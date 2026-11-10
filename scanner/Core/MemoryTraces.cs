using System.Runtime.InteropServices;
using System.Text.RegularExpressions;

namespace HeRoShield.Core;

/// <summary>
/// Reads the memory of a few Windows processes that remember what ran on the PC, even after the
/// file was deleted and the logs were cleared — the same places pro screenshare tools look:
///  • DPS (Diagnostic Policy Service)  "!!cheat.exe!2026/11/08:15:12:33!…"  = program + time it ran
///  • PcaSvc (Program Compatibility Assistant) and SysMain: full paths of programs that ran
///  • explorer.exe: paths of files the player opened / browsed
///  • Dnscache: websites the PC resolved (cheat shop / loader domains)
/// Read-only (OpenProcess with VM_READ). Needs admin, which the scanner has.
/// </summary>
public static class MemoryTraces
{
    public enum Kind { Path, Dps, Domain }

    // printable ASCII / Latin-1 only: binary noise decoded as UTF-16 must not turn into "paths"
    private const string PC = @"[\x20-\x7E -ÿ]";
    private const string NoBad = @"[\x20\x21\x23-\x29\x2B-\x3B\x3D\x40-\x5B\x5D-\x7B\x7D\x7E -ÿ]";   // no " * < > ? \ |
    private static readonly Regex PathRx = new(@"(?i)(?:(?<![A-Za-z0-9])[A-Z]:\\|\\Device\\HarddiskVolume\d{1,2}\\)(?:" + NoBad + @"{1,120}\\){0,24}" + NoBad + @"{1,120}?\.(?:exe|dll|sys|ahk|lua|bat|cmd|ps1|py|jar|asi|scr|com)(?![A-Za-z0-9])", RegexOptions.Compiled);
    private static readonly Regex DpsRx = new(@"!!(" + NoBad + @"{1,160}?\.(?:exe|dll|bat|cmd|com|scr|ahk|py))!(\d{4}/\d{2}/\d{2}:\d{2}:\d{2}:\d{2})!", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex DomainRx = new(@"(?i)(?<![A-Za-z0-9.\-])(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.){1,4}(?:com|net|org|gg|cc|io|xyz|ru|to|me|dev|app|shop|store|pro|club|site|online|fun|lol|vip|cx|su|win|best|top|live|tech|wtf|ws|biz|info|co|uk|de|fr)(?![A-Za-z0-9\-])", RegexOptions.Compiled);

    // ------------------------------------------------------------------ pure part (testable)
    /// <summary>Finds paths / DPS entries / domains in a block of process memory (ASCII and both UTF-16 alignments).</summary>
    public static void ScanBuffer(byte[] buf, int len, bool domains, Action<Kind, string, string?> found)
    {
        if (len <= 0) return;
        var views = new List<string>(3);
        // quick pre-checks so we only decode blocks that can contain something
        bool asciiPath = HasAscii(buf, len, ":\\") || HasAscii(buf, len, "Volume") || HasAscii(buf, len, "!!");
        bool uniPath = HasUtf16(buf, len, ":\\") || HasUtf16(buf, len, "Volume") || HasUtf16(buf, len, "!!");
        if (asciiPath || domains) views.Add(Encoding.GetEncoding(28591).GetString(buf, 0, len));
        if (uniPath || domains)
        {
            views.Add(Encoding.Unicode.GetString(buf, 0, len & ~1));
            if (len > 2) views.Add(Encoding.Unicode.GetString(buf, 1, (len - 1) & ~1));
        }
        foreach (var v in views)
        {
            if (v.IndexOf("!!", StringComparison.Ordinal) >= 0)
                foreach (Match m in DpsRx.Matches(v)) found(Kind.Dps, m.Groups[1].Value, m.Groups[2].Value);
            if (v.IndexOf(":\\", StringComparison.Ordinal) >= 0 || v.IndexOf("HarddiskVolume", StringComparison.Ordinal) >= 0)
                foreach (Match m in PathRx.Matches(v))
                    foreach (var piece in SplitJoined(m.Value)) found(Kind.Path, piece, null);
            if (domains)
                foreach (Match m in DomainRx.Matches(v))
                    if (m.Value.Length >= 5 && m.Value.Length <= 80) found(Kind.Domain, m.Value.ToLowerInvariant(), null);
        }
    }

    // Memory often holds paths back to back with no separator:
    // "C:\…\Discord.exe\Device\HarddiskVolume1\Windows\System32\ctfmon.exe" — cut them apart.
    private static readonly Regex JoinCut = new(@"(?i)(?<=\.(?:exe|dll|sys|ahk|lua|bat|cmd|ps1|py|jar|asi|scr|com))(?=\\Device\\HarddiskVolume\d|\\?[A-Z]:\\)|(?<!^)(?=\\Device\\HarddiskVolume\d)", RegexOptions.Compiled);
    private static readonly Regex Whole = new(@"(?i)^(?:[A-Z]:\\|\\Device\\HarddiskVolume\d{1,2}\\).*\.(?:exe|dll|sys|ahk|lua|bat|cmd|ps1|py|jar|asi|scr|com)$", RegexOptions.Compiled);
    internal static IEnumerable<string> SplitJoined(string s)
    {
        foreach (var raw in JoinCut.Split(s))
        {
            var p = raw.StartsWith("\\") && raw.Length > 3 && raw[2] == ':' ? raw.Substring(1) : raw;
            // a folder in the middle can never be "something.exe\" — that means two paths were glued
            if (Whole.IsMatch(p) && !Regex.IsMatch(p, @"(?i)\.(?:exe|dll|sys)\\")) yield return p;
        }
    }

    private static bool HasAscii(byte[] b, int len, string s)
    {
        var n = Encoding.ASCII.GetBytes(s);
        return IndexOf(b, len, n) >= 0;
    }
    private static bool HasUtf16(byte[] b, int len, string s)
    {
        var n = Encoding.Unicode.GetBytes(s);
        return IndexOf(b, len, n) >= 0;
    }
    private static int IndexOf(byte[] h, int len, byte[] n)
    {
        int last = len - n.Length;
        for (int i = 0; i <= last; i++)
        {
            if (h[i] != n[0]) continue;
            int j = 1; while (j < n.Length && h[i + j] == n[j]) j++;
            if (j == n.Length) return i;
        }
        return -1;
    }

    // ------------------------------------------------------------------ Windows part
    public sealed class Found
    {
        public Kind Kind;
        public string Text = "";
        public string? When;
        public HashSet<string> Sources = new();
    }

    public sealed record Target(string Source, int Pid);

    /// <summary>The processes to read: DPS / PcaSvc / SysMain / Dnscache hosts + explorer.</summary>
    public static List<Target> Targets()
    {
        var list = new List<Target>();
        try
        {
            using var s = new System.Management.ManagementObjectSearcher(
                "SELECT Name, ProcessId FROM Win32_Service WHERE Name='DPS' OR Name='PcaSvc' OR Name='SysMain' OR Name='Dnscache'");
            foreach (System.Management.ManagementObject o in s.Get())
            {
                var pid = Convert.ToInt32(o["ProcessId"] ?? 0);
                if (pid > 4) list.Add(new(Convert.ToString(o["Name"]) ?? "service", pid));
            }
        }
        catch { }
        try
        {
            foreach (var p in System.Diagnostics.Process.GetProcessesByName("explorer").Take(2)) list.Add(new("explorer", p.Id));
        }
        catch { }
        return list;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MBI
    {
        public IntPtr BaseAddress, AllocationBase;
        public uint AllocationProtect;
        public UIntPtr RegionSize;
        public uint State, Protect, Type;
    }
    [DllImport("kernel32.dll", SetLastError = true)] private static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool CloseHandle(IntPtr h);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern IntPtr VirtualQueryEx(IntPtr h, IntPtr addr, out MBI mbi, IntPtr len);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool ReadProcessMemory(IntPtr h, IntPtr addr, byte[] buf, IntPtr size, out IntPtr read);
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)] private static extern uint QueryDosDevice(string device, StringBuilder target, int max);

