# Mobile combat feedback pilot — 2026-11-20

This change wires the existing `sound("hit")` Web Audio synthesizer to actual combat hit events and adds a short pixel-style cross flash. Both are local implementations; they **do not import the plinkfx or pixelfx npm packages**.

- Sound obeys existing game sound settings, unlock gesture, six-voice limit and 60 ms per-kind cooldown.
- Visuals obey `motionEnabled()`, limit creation when more than eight hit targets are tracked, and destroy their graphics after 110 ms.
- No changes to reward settlement, persisted state, save schema or dependencies.
- Future genuine library integration requires a reproducible npm lockfile update, license review, browser bundle budget, and performance regression testing. Registry access was unavailable in the current execution environment, so dependency installation was not attempted in the repository.

The upstream agent skills for both packages are already installed under `.claude/skills`.
