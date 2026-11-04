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

### Story

1. **Precision Lab (frontal plane): inside the factory.** The android has just been built. It is still a test subject: scientists behind the observation glass test it, measure it and study its muscles. It cannot leave.
2. **Factory Escape (sagittal plane): the escape.** The android breaks out and runs for the EXIT. Other androids (its friends, §2) are escaping with it. It has to get past the factory's safety systems: pits, lasers, crates, blast doors and the trolley rail.
3. **Drone Defense (transverse plane, ⏸ paused): outside the factory, after the escape.** Capture drones hunt the escaped android in the open.

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
6. A failure shows an explanation screen. What happens next depends on the **hybrid damage system** (§2b): a *fatal* failure (pit, crushed) **reboots at the same hazard** (checkpoint); a *non-fatal* failure costs one energy cell and **asks the same question again**. A wrong answer never skips the question.
7. After 10 hazards the android reaches the **EXIT** door. A results screen shows accuracy, **energy remaining**, **friends saved** and *review targets* broken down by error type: plane errors, flexion/extension mix-ups, contraction errors and timeouts.

Difficulty rises with each hazard: speed goes from 380 to about 500 px/s (`380 + 14·i`), and the timer drops from 8 s to a minimum of 4.5 s (`max(4.5, 8 − 0.35·i)`). Hazards are spaced `end + 1050…1400` px apart (world x), so there are about 2.3–3 s of normal running between freezes.

**Hazard order is tiered.** Simple joint actions come first, the subtle ones later. `buildCourse` sequence:

```js
const seq = ['gap', 'crate', 'gap', 'zipline', 'laser', 'door'];
seq.push(pick(2, 'door'));   // slot 7: never two doors in a row
seq.push('drop');
while (seq.length < 10) seq.push(pick(3, seq[seq.length - 1]));
```

| Slots | Hazards | Tier | Speed (px/s) | Timer (s) |
|---|---|---|---|---|
| 1–3 | Gap (jump = extension), crate (push = extension), gap | 1 | 380 / 394 / 408 | 8.0 / 7.65 / 7.3 |
| 4–5 | Trolley rail (reach = flexion, hold = isometric), laser slide | 2 | 422 / 436 | 6.95 / 6.6 |
| 6 | **Blast door** (hold = isometric), introduced right after the laser | 2 | 450 | 6.25 |
| 7 | One more tier ≤2 hazard (not door) | ≤2 | 464 | 5.9 |
| 8 | High ledge (eccentric landing) | 3 | 478 | 5.55 |
| 9–10 | Random mix (no repeat of the previous type) | any | 492 / 506 | 5.2 / 4.85 |

The door comes after the laser so the student has already met one isometric question (trolley hold, slot 4) and one "gravity does the work" question (laser) before the door asks them to tell isometric apart from both shortening and lengthening under load.

**Rotating axis names.** The HUD label switches between *frontal / transverse / mediolateral axis* every 8 s. Feedback and failure cards use the current name, and the failure card lists all of them.

**Friend androids.** Fellow escapees run on a hazier catwalk behind the player, drawn smaller (`LANE_SCALE`). They overtake the player (or get overtaken) and jump the catwalk gaps. When one fails it **only stumbles**: it trips at the gap edge (it never falls in), its status light turns red, a floater reads "UNIT-07 DOWN", and it slumps to its knees. **No explosion, ever.** It stays kneeling and scrolls off screen. They share the slowed time during decisions. They are background drama only and **never hint at the current answer** (no friend ever performs the questioned movement during a freeze). At the blast door, 2–4 friends run *under* the door the player is holding (see the door spec); these are the friends counted as "saved".

### Outcome rules

