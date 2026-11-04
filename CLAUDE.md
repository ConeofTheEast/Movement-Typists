# CLAUDE.md

Educational SEHS game ("Kinetic Escape"). Read `docs/AGENTIC_WORKFLOW.md` before multi-step work. It defines the agent roster (`.claude/agents/`), the pipeline, the teacher gates and the data contracts.

## Ground rules

- **Content accuracy beats everything.** Curriculum wording lives only in `js/content.js`. Plane ↔ axis pairs are sagittal ↔ frontal axis, frontal ↔ sagittal axis, and transverse ↔ longitudinal axis.
- **Transverse level is PAUSED.** Do not build it unless the teacher says so.
- The game must keep running from `file://`. That means no ES modules, no bundler and no external assets. Use plain scripts on the `window.SEHS` namespace.
- Pose angles are in degrees and relative to the parent segment (flexion +, dorsiflexion +). The full convention is in AGENTIC_WORKFLOW §4.3.
- Every hazard needs success, each wrong branch, timeout and checkpoint-reset behaviour.
- Axis names rotate (teacher decision). Never hard-code an axis name in UI text; use `C.axisName(planeId)` or `C.axisAllNames(planeId)`.
- Every game starts with its tutorial (`js/tutorial.js`). New content must also appear in the tutorial and in `review-sheet.html`; both read from `content.js`.
- Sprites are optional skins. Muscles are always drawn in code (see `docs/SPRITE_PROMPTS.md`).

## Verify changes

```bash
node tools/playtest.js out <hazards> <choices>
```

`<hazards>` is a comma-separated list of `gap`, `laser`, `crate`, `drop` and `zipline`. `<choices>` is a comma-separated list of `correct`, `wrong`, `wrong2`, `plane` and `timeout`. The run must print `no errors`. Look at the screenshots it writes.
