using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media.Animation;
using System.Windows.Threading;
using HeRoShield.Core;
using HeRoShield.Api;

namespace HeRoShield;

public partial class MainWindow : Window
{
    private string _pin = "";
    private string? _api;
    private DispatcherTimer? _dotTimer;
    private DispatcherTimer? _elapsedTimer;
    private DateTime _scanStart;

    public MainWindow()
    {
        InitializeComponent();
        ParseArgs();
        // Always ask for the PIN, unless staff pre-supplied one (--pin / pin.txt).
        bool havePin = !string.IsNullOrWhiteSpace(_pin) && !_pin.StartsWith("TEST");
        PinRow.Visibility = havePin ? Visibility.Collapsed : Visibility.Visible;
        AnimateDot();
    }

    // --pin ABCD1234 --api https://backend   (or HERO_API env var)
    private void ParseArgs()
    {
        var args = Environment.GetCommandLineArgs();
        for (int i = 1; i < args.Length - 1; i++)
        {
            if (args[i] == "--pin") _pin = args[i + 1];
            if (args[i] == "--api") _api = args[i + 1];
        }
        _api ??= Environment.GetEnvironmentVariable("HERO_API");

        // per-player download link: PIN (and the site it came from) baked into this .exe
        var (embPin, embApi) = Embedded.Read(Environment.ProcessPath);
        if (string.IsNullOrWhiteSpace(_pin) && !string.IsNullOrWhiteSpace(embPin)) _pin = embPin!;

        // API can also be set once by placing api.txt next to the exe (your backend URL)
        if (string.IsNullOrWhiteSpace(_api))
        {
            try
            {
                var a = Path.Combine(AppContext.BaseDirectory, "api.txt");
                if (File.Exists(a)) _api = File.ReadAllText(a).Trim();
            }
            catch { }
        }
        if (string.IsNullOrWhiteSpace(_api) && !string.IsNullOrWhiteSpace(embApi)) _api = embApi;
        // Baked-in default so the client only needs the single .exe (no api.txt).
        if (string.IsNullOrWhiteSpace(_api))
            _api = "https://southside-ecjn.onrender.com";

        // PIN can come from pin.txt (per-player download) too
        if (string.IsNullOrWhiteSpace(_pin))
        {
            try
            {
                var p = Path.Combine(AppContext.BaseDirectory, "pin.txt");
                if (File.Exists(p)) _pin = File.ReadAllText(p).Trim();
            }
            catch { }
        }
        if (string.IsNullOrWhiteSpace(_pin)) _pin = "TEST" + new Random().Next(1000, 9999);
    }