| Student picks… | What happens |
|---|---|
| **Correct** | The success animation plays, with the agonists shown in the right contraction colour, and the run continues |
| **Wrong but in the sagittal plane** (e.g. flexion instead of extension) | **The muscles do what was chosen.** The legs flex even tighter, the android rolls over the edge and drops off-screen, and an explosion erupts from below. Fatal or partial per §2b |
| **A movement outside the sagittal plane** (abduction, rotation and so on) | **Malfunction.** The limb twists out of the screen (foreshortened), sparks fly, the screen cracks with a glitch effect, and SYSTEM FAULT appears ("plane violation"). −1 energy, no explosion, same question again |
| **Wrong contraction type** | The android acts out that contraction. Concentric = the muscle shortens, eccentric = it lengthens under load, isometric = it stays rigid. Fatal or partial per §2b |
| **Timer runs out** | The android "hesitates": the in-plane failure animation plays with timeout feedback. Fatal or partial per §2b |

### Hazard bank (v0.1)

| Hazard | Question | Correct | In-plane wrong answer → animation | Notes |
|---|---|---|---|---|
| **Floor gap** (molten pit) | Hip & knee movement to jump | **Extension** (glutes, quads, gastrocnemius: C) | Flexion → tighter tuck, roll into the pit, explosion from below | Landing shows eccentric quads (E) |
| **Laser grid** (head height) | Hip & knee movement to slide under | **Flexion**. The main feedback is kept simple; a "Going deeper" note explains that the quads and glutes control the drop eccentrically | Extension → stands tall into the beams, gets electrocuted, explodes | Teaches that gravity-driven flexion is controlled eccentrically |
| **Blocked conveyor** (400 kg crate) | Elbow movement to shove it | **Extension** (triceps: C, plus anterior deltoid and pectoralis major) | Flexion → pulls the crate onto itself, crushed | |
| **High ledge** | Quadriceps contraction on landing | **Eccentric** | Concentric → knees lock straight and buckle backward; Isometric → rigid landing, bounces and crashes | Contraction question |
| **Trolley rail**, step 1 | Shoulder movement to reach forward and up | **Flexion** (anterior deltoid: C) | Extension → arms swing back, misses the handle, falls into the pit | Two-step hazard |
| **Trolley rail**, step 2 | Biceps contraction to hold the elbows at 90° between a live rail and a grinder | **Isometric** | Concentric → pulls up into the live rail; Eccentric (or timeout) → lowered into the grinder | Muscle monitor is "jammed" so it can't give the answer away |
| **Blast door** (new, tier 2) | Contraction to hold the closing door up while friends escape | **Isometric** (triceps, anterior deltoid, quadriceps, gluteus maximus: I) | Concentric / Isotonic → shoves up, door slams, crushed; Eccentric → arms and knees give, crushed | Four options; muscles "jammed" white during the freeze. Full spec below |

For movement questions, the options are the correct answer, the in-plane wrong answer and 2 random out-of-plane distractors, shuffled. Contraction questions offer concentric, eccentric and isometric, unless the stage lists its own `options` (the blast door adds **Isotonic**, so `buildOptions` must read `st.options` when present).

### Blast door hazard spec

