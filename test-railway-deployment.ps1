# Test Railway Deployment
# Replace YOUR_RAILWAY_URL with your actual Railway domain

param(
    [string]$RailwayUrl = "https://puretask-backend-production.up.railway.app"
)

Write-Host "`n=== Testing Railway Deployment ===" -ForegroundColor Cyan
Write-Host "URL: $RailwayUrl" -ForegroundColor Yellow
Write-Host ""

# Test 1: Health Check
Write-Host "Test 1: Health Check..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$RailwayUrl/health" -UseBasicParsing
    Write-Host "✅ PASSED - Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "❌ FAILED - $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Database Connection
Write-Host "Test 2: Database Connection..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$RailwayUrl/health/ready" -UseBasicParsing
    Write-Host "✅ PASSED - Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "❌ FAILED - $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "=== Test Complete ===" -ForegroundColor Cyan

