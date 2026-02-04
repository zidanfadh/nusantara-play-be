# FRONTEND.md

## Nusantara Play — Frontend Style & Layout Guide

Dokumen ini adalah **panduan styling dan layouting** untuk pengembangan **Frontend Nusantara Play** — platform arsip nasional permainan rakyat Indonesia.

---

## 1. Tentang Proyek

**Nusantara Play** adalah platform digital pelestarian budaya permainan rakyat Indonesia.

### Target Pengguna

| Role               | Deskripsi               | Akses                          |
| ------------------ | ----------------------- | ------------------------------ |
| **Publik**         | Masyarakat umum         | Read-only (lihat arsip, event) |
| **Kurator Daerah** | Perwakilan KPOTI Daerah | Input & edit data budaya       |
| **Pakar**          | Ahli budaya/sejarah     | Verifikasi konten              |
| **Admin KPOTI**    | Pengelola pusat         | Full access, publish nasional  |

---

## 2. Tech Stack

```
Framework     : Next.js 14+ (App Router)
Language      : TypeScript
Styling       : Tailwind CSS
UI Components : shadcn/ui
Icons         : Lucide React
Fonts         : Plus Jakarta Sans, Inter
```

---

## 3. Filosofi Desain

> **"Modern Nusantara"** — Desain kontemporer dengan jiwa budaya Indonesia.

### Prinsip Utama

| Prinsip                | Deskripsi                                     |
| ---------------------- | --------------------------------------------- |
| **Cultural-first**     | Visual terinspirasi kekayaan budaya Nusantara |
| **Clean & Accessible** | UI bersih, mudah digunakan semua kalangan     |
| **Warm & Inviting**    | Warna hangat yang ramah dan mengundang        |
| **Professional Trust** | Tampilan kredibel untuk data resmi pemerintah |

### Mood & Feel

- Hangat seperti **tanah Nusantara**
- Elegan dengan sentuhan **emas tradisional**
- Modern tapi tetap **berkarakter lokal**
- Bersih, tidak ramai, **fokus pada konten**

---

## 4. Color System

### 4.1 Tailwind Config

```javascript
// tailwind.config.ts
const config = {
  theme: {
    extend: {
      colors: {
        // Primary - Amber/Emas Tradisional
        primary: {
          50: '#FFF8F0',
          100: '#FFECD9',
          200: '#FFD4B3',
          300: '#FFBC8C',
          400: '#FFA366',
          500: '#D97706', // Main
          600: '#B45309',
          700: '#92400E',
          800: '#78350F',
          900: '#5C2D0E',
        },
        // Secondary - Hijau Alam
        secondary: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#059669', // Main
          600: '#047857',
          700: '#065F46',
          800: '#064E3B',
          900: '#053D31',
        },
        // Neutral - Stone (Hangat)
        neutral: {
          50: '#FAFAF9',
          100: '#F5F5F4',
          200: '#E7E5E4',
          300: '#D6D3D1',
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#44403C',
          800: '#292524',
          900: '#1C1917',
        },
        // Accent
        accent: {
          gold: '#F59E0B',
          terracotta: '#C2410C',
          red: '#DC2626',
        },
        // Semantic
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
      },
    },
  },
};
```

### 4.2 Penggunaan Warna

| Elemen           | Warna           | Tailwind Class         |
| ---------------- | --------------- | ---------------------- |
| Background utama | Cream/Off-white | `bg-neutral-50`        |
| Background card  | Putih           | `bg-white`             |
| Primary button   | Amber           | `bg-primary-500`       |
| Primary hover    | Amber gelap     | `hover:bg-primary-600` |
| Secondary button | Stone           | `bg-neutral-200`       |
| Text heading     | Coklat tua      | `text-neutral-900`     |
| Text body        | Abu hangat      | `text-neutral-700`     |
| Text muted       | Abu medium      | `text-neutral-500`     |
| Border default   | Stone border    | `border-neutral-200`   |
| Success state    | Hijau           | `text-success`         |
| Error state      | Merah           | `text-error`           |
| Link             | Primary         | `text-primary-600`     |

