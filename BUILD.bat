@echo off
setlocal
cd /d "%~dp0"
title HeRoShield - build the small scanner .exe
echo.
echo HeRoShield - build HeRoShieldScanner.exe (.NET Framework 4.8, built into Windows 10/11)
where dotnet >nul 2>&1
if errorlevel 1 (
  echo ERROR: .NET SDK not installed. Install the .NET 8 SDK from https://dotnet.microsoft.com/download/dotnet/8.0
  pause
  exit /b 1
)
cd /d "%~dp0scanner"
if not exist "hero-icon.ico" (
  echo ERROR: scanner\hero-icon.ico is missing.
  pause
  exit /b 1
)
echo Cleaning previous build...
if exist "bin" rmdir /s /q "bin"
if exist "obj" rmdir /s /q "obj"
echo Building...
dotnet build "HeRoScanner.csproj" -c Release
if errorlevel 1 goto :failed
set "EXE=%~dp0scanner\bin\Release\net48\HeRoShieldScanner.exe"
if not exist "%EXE%" goto :failed
copy /y "%EXE%" "%~dp0HeRoShieldScanner.exe" >nul
if errorlevel 1 goto :failed
for %%A in ("%~dp0HeRoShieldScanner.exe") do set SIZE=%%~zA
echo.
echo SUCCESS: %~dp0HeRoShieldScanner.exe  (%SIZE% bytes)
echo One file, no DLLs, nothing to install for the player.
echo Upload it to your GitHub release v1.0 with the name HeRoShield.exe
echo If an error appears when it runs, read %%TEMP%%\HeRoShield-startup-error.log
pause
exit /b 0
:failed
echo.
echo BUILD FAILED. Copy the red error lines above and send them; do not distribute an old EXE.
pause
exit /b 1