| Field | Content |
|---|---|
| Hazard / art | A heavy steel blast door (about 70 px thick, yellow/black hazard chevrons on its bottom edge) hanging in a frame that spans the main floor and the back catwalk, so the friends' lane passes under it too. Two rotating amber warning lights on the frame, a klaxon, and a "LOCKDOWN" sign. The door's bottom edge and the android's hands must both be in frame during the freeze. Fits in `makeOb` as `case 'door'`: `ob.x` = door near face, `ob.w = 70`, `ob.start = x0`, `ob.end = ob.x + ob.w + 120`. Floor is flat (`groundAt` unchanged). |
| Trigger (world x relative to hazard) | `ob.triggers = [ob.x + ob.w/2 − Android.handRel(POSES.doorHold)[0]]`: the freeze happens when the hands are under the middle of the door's bottom edge. The door starts descending (lights, klaxon) when `scrollX ≥ trigger − 900`. Its height is driven by **scroll position, not time**: `doorBottom = lerp(openY, handY, ease(clamp((scrollX − (trigger − 900)) / 900)))`, where `handY` is the hand height in `doorHold`. That way slow-motion keeps the door and the android in sync, and the door touches the hands exactly at the freeze. |
| Anticipation pose (held isometrically) | `POSES.doorHold`: the android ducks under the door. Shoulders flexed about 160°, elbows slightly bent (about 30° flexion), palms flat on the door's underside, trunk leaning a little forward, **knees half bent (about 45–50° flexion)**, hips flexed about 40°. During the freeze the muscles are drawn in **neutral white with a "SENSORS JAMMED" tag** (same as trolley step 2), and the muscle monitor shows "– – –", because an amber hold would give away the answer. Tremble on arms and legs (`jitterPose` on `shN, elN, shF, elF, hipN, kneeN`). The door creeps 1–2 px and grinds sparks off the palms as the timer runs. The decision panel sits **low and to the right**; it must not cover the hands, elbows, knees or the door edge. |
| Question (content.js key) | `C.OBSTACLES.door`, `tier: 2`, one stage: `kind: 'contraction'`, `options: ['Isometric', 'Concentric', 'Eccentric', 'Isotonic']` (shuffled), `correct: 'Isometric'`, `limb: 'arms'`, prompt e.g. "The blast door is closing. Your friends are right behind you. Which contraction holds the door still so they can get through?" Needs `fail.Concentric`, `fail.Eccentric`, `fail.Isotonic` (with `as: 'Concentric'`) and `timeout`. |
| Success animation + muscles (C/E/I) | 1. **Hold** (about 2.4 s, `scrollMul = 0`): joint angles do not change at all. Triceps, anterior deltoid, quadriceps and gluteus maximus glow **I (amber)**, with a small steady tremble. The door stops, with sparks at the palms. 2. **Friends escape**: 2–4 friend androids sprint in from the left, on the main floor behind the player (drawn at about 0.85 scale) and from the back catwalk. They duck under the door and run off screen right, each with a green floater "UNIT-xx SAFE". Count: 4 if more than 50% of the timer was left, 3 if more than 25%, otherwise 2. 3. **Duck out**: the android drops its arms and dives forward and down (hip and knee flexion, then extension to run). The door **slams** shut behind it with a dust burst, a heavy clank and shake. 4. **+1 energy cell** (capped at 5), green "+1" pulse on the HUD bar. Feedback card: "Isometric: force without length change; the joint angles stayed the same." |
| Each wrong option → animation | **Concentric** (fatal): the triceps, anterior deltoid and quadriceps glow **C (orange)**. The elbows and knees extend and the arms shove up. The door **lurches up** about 20 px, the motor screams, then the door slams down at full force. Crushed: sparks at the chest, then a **full explosion** at the chest. Back to checkpoint. **Isotonic** (fatal): plays **exactly as Concentric** (see the decision note below). The fail card says: "Isotonic means the muscle length changes: concentric or eccentric. Here your muscles shortened (concentric), so the door bounced back and crushed you." **Eccentric** (fatal): triceps and quadriceps glow **E (blue)**. The elbows and knees **slowly give** (about 1.2 s) as the door pushes the android down to the floor: it is visibly still working, but losing. Then a **full explosion**. Back to checkpoint. |
| Timeout → animation | (fatal) The android hesitates: the muscles stay white and jammed, and the door grinds down onto it without any resistance curve (fast, about 0.4 s). Crushed, **full explosion**, back to checkpoint. Card: correct answer = Isometric. |
| Checkpoint reset state | `ob.reset()`: `doorY = openY`, `slammed = false`, friends cleared. `restartAt(i)` puts the scroll 650 px before `ob.start`, so the door is open again and starts descending at `trigger − 900`. Energy unchanged (see §2b). |

