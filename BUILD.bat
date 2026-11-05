@echo off
title HeRo Shield - Build Scanner
color 0b
echo.
echo   }=^<(((*^>   HeRo Shield - building the scanner (single .exe)
echo   ------------------------------------------------------------
echo.

cd /d "%~dp0scanner"

echo [1/4] Closing any running scanner and clearing old build...
taskkill /f /im HeRoShieldScanner.exe 1>nul 2>nul
taskkill /f /im HeRoScanner.exe 1>nul 2>nul
rmdir /s /q bin 1>nul 2>nul
rmdir /s /q obj 1>nul 2>nul
echo       done.
echo.

echo [2/4] Making sure nuget.org is a package source...
dotnet nuget add source https://api.nuget.org/v3/index.json -n nuget.org 1>nul 2>nul
echo       done.
echo.

echo [3/4] Restoring packages (first time can take a few minutes)...
dotnet restore
if errorlevel 1 ( echo. & echo   RESTORE FAILED - check your internet and run again. & echo. & pause & exit /b 1 )
echo.

echo [4/4] Building ONE self-contained HeRoShieldScanner.exe ...
dotnet publish -c Release -r win-x64 -p:PublishSingleFile=true --self-contained true
if errorlevel 1 (
  echo.
  echo   BUILD FAILED.
  echo   If it says "Access denied", the folder exclusion in Avast/Defender is missing.
  echo   Add C:\Users\medmi\Desktop\HeRoShield as an exclusion, then run again.
  echo.
  pause
  exit /b 1
)

set "EXE=bin\Release\net8.0-windows\win-x64\publish\HeRoShieldScanner.exe"

echo.
echo   ================================================
echo   DONE! ONE file the client downloads and runs:
echo   scanner\%EXE%
echo   ================================================
echo.

REM copy the single exe next to BUILD.bat for easy sharing
copy /y "%EXE%" "%~dp0HeRoShieldScanner.exe" 1>nul 2>nul
if exist "%~dp0HeRoShieldScanner.exe" ( echo   Copied here: %~dp0HeRoShieldScanner.exe  ^(give players THIS single file^) )
echo.
pause
