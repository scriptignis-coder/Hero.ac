using System.Runtime.InteropServices;
using System.Text.RegularExpressions;

namespace HeRoShield.Core;

/// <summary>
/// Cheat hardware: DMA cards (PCIe FPGA), KMBox, Cronus Zen / StrikePack, XIM, Titan, Arduino "mouse" boards.
/// Windows keeps every device that was EVER connected (even unplugged) — we read that list through SetupAPI,
/// including the name the device reported itself (BusReportedDeviceDesc), its last arrival time and whether it is
/// plugged in now. Read-only.
/// </summary>
public static class Hardware
{
    public sealed class Dev
    {
        public string InstanceId = "", Desc = "", Friendly = "", Mfg = "", BusDesc = "", LastArrival = "";
        public bool Present;
    }

    // ------------------------------------------------------------------ pure classifier (testable)
    private static readonly Regex VidPid = new(@"VID_([0-9A-F]{4}).*?PID_([0-9A-F]{4})", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex VenDev = new(@"VEN_([0-9A-F]{4}).*?DEV_([0-9A-F]{4})", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly (Regex rx, string kind, string why)[] NameRules =
    {
        (new(@"\bkm\s?box\b|kmboxnet|kmbox[_\- ]?(b|net|pro)", RegexOptions.IgnoreCase), "KMBox",
            "KMBox — a box between the mouse and the PC that moves the mouse for an aimbot (used with DMA / colorbot cheats)"),
        (new(@"cronus|collective\s*minds|strike\s*pack", RegexOptions.IgnoreCase), "Cronus / StrikePack",
            "Cronus Zen / StrikePack (Collective Minds) — runs anti-recoil / rapid-fire scripts"),
        (new(@"\bxim\s*(apex|matrix|nexus|4|edge)\b|\bxim\s+technolog", RegexOptions.IgnoreCase), "XIM",
            "XIM — mouse & keyboard adapter often used with aim-assist / anti-recoil"),
        (new(@"titan\s*(one|two)|consoletuner", RegexOptions.IgnoreCase), "Titan (ConsoleTuner)",
            "Titan One / Two — runs anti-recoil / macro scripts"),
        (new(@"\bpcileech\b|screamer\s*(m2|pcie)|squirrel\s*dma|captain\s*dma|\bdma\s*card\b|leetdma|enigma\s*x1", RegexOptions.IgnoreCase), "DMA card",
            "a DMA cheat card — reads the game's memory from outside the PC"),
    };

    /// <summary>Returns the devices that matter, with a level: 2 = cheat device, 1 = check it.</summary>
    public static List<HardwareDevice> Classify(IEnumerable<Dev> devs)
    {
        var map = new Dictionary<string, HardwareDevice>();
        foreach (var d in devs)
        {
            var id = d.InstanceId ?? "";
            var text = string.Join(" | ", new[] { d.BusDesc, d.Friendly, d.Desc, d.Mfg }.Where(x => !string.IsNullOrWhiteSpace(x)));
            string? kind = null, why = null; int level = 0;

            var vd = VenDev.Match(id);
            if (id.StartsWith("PCI\\", StringComparison.OrdinalIgnoreCase) && vd.Success)
            {
                var ven = vd.Groups[1].Value.ToUpperInvariant(); var dev = vd.Groups[2].Value.ToUpperInvariant();
                if (ven == "10EE" && dev == "0666") { kind = "DMA card"; level = 2; why = "PCIe device 10EE:0666 = the default ID of PCILeech DMA cheat cards (Screamer / Squirrel / Captain…)"; }
                else if (ven == "10EE" || ven == "1204") { kind = "FPGA board (PCIe)"; level = 1; why = (ven == "10EE" ? "Xilinx" : "Lattice") + " FPGA on PCIe — DMA cheat cards are built on these chips (gaming PCs normally never have one)"; }
            }
            var vp = VidPid.Match(id);
            if (kind == null && id.StartsWith("USB\\", StringComparison.OrdinalIgnoreCase) && vp.Success)
            {
                var v = vp.Groups[1].Value.ToUpperInvariant(); var pd = vp.Groups[2].Value.ToUpperInvariant();
                if (v == "0403" && pd == "601F") { kind = "FT601 (DMA data port)"; level = 1; why = "FTDI FT601 USB 3.0 chip — this is the cable side of a DMA card (it plugs into the cheat PC)"; }
                else if ((v == "2341" || v == "2A03") && (pd is "8036" or "8037" or "0036" or "0037" or "8041" or "0041")
                      || v == "1B4F" && (pd is "9205" or "9206" or "9203" or "9204"))
                { kind = "Arduino (HID)"; level = 1; why = "Arduino Leonardo / Micro / Pro Micro — can pretend to be a mouse; colorbot & aim kits move the mouse through one"; }
            }
            if (kind == null && text.Length > 0)
                foreach (var (rx, k, w) in NameRules)
                    if (rx.IsMatch(text)) { kind = k; level = 2; why = w; break; }
            if (kind == null) continue;

            // one row per physical device (USB composite devices show several interfaces)
            var key = kind + "|" + (vp.Success ? vp.Value : vd.Success ? vd.Value : id).ToUpperInvariant();
            if (map.TryGetValue(key, out var ex))
            {
                ex.Present |= d.Present;
                if (string.CompareOrdinal(d.LastArrival, ex.LastSeen) > 0) ex.LastSeen = d.LastArrival;
                if (ex.Name == kind) ex.Name = FirstNonEmpty(d.BusDesc, d.Friendly, d.Desc, kind);
                continue;
            }
            map[key] = new HardwareDevice
            {
                Name = FirstNonEmpty(d.BusDesc, d.Friendly, d.Desc, kind), Kind = kind, InstanceId = id,
                Present = d.Present, LastSeen = d.LastArrival, Level = level, Why = why!,
            };
        }
        foreach (var h in map.Values) h.Why += h.Present ? " — plugged in now." : " — was connected to this PC before.";
        return map.Values.OrderByDescending(x => x.Level).ThenByDescending(x => x.Present).ToList();
    }
    private static string FirstNonEmpty(params string?[] v) => v.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x)) ?? "";