**Isotonic decision:** it plays as **concentric**. Isotonic is a category (C or E), so it cannot be acted out on its own. Concentric is the textbook "isotonic" example (the curl going up), and a shove produces a visible joint-angle change that is clearly different from the eccentric "give". If it played as eccentric, two options would look identical *and* the timeout would look similar too.

**Ambiguity flag:** Isotonic has no unique animation by definition, so the fail card must say which half of isotonic was acted out. Everything else is unambiguous: isometric = **no joint angle change**, concentric = angles open, eccentric = angles close under load.

### §2b. Hybrid damage system (replaces "every failure = checkpoint restart")

**Energy bar.** The HUD shows 5 cells (with "ENERGY 3/5" text for colour-blind players). The run starts at 5.

**Two kinds of failure.**

- **Fatal:** the android falls into a hole, or it is crushed or destroyed by an object. It gets a **full explosion**, then the fail card, then **back to the checkpoint** (start of the same hazard, `restartAt(cur)`). **Energy is unchanged.** (Refilling would make a fatal mistake heal you, rewarding the worse error. Taking a cell as well would double-punish, because the reboot already costs time.) Cosmetic damage is cleared because it is a rebooted chassis.
- **Non-fatal:** only part of the android is hit. It loses **1 cell**, gets a **partial explosion at that body part only** (`fx.explosion(part, 0.45)`, small shake, no full-screen flash), the part gets a **damage state**, the fail card is shown (button: "Try again"), and then the **same question is asked again**.

**Rewinding for a re-ask.** `enterDecide` saves a snapshot: `scrollX`, a copy of `pl` (pose, x, y, mode), the current-stage obstacle state (`trolleyX`, `K`, `attached`, crate/door fields) and `decisionTime`. After the partial animation (about 1.2 s) and the card, a 0.5 s **rewind effect** plays: VHS scanlines, a reverse whoosh, the screen crack and glitch fade out, and the world scrolls back. Then `rewindToDecision()` restores the snapshot and calls `enterDecide(ob)` directly, with the same stage, a fresh full timer and **reshuffled** option order (for movement questions the same distractors are kept, so it really is the same question). The anticipation pose is restored. The scroll does not re-run the approach.

**Energy 0 = shutdown.** If a non-fatal hit takes the last cell, a **shutdown sequence** plays instead of the re-ask: the visor fades, the status light goes dark, the limbs go limp into `POSES.slump`, the muscles drain to grey and the screen shows "POWER FAILURE". There is no explosion. Then **back to the checkpoint with energy refilled to 5** and damage cleared.

**Friends saved.** Holding the blast door gives **+1 cell (cap 5)** and adds 2–4 to the friends-saved count.

**Damage states (cosmetic only, no effect on play).** These are stored as `pl.damage = { head, arms, legs, feet }`, drawn by `Android.draw(..., { damage })` and kept until a checkpoint reboot or a shutdown refill.

| Part | Look |
|---|---|
| head | scorched visor (dark smudge), the visor flickers at about 6 Hz, an occasional spark |
| arms / hands | scorched forearm plates, a spark from the elbow every 1–2 s |
| legs (knees) | a knee segment flickers (alpha 0.75–1), sparks at the knee every 1–2 s, slight limp in the run cycle (±4° on the near knee) |
| feet / shins | shredded shin plates (jagged dark edge), sparks at the ankle while running |

Muscles are always drawn normally on top, so the C/E/I colours stay readable. With reduced flashing on, the flicker is replaced by a static scorch.

**Rules.** A wrong answer never skips the question. Full explosions happen **only** when the android falls into a hole or is crushed or destroyed by an object. A partial explosion happens when only part of the android is hit. A plane error causes no explosion at all.

### Outcome table (every hazard × every outcome)

"Re-ask" = −1 energy → fail card → rewind → same question. "Checkpoint" = full explosion → fail card → `restartAt(cur)`, energy unchanged. Plane errors only exist on movement questions.

