# HeRo Shield scanner

- `scanner/` — the C# source (.NET 8, WPF).
- **Build on your PC:** double-click `BUILD.bat` → `HeRoShieldScanner.exe` appears next to it.
  Upload it to your GitHub release **v1.0** with the name **HeRoShield.exe**.
- **Or let GitHub build it:** put this folder in a GitHub repo (keep `.github/workflows/build-scanner.yml`).
  Every push builds `HeRoShield.exe` on Windows and puts it in release **v1.0** of that repo.
  If that repo is not SouthSide, set `SCANNER_EXE_URL` on Render to
  `https://github.com/<you>/<repo>/releases/download/v1.0/HeRoShield.exe`.
