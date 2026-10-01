@echo off
title SmartFlood 2026 - Server Management Console
color 0B
chcp 65001 >nul
cd /d "%~dp0"

:CHECK_NODE
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in your PATH.
    echo Please download and install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Auto-create .env if missing
if not exist ".env" (
    echo [SETUP] Creating .env file from template...
    copy ".env.example" ".env" >nul
)

:: Get Local IPv4 Address
set LOCAL_IP=
for /f "tokens=4" %%a in ('route print 0.0.0.0 2^>nul ^| findstr "0.0.0.0" ^| findstr /v "Persistent"') do (
    set LOCAL_IP=%%a
    goto :MENU
)

:MENU
cls
echo ==============================================================================
echo   * SMARTFLOOD 2026 - EMERGENCY OPERATIONS SERVER CONSOLE *
echo ==============================================================================
if not "%LOCAL_IP%"=="" (
    echo   [Host Machine LAN IP: %LOCAL_IP%]
)
echo.
echo   [1] Start Full System (Backend API + Frontend Web App)
echo   [2] Start Unified Production Server (Single Port 3001, No Vite)
echo   [3] Start Full System + ESP32 Hardware Simulator + 3D Wiring
echo   [4] Start ESP32 Virtual Simulator Only (Web GUI on Port 5174)
echo   [5] Start ESP32 Standalone CLI Streamer (tools/virtual-esp32.js)
echo   [6] Run Automated Thesis Showcase Script (npm run showcase)
echo   [7] Run Full System Test Suite (npm run test:suite)
echo   [8] Rebuild Frontend Production Bundle (npm run build)
echo   [9] Stop Running Node Servers (Kill 3001, 5173, 5174)
echo   [0] Exit
echo.
echo ==============================================================================
choice /c 1234567890 /n /m "Enter your selection [0-9]: "

if errorlevel 10 exit /b 0
if errorlevel 9 goto STOP_SERVERS
if errorlevel 8 goto RUN_BUILD
if errorlevel 7 goto RUN_TESTS
if errorlevel 6 goto RUN_SHOWCASE
if errorlevel 5 goto START_CLI_SIM
if errorlevel 4 goto START_SIM_GUI
if errorlevel 3 goto START_FULL_SIM
if errorlevel 2 goto START_UNIFIED
if errorlevel 1 goto START_FULL

goto MENU

:START_FULL
cls
echo ==============================================================================
echo   Launching SmartFlood 2026 (Full Dev System)
echo ==============================================================================
echo [1/2] Launching Backend API + WebSocket Server on Port 3001...
start "SmartFlood Backend API [3001]" cmd /c "cd /d "%~dp0" && node server/index.js"
echo [2/2] Launching Frontend Web App on Port 5173...
start "SmartFlood Frontend [5173]" cmd /c "cd /d "%~dp0" && npx vite --host 0.0.0.0 --port 5173"
ping 127.0.0.1 -n 4 >nul
start http://localhost:5173
echo.
echo Servers started in separate windows!
echo Local Portal : http://localhost:5173
echo EOC Admin    : http://localhost:5173/admin (admin / admin)
if not "%LOCAL_IP%"=="" (
    echo LAN Access   : http://%LOCAL_IP%:5173
)
echo.
pause
goto MENU

:START_UNIFIED
cls
echo ==============================================================================
echo   Launching Unified Production Server (Single Port 3001)
echo ==============================================================================
if not exist "dist\index.html" (
    echo Building frontend first...
    call npm run build
)
echo Starting Express server serving Frontend + API + WebSocket on Port 3001...
start "SmartFlood Production Server [3001]" cmd /c "cd /d "%~dp0" && node server/index.js"
ping 127.0.0.1 -n 3 >nul
start http://localhost:3001
echo.
echo Server running at:
echo Local Portal : http://localhost:3001
echo EOC Admin    : http://localhost:3001/admin (admin / admin)
if not "%LOCAL_IP%"=="" (
    echo LAN Access   : http://%LOCAL_IP%:3001
)
echo.
pause
goto MENU

:START_FULL_SIM
cls
echo ==============================================================================
echo   Launching Full System + Virtual ESP32 Simulator & 3D Wiring
echo ==============================================================================
echo [1/3] Launching Backend API + WebSocket on Port 3001...
start "SmartFlood Backend API [3001]" cmd /c "cd /d "%~dp0" && node server/index.js"
echo [2/3] Launching Frontend Web App on Port 5173...
start "SmartFlood Frontend [5173]" cmd /c "cd /d "%~dp0" && npx vite --host 0.0.0.0 --port 5173"
echo [3/3] Launching ESP32 Simulator & 3D Wiring on Port 5174...
start "SmartFlood Simulator Hub [5174]" cmd /c "cd /d "%~dp0" && node tools/server-simulator-gui.js"
ping 127.0.0.1 -n 4 >nul
start http://localhost:5173
start http://localhost:5174
echo.
echo All services are running!
echo - Dashboard: http://localhost:5173
echo - Admin:     http://localhost:5173/admin
echo - Simulator: http://localhost:5174
echo - 3D Wiring: http://localhost:5174/wiring
echo.
pause
goto MENU

:START_SIM_GUI
cls
echo Starting Virtual ESP32 Simulator & 3D Wiring server on port 5174...
start "SmartFlood Simulator Hub [5174]" cmd /c "cd /d "%~dp0" && node tools/server-simulator-gui.js"
ping 127.0.0.1 -n 3 >nul
start http://localhost:5174
pause
goto MENU

:START_CLI_SIM
cls
echo Starting Standalone Virtual ESP32 Terminal Streamer...
node tools/virtual-esp32.js
pause
goto MENU

:RUN_SHOWCASE
cls
echo Running Automated Thesis Showcase Demo...
node tools/admin-showcase.js
pause
goto MENU

:RUN_TESTS
cls
echo Running System Diagnostics & Telemetry Validation Suite...
node tools/test_system_suite.js
pause
goto MENU

:RUN_BUILD
cls
echo Building Frontend Production Bundle...
call npm run build
echo.
echo Build complete.
pause
goto MENU

:STOP_SERVERS
cls
echo ==============================================================================
echo   Stopping SmartFlood Node.js Server Processes...
echo ==============================================================================
powershell -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*node*' } | Stop-Process -Force"
echo Stopped running Node.js instances.
ping 127.0.0.1 -n 3 >nul
goto MENU
