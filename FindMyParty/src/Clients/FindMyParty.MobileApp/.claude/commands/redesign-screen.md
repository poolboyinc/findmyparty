---
description: Redesign a screen following the full FindMyParty workflow
argument-hint: <ScreenName> [+ any cross-screen context]
---

Target: **$ARGUMENTS**

Follow this workflow, waiting for my approval between each phase:

1. **Critique.** Dispatch the `design-reviewer` subagent. Brief it on the target screen, the design system in CLAUDE.md, the theme tokens at `app/theme/index.ts`, the mockups in `/design-refs/`, and any cross-screen context I provided above. Output a structured critique. Do not write code.

2. **Pause.** Show me the critique and wait for me to approve the direction (or redirect it). Surface any open questions before moving on.

3. **Build.** Dispatch the `screen-builder` subagent. Brief it on the approved direction, the theme path (`app/theme/index.ts`), existing similar screens for pattern consistency, and any cross-screen wiring needed (e.g. entry-point gestures, navigation routes). It should plan first, wait for approval, then implement. Run `npx tsc --noEmit` after.

4. **Animate.** Dispatch the `animation-specialist` subagent. Brief it on what the new screen does and the moments that need motion or haptics. It should propose in human terms, get approval, then implement with Reanimated 3.

5. **Review.** Dispatch the `code-reviewer` subagent on the full diff before commit. Use its output as the final gate.

Throughout: never commit. Never touch the backend. Stay on the current feature branch.
