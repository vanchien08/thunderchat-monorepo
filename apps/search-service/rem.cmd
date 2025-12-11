@echo off
:: uninstall-package.cmd
:: Gỡ một hoặc nhiều package bằng pnpm (không dùng shift)

if "%~1"=="" (
  echo.
  echo [Usage] uninstall-package package1 [package2 package3 ...]
  echo.
  echo Example:
  echo     uninstall-package ts-proto protoc eslint prettier
  exit /b 1
)

echo ============================================
echo Starting uninstall process via pnpm...
echo ============================================
echo.

:: Lặp qua tất cả các tham số được truyền vào
for %%P in (%*) do (
  echo Uninstalling package "%%P"...
  pnpm remove %%P >nul 2>&1

  if !errorlevel! == 0 (
    echo Successfully uninstalled "%%P"
  ) else (
    echo Failed to uninstall "%%P"
  )
)

echo.
echo ============================================
echo All specified packages processed.
echo ============================================

