@echo off
title SplitTheBill - Launcher
color 0A

echo ============================================================
echo          SplitTheBill - Starting Application
echo ============================================================
echo.

:: --- Resolve JAVA_HOME ---
set "JAVA_HOME="
if exist "C:\Program Files\Android\openjdk\jdk-21.0.8\bin\java.exe" (
    set "JAVA_HOME=C:\Program Files\Android\openjdk\jdk-21.0.8"
    echo [INFO] Using JDK 21 from Android SDK
)
if not defined JAVA_HOME (
    if exist "C:\Program Files\JetBrains\IntelliJ IDEA 2026.1.3\jbr\bin\java.exe" (
        set "JAVA_HOME=C:\Program Files\JetBrains\IntelliJ IDEA 2026.1.3\jbr"
        echo [INFO] Using Java from IntelliJ JBR
    )
)
if not defined JAVA_HOME (
    echo [ERROR] Could not find Java 21. Please install JDK 21.
    pause & exit /b 1
)

:: --- Resolve MAVEN_HOME ---
set "MAVEN_HOME="
if exist "C:\Program Files\JetBrains\IntelliJ IDEA 2026.1.3\plugins\maven\lib\maven3\bin\mvn.cmd" (
    set "MAVEN_HOME=C:\Program Files\JetBrains\IntelliJ IDEA 2026.1.3\plugins\maven\lib\maven3"
    echo [INFO] Using Maven from IntelliJ IDEA
)
if not defined MAVEN_HOME (
    echo [ERROR] Could not find Maven. Please install Maven.
    pause & exit /b 1
)

:: --- Check npm ---
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js/npm not found. Please install Node.js.
    pause & exit /b 1
)

:: --- Add Java and Maven to PATH ---
set "PATH=%JAVA_HOME%\bin;%MAVEN_HOME%\bin;%PATH%"

echo [OK] Java, Maven, and Node.js ready.
echo.

:: --- Start Backend ---
echo [1/2] Starting Spring Boot Backend...
start "SplitTheBill - Backend" /d "%~dp0backend" cmd /k "%MAVEN_HOME%\bin\mvn.cmd" spring-boot:run

timeout /t 3 /nobreak >nul

:: --- Start Frontend ---
echo [2/2] Starting Vite Frontend...
start "SplitTheBill - Frontend" /d "%~dp0frontend" cmd /k "npm install && npm run dev"

echo.
echo ============================================================
echo   Both servers are starting in separate windows!
echo.
echo   Backend  :  http://localhost:8085
echo   Frontend :  http://localhost:5173
echo.
echo   Close those windows to stop the servers.
echo ============================================================
echo.
pause