| Hazard | Outcome | Fatal / partial | Body part damaged | Explosion | Next step |
|---|---|---|---|---|---|
| Gap | Correct (extension) | – | – | none | continue |
| Gap | sagittalWrong (flexion: tuck-roll into the pit) | **fatal** | whole body | full, from below the pit | checkpoint |
| Gap | Plane distractor | partial (no hit) | none (visor glitch only) | none (malfunction + screen crack) | −1, re-ask |
| Gap | Timeout (hesitate, roll into the pit) | **fatal** | whole body | full, from below | checkpoint |
| Crate | Correct (extension push) | – | – | none | continue |
| Crate | sagittalWrong (flexion pulls the crate on) | **fatal** | whole body (crushed) | full, at the chest | checkpoint |
| Crate | Plane distractor | partial | none | none (malfunction + crack) | −1, re-ask |
| Crate | Timeout (crate topples on it) | **fatal** | whole body | full, at the chest | checkpoint |
| Laser | Correct (flexion slide) | – | – | none | continue |
| Laser | sagittalWrong (extension, stands into the beams) | partial | head | partial, at the head | −1, re-ask |
| Laser | Plane distractor | partial | none | none (malfunction + crack) | −1, re-ask |
| Laser | Timeout (half-crouch, head clips the beam) | partial | head | partial, at the head | −1, re-ask |
| Trolley step 1 | Correct (shoulder flexion grab) | – | – | none | continue to step 2 |
| Trolley step 1 | sagittalWrong (extension, misses the rail, falls into the pit) | **fatal** | whole body | full, from below | checkpoint |
| Trolley step 1 | Plane distractor | partial | none | none (malfunction + crack) | −1, re-ask step 1 |
| Trolley step 1 | Timeout (no reach, runs off the edge) | **fatal** | whole body | full, from below | checkpoint |
| Trolley step 2 | Correct (isometric hold) | – | – | none | ride to dismount |
| Trolley step 2 | Concentric (pulls up into the live rail) | partial | head (and hands) | partial, at the head; the android **stays hanging** (no fall) | −1, re-ask step 2 |
| Trolley step 2 | Eccentric (lowered into the grinder) | partial | feet / shins | partial, at the feet; it is yanked back up to the hold height | −1, re-ask step 2 |
| Trolley step 2 | Timeout (as eccentric) | partial | feet / shins | partial, at the feet | −1, re-ask step 2 |
| High ledge | Correct (eccentric landing) | – | – | none | continue |
| High ledge | Concentric (locked knees buckle) | partial | legs (knees) | partial, at the knees | −1, re-ask (rewind to the ledge top) |
| High ledge | Isometric (rigid landing, bounce) | partial | legs (ankles / shins) | partial, at the ankles; it falls on its seat, **no chest explosion** | −1, re-ask |
| High ledge | Timeout (as isometric) | partial | legs (ankles / shins) | partial, at the ankles | −1, re-ask |
| Blast door | Correct (isometric hold) | – | – | none | friends escape, +1 energy, continue |
| Blast door | Concentric (shove, door slams) | **fatal** | whole body (crushed) | full, at the chest | checkpoint |
| Blast door | Isotonic (plays as concentric) | **fatal** | whole body | full, at the chest | checkpoint |
| Blast door | Eccentric (gives way slowly) | **fatal** | whole body | full, at the chest | checkpoint |
| Blast door | Timeout (door closes on it) | **fatal** | whole body | full, at the chest | checkpoint |
| any non-fatal | the hit that drops energy to 0 | → shutdown | – | none (power-down) | checkpoint, energy refilled to 5 |

**Win screen additions:** energy remaining (x/5), friends saved, partial hits taken, shutdowns, and first-try accuracy (re-asks count as extra decisions but not as first tries).

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

What a failure *costs* is level-specific. In Factory Escape it is the hybrid damage system (§2b: fatal → checkpoint, non-fatal → −1 energy and the same question again). In the Precision Lab it is a scientists' shock (−1 life, no reset).

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
