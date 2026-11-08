using System;
using System.IO;
using System.Text;
using System.Windows;
using System.Windows.Threading;

namespace HeRoShield;

public partial class App : Application
{
    public App()
    {
        DispatcherUnhandledException += (_, e) =>
        {
            ReportError(e.Exception);
            e.Handled = true;
            Shutdown(1);
        };
        AppDomain.CurrentDomain.UnhandledException += (_, e) =>
        {
            if (e.ExceptionObject is Exception ex) ReportError(ex);
        };
        System.Threading.Tasks.TaskScheduler.UnobservedTaskException += (_, e) =>
        {
            ReportError(e.Exception);
            e.SetObserved();
        };
    }

    private static void ReportError(Exception ex)
    {
        string details = ex.ToString();
        string path = Path.Combine(Path.GetTempPath(), "HeRoShield-startup-error.log");
        try { File.AppendAllText(path, DateTime.Now.ToString("O") + Environment.NewLine + details + Environment.NewLine, Encoding.UTF8); } catch { }
        try { MessageBox.Show("HeRoShield encountered an error.\n\n" + ex.Message + "\n\nDiagnostic log: " + path, "HeRoShield - Error", MessageBoxButton.OK, MessageBoxImage.Error); } catch { }
    }
}
