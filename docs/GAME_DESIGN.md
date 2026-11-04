# Kinetic Escape: Game Design Document

**Audience:** IB / high-school SEHS students reteaching the planes and axes of movement, joint actions and muscle contraction types.
**Platform:** browser (HTML5 canvas, no install, no build step). Works on Chromebooks and on a classroom projector.

---

## 1. Premise and timeline

An experimental android has **anatomically correct human muscles** built onto a metal skeleton. In phase 1 these are 15 lower- and upper-limb muscles. Each muscle swells in small steps and glows when it works. The colour shows the contraction type:

- **C** concentric: orange
- **E** eccentric: blue
- **I** isometric: amber

The three levels tell one story, and each one is locked to a single plane of movement:

| Order in story | Level | Plane, and the camera that shows it | Status |
|---|---|---|---|
| 1 (before the escape) | **Precision Lab** | Frontal plane, viewed from front or back | Design (§5) |
| 2 | **Factory Escape** | Sagittal plane, viewed side-on | **Playable prototype** |
| 3 (after the escape) | **Drone Defense** | Transverse plane, viewed top-down | ⏸ Paused |

**Core idea: the camera is the plane.** In every level the screen is the plane being practised, and that plane's axis points straight out of the screen. During each decision the questioned joints show a ⊙ glyph, which is the axis seen end-on, with rotation arrows drawn in the plane of the screen.

---

## 1b. Tutorial and review section (every game)

Each game is a **teaching** game, not only a review game. Pressing **Play** opens the level's tutorial first; the student can skip it. Every level card also has its own **Tutorial** button, and the pause menu links to it. The tutorial has five pages, all generated from `content.js`:

1. **Planes & axes:** three plane diagrams, what each plane divides the body into, and **every name for each axis**. A warning explains that the "transverse axis" is not the transverse plane, and a callout explains that *the screen is this game's plane*.
2. **Movements in this plane:** a definition and an everyday example for each movement, each with **▶ show me**. The sagittal demos use the real muscled android and show the **live joint angle** (e.g. knee 176° → 85° = "angle DECREASES → FLEXION"). The frontal demos use a back-view figure, and the transverse demos use a top-down figure. The frontal tutorial also shows the cross-plane palm step (pronation and supination, shown in top view). This page also lists the movements from the other planes.
3. **Contraction types:** a tree with **ISOTONIC** (concentric, eccentric) on one side and **STATIC** (isometric) on the other. Each type is shown in a dumbbell-curl demo with the matching muscle colours, plus a full curl (concentric going up, eccentric going down). It ends with the landing example: "movement ≠ contraction".
4. **Muscles:** each muscle's location and main action. In the sagittal tutorial, clicking a row highlights that muscle on the android.
5. **How to play:** level-specific rules.

**Printable review sheet** (`review-sheet.html?level=<id>`): planes and axes with diagrams, a movement table, the contraction tree, a key-muscle table, and 8 self-check questions with a toggleable answer key. It is built from the same content file, so it always matches the game.

## 2. Level 2: Factory Escape (sagittal plane) [PLAYABLE]

### Core loop

1. The android runs, staying centred on screen while the factory scrolls left.
2. A hazard approaches. **Time slows smoothly to a near-freeze**, the camera zooms in and pans so the limbs stay visible, and the android settles into an anticipation pose. For example, it crouches before a jump. Its muscles hold that pose isometrically and tremble.
3. A decision panel appears with a **timer**. Tension builds as the timer runs:
   - colour drains from the world while the android stays vivid
   - a red vignette pulses
   - a heartbeat speeds up and a tick plays each second
   - frozen speed-lines and slight camera shake appear
4. The student picks one option, by mouse or with keys 1–4.
5. The outcome plays out (see the next section). A correct answer shows a feedback card naming the movement, plane, axis, agonists and contraction type.
6. A failure shows an explanation screen, then **reboots at the same hazard** (a checkpoint).
7. After 10 hazards the android reaches the **EXIT** door. A results screen shows accuracy and *review targets* broken down by error type: plane errors, flexion/extension mix-ups, contraction errors and timeouts.

Difficulty rises with each hazard: speed goes from 380 to about 500 px/s, and the timer drops from 8 s to a minimum of 4.5 s.

**Hazard order is tiered.** Simple joint actions come first, the subtle ones later:

| Slots | Hazards | Tier |
|---|---|---|
| 1–3 | Gap (jump = extension), crate (push = extension), gap | 1 |
| 4–5 | Trolley rail (reach = flexion, hold = isometric), laser slide | 2 |
| 6 | One more tier ≤2 hazard | ≤2 |
| 7 | High ledge (eccentric landing) | 3 |
| 8–10 | Random mix | any |

