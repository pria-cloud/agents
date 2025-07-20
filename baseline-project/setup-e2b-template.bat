@echo off
setlocal enabledelayedexpansion

echo 🚀 Setting up E2B Template for baseline-project
echo ===============================================

REM Check if E2B CLI is installed
e2b --version >nul 2>&1
if errorlevel 1 (
    echo ❌ E2B CLI is not installed
    echo Please install it first:
    echo   npm install -g @e2b/cli
    echo   or visit: https://e2b.dev/docs/getting-started
    exit /b 1
)

REM Check if user is logged in
e2b whoami >nul 2>&1
if errorlevel 1 (
    echo ❌ You are not logged in to E2B
    echo Please login first:
    echo   e2b login
    exit /b 1
)

echo ✅ E2B CLI is installed and you are logged in

REM Get current user info
for /f "tokens=*" %%i in ('e2b whoami') do set USER_INFO=%%i
echo 👤 Logged in as: !USER_INFO!

REM Check if we're in the right directory
if not exist "e2b.Dockerfile" (
    echo ❌ e2b.Dockerfile not found
    echo Please run this script from the baseline-project directory
    exit /b 1
)

echo ✅ Found e2b.Dockerfile

REM Initialize template if e2b.toml doesn't exist
if not exist "e2b.toml" (
    echo 📝 Initializing E2B template...
    e2b template init
) else (
    echo ✅ e2b.toml already exists
)

REM Build the template
echo 🔨 Building E2B template...
echo This may take a few minutes...

e2b template build

echo.
echo 🔧 Next steps:
echo 1. Check the output above for your Template ID
echo 2. Add the Template ID to your agent environment variables:
echo    E2B_TEMPLATE_ID=your-template-id-here
echo.
echo 3. Update your .env files in the agent directories:
echo    - app-builder/.env
echo    - app-builder-claude/.env
echo.
echo 4. Test the template:
echo    e2b sandbox create your-template-id
echo.
echo 📚 For more details, see: E2B_DEPLOYMENT_GUIDE.md
echo.
echo 🎉 E2B template setup complete!