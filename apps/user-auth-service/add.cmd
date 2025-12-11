@echo off
:: install-package.cmd
:: Script để cài package bằng pnpm mà không cần nhớ cú pháp

if "%~1"=="" (
  echo.
  echo [Usage] add package-name [package-name ...] [--save-dev|--save|-D]
  echo.
  echo Example:
  echo     add express
  echo     add lodash --save-dev
  echo     add react react-dom -D
  exit /b 1
)

setlocal enabledelayedexpansion

set DEV_FLAG=
set PACKAGES=

:parse
if "%~1"=="" goto done

if /I "%~1"=="--save-dev" (
  set DEV_FLAG=-D
) else if /I "%~1"=="--save" (
  rem pnpm không phân biệt save/prod như npm, mặc định là dependencies
  rem nên ở đây bỏ qua --save, chỉ giữ lại packages
) else if /I "%~1"=="-D" (
  set DEV_FLAG=-D
) else (
  set PACKAGES=!PACKAGES! %~1
)

shift
goto parse

:done

if defined DEV_FLAG (
  echo Installing dev packages: %PACKAGES% with pnpm...
  pnpm add %DEV_FLAG% %PACKAGES%
) else (
  echo Installing packages: %PACKAGES% with pnpm...
  pnpm add %PACKAGES%
)

if %errorlevel%==0 (
  echo.
  echo Packages installed successfully!
) else (
  echo.
  echo Failed to install packages.
)

endlocal