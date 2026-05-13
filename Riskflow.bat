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
