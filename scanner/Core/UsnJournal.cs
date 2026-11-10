using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

namespace HeRoShield.Core;

/// <summary>
/// Reads the NTFS change journal ($UsnJrnl) of each fixed NTFS drive: Windows writes one line for every
/// file created, deleted or renamed, even when the file and the recycle bin are gone. This is how
/// screenshare tools see "cheat.exe deleted 4 minutes before the check" or "loader.exe renamed to
/// discord.exe". Read-only (needs admin, which the scanner already has).
/// </summary>
public static class UsnJournal
{
    public sealed class Entry
    {
        public string Name { get; set; } = "";
        public string? OldName { get; set; }
        public string Action { get; set; } = "";       // Deleted | Renamed | Created
        public DateTime TimeUtc { get; set; }
        public string Drive { get; set; } = "";
        public ulong FileId { get; set; }
    }

    // USN reason flags
    private const uint DataOverwrite = 0x1, DataExtend = 0x2, FileCreate = 0x100, FileDelete = 0x200,
                       RenameOld = 0x1000, RenameNew = 0x2000, Close = 0x80000000;

    // file types worth keeping (programs, scripts, archives, game mods)
    public static readonly HashSet<string> Interesting = new(StringComparer.OrdinalIgnoreCase)
    {
        ".exe", ".dll", ".sys", ".asi", ".ahk", ".lua", ".py", ".ps1", ".bat", ".cmd", ".vbs", ".js",
        ".zip", ".rar", ".7z", ".rpf", ".cfg", ".ini", ".json", ".amc", ".lnk", ".pf", ".jar", ".msi",
    };

    // ---------------------------------------------------------------- parsing (pure, testable)
    /// <summary>Parses the output of FSCTL_READ_USN_JOURNAL (8-byte next USN + records V2/V3).</summary>
    public static long ParseBuffer(byte[] buf, int len, Action<ulong, uint, long, string> onRecord)
    {
        if (len < 8) return 0;
        long next = BitConverter.ToInt64(buf, 0);
        int o = 8;
        while (o + 60 <= len)
        {
            int recLen = BitConverter.ToInt32(buf, o);
            if (recLen <= 0 || o + recLen > len) break;
            ushort major = BitConverter.ToUInt16(buf, o + 4);
            ulong frn; long ts; uint reason; int nameLen, nameOff;
            if (major == 2)
            {
                frn = BitConverter.ToUInt64(buf, o + 8);
                ts = BitConverter.ToInt64(buf, o + 32);
                reason = BitConverter.ToUInt32(buf, o + 40);
                nameLen = BitConverter.ToUInt16(buf, o + 56);
                nameOff = BitConverter.ToUInt16(buf, o + 58);
            }
            else if (major == 3)
            {
                if (recLen < 76) { o += recLen; continue; }
                frn = BitConverter.ToUInt64(buf, o + 8);    // low 64 bits of the 128-bit id
                ts = BitConverter.ToInt64(buf, o + 48);
                reason = BitConverter.ToUInt32(buf, o + 56);
                nameLen = BitConverter.ToUInt16(buf, o + 72);
                nameOff = BitConverter.ToUInt16(buf, o + 74);
            }
            else { o += recLen; continue; }
            if (nameOff + nameLen <= recLen && nameLen > 0)
            {
                var name = Encoding.Unicode.GetString(buf, o + nameOff, nameLen);
                onRecord(frn, reason, ts, name);
            }
            o += (recLen + 7) & ~7;   // records are 8-byte aligned
        }
        return next;
    }

    /// <summary>Turns raw journal records into Deleted / Renamed / Created events (one per file and action).</summary>
    public sealed class Collector
    {
        private readonly DateTime _sinceUtc;
        private readonly string _drive;
        private readonly Dictionary<ulong, string> _oldNames = new();
        private readonly Dictionary<string, Entry> _out = new();
        public Collector(DateTime sinceUtc, string drive) { _sinceUtc = sinceUtc; _drive = drive; }

        public void Add(ulong frn, uint reason, long fileTime, string name)
        {
            DateTime t;
            try { t = DateTime.FromFileTimeUtc(fileTime); } catch { return; }
            if ((reason & RenameOld) != 0) { _oldNames[frn] = name; return; }   // the name BEFORE a rename
            if (t < _sinceUtc) return;
            string? old = null;
            if ((reason & RenameNew) != 0) { _oldNames.TryGetValue(frn, out old); _oldNames.Remove(frn); }
            bool interesting = IsInteresting(name) || (old != null && IsInteresting(old));
            if (!interesting) return;

            string action;
            if ((reason & FileDelete) != 0) action = "Deleted";
            else if ((reason & RenameNew) != 0 && old != null && !string.Equals(old, name, StringComparison.OrdinalIgnoreCase)) action = "Renamed";
            else if ((reason & FileCreate) != 0) action = "Created";
            else return;   // ordinary writes are not interesting

            var key = frn + "|" + action + "|" + name.ToLowerInvariant();
            if (_out.TryGetValue(key, out var e)) { if (t > e.TimeUtc) e.TimeUtc = t; return; }
            _out[key] = new Entry { Name = name, OldName = action == "Renamed" ? old : null, Action = action, TimeUtc = t, Drive = _drive, FileId = frn };
        }

