# DAY 1 SETUP - SIMPLIFIED VERSION
# This version creates files one at a time to avoid PowerShell parsing issues

Write-Host "🚀 PureTask Day 1 Setup - Starting..." -ForegroundColor Cyan

# Check location
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Not in puretask-frontend directory!" -ForegroundColor Red
    exit
}

# Create folders
Write-Host "📁 Creating folders..." -ForegroundColor Yellow
$folders = @("src/components/ui", "src/components/layout", "src/components/features", "src/lib", "src/types", "src/hooks", "src/api")
foreach ($folder in $folders) {
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
}
Write-Host "✅ Folders created!" -ForegroundColor Green

# Install packages
Write-Host "📦 Installing packages..." -ForegroundColor Yellow
npm install --silent clsx tailwind-merge lucide-react
Write-Host "✅ Packages installed!" -ForegroundColor Green

# Create colors.ts
Write-Host "🎨 Creating design system files..." -ForegroundColor Yellow
$colorsContent = @'
export const colors = {
  primary: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a' },
  success: { 50: '#ecfdf5', 500: '#10b981', 600: '#059669' },
  warning: { 50: '#fffbeb', 500: '#f59e0b', 600: '#d97706' },
  error: { 50: '#fef2f2', 500: '#ef4444', 600: '#dc2626' },
  neutral: { 50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827' },
};
'@
$colorsContent | Out-File -FilePath "src/lib/colors.ts" -Encoding utf8

# Create utils.ts
$utilsContent = @'
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function formatCurrency(amount: number): string { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount); }
export function formatDate(date: Date | string): string { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date)); }
'@
$utilsContent | Out-File -FilePath "src/lib/utils.ts" -Encoding utf8

# Create types
$typesContent = @'
export interface User { id: string; email: string; name: string; role: 'client' | 'cleaner' | 'admin'; avatar?: string; }
'@
$typesContent | Out-File -FilePath "src/types/index.ts" -Encoding utf8

Write-Host "✅ Design system created!" -ForegroundColor Green

Write-Host ""
Write-Host "🎉 Basic setup complete!" -ForegroundColor Green
Write-Host "⚠️  Component files need to be created manually due to complexity" -ForegroundColor Yellow
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "1. I'll guide you through creating each component" -ForegroundColor White
Write-Host "2. Or we can use VS Code to create them" -ForegroundColor White
Write-Host ""

# Fix tsconfig
$tsconfig = Get-Content "tsconfig.json" -Raw | ConvertFrom-Json
if (-not $tsconfig.compilerOptions.paths) {
    $tsconfig.compilerOptions | Add-Member -NotePropertyName "paths" -NotePropertyValue @{"@/*" = @("./src/*")} -Force
    $tsconfig | ConvertTo-Json -Depth 10 | Out-File "tsconfig.json" -Encoding utf8
}

Write-Host "✅ Setup complete! Ready to create components." -ForegroundColor Green

