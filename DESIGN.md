---
name: MetricYak
description: Friendly, precise metrics observability and monitoring for engineers and business teams alike.
colors:
  yak-orange: "#d9591a"
  yak-yellow: "#f4c842"
  yak-cream: "#f2ead6"
  neutral-bg: "#ffffff"
  neutral-surface: "#f5f4f0"
  neutral-sidebar: "#e4e2dc"
  neutral-border: "#d4d0c8"
  neutral-muted: "#8c8880"
  neutral-secondary: "#635f58"
  neutral-text: "#1a1917"
  neutral-dark-bg: "#1a1917"
  neutral-dark-surface: "#252320"
  neutral-dark-border: "#3e3b36"
  ink: "#0f0e0d"
  destructive: "#dc2626"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "normal"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.625rem"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "normal"
rounded:
  lg: "0.625rem"
  md: "0.5rem"
  sm: "0.375rem"
spacing:
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  8: "2rem"
  14: "3.5rem"
components:
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.md}"
    padding: "0.5rem"
  nav-item-active:
    backgroundColor: "#d9591a26"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.md}"
    padding: "0.5rem"
  settings-input:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
  button-raised:
    backgroundColor: "{colors.yak-orange}"
    textColor: "{colors.neutral-surface}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-raised-hover:
    backgroundColor: "{colors.yak-orange}"
    textColor: "{colors.neutral-surface}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
---

# Design System: MetricYak

## 1. Overview

**Creative North Star: "The Friendly Instrument"**

MetricYak's interface is a well-calibrated tool you actually enjoy picking up. Like a good instrument — a quality scale, a precision gauge, a reliable meter — it's honest about what it is, quick to respond, and quietly satisfying to use. The personality isn't layered on top of the function; it's baked into the craft: the warmth in the orange, the give in the rounded corners, the tactile press of a raised button.

The surface serves the data. Metric values, event streams, monitor states — these are the signal, and the UI's job is to get out of the way. Quirk and warmth live in the margins: a clever label when a list is empty, a loading state with personality, the physical satisfaction of a cartoony button press. On the metric canvas itself, the rule is restraint.

Both a product manager setting up their first metric and an engineer validating event throughput should feel immediately at home on the same screen. Progressive disclosure bridges the gap — complexity available on demand, not announced in advance. This is not Datadog's wall of configuration panels or Grafana's "every feature exposed at once" philosophy. It is not a soft collaboration tool with pastels and team-first vibes. It is a precise instrument with a friendly face.

**Key Characteristics:**
- Single saturated accent (Yak Orange) kept deliberately rare against warm neutral surfaces
- Cartoony raised interaction style on controls — tactile, physical, memorable
- System font at a fixed readable scale — no display pairing, no fluid sizing
- Flat by default; tonal sidebar layer creates depth without shadows
- Motion serves state only: panel slide, accordion reveal, nav highlight spring, button press
- Personality lives in the margins: empty states, microcopy, transitions

## 2. Colors: The Warm Signal Palette

One saturated voice against a near-achromatic warm neutral ramp. The orange marks the thing that matters; the rest of the palette recedes and lets the data speak.

### Primary
- **Yak Orange** (`#d9591a`): The brand's one saturated voice. Used on the active nav highlight (15% opacity fill + full-strength border), primary action buttons, search input focus rings, and the `--ring` indicator. Appears on ≤10% of any screen surface. Its rarity is what makes it signal.
- **Yak Yellow** (`#f4c842`): Secondary brand color. Reserved for warnings, data callouts, or accent moments where orange would conflict with action semantics.
- **Yak Cream** (`#f2ead6`): Tertiary warm tone. Available for tinted surfaces, onboarding backdrops, or empty-state backgrounds where warmth without weight is needed.

### Neutral
- **Near-White** (`#fafaf8`): Primary foreground on dark surfaces and on orange (`--primary-foreground`).
- **Off-White** (`#f5f4f0`): Default light-mode background approximation.
- **Warm Smoke** (`#edecea`): Secondary surface, muted base, `--muted` and `--secondary` token.
- **Sidebar Ash** (`#e4e2dc`): Light-mode sidebar and panel background — the tonal depth layer that separates navigation from content.
- **Cool Stone** (`#d4d0c8`): Default border and input stroke (`--border`, `--input`).
- **Quiet Gray** (`#8c8880`): Muted foreground — placeholder text, supporting icons, captions.
- **Dusk** (`#635f58`): Secondary foreground — labels, timestamps, secondary text.
- **Dark Tobacco** (`#3e3b36`): Dark-mode border and divider.
- **Near-Black Surface** (`#252320`): Dark-mode secondary surface and sidebar.
- **Near-Black** (`#1a1917`): Primary body text in light mode; primary background in dark mode.
- **Ink** (`#0f0e0d`): Deepest neutral. The raised interaction border and shadow color — the black bottom of every pressed control.
- **Destructive** (`#dc2626`): Error states and destructive actions. `#ef4444` in dark mode.

