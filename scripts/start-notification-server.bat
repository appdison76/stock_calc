@echo off
chcp 65001 >nul
title 알림 관리 서버 (stock_calc)
cd /d "%~dp0.."
if not exist "package.json" (
  echo 오류: package.json 을 찾을 수 없습니다.
  echo 이 배치 파일은 stock_calc\scripts 안에 두거나, 바로가기 대상 경로를 확인하세요.
  pause
  exit /b 1
)

echo 프로젝트: %CD%
echo 브라우저에서 http://localhost:3000 접속
echo 종료: 이 창에서 Ctrl+C
echo.
npm run notification:server
echo.
pause
