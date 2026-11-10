using Microsoft.Data.Sqlite;
using System.IO;

namespace HeRoShield.Core;

/// <summary>Explicitly opt-in browser search/download review; no cookies, passwords or sessions.</summary>
public static class BrowserAudit
{
    public sealed record Entry(string Browser, string Profile, string Title, string Url, string Date);
    public sealed record Download(string Browser, string Profile, string FileName, string Source, string Date);
    public sealed record Result(List<Entry> History, List<Download> Downloads);
    private const int MaxRows = 100;

    public static Result ReadLocal()
    {
        var history = new List<Entry>();
        var downloads = new List<Download>();
        foreach (var (browser, profile, path, firefox) in Profiles())
        {
            if (!File.Exists(path)) continue;
            var temp = PathX.Combine(Path.GetTempPath(), "hero-browser-" + Guid.NewGuid().ToString("N") + ".sqlite");
            try
            {
                File.Copy(path, temp, true);
                using var db = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = temp, Mode = SqliteOpenMode.ReadOnly }.ToString());
                db.Open();
                if (firefox)
                {
                    using var cmd = db.CreateCommand();
                    cmd.CommandText = "SELECT url, COALESCE(title,''), COALESCE(last_visit_date,0) FROM moz_places WHERE url IS NOT NULL ORDER BY last_visit_date DESC LIMIT 500";
                    using var rd = cmd.ExecuteReader();
                    while (rd.Read() && history.Count < 1000)
                    {
                        var url = rd.GetString(0);
                        if (!IsSearchUrl(url)) continue;
                        history.Add(new Entry(browser, profile, rd.GetString(1), url, FirefoxDate(rd.GetInt64(2))));
                    }
                    // Firefox does not reliably keep download history in places.sqlite.
                }
                else
                {
                    using (var cmd = db.CreateCommand())
                    {
                        cmd.CommandText = "SELECT url, COALESCE(title,''), COALESCE(last_visit_time,0) FROM urls ORDER BY last_visit_time DESC LIMIT 500";
                        using var rd = cmd.ExecuteReader();
                        int added = 0;
                        while (rd.Read() && added < MaxRows)
                        {
                            var url = rd.GetString(0);
                            if (!IsSearchUrl(url)) continue;
                            history.Add(new Entry(browser, profile, rd.GetString(1), url, ChromeDate(rd.GetInt64(2))));
                            added++;
                        }
                    }
                    // Chromium schema varies; keep the download query compatible with common versions.
                    try
                    {
                        using var cmd = db.CreateCommand();
                        cmd.CommandText = "SELECT COALESCE(target_path,''), COALESCE(tab_url,''), COALESCE(start_time,0) FROM downloads ORDER BY start_time DESC LIMIT 100";
                        using var rd = cmd.ExecuteReader();
                        while (rd.Read())
                        {
                            var file = rd.GetString(0);
                            downloads.Add(new Download(browser, profile, PathX.GetFileName(file), rd.GetString(1), ChromeDate(rd.GetInt64(2))));
                        }
                    }
                    catch (SqliteException) { /* Old Chromium schema: leave this profile empty. */ }
                }
            }
            catch (Exception) { /* Browser may be locked, or winsqlite3 missing on old Windows. */ }
            finally { try { File.Delete(temp); } catch { } }
        }
        return new Result(history, downloads);
    }

    private static string ChromeDate(long microseconds)
    {
        try { return microseconds > 0 ? new DateTime(1601, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddTicks(checked(microseconds * 10)).ToString("O") : ""; }
        catch { return ""; }
    }
    private static string FirefoxDate(long microseconds)
    {
        try { return microseconds > 0 ? new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddTicks(checked(microseconds * 10)).ToString("O") : ""; }
        catch { return ""; }
    }
    private static bool IsSearchUrl(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var u)) return false;
        var h = u.Host.ToLowerInvariant();
        var engine = h == "google.com" || h.EndsWith(".google.com") || h == "bing.com" || h.EndsWith(".bing.com") || h == "duckduckgo.com" || h.EndsWith(".duckduckgo.com") || h == "search.yahoo.com" || h == "search.brave.com";
        return engine && (u.Query.Contains("q=", StringComparison.OrdinalIgnoreCase) || u.Query.Contains("p=", StringComparison.OrdinalIgnoreCase));
    }
    private static IEnumerable<(string Browser, string Profile, string Path, bool Firefox)> Profiles()
    {
        var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var roaming = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        foreach (var (name, root) in new[] {
            ("Chrome", PathX.Combine(local, "Google", "Chrome", "User Data")),
            ("Edge", PathX.Combine(local, "Microsoft", "Edge", "User Data")),
            ("Brave", PathX.Combine(local, "BraveSoftware", "Brave-Browser", "User Data")) })
        {
            if (!Directory.Exists(root)) continue;
            foreach (var dir in Directory.EnumerateDirectories(root))
            {
                var profile = PathX.GetFileName(dir);
                if (profile == "Default" || profile.StartsWith("Profile ", StringComparison.OrdinalIgnoreCase))
                    yield return (name, profile, PathX.Combine(dir, "History"), false);
            }
        }
        var firefox = PathX.Combine(roaming, "Mozilla", "Firefox", "Profiles");
        if (Directory.Exists(firefox))
            foreach (var dir in Directory.EnumerateDirectories(firefox))
                yield return ("Firefox", PathX.GetFileName(dir), PathX.Combine(dir, "places.sqlite"), true);
    }
}
