using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

namespace HeRoShield.Core;

/// <summary>
/// Conservative, read-only script triage. No execution of untrusted code.
/// This is lexical/behavioral triage, NOT a compiler or proof of cheating.
/// </summary>
internal static class ScriptIntelligence
{
    internal sealed record Result(bool NeedsReview, string Reason);

    internal static Result Analyze(string source, string extension)
    {
        if (string.IsNullOrWhiteSpace(source) || source == "\0luabytecode\0")
            return new(false, "No readable source code");

        // Remove comments, preserving quoted literals. This avoids treating tutorials,
        // detection rule lists, and disabled code as active script behavior.
        var code = StripComments(source, extension);
        bool injection = Any(code, "createremotethread", "writeprocessmemory", "virtualallocex", "ntwritevirtualmemory", "process_vm_writev");
        bool processAccess = Any(code, "openprocess(", "readprocessmemory", "getprocaddress", "getmodulehandle", "ptrace(");
        // Game native calls and cheat-related strings also occur in legitimate FiveM
        // resources, native definition tables, anti-cheat tools and dashboards.
        // They are deliberately not a standalone suspicious finding.
        bool remotePayload = Any(code, "downloadstring(", "invoke-expression", "iex(", "loadstring(", "eval(");
        bool network = Any(code, "httpget(", "httpclient", "webclient", "requests.get(", "fetch(", "performhttprequest(");
        bool encoded = Any(code, "frombase64string", "atob(", "base64.b64decode", "-encodedcommand", "string.char(");
        var reasons = new List<string>();
        if (injection && processAccess) reasons.Add("process-memory modification and process-access APIs");
        if (remotePayload && network && encoded) reasons.Add("network payload, dynamic evaluation and decoding combined");
        if (reasons.Count == 0) return new(false, "No correlated script behavior found");
        return new(true, "Script review: " + string.Join("; ", reasons) + ". Requires analyst confirmation; not proof of cheating");
    }

    private static bool Any(string text, params string[] needles) => needles.Any(text.Contains);

    private static string StripComments(string s, string ext)
    {
        var b = new StringBuilder(s.Length);
        char quote = '\0';
        bool escape = false;
        for (int i = 0; i < s.Length; i++)
        {
            char c = s[i];
            if (quote != '\0')
            {
                b.Append(c);
                if (escape) escape = false;
                else if (c == '\\') escape = true;
                else if (c == quote) quote = '\0';
                continue;
            }
            if (c is '\'' or '"' or '`') { quote = c; b.Append(c); continue; }
            bool slashComment = i + 1 < s.Length && c == '/' && s[i + 1] == '/'
                                && ext is ".js" or ".lua";
            bool luaComment = ext == ".lua" && i + 1 < s.Length && c == '-' && s[i + 1] == '-';
            bool hashComment = ext is ".py" or ".ps1" && c == '#';
            bool remComment = ext is ".bat" or ".cmd" && (i == 0 || s[i - 1] == '\n')
                              && string.Compare(s, i, "rem ", 0, 4, StringComparison.OrdinalIgnoreCase) == 0;
            if (slashComment || luaComment || hashComment || remComment)
            {
                while (i < s.Length && s[i] != '\n') i++;
                if (i < s.Length) b.Append('\n');
                continue;
            }
            b.Append(c);
        }
        return b.ToString();
    }
}
