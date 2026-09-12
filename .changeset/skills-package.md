---
"@vaam-apps/ui": patch
---

Adds `skills/vaam-ui/`, installable with `npx skills add vaam-apps/ui`, so an agent integrating this package into another repository gets the setup steps whose failures are silent, the status system, a component index and the pitfalls. Gated by `src/lib/skill.test.ts`, which fails if the skill names an export the package no longer has.
