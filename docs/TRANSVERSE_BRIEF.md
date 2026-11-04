# Drone Defense: producer brief (teacher un-paused 2026-11-04)

Teacher rules, in priority order:
1. **Educational:** it teaches transverse-plane actions about the longitudinal axis.
2. **Entertaining.**
3. **Sustainably engaging:** players return and play many waves.

Beyond those rules: "go bananas". Match the vibe of Factory Escape: dark industrial sci-fi, time dilation at decisions, muscles that swell and glow, crack and glitch on wrong-plane errors, synthesised audio.

Required by the teacher:
- **Ally androids.**
- **Teaches transverse actions.**
- **An upgrade and optimisation system.** It rewards correct answers to SEHS **exam-style multiple-choice** questions.

## Story
- **Setting:** the night after the escape, OUTSIDE the factory, at a scrapyard on the edge of a forest.
- **The camp:** the android and its friends (the allies who escaped with it) hold out at a wrecked transport. The allies are repairing it to drive away.
- **The threat:** the factory sends waves of capture drones that try to net the allies and the android.
- **Goal of each wave:** keep the drones off while the repair bar fills.

## Camera = plane
- **View:** top-down. The screen IS the transverse plane, and the longitudinal axis points out of the screen (⊙).
- **Axis names:** rotate them with `C.axisName('transverse')`.

## Core loop (one wave is about 2–3 minutes)
1. **Real-time phase (light action).**
   - The android stands at the centre of the camp.
   - Drones fly in from any direction around the circle.
   - The player clicks or taps a drone, or uses the arrow keys or A/D, to choose a target.
   - The android then deals with routine drones automatically, using transverse-plane actions that are animated with muscles.
   - The allies work on the transport, and the repair bar fills.
2. **Threat freeze (the teaching moment).**
   - **Trigger:** an elite drone, a drone about to net an ally, or a drone diving at the android.
   - **What happens:** time dilates and the tension effects play, as in Factory Escape. The student chooses the action.
   - **Movement questions** use transverse actions:
     - rotation (trunk / spine)
     - medial and lateral rotation (shoulder, hip)
     - horizontal abduction and adduction (shoulder)
     - pronation and supination (forearm / radio-ulnar joint)
   - **Contraction questions** appear sometimes. Examples: bracing against a tether pull is isometric; letting a heavy net-drone down slowly is eccentric; a fast throw is concentric.
   - **Correct:** the action plays, for example a trunk rotation plus a horizontal-adduction swat, or a lateral-rotation wind-up then a medial-rotation disc throw. The drone is destroyed and the muscles glow.
   - **Wrong, but a transverse action:** the android does exactly the chosen action and visibly misses (it turns the wrong way, or the palm faces the wrong way). Consequence: the ally is netted, or the android takes a hit.
   - **Wrong plane** (flexion, abduction and so on): malfunction, screen crack and glitch, as in Factory Escape.
3. **Consequences**
   - **Energy:** 5 cells, as in Factory Escape. A hit costs 1 cell. At 0 the android shuts down and the wave restarts.
   - **Netted allies:** the student frees them with a quick follow-up question or click. A freed ally gives +1 cell.
   - **No full explosions of the player** in this level; damage is partial. Drones explode freely.
4. **Ally androids**
   - There are named ally types, each with a clear gameplay role:
     - **Mechanic:** speeds up the repair.
     - **Medic:** restores energy.
     - **Scout:** marks the side the next drones will come from.
     - **Engineer:** builds a small auto-turret.
   - New allies arrive as waves go on.
   - Allies can be netted and dragged off if not rescued in time. A rescued ally comes back.
5. **Workshop between waves (upgrade and optimise)**
   - **Exam terminal:** SEHS exam-style MCQs (IB SEHS Paper 1 style, options A–D). The bank covers:
     - planes and axes
     - joint actions in all planes
     - contraction types
     - agonist / antagonist pairs
     - muscle actions
     - types of joints and levers, if included
   - **Earning scrap:** correct answers earn SCRAP. A streak multiplies it, and harder questions pay more.
   - **Fault Log (spaced retrieval):** wrong answers go into the Fault Log and come back in later workshops. Clearing a fault pays bonus scrap.
   - **Upgrade tree:** scrap is spent on upgrades with an anatomy theme. Example names:
     - **Rotator Cuff Servos:** longer decision timer
     - **Oblique Drive:** wider trunk-rotation sweep, so it hits more drones
     - **Pronator Coil:** stronger palm pulse
     - **Pec Major Actuator:** stronger swat
     - **Ally Uplink:** one more ally slot
     - **Reinforced Frame:** +1 max energy, capped
   - **Optimisation:** a limited POWER BUDGET means only some upgrades can be active at once. The player must tune a loadout for the next wave, and the Scout's intel says what is coming.
   - **Calibration:** each topic has a calibration % based on recent MCQ accuracy. Calibration boosts the related systems, so learning the content literally optimises the robot.
6. **Sustainable engagement**
   - endless waves with rising difficulty and new drone types
   - a best-wave record
   - progress saved in localStorage (wrapped in try/catch)
   - short sessions: one wave plus one workshop takes about 5 minutes
   - mixed question types, and no repeated item until its spacing is due

## Technical constraints
These are the same as the rest of the repo:
- Plain scripts on `window.SEHS`, no modules, no build, no external assets, and it must run from `file://`.
- All curriculum wording goes in `js/content.js`.
- Every option must have defined feedback.
- The tutorial (`js/tutorial.js`, `TUTORIALS.transverse`) runs before the game, and the review sheet must cover the new content.
- `tools/playtest.js` (or a sibling `tools/playtest-transverse.js`) must be able to drive the level headless and print `no errors`.