    private const uint MEM_COMMIT = 0x1000, MEM_IMAGE = 0x1000000, PAGE_GUARD = 0x100, PAGE_NOACCESS = 0x01;
    private const uint READABLE = 0x02 | 0x04 | 0x08 | 0x20 | 0x40 | 0x80;

    /// <summary>"\Device\HarddiskVolume3" → "C:" for every drive letter.</summary>
    public static Dictionary<string, string> VolumeMap()
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        for (char c = 'A'; c <= 'Z'; c++)
        {
            try
            {
                var sb = new StringBuilder(260);
                if (QueryDosDevice(c + ":", sb, sb.Capacity) > 0) map[sb.ToString()] = c + ":";
            }
            catch { }
        }
        return map;
    }

    public static string? Status;

    /// <summary>Reads every target (time budget in seconds) and returns what was found, merged.</summary>
    public static Dictionary<string, Found> ReadAll(int budgetSeconds = 35, int perProcessMb = 400, Action<double>? onProgress = null)
    {
        var all = new Dictionary<string, Found>(StringComparer.OrdinalIgnoreCase);
        try { System.Diagnostics.Process.EnterDebugMode(); } catch { }
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var targets = Targets();
        var read = new List<string>();
        foreach (var t in targets)
        {
            double left = budgetSeconds - sw.Elapsed.TotalSeconds;
            if (left < 2) break;
            bool dns = t.Source.Equals("Dnscache", StringComparison.OrdinalIgnoreCase);
            int ti = read.Count;
            onProgress?.Invoke(Math.Max(sw.Elapsed.TotalSeconds / budgetSeconds, (double)ti / Math.Max(1, targets.Count)));
            var ok = ReadProcess(t.Pid, Math.Min(left, dns ? 8 : 14), perProcessMb, dns, (k, text, when) =>
            {
                var key = k + "|" + text;
                if (!all.TryGetValue(key, out var f)) all[key] = f = new Found { Kind = k, Text = text, When = when };
                if (when != null && (f.When == null || string.CompareOrdinal(when, f.When) > 0)) f.When = when;
                f.Sources.Add(t.Source);
            });
            read.Add(t.Source + (ok ? "" : " (no access)"));
            if (all.Count > 60000) break;
        }
        Status = string.Join(", ", read);
        return all;
    }

    private static bool ReadProcess(int pid, double seconds, int maxMb, bool domains, Action<Kind, string, string?> found)
    {
        IntPtr h = OpenProcess(0x0400 | 0x0010, false, pid);   // QUERY_INFORMATION | VM_READ
        if (h == IntPtr.Zero) return false;
        try
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            long total = 0, cap = (long)maxMb * 1024 * 1024;
            var buf = new byte[1 << 20];
            long addr = 0;
            int size = Marshal.SizeOf<MBI>();
            while (sw.Elapsed.TotalSeconds < seconds && total < cap)
            {
                if (VirtualQueryEx(h, new IntPtr(addr), out var m, new IntPtr(size)) == IntPtr.Zero) break;
                long baseAddr = m.BaseAddress.ToInt64(), regionSize = (long)m.RegionSize.ToUInt64();
                if (regionSize <= 0) break;
                bool readable = m.State == MEM_COMMIT && (m.Protect & READABLE) != 0 && (m.Protect & (PAGE_GUARD | PAGE_NOACCESS)) == 0 && m.Type != MEM_IMAGE;
                if (readable && regionSize <= 256L * 1024 * 1024)
                {
                    for (long off = 0; off < regionSize && sw.Elapsed.TotalSeconds < seconds; off += buf.Length - 512)
                    {
                        long want = Math.Min(buf.Length, regionSize - off);
                        if (!ReadProcessMemory(h, new IntPtr(baseAddr + off), buf, new IntPtr(want), out var got) || got.ToInt64() <= 0) break;
                        ScanBuffer(buf, (int)got.ToInt64(), domains, found);
                        total += got.ToInt64();
                        if (want < buf.Length) break;
                    }
                }
                long next = baseAddr + regionSize;
                if (next <= addr) break;
                addr = next;
                if (addr >= 0x7FFFFFFF0000L) break;
            }
            return true;
        }
        catch { return false; }
        finally { CloseHandle(h); }
    }
}
