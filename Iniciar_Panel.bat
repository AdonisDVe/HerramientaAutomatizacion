@echo off
start node dashboard.js
timeout /t 3
start http://localhost:3000
exit