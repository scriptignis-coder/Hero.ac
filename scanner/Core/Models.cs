namespace HeRoShield.Core;

public enum DetectMethod
{
    RunningProcess, Prefetch, Bam, GameFileIntegrity, DisabledService,
    SuspiciousExecutable, RecycleBin, FiveMPlugin,
    // v4.0 additions
    StartupPersistence, ScheduledTask, EventLog, RecentFile, NetworkIndicator,
    KernelDriver, AmCache, ShimCache, AlternateDataStream,
    // v4.3
    UsnJournal, InjectedModule,
    // v4.4
    MemoryTrace,
    // v4.5
    Hardware
}

public enum Severity { Low, Medium, High }

/// <summary>A command found in PowerShell history or the Run (Win+R) list.</summary>
public sealed class CommandEntry
{
    public string Text { get; set; } = "";
    public string Source { get; set; } = "";   // PowerShell | Run | CMD
    public bool Suspicious { get; set; }
}

/// <summary>A cheat/suspicious item found (the red "Detects" list).</summary>
public sealed class Detection
{
    public string File { get; set; } = "";
    public string Signature { get; set; } = "";
    public string Path { get; set; } = "";
    public string? Sha256 { get; set; }
    public DetectMethod Method { get; set; }
    public Severity Severity { get; set; }
    public bool Deleted { get; set; }
    public string When { get; set; } = "";
    public List<string> Features { get; set; } = new();
    public string Explain { get; set; } = "";
}

/// <summary>A non-cheat red flag (the amber "Warnings" list).</summary>
public sealed class Warning
{
    public string Title { get; set; } = "";
    public string Detail { get; set; } = "";
    public string Category { get; set; } = "System";
    // System | Antivirus | Injection | Cleaning | Commands | Persistence | Network | Evasion
}

/// <summary>A mod file found in the FiveM / game folder.</summary>
public sealed class ModFile
{
    public string File { get; set; } = "";
    public double SizeMb { get; set; }
    public string Path { get; set; } = "";
}

/// <summary>A suspicious-but-not-confirmed file.</summary>
public sealed class SuspiciousFile
{
    public string Path { get; set; } = "";
    public string Kind { get; set; } = "";
}

public sealed class SystemInfo
{
    public string Os { get; set; } = "";
    public string WinBuild { get; set; } = "";
    public string Cpu { get; set; } = "";
    public string Gpu { get; set; } = "";
    public string RamGb { get; set; } = "";
    public string SystemTime { get; set; } = "";
    public string Uptime { get; set; } = "";
    public string BootTime { get; set; } = "";
    public string Hwid { get; set; } = "";
    public string Uuid { get; set; } = "";
    public string Sid { get; set; } = "";
    public string Motherboard { get; set; } = "";
    public string BiosSerial { get; set; } = "";
    public string DiskSerials { get; set; } = "";
    public string MacAddresses { get; set; } = "";
    public string MachineGuid { get; set; } = "";
    public string SpooferFlag { get; set; } = "";
    public string WindowsInstall { get; set; } = "unknown";
    public string FiveMLastLaunch { get; set; } = "unknown";
    public string RecycleModified { get; set; } = "unknown";
    public List<string> DisabledServices { get; set; } = new();
    // v4.0
    public string TimeZone { get; set; } = "";
    public string DotNetVersion { get; set; } = "";
    public bool SecureBoot { get; set; }
    public bool IsVirtualMachine { get; set; }
    public string VmPlatform { get; set; } = "";
    public string HostsFileStatus { get; set; } = "normal";
}

/// <summary>A file found in the recycle bin.</summary>
public sealed class DeletedFile
{
    public string File { get; set; } = "";         // original name ("aimbot.exe")
    public string Path { get; set; } = "";         // where it was before it was deleted
    public long SizeKb { get; set; }
    public string DeletedAt { get; set; } = "";    // yyyy-MM-dd HH:mm
    public string When { get; set; } = "";         // "3 days ago"
    public bool Executable { get; set; }
    public bool Folder { get; set; }
    public bool StillInBin { get; set; } = true;   // false = the recycle bin entry is half-wiped
    public int Flag { get; set; }                  // 2 = cheat name, 1 = check it
    public string Why { get; set; } = "";
}

/// <summary>A program Windows recorded as having run.</summary>
public sealed class ExecutedProgram
{
    public string Name { get; set; } = "";
    public string Path { get; set; } = "";
    public string LastRun { get; set; } = "";
    public string Source { get; set; } = "";
    public bool Flagged { get; set; }
}

// ========== v4.0 new models ==========

public sealed class StartupEntry
{
    public string Name { get; set; } = "";
    public string Command { get; set; } = "";
    public string Location { get; set; } = "";
    public bool Suspicious { get; set; }
}

public sealed class ScheduledTaskEntry
{
    public string Name { get; set; } = "";
    public string Command { get; set; } = "";
    public string Status { get; set; } = "";
    public string LastRun { get; set; } = "";
    public bool Suspicious { get; set; }
}

