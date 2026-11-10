using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Text.Json;

namespace HeRoShield.Core;

/// <summary>
/// Loads the detection list from an external <c>signatures.json</c> file that
/// ships next to the scanner. The scanner itself contains no built-in list of
/// named cheats: the operator maintains the list (or the dashboard "Signatures"
/// page pushes updates to it). Each row simply names a file to recognise and the
/// in-game features it is associated with, so the report can tell staff what the
/// player could do.
/// </summary>
public static class Signatures
{
    public sealed class Sig
    {
        public string Name { get; set; } = "";
        public List<string> FileNames { get; set; } = new();   // lowercase names to match
        public List<string> Features { get; set; } = new();    // e.g. "Aimbot", "No recoil"
        public List<string> Domains { get; set; } = new();     // C2 / API domains the cheat contacts
        public List<string> Hashes { get; set; } = new();      // known SHA-256 of the cheat files
        public string Severity { get; set; } = "medium";       // low | medium | high
    }

    /// <summary>
    /// Reads signatures.json from the scanner folder. Returns an empty list if
    /// the file is missing or malformed (scan still runs, just with no matches).
    /// </summary>
    public static List<Sig> Load(string folder)
    {
        // 1) an editable signatures.json next to the exe wins (operator can tweak it)
        try
        {
            var path = PathX.Combine(folder, "signatures.json");
            if (File.Exists(path)) return FromJson(File.ReadAllText(path));
        }
        catch { }

        // 2) otherwise fall back to the starter list baked INTO the exe,
        //    so a single downloaded .exe still has the known-cheat list offline
        var embedded = ReadEmbedded();
        return embedded != null ? FromJson(embedded) : new();
    }

    private static string? ReadEmbedded()
    {
        try
        {
            var asm = System.Reflection.Assembly.GetExecutingAssembly();
            var name = asm.GetManifestResourceNames().FirstOrDefault(n => n.EndsWith("signatures.json"));
            if (name == null) return null;
            using var s = asm.GetManifestResourceStream(name);
            if (s == null) return null;
            using var r = new StreamReader(s);
            return r.ReadToEnd();
        }
        catch { return null; }
    }

    /// <summary>Parses a signatures JSON string (same shape as signatures.json).</summary>
    public static List<Sig> FromJson(string json)
    {
        try
        {
            var list = JsonSerializer.Deserialize<List<Sig>>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
            foreach (var s in list)
            {
                s.FileNames = (s.FileNames ?? new()).Select(f => f.ToLowerInvariant()).ToList();
                s.Domains = (s.Domains ?? new()).Select(d => d.ToLowerInvariant().Trim()).Where(d => d.Length > 0).ToList();
                s.Hashes = (s.Hashes ?? new()).Select(h => h.ToLowerInvariant().Trim()).Where(h => h.Length >= 32).ToList();
                s.Features ??= new();
            }
            return list;
        }
        catch { return new(); }
    }

    public static Severity ParseSeverity(string s) => s?.ToLowerInvariant() switch
    {
        "high" => Severity.High,
        "low" => Severity.Low,
        _ => Severity.Medium
    };
}
