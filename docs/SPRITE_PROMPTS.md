# Sprite prompts for the android (one set per game)

Paste these into an image AI (Midjourney, DALL·E, Firefly, Leonardo, Ideogram…) to generate art for the android. Then drop the files into this repo (or send them to Claude), and they will be wired in.

## How the game uses sprites (read this first)

The game **draws the muscles itself**, so it can swell them and colour them by contraction type (concentric, eccentric, isometric). Because of that:

- Sprites replace only the **metal skeleton, shell and head**. Generate them **without muscles**: a bare robotic endoskeleton, a little like an X-ray.
- The android is animated like a puppet. Each body part is a **separate image** that the game rotates at its joints, so every part must:
  - be drawn **straight**, at a neutral angle, in a fixed orientation (specified below)
  - sit on a **transparent background**, alone, uncropped, with nothing else in the image
  - have its joint centres at **predictable positions** in the image, so the game knows where to pin it

AI generators are not pixel-perfect. Small errors are fine. Open `index.html?sprites=debug` and the game shows its pin points, and the numbers can be adjusted in `assets/sprites/manifest.js` (or Claude can do it).

If your AI tool can only produce one image at a time, that's fine. If it can only produce *sheets*, ask for an evenly spaced grid with one part per cell and say so when you hand it over. It can be sliced.

---

## 0. Style bible (paste this at the start of EVERY prompt)

> **Style:** clean semi-realistic sci-fi game art, 2D, flat orthographic view (no perspective), crisp dark outline (about 2 px at 512 px), soft cel shading lit from the top-left, no cast shadow, no background (transparent PNG), no text, no watermark.
>
> **Character:** "the android", a humanoid robot endoskeleton built to human proportions (about 1.75 m tall, athletic adult). Brushed-titanium bones shaped like real human bones (femur, tibia, humerus, radius/ulna, ribcage, spine, pelvis), dark graphite joint housings with hex-bolt caps at every joint, thin cyan power lines running along the bones, and a small glowing cyan power core in the centre of the chest. The head is a smooth gunmetal skull-helmet with a narrow horizontal cyan visor, a dark jaw plate, a round ear module and a short antenna. **No skin, no armour panels over the limbs, no muscles.** The limbs must stay thin and skeletal, because red muscles are drawn on top later. Colour palette: titanium #AAB5C0, graphite #4C5763, outline #161B22, accents cyan #56E0FF.

## 1. Character reference sheet (do this first to lock the design)

> [STYLE BIBLE] Character turnaround reference sheet of the android standing in anatomical position (arms at its sides, palms facing forward, feet together). Show four orthographic views side by side, all at the same scale on a plain light-grey background: **right side view (facing right)**, **front view**, **back view**, and **top-down view**. Label nothing.

Keep the best result. In every later prompt, attach it as the reference image or "character reference" ("--cref" in Midjourney, "image reference" in others), and add *"match the attached character exactly"*.

Optional menu/poster art (this one MAY show muscles):

> [STYLE BIBLE, but replace "no muscles" with "anatomically correct red human muscles (quadriceps, hamstrings, gastrocnemius, gluteus maximus, deltoid, biceps, triceps…) attached over the metal skeleton, some glowing orange"] Dynamic side view of the android sprinting through a dark industrial factory with red alarm lights, motion blur in the background, cinematic.

---

## 2. Factory Escape (sagittal plane): SIDE VIEW part set ✅ used now

All parts are seen from the **android's right side, facing RIGHT**. Generate each as its own **transparent PNG**:

| File name | Part | Canvas | Orientation and joint positions (the game pins these) |
|---|---|---|---|
| `torso.png` | Pelvis + spine + ribcage + chest core, side view | 512 × 1024 | Upright. **Hip-joint centre** at 50% across, 88% down. **Base of the neck** at 50% across, 10% down. Chest faces right |
| `head.png` | Head **including the neck** | 512 × 512 | Facing right. **Bottom of the neck** at 42% across, 94% down. **Top of the skull** at 42% across, 6% down |
| `upper_arm.png` | Humerus segment | 256 × 512 | Vertical. **Shoulder joint** centre at top-centre (50%, 12.5%), **elbow joint** at bottom-centre (50%, 87.5%) |
| `forearm.png` | Radius/ulna segment | 256 × 512 | Vertical. **Elbow** at top-centre (50%, 12.5%), **wrist** at bottom-centre (50%, 87.5%) |
| `hand.png` | Closed fist, side view | 256 × 512 | Vertical, fingers pointing down. **Wrist** at (50%, 15%), **knuckles** at (50%, 85%) |
| `thigh.png` | Femur segment | 256 × 512 | Vertical. **Hip joint** at (50%, 12.5%), **knee joint** at (50%, 87.5%) |
| `shank.png` | Tibia/fibula segment | 256 × 512 | Vertical. **Knee** at (50%, 12.5%), **ankle** at (50%, 87.5%) |
| `foot.png` | Foot, side view, toes pointing right | 512 × 256 | Flat on the ground. **Ankle joint** at (28%, 30%), **tip of the toes** at (92%, 78%) |

