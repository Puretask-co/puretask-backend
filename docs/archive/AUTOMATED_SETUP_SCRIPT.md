# 🚀 **AUTOMATED SETUP SCRIPT FOR PURETASK FRONTEND**

**This script does EVERYTHING from Day 1 automatically!**

---

## 📋 **WHAT THIS SCRIPT DOES:**

1. ✅ Creates all folder structure
2. ✅ Creates all files (colors.ts, utils.ts, Button.tsx, page.tsx)
3. ✅ Installs all packages
4. ✅ Fixes tsconfig.json
5. ✅ Starts the dev server

**Time:** 2-3 minutes instead of 1-2 hours!

---

## 🎯 **HOW TO USE:**

### **STEP 1: Copy this ENTIRE script**

```powershell
# PureTask Frontend - Automated Setup Script
Write-Host "🚀 Starting PureTask Frontend Setup..." -ForegroundColor Cyan

# Create folder structure
Write-Host "`n📁 Creating folder structure..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "src/components/ui" | Out-Null
New-Item -ItemType Directory -Force -Path "src/components/layout" | Out-Null
New-Item -ItemType Directory -Force -Path "src/components/features" | Out-Null
New-Item -ItemType Directory -Force -Path "src/lib" | Out-Null
New-Item -ItemType Directory -Force -Path "src/styles" | Out-Null
New-Item -ItemType Directory -Force -Path "src/types" | Out-Null
New-Item -ItemType Directory -Force -Path "src/hooks" | Out-Null
New-Item -ItemType Directory -Force -Path "src/api" | Out-Null
Write-Host "✅ Folders created!" -ForegroundColor Green

# Create colors.ts
Write-Host "`n🎨 Creating colors.ts..." -ForegroundColor Yellow
@"
export const colors = {
  // Primary colors (Blue - for buttons, links)
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',  // Main blue
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  
  // Success colors (Green)
  success: {
    500: '#10b981',
    600: '#059669',
  },
  
  // Warning colors (Yellow)
  warning: {
    500: '#f59e0b',
    600: '#d97706',
  },
  
  // Error colors (Red)
  error: {
    500: '#ef4444',
    600: '#dc2626',
  },
  
  // Neutral colors (Gray)
  neutral: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
};
"@ | Out-File -FilePath "src/lib/colors.ts" -Encoding utf8
Write-Host "✅ colors.ts created!" -ForegroundColor Green

# Create utils.ts
Write-Host "`n🔧 Creating utils.ts..." -ForegroundColor Yellow
@"
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Function to combine CSS classes smartly
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Function to format money
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// Function to format dates
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}
"@ | Out-File -FilePath "src/lib/utils.ts" -Encoding utf8
Write-Host "✅ utils.ts created!" -ForegroundColor Green

# Create Button.tsx
Write-Host "`n🔘 Creating Button.tsx..." -ForegroundColor Yellow
@"
import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  isLoading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className,
  disabled,
  isLoading,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
  
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 focus-visible:ring-blue-600',
    ghost: 'text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600',
  };
  
  const sizes = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-10 px-4 text-base',
    lg: 'h-12 px-6 text-lg',
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
}
"@ | Out-File -FilePath "src/components/ui/Button.tsx" -Encoding utf8
Write-Host "✅ Button.tsx created!" -ForegroundColor Green

# Create page.tsx
Write-Host "`n📄 Creating page.tsx..." -ForegroundColor Yellow
@"
import { Button } from '@/components/ui/Button';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 gap-4 bg-gray-50">
      <h1 className="text-4xl font-bold mb-8 text-gray-900">
        PureTask - Button Test! 🎉
      </h1>
      
      <div className="flex flex-col gap-4 w-full max-w-md">
        <Button variant="primary">Primary Button</Button>
        <Button variant="secondary">Secondary Button</Button>
        <Button variant="outline">Outline Button</Button>
        <Button variant="ghost">Ghost Button</Button>
        <Button variant="danger">Danger Button</Button>
        
        <div className="flex gap-4 justify-center">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
        
        <Button isLoading>Loading State</Button>
        <Button disabled>Disabled Button</Button>
      </div>
    </main>
  );
}
"@ | Out-File -FilePath "src/app/page.tsx" -Encoding utf8
Write-Host "✅ page.tsx created!" -ForegroundColor Green

# Fix tsconfig.json to ensure @/ alias works
Write-Host "`n⚙️ Fixing tsconfig.json..." -ForegroundColor Yellow
$tsconfigPath = "tsconfig.json"
if (Test-Path $tsconfigPath) {
    $tsconfig = Get-Content $tsconfigPath -Raw | ConvertFrom-Json
    if (-not $tsconfig.compilerOptions.baseUrl) {
        $tsconfig.compilerOptions | Add-Member -NotePropertyName "baseUrl" -NotePropertyValue "." -Force
    }
    if (-not $tsconfig.compilerOptions.paths) {
        $tsconfig.compilerOptions | Add-Member -NotePropertyName "paths" -NotePropertyValue @{"@/*" = @("./src/*")} -Force
    }
    $tsconfig | ConvertTo-Json -Depth 10 | Out-File -FilePath $tsconfigPath -Encoding utf8
    Write-Host "✅ tsconfig.json updated!" -ForegroundColor Green
}

# Install packages
Write-Host "`n📦 Installing packages (this takes 1-2 minutes)..." -ForegroundColor Yellow
npm install clsx tailwind-merge --silent
Write-Host "✅ Packages installed!" -ForegroundColor Green

Write-Host "`n✨ Setup complete! Starting dev server..." -ForegroundColor Cyan
Write-Host "`n🌐 Open your browser to: http://localhost:3000" -ForegroundColor Green
Write-Host "`n⏹️  Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start dev server
npm run dev
```

---

### **STEP 2: Open Terminal in VS Code**

Press: **Ctrl + `** (backtick)

---

### **STEP 3: Make Sure You're in the Right Folder**

In the terminal, check if you see:
```
PS C:\Users\onlyw\Documents\GitHub\puretask-frontend>
```

**If NOT, run this first:**
```powershell
cd C:\Users\onlyw\Documents\GitHub\puretask-frontend
```

---

### **STEP 4: Paste the Entire Script**

1. **Copy the ENTIRE script above** (from `# PureTask Frontend...` to `npm run dev`)
2. **Right-click in the terminal** and click **Paste**
3. **Press Enter**
4. **Wait 2-3 minutes**

---

## 🎉 **WHAT WILL HAPPEN:**

You'll see:
```
🚀 Starting PureTask Frontend Setup...
📁 Creating folder structure...
✅ Folders created!
🎨 Creating colors.ts...
✅ colors.ts created!
🔧 Creating utils.ts...
✅ utils.ts created!
🔘 Creating Button.tsx...
✅ Button.tsx created!
📄 Creating page.tsx...
✅ page.tsx created!
⚙️ Fixing tsconfig.json...
✅ tsconfig.json updated!
📦 Installing packages...
✅ Packages installed!
✨ Setup complete! Starting dev server...
🌐 Open your browser to: http://localhost:3000
```

---

## 🌐 **OPEN YOUR BROWSER:**

Go to: **http://localhost:3000**

**You should see all your beautiful buttons!** 🎊

---

## 💡 **BENEFITS:**

- ⚡ Takes 2-3 minutes instead of hours
- ✅ No typing errors
- ✅ Everything configured correctly
- ✅ All files created automatically
- ✅ Server starts automatically

---

**Ready to try it? Just copy the script and paste it in your terminal!** 🚀

