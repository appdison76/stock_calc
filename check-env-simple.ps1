# Simple Environment Check
Write-Host "Checking development environment..." -ForegroundColor Cyan
Write-Host ""

# Node.js
Write-Host "[Node.js]" -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "OK: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "NOT FOUND: Install from https://nodejs.org/" -ForegroundColor Red
}

# npm
Write-Host "[npm]" -ForegroundColor Yellow
try {
    $npmVersion = npm --version 2>&1
    Write-Host "OK: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "NOT FOUND" -ForegroundColor Red
}

# Java
Write-Host "[Java]" -ForegroundColor Yellow
try {
    $javaVersion = java -version 2>&1 | Select-Object -First 1
    Write-Host "OK: $javaVersion" -ForegroundColor Green
} catch {
    Write-Host "NOT FOUND: Install from https://adoptium.net/" -ForegroundColor Red
}

# JAVA_HOME
Write-Host "[JAVA_HOME]" -ForegroundColor Yellow
if ($env:JAVA_HOME) {
    Write-Host "OK: $env:JAVA_HOME" -ForegroundColor Green
} else {
    Write-Host "NOT SET" -ForegroundColor Yellow
}

# ANDROID_HOME
Write-Host "[ANDROID_HOME]" -ForegroundColor Yellow
if ($env:ANDROID_HOME) {
    Write-Host "OK: $env:ANDROID_HOME" -ForegroundColor Green
} else {
    Write-Host "NOT SET" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Check complete!" -ForegroundColor Cyan
