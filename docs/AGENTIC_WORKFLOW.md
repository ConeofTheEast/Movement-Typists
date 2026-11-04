# Agentic Workflow: SEHS Educational Game Studio

A plan for building **Kinetic Escape** and later SEHS games with a small team of specialised AI agents. A teacher stays the final authority on content.

The agents are defined as Claude Code subagents in [`.claude/agents/`](../.claude/agents). Any Claude Code session opened in this repo can call them by name, for example *"use the anatomy-animator agent to audit the gastrocnemius attachment"*.

---

## 1. Design principles

1. **Content is data; the engine is generic.** All curriculum wording, planes and axes, muscles and question text live in `js/content.js`. Muscle geometry lives in `js/android.js`, and hazard scripts live in level files. Agents edit only the layer they own, so they can work in parallel without conflicts.
2. **The camera is the plane.** Each level's camera looks straight down the axis of the plane it teaches:
   - sagittal level: side view
   - frontal level: front or back view
   - transverse level: top-down

   The plane being practised is always the plane of the screen, and its axis always points out of the screen. Every level design should keep this.
3. **Wrong answers act out the mistake.** The android does exactly what the student chose. Flexion makes it tuck, and a frontal-plane movement makes it twist out of the screen and malfunction. Every failure ends with a written explanation and the correct answer.
4. **Accuracy is checked before fun.** No feature merges until the content and anatomy audits pass. A cool animation of the wrong muscle teaches the wrong thing.
5. **The teacher signs off twice.** Gate A approves the question bank. Gate B is a teacher playtest. Agents never ship content past a gate on their own.

---

## 2. Agent roster

| Agent | Owns | Main inputs | Main outputs | Done when |
|---|---|---|---|---|
| **Producer** (the main session) | Plan, task routing, gates, git | Teacher request, this doc | Task breakdown, integration, commits/PRs | Every gate passed, branch pushed |
| **sehs-content-specialist** | `js/content.js` | Syllabus refs, teacher notes | Planes/axes/movement tables, question bank, success & failure explanations | Every question has one defensible correct answer; terms match the class textbook |
| **anatomy-animator** | `js/android.js`, pose library in level files | Muscle list, movement list | Origins/insertions, joint conventions, poses, muscle activation scripts (C/E/I per phase) | Anatomy audit checklist (section 6) passes |
| **level-designer** | Hazard specs and pacing in `docs/GAME_DESIGN.md`, course builder | Question bank, poses | Hazard table (trigger, anticipation pose, success and each failure branch), difficulty curve | Every question maps to a hazard whose outcome visibly demonstrates the concept |
| **game-engineer** | `js/sagittal.js`, `js/main.js`, future level files | Hazard specs, poses | Working code with no console errors | Playtest script passes all branches |
| **vfx-audio** | `js/effects.js` | Hazard specs | Particles, crack, glitch, synth SFX, reduced-effects variants | Effects readable at classroom-projector size; reduced mode has no rapid flashing |
| **playtest-qa** | `tools/playtest.js`, screenshots | A build | Branch-coverage report and screenshots, bug list | Every hazard × {correct, sagittal-wrong, plane-wrong, timeout} runs without errors and looks right |
| **pedagogy-reviewer** | Review notes only (read-only on code) | Build + content | Reading-level, misconception and accessibility review | No item gives away its own answer; feedback names the plane, axis, movement, agonist and contraction |

The Producer should keep the specialists' context small. It gives each one only the files it owns plus the relevant contract (section 4). Specialists report back with a summary, not file dumps.

---

## 3. Pipeline

```
 Teacher request
       │
       ▼
 [0] BRIEF ─ Producer writes a 1-page brief: plane, target misconceptions,
       │      hazards wanted, what is out of scope (e.g. "transverse: paused")
       ▼
 [1] CONTENT ─────────────┬─ sehs-content-specialist: question bank + explanations
       │                  └─ pedagogy-reviewer: misconception list, reading level
       ▼
 ■ GATE A: teacher approves the question bank (content.js diff / table)
       ▼
 [2] DESIGN ──────────────┬─ level-designer: hazard specs, branches, pacing
       │                  └─ anatomy-animator: poses + C/E/I activation scripts
       ▼
 [3] BUILD ───────────────┬─ game-engineer: hazard logic, UI, scoring
       │                  └─ vfx-audio: effects for each branch
       ▼
 [4] VERIFY (parallel) ───┬─ playtest-qa: run every branch, screenshots
       │                  ├─ anatomy-animator: anatomy audit
       │                  ├─ sehs-content-specialist: terminology audit
       │                  └─ pedagogy-reviewer: give-away / clarity / a11y audit
       │      ↺ fix loop (max 3 rounds; anything still open → teacher)
       ▼
 ■ GATE B: teacher playtest (or a student pilot) + sign-off
       ▼
 [5] RELEASE: Producer commits, opens PR, publishes (GitHub Pages)
```