    // ------------------------------------------------------------------ Windows part (SetupAPI)
    [StructLayout(LayoutKind.Sequential)] private struct SP_DEVINFO_DATA { public int cbSize; public Guid ClassGuid; public int DevInst; public IntPtr Reserved; }
    [StructLayout(LayoutKind.Sequential)] private struct DEVPROPKEY { public Guid fmtid; public uint pid; public DEVPROPKEY(string g, uint p) { fmtid = new Guid(g); pid = p; } }

    [DllImport("setupapi.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr SetupDiGetClassDevs(IntPtr classGuid, string? enumerator, IntPtr hwnd, int flags);
    [DllImport("setupapi.dll", SetLastError = true)] private static extern bool SetupDiEnumDeviceInfo(IntPtr set, int index, ref SP_DEVINFO_DATA data);
    [DllImport("setupapi.dll", SetLastError = true)] private static extern bool SetupDiDestroyDeviceInfoList(IntPtr set);
    [DllImport("setupapi.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool SetupDiGetDeviceInstanceId(IntPtr set, ref SP_DEVINFO_DATA data, System.Text.StringBuilder id, int size, out int req);
    [DllImport("setupapi.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool SetupDiGetDevicePropertyW(IntPtr set, ref SP_DEVINFO_DATA data, ref DEVPROPKEY key, out uint type, byte[]? buf, int size, out int req, int flags);

    private const int DIGCF_ALLCLASSES = 0x4;
    private static readonly DEVPROPKEY K_Desc = new("a45c254e-df1c-4efd-8020-67d146a850e0", 2);
    private static readonly DEVPROPKEY K_Mfg = new("a45c254e-df1c-4efd-8020-67d146a850e0", 13);
    private static readonly DEVPROPKEY K_Friendly = new("a45c254e-df1c-4efd-8020-67d146a850e0", 14);
    private static readonly DEVPROPKEY K_BusDesc = new("540b947e-8b40-45bc-a8a2-6a0b894cbda2", 4);
    private static readonly DEVPROPKEY K_Present = new("540b947e-8b40-45bc-a8a2-6a0b894cbda2", 5);
    private static readonly DEVPROPKEY K_LastArrival = new("83da6326-97a6-4088-9453-a1923f573b29", 102);

    public static string? Status;

    /// <summary>Every device Windows remembers on the USB / PCI / HID buses (present or not).</summary>
    public static List<Dev> ReadAll()
    {
        var all = new List<Dev>();
        foreach (var bus in new[] { "USB", "PCI", "HID" })
        {
            IntPtr set = SetupDiGetClassDevs(IntPtr.Zero, bus, IntPtr.Zero, DIGCF_ALLCLASSES);   // no DIGCF_PRESENT → unplugged ones too
            if (set == IntPtr.Zero || set == new IntPtr(-1)) continue;
            try
            {
                for (int i = 0; i < 20000; i++)
                {
                    var d = new SP_DEVINFO_DATA { cbSize = Marshal.SizeOf<SP_DEVINFO_DATA>() };
                    if (!SetupDiEnumDeviceInfo(set, i, ref d)) break;
                    var sb = new System.Text.StringBuilder(512);
                    if (!SetupDiGetDeviceInstanceId(set, ref d, sb, sb.Capacity, out _)) continue;
                    all.Add(new Dev
                    {
                        InstanceId = sb.ToString(),
                        Desc = Str(set, ref d, K_Desc), Mfg = Str(set, ref d, K_Mfg), Friendly = Str(set, ref d, K_Friendly),
                        BusDesc = Str(set, ref d, K_BusDesc), Present = Bool(set, ref d, K_Present), LastArrival = Time(set, ref d, K_LastArrival),
                    });
                }
            }
            catch { }
            finally { SetupDiDestroyDeviceInfoList(set); }
        }
        Status = $"{all.Count} devices in Windows' device history";
        return all;
    }

    private static byte[]? Prop(IntPtr set, ref SP_DEVINFO_DATA d, DEVPROPKEY k)
    {
        try
        {
            var key = k;
            SetupDiGetDevicePropertyW(set, ref d, ref key, out _, null, 0, out int req, 0);
            if (req <= 0 || req > 65536) return null;
            var buf = new byte[req];
            return SetupDiGetDevicePropertyW(set, ref d, ref key, out _, buf, req, out _, 0) ? buf : null;
        }
        catch { return null; }
    }
    private static string Str(IntPtr set, ref SP_DEVINFO_DATA d, DEVPROPKEY k)
    {
        var b = Prop(set, ref d, k); if (b == null) return "";
        var s = System.Text.Encoding.Unicode.GetString(b); int z = s.IndexOf('\0'); return (z >= 0 ? s.Substring(0, z) : s).Trim();
    }
    private static bool Bool(IntPtr set, ref SP_DEVINFO_DATA d, DEVPROPKEY k) { var b = Prop(set, ref d, k); return b != null && b.Length > 0 && b[0] != 0; }
    private static string Time(IntPtr set, ref SP_DEVINFO_DATA d, DEVPROPKEY k)
    {
        var b = Prop(set, ref d, k); if (b == null || b.Length < 8) return "";
        try { return DateTime.FromFileTimeUtc(BitConverter.ToInt64(b, 0)).ToLocalTime().ToString("yyyy-MM-dd HH:mm"); } catch { return ""; }
    }
}

/// <summary>NTFS volume facts (how many file records exist) — used to show real progress during the disk sweep.</summary>
public static class NtfsInfo
{
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateFile(string name, uint access, uint share, IntPtr sec, uint disp, uint flags, IntPtr tmpl);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool DeviceIoControl(IntPtr h, uint code, IntPtr inBuf, int inSize, byte[] outBuf, int outSize, out int ret, IntPtr ov);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr h);

    /// <summary>Number of MFT file records on the volume ("C:\") — 0 if unknown.</summary>
    public static long FileRecords(string root)
    {
        var letter = root.TrimEnd('\\', ':');
        IntPtr h = CreateFile(@"\\.\" + letter + ":", 0x80000000, 3, IntPtr.Zero, 3, 0, IntPtr.Zero);
        if (h == IntPtr.Zero || h == new IntPtr(-1)) return 0;
        try
        {
            var buf = new byte[128];
            if (!DeviceIoControl(h, 0x00090064, IntPtr.Zero, 0, buf, buf.Length, out _, IntPtr.Zero)) return 0;   // FSCTL_GET_NTFS_VOLUME_DATA
            uint recSize = BitConverter.ToUInt32(buf, 48);
            long mftValid = BitConverter.ToInt64(buf, 56);
            return recSize > 0 ? mftValid / recSize : 0;
        }
        catch { return 0; }
        finally { CloseHandle(h); }
    }
}