---

## 5. Typography

### 5.1 Font Families

```css
/* globals.css */
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');

:root {
  --font-heading: 'Plus Jakarta Sans', sans-serif;
  --font-body: 'Inter', sans-serif;
}
```

### 5.2 Tailwind Font Config

```javascript
// tailwind.config.ts
fontFamily: {
  heading: ['Plus Jakarta Sans', 'sans-serif'],
  body: ['Inter', 'sans-serif'],
}
```

### 5.3 Typography Scale

| Element    | Size | Weight   | Font    | Tailwind Class                        |
| ---------- | ---- | -------- | ------- | ------------------------------------- |
| H1         | 36px | Bold     | Heading | `text-4xl font-bold font-heading`     |
| H2         | 30px | Semibold | Heading | `text-3xl font-semibold font-heading` |
| H3         | 24px | Semibold | Heading | `text-2xl font-semibold font-heading` |
| H4         | 20px | Medium   | Heading | `text-xl font-medium font-heading`    |
| Body Large | 18px | Normal   | Body    | `text-lg font-body`                   |
| Body       | 16px | Normal   | Body    | `text-base font-body`                 |
| Body Small | 14px | Normal   | Body    | `text-sm font-body`                   |
| Caption    | 12px | Normal   | Body    | `text-xs font-body`                   |
| Button     | 14px | Medium   | Body    | `text-sm font-medium font-body`       |

---

## 6. Spacing & Sizing

### 6.1 Border Radius

| Variant | Value  | Tailwind       | Penggunaan          |
| ------- | ------ | -------------- | ------------------- |
| Small   | 6px    | `rounded-md`   | Badge, tag, chip    |
| Medium  | 8px    | `rounded-lg`   | Button, input       |
| Large   | 12px   | `rounded-xl`   | Card, modal         |
| XLarge  | 16px   | `rounded-2xl`  | Container besar     |
| Full    | 9999px | `rounded-full` | Avatar, icon button |

### 6.2 Shadows

```javascript
// tailwind.config.ts
boxShadow: {
  'soft-sm': '0 1px 2px rgba(41, 37, 36, 0.05)',
  'soft-md': '0 4px 6px rgba(41, 37, 36, 0.07)',
  'soft-lg': '0 10px 15px rgba(41, 37, 36, 0.1)',
  'soft-xl': '0 20px 25px rgba(41, 37, 36, 0.12)',
}
```

| Variant | Tailwind Class   | Penggunaan           |
| ------- | ---------------- | -------------------- |
| Soft SM | `shadow-soft-sm` | Hover state ringan   |
| Soft MD | `shadow-soft-md` | Card default         |
| Soft LG | `shadow-soft-lg` | Card hover, dropdown |
| Soft XL | `shadow-soft-xl` | Modal, dialog        |

### 6.3 Standard Spacing

| Size | Value | Tailwind | Penggunaan        |
| ---- | ----- | -------- | ----------------- |
| XS   | 4px   | `p-1`    | Padding icon      |
| SM   | 8px   | `p-2`    | Gap kecil         |
| MD   | 16px  | `p-4`    | Padding default   |
| LG   | 24px  | `p-6`    | Padding card      |
| XL   | 32px  | `p-8`    | Padding section   |
| 2XL  | 48px  | `p-12`   | Padding container |

---

## 7. Component Styling

### 7.1 Buttons

```tsx
// Primary Button
<button className="
  bg-primary-500
  hover:bg-primary-600
  active:bg-primary-700
  text-white
  font-medium
  text-sm
  px-4 py-2.5
  rounded-lg
  transition-colors
  shadow-soft-sm
  hover:shadow-soft-md
">
  Primary Action
</button>

// Secondary Button
<button className="
  bg-neutral-100
  hover:bg-neutral-200
  text-neutral-700
  font-medium
  text-sm
  px-4 py-2.5
  rounded-lg
  transition-colors
">
  Secondary
</button>

// Outline Button
<button className="
  border border-neutral-300
  hover:border-neutral-400
  hover:bg-neutral-50
  text-neutral-700
  font-medium
  text-sm
  px-4 py-2.5
  rounded-lg
  transition-colors
">
  Outline
</button>

// Ghost Button
<button className="
  hover:bg-neutral-100
  text-neutral-600
  font-medium
  text-sm
  px-4 py-2.5
  rounded-lg
  transition-colors
">
  Ghost
</button>
```

