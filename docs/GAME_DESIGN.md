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
| 3 (after the escape) | **Drone Defense** | Transverse plane, viewed top-down | **Active: spec ready (§4)** (teacher un-paused 2026-11-04) |

**Core idea: the camera is the plane.** In every level the screen is the plane being practised, and that plane's axis points straight out of the screen. During each decision the questioned joints show a ⊙ glyph, which is the axis seen end-on, with rotation arrows drawn in the plane of the screen.

### Story

1. **Precision Lab (frontal plane): inside the factory.** The android has just been built. It is still a test subject: scientists behind the observation glass test it, measure it and study its muscles. It cannot leave.
2. **Factory Escape (sagittal plane): the escape.** The android breaks out and runs for the EXIT. Other androids (its friends, §2) are escaping with it. It has to get past the factory's safety systems: pits, lasers, crates, blast doors and the trolley rail.
3. **Drone Defense (transverse plane): outside the factory, after the escape.** The android and the friends who escaped with it hold out at a wrecked transport in a scrapyard at the forest edge. The friends repair the transport while the factory sends waves of capture drones to net them.

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

## 4. Level 3: Drone Defense (transverse plane) [ACTIVE: un-paused 2026-11-04]

Source brief: `docs/TRANSVERSE_BRIEF.md`. Teacher priorities: (1) educational (transverse actions about the longitudinal axis), (2) entertaining, (3) sustainably engaging (many waves, return visits).

**One-line pitch:** the night after the escape. The android stands guard at the centre of a scrapyard camp while its friends patch up a wrecked transport. Capture drones pour out of the forest. Routine drones get swatted, flicked and spun away automatically, with every strike a labelled transverse action. When a drone gets dangerous, time freezes and the student picks the action. Between waves, an exam terminal pays SCRAP for SEHS multiple-choice answers, and the scrap buys anatomy-themed upgrades.

**Files (engine plan):** `js/transverse.js` (level class `DroneDefense`, same lifecycle as the sagittal level: `start / update(dt) / draw(ctx) / choose(i)`), `js/topdown.js` (top-down muscled rig `SEHS.TopAndroid`, plus ally and drone painters), `js/workshop.js` (terminal, upgrades, loadout, save). Reuse `SEHS.FX`, `SEHS.Audio`, the decision panel and the fail/feedback cards from `main.js`. Headless driver: `tools/playtest-transverse.js` (§4.13).

### 4.1 Camera, arena and HUD

**Camera = plane.** Fixed top-down orthographic view of a 1280×720 arena. The screen is the transverse plane, and the longitudinal (vertical) axis points straight out of the screen (⊙). **The camera never rotates.** The android's pelvis always faces **screen-up (north)**, toward the forest, with its back to the transport. So the android's left and right are the student's left and right, the same as the tutorial's "▲ FRONT" figure. The trunk, arms and hips rotate; the feet and pelvis do not.

Bearings in this spec: **θ** = degrees clockwise from the android's front (0 = screen-up, +90 = android's right = screen right, ±180 = behind). **d** = distance in px from the android's centre at 1× zoom.

| Element | Position / size (1× arena px) | Notes |
|---|---|---|
| Android (guard post) | centre (640, 380). Shoulder span 74 px, trunk ellipse 74×28, raised-arm length 92 px (melee reach ~140 px from the centre) | Drawn by `TopAndroid` with muscles always in code (§4.2a) |
| Transport wreck | Box centred at (640, 620), 380×120, below the android | Tyres, open bonnet, sparks where allies work. Each wave repairs one named subsystem (§4.9) |
| Ally work spots | Rear: R1 (530, 585) and R2 (750, 585) on the bonnet. Flanks: FL (330, 430) on a crate lookout and FR (950, 430) at a turret pad. Extra slots X1 (250, 600), X2 (1030, 600) | Rear spots are the Mechanic and Medic defaults; FL = Scout; FR = Engineer |
| Forest edge | Dark treeline along the top 0–90 px with pine silhouettes; scrap heaps on the left and right edges | Drones emerge from the trees and the heaps |
| Spawn ring | Circle r = 760 around the android (off-screen). Spawn bearing is drawn from the wave's side weights (§4.9) | Scout intel shows these weights (§4.6e) |
| Ground | Muddy dirt with tyre ruts, puddles that reflect drone lights, floodlights on the wreck | Night palette; drone lights are the brightest thing on screen |

**Freeze camera.** Over the 0.6 s time-dilation ramp the camera zooms to `Z = clamp(0.5·H / (d + 70), 1.4, 2.0)` and centres on `lerp(android, drone, 0.35)`. The android, the threat drone and (for ally threats) the ally must all be on screen. Leg threats (`hipPivot`) use Z = 2.0 centred on the feet.

**HUD** (all text also readable without colour):

| Region | Content |
|---|---|
| Top-left | **ENERGY** cells (5 base, up to 8 with `reinforcedFrame`). Cells are drawn split into two halves because real-time chips cost half a cell (§4.3). Text: "ENERGY 3.5/5" |
| Top-centre | **REPAIR** bar with the subsystem name ("REPAIR 63%: FUEL LINE") and the current rate (e.g. "+1.6/s"). Turns grey and shows "STALLED" when no ally is working |
| Top-right | **WAVE 4**, **SCRAP 230**, **COMBO ×3** meter (drains in 3 s without a hit) |
| Bottom-left | **Axis tag**: "⊙ " + `C.axisName('transverse')`, which rotates every `C.AXIS_INTERVAL_MS`. Never hard-coded. Above it sits the **muscle monitor** listing active muscles with C/E/I letters, as in Factory Escape |
| Bottom-right | **Ally roster**: one chip per ally with unit ID, role icon, and state text WORKING / NETTED 6 s / DRAGGED OFF |
| Edge chevrons | Scout warnings: a pulsing chevron on the screen edge 2 s before a spawn from that bearing |

### 4.2 Real-time phase

#### 4.2a The top-down rig (`SEHS.TopAndroid`)

Pose keys, in degrees, use the same sign rule on both sides (+ = anatomical outward/lateral). The engine mirrors the left side.

| Key | Meaning | Range |
|---|---|---|
| `trunk` | Spinal rotation of the shoulders over the fixed pelvis (+ = turns right, clockwise from above) | −60…+60 |
| `R.fl`, `L.fl` | Arm drawing mode: 0 = hanging (seen end-on as a disc), 90 = raised to horizontal. Only ever set **before** a freeze (it is a sagittal/frontal setup, never a questioned action) | 0 or 90 |
| `R.hz`, `L.hz` | Raised arm's horizontal angle relative to the trunk: 0 = straight forward, + = horizontal abduction (outward), − = horizontal adduction past the midline | −40…+120 |
| `R.rot`, `L.rot` | Shoulder rotation. With the arm hanging and the elbow at 90°, this is the forearm angle (0 = forearm forward, + = lateral/out, − = medial/in across the belly). With the arm raised it rolls the arm about its long axis (drawn as forearm foreshortening plus the glove stripe flipping) | −90…+90 |
| `R.el`, `L.el` | Elbow flexion | 0…100 |
| `R.pr`, `L.pr` | Forearm: 0 = mid-position (thumb forward, palm facing the thigh), + = supination (palm forward), − = pronation (palm back) | −90…+90 |
| `hipR`, `hipL` | Hip rotation seen as the foot direction (+ = lateral, toes turn out) | −40…+45 |

**Muscles drawn top-down (always in code):** pectoralis_major, deltoid_anterior, deltoid_posterior, latissimus_dorsi, subscapularis, infraspinatus, obliques, pronator_teres, supinator, biceps_brachii, gluteus_maximus. Colours and quantised swelling are the same as on the side rig (C orange, E blue, I amber, with letters in the monitor). **Live angle readout** during every questioned outcome, mirroring the sagittal knee-angle overlay: an arc at the moving joint plus text, e.g. "arm 80° → −30°: moved TOWARD the midline → HORIZONTAL ADDUCTION". Out-of-plane malfunctions draw the limb **foreshortened and scaled up** (it lifts toward the camera, out of the screen plane) with sparks.

#### 4.2b Controls

| Input | Action |
|---|---|
| Click / tap a drone | Select it as the target (cyan ring + bracket, plus a dashed line from the android) |
| A / D or ← / → (also Tab) | Cycle targets clockwise / anticlockwise by bearing |
| Space | **Focused strike** on the target now: skips the 0.35 s auto-delay and does +25% damage. Needs the relevant cooldown to be ready |
| R, or click a netted ally | Start a rescue (§4.5) |
| 1–4 | Answer options (freeze, rescue prompt, terminal) |
| P / Esc | Pause (planes/axes reference table, as in Factory Escape) |
| L | Toggle action labels and muscle labels |