### Named Rules
**The One Voice Rule.** Yak Orange appears on ≤10% of any given screen. It marks the active item, the primary action, the focus ring. Used more broadly, it becomes noise.

**The Tonal Layer Rule.** Sidebar Ash (light) and Near-Black Surface (dark) are the only depth mechanism at rest. No shadows on flat surfaces — only on transient overlays.

**The Ink Rule.** Ink (`#0f0e0d`) is reserved for the raised interaction shadow. It should not appear as a UI color elsewhere, which keeps the pressed-control effect feeling distinct and physical.

## 3. Typography

**UI Font:** `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` — the system stack throughout.

**Character:** One family, two weights. The system stack earns its place on product surfaces: crisp at small sizes, immediately familiar in a tool context, leaves the visual personality to color and interaction rather than typeface. No display font — at product scale, editorial presence competes with data legibility.

### Hierarchy
- **Display** (600 weight, 1.5rem / 24px, line-height 1.3): Page-level headings, one per view. Current use: settings page title.
- **Title** (600 weight, 0.875rem / 14px, line-height 1.5): Panel headers, section labels, sidebar group headings.
- **Body** (400 weight, 0.875rem / 14px, line-height 1.5): Nav labels, list items, settings items, form text. Cap prose at 65–75ch (`max-w-2xl`).
- **Label** (400 weight, 0.625rem / 10px, line-height 1.25): Collapsed sidebar icon labels only — tight, centered beneath icons.

### Named Rules
**The Fixed Scale Rule.** No `clamp()` sizing on product UI. Fixed rem values throughout.

**The One-Weight-per-Role Rule.** Each typographic role has one weight. Use label hierarchy or color for emphasis — not mid-paragraph bold.

## 4. Elevation

Flat by default. Depth comes from **tonal layering** — sidebar surfaces one step away from the content surface — not from shadows.

The two exceptions: the floating submenu panel lifts with `shadow-xl` to signal it's a transient overlay. Raised controls use a bottom `box-shadow` in Ink to simulate physical depth (see Components).

### Shadow Vocabulary
- **Overlay** (`shadow-xl` / `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)`): Floating submenu panels. Signals "this is above the layout."
- **Raised control default** (`0 4px 0 0 #0f0e0d`): The black bottom of a `.raised` button or input at rest.
- **Raised control hover** (`0 6px 0 0 #0f0e0d`): Lifts 2px, shadow deepens 2px.
- **Raised control active** (`none`): Shadow collapses; control presses down 4px.

### Named Rules
**The Flat-First Rule.** Flat surfaces stay flat. If you're reaching for a shadow on a card or section, use a tonal background shift instead. The only structural shadows are on overlays and raised controls.

## 5. Components

### Raised Controls (`.raised` class)

The signature interaction pattern. Add the `raised` class to any button or interactive form control to opt into the cartoony pressed effect. It is deliberately opt-in — not every control gets this treatment.

- **Default:** `border: 1.5px solid #0f0e0d`, `box-shadow: 0 4px 0 0 #0f0e0d`, `translateY(0)`. The Ink border wraps the full control; the bottom shadow creates the raised edge.
- **Hover:** `box-shadow: 0 6px 0 0 #0f0e0d`, `translateY(-2px)`. Lifts 2px; shadow deepens 2px to maintain visual ground contact.
- **Active/pressed:** `box-shadow: none`, `translateY(4px)`. Presses down the full raise height; shadow disappears as the control meets the floor.
- **Disabled:** `opacity: 0.5`, `box-shadow: 0 2px 0 0 #0f0e0d`. Shallower raise signals inactivity.
- **Transition:** `transform 100ms ease, box-shadow 100ms ease`. Fast enough to feel responsive; slow enough to be visible.
- **Reduced motion:** Transform locked at zero; shadow stays at rest depth. The visual state still changes; only the animation is removed.
- **Override:** Set `--raised-color` on the element to change the border/shadow tone (e.g. a ghost variant with a lighter border).

### Navigation Rail
A resizable vertical rail (default 256px, collapsible to 64px) with Sidebar Ash background.

