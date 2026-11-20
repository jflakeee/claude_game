# Optional game-dev tool integration (2026-11-20)

Target: claude_game (Phaser 3.80.1, Vite). This integration is editor/agent tooling only; game runtime, npm lockfile, P0 save schema and deployment are unchanged.

## Installed project-local Claude Code skills

| Origin | Location | Purpose |
| --- | --- | --- |
| gamedev-skills/awesome-gamedev-agent-skills | .claude/skills/phaser-core, phaser-arcade-physics | Phaser guidance (verify 3.80.1 differences; upstream primarily targets Phaser 4) |
| achimala/dream-loop | .claude/skills/dream-loop | Screenshot/reference guided visual iteration; requires agent image/vision access |
| maximilianfeix/plinkfx | .claude/skills/plinkfx | SFX design instructions and reference; runtime library not added |
| patch-gg/pixelfx | .claude/skills/pixelfx | Pixel VFX authoring instructions; runtime library not added |

## Already integrated — do not overwrite

- Donchitos/Claude-Code-Game-Studios: .claude/skills, .claude/agents, CLAUDE.md, project.yaml are already part of the repository. Avoid reinstalling the complete template over this game.

## Optional, not installed

- dudwns0921/claude-gamedev-kit: distinct Claude Code plugin with its own CEO, dashboard, hooks and project lifecycle. Installing into the same .claude layout can override the existing CCGS workflow. Install separately only after an explicit migration decision. Upstream: `claude plugin marketplace add dudwns0921/claude-gamedev-kit` then `claude plugin install gamedev-kit@claude-gamedev-kit --scope project`.
- awesome-gamedev-agent-skills router and the full 79-skill catalog are not vendored; only the two Phaser skills are copied, to avoid duplicate command discovery, unrelated engines, and excessive files. Upstream supports `npx skills add gamedev-skills/awesome-gamedev-agent-skills` in a compatible agent environment.

## Runtime integration is a separate task

- plinkfx: `npm i plinkfx` when approved, followed by sound-event mapping and browser audio unlock tests.
- pixelfx: review renderer size/performance and verify Phaser-canvas integration before adding runtime code. Use the project-local skill for prototypes first.
- No third-party install hooks or automatic scripts were executed in this GitHub-only integration.

## Licensing and update notes

- Apache-2.0 for gamedev-skills; MIT for dream-loop and pixelfx. Retain upstream licenses and attribution in any distribution where required.
- plinkfx software and sound licenses require separate review before redistributing runtime assets.
- Skill copies are snapshots from upstream `main` as of 2026-11-20. Inspect upstream changes before updating.

## P0 safety guardrails

Never replace the existing .claude tree or modify master during tool installation. Run P0 safety CI and browser acceptance on the feature branch before any merge. Keep the public GitHub Pages deployment unchanged.