public sealed class DriverEntry
{
    public string Name { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string Path { get; set; } = "";
    public string Status { get; set; } = "";
    public bool Signed { get; set; }
    public bool Suspicious { get; set; }
}

public sealed class RecentFileEntry
{
    public string Name { get; set; } = "";
    public string Target { get; set; } = "";
    public string When { get; set; } = "";
    public bool Executable { get; set; }
    public bool Flagged { get; set; }
}

public sealed class NetworkConnection
{
    public string Process { get; set; } = "";
    public int Pid { get; set; }
    public string LocalAddress { get; set; } = "";
    public string RemoteAddress { get; set; } = "";
    public string State { get; set; } = "";
    public bool Suspicious { get; set; }
}

public sealed class EventLogEntry
{
    public string Source { get; set; } = "";
    public int EventId { get; set; }
    public string When { get; set; } = "";
    public string Message { get; set; } = "";
    public string Category { get; set; } = "";
}

/// <summary>Something found in the FiveM install: a mod archive, plugin, graphics mod…</summary>
public sealed class FiveMItem
{
    public string Kind { get; set; } = "";        // Folder | Mod archive | Plugin | Graphics mod | Script
    public string Name { get; set; } = "";
    public string Path { get; set; } = "";
    public int Level { get; set; }                // 0 = info, 1 = look at it, 2 = cheat
    public string Detail { get; set; } = "";
    public double SizeMb { get; set; }
    public string When { get; set; } = "";
    public List<string> Files { get; set; } = new();
}

/// <summary>A Discord server found in the Discord / browser cache on the PC — also servers the player already LEFT.</summary>
public sealed class DiscordTrace
{
    public string GuildId { get; set; } = "";      // empty when only an invite code was found
    public string? Name { get; set; }
    public string? Invite { get; set; }            // invite code he opened (discord.gg/CODE)
    public string? Icon { get; set; }              // server icon hash → cdn.discordapp.com/icons/ID/HASH.png
    public List<string> Sources { get; set; } = new();   // "Discord app", "Chrome" … + what: icon, invite, channel, local storage
    public string? FirstSeen { get; set; }         // ISO dates of the cache files
    public string? LastSeen { get; set; }
}

/// <summary>A file the NTFS change journal saw being deleted / renamed / created (even if the file is gone).</summary>
public sealed class JournalEntry
{
    public string Name { get; set; } = "";
    public string? OldName { get; set; }
    public string Action { get; set; } = "";     // Deleted | Renamed | Created | Recycled
    public string When { get; set; } = "";       // local time yyyy-MM-dd HH:mm:ss
    public string Drive { get; set; } = "";
    public int Level { get; set; }               // 0 normal, 1 look at it, 2 cheat
    public string Why { get; set; } = "";
}

/// <summary>A program path / DPS entry / domain found in the memory of a Windows service (v4.4).</summary>
public sealed class MemoryTrace
{
    public string Path { get; set; } = "";
    public string Name { get; set; } = "";
    public string Source { get; set; } = "";      // DPS, PcaSvc, SysMain, explorer, Dnscache
    public string? When { get; set; }             // DPS only: when it ran (UTC)
    public bool Exists { get; set; }
    public int Level { get; set; }                // 0 info, 1 check, 2 cheat
    public string Why { get; set; } = "";
}

public sealed class ScanReport
{
    public string Pin { get; set; } = "";
    public string ScannerVersion { get; set; } = "4.5.2";
    public DateTime StartedUtc { get; set; } = DateTime.UtcNow;
    public double DurationSeconds { get; set; }
    public SystemInfo System { get; set; } = new();
    public List<Detection> Detections { get; set; } = new();
    public List<Warning> Warnings { get; set; } = new();
    public List<ModFile> Mods { get; set; } = new();
    public List<SuspiciousFile> Suspicious { get; set; } = new();
    public List<DeletedFile> DeletedFiles { get; set; } = new();
    public List<ExecutedProgram> ExecutedPrograms { get; set; } = new();
    public List<CommandEntry> Commands { get; set; } = new();
    public List<string> SteamAccounts { get; set; } = new();
    public List<string> Browsers { get; set; } = new();
    public List<BrowserAudit.Entry> BrowserSearchHistory { get; set; } = new();
    public List<BrowserAudit.Download> BrowserDownloads { get; set; } = new();
    public List<string> UsbDevices { get; set; } = new();
    public List<string> Antivirus { get; set; } = new();
    public string? DiscordId { get; set; }
    public string? ScreenshotJpegBase64 { get; set; }
    public List<string> ArtifactsCollected { get; set; } = new();
    public int FilesScanned { get; set; }

    // v4.0
    public List<StartupEntry> StartupEntries { get; set; } = new();
    public List<ScheduledTaskEntry> ScheduledTasks { get; set; } = new();
    public List<DriverEntry> LoadedDrivers { get; set; } = new();
    public List<RecentFileEntry> RecentFiles { get; set; } = new();
    public List<NetworkConnection> NetworkConnections { get; set; } = new();
    public List<EventLogEntry> EventLogEntries { get; set; } = new();
    public List<string> FirewallRules { get; set; } = new();
    public List<string> EpicAccounts { get; set; } = new();
    public List<string> RockstarAccounts { get; set; } = new();
    public List<FiveMItem> FiveM { get; set; } = new();
    public List<DiscordTrace> DiscordTraces { get; set; } = new();
    // v4.3
    public List<JournalEntry> Journal { get; set; } = new();
    public string JournalInfo { get; set; } = "";
    // v4.4
    public List<MemoryTrace> MemoryTraces { get; set; } = new();
    public string MemoryInfo { get; set; } = "";
    // v4.5
    public List<HardwareDevice> Hardware { get; set; } = new();
    public string HardwareInfo { get; set; } = "";

    public string Verdict =>
        Detections.Any(d => d.Severity == Severity.High) ? "cheating"
        : Detections.Count > 0 || Warnings.Count >= 3 ? "suspicious"
        : "clean";
}

/// <summary>A device that is (or was) connected to the PC — only the ones that matter for cheating are kept.</summary>
public sealed class HardwareDevice
{
    public string Name { get; set; } = "";
    public string Kind { get; set; } = "";        // DMA card / KMBox / Cronus / XIM / Arduino / FPGA …
    public string InstanceId { get; set; } = "";
    public bool Present { get; set; }             // plugged in right now
    public string LastSeen { get; set; } = "";
    public int Level { get; set; }                // 2 = cheat device, 1 = check it
    public string Why { get; set; } = "";
}
