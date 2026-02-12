# 🎓 **COMPLETE BEGINNER'S GUIDE - DAY 1**

**For absolute beginners who want to understand EVERYTHING**

**Goal:** Set up your frontend project and build your first components  
**Time:** 3-5 hours (with reading and understanding)  
**Level:** Complete beginner friendly 🌱

---

## 📖 **TABLE OF CONTENTS**

1. [What We're Building](#what-were-building)
2. [What You Need Before Starting](#prerequisites)
3. [Understanding the Basics](#understanding-basics)
4. [Step-by-Step Setup](#step-by-step)
5. [Troubleshooting](#troubleshooting)

---

## 🎯 **WHAT WE'RE BUILDING** {#what-were-building}

Imagine your project like a house:

```
🏠 PureTask (Your House)
│
├── 🧱 Backend (Foundation - Already Built!)
│   └── This is your server, database, APIs
│   └── Status: ✅ DONE
│
└── 🪟 Frontend (The Visible Part - We're Building This!)
    └── This is what users see and interact with
    └── Status: ❌ NOT STARTED ← TODAY WE START HERE
```

**Today's Goal:** Set up the frontend so users can see beautiful pages and click buttons!

---

## ✅ **WHAT YOU NEED BEFORE STARTING** {#prerequisites}

### **1. Check if you have Node.js installed**

**What is Node.js?** Think of it as the "engine" that runs JavaScript on your computer.

**How to check:**

```bash
# Open PowerShell or Command Prompt
# Type this and press Enter:
node --version
```

**You should see:** Something like `v18.17.0` or `v20.x.x`

**If you DON'T see a version number:**
1. Go to: https://nodejs.org/
2. Download the "LTS" version (the green button)
3. Install it (click Next, Next, Next...)
4. Close and reopen your terminal
5. Try `node --version` again

---

### **2. Check if you have npm (comes with Node.js)**

**What is npm?** It's like an "app store" for code packages. It lets you download and use code that other people wrote.

```bash
npm --version
```

**You should see:** Something like `9.6.7` or `10.x.x`

**If you see a version, you're good!** ✅

---

### **3. Have a code editor (VS Code recommended)**

**What is VS Code?** It's a fancy notepad for writing code. It helps you by coloring text, finding errors, and suggesting code.

**Do you have it?** Look for a blue icon on your computer that looks like `><`

**If not:**
1. Go to: https://code.visualstudio.com/
2. Download and install
3. Open it

---

## 📚 **UNDERSTANDING THE BASICS** {#understanding-basics}

Before we start, let's understand what we're doing:

### **What is "Frontend"?**

```
Frontend = Everything the user SEES and CLICKS

Examples:
✓ The login page
✓ The buttons you click
✓ The search bar
✓ The cleaner profiles
✓ Everything visual!
```

### **What technologies are we using?**

Let me explain each one in simple terms:

#### **1. React** 🔵
**What it is:** A tool made by Facebook to build user interfaces  
**Why we use it:** Makes building complex pages MUCH easier  
**Think of it like:** Building with LEGO blocks instead of carving wood

#### **2. Next.js** ⬛
**What it is:** A framework built on top of React  
**Why we use it:** Adds superpowers to React (faster, better)  
**Think of it like:** React is a car, Next.js is a sports car

#### **3. TypeScript** 🔷
**What it is:** JavaScript with extra safety features  
**Why we use it:** Catches mistakes BEFORE you run the code  
**Think of it like:** Spell-check for code

#### **4. Tailwind CSS** 🎨
**What it is:** A way to style (color, size, position) your components  
**Why we use it:** Much faster than writing regular CSS  
**Think of it like:** Using Instagram filters instead of Photoshop

---

## 🚀 **STEP-BY-STEP SETUP** {#step-by-step}

### **STEP 1: Open Your Terminal**

**What is a terminal?** A text-based way to give commands to your computer.

**How to open it:**

**On Windows:**
1. Press `Windows Key + R`
2. Type `powershell`
3. Press Enter
4. A blue/black window appears ← This is your terminal!

**Alternative:**
- Press `Windows Key`
- Type "PowerShell"
- Click on "Windows PowerShell"

**You should see something like:**
```
PS C:\Users\onlyw>
```

This `PS C:\Users\onlyw>` is called the "prompt" - it's waiting for your command!

---

### **STEP 2: Navigate to Your Project Folder**

**What does "navigate" mean?** Moving to a different folder using text commands.

**The command:**
```bash
cd C:\Users\onlyw\Documents\GitHub
```

**What this does:**
- `cd` = "Change Directory" (move to a different folder)
- `C:\Users\onlyw\Documents\GitHub` = The folder where your backend is

**Type it and press Enter**

**Your prompt should now say:**
```
PS C:\Users\onlyw\Documents\GitHub>
```

**What if you get an error?**
- Make sure the path exists
- Check for typos
- Try: `cd Documents\GitHub` (if you're already in Users\onlyw)

---

### **STEP 3: Create Your Frontend Project**

**Now for the magic command!** This will create your entire project automatically:

```bash
npx create-next-app@latest puretask-frontend
```

**Wait, what is this command doing?**

Let me break it down:

- `npx` = "Execute a package" (run a tool)
- `create-next-app` = The tool's name (it creates Next.js projects)
- `@latest` = Use the newest version
- `puretask-frontend` = Name of your project folder

**Press Enter!**

---

### **STEP 4: Answer the Setup Questions**

The tool will ask you questions. Here's what to choose:

```
? Would you like to use TypeScript?
→ Type: Yes (or press Y)
→ WHY: TypeScript helps catch errors early

? Would you like to use ESLint?
→ Type: Yes (or press Y)  
→ WHY: ESLint checks your code for common mistakes

? Would you like to use Tailwind CSS?
→ Type: Yes (or press Y)
→ WHY: Makes styling super easy

? Would you like to use `src/` directory?
→ Type: Yes (or press Y)
→ WHY: Keeps your code organized

? Would you like to use App Router?
→ Type: Yes (or press Y)
→ WHY: The new, better way to handle pages

? Would you like to customize the default import alias?
→ Type: No (or press N)
→ WHY: Default settings are fine
```

**What happens next?**
- The tool downloads ~200MB of files (takes 2-5 minutes)
- You'll see lots of text scrolling
- Don't worry! This is normal
- Wait until it says "Success!" or returns to the prompt

**When it's done, you should see:**
```
✔ Created puretask-frontend
✔ Installing packages...
✔ Success!
```

---

### **STEP 5: Enter Your New Project**

**The command:**
```bash
cd puretask-frontend
```

**What this does:**
- Moves you INTO the new project folder
- All your frontend code will live here

**Your prompt should now say:**
```
PS C:\Users\onlyw\Documents\GitHub\puretask-frontend>
```

---

### **STEP 6: Open the Project in VS Code**

**The command:**
```bash
code .
```

**What this does:**
- `code` = Opens VS Code
- `.` = "This folder" (the current folder)

**VS Code should open automatically!**

**What you should see in VS Code:**

```
📁 puretask-frontend/
├── 📁 public/
├── 📁 src/
│   └── 📁 app/
│       ├── favicon.ico
│       ├── globals.css
│       ├── layout.tsx
│       └── page.tsx
├── 📄 .eslintrc.json
├── 📄 .gitignore
├── 📄 next.config.js
├── 📄 package.json
├── 📄 tailwind.config.ts
└── 📄 tsconfig.json
```

**Don't worry if this looks confusing!** Each file has a purpose, and we'll explain as we go.

---

### **STEP 7: Install Additional Tools**

**What are we doing?** Adding more "packages" (tools) that we'll need.

**The command:**
```bash
npm install react-router-dom @tanstack/react-query zustand axios date-fns clsx tailwind-merge
```

**What is each package?**

| Package | What It Does | Why We Need It |
|---------|-------------|----------------|
| `react-router-dom` | Handles navigation between pages | So users can go from login → dashboard → booking |
| `@tanstack/react-query` | Manages API calls | Makes fetching data from backend easier |
| `zustand` | Stores data in memory | Remembers user login, preferences, etc. |
| `axios` | Makes API requests | Talks to your backend |
| `date-fns` | Works with dates | Formats "2026-01-10" to "Jan 10, 2026" |
| `clsx` | Combines CSS classes | Makes styling logic easier |
| `tailwind-merge` | Merges Tailwind classes | Prevents style conflicts |

**Press Enter and wait!**

This will take 1-2 minutes. You'll see:
```
added 234 packages in 1m
```

---

### **STEP 8: Test If Everything Works**

**Let's see if your project runs!**

**The command:**
```bash
npm run dev
```

**What this does:**
- Starts a development server (a mini web server on your computer)
- Compiles your code
- Opens it at http://localhost:3000

**You should see:**
```
- ready started server on 0.0.0.0:3000
- Local:   http://localhost:3000
```

**Now open your web browser (Chrome, Edge, Firefox) and go to:**
```
http://localhost:3000
```

**You should see:** A Next.js welcome page with a dark background!

**If you see this page → SUCCESS! ✅ Your setup works!**

---

### **STEP 9: Stop the Server**

**We need to stop the server to make changes.**

**How to stop it:**
1. Go back to your terminal
2. Press `Ctrl + C` (hold Ctrl, press C)
3. You'll be back at the prompt

**Why stop it?** We need to create new folders and files.

---

### **STEP 10: Create Your Project Structure**

**What are we doing?** Creating folders to organize our code.

**Think of it like organizing a house:**
```
🏠 House (puretask-frontend)
├── 🚪 Living Room (components/)
│   ├── Couch (ui/)
│   ├── TV Stand (layout/)
│   └── Decorations (features/)
├── 🔧 Utility Closet (lib/)
├── 👔 Closet (styles/)
└── 📦 Storage (types/)
```

**The commands:**

```bash
mkdir -p src/components/ui
mkdir -p src/components/layout
mkdir -p src/components/features
mkdir -p src/lib
mkdir -p src/styles
mkdir -p src/types
mkdir -p src/hooks
mkdir -p src/api
```

**What does `mkdir -p` mean?**
- `mkdir` = "Make Directory" (create folder)
- `-p` = "Create parent folders too" (create nested folders)

**On Windows, if `-p` doesn't work, use:**
```bash
mkdir src\components\ui
mkdir src\components\layout
mkdir src\components\features
mkdir src\lib
mkdir src\styles
mkdir src\types
mkdir src\hooks
mkdir src\api
```

**Press Enter after each line!**

**To verify it worked:**
- Look at VS Code
- You should see the new folders in the sidebar

---

### **STEP 11: Create Your Design System**

**What is a "design system"?** A set of rules for colors, sizes, and styles so everything looks consistent.

**Think of it like:** Apple's design - everything looks clean and follows the same style.

---

#### **11a. Create the Colors File**

**In VS Code:**
1. Right-click on `src/lib` folder
2. Click "New File"
3. Name it: `colors.ts`
4. Copy and paste this code:

```typescript
export const colors = {
  // Primary colors (Blue - for buttons, links)
  primary: {
    50: '#eff6ff',   // Lightest blue
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',  // Main blue ← We'll use this most
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',  // Darkest blue
  },
  
  // Success colors (Green - for success messages)
  success: {
    500: '#10b981',
    600: '#059669',
  },
  
  // Warning colors (Yellow - for warnings)
  warning: {
    500: '#f59e0b',
    600: '#d97706',
  },
  
  // Error colors (Red - for errors)
  error: {
    500: '#ef4444',
    600: '#dc2626',
  },
  
  // Neutral colors (Gray - for text, borders)
  neutral: {
    50: '#f9fafb',   // Almost white
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',  // Medium gray
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',  // Almost black
  },
};
```

**What is this file doing?**
- Defining ALL the colors we'll use
- Each color has shades from light (50) to dark (900)
- Now we can use `colors.primary.500` instead of `#3b82f6`

**Save the file:** `Ctrl + S`

---

#### **11b. Create the Utils File**

**Create new file:** `src/lib/utils.ts`

```typescript
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
```

**What is this file doing?**

**1. `cn()` function:**
- Combines CSS classes intelligently
- Prevents conflicts
- Example: `cn('text-blue-500', 'text-red-500')` → Only applies red (the last one)

**2. `formatCurrency()` function:**
- Turns `150` into `$150.00`
- Adds commas: `1000` → `$1,000.00`

**3. `formatDate()` function:**
- Turns `2026-01-10` into `Jan 10, 2026`
- Makes dates readable

**Save the file:** `Ctrl + S`

---

### **STEP 12: Build Your First Component - BUTTON**

**What is a "component"?** A reusable piece of UI, like a LEGO block.

**Why build a Button component?**
- You'll use buttons EVERYWHERE (50+ times!)
- Build once, reuse everywhere
- Change one file → Updates all buttons

---

#### **Create the Button Component**

**Create new file:** `src/components/ui/Button.tsx`

**Copy this code:**

```typescript
import React from 'react';
import { cn } from '@/lib/utils';

// Define what properties the Button can accept
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  isLoading?: boolean;
}

export function Button({
  variant = 'primary',  // Default: blue button
  size = 'md',          // Default: medium size
  children,             // The text inside the button
  className,            // Extra custom styles
  disabled,             // Is button disabled?
  isLoading,            // Is button loading?
  ...props              // Any other HTML button properties
}: ButtonProps) {
  
  // Base styles that ALL buttons have
  const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
  
  // Different button styles (colors)
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 focus-visible:ring-blue-600',
    ghost: 'text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600',
  };
  
  // Different button sizes
  const sizes = {
    sm: 'h-9 px-3 text-sm',      // Small: height 36px
    md: 'h-10 px-4 text-base',   // Medium: height 40px
    lg: 'h-12 px-6 text-lg',     // Large: height 48px
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          {/* Loading spinner */}
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

**Let me explain this code section by section:**

**1. The Interface (ButtonProps):**
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  isLoading?: boolean;
}
```
- This defines what you can pass to the Button
- `variant?` = Button style (the `?` means it's optional)
- `size?` = Button size (optional)
- `children` = The text or content inside
- `isLoading?` = Show a loading spinner? (optional)

**2. The Function:**
```typescript
export function Button({ ... }: ButtonProps) {
```
- `export` = Other files can use this
- `function Button` = The component name
- `{ ... }` = Destructuring the props (taking them apart)

**3. The Styles:**
```typescript
const variants = {
  primary: 'bg-blue-600 text-white ...',
  secondary: 'bg-gray-100 text-gray-900 ...',
  ...
}
```
- Each variant has different Tailwind classes
- `bg-blue-600` = Background blue
- `text-white` = White text
- `hover:bg-blue-700` = Darker on hover

**4. The Return:**
```typescript
return (
  <button className={...} disabled={...}>
    {isLoading ? <spinner /> : children}
  </button>
);
```
- Returns the actual button HTML
- If loading, show spinner
- Otherwise, show the children (button text)

**Save the file:** `Ctrl + S`

---

### **STEP 13: Test Your Button**

**Now let's see your button in action!**

**Open file:** `src/app/page.tsx`

**Delete EVERYTHING in the file and replace with:**

```typescript
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
```

**What is this code doing?**

**1. Import:**
```typescript
import { Button } from '@/components/ui/Button';
```
- Brings in your Button component
- `@/` = Shortcut to `src/` folder

**2. The Component:**
```typescript
export default function Home() {
  return (...)
}
```
- This is the home page component
- Whatever we return shows on the page

**3. The HTML (JSX):**
```typescript
<main className="...">
  <h1>Title</h1>
  <Button>Click me</Button>
</main>
```
- Looks like HTML but it's actually JSX
- Can use our custom Button component!

**Save the file:** `Ctrl + S`

---

### **STEP 14: Start the Server and See Your Buttons!**

**Back in terminal:**

```bash
npm run dev
```

**Open browser:** http://localhost:3000

**YOU SHOULD SEE:**
- A gray background
- A title: "PureTask - Button Test! 🎉"
- Multiple buttons in different colors
- Different sized buttons
- A spinning loading button
- A disabled button (grayed out)

**TRY CLICKING THE BUTTONS!**
- They should change color on hover
- The disabled button shouldn't work
- The loading button shows a spinner

**IF YOU SEE THIS → CONGRATULATIONS! 🎉**

You just built your first React component!

---

### **STEP 15: Understanding What You Built**

Let's review what happened:

```
1. You created a Button.tsx file
   └─ This defines how buttons look and behave

2. You imported it into page.tsx
   └─ This uses the button on a page

3. You used the button multiple times
   └─ <Button variant="primary">Text</Button>
   └─ <Button variant="danger">Delete</Button>

4. Each button is an "instance" of your component
   └─ Same code, different properties
```

**This is the power of components!**
- Write once → Use many times
- Change Button.tsx → ALL buttons update
- Consistent design everywhere

---

## 🎉 **DAY 1 COMPLETE!**

### **What You Learned Today:**

✅ **Set up a complete frontend project**
   - Installed Node.js and npm
   - Created a Next.js project
   - Installed all dependencies

✅ **Understood the tech stack**
   - React (component-based UI)
   - Next.js (React framework)
   - TypeScript (type-safe JavaScript)
   - Tailwind (utility-first CSS)

✅ **Created your first files**
   - colors.ts (design system)
   - utils.ts (helper functions)
   - Button.tsx (reusable component)

✅ **Built and tested your first component**
   - Understood props
   - Used Tailwind for styling
   - Saw it working in the browser!

---

## 📅 **TOMORROW (DAY 2):**

We'll build more components:
1. **Input** - For text fields
2. **Card** - For containers
3. **Badge** - For status labels
4. **Modal** - For pop-ups

Then we'll start building the **Landing Page**!

---

## 🐛 **TROUBLESHOOTING GUIDE** {#troubleshooting}

### **Problem: "node is not recognized"**

**Solution:**
1. Install Node.js from https://nodejs.org/
2. Restart your terminal
3. Try again

---

### **Problem: "npm install" is stuck**

**Solution:**
1. Wait 5 minutes (it can be slow)
2. If still stuck, press `Ctrl + C`
3. Delete `node_modules` folder (if it exists)
4. Run `npm install` again

---

### **Problem: "Cannot find module '@/lib/utils'"**

**Solution:**
This means the path is wrong.

Check your `tsconfig.json` has this:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

### **Problem: "Port 3000 is already in use"**

**Solution:**
1. Press `Ctrl + C` in terminal
2. Or change the port:
```bash
npm run dev -- -p 3001
```
Now use: http://localhost:3001

---

### **Problem: Styles aren't showing**

**Solution:**
1. Make sure `tailwind.config.ts` has this:
```typescript
content: [
  './src/**/*.{js,ts,jsx,tsx,mdx}',
],
```

2. Restart the dev server:
   - Press `Ctrl + C`
   - Run `npm run dev` again

---

### **Problem: VS Code shows red squiggly lines**

**Solution:**
This is usually just TypeScript being helpful!

- Red = Error (needs to be fixed)
- Yellow = Warning (should fix but not urgent)
- Hover over it to read the message

Common fixes:
- Save all files (`Ctrl + S`)
- Restart VS Code
- Check for typos

---

## 💡 **HELPFUL TIPS**

### **Terminal Shortcuts:**

| Shortcut | What It Does |
|----------|-------------|
| `Ctrl + C` | Stop the current command |
| `Ctrl + L` | Clear the terminal screen |
| `↑` (Up Arrow) | Show previous command |
| `Tab` | Auto-complete file names |

---

### **VS Code Shortcuts:**

| Shortcut | What It Does |
|----------|-------------|
| `Ctrl + S` | Save file |
| `Ctrl + P` | Quick file search |
| `Ctrl + B` | Toggle sidebar |
| `Ctrl + `\`` | Open terminal in VS Code |
| `Alt + ↑/↓` | Move line up/down |
| `Ctrl + D` | Select next occurrence |

---

### **Understanding File Extensions:**

| Extension | What It Is |
|-----------|-----------|
| `.ts` | TypeScript file (logic code) |
| `.tsx` | TypeScript + JSX (component with HTML) |
| `.css` | Stylesheet (styles) |
| `.json` | Configuration file (settings) |
| `.md` | Markdown file (documentation) |

---

### **Reading Tailwind Classes:**

Tailwind classes are shortcuts:

| Class | What It Does | CSS Equivalent |
|-------|-------------|----------------|
| `text-blue-500` | Blue text | `color: #3b82f6` |
| `bg-gray-100` | Light gray background | `background: #f3f4f6` |
| `p-4` | Padding 1rem (16px) | `padding: 1rem` |
| `mt-8` | Margin top 2rem (32px) | `margin-top: 2rem` |
| `flex` | Flexbox layout | `display: flex` |
| `rounded-lg` | Large border radius | `border-radius: 0.5rem` |
| `hover:bg-blue-700` | Darker on hover | `:hover { background: #1d4ed8 }` |

**Pattern:**
- `{property}-{color}-{shade}`
- `{property}-{size}`
- `{state}:{property}-{value}`

Examples:
- `text-red-500` → text color, red, medium shade
- `p-4` → padding, 1rem
- `hover:bg-blue-700` → on hover, background blue, dark shade

---

## 📚 **GLOSSARY OF TERMS**

| Term | Simple Explanation |
|------|-------------------|
| **Component** | A reusable piece of UI (like a button, card, input) |
| **Props** | Data you pass into a component |
| **State** | Data that can change (like a counter, form input) |
| **JSX** | HTML-like syntax in JavaScript |
| **Import** | Bringing code from another file |
| **Export** | Making code available to other files |
| **Function** | A reusable block of code |
| **Interface** | TypeScript definition of object shape |
| **npm** | Node Package Manager (installs packages) |
| **Package** | Pre-written code you can use |
| **Terminal** | Text-based command interface |
| **Server** | Program that serves your website |
| **Localhost** | Your own computer as a server |
| **Port** | A number that identifies a running program (3000, 5000) |
| **API** | Way for frontend and backend to communicate |
| **CSS** | Stylesheet language (colors, sizes, positions) |
| **Tailwind** | CSS framework with utility classes |
| **TypeScript** | JavaScript with types |
| **React** | JavaScript library for UIs |
| **Next.js** | React framework |

---

## 🎯 **QUICK COMMANDS REFERENCE**

**Navigate folders:**
```bash
cd folder-name          # Go into folder
cd ..                   # Go up one level
cd C:\Users\...         # Go to specific path
```

**Create things:**
```bash
mkdir folder-name       # Create folder
touch file.txt          # Create file (Mac/Linux)
type nul > file.txt     # Create file (Windows)
```

**NPM commands:**
```bash
npm install package-name  # Install a package
npm run dev              # Start development server
npm run build            # Build for production
```

**VS Code:**
```bash
code .                  # Open current folder in VS Code
code file.txt           # Open specific file
```

---

## ✅ **CHECKLIST**

Before moving to Day 2, make sure:

- [ ] Node.js installed and working (`node --version`)
- [ ] npm installed and working (`npm --version`)
- [ ] VS Code installed
- [ ] Created `puretask-frontend` project
- [ ] All packages installed (no errors)
- [ ] Dev server starts (`npm run dev`)
- [ ] Can see Next.js page at http://localhost:3000
- [ ] Created folder structure
- [ ] Created `colors.ts` file
- [ ] Created `utils.ts` file
- [ ] Created `Button.tsx` component
- [ ] Can see buttons working in browser
- [ ] Understand what you built

**If all checked → You're ready for Day 2! 🚀**

---

## 🎓 **WANT TO LEARN MORE?**

**Free Resources:**

1. **React Official Tutorial**
   - https://react.dev/learn
   - Start with "Thinking in React"

2. **Next.js Documentation**
   - https://nextjs.org/learn
   - Very beginner-friendly

3. **Tailwind CSS Docs**
   - https://tailwindcss.com/docs
   - Great examples and search

4. **TypeScript Basics**
   - https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html

5. **Web Dev Simplified (YouTube)**
   - Search: "Web Dev Simplified React"
   - Great explanations

---

## 💬 **NEED HELP?**

**If you're stuck:**

1. **Read the error message carefully**
   - It usually tells you what's wrong
   - Google the error (copy/paste it)

2. **Check for typos**
   - Missing comma?
   - Wrong spelling?
   - Case sensitivity? (`button` vs `Button`)

3. **Restart things**
   - Terminal: `Ctrl + C`, then `npm run dev` again
   - VS Code: Close and reopen
   - Browser: Hard refresh (`Ctrl + Shift + R`)

4. **Start over (last resort)**
   - Delete the project folder
   - Run the commands again

---

**🎉 GREAT JOB COMPLETING DAY 1! 🎉**

Take a break, celebrate your progress, and come back for Day 2 when you're ready!

**You're officially a frontend developer now!** 👨‍💻👩‍💻

---

*Created: January 2026*  
*For: Complete Beginners*  
*Difficulty: 1/10 (You can do this!)* 💪

