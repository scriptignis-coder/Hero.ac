using System.IO.Compression;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace HeRoShield.Core;

/// <summary>
/// Finds the Discord servers a player was in — also the ones he already LEFT — from what Discord
/// and the browsers keep on disk: server icons in the HTTP cache (every server in the left bar loads
/// its icon), invite pages he opened (/api/invites/CODE → server id + name), channel links and the
/// Local Storage / IndexedDB of the Discord app. Leaving a server does not clean this up; only clearing
/// the cache does (and that is reported as "no traces" by the dashboard).
/// </summary>
public static class DiscordCache
{
    private static readonly Regex Icon = new(@"cdn\.discordapp\.com/(icons|banners|splashes|discovery-splashes)/(\d{17,20})/", RegexOptions.Compiled);
    private static readonly Regex ApiGuild = new(@"discord(?:app)?\.com/api/(?:v\d+/)?guilds/(\d{17,20})", RegexOptions.Compiled);
    private static readonly Regex Channel = new(@"discord(?:app)?\.com/channels/(\d{17,20})/\d{17,20}", RegexOptions.Compiled);
    private static readonly Regex ApiInvite = new(@"discord(?:app)?\.com/api/(?:v\d+/)?invites?/([A-Za-z0-9-]{2,32})", RegexOptions.Compiled);
    private static readonly Regex GuildIdField = new(@"""guild_?[iI]d""\s*:\s*""(\d{17,20})""", RegexOptions.Compiled);
    private static readonly byte[] SimpleMagic = BitConverter.GetBytes(0xfcfb6d1ba7725c30UL);
    private static readonly byte[] EofMagic = BitConverter.GetBytes(0xf4fa6f45970d41d8UL);

    public static IEnumerable<(string Client, string Dir)> DefaultRoots()
    {
        var roam = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        foreach (var (n, d) in new[] { ("Discord app", "discord"), ("Discord PTB", "discordptb"), ("Discord Canary", "discordcanary"),
                                       ("Discord Dev", "discorddevelopment"), ("Vesktop", Path.Combine("vesktop", "sessionData")), ("Lightcord", "Lightcord") })
            yield return (n, Path.Combine(roam, d));
        foreach (var (n, d) in new[] { ("Chrome", Path.Combine(local, "Google", "Chrome", "User Data")), ("Edge", Path.Combine(local, "Microsoft", "Edge", "User Data")),
                                       ("Brave", Path.Combine(local, "BraveSoftware", "Brave-Browser", "User Data")), ("Vivaldi", Path.Combine(local, "Vivaldi", "User Data")),
                                       ("Opera", Path.Combine(roam, "Opera Software", "Opera Stable")), ("Opera GX", Path.Combine(roam, "Opera Software", "Opera GX Stable")),
                                       ("Opera", Path.Combine(local, "Opera Software", "Opera Stable")), ("Opera GX", Path.Combine(local, "Opera Software", "Opera GX Stable")) })
        {
            if (!Directory.Exists(d)) continue;
            yield return (n, d);   // Opera keeps the profile in the root
            string[] profiles;
            try { profiles = Directory.GetDirectories(d); } catch { continue; }
            foreach (var p in profiles)
            {
                var b = Path.GetFileName(p);
                if (b == "Default" || b.StartsWith("Profile ", StringComparison.OrdinalIgnoreCase)) yield return (n, p);
            }
        }
    }

    private sealed class Acc
    {
        public string? Name, Invite;
        public HashSet<string> Sources = new();
        public DateTime First = DateTime.MaxValue, Last = DateTime.MinValue;
    }