### 7.2 Input Fields

```tsx
// Default Input
<input className="
  w-full
  px-4 py-2.5
  bg-white
  border border-neutral-300
  rounded-lg
  text-neutral-900
  placeholder:text-neutral-400
  focus:outline-none
  focus:ring-2
  focus:ring-primary-500/20
  focus:border-primary-500
  transition-all
"/>

// Input with Error
<input className="
  ...
  border-error
  focus:ring-error/20
  focus:border-error
"/>
```

### 7.3 Cards

```tsx
// Default Card
<div className="
  bg-white
  rounded-xl
  border border-neutral-200
  shadow-soft-md
  p-6
">
  {/* Content */}
</div>

// Interactive Card (Hover)
<div className="
  bg-white
  rounded-xl
  border border-neutral-200
  shadow-soft-sm
  hover:shadow-soft-lg
  hover:border-neutral-300
  p-6
  transition-all
  cursor-pointer
">
  {/* Content */}
</div>
```

### 7.4 Badge / Tag

```tsx
// Status Badge
<span
  className="
  inline-flex items-center
  px-2.5 py-0.5
  rounded-full
  text-xs font-medium
  bg-success/10 text-success     // Success
  bg-warning/10 text-warning     // Warning  
  bg-error/10 text-error         // Error
  bg-primary-100 text-primary-700  // Primary
"
>
  Status
</span>
```

---

## 8. Layout Patterns

### 8.1 Page Container

```tsx
// Max width container dengan padding
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{/* Content */}</div>
```

### 8.2 Auth Layout (Centered)

```tsx
<div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
  <div className="w-full max-w-md">
    <div className="bg-white rounded-2xl shadow-soft-lg p-8">
      {/* Auth Form */}
    </div>
  </div>
</div>
```

### 8.3 Dashboard Layout (Sidebar)

```tsx
<div className="min-h-screen bg-neutral-50">
  {/* Top Header */}
  <header
    className="
    fixed top-0 left-0 right-0 
    h-16 
    bg-white 
    border-b border-neutral-200
    z-50
  "
  >
    {/* Header content */}
  </header>

  {/* Sidebar */}
  <aside
    className="
    fixed left-0 top-16 bottom-0 
    w-64 
    bg-white 
    border-r border-neutral-200
    overflow-y-auto
  "
  >
    {/* Sidebar navigation */}
  </aside>

  {/* Main Content */}
  <main
    className="
    ml-64 
    pt-16 
    min-h-screen
    p-6
  "
  >
    {/* Page content */}
  </main>
</div>
```

### 8.4 Grid Layouts

```tsx
// Stats Grid (4 columns)
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Stat Cards */}
</div>

// Two Column Layout
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Content */}
</div>

// Sidebar + Content (3:9)
<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
  <div className="lg:col-span-3">{/* Sidebar */}</div>
  <div className="lg:col-span-9">{/* Main */}</div>
</div>
```

---

## 9. Sidebar Navigation Style

```tsx
// Sidebar Container
<nav className="p-4 space-y-1">
  {/* Nav Item - Default */}
  <a
    className="
    flex items-center gap-3
    px-3 py-2.5
    rounded-lg
    text-neutral-600
    hover:bg-neutral-100
    hover:text-neutral-900
    transition-colors
  "
  >
    <Icon className="w-5 h-5" />
    <span className="font-medium text-sm">Menu Item</span>
  </a>

  {/* Nav Item - Active */}
  <a
    className="
    flex items-center gap-3
    px-3 py-2.5
    rounded-lg
    bg-primary-50
    text-primary-700
  "
  >
    <Icon className="w-5 h-5" />
    <span className="font-medium text-sm">Active Item</span>
  </a>
</nav>
```

