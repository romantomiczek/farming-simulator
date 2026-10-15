@echo off
rem Spusti Godot demo. Godot_v4.3-stable_win64.exe (nebo novejsi 4.x) musi lezet v teto slozce.
cd /d "%~dp0"
for %%f in (Godot_v4*_win64.exe) do (
  start "" "%%f" --path "%~dp0."
  goto :eof
)
echo.
echo  Nenasel jsem Godot.
echo  Stahni "Godot Engine - Windows 64 bit" (verze 4.3) z https://godotengine.org/download/archive/4.3-stable/
echo  a soubor Godot_v4.3-stable_win64.exe z archivu dej do teto slozky:
echo  %~dp0
echo.
pause