**Auto-defence.** The android always attacks the selected target when it is in range. With no target (or the target out of range) it auto-picks the drone **nearest to any ally**, at the slower auto rate (+0.35 s delay). So the game is playable hands-off during demos, but active targeting is clearly better.

#### 4.2c Which transverse action plays for which drone position

θ is relative to the trunk's rest heading (north). "Same-side arm" = the arm on the drone's side.

| Drone position | Auto action (floater label) | Movement(s) shown | Agonists (C) | Damage | Cooldown |
|---|---|---|---|---|---|
| d ≤ 140, \|θ\| ≤ 25 (dead ahead) | **Palm pulse**: same-side arm raised forward, forearm flips palm-down and pulses | Pronation (return = supination) | pronator_teres | 1, AoE r = 60 | palm 1.0 s |
| d ≤ 140, 25 < \|θ\| ≤ 70 | **Cross swat**: opposite arm sweeps across the chest | Horizontal adduction | pectoralis_major, deltoid_anterior | 1 (+knockback 40 px) | that arm 0.55 s |
| d ≤ 140, 70 < \|θ\| ≤ 125 | **Backhand**: same-side arm sweeps out from a guard across the chest | Horizontal abduction | deltoid_posterior, infraspinatus | 1 | that arm 0.55 s |
| d ≤ 160, \|θ\| > 125 (behind) | **Spin strike**: trunk turns toward the drone, same-side arm sweeps back | Rotation + horizontal abduction | obliques, deltoid_posterior | 2, arc 60° | both arms 1.1 s |
| 140 < d ≤ 460, \|θ\| ≤ 120 | **Disc flick**: trunk turns to aim (max 60°), elbow tucked at 90°, forearm swings out to load (0.25 s), then snaps in to release | Rotation (aim), lateral rotation (wind-up) → medial rotation (throw) | infraspinatus → subscapularis, pectoralis_major, latissimus_dorsi | 2 | that arm 1.3 s |
| Lancer bolt incoming (front / rear) | **Shield flip**: hanging arm turns the palm emitter toward the bolt | Supination (front) / pronation (rear) | supinator + biceps_brachii / pronator_teres | blocks 1 bolt | palm 1.0 s |
| Crawler at a foot, d ≤ 70 | **Heel-pivot stomp**: the toes swing out (drone outside the foot) or in (drone inside / front) | Hip lateral rotation / hip medial rotation | gluteus_maximus / (content: hip medial rotators) | 2 | 0.9 s |

Trunk turn speed 300°/s (scaled by `turnRate`). Every auto action shows its movement label as a 0.8 s floater by the limb (toggle with L; on by default) and lights its muscles. **During a freeze, no ally or auto action ever performs the questioned movement** (as in Factory Escape: friends never hint).

**Juice:** 60 ms hit-stop on every hit (off in reduced effects), drones burst into scrap-coloured debris and smoke rings, swats leave a short arc trail in the movement's plane, disc hits ricochet sparks, synthesised whoosh (swat), thunk-zip (disc), zap (palm), crunch (stomp). **Combo meter:** +1 per drone destroyed, +2 per correct freeze, resets when an ally is netted or the android is hit. At ×5: **OVERDRIVE** for 4 s (all cooldowns halved, muscles glow at full swell, bass drop). Combo only feeds the score and best-wave record, not scrap.

### 4.3 Damage rules (Drone Defense version of §2b)

There is no player explosion in this level. Damage is always partial; drones explode freely.

- **Energy:** 5 cells (max 8 with upgrades). A freeze-outcome hit on the android costs **1 cell** plus a partial explosion at the hit part (`fx.partialExplosion(part, 0.45)`) and a cosmetic damage state on that part (head / armR / armL / torso / legR / legL; same looks as §2b). A routine real-time hit (diver contact, lancer bolt, heavy bump) costs **½ cell** ("chip"), with sparks and no explosion.
- **Ally netted:** no energy cost, but that ally stops working and is towed toward the spawn ring (§4.5).
- **Plane error:** −1 cell, malfunction + screen crack + glitch, no explosion. The threat drone is driven off by a camp flare (it retreats off-screen), so the error is not double-punished.
- **No rewind.** This is real time, so the wrong answer is not re-asked on the spot. Instead, after the fail card, a 1.5 s **ghost replay** plays: a translucent cyan android performs the correct action at 0.6× speed with its muscles lit (purely visual). The threat id then goes into the **re-ask queue**: the director serves it again as the next freeze of the same wave (§4.4d). If the wave ends first, it becomes the first freeze of the next wave. **A wrong answer never skips the question.**
- **Energy 0 = shutdown.** The shutdown sequence plays (visor fades, limbs slump, muscles drain grey, "POWER FAILURE"). Then **WAVE FAILED** → the same wave restarts with full energy, all allies back at their spots, repair at 0, and the re-ask queue kept. Scrap and upgrades are never lost.
- **Medic and rescues** restore energy (§4.5). Cap at max energy.

### 4.4 Threat freeze (the teaching moment)

#### 4.4a Triggers

A freeze fires when a drone reaches its **trigger condition** (table §4.4c) **and** the freeze director allows it:

- at least **15 s** after the wave starts, and at least **12 s** since the end of the previous freeze outcome
- the wave's freeze target (§4.9) is not yet reached
- otherwise the drone acts in real time (e.g. a netter nets its ally if the student does not kill it). Real time stays tense, but freezes stay paced.

If the director is behind schedule (fewer freezes done than `target × elapsed / expectedDuration − 1`), it spawns an **elite** drone of a type that triggers the next wanted threat (the re-ask queue first).

**Threat choice when a trigger fires:** (1) a compatible id in the re-ask queue; (2) a compatible id not yet seen this session; (3) the least recently seen compatible id in the wave's pool. Compatibility = the trigger column in §4.4c.

**Staging (key to readability).** During the 0.6 s dilation ramp the threat drone (and the ally, if any) is **lerped to the threat's staged position** (θ, d) and the android blends into the anticipation pose. Every threat therefore always looks the same, so its picture can be designed for the projector. Staged positions live in the engine (`THREAT_STAGE[id]`), not in content.

#### 4.4b Timer, tension and options

- **Timer:** `base = max(5, 9 − 0.4·(wave − 1))` s, plus the `freezeBonus` upgrade (+1 / +2 / +3 s), plus the planes_axes Calibration bonus (`+1.0 × cal`). Total capped at 12 s. Warden freezes use `base − 1` (min 4.5).
- **Tension** (same as Factory Escape): time scale 0.04, colour drains from the world except the android, the threat drone and the endangered ally; red vignette pulse, heartbeat, a tick each second, isometric tremble on the posed joints (`jitterPose`). ⊙ glyph at each questioned joint with rotation arrows drawn in the screen plane. The endangered ally's chip and floater shake ("KITE!").
- **Decision panel** (380 px wide): placed on the screen half **opposite** the threat drone (drone right → panel left). For drones dead ahead or behind, the panel goes left. It must never cover the android, the questioned joints, the drone or the ally.
- **Options (movement kind)** by tier:

| Tier | Options |
|---|---|
| 1 | correct + `distractors[0]` (the "mirror" opposite) + 2 random `planeWrong` |
| 2 | correct + 2 `distractors` (the mirror always included) + 1 `planeWrong` |
| 3 | correct + 3 `distractors` (or all available, topped up with `planeWrong`) |

  Tier 3 is the hardest because all options are transverse. On a re-ask the option set is the same and the order is reshuffled.
- **Options (contraction kind):** Concentric / Eccentric / Isometric, or the threat's own `options` (adds Isotonic at tier 3, with `as`).

**Physics-honesty rule (designer constraint on `distractors`).** A distractor may only be listed if acting it out *genuinely fails* from the staged pose. For a direction-free option (e.g. "Rotation"), the engine animates the direction that gets closest, and it must still visibly fall short. Horizontal ab/adduction may only be offered when the arm is already raised; shoulder rotations of a hanging arm also turn the palm, so they are excluded where they would succeed (see each threat). The per-threat lists below already apply this rule. **The content agent must not add distractors beyond these lists.**

#### 4.4c Threat bank (`C.DRONE_THREATS`)

