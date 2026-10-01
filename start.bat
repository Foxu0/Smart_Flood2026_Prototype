@echo off
title SmartFlood 2026 - Server Launcher
color 0B
chcp 65001 >nul
cls

echo ==============================================================================
echo   * SMARTFLOOD 2026 - EARLY WARNING SYSTEM SERVER *
echo ==============================================================================
echo.

cd /d "%~dp0"

:: 1. Check Node.js installation
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in your PATH.
    echo Please install Node.js from https://nodejs.org/ and try again.
    pause
    exit /b 1
)

:: 2. Check if node_modules exists, install if missing
if not exist "node_modules\" (
    echo [SETUP] First-time setup detected. Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install npm dependencies.
        pause
        exit /b 1
    )
)

:: 3. Check if .env exists, create from template if missing
if not exist ".env" (
    echo [SETUP] Creating .env file from template...
    copy ".env.example" ".env" >nul
)

:: 4. Get Local IPv4 Address for LAN display
set LOCAL_IP=
for /f "tokens=4" %%a in ('route print 0.0.0.0 2^>nul ^| findstr "0.0.0.0" ^| findstr /v "Persistent"') do (
    set LOCAL_IP=%%a
    goto :IP_RESOLVED
)
:IP_RESOLVED

echo [INFO] Starting Backend API Server on Port 3001...
start "SmartFlood Backend API [Port 3001]" cmd /c "cd /d "%~dp0" && node server/index.js"

echo [INFO] Starting Frontend Web App on Port 5173...
start "SmartFlood Frontend Web App [Port 5173]" cmd /c "cd /d "%~dp0" && npx vite --host 0.0.0.0 --port 5173"

:: Wait 3 seconds for services to bind
ping 127.0.0.1 -n 4 >nul

echo.
echo ==============================================================================
echo   SUCCESS: SMARTFLOOD SERVICES RUNNING!
echo ==============================================================================
echo.
echo   LOCAL ACCESS:
echo      - Public Resident Dashboard : http://localhost:5173
echo      - EOC Admin Operations      : http://localhost:5173/admin
echo      - REST API / Health         : http://localhost:3001/api/v1/health
echo      - WebSocket Stream          : ws://localhost:3001
echo.
if not "%LOCAL_IP%"=="" (
    echo   NETWORK / LAN ACCESS [Phones, Tablets, Other PCs]:
    echo      - Public Resident Dashboard : http://%LOCAL_IP%:5173
    echo      - EOC Admin Operations      : http://%LOCAL_IP%:5173/admin
    echo      - REST API Stream           : http://%LOCAL_IP%:3001/api/v1
    echo.
)
echo   DEFAULT ADMIN CREDENTIALS:
echo      - Username : admin
echo      - Password : admin
echo.
echo ==============================================================================
echo   Keep the server command windows open while running.
echo   Opening dashboard in your default browser...
start http://localhost:5173
echo.
pause
exit /b 0