**Rotating axis names.** The HUD label switches between *frontal / transverse / mediolateral axis* every 8 s. Feedback and failure cards use the current name, and the failure card lists all of them.

**Rival androids.** Other escapees run on a hazier catwalk behind the player, drawn smaller. They overtake the player (or get overtaken), jump the catwalk gaps, and sometimes fail: a tuck-roll into a gap with an explosion from below, or a malfunction and collapse ("UNIT-07 LOST"). They share the slowed time during decisions. They are background drama only and never hint at the current answer.

### Outcome rules

| Student picks… | What happens |
|---|---|
| **Correct** | The success animation plays, with the agonists shown in the right contraction colour, and the run continues |
| **Wrong but in the sagittal plane** (e.g. flexion instead of extension) | **The muscles do what was chosen.** The legs flex even tighter, the android rolls over the edge and drops off-screen, and an explosion erupts from below |
| **A movement outside the sagittal plane** (abduction, rotation and so on) | **Malfunction.** The limb twists out of the screen (foreshortened), sparks fly, the screen cracks with a glitch effect, and SYSTEM FAILURE appears ("plane violation") |
| **Wrong contraction type** | The android acts out that contraction. Concentric = the muscle shortens, eccentric = it lengthens under load, isometric = it stays rigid |
| **Timer runs out** | The android "hesitates": the in-plane failure animation plays with timeout feedback |

### Hazard bank (v0.1)

| Hazard | Question | Correct | In-plane wrong answer → animation | Notes |
|---|---|---|---|---|
| **Floor gap** (molten pit) | Hip & knee movement to jump | **Extension** (glutes, quads, gastrocnemius: C) | Flexion → tighter tuck, roll into the pit, explosion from below | Landing shows eccentric quads (E) |
| **Laser grid** (head height) | Hip & knee movement to slide under | **Flexion**. The main feedback is kept simple; a "Going deeper" note explains that the quads and glutes control the drop eccentrically | Extension → stands tall into the beams, gets electrocuted, explodes | Teaches that gravity-driven flexion is controlled eccentrically |
| **Blocked conveyor** (400 kg crate) | Elbow movement to shove it | **Extension** (triceps: C, plus anterior deltoid and pectoralis major) | Flexion → pulls the crate onto itself, crushed | |
| **High ledge** | Quadriceps contraction on landing | **Eccentric** | Concentric → knees lock straight and buckle backward; Isometric → rigid landing, bounces and crashes | Contraction question |
| **Trolley rail**, step 1 | Shoulder movement to reach forward and up | **Flexion** (anterior deltoid: C) | Extension → arms swing back, misses the handle, falls into the pit | Two-step hazard |
| **Trolley rail**, step 2 | Biceps contraction to hold the elbows at 90° between a live rail and a grinder | **Isometric** | Concentric → pulls up into the live rail; Eccentric (or timeout) → lowered into the grinder | Muscle monitor is "jammed" so it can't give the answer away |

For movement questions, the options are the correct answer, the in-plane wrong answer and 2 random out-of-plane distractors, shuffled. Contraction questions always offer concentric, eccentric and isometric.

### The android (phase 1 muscle set)

**Lower limb:**

- gluteus maximus
- iliopsoas
- quadriceps femoris (patellar tendon to the tibial tuberosity)
- hamstrings
- gastrocnemius (crosses the knee; Achilles tendon to the calcaneus)
- soleus
- tibialis anterior

**Upper limb:**

- deltoid (anterior and posterior)
- pectoralis major
- latissimus dorsi
- biceps brachii (to the radial tuberosity)
- brachialis
- brachioradialis
- triceps brachii (to the olecranon)

How the muscles are drawn and animated:

- Every muscle is drawn between real attachment regions, routed over via points such as the patella and the Achilles tendon.
- Because of this, muscles shorten and lengthen correctly as the skeleton moves.
- Belly width depends on how far the muscle has shortened, plus its activation. Activation is quantised into 1/8 steps, which gives the visible "small-increment" swelling.
- When no explicit contraction is scripted, any muscle that is shortening shows as concentric automatically. This is what drives the running cycle.

### Classroom features

- **Briefing screen** before play explains the plane/axis idea and defines the three contraction types.
- **Pause screen** shows a planes/axes/movements reference table.
- **Muscle labels**: press L to show every muscle's name.
- **Muscle monitor** in the HUD lists the active muscles with C/E/I letters, so it works for colour-blind players. The legend notes that C + E = isotonic.
- **Reduce flashing & shake** option; it switches on automatically when the device has `prefers-reduced-motion` set.
- **Keyboard-only play** is supported.