    public static List<DiscordTrace> Read(IEnumerable<(string Client, string Dir)> roots, int maxFiles = 90000, int maxSeconds = 30)
    {
        var map = new Dictionary<string, Acc>();
        var invites = new Dictionary<string, Acc>(StringComparer.OrdinalIgnoreCase);
        var sw = System.Diagnostics.Stopwatch.StartNew();
        int files = 0;
        bool Out() => files >= maxFiles || sw.Elapsed.TotalSeconds > maxSeconds;

        void Note(string id, string client, string what, DateTime t, string? name = null, string? invite = null)
        {
            if (!map.TryGetValue(id, out var a)) map[id] = a = new Acc();
            a.Sources.Add($"{client}: {what}");
            if (t < a.First) a.First = t;
            if (t > a.Last) a.Last = t;
            if (!string.IsNullOrWhiteSpace(name)) a.Name = name;
            if (invite != null) a.Invite = invite;
        }

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (client, dir) in roots)
        {
            if (Out()) break;
            if (!Directory.Exists(dir)) continue;
            // HTTP cache (new "simple" format and the old block-file format)
            foreach (var cache in new[] { Path.Combine(dir, "Cache", "Cache_Data"), Path.Combine(dir, "Cache") })
            {
                if (!seen.Add(cache) || !Directory.Exists(cache)) continue;
                IEnumerable<string> list;
                try { list = Directory.EnumerateFiles(cache); } catch { continue; }
                foreach (var f in list)
                {
                    if (Out()) break;
                    files++;
                    try { ReadCacheFile(f, client, Note, invites); } catch { }
                }
            }
            // Local Storage / Session Storage / IndexedDB (leveldb) — only for Discord itself / discord.com
            foreach (var sub in new[] { Path.Combine(dir, "Local Storage", "leveldb"), Path.Combine(dir, "Session Storage"),
                                        Path.Combine(dir, "IndexedDB", "https_discord.com_0.indexeddb.leveldb") })
            {
                if (!seen.Add(sub) || !Directory.Exists(sub)) continue;
                bool app = client.StartsWith("Discord") || client is "Vesktop" or "Lightcord";
                IEnumerable<string> list;
                try { list = Directory.EnumerateFiles(sub); } catch { continue; }
                foreach (var f in list)
                {
                    if (Out()) break;
                    var ext = Path.GetExtension(f).ToLowerInvariant();
                    if (ext != ".log" && ext != ".ldb") continue;
                    files++;
                    try
                    {
                        var fi = new FileInfo(f);
                        if (fi.Length > 64L * 1024 * 1024) continue;
                        var text = ReadShared(f, (int)fi.Length);
                        var t = fi.LastWriteTime;
                        foreach (Match m in Channel.Matches(text)) Note(m.Groups[1].Value, client, "opened a channel", t);
                        if (app || text.Contains("discord.com", StringComparison.Ordinal))
                            foreach (Match m in GuildIdField.Matches(text)) Note(m.Groups[1].Value, client, "local storage", t);
                        foreach (Match m in Icon.Matches(text)) Note(m.Groups[2].Value, client, "server icon", t);
                    }
                    catch { }
                }
            }
        }

