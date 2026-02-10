Write-Host "Creating Day 1 Setup Files..." -ForegroundColor Cyan

# Navigate to puretask-frontend
Set-Location "C:\Users\onlyw\Documents\GitHub\puretask-frontend"

# Check if we're in the right place
if (-not (Test-Path "package.json")) {
    Write-Host "Error: Not in puretask-frontend!" -ForegroundColor Red
    exit
}

# Create folders
Write-Host "Creating folders..."
New-Item -ItemType Directory -Force -Path "src\components\ui" | Out-Null
New-Item -ItemType Directory -Force -Path "src\components\layout" | Out-Null
New-Item -ItemType Directory -Force -Path "src\components\features" | Out-Null
New-Item -ItemType Directory -Force -Path "src\lib" | Out-Null
New-Item -ItemType Directory -Force -Path "src\types" | Out-Null

# Install packages
Write-Host "Installing packages..."
npm install --silent clsx tailwind-merge lucide-react

# Create files using Set-Content to avoid here-string issues
Write-Host "Creating files..."

# Button component
Set-Content -Path "src\components\ui\Button.tsx" -Value "import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  isLoading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', children, className, disabled, isLoading, ...props }: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
  const variants = { primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600', secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500', outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 focus-visible:ring-blue-600', ghost: 'text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-500', danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600' };
  const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-10 px-4 text-base', lg: 'h-12 px-6 text-lg' };
  return (<button className={cn(baseStyles, variants[variant], sizes[size], className)} disabled={disabled || isLoading} {...props}>{isLoading ? (<><svg className=`"mr-2 h-4 w-4 animate-spin`" xmlns=`"http://www.w3.org/2000/svg`" fill=`"none`" viewBox=`"0 0 24 24`"><circle className=`"opacity-25`" cx=`"12`" cy=`"12`" r=`"10`" stroke=`"currentColor`" strokeWidth=`"4`" /><path className=`"opacity-75`" fill=`"currentColor`" d=`"M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z`" /></svg>Loading...</>) : children}</button>);
}"

Write-Host "Button.tsx created"

# Utils
Set-Content -Path "src\lib\utils.ts" -Value "import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function formatCurrency(amount: number): string { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount); }
export function formatDate(date: Date | string): string { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date)); }"

# Colors
Set-Content -Path "src\lib\colors.ts" -Value "export const colors = { primary: { 50: '#eff6ff', 500: '#3b82f6', 600: '#2563eb' }, success: { 500: '#10b981' }, warning: { 500: '#f59e0b' }, error: { 500: '#ef4444' }, neutral: { 50: '#f9fafb', 500: '#6b7280', 900: '#111827' } };"

# Types
Set-Content -Path "src\types\index.ts" -Value "export interface User { id: string; email: string; name: string; role: 'client' | 'cleaner' | 'admin'; avatar?: string; }"

# Simple test page
Set-Content -Path "src\app\page.tsx" -Value "'use client';
import { Button } from '@/components/ui/Button';
export default function Home() {
  return (<main className=`"min-h-screen bg-blue-50 flex items-center justify-center`"><div className=`"text-center`"><h1 className=`"text-4xl font-bold mb-8`">Day 1 Setup Complete!</h1><div className=`"space-y-4`"><Button>Primary Button</Button><Button variant=`"secondary`">Secondary</Button><Button variant=`"outline`">Outline</Button></div></div></main>);
}"

# Fix tsconfig
$tsconfig = Get-Content "tsconfig.json" | ConvertFrom-Json
$tsconfig.compilerOptions | Add-Member -NotePropertyName "paths" -NotePropertyValue @{"@/*" = @("./src/*")} -Force
$tsconfig | ConvertTo-Json -Depth 10 | Set-Content "tsconfig.json"

Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "Run: npm run dev" -ForegroundColor Cyan