    private void AnimateDot()
    {
        _dotTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(700) };
        bool on = true;
        _dotTimer.Tick += (_, _) => { StatusDot.Opacity = on ? 0.4 : 1.0; on = !on; };
        _dotTimer.Start();
    }

    private void Window_Drag(object sender, MouseButtonEventArgs e)
    {
        if (e.ButtonState == MouseButtonState.Pressed) DragMove();
    }

    private void Close_Click(object sender, RoutedEventArgs e) => Close();
    private void Deny_Click(object sender, RoutedEventArgs e) => Close();

    private async void Accept_Click(object sender, RoutedEventArgs e)
    {
        // if the PIN box is visible, use what the player typed
        if (PinRow.Visibility == Visibility.Visible)
        {
            var typed = (PinInput.Text ?? "").Trim();
            if (typed.Length < 4) { PinInput.BorderBrush = (System.Windows.Media.Brush)FindResource("Bad"); return; }
            _pin = typed;
        }

        // check the PIN with the site first, so a wrong PIN does not waste a 3-minute scan
        if (!string.IsNullOrWhiteSpace(_api) && !_pin.StartsWith("TEST"))
        {
            AcceptBtn.IsEnabled = false;
            var oldText = AcceptBtn.Content;
            AcceptBtn.Content = "Checking PIN…";
            var check = await new Client(_api!).ValidatePinAsync(_pin);
            AcceptBtn.Content = oldText;
            AcceptBtn.IsEnabled = true;
            if (check is PinCheck.Unknown or PinCheck.Used)
            {
                PinRow.Visibility = Visibility.Visible;
                PinLabel.Text = check == PinCheck.Unknown
                    ? $"PIN {_pin} NOT FOUND — check it with staff"
                    : $"PIN {_pin} WAS ALREADY USED — ask staff for a new link";
                PinLabel.Foreground = (System.Windows.Media.Brush)FindResource("Bad");
                PinInput.BorderBrush = (System.Windows.Media.Brush)FindResource("Bad");
                PinInput.Text = "";
                PinInput.Focus();
                return;
            }
        }

        Consent.Visibility = Visibility.Collapsed;
        await RunScanAsync();
    }

    private async System.Threading.Tasks.Task RunScanAsync()
    {
        SetStatus("Starting scan…");
        _ = LoadBackgroundAsync();   // staff-set background (fetched by PIN), fades in
        OpenDiscordCheck();          // player connects Discord in the browser while the scan runs
        StartElapsed();

        // live phase text that changes as the real scan advances (like napse)
        var progress = new Progress<(int pct, string status)>(p =>
        {
            SetPct(p.pct);
            SetStatus(p.status);
        });

        // built-in list (embedded in the exe / editable signatures.json next to it)
        List<Signatures.Sig> sigs = Signatures.Load(AppContext.BaseDirectory);
        // PLUS the operator's live signatures (names + domains + hashes) added on the
        // dashboard, fetched by PIN — so renamed loaders are caught by domain / hash.
        if (!string.IsNullOrWhiteSpace(_api) && !string.IsNullOrWhiteSpace(_pin))
        {
            try
            {
                using var http = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(8) };
                var json = await http.GetStringAsync(
                    _api!.TrimEnd('/') + "/api/scanner-sigs?pin=" + Uri.EscapeDataString(_pin));
                var live = Signatures.FromJson(json);
                if (live.Count > 0) sigs.AddRange(live);
            }
            catch { }
        }

        ScanReport report = await System.Threading.Tasks.Task.Run(() =>
            new ForensicScan(sigs).Run(_pin, progress));

        // Explicit opt-in: the user sees that these records are included in the staff report.
        if (BrowserOptIn.IsChecked == true)
        {
            var browser = await System.Threading.Tasks.Task.Run(() => BrowserAudit.ReadLocal());
            report.BrowserSearchHistory = browser.History;
            report.BrowserDownloads = browser.Downloads;
            BrowserHistoryText.Text = browser.History.Count == 0 ? "No search history found (or browser database locked)." :
                string.Join("\n", browser.History.Select(x => $"[{x.Browser} / {x.Profile}] {x.Title} — {x.Url} ({x.Date})"));
            BrowserDownloadsText.Text = browser.Downloads.Count == 0 ? "No download history found (or browser database locked)." :
                string.Join("\n", browser.Downloads.Select(x => $"[{x.Browser} / {x.Profile}] {x.FileName} — {x.Source} ({x.Date})"));
        }

        // take one screenshot of the player's screen (consented screenshare)
        report.ScreenshotJpegBase64 = CaptureScreenJpeg();

        // Do not expose detection details in the client UI; the staff dashboard handles review.
        Toast.Visibility = Visibility.Collapsed;

        // save a local copy
        try
        {
            var outPath = Path.Combine(AppContext.BaseDirectory, $"hero-report-{_pin}.json");
            File.WriteAllText(outPath, System.Text.Json.JsonSerializer.Serialize(report,
                new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
        }
        catch { }

        // The completion countdown starts ONLY after confirmed upload success.
        // An upload failure must remain visible so the user can ask staff to retry.
        bool uploaded = false;
        string failure = "No server endpoint is configured.";
        if (!string.IsNullOrWhiteSpace(_api))
        {
            var client = new Client(_api!);
            uploaded = await client.SubmitAsync(report);
            if (!uploaded) failure = client.LastError ?? "Upload failed.";
        }

        _dotTimer?.Stop();
        _elapsedTimer?.Stop();
        SetPct(100);
        await System.Threading.Tasks.Task.Delay(700);
        _pctTimer?.Stop();
        Dispatcher.Invoke(() => RenderPct(100));
        StatusDot.Opacity = 1;
        StatusDot.Fill = (System.Windows.Media.Brush)FindResource("Accent");
        ResultsPanel.Visibility = Visibility.Collapsed;
        Toast.Visibility = Visibility.Collapsed;

        if (!uploaded)
        {
            SetStatus("Scan finished, but report upload failed. Contact staff; do not close until the issue is resolved.");
            System.Windows.MessageBox.Show(
                "The scan finished, but the report was NOT delivered to staff.\n\n" +
                failure + "\n\nPlease contact staff to retry the scan.",
                "HeRoShield - Upload failed", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        // Keep original scan UI at 100% for 10 seconds; no new overlay or popup.
        SetStatus("100%");
        await System.Threading.Tasks.Task.Delay(TimeSpan.FromSeconds(10));
        Close();
    }

    // opens /verify?pin=… in the default browser: the player links the Discord they play with,
    // so staff see which (cheat) servers that account is in. Fails silently without a browser.
    private void OpenDiscordCheck()
    {
        if (string.IsNullOrWhiteSpace(_api) || string.IsNullOrWhiteSpace(_pin)) return;
        try
        {
            var url = _api!.TrimEnd('/') + "/verify?pin=" + Uri.EscapeDataString(_pin);
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch { }
    }

    // fetch the staff-set background for this PIN and show it behind the scan UI
    private async System.Threading.Tasks.Task LoadBackgroundAsync()
    {
        if (string.IsNullOrWhiteSpace(_api) || string.IsNullOrWhiteSpace(_pin)) return;
        try
        {
            using var http = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(8) };
            var json = await http.GetStringAsync(_api!.TrimEnd('/') + "/api/scanner-bg?pin=" + Uri.EscapeDataString(_pin));
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            var bg = doc.RootElement.TryGetProperty("bg", out var v) ? v.GetString() : null;
            if (string.IsNullOrWhiteSpace(bg)) return;
            var bytes = await http.GetByteArrayAsync(bg);
            Dispatcher.Invoke(() =>
            {
                var bmp = new System.Windows.Media.Imaging.BitmapImage();
                bmp.BeginInit();
                bmp.CacheOption = System.Windows.Media.Imaging.BitmapCacheOption.OnLoad;
                bmp.StreamSource = new MemoryStream(bytes);
                bmp.EndInit();
                BgImage.Source = bmp;
                BgImage.BeginAnimation(OpacityProperty, new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(450)));
                BgScrim.Background = new System.Windows.Media.SolidColorBrush(
                    System.Windows.Media.Color.FromArgb(0x96, 0x05, 0x06, 0x09)); // darken for readability
            });
        }
        catch { }
    }

    // live mm:ss timer so the scan feels real-time
    private void StartElapsed()
    {
        _scanStart = DateTime.Now;
        _elapsedTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(500) };
        _elapsedTimer.Tick += (_, _) =>
        {
            var t = DateTime.Now - _scanStart;
            ElapsedText.Text = $"{(int)t.TotalMinutes:00}:{t.Seconds:00}";
        };
        _elapsedTimer.Start();
    }

    // Show the full result inside the app so it is obviously real.
    private void ShowResults(ScanReport r, string sent)
    {
        var s = r.System;
        var vbox = (System.Windows.Media.Brush)FindResource(
            r.Verdict == "cheating" ? "Bad" : r.Verdict == "suspicious" ? "Muted" : "Accent");
        VerdictText.Foreground = vbox;
        VerdictBox.Background = new System.Windows.Media.SolidColorBrush(
            ((System.Windows.Media.SolidColorBrush)vbox).Color) { Opacity = 0.12 };
        VerdictText.Text = "VERDICT: " + r.Verdict.ToUpperInvariant();

        var sb = new System.Text.StringBuilder();
        sb.AppendLine($"System      : {s.Os} (build {s.WinBuild})");
        sb.AppendLine($"CPU         : {s.Cpu}");
        sb.AppendLine($"GPU         : {s.Gpu}");
        sb.AppendLine($"RAM         : {s.RamGb}");
        sb.AppendLine($"Boot time   : {s.BootTime}");
        sb.AppendLine($"HWID        : {s.Hwid}");
        sb.AppendLine($"FiveM       : {s.FiveMLastLaunch}");
        sb.AppendLine($"Recycle     : {s.RecycleModified}");
        if (r.SteamAccounts.Count > 0) sb.AppendLine($"Steam       : {string.Join(", ", r.SteamAccounts)}");
        if (!string.IsNullOrEmpty(r.DiscordId)) sb.AppendLine($"Discord ID  : {r.DiscordId}");
        sb.AppendLine();
        sb.AppendLine($"Files scanned : {r.FilesScanned}");
        sb.AppendLine($"Mods found    : {r.Mods.Count}");
        sb.AppendLine($"Scan time     : {r.DurationSeconds}s");
        sb.AppendLine();

        if (r.Detections.Count == 0)
            sb.AppendLine("Detections  : none — no known cheat files or traces found.");
        else
        {
            sb.AppendLine($"Detections  : {r.Detections.Count}");
            foreach (var d in r.Detections.Take(20))
                sb.AppendLine($"  [{d.Severity}] {d.File} — {d.Signature}"
                    + (d.Features.Count > 0 ? "  (" + string.Join(", ", d.Features) + ")" : ""));
        }
        if (r.Warnings.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine($"Warnings    : {r.Warnings.Count}");
            foreach (var w in r.Warnings.Take(10)) sb.AppendLine($"  ! {w.Title}");
        }
        sb.AppendLine();
        sb.AppendLine(sent);

        ResultsText.Text = sb.ToString();
        ResultsPanel.Visibility = Visibility.Visible;
    }

    // Capture the primary screen, downscale, return as a small JPEG base64.
    private static string? CaptureScreenJpeg()
    {
        try
        {
            var w = (int)SystemParameters.PrimaryScreenWidth;
            var h = (int)SystemParameters.PrimaryScreenHeight;
            if (w <= 0 || h <= 0) return null;
            using var full = new System.Drawing.Bitmap(w, h);
            using (var g = System.Drawing.Graphics.FromImage(full))
                g.CopyFromScreen(0, 0, 0, 0, full.Size);

            // downscale to max 1280 wide to keep the report small
            double scale = Math.Min(1.0, 1280.0 / w);
            int nw = (int)(w * scale), nh = (int)(h * scale);
            using var small = new System.Drawing.Bitmap(full, nw, nh);

            var enc = System.Drawing.Imaging.ImageCodecInfo.GetImageEncoders()
                .First(c => c.FormatID == System.Drawing.Imaging.ImageFormat.Jpeg.Guid);
            var ps = new System.Drawing.Imaging.EncoderParameters(1);
            ps.Param[0] = new System.Drawing.Imaging.EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 70L);

            using var ms = new MemoryStream();
            small.Save(ms, enc, ps);
            return "data:image/jpeg;base64," + Convert.ToBase64String(ms.ToArray());
        }
        catch { return null; }
    }

    private void SetStatus(string s) => Dispatcher.Invoke(() => StatusText.Text = s);

    private double _targetPct, _displayPct;
    private DispatcherTimer? _pctTimer;

    // Smoothly glide the shown percentage toward the latest target so it never jumps.
    private void SetPct(int pct) => Dispatcher.Invoke(() =>
    {
        _targetPct = Math.Max(_targetPct, pct); // never go backwards
        if (_pctTimer == null)
        {
            _pctTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(33) };
            _pctTimer.Tick += (_, _) =>
            {
                // ease toward the target, but always creep forward a little so it feels alive
                double step = Math.Max(0.06, (_targetPct - _displayPct) * 0.10);
                if (_displayPct < _targetPct) _displayPct = Math.Min(_targetPct, _displayPct + step);
                RenderPct(_displayPct);
            };
            _pctTimer.Start();
        }
    });

    private void RenderPct(double v)
    {
        int shown = (int)Math.Round(v);
        PctText.Text = shown + "%";
        DrawArc(shown);
        double full = 0;
        if (ProgressFill.Parent is FrameworkElement track) full = track.ActualWidth;
        if (full <= 0) full = 636;
        ProgressFill.Width = full * v / 100.0;
    }

    // draw the circular progress arc for the given percentage (center 85,85 in the 170 grid)
    private void DrawArc(int pct)
    {
        if (ProgressArc == null) return;
        const double cx = 85, cy = 85, R = 58;
        double sweep = 360.0 * Math.Max(0, Math.Min(100, pct)) / 100.0;
        if (sweep <= 0.1) { ProgressArc.Data = null; return; }
        if (sweep >= 359.9) sweep = 359.9;
        double a0 = -90 * Math.PI / 180.0;
        double a1 = (-90 + sweep) * Math.PI / 180.0;
        var p0 = new System.Windows.Point(cx + R * Math.Cos(a0), cy + R * Math.Sin(a0));
        var p1 = new System.Windows.Point(cx + R * Math.Cos(a1), cy + R * Math.Sin(a1));
        var fig = new System.Windows.Media.PathFigure { StartPoint = p0, IsClosed = false };
        fig.Segments.Add(new System.Windows.Media.ArcSegment(
            p1, new System.Windows.Size(R, R), 0, sweep > 180,
            System.Windows.Media.SweepDirection.Clockwise, true));
        var geo = new System.Windows.Media.PathGeometry();
        geo.Figures.Add(fig);
        ProgressArc.Data = geo;
    }

    private void ShowToast(string title, string sub) => Dispatcher.Invoke(() =>
    {
        ToastTitle.Text = title;
        ToastSub.Text = sub;
        Toast.Visibility = Visibility.Visible;
        var timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(3.5) };
        timer.Tick += (_, _) => { Toast.Visibility = Visibility.Collapsed; timer.Stop(); };
        timer.Start();
    });
}