**Prompt template** (run it once per row, filling in the brackets):

> [STYLE BIBLE] Single game sprite part on a transparent background: the android's **[PART]**, seen exactly from the side (orthographic, right side view). [ORIENTATION, e.g. "drawn perfectly vertical, joint at the top and joint at the bottom, centred"]. The [upper joint] housing is a round bolt cap centred at the top and the [lower joint] housing is centred at the bottom. Leave empty margin around it. Only this one part, nothing else. Match the attached character reference exactly. [CANVAS] pixels.

**Rival androids:** the same parts are reused, and the game tints only the visor colour. No extra sprites are needed. For fully distinct rivals, re-run the set with *"same design but scuffed orange-and-black hazard paint on the bones"*.

**Install:** copy the files into `assets/sprites/sagittal/`, set `enabled: true` in `assets/sprites/manifest.js`, then open `index.html?sprites=debug`. Green dots should sit on the near (proximal) joint and magenta dots on the far (distal) joint. Adjust `pivot`/`tip` until they do.

---

## 3. Precision Lab (frontal plane): BACK VIEW part set 🛠 for the next level

The camera looks at the android's **back** (so its left and right match the student's). The frontal-plane movements here are abduction, adduction and lateral flexion, and they rotate the limbs **within** the picture, so parts are drawn from behind:

| File name | Part | Canvas | Orientation |
|---|---|---|---|
| `torso_back.png` | Pelvis + spine + ribcage + shoulder blades, back view | 1024 × 1024 | Upright and symmetrical. Hip line at 85% down, neck base at 8% down, shoulder joints at 18% and 82% across, 20% down |
| `head_back.png` | Back of the head + neck | 512 × 512 | Neck bottom at (50%, 94%), crown at (50%, 6%) |
| `upper_arm_back.png`, `forearm_back.png` | Arm segments, back view | 256 × 512 | Vertical, joints at top-centre and bottom-centre (12.5% / 87.5%) |
| `hand_back_palm.png`, `hand_back_dorsum.png` | Open hand: palm side, and back-of-hand side | 256 × 512 | Fingers pointing down, wrist at top-centre. Two versions are needed for the palm (pronation/supination) step |
| `thigh_back.png`, `shank_back.png` | Leg segments, back view | 256 × 512 | Vertical, joints at top-centre and bottom-centre |
| `foot_back.png` | Heel and sole seen from behind | 256 × 256 | Ankle at (50%, 25%), sole flat along the bottom edge |

Extra scene sprites for this level (same style bible; these MAY include clothing):

> Two lab scientists in white coats and safety goggles behind an observation window, seen from the waist up, one with a hand on a big red shock button, clipboard, sterile blue lighting, transparent background. Make one version calm and one version pressing the button.

> A climbing test wall panel tile with metal hand holds and round push-buttons (unlit and lit-green versions), flat front view, seamless tile, 512 × 512.

> A blue-white electric shock arc effect sprite sheet, 6 frames in a row, transparent background.

---

## 4. Drone Defense (transverse plane): TOP-DOWN part set ⏸ paused level

Only generate this when the level is un-paused. The camera looks straight down on the android's head and shoulders:

| File name | Part | Canvas | Orientation |
|---|---|---|---|
| `torso_top.png` | Shoulders and chest seen from above, front of the body facing UP the image | 1024 × 512 | Shoulder joints at 12% and 88% across, 50% down |
| `head_top.png` | Top of the head, visor edge facing up | 256 × 256 | Centred |
| `upper_arm_top.png`, `forearm_top.png` | Arm segments seen from above | 256 × 512 | Vertical, joints at top-centre and bottom-centre |
| `hand_top_palm.png`, `hand_top_dorsum.png` | Hand seen from above, palm up and palm down | 256 × 256 | Wrist at top-centre |

> [STYLE BIBLE] Small hovering capture drone seen from directly above, four rotors, red sensor eye, net launcher, transparent background, 512 × 512. Also a version with the net deployed.

---

## 5. Hand-off checklist

- [ ] PNG files with a transparent background, named exactly as in the tables
- [ ] Every part comes from the same session or uses the same character reference, so colours match
- [ ] Limbs drawn straight, joints at the top and bottom centres
- [ ] No muscles on any part sprite (menu art is the exception)
- [ ] Put the files in `assets/sprites/<view>/` and ask Claude to "wire in the sprites and calibrate the pivots"
