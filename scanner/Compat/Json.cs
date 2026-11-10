// Small built-in replacement for the parts of System.Text.Json the scanner uses.
// .NET Framework 4.8 (built into Windows) has no System.Text.Json, and shipping the NuGet
// package would add ~10 DLLs. This keeps HeRoShield.exe one small file with no dependencies.
// Output matches System.Text.Json defaults: property names as declared, enums as numbers.
using System.Collections;
using System.Globalization;
using System.Reflection;

namespace System.Text.Json
{
    public enum JsonValueKind { Undefined, Object, Array, String, Number, True, False, Null }

    public sealed class JsonSerializerOptions
    {
        public bool WriteIndented { get; set; }
        public bool PropertyNameCaseInsensitive { get; set; }
    }

    public sealed class JsonException : Exception { public JsonException(string m) : base(m) { } }

    public readonly struct JsonProperty
    {
        public JsonProperty(string name, JsonElement value) { Name = name; Value = value; }
        public string Name { get; }
        public JsonElement Value { get; }
    }

    public readonly struct JsonElement
    {
        private readonly object? _v;   // null | string | double-string (JsonNumber) | bool | List<JsonElement> | List<JsonProperty>
        private readonly JsonValueKind _k;
        internal JsonElement(JsonValueKind k, object? v) { _k = k; _v = v; }
        public JsonValueKind ValueKind => _k;

        public bool TryGetProperty(string name, out JsonElement value)
        {
            if (_k == JsonValueKind.Object)
                foreach (var p in (List<JsonProperty>)_v!)
                    if (p.Name == name) { value = p.Value; return true; }
            value = default; return false;
        }
        internal bool TryGetPropertyCI(string name, out JsonElement value)
        {
            if (_k == JsonValueKind.Object)
                foreach (var p in (List<JsonProperty>)_v!)
                    if (string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase)) { value = p.Value; return true; }
            value = default; return false;
        }
        public JsonElement GetProperty(string name) => TryGetProperty(name, out var v) ? v : throw new KeyNotFoundException(name);
        public string? GetString() => _k switch
        {
            JsonValueKind.String => (string)_v!,
            JsonValueKind.Null => null,
            _ => throw new InvalidOperationException("Not a string"),
        };
        public bool GetBoolean() => _k == JsonValueKind.True ? true : _k == JsonValueKind.False ? false : throw new InvalidOperationException("Not a boolean");
        public double GetDouble() => _k == JsonValueKind.Number ? double.Parse((string)_v!, NumberStyles.Float, CultureInfo.InvariantCulture) : throw new InvalidOperationException("Not a number");
        public long GetInt64() => _k == JsonValueKind.Number ? (long)GetDouble() : throw new InvalidOperationException("Not a number");
        public int GetInt32() => (int)GetInt64();
        public int GetArrayLength() => _k == JsonValueKind.Array ? ((List<JsonElement>)_v!).Count : throw new InvalidOperationException("Not an array");
        public IEnumerable<JsonElement> EnumerateArray() => _k == JsonValueKind.Array ? (List<JsonElement>)_v! : throw new InvalidOperationException("Not an array");
        public IEnumerable<JsonProperty> EnumerateObject() => _k == JsonValueKind.Object ? (List<JsonProperty>)_v! : throw new InvalidOperationException("Not an object");
        internal string RawNumber => (string)_v!;
        public override string ToString() => _k switch
        {
            JsonValueKind.String => (string)_v!,
            JsonValueKind.Number => (string)_v!,
            JsonValueKind.True => "True",
            JsonValueKind.False => "False",
            JsonValueKind.Null => "",
            _ => JsonSerializer.WriteElement(this),
        };
    }

    public sealed class JsonDocument : IDisposable
    {
        private JsonDocument(JsonElement root) { RootElement = root; }
        public JsonElement RootElement { get; }
        public static JsonDocument Parse(string json) => new(new Parser(json).ParseRoot());
        public void Dispose() { }
    }

    internal sealed class Parser
    {
        private readonly string _s; private int _i;
        public Parser(string s) { _s = s ?? throw new ArgumentNullException(nameof(s)); }

        public JsonElement ParseRoot()
        {
            if (_s.Length > 0 && _s[0] == '﻿') _i = 1;
            var v = Value(0);
            Ws();
            if (_i != _s.Length) throw new JsonException("Unexpected text after the JSON value at " + _i);
            return v;
        }

        private void Ws() { while (_i < _s.Length && (_s[_i] == ' ' || _s[_i] == '\t' || _s[_i] == '\n' || _s[_i] == '\r')) _i++; }

        private JsonElement Value(int depth)
        {
            if (depth > 128) throw new JsonException("JSON nested too deep");
            Ws();
            if (_i >= _s.Length) throw new JsonException("Unexpected end of JSON");
            char c = _s[_i];
            switch (c)
            {
                case '{':
                {
                    _i++; var props = new List<JsonProperty>();
                    Ws();
                    if (_i < _s.Length && _s[_i] == '}') { _i++; return new(JsonValueKind.Object, props); }
                    while (true)
                    {
                        Ws();
                        if (_i >= _s.Length || _s[_i] != '"') throw new JsonException("Expected a property name at " + _i);
                        var name = Str();
                        Ws();
                        if (_i >= _s.Length || _s[_i] != ':') throw new JsonException("Expected ':' at " + _i);
                        _i++;
                        props.Add(new JsonProperty(name, Value(depth + 1)));
                        Ws();
                        if (_i < _s.Length && _s[_i] == ',') { _i++; continue; }
                        if (_i < _s.Length && _s[_i] == '}') { _i++; return new(JsonValueKind.Object, props); }
                        throw new JsonException("Expected ',' or '}' at " + _i);
                    }
                }
                case '[':
                {
                    _i++; var items = new List<JsonElement>();
                    Ws();
                    if (_i < _s.Length && _s[_i] == ']') { _i++; return new(JsonValueKind.Array, items); }
                    while (true)
                    {
                        items.Add(Value(depth + 1));
                        Ws();
                        if (_i < _s.Length && _s[_i] == ',') { _i++; continue; }
                        if (_i < _s.Length && _s[_i] == ']') { _i++; return new(JsonValueKind.Array, items); }
                        throw new JsonException("Expected ',' or ']' at " + _i);
                    }
                }
                case '"': return new(JsonValueKind.String, Str());
                case 't': Lit("true"); return new(JsonValueKind.True, true);
                case 'f': Lit("false"); return new(JsonValueKind.False, false);
                case 'n': Lit("null"); return new(JsonValueKind.Null, null);
                default:
                {
                    int st = _i;
                    if (c == '-') _i++;
                    while (_i < _s.Length && (char.IsDigit(_s[_i]) || _s[_i] == '.' || _s[_i] == 'e' || _s[_i] == 'E' || _s[_i] == '+' || _s[_i] == '-')) _i++;
                    var num = _s.Substring(st, _i - st);
                    if (num.Length == 0 || !double.TryParse(num, NumberStyles.Float, CultureInfo.InvariantCulture, out _))
                        throw new JsonException("Invalid value at " + st);
                    return new(JsonValueKind.Number, num);
                }
            }
        }

        private void Lit(string w)
        {
            if (string.CompareOrdinal(_s, _i, w, 0, w.Length) != 0) throw new JsonException("Invalid literal at " + _i);
            _i += w.Length;
        }

        private string Str()
        {
            _i++; // opening quote
            var sb = new StringBuilder();
            while (true)
            {
                if (_i >= _s.Length) throw new JsonException("Unterminated string");
                char c = _s[_i++];
                if (c == '"') return sb.ToString();
                if (c != '\\') { sb.Append(c); continue; }
                if (_i >= _s.Length) throw new JsonException("Unterminated string");
                char e = _s[_i++];
                switch (e)
                {
                    case '"': sb.Append('"'); break;
                    case '\\': sb.Append('\\'); break;
                    case '/': sb.Append('/'); break;
                    case 'b': sb.Append('\b'); break;
                    case 'f': sb.Append('\f'); break;
                    case 'n': sb.Append('\n'); break;
                    case 'r': sb.Append('\r'); break;
                    case 't': sb.Append('\t'); break;
                    case 'u':
                        if (_i + 4 > _s.Length) throw new JsonException("Bad \\u escape");
                        sb.Append((char)int.Parse(_s.Substring(_i, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                        _i += 4; break;
                    default: throw new JsonException("Bad escape \\" + e);
                }
            }
        }
    }

    public static class JsonSerializer
    {
        // ------------------------------------------------------------ write
        public static string Serialize<T>(T value, JsonSerializerOptions? options = null)
        {
            var sb = new StringBuilder(1 << 16);
            Write(sb, value, options?.WriteIndented == true, 0, 0);
            return sb.ToString();
        }

        internal static string WriteElement(JsonElement e) { var sb = new StringBuilder(); WriteEl(sb, e); return sb.ToString(); }

        private static void WriteEl(StringBuilder sb, JsonElement e)
        {
            switch (e.ValueKind)
            {
                case JsonValueKind.Object:
                    sb.Append('{'); bool f = true;
                    foreach (var p in e.EnumerateObject()) { if (!f) sb.Append(','); f = false; Quote(sb, p.Name); sb.Append(':'); WriteEl(sb, p.Value); }
                    sb.Append('}'); break;
                case JsonValueKind.Array:
                    sb.Append('['); bool g = true;
                    foreach (var x in e.EnumerateArray()) { if (!g) sb.Append(','); g = false; WriteEl(sb, x); }
                    sb.Append(']'); break;
                case JsonValueKind.String: Quote(sb, e.GetString()!); break;
                case JsonValueKind.Number: sb.Append(e.RawNumber); break;
                case JsonValueKind.True: sb.Append("true"); break;
                case JsonValueKind.False: sb.Append("false"); break;
                default: sb.Append("null"); break;
            }
        }

        private static readonly Dictionary<Type, PropertyInfo[]> PropCache = new();

        private static PropertyInfo[] Props(Type t)
        {
            lock (PropCache)
            {
                if (PropCache.TryGetValue(t, out var ps)) return ps;
                ps = t.GetProperties(BindingFlags.Public | BindingFlags.Instance)
                      .Where(p => p.CanRead && p.GetIndexParameters().Length == 0 && p.GetGetMethod() != null)
                      .ToArray();
                // System.Text.Json order: base-class properties first, then the type's own, in declaration order
                ps = ps.OrderBy(p => Depth(p.DeclaringType!)).ThenBy(p => p.MetadataToken).ToArray();
                PropCache[t] = ps;
                return ps;
            }
        }
        private static int Depth(Type t) { int d = 0; while (t.BaseType != null) { d++; t = t.BaseType; } return d; }

        private static void NewLine(StringBuilder sb, bool indent, int level)
        {
            if (!indent) return;
            sb.Append('\n'); sb.Append(' ', level * 2);
        }

        private static void Write(StringBuilder sb, object? v, bool indent, int level, int depth)
        {
            if (depth > 64) { sb.Append("null"); return; }
            switch (v)
            {
                case null: sb.Append("null"); return;
                case string s: Quote(sb, s); return;
                case bool b: sb.Append(b ? "true" : "false"); return;
                case char ch: Quote(sb, ch.ToString()); return;
                case Enum en: sb.Append(Convert.ToInt64(en, CultureInfo.InvariantCulture).ToString(CultureInfo.InvariantCulture)); return;
                case int or long or short or byte or sbyte or ushort or uint or ulong:
                    sb.Append(Convert.ToString(v, CultureInfo.InvariantCulture)); return;
                case double d: Num(sb, d); return;
                case float fl: Num(sb, fl); return;
                case decimal m: sb.Append(m.ToString(CultureInfo.InvariantCulture)); return;
                case DateTime dt: Quote(sb, dt.ToString(dt.Kind == DateTimeKind.Utc ? "yyyy-MM-dd'T'HH:mm:ss.FFFFFFF'Z'" : dt.Kind == DateTimeKind.Local ? "yyyy-MM-dd'T'HH:mm:ss.FFFFFFFzzz" : "yyyy-MM-dd'T'HH:mm:ss.FFFFFFF", CultureInfo.InvariantCulture)); return;
                case DateTimeOffset dto: Quote(sb, dto.ToString("yyyy-MM-dd'T'HH:mm:ss.FFFFFFFzzz", CultureInfo.InvariantCulture)); return;
                case TimeSpan ts: Quote(sb, ts.ToString("c", CultureInfo.InvariantCulture)); return;
                case Guid gu: Quote(sb, gu.ToString()); return;
                case JsonElement je: WriteEl(sb, je); return;
                case IDictionary dict:
                {
                    sb.Append('{'); bool first = true;
                    foreach (DictionaryEntry kv in dict)
                    {
                        if (!first) sb.Append(','); first = false;
                        NewLine(sb, indent, level + 1);
                        Quote(sb, Convert.ToString(kv.Key, CultureInfo.InvariantCulture) ?? "");
                        sb.Append(indent ? ": " : ":");
                        Write(sb, kv.Value, indent, level + 1, depth + 1);
                    }
                    if (!first) NewLine(sb, indent, level);
                    sb.Append('}'); return;
                }
                case IEnumerable list:
                {
                    sb.Append('['); bool first = true;
                    foreach (var x in list)
                    {
                        if (!first) sb.Append(','); first = false;
                        NewLine(sb, indent, level + 1);
                        Write(sb, x, indent, level + 1, depth + 1);
                    }
                    if (!first) NewLine(sb, indent, level);
                    sb.Append(']'); return;
                }
            }
            var t = v.GetType();
            if (t.IsPrimitive) { Quote(sb, Convert.ToString(v, CultureInfo.InvariantCulture) ?? ""); return; }
            sb.Append('{'); bool any = false;
            foreach (var p in Props(t))
            {
                object? pv;
                try { pv = p.GetValue(v); } catch { continue; }
                if (any) sb.Append(','); any = true;
                NewLine(sb, indent, level + 1);
                Quote(sb, p.Name);
                sb.Append(indent ? ": " : ":");
                Write(sb, pv, indent, level + 1, depth + 1);
            }
            if (any) NewLine(sb, indent, level);
            sb.Append('}');
        }

        private static void Num(StringBuilder sb, double d)
        {
            if (double.IsNaN(d) || double.IsInfinity(d)) { sb.Append('0'); return; }   // JSON has no NaN/Infinity
            sb.Append(d.ToString("R", CultureInfo.InvariantCulture));
        }

        private static void Quote(StringBuilder sb, string s)
        {
            sb.Append('"');
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    case '\b': sb.Append("\\b"); break;
                    case '\f': sb.Append("\\f"); break;
                    default:
                        // escape control chars, non-ASCII and HTML-sensitive chars like System.Text.Json does
                        if (c < 0x20 || c > 0x7E || c == '<' || c == '>' || c == '&' || c == '\'' || c == '+' || c == '`')
                            sb.Append("\\u").Append(((int)c).ToString("X4", CultureInfo.InvariantCulture));
                        else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
        }

        // ------------------------------------------------------------ read
        public static T? Deserialize<T>(string json, JsonSerializerOptions? options = null)
        {
            var root = new Parser(json).ParseRoot();
            return (T?)Read(root, typeof(T), options?.PropertyNameCaseInsensitive == true);
        }

        private static object? Read(JsonElement e, Type t, bool ci)
        {
            var nt = Nullable.GetUnderlyingType(t);
            if (nt != null) { if (e.ValueKind == JsonValueKind.Null) return null; t = nt; }
            if (e.ValueKind == JsonValueKind.Null) return t.IsValueType ? Activator.CreateInstance(t) : null;
            if (t == typeof(object) || t == typeof(JsonElement)) return e;
            if (t == typeof(string)) return e.ValueKind == JsonValueKind.String ? e.GetString() : throw new JsonException("Expected a string");
            if (t == typeof(bool)) return e.GetBoolean();
            if (t.IsEnum)
                return e.ValueKind == JsonValueKind.String ? Enum.Parse(t, e.GetString()!, true) : Enum.ToObject(t, e.GetInt64());
            if (t == typeof(double)) return e.GetDouble();
            if (t == typeof(float)) return (float)e.GetDouble();
            if (t == typeof(decimal)) return decimal.Parse(e.RawNumber, NumberStyles.Float, CultureInfo.InvariantCulture);
            if (t.IsPrimitive) return Convert.ChangeType(e.GetDouble(), t, CultureInfo.InvariantCulture);
            if (t == typeof(DateTime)) return DateTime.Parse(e.GetString()!, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind);

            if (t.IsArray)
            {
                var et = t.GetElementType()!;
                var items = e.EnumerateArray().Select(x => Read(x, et, ci)).ToList();
                var arr = Array.CreateInstance(et, items.Count);
                for (int i = 0; i < items.Count; i++) arr.SetValue(items[i], i);
                return arr;
            }
            if (t.IsGenericType && typeof(IList).IsAssignableFrom(t))
            {
                var et = t.GetGenericArguments()[0];
                var list = (IList)Activator.CreateInstance(t)!;
                foreach (var x in e.EnumerateArray()) list.Add(Read(x, et, ci));
                return list;
            }
            if (t.IsGenericType && typeof(IDictionary).IsAssignableFrom(t))
            {
                var vt = t.GetGenericArguments()[1];
                var dict = (IDictionary)Activator.CreateInstance(t)!;
                foreach (var p in e.EnumerateObject()) dict[p.Name] = Read(p.Value, vt, ci);
                return dict;
            }
            if (e.ValueKind != JsonValueKind.Object) throw new JsonException("Expected an object for " + t.Name);
            var o = Activator.CreateInstance(t)!;
            foreach (var p in t.GetProperties(BindingFlags.Public | BindingFlags.Instance))
            {
                if (!p.CanWrite || p.GetSetMethod() == null) continue;
                bool found = ci ? e.TryGetPropertyCI(p.Name, out var pv) : e.TryGetProperty(p.Name, out pv);
                if (!found) continue;
                p.SetValue(o, Read(pv, p.PropertyType, ci));
            }
            return o;
        }
    }
}
