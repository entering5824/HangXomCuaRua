@echo off
title Electron Dev Launcher

cd /d "%~dp0"

echo Starting Electron development mode...
npm.cmd run electron:dev

pause
