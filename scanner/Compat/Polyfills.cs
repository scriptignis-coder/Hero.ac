// Small helpers so the same C# code builds for .NET Framework 4.8 (built into Windows),
// which keeps HeRoShield.exe a few MB instead of shipping the whole .NET runtime.
namespace System.Runtime.CompilerServices
{
    internal static class IsExternalInit { }
}

namespace HeRoShield
{
    using System.Collections.Generic;

    internal static class Net48Extensions
    {
        public static bool Contains(this string s, string value, StringComparison comparison) => s.IndexOf(value, comparison) >= 0;
        public static bool Contains(this string s, char value) => s.IndexOf(value) >= 0;
        public static bool StartsWith(this string s, char c) => s.Length > 0 && s[0] == c;
        public static bool EndsWith(this string s, char c) => s.Length > 0 && s[s.Length - 1] == c;
        public static string[] Split(this string s, char c, StringSplitOptions o) => s.Split(new[] { c }, o);
        public static string[] Split(this string s, string sep, StringSplitOptions o = StringSplitOptions.None) => s.Split(new[] { sep }, o);
        public static string Replace(this string s, string oldValue, string? newValue, StringComparison comparison)
        {
            if (string.IsNullOrEmpty(oldValue)) return s;
            var sb = new System.Text.StringBuilder();
            int i = 0, j;
            while ((j = s.IndexOf(oldValue, i, comparison)) >= 0) { sb.Append(s, i, j - i).Append(newValue); i = j + oldValue.Length; }
            return sb.Append(s, i, s.Length - i).ToString();
        }
        public static void Deconstruct<TK, TV>(this KeyValuePair<TK, TV> kv, out TK key, out TV value) { key = kv.Key; value = kv.Value; }
        public static TV? GetValueOrDefault<TK, TV>(this IDictionary<TK, TV> d, TK key, TV? fallback = default) => d.TryGetValue(key, out var v) ? v : fallback;
        public static bool TryAdd<TK, TV>(this IDictionary<TK, TV> d, TK key, TV value) { if (d.ContainsKey(key)) return false; d.Add(key, value); return true; }
    }
}