        var result = map.Select(kv => new DiscordTrace
        {
            GuildId = kv.Key, Name = kv.Value.Name, Invite = kv.Value.Invite,
            Sources = kv.Value.Sources.OrderBy(x => x).Take(8).ToList(),
            FirstSeen = kv.Value.First == DateTime.MaxValue ? null : kv.Value.First.ToString("yyyy-MM-ddTHH:mm:ss"),
            LastSeen = kv.Value.Last == DateTime.MinValue ? null : kv.Value.Last.ToString("yyyy-MM-ddTHH:mm:ss"),
        }).ToList();
        // invite codes we could not tie to a server id (the site matches them against its invite list)
        foreach (var kv in invites)
            if (!result.Any(r => string.Equals(r.Invite, kv.Key, StringComparison.OrdinalIgnoreCase)))
                result.Add(new DiscordTrace
                {
                    Invite = kv.Key, Sources = kv.Value.Sources.Take(8).ToList(),
                    FirstSeen = kv.Value.First == DateTime.MaxValue ? null : kv.Value.First.ToString("yyyy-MM-ddTHH:mm:ss"),
                    LastSeen = kv.Value.Last == DateTime.MinValue ? null : kv.Value.Last.ToString("yyyy-MM-ddTHH:mm:ss"),
                });
        return result.OrderByDescending(r => r.Name != null).ThenByDescending(r => r.LastSeen).Take(600).ToList();
    }

    private delegate void Noter(string id, string client, string what, DateTime t, string? name = null, string? invite = null);

    private static void ReadCacheFile(string f, string client, Noter note, Dictionary<string, Acc> invites)
    {
        var fi = new FileInfo(f);
        var name = fi.Name;
        var t = fi.LastWriteTime;
        if (name.StartsWith("data_", StringComparison.OrdinalIgnoreCase))   // old block files: keys are plain text inside
        {
            if (fi.Length > 48L * 1024 * 1024) return;
            var text = ReadShared(f, (int)fi.Length);
            foreach (Match m in Icon.Matches(text)) note(m.Groups[2].Value, client, "server icon", t);
            foreach (Match m in ApiGuild.Matches(text)) note(m.Groups[1].Value, client, "server page", t);
            foreach (Match m in ApiInvite.Matches(text)) AddInvite(invites, m.Groups[1].Value, client, t);
            return;
        }
        if (fi.Length < 32) return;
        byte[] head;
        using (var fs = new FileStream(f, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
        {
            head = new byte[(int)Math.Min(fs.Length, 4096)];
            int r = 0; while (r < head.Length) { int k = fs.Read(head, r, head.Length - r); if (k <= 0) break; r += k; }
        }
        if (!head.AsSpan(0, 8).SequenceEqual(SimpleMagic)) return;
        int keyLen = (int)Math.Min(BitConverter.ToUInt32(head, 12), (uint)(head.Length - 24));
        if (keyLen <= 0) return;
        var key = Encoding.ASCII.GetString(head, 24, keyLen);
        if (!key.Contains("discord", StringComparison.OrdinalIgnoreCase)) return;

        var mi = Icon.Match(key);
        if (mi.Success) { note(mi.Groups[2].Value, client, "server icon", t); return; }
        var mc = Channel.Match(key);
        if (mc.Success) note(mc.Groups[1].Value, client, "opened a channel", t);
        var mg = ApiGuild.Match(key);
        if (mg.Success) note(mg.Groups[1].Value, client, "server page", t);
        var minv = ApiInvite.Match(key);
        bool isApi = key.Contains("/api/", StringComparison.Ordinal);
        if (minv.Success) AddInvite(invites, minv.Groups[1].Value, client, t);
        if (!isApi || fi.Length > 4L * 1024 * 1024) return;

        // read the cached JSON answer: invites carry the server id + name, guild lists carry many servers
        var all = File.ReadAllBytes(f);
        int start = 24 + keyLen;
        int end = IndexOf(all, EofMagic, start);
        if (end <= start) return;
        var body = all.AsSpan(start, end - start).ToArray();
        var json = Decode(body);
        if (json == null) return;
        try
        {
            using var doc = JsonDocument.Parse(json);
            string? code = minv.Success ? minv.Groups[1].Value : null;
            Walk(doc.RootElement, 0, (id, gname) =>
            {
                note(id, client, code != null ? "opened invite" : "server info", t, gname, code);
                if (code != null) invites.Remove(code);
            });
        }
        catch { }
    }

    private static void AddInvite(Dictionary<string, Acc> invites, string code, string client, DateTime t)
    {
        if (code.Length < 2) return;
        if (!invites.TryGetValue(code, out var a)) invites[code] = a = new Acc { Invite = code };
        a.Sources.Add($"{client}: opened invite");
        if (t < a.First) a.First = t;
        if (t > a.Last) a.Last = t;
    }

    private static void Walk(JsonElement e, int depth, Action<string, string?> found)
    {
        if (depth > 6) return;
        if (e.ValueKind == JsonValueKind.Array) { int i = 0; foreach (var x in e.EnumerateArray()) { if (i++ > 400) break; Walk(x, depth + 1, found); } return; }
        if (e.ValueKind != JsonValueKind.Object) return;
        if (e.TryGetProperty("id", out var id) && id.ValueKind == JsonValueKind.String && Regex.IsMatch(id.GetString() ?? "", @"^\d{17,20}$")
            && e.TryGetProperty("features", out var feat) && feat.ValueKind == JsonValueKind.Array)
        {
            string? n = e.TryGetProperty("name", out var nm) && nm.ValueKind == JsonValueKind.String ? nm.GetString() : null;
            found(id.GetString()!, n);
        }
        foreach (var p in e.EnumerateObject())
            if (p.Value.ValueKind is JsonValueKind.Object or JsonValueKind.Array) Walk(p.Value, depth + 1, found);
    }

    private static string? Decode(byte[] body)
    {
        if (body.Length == 0) return null;
        static bool Js(byte b) => b == (byte)'{' || b == (byte)'[';
        if (Js(body[0])) return Encoding.UTF8.GetString(body);
        try
        {
            if (body.Length > 2 && body[0] == 0x1f && body[1] == 0x8b)
            {
                using var gz = new GZipStream(new MemoryStream(body), CompressionMode.Decompress);
                using var ms = new MemoryStream(); gz.CopyTo(ms); var o = ms.ToArray();
                return o.Length > 0 && Js(o[0]) ? Encoding.UTF8.GetString(o) : null;
            }
        }
        catch { }
        try
        {
            using var br = new BrotliStream(new MemoryStream(body), CompressionMode.Decompress);
            using var ms = new MemoryStream(); br.CopyTo(ms); var o = ms.ToArray();
            if (o.Length > 0 && Js(o[0])) return Encoding.UTF8.GetString(o);
        }
        catch { }
        try
        {
            using var df = new ZLibStream(new MemoryStream(body), CompressionMode.Decompress);
            using var ms = new MemoryStream(); df.CopyTo(ms); var o = ms.ToArray();
            if (o.Length > 0 && Js(o[0])) return Encoding.UTF8.GetString(o);
        }
        catch { }
        return null;
    }

    private static int IndexOf(byte[] hay, byte[] needle, int from)
    {
        for (int i = Math.Max(0, from); i <= hay.Length - needle.Length; i++)
        {
            int j = 0; while (j < needle.Length && hay[i + j] == needle[j]) j++;
            if (j == needle.Length) return i;
        }
        return -1;
    }

    private static string ReadShared(string f, int len)
    {
        using var fs = new FileStream(f, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        var b = new byte[len]; int r = 0;
        while (r < len) { int k = fs.Read(b, r, len - r); if (k <= 0) break; r += k; }
        return Encoding.Latin1.GetString(b, 0, r);
    }
}
