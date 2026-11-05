using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Management;
using System.ServiceProcess;
using Microsoft.Win32;

namespace HeRoShield.Core;

/// <summary>
/// v4.0 — Read-only forensic PC check for a FiveM screenshare.
/// Inspects 30+ Windows artifacts: running processes, execution traces
/// (Prefetch, BAM, PCA, UserAssist, MUICache, AmCache, ShimCache),
/// startup persistence (Run keys, Startup folder, scheduled tasks),
/// loaded kernel drivers, active network connections, event logs,
/// hosts-file tampering, firewall rules, DNS cache, registry hooks,
/// alternate data streams, and the FiveM / common drop folders.
/// Matches filenames, hashes and domains against the operator's signature list.
/// Never reads process memory, changes files, or installs anything.
/// </summary>
public sealed class ForensicScan
{
    private readonly List<Signatures.Sig> _sigs;
    private readonly List<string> _artifacts = new();
    private readonly List<SuspiciousFile> _suspicious = new();
    private int _filesScanned;
    private DateTime? _winInstall;
    private int _recycleCount = -1;
    private bool _amcacheTiny;

    public ForensicScan(List<Signatures.Sig> sigs) => _sigs = sigs;

    public ScanReport Run(string pin, IProgress<(int pct, string status)>? progress = null)
    {
        var sw = Stopwatch.StartNew();
        var report = new ScanReport { Pin = pin };
        void P(int pct, string s) => progress?.Report((pct, s));
        void Hold(int ms = 750) => System.Threading.Thread.Sleep(ms);

        P(2, "Loading modules…"); Hold(900);
        P(5, "Collecting system information…");
        report.System = CollectSystemInfo(); Hold();

        P(10, "Detecting virtual machines…");
        DetectVirtualMachine(report); Hold();

        P(14, "Scanning active processes…");
        report.Detections.AddRange(ScanRunningProcesses());
        ScanRunningAnalysisTools(report); Hold();

        P(18, "Checking network / DNS for cheat domains…");
        report.Detections.AddRange(ScanNetworkIndicators()); Hold();

        P(22, "Scanning active network connections…");
        report.NetworkConnections = ScanNetworkConnections(report); Hold();

        P(26, "Reading execution history…");
        report.Detections.AddRange(ScanPrefetch()); Hold();

        P(30, "Reading background activity…");
        report.Detections.AddRange(ScanBam()); Hold();

        P(34, "Checking Temp & Downloads…");
        report.Detections.AddRange(ScanDropFolders()); Hold();

        P(38, "Scanning the FiveM folder…");
        ScanFiveM(report); Hold();

        P(42, "Scanning startup & persistence…");
        ScanStartupPersistence(report); Hold();

        P(46, "Scanning scheduled tasks…");
        ScanScheduledTasks(report); Hold();

        P(50, "Enumerating loaded drivers…");
        ScanLoadedDrivers(report); Hold();

        P(54, "Reading recent file access…");
        report.RecentFiles = ScanRecentFiles(report); Hold();

        // deep sweep of every drive — this is the slow, thorough part
        P(58, "Deep-scanning drives & files…");
        ScanWholeDisk(report, progress);

        P(76, "Validating services & integrity…");
        report.Warnings.AddRange(ScanWarnings(report.System)); Hold();

        P(79, "Reading deleted files…");
        report.DeletedFiles = ScanRecycleBin(); Hold();

        P(82, "Building execution timeline…");
        report.ExecutedPrograms = CollectExecutedPrograms(); Hold();

        // a KNOWN cheat that ran anywhere on the PC (even if since deleted) is a detection
        foreach (var e in report.ExecutedPrograms.Where(x => x.Flagged))
        {
            var sig = _sigs.FirstOrDefault(s => s.FileNames.Contains(e.Name.ToLowerInvariant()));
            bool gone = false; try { gone = !File.Exists(e.Path); } catch { }
            if (sig == null)
            {
                var w = CheatWordIn(Path.GetFileNameWithoutExtension(e.Name));
                if (w == null) continue;
                report.Detections.Add(new Detection
                {
                    File = e.Name, Signature = $"Cheat-named program ran (\"{w}\")", Path = e.Path,
                    Method = DetectMethod.Prefetch, Severity = Severity.Medium, When = e.LastRun, Deleted = gone,
                    Features = new() { "Executed" },
                    Explain = $"Windows ({e.Source}) recorded a program named like a cheat running on this PC"
                              + (gone ? " — the file has since been deleted." : ".")
                });
                continue;
            }
            report.Detections.Add(Det(e.Name, sig, e.Path, DetectMethod.Prefetch, e.LastRun,
                $"A known cheat was recorded running on this PC by {e.Source}"
                + (gone ? " — the file is now deleted." : "."), gone));
        }

        P(85, "Reading PowerShell & command history…");
        report.Commands = ScanCommandHistory(report); Hold();

        P(87, "Checking for bypass / cleaning…");
        ScanBypassTells(report); Hold();

        P(89, "Checking antivirus, exclusions & injection hooks…");
        ScanAntivirusAndHooks(report); Hold();

        P(91, "Reading USB devices & browsers…");
        report.UsbDevices = ReadUsbDevices();
        report.Browsers = ReadBrowsers(); Hold();

        P(92, "Reading linked accounts…");
        report.SteamAccounts = ReadSteamAccounts();
        report.DiscordId = ReadDiscordId();
        report.EpicAccounts = ReadEpicAccounts();
        report.RockstarAccounts = ReadRockstarAccounts(); Hold();

        P(93, "Checking hosts file & firewall…");
        ScanHostsFile(report);
        ScanFirewallRules(report); Hold();

        P(94, "Reading Windows Event Log…");
        ScanEventLog(report); Hold();

        P(95, "Scanning for alternate data streams…");
        ScanAlternateDataStreams(report); Hold();

        P(96, "Checking Volume Shadow Copies…");
        ScanVSSAndAntiForensic(report); Hold();

        // de-duplicate detections
        report.Detections = report.Detections
            .GroupBy(d => d.File + "|" + d.Method)
            .Select(g => g.First())
            .ToList();

        report.Suspicious = _suspicious.GroupBy(s => s.Path).Select(g => g.First()).Take(300).ToList();
        report.Mods = report.Mods.GroupBy(m => m.Path).Select(g => g.First())
            .OrderByDescending(m => m.SizeMb).Take(1000).ToList();
        report.ArtifactsCollected = _artifacts;
        report.FilesScanned = _filesScanned;
        sw.Stop();
        report.DurationSeconds = Math.Round(sw.Elapsed.TotalSeconds, 1);
        P(98, "Compiling results…"); Hold(900);
        P(100, "Finalizing report…"); Hold(600);
        return report;
    }

