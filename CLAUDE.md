# CLAUDE.md

Educational SEHS game ("Kinetic Escape"). Read `docs/AGENTIC_WORKFLOW.md` before multi-step work. It defines the agent roster (`.claude/agents/`), the pipeline, the teacher gates and the data contracts.

## Ground rules

- **Content accuracy beats everything.** Curriculum wording lives only in `js/content.js`. Plane ↔ axis pairs are sagittal ↔ frontal axis, frontal ↔ sagittal axis, and transverse ↔ longitudinal axis.
- **Transverse level is PAUSED.** Do not build it unless the teacher says so.
- The game must keep running from `file://`. That means no ES modules, no bundler and no external assets. Use plain scripts on the `window.SEHS` namespace.
- Pose angles are in degrees and relative to the parent segment (flexion +, dorsiflexion +). The full convention is in AGENTIC_WORKFLOW §4.3.
- Every hazard needs success, each wrong branch, timeout and checkpoint-reset behaviour.

## Verify changes

```bash
node tools/playtest.js out <hazards> <choices>
```

`<hazards>` is a comma-separated list of `gap`, `laser`, `crate`, `drop` and `zipline`. `<choices>` is a comma-separated list of `correct`, `wrong`, `wrong2`, `plane` and `timeout`. The run must print `no errors`. Look at the screenshots it writes.
