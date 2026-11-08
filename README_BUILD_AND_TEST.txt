HeRoShield Scanner - WPF startup icon fix

FIX: MainWindow.xaml references the pack URI of hero-icon.ico, which is explicitly embedded as a WPF Resource in HeRoScanner.csproj. ApplicationIcon remains set for Windows Explorer and taskbar.

BUILD: On Windows with .NET 8 SDK installed, run BUILD.bat. It publishes a Windows x64 self-contained single-file executable and copies HeRoShieldScanner.exe to the project root.

TEST: Run the new EXE on Windows before uploading it to the website. If it fails, read %TEMP%\HeRoShield-startup-error.log and share its full exception details.

IMPORTANT: This environment does not have the Windows .NET WPF toolchain; successful compilation and runtime launch have NOT been verified. This patch targets the identified WPF icon resource issue, not every possible startup failure.
