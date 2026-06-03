# Installation

RiskFlow CRM does not ship with unsigned `.bat` or `.exe` launchers. Windows can block those files, so the launcher is built locally from the commands below.

## Requirements

- Windows 10 or Windows 11.
- Node.js LTS from https://nodejs.org/.
- The project folder extracted somewhere normal, such as the Desktop or Documents folder.
- `RiskflowCRM-App` kept inside the project root.

## Open the Project Folder

1. Open File Explorer.
2. Open the folder that contains `installation.md` and `RiskflowCRM-App`.
3. Right-click empty space inside the folder.
4. Select `Open in Terminal`.
5. If Command Prompt opens instead of PowerShell, run:

```powershell
powershell
```

The prompt should start with `PS`. Run the commands below from the project root, not from inside `RiskflowCRM-App`.

## Build the App

```powershell
cd ".\RiskflowCRM-App"
npm ci
npm run build
cd ..
```

The production build is created in `RiskflowCRM-App\dist`. The local launcher still starts the Vite server so the app opens at `http://127.0.0.1:5173/`.

If `npm` is not recognized, install Node.js LTS, close the terminal, reopen it in the project folder, and run the commands again.

## Create Riskflow.bat

Paste this full block into PowerShell:

```powershell
@'
@echo off
setlocal
set "ROOT=%~dp0"
set "APP_DIR=%ROOT%RiskflowCRM-App"
set "SCRIPT=%APP_DIR%\scripts\start-riskflow.ps1"

if not exist "%SCRIPT%" (
  msg * "RiskFlow CRM launcher could not find the app folder. Keep Riskflow.bat next to the RiskflowCRM-App folder."
  exit /b 1
)

start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%SCRIPT%"
exit /b 0
'@ | Set-Content -Path ".\Riskflow.bat" -Encoding ASCII
```

Confirm that the launcher was created:

```powershell
Test-Path ".\Riskflow.bat"
```

`True` means the file exists. Start it from PowerShell with:

```powershell
.\Riskflow.bat
```

Double-clicking `Riskflow.bat` from File Explorer works as well.

## Optional EXE Launcher

This step creates a small `Riskflow.exe` from readable C# source. The EXE starts the `Riskflow.bat` file created above, so both files must stay beside the `RiskflowCRM-App` folder.

Paste this full block into PowerShell:

```powershell
@'
using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

public static class RiskflowLauncher
{
    public static int Main()
    {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string bat = Path.Combine(root, "Riskflow.bat");

        if (!File.Exists(bat))
        {
            MessageBox.Show(
                "Riskflow.bat was not found. Keep Riskflow.exe next to Riskflow.bat and the RiskflowCRM-App folder.",
                "RiskFlow CRM"
            );
            return 1;
        }

        ProcessStartInfo info = new ProcessStartInfo();
        info.FileName = "cmd.exe";
        info.Arguments = "/c \"" + bat + "\"";
        info.WorkingDirectory = root;
        info.UseShellExecute = false;
        info.CreateNoWindow = true;
        info.WindowStyle = ProcessWindowStyle.Hidden;

        Process.Start(info);
        return 0;
    }
}
'@ | Set-Content -Path ".\RiskflowLauncher.cs" -Encoding ASCII

$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) {
  $csc = "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe"
}

if (-not (Test-Path $csc)) {
  Write-Host "C# compiler not found. Install Visual Studio Build Tools or the .NET Framework Developer Pack, then run this step again."
  return
}

& $csc /nologo /target:winexe /reference:System.Windows.Forms.dll /out:".\Riskflow.exe" ".\RiskflowLauncher.cs"
```

Confirm that the EXE was created:

```powershell
Test-Path ".\Riskflow.exe"
```

`True` means `Riskflow.exe` is ready to run.

## First Start

- The first start can take a little longer while dependencies are checked.
- The app opens at `http://127.0.0.1:5173/`.
- If the browser does not open, run `Riskflow.bat` again and check `RiskflowCRM-App\riskflow-start.log`.
- If port `5173` is already busy, close old RiskFlow CRM or Vite windows and start the launcher again.

## Note

macOS compatibility will be added in a future update.