- **Shape:** `rounded-md` (8px) on each nav item
- **Default:** `bg-transparent`, `px-2 py-2`, 14px body text, icon + label + chevron
- **Hover:** `bg-sidebar-accent` (Cool Stone in light, Dark Tobacco in dark)
- **Active:** Shared spring-animated highlight (`layoutId="nav-highlight"`) — `bg-yak-orange/15` fill + `border-yak-orange` border. Spring: bounce 0.4, visualDuration 0.4. `font-medium` on label.
- **Collapsed (64px):** Icon in a 36px square, 10px label below. Spring highlight wraps icon square.

### Settings Accordion Panel
A secondary resizable panel (default 224px) that docks or floats.

- **Header:** 56px fixed height, semibold title, pin toggle, border-bottom
- **Search input:** Transparent fill, Cool Stone border, `rounded-md`, `pl-8` inset Search icon; focus border shifts to Yak Orange — no shadow, color swap only
- **Accordion trigger:** `rounded-md px-3 py-2`, ChevronRight rotates 90° on expand
- **Item links:** `rounded-md px-3 py-2`, `hover:bg-sidebar-accent`, active: `bg-sidebar-accent font-medium`
- **Reveal:** height `0 → auto` + opacity `0 → 1`, 0.18s easeOut

### Inputs / Fields
- **Style:** Transparent or white fill, Cool Stone border, `rounded-md` (8px)
- **Focus:** Border shifts to Yak Orange — clean color swap, no glow
- **Placeholder:** Quiet Gray (`#8c8880`) — must meet 4.5:1 contrast
- **Raised variant:** Apply `.raised` for inputs that should feel tactile (e.g. a prominent search bar or metric name field)

### Motion Vocabulary
- **Panel slide** (x: `-100% → 0`, opacity `0 → 1`, 0.18s easeOut): Floating submenu entry/exit
- **Accordion reveal** (height `0 → auto`, opacity `0 → 1`, 0.18s easeOut)
- **Nav highlight** (layoutId spring, bounce 0.4, visualDuration 0.4): The only spring in the system — the highlight physically follows the cursor, justifying the bounce
- **Button press** (translateY + box-shadow, 100ms ease): Physical press feedback on `.raised` controls
- **Reduced motion:** All position/height transitions collapse to instant; opacity crossfades remain; `.raised` transform locked

## 6. Do's and Don'ts

### Do:
- **Do** keep Yak Orange on ≤10% of any screen surface — it marks what matters.
- **Do** use `.raised` on primary action buttons and prominent form controls for tactile character. It is an opt-in, not the default for every element.
- **Do** use tonal backgrounds (Sidebar Ash / Near-Black Surface) for spatial depth. Shadows are for overlays and raised controls only.
- **Do** let personality show in empty states, loading copy, and microcopy. The metric canvas stays clean.
- **Do** use `rounded-md` (8px) consistently across all interactive controls. Consistency is a virtue on product surfaces.
- **Do** animate state, not decoration — panel slides, accordion reveals, nav highlight, button press. If the animation doesn't communicate something, cut it.
- **Do** give every interactive component default, hover, focus, active, and disabled states before shipping.
- **Do** use skeleton loaders for async content, not spinners in the middle of content areas.
- **Do** cap prose and settings content at `max-w-2xl` (65–75ch).

### Don't:
- **Don't** make it feel like Datadog or Splunk — dense enterprise dashboards, aggressive blue/purple, wall-to-wall charts, configuration-first onboarding.
- **Don't** make it feel like a generic SaaS tool (Notion, Monday.com) — soft pastels, friendly illustrations on every screen, collaboration energy that undermines the seriousness of the data.
- **Don't** make it feel like Grafana OSS — every feature exposed at once, low polish, assembled rather than designed.
- **Don't** make it feel like a corporate BI tool (Tableau, Power BI) — heavy, formal, built for quarterly presentations rather than daily monitoring.
- **Don't** apply `.raised` to every control — it loses impact when overused. Nav items, accordion triggers, and sidebar list items should stay flat.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent on list items or cards. Use background tints or full borders.
- **Don't** use gradient text (`background-clip: text`). Emphasis goes through weight or size.
- **Don't** use display or editorial fonts for UI labels, button text, or data values. System sans only.
- **Don't** add decorative motion. Every animation must communicate a state change.
- **Don't** reach for a modal as the first answer to any UX problem. Exhaust inline and progressive disclosure alternatives first.
- **Don't** crowd the metric canvas. If an element doesn't help the user understand their data faster, it competes with data and loses.
