@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ร้านทากทะเล 3D

rem ====================================================================
rem  เปิดเกมแบบมีโมเดล 3D โดยไม่ต้องเปิดเซิร์ฟเวอร์
rem
rem  ทำไมดับเบิลคลิก index.html เฉย ๆ แล้วได้แต่ทาก 2D:
rem  หน้าเว็บที่เปิดจากไฟล์ตรง ๆ อยู่บน file:// ซึ่ง Chrome ถือว่าเป็น "origin ว่าง"
rem  แล้วบล็อก <script type="module"> ทั้งก้อน → js/slug-3d.js ไม่ถูกรันเลย
rem  เกมจึงตกไปใช้ทางสำรองคือสไปรต์ 2D ของ slug-engine.js
rem
rem  ไฟล์นี้เปิด Chrome ด้วยแฟล็ก --allow-file-access-from-files ซึ่งปลดล็อกให้
rem  โมดูลโหลดได้ ส่วน fetch() ที่ยังโดนบล็อกอยู่ js/file-mode.js จัดการต่อให้แล้ว
rem ====================================================================

set "PF86=%ProgramFiles(x86)%"
set "BROWSER="
set "NAME="

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe" & set "NAME=Chrome")
if not defined BROWSER if exist "%PF86%\Google\Chrome\Application\chrome.exe" (set "BROWSER=%PF86%\Google\Chrome\Application\chrome.exe" & set "NAME=Chrome")
if not defined BROWSER if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (set "BROWSER=%LocalAppData%\Google\Chrome\Application\chrome.exe" & set "NAME=Chrome")
if not defined BROWSER if exist "%PF86%\Microsoft\Edge\Application\msedge.exe" (set "BROWSER=%PF86%\Microsoft\Edge\Application\msedge.exe" & set "NAME=Edge")
if not defined BROWSER if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" & set "NAME=Edge")

if not defined BROWSER goto nobrowser

echo เปิดด้วย %NAME% ... (โมเดล 3D ใหญ่ ครั้งแรกรอสัก 5-10 วินาที)
start "" "%BROWSER%" ^
 --allow-file-access-from-files ^
 --user-data-dir="%LocalAppData%\TakTaLay3D\browser-profile" ^
 --autoplay-policy=no-user-gesture-required ^
 "%CD%\index.html"
exit /b 0

:nobrowser
echo.
echo *** หา Chrome หรือ Edge ในเครื่องไม่เจอ ***
echo.
echo เล่นบนเว็บแทนได้เลย:
echo   https://bbkekeub.github.io/Tak-Ta-Lay-the-Sea-slug-Aquarium/
echo.
pause
exit /b 1
