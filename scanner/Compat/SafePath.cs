namespace HeRoShield
{
    /// <summary>
    /// .NET Framework's Path methods throw "Illegal characters in path" for names with " &lt; &gt; | etc.
    /// (registry values, command lines, prefetch names…), where .NET 8 just returns a result.
    /// These wrappers keep the .NET 8 behaviour so one odd entry can't stop a whole scan step.
    /// </summary>
    internal static class PathX
    {
        private static int LastSep(string p) => Math.Max(p.LastIndexOf('\\'), Math.Max(p.LastIndexOf('/'), p.Length >= 2 && p[1] == ':' ? 1 : -1));

        // same result as Windows' Path.GetFileName, but never throws on odd characters
        public static string GetFileName(string? p) => p == null ? null! : p.Substring(LastSep(p) + 1);

        public static string GetExtension(string? p)
        {
            if (p == null) return null!;
            var n = p.Substring(LastSep(p) + 1);
            int i = n.LastIndexOf('.');
            return i < 0 || i == n.Length - 1 ? "" : n.Substring(i);
        }

        public static string GetFileNameWithoutExtension(string? p)
        {
            if (p == null) return null!;
            var n = p.Substring(LastSep(p) + 1);
            int i = n.LastIndexOf('.');
            return i < 0 ? n : n.Substring(0, i);
        }

        public static string? GetDirectoryName(string? p)
        {
            if (p == null) return null;
            try { return System.IO.Path.GetDirectoryName(p); }
            catch (ArgumentException)
            {
                int i = Math.Max(p.LastIndexOf('\\'), p.LastIndexOf('/'));
                if (i <= 0) return null;
                if (i == 2 && p.Length > 1 && p[1] == ':') return null;
                return p.Substring(0, i);
            }
            catch (System.IO.PathTooLongException)
            {
                int i = Math.Max(p.LastIndexOf('\\'), p.LastIndexOf('/'));
                return i <= 0 ? null : p.Substring(0, i);
            }
        }

        public static string Combine(params string[] parts)
        {
            try { return System.IO.Path.Combine(parts); }
            catch (ArgumentException)
            {
                var sb = new System.Text.StringBuilder();
                foreach (var part in parts)
                {
                    if (string.IsNullOrEmpty(part)) continue;
                    if (part.StartsWith("\\") || (part.Length > 1 && part[1] == ':')) sb.Clear();   // rooted part resets, like Path.Combine
                    if (sb.Length > 0 && sb[sb.Length - 1] != '\\' && sb[sb.Length - 1] != '/') sb.Append('\\');
                    sb.Append(part);
                }
                return sb.ToString();
            }
        }

        public static string GetFullPath(string p)
        {
            try { return System.IO.Path.GetFullPath(p); }
            catch (Exception ex) when (ex is ArgumentException or NotSupportedException or System.IO.PathTooLongException) { return p; }
        }
    }
}
