@echo off
setlocal EnableDelayedExpansion

echo [55CINE] Stopping servers...

call :kill_port 8080
call :kill_port 3000

taskkill /FI "WINDOWTITLE eq 55CINE Static Server*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq 55CINE API Server*" /T /F >nul 2>&1

echo [55CINE] Done.
endlocal
exit /b 0

:kill_port
set "PORT=%~1"
set "FOUND=0"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
  set "FOUND=1"
  echo   - Stopping port %PORT% (PID %%p)
  taskkill /F /PID %%p >nul 2>&1
)
if "!FOUND!"=="0" (
  echo   - Port %PORT%: no listening process
)
exit /b 0