    // ================================================================
    //  SYSTEM INFORMATION
    // ================================================================
    private SystemInfo CollectSystemInfo()
    {
        var si = new SystemInfo();
        si.SystemTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

        try
        {
            foreach (ManagementObject os in new ManagementObjectSearcher(
                "SELECT Caption, BuildNumber, LastBootUpTime FROM Win32_OperatingSystem").Get())
            {
                si.Os = os["Caption"]?.ToString()?.Trim() ?? "Windows";
                si.WinBuild = os["BuildNumber"]?.ToString() ?? "";
                var boot = ManagementDateTimeConverter.ToDateTime(os["LastBootUpTime"].ToString());
                si.BootTime = Ago(boot);
                si.Uptime = $"{(int)(DateTime.Now - boot).TotalHours}h {(DateTime.Now - boot).Minutes}m";
            }
        }
        catch { si.Os = "Windows"; }

        try
        {
            foreach (ManagementObject cpu in new ManagementObjectSearcher("SELECT Name FROM Win32_Processor").Get())
                si.Cpu = cpu["Name"]?.ToString()?.Trim() ?? "";
        }
        catch { }

        try
        {
            var gpus = new List<string>();
            foreach (ManagementObject g in new ManagementObjectSearcher("SELECT Name FROM Win32_VideoController").Get())
            { var n = g["Name"]?.ToString()?.Trim(); if (!string.IsNullOrEmpty(n)) gpus.Add(n); }
            si.Gpu = string.Join(", ", gpus);
        }
        catch { }

        try
        {
            foreach (ManagementObject cs in new ManagementObjectSearcher("SELECT TotalPhysicalMemory FROM Win32_ComputerSystem").Get())
            {
                if (ulong.TryParse(cs["TotalPhysicalMemory"]?.ToString(), out var bytes))
                    si.RamGb = Math.Round(bytes / 1073741824.0) + " GB";
            }
        }
        catch { }

        try
        {
            foreach (ManagementObject b in new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BIOS").Get())
                si.Hwid = Hash(b["SerialNumber"]?.ToString() ?? Environment.MachineName);
        }
        catch { si.Hwid = Hash(Environment.MachineName); }

        try
        {
            foreach (ManagementObject p in new ManagementObjectSearcher("SELECT UUID FROM Win32_ComputerSystemProduct").Get())
                si.Uuid = p["UUID"]?.ToString() ?? "";
        }
        catch { }

        try { si.Sid = System.Security.Principal.WindowsIdentity.GetCurrent().User?.Value ?? ""; }
        catch { }

        // timezone
        try { si.TimeZone = TimeZoneInfo.Local.DisplayName; } catch { }

        // .NET version
        try { si.DotNetVersion = Environment.Version.ToString(); } catch { }

        // Secure Boot
        try
        {
            using var k = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\SecureBoot\State");
            si.SecureBoot = k?.GetValue("UEFISecureBootEnabled") is int v && v == 1;
        }
        catch { }

        // ---- hardware ban identifiers ----
        try
        {
            foreach (ManagementObject mb in new ManagementObjectSearcher(
                "SELECT Manufacturer, Product, SerialNumber FROM Win32_BaseBoard").Get())
            {
                var man = mb["Manufacturer"]?.ToString()?.Trim();
                var prod = mb["Product"]?.ToString()?.Trim();
                si.Motherboard = string.Join(" ", new[] { man, prod }.Where(x => !string.IsNullOrEmpty(x)));
                var serial = mb["SerialNumber"]?.ToString()?.Trim();
                if (!string.IsNullOrEmpty(serial)) si.BiosSerial = serial;
            }
        }
        catch { }

        try
        {
            var serials = new List<string>();
            foreach (ManagementObject d in new ManagementObjectSearcher("SELECT SerialNumber, Model FROM Win32_DiskDrive").Get())
            {
                var sn = d["SerialNumber"]?.ToString()?.Trim();
                if (!string.IsNullOrEmpty(sn)) serials.Add(sn);
            }
            si.DiskSerials = string.Join(", ", serials.Distinct().Take(6));
        }
        catch { }

        try
        {
            var macs = new List<string>();
            foreach (var nic in System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces())
            {
                if (nic.NetworkInterfaceType == System.Net.NetworkInformation.NetworkInterfaceType.Loopback) continue;
                if (nic.NetworkInterfaceType == System.Net.NetworkInformation.NetworkInterfaceType.Tunnel) continue;
                var mac = nic.GetPhysicalAddress()?.ToString();
                if (!string.IsNullOrEmpty(mac) && mac.Length == 12)
                    macs.Add(string.Join(":", Enumerable.Range(0, 6).Select(i => mac.Substring(i * 2, 2))));
            }
            si.MacAddresses = string.Join(", ", macs.Distinct().Take(6));
        }
        catch { }

        try
        {
            using var k = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Cryptography");
            si.MachineGuid = k?.GetValue("MachineGuid")?.ToString() ?? "";
        }
        catch { }

        // generic spoofer tell
        try
        {
            bool Blank(string v) => string.IsNullOrWhiteSpace(v)
                || v.Equals("default string", StringComparison.OrdinalIgnoreCase)
                || v.Equals("none", StringComparison.OrdinalIgnoreCase)
                || v.Equals("0", StringComparison.OrdinalIgnoreCase)
                || v.Contains("o.e.m", StringComparison.OrdinalIgnoreCase)
                || v.Contains("to be filled", StringComparison.OrdinalIgnoreCase)
                || v.TrimStart('0').Length == 0;
            int blanks = new[] { si.BiosSerial, si.DiskSerials, si.Uuid, si.Motherboard }.Count(Blank);
            if (blanks >= 2) si.SpooferFlag = "possible HWID spoof (identifiers blanked/placeholder)";
        }
        catch { }

        // Windows install date
        try
        {
            using var k = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion");
            if (k?.GetValue("InstallDate") is int unix)
            {
                var when = DateTimeOffset.FromUnixTimeSeconds(unix).LocalDateTime;
                si.WindowsInstall = Ago(when);
                _winInstall = when;
            }
        }
        catch { }

        // FiveM last launch
        foreach (var root in FiveMRoots())
        {
            try { if (Directory.Exists(root)) { si.FiveMLastLaunch = Ago(Directory.GetLastWriteTime(root)); break; } } catch { }
        }

        // recycle bin
        try
        {
            var rb = new DirectoryInfo(@"C:\$Recycle.Bin");
            if (rb.Exists)
            {
                var items = rb.GetDirectories()
                    .SelectMany(d => { try { return d.GetFiles("$R*"); } catch { return Array.Empty<FileInfo>(); } })
                    .ToList();
                _recycleCount = items.Count;
                si.RecycleModified = items.Count == 0 ? "empty"
                    : $"{items.Count} items, newest {Ago(items.Max(f => f.LastWriteTime))}";
            }
        }
        catch { }

        return si;
    }

    // ================================================================
    //  v4.0 — VIRTUAL MACHINE DETECTION
    // ================================================================
    private void DetectVirtualMachine(ScanReport report)
    {
        var si = report.System;
        try
        {
            foreach (ManagementObject cs in new ManagementObjectSearcher(
                "SELECT Manufacturer, Model FROM Win32_ComputerSystem").Get())
            {
                var mfg = (cs["Manufacturer"]?.ToString() ?? "").ToLowerInvariant();
                var mod = (cs["Model"]?.ToString() ?? "").ToLowerInvariant();

                if (mfg.Contains("vmware") || mod.Contains("vmware"))
                { si.IsVirtualMachine = true; si.VmPlatform = "VMware"; }
                else if (mfg.Contains("microsoft") && mod.Contains("virtual"))
                { si.IsVirtualMachine = true; si.VmPlatform = "Hyper-V"; }
                else if (mod.Contains("virtualbox") || mfg.Contains("innotek"))
                { si.IsVirtualMachine = true; si.VmPlatform = "VirtualBox"; }
                else if (mfg.Contains("qemu") || mfg.Contains("bochs"))
                { si.IsVirtualMachine = true; si.VmPlatform = "QEMU/KVM"; }
                else if (mfg.Contains("xen"))
                { si.IsVirtualMachine = true; si.VmPlatform = "Xen"; }
            }

            // also check BIOS for VM strings
            if (!si.IsVirtualMachine)
            {
                foreach (ManagementObject bios in new ManagementObjectSearcher(
                    "SELECT SMBIOSBIOSVersion, Manufacturer FROM Win32_BIOS").Get())
                {
                    var ver = (bios["SMBIOSBIOSVersion"]?.ToString() ?? "").ToLowerInvariant();
                    var mfg = (bios["Manufacturer"]?.ToString() ?? "").ToLowerInvariant();
                    if (ver.Contains("vbox") || mfg.Contains("vbox"))
                    { si.IsVirtualMachine = true; si.VmPlatform = "VirtualBox"; }
                    else if (ver.Contains("vmware") || mfg.Contains("vmware"))
                    { si.IsVirtualMachine = true; si.VmPlatform = "VMware"; }
                }
            }

            // check for VM-specific services
            if (!si.IsVirtualMachine)
            {
                var vmServices = new[] { "vmtools", "vmhgfs", "vboxservice", "vboxguest", "vmmouse" };
                try
                {
                    var svcs = ServiceController.GetServices().Select(s => s.ServiceName.ToLowerInvariant()).ToHashSet();
                    var hit = vmServices.FirstOrDefault(s => svcs.Contains(s));
                    if (hit != null)
                    { si.IsVirtualMachine = true; si.VmPlatform = hit.StartsWith("vm") ? "VMware" : "VirtualBox"; }
                }
                catch { }
            }

            if (si.IsVirtualMachine)
            {
                _artifacts.Add("VM detection");
                report.Warnings.Add(new Warning
                {
                    Category = "Evasion",
                    Title = $"Running inside a virtual machine ({si.VmPlatform})",
                    Detail = "The PC check is running inside a VM — some cheaters use VMs to isolate cheat traces from the host."
                });
            }
        }
        catch { }
    }

    // ================================================================
    //  RUNNING PROCESSES
    // ================================================================
    private IEnumerable<Detection> ScanRunningProcesses()
    {
        _artifacts.Add("Running processes");
        var hits = new List<Detection>();
        Process[] procs; try { procs = Process.GetProcesses(); } catch { return hits; }
        foreach (var p in procs)
        {
            string exe; try { exe = (p.ProcessName + ".exe").ToLowerInvariant(); } catch { continue; }
            var sig = _sigs.FirstOrDefault(s => s.FileNames.Contains(exe));
            if (sig != null)
                hits.Add(Det(exe, sig, SafePath(p), DetectMethod.RunningProcess, "running now",
                    "This program is running right now and matches a known cheat signature.", false));
        }

        // v4.0: cheat-making tools running right now (these ARE cheat tools → detection)
        var cheatTools = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            {"cheatengine-x86_64.exe", "Cheat Engine"},
            {"cheatengine-x86_64-sse4-avx2.exe", "Cheat Engine"},
            {"cheatengine-i386.exe", "Cheat Engine"},
            {"cheatengine.exe", "Cheat Engine"},
            {"extremeinjector.exe", "Extreme Injector"},
            {"extreme injector v3.exe", "Extreme Injector"},
            {"xenos.exe", "Xenos injector"},
            {"xenos64.exe", "Xenos injector"},
            {"reclass.net.exe", "ReClass.NET"},
            {"reclass.exe", "ReClass"},
            {"reclassex.exe", "ReClassEx"},
            {"kdmapper.exe", "kdmapper (driver mapper)"},
            {"kdu.exe", "KDU (driver loader)"},
        };
        foreach (var p in procs)
        {
            try
            {
                var exe = (p.ProcessName + ".exe").ToLowerInvariant();
                if (cheatTools.TryGetValue(exe, out var label))
                    hits.Add(new Detection
                    {
                        File = exe, Signature = label + " (running)", Path = SafePath(p),
                        Method = DetectMethod.RunningProcess, Severity = Severity.Medium,
                        When = "running now", Features = new() { "Cheat tool" },
                        Explain = $"{label} is running right now — this tool is used to read/write game memory or inject cheats."
                    });
            }
            catch { }
        }
        return hits;
    }
    // v4.0: debuggers / RE / macro tools — legit people use them too, so WARNING only
    private void ScanRunningAnalysisTools(ScanReport report)
    {
        var tools = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            {"x64dbg.exe", "x64dbg debugger"}, {"x32dbg.exe", "x32dbg debugger"},
            {"ollydbg.exe", "OllyDbg debugger"}, {"ida.exe", "IDA Pro"}, {"ida64.exe", "IDA Pro"},
            {"ghidra.exe", "Ghidra"}, {"dnspy.exe", "dnSpy"}, {"de4dot.exe", "de4dot"},
            {"processhacker.exe", "Process Hacker"}, {"systeminformer.exe", "System Informer"},
            {"httpdebugger.exe", "HTTP Debugger"}, {"httpdebuggerui.exe", "HTTP Debugger"},
            {"autohotkey.exe", "AutoHotkey"}, {"autohotkey32.exe", "AutoHotkey"},
            {"autohotkey64.exe", "AutoHotkey"}, {"autohotkeyux.exe", "AutoHotkey"},
        };
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        Process[] procs; try { procs = Process.GetProcesses(); } catch { return; }
        foreach (var p in procs)
        {
            try
            {
                var exe = (p.ProcessName + ".exe").ToLowerInvariant();
                if (tools.TryGetValue(exe, out var label) && seen.Add(label))
                    report.Warnings.Add(new Warning
                    {
                        Category = label == "AutoHotkey" ? "Macro" : "Tools",
                        Title = $"{label} is running during the check",
                        Detail = label == "AutoHotkey"
                            ? "A macro tool is running — can be used for no-recoil / rapid-fire scripts. Ask the player what script is loaded."
                            : "A debugging / reverse-engineering tool is running — used to analyse or bypass game protection."
                    });
            }
            catch { }
        }
    }

    private static string SafePath(Process p) { try { return p.MainModule?.FileName ?? "(unknown)"; } catch { return "(access denied)"; } }

    // ================================================================
    //  NETWORK INDICATORS (DNS CACHE)
    // ================================================================
    private IEnumerable<Detection> ScanNetworkIndicators()
    {
        var hits = new List<Detection>();
        var withDomains = _sigs.Where(s => s.Domains.Count > 0).ToList();
        if (withDomains.Count == 0) return hits;

        var seenDomains = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        try
        {
            var psi = new ProcessStartInfo("ipconfig", "/displaydns")
            {
                RedirectStandardOutput = true, UseShellExecute = false, CreateNoWindow = true,
                StandardOutputEncoding = System.Text.Encoding.UTF8
            };
            using var p = Process.Start(psi);
            if (p != null)
            {
                var outp = p.StandardOutput.ReadToEnd();
                p.WaitForExit(8000);
                _artifacts.Add("DNS cache");
                foreach (System.Text.RegularExpressions.Match m in
                         System.Text.RegularExpressions.Regex.Matches(outp, @"[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+\.[A-Za-z]{2,}"))
                    seenDomains.Add(m.Value.ToLowerInvariant());
            }
        }
        catch { }

        foreach (var sig in withDomains)
            foreach (var dom in sig.Domains)
                if (seenDomains.Any(x => x == dom || x.EndsWith("." + dom) || x.Contains(dom)))
                {
                    hits.Add(new Detection
                    {
                        File = dom, Signature = sig.Name + " (network)", Path = "DNS cache: " + dom,
                        Method = DetectMethod.RunningProcess, Severity = Severity.High, When = "recent",
                        Features = new List<string>(sig.Features) { "C2 domain" },
                        Explain = $"This PC contacted \"{dom}\", a domain used by the cheat \"{sig.Name}\" — a renamed loader still phones home here."
                    });
                    break;
                }
        return hits;
    }

    // ================================================================
    //  v4.0 — ACTIVE NETWORK CONNECTIONS
    // ================================================================
    private List<NetworkConnection> ScanNetworkConnections(ScanReport report)
    {
        var list = new List<NetworkConnection>();
        try
        {
            var psi = new ProcessStartInfo("netstat", "-ano")
            {
                RedirectStandardOutput = true, UseShellExecute = false, CreateNoWindow = true,
                StandardOutputEncoding = System.Text.Encoding.UTF8
            };
            using var p = Process.Start(psi);
            if (p == null) return list;
            var output = p.StandardOutput.ReadToEnd();
            p.WaitForExit(8000);
            _artifacts.Add("Active network connections");

            var sigNames = new HashSet<string>(_sigs.SelectMany(x => x.FileNames));
            var procMap = new Dictionary<int, string>();
            try
            {
                foreach (var proc in Process.GetProcesses())
                    try { procMap[proc.Id] = proc.ProcessName; } catch { }
            }
            catch { }

            foreach (var line in output.Split('\n'))
            {
                var parts = line.Trim().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length < 5 || parts[0] != "TCP") continue;
                if (!int.TryParse(parts[4], out int pid) || pid == 0) continue;
                var state = parts[3];
                var remote = parts[2];
                // listening sockets have a wildcard remote end — skip them (works on any Windows language)
                if (remote.StartsWith("0.0.0.0") || remote.StartsWith("[::]") || remote.EndsWith(":0")) continue;
                if (remote.StartsWith("127.") || remote.StartsWith("[::1]")) continue;

                procMap.TryGetValue(pid, out var procName);
                var exe = ((procName ?? "") + ".exe").ToLowerInvariant();
                bool susp = sigNames.Contains(exe) || CheatWordIn(exe) != null;
                list.Add(new NetworkConnection
                {
                    Process = procName ?? $"PID:{pid}",
                    Pid = pid,
                    LocalAddress = parts[1],
                    RemoteAddress = remote,
                    State = state,
                    Suspicious = susp
                });
                if (susp && sigNames.Contains(exe))
                {
                    var sig = _sigs.First(x => x.FileNames.Contains(exe));
                    report.Detections.Add(Det(exe, sig, "connected to " + remote, DetectMethod.NetworkIndicator, "connected now",
                        $"A known cheat process is connected to {remote} right now (talking to its server).", false));
                }
            }
        }
        catch { }
        return list.OrderByDescending(c => c.Suspicious).Take(200).ToList();
    }

    // ================================================================
    //  PREFETCH
    // ================================================================
    private IEnumerable<Detection> ScanPrefetch()
    {
        var hits = new List<Detection>();
        var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "Prefetch");
        if (!Directory.Exists(dir)) return hits;
        _artifacts.Add("Prefetch");
        string[] files; try { files = Directory.GetFiles(dir, "*.pf"); } catch { return hits; }
        _filesScanned += files.Length;
        foreach (var pf in files)
        {
            var name = Path.GetFileName(pf).ToLowerInvariant();
            foreach (var sig in _sigs)
            {
                var m = sig.FileNames.FirstOrDefault(fn => name.StartsWith(fn + "-"));
                if (m != null)
                {
                    DateTime t; try { t = File.GetLastWriteTime(pf); } catch { t = DateTime.MinValue; }
                    hits.Add(Det(m, sig, pf, DetectMethod.Prefetch, t == DateTime.MinValue ? "unknown" : Ago(t),
                        "Prefetch proves this program ran on the PC — even if the file was deleted afterwards.", true));
                    break;
                }
            }
        }
        return hits;
    }

    // ================================================================
    //  BAM
    // ================================================================
    private IEnumerable<Detection> ScanBam()
    {
        var hits = new List<Detection>();
        try
        {
            using var bam = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Services\bam\State\UserSettings");
            if (bam == null) return hits;
            _artifacts.Add("BAM");
            foreach (var sid in bam.GetSubKeyNames())
            {
                using var u = bam.OpenSubKey(sid); if (u == null) continue;
                foreach (var v in u.GetValueNames())
                {
                    var low = v.ToLowerInvariant();
                    var sig = _sigs.FirstOrDefault(s => s.FileNames.Any(fn => low.EndsWith("\\" + fn)));
                    if (sig != null)
                        hits.Add(Det(Path.GetFileName(v), sig, v, DetectMethod.Bam, "recorded by BAM",
                            "The Background Activity Moderator recorded this executable running under a user account.", false));
                }
            }
        }
        catch { }
        return hits;
    }

    // ================================================================
    //  DROP FOLDERS (Temp, Downloads, Desktop, Documents)
    // ================================================================
    private IEnumerable<Detection> ScanDropFolders()
    {
        var hits = new List<Detection>();
        var up = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        var folders = new[]
        {
            Path.GetTempPath(),
            Path.Combine(up, "Downloads"),
            Environment.GetFolderPath(Environment.SpecialFolder.Desktop),
            Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
            Path.Combine(up, "Desktop"),
            Path.Combine(up, "Documents"),
            // v4.0: scan Videos and Pictures too (cheaters hide loaders there)
            Path.Combine(up, "Videos"),
            Path.Combine(up, "Pictures"),
            Path.Combine(up, "Music"),
        };
        var ex = new[] { ".exe", ".dll", ".asi", ".lua", ".py", ".bat", ".cmd", ".ps1", ".vbs", ".js", ".rar", ".zip", ".7z" };
        foreach (var f in folders.Distinct())
        {
            if (string.IsNullOrEmpty(f) || !Directory.Exists(f)) continue;
            _artifacts.Add("Folder: " + f);
            IEnumerable<string> files;
            try { files = SafeEnumerate(f, ex, maxDepth: 4); } catch { continue; }
            foreach (var path in files)
            {
                _filesScanned++;
                var name = Path.GetFileName(path).ToLowerInvariant();

                var sig = _sigs.FirstOrDefault(s => s.FileNames.Contains(name));
                if (sig != null)
                {
                    var d = Det(name, sig, path, DetectMethod.SuspiciousExecutable, SafeWrite(path),
                        "An executable matching a known cheat signature was found on disk.", false);
                    d.Sha256 = Sha256File(path);
                    hits.Add(d);
                    continue;
                }

                if (name.EndsWith(".zip")) ScanZipEntries(path, hits);

                var wd = CheatWordIn(name);
                if (wd != null)
                    hits.Add(new Detection
                    {
                        File = name, Signature = "Suspicious name (" + wd + ")", Path = path,
                        Sha256 = Sha256File(path), Method = DetectMethod.SuspiciousExecutable,
                        Severity = Severity.Medium, When = SafeWrite(path),
                        Features = new() { "Named cheat" },
                        Explain = $"A file named with the cheat term \"{wd}\" was found in {Path.GetFileName(Path.GetDirectoryName(path))}."
                    });
            }
        }
        return hits;
    }
    private int _unsignedFlagged;

    // list the files inside a .zip (no extraction) and match them like files on disk
    private void ScanZipEntries(string zipPath, List<Detection> hits)
    {
        try
        {
            var fi = new FileInfo(zipPath);
            if (fi.Length > 500L * 1024 * 1024) return;
            using var z = System.IO.Compression.ZipFile.OpenRead(zipPath);
            int n = 0;
            foreach (var en in z.Entries)
            {
                if (++n > 5000) break;
                var entry = en.FullName.Replace('/', '\\');
                var nm = Path.GetFileName(entry).ToLowerInvariant();
                if (nm.Length == 0) continue;
                var ext = Path.GetExtension(nm);
                if (ext is not (".exe" or ".dll" or ".sys" or ".asi" or ".lua" or ".bat" or ".ps1")) continue;
                var sig = _sigs.FirstOrDefault(x => x.FileNames.Contains(nm));
                var w = sig == null ? (CheatWordIn(nm) ?? CheatWordIn(entry)) : null;
                if (sig == null && w == null) continue;
                hits.Add(new Detection
                {
                    File = nm, Signature = sig != null ? sig.Name + " (inside archive)" : $"Cheat-named file in archive (\"{w}\")",
                    Path = zipPath + " → " + entry, Method = DetectMethod.SuspiciousExecutable,
                    Severity = sig != null ? Signatures.ParseSeverity(sig.Severity) : Severity.Medium,
                    When = SafeWrite(zipPath), Features = new() { "In archive" },
                    Explain = "A cheat file is packed inside this .zip archive (found without extracting it)."
                });
            }
        }
        catch { }
    }

    // ================================================================
    //  v4.0 — STARTUP PERSISTENCE (Registry Run keys + Startup folder)
    // ================================================================
    private void ScanStartupPersistence(ScanReport report)
    {
        _artifacts.Add("Startup entries");
        var sigNames = new HashSet<string>(_sigs.SelectMany(s => s.FileNames));

        var keys = new (RegistryKey hive, string path, string label)[]
        {
            (Registry.LocalMachine, @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", @"HKLM\Run"),
            (Registry.LocalMachine, @"SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce", @"HKLM\RunOnce"),
            (Registry.LocalMachine, @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run", @"HKLM\Run (32-bit)"),
            (Registry.LocalMachine, @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\RunOnce", @"HKLM\RunOnce (32-bit)"),
            (Registry.CurrentUser,  @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", @"HKCU\Run"),
            (Registry.CurrentUser,  @"SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce", @"HKCU\RunOnce"),
        };

        foreach (var (hive, keyPath, label) in keys)
        {
            try
            {
                using var k = hive.OpenSubKey(keyPath);
                if (k == null) continue;
                foreach (var name in k.GetValueNames())
                {
                    var cmd = k.GetValue(name)?.ToString() ?? "";
                    if (cmd.Length == 0) continue;
                    bool susp = IsSuspiciousLaunch(cmd, sigNames, out var exe);
                    report.StartupEntries.Add(new StartupEntry { Name = name, Command = Trunc(cmd, 260), Location = label, Suspicious = susp });
                    if (sigNames.Contains(exe))
                    {
                        var sig = _sigs.First(s => s.FileNames.Contains(exe));
                        report.Detections.Add(Det(exe, sig, cmd, DetectMethod.StartupPersistence, "starts with Windows",
                            "A known cheat is set to start automatically with Windows (persistent install).", false));
                    }
                }
            }
            catch { }
        }

        // Winlogon Shell / Userinit hijack (classic persistence)
        try
        {
            using var k = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon");
            var shell = k?.GetValue("Shell")?.ToString()?.Trim() ?? "";
            var userinit = k?.GetValue("Userinit")?.ToString()?.Trim().TrimEnd(',') ?? "";
            if (shell.Length > 0 && !shell.Equals("explorer.exe", StringComparison.OrdinalIgnoreCase))
                report.Warnings.Add(new Warning { Category = "Persistence", Title = "Winlogon Shell changed: " + shell,
                    Detail = "Windows starts a different shell than explorer.exe — a hidden way to auto-start a program." });
            if (userinit.Length > 0 && !userinit.EndsWith(@"system32\userinit.exe", StringComparison.OrdinalIgnoreCase))
                report.Warnings.Add(new Warning { Category = "Persistence", Title = "Winlogon Userinit changed: " + userinit,
                    Detail = "An extra program was added to the Windows logon sequence." });
        }
        catch { }

        // Startup folders
        foreach (var startupDir in new[]
        {
            Environment.GetFolderPath(Environment.SpecialFolder.Startup),
            Environment.GetFolderPath(Environment.SpecialFolder.CommonStartup)
        })
        {
            try
            {
                if (string.IsNullOrEmpty(startupDir) || !Directory.Exists(startupDir)) continue;
                foreach (var f in Directory.GetFiles(startupDir))
                {
                    var name = Path.GetFileName(f).ToLowerInvariant();
                    if (name == "desktop.ini") continue;
                    var ext = Path.GetExtension(name);
                    // a raw script / exe dropped in Startup (not a normal shortcut) is unusual
                    bool susp = ext is ".exe" or ".bat" or ".cmd" or ".ps1" or ".vbs" or ".js"
                        || sigNames.Contains(name) || CheatWordIn(name) != null;
                    report.StartupEntries.Add(new StartupEntry
                    {
                        Name = Path.GetFileName(f), Command = f, Location = "Startup folder", Suspicious = susp
                    });
                }
            }
            catch { }
        }

        int suspCount = report.StartupEntries.Count(s => s.Suspicious);
        if (suspCount > 0)
            report.Warnings.Add(new Warning
            {
                Category = "Persistence",
                Title = $"{suspCount} suspicious startup entr{(suspCount == 1 ? "y" : "ies")}",
                Detail = "Programs set to start with Windows from Temp/Downloads, unsigned from AppData, hidden PowerShell, or with cheat-like names."
            });
    }

    // ================================================================
    //  v4.0 — SCHEDULED TASKS
    // ================================================================
    private void ScanScheduledTasks(ScanReport report)
    {
        _artifacts.Add("Scheduled tasks");
        try
        {
            var psi = new ProcessStartInfo("schtasks", "/query /fo csv /nh /v")
            {
                RedirectStandardOutput = true, UseShellExecute = false, CreateNoWindow = true,
                StandardOutputEncoding = System.Text.Encoding.UTF8
            };
            using var p = Process.Start(psi);
            if (p == null) return;
            var output = p.StandardOutput.ReadToEnd();
            p.WaitForExit(20000);

            var sigNames = new HashSet<string>(_sigs.SelectMany(s => s.FileNames));
            var seenTasks = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var line in output.Split('\n'))
            {
                if (string.IsNullOrWhiteSpace(line)) continue;
                // /v CSV columns: 0 HostName, 1 TaskName, 2 Next Run, 3 Status, 4 Logon Mode,
                //                 5 Last Run Time, 6 Last Result, 7 Author, 8 Task To Run, ...
                var parts = SplitCsv(line.TrimEnd('\r'));
                if (parts.Count < 9) continue;

                var taskName = parts[1].Trim();
                if (!taskName.StartsWith("\\")) continue;                       // header / junk line
                if (taskName.StartsWith(@"\Microsoft\", StringComparison.OrdinalIgnoreCase)) continue; // built-in Windows tasks
                if (!seenTasks.Add(taskName)) continue;                         // one row per trigger → dedupe

                var status = parts[3].Trim();
                var lastRun = parts[5].Trim();
                var command = parts[8].Trim();

                bool susp = IsSuspiciousLaunch(command, sigNames, out var exeName);

                report.ScheduledTasks.Add(new ScheduledTaskEntry
                {
                    Name = taskName, Command = Trunc(command, 260),
                    Status = status, LastRun = lastRun, Suspicious = susp
                });

                if (sigNames.Contains(exeName))
                {
                    var sig = _sigs.First(s => s.FileNames.Contains(exeName));
                    report.Detections.Add(Det(exeName, sig, command, DetectMethod.ScheduledTask, "scheduled task",
                        "A known cheat is set to run through Windows Task Scheduler.", false));
                }
            }

            report.ScheduledTasks = report.ScheduledTasks.OrderByDescending(t => t.Suspicious).Take(150).ToList();
            int suspCount = report.ScheduledTasks.Count(s => s.Suspicious);
            if (suspCount > 0)
                report.Warnings.Add(new Warning
                {
                    Category = "Persistence",
                    Title = $"{suspCount} suspicious scheduled task(s)",
                    Detail = "Tasks that run from Temp/Downloads, unsigned AppData programs, or hidden/encoded PowerShell — cheat persistence or auto-cleaners."
                });
        }
        catch { }
    }

    // ================================================================
    //  v4.0 — LOADED KERNEL DRIVERS
    // ================================================================
    // Drivers that kernel cheats abuse ("bring your own vulnerable driver").
    // Normal software ALSO ships some of these (RGB tools, Gigabyte, CPU-Z, Genshin…),
    // so they are a WARNING for staff to ask about — never an automatic "cheating".
    private static readonly Dictionary<string, string> VulnerableDrivers = new(StringComparer.OrdinalIgnoreCase)
    {
        {"capcom", "Capcom.sys"}, {"gdrv", "Gigabyte gdrv.sys"}, {"cpuz141", "CPU-Z cpuz141.sys (old)"},
        {"dbutil_2_3", "Dell dbutil_2_3.sys"}, {"iqvw64e", "Intel iqvw64e.sys (kdmapper's driver)"},
        {"asrdrv106", "ASRock AsrDrv106.sys"}, {"winio", "WinIO"}, {"winio64", "WinIO64"},
        {"phymem", "PhyMem"}, {"phymemx64", "PhyMem x64"}, {"inpoutx64", "InpOutx64"},
        {"rtcore64", "MSI RTCore64.sys"}, {"atillk64", "ATI atillk64.sys"}, {"aswarpot", "Avast aswArPot.sys"},
        {"mhyprot2", "mhyprot2.sys (Genshin anticheat)"}, {"mhyprot3", "mhyprot3.sys"},
        {"kprocesshacker", "Process Hacker driver"}, {"kprocesshacker3", "Process Hacker driver"},
        {"ene", "ENE RGB driver"}, {"glckio2", "ASUS GLCKIO2"}, {"physmem", "PhysMem"},
        {"speedfan", "SpeedFan"}, {"amifldrv64", "AMI flash driver"}, {"bsmixp64", "BIOStar"},
    };

    private void ScanLoadedDrivers(ScanReport report)
    {
        _artifacts.Add("Loaded drivers");
        var sigNames = new HashSet<string>(_sigs.SelectMany(s => s.FileNames));
        var win = Environment.GetFolderPath(Environment.SpecialFolder.Windows);
        var vulnFound = new List<string>();

        try
        {
            foreach (ManagementObject drv in new ManagementObjectSearcher(
                "SELECT Name, DisplayName, PathName, State FROM Win32_SystemDriver WHERE Started = TRUE").Get())
            {
                var name = drv["Name"]?.ToString() ?? "";
                var displayName = drv["DisplayName"]?.ToString() ?? "";
                var raw = drv["PathName"]?.ToString() ?? "";
                var state = drv["State"]?.ToString() ?? "";
                var path = ResolveDriverPath(raw, win);
                var low = path.ToLowerInvariant();
                var file = Path.GetFileName(low);

                // skip Microsoft's own drivers (hundreds of them, all fine)
                string company = "";
                try { if (File.Exists(path)) company = FileVersionInfo.GetVersionInfo(path).CompanyName ?? ""; } catch { }
                if (company.Contains("Microsoft", StringComparison.OrdinalIgnoreCase)) continue;

                // Inside Windows (System32\drivers, DriverStore) drivers are catalog-signed by Windows.
                // Outside Windows, check the file's own signature.
                bool inWindows = low.StartsWith(win.ToLowerInvariant());
                bool signed = inWindows || (File.Exists(path) && IsSigned(path));
                bool userPath = low.Contains(@"\users\") || low.Contains(@"\temp\") || low.Contains(@"\downloads\");
                bool vuln = VulnerableDrivers.ContainsKey(name) || VulnerableDrivers.ContainsKey(Path.GetFileNameWithoutExtension(file));
                bool sigHit = file.Length > 0 && sigNames.Contains(file);

                report.LoadedDrivers.Add(new DriverEntry
                {
                    Name = name, DisplayName = displayName, Path = path, Status = state,
                    Signed = signed, Suspicious = vuln || !signed || userPath || sigHit
                });

                if (sigHit)
                {
                    var sig = _sigs.First(s => s.FileNames.Contains(file));
                    report.Detections.Add(Det(file, sig, path, DetectMethod.KernelDriver, "loaded now",
                        "A kernel driver matching a known cheat is loaded right now.", false));
                }
                else if (userPath)
                {
                    // a kernel driver running from a user folder is never normal software behaviour
                    report.Detections.Add(new Detection
                    {
                        File = file, Signature = "Kernel driver loaded from user folder", Path = path,
                        Sha256 = Sha256File(path), Method = DetectMethod.KernelDriver, Severity = Severity.Medium,
                        When = "loaded now", Features = new() { "Kernel driver" },
                        Explain = "A driver is running from Users/Temp/Downloads — kernel cheats and spoofers load this way."
                    });
                }
                else if (vuln)
                {
                    var key = VulnerableDrivers.ContainsKey(name) ? name : Path.GetFileNameWithoutExtension(file);
                    vulnFound.Add(VulnerableDrivers[key]);
                }

                if (!signed)
                    _suspicious.Add(new SuspiciousFile { Path = path, Kind = "Unsigned kernel driver: " + name });
            }
        }
        catch { }

        if (vulnFound.Count > 0)
            report.Warnings.Add(new Warning
            {
                Category = "Injection",
                Title = "Exploitable driver loaded: " + string.Join(", ", vulnFound.Distinct()),
                Detail = "Kernel cheats abuse these drivers to read/write game memory. Some normal tools (RGB, motherboard, CPU-Z) also use them — ask the player which program installed it."
            });

        int unsignedCount = report.LoadedDrivers.Count(d => !d.Signed);
        if (unsignedCount > 0)
            report.Warnings.Add(new Warning
            {
                Category = "Injection",
                Title = $"{unsignedCount} unsigned kernel driver(s) loaded",
                Detail = "Unsigned drivers can read/write any process memory — this is how kernel cheats work."
            });
    }

    private static string ResolveDriverPath(string p, string win)
    {
        if (string.IsNullOrWhiteSpace(p)) return "";
        p = p.Trim().Trim('"');
        if (p.StartsWith(@"\??\")) p = p.Substring(4);
        if (p.StartsWith(@"\SystemRoot\", StringComparison.OrdinalIgnoreCase)) p = Path.Combine(win, p.Substring(12));
        else if (p.StartsWith(@"System32\", StringComparison.OrdinalIgnoreCase)) p = Path.Combine(win, p);
        return Environment.ExpandEnvironmentVariables(p);
    }

    // Is a startup/task command line suspicious? Keeps normal apps (Discord, Steam, Spotify…) clean.
    private bool IsSuspiciousLaunch(string cmd, HashSet<string> sigNames, out string exe)
    {
        var path = ExtractExePath(cmd);
        exe = Path.GetFileName(path).ToLowerInvariant();
        var e = exe;
        if (sigNames.Contains(e)) return true;
        if (CheatWordIn(e) != null) return true;

        var c = cmd.ToLowerInvariant();
        if (c.Contains(@"\temp\") || c.Contains(@"\downloads\") || c.Contains(@"$recycle.bin")) return true;
        if (c.Contains("powershell") && (c.Contains("-enc") || c.Contains("frombase64") || c.Contains("-w hidden")
            || c.Contains("-windowstyle hidden") || c.Contains("iex") || c.Contains("downloadstring"))) return true;
        if ((c.Contains("mshta") || c.Contains("wscript") || c.Contains("cscript")) && c.Contains("http")) return true;

        var low = path.ToLowerInvariant();
        if ((low.Contains(@"\appdata\") || low.Contains(@"\programdata\")) && low.EndsWith(".exe"))
        {
            try { if (File.Exists(path) && !IsSigned(path)) return true; } catch { }
        }
        return false;
    }

    private static string ExtractExePath(string cmd)
    {
        cmd = Environment.ExpandEnvironmentVariables(cmd.Trim());
        if (cmd.StartsWith("\""))
        {
            int end = cmd.IndexOf('"', 1);
            return end > 1 ? cmd.Substring(1, end - 1) : cmd.Trim('"');
        }
        int exeIdx = cmd.IndexOf(".exe", StringComparison.OrdinalIgnoreCase);
        if (exeIdx > 0) return cmd.Substring(0, exeIdx + 4);
        int sp = cmd.IndexOf(' ');
        return sp > 0 ? cmd.Substring(0, sp) : cmd;
    }

    private static string Trunc(string s, int n) => s.Length > n ? s.Substring(0, n) : s;

    // ================================================================
    //  v4.0 — RECENT FILES (Windows Recent / LNK files)
    // ================================================================
    private List<RecentFileEntry> ScanRecentFiles(ScanReport report)
    {
        var list = new List<RecentFileEntry>();
        var sigNames = new HashSet<string>(_sigs.SelectMany(s => s.FileNames));
        try
        {
            var recentDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "Microsoft", "Windows", "Recent");
            if (!Directory.Exists(recentDir)) return list;
            _artifacts.Add("Recent files (LNK)");

            foreach (var lnk in Directory.GetFiles(recentDir, "*.lnk"))
            {
                try
                {
                    var fi = new FileInfo(lnk);
                    // only look at recent entries (last 30 days)
                    if ((DateTime.Now - fi.LastWriteTime).TotalDays > 30) continue;

                    var lnkName = Path.GetFileNameWithoutExtension(lnk);
                    bool isExe = lnkName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)
                        || lnkName.EndsWith(".dll", StringComparison.OrdinalIgnoreCase)
                        || lnkName.EndsWith(".bat", StringComparison.OrdinalIgnoreCase)
                        || lnkName.EndsWith(".ps1", StringComparison.OrdinalIgnoreCase);

                    var nameLow = lnkName.ToLowerInvariant();
                    bool flagged = sigNames.Contains(nameLow) || sigNames.Contains(nameLow + ".exe")
                        || CheatWordIn(nameLow) != null;

                    list.Add(new RecentFileEntry
                    {
                        Name = lnkName, Target = lnk, When = Ago(fi.LastWriteTime),
                        Executable = isExe, Flagged = flagged
                    });

                    if (flagged && sigNames.Contains(nameLow))
                    {
                        var sig = _sigs.First(s => s.FileNames.Contains(nameLow));
                        report.Detections.Add(Det(nameLow, sig, lnk, DetectMethod.RecentFile, Ago(fi.LastWriteTime),
                            "A known cheat file was recently opened — Windows recorded it in the Recent Items list.", true));
                    }
                }
                catch { }
            }
        }
        catch { }
        return list.OrderByDescending(r => r.Flagged).ThenByDescending(r => r.Executable).Take(200).ToList();
    }

    // ================================================================
    //  DEEP SCAN (whole disk)
    // ================================================================
    private static readonly string[] ModExt = { ".rpf", ".ytd", ".ydr", ".ymap", ".oiv", ".lua", ".asi", ".ydd", ".yft" };

    private static readonly string[] CheatWordsContent =
    {
        "aimbot", "wallhack", "triggerbot", "silentaim", "norecoil", "hwidspoof", "aimassist",
    };

    private static readonly string[] CheatWords =
    {
        "aimbot", "wallhack", "triggerbot", "silentaim", "norecoil", "no-recoil",
        "spoofer", "hwidspoof", "injector", "unlockall", "godmode", "aimassist",
        "esphack", "chams", "bhop", "fastrun", "nowater", "nobush",
        // v4.0 additions
        "norecoiltool", "modmenu", "mod-menu", "aimbotloader", "esp-hack",
        "hwid-spoof", "hwid_spoof", "kdmapper", "drvmap", "manualmap",
        "cheat", "triggerbot", "silentaim", "aimlock", "wallhack", "luaexecutor", "lua_executor", "luainjector",
        "acbypass", "unbanner", "ragebot", "legitbot", "noclip", "menuloader", "fivemmenu", "fivemhack", "gtahack",
    };

    private void ScanWholeDisk(ScanReport report, IProgress<(int pct, string status)>? progress)
    {
        var sigNames = new HashSet<string>(_sigs.SelectMany(s => s.FileNames));

        var stop = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "hook","overlay","loader","cheat","cheats","external","internal","menu","inject",
            "injector","manualmap","manual","water","nowater","bush","nobush","texture","textures",
            "modified","lowtrees","clearwater","novegetation","gameoverlay","dxhook","d3dhook",
            "overlay64","d3d11hook","mono","driver","client","game","hack","hacks","mod","mods",
            "impact","lumia","macro","build","test","setup","free","detected","string","cleaner",
        };
        var needles = new List<(string needle, Signatures.Sig sig)>();
        foreach (var s in _sigs)
            foreach (var f in s.FileNames)
            {
                var stem = Path.GetFileNameWithoutExtension(f).ToLowerInvariant();
                if (stem.Length >= 5 && !stop.Contains(stem)) needles.Add((stem, s));
            }
        needles = needles.GroupBy(n => n.needle).Select(g => g.First()).ToList();

        var hashMap = new Dictionary<string, Signatures.Sig>(StringComparer.OrdinalIgnoreCase);
        foreach (var s in _sigs) foreach (var h in s.Hashes) hashMap[h] = s;
        var domainList = new List<(string dom, Signatures.Sig sig)>();
        foreach (var s in _sigs) foreach (var d in s.Domains) domainList.Add((d, s));

        DriveInfo[] drives;
        try { drives = DriveInfo.GetDrives(); } catch { return; }
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var drive in drives)
        {
            try { if ((drive.DriveType != DriveType.Fixed && drive.DriveType != DriveType.Removable) || !drive.IsReady) continue; } catch { continue; }
            _artifacts.Add("Drive " + drive.Name);
            foreach (var path in SafeEnumerate(drive.RootDirectory.FullName, new[] {
                ".exe", ".dll", ".sys", ".asi",
                ".lua", ".py", ".bat", ".cmd", ".ps1", ".vbs", ".js",
                ".rpf", ".ytd", ".ydr", ".ymap", ".oiv", ".ydd", ".yft" }, maxDepth: 40))
            {
                _filesScanned++;
                if ((_filesScanned & 0x3FF) == 0)
                {
                    int pct = 58 + (int)(16.0 * (1.0 - 1.0 / (1.0 + _filesScanned / 15000.0)));
                    progress?.Report((pct, $"Deep-scanning drives & files… {_filesScanned:n0} files"));
                }

                var name = Path.GetFileName(path).ToLowerInvariant();
                var ext = Path.GetExtension(name);
                var low = path.ToLowerInvariant();
                bool inGame = IsGamePath(low);

                bool isBin = ext is ".exe" or ".dll" or ".sys" or ".asi";
                bool isScript = ext is ".lua" or ".py" or ".bat" or ".cmd" or ".ps1" or ".vbs" or ".js";

                if ((isBin || isScript) && !low.Contains("\\windows\\"))
                {
                    var hit = CheatWordIn(name);
                    if (hit != null && seen.Add(path))
                        report.Detections.Add(new Detection
                        {
                            File = name, Signature = "Suspicious name (" + hit + ")", Path = path,
                            Sha256 = Sha256File(path), Method = DetectMethod.SuspiciousExecutable,
                            Severity = Severity.Medium, When = SafeWrite(path),
                            Features = new() { "Named cheat" },
                            Explain = $"The file name contains \"{hit}\", a common cheat term."
                        });
                }

                if (ModExt.Contains(ext) && inGame)
                {
                    double mb = 0; try { mb = Math.Round(new FileInfo(path).Length / 1048576.0, 2); } catch { }
                    report.Mods.Add(new ModFile { File = name, SizeMb = mb, Path = path });
                    if (ext == ".asi") _suspicious.Add(new SuspiciousFile { Path = path, Kind = "ASI plugin" });
                    if (!isBin && !isScript) continue;
                }

                if (!isBin && !isScript) continue;

                if (ext == ".dll" && inGame && IsUserModPath(low)) _suspicious.Add(new SuspiciousFile { Path = path, Kind = "DLL added to the game (plugins / mods)" });

                // 1) filename match
                if (sigNames.Contains(name))
                {
                    var sig = _sigs.First(s => s.FileNames.Contains(name));
                    var d = Det(name, sig, path, DetectMethod.SuspiciousExecutable, SafeWrite(path),
                        "A file matching a known cheat signature was found on disk.", false);
                    d.Sha256 = Sha256File(path);
                    if (seen.Add(path)) report.Detections.Add(d);
                    continue;
                }

                // HASH match
                if (isBin && hashMap.Count > 0 && !low.Contains("\\windows\\"))
                {
                    var h = Sha256File(path);
                    if (h != null && hashMap.TryGetValue(h, out var hsig))
                    {
                        if (seen.Add(path))
                            report.Detections.Add(new Detection
                            {
                                File = name, Signature = hsig.Name + " (hash)", Path = path, Sha256 = h,
                                Method = DetectMethod.SuspiciousExecutable, Severity = Severity.High, When = SafeWrite(path),
                                Features = new List<string>(hsig.Features) { "Hash match" },
                                Explain = $"This file's SHA-256 matches a known {hsig.Name} cheat file (even if renamed)."
                            });
                        continue;
                    }
                }

                if (low.Contains("\\windows\\")) continue;
                if (low.Contains("heroshield") || low.Contains("hero_shield") || low.Contains("hero-shield")
                    || low.Contains("hero-site") || low.Contains("heroscanner")) continue;

                bool legit = low.Contains("node_modules") || low.Contains("\\onedrive\\")
                    || low.Contains("appdata\\local\\microsoft") || low.Contains("appdata\\roaming\\microsoft")
                    || low.Contains("\\vendor\\") || low.Contains("\\.vscode\\") || low.Contains("\\.git\\")
                    || low.Contains("program files") || low.Contains("\\google\\chrome") || low.Contains("\\microsoft\\edge")
                    || low.Contains("$recycle.bin");
                bool inGameC = IsGamePath(low);

                var content = (legit && !inGameC) ? null : (isScript ? ReadTextLower(path) : ReadAsLower(path));
                if (content == null) continue;

                bool cHit = false;

                // domain in file content
                if (domainList.Count > 0)
                {
                    foreach (var (dom, dsig) in domainList)
                        if (content.Contains(dom))
                        {
                            if (seen.Add(path))
                                report.Detections.Add(new Detection
                                {
                                    File = name, Signature = dsig.Name + " (domain)", Path = path, Sha256 = Sha256File(path),
                                    Method = DetectMethod.SuspiciousExecutable, Severity = Severity.High, When = SafeWrite(path),
                                    Features = new List<string>(dsig.Features) { "C2 domain" },
                                    Explain = $"This file contains \"{dom}\", the {dsig.Name} cheat's domain — a renamed loader."
                                });
                            cHit = true; break;
                        }
                    if (cHit) continue;
                }

                // cheat brand name inside the file — game folder OR the places loaders are dropped
                bool dropZone = low.Contains("\\downloads\\") || low.Contains("\\desktop\\") || low.Contains("\\temp\\")
                    || low.Contains("\\appdata\\") || low.Contains("\\documents\\") || low.Contains("\\programdata\\");
                if (inGameC || (dropZone && isBin))
                {
                    int distinct = 0; string? first = null;
                    foreach (var (needle, sig) in needles)
                    {
                        if (needle.Length < 6 || !ContainsWord(content, needle)) continue;
                        first ??= needle;
                        if (++distinct >= 3) break;
                    }
                    if (distinct >= 3)
                        _suspicious.Add(new SuspiciousFile { Path = path, Kind = "Mentions 3+ cheat names (list / anticheat file)" });
                    else if (first != null)
                    {
                        if (seen.Add(path))
                            report.Detections.Add(new Detection
                            {
                                File = name, Signature = "Cheat string: " + first, Path = path,
                                Sha256 = Sha256File(path), Method = DetectMethod.SuspiciousExecutable,
                                Severity = Severity.Medium, When = SafeWrite(path),
                                Features = new() { isScript ? "In-script" : "In-content" },
                                Explain = $"The cheat string \"{first}\" was found inside this file."
                            });
                        cHit = true;
                    }
                    if (cHit) continue;
                }

                // cheat score: features + FiveM executor tells + injection + overlay + location + signature
                if (!legit && isBin && !low.Contains("\\fivem.app\\") && !low.Contains("\\citizenfx\\"))
                {
                    var (score, reasons, strongN, cheatSign) = CheatScore(content, path, low, dropZone);
                    bool signedFile = false;
                    if (score >= 3) { signedFile = IsSigned(path); if (!signedFile) { score += 1; reasons.Add("unsigned"); } }
                    // detection needs a real cheat sign (menu name, cheat feature, FiveM executor code) — APIs alone never
                    if (score >= 4 && cheatSign)
                    {
                        if (signedFile && score < 8)
                        {
                            _suspicious.Add(new SuspiciousFile { Path = path, Kind = $"Signed program with cheat features (score {score}): {string.Join(", ", reasons.Take(5))}" });
                        }
                        else if (seen.Add(path))
                        {
                            bool brandHit = reasons.Any(r => r.StartsWith("menu name"));
                            bool high = (score >= 8 && strongN >= 2) || (brandHit && !signedFile);
                            report.Detections.Add(new Detection
                            {
                                File = name, Signature = (high ? "Cheat program" : "Cheat-like program") + $" (score {score})", Path = path,
                                Sha256 = Sha256File(path), Method = DetectMethod.SuspiciousExecutable,
                                Severity = high ? Severity.High : Severity.Medium, When = SafeWrite(path),
                                Features = reasons.Take(6).ToList(),
                                Explain = "Found inside this program: " + string.Join(", ", reasons) + "."
                            });
                            continue;
                        }
                    }
                    else if (score >= 2 && _suspicious.Count < 400)
                        _suspicious.Add(new SuspiciousFile { Path = path, Kind = $"Weak cheat signs (score {score}): {string.Join(", ", reasons.Take(4))}" });
                }

                // high entropy = packed / encrypted (cheats hide their strings this way)
                if (isBin && dropZone && !legit && _suspicious.Count < 400 && !seen.Contains(path))
                {
                    var ent = FileEntropy(path);
                    if (ent >= 7.2 && !IsSigned(path))
                        _suspicious.Add(new SuspiciousFile { Path = path, Kind = $"High entropy {ent:0.00} (packed / encrypted program)" });
                }

                // unsigned exe in user/drop/game folder
                if ((ext == ".exe" || ext == ".dll") && _unsignedFlagged < 250
                    && (inGameC || low.Contains("\\downloads\\") || low.Contains("\\desktop\\")
                        || low.Contains("\\temp\\") || low.Contains("\\appdata\\roaming\\")))
                {
                    if (!IsSigned(path)) { _unsignedFlagged++; _suspicious.Add(new SuspiciousFile { Path = path, Kind = "Unsigned executable" }); }
                }

                // packer detection
                if (isBin && _suspicious.Count < 300 && !low.Contains("\\windows\\") && !low.Contains("program files"))
                {
                    string? packer =
                        content.Contains("themida") || content.Contains(" winlicense") ? "Themida"
                        : content.Contains("vmprotect") ? "VMProtect"
                        : content.Contains("enigma protector") ? "Enigma"
                        : (content.Contains(" upx0") && content.Contains(" upx1")) ? "UPX"
                        // v4.0: additional packers
                        : content.Contains("asprotect") ? "ASProtect"
                        : content.Contains("armadillo") ? "Armadillo"
                        : content.Contains("obsidium") ? "Obsidium"
                        : content.Contains("pecompact") ? "PECompact"
                        : null;
                    if (packer != null) _suspicious.Add(new SuspiciousFile { Path = path, Kind = $"Generic A1 ({packer})" });
                }

                // obfuscation detection on scripts
                if (isScript && _suspicious.Count < 300)
                {
                    string? obf = ScriptObfuscation(content, ext);
                    if (obf != null) _suspicious.Add(new SuspiciousFile { Path = path, Kind = $"Generic A1 ({obf})" });
                }

                // v4.0: unsigned executable created in the last 7 days in a drop folder
                if ((ext == ".exe" || ext == ".dll") && !legit && _suspicious.Count < 400
                    && (low.Contains("\\downloads\\") || low.Contains("\\desktop\\") || low.Contains("\\temp\\")
                        || low.Contains("\\appdata\\roaming\\") || inGameC))
                {
                    try
                    {
                        var created = File.GetCreationTime(path);
                        if ((DateTime.Now - created).TotalDays <= 7 && !IsSigned(path))
                            _suspicious.Add(new SuspiciousFile { Path = path, Kind = $"New unsigned file (created {Ago(created)})" });
                    }
                    catch { }
                }
            }
        }
    }

    // ================================================================
    //  FIVEM FOLDER
    // ================================================================
    private void ScanFiveM(ScanReport report)
    {
        foreach (var root in FiveMRoots())
        {
            if (!Directory.Exists(root)) continue;
            _artifacts.Add("FiveM folder: " + root);
            IEnumerable<string> files;
            try { files = SafeEnumerate(root, null, maxDepth: 6); } catch { continue; }
            foreach (var path in files)
            {
                _filesScanned++;
                var name = Path.GetFileName(path).ToLowerInvariant();
                var ext = Path.GetExtension(name);

                if (ext is ".rpf" or ".ytd" or ".ydr" or ".ymap" or ".asi" or ".lua" or ".dll" or ".oiv")
                {
                    double mb = 0; try { mb = Math.Round(new FileInfo(path).Length / 1048576.0, 2); } catch { }
                    report.Mods.Add(new ModFile { File = name, SizeMb = mb, Path = path });
                }

                var sig = _sigs.FirstOrDefault(s => s.FileNames.Contains(name));
                if (sig != null)
                {
                    var d = Det(name, sig, path, DetectMethod.GameFileIntegrity, SafeWrite(path),
                        "A modified game file matching a known visual cheat (no-bush / no-water) was found.", false);
                    d.Sha256 = Sha256File(path);
                    report.Detections.Add(d);
                }

                if (name is "dinput8.dll" or "d3d11.dll" or "d3d9.dll" or "winmm.dll" or "version.dll" or "dxgi.dll"
                    && path.ToLowerInvariant().Contains("fivem")
                    && GraphicsModName(path) is string gfx)
                {
                    // ReShade / ENB load as dxgi.dll / d3d11.dll in FiveM.app\plugins — FiveM allows this
                    _suspicious.Add(new SuspiciousFile { Path = path, Kind = $"Graphics mod {gfx} (allowed by FiveM — make sure it is the real one)" });
                    continue;
                }
                if (name is "dinput8.dll" or "d3d11.dll" or "d3d9.dll" or "winmm.dll" or "version.dll" or "dxgi.dll"
                    && path.ToLowerInvariant().Contains("fivem"))
                    report.Detections.Add(new Detection
                    {
                        File = name, Signature = "DLL injection vector", Path = path,
                        Sha256 = Sha256File(path),
                        Method = DetectMethod.FiveMPlugin, Severity = Severity.Medium, When = SafeWrite(path),
                        Features = new() { "Injector" },
                        Explain = "A proxy DLL that is NOT ReShade/ENB was found in the FiveM folder — this is how injectors load code into the game."
                    });

                if (ext == ".asi")
                    _suspicious.Add(new SuspiciousFile { Path = path, Kind = "ASI plugin" });
                else if (ext == ".dll" && IsUserModPath(path.ToLowerInvariant()))
                    _suspicious.Add(new SuspiciousFile { Path = path, Kind = "DLL added to the game (plugins / mods)" });
            }
        }
        report.Mods = report.Mods.OrderByDescending(m => m.SizeMb).Take(1000).ToList();
    }

    // ================================================================
    //  WARNINGS (bypass tells)
    // ================================================================
    private IEnumerable<Warning> ScanWarnings(SystemInfo si)
    {
        var w = new List<Warning>();
        var watch = new (string svc, string label)[]
        {
            ("SysMain", "SysMain (Prefetch) disabled"),
            ("PcaSvc", "PcaSvc disabled"),
            ("DPS", "Diagnostic Policy Service disabled"),
            ("EventLog", "Windows Event Log disabled"),
            ("bam", "BAM service disabled"),
            // v4.0
            ("DiagTrack", "Connected User Experiences (DiagTrack) disabled"),
            ("Dnscache", "DNS Client service disabled"),
        };
        _artifacts.Add("Windows services");
        foreach (var (svc, label) in watch)
        {
            try
            {
                var start = GetStartType(svc);
                if (start == "Disabled")
                {
                    si.DisabledServices.Add(label);
                    w.Add(new Warning { Title = label, Detail = "Disabling this service can hide execution traces from a check (bypass tell)." });
                }
            }
            catch { }
        }

        try
        {
            using var k = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management\PrefetchParameters");
            if (k?.GetValue("EnablePrefetcher") is int ep && ep == 0)
                w.Add(new Warning { Title = "Prefetch disabled", Detail = "Prefetch is turned off, which erases proof of what was executed." });
        }
        catch { }

        if (_winInstall.HasValue && (DateTime.Now - _winInstall.Value).TotalDays <= 7)
            w.Add(new Warning
            {
                Title = $"Windows reinstalled {si.WindowsInstall} (possible format)",
                Detail = "Windows was installed very recently — a format wipes most cheat traces before a check."
            });

        if (!string.IsNullOrEmpty(si.SpooferFlag))
            w.Add(new Warning
            {
                Title = "Hardware ID looks spoofed",
                Detail = si.SpooferFlag + " — HWID spoofers blank or fake these IDs to dodge hardware bans."
            });

        return w;
    }

    // ================================================================
    //  EXECUTION TIMELINE
    // ================================================================
    private List<ExecutedProgram> CollectExecutedPrograms()
    {
        var all = new Dictionary<string, ExecutedProgram>(StringComparer.OrdinalIgnoreCase);
        var sigNames = new HashSet<string>(_sigs.SelectMany(s => s.FileNames));

        void Add(string name, string path, DateTime when, string src)
        {
            name = name.ToLowerInvariant();
            if (name.Length == 0) return;
            bool known = when > new DateTime(2000, 1, 1) && when <= DateTime.Now.AddDays(1);
            var label = known ? Ago(when) : "unknown";
            if (all.TryGetValue(name, out var e))
            {
                // keep the entry that has a real time; add the extra source as more proof
                if (!e.Source.Contains(src)) e.Source += " + " + src;
                if (e.LastRun == "unknown" && known) { e.LastRun = label; e.Path = path; }
                return;
            }
            all[name] = new ExecutedProgram
            {
                Name = name, Path = path, LastRun = label, Source = src,
                Flagged = sigNames.Contains(name) || CheatWordIn(Path.GetFileNameWithoutExtension(name)) != null
            };
        }

        // 1) Prefetch
        try
        {
            var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "Prefetch");
            if (Directory.Exists(dir))
                foreach (var pf in Directory.GetFiles(dir, "*.pf"))
                {
                    var fn = Path.GetFileName(pf);
                    var dash = fn.LastIndexOf('-');
                    var name = dash > 0 ? fn.Substring(0, dash) : fn;
                    if (name.ToLowerInvariant().EndsWith(".exe"))
                        Add(name, pf, SafeTime(pf), "Prefetch");
                }
        }
        catch { }

        // 2) PCA (Windows 11)
        try
        {
            var pca = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),
                "appcompat", "pca", "PcaAppLaunchDic.txt");
            if (File.Exists(pca))
            {
                _artifacts.Add("PCA (Program Compatibility Assistant)");
                foreach (var line in File.ReadLines(pca))
                {
                    var parts = line.Split('|');
                    if (parts.Length < 2) continue;
                    var path = parts[0].Trim();
                    DateTime.TryParse(parts[1].Trim(), out var when);
                    Add(Path.GetFileName(path), path, when, "PCA");
                }
            }
        }
        catch { }

        // 3) BAM
        try
        {
            using var bam = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Services\bam\State\UserSettings");
            if (bam != null)
                foreach (var sid in bam.GetSubKeyNames())
                {
                    using var u = bam.OpenSubKey(sid); if (u == null) continue;
                    foreach (var v in u.GetValueNames())
                    {
                        if (!v.ToLowerInvariant().EndsWith(".exe")) continue;
                        var when = DateTime.MinValue;
                        try
                        {
                            if (u.GetValue(v) is byte[] data && data.Length >= 8)
                                when = DateTime.FromFileTime(BitConverter.ToInt64(data, 0));
                        }
                        catch { }
                        Add(Path.GetFileName(v), v, when, "BAM");
                    }
                }
        }
        catch { }

        // 4) UserAssist
        try
        {
            using var ua = Registry.CurrentUser.OpenSubKey(
                @"Software\Microsoft\Windows\CurrentVersion\Explorer\UserAssist");
            if (ua != null)
            {
                _artifacts.Add("UserAssist");
                foreach (var guid in ua.GetSubKeyNames())
                {
                    using var cnt = ua.OpenSubKey(guid + @"\Count");
                    if (cnt == null) continue;
                    foreach (var v in cnt.GetValueNames())
                    {
                        var name = Rot13(v);
                        if (!name.ToLowerInvariant().EndsWith(".exe")) continue;
                        var when = DateTime.MinValue;
                        try
                        {
                            if (cnt.GetValue(v) is byte[] d && d.Length >= 68)
                            {
                                long ft = BitConverter.ToInt64(d, 60);
                                if (ft > 0) when = DateTime.FromFileTime(ft);
                            }
                        }
                        catch { }
                        Add(Path.GetFileName(name), name, when, "UserAssist");
                    }
                }
            }
        }
        catch { }

        // 5) MUICache
        try
        {
            using var mui = Registry.CurrentUser.OpenSubKey(
                @"Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\MuiCache");
            if (mui != null)
            {
                _artifacts.Add("MUICache");
                foreach (var v in mui.GetValueNames())
                {
                    var low = v.ToLowerInvariant();
                    if (!low.Contains(".exe")) continue;
                    var path = v.Split(new[] { ".FriendlyAppName", ".ApplicationCompany" }, StringSplitOptions.None)[0];
                    Add(Path.GetFileName(path), path, DateTime.MinValue, "MUICache");
                }
            }
        }
        catch { }

        // 6) v4.0: PCA general database (Windows 11) — includes programs that crashed / were blocked
        try
        {
            var pcaDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "appcompat", "pca");
            foreach (var db in new[] { "PcaGeneralDb0.txt", "PcaGeneralDb1.txt" })
            {
                var fp = Path.Combine(pcaDir, db);
                if (!File.Exists(fp)) continue;
                _artifacts.Add("PCA " + db);
                // format: time|runStatus|path|description|vendor|version|programId|exitCode
                foreach (var line in File.ReadLines(fp))
                {
                    var parts = line.Split('|');
                    if (parts.Length < 3) continue;
                    var path = Environment.ExpandEnvironmentVariables(parts[2].Trim());
                    if (!path.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) continue;
                    DateTime.TryParse(parts[0].Trim(), System.Globalization.CultureInfo.InvariantCulture,
                        System.Globalization.DateTimeStyles.AssumeUniversal, out var when);
                    Add(Path.GetFileName(path), path, when, "PCA");
                }
            }
        }
        catch { }

        // 7) v4.0: AmCache hive presence (the hive itself is locked by Windows while running)
        try
        {
            var am = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "appcompat", "Programs", "Amcache.hve");
            if (File.Exists(am))
            {
                _artifacts.Add("AmCache");
                var fi = new FileInfo(am);
                if (fi.Length < 256 * 1024)
                    _amcacheTiny = true; // a near-empty AmCache = wiped
            }
        }
        catch { }

        // 8) v4.0: ShimCache / AppCompatCache — every exe Windows has "seen" (even if deleted)
        try
        {
            using var k = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\Session Manager\AppCompatCache");
            if (k?.GetValue("AppCompatCache") is byte[] data && data.Length > 128)
            {
                _artifacts.Add("ShimCache (AppCompatCache)");
                foreach (var path in ParseShimCache(data))
                    Add(Path.GetFileName(path), path, DateTime.MinValue, "ShimCache");
            }
        }
        catch { }

        return all.Values.OrderByDescending(e => e.Flagged).Take(500).ToList();
    }

    // ================================================================
    //  COMMAND HISTORY
    // ================================================================
    private static readonly string[] CmdFlags = {
        "set-mppreference", "add-mppreference", "disablerealtimemonitoring",
        "wevtutil cl", "clear-eventlog", "vssadmin delete", "cipher /w",
        "bcdedit", "bitsadmin", "certutil -urlcache", "certutil.exe -urlcache",
        "invoke-webrequest", "iwr ", "invoke-expression", "iex ", "downloadfile", "downloadstring",
        "frombase64string", "-enc ", "-encodedcommand", "reg delete", "schtasks /create",
        "takeown", "icacls", "attrib +h", "\\prefetch",
        // v4.0 additions
        "remove-item", "del /f", "wmic shadowcopy", "sc stop", "sc config",
        "netsh advfirewall", "netsh firewall", "reg add", "taskkill /f",
        "fsutil usn deletejournal", "compact /u", "wbadmin delete",
    };

    private void ScanBypassTells(ScanReport report)
    {
        var w = report.Warnings;

        // Prefetch enabled but almost empty = history wiped
        try
        {
            var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "Prefetch");
            bool enabled = true;
            using (var k = Registry.LocalMachine.OpenSubKey(
                @"SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management\PrefetchParameters"))
                if (k?.GetValue("EnablePrefetcher") is int ep) enabled = ep != 0;
            if (enabled && Directory.Exists(dir))
            {
                int n = Directory.GetFiles(dir, "*.pf").Length;
                if (n < 10)
                    w.Add(new Warning { Title = "Prefetch looks wiped", Category = "Cleaning",
                        Detail = $"Only {n} Prefetch records while Prefetch is enabled — execution history may have been cleared before the check." });
            }
        }
        catch { }

        // Windows Defender disabled by policy
        try
        {
            using var k = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Policies\Microsoft\Windows Defender");
            if (k?.GetValue("DisableAntiSpyware") is int v && v == 1)
                w.Add(new Warning { Title = "Windows Defender disabled by policy", Category = "Antivirus",
                    Detail = "Real-time protection was turned off — common when running or hiding a cheat." });
        }
        catch { }

        // Security event log unusually small and freshly created
        try
        {
            var log = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),
                "System32", "winevt", "Logs", "Security.evtx");
            var fi = new FileInfo(log);
            if (fi.Exists && fi.Length < 100 * 1024 && (DateTime.Now - fi.CreationTime).TotalDays < 3)
                w.Add(new Warning { Title = "Security event log looks cleared", Category = "Cleaning",
                    Detail = "The Windows Security log is unusually small and was created recently — logs may have been wiped." });
        }
        catch { }

        // BAM almost empty
        try
        {
            using var bam = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Services\bam\State\UserSettings");
            if (bam != null)
            {
                int n = 0;
                foreach (var sid in bam.GetSubKeyNames())
                {
                    using var u = bam.OpenSubKey(sid); if (u == null) continue;
                    n += u.GetValueNames().Count(x => x.ToLowerInvariant().EndsWith(".exe"));
                }
                if (n < 5)
                    w.Add(new Warning { Title = "Activity history (BAM) almost empty", Category = "Cleaning",
                        Detail = "Very few recorded programs — the background-activity log may have been cleaned." });
            }
        }
        catch { }

        // near-empty execution history
        try
        {
            if (report.ExecutedPrograms != null && report.ExecutedPrograms.Count < 8)
                w.Add(new Warning { Title = "Very little execution history", Category = "Cleaning",
                    Detail = "Windows normally records dozens of programs; a near-empty history suggests anti-forensic cleaning." });
        }
        catch { }

        // v4.0: USN journal deleted (anti-forensic)
        try
        {
            var psi = new ProcessStartInfo("fsutil", "usn queryjournal c:")
            {
                RedirectStandardOutput = true, RedirectStandardError = true,
                UseShellExecute = false, CreateNoWindow = true,
            };
            using var p = Process.Start(psi);
            if (p != null)
            {
                var outp = p.StandardOutput.ReadToEnd();
                p.WaitForExit(5000);
                if (outp.Contains("not active", StringComparison.OrdinalIgnoreCase)
                    || outp.Contains("n'est pas actif", StringComparison.OrdinalIgnoreCase))
                    w.Add(new Warning { Title = "USN Journal deleted or disabled", Category = "Cleaning",
                        Detail = "The NTFS change journal is not active — this erases the record of file modifications." });
            }
        }
        catch { }

        if (_amcacheTiny)
            w.Add(new Warning { Title = "AmCache looks wiped", Category = "Cleaning",
                Detail = "The AmCache execution database is almost empty — it is normally several MB on a used PC." });

        // v4.0: Jump lists / Recent items wiped
        try
        {
            var recent = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Microsoft", "Windows", "Recent");
            if (Directory.Exists(recent) && _winInstall.HasValue && (DateTime.Now - _winInstall.Value).TotalDays > 14)
            {
                int n = Directory.GetFiles(recent, "*.lnk").Length;
                if (n < 3)
                    w.Add(new Warning { Title = "Recent files list is empty", Category = "Cleaning",
                        Detail = $"Only {n} recent items on a PC installed {_winInstall.Value:dd/MM/yyyy} — the Recent list was probably cleared." });
            }
        }
        catch { }

        // v4.0: System Restore disabled
        try
        {
            using var k = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Policies\Microsoft\Windows NT\SystemRestore");
            if (k?.GetValue("DisableSR") is int v && v == 1)
                w.Add(new Warning { Title = "System Restore disabled by policy", Category = "Cleaning",
                    Detail = "System Restore is disabled — removes the ability to recover previous file versions." });
        }
        catch { }
    }

    private List<CommandEntry> ScanCommandHistory(ScanReport report)
    {
        var list = new List<CommandEntry>();

        // PowerShell PSReadLine history
        try
        {
            var hist = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "Microsoft", "Windows", "PowerShell", "PSReadLine", "ConsoleHost_history.txt");
            if (File.Exists(hist))
            {
                _artifacts.Add("PowerShell history");
                foreach (var line in File.ReadLines(hist))
                {
                    var t = line.Trim();
                    if (t.Length == 0) continue;
                    var low = t.ToLowerInvariant();
                    list.Add(new CommandEntry
                    {
                        Text = t.Length > 300 ? t.Substring(0, 300) : t,
                        Source = "PowerShell",
                        Suspicious = CmdFlags.Any(f => low.Contains(f)),
                    });
                }
            }
        }
        catch { }

        // RunMRU (Win+R)
        try
        {
            using var run = Registry.CurrentUser.OpenSubKey(
                @"Software\Microsoft\Windows\CurrentVersion\Explorer\RunMRU");
            if (run != null)
            {
                _artifacts.Add("RunMRU");
                foreach (var v in run.GetValueNames())
                {
                    if (v == "MRUList") continue;
                    var t = (run.GetValue(v)?.ToString() ?? "");
                    if (t.EndsWith("\\1")) t = t.Substring(0, t.Length - 2);
                    t = t.Trim();
                    if (t.Length == 0) continue;
                    var low = t.ToLowerInvariant();
                    list.Add(new CommandEntry { Text = t, Source = "Run", Suspicious = CmdFlags.Any(f => low.Contains(f)) });
                }
            }
        }
        catch { }

        // v4.0: CMD history (doskey / command processor)
        try
        {
            var cmdHist = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "Microsoft", "Windows", "cmd_history.txt");
            if (File.Exists(cmdHist))
            {
                _artifacts.Add("CMD history");
                foreach (var line in File.ReadLines(cmdHist).Take(200))
                {
                    var t = line.Trim();
                    if (t.Length == 0) continue;
                    var low = t.ToLowerInvariant();
                    list.Add(new CommandEntry { Text = t, Source = "CMD", Suspicious = CmdFlags.Any(f => low.Contains(f)) });
                }
            }
        }
        catch { }

        int susN = list.Count(c => c.Suspicious);
        if (susN > 0)
            report.Warnings.Add(new Warning
            {
                Category = "Commands",
                Title = $"{susN} suspicious command(s) in PowerShell / Run history",
                Detail = "Commands that disable protection, download files or wipe traces were run on this PC."
            });

        return list.Take(400).ToList();
    }

    // ================================================================
    //  ANTIVIRUS, DEFENDER EXCLUSIONS, INJECTION HOOKS
    // ================================================================
    private void ScanAntivirusAndHooks(ScanReport report)
    {
        // AV products
        try
        {
            using var q = new ManagementObjectSearcher(@"root\SecurityCenter2", "SELECT displayName, productState FROM AntiVirusProduct");
            foreach (ManagementObject av in q.Get())
            {
                var name = av["displayName"]?.ToString() ?? "?";
                int state = 0; try { state = Convert.ToInt32(av["productState"]); } catch { }
                bool on = ((state >> 12) & 0xF) == 1;
                report.Antivirus.Add(name + (on ? " (on)" : " (off)"));
                if (!on) report.Warnings.Add(new Warning { Category = "Antivirus", Title = name + " real-time protection is off",
                    Detail = "Antivirus switched off — usually done so a cheat or loader isn't quarantined." });
            }
            _artifacts.Add("Security Center");
        }
        catch { }

        // Defender exclusions
        foreach (var kind in new[] { "Paths", "Processes", "Extensions" })
        {
            try
            {
                using var k = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows Defender\Exclusions\" + kind);
                if (k == null) continue;
                foreach (var v in k.GetValueNames())
                    report.Warnings.Add(new Warning { Category = "Antivirus", Title = "Defender exclusion (" + kind.ToLower() + "): " + v,
                        Detail = "This " + kind.ToLower().TrimEnd('s') + " is excluded from Windows Defender scanning. Check what lives there." });
            }
            catch { }
        }

        // AppInit_DLLs
        foreach (var root in new[] { @"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Windows", @"SOFTWARE\WOW6432Node\Microsoft\Windows NT\CurrentVersion\Windows" })
        {
            try
            {
                using var k = Registry.LocalMachine.OpenSubKey(root);
                var dlls = k?.GetValue("AppInit_DLLs")?.ToString();
                if (!string.IsNullOrWhiteSpace(dlls))
                    report.Warnings.Add(new Warning { Category = "Injection", Title = "AppInit_DLLs set: " + dlls,
                        Detail = "A DLL is force-loaded into every program — a known injection method." });
            }
            catch { }
        }

        // IFEO debugger hijacks
        try
        {
            using var ifeo = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options");
            if (ifeo != null)
                foreach (var exe in ifeo.GetSubKeyNames())
                {
                    using var k = ifeo.OpenSubKey(exe);
                    var dbg = k?.GetValue("Debugger")?.ToString();
                    if (string.IsNullOrWhiteSpace(dbg)) continue;
                    report.Warnings.Add(new Warning { Category = "Injection", Title = "IFEO hijack on " + exe + " → " + dbg,
                        Detail = "When " + exe + " starts, Windows launches another program instead/first — used by loaders to hook the game." });
                }
        }
        catch { }

        // Test-signing mode
        try
        {
            using var k = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control");
            var opts = k?.GetValue("SystemStartOptions")?.ToString() ?? "";
            if (opts.Contains("TESTSIGNING", StringComparison.OrdinalIgnoreCase))
                report.Warnings.Add(new Warning { Category = "Injection", Title = "Windows test-signing mode is ON",
                    Detail = "Allows unsigned kernel drivers — what kernel cheats and spoofers need." });
        }
        catch { }

        // v4.0: Debug mode
        try
        {
            using var k = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control");
            var opts = k?.GetValue("SystemStartOptions")?.ToString() ?? "";
            if (System.Text.RegularExpressions.Regex.IsMatch(opts, @"(^|\s)DEBUG(\s|=|$)", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                report.Warnings.Add(new Warning { Category = "Injection", Title = "Windows debug mode is ON",
                    Detail = "Debug mode allows kernel debugging — used to load unsigned drivers and bypass protections." });
        }
        catch { }

        // v4.0: kernel debugger / DSE override flags in boot config
        try
        {
            using var k = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control");
            var opts = k?.GetValue("SystemStartOptions")?.ToString() ?? "";
            if (opts.Contains("DISABLE_INTEGRITY_CHECKS", StringComparison.OrdinalIgnoreCase)
                || opts.Contains("NOINTEGRITYCHECKS", StringComparison.OrdinalIgnoreCase))
                report.Warnings.Add(new Warning { Category = "Injection", Title = "Driver signature enforcement is OFF",
                    Detail = "Windows was booted without driver signature checks — any unsigned kernel cheat can load." });
        }
        catch { }

        // tag warnings with categories
        foreach (var w in report.Warnings.Where(x => x.Category == "System"))
        {
            var t = w.Title.ToLowerInvariant();
            if (t.Contains("defender")) w.Category = "Antivirus";
            else if (t.Contains("wiped") || t.Contains("cleared") || t.Contains("empty") || t.Contains("history") || t.Contains("reinstalled")) w.Category = "Cleaning";
            else if (t.Contains("command")) w.Category = "Commands";
        }
    }

    // ================================================================
    //  v4.0 — HOSTS FILE TAMPERING
    // ================================================================
    private void ScanHostsFile(ScanReport report)
    {
        try
        {
            var hostsPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),
                "System32", "drivers", "etc", "hosts");
            if (!File.Exists(hostsPath)) return;
            _artifacts.Add("hosts file");

            var lines = File.ReadAllLines(hostsPath);
            var suspicious = new List<string>();
            var blockedDomains = new[] {
                "fivem", "cfx.re", "citizenfx", "battleye", "easyanticheat", "faceit",
                "vanguard", "riot", "anticheat", "fairfight", "punkbuster",
            };

            foreach (var raw in lines)
            {
                var line = raw.Trim();
                if (line.Length == 0 || line.StartsWith("#")) continue;
                var low = line.ToLowerInvariant();
                // check if it's blocking a game/anticheat domain
                if (blockedDomains.Any(d => low.Contains(d)))
                    suspicious.Add(line);
            }

            if (suspicious.Count > 0)
            {
                report.System.HostsFileStatus = $"MODIFIED ({suspicious.Count} suspicious entries)";
                report.Warnings.Add(new Warning
                {
                    Category = "Evasion",
                    Title = $"Hosts file blocking {suspicious.Count} game/anticheat domain(s)",
                    Detail = "The Windows hosts file redirects game or anticheat domains — " +
                        string.Join(", ", suspicious.Take(3).Select(s => s.Length > 60 ? s[..60] : s))
                });
            }
        }
        catch { }
    }

    // ================================================================
    //  v4.0 — FIREWALL RULES
    // ================================================================
    private void ScanFirewallRules(ScanReport report)
    {
        try
        {
            var psi = new ProcessStartInfo("netsh", "advfirewall firewall show rule name=all dir=out verbose")
            {
                RedirectStandardOutput = true, UseShellExecute = false, CreateNoWindow = true,
            };
            using var p = Process.Start(psi);
            if (p == null) return;
            var output = p.StandardOutput.ReadToEnd();
            p.WaitForExit(15000);
            _artifacts.Add("Firewall rules");

            var targets = new[] { "fivem", "citizenfx", "cfx.re", "cfx", "anticheat", "fxserver", "gta5", "gtav", "socialclub", "rockstar" };

            // netsh prints one block per rule separated by a blank line; key: value lines.
            foreach (var block in output.Replace("\r", "").Split(new[] { "\n\n" }, StringSplitOptions.RemoveEmptyEntries))
            {
                var lines = block.Split('\n').Select(l => l.Trim()).Where(l => l.Contains(':')).ToList();
                if (lines.Count < 3) continue;
                // first line = rule name (label is translated on non-English Windows, so take the value)
                string Val(string l) { int i = l.IndexOf(':'); return i >= 0 ? l.Substring(i + 1).Trim() : ""; }
                var ruleName = Val(lines[0]);
                var all = block.ToLowerInvariant();
                bool isBlock = lines.Any(l => (l.StartsWith("Action", StringComparison.OrdinalIgnoreCase) || l.StartsWith("Op", StringComparison.OrdinalIgnoreCase))
                                             && (l.Contains("Block", StringComparison.OrdinalIgnoreCase) || l.Contains("Bloquer", StringComparison.OrdinalIgnoreCase)));
                if (!isBlock) continue;
                var hit = targets.FirstOrDefault(t => all.Contains(t));
                if (hit == null) continue;
                var prog = lines.Select(Val).FirstOrDefault(v => v.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) ?? "(any program)";
                report.FirewallRules.Add($"BLOCK OUT: {ruleName} → {prog}");
            }

            if (report.FirewallRules.Count > 0)
                report.Warnings.Add(new Warning
                {
                    Category = "Network",
                    Title = $"Firewall blocks FiveM / game traffic ({report.FirewallRules.Count} rule(s))",
                    Detail = "Outbound rules block FiveM / Rockstar / anticheat — used to stop the game reporting or updating: "
                             + string.Join("; ", report.FirewallRules.Take(3))
                });
        }
        catch { }
    }

    // ================================================================
    //  v4.0 — WINDOWS EVENT LOG
    // ================================================================
    private void ScanEventLog(ScanReport report)
    {
        try
        {
            // 7045 = new service / driver installed (last 7 days)
            ReadEventEntries(report, "System",
                "*[System[(EventID=7045) and TimeCreated[timediff(@SystemTime) <= 604800000]]]", "ServiceInstall", 40);
            // 1102 = Security log cleared, 104 = any log cleared (last 30 days)
            ReadEventEntries(report, "Security",
                "*[System[(EventID=1102) and TimeCreated[timediff(@SystemTime) <= 2592000000]]]", "AuditClear", 10);
            ReadEventEntries(report, "System",
                "*[System[(EventID=104) and TimeCreated[timediff(@SystemTime) <= 2592000000]]]", "LogClear", 10);
            // Defender: 1116 = threat found, 5001 = real-time protection turned off (last 14 days)
            ReadEventEntries(report, "Microsoft-Windows-Windows Defender/Operational",
                "*[System[(EventID=1116 or EventID=5001) and TimeCreated[timediff(@SystemTime) <= 1209600000]]]", "Defender", 30);
            // Sysmon process creation, if Sysmon is installed (last 24h)
            ReadEventEntries(report, "Microsoft-Windows-Sysmon/Operational",
                "*[System[(EventID=1) and TimeCreated[timediff(@SystemTime) <= 86400000]]]", "ProcessCreate", 50);

            // keep only service/driver installs that are NOT Windows / Microsoft (they are noise)
            report.EventLogEntries = report.EventLogEntries.Where(e => e.Category != "ServiceInstall" || !IsBenignServiceInstall(e.Message)).ToList();

            var clears = report.EventLogEntries.Where(e => e.Category is "AuditClear" or "LogClear").ToList();
            if (clears.Count > 0)
                report.Warnings.Add(new Warning
                {
                    Category = "Cleaning",
                    Title = $"Windows event logs were cleared ({clears.Count}x, last: {clears.First().When})",
                    Detail = "Event logs were wiped by hand — a strong anti-forensic sign before a PC check."
                });

            // driver services installed from a user folder = kernel cheat / mapper / spoofer install
            foreach (var e in report.EventLogEntries.Where(e => e.Category == "ServiceInstall"))
            {
                var m = e.Message.ToLowerInvariant();
                if ((m.Contains(@"\users\") || m.Contains(@"\temp\") || m.Contains(@"\downloads\")) && m.Contains(".sys"))
                    report.Warnings.Add(new Warning
                    {
                        Category = "Injection",
                        Title = "Kernel driver installed from a user folder (" + e.When + ")",
                        Detail = "A driver service was created from Users/Temp/Downloads — how kdmapper-style cheats and HWID spoofers load. " + Trunc(e.Message, 160)
                    });
            }

            // Defender caught something or was switched off
            var threats = report.EventLogEntries.Where(e => e.Category == "Defender" && e.EventId == 1116).ToList();
            if (threats.Count > 0)
                report.Warnings.Add(new Warning
                {
                    Category = "Antivirus",
                    Title = $"Windows Defender detected {threats.Count} threat(s) in the last 14 days",
                    Detail = "Cheat loaders are often flagged by Defender: " + Trunc(threats.First().Message, 160)
                });
            if (report.EventLogEntries.Any(e => e.Category == "Defender" && e.EventId == 5001))
                report.Warnings.Add(new Warning
                {
                    Category = "Antivirus",
                    Title = "Defender real-time protection was turned off recently",
                    Detail = "Protection was disabled in the last 14 days — common right before running a cheat."
                });
        }
        catch { }
    }

    private static bool IsBenignServiceInstall(string msg)
    {
        var m = msg.ToLowerInvariant();
        var path = System.Text.RegularExpressions.Regex.Match(m, @"(?:[a-z]:\\|\\systemroot\\|system32\\)[^""]*?\.(?:exe|sys|dll)").Value;
        if (path.Length == 0) return m.Contains("microsoft");
        if (path.StartsWith("system32\\") || path.Contains("\\windows\\") || path.StartsWith("\\systemroot\\")) return true;
        if (path.Contains("\\program files") && (m.Contains("microsoft") || m.Contains("nvidia") || m.Contains("amd ") || m.Contains("intel"))) return true;
        return false;
    }

    private void ReadEventEntries(ScanReport report, string logName, string xpath, string category, int max = 20)
    {
        try
        {
            var psi = new ProcessStartInfo("wevtutil", $"qe \"{logName}\" /q:\"{xpath}\" /c:{max} /rd:true /f:text")
            {
                RedirectStandardOutput = true, RedirectStandardError = true,
                UseShellExecute = false, CreateNoWindow = true,
            };
            using var p = Process.Start(psi);
            if (p == null) return;
            var output = p.StandardOutput.ReadToEnd();
            p.WaitForExit(10000);
            if (string.IsNullOrWhiteSpace(output)) return;
            _artifacts.Add($"EventLog:{logName}");

            // one block per event, starting with "Event[n]:"
            var blocks = System.Text.RegularExpressions.Regex.Split(output, @"(?m)^Event\[\d+\]:");
            foreach (var blk in blocks)
            {
                if (string.IsNullOrWhiteSpace(blk)) continue;
                string F(string label)
                {
                    var m = System.Text.RegularExpressions.Regex.Match(blk, @"(?m)^\s*" + label + @":\s*(.*)$");
                    return m.Success ? m.Groups[1].Value.Trim() : "";
                }
                int.TryParse(F("Event ID"), out var id);
                if (id == 0) continue;
                var di = blk.IndexOf("Description:", StringComparison.Ordinal);
                var msg = di >= 0 ? blk.Substring(di + 12) : "";
                msg = System.Text.RegularExpressions.Regex.Replace(msg, @"\s+", " ").Trim();
                report.EventLogEntries.Add(new EventLogEntry
                {
                    Source = F("Source"), EventId = id, When = F("Date"),
                    Message = Trunc(msg, 400), Category = category
                });
            }
        }
        catch { }
    }

    // ================================================================
    //  v4.0 — ALTERNATE DATA STREAMS
    // ================================================================
    private void ScanAlternateDataStreams(ScanReport report)
    {
        // ADS can hide executables in NTFS — check user folders
        var up = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        var foldersToCheck = new[]
        {
            Path.Combine(up, "Downloads"),
            Path.Combine(up, "Desktop"),
            Path.Combine(up, "Documents"),
            Path.GetTempPath(),
        };

        foreach (var folder in foldersToCheck)
        {
            if (!Directory.Exists(folder)) continue;
            try
            {
                var psi = new ProcessStartInfo("cmd", $"/c dir /r \"{folder}\"")
                {
                    RedirectStandardOutput = true, UseShellExecute = false, CreateNoWindow = true,
                    StandardOutputEncoding = System.Text.Encoding.UTF8
                };
                using var p = Process.Start(psi);
                if (p == null) continue;
                var output = p.StandardOutput.ReadToEnd();
                p.WaitForExit(5000);

                // `dir /r` prints streams as:  "      1 234 name.ext:stream:$DATA"
                foreach (var line in output.Split('\n'))
                {
                    var m = System.Text.RegularExpressions.Regex.Match(line.TrimEnd('\r'), @"^\s*[\d\s., ]+\s(.+?):([^:]+):\$DATA\s*$");
                    if (!m.Success) continue;
                    var host = m.Groups[1].Value.Trim();
                    var stream = m.Groups[2].Value.Trim();
                    var sl = stream.ToLowerInvariant();
                    if (sl is "zone.identifier" or "smartscreen" or "encryptable" or "favicon") continue;
                    var kind = sl.EndsWith(".exe") || sl.EndsWith(".dll") || sl.EndsWith(".sys") || sl.EndsWith(".bat")
                               || sl.EndsWith(".ps1") || sl.EndsWith(".vbs") || sl.EndsWith(".lua") ? "executable" : "data";
                    _suspicious.Add(new SuspiciousFile
                    {
                        Path = Path.Combine(folder, host) + ":" + stream,
                        Kind = kind == "executable" ? "Hidden executable in NTFS stream (ADS)" : "Hidden NTFS data stream (ADS)"
                    });
                    if (kind == "executable")
                        report.Warnings.Add(new Warning
                        {
                            Category = "Evasion",
                            Title = $"Hidden file \"{stream}\" inside {host}",
                            Detail = "A program is hidden inside another file's NTFS alternate data stream — invisible in Explorer, used to hide cheats."
                        });
                }
            }
            catch { }
        }
    }

    // ================================================================
    //  v4.0 — VSS AND ANTI-FORENSIC CHECKS
    // ================================================================
    private void ScanVSSAndAntiForensic(ScanReport report)
    {
        // Shadow copies deleted on purpose leave event 8224/VSS or a "vssadmin delete" in history.
        // Many home PCs simply have System Restore off, so "no shadows" alone is NOT flagged.
        try
        {
            bool deletedInHistory = report.Commands.Any(c =>
            {
                var t = c.Text.ToLowerInvariant();
                return t.Contains("vssadmin delete") || t.Contains("shadowcopy delete") || t.Contains("wbadmin delete");
            });
            if (deletedInHistory)
                report.Warnings.Add(new Warning { Category = "Cleaning", Title = "Shadow copies / backups were deleted by command",
                    Detail = "A command to delete Volume Shadow Copies or backups was run — removes old versions of files (evidence)." });
        }
        catch { }

        // Clock changed recently (Security event 4616) — used to fake file timestamps
        try
        {
            ReadEventEntries(report, "Security",
                "*[System[(EventID=4616) and TimeCreated[timediff(@SystemTime) <= 604800000]]]", "TimeChange", 10);
            // Windows' own time sync runs as svchost / LOCAL SERVICE — anything else is a person
            int manual = report.EventLogEntries.Count(e => e.Category == "TimeChange" && e.Message.Length > 0
                && !e.Message.Contains("svchost.exe", StringComparison.OrdinalIgnoreCase)
                && !e.Message.Contains("LOCAL SERVICE", StringComparison.OrdinalIgnoreCase)
                && !e.Message.Contains("SERVICE LOCAL", StringComparison.OrdinalIgnoreCase));
            if (manual > 0)
                report.Warnings.Add(new Warning { Category = "Evasion", Title = $"System clock changed manually ({manual}x this week)",
                    Detail = "Someone changed the Windows time by hand — used to make files look older or newer than they are." });
        }
        catch { }
    }

    // ================================================================
    //  USB DEVICES
    // ================================================================
    private List<string> ReadUsbDevices()
    {
        var list = new List<string>();
        try
        {
            using var k = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Enum\USBSTOR");
            if (k == null) return list;
            _artifacts.Add("USBSTOR");
            foreach (var dev in k.GetSubKeyNames())
            {
                using var dk = k.OpenSubKey(dev);
                foreach (var inst in dk?.GetSubKeyNames() ?? Array.Empty<string>())
                {
                    using var ik = dk?.OpenSubKey(inst);
                    var name = ik?.GetValue("FriendlyName")?.ToString() ?? dev.Replace("Disk&Ven_", "").Replace("&Prod_", " ");
                    list.Add(name + "  [" + inst.Split('&')[0] + "]");
                }
            }
        }
        catch { }
        return list.Distinct().Take(50).ToList();
    }

    // ================================================================
    //  BROWSERS
    // ================================================================
    private List<string> ReadBrowsers()
    {
        var la = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var ra = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var map = new (string name, string path)[]
        {
            ("Chrome", Path.Combine(la, "Google", "Chrome", "User Data")),
            ("Edge", Path.Combine(la, "Microsoft", "Edge", "User Data")),
            ("Brave", Path.Combine(la, "BraveSoftware", "Brave-Browser", "User Data")),
            ("Opera", Path.Combine(ra, "Opera Software", "Opera Stable")),
            ("Opera GX", Path.Combine(ra, "Opera Software", "Opera GX Stable")),
            ("Firefox", Path.Combine(ra, "Mozilla", "Firefox", "Profiles")),
            ("Vivaldi", Path.Combine(la, "Vivaldi", "User Data")),
            // v4.0
            ("Tor Browser", Path.Combine(up(), "Desktop", "Tor Browser")),
            ("Waterfox", Path.Combine(ra, "Waterfox", "Profiles")),
        };
        var list = new List<string>();
        foreach (var (n, p) in map)
            try { if (Directory.Exists(p)) list.Add(n + " — last used " + Ago(Directory.GetLastWriteTime(p))); } catch { }
        if (list.Count > 0) _artifacts.Add("Browsers");
        return list;
    }

    // ================================================================
    //  LINKED ACCOUNTS
    // ================================================================
    private string? ReadDiscordId()
    {
        try
        {
            var p = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "discord", "settings.json");
            if (!File.Exists(p)) return null;
            _artifacts.Add("Discord settings.json");
            var txt = File.ReadAllText(p);
            var m = System.Text.RegularExpressions.Regex.Match(txt, "\"USER_ID\"\\s*:\\s*\"(\\d{5,25})\"");
            return m.Success ? m.Groups[1].Value : null;
        }
        catch { return null; }
    }

    private List<string> ReadSteamAccounts()
    {
        var list = new List<string>();
        try
        {
            string? steam = null;
            using (var k = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam"))
                steam = k?.GetValue("SteamPath")?.ToString();
            if (steam == null) return list;
            var vdf = Path.Combine(steam, "config", "loginusers.vdf");
            if (!File.Exists(vdf)) return list;
            _artifacts.Add("Steam loginusers.vdf");
            string id = "", name = "";
            foreach (var raw in File.ReadLines(vdf))
            {
                var line = raw.Trim();
                if (line.StartsWith("\"7656")) id = line.Trim('"');
                else if (line.StartsWith("\"AccountName\"") || line.StartsWith("\"PersonaName\""))
                {
                    var parts = line.Split('"').Where(x => x.Trim().Length > 0).ToArray();
                    if (parts.Length >= 2) name = parts[^1];
                }
                if (id != "" && name != "") { list.Add($"{name} — {id}"); id = name = ""; }
            }
        }
        catch { }
        return list.Distinct().Take(10).ToList();
    }

    // v4.0: Epic Games accounts
    private List<string> ReadEpicAccounts()
    {
        var list = new List<string>();
        try
        {
            var la = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var settingsDir = Path.Combine(la, "EpicGamesLauncher", "Saved", "Config", "Windows");
            if (!Directory.Exists(settingsDir)) return list;
            _artifacts.Add("Epic Games launcher");

            // check for logged-in user from GameUserSettings.ini
            var ini = Path.Combine(settingsDir, "GameUserSettings.ini");
            if (File.Exists(ini))
            {
                foreach (var line in File.ReadLines(ini))
                {
                    if (line.StartsWith("LastActiveEpicID=", StringComparison.OrdinalIgnoreCase))
                    {
                        var id = line.Substring(17).Trim();
                        if (id.Length > 5) list.Add(id);
                    }
                }
            }
        }
        catch { }
        return list.Distinct().Take(5).ToList();
    }

    // v4.0: Rockstar / Social Club accounts
    private List<string> ReadRockstarAccounts()
    {
        var list = new List<string>();
        try
        {
            var la = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var scDir = Path.Combine(la, "Rockstar Games", "Social Club");
            _artifacts.Add("Rockstar Social Club");

            // Documents\Rockstar Games\Social Club\Profiles\<profile id>
            var profileDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                "Rockstar Games", "Social Club", "Profiles");
            if (Directory.Exists(profileDir))
                foreach (var dir in Directory.GetDirectories(profileDir))
                {
                    var id = Path.GetFileName(dir);
                    list.Add($"Profile {id} — last used {Ago(Directory.GetLastWriteTime(dir))}");
                }
        }
        catch { }
        return list.Distinct().Take(5).ToList();
    }

    // ================================================================
    //  RECYCLE BIN
    // ================================================================
    private List<DeletedFile> ScanRecycleBin()
    {
        var list = new List<DeletedFile>();
        try
        {
            var rb = new DirectoryInfo(@"C:\$Recycle.Bin");
            if (!rb.Exists) return list;
            _artifacts.Add("Recycle bin contents");
            foreach (var userDir in rb.GetDirectories())
            {
                FileInfo[] files;
                try { files = userDir.GetFiles("$R*", SearchOption.TopDirectoryOnly); } catch { continue; }
                foreach (var f in files)
                {
                    var realExt = Path.GetExtension(f.Name).ToLowerInvariant();
                    var exe = realExt is ".exe" or ".dll" or ".sys";
                    list.Add(new DeletedFile
                    {
                        File = "*" + realExt + " (" + Math.Round(f.Length / 1024.0) + " KB)",
                        When = Ago(f.LastWriteTime),
                        Executable = exe
                    });
                }
            }
        }
        catch { }
        return list.OrderByDescending(d => d.Executable).Take(50).ToList();
    }

    // ================================================================
    //  HELPERS
    // ================================================================
    private Detection Det(string file, Signatures.Sig sig, string path, DetectMethod m, string when, string why, bool deleted)
        => new()
        {
            File = file, Signature = sig.Name, Path = path, Method = m,
            Severity = Signatures.ParseSeverity(sig.Severity), When = when, Deleted = deleted,
            Features = sig.Features, Explain = why
        };

    private static IEnumerable<string> FiveMRoots() => new[]
    {
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "FiveM"),
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "CitizenFX"),
    };

    private static IEnumerable<string> SafeEnumerate(string root, string[]? exts, int maxDepth)
    {
        var stack = new Stack<(string dir, int depth)>();
        stack.Push((root, 0));
        while (stack.Count > 0)
        {
            var (dir, depth) = stack.Pop();
            string[] files = Array.Empty<string>(), dirs = Array.Empty<string>();
            try { files = Directory.GetFiles(dir); } catch { }
            try { if (depth < maxDepth) dirs = Directory.GetDirectories(dir); } catch { }
            foreach (var f in files)
                if (exts == null || exts.Contains(Path.GetExtension(f).ToLowerInvariant()))
                    yield return f;
            foreach (var d in dirs) stack.Push((d, depth + 1));
        }
    }

    private static string GetStartType(string svc)
    {
        try
        {
            using var k = Registry.LocalMachine.OpenSubKey($@"SYSTEM\CurrentControlSet\Services\{svc}");
            return k?.GetValue("Start") is int i ? i switch { 2 => "Automatic", 3 => "Manual", 4 => "Disabled", _ => "Other" } : "Unknown";
        }
        catch { return "Unknown"; }
    }

    // Phrases typical of cheat menus (match on the lower-case strings view, so spaces work).
    private static readonly string[] StrongFeatures =
    {
        "triggerbot", "trigger bot", "silentaim", "silent aim", "magic bullet", "magicbullet", "wallhack", "wall hack",
        "norecoil", "no recoil", "nospread", "no spread", "aimlock", "aim lock", "aimassist", "aim assist",
        "skeleton esp", "box esp", "esp box", "bone esp", "name esp", "health esp", "distance esp", "esp distance",
        "aimbot fov", "aim fov", "fov circle", "draw fov", "aim key", "aimkey", "aim smooth", "smoothing aim",
        "ragebot", "rage bot", "legitbot", "legit bot", "hwid spoof", "hwidspoof", "hwid spoofer", "serial spoof",
        "lua executor", "luaexecutor", "lua injector", "resource stopper", "stop resource", "menu bypass",
        "anticheat bypass", "bypass anticheat", "ac bypass", "unlimited ammo", "infinite ammo", "rapid fire",
        "fast reload", "no reload", "god mode", "godmode", "noclip", "no clip", "teleport to waypoint", "tp to waypoint",
        "spawn vehicle", "give all weapons", "give weapon", "explode player", "crash player", "mod menu", "modmenu",
        "super jump", "superjump", "fast run", "infinite stamina", "invisible", "freecam",
    };
    private static readonly string[] WeakFeatures = { "aimbot", "cheat", "cheats", "injector", "unban", "spoofer", "bypass", "esp" };
    private static readonly string[] FiveMTells =
    {
        "triggerserverevent", "triggerclientevent", "invokenative", "citizen invokenative", "getplayerped", "playerpedid",
        "setentitycoords", "giveweapontoped", "addexplosion", "networkresurrectlocalplayer", "fivem exe", "fivem b",
        "gta5 exe", "gta5 b", "citizenfx", "cfx re",
    };
    private static readonly string[] InjectionApis =
    {
        "writeprocessmemory", "readprocessmemory", "virtualallocex", "createremotethread", "ntcreatethreadex",
        "ntwritevirtualmemory", "ntreadvirtualmemory", "setwindowshookex", "queueuserapc", "manualmap", "manual map",
        "loadlibrarya", "zwmapviewofsection", "openprocess",
    };
    private static readonly string[] OverlayTells = { "imgui", "kiero", "minhook", "detours", "present hook", "hkpresent", "swapchain" };
    // brand strings of well-known FiveM / GTA menus (space-separated where the name has a dot)
    private static readonly string[] BrandStrings =
    {
        "eulen", "redengine", "red engine", "skript gg", "hammafia", "lynx menu", "lynxmenu", "desudo", "susano",
        "tz project", "tzproject", "tzx", "absolute menu", "fallout menu", "brutan", "yimmenu", "kiddion", "cherax",
        "2take1", "phaze menu", "ozark menu", "lumia menu", "impact menu", "hx software", "fivem cheat", "fivemcheat",
    };

    // cheat word in a file / folder / process name — ignores "anticheat", "nocheat" etc.
    private static string? CheatWordIn(string name)
    {
        if (string.IsNullOrEmpty(name)) return null;
        var n = name.ToLowerInvariant().Replace("anti-cheat", "").Replace("anti_cheat", "").Replace("anticheat", "")
                    .Replace("nocheat", "").Replace("cheatsheet", "").Replace("cheat-sheet", "").Replace("cheat_sheet", "");
        return CheatWords.FirstOrDefault(w => n.Contains(w));
    }

    private static int CountHits(string content, string[] words, int max)
    {
        int n = 0;
        foreach (var w in words) if (ContainsWord(content, w) && ++n >= max) break;
        return n;
    }

    private static (int score, List<string> reasons, int strong, bool cheatSign) CheatScore(string content, string path, string low, bool dropZone)
    {
        var reasons = new List<string>();
        int score = 0;

        var brand = BrandStrings.FirstOrDefault(b => ContainsWord(content, b));
        if (brand != null) { score += 5; reasons.Add($"menu name \"{brand}\""); }

        var strong = StrongFeatures.Where(w => ContainsWord(content, w)).Take(6).ToList();
        score += Math.Min(strong.Count, 4) * 2;
        if (strong.Count > 0) reasons.Add("cheat features: " + string.Join(", ", strong));

        var weak = WeakFeatures.Where(w => ContainsWord(content, w)).Take(3).ToList();
        score += Math.Min(weak.Count, 2);
        if (weak.Count > 0) reasons.Add("words: " + string.Join(", ", weak));

        int fivem = CountHits(content, FiveMTells, 4);
        if (fivem >= 2) { score += 3; reasons.Add("FiveM executor code (events / natives)"); }
        else if (fivem == 1) { score += 1; reasons.Add("targets FiveM / GTA"); }

        int inj = CountHits(content, InjectionApis, 6);
        if (inj >= 4) { score += 2; reasons.Add("memory injection APIs"); }
        else if (inj >= 2) { score += 1; reasons.Add("process memory APIs"); }

        int ov = CountHits(content, OverlayTells, 3);
        if (ov >= 1) { score += 1; reasons.Add("in-game overlay (ImGui / DirectX hook)"); }

        if (score > 0 && dropZone) { score += 1; reasons.Add("in Downloads/Temp/AppData"); }

        // the folder it sits in is named like a cheat
        try
        {
            var folder = Path.GetFileName(Path.GetDirectoryName(path) ?? "").ToLowerInvariant();
            var fw = CheatWordIn(folder) ?? BrandStrings.FirstOrDefault(b => b.Length >= 5 && folder.Replace(" ", "").Contains(b.Replace(" ", "")));
            if (fw != null) { score += 2; reasons.Add($"folder named \"{folder}\""); }
        }
        catch { }

        return (score, reasons, strong.Count, brand != null || strong.Count > 0 || fivem >= 2);
    }

    private static bool IsGamePath(string low) =>
        low.Contains("fivem") || low.Contains("citizenfx") || low.Contains("\\mods\\") || low.Contains("\\resources\\")
        || low.Contains("\\gta") || low.Contains("grand theft auto") || low.Contains("rockstar games");

    // folders where the PLAYER adds files (not the game's own install)
    private static bool IsUserModPath(string low) =>
        !low.Contains("\\windows\\") && (low.Contains("\\plugins\\") || low.Contains("\\mods\\") || low.Contains("\\scripts\\"));

    // Shannon entropy (0–8) of the first 8 MB; > 7.2 on a whole .exe = packed / encrypted
    private static double FileEntropy(string path)
    {
        try
        {
            var fi = new FileInfo(path);
            if (fi.Length < 64 * 1024) return 0;
            var counts = new long[256];
            long total = 0;
            using var fs = File.OpenRead(path);
            var buf = new byte[1 << 16];
            int n;
            while (total < 8L * 1024 * 1024 && (n = fs.Read(buf, 0, buf.Length)) > 0)
            {
                for (int i = 0; i < n; i++) counts[buf[i]]++;
                total += n;
            }
            double h = 0;
            foreach (var c in counts) if (c > 0) { double p = (double)c / total; h -= p * Math.Log2(p); }
            return Math.Round(h, 2);
        }
        catch { return 0; }
    }

    private static double SafeSizeMb(string f) { try { return Math.Round(new FileInfo(f).Length / 1048576.0, 2); } catch { return 0; } }

    // Is this proxy DLL a known graphics mod? Checks version info first, then the file's own strings.
    private static string? GraphicsModName(string path)
    {
        try
        {
            var vi = FileVersionInfo.GetVersionInfo(path);
            var meta = $"{vi.ProductName} {vi.FileDescription} {vi.CompanyName} {vi.OriginalFilename}".ToLowerInvariant();
            if (meta.Contains("reshade")) return "ReShade";
            if (meta.Contains("enbseries") || meta.Contains("boris vorontsov")) return "ENB";
            if (meta.Contains("special k")) return "Special K";
        }
        catch { }
        var c = ReadAsLower(path);
        if (c == null) return null;
        if (c.Contains("reshade") && (c.Contains("crosire") || c.Contains("reshade ini") || c.Contains("reshadepreset"))) return "ReShade";
        if (c.Contains("enbseries") && c.Contains("enblocal")) return "ENB";
        return null;
    }

    private static string SafeWrite(string f) { try { return Ago(File.GetLastWriteTime(f)); } catch { return "unknown"; } }

    private static bool IsRecent(string f)
    {
        try { return (DateTime.Now - File.GetLastWriteTime(f)).TotalDays <= 14; } catch { return false; }
    }

    private static string? Sha256File(string path)
    {
        try
        {
            var fi = new FileInfo(path);
            if (!fi.Exists || fi.Length > 200 * 1024 * 1024) return null;
            using var sha = System.Security.Cryptography.SHA256.Create();
            using var fs = File.OpenRead(path);
            return Convert.ToHexString(sha.ComputeHash(fs)).ToLowerInvariant();
        }
        catch { return null; }
    }

    private static bool IsSigned(string path)
    {
        try
        {
            using var cert = System.Security.Cryptography.X509Certificates.X509Certificate.CreateFromSignedFile(path);
            return cert != null && !string.IsNullOrEmpty(cert.Subject);
        }
        catch { return false; }
    }

    private static string Ago(DateTime t)
    {
        var s = (DateTime.Now - t).TotalSeconds;
        if (s < 90) return "just now";
        if (s < 5400) return $"{Math.Round(s / 60)} min ago";
        if (s < 172800) return $"{Math.Round(s / 3600)} h ago";
        return $"{Math.Round(s / 86400)} days ago";
    }

    private static string Hash(string s)
    {
        using var sha = System.Security.Cryptography.SHA256.Create();
        return Convert.ToHexString(sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(s)))[..16].ToLowerInvariant();
    }

    private static DateTime SafeTime(string f) { try { return File.GetLastWriteTime(f); } catch { return DateTime.MinValue; } }

    private static string up() => Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);

    // Win10/11 ShimCache: header, then entries "10ts" + crc + len + pathLen(u16) + path(UTF-16) + ...
    private static IEnumerable<string> ParseShimCache(byte[] d)
    {
        var list = new List<string>();
        try
        {
            int off = d.Length > 4 ? BitConverter.ToInt32(d, 0) : 0;  // header size (0x30 / 0x34)
            if (off <= 0 || off >= d.Length) off = 0x34;
            int guard = 0;
            while (off + 12 < d.Length && guard++ < 4096)
            {
                if (!(d[off] == (byte)'1' && d[off + 1] == (byte)'0' && d[off + 2] == (byte)'t' && d[off + 3] == (byte)'s')) break;
                int entryLen = BitConverter.ToInt32(d, off + 8);
                int pLen = BitConverter.ToUInt16(d, off + 12);
                if (pLen > 0 && off + 14 + pLen <= d.Length)
                {
                    var path = Encoding.Unicode.GetString(d, off + 14, pLen);
                    if (path.StartsWith(@"\??")) path = path.Substring(4);
                    if (path.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) list.Add(path);
                }
                if (entryLen <= 0) break;
                off += 12 + entryLen;
            }
        }
        catch { }
        return list;
    }

    // simple CSV line splitter (handles quoted fields)
    private static List<string> SplitCsv(string line)
    {
        var result = new List<string>();
        bool inQuotes = false;
        var current = new System.Text.StringBuilder();
        foreach (var c in line)
        {
            if (c == '"') { inQuotes = !inQuotes; continue; }
            if (c == ',' && !inQuotes) { result.Add(current.ToString()); current.Clear(); continue; }
            current.Append(c);
        }
        result.Add(current.ToString());
        return result;
    }

    private static string Rot13(string s)
    {
        var a = s.ToCharArray();
        for (int i = 0; i < a.Length; i++)
        {
            char c = a[i];
            if (c >= 'a' && c <= 'z') a[i] = (char)('a' + (c - 'a' + 13) % 26);
            else if (c >= 'A' && c <= 'Z') a[i] = (char)('A' + (c - 'A' + 13) % 26);
        }
        return new string(a);
    }

    private static bool ContainsWord(string hay, string needle)
    {
        int i = 0;
        while ((i = hay.IndexOf(needle, i, StringComparison.Ordinal)) >= 0)
        {
            char b = i == 0 ? ' ' : hay[i - 1];
            int end = i + needle.Length;
            char a = end >= hay.Length ? ' ' : hay[end];
            bool bAl = (b >= 'a' && b <= 'z') || (b >= '0' && b <= '9');
            bool aAl = (a >= 'a' && a <= 'z') || (a >= '0' && a <= '9');
            if (!bAl && !aAl) return true;
            i = end;
        }
        return false;
    }

    // Lower-case "strings" view of a binary: letters/digits kept, everything else = space.
    // Adds a second pass for UTF-16LE text ("a\0i\0m\0b\0o\0t\0"), which is how C#/.NET
    // and most Windows programs store strings — without it those cheats are invisible.
    private static string? ReadAsLower(string path)
    {
        try
        {
            var fi = new FileInfo(path);
            if (!fi.Exists || fi.Length > 96L * 1024 * 1024) return null;
            var bytes = File.ReadAllBytes(path);
            static char Map(byte b) =>
                b >= 65 && b <= 90 ? (char)(b + 32)
                : (b >= 97 && b <= 122) || (b >= 48 && b <= 57) ? (char)b : ' ';
            var sb = new System.Text.StringBuilder(bytes.Length + bytes.Length / 2 + 2);
            foreach (var b in bytes) sb.Append(Map(b));
            if (bytes.Length <= 48L * 1024 * 1024)
            {
                sb.Append(' ');
                // two alignments, so strings starting on an odd byte are found too
                for (int start = 0; start < 2; start++)
                {
                    bool prevSpace = true;
                    for (int i = start; i + 1 < bytes.Length; i += 2)
                    {
                        char c = bytes[i + 1] == 0 ? Map(bytes[i]) : ' ';
                        if (c == ' ') { if (!prevSpace) sb.Append(' '); prevSpace = true; }
                        else { sb.Append(c); prevSpace = false; }
                    }
                    sb.Append(' ');
                }
            }
            return sb.ToString();
        }
        catch { return null; }
    }

    private static string? ReadTextLower(string path)
    {
        try
        {
            var fi = new FileInfo(path);
            if (!fi.Exists || fi.Length > 16L * 1024 * 1024) return null;
            var raw = File.ReadAllBytes(path);
            if (raw.Length >= 4 && raw[0] == 0x1B && raw[1] == (byte)'L' && raw[2] == (byte)'u' && raw[3] == (byte)'a')
                return "\u0000luabytecode\u0000";
            return System.Text.Encoding.UTF8.GetString(raw).ToLowerInvariant();
        }
        catch { return null; }
    }

    private static string? ScriptObfuscation(string text, string ext)
    {
        if (text == "\u0000luabytecode\u0000") return "compiled Lua";

        int nl = 0; foreach (var c in text) if (c == '\n') nl++;
        bool oneBigLine = text.Length > 4000 && nl <= 2;
        bool longB64 = HasLongBase64Run(text, 512);
        int fcc = CountOccurrences(text, "fromcharcode") + CountOccurrences(text, "char(");

        if (ext == ".lua")
        {
            if ((text.Contains("loadstring") || text.Contains("load(")) && (longB64 || oneBigLine)) return "obfuscated Lua";
        }
        else if (ext == ".ps1")
        {
            if (text.Contains("frombase64string") || text.Contains("-encodedcommand") || text.Contains("-enc ")) return "encoded PowerShell";
        }
        else if (ext is ".js" or ".vbs")
        {
            if (fcc >= 8 || (text.Contains("eval(") && longB64)) return "obfuscated script";
        }
        else if (ext is ".bat" or ".cmd")
        {
            if (text.Contains("frombase64string") || text.Contains("-encodedcommand")) return "encoded batch";
        }
        else if (ext == ".py")
        {
            if ((text.Contains("exec(") || text.Contains("eval(")) && (longB64 || text.Contains("b64decode"))) return "obfuscated Python";
        }
        if (longB64 && oneBigLine) return "encoded blob";
        return null;
    }

    private static int CountOccurrences(string s, string sub)
    {
        int n = 0, i = 0;
        while ((i = s.IndexOf(sub, i, StringComparison.Ordinal)) >= 0) { n++; i += sub.Length; }
        return n;
    }

    private static bool HasLongBase64Run(string s, int min)
    {
        int run = 0;
        foreach (var c in s)
        {
            bool b64 = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '+' || c == '/' || c == '=' || c == '_' || c == '-';
            if (b64) { if (++run >= min) return true; }
            else run = 0;
        }
        return false;
    }
}
