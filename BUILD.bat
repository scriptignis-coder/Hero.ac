@echo off
setlocal
cd /d "%~dp0"
title HeRoShield - Windows x64 Single EXE Build
echo.
echo HeRoShield - clean build of one Windows executable
where dotnet >nul 2>&1
if errorlevel 1 (
  echo ERROR: .NET 8 SDK not installed. Install it from https://dotnet.microsoft.com/download/dotnet/8.0
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
dotnet clean "HeRoScanner.csproj" -c Release -r win-x64
if errorlevel 1 goto :failed
echo Publishing self-contained, Windows x64, single file...
dotnet publish "HeRoScanner.csproj" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -p:DebugType=None -p:DebugSymbols=false
if errorlevel 1 goto :failed
set "EXE=%~dp0scanner\bin\Release\net8.0-windows\win-x64\publish\HeRoShieldScanner.exe"
if not exist "%EXE%" goto :failed
copy /y "%EXE%" "%~dp0HeRoShieldScanner.exe" >nul
if errorlevel 1 goto :failed
echo.
echo SUCCESS: %~dp0HeRoShieldScanner.exe
echo Upload this single EXE as your site's scanner base file.
echo If a generated download fails to launch, first test this original EXE.
echo If an error appears, inspect %%TEMP%%\HeRoShield-startup-error.log
pause
exit /b 0
:failed
echo.
echo BUILD FAILED. Read the error above; do not distribute an old EXE.
pause
exit /b 1
