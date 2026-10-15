@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Instaluji zavislosti, poprve to chvili trva...
  call npm install
)
call npm run dev -- --open
