---
description: Redesign a screen following the full FindMyParty workflow
argument-hint: <ScreenName>
---

I want to redesign the **$1** screen.

Please follow this workflow:

1. First, use the `design-reviewer` subagent to critique the current implementation. Output a structured critique.

2. Pause and let me approve the direction.

3. Then use the `screen-builder` subagent to implement the redesigned screen, following our design system in CLAUDE.md and referencing the mockups in /design-refs/.

4. After the screen builds successfully, use the `animation-specialist` subagent to add appropriate animations, transitions, and haptics.

5. Finally, use the `code-reviewer` subagent to review the full diff before I commit.

Wait for my approval between each phase.