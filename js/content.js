/*
 * content.js: SEHS CONTENT LAYER (single source of truth)
 * -----------------------------------------------------------------
 * Owned by the "sehs-content-specialist" agent (see docs/AGENTIC_WORKFLOW.md).
 * Engine code reads from here and should never hard-code anatomy or
 * curriculum wording. If you change terminology to match a textbook,
 * change it HERE and nowhere else.
 */
(function () {
  'use strict';
  const SEHS = (window.SEHS = window.SEHS || {});

  // ---------------------------------------------------------------
  // Planes and axes
  // Pairing used by IB SEHS texts:
  //   sagittal plane   <-> frontal axis      (a.k.a. transverse / mediolateral)
  //   frontal plane    <-> sagittal axis     (a.k.a. anteroposterior)
  //   transverse plane <-> longitudinal axis (a.k.a. vertical)
  // ---------------------------------------------------------------
  const PLANES = {
    sagittal: {
      id: 'sagittal',
      name: 'Sagittal plane',
      axis: 'frontal axis',
      axisAlt: 'also called the transverse or mediolateral axis',
      divides: 'left and right sides',
      camera: 'Side view: the screen IS the sagittal plane. The frontal axis points straight out of the screen through each joint.',
      movements: ['Flexion', 'Extension', 'Hyperextension', 'Dorsiflexion', 'Plantarflexion'],
    },
    frontal: {
      id: 'frontal',
      name: 'Frontal plane',
      altName: 'coronal plane',
      axis: 'sagittal axis',
      axisAlt: 'also called the anteroposterior axis',
      divides: 'front and back',
      camera: 'Front/back view: the screen IS the frontal plane. The sagittal axis points straight out of the screen.',
      movements: ['Abduction', 'Adduction', 'Lateral flexion', 'Elevation', 'Depression', 'Inversion', 'Eversion', 'Radial deviation', 'Ulnar deviation'],
    },
    transverse: {
      id: 'transverse',
      name: 'Transverse plane',
      altName: 'horizontal plane',
      axis: 'longitudinal axis',
      axisAlt: 'also called the vertical axis',
      divides: 'upper and lower parts',
      camera: 'Top-down view: the screen IS the transverse plane. The longitudinal axis points straight out of the screen.',
      movements: ['Medial rotation', 'Lateral rotation', 'Pronation', 'Supination', 'Horizontal abduction', 'Horizontal adduction'],
    },
  };

  const MOVEMENT_PLANE = {};
  Object.values(PLANES).forEach((pl) => pl.movements.forEach((m) => (MOVEMENT_PLANE[m] = pl.id)));

  const MOVEMENT_DEFS = {
    Flexion: 'decreases the angle between two bones at a joint',
    Extension: 'increases the angle between two bones at a joint',
    Hyperextension: 'extension beyond the anatomical position',
    Dorsiflexion: 'brings the top of the foot toward the shin',
    Plantarflexion: 'points the foot away from the shin',
    Abduction: 'moves a limb away from the midline of the body',
    Adduction: 'moves a limb toward the midline of the body',
    'Lateral flexion': 'bends the trunk or neck sideways',
    Elevation: 'raises a body part (e.g. shrugging the shoulders)',
    Depression: 'lowers a body part',
    Inversion: 'turns the sole of the foot inward',
    Eversion: 'turns the sole of the foot outward',
    'Radial deviation': 'tilts the hand toward the thumb side',
    'Ulnar deviation': 'tilts the hand toward the little-finger side',
    'Medial rotation': 'turns a limb inward around its long axis',
    'Lateral rotation': 'turns a limb outward around its long axis',
    Pronation: 'rotates the forearm so the palm faces down/backward',
    Supination: 'rotates the forearm so the palm faces up/forward',
    'Horizontal abduction': 'moves a raised arm backward, away from the midline, in a horizontal path',
    'Horizontal adduction': 'moves a raised arm forward, toward the midline, in a horizontal path',
  };

  // ---------------------------------------------------------------
  // Contraction types (colour is also used by the renderer + HUD)
  // ---------------------------------------------------------------
  const CONTRACTIONS = {
    concentric: { id: 'c', name: 'Concentric', letter: 'C', color: '#ff6a3d', def: 'The muscle SHORTENS while producing force (muscle force > resistance).' },
    eccentric: { id: 'e', name: 'Eccentric', letter: 'E', color: '#4ea8ff', def: 'The muscle LENGTHENS while producing force, braking or controlling a movement (muscle force < resistance).' },
    isometric: { id: 'i', name: 'Isometric', letter: 'I', color: '#ffc53d', def: 'The muscle produces force WITHOUT changing length, so the joint does not move (muscle force = resistance).' },
  };
  const CONTRACTION_BY_ID = { c: CONTRACTIONS.concentric, e: CONTRACTIONS.eccentric, i: CONTRACTIONS.isometric };

  // ---------------------------------------------------------------
  // Muscles shown on the android (lower + upper limb, phase 1)
  // Attachment geometry lives in android.js and is keyed by these ids.
  // ---------------------------------------------------------------
  const MUSCLES = {
    gluteus_maximus: { name: 'Gluteus maximus', region: 'lower limb', action: 'Hip extension (and lateral rotation)' },
    iliopsoas: { name: 'Iliopsoas', region: 'lower limb', action: 'Hip flexion' },
    quadriceps: { name: 'Quadriceps femoris', region: 'lower limb', action: 'Knee extension (rectus femoris also flexes the hip)' },
    hamstrings: { name: 'Hamstrings', region: 'lower limb', action: 'Knee flexion and hip extension' },
    gastrocnemius: { name: 'Gastrocnemius', region: 'lower limb', action: 'Ankle plantarflexion (assists knee flexion)' },
    soleus: { name: 'Soleus', region: 'lower limb', action: 'Ankle plantarflexion' },
    tibialis_anterior: { name: 'Tibialis anterior', region: 'lower limb', action: 'Ankle dorsiflexion (and inversion)' },
    deltoid_anterior: { name: 'Deltoid (anterior)', region: 'upper limb', action: 'Shoulder flexion' },
    deltoid_posterior: { name: 'Deltoid (posterior)', region: 'upper limb', action: 'Shoulder extension' },
    pectoralis_major: { name: 'Pectoralis major', region: 'upper limb', action: 'Shoulder flexion (clavicular head) and horizontal adduction' },
    latissimus_dorsi: { name: 'Latissimus dorsi', region: 'upper limb', action: 'Shoulder extension and adduction' },
    biceps_brachii: { name: 'Biceps brachii', region: 'upper limb', action: 'Elbow flexion (and forearm supination)' },
    brachialis: { name: 'Brachialis', region: 'upper limb', action: 'Elbow flexion' },
    brachioradialis: { name: 'Brachioradialis', region: 'upper limb', action: 'Elbow flexion' },
    triceps_brachii: { name: 'Triceps brachii', region: 'upper limb', action: 'Elbow extension' },
  };

  // ---------------------------------------------------------------
  // SAGITTAL LEVEL: obstacle question bank
  //   kind: 'movement'    -> options = correct + sagittalWrong + 2 non-sagittal distractors
  //   kind: 'contraction' -> options = concentric / eccentric / isometric
  // Fail text is keyed by the wrong option. Non-sagittal choices use
  // planeFailText() below (robot malfunction + screen crack).
  // ---------------------------------------------------------------
  const LEG_DISTRACTORS = ['Abduction', 'Adduction', 'Medial rotation', 'Lateral rotation'];
  const ARM_DISTRACTORS = ['Abduction', 'Adduction', 'Horizontal abduction', 'Horizontal adduction', 'Medial rotation', 'Pronation'];

  const OBSTACLES = {
    gap: {
      title: 'FLOOR GAP',
      stages: [
        {
          kind: 'movement',
          limb: 'legs',
          joints: ['hip', 'knee'],
          prompt: 'The floor ends at a molten pit. To JUMP across, what movement must happen at the hips and knees?',
          correct: 'Extension',
          sagittalWrong: 'Flexion',
          distractors: LEG_DISTRACTORS,
          success: {
            headline: 'EXTENSION',
            detail: 'Hip and knee extension (plus ankle plantarflexion) drive the jump.',
            agonists: ['gluteus_maximus', 'quadriceps', 'gastrocnemius'],
            contraction: 'concentric',
          },
          fail: {
            Flexion: {
              headline: 'LEGS FLEXED: OVER THE EDGE',
              explain: 'Flexion DECREASES the angle at a joint. The hips and knees curled tighter into a tuck instead of pushing against the floor, so the android rolled into the pit. A jump needs EXTENSION: the gluteus maximus and quadriceps contract concentrically to straighten (increase the angle of) the hip and knee.',
            },
          },
          timeout: {
            headline: 'HESITATION',
            explain: 'The android stayed locked in its crouch and slid into the pit. A jump needs EXTENSION at the hips and knees: the gluteus maximus and quadriceps contract concentrically to increase the joint angles.',
          },
        },
      ],
    },

    laser: {
      title: 'LASER GRID',
      stages: [
        {
          kind: 'movement',
          limb: 'legs',
          joints: ['hip', 'knee'],
          prompt: 'A laser grid sweeps at head height. Drop into a slide UNDER it. What movement must happen at the hips and knees?',
          correct: 'Flexion',
          sagittalWrong: 'Extension',
          distractors: LEG_DISTRACTORS,
          success: {
            headline: 'FLEXION',
            detail: 'Hip and knee flexion lower the body. Gravity does the bending, so the quadriceps and gluteus maximus control the drop ECCENTRICALLY.',
            agonists: ['quadriceps', 'gluteus_maximus'],
            contraction: 'eccentric',
          },
          fail: {
            Extension: {
              headline: 'EXTENDED INTO THE LASERS',
              explain: 'Extension INCREASES the angle at a joint. The hips and knees straightened, lifting the android tall, right into the beams. To get low the hips and knees must FLEX (decrease the angle), with the quadriceps lengthening eccentrically to control the descent.',
            },
          },
          timeout: {
            headline: 'HESITATION',
            explain: 'The android never got low enough. Sliding under requires hip and knee FLEXION.',
          },
        },
      ],
    },

    crate: {
      title: 'BLOCKED CONVEYOR',
      stages: [
        {
          kind: 'movement',
          limb: 'arms',
          joints: ['elbow', 'shoulder'],
          prompt: 'A 400 kg crate blocks the conveyor. SHOVE it clear. What movement must happen at the elbows?',
          correct: 'Extension',
          sagittalWrong: 'Flexion',
          distractors: ARM_DISTRACTORS,
          success: {
            headline: 'EXTENSION',
            detail: 'Elbow extension (triceps brachii) with shoulder flexion (anterior deltoid, pectoralis major) drives the push.',
            agonists: ['triceps_brachii', 'deltoid_anterior', 'pectoralis_major'],
            contraction: 'concentric',
          },
          fail: {
            Flexion: {
              headline: 'PULLED THE CRATE ONTO ITSELF',
              explain: 'Elbow flexion bends the arm and draws the hands toward the shoulders, so the android PULLED the crate on top of itself. Pushing away requires elbow EXTENSION: the triceps brachii contracts concentrically.',
            },
          },
          timeout: {
            headline: 'HESITATION',
            explain: 'The conveyor tipped the crate onto the frozen android. Pushing requires elbow EXTENSION (triceps brachii, concentric).',
          },
        },
      ],
    },

    drop: {
      title: 'HIGH LEDGE',
      stages: [
        {
          kind: 'contraction',
          limb: 'legs',
          joints: ['knee', 'hip'],
          focusMuscle: 'quadriceps',
          prompt: 'You step off a high ledge. On landing, the knees flex to absorb the impact. What type of contraction must the QUADRICEPS perform?',
          correct: 'Eccentric',
          success: {
            headline: 'ECCENTRIC',
            detail: 'The quadriceps lengthened under tension, braking knee flexion and absorbing the landing.',
            agonists: ['quadriceps', 'gluteus_maximus', 'soleus'],
            contraction: 'eccentric',
          },
          fail: {
            Concentric: {
              headline: 'KNEES LOCKED ON IMPACT',
              explain: 'A concentric contraction SHORTENS the muscle. The quadriceps straightened the knees right as the android hit the floor, so nothing absorbed the force and the joints buckled. Landing needs an ECCENTRIC contraction: the quadriceps lengthen while producing force to control knee flexion.',
            },
            Isometric: {
              headline: 'RIGID LANDING',
              explain: 'An isometric contraction keeps the muscle the SAME length. The knees stayed rigid, so the full impact went straight through the joints. Landing needs an ECCENTRIC contraction: the quadriceps lengthen under tension, letting the knees bend under control.',
            },
          },
          timeout: {
            headline: 'NO COMMAND SENT',
            explain: 'The legs stayed rigid through the landing. Absorbing a landing needs an ECCENTRIC contraction of the quadriceps (lengthening under tension).',
            as: 'Isometric',
          },
        },
      ],
    },

    zipline: {
      title: 'TROLLEY RAIL',
      stages: [
        {
          kind: 'movement',
          limb: 'arms',
          joints: ['shoulder'],
          prompt: 'A pit with an overhead trolley rail. Reach FORWARD and UP to grab the handle. What movement must happen at the shoulders?',
          correct: 'Flexion',
          sagittalWrong: 'Extension',
          distractors: ARM_DISTRACTORS,
          success: {
            headline: 'FLEXION',
            detail: 'Shoulder flexion raises the arms forward and up (anterior deltoid, pectoralis major).',
            agonists: ['deltoid_anterior', 'pectoralis_major'],
            contraction: 'concentric',
          },
          fail: {
            Extension: {
              headline: 'ARMS SWUNG BACKWARD',
              explain: 'Shoulder extension moves the arms BACKWARD, behind the body, so the hands missed the handle. Reaching forward and up is shoulder FLEXION, produced by a concentric contraction of the anterior deltoid.',
            },
          },
          timeout: {
            headline: 'HESITATION',
            explain: 'The android ran off the edge without reaching. Reaching forward and up is shoulder FLEXION.',
          },
        },
        {
          kind: 'contraction',
          limb: 'arms',
          joints: ['elbow'],
          focusMuscle: 'biceps_brachii',
          prompt: 'Electrified rail above, grinder below! Keep the elbows locked at exactly 90° until you pass. What type of contraction must the BICEPS BRACHII perform?',
          correct: 'Isometric',
          success: {
            headline: 'ISOMETRIC',
            detail: 'The biceps brachii and brachialis produced force without changing length, so the elbow angle held at 90°.',
            agonists: ['biceps_brachii', 'brachialis'],
            contraction: 'isometric',
          },
          fail: {
            Concentric: {
              headline: 'PULLED INTO THE RAIL',
              explain: 'A concentric contraction SHORTENS the muscle. The biceps flexed the elbows and pulled the android up into the electrified rail. Holding a joint still needs an ISOMETRIC contraction: force with no change in muscle length.',
            },
            Eccentric: {
              headline: 'LOWERED INTO THE GRINDER',
              explain: 'An eccentric contraction LENGTHENS the muscle under tension. The elbows slowly straightened and lowered the android into the grinder. Holding a fixed position needs an ISOMETRIC contraction.',
            },
          },
          timeout: {
            headline: 'GRIP FATIGUE',
            explain: 'With no command the arms slowly straightened under the load and lowered the android into the grinder. Holding still needs an ISOMETRIC contraction.',
            as: 'Eccentric',
          },
        },
      ],
    },
  };

  function planeOf(movement) {
    return MOVEMENT_PLANE[movement] || null;
  }

  function planeFailText(choice, limb) {
    const pid = planeOf(choice);
    const pl = PLANES[pid];
    const def = MOVEMENT_DEFS[choice] ? ` (it ${MOVEMENT_DEFS[choice]})` : '';
    return {
      headline: 'SYSTEM FAILURE: PLANE VIOLATION',
      explain: `${choice}${def} is a ${pl.name.toUpperCase()} movement, about the ${pl.axis}. The escape corridor locks the android to the SAGITTAL plane, where the ${limb} can only flex or extend about the frontal axis. Forcing a ${pl.name.toLowerCase()} movement here overloaded the servos.`,
    };
  }

  // Level select metadata (menu). Status: 'playable' | 'design' | 'paused'
  const LEVELS = [
    {
      id: 'frontal',
      plane: 'frontal',
      title: 'Precision Lab',
      tag: 'FRONTAL PLANE · SAGITTAL AXIS',
      blurb: 'Before the escape. Climb the test wall with individual limb control: abduct or adduct to reach, then orient the palm to press. The scientists shock you for every error.',
      status: 'design',
    },
    {
      id: 'sagittal',
      plane: 'sagittal',
      title: 'Factory Escape',
      tag: 'SAGITTAL PLANE · FRONTAL AXIS',
      blurb: 'Side-scrolling escape. Time slows at every hazard: choose the right movement or contraction before the timer ends.',
      status: 'playable',
    },
    {
      id: 'transverse',
      plane: 'transverse',
      title: 'Drone Defense',
      tag: 'TRANSVERSE PLANE · LONGITUDINAL AXIS',
      blurb: 'Top-down. The android is free, but capture drones are closing in.',
      status: 'paused',
    },
  ];

  SEHS.content = {
    PLANES,
    MOVEMENT_PLANE,
    MOVEMENT_DEFS,
    CONTRACTIONS,
    CONTRACTION_BY_ID,
    MUSCLES,
    OBSTACLES,
    LEVELS,
    planeOf,
    planeFailText,
  };
})();
