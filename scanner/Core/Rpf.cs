using System.IO.Compression;

namespace HeRoShield.Core;

/// <summary>
/// Minimal read-only reader for GTA V "RPF7" archives (the .rpf files FiveM mods use).
/// Rockstar's own archives are encrypted (AES / NG) and can't be read without the game keys,
/// but mods saved by OpenIV are usually "OPEN" (not encrypted): their file list and the
/// .meta / .xml / .dat files inside can be read and checked.
/// Layout: header (magic, entry count, names length, encryption) · 16-byte entries · names table.
/// </summary>
public static class Rpf
{
    public const uint Magic = 0x52504637;          // "RPF7"
    public const uint EncOpen = 0x4E45504F;        // "OPEN"
    public const uint EncNone = 0;
    public const uint EncAes = 0x0FFFFFF9;
    public const uint EncNg = 0x0FEFFFFF;

    public sealed record Entry(string Path, bool IsResource, long Offset, uint Size, uint UncompressedSize, bool Encrypted);

    public sealed record Archive(string State, List<Entry> Files)   // State: "open" | "encrypted" | "invalid"
    {
        public bool CanRead => State == "open";
    }

    public static Archive Read(Stream s)
    {
        try
        {
            var br = new BinaryReader(s);
            s.Position = 0;
            if (br.ReadUInt32() != Magic) return new("invalid", new());
            uint count = br.ReadUInt32(), namesLen = br.ReadUInt32(), enc = br.ReadUInt32();
            if (count == 0 || count > 200000 || namesLen > 16 * 1024 * 1024) return new("invalid", new());
            if (enc != EncOpen && enc != EncNone) return new("encrypted", new());

            var entries = br.ReadBytes((int)count * 16);
            var names = br.ReadBytes((int)namesLen);
            if (entries.Length < count * 16) return new("invalid", new());

            string NameAt(uint off)
            {
                if (off >= names.Length) return "";
                int end = Array.IndexOf(names, (byte)0, (int)off);
                if (end < 0) end = names.Length;
                return System.Text.Encoding.ASCII.GetString(names, (int)off, end - (int)off);
            }

            var files = new List<Entry>();
            // walk the directory tree from the root (entry 0) so every file gets its full path
            var stack = new Stack<(uint index, string path, int depth)>();
            stack.Push((0, "", 0));
            int guard = 0;
            while (stack.Count > 0 && guard++ < 400000)
            {
                var (i, path, depth) = stack.Pop();
                if (i >= count || depth > 64) continue;
                int o = (int)i * 16;
                uint x = BitConverter.ToUInt32(entries, o + 4);
                if (x == 0x7FFFFF00)
                {
                    uint nameOff = BitConverter.ToUInt32(entries, o);
                    uint first = BitConverter.ToUInt32(entries, o + 8), n = BitConverter.ToUInt32(entries, o + 12);
                    var dir = i == 0 ? "" : (path.Length > 0 ? path + "/" : "") + NameAt(nameOff);
                    for (uint k = 0; k < n && k < 100000; k++) stack.Push((first + k, dir, depth + 1));
                    continue;
                }
                ulong buf = BitConverter.ToUInt64(entries, o);
                uint nOff = (uint)(buf & 0xFFFF);
                uint size = (uint)((buf >> 16) & 0xFFFFFF);
                bool resource = (x & 0x80000000) != 0;
                long offset = (long)((buf >> 40) & (resource ? 0x7FFFFFUL : 0xFFFFFFUL)) * 512;
                uint usize = resource ? 0 : BitConverter.ToUInt32(entries, o + 8);
                bool encrypted = !resource && BitConverter.ToUInt32(entries, o + 12) != 0;
                var name = NameAt(nOff);
                files.Add(new((path.Length > 0 ? path + "/" : "") + name, resource, offset, size, usize, encrypted));
            }
            return new("open", files);
        }
        catch { return new("invalid", new()); }
    }

    /// <summary>Bytes of a plain (non-resource, non-encrypted) file inside an OPEN archive.</summary>
    public static byte[]? Extract(Stream s, Entry e, int maxBytes = 8 * 1024 * 1024)
    {
        try
        {
            if (e.IsResource || e.Encrypted) return null;
            if (e.Offset <= 0 || e.Offset >= s.Length) return null;
            s.Position = e.Offset;
            if (e.Size == 0)   // stored
            {
                if (e.UncompressedSize > maxBytes) return null;
                var raw = new byte[e.UncompressedSize];
                int r = 0;
                while (r < raw.Length) { int k = s.Read(raw, r, raw.Length - r); if (k <= 0) break; r += k; }
                return raw;
            }
            if (e.Size > maxBytes || e.UncompressedSize > maxBytes) return null;
            var comp = new byte[e.Size];
            int got = 0;
            while (got < comp.Length) { int k = s.Read(comp, got, comp.Length - got); if (k <= 0) break; got += k; }
            using var ds = new DeflateStream(new MemoryStream(comp), CompressionMode.Decompress);
            using var ms = new MemoryStream();
            ds.CopyTo(ms);
            return ms.ToArray();
        }
        catch { return null; }
    }
}