**What runs in parallel:** stages 1, 2 and 4 fan out because the agents touch different files. Stage 3 is the only one where two agents might edit the same file. If the engineer needs a new effect, it adds a call to a function that vfx-audio implements.

**Fix-loop rule:** a verifier files issues as `file:line`, what is wrong and why, plus a suggested fix. The owning agent fixes them. After 3 rounds, anything unresolved goes to the teacher as a decision rather than looping forever.

---

## 4. Contracts between agents

These are the interfaces that let the agents work independently.

### 4.1 Question (stage) schema (`content.js → OBSTACLES[type].stages[]`)

```js
{
  kind: 'movement' | 'contraction',
  limb: 'legs' | 'arms',          // which limb malfunctions on a plane error
  joints: ['hip','knee'],          // highlighted with the axis glyph during the freeze
  prompt: '…',                     // must NOT contain the answer word
  correct: 'Extension',
  sagittalWrong: 'Flexion',        // movement only: the in-plane wrong answer
  distractors: [...],              // movement only: out-of-plane options (2 are drawn)
  success: { headline, detail, agonists: [muscleIds], contraction: 'concentric'|'eccentric'|'isometric' },
  fail: { [wrongOption]: { headline, explain } },
  timeout: { headline, explain, as?: 'Isometric' }  // `as` = which failure animation to reuse
}
```

### 4.2 Muscle geometry (`android.js → MUSCLES[]`)

```js
{ id, limb: 'leg'|'arm', w /*belly width*/, pts: [[segment, t, offset], …], belly: [from, to] }
```

- `segment` is one of `torso | thigh | shank | foot | upper | fore`.
- `t` is the fraction along the bone measured from its proximal joint.
- `offset` is positive anterior and negative posterior, in rig units.
- A 3-point path is origin, then via point, then insertion; the belly lies on the first leg of the path.

### 4.3 Pose convention

All angles are in degrees. Each limb is measured relative to its parent segment.

| Key | Positive means |
|---|---|
| `hip` | hip flexion |
| `knee` | knee flexion |
| `ankle` | dorsiflexion |
| `sh` | shoulder flexion |
| `el` | elbow flexion |
| `lean` | trunk forward |
| `rot` | whole-body forward roll |

- Suffix `N` is the near side and `F` is the far side.
- `mus` sets muscle activation explicitly, for example `{ quadriceps: ['e', 1] }`. The code letters are `c` concentric, `e` eccentric and `i` isometric, followed by a 0–1 level.
- Muscles without an explicit entry turn concentric automatically while they shorten.

### 4.4 Outcome script interface (level files)

```js
actSomething(ob) → { scroll0, update(t, dt) }   // mutates this.pl.pose / mode, calls stageDone(ob) or fail()
```

Each hazard needs a script for:

- **success**
- **each in-plane wrong answer**
- **timeout**

Plane errors share the generic `actPlaneFail` script.

---

## 5. Running the workflow in Claude Code

### Typical prompts to the Producer session

**New hazard:**
> Add a "pressure plate" hazard to the sagittal level that tests ankle plantarflexion vs dorsiflexion. Run the full pipeline: content → Gate A (show me the question first) → design → build → verify.

**Audit only:**
> Use the anatomy-animator and sehs-content-specialist agents in parallel to audit the current build. Report issues only, no edits.

**Next level:**
> Start the Frontal level work package from docs/GAME_DESIGN.md §5. Stop at Gate A with the question bank.

### Direct subagent calls

```
use the playtest-qa agent to run tools/playtest.js for every hazard and every branch and summarise failures
use the pedagogy-reviewer agent to check whether any prompt gives away its answer
```

### Verification commands (used by playtest-qa)

```bash
node tools/playtest.js out/ gap,laser,crate,drop,zipline correct
```

```bash
node tools/playtest.js out/ gap wrong
```

```bash
node tools/playtest.js out/ gap plane
```

```bash
node tools/playtest.js out/ zipline correct,wrong2
```

