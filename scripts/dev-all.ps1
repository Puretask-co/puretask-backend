param(
  [string]$BackendPath = "C:\Users\onlyw\Documents\GitHub\puretask-backend",
  [string]$FrontendPath = "C:\Users\onlyw\Documents\GitHub\puretask-frontend",
  [int]$BackendPort = 4000,
  [int]$FrontendPort = 3001
)

$ErrorActionPreference = "Stop"

function Assert-ProjectDir([string]$Path, [string]$Name) {
  if (-not (Test-Path $Path)) {
    throw "$Name path not found: $Path"
  }
  if (-not (Test-Path (Join-Path $Path "package.json"))) {
    throw "$Name package.json not found at: $Path"
  }
}

Assert-ProjectDir -Path $BackendPath -Name "Backend"
Assert-ProjectDir -Path $FrontendPath -Name "Frontend"

Write-Host "Stopping any existing dev servers on ports $BackendPort and $FrontendPort..."
& (Join-Path $BackendPath "scripts\dev-stop.ps1") -Ports @($BackendPort, $FrontendPort)

Write-Host ""
Write-Host "Starting backend in a new PowerShell window..."
Start-Process -FilePath "powershell.exe" -WorkingDirectory $BackendPath -ArgumentList @(
  "-NoExit",
  "-Command",
  "Write-Host 'Backend: npm run dev' -ForegroundColor Cyan; `$env:PORT=$BackendPort; npm run dev"
)

Write-Host "Starting frontend in a new PowerShell window..."
Start-Process -FilePath "powershell.exe" -WorkingDirectory $FrontendPath -ArgumentList @(
  "-NoExit",
  "-Command",
  "Write-Host 'Frontend: npm run dev' -ForegroundColor Cyan; npm run dev"
)

Write-Host ""
Write-Host "If Tailwind resolution fails again, verify the frontend window shows CWD = $FrontendPath"
Write-Host "Backend:  http://localhost:$BackendPort/health"
Write-Host "Frontend: http://localhost:$FrontendPort/"