        public IEnumerable<Entry> Results => _out.Values;
    }

    private static bool IsInteresting(string name)
    {
        var dot = name.LastIndexOf('.');
        if (dot < 0) return false;
        var ext = name.Substring(dot);
        if (!Interesting.Contains(ext)) return false;
        // Windows / browsers churn through thousands of these: skip the noise
        var low = name.ToLowerInvariant();
        if (ext == ".pf" && !low.Contains("-")) return false;
        if (low.StartsWith("~") || low.EndsWith(".tmp.exe")) return false;
        return true;
    }

    // ---------------------------------------------------------------- reading the drive (Windows)
    [StructLayout(LayoutKind.Sequential)]
    private struct UsnJournalData { public ulong JournalId; public long FirstUsn, NextUsn, LowestValidUsn, MaxUsn; public ulong MaximumSize, AllocationDelta; }

    [StructLayout(LayoutKind.Sequential)]
    private struct ReadUsnJournalData { public long StartUsn; public uint ReasonMask, ReturnOnlyOnClose; public ulong Timeout, BytesToWaitFor, UsnJournalId; }

    private const uint FSCTL_QUERY_USN_JOURNAL = 0x000900F4, FSCTL_READ_USN_JOURNAL = 0x000900BB;
    private const uint GENERIC_READ = 0x80000000, FILE_SHARE_READ = 1, FILE_SHARE_WRITE = 2, OPEN_EXISTING = 3;

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr sa, uint disposition, uint flags, IntPtr template);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool DeviceIoControl(SafeFileHandle h, uint code, ref ReadUsnJournalData inBuf, int inSize, byte[] outBuf, int outSize, out int returned, IntPtr overlapped);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool DeviceIoControl(SafeFileHandle h, uint code, IntPtr inBuf, int inSize, out UsnJournalData outBuf, int outSize, out int returned, IntPtr overlapped);

    /// <summary>State of one drive's journal: "ok", "missing" (deleted / never created), "denied", "error".</summary>
    public sealed record DriveResult(string Drive, string State, DateTime? OldestUtc, List<Entry> Entries);

    public static List<DriveResult> ReadAll(DateTime sinceUtc, int maxSeconds = 25)
    {
        var list = new List<DriveResult>();
        var sw = System.Diagnostics.Stopwatch.StartNew();
        DriveInfo[] drives;
        try { drives = DriveInfo.GetDrives(); } catch { return list; }
        foreach (var d in drives)
        {
            try
            {
                if (d.DriveType != DriveType.Fixed || !d.IsReady || !string.Equals(d.DriveFormat, "NTFS", StringComparison.OrdinalIgnoreCase)) continue;
            }
            catch { continue; }
            var letter = d.Name.Substring(0, 2);   // "C:"
            var left = maxSeconds - (int)sw.Elapsed.TotalSeconds;
            if (left <= 2) break;
            list.Add(ReadDrive(letter, sinceUtc, left));
        }
        return list;
    }

    private static DriveResult ReadDrive(string letter, DateTime sinceUtc, int maxSeconds)
    {
        var entries = new List<Entry>();
        using var h = CreateFile(@"\\.\" + letter, GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE, IntPtr.Zero, OPEN_EXISTING, 0, IntPtr.Zero);
        if (h.IsInvalid) return new(letter, Marshal.GetLastWin32Error() == 5 ? "denied" : "error", null, entries);

        if (!DeviceIoControl(h, FSCTL_QUERY_USN_JOURNAL, IntPtr.Zero, 0, out UsnJournalData jd, Marshal.SizeOf<UsnJournalData>(), out _, IntPtr.Zero))
        {
            int err = Marshal.GetLastWin32Error();
            // 1179 ERROR_JOURNAL_NOT_ACTIVE, 1178 ERROR_JOURNAL_DELETE_IN_PROGRESS
            return new(letter, err is 1179 or 1178 ? "missing" : err == 5 ? "denied" : "error", null, entries);
        }

        var col = new Collector(sinceUtc, letter);
        DateTime? oldest = null;
        var rd = new ReadUsnJournalData { StartUsn = jd.FirstUsn, ReasonMask = FileCreate | FileDelete | RenameOld | RenameNew | Close, ReturnOnlyOnClose = 0, Timeout = 0, BytesToWaitFor = 0, UsnJournalId = jd.JournalId };
        var buf = new byte[1 << 20];
        var sw = System.Diagnostics.Stopwatch.StartNew();
        long guard = 0;
        while (sw.Elapsed.TotalSeconds < maxSeconds && guard++ < 20000)
        {
            if (!DeviceIoControl(h, FSCTL_READ_USN_JOURNAL, ref rd, Marshal.SizeOf<ReadUsnJournalData>(), buf, buf.Length, out int got, IntPtr.Zero)) break;
            if (got <= 8) break;
            long next = ParseBuffer(buf, got, (frn, reason, ts, name) =>
            {
                if (oldest == null) { try { oldest = DateTime.FromFileTimeUtc(ts); } catch { } }
                col.Add(frn, reason, ts, name);
            });
            if (next <= rd.StartUsn) break;
            rd.StartUsn = next;
            if (next >= jd.NextUsn) break;
        }
        entries.AddRange(col.Results);
        return new(letter, "ok", oldest, entries);
    }
}
