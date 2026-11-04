/*
 * SPRITE MANIFEST: optional image skin for the android.
 * -----------------------------------------------------------------
 * The game draws the muscles itself (so they can swell and change colour);
 * sprites replace only the metal skeleton, head and shell.
 *
 * To turn a skin on:
 *   1. Put the PNGs in assets/sprites/<view>/ using the file names below
 *      (see docs/SPRITE_PROMPTS.md for how to generate them).
 *   2. Set enabled: true for that view.
 *   3. Open index.html?sprites=debug to see green (pivot) and magenta (tip)
 *      markers; adjust pivot/tip until they sit on the joint centres.
 *
 * pivot = proximal joint centre, tip = distal joint centre, both as
 * fractions of the image width/height (0..1). Defaults match the layout
 * requested in docs/SPRITE_PROMPTS.md. Add ?skin=off to force the
 * built-in vector android.
 */
window.SEHS_SPRITES = {
  sagittal: {
    enabled: false,
    parts: {
      torso:     { src: 'sagittal/torso.png',     pivot: [0.50, 0.88], tip: [0.50, 0.10] }, // hip joint -> neck base
      head:      { src: 'sagittal/head.png',      pivot: [0.42, 0.94], tip: [0.42, 0.06] }, // neck base -> crown
      upper_arm: { src: 'sagittal/upper_arm.png', pivot: [0.50, 0.125], tip: [0.50, 0.875] }, // shoulder -> elbow
      forearm:   { src: 'sagittal/forearm.png',   pivot: [0.50, 0.125], tip: [0.50, 0.875] }, // elbow -> wrist
      hand:      { src: 'sagittal/hand.png',      pivot: [0.50, 0.15], tip: [0.50, 0.85] },   // wrist -> knuckles
      thigh:     { src: 'sagittal/thigh.png',     pivot: [0.50, 0.125], tip: [0.50, 0.875] }, // hip -> knee
      shank:     { src: 'sagittal/shank.png',     pivot: [0.50, 0.125], tip: [0.50, 0.875] }, // knee -> ankle
      foot:      { src: 'sagittal/foot.png',      pivot: [0.28, 0.30], tip: [0.92, 0.78] },   // ankle -> toe tip
    },
  },
  // Frontal (back view) and transverse (top view) skins are listed in
  // docs/SPRITE_PROMPTS.md; their rigs are not built yet.
};
