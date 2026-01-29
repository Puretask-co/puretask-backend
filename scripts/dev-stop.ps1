param(
  [int[]]$Ports = @(4000, 3001)
)

$ErrorActionPreference = "SilentlyContinue"

function Stop-PortProcess([int]$Port) {
  $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
  if (-not $conns) {
    Write-Host ("Port {0}: not in use" -f $Port)
    return
  }

  $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($pid in $pids) {
    if (-not $pid) { continue }
    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($proc) {
      Write-Host "Stopping PID $pid ($($proc.ProcessName)) holding port $Port..."
      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
  }
}

foreach ($p in $Ports) {
  Stop-PortProcess -Port $p
}

Write-Host "Done."

