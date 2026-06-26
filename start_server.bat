@echo off
setlocal
cd /d "%~dp0"

echo [55CINE] Starting static server (port 8080)...
start "55CINE Static Server" cmd /k "cd /d "%~dp0" && python -m http.server 8080"

echo [55CINE] Starting API server (port 3000)...
start "55CINE API Server" cmd /k "cd /d "%~dp0api" && npm run dev"

echo.
echo [55CINE] Servers started in separate windows.
echo   - Static: http://127.0.0.1:8080
echo   - API:    http://127.0.0.1:3000
echo.
echo To stop, run stop_server.bat
endlocal
