@echo off
title SplitTheBill - Launcher
color 0A

echo ============================================================
echo            SplitTheBill - Starting Application
echo ============================================================
echo.

:: Check Java
where java >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Java is not installed or not in PATH.
    pause & exit /b 1
)

:: Check Maven
where mvn >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Maven is not installed or not in PATH.
    pause & exit /b 1
)

:: Check Node / npm
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js / npm is not installed or not in PATH.
    pause & exit /b 1
)

echo [OK] Java, Maven, and Node.js found.
echo.

:: Start Backend in new window
echo [1/2] Starting Spring Boot Backend...
start "SplitTheBill - Backend" cmd /k "cd /d %~dp0backend && mvn spring-boot:run"

timeout /t 3 /nobreak >nul

:: Start Frontend in new window
echo [2/2] Starting Vite Frontend...
start "SplitTheBill - Frontend" cmd /k "cd /d %~dp0frontend && npm install && npm run dev"

echo.
echo ============================================================
echo   Both servers are starting in separate windows!
echo.
echo   Backend  : http://localhost:8085
echo   Frontend : http://localhost:5173
echo.
echo   Close those windows to stop the servers.
echo ============================================================
echo.
pause

