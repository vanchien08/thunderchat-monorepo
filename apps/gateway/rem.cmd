@echo off
:: uninstall-package.cmd
:: Script để gỡ package bằng pnpm mà không cần nhớ cú pháp

if "%~1"=="" (
  echo.
  echo [Usage] rem package-name
  echo.
  echo Example:
  echo     rem express
  echo     rem lodash
  exit /b 1
)

echo Uninstalling package "%~1" with pnpm...
pnpm remove %~1

if %errorlevel%==0 (
  echo.
  echo Package "%~1" uninstalled successfully!
) else (
  echo.
  echo Failed to uninstall package "%~1".
)
