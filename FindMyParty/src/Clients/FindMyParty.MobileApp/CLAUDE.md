# FindMyParty - React Native iOS App

## Mission
Build a premium iOS-native party discovery app that feels like it could be made by Apple. Every decision should pass the test: "Would this ship in a top-100 App Store app?"

## Stack
- React Native (Expo SDK 51+)
- iOS-first (Android secondary, lower priority)
- Mapbox for maps (token security critical — never commit tokens)
- .NET backend on Railway (DO NOT modify backend code unless explicitly asked)
- TypeScript strict mode

## Design System
- Theme file: `app/theme/index.ts` is the single source of truth
- All colors, spacing, typography, radii MUST come from theme tokens — no hardcoded values
- Reference: Apple HIG (the hig-* skills installed in ~/.claude/skills/)
- Brand: dark-mode-first, near-black backgrounds, purple #9D6BFF as accent, gradient (purple→pink→orange) reserved ONLY for the FindMyParty logo and rare hero moments

## Design Principles
1. Less is more — when in doubt, remove
2. One primary action per screen, never two competing CTAs
3. iOS-native patterns over custom inventions
4. Smooth animations (150-300ms, Easing.out, spring for physical feel)
5. Haptic feedback on every meaningful interaction
6. Full-bleed content, floating chrome with glass/blur

## Component Library
- All reusable components live in `src/components/`
- Every component must have: TypeScript props interface, default values, variants via prop unions (not inheritance), Storybook-style examples in comments
- Buttons: Primary (gradient), Secondary (purple solid), Tertiary (ghost/text)
- Use `expo-haptics` for haptic feedback
- Use `react-native-reanimated` v3 for animations (no Animated API)
- Use `expo-blur` for glass effects
- Use `@gorhom/bottom-sheet` for any bottom sheet patterns

## Code Quality
- No `any` types
- No inline styles for anything reused — extract to StyleSheet or theme
- Functional components with hooks only, no class components
- Co-locate component, styles, and types in the same file unless component > 300 lines
- After any change, verify TypeScript compiles with `npx tsc --noEmit`

## Storage Conventions
- All AsyncStorage keys MUST be namespaced with `@findmyparty/*` to avoid collisions
  with other apps and to make grep-driven audits trivial.
- Define keys as named exports in a constants file (see `constants/cities.ts`), never
  inline at the call site.

## Workflow Rules
- ALWAYS work on a feature branch, never directly on main
- Before any code change, show a plan and wait for approval
- After implementing, run TypeScript check and report results
- For UI changes, describe what the user will see different
- Never commit to git unless explicitly told to commit

## Reference Designs
The mockups in `/design-refs/` are the visual target. They were created by a designer and represent the agreed-upon direction. Deviate only with explicit reason.

## What to NEVER do
- Touch the .NET backend
- Add new dependencies without discussing first
- Use the legacy Animated API (use Reanimated 3)
- Hardcode colors, sizes, or spacing
- Create generic "AI-looking" designs (purple gradients everywhere, Inter font, centered cards)
- Implement features I didn't ask for