---

## 3. Failure taxonomy (shared across all levels)

| Error class | Shown as | Feedback must include |
|---|---|---|
| Plane error | Malfunction, screen crack, glitch, SYSTEM FAILURE | The plane and axis the chosen movement belongs to, and why it is illegal here |
| In-plane movement error | The chosen movement happens literally | A definition of both movements, using the joint angle (decreases vs increases) |
| Contraction error | The chosen contraction happens literally | Length change under tension: shortens, lengthens or stays the same |
| Timeout | The hesitation version of the in-plane failure | The correct answer |

---

## 4. Level 3: Drone Defense (transverse plane) ⏸ PAUSED

Development is paused at the teacher's request. All that exists is a placeholder card in the menu. The concept to resume later:

- top-down view
- the escaped android uses rotations (medial and lateral, trunk rotation), horizontal abduction and adduction, and pronation and supination to deflect or strike capture drones

---

## 5. Level 1: Precision Lab (frontal plane) [NEXT WORK PACKAGE]

### Story

This level takes place *before* the escape. The android is a test subject forced to perform precision tasks on a climbing wall. **Scientists are always visible behind an observation window.**

Wrong responses do **not** reset the level. Instead the scientists press a button and **shock** the android, which costs one battery cell from its **life total** (proposed: 5 cells), and the test continues. The shocks escalate: sparks at 4 cells, visor flicker at 2, limbs twitching at 1.

When the last cell is gone, the android **malfunctions and shuts off**: its limbs go limp, the visor fades, and a "TEST TERMINATED: SUBJECT OFFLINE" screen appears. That ends the level. Whether the battery runs out or the wall is completed, the level **always ends with a PRECISION REPORT**:

- tasks completed
- first-try accuracy
- errors by type (abduction/adduction mix-ups, plane errors, palm-step errors)
- shocks taken
- review targets that link back to the tutorial

### Camera and controls

- **Posterior view** (the camera looks at the android's back, so its left and right match the student's). The screen is the frontal plane, and the **sagittal axis** points out of the screen.
- **Individual limb control:**
  - select a limb (L arm `Q`, R arm `E`, L leg `Z`, R leg `C`, or click it)
  - choose the movement that brings the limb to the target hold or button lane
- **Move phase** (frontal plane): **abduction** or **adduction** at the shoulder or hip to reach the target. The arm muscles that light up are the deltoid (middle fibres) and supraspinatus for abduction, and the latissimus dorsi and pectoralis major for adduction. The leg muscles are the gluteus medius for abduction and the adductor group for adduction. These muscles would be added to the rig.
- **Press phase (kept, teacher decision):** turn the palm (pronation or supination) to press a button. This step is labelled honestly as a **transverse-plane** movement (longitudinal/vertical axis): "this task uses a second plane". A wrong palm choice costs a shock, but it is reported as a *palm-step error*, never as a plane error.
- **Optional frontal-plane variants:**
  - foot **inversion/eversion** to stand on angled footholds
  - trunk **lateral flexion** to lean around obstacles
  - wrist **radial/ulnar deviation** to aim at switches
- **Contraction moments:**
  - hanging still on the wall = isometric
  - lowering to a hold below = eccentric
  - pulling up to a hold above = concentric

### Feedback

- **Correct:** the limb moves smoothly, the button lights up and a precision score goes up.
- **Wrong but in the frontal plane** (e.g. adduction instead of abduction): the limb moves the wrong way and misses the target. Then the scientists' shock plays (an arc across the glass, the android convulses, one battery cell drains), followed by the explanation card.
- **Wrong plane** (e.g. flexion): the limb swings toward or away from the camera (foreshortened) and misses, then the shock and a plane-error card.
- **0 lives:** the android malfunctions and shuts off, which ends the level, followed by the precision report (teacher decision, AGENTIC_WORKFLOW §8).

### Engineering notes

- Reuse `Android` with a new **frontal-view rig**: the same muscle-path idea, but drawn front-on, with abduction and adduction rotating limbs within the screen plane.
- Reuse `FX` (shock arcs, sparks) and the decision UI unchanged.
- Question data goes in `content.js` as `FRONTAL_TASKS` using the same stage schema.

---

## 6. Accessibility and classroom constraints

- No external assets or network. Everything is drawn in code and the audio is synthesised. The game opens straight from `index.html`, even on `file://`.
- Contraction colours are always paired with the C/E/I letters.
- The reduced-effects mode cuts screen shake to 25% and full-screen flashes to 30%, and reduces the glitch effect.
- Prompts stay at a high-school reading level, under about 35 words.
