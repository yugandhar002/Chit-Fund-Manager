---
phase: 1
plan: 3
wave: 2
---

# Plan 1.3: Navigation Shell & App Theme

## Objective
Set up the app's navigation structure using expo-router tab layout and establish the design system (colors, typography, spacing) that will be used throughout the app. Create a basic tab navigator with placeholder screens.

## Context
- .gsd/SPEC.md
- .gsd/ROADMAP.md
- app.json
- src/database/index.ts (from Plan 1.2)

## Tasks

<task type="auto">
  <name>Create design system and navigation shell</name>
  <files>
    src/constants/theme.ts
    src/constants/colors.ts
    app/(tabs)/_layout.tsx
    app/(tabs)/index.tsx
    app/(tabs)/members.tsx
    app/(tabs)/auction.tsx
    app/(tabs)/payments.tsx
    app/_layout.tsx
    app/+not-found.tsx
  </files>
  <action>
    **1. Create design system (`src/constants/theme.ts` and `colors.ts`):**
    
    Color palette — Premium dark theme with gold accent (fits the "money/finance" domain):
    - Primary: Deep navy blue (#0A1628)
    - Secondary: Rich gold (#D4A844)
    - Accent: Warm amber (#F5A623)
    - Surface: Dark slate (#1A2332)
    - Card: Elevated dark (#1E2D3D)
    - Success: Emerald (#10B981)
    - Warning: Amber (#F59E0B)
    - Error: Rose (#EF4444)
    - Text Primary: White (#FFFFFF)
    - Text Secondary: Muted (#94A3B8)
    - Border: Subtle (#2A3A4A)
    
    Typography: Use system fonts (no external fonts for now)
    Spacing: 4, 8, 12, 16, 20, 24, 32, 40, 48
    Border radius: 8, 12, 16

    **2. Set up tab navigation with 4 tabs:**
    - 🏠 Home (Dashboard) — `app/(tabs)/index.tsx`
    - 👥 Members — `app/(tabs)/members.tsx`
    - 🏆 Auction — `app/(tabs)/auction.tsx`
    - 💰 Payments — `app/(tabs)/payments.tsx`

    **3. Create placeholder screens** for each tab showing:
    - Screen title
    - "Coming in Phase X" message
    - Use the design system colors

    **4. Root layout (`app/_layout.tsx`):**
    - Initialize SQLite database on app start
    - Provide database context to all screens
    - Set status bar style to light (dark theme)
    - Apply dark theme to navigation

    IMPORTANT:
    - Use expo-router's file-based routing
    - Apply the dark premium theme to the tab bar
    - Tab bar should have glass-morphism effect (semi-transparent with blur)
    - Use meaningful tab icons from @expo/vector-icons
  </action>
  <verify>
    npx expo start --no-dev --minify
    - App launches without crash
    - 4 tabs visible in bottom navigation
    - Dark theme applied consistently
    - Database initializes on launch
  </verify>
  <done>
    - 4-tab navigation working (Home, Members, Auction, Payments)
    - Premium dark theme with gold accent applied
    - Tab bar has polished, modern appearance
    - Database initializes on app start
    - All placeholder screens render correctly
  </done>
</task>

<task type="auto">
  <name>Create reusable UI components</name>
  <files>
    src/components/ui/Card.tsx
    src/components/ui/Button.tsx
    src/components/ui/Badge.tsx
    src/components/ui/StatCard.tsx
    src/components/ui/EmptyState.tsx
    src/components/ui/index.ts
  </files>
  <action>
    Create foundational UI components that will be reused across all screens:

    **Card.tsx** — Elevated card container with dark theme
    - Props: children, style, onPress (optional)
    - Subtle border, rounded corners, shadow

    **Button.tsx** — Primary action button
    - Props: title, onPress, variant (primary/secondary/danger), disabled, loading
    - Primary uses gold gradient
    - Proper touch feedback

    **Badge.tsx** — Status badge
    - Props: label, variant (success/warning/error/info)
    - Small pill-shaped badge with colored background

    **StatCard.tsx** — Statistic display card
    - Props: label, value, icon, trend (optional)
    - Used on dashboard for key metrics (total collected, pending, etc.)

    **EmptyState.tsx** — Empty state placeholder
    - Props: icon, title, message, actionLabel, onAction
    - Shown when no data exists (no members yet, no auctions yet)

    All components must:
    - Use theme colors from constants/theme.ts
    - Support the dark theme
    - Have proper TypeScript props interfaces
    - Include micro-animations (fade in, scale on press)
  </action>
  <verify>
    - All 5 component files exist
    - index.ts re-exports all components
    - TypeScript compiles without errors
  </verify>
  <done>
    - 5 reusable UI components created
    - All use design system tokens (no hard-coded colors)
    - Components are properly typed with TypeScript
    - Ready for use in Phase 2-5 screens
  </done>
</task>

## Success Criteria
- [ ] App launches with 4-tab navigation on dark theme
- [ ] Tab bar is polished with proper icons and styling
- [ ] Database initializes automatically on first launch
- [ ] 5 reusable UI components created and exported
- [ ] Design system established with consistent color/spacing tokens