| id | Tier | Kind | Trigger (drone) | Staged drone (θ, d) | Correct | `distractors` (ordered, mirror first) | Damage |
|---|---|---|---|---|---|---|---|
| `netterOnAlly_left` | 1 | movement | netter charging an ally left of the android | −65°, 130 (Scout at FL behind it) | Horizontal abduction (L arm) | Horizontal adduction, Medial rotation, Lateral rotation | ally |
| `netterOnAlly_right` | 1 | movement | netter charging an ally right of the android | +30°, 120 (Engineer at FR behind it) | Horizontal adduction (L arm) | Horizontal abduction, Rotation, Medial rotation, Lateral rotation | ally |
| `crossSwat` | 1 | movement | diver diving from the front-left | −25°, 115 | Horizontal adduction (R arm) | Horizontal abduction, Rotation, Medial rotation, Lateral rotation | android (torso) |
| `backhandSwat` | 1 | movement | diver diving from the right | +95°, 115 | Horizontal abduction (R arm) | Horizontal adduction, Rotation, Medial rotation, Lateral rotation | android (armR) |
| `diveBehind` | 1 | movement | diver diving from behind (\|θ\| > 125) | +165°, 115 | Rotation (trunk) | Horizontal abduction, Lateral rotation, Medial rotation | android (torso) |
| `spineTwist` | 2 | movement | swarm arc formed within 150 | 5 midges on an arc −50°…+50°, d 135 | Rotation (trunk) | Horizontal adduction, Horizontal abduction, Lateral rotation | android (torso) |
| `palmShield` | 2 | movement | lancer charging from the rear arc | +150°, 260 | Pronation | Supination, Lateral rotation, Rotation | android (armR) |
| `palmCatch` | 2 | movement | lancer charging from the front arc | +25°, 260 | Supination | Pronation, Medial rotation | android (armR) |
| `discWindup` | 2 | movement | spotter hovering out of reach | −15°, 380 | Lateral rotation (R shoulder) | Medial rotation, Pronation, Supination | android (head) |
| `discThrow` | 2 | movement | spotter (or `discWindup` just succeeded) | −15°, 380 | Medial rotation (R shoulder) | Lateral rotation, Pronation, Supination | android (head) |
| `tetherPull` | 2 | contraction | tether hooks the R wrist | +95°, 210 (cable to the wrist) | Isometric (subscapularis) | Concentric, Eccentric | android (Concentric: torso, Eccentric: armR) |
| `hipPivot` | 3 | movement | crawler reaches the right foot | +60°, 70 (just outside the right toes) | Lateral rotation (R hip) | Medial rotation, Rotation | android (legR) |
| `heavyCatch` | 3 | contraction | heavy ramming from the front | +15°, 100 | Eccentric (pectoralis major) | Concentric, Isometric, Isotonic (`as: 'Concentric'`) | android (Concentric: armR, Isometric: torso) |
| `discSnap` | 3 | contraction | spotter (elite) | −15°, 380 | Concentric (subscapularis) | Eccentric, Isometric | android (head) |

**`planeWrong` pools** (the content agent fills these per threat from here): arm threats: Flexion, Extension, Abduction, Adduction; trunk threats: Flexion, Extension, Lateral flexion; palm threats: Flexion, Extension, Radial deviation, Ulnar deviation; hip threat: Abduction, Adduction, Flexion, Inversion.

#### 4.4d Data contract the content agent fills

```js
C.DRONE_THREATS[id] = {
  title: 'NETTER ON KITE',            // short banner text
  tier: 1,                            // 1..3 (option rules §4.4b)
  kind: 'movement' | 'contraction',
  limb: 'armL' | 'armR' | 'trunk' | 'forearmR' | 'legR',   // used in plane-fail text
  joints: ['shoulder'],               // ⊙ glyph targets: 'shoulder','trunk','forearm','hip'
  prompt: '…',                        // ≤ 35 words; names the joint; must NOT restate the definition
  correct: 'Horizontal abduction',
  distractors: [/* exactly the §4.4c list, same order */],
  planeWrong: [/* from the §4.4c pools */],
  options: ['Eccentric','Concentric','Isometric','Isotonic'],   // contraction threats only, optional
  success: { headline, detail, deeper?, agonists: [muscle ids], contraction: 'concentric'|'eccentric'|'isometric' },
  fail: { '<option>': { headline, explain, damage: 'ally'|'android', part?: 'head'|'armR'|'armL'|'torso'|'legR', as?: '<option>' } },
  timeout: { headline, explain, damage, part?, as: '<option whose animation plays>' },
};
```

