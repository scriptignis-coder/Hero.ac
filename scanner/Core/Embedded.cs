using System.Text.RegularExpressions;

namespace HeRoShield.Core;

/// <summary>
/// Per-player download link: the website appends "HEROPIN:ABCD2345|API:https://site" to the end of
/// the .exe it serves, and names the file "HeRoShield-ABCD2345.exe". The scanner reads either one
/// so the player never types the PIN. Extra bytes after a .NET single-file bundle are ignored by the runtime.
/// </summary>
public static class Embedded
{
    private static readonly Regex Tail = new(@"HEROPIN:([A-Z0-9]{4,12})(?:\|API:(https?://[A-Za-z0-9.\-:]+))?", RegexOptions.Compiled);
    private static readonly Regex Name = new(@"^HeRoShield[-_ ]([A-Za-z0-9]{4,12})(?=$|[-_ .(])", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static (string? Pin, string? Api) Read(string? exePath)
    {
        if (string.IsNullOrEmpty(exePath)) return (null, null);
        // 1) marker at the end of the file
        try
        {
            using var fs = new FileStream(exePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            int n = (int)Math.Min(1024, fs.Length);
            fs.Seek(-n, SeekOrigin.End);
            var buf = new byte[n];
            int read = 0;
            while (read < n) { int r = fs.Read(buf, read, n - read); if (r <= 0) break; read += r; }
            var m = Tail.Match(Encoding.ASCII.GetString(buf, 0, read));
            if (m.Success) return (m.Groups[1].Value, m.Groups[2].Success ? m.Groups[2].Value.TrimEnd('/') : null);
        }
        catch { }
        // 2) PIN in the file name (browser may add " (1)")
        try
        {
            var name = Path.GetFileNameWithoutExtension(exePath);
            var m = Name.Match(name);
            if (m.Success && !m.Groups[1].Value.Equals("scanner", StringComparison.OrdinalIgnoreCase))
                return (m.Groups[1].Value.ToUpperInvariant(), null);
        }
        catch { }
        return (null, null);
    }
}
