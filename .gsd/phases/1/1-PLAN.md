---
phase: 1
plan: 1
wave: 1
---

# Plan 1.1: Expo Project Initialization & Dependencies

## Objective
Initialize the React Native Expo project with all required dependencies (expo-sqlite, expo-router, navigation libraries) and establish the project structure with folder conventions.

## Context
- .gsd/SPEC.md
- .gsd/DECISIONS.md

## Tasks

<task type="auto">
  <name>Initialize Expo project</name>
  <files>
    package.json
    app.json
    tsconfig.json
  </files>
  <action>
    1. Run `npx -y create-expo-app@latest ./ --template tabs` to create an Expo project with tab navigation template
       - If the directory is not empty, use `--yes` flag or clear non-GSD files first
    2. Update `app.json` with:
       - name: "ChitFund Manager"
       - slug: "chitfund-manager"
       - scheme: "chitfund"
    3. Ensure TypeScript is configured (Expo tabs template includes it)
  </action>
  <verify>
    npx expo doctor
    - Verify package.json exists with expo dependencies
    - Verify app.json has correct app name
  </verify>
  <done>
    - Expo project is initialized and runnable
    - app.json shows "ChitFund Manager" as the app name
  </done>
</task>

<task type="auto">
  <name>Install required dependencies</name>
  <files>package.json</files>
  <action>
    Install the following dependencies:
    1. `npx expo install expo-sqlite` — Local SQLite database
    2. `npx expo install expo-file-system` — File system access (for potential exports later)
    3. `npm install date-fns` — Date formatting utilities
    4. `npm install zustand` — Lightweight state management
    
    Do NOT install:
    - expo-router (already included in tabs template)
    - react-navigation (expo-router handles this)
  </action>
  <verify>
    node -e "const pkg = require('./package.json'); const deps = {...pkg.dependencies, ...pkg.devDependencies}; console.log('expo-sqlite:', !!deps['expo-sqlite']); console.log('zustand:', !!deps['zustand']); console.log('date-fns:', !!deps['date-fns']);"
  </verify>
  <done>
    - expo-sqlite, zustand, date-fns are in package.json dependencies
    - No unnecessary packages installed
  </done>
</task>

## Success Criteria
- [ ] `npx expo doctor` passes without errors
- [ ] All required dependencies are installed
- [ ] Project runs successfully with `npx expo start`
