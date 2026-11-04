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
      movements: ['Medial rotation', 'Lateral rotation', 'Rotation', 'Pronation', 'Supination', 'Horizontal abduction', 'Horizontal adduction'],
    },
  };

  const MOVEMENT_PLANE = {};
  Object.values(PLANES).forEach((pl) => pl.movements.forEach((m) => (MOVEMENT_PLANE[m] = pl.id)));

  // ---------------------------------------------------------------
  // Axis names. Textbooks use different names for the same axis, so the
  // game ROTATES through them at a regular interval (teacher request).
  // NOTE: "transverse axis" (= frontal axis) is NOT the transverse plane.
  // ---------------------------------------------------------------
  const AXIS_NAMES = {
    sagittal: ['frontal axis', 'transverse axis', 'mediolateral axis'],
    frontal: ['sagittal axis', 'anteroposterior axis'],
    transverse: ['longitudinal axis', 'vertical axis'],
  };
  const AXIS_INTERVAL_MS = 8000;
  function axisName(planeId, idx) {
    const a = AXIS_NAMES[planeId] || [''];
    const i = idx == null ? Math.floor(Date.now() / AXIS_INTERVAL_MS) : idx;
    return a[i % a.length];
  }
  function axisAllNames(planeId) {
    const a = AXIS_NAMES[planeId] || [''];
    return a.join(' / ');
  }

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
    Rotation: 'turns the trunk or head around its long (vertical) axis',
  };

  const MOVEMENT_EXAMPLES = {
    Flexion: 'Bending the elbow in a biceps curl; bending the knees to crouch',
    Extension: 'Straightening the hips and knees to jump',
    Hyperextension: 'Leaning the trunk backward past upright',
    Dorsiflexion: 'Pulling the toes up toward the shin (walking on your heels)',
    Plantarflexion: 'Pointing the toes; rising onto tiptoes',
    Abduction: 'Raising the arms out to the sides in a jumping jack',
    Adduction: 'Bringing the arms back down to the sides',
    'Lateral flexion': 'Bending the trunk sideways in a side bend',
    Elevation: 'Shrugging the shoulders up',
    Depression: 'Pulling the shoulders back down',
    Inversion: 'Rolling the sole of the foot inward',
    Eversion: 'Turning the sole of the foot outward',
    'Radial deviation': 'Tilting the hand toward the thumb side',
    'Ulnar deviation': 'Tilting the hand toward the little-finger side',
    'Medial rotation': 'Turning the arm inward, as in arm wrestling',
    'Lateral rotation': 'Turning the arm outward when cocking the arm to throw',
    Rotation: 'Turning the trunk during a golf swing',
    Pronation: 'Turning the palm to face down when dribbling a basketball',
    Supination: 'Turning the palm to face up, as if carrying a bowl of soup',
    'Horizontal abduction': 'Arms held out in front swing out to the sides (reverse fly)',
    'Horizontal adduction': 'Arms held out to the sides swing in across the chest (chest fly)',
  };

  // ---------------------------------------------------------------
  // Contraction types (colour is also used by the renderer + HUD)
  // ---------------------------------------------------------------
  // Isotonic = the muscle changes length (joint moves): concentric + eccentric.
  // Isometric = no change in length (joint still).
  const ISOTONIC = {
    name: 'Isotonic',
    def: 'The muscle CHANGES LENGTH while it produces force, so the joint moves. There are two kinds: concentric and eccentric.',
    example: 'Lifting and lowering a dumbbell',
  };
  const CONTRACTIONS = {
    concentric: { id: 'c', name: 'Concentric', letter: 'C', color: '#ff6a3d', family: 'isotonic', def: 'The muscle SHORTENS while producing force (muscle force > resistance).', example: 'Lifting the dumbbell in a biceps curl: the biceps shortens.' },
    eccentric: { id: 'e', name: 'Eccentric', letter: 'E', color: '#4ea8ff', family: 'isotonic', def: 'The muscle LENGTHENS while producing force, braking or controlling a movement (muscle force < resistance).', example: 'Lowering the dumbbell slowly; the quadriceps when landing from a jump.' },
    isometric: { id: 'i', name: 'Isometric', letter: 'I', color: '#ffc53d', family: 'isometric', def: 'The muscle produces force WITHOUT changing length, so the joint does not move (muscle force = resistance).', example: 'Holding the dumbbell still at 90°; holding a plank.' },
  };
  function contractionLabel(key) {
    const c = CONTRACTIONS[key];
    return c.family === 'isotonic' ? `${c.name} (isotonic)` : `${c.name} (static)`;
  }
  const CONTRACTION_BY_ID = { c: CONTRACTIONS.concentric, e: CONTRACTIONS.eccentric, i: CONTRACTIONS.isometric };

  // ---------------------------------------------------------------
  // Muscles shown on the android (lower + upper limb, phase 1)
  // Attachment geometry lives in android.js and is keyed by these ids.
  // ---------------------------------------------------------------
  const MUSCLES = {
    // ---- on the android rig (phase 1, sagittal level) ----
    gluteus_maximus: { name: 'Gluteus maximus', region: 'lower limb', where: 'Buttock (back of the hip)', action: 'Hip extension (and lateral rotation)' },
    iliopsoas: { name: 'Iliopsoas', region: 'lower limb', where: 'Deep, front of the hip', action: 'Hip flexion' },
    quadriceps: { name: 'Quadriceps femoris', region: 'lower limb', where: 'Front of the thigh', action: 'Knee extension (rectus femoris also flexes the hip)' },
    hamstrings: { name: 'Hamstrings', region: 'lower limb', where: 'Back of the thigh', action: 'Knee flexion and hip extension' },
    gastrocnemius: { name: 'Gastrocnemius', region: 'lower limb', where: 'Back of the calf (crosses the knee)', action: 'Ankle plantarflexion (assists knee flexion)' },
    soleus: { name: 'Soleus', region: 'lower limb', where: 'Calf, deep to the gastrocnemius', action: 'Ankle plantarflexion' },
    tibialis_anterior: { name: 'Tibialis anterior', region: 'lower limb', where: 'Front of the shin', action: 'Ankle dorsiflexion (and inversion)' },
    deltoid_anterior: { name: 'Deltoid (anterior)', region: 'upper limb', where: 'Front of the shoulder cap', action: 'Shoulder flexion' },
    deltoid_posterior: { name: 'Deltoid (posterior)', region: 'upper limb', where: 'Back of the shoulder cap', action: 'Shoulder extension (and horizontal abduction)' },
    pectoralis_major: { name: 'Pectoralis major', region: 'upper limb', where: 'Chest', action: 'Shoulder flexion (clavicular head), horizontal adduction, medial rotation' },
    latissimus_dorsi: { name: 'Latissimus dorsi', region: 'upper limb', where: 'Side and back of the trunk', action: 'Shoulder extension, adduction and medial rotation' },
    biceps_brachii: { name: 'Biceps brachii', region: 'upper limb', where: 'Front of the upper arm', action: 'Elbow flexion (and forearm supination)' },
    brachialis: { name: 'Brachialis', region: 'upper limb', where: 'Front of the upper arm, deep to the biceps', action: 'Elbow flexion' },
    brachioradialis: { name: 'Brachioradialis', region: 'upper limb', where: 'Thumb side of the forearm', action: 'Elbow flexion' },
    triceps_brachii: { name: 'Triceps brachii', region: 'upper limb', where: 'Back of the upper arm', action: 'Elbow extension' },
    // ---- tutorial / future levels (not yet on the rig) ----
    deltoid_middle: { name: 'Deltoid (middle)', region: 'upper limb', where: 'Side of the shoulder cap', action: 'Shoulder abduction' },
    supraspinatus: { name: 'Supraspinatus', region: 'upper limb', where: 'Top of the shoulder blade (rotator cuff)', action: 'Starts shoulder abduction' },
    infraspinatus: { name: 'Infraspinatus', region: 'upper limb', where: 'Back of the shoulder blade (rotator cuff)', action: 'Shoulder lateral rotation' },
    subscapularis: { name: 'Subscapularis', region: 'upper limb', where: 'Front of the shoulder blade (rotator cuff)', action: 'Shoulder medial rotation' },
    pronator_teres: { name: 'Pronator teres', region: 'upper limb', where: 'Front of the forearm, near the elbow', action: 'Forearm pronation' },
    supinator: { name: 'Supinator', region: 'upper limb', where: 'Back of the forearm, near the elbow', action: 'Forearm supination' },
    gluteus_medius: { name: 'Gluteus medius', region: 'lower limb', where: 'Side of the hip', action: 'Hip abduction' },
    hip_adductors: { name: 'Hip adductors', region: 'lower limb', where: 'Inner thigh', action: 'Hip adduction' },
    fibularis_longus: { name: 'Fibularis (peroneus) longus', region: 'lower limb', where: 'Outer side of the lower leg', action: 'Foot eversion (and plantarflexion)' },
    obliques: { name: 'External & internal obliques', region: 'trunk', where: 'Sides of the abdomen', action: 'Trunk lateral flexion and rotation' },
  };

  // Muscles featured in each level's tutorial
  const LEVEL_MUSCLES = {
    sagittal: ['gluteus_maximus', 'iliopsoas', 'quadriceps', 'hamstrings', 'gastrocnemius', 'soleus', 'tibialis_anterior', 'deltoid_anterior', 'deltoid_posterior', 'pectoralis_major', 'latissimus_dorsi', 'biceps_brachii', 'brachialis', 'brachioradialis', 'triceps_brachii'],
    frontal: ['deltoid_middle', 'supraspinatus', 'latissimus_dorsi', 'pectoralis_major', 'gluteus_medius', 'hip_adductors', 'obliques', 'tibialis_anterior', 'fibularis_longus', 'pronator_teres', 'supinator', 'biceps_brachii'],
    transverse: ['pectoralis_major', 'latissimus_dorsi', 'deltoid_posterior', 'subscapularis', 'infraspinatus', 'obliques', 'pronator_teres', 'supinator', 'biceps_brachii'],
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
      tier: 1,
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
      tier: 2,
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
            detail: 'The hips and knees bend (flex), so the joint angles get smaller and the body drops low enough to slide under the beams.',
            deeper: 'Going deeper: gravity pulls the body down, so the quadriceps and gluteus maximus actually LENGTHEN under tension to control the drop (an eccentric contraction).',
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
      tier: 1,
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
      tier: 3,
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
      tier: 2,
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
      explain: `${choice}${def} is a ${pl.name.toUpperCase()} movement, about the ${axisName(pid)}. The escape corridor locks the android to the SAGITTAL plane, where the ${limb} can only flex or extend about the ${axisName('sagittal')}. Forcing a ${pl.name.toLowerCase()} movement here overloaded the servos.`,
    };
  }

  // Level select metadata (menu). Status: 'playable' | 'design' | 'paused'
  const LEVELS = [
    {
      id: 'frontal',
      plane: 'frontal',
      title: 'Precision Lab',
      tag: 'FRONTAL PLANE · SAGITTAL AXIS',
      blurb: 'Before the escape. Climb the test wall with individual limb control: abduct or adduct to reach, then turn the palm to press. Every error earns a shock; too many and the android shuts down.',
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

  // ---------------------------------------------------------------
  // TUTORIALS: shown at the start of every game (and from the menu).
  // Pages: planes & axes -> movements -> contraction types -> muscles -> how to play
  // ---------------------------------------------------------------
  const TUTORIALS = {
    sagittal: {
      camera: 'In this game your screen IS the sagittal plane: you see the android from the side. The axis it turns about points straight out of the screen through each joint (shown as ⊙).',
      demos: ['Flexion', 'Extension', 'Hyperextension', 'Dorsiflexion', 'Plantarflexion'],
      play: [
        'The android runs on its own. Time slows almost to a stop as each hazard approaches.',
        'Choose the correct MOVEMENT (e.g. flexion or extension) or CONTRACTION (concentric, eccentric or isometric) before the timer runs out. Click, or press 1–4.',
        'Wrong, but in the sagittal plane: the muscles do exactly what you chose, with the result you would expect.',
        'A movement from another plane (abduction, rotation and so on): the android malfunctions and the screen cracks.',
        'After a failure you reboot at the same hazard. Hazards start simple and get harder.',
        'Watch the other androids on the back catwalk. Not all of them make it.',
      ],
    },
    frontal: {
      camera: 'In this game your screen IS the frontal plane: you see the android from behind. The axis it turns about points straight out of the screen (shown as ⊙).',
      demos: ['Abduction', 'Adduction', 'Lateral flexion', 'Elevation', 'Depression', 'Inversion', 'Eversion', 'Radial deviation', 'Ulnar deviation'],
      crossPlane: {
        title: 'The palm step uses a second plane',
        text: 'To press each button you turn the palm with PRONATION or SUPINATION. These are TRANSVERSE-plane movements (about the longitudinal/vertical axis), not frontal ones. Real tasks often combine planes. In this level the palm step is never counted as a plane error.',
        demos: ['Pronation', 'Supination'],
      },
      play: [
        'Before the escape: the android is forced to climb a test wall while scientists watch from behind the glass.',
        'Select one limb at a time, then choose ABDUCTION or ADDUCTION to reach the next hold or button.',
        'Turn the palm (pronation or supination) to press each button.',
        'Wrong answers do not restart the level. Instead the scientists SHOCK the android and it loses one battery cell.',
        'If the battery runs out, the android malfunctions and shuts down. That ends the test.',
        'At the end you get a PRECISION REPORT showing what you got right and what to review.',
      ],
    },
    transverse: {
      camera: 'In this game your screen IS the transverse plane: you look down on the android from above. The axis it turns about points straight out of the screen (shown as ⊙).',
      demos: ['Rotation', 'Medial rotation', 'Lateral rotation', 'Horizontal abduction', 'Horizontal adduction', 'Pronation', 'Supination'],
      play: [
        'After the escape, the free android must defend itself from capture drones using rotations and horizontal movements.',
        'This level is PAUSED in development. Use this tutorial as review only.',
      ],
    },
  };

  // Self-check items for the printable review sheet (answer key included)
  const REVIEW_CHECKS = [
    { q: 'Which plane divides the body into left and right sides, and which axis does movement in it rotate about?', a: 'Sagittal plane; frontal axis (also called transverse or mediolateral axis)' },
    { q: 'Name two movements that happen in the frontal plane.', a: 'Any two of: abduction, adduction, lateral flexion, elevation, depression, inversion, eversion' },
    { q: 'Does flexion increase or decrease the angle at a joint?', a: 'Decrease (extension increases it)' },
    { q: 'Jumping: what movement happens at the hips and knees as you push off?', a: 'Extension (gluteus maximus and quadriceps, concentric)' },
    { q: 'Landing from a jump: what type of contraction do the quadriceps perform?', a: 'Eccentric: they lengthen under tension to control knee flexion' },
    { q: 'Holding a dumbbell still with the elbow at 90°: what type of contraction is this?', a: 'Isometric: force with no change in muscle length' },
    { q: 'Which two contraction types are kinds of ISOTONIC contraction?', a: 'Concentric and eccentric' },
    { q: 'In which plane do pronation and supination of the forearm occur, and about which axis?', a: 'Transverse plane; longitudinal (vertical) axis' },
  ];

  SEHS.content = {
    PLANES,
    MOVEMENT_PLANE,
    MOVEMENT_DEFS,
    MOVEMENT_EXAMPLES,
    AXIS_NAMES,
    AXIS_INTERVAL_MS,
    axisName,
    axisAllNames,
    ISOTONIC,
    CONTRACTIONS,
    CONTRACTION_BY_ID,
    contractionLabel,
    MUSCLES,
    LEVEL_MUSCLES,
    OBSTACLES,
    LEVELS,
    TUTORIALS,
    REVIEW_CHECKS,
    planeOf,
    planeFailText,
  };
})();