---

## 10. Header Style

```tsx
<header
  className="
  h-16 
  bg-white 
  border-b border-neutral-200
  px-6
  flex items-center justify-between
"
>
  {/* Logo */}
  <div className="flex items-center gap-3">
    <img src="/logo.svg" className="h-8 w-8" />
    <span className="font-heading font-bold text-xl text-neutral-900">
      Nusantara Play
    </span>
  </div>

  {/* Right Side */}
  <div className="flex items-center gap-4">
    {/* Notification */}
    <button
      className="
      p-2 
      rounded-lg 
      hover:bg-neutral-100
      text-neutral-500
    "
    >
      <Bell className="w-5 h-5" />
    </button>

    {/* User Menu */}
    <div className="flex items-center gap-3">
      <img src="/avatar.jpg" className="w-8 h-8 rounded-full object-cover" />
      <span className="text-sm font-medium text-neutral-700">Nama User</span>
    </div>
  </div>
</header>
```

---

## 11. Responsive Breakpoints

| Breakpoint | Min Width | Tailwind Prefix | Target Device    |
| ---------- | --------- | --------------- | ---------------- |
| Default    | 0px       | -               | Mobile           |
| sm         | 640px     | `sm:`           | Mobile landscape |
| md         | 768px     | `md:`           | Tablet           |
| lg         | 1024px    | `lg:`           | Desktop          |
| xl         | 1280px    | `xl:`           | Large desktop    |
| 2xl        | 1536px    | `2xl:`          | Extra large      |

### Mobile Considerations

- Sidebar collapse to hamburger menu on `< lg`
- Touch-friendly buttons min height 44px
- Stack grids vertically on mobile
- Full-width cards on mobile

---

## 12. Animation & Transitions

```javascript
// tailwind.config.ts
transitionDuration: {
  DEFAULT: '150ms',
  fast: '100ms',
  normal: '200ms',
  slow: '300ms',
}
```

### Common Transitions

```tsx
// Color transition
className = 'transition-colors duration-150';

// All properties
className = 'transition-all duration-200';

// Transform + opacity (for modals)
className = 'transition-all duration-300 ease-out';
```

---

## 13. Visual Accents (Opsional)

### Decorative Elements

- **Subtle batik pattern** sebagai background hero section
- **Ornamental divider** dengan motif tenun
- **Icon set** bergaya budaya Indonesia
- **Ilustrasi** permainan tradisional

### Background Patterns

```css
/* Pattern overlay halus */
.pattern-batik {
  background-image: url('/patterns/batik-subtle.svg');
  background-repeat: repeat;
  opacity: 0.03;
}
```

---

## 14. Dark Mode (Future)

Siapkan struktur untuk dark mode:

```javascript
// tailwind.config.ts
darkMode: 'class',
```

Gunakan semantic class yang mudah di-swap:

- `bg-white dark:bg-neutral-900`
- `text-neutral-900 dark:text-neutral-100`
- `border-neutral-200 dark:border-neutral-700`

---

## 15. CSS Variables Reference

```css
/* globals.css */
:root {
  /* Colors */
  --color-primary: #d97706;
  --color-secondary: #059669;
  --color-background: #fafaf9;
  --color-foreground: #1c1917;
  --color-muted: #78716c;
  --color-border: #e7e5e4;

  /* Typography */
  --font-heading: 'Plus Jakarta Sans', sans-serif;
  --font-body: 'Inter', sans-serif;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
}
```

---

## 16. Checklist Implementasi

- [ ] Setup Tailwind dengan konfigurasi custom
- [ ] Import Google Fonts (Plus Jakarta Sans, Inter)
- [ ] Konfigurasi shadcn/ui dengan theme colors
- [ ] Buat base layout components (Header, Sidebar)
- [ ] Buat Auth layout (centered)
- [ ] Buat Dashboard layout (sidebar)
- [ ] Style semua base components (Button, Input, Card)
- [ ] Test responsive di semua breakpoints

---

_End of document._
