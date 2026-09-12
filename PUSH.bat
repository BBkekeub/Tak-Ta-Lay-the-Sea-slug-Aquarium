@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo   push ขึ้น GitHub Pages
echo ================================================
git config --global --add safe.directory "%CD:\=/%" >nul 2>&1

set "MSG=%~1"
if "%MSG%"=="" set /p "MSG=ข้อความ commit (กด Enter เฉย ๆ = update): "
if "%MSG%"=="" set "MSG=update"

echo.
echo [1/3] เพิ่มไฟล์ที่แก้ทั้งหมด...
git add -A
if errorlevel 1 goto fail

echo [2/3] commit...
git commit -m "%MSG%"
if errorlevel 1 echo        ^(ไม่มีอะไรใหม่ให้ commit - ข้ามไปขั้นต่อไป^)

echo [3/3] push... ^(ครั้งแรกอาจนานหน่อย ไฟล์โมเดล 3D ใหญ่^)
git push origin main
if errorlevel 1 goto fail

echo.
echo ================================================
echo   เสร็จแล้ว! รอ GitHub Pages build 1-2 นาที
echo.
echo   https://bbkekeub.github.io/Tak-Ta-Lay-the-Sea-slug-Aquarium/
echo.
echo   เปิดแล้วกด Ctrl+F5 เพื่อล้างแคช
echo ================================================
pause
exit /b 0

:fail
echo.
echo *** ไม่สำเร็จ - อ่านข้อความ error ด้านบน ***
pause
exit /b 1
