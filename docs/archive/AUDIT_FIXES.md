# Audit Fixes - Common Issues & Solutions

**Date**: 2025-01-27  
**Status**: 🔧 **FIXES READY TO APPLY**

---

## 🔍 **ACCESSIBILITY ISSUES & FIXES**

### **1. Missing ARIA Labels**

**Issue**: Buttons and icons without accessible labels

**Fix**: Add `aria-label` to all icon-only buttons

```tsx
// Before
<Button onClick={handleClick}>
  <X className="h-4 w-4" />
</Button>

// After
<Button onClick={handleClick} aria-label="Close">
  <X className="h-4 w-4" />
</Button>
```

**Files to update**:
- All components with icon-only buttons
- Header navigation
- Notification bell
- Close buttons

---

### **2. Color Contrast**

**Issue**: Text may not meet WCAG AA contrast ratios

**Fix**: Ensure minimum 4.5:1 contrast for normal text, 3:1 for large text

```tsx
// Check contrast ratios
// Use tools like WebAIM Contrast Checker
// Update Tailwind colors if needed
```

**Files to check**:
- All text components
- Button variants
- Badge components
- Card components

---

### **3. Missing Alt Text**

**Issue**: Images without descriptive alt text

**Fix**: Add meaningful alt text to all images

```tsx
// Before
<img src={imageUrl} />

// After
<img src={imageUrl} alt="Cleaner profile photo" />
```

**Files to update**:
- Cleaner profile images
- Avatar components
- Gallery components
- Booking photos

---

### **4. Keyboard Navigation**

**Issue**: Some interactive elements not keyboard accessible

**Fix**: Ensure all interactive elements are keyboard accessible

```tsx
// Add keyboard handlers
<div
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
  tabIndex={0}
  role="button"
>
```

**Files to update**:
- Clickable cards
- Dropdown menus
- Modal triggers

---

### **5. Focus Management**

**Issue**: Focus not properly managed in modals and dropdowns

**Fix**: Implement focus trapping and restoration

```tsx
// Use focus trap library or implement manually
import { useEffect, useRef } from 'react';

function Modal({ isOpen, onClose, children }) {
  const modalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const firstFocusable = modalRef.current.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (firstFocusable as HTMLElement)?.focus();
    }
  }, [isOpen]);
  
  // ... rest of component
}
```

**Files to update**:
- Modal components
- Dropdown components
- Dialog components

---

## ⚡ **PERFORMANCE ISSUES & FIXES**

### **1. Large Bundle Size**

**Issue**: JavaScript bundle too large

**Fix**: Code splitting and lazy loading

```tsx
// Lazy load heavy components
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(() => import('@/components/ui/Charts'), {
  loading: () => <Skeleton />,
  ssr: false,
});
```

**Files to update**:
- Chart components
- Map components
- Admin dashboard
- Analytics pages

---

### **2. Unoptimized Images**

**Issue**: Images not using Next.js Image component

**Fix**: Replace all `<img>` with Next.js `<Image>`

```tsx
// Before
<img src={imageUrl} alt="..." />

// After
import Image from 'next/image';

<Image
  src={imageUrl}
  alt="..."
  width={400}
  height={300}
  loading="lazy"
/>
```

**Files to update**:
- All image components
- Avatar components
- Gallery components
- Profile images

---

### **3. Missing Lazy Loading**

**Issue**: Components loaded even when not visible

**Fix**: Implement lazy loading for below-fold content

```tsx
// Use Intersection Observer
import { useEffect, useRef, useState } from 'react';

function LazyComponent({ children }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    if (ref.current) {
      observer.observe(ref.current);
    }
    
    return () => observer.disconnect();
  }, []);
  
  return <div ref={ref}>{isVisible && children}</div>;
}
```

**Files to update**:
- Long lists
- Charts
- Images below fold

---

### **4. Missing Caching Headers**

**Issue**: Static assets not cached

**Fix**: Add caching headers in Next.js config

```tsx
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};
```

---

### **5. Slow API Calls**

**Issue**: API calls not optimized

**Fix**: Implement request deduplication and caching

```tsx
// Use React Query's built-in caching
const { data } = useQuery({
  queryKey: ['key'],
  queryFn: fetchData,
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
});
```

---

## 🔧 **AUTOMATED FIXES**

### **Script to Add ARIA Labels**

```bash
# Find all icon-only buttons
grep -r "<Button.*><.*Icon" src/

# Add aria-label manually or use codemod
```

### **Script to Check Contrast**

```bash
# Use axe DevTools or Lighthouse
npm run audit:a11y
```

### **Script to Optimize Images**

```bash
# Use next/image optimizer
# Already built into Next.js
```

---

## 📋 **CHECKLIST**

### **Accessibility**
- [ ] Add ARIA labels to all icon buttons
- [ ] Check color contrast ratios
- [ ] Add alt text to all images
- [ ] Test keyboard navigation
- [ ] Implement focus management
- [ ] Test with screen readers

### **Performance**
- [ ] Lazy load heavy components
- [ ] Replace <img> with Next.js Image
- [ ] Implement code splitting
- [ ] Add caching headers
- [ ] Optimize API calls
- [ ] Run Lighthouse audit

---

**Status**: Ready to apply fixes systematically.
