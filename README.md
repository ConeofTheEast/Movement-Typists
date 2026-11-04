# Kinetic Escape: Planes & Axes (SEHS)

An educational browser game for reteaching **planes and axes of movement**, **joint actions** and **muscle contraction types** (SEHS).

An android with anatomically placed human muscles has to escape a factory. Its muscles swell and glow as they work. At every hazard, time slows to a near-freeze and the student must choose the right movement or contraction before the timer runs out.

## Play

Open `index.html` in a browser. There is no install, no build step and no internet requirement.

To host it for a class, enable **GitHub Pages** on this repo and share the link.

| Level | Plane (= the screen) | Status |
|---|---|---|
| Precision Lab | Frontal · sagittal axis | In design |
| **Factory Escape** | **Sagittal · frontal axis** | **Playable** |
| Drone Defense | Transverse · longitudinal axis | Paused |

Controls:

| Key | Action |
|---|---|
| <kbd>1</kbd>–<kbd>4</kbd> or click | Choose an answer |
| <kbd>P</kbd> | Pause and show the reference table |
| <kbd>L</kbd> | Show muscle labels |
| <kbd>M</kbd> | Sound on/off |
| <kbd>R</kbd> | Reboot after a failure |

## Repo map

| Path | What | Owner agent |
|---|---|---|
| `js/content.js` | All curriculum data and wording: planes, axes, muscles, questions, feedback | sehs-content-specialist |
| `js/android.js` | Muscled android rig, kinematics and muscle rendering | anatomy-animator |
| `js/effects.js` | Particles, screen crack, glitch, synthesised audio | vfx-audio |
| `js/sagittal.js` | Factory Escape level: hazards, outcome animations, rendering | game-engineer + level-designer |
| `js/main.js`, `index.html`, `css/` | Menu, HUD, decision UI, loop | game-engineer |
| `tools/playtest.js` | Automated branch playtest using Playwright | playtest-qa |
| `docs/GAME_DESIGN.md` | Game design, hazard table, Frontal level spec | level-designer |
| `docs/AGENTIC_WORKFLOW.md` | The multi-agent production workflow | Producer |
| `.claude/agents/` | Claude Code subagent definitions for the workflow | n/a |

## Automated playtest

Requires Node and Playwright.

```bash
node tools/playtest.js out gap,laser,crate,drop,zipline correct
```

```bash
node tools/playtest.js out gap plane
```
