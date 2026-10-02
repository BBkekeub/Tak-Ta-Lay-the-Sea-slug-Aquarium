@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ร้านทากทะเล

rem ====================================================================
rem  เปิดเกมจากไฟล์ในเครื่อง โดยไม่ต้องเปิดเซิร์ฟเวอร์
rem  ใช้โปรไฟล์เบราว์เซอร์แยกของเกม — เซฟเก็บอยู่ในโปรไฟล์นี้ ห้ามเปลี่ยนพาธ --user-data-dir
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

echo เปิดด้วย %NAME% ...
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