Every `distractors` entry and every contraction option except the correct one needs a `fail` entry. `planeWrong` choices use a **generalised** `C.planeFailText(choice, limb, levelPlane)` (the third parameter defaults to `'sagittal'`; for this level it is `'transverse'`, and the text says the camp's guard post locks the android to the transverse plane about `axisName('transverse')`). Never hard-code an axis name in the text.

Extra small content needed: `C.DRONE_UI.rescuePrompt` (template, e.g. "Cut the net! Which plane is {movement} in?"), `C.DRONE_BANTER` (lines below), and the hip medial rotators muscle entry (e.g. `gluteus_medius` with its anterior-fibres action extended, or a new `hip_medial_rotators` id) for the `hipPivot` fail text.

#### 4.4e Per-threat specs

Shared outcome rules for every threat:

- **Correct:** the action plays (0.25–0.4 s, or the hold for isometric), hit-stop, drone destroyed, muscles glow in the success contraction colour, angle readout, feedback card (movement, transverse plane, `axisName('transverse')`, agonists, contraction). +2 combo, +5 scrap.
- **Plane error:** the questioned limb lifts out of the screen plane (foreshortened, scaled up toward the camera), servo sparks, screen crack + glitch, "SYSTEM FAILURE: PLANE VIOLATION". −1 cell, the drone retreats, re-ask queued.
- **Wrong (in-plane):** the android does exactly what was chosen (spec below), then the damage, fail card, ghost replay, re-ask queued.
- **Timeout:** hesitation. Muscles stay white and tremble, then the threat lands (spec below), "HESITATION" card naming the correct answer, ghost replay, re-ask queued.
- **Re-ask state** (replaces "checkpoint reset"): when served again, the drone is re-staged from scratch. For an ally that was netted by this threat and then rescued, the threat fires on that ally again if it is working, otherwise on the nearest ally on the same side.

**`netterOnAlly_left`**

| Field | Content |
|---|---|
| Hazard / art | Netter (quad-rotor with a glowing folded net pod) hovering between the android and KITE (Scout, FL lookout). A pulsing net-charge ring around the pod; KITE ducks, arms over head |
| Trigger | A netter within 90 px of an ally with x < 640 starts its 1.2 s net charge. Staged at θ −65°, d 130 |
| Anticipation pose | L arm raised straight forward (`L.fl 90, L.hz 0, L.el 10`), R arm hanging with the elbow at 90°, trunk 0. Isometric tremble at the L shoulder. ⊙ at the L shoulder with an arc arrow across the front. Panel on the right |
| Question | `C.DRONE_THREATS.netterOnAlly_left`. "The netter is diving at KITE on your LEFT. Your left arm is raised straight in front. What movement at the left shoulder swings it into the drone?" |
| Success + muscles | `L.hz 0 → +80` in 0.25 s (outward, away from the midline). Hand clips the netter, which spins away and explodes; KITE gives a thumbs-up and says a banter line. deltoid_posterior **C**, infraspinatus **C**. Readout "0° → 80°: AWAY from the midline → HORIZONTAL ABDUCTION" |
| Wrong options → animation | **Horizontal adduction**: the arm sweeps across the chest to −40 (toward the right), a clean whiff on the wrong side. The net fires and KITE is netted (ally). **Medial rotation / Lateral rotation**: the raised arm rolls about its long axis (the forearm drops / rises, foreshortened; the glove stripe flips), but the arm keeps pointing forward. Net fires, KITE netted |
| Timeout | The arm trembles and stays forward; the net fires and KITE is netted |
| Re-ask state | Netter re-staged on KITE (or the nearest left-side ally) |

**`netterOnAlly_right`**

| Field | Content |
|---|---|
| Hazard / art | Netter over the path to BOLT (Engineer, FR pad), staged in front of the android's right shoulder. The right hand holds a net cutter and is drawn with a **lock glyph** (busy) |
| Trigger | A netter within 90 px of an ally with x > 640 starts its charge. Staged at θ +30°, d 120 |
| Anticipation pose | L arm raised and swung out to the left side (`L.hz +85`), R arm hanging and locked. ⊙ at the L shoulder. Panel on the left (it must not cover the L arm's sweep path) |
| Question | "The netter is going for BOLT on your RIGHT. Your RIGHT hand is busy, so your LEFT arm, held out to the side, must sweep across in front of you. What movement at the left shoulder?" |
| Success + muscles | `L.hz +85 → −35`: the left hand crosses the midline and smashes the netter at +30°. pectoralis_major **C**, deltoid_anterior **C**. Readout "TOWARD and across the midline → HORIZONTAL ADDUCTION" |
| Wrong options → animation | **Horizontal abduction**: the arm swings further back (+85 → +120), away from the drone; BOLT netted. **Rotation**: the trunk turns right to its 60° limit (the nearest try); the left hand ends at −25°, 55° short (a ghost arc shows the gap); BOLT netted. **Medial / Lateral rotation**: the arm rolls on its long axis without sweeping; BOLT netted |
| Timeout | Frozen; BOLT netted |
| Re-ask state | As above |

Teaching note: the left and right netter threats are a deliberate pair. One is solved by moving away from the midline and the other by moving toward and across it, so the answer depends on the midline, not on the screen side.

**`crossSwat`**

| Field | Content |
|---|---|
| Hazard / art | Diver (wasp-shaped, red visor, afterburner streak) diving at the android's front-left, with a lock-on reticle on the android's chest |
| Trigger | A diver starts its dive with −70° ≤ θ ≤ −10°. Staged at −25°, d 115 |
| Anticipation pose | R arm raised and swung out to the right (`R.hz +80`), L arm hanging. ⊙ at the R shoulder. Panel on the right, low (below the R arm) |
| Question | "A diver is coming at you from the front-left. Your right arm is out to the side. What movement at the right shoulder swings it across your body into the drone?" |
| Success + muscles | `R.hz +80 → −30`, the diver is batted into the dirt and explodes. pectoralis_major **C**, deltoid_anterior **C**. Readout "TOWARD the midline → HORIZONTAL ADDUCTION" |
| Wrong options → animation | **Horizontal abduction**: the arm swings further back to +120; the diver slams the chest (−1 cell, torso). **Rotation**: the trunk turns left 60° (the nearest try), the hand ends at +20°, 45° short; the diver hits the torso. **Medial / Lateral rotation**: the arm rolls without sweeping; torso hit |
| Timeout | Arm frozen; torso hit |
| Re-ask state | Diver re-staged |

**`backhandSwat`**

| Field | Content |
|---|---|
| Hazard / art | Diver coming in from the android's right side |
| Trigger | A diver starts its dive with 70° ≤ θ ≤ 125°. Staged at +95°, d 115 |
| Anticipation pose | R arm raised across the chest (`R.hz −20`, guard). ⊙ at the R shoulder. Panel on the left |
| Question | "A diver is coming at your RIGHT side. Your right arm is guarding across your chest. What movement at the right shoulder sweeps it out into the drone?" |
| Success + muscles | `R.hz −20 → +100`, backhand smash. deltoid_posterior **C**, infraspinatus **C**. Readout "AWAY from the midline → HORIZONTAL ABDUCTION" |
| Wrong options → animation | **Horizontal adduction**: the arm presses further across to −40, the diver clips the right shoulder (−1 cell, armR). **Rotation**: the trunk turns right 60° (the nearest try), the hand ends at +40°, 55° short; armR hit. **Medial / Lateral rotation**: the arm rolls; armR hit |
| Timeout | armR hit |
| Re-ask state | Diver re-staged |

**`diveBehind`**

| Field | Content |
|---|---|
| Hazard / art | Diver screaming in over the transport from behind-right; the allies on the bonnet duck. A rear-warning arc flashes behind the android |
| Trigger | A diver starts its dive with \|θ\| > 125°. Staged at +165°, d 115 |
| Anticipation pose | Both arms raised forward in guard (`R.hz 0, L.hz 0`), trunk 0, feet planted. ⊙ at the **trunk centre** (spine) with a large arc arrow. Panel on the left, upper half |
| Question | "A diver is coming from BEHIND you. Your feet are planted. Your arms alone cannot reach behind you. What movement of the TRUNK (spine) brings you round to face it?" |
| Success + muscles | `trunk 0 → +50` and `R.hz 0 → +115` together; the hand meets the diver at +165°. obliques **C**, plus deltoid_posterior **C**. Card: "ROTATION of the trunk about the longitudinal axis"; deeper: "the arm also horizontally abducted, but without trunk rotation it could not reach" |
| Wrong options → animation | **Horizontal abduction**: the R arm alone sweeps to its +120 limit (a ghost limit tick shows where it stops), 45° short; the diver hits the back (torso). **Lateral rotation / Medial rotation**: the arms roll in place; torso hit |
| Timeout | Torso hit |
| Re-ask state | Diver re-staged behind |

**`spineTwist`**

| Field | Content |
|---|---|
| Hazard / art | Five midges (tiny rotor drones with nets) fanned in an arc in front, closing together |
| Trigger | A swarm forms its arc within d 150. Staged at −50°…+50°, d 135 |
| Anticipation pose | Trunk wound right (`trunk +50`), R arm raised forward relative to the trunk (so the hand is at +50°), L arm tucked. ⊙ at the trunk centre. Panel on the left, lower half |
| Question | "Five midges in an arc in front of you! You are wound up to the right with your arm out. What movement of the TRUNK sweeps your arm through the whole arc?" |
| Success + muscles | `trunk +50 → −55`: the hand sweeps the arc and hits all five in a chain (five hit-stops, +5 combo). obliques **C** (swelling in steps) |
| Wrong options → animation | **Horizontal adduction**: the arm alone sweeps +50 → +10 (shoulder limit) and hits 2 of 5; the other 3 net the android (torso). **Horizontal abduction**: the arm swings right, hits none; torso. **Lateral rotation**: the arm rolls; none hit; torso |
| Timeout | None hit; torso |
| Re-ask state | A new 5-midge arc is staged |

**`palmShield`**

| Field | Content |
|---|---|
| Hazard / art | Lancer (long-nosed drone) behind-right charging a beam; a thin, growing telegraph line ends at the android's right side. The palm emitter is an orange plate on the palm side of the R hand (as in the tutorial's palm stripe) |
| Trigger | A lancer starts charging from \|θ\| > 90°. Staged at +150°, d 260 |
| Anticipation pose | R arm hanging, elbow straight, forearm mid-position (`R.pr 0`, palm facing the thigh). Zoom to 2.0 on the R hand (seen end-on, like the tutorial). ⊙ at the forearm. Panel on the left |
| Question | "A lancer is charging a beam from BEHIND you. Your arm hangs at your side with the palm shield facing your thigh. What forearm movement turns the shield to face backward?" |
| Success + muscles | `R.pr 0 → −90`: the shield plate faces back, the beam hits it and reflects back up the line, and the lancer explodes. pronator_teres **C** |
| Wrong options → animation | **Supination**: the palm turns to face forward; the beam scorches the back of the forearm (armR). **Lateral rotation**: the whole arm rolls outward and the palm turns forward/out; armR. **Rotation**: the trunk turns (the nearest try leaves the shield 60° off the beam line); the beam hits the arm; armR. **Excluded:** Medial rotation (a hanging arm's medial rotation also turns the palm back, so it would work) |
| Timeout | Palm stays facing the thigh; armR |
| Re-ask state | Lancer re-staged and recharging |

**`palmCatch`**

| Field | Content |
|---|---|
| Hazard / art | Lancer front-right charging |
| Trigger | A lancer starts charging from \|θ\| ≤ 90°. Staged at +25°, d 260 |
| Anticipation pose | As `palmShield` |
| Question | "A lancer is charging from IN FRONT. Your palm shield faces your thigh. What forearm movement turns it to face forward?" |
| Success + muscles | `R.pr 0 → +90`, beam reflected. supinator **C**, biceps_brachii **C** |
| Wrong options → animation | **Pronation**: the palm faces back; the beam hits the forearm (armR). **Medial rotation**: the arm rolls inward, the palm turns back; armR. **Excluded:** Lateral rotation (it would turn the palm forward and succeed) |
| Timeout | armR |
| Re-ask state | Re-staged |

**`discWindup`**

| Field | Content |
|---|---|
| Hazard / art | Spotter (a lens drone with a red scanning cone) far out front, painting the android; a lock-on % counts up beside it. A disc launcher is strapped along the R forearm |
| Trigger | A spotter holds position beyond 380 for 3 s (or any elite spotter). Staged at −15°, d 380 |
| Anticipation pose | R upper arm hanging, elbow 90°, forearm forward (`R.rot 0`) — the tutorial's medial/lateral rotation pose. ⊙ at the R shoulder. Panel on the right |
| Question | "Load the disc launcher: keep your elbow tucked at your side and swing the right forearm out to cock it. What movement at the right shoulder?" |
| Success + muscles | `R.rot 0 → +60`, a launcher clack. infraspinatus **C**. Then an **unquestioned** auto-throw (medial rotation, labelled) destroys the spotter |
| Wrong options → animation | **Medial rotation**: the forearm swings in across the belly; the launcher jams against the torso and misfires with sparks; the spotter's lance hits the head (head). **Pronation / Supination**: the forearm twists, the launcher rolls sideways and the disc slides off into the mud; head hit |
| Timeout | Head hit |
| Re-ask state | Spotter re-staged |

**`discThrow`**

| Field | Content |
|---|---|
| Hazard / art | As `discWindup`, with the launcher already cocked |
| Trigger | As `discWindup`. The director prefers `discThrow` right after a correct `discWindup` in a later freeze, to build the sequence |
| Anticipation pose | `R.rot +60` (wound up), elbow 90° at the side. Panel on the right |
| Question | "Launcher cocked. Snap the forearm IN across your body to fling the disc at the spotter. What movement at the right shoulder?" |
| Success + muscles | `R.rot +60 → −40` in 0.12 s; the disc flies tangentially to the spotter and it explodes. subscapularis **C**, pectoralis_major **C**, latissimus_dorsi **C**. Deeper: "a real throw also uses trunk rotation and pronation" |
| Wrong options → animation | **Lateral rotation**: the forearm swings further out to the +90 limit; the disc releases backward and clangs off the transport hull; head hit. **Pronation / Supination**: the forearm twists and the disc spins off sideways into the dirt; head hit |
| Timeout | Head hit |
| Re-ask state | Re-staged, wound up |

**`discSnap`** (contraction)

| Field | Content |
|---|---|
| Hazard / art | As `discThrow`. The launcher's spring is visibly pulling the forearm outward (the load) |
| Trigger | Elite spotter only (tier 3) |
| Anticipation pose | As `discThrow`. The muscles are drawn **white with "SENSORS JAMMED"** during the freeze (the blast-door rule: no colour hint) |
| Question | "To snap the disc out FAST, against the launcher spring, what type of contraction must SUBSCAPULARIS perform?" |
| Success + muscles | As `discThrow`; subscapularis **C** (orange) |
| Wrong options → animation | **Eccentric**: subscapularis glows **E**; the forearm creeps outward under the spring (still working, losing), the disc drops behind; head hit. **Isometric**: glows **I**; the forearm stays frozen at +60, the disc never leaves; head hit |
| Timeout | `as: 'Eccentric'` (no resistance, fast creep); head hit |
| Re-ask state | Re-staged |

**`tetherPull`** (contraction)

| Field | Content |
|---|---|
| Hazard / art | Leech (tether drone) at the right with a taut glowing cable to the R wrist. BOLT (Engineer), or the nearest working ally, runs toward the cable with a cutter. The cable sings and sparks |
| Trigger | A tether lands its hook. Staged at +95°, d 210 |
| Anticipation pose | R upper arm hanging, elbow 90°, forearm forward (`R.rot 0`); the cable tugs outward (toward lateral rotation). Muscles **SENSORS JAMMED** white. ⊙ at the R shoulder. Panel on the left |
| Question | "A tether is yanking your right forearm outward. Hold it exactly where it is while BOLT cuts the cable. What contraction must your shoulder's medial rotators (subscapularis) perform?" |
| Success + muscles | Hold 2.2 s: the angle readout stays "0° … 0°", subscapularis and pectoralis_major **I** (amber) with a steady tremble. BOLT cuts the cable, the Leech whips back into the trees and explodes |
| Wrong options → animation | **Concentric**: subscapularis **C**; the forearm yanks inward (`rot 0 → −70`), reeling the Leech in; it smacks the chest and its net bursts (torso). **Eccentric**: subscapularis **E**; the forearm slowly gives outward (`0 → +70` over 1.2 s, visibly working), the android is dragged 40 px with its feet scraping, and the cable wraps the arm (armR) |
| Timeout | `as: 'Eccentric'`, fast (0.4 s), no resistance; armR |
| Re-ask state | A new Leech is staged and hooked |

**`heavyCatch`** (contraction)

| Field | Content |
|---|---|
| Hazard / art | Ram (big armoured drone, 48 px, battering prow) pressing into the android's raised right palm |
| Trigger | A heavy begins its ram run from \|θ\| ≤ 60°. Staged at +15°, d 100 (in contact) |
| Anticipation pose | R arm raised forward (`R.hz 0`), palm out against the prow; trunk braced. Muscles **SENSORS JAMMED**. ⊙ at the R shoulder. Panel on the left |
| Question | "The Ram is shoving your raised right arm outward and back. To slow it safely, the arm must give way under control. What contraction does PECTORALIS MAJOR perform?" |
| Success + muscles | `R.hz 0 → +70` over 1.0 s, pectoralis_major and deltoid_anterior **E** (blue); the Ram's speed bar drains to 0. Then a concentric shove flips it into the dirt and it explodes. Card: "the arm horizontally abducted while the horizontal adductor lengthened under tension: ECCENTRIC" |
| Wrong options → animation | **Concentric** (and **Isotonic** `as: 'Concentric'`): **C**; the arm punches forward (`0 → −30`) into the Ram, which barely slows; the arm rebounds with sparks (armR). **Isometric**: **I**; the arm stays locked at 0, so the whole android is shoved back 60 px and spun 30°, with feet scraping (torso) |
| Timeout | The arm goes limp; the Ram ploughs through (torso) |
| Re-ask state | Ram re-staged in contact |

**`hipPivot`**

| Field | Content |
|---|---|
| Hazard / art | Snare (a ground crab with clamp jaws) scuttling at the outside of the right forefoot. The camera zooms 2.0 onto the feet; the foot outline and toe direction are drawn bold, with a blade on the outer edge of the forefoot |
| Trigger | A crawler gets within 70 px of the right foot. Staged at +60°, d 70 |
| Anticipation pose | Weight on the left leg; right foot on its heel with the toes forward (`hipR 0`). ⊙ at the **R hip**, with a dashed line down the leg to the heel pivot. Panel on the left |
| Question | "A Snare is at the OUTSIDE of your right foot. Pivot on your heel to swing the toes out and stamp on it. What movement at the right HIP?" |
| Success + muscles | `hipR 0 → +40`, crunch. gluteus_maximus **C** |
| Wrong options → animation | **Medial rotation**: the toes swing in (pigeon-toed) and the Snare clamps the ankle (legR). **Rotation**: the trunk turns but the feet stay put; legR |
| Timeout | legR |
| Re-ask state | Re-staged |

#### 4.4f Ambiguity flags

1. **Hip pivot vs abduction.** Students may feel "move my foot sideways" = abduction. The prompt must name the heel pivot and the hip, and the plane-error card must explain that abduction slides the whole leg sideways about a different axis.
2. **Hanging-arm rotation vs forearm rotation.** Shoulder medial/lateral rotation of a hanging arm also turns the palm. Excluded where it would succeed (Medial rotation in `palmShield`, Lateral rotation in `palmCatch`). The prompts must say "forearm".
3. **`diveBehind` success also shows horizontal abduction** (which is itself a distractor). The card must say that the arm alone hit its limit, and the trunk rotation closed the gap.
4. **The brief's "let a heavy drone down slowly" (vertical lowering) is not readable top-down** (only shadow scale changes). It is replaced by `heavyCatch`: the arm gives way horizontally under load, which the top-down camera shows clearly.
5. **Throw realism.** An overarm throw's wind-up happens with the arm abducted, and top-down it would look like foreshortening only. The level uses the elbow-tucked side-arm flick instead, which is a clean transverse arc. Fail text must not claim this is how a baseball pitch works.
6. **Raised-arm rotation** (the rotation distractors on swat threats) is drawn as foreshortening plus a glove-stripe flip. It is readable, but less clear than a sweep. Fine as a failure, because it obviously does not sweep.
7. **Isotonic** (in `heavyCatch` only) has no unique animation; it plays as concentric, as at the blast door.

### 4.5 Allies

Drawn as small top-down androids (shoulder span 34 px, round head with a coloured visor arc, the role tool held in the hands), reusing the sagittal visor palette. Working animations: wrench spin, welding sparks, scanner sweep. They are drawn below the drone layer, with a status light (green / amber netted / red dragged).

| Role | Name / unit | Visor | Arrives | Repair rate | Ability |
|---|---|---|---|---|---|
| Mechanic | **WRENCH**, UNIT-07 (the friend who stumbled in Factory Escape: continuity) | `#ffb347` | wave 1 | 1.0 /s | Main repairer. `mechanicTorque` raises the rate |
| Medic | **PATCH**, UNIT-12 | `#7dff9a` | wave 1 | 0.3 /s | Heals the android +1 cell every 60 s while working (`medicHeal` shortens this). Rescued allies return 2 s faster |
| Scout | **KITE**, UNIT-03 | `#ff7ad9` | wave 2 | 0.3 /s | Edge chevrons 2 s before each spawn. Workshop **intel** (§4.6e). If KITE ends the wave dragged off: "NO SIGNAL" |
| Engineer | **BOLT**, UNIT-21 | `#b48cff` | wave 4 | 0.3 /s | Builds a turret on FR over the first 20 s: range 220, 1 damage per 2.5 s, only targets scouts and midges. The turret never resolves a freeze |
| Mechanic 2 | **TORQUE**, UNIT-15 | `#ffe066` | wave 6 (needs a free slot) | 1.0 /s | As Mechanic |
| Medic 2 | **SALVE**, UNIT-30 | `#56e0ff` | wave 8 (needs a free slot) | 0.3 /s | As Medic (the heal timers are staggered) |

**Ally slots:** 4 base (`allySlots` upgrade +1/+2/+3, max 6 in camp). A new ally that arrives with no free slot waits "on the radio" and joins when a slot opens.

**Netting and rescue:**

- A netted ally stops working. Its netter tows it toward the nearest spawn-ring bearing at 30 px/s. The **rescue window** is 8 s (`netCutSpeed` extends it). A countdown ring and the text "NETTED 6" are shown on the ally and its chip.
- **Rescue:** click the netted ally (or press R for the nearest). Time slows to 0.5× (not a full freeze) and a quick 3-option prompt appears: `C.DRONE_UI.rescuePrompt` with a movement drawn from `C.MOVEMENT_PLANE`, options = the three plane names (content-driven, so always accurate). Correct → a cutter disc slices the net, the netter explodes, the ally runs back to its spot, and **+1 energy cell** (cap max). Wrong → the prompt shakes, a 2 s lockout, then retry with a new movement (the window keeps running). Killing the towing netter in real time also frees the ally (+1 cell).
- **Dragged off:** if the window expires, the ally vanishes into the trees ("UNIT-03 TAKEN"). It is gone for the rest of the wave and **returns at the start of the next wave** ("UNIT-03 escaped and found its way back!"). If **every** ally is dragged off, the repair stalls: **WAVE FAILED: NO CREW** (same restart rules as shutdown).
- Rescue answers are logged (topic planes_axes) but do not change Calibration (too easy to farm).

**Banter** (`C.DRONE_BANTER`, content owned, not curriculum; silenced during freezes and never hinting at an answer). Samples: WRENCH "Fuel line's a mess. Keep them off my back!"; KITE "Contacts north-east, lots of them!"; PATCH on a heal "Hold still, patching your cells."; BOLT "Turret's online. It shoots small stuff only, sorry."; a rescued ally "Thanks! That net smelled like the factory."; Warden arrival, all allies "...that's a big one."

### 4.6 Workshop (between waves)

Opens after every cleared wave (and is optional before retrying a failed wave). Target time is about 2 min. It has three tabs: **TERMINAL → UPGRADES → LOADOUT**, then a **DEPLOY** button. Scout intel is pinned on the right side throughout.

#### 4.6a Exam terminal

- **6 items per visit.** First come up to **2 due Fault Log items** (tagged "FAULT LOG"), then new items. Topic choice for new items: 50% from the topic with the lowest Calibration, the rest random. Difficulty band by wave: waves 1–2 = d1–2, waves 3–6 = d1–3, waves 7+ = d2–3.
- **Untimed** by default (exam style, reading time matters). Optional **OVERCLOCK** toggle per visit: 25 s per item, ×1.5 scrap, and a timeout counts as wrong.
- **Scrap:** d1 = 10, d2 = 18, d3 = 30. **Streak multiplier** `1 + 0.2·min(streak, 5)` (cap ×2.0); the streak persists across visits until a wrong answer. Fault cleared (§4.6b) = +25 bonus. Freeze answers in waves give +5 each. A cleared wave gives a flat +20, so a student never stalls completely.
- **After each answer:** the correct option is highlighted, `explain` is shown, and if wrong, `whyWrong[chosen]` too. Keys 1–4 / A–D answer, Enter continues.
- **No repeats until due:** an item answered correctly (outside the Fault Log) is ineligible for **8 visits** (`seenAt[id]`). If the eligible pool runs dry, the oldest-seen item is used first.
- A visit summary shows scrap earned, the streak, and faults added or cleared.

#### 4.6b Fault Log (spaced retrieval)

Each wrong item goes into the log as `{ id, box: 1, due: visit + 1 }`. When a due item is answered correctly, it moves up a box: box 2 is due +2 visits, box 3 is due +4 visits, and a correct answer at box 3 **clears** it (+25 scrap, a "FAULT CLEARED" stamp). A wrong answer sends it back to box 1, due next visit. Wrong freeze answers in waves also add a fault: the linked MCQ topic gets a matching item (`topic: 'joint_actions'` for movement threats, `'contractions'` for contraction threats) chosen by the engine from the bank.

#### 4.6c MCQ data contract (content agent fills)

```js
C.MCQ_BANK = [{
  id: 'pa_001',                 // unique, stable (used by saves)
  topic: 'planes_axes' | 'joint_actions' | 'contractions' | 'agonist_antagonist' | 'muscle_actions' | 'joints_levers',
  difficulty: 1 | 2 | 3,
  stem: '…',                    // IB SEHS Paper 1 style
  options: ['A text', 'B text', 'C text', 'D text'],
  answer: 2,                    // index 0..3
  explain: '…',
  whyWrong: ['…', '…', null, '…'],  // null at the answer index
}];
```

Target: at least 15 items per topic (90+), with roughly 40% d1, 40% d2, 20% d3, and a transverse emphasis within joint_actions and planes_axes. Option order is shuffled by the engine (`answer` is remapped). **Ambiguity flag:** items whose options say "all of the above" / "A and B" must not be shuffled; give them `fixedOrder: true`.

#### 4.6d Upgrades (`C.UPGRADES`)

The ids, effects, costs and power are **engine-defined here**. The content agent writes only `name`, `muscle` and `desc`. Effects are absolute values per level (not cumulative); the engine sums active upgrades into `loadout.fx` with these defaults: `freezeBonus 0, sweepArc 60, spinDmg 2, pulseDmg 1, pulseRadius 60, swatDmg 1, swatKnock 40, windupMul 1, discDmg 2, discPierce 0, backhandReach 0, netCutWindow 8, turnRate 1, allySlots 4, maxEnergy 5, medicHealEvery 60, repairMul 1, turretDmg 1, turretRate 2.5, earlyWarning 0, comboKeep 3`.

| id | Suggested name (content may rename) | Muscle theme | L1 / L2 / L3 effect | Cost L1/L2/L3 (scrap) | Power L1/L2/L3 |
|---|---|---|---|---|---|
| `rotatorCuffServos` | Rotator Cuff Servos | rotator cuff | `freezeBonus` 1 / 2 / 3 s | 80 / 160 / 260 | 2 / 3 / 4 |
| `obliqueDrive` | Oblique Drive | obliques | `sweepArc` 80 / 100 / 120°; `spinDmg` 2 / 3 / 3 | 60 / 130 / 220 | 1 / 2 / 3 |
| `pronatorCoil` | Pronator Coil | pronator teres | `pulseDmg` 2 / 3 / 4; `pulseRadius` 75 / 90 / 105 | 40 / 90 / 160 | 1 / 2 / 3 |
| `pecMajorActuator` | Pec Major Actuator | pectoralis major | `swatDmg` 2 / 3 / 4; `swatKnock` 70 / 100 / 130 | 60 / 130 / 220 | 1 / 2 / 3 |
| `infraspinatusSpring` | Infraspinatus Spring | infraspinatus | `windupMul` 0.8 / 0.65 / 0.5 (disc wind-up time and disc cooldown) | 40 / 90 / 160 | 1 / 2 / 3 |
| `subscapularisLauncher` | Subscapularis Launcher | subscapularis | `discDmg` 3 / 4 / 5; `discPierce` 0 / 1 / 2 | 60 / 130 / 220 | 1 / 2 / 3 |
| `rearDeltGuard` | Rear Delt Guard | posterior deltoid | `backhandReach` +20 / +35 / +50 px; `netCutWindow` 10 / 12 / 14 s | 40 / 90 / 160 | 1 / 2 / 3 |
| `glutePivot` | Glute Pivot Bearings | gluteus maximus | `turnRate` 1.25 / 1.5 / 1.8 | 40 / 90 / 160 | 1 / 2 / 3 |
| `allyUplink` | Ally Uplink | (radio) | `allySlots` 5 / 6 / 6, plus newcomers arrive one wave earlier at L3 | 100 / 200 / 320 | 2 / 3 / 4 |
| `reinforcedFrame` | Reinforced Frame | skeleton | `maxEnergy` 6 / 7 / 8 (hard cap 8) | 100 / 200 / 320 | 2 / 3 / 4 |
| `medicProtocol` | Medic Protocol | (ally) | `medicHealEvery` 45 / 35 / 25 s | 60 / 130 / 220 | 1 / 2 / 3 |
| `mechanicTorque` | Mechanic Torque Wrench | (ally, lever theme) | `repairMul` 1.15 / 1.3 / 1.45 | 60 / 130 / 220 | 1 / 2 / 3 |
| `engineerTurret` | Turret Mk II | (ally) | `turretDmg` 1 / 2 / 2; `turretRate` 2.0 / 1.6 / 1.2 s | 60 / 130 / 220 | 1 / 2 / 3 |
| `spindleSensors` | Muscle Spindle Sensors | muscle spindles (proprioception) | `earlyWarning` 60 / 120 / 180 px: threat triggers telegraph that much earlier (more planning time before the freeze) | 40 / 90 / 160 | 1 / 2 / 3 |
| `tendonCapacitor` | Tendon Capacitor | tendons (elastic energy) | `comboKeep` 4.5 / 6 / 8 s (combo drain time) | 40 / 90 / 160 | 1 / 2 / 3 |

Content contract: `C.UPGRADES = [{ id, name, muscle, desc, levels: [{cost, power, effect: {...}}, ×3] }]`. The engine owns `levels`; if content ships them, the engine values above win (the engine asserts that the ids match and warns on mismatch).

Full tree cost ≈ 5,400 scrap. At about 150–200 scrap per visit, that is roughly 30 visits, which supports many return sessions.

#### 4.6e Loadout, POWER BUDGET, Calibration, Scout intel

- **Loadout:** every owned upgrade can be slotted at any owned level (running a lower level costs less power). The power meter shows "POWER 7/9". DEPLOY is disabled while over budget.
- **Budget:** `budget = min(14, 4 + floor(0.75 · highestWaveCleared))`, **+1 "OPTIMISED" bonus** while every topic's Calibration is ≥ 80%. So learning the content literally raises the robot's power.
- **Calibration %** per topic = correct / attempts over the **last 10** terminal attempts in that topic, × `min(1, attempts/5)` (so 2/2 does not count as 100%). It shows as six gauges, each naming its linked system:

| Topic | Boosts (multiplier = 1 + k·cal) |
|---|---|
| planes_axes | Freeze timer +1.0·cal s ("axis lock") |
| joint_actions | Swat, backhand, disc and spin damage ×(1 + 0.3·cal) |
| contractions | Real-time tether pull and heavy shove strength ×(1 − 0.3·cal); success holds finish 30% faster at cal ≥ 0.8 |
| agonist_antagonist | Combo drain time ×(1 + 0.5·cal); OVERDRIVE lasts 4 → 6 s at cal 1 |
| muscle_actions | Crit chance 0–20% ("muscle surge": ×2 damage with a bright glow) |
| joints_levers | Repair rate ×(1 + 0.2·cal) and turret rate ×(1 + 0.2·cal) ("better leverage on the tools") |

- **Scout intel** (needs KITE in camp at the end of the last wave): next wave's drone icons with counts, any **NEW** type highlighted with a one-line warning ("RAMS: heavy, they shove; get ready to catch them"), side weights as a compass rose ("most from the EAST"), likely freeze kinds ("expect contraction threats"), and "WARDEN INBOUND" before boss waves. Without KITE: static and "NO SIGNAL". Intel never reveals answers.

### 4.7 Drone roster

| id | Name / silhouette | Size | Speed (px/s) | HP | Behaviour | First wave | Threat ids triggered |
|---|---|---|---|---|---|---|---|
| `scout` | Gnat: tri-rotor, green blink | 24 | 95 | 1 | Darts to a random ally and bumps it (that ally pauses 2 s), then flees. Fodder and combo food | 1 | none |
| `netter` | Netter: quad with a glowing net pod | 32 | 70 | 2 | Targets the nearest working ally, hovers 90 px away, 1.2 s net charge, then nets. Then tows the ally | 1 | `netterOnAlly_left`, `netterOnAlly_right` |
| `diver` | Hornet: wasp body, afterburner | 28 | orbit 60 at r 280, dive 320 | 2 | Circles, then dives at the android (contact = ½ cell) | 2 | `crossSwat`, `backhandSwat`, `diveBehind` |
| `lancer` | Lancer: long nose, charge glow | 30 | 50 | 2 | Stops at 260, charges a 2.5 s telegraphed beam (½ cell; auto shield flip blocks it if ready) | 3 | `palmShield`, `palmCatch` |
| `tether` | Leech: tentacle reel | 34 | 55 | 3 | Stops at 220, 2 s telegraph, hooks an arm. A hooked arm can't strike and the android is pulled 10 px/s until the Leech is killed | 4 | `tetherPull` |
| `swarm` | Midges: pack of 5 mini rotors | 16 each | 110 | 1 each | Arrive in an arc formation, then each one nets the android (½ cell per contact) | 4 | `spineTwist` |
| `spotter` | Spotter: lens and scanning cone | 26 | 40 | 2 | Hovers at 380–440 (out of melee). Marks a target: the marked one takes double chip damage, and every 8 s it calls 2 scouts | 6 | `discWindup`, `discThrow`, `discSnap` (elite) |
| `heavy` | Ram: armoured, battering prow | 48 | 45 (ram 180) | 6 | Swats do half damage. Ram run = 1 cell and a 60 px shove | 7 | `heavyCatch` |
| `crawler` | Snare: ground crab, clamp jaws | 22 | 40 | 2 | Walks on the ground to a foot. Contact snares it: turning stops for 4 s | 8 | `hipPivot` |
| `jammer` | Jammer: spiky dish, static rings | 36 | 60 | 4 | Aura r 160: auto-actions are off inside it, and the HUD axis tag glitches (cosmetic only, never hides question text). Within 200 it triggers **any** threat in the pool ("SIGNAL SCRAMBLED") | 9 | any |
| `warden` | **The Warden**: boss (§4.8) | 140 | 30 orbit | 3 plates | Boss | 5, 10, 15… | chains |

**Elite modifier** (wave 6+, chance `10% + 2%/wave`, cap 40%): any type gets a gold rim and a crown spike, +2 HP, and **always** triggers its type's threat (forced by the director, still within the freeze target). Silhouettes are distinct so type is never shown by colour alone.

### 4.8 The Warden (boss every 5 waves)

A huge hexagonal factory drone with three armour **plates** (front, left, right), a searchlight sweeping the camp, and a rumbling bass drone. It orbits at d 300 and launches **phases**: each phase is a **chain of 2 freezes** back to back (no 12 s gap; a 2 s breather between them), using its own pool:

| Phase | Chain | Plate cracked |
|---|---|---|
| 1 | `diveBehind` → `crossSwat` (it fires a diver pod) | front |
| 2 | `tetherPull` → `discThrow` (it hooks the android, then retreats out of reach) | left |
| 3 | `palmShield` → `spineTwist` (rear beam, then a midge burst) | right → core exposed → **finale**: slow-mo, mega explosion, all allies cheer, +1 cell |

Warden II (wave 10) and later Wardens use tier-3 substitutes: `heavyCatch` for `crossSwat`, `discSnap` for `discThrow`, `hipPivot` for `spineTwist`. Timer = wave base − 1 s. A wrong answer in a chain applies the normal damage, the plate re-seals, and that phase repeats after 10 s with the failed id first. Boss waves need the Warden destroyed **and** repair at 100% (repair need is lowered to 120). Warden HP scales by +1 plate chain per 10 waves in endless mode (a 3-freeze chain at wave 15+).

### 4.9 Waves, difficulty and pacing

Repair need per wave: `160 + 25·(wave − 1)` units (boss waves 120). Base repair rate with WRENCH + PATCH = 1.3 /s. Target real-time length is 120–150 s, plus freezes (about 15 s each, card included).

| Wave | Subsystem | New | Drones (total) | Spawn interval (s) | Side weights | Freeze target | Threat pool | Timer base (s) | Allies |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Tyres | scout, netter | 14 | 8.5 | N only | 3 | `netterOnAlly_left/right` | 9.0 | WRENCH, PATCH |
| 2 | Fuel line | diver | 18 | 7.0 | N, E, W | 3 | + `crossSwat`, `backhandSwat`, `diveBehind` | 8.6 | + KITE |
| 3 | Battery | lancer | 20 | 6.5 | all, N heavy | 4 | + `palmShield`, `palmCatch` | 8.2 | |
| 4 | Steering | tether, swarm | 22 | 6.0 | all | 4 | + `tetherPull`, `spineTwist` | 7.8 | + BOLT |
| 5 | Armour plates | **WARDEN I** | 12 + boss | 8.0 | all | 6 (chains) | Warden pool | 7.4 (−1) | |
| 6 | Radiator | spotter, elites | 24 | 5.6 | all | 5 | + `discWindup`, `discThrow` | 7.0 | + TORQUE (if a slot is free) |
| 7 | Axle | heavy | 26 | 5.3 | all, S heavier | 5 | + `heavyCatch` | 6.6 | |
| 8 | Headlights | crawler | 28 | 5.0 | all | 5 | + `hipPivot` | 6.2 | + SALVE (if a slot is free) |
| 9 | Ignition | jammer | 30 | 4.7 | all | 6 | + `discSnap`, all | 5.8 | |
| 10 | Engine core | **WARDEN II** | 16 + boss | 6.0 | all | 6 (chains) | tier-3 Warden pool | 5.4 (−1) | |

**Wave 10 clear = chapter ending:** the transport roars to life and drives into the forest with everyone aboard ("ESCAPE COMPLETE"). Then the **endless mode** "Night 2+" starts: the transport breaks down further along the road, and new subsystems are generated from a list.

**Endless (wave n ≥ 11):** drones `30 + 2(n − 10)`; speed ×`min(1.5, 1 + 0.03(n − 10))`; freeze target `min(8, 6 + floor((n − 10)/3))`; timer base `max(5, 5.5 − 0.1(n − 10))`; all threats, weighted toward the lowest-accuracy ones in this save (50%); elite chance per the formula above; Warden every 5 waves.

**Session target:** wave about 2.5–3 min + workshop about 2 min ≈ **5 min**. A class period fits 6–8 waves.

**Win / lose per wave:** win = repair reaches 100% (plus the Warden on boss waves): drones retreat, a subsystem-fixed stinger plays, and a wave summary shows (freezes right/wrong, rescues, combo best, scrap). Lose = shutdown (energy 0) or NO CREW: restart the same wave (the workshop is optional first). **Best-wave record** = the highest wave cleared, shown on the level card and the wave summary ("NEW RECORD").

### 4.10 Save system

- Key `kinetic-escape-drone-v1` (settings keep using `kinetic-escape-settings`). All reads and writes are wrapped in try/catch; on failure the game runs unsaved, with a small "progress not saved" tag.
- Saved at every workshop entry and every DEPLOY: `{ v: 1, wave, bestWave, scrap, upgrades: {id: level}, loadout: {id: level}, faultLog: [{id, box, due}], visit, seenAt: {mcqId: visit}, calib: {topic: [1,0,…] /* last 10 */}, reaskQueue: [threatId], threatStats: {id: {seen, firstTryCorrect, streak}}, lifetime: {waves, rescues, wardens, playMs} }`.
- Unknown ids (e.g. after a content edit) are dropped silently. An MCQ id missing from the bank is removed from `seenAt` and `faultLog`.
- The menu shows **Continue (wave N)** and **New defense**. New defense resets the wave, scrap, upgrades and loadout, but **keeps** the Fault Log, Calibration and threatStats (learning data). A "Reset all" sits behind a confirm.

### 4.11 End-of-session report

Shown on "End session" from pause or from any wave summary.

- Waves cleared this session, best wave, play time, rescues, Wardens destroyed.
- **Accuracy per MCQ topic** (session and lifetime) with the Calibration gauges.
- **Transverse actions mastered**: a grid of the 7 transverse movements (medial rotation, lateral rotation, rotation, pronation, supination, horizontal abduction, horizontal adduction) plus the 3 contraction types. A cell is **MASTERED** after 3 consecutive first-try correct freezes on threats with that correct answer; **PRACTISING** with 1–2; **REVIEW** after any error in the last 3. Each cell shows text, not only colour.
- **Review targets** by error class (as in the §3 taxonomy): plane errors, in-plane mix-ups (with the most-confused pair, e.g. "horizontal abduction ↔ adduction ×3"), contraction errors, timeouts. Each has a link to the matching tutorial page.
- A **Copy report** button copies plain text to the clipboard for the teacher.

### 4.12 Accessibility and teacher analytics

- **Keyboard-only:** everything in §4.2b. Focus order in the workshop: tabs → list → buttons.
- **Colour is never the only cue:** drone types use distinct silhouettes; the target ring is a shape plus brackets; netted allies show a net pattern plus "NETTED" plus a number; C/E/I letters in the monitor; energy as text; Calibration gauges with % numbers; the mastery grid in words.
- **Reduced effects** (setting or `prefers-reduced-motion`): shake 25%, flashes 30%, glitch reduced, hit-stop off, no visor flicker, the OVERDRIVE pulse replaced with a static glow. Time dilation is kept (it is the teaching moment).
- **Assist mode** (teacher setting, off by default): freeze timers ×1.5, drone speed ×0.8, rescue window +4 s. Shown in the report as "assist on".
- **Projector readability:** threat drone ≥ 40 px on screen during a freeze (zoom guarantees it), all freeze text ≥ 20 px, panel contrast as in Factory Escape.
- **Analytics hooks:** `level.stats.log.push({ t, wave, source: 'threat'|'mcq'|'rescue', id, topic, kind, choice, correct, result: 'correct'|'inplane'|'plane'|'contraction'|'timeout', rtMs, reask, assist })`. The last 500 entries are mirrored to `kinetic-escape-drone-log-v1` (try/catch). `window.game.level` exposes `stats`, and the report builder reads only from it. There is no network access.

### 4.13 Tutorial (`TUTORIALS.transverse`) and review sheet

- **Page 1 (planes & axes):** unchanged; the callout reads "the screen is this game's plane: you look DOWN on the android".
- **Page 2 (movements):** keep the 7 existing `TOP` demos. **Add**: `'Hip rotation'` (foot direction top-down: the toes turn out = lateral, in = medial, with a heel pivot ⊙ at the hip), `'Disc flick'` (lateral-rotation wind-up → medial-rotation snap, two labelled phases), and `'Midline'` (the same arm doing horizontal abduction on the left and horizontal adduction on the right, to teach "relative to the midline, not the screen"). These are demo keys, not new movement names, so `C.PLANES.transverse.movements` is unchanged.
- **Page 3 (contractions):** keep the curl demos; add two top-down captions/demos: the **tether hold** (isometric: forearm angle stays at 0°) and the **Ram catch** (eccentric: the arm gives way while the pectoralis major lengthens).
- **Page 4 (muscles):** `LEVEL_MUSCLES.transverse` plus deltoid_anterior, gluteus_maximus and the hip medial rotators entry.
- **Page 5 (how to play):** replace the PAUSED lines with: the camp and the goal; targeting controls; that auto-strikes are labelled transverse actions; freeze rules (wrong in-plane = it does exactly that and misses, wrong plane = malfunction, timeout = hesitation; the threat comes back later); energy and chips; netting and rescue (+1 cell); the workshop (terminal → scrap → upgrades → power budget; the Fault Log comes back; Calibration powers systems); the Warden every 5 waves.
- **Review sheet:** add a transverse movement table with the matching drone action ("cross swat = horizontal adduction"), and 4 more self-checks (e.g. "Swinging a raised arm across the chest is…", "Turning the palm to face backward with the arm by your side is…", "Holding the forearm still against a pull: which contraction?", "Which axis does the transverse plane rotate about?" with the answer listing `axisAllNames('transverse')`).
- **Headless test:** `node tools/playtest-transverse.js out <threatIds|all> <correct|wrong|wrong2|plane|timeout> [--mcq N] [--wave W]` drives `level.debug.forceThreat(id)`, `level.choose(i)`, `level.debug.endWave()` and `workshop.debug.answer(i)`. It must print `no errors` and write screenshots of each freeze (to check panel placement against the joints), each outcome, the workshop and the report.

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
