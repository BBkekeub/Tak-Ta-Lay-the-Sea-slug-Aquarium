@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === push ขึ้น GitHub ===
git config --global --add safe.directory "%CD:\=/%" >nul 2>&1
git push origin main
echo.
echo เสร็จแล้ว - รอ GitHub Pages build 1-2 นาที แล้วเปิดเว็บกด Ctrl+F5
pause
