# DISHCISION Frontend Design System

DISHCISION is designed with a premium, highly interactive aesthetic utilizing **Glassmorphism**, vibrant HSL-tailored color gradients, and dark-mode adaptive layouts.

---

## 🎨 Theme & Colors (HSL Tokens)

The application utilizes dynamic CSS variables defined in [globals.css](file:///Users/pasawee.p/Second%20Brain/1.%20Projects/Restaurant%20Suggestion/dishcision-line-bot/frontend/app/globals.css) mapped to Tailwind configuration. The system supports automatic and user-toggled theme changes.

### ☀️ Light Mode (Soft Cream & Vibrant Coral)
- **Background:** `hsl(30 50% 98%)` — Soft warm cream.
- **Foreground Text:** `hsl(220 15% 20%)` — Dark charcoal/blue-grey.
- **Primary Accent:** `hsl(15 90% 65%)` — Vibrant Coral/Orange.
- **Secondary Color:** `hsl(45 90% 90%)` — Soft Sun Yellow.
- **Decorative Accent:** `hsl(330 80% 65%)` — Playful Pink.
- **Glass Panel Fill:** `rgba(255, 255, 255, 0.65)` with border `rgba(255, 255, 255, 0.4)`.

### 🌙 Dark Mode (Sleek Cyberpunk & Electric Purple)
- **Background:** `hsl(240 10% 3.9%)` — Deep near-black.
- **Foreground Text:** `hsl(0 0% 98%)` — Bright off-white.
- **Primary Accent:** `hsl(263.4 70% 50.4%)` — Electric Purple.
- **Secondary Color:** `hsl(240 3.7% 15.9%)` — Slate Grey.
- **Decorative Accent:** `hsl(190 90% 50%)` — Neon Azure/Cyan.
- **Glass Panel Fill:** `rgba(255, 255, 255, 0.05)` with border `rgba(255, 255, 255, 0.1)`.

---

## 🧪 Typography & Grid
- **Primary Font:** Geist Sans (modern, high-legibility geometric sans-serif).
- **Secondary Font:** Geist Mono (used for codes, metadata, or clean label states).
- **Container Layout:** Centered, constrained layouts (typically `max-w-lg` or `max-w-xl`) perfect for mobile-first views inside the LINE Webview.

---

## 🪄 Core Design Utilities

To maintain visual consistency across all pages, developers must use the following pre-defined CSS utility classes instead of ad-hoc Tailwind overrides:

### 1. Adaptive Glass Panels (`.glass-panel`)
Soft, blurred background cards that adapt to the active theme.
```html
<div className="glass-panel p-6 rounded-3xl">
  <!-- Content -->
</div>
```

### 2. Glass Inputs & Textareas (`.glass-input`)
Subtle glass input fields that shift opacity and acquire the primary brand outline color on focus.
```html
<input className="glass-input w-full p-3 rounded-xl focus:ring-2 focus:ring-primary" />
```

### 3. Glass Action Buttons (`.glass-button`)
A stunning gradient button combining the primary and accent colors, with an organic lift hover effect.
```html
<button className="glass-button w-full py-4 rounded-xl font-bold uppercase tracking-wider">
  Action Text
</button>
```

---

## 📋 Feedback Page Design Integration (`/[meetingId]/feedback`)

To ensure the feedback page looks premium and matches the rest of the application, we apply these styling rules:

1. **Card Frame:** Avoid solid black or dark grey backgrounds. Use the adaptive `.glass-panel` class for the main wrapper. This will automatically morph between soft semi-transparent white in light mode and deep purple-hued transparent dark paneling in dark mode.
2. **Text Hierarchy:**
   - Section indicators should use uppercase tracker styling in the accent color (`text-primary` or custom HSL pink/purple) to draw focus.
   - Question headings should use crisp bold labels (`text-foreground`).
3. **Interactive Elements:**
   - **Option Buttons (Select / Checkbox):** Render as glass-styled options that transition cleanly on selection into a colored border and backdrop state.
   - **Rating Circles (1-5):** Centered floating circle selectors that pop with scale and shadow effects (`shadow-lg shadow-primary/25`) when active.
   - **Inputs & Textareas:** Use `.glass-input` with smooth margins, clear placeholders, and HSL outline focus states.
4. **Action Buttons:** Back, Next, and Submit buttons must use `.glass-button` (for final submits) or glass borders to ensure consistency with standard form actions.