The last argument is a comma-separated list of choices, one per decision: `correct`, `wrong`, `wrong2`, `plane` or `timeout`. The script prints any page errors and saves screenshots of each decision and outcome.

---

## 6. Review checklists

### Anatomy audit (anatomy-animator)

- [ ] Each muscle sits on the correct surface: anterior or posterior, superficial or deep layering.
- [ ] Origin and insertion regions are right. Examples: quadriceps reach the tibial tuberosity via the patella; the gastrocnemius crosses the knee and reaches the calcaneus via the Achilles tendon; the biceps brachii inserts on the radial tuberosity.
- [ ] Every scripted phase uses the correct contraction type:
  - concentric = shortening under load
  - eccentric = lengthening under load, as in landings and lowering against gravity
  - isometric = holding a position
- [ ] The agonist named in the feedback is the one that glows.
- [ ] Joint ranges stay physiological, except in deliberate damage states such as knee hyperextension on a bad landing.

### Content audit (sehs-content-specialist)

- [ ] Plane and axis pairs are correct: sagittal ↔ frontal axis, frontal ↔ sagittal axis, transverse ↔ longitudinal axis.
- [ ] Wording matches the teacher's textbook (one place: `content.js`).
- [ ] Each movement question has exactly one correct option, and the out-of-plane distractors really are out of plane.
- [ ] Each contraction question describes the situation without naming the contraction.

### Pedagogy and accessibility audit (pedagogy-reviewer)

- [ ] Prompts are at a high-school reading level (max ~35 words).
- [ ] Every failure screen states what the student chose, why it failed, and the correct answer with plane, axis, agonists and contraction.
- [ ] Contraction colours always have a letter alongside (C/E/I), so they work for colour-blind players.
- [ ] "Reduce flashing & shake" removes rapid flashes and full-screen glitch.
- [ ] The game is fully playable with the keyboard alone (1–4, P, L, M, R, Enter).
- [ ] The muscle monitor never reveals the answer to a contraction question; it is "jammed" during those decisions.

### Playtest (playtest-qa)

- [ ] For every hazard, run correct, sagittal-wrong, each contraction-wrong, one plane-wrong and a timeout.
- [ ] No page errors appear in any run.
- [ ] The android never clips through the floor, and the decision panel never covers the limbs being asked about.
- [ ] Rebooting at a checkpoint restores the hazard (crate back, trolley parked).
- [ ] Frame time is fine on a low-end Chromebook profile (CPU throttle ×4).

---

## 7. Work packages

| Package | Status | Contents |
|---|---|---|
| **WP-S1 Sagittal prototype** | ✅ this commit | Android rig with 15 lower- and upper-limb muscles; 5 hazards (gap, laser, crate, drop, trolley rail) with 6 questions; slow-mo, timer and tension effects; all failure branches; checkpoints; review summary |
| WP-S2 Sagittal content expansion | next | Ankle hazards (plantarflexion pressure plate, dorsiflexion toe-clearance trip wire), trunk flexion/extension, hyperextension; difficulty modes (timer length, hints on or off) |
| WP-S3 Teacher tools | next | Export the session log as CSV; a class-code leaderboard (optional); misconception summary per student |
| **WP-F1 Frontal level** | design (see GAME_DESIGN §5) | Climbing wall with per-limb control, abduction and adduction, palm orientation, scientist shocks, lives |
| WP-T1 Transverse level | ⏸ **paused** | Placeholder in the menu only. Do not develop until the teacher un-pauses it |

---

## 8. Open decisions for the teacher (Gate A items)

1. **Pronation and supination in the frontal level.** Forearm pronation and supination are **transverse-plane** movements about the longitudinal axis, not frontal-plane ones. Options:
   - **(a) Recommended:** keep the palm step but label it honestly as a transverse movement. This becomes a deliberate "two planes, one task" moment, and choosing it in the palm step is never punished as a plane error.
   - **(b)** Swap it for wrist **radial or ulnar deviation**, which is frontal plane, so the level stays single-plane.
2. **Axis naming.** The game says *frontal axis* (also transverse or mediolateral), *sagittal axis* (anteroposterior) and *longitudinal axis*. Change one line in `content.js` if your textbook differs.
3. **Laser slide feedback.** The game teaches that dropping into a slide is hip and knee **flexion** controlled by an **eccentric** quadriceps. This is accurate but subtle, so confirm you want that nuance at this level.
4. **Frontal level life total.** What happens at 0 lives? The proposal is that the session ends with a precision report ("test terminated"), without a game-over reset.
