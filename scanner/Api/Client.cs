using System.Net.Http;
using System.Text;
using System.Text.Json;
using HeRoShield.Core;

namespace HeRoShield.Api;

/// <summary>Sends the finished report back to the HeRo Shield backend.</summary>
public sealed class Client
{
    // long timeout: Render free servers take ~50 s to wake up, and the report is a few MB
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(150) };
    private readonly string _baseUrl;

    /// <summary>Why the last SubmitAsync failed (shown to the player / in the local log).</summary>
    public string LastError { get; private set; } = "";

    public Client(string baseUrl) => _baseUrl = baseUrl.TrimEnd('/');

    public async Task<bool> SubmitAsync(ScanReport report)
    {
        string json;
        try
        {
            json = JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = false });
            // Postgres (Supabase) rejects \u0000 inside JSON text — registry / binary strings often have it
            json = json.Replace("\\u0000", "");
        }
        catch (Exception ex) { LastError = "could not build the report: " + ex.Message; return false; }

        for (int attempt = 1; attempt <= 3; attempt++)
        {
            try
            {
                using var body = new StringContent(json, Encoding.UTF8, "application/json");
                var res = await _http.PostAsync($"{_baseUrl}/api/scan-report", body);
                if (res.IsSuccessStatusCode) { LastError = ""; return true; }
                var text = "";
                try { text = await res.Content.ReadAsStringAsync(); } catch { }
                var code = (int)res.StatusCode;
                var msg = System.Text.RegularExpressions.Regex.Match(text, "\"error\"\\s*:\\s*\"([^\"]{1,160})\"").Groups[1].Value;
                LastError = $"HTTP {code}" + (msg.Length > 0 ? " — " + msg : "");
                // wrong PIN / bad request: retrying will not help
                if (code is 400 or 404 or 405 or 413) return false;
            }
            catch (TaskCanceledException) { LastError = "the server did not answer in time"; }
            catch (Exception ex) { LastError = ex.Message; }
            if (attempt < 3) await Task.Delay(TimeSpan.FromSeconds(attempt * 10));
        }
        return false;
    }

    /// <summary>Asks the site if the PIN exists and is still unused — BEFORE the scan starts.</summary>
    public async Task<PinCheck> ValidatePinAsync(string pin)
    {
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(75) }; // Render may need to wake up
            var res = await http.GetAsync($"{_baseUrl}/api/scan-report?pin={Uri.EscapeDataString(pin)}");
            var code = (int)res.StatusCode;
            if (code == 200) return PinCheck.Ok;
            if (code == 404) return PinCheck.Unknown;
            if (code == 410) return PinCheck.Used;
            return PinCheck.Offline;   // older site / server error: scan anyway, report is kept locally
        }
        catch { return PinCheck.Offline; }
    }
}

public enum PinCheck { Ok, Unknown, Used, Offline }
