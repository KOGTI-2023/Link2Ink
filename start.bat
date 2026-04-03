@echo off
echo ===================================================
echo Starting Link 2 Ink Studio
echo ===================================================

:: Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if .env exists, if not copy from .env.example
if not exist .env (
    if exist .env.example (
        echo Creating .env from .env.example...
        copy .env.example .env >nul
        echo Please update .env with your actual GEMINI_API_KEY if needed.
    ) else (
        echo Warning: No .env or .env.example found.
    )
)

:: Install dependencies if node_modules doesn't exist
if not exist node_modules (
    echo Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo Error: Failed to install dependencies.
        pause
        exit /b 1
    )
)

echo Starting development server...
call npm run dev

pause
