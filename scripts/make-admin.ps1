# Make User Admin Script
# Promotes an existing user to admin role
#
# Usage: .\scripts\make-admin.ps1 <email>
# Example: .\scripts\make-admin.ps1 user@example.com

param(
    [Parameter(Mandatory=$true)]
    [string]$Email
)

Write-Host ""
Write-Host "🔐 Promoting User to Admin..." -ForegroundColor Cyan
Write-Host "Email: $Email" -ForegroundColor Yellow
Write-Host ""

# Get DATABASE_URL from .env
$envFile = Get-Content .env -ErrorAction SilentlyContinue
$dbUrl = ($envFile | Select-String "DATABASE_URL" | ForEach-Object { $_.Line.Split('=',2)[1].Trim() })

if (-not $dbUrl) {
    Write-Host "❌ DATABASE_URL not found in .env file!" -ForegroundColor Red
    exit 1
}

# SQL query to promote user to admin
$query = @"
UPDATE users 
SET role = 'admin' 
WHERE email = '$Email'
RETURNING id, email, role, full_name;
"@

Write-Host "Executing SQL query..." -ForegroundColor Gray

# Execute query using psql (if available)
if (Get-Command psql -ErrorAction SilentlyContinue) {
    $result = & psql $dbUrl -c $query -t
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ User promoted to admin successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Updated User:" -ForegroundColor Cyan
        Write-Host $result
        Write-Host ""
        Write-Host "🎉 User can now login as admin!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Failed to promote user. Check if email exists." -ForegroundColor Red
        Write-Host ""
        Write-Host "To check if user exists, run:" -ForegroundColor Yellow
        Write-Host "  psql `$env:DATABASE_URL -c `"SELECT id, email, role FROM users WHERE email = '$Email';`""
    }
} else {
    Write-Host ""
    Write-Host "⚠️  psql not found. Install PostgreSQL client tools or use manual method:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Go to your Neon Console: https://console.neon.tech" -ForegroundColor Cyan
    Write-Host "2. Select your project" -ForegroundColor Cyan
    Write-Host "3. Go to SQL Editor" -ForegroundColor Cyan
    Write-Host "4. Run this query:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host $query -ForegroundColor White
    Write-Host ""
}

