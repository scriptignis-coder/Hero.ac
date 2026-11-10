// Tiny read-only SQLite access through winsqlite3.dll, which is built into Windows 10 and 11.
// Replaces the Microsoft.Data.Sqlite package (and its native e_sqlite3.dll), so the scanner
// stays one small .exe. Same names as Microsoft.Data.Sqlite for the few calls BrowserAudit makes.
using System.Runtime.InteropServices;

namespace Microsoft.Data.Sqlite
{
    public enum SqliteOpenMode { ReadWriteCreate, ReadWrite, ReadOnly, Memory }

    public class SqliteException : Exception { public SqliteException(string m) : base(m) { } }

    public sealed class SqliteConnectionStringBuilder
    {
        public string DataSource { get; set; } = "";
        public SqliteOpenMode Mode { get; set; } = SqliteOpenMode.ReadOnly;
        public override string ToString() => DataSource + "\u0001" + (int)Mode;
    }

    internal static class Native
    {
        private const string Dll = "winsqlite3.dll";
        public const int SQLITE_OK = 0, SQLITE_ROW = 100, SQLITE_DONE = 101, SQLITE_NULL = 5;
        public const int OPEN_READONLY = 0x1;
        [DllImport(Dll, CallingConvention = CallingConvention.StdCall)] public static extern int sqlite3_open_v2(byte[] filename, out IntPtr db, int flags, IntPtr vfs);
        [DllImport(Dll, CallingConvention = CallingConvention.StdCall)] public static extern int sqlite3_close_v2(IntPtr db);
        [DllImport(Dll, CallingConvention = CallingConvention.StdCall)] public static extern int sqlite3_prepare_v2(IntPtr db, byte[] sql, int nBytes, out IntPtr stmt, IntPtr tail);
        [DllImport(Dll, CallingConvention = CallingConvention.StdCall)] public static extern int sqlite3_step(IntPtr stmt);
        [DllImport(Dll, CallingConvention = CallingConvention.StdCall)] public static extern int sqlite3_finalize(IntPtr stmt);
        [DllImport(Dll, CallingConvention = CallingConvention.StdCall)] public static extern int sqlite3_column_type(IntPtr stmt, int col);
        [DllImport(Dll, CallingConvention = CallingConvention.StdCall)] public static extern IntPtr sqlite3_column_text(IntPtr stmt, int col);
        [DllImport(Dll, CallingConvention = CallingConvention.StdCall)] public static extern int sqlite3_column_bytes(IntPtr stmt, int col);
        [DllImport(Dll, CallingConvention = CallingConvention.StdCall)] public static extern long sqlite3_column_int64(IntPtr stmt, int col);
        [DllImport(Dll, CallingConvention = CallingConvention.StdCall)] public static extern IntPtr sqlite3_errmsg(IntPtr db);

        public static byte[] Utf8Z(string s) { var b = System.Text.Encoding.UTF8.GetBytes(s); Array.Resize(ref b, b.Length + 1); return b; }

        public static string Err(IntPtr db)
        {
            try { var p = sqlite3_errmsg(db); return p == IntPtr.Zero ? "sqlite error" : Marshal.PtrToStringAnsi(p) ?? "sqlite error"; }
            catch { return "sqlite error"; }
        }
    }

    public sealed class SqliteConnection : IDisposable
    {
        private readonly string _path;
        internal IntPtr Handle;
        public SqliteConnection(string connectionString) { _path = connectionString.Split('\u0001')[0]; }

        public void Open()
        {
            int rc;
            try { rc = Native.sqlite3_open_v2(Native.Utf8Z(_path), out Handle, Native.OPEN_READONLY, IntPtr.Zero); }
            catch (Exception ex) when (ex is DllNotFoundException or EntryPointNotFoundException or BadImageFormatException)
            { throw new SqliteException("winsqlite3.dll is not available on this Windows: " + ex.Message); }
            if (rc != Native.SQLITE_OK) { var m = Native.Err(Handle); Dispose(); throw new SqliteException(m); }
        }

        public SqliteCommand CreateCommand() => new(this);

        public void Dispose()
        {
            if (Handle != IntPtr.Zero) { try { Native.sqlite3_close_v2(Handle); } catch { } Handle = IntPtr.Zero; }
        }
    }

    public sealed class SqliteCommand : IDisposable
    {
        private readonly SqliteConnection _c;
        internal SqliteCommand(SqliteConnection c) { _c = c; }
        public string CommandText { get; set; } = "";

        public SqliteDataReader ExecuteReader()
        {
            if (_c.Handle == IntPtr.Zero) throw new SqliteException("connection is not open");
            var sql = Native.Utf8Z(CommandText);
            int rc = Native.sqlite3_prepare_v2(_c.Handle, sql, sql.Length, out var stmt, IntPtr.Zero);
            if (rc != Native.SQLITE_OK || stmt == IntPtr.Zero) throw new SqliteException(Native.Err(_c.Handle));
            return new SqliteDataReader(_c, stmt);
        }

        public void Dispose() { }
    }

    public sealed class SqliteDataReader : IDisposable
    {
        private readonly SqliteConnection _c;
        private IntPtr _stmt;
        internal SqliteDataReader(SqliteConnection c, IntPtr stmt) { _c = c; _stmt = stmt; }

        public bool Read()
        {
            if (_stmt == IntPtr.Zero) return false;
            int rc = Native.sqlite3_step(_stmt);
            if (rc == Native.SQLITE_ROW) return true;
            if (rc == Native.SQLITE_DONE) return false;
            throw new SqliteException(Native.Err(_c.Handle));
        }

        public bool IsDBNull(int i) => Native.sqlite3_column_type(_stmt, i) == Native.SQLITE_NULL;

        public string GetString(int i)
        {
            var p = Native.sqlite3_column_text(_stmt, i);
            if (p == IntPtr.Zero) return "";
            int n = Native.sqlite3_column_bytes(_stmt, i);
            if (n <= 0) return "";
            var b = new byte[n];
            Marshal.Copy(p, b, 0, n);
            return System.Text.Encoding.UTF8.GetString(b);
        }

        public long GetInt64(int i) => Native.sqlite3_column_int64(_stmt, i);

        public void Dispose()
        {
            if (_stmt != IntPtr.Zero) { try { Native.sqlite3_finalize(_stmt); } catch { } _stmt = IntPtr.Zero; }
        }
    }
}
