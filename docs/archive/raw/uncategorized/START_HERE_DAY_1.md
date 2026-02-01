# 🎯 **START HERE - DAY 1 SETUP GUIDE**

**Goal:** Get your development environment ready and build your first component

**Time:** 2-4 hours

---

## ✅ **STEP 1: SETUP YOUR FRONTEND PROJECT (20 minutes)**

### **Open a new terminal and run:**

```bash
# Navigate to your project directory
cd C:\Users\onlyw\Documents\GitHub

# Create the frontend project
npx create-next-app@latest puretask-frontend

# When prompted, choose:
✔ Would you like to use TypeScript? → Yes
✔ Would you like to use ESLint? → Yes
✔ Would you like to use Tailwind CSS? → Yes
✔ Would you like to use `src/` directory? → Yes
✔ Would you like to use App Router? → Yes
✔ Would you like to customize the default import alias? → No

# Navigate into the project
cd puretask-frontend

# Install additional dependencies
npm install react-router-dom @tanstack/react-query zustand axios date-fns
npm install -D @types/node

# Start the dev server to test
npm run dev
```

**Open browser:** http://localhost:3000 (should see Next.js welcome page)

**✅ If you see the Next.js page, setup is complete!**

---

## ✅ **STEP 2: CREATE PROJECT STRUCTURE (10 minutes)**

### **Stop the dev server (Ctrl+C) and run:**

```bash
# Create folder structure
mkdir -p src/components/ui
mkdir -p src/components/layout
mkdir -p src/components/features
mkdir -p src/lib
mkdir -p src/styles
mkdir -p src/types
mkdir -p src/hooks
mkdir -p src/api
```

### **Your structure should look like:**
```
puretask-frontend/
├── src/
│   ├── app/                 # Next.js pages (already exists)
│   ├── components/
│   │   ├── ui/             # Button, Input, Card, etc.
│   │   ├── layout/         # Header, Footer, Container
│   │   └── features/       # CleanerCard, BookingCard, etc.
│   ├── lib/                # Utility functions
│   ├── styles/             # Global styles
│   ├── types/              # TypeScript types
│   ├── hooks/              # Custom React hooks
│   └── api/                # API client functions
├── public/                 # Images, fonts
└── package.json
```

---

## ✅ **STEP 3: CREATE DESIGN SYSTEM (15 minutes)**

### **Create: `src/lib/colors.ts`**

```typescript
export const colors = {
  // Primary colors
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
  
  // Success (green)
  success: {
    500: '#10b981',
    600: '#059669',
  },
  
  // Warning (yellow)
  warning: {
    500: '#f59e0b',
    600: '#d97706',
  },
  
  // Error (red)
  error: {
    500: '#ef4444',
    600: '#dc2626',
  },
  
  // Neutral (gray)
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

export type ColorShade = keyof typeof colors.primary;
export type ColorName = keyof typeof colors;
```

### **Create: `src/lib/utils.ts`**

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility to merge Tailwind classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// Format date
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}
```

### **Install clsx and tailwind-merge:**

```bash
npm install clsx tailwind-merge
```

---

## ✅ **STEP 4: BUILD YOUR FIRST COMPONENT - BUTTON (30 minutes)**

### **Create: `src/components/ui/Button.tsx`**

```typescript
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
```

---

## ✅ **STEP 5: TEST YOUR BUTTON (15 minutes)**

### **Update: `src/app/page.tsx`**

Replace the entire content with:

```typescript
import { Button } from '@/components/ui/Button';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 gap-4">
      <h1 className="text-4xl font-bold mb-8">PureTask - Button Test</h1>
      
      <div className="flex flex-col gap-4 w-full max-w-md">
        <Button variant="primary">Primary Button</Button>
        <Button variant="secondary">Secondary Button</Button>
        <Button variant="outline">Outline Button</Button>
        <Button variant="ghost">Ghost Button</Button>
        <Button variant="danger">Danger Button</Button>
        
        <div className="flex gap-4">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
        
        <Button isLoading>Loading Button</Button>
        <Button disabled>Disabled Button</Button>
      </div>
    </main>
  );
}
```

### **Start the dev server:**

```bash
npm run dev
```

### **Open browser:** http://localhost:3000

**✅ You should see all your button variants!**

---

## ✅ **STEP 6: BUILD MORE CORE COMPONENTS (1-2 hours)**

Now build these essential components following the same pattern:

### **1. Input Component**

**Create: `src/components/ui/Input.tsx`**

```typescript
import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        className={cn(
          'flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm',
          'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-red-500 focus:ring-red-500',
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
```

### **2. Card Component**

**Create: `src/components/ui/Card.tsx`**

```typescript
import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 bg-white shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 p-6', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className, ...props }: CardProps) {
  return (
    <h3
      className={cn('text-2xl font-semibold leading-none tracking-tight', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ children, className, ...props }: CardProps) {
  return (
    <p className={cn('text-sm text-gray-500', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ children, className, ...props }: CardProps) {
  return (
    <div className={cn('p-6 pt-0', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className, ...props }: CardProps) {
  return (
    <div className={cn('flex items-center p-6 pt-0', className)} {...props}>
      {children}
    </div>
  );
}
```

### **3. Badge Component**

**Create: `src/components/ui/Badge.tsx`**

```typescript
import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  children: React.ReactNode;
}

export function Badge({ variant = 'default', children, className, ...props }: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
```

### **Test all components:**

Update `src/app/page.tsx`:

```typescript
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 gap-8">
      <h1 className="text-4xl font-bold mb-8">PureTask - Component Library</h1>
      
      {/* Buttons */}
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
          <CardDescription>All button variants</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="danger">Danger</Button>
        </CardContent>
      </Card>

      {/* Inputs */}
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Inputs</CardTitle>
          <CardDescription>Form inputs</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Input label="Email" type="email" placeholder="Enter your email" />
          <Input label="Password" type="password" placeholder="Enter your password" />
          <Input label="With Error" error="This field is required" />
        </CardContent>
      </Card>

      {/* Badges */}
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Badges</CardTitle>
          <CardDescription>Status indicators</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="default">Default</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="info">Info</Badge>
        </CardContent>
      </Card>
    </main>
  );
}
```

**✅ You should now see all components working!**

---

## ✅ **STEP 7: SET UP API CONNECTION (30 minutes)**

### **Create: `src/lib/api.ts`**

```typescript
import axios from 'axios';

// API base URL (your backend)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login if unauthorized
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### **Create: `.env.local` in root:**

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## 🎉 **DAY 1 COMPLETE!**

### **What you've accomplished:**

✅ Frontend project set up  
✅ Project structure created  
✅ Design system established  
✅ 4 core components built (Button, Input, Card, Badge)  
✅ API client configured  
✅ Development environment working  

### **You now have:**
- A working Next.js + TypeScript + Tailwind setup
- Reusable UI components
- Design system with colors and utilities
- API connection ready to your backend

---

## 📅 **TOMORROW (DAY 2):**

1. Build remaining UI components:
   - Modal
   - Avatar
   - Rating
   - Dropdown

2. Build layout components:
   - Header
   - Footer
   - Container

3. Start building your first page:
   - Landing page

---

## 📚 **HELPFUL RESOURCES:**

- Next.js Docs: https://nextjs.org/docs
- Tailwind CSS: https://tailwindcss.com/docs
- React TypeScript: https://react-typescript-cheatsheet.netlify.app/

---

## ❓ **NEED HELP?**

If you run into issues:
1. Make sure you're in the right directory
2. Check that all packages installed successfully
3. Verify the dev server is running
4. Check browser console for errors

---

**Ready to continue to Day 2?** 🚀

