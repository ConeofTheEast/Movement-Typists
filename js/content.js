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
    isometric: { id: 'i', name: 'Isometric', letter: 'I', color: '#ffc53d', family: 'isometric', def: 'The muscle produces force WITHOUT changing length, so the joint does not move (muscle force = resistance).', example: 'Holding the dumbbell still at 90°; holding a plank; a wall-sit.' },
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
    gluteus_medius: { name: 'Gluteus medius', region: 'lower limb', where: 'Side of the hip', action: 'Hip abduction (front fibres also medially rotate the hip)' },
    tensor_fasciae_latae: { name: 'Tensor fasciae latae', region: 'lower limb', where: 'Front and side of the hip', action: 'Hip medial rotation (and assists hip flexion and abduction)' },
    hip_adductors: { name: 'Hip adductors', region: 'lower limb', where: 'Inner thigh', action: 'Hip adduction' },
    fibularis_longus: { name: 'Fibularis (peroneus) longus', region: 'lower limb', where: 'Outer side of the lower leg', action: 'Foot eversion (and plantarflexion)' },
    obliques: { name: 'External & internal obliques', region: 'trunk', where: 'Sides of the abdomen', action: 'Trunk lateral flexion and rotation' },
  };

  // Muscles featured in each level's tutorial
  const LEVEL_MUSCLES = {
    sagittal: ['gluteus_maximus', 'iliopsoas', 'quadriceps', 'hamstrings', 'gastrocnemius', 'soleus', 'tibialis_anterior', 'deltoid_anterior', 'deltoid_posterior', 'pectoralis_major', 'latissimus_dorsi', 'biceps_brachii', 'brachialis', 'brachioradialis', 'triceps_brachii'],
    frontal: ['deltoid_middle', 'supraspinatus', 'latissimus_dorsi', 'pectoralis_major', 'gluteus_medius', 'hip_adductors', 'obliques', 'tibialis_anterior', 'fibularis_longus', 'pronator_teres', 'supinator', 'biceps_brachii'],
    transverse: ['pectoralis_major', 'deltoid_anterior', 'latissimus_dorsi', 'deltoid_posterior', 'subscapularis', 'infraspinatus', 'obliques', 'pronator_teres', 'supinator', 'biceps_brachii', 'gluteus_medius', 'tensor_fasciae_latae'],
  };


  // ---------------------------------------------------------------
  // SAGITTAL LEVEL: obstacle question bank
  //   kind: 'movement'    -> options = correct + sagittalWrong + 2 non-sagittal distractors
  //   kind: 'contraction' -> options = concentric / eccentric / isometric,
  //                          unless the stage lists its own `options` array
  //                          (e.g. the door adds 'Isotonic').
  // Fail text is keyed by the wrong option. Non-sagittal choices use
  // planeFailText() below (robot malfunction + screen crack).
  // Optional `fatal: true` on a fail entry = full explosion + checkpoint
  // (hybrid damage system); otherwise the mistake costs 1 energy cell.
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

    door: {
      title: 'BLAST DOOR',
      tier: 2,
      stages: [
        {
          kind: 'contraction',
          limb: 'arms',
          joints: ['shoulder', 'elbow', 'knee', 'hip'],
          focusMuscle: 'triceps_brachii',
          prompt: 'A blast door is sliding shut. You step under it, arms up, elbows and knees bent, so your friends can run through. Which contraction type must your arm and leg muscles perform?',
          correct: 'Isometric',
          options: ['Isometric', 'Concentric', 'Eccentric', 'Isotonic'],
          success: {
            headline: 'ISOMETRIC',
            detail: 'Muscle tension rose, but muscle length and joint angles stayed the same. Your push matched the door\'s downward force, so it stopped moving and your friends escaped underneath.',
            deeper: 'Going deeper: "isometric" means "same length". The anterior deltoid, triceps brachii, quadriceps and gluteus maximus all produce force, yet no joint moves.',
            agonists: ['deltoid_anterior', 'triceps_brachii', 'quadriceps', 'gluteus_maximus'],
            contraction: 'isometric',
          },
          fail: {
            Concentric: {
              headline: 'SHOVED UP, THEN SLAMMED',
              explain: 'A concentric contraction SHORTENS the muscle. The triceps and anterior deltoid shortened and the arms shoved upward, so the elbow and shoulder angles changed. The door lurched up, then the motor slammed it down on the android. The door needs an ISOMETRIC contraction: the triceps, anterior deltoid, quadriceps and gluteus maximus make force without changing length.',
              fatal: true,
            },
            Eccentric: {
              headline: 'CRUSHED UNDER THE DOOR',
              explain: 'An eccentric contraction LENGTHENS the muscle under tension. The triceps and quadriceps lengthened while still pulling hard, like brakes, so the elbows and knees slowly bent and the door crushed down on the android. The door needs an ISOMETRIC contraction: muscle force equals the load, so muscle length and joint angles stay the same.',
              fatal: true,
            },
            Isotonic: {
              headline: 'JOINTS MOVED: DOOR CAME DOWN',
              explain: 'Isotonic is the umbrella name for contractions where the muscle CHANGES LENGTH: concentric (shortening) and eccentric (lengthening). Either way the elbows and knees moved. You saw the concentric version: the arms shoved up. The door shifted and slammed down on the android. The door needs an ISOMETRIC contraction: the triceps, anterior deltoid, quadriceps and gluteus maximus make force with no change in length.',
              fatal: true,
              as: 'Concentric',
            },
          },
          timeout: {
            headline: 'DOOR SHUT',
            explain: 'No command reached the muscles, so nothing resisted and the door crushed down on the android. Keeping it open needs an ISOMETRIC contraction: arm and leg muscles push back as hard as the door pushes down, without changing length.',
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

  // ---------------------------------------------------------------
  // TRANSVERSE LEVEL (Drone Defense): threat-freeze question bank
  //   kind: 'movement'    -> options = correct + distractors (other
  //                          TRANSVERSE actions) + planeWrong (sagittal /
  //                          frontal actions -> malfunction, crack, glitch)
  //   kind: 'contraction' -> options = concentric / eccentric / isometric,
  //                          unless the threat lists its own `options`.
  // Every option has its own fail entry. `damage` says who pays:
  //   'ally'    -> the drone nets an ally (rescue follow-up)
  //   'android' -> the android takes a hit (-1 energy cell)
  // `planeError: true` marks a non-transverse choice (glitch effects).
  // `as` on a contraction fail/timeout = the contraction the rig animates.
  // Static strings never name an axis (axis names rotate: use
  // axisName('transverse') in the engine if a label is needed).
  // ---------------------------------------------------------------
  const DRONE_THREATS = {
    crossSwat: {
      title: 'CROSS-BODY SWAT',
      tier: 1,
      kind: 'movement',
      limb: 'arms',
      joints: ['shoulder'],
      prompt: 'A drone dives at the ally on your FAR side. Your arm is straight out to the side at shoulder height. Sweep it across your chest to swat. Which shoulder action?',
      correct: 'Horizontal adduction',
      distractors: ['Horizontal abduction', 'Medial rotation'],
      planeWrong: ['Adduction', 'Flexion'],
      success: {
        headline: 'HORIZONTAL ADDUCTION',
        detail: 'The straight arm swept forward and across the chest at shoulder height, toward the midline. The swat smashed the drone.',
        deeper: 'Going deeper: the pectoralis major is the prime mover, helped by the anterior deltoid. Both shorten under tension (concentric).',
        agonists: ['pectoralis_major', 'deltoid_anterior'],
        contraction: 'concentric',
      },
      fail: {
        'Horizontal abduction': {
          headline: 'SWUNG THE WRONG WAY',
          explain: 'Horizontal abduction swings a raised arm BACKWARD, away from the midline. Your arm opened out behind you while the drone netted your ally. The swat needed HORIZONTAL ADDUCTION: the pectoralis major shortens (concentric) to sweep the arm across the chest.',
          damage: 'ally',
        },
        'Medial rotation': {
          headline: 'ARM TWISTED, NEVER SWUNG',
          explain: 'Medial rotation turns the upper arm inward around its own long axis. The arm twisted in place but stayed out to the side, so it never crossed your body. The swat needed HORIZONTAL ADDUCTION: the pectoralis major shortens (concentric).',
          damage: 'ally',
        },
        Adduction: {
          headline: 'PLANE VIOLATION: ARM DROPPED',
          explain: 'Adduction is a FRONTAL-plane movement: it lowers the arm down to your side. The servos fought the level swing and glitched. The swat needed HORIZONTAL ADDUCTION, a transverse-plane sweep driven by the pectoralis major (concentric).',
          damage: 'android',
          planeError: true,
        },
        Flexion: {
          headline: 'PLANE VIOLATION: ARM JAMMED UP',
          explain: 'Flexion is a SAGITTAL-plane movement: it swings the arm forward and up. The arm jerked upward instead of sweeping level, and the servos glitched. The swat needed HORIZONTAL ADDUCTION: the pectoralis major shortens (concentric).',
          damage: 'android',
          planeError: true,
        },
      },
      timeout: {
        headline: 'FROZEN MID-SWING',
        explain: 'The arm stayed out to the side and the drone netted your ally. Sweeping a raised arm across the chest is HORIZONTAL ADDUCTION (pectoralis major, concentric).',
        damage: 'ally',
      },
    },

    backhandSwat: {
      title: 'BACKHAND SWAT',
      tier: 1,
      kind: 'movement',
      limb: 'arms',
      joints: ['shoulder'],
      prompt: 'A drone darts in on the OUTSIDE of your arm. The arm is straight out in front at shoulder height. Swing it out and back like a backhand. Which shoulder action?',
      correct: 'Horizontal abduction',
      distractors: ['Horizontal adduction', 'Lateral rotation'],
      planeWrong: ['Abduction', 'Extension'],
      success: {
        headline: 'HORIZONTAL ABDUCTION',
        detail: 'The straight arm swung backward at shoulder height, away from the midline. The backhand smashed the drone.',
        deeper: 'Going deeper: the posterior deltoid is the prime mover, helped by the infraspinatus. Both shorten (concentric). The pectoralis major is the antagonist.',
        agonists: ['deltoid_posterior', 'infraspinatus'],
        contraction: 'concentric',
      },
      fail: {
        'Horizontal adduction': {
          headline: 'SWATTED THIN AIR',
          explain: 'Horizontal adduction sweeps a raised arm forward and ACROSS the chest. Your arm swung inward, away from the drone, and it slammed into your side. The backhand needed HORIZONTAL ABDUCTION: the posterior deltoid shortens (concentric).',
          damage: 'android',
        },
        'Lateral rotation': {
          headline: 'ARM TWISTED, NEVER SWUNG',
          explain: 'Lateral rotation turns the upper arm outward around its own long axis. The arm twisted in place but kept pointing forward, so it never reached the drone. The backhand needed HORIZONTAL ABDUCTION: the posterior deltoid shortens (concentric).',
          damage: 'android',
        },
        Abduction: {
          headline: 'PLANE VIOLATION: SIDEWAYS LIFT',
          explain: 'Abduction is a FRONTAL-plane movement: it raises the arm sideways from your side. The servos fought the level backhand and glitched. The swat needed HORIZONTAL ABDUCTION, driven by the posterior deltoid (concentric).',
          damage: 'android',
          planeError: true,
        },
        Extension: {
          headline: 'PLANE VIOLATION: ARM DROPPED BACK',
          explain: 'Extension is a SAGITTAL-plane movement: it swings the arm down and back past your hip. The arm dived low under the drone and the servos glitched. The swat needed HORIZONTAL ABDUCTION: the posterior deltoid shortens (concentric).',
          damage: 'android',
          planeError: true,
        },
      },
      timeout: {
        headline: 'FROZEN MID-SWING',
        explain: 'The arm stayed pointing forward and the drone rammed you. Swinging a raised arm out and back is HORIZONTAL ABDUCTION (posterior deltoid, concentric).',
        damage: 'android',
      },
    },

    spineTwist: {
      title: 'REAR DIVE',
      tier: 2,
      kind: 'movement',
      limb: 'trunk',
      joints: ['spine'],
      prompt: 'A drone dives at you from behind on the LEFT. Your feet stay planted. Turn your chest and shoulders round to face it. Which action happens at the spine?',
      correct: 'Rotation',
      distractors: ['Lateral rotation', 'Horizontal abduction'],
      planeWrong: ['Lateral flexion', 'Hyperextension'],
      success: {
        headline: 'ROTATION',
        detail: 'The spine turned around its long axis, so the chest swung round to face the drone and the strike landed.',
        deeper: 'Going deeper: turning LEFT uses the RIGHT external oblique and the LEFT internal oblique together, both shortening (concentric).',
        agonists: ['obliques'],
        contraction: 'concentric',
      },
      fail: {
        'Lateral rotation': {
          headline: 'WRONG JOINT TURNED',
          explain: 'Lateral rotation turns a LIMB outward at the shoulder or hip. Your arms rolled outward but your chest kept facing forward, so the drone hit you from behind. The spine needed ROTATION: the obliques shorten (concentric).',
          damage: 'android',
        },
        'Horizontal abduction': {
          headline: 'ARM FLAILED BEHIND',
          explain: 'Horizontal abduction swings a raised arm backward. One arm swept behind you, but your chest never turned, so the strike was blind and weak. The spine needed ROTATION: the obliques shorten (concentric) to turn the trunk.',
          damage: 'android',
        },
        'Lateral flexion': {
          headline: 'PLANE VIOLATION: SIDE BEND',
          explain: 'Lateral flexion is a FRONTAL-plane movement: it bends the trunk sideways. You leaned left instead of turning, the servos glitched, and the drone hit your back. The spine needed ROTATION: the obliques shorten (concentric).',
          damage: 'android',
          planeError: true,
        },
        Hyperextension: {
          headline: 'PLANE VIOLATION: BACK ARCH',
          explain: 'Hyperextension is a SAGITTAL-plane movement: it arches the spine backward past upright. You leaned back and stared at the sky while the drone struck. The spine needed ROTATION: the obliques shorten (concentric).',
          damage: 'android',
          planeError: true,
        },
      },
      timeout: {
        headline: 'HIT FROM BEHIND',
        explain: 'Your chest kept facing forward and the drone struck your back. Turning the chest and shoulders round is ROTATION of the spine (obliques, concentric).',
        damage: 'android',
      },
    },

    discWindup: {
      title: 'DISC WIND-UP',
      tier: 2,
      kind: 'movement',
      limb: 'arms',
      joints: ['shoulder'],
      prompt: 'Elbow tucked at your side and bent to 90°, scrap disc in front of your belly. Load the throw: swing the hand away from your belly, elbow still tucked. Which shoulder action?',
      correct: 'Lateral rotation',
      distractors: ['Medial rotation', 'Supination'],
      planeWrong: ['Abduction'],
      success: {
        headline: 'LATERAL ROTATION',
        detail: 'The upper arm turned outward around its own long axis, so the forearm swung out like a door opening. The throw is loaded.',
        deeper: 'Going deeper: the infraspinatus (rotator cuff) shortens (concentric). The wind-up also stretches the medial rotators, ready to fire.',
        agonists: ['infraspinatus'],
        contraction: 'concentric',
      },
      fail: {
        'Medial rotation': {
          headline: 'WOUND UP BACKWARDS',
          explain: 'Medial rotation turns the upper arm INWARD. The forearm swung into your belly, the opposite of a wind-up, so the drone got through. Loading needs LATERAL ROTATION: the infraspinatus shortens (concentric) to swing the forearm out.',
          damage: 'android',
        },
        Supination: {
          headline: 'PALM FLIPPED, NO WIND-UP',
          explain: 'Supination turns the forearm so the palm faces up. The disc flipped flat in your palm, but the arm never swung out, so there was no wind-up. Loading needs LATERAL ROTATION at the shoulder: the infraspinatus shortens (concentric).',
          damage: 'android',
        },
        Abduction: {
          headline: 'PLANE VIOLATION: ELBOW FLEW UP',
          explain: 'Abduction is a FRONTAL-plane movement: it lifts the elbow away from your side. The disc tipped out of your hand and the servos glitched. Loading needs LATERAL ROTATION: the infraspinatus shortens (concentric).',
          damage: 'android',
          planeError: true,
        },
      },
      timeout: {
        headline: 'NO WIND-UP',
        explain: 'The disc stayed in front of your belly and the drone closed in. Swinging the forearm out with the elbow tucked is LATERAL ROTATION (infraspinatus, concentric).',
        damage: 'android',
      },
    },

    discThrow: {
      title: 'DISC RELEASE',
      tier: 2,
      kind: 'movement',
      limb: 'arms',
      joints: ['shoulder'],
      prompt: 'Disc loaded: hand swung out, elbow still tucked at your side. Now whip the hand back across the front of your body to fling the disc. Which shoulder action?',
      correct: 'Medial rotation',
      distractors: ['Lateral rotation', 'Pronation'],
      planeWrong: ['Flexion'],
      success: {
        headline: 'MEDIAL ROTATION',
        detail: 'The upper arm turned inward around its own long axis, whipping the forearm across the body. The disc sliced into the drone.',
        deeper: 'Going deeper: the subscapularis, pectoralis major and latissimus dorsi all shorten (concentric). The infraspinatus lengthens as the antagonist.',
        agonists: ['subscapularis', 'pectoralis_major', 'latissimus_dorsi'],
        contraction: 'concentric',
      },
      fail: {
        'Lateral rotation': {
          headline: 'THROWN OVER YOUR SHOULDER',
          explain: 'Lateral rotation turns the upper arm OUTWARD. The forearm swung further out and the disc flew off behind you. The throw needed MEDIAL ROTATION: the subscapularis and pectoralis major shorten (concentric).',
          damage: 'android',
        },
        Pronation: {
          headline: 'DISC TIPPED, NO THROW',
          explain: 'Pronation turns the forearm so the palm faces down. The disc tipped over in your hand, but the arm never whipped across, so it dropped at your feet. The throw needed MEDIAL ROTATION: the subscapularis shortens (concentric).',
          damage: 'android',
        },
        Flexion: {
          headline: 'PLANE VIOLATION: WEAK LOB',
          explain: 'Flexion is a SAGITTAL-plane movement: it swings the upper arm forward and up. The elbow left your side and the disc lobbed up in a weak arc. The throw needed MEDIAL ROTATION: the subscapularis shortens (concentric).',
          damage: 'android',
          planeError: true,
        },
      },
      timeout: {
        headline: 'HELD THE DISC',
        explain: 'The arm stayed wound up and the drone hit you. Whipping the forearm across the body with the elbow tucked is MEDIAL ROTATION (subscapularis, concentric).',
        damage: 'android',
      },
    },

    palmUp: {
      title: 'CORE CATCH',
      tier: 1,
      kind: 'movement',
      limb: 'arms',
      joints: ['radioulnar'],
      prompt: 'A glowing drone core is falling toward you. Your elbow is bent at 90° and your palm faces the floor. Turn the forearm so the core lands in your hand. Which action?',
      correct: 'Supination',
      distractors: ['Pronation', 'Lateral rotation'],
      planeWrong: ['Flexion', 'Radial deviation'],
      success: {
        headline: 'SUPINATION',
        detail: 'The radius rolled back beside the ulna and the palm turned to face up. The core dropped safely into your hand.',
        deeper: 'Going deeper: the supinator and biceps brachii shorten (concentric). The biceps is a strong supinator when the elbow is bent.',
        agonists: ['supinator', 'biceps_brachii'],
        contraction: 'concentric',
      },
      fail: {
        Pronation: {
          headline: 'PALM STILL DOWN',
          explain: 'Pronation turns the palm to face DOWN. Your palm was already down, so it stayed facing the floor and the core bounced off the back of your hand. The catch needed SUPINATION: the supinator and biceps brachii shorten (concentric).',
          damage: 'android',
        },
        'Lateral rotation': {
          headline: 'ARM SWUNG OUT',
          explain: 'Lateral rotation turns the upper arm outward at the SHOULDER. Your forearm swung out to the side, palm still down, and the core fell past your hand. The catch needed SUPINATION at the forearm: supinator and biceps brachii, concentric.',
          damage: 'android',
        },
        Flexion: {
          headline: 'PLANE VIOLATION: KNUCKLE BOUNCE',
          explain: 'Flexion is a SAGITTAL-plane movement: it bends the elbow and lifts the hand. The palm still faced down and the core bounced off your knuckles. The catch needed SUPINATION: supinator and biceps brachii, concentric.',
          damage: 'android',
          planeError: true,
        },
        'Radial deviation': {
          headline: 'PLANE VIOLATION: WRIST TILT',
          explain: 'Radial deviation is a FRONTAL-plane movement: it tilts the hand toward the thumb side. The palm still faced down and the core slid off. The catch needed SUPINATION: supinator and biceps brachii, concentric.',
          damage: 'android',
          planeError: true,
        },
      },
      timeout: {
        headline: 'CORE DROPPED',
        explain: 'The palm stayed facing the floor and the core shattered against your arm. Turning the palm to face up is SUPINATION (supinator and biceps brachii, concentric).',
        damage: 'android',
      },
    },

    palmDown: {
      title: 'GROUND SLAM',
      tier: 1,
      kind: 'movement',
      limb: 'arms',
      joints: ['radioulnar'],
      prompt: 'A crawler drone skitters past your feet toward an ally. Your palm-emitter faces the sky, elbow bent at 90°. Turn the forearm so the emitter points at the ground. Which action?',
      correct: 'Pronation',
      distractors: ['Supination', 'Medial rotation'],
      planeWrong: ['Extension', 'Ulnar deviation'],
      success: {
        headline: 'PRONATION',
        detail: 'The radius crossed over the ulna and the palm turned to face down. The emitter blasted the crawler flat.',
        deeper: 'Going deeper: the pronator teres is the prime mover (concentric), helped by the small pronator quadratus near the wrist.',
        agonists: ['pronator_teres'],
        contraction: 'concentric',
      },
      fail: {
        Supination: {
          headline: 'BLASTED THE SKY',
          explain: 'Supination turns the palm to face UP. Your palm was already up, so the emitter fired into the sky and the crawler netted your ally. The slam needed PRONATION: the pronator teres shortens (concentric).',
          damage: 'ally',
        },
        'Medial rotation': {
          headline: 'ARM SWUNG ACROSS',
          explain: 'Medial rotation turns the upper arm inward at the SHOULDER. Your forearm swung across your belly, palm still up, and the blast missed. The slam needed PRONATION at the forearm: the pronator teres shortens (concentric).',
          damage: 'ally',
        },
        Extension: {
          headline: 'PLANE VIOLATION: ELBOW STRAIGHTENED',
          explain: 'Extension is a SAGITTAL-plane movement: it straightens the elbow. The emitter tipped forward instead of down and the servos glitched. The slam needed PRONATION: the pronator teres shortens (concentric).',
          damage: 'android',
          planeError: true,
        },
        'Ulnar deviation': {
          headline: 'PLANE VIOLATION: WRIST TILT',
          explain: 'Ulnar deviation is a FRONTAL-plane movement: it tilts the hand toward the little-finger side. The palm still faced up and the servos glitched. The slam needed PRONATION: the pronator teres shortens (concentric).',
          damage: 'android',
          planeError: true,
        },
      },
      timeout: {
        headline: 'CRAWLER GOT THROUGH',
        explain: 'The emitter kept pointing at the sky and the crawler netted your ally. Turning the palm to face down is PRONATION (pronator teres, concentric).',
        damage: 'ally',
      },
    },

    hipPivot: {
      title: 'FLANK PIVOT',
      tier: 3,
      kind: 'movement',
      limb: 'legs',
      joints: ['hip'],
      prompt: 'A drone flanks you from the LEFT. Pivot on the ball of your right foot so the right knee and toes swing round to point at your left foot. Which action at the right hip?',
      correct: 'Medial rotation',
      distractors: ['Lateral rotation', 'Rotation'],
      planeWrong: ['Abduction', 'Flexion'],
      success: {
        headline: 'MEDIAL ROTATION',
        detail: 'The right thigh turned inward around its own long axis. Knee and toes swung round and the android pivoted to face the drone.',
        deeper: 'Going deeper: the front fibres of the gluteus medius and the tensor fasciae latae shorten (concentric) to medially rotate the hip.',
        agonists: ['gluteus_medius', 'tensor_fasciae_latae'],
        contraction: 'concentric',
      },
      fail: {
        'Lateral rotation': {
          headline: 'PIVOTED THE WRONG WAY',
          explain: 'Lateral rotation turns the thigh OUTWARD. Your right knee and toes swung away from your left foot, so you turned your back on the drone. The pivot needed MEDIAL ROTATION: gluteus medius (front fibres) and tensor fasciae latae, concentric.',
          damage: 'android',
        },
        Rotation: {
          headline: 'TWISTED, FEET LOCKED',
          explain: 'Rotation turns the TRUNK (spine), not the hip. Your chest twisted left but your legs stayed locked, so you lost balance. The pivot needed MEDIAL ROTATION of the hip: gluteus medius (front fibres) and tensor fasciae latae, concentric.',
          damage: 'android',
        },
        Abduction: {
          headline: 'PLANE VIOLATION: LEG OUT SIDEWAYS',
          explain: 'Abduction is a FRONTAL-plane movement: it swings the leg out to the side. Your foot left the ground and the servos glitched. The pivot needed MEDIAL ROTATION of the hip: gluteus medius (front fibres) and tensor fasciae latae, concentric.',
          damage: 'android',
          planeError: true,
        },
        Flexion: {
          headline: 'PLANE VIOLATION: KNEE LIFT',
          explain: 'Flexion is a SAGITTAL-plane movement: it lifts the knee forward and up. You stood on one leg facing the wrong way and the servos glitched. The pivot needed MEDIAL ROTATION of the hip (concentric).',
          damage: 'android',
          planeError: true,
        },
      },
      timeout: {
        headline: 'FLANKED',
        explain: 'Your stance stayed locked and the drone hit you from the side. Turning the knee and toes in toward the other foot is MEDIAL ROTATION of the hip (gluteus medius, tensor fasciae latae, concentric).',
        damage: 'android',
      },
    },

    tetherPull: {
      title: 'TETHER DRONE',
      tier: 2,
      kind: 'contraction',
      limb: 'arms',
      joints: ['shoulder', 'elbow'],
      focusMuscle: 'subscapularis',
      prompt: 'A tether drone hooks your wrist and tugs your hand away from your body. Hold the arm exactly where it is while an ally cuts the line. Which contraction must your shoulder muscles perform?',
      correct: 'Isometric',
      options: ['Isometric', 'Concentric', 'Eccentric', 'Isotonic'],
      success: {
        headline: 'ISOMETRIC',
        detail: 'Your shoulder muscles pulled exactly as hard as the tether, so the arm stayed still. Your ally cut the line.',
        deeper: 'Going deeper: the tether tries to laterally rotate your shoulder. The subscapularis and pectoralis major resist with force but no change in length.',
        agonists: ['subscapularis', 'pectoralis_major'],
        contraction: 'isometric',
      },
      fail: {
        Concentric: {
          headline: 'REELED THE DRONE IN',
          explain: 'A concentric contraction SHORTENS the muscle. Your arm yanked the hand back toward your belly and dragged the drone straight into you. Bracing needs an ISOMETRIC contraction: force with no change in muscle length.',
          damage: 'android',
        },
        Eccentric: {
          headline: 'DRAGGED OFF YOUR FEET',
          explain: 'An eccentric contraction LENGTHENS the muscle under tension. Your hand slowly gave way and the tether dragged you out of camp. Bracing needs an ISOMETRIC contraction: muscle force equals the pull, so nothing moves.',
          damage: 'android',
        },
        Isotonic: {
          headline: 'ARM GAVE WAY',
          explain: 'Isotonic is the umbrella name for contractions where the muscle CHANGES LENGTH: concentric or eccentric. Either way the arm moves. Yours gave way and the tether dragged you. Bracing needs an ISOMETRIC contraction.',
          damage: 'android',
          as: 'Eccentric',
        },
      },
      timeout: {
        headline: 'TETHER WON',
        explain: 'With no command the arm slowly gave way and the drone dragged you off. Holding still against a pull needs an ISOMETRIC contraction.',
        damage: 'android',
        as: 'Eccentric',
      },
    },

    heavyCatch: {
      title: 'HEAVY DROP',
      tier: 3,
      kind: 'contraction',
      limb: 'arms',
      joints: ['elbow'],
      focusMuscle: 'biceps_brachii',
      prompt: 'A heavy drone crashes onto your bent forearm. Lower it slowly to the ground so its unstable core does not burst. Which contraction must the BICEPS BRACHII perform?',
      correct: 'Eccentric',
      success: {
        headline: 'ECCENTRIC',
        detail: 'The biceps lengthened while still producing force, braking the elbow as it straightened. The drone touched down gently.',
        deeper: 'Going deeper: the elbow EXTENDS here, but the triceps is not doing the work. Gravity moves the arm; the biceps and brachialis brake it.',
        agonists: ['biceps_brachii', 'brachialis'],
        contraction: 'eccentric',
      },
      fail: {
        Concentric: {
          headline: 'FLUNG IT UPWARD',
          explain: 'A concentric contraction SHORTENS the muscle. The elbow flexed and flung the drone up at your face, where its core burst. Lowering under control needs an ECCENTRIC contraction: the biceps lengthens under tension.',
          damage: 'android',
        },
        Isometric: {
          headline: 'STUCK HOLDING IT',
          explain: 'An isometric contraction keeps the muscle the SAME length. Your elbow froze and the drone sat on your arm until its core burst. Lowering needs an ECCENTRIC contraction: the biceps lengthens under tension.',
          damage: 'android',
        },
      },
      timeout: {
        headline: 'CORE BURST',
        explain: 'Your arm locked rigid and the drone core overheated on it. Lowering a load under control needs an ECCENTRIC contraction of the biceps brachii.',
        damage: 'android',
        as: 'Isometric',
      },
    },

    netRip: {
      title: 'NET RIP',
      tier: 1,
      kind: 'contraction',
      limb: 'arms',
      joints: ['shoulder', 'elbow'],
      focusMuscle: 'latissimus_dorsi',
      prompt: 'An ally is trapped in a capture net. Grab the net with both arms reaching forward, then haul it toward your chest. Which contraction must the LATISSIMUS DORSI perform?',
      correct: 'Concentric',
      success: {
        headline: 'CONCENTRIC',
        detail: 'The latissimus dorsi shortened, pulling the arms back toward the body. The net tore open and your ally rolled free.',
        deeper: 'Going deeper: the biceps brachii also shortens to bend the elbows, and the posterior deltoid helps draw the arms back.',
        agonists: ['latissimus_dorsi', 'biceps_brachii', 'deltoid_posterior'],
        contraction: 'concentric',
      },
      fail: {
        Eccentric: {
          headline: 'NET SLIPPED AWAY',
          explain: 'An eccentric contraction LENGTHENS the muscle under tension. Your arms slid forward and the net drone dragged your ally away. Pulling toward you needs a CONCENTRIC contraction: the latissimus dorsi shortens.',
          damage: 'ally',
        },
        Isometric: {
          headline: 'TUG OF WAR, LOST',
          explain: 'An isometric contraction keeps the muscle the SAME length. Your arms locked, the net never tore, and the drone reeled your ally off. Pulling toward you needs a CONCENTRIC contraction: the latissimus dorsi shortens.',
          damage: 'ally',
        },
      },
      timeout: {
        headline: 'ALLY DRAGGED OFF',
        explain: 'Your arms stayed locked and the drone hauled your ally away. Pulling the arms toward the body needs a CONCENTRIC contraction of the latissimus dorsi.',
        damage: 'ally',
        as: 'Isometric',
      },
    },
  };

  // Level select metadata (menu). Status: 'playable' | 'design' | 'paused'
  const LEVELS = [
    {
      id: 'frontal',
      plane: 'frontal',
      title: 'Precision Lab',
      tag: 'FRONTAL PLANE · SAGITTAL AXIS',
      blurb: 'Inside the factory. Scientists test and study the android on a precision wall: abduct or adduct one limb to reach, then turn the palm to press. Every error earns a shock. Run out of energy and the android shuts down.',
      status: 'design',
    },
    {
      id: 'sagittal',
      plane: 'sagittal',
      title: 'Factory Escape',
      tag: 'SAGITTAL PLANE · FRONTAL AXIS',
      blurb: 'The escape. The android and its friends break out of the factory. Time slows at every hazard: choose the right movement or contraction before the timer ends.',
      status: 'playable',
    },
    {
      id: 'transverse',
      plane: 'transverse',
      title: 'Drone Defense',
      tag: 'TRANSVERSE PLANE · LONGITUDINAL AXIS',
      blurb: 'The night after the escape. Seen from above, the android defends a scrapyard camp outside the factory while its allies repair a wrecked transport. Twist, swat, throw and turn the palm to stop wave after wave of capture drones, then upgrade in the workshop.',
      status: 'playable',
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
        'Choose the correct MOVEMENT (e.g. flexion or extension) or CONTRACTION (e.g. concentric or isometric) before the timer runs out. Click, or press 1–4.',
        'Wrong, but in the sagittal plane: if you pick the wrong flexion or extension, the android does exactly that, so you can see what goes wrong.',
        'A movement from another plane (abduction, rotation and so on): the android malfunctions and the screen cracks.',
        'The android has an ENERGY bar of 5 cells.',
        'Small mistakes damage part of the android. You lose 1 cell and get the SAME question again.',
        'Fatal mistakes (falling into a hole, or being crushed by a door or crate) make the android explode. You go back to the last checkpoint. Running out of time at these hazards is also fatal.',
        'Save your friends at the blast door to win back 1 cell. If energy reaches 0 the android shuts down and you go back to the checkpoint.',
        'A wrong answer never skips a question. Hazards start simple and get harder.',
        'Your friends, the other escaping androids, run on the back catwalk. If one fails it stumbles, its light turns red and you see "UNIT-07 DOWN".',
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
        'Inside the factory, before any escape: scientists are testing and studying the android. It must climb a test wall while they watch from behind the glass.',
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
        'The night after the escape. Your allies are fixing a wrecked transport in a scrapyard. Capture drones attack from every side. Hold them off until the repair bar is full.',
        'You look straight down from above. The axis for every move points out of the screen (⊙), running from head to toe through the body.',
        'Click or tap a drone (or use the arrow keys or A/D) to choose a target. The android handles small drones by itself.',
        'Big threats freeze time. Choose the right MOVEMENT or CONTRACTION before the timer runs out. Click, or press 1–4.',
        'ROTATION: turn the trunk (spine) to face a drone behind you.',
        'MEDIAL and LATERAL ROTATION: turn the upper arm or thigh inward or outward around its own long axis, like winding up and throwing a disc.',
        'HORIZONTAL ADDUCTION and ABDUCTION: swing a straight arm at shoulder height across the chest, or out and back.',
        'PRONATION and SUPINATION: turn the forearm so the palm faces down or up.',
        'Some threats ask for a CONTRACTION: bracing still is isometric, lowering under control is eccentric, pulling or throwing is concentric.',
        'Wrong, but still a transverse move: the android does exactly what you chose and misses. An ally gets netted, or you take a hit.',
        'A move from another plane (flexion, abduction and so on): the android glitches and the screen cracks.',
        'ENERGY: 5 cells. Each hit costs 1 cell. At 0 the android shuts down and the wave restarts.',
        'ALLIES: the Mechanic speeds up repairs, the Medic restores energy, the Scout shows where drones come from, and the Engineer builds a turret.',
        'A netted ally gets dragged away. Rescue them quickly to win back 1 energy cell.',
        'WORKSHOP: between waves, answer exam-style questions to earn SCRAP. Streaks and harder questions pay more.',
        'Spend scrap on upgrades, then choose which ones to power for the next wave. Questions you miss come back later, so you can clear them.',
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
    { q: 'Standing under a closing door, arms up and knees bent, to keep it from moving: what type of contraction do the arm and leg muscles perform?', a: 'Isometric: muscle force equals the load, so muscle length and joint angles stay the same' },
    { q: 'Which two contraction types are kinds of ISOTONIC contraction?', a: 'Concentric and eccentric' },
    { q: 'In which plane do pronation and supination of the forearm occur, and about which axis?', a: 'Transverse plane; longitudinal (vertical) axis' },
    { q: 'Which muscle is the prime mover when a straight arm at shoulder height swings across the chest? Name the movement.', a: 'Pectoralis major; horizontal adduction (transverse plane)' },
    { q: 'Which radio-ulnar movement turns the palm to face up, and which two muscles produce it?', a: 'Supination; supinator and biceps brachii' },
    { q: 'Throwing with the elbow tucked: which shoulder movement is the wind-up, and which is the release?', a: 'Wind-up: lateral rotation (infraspinatus). Release: medial rotation (subscapularis, pectoralis major, latissimus dorsi)' },
    { q: 'Turning the chest to look behind you with the feet planted: name the movement at the spine and the muscles that produce it.', a: 'Rotation of the trunk (spine), transverse plane; external and internal obliques' },
  ];

  // ---------------------------------------------------------------
  // WORKSHOP EXAM TERMINAL: IB SEHS Paper-1-style multiple choice.
  //   { id, topic, difficulty 1 (recall) | 2 (application) | 3 (analysis),
  //     stem, options[4], answer (index), explain,
  //     whyWrong[4]: null at the answer index, else why that option fails }
  // Stems may name axes directly (exam wording); accepted axis names:
  // see AXIS_NAMES.
  // ---------------------------------------------------------------
  const MCQ_TOPICS = {
    planes_axes: 'Planes & axes',
    joint_actions: 'Joint actions',
    contractions: 'Contraction types',
    agonist_antagonist: 'Agonists & antagonists',
    muscle_actions: 'Muscle actions',
    joints_levers: 'Joints & levers',
  };

  const MCQ_BANK = [
    // ---------------- planes_axes ----------------
    {
      id: 'pa01', topic: 'planes_axes', difficulty: 1,
      stem: 'Which plane divides the body into left and right sides?',
      options: ['Frontal plane', 'Sagittal plane', 'Transverse plane', 'Coronal plane'],
      answer: 1,
      explain: 'The sagittal plane runs front to back and splits the body into left and right sides.',
      whyWrong: ['The frontal plane divides the body into front and back.', null, 'The transverse plane divides the body into upper and lower parts.', 'Coronal plane is another name for the frontal plane (front and back).'],
    },
    {
      id: 'pa02', topic: 'planes_axes', difficulty: 1,
      stem: 'About which axis does movement in the transverse plane occur?',
      options: ['Transverse axis', 'Frontal axis', 'Longitudinal axis', 'Sagittal axis'],
      answer: 2,
      explain: 'Transverse-plane movements (e.g. rotation) turn about the longitudinal (vertical) axis.',
      whyWrong: ['The transverse AXIS is another name for the frontal axis, which pairs with the sagittal plane.', 'The frontal axis pairs with the sagittal plane.', null, 'The sagittal axis pairs with the frontal plane.'],
    },
    {
      id: 'pa03', topic: 'planes_axes', difficulty: 1,
      stem: 'Which plane divides the body into anterior (front) and posterior (back) parts?',
      options: ['Frontal plane', 'Sagittal plane', 'Transverse plane', 'Horizontal plane'],
      answer: 0,
      explain: 'The frontal (coronal) plane runs side to side and splits the body into front and back.',
      whyWrong: [null, 'The sagittal plane divides left from right.', 'The transverse plane divides upper from lower.', 'Horizontal plane is another name for the transverse plane (upper and lower).'],
    },
    {
      id: 'pa04', topic: 'planes_axes', difficulty: 1,
      stem: 'Identify the axis that passes horizontally from the front to the back of the body.',
      options: ['Longitudinal axis', 'Mediolateral axis', 'Anteroposterior axis', 'Vertical axis'],
      answer: 2,
      explain: 'Anteroposterior means front-to-back. It is also called the sagittal axis.',
      whyWrong: ['The longitudinal axis runs vertically from head to toe.', 'The mediolateral axis runs from side to side.', null, 'The vertical axis runs from head to toe (it is the longitudinal axis).'],
    },
    {
      id: 'pa05', topic: 'planes_axes', difficulty: 2,
      stem: 'Which of the following correctly pairs a plane with its axis of rotation?',
      options: ['Sagittal plane and sagittal axis', 'Frontal plane and frontal axis', 'Transverse plane and longitudinal axis', 'Transverse plane and transverse axis'],
      answer: 2,
      explain: 'Transverse plane pairs with the longitudinal axis. The other pairs are sagittal plane with frontal axis, and frontal plane with sagittal axis.',
      whyWrong: ['The sagittal plane rotates about the frontal axis.', 'The frontal plane rotates about the sagittal axis.', null, 'The transverse axis is the frontal axis, which belongs to the sagittal plane.'],
    },
    {
      id: 'pa06', topic: 'planes_axes', difficulty: 2,
      stem: 'A gymnast performs a forward somersault. In which plane and about which axis does the body rotate?',
      options: ['Sagittal plane, frontal axis', 'Frontal plane, sagittal axis', 'Transverse plane, longitudinal axis', 'Sagittal plane, longitudinal axis'],
      answer: 0,
      explain: 'A somersault turns head over heels (front to back), which is the sagittal plane about the frontal (mediolateral) axis.',
      whyWrong: [null, 'Frontal plane about the sagittal axis is a cartwheel.', 'Transverse plane about the longitudinal axis is a twist or spin.', 'The sagittal plane does not rotate about the longitudinal axis.'],
    },
    {
      id: 'pa07', topic: 'planes_axes', difficulty: 2,
      stem: 'A gymnast performs a cartwheel. Identify the plane and axis of rotation.',
      options: ['Transverse plane, longitudinal axis', 'Sagittal plane, frontal axis', 'Frontal plane, anteroposterior axis', 'Frontal plane, mediolateral axis'],
      answer: 2,
      explain: 'A cartwheel turns sideways, which is the frontal plane about the anteroposterior (sagittal) axis.',
      whyWrong: ['That pair describes a spin or twist.', 'That pair describes a somersault.', null, 'The mediolateral axis belongs to the sagittal plane, not the frontal plane.'],
    },
    {
      id: 'pa08', topic: 'planes_axes', difficulty: 2,
      stem: 'A figure skater spins on the spot. In which plane and about which axis does the skater rotate?',
      options: ['Transverse plane, vertical axis', 'Frontal plane, vertical axis', 'Sagittal plane, transverse axis', 'Transverse plane, transverse axis'],
      answer: 0,
      explain: 'A spin is rotation in the transverse plane about the vertical (longitudinal) axis.',
      whyWrong: [null, 'The frontal plane rotates about the sagittal axis, not the vertical axis.', 'Sagittal plane about the transverse axis is a somersault, not a spin.', 'The transverse AXIS is the frontal axis; it does not pair with the transverse plane.'],
    },
    {
      id: 'pa09', topic: 'planes_axes', difficulty: 1,
      stem: 'Which axis is also known as the mediolateral (or transverse) axis?',
      options: ['Sagittal axis', 'Frontal axis', 'Longitudinal axis', 'Anteroposterior axis'],
      answer: 1,
      explain: 'The frontal axis runs side to side, so it is also called the mediolateral or transverse axis.',
      whyWrong: ['The sagittal axis runs front to back (anteroposterior).', null, 'The longitudinal axis runs head to toe (vertical).', 'Anteroposterior is another name for the sagittal axis.'],
    },
    {
      id: 'pa10', topic: 'planes_axes', difficulty: 2,
      stem: 'During a star jump, the arms and legs move out to the sides and back in. Identify the plane and axis.',
      options: ['Sagittal plane, frontal axis', 'Frontal plane, sagittal axis', 'Transverse plane, longitudinal axis', 'Frontal plane, longitudinal axis'],
      answer: 1,
      explain: 'Abduction and adduction of the arms and legs happen in the frontal plane about the sagittal (anteroposterior) axis.',
      whyWrong: ['Sagittal-plane movements are forward and backward, such as flexion.', null, 'Transverse-plane movements are rotations, not sideways lifts.', 'The frontal plane rotates about the sagittal axis, not the longitudinal axis.'],
    },
    {
      id: 'pa11', topic: 'planes_axes', difficulty: 3,
      stem: 'A diver performs a forward somersault with a full twist. About which two axes does the diver rotate?',
      options: ['Frontal axis and longitudinal axis', 'Sagittal axis and longitudinal axis', 'Frontal axis and sagittal axis', 'Longitudinal axis only'],
      answer: 0,
      explain: 'The somersault rotates about the frontal axis (sagittal plane); the twist rotates about the longitudinal axis (transverse plane).',
      whyWrong: [null, 'The sagittal axis is for cartwheel-type rotation, not a forward somersault.', 'A twist is about the longitudinal axis, not the sagittal axis.', 'The forward somersault also needs rotation about the frontal axis.'],
    },
    {
      id: 'pa12', topic: 'planes_axes', difficulty: 3,
      stem: 'A student writes: "Trunk rotation in a golf swing happens about the transverse axis." Which statement best corrects this?',
      options: ['It is already correct: a transverse-plane movement uses the transverse axis', 'It is in the transverse plane about the longitudinal axis; the transverse axis belongs to the sagittal plane', 'It is in the sagittal plane about the transverse axis', 'It is in the frontal plane about the longitudinal axis'],
      answer: 1,
      explain: 'Trunk rotation is transverse plane, longitudinal axis. "Transverse axis" is another name for the frontal axis, used for sagittal-plane movements.',
      whyWrong: ['The transverse axis is not the axis of the transverse plane.', null, 'Sagittal-plane movements are flexion and extension, not rotation.', 'The frontal plane pairs with the sagittal axis, and rotation is not a frontal-plane movement.'],
    },

    // ---------------- joint_actions ----------------
    {
      id: 'ja01', topic: 'joint_actions', difficulty: 1,
      stem: 'Which of the following movements occurs in the transverse plane?',
      options: ['Abduction', 'Lateral flexion', 'Medial rotation', 'Dorsiflexion'],
      answer: 2,
      explain: 'Medial rotation turns a limb inward around its long axis, in the transverse plane.',
      whyWrong: ['Abduction is a frontal-plane movement.', 'Lateral flexion is a frontal-plane movement.', null, 'Dorsiflexion is a sagittal-plane movement.'],
    },
    {
      id: 'ja02', topic: 'joint_actions', difficulty: 1,
      stem: 'With the elbow bent at 90°, which term describes turning the forearm so the palm faces upward?',
      options: ['Pronation', 'Supination', 'Lateral rotation', 'Eversion'],
      answer: 1,
      explain: 'Supination turns the palm to face up (forward in the anatomical position).',
      whyWrong: ['Pronation turns the palm to face down.', null, 'Lateral rotation happens at the shoulder or hip, not the forearm.', 'Eversion turns the sole of the foot outward.'],
    },
    {
      id: 'ja03', topic: 'joint_actions', difficulty: 1,
      stem: 'Which of the following movements occurs in the frontal plane?',
      options: ['Horizontal adduction', 'Plantarflexion', 'Inversion', 'Supination'],
      answer: 2,
      explain: 'Inversion turns the sole of the foot inward, a frontal-plane movement.',
      whyWrong: ['Horizontal adduction is a transverse-plane movement.', 'Plantarflexion is a sagittal-plane movement.', null, 'Supination is a transverse-plane movement.'],
    },
    {
      id: 'ja04', topic: 'joint_actions', difficulty: 2,
      stem: 'In a chest fly, the arms start straight out to the sides at shoulder height and swing forward to meet in front of the chest. Identify the shoulder movement.',
      options: ['Adduction', 'Horizontal adduction', 'Flexion', 'Horizontal abduction'],
      answer: 1,
      explain: 'A raised arm moving toward the midline at shoulder height is horizontal adduction (transverse plane).',
      whyWrong: ['Adduction lowers the arm down to the side in the frontal plane.', null, 'Flexion raises the arm forward and up in the sagittal plane.', 'Horizontal abduction is the reverse: arms swing out and back.'],
    },
    {
      id: 'ja05', topic: 'joint_actions', difficulty: 2,
      stem: 'In a reverse fly, the arms start straight out in front at shoulder height and swing out and back. Identify the shoulder movement.',
      options: ['Horizontal abduction', 'Abduction', 'Extension', 'Lateral rotation'],
      answer: 0,
      explain: 'A raised arm moving away from the midline at shoulder height is horizontal abduction (transverse plane).',
      whyWrong: [null, 'Abduction raises the arm sideways from the hip in the frontal plane.', 'Extension swings the arm down and back in the sagittal plane.', 'Lateral rotation turns the arm about its own long axis; it does not swing it.'],
    },
    {
      id: 'ja06', topic: 'joint_actions', difficulty: 2,
      stem: 'In the backswing of a golf drive, the shoulders turn away from the target while the feet stay planted. Which movement occurs at the spine?',
      options: ['Lateral flexion', 'Rotation', 'Hyperextension', 'Lateral rotation'],
      answer: 1,
      explain: 'Turning the trunk is rotation of the spine, in the transverse plane about the longitudinal axis.',
      whyWrong: ['Lateral flexion bends the trunk sideways (frontal plane).', null, 'Hyperextension arches the spine backward (sagittal plane).', 'Lateral rotation describes a limb at the shoulder or hip, not the spine.'],
    },
    {
      id: 'ja07', topic: 'joint_actions', difficulty: 2,
      stem: 'A basketball player dribbles with the palm facing the floor. Which movement at the radio-ulnar joint turns the palm to face down?',
      options: ['Supination', 'Pronation', 'Medial rotation', 'Ulnar deviation'],
      answer: 1,
      explain: 'Pronation turns the forearm so the palm faces down.',
      whyWrong: ['Supination turns the palm to face up.', null, 'Medial rotation happens at the shoulder, not the radio-ulnar joint.', 'Ulnar deviation tilts the hand toward the little finger at the wrist.'],
    },
    {
      id: 'ja08', topic: 'joint_actions', difficulty: 2,
      stem: 'A tennis player prepares to serve: the upper arm is raised and the racket drops back behind the head. Identify the movement at the shoulder.',
      options: ['Medial rotation', 'Lateral rotation', 'Horizontal adduction', 'Extension'],
      answer: 1,
      explain: 'Cocking the arm back is lateral (external) rotation of the shoulder.',
      whyWrong: ['Medial rotation brings the racket forward during the hit.', null, 'Horizontal adduction swings the arm across the chest.', 'Extension swings the arm down and back in the sagittal plane.'],
    },
    {
      id: 'ja09', topic: 'joint_actions', difficulty: 2,
      stem: 'During the acceleration phase of an overarm throw, the upper arm turns forcefully inward. Which movement occurs at the shoulder?',
      options: ['Medial rotation', 'Pronation', 'Lateral rotation', 'Adduction'],
      answer: 0,
      explain: 'Turning the upper arm inward around its long axis is medial (internal) rotation.',
      whyWrong: [null, 'Pronation happens at the forearm, not the shoulder.', 'Lateral rotation turns the arm outward (the cocking phase).', 'Adduction lowers the arm toward the side in the frontal plane.'],
    },
    {
      id: 'ja10', topic: 'joint_actions', difficulty: 3,
      stem: 'For a side-foot pass, a footballer turns the toes of the kicking leg outward from the hip. Identify the hip movement and its plane.',
      options: ['Medial rotation, transverse plane', 'Lateral rotation, transverse plane', 'Eversion, frontal plane', 'Abduction, frontal plane'],
      answer: 1,
      explain: 'Turning the thigh and toes outward is lateral rotation of the hip, in the transverse plane.',
      whyWrong: ['Medial rotation turns the toes inward.', null, 'Eversion is a foot movement at the ankle, not the hip.', 'Abduction moves the leg out to the side; it does not turn it.'],
    },
    {
      id: 'ja11', topic: 'joint_actions', difficulty: 3,
      stem: 'Which list contains ONLY transverse-plane movements?',
      options: ['Pronation, supination, horizontal abduction', 'Rotation, lateral flexion, medial rotation', 'Flexion, rotation, supination', 'Abduction, horizontal adduction, pronation'],
      answer: 0,
      explain: 'Pronation, supination and horizontal abduction all occur in the transverse plane.',
      whyWrong: [null, 'Lateral flexion is a frontal-plane movement.', 'Flexion is a sagittal-plane movement.', 'Abduction is a frontal-plane movement.'],
    },
    {
      id: 'ja12', topic: 'joint_actions', difficulty: 1,
      stem: 'Which movement increases the angle between two bones at a joint?',
      options: ['Flexion', 'Extension', 'Adduction', 'Dorsiflexion'],
      answer: 1,
      explain: 'Extension increases the joint angle (flexion decreases it).',
      whyWrong: ['Flexion decreases the joint angle.', null, 'Adduction moves a limb toward the midline; it does not describe the joint angle.', 'Dorsiflexion decreases the angle between the top of the foot and the shin.'],
    },
    {
      id: 'ja13', topic: 'joint_actions', difficulty: 2,
      stem: 'Which statement correctly describes inversion?',
      options: ['Turning the sole of the foot inward, in the frontal plane', 'Pointing the toes away from the shin, in the sagittal plane', 'Turning the sole of the foot inward, in the transverse plane', 'Turning the thigh inward at the hip, in the transverse plane'],
      answer: 0,
      explain: 'Inversion turns the sole inward and is a frontal-plane movement.',
      whyWrong: [null, 'That describes plantarflexion.', 'The description is right but inversion is a frontal-plane movement.', 'That describes medial rotation of the hip.'],
    },
    {
      id: 'ja14', topic: 'joint_actions', difficulty: 3,
      stem: 'In the final sweep of a discus throw, the straight throwing arm swings forward around the body at shoulder height. Which description is correct?',
      options: ['Horizontal adduction, transverse plane, longitudinal axis', 'Adduction, frontal plane, sagittal axis', 'Flexion, sagittal plane, frontal axis', 'Horizontal abduction, transverse plane, longitudinal axis'],
      answer: 0,
      explain: 'A straight arm at shoulder height swinging toward the midline is horizontal adduction: transverse plane, longitudinal axis.',
      whyWrong: [null, 'Adduction lowers the arm to the side; the discus arm stays at shoulder height.', 'Flexion raises the arm forward and up from the side.', 'Horizontal abduction swings the arm backward, as in the wind-up.'],
    },

    // ---------------- contractions ----------------
    {
      id: 'ct01', topic: 'contractions', difficulty: 1,
      stem: 'Which type of contraction happens when a muscle lengthens while producing force?',
      options: ['Concentric', 'Isometric', 'Eccentric', 'Isotonic'],
      answer: 2,
      explain: 'Eccentric contractions lengthen under tension, braking or controlling a movement.',
      whyWrong: ['Concentric contractions shorten the muscle.', 'Isometric contractions keep the muscle the same length.', null, 'Isotonic covers BOTH shortening and lengthening, so it is not specific enough.'],
    },
    {
      id: 'ct02', topic: 'contractions', difficulty: 1,
      stem: 'A muscle produces force but does not change length, so the joint does not move. Identify the contraction type.',
      options: ['Isotonic', 'Isometric', 'Concentric', 'Eccentric'],
      answer: 1,
      explain: 'Isometric means "same length": tension with no change in muscle length.',
      whyWrong: ['Isotonic means the muscle changes length, so the joint moves.', null, 'Concentric contractions shorten the muscle.', 'Eccentric contractions lengthen the muscle.'],
    },
    {
      id: 'ct03', topic: 'contractions', difficulty: 1,
      stem: 'Which two contraction types are both forms of isotonic contraction?',
      options: ['Concentric and isometric', 'Eccentric and isometric', 'Concentric and eccentric', 'Isometric only'],
      answer: 2,
      explain: 'Isotonic contractions change muscle length: concentric (shortening) and eccentric (lengthening).',
      whyWrong: ['Isometric is not isotonic because the length stays the same.', 'Isometric is not isotonic because the length stays the same.', null, 'Isometric is not isotonic at all, and isotonic has two kinds.'],
    },
    {
      id: 'ct04', topic: 'contractions', difficulty: 2,
      stem: 'During the upward phase of a biceps curl, what type of contraction does the biceps brachii perform?',
      options: ['Eccentric', 'Concentric', 'Isometric', 'Static'],
      answer: 1,
      explain: 'The biceps shortens under tension to flex the elbow and lift the weight: concentric.',
      whyWrong: ['Eccentric happens on the way DOWN, when the biceps lengthens.', null, 'Isometric would hold the weight still.', 'Static is another word for isometric; the elbow is moving.'],
    },
    {
      id: 'ct05', topic: 'contractions', difficulty: 2,
      stem: 'During the downward phase of a squat, the knees and hips flex. What is the quadriceps doing?',
      options: ['Contracting concentrically', 'Contracting eccentrically', 'Relaxing, because gravity does the work', 'Contracting isometrically'],
      answer: 1,
      explain: 'The quadriceps lengthen under tension to control knee flexion against gravity: eccentric.',
      whyWrong: ['Concentric happens on the way UP, when the quadriceps shorten.', null, 'If the quadriceps relaxed, the body would drop uncontrolled.', 'Isometric would hold the squat still; here the knees are bending.'],
    },
    {
      id: 'ct06', topic: 'contractions', difficulty: 2,
      stem: 'A student holds a plank position for 60 seconds. What type of contraction do the abdominal muscles perform?',
      options: ['Concentric', 'Eccentric', 'Isometric', 'Isotonic'],
      answer: 2,
      explain: 'The muscles produce force with no change in length and no joint movement: isometric.',
      whyWrong: ['Concentric would shorten the muscle and move the trunk.', 'Eccentric would lengthen the muscle and move the trunk.', null, 'Isotonic means the muscle changes length; in a plank it does not.'],
    },
    {
      id: 'ct07', topic: 'contractions', difficulty: 3,
      stem: 'During the lowering phase of a push-up, which statement about the triceps brachii is correct?',
      options: ['It shortens under tension (concentric) to extend the elbow', 'It lengthens under tension (eccentric) to control elbow flexion', 'It lengthens with no tension because gravity lowers the body', 'It stays the same length (isometric) because the hands do not move'],
      answer: 1,
      explain: 'As the elbows bend, the triceps lengthens while working to brake the descent: eccentric.',
      whyWrong: ['Concentric triceps action happens on the way up.', null, 'Without tension the body would fall to the floor.', 'The hands are still, but the elbow angle changes, so the muscle length changes.'],
    },
    {
      id: 'ct08', topic: 'contractions', difficulty: 3,
      stem: 'In the late swing phase of sprinting, the hamstrings slow down the lower leg as the knee extends. Which statement is correct?',
      options: ['Concentric, because the hamstrings flex the knee', 'Eccentric, because the hamstrings lengthen while braking knee extension', 'Isometric, because the knee angle stays fixed', 'Concentric, because the quadriceps are the agonist'],
      answer: 1,
      explain: 'The knee extends, so the hamstrings lengthen while producing force to brake it: eccentric.',
      whyWrong: ['The knee is extending, so the hamstrings are lengthening, not shortening.', null, 'The knee angle is changing, not fixed.', 'This describes a different muscle; the hamstrings themselves are lengthening.'],
    },
    {
      id: 'ct09', topic: 'contractions', difficulty: 2,
      stem: 'During the slow lowering phase of a lateral raise, what type of contraction does the middle deltoid perform?',
      options: ['Concentric', 'Eccentric', 'Isometric', 'No contraction'],
      answer: 1,
      explain: 'The deltoid lengthens under tension to control shoulder adduction against gravity: eccentric.',
      whyWrong: ['Concentric happens when the arms are raised.', null, 'Isometric would hold the arms still.', 'Without contraction the arms would drop quickly, not slowly.'],
    },
    {
      id: 'ct10', topic: 'contractions', difficulty: 3,
      stem: 'A volleyball player dips down, then jumps up to block. Which correctly describes the quadriceps in the two phases?',
      options: ['Dip: concentric; jump: eccentric', 'Dip: eccentric; jump: concentric', 'Dip: isometric; jump: concentric', 'Both phases: concentric'],
      answer: 1,
      explain: 'In the dip the quadriceps lengthen to control knee flexion (eccentric); in the jump they shorten to extend the knee (concentric).',
      whyWrong: ['The phases are reversed.', null, 'The knees bend during the dip, so the quadriceps change length.', 'In the dip the quadriceps lengthen, so it cannot be concentric.'],
    },
    {
      id: 'ct11', topic: 'contractions', difficulty: 3,
      stem: 'A weightlifter holds a barbell still overhead, then slowly lowers it to the shoulders. Which sequence describes the triceps brachii?',
      options: ['Isometric, then eccentric', 'Concentric, then eccentric', 'Isometric, then concentric', 'Eccentric, then isometric'],
      answer: 0,
      explain: 'Holding still is isometric. Lowering bends the elbows while the triceps brakes the bar: eccentric.',
      whyWrong: [null, 'The bar is held still first, so there is no shortening.', 'Lowering lengthens the triceps, so it is not concentric.', 'The order is reversed.'],
    },
    {
      id: 'ct12', topic: 'contractions', difficulty: 2,
      stem: 'In a rugby scrum, both packs push as hard as they can but neither moves. What type of contraction do the leg extensors perform?',
      options: ['Concentric', 'Eccentric', 'Isometric', 'Isotonic'],
      answer: 2,
      explain: 'Force is produced with no change in muscle length or joint angle: isometric.',
      whyWrong: ['Concentric would shorten the muscles and drive the scrum forward.', 'Eccentric would mean the legs are being pushed back under control.', null, 'Isotonic means the muscle changes length, but nothing is moving.'],
    },

    // ---------------- agonist_antagonist ----------------
    {
      id: 'aa01', topic: 'agonist_antagonist', difficulty: 1,
      stem: 'During elbow flexion in a biceps curl, which muscle is the antagonist?',
      options: ['Biceps brachii', 'Brachialis', 'Triceps brachii', 'Anterior deltoid'],
      answer: 2,
      explain: 'The triceps brachii extends the elbow, so it opposes (and relaxes during) elbow flexion.',
      whyWrong: ['The biceps brachii is the agonist for elbow flexion.', 'The brachialis also flexes the elbow (agonist or synergist).', null, 'The anterior deltoid acts at the shoulder, not the elbow.'],
    },
    {
      id: 'aa02', topic: 'agonist_antagonist', difficulty: 1,
      stem: 'What name is given to the muscle mainly responsible for producing a movement?',
      options: ['Antagonist', 'Agonist (prime mover)', 'Fixator', 'Synergist'],
      answer: 1,
      explain: 'The agonist, or prime mover, is the main muscle producing the movement.',
      whyWrong: ['The antagonist opposes the movement.', null, 'A fixator stabilises a bone so the agonist can work.', 'A synergist assists the agonist but is not the main mover.'],
    },
    {
      id: 'aa03', topic: 'agonist_antagonist', difficulty: 1,
      stem: 'Identify the muscle role that stabilises the origin of the agonist so it can work efficiently.',
      options: ['Fixator (stabiliser)', 'Antagonist', 'Agonist', 'Prime mover'],
      answer: 0,
      explain: 'A fixator holds a bone steady so the agonist has a stable base to pull from.',
      whyWrong: [null, 'The antagonist opposes the movement.', 'The agonist produces the movement.', 'Prime mover is another name for the agonist.'],
    },
    {
      id: 'aa04', topic: 'agonist_antagonist', difficulty: 2,
      stem: 'During knee extension when kicking a ball, which pair is correctly listed as agonist / antagonist?',
      options: ['Hamstrings / quadriceps', 'Quadriceps / hamstrings', 'Gastrocnemius / tibialis anterior', 'Gluteus maximus / iliopsoas'],
      answer: 1,
      explain: 'The quadriceps extend the knee (agonist) while the hamstrings oppose it (antagonist).',
      whyWrong: ['This is reversed: the hamstrings flex the knee.', null, 'This pair acts at the ankle.', 'This pair acts at the hip.'],
    },
    {
      id: 'aa05', topic: 'agonist_antagonist', difficulty: 2,
      stem: 'During dorsiflexion of the ankle, which muscle acts as the antagonist?',
      options: ['Tibialis anterior', 'Gastrocnemius', 'Quadriceps', 'Iliopsoas'],
      answer: 1,
      explain: 'The gastrocnemius plantarflexes the ankle, so it opposes dorsiflexion.',
      whyWrong: ['The tibialis anterior is the agonist for dorsiflexion.', null, 'The quadriceps act at the knee.', 'The iliopsoas acts at the hip.'],
    },
    {
      id: 'aa06', topic: 'agonist_antagonist', difficulty: 2,
      stem: 'Which of the following is an antagonistic pair for hip flexion and extension?',
      options: ['Iliopsoas and gluteus maximus', 'Quadriceps and gastrocnemius', 'Biceps brachii and brachialis', 'Gluteus medius and hip adductors'],
      answer: 0,
      explain: 'The iliopsoas flexes the hip and the gluteus maximus extends it.',
      whyWrong: [null, 'These muscles act at different joints and do not oppose each other.', 'Both flex the elbow, so they work together.', 'These oppose each other in hip abduction and adduction (frontal plane).'],
    },
    {
      id: 'aa07', topic: 'agonist_antagonist', difficulty: 2,
      stem: 'During the release of an overarm throw, the shoulder medially rotates. Which muscle is the antagonist?',
      options: ['Subscapularis', 'Infraspinatus', 'Pectoralis major', 'Latissimus dorsi'],
      answer: 1,
      explain: 'The infraspinatus laterally rotates the shoulder, so it opposes medial rotation.',
      whyWrong: ['The subscapularis is a medial rotator (agonist).', null, 'The pectoralis major helps medially rotate the shoulder.', 'The latissimus dorsi helps medially rotate the shoulder.'],
    },
    {
      id: 'aa08', topic: 'agonist_antagonist', difficulty: 2,
      stem: 'In a chest fly (horizontal adduction of the shoulder), which pair is correctly listed as agonist / antagonist?',
      options: ['Pectoralis major / posterior deltoid', 'Posterior deltoid / pectoralis major', 'Latissimus dorsi / triceps brachii', 'Anterior deltoid / pectoralis major'],
      answer: 0,
      explain: 'The pectoralis major horizontally adducts; the posterior deltoid horizontally abducts, so it opposes.',
      whyWrong: [null, 'This is reversed: the posterior deltoid horizontally abducts.', 'Neither is the main horizontal adductor, and they are not an opposing pair here.', 'Both muscles horizontally adduct, so they work together (synergists).'],
    },
    {
      id: 'aa09', topic: 'agonist_antagonist', difficulty: 3,
      stem: 'During the lowering phase of a biceps curl, which muscle is the agonist and how is it contracting?',
      options: ['Triceps brachii, concentric', 'Biceps brachii, eccentric', 'Triceps brachii, eccentric', 'No agonist: gravity lowers the weight'],
      answer: 1,
      explain: 'The biceps stays the agonist, lengthening under tension to control the weight: eccentric.',
      whyWrong: ['The triceps does not pull the weight down; gravity does.', null, 'The triceps is not under load in this phase.', 'Gravity moves the weight, but the biceps controls it, so it is still the agonist.'],
    },
    {
      id: 'aa10', topic: 'agonist_antagonist', difficulty: 2,
      stem: 'During a biceps curl, which muscles act as fixators to keep the shoulder joint stable?',
      options: ['Rotator cuff muscles', 'Triceps brachii', 'Brachioradialis', 'Gastrocnemius'],
      answer: 0,
      explain: 'The rotator cuff holds the head of the humerus steady so the biceps can work from a stable base.',
      whyWrong: [null, 'The triceps is the antagonist for elbow flexion.', 'The brachioradialis assists elbow flexion (synergist).', 'The gastrocnemius acts at the ankle and knee.'],
    },
    {
      id: 'aa11', topic: 'agonist_antagonist', difficulty: 3,
      stem: 'With the elbow bent, the forearm supinates to turn a doorknob. Which option correctly identifies the agonists and the antagonist?',
      options: ['Agonists: supinator and biceps brachii; antagonist: pronator teres', 'Agonist: pronator teres; antagonist: supinator', 'Agonists: supinator and triceps brachii; antagonist: biceps brachii', 'Agonist: brachialis; antagonist: pronator teres'],
      answer: 0,
      explain: 'The supinator and biceps brachii supinate the forearm; the pronator teres opposes them.',
      whyWrong: [null, 'This is reversed: the pronator teres pronates.', 'The triceps does not supinate, and the biceps is a supinator.', 'The brachialis attaches to the ulna, so it cannot supinate.'],
    },

    // ---------------- muscle_actions ----------------
    {
      id: 'ma01', topic: 'muscle_actions', difficulty: 1,
      stem: 'Which muscle both flexes the elbow and supinates the forearm?',
      options: ['Triceps brachii', 'Biceps brachii', 'Pronator teres', 'Brachialis'],
      answer: 1,
      explain: 'The biceps brachii flexes the elbow and is a strong supinator of the forearm.',
      whyWrong: ['The triceps brachii extends the elbow.', null, 'The pronator teres pronates the forearm.', 'The brachialis flexes the elbow but cannot supinate.'],
    },
    {
      id: 'ma02', topic: 'muscle_actions', difficulty: 1,
      stem: 'Identify the main action of the pronator teres.',
      options: ['Supination of the forearm', 'Pronation of the forearm', 'Elbow extension', 'Shoulder medial rotation'],
      answer: 1,
      explain: 'The pronator teres turns the forearm so the palm faces down.',
      whyWrong: ['Supination is done by the supinator and biceps brachii.', null, 'Elbow extension is done by the triceps brachii.', 'Shoulder medial rotation is done by muscles such as the subscapularis.'],
    },
    {
      id: 'ma03', topic: 'muscle_actions', difficulty: 1,
      stem: 'What is the main action of the infraspinatus?',
      options: ['Medial rotation of the shoulder', 'Lateral rotation of the shoulder', 'Abduction of the hip', 'Extension of the elbow'],
      answer: 1,
      explain: 'The infraspinatus is a rotator cuff muscle that laterally rotates the shoulder.',
      whyWrong: ['Medial rotation is done by the subscapularis.', null, 'Hip abduction is done by the gluteus medius.', 'Elbow extension is done by the triceps brachii.'],
    },
    {
      id: 'ma04', topic: 'muscle_actions', difficulty: 1,
      stem: 'Which rotator cuff muscle medially rotates the shoulder?',
      options: ['Infraspinatus', 'Supraspinatus', 'Subscapularis', 'Deltoid (middle)'],
      answer: 2,
      explain: 'The subscapularis, on the front of the shoulder blade, medially rotates the shoulder.',
      whyWrong: ['The infraspinatus laterally rotates the shoulder.', 'The supraspinatus starts shoulder abduction.', null, 'The deltoid is not a rotator cuff muscle; its middle part abducts.'],
    },
    {
      id: 'ma05', topic: 'muscle_actions', difficulty: 2,
      stem: 'Which muscle is the prime mover for horizontal adduction of the shoulder in a chest fly?',
      options: ['Pectoralis major', 'Latissimus dorsi', 'Posterior deltoid', 'Trapezius'],
      answer: 0,
      explain: 'The pectoralis major pulls the raised arm across the chest.',
      whyWrong: [null, 'The latissimus dorsi extends, adducts and medially rotates the shoulder.', 'The posterior deltoid horizontally abducts (the opposite).', 'The trapezius moves the shoulder blade, not the arm across the chest.'],
    },
    {
      id: 'ma06', topic: 'muscle_actions', difficulty: 2,
      stem: 'Which muscle is the prime mover for horizontal abduction of the shoulder in a reverse fly?',
      options: ['Anterior deltoid', 'Pectoralis major', 'Posterior deltoid', 'Biceps brachii'],
      answer: 2,
      explain: 'The posterior deltoid swings the raised arm out and back.',
      whyWrong: ['The anterior deltoid flexes and horizontally adducts the shoulder.', 'The pectoralis major horizontally adducts (the opposite).', null, 'The biceps brachii mainly acts at the elbow.'],
    },
    {
      id: 'ma07', topic: 'muscle_actions', difficulty: 2,
      stem: 'Which pair of actions is produced by the gluteus maximus?',
      options: ['Hip flexion and medial rotation', 'Hip extension and lateral rotation', 'Knee extension and hip flexion', 'Hip abduction and knee flexion'],
      answer: 1,
      explain: 'The gluteus maximus is the main hip extensor and also laterally rotates the hip.',
      whyWrong: ['Hip flexion is done by the iliopsoas.', null, 'These are actions of the rectus femoris (quadriceps).', 'Hip abduction is mainly the gluteus medius; knee flexion is the hamstrings.'],
    },
    {
      id: 'ma08', topic: 'muscle_actions', difficulty: 1,
      stem: 'Which muscles mainly rotate the trunk in the transverse plane, for example in a golf swing?',
      options: ['External and internal obliques', 'Iliopsoas', 'Pectoralis major', 'Hamstrings'],
      answer: 0,
      explain: 'The obliques, on the sides of the abdomen, rotate the trunk.',
      whyWrong: [null, 'The iliopsoas flexes the hip.', 'The pectoralis major acts at the shoulder.', 'The hamstrings flex the knee and extend the hip.'],
    },
    {
      id: 'ma09', topic: 'muscle_actions', difficulty: 3,
      stem: 'Which combination of obliques turns the trunk to the LEFT?',
      options: ['Right external oblique and left internal oblique', 'Left external oblique and left internal oblique', 'Right external oblique and right internal oblique', 'Left external oblique and right internal oblique'],
      answer: 0,
      explain: 'Rotation uses the external oblique of one side with the internal oblique of the opposite side. Turning left: right external and left internal.',
      whyWrong: [null, 'Both left obliques together mainly bend the trunk sideways to the left.', 'Both right obliques together mainly bend the trunk sideways to the right.', 'This pair turns the trunk to the RIGHT.'],
    },
    {
      id: 'ma10', topic: 'muscle_actions', difficulty: 1,
      stem: 'Which muscle is the prime mover for hip flexion?',
      options: ['Gluteus maximus', 'Iliopsoas', 'Hamstrings', 'Gastrocnemius'],
      answer: 1,
      explain: 'The iliopsoas, deep at the front of the hip, is the main hip flexor.',
      whyWrong: ['The gluteus maximus extends the hip.', null, 'The hamstrings extend the hip and flex the knee.', 'The gastrocnemius plantarflexes the ankle.'],
    },
    {
      id: 'ma11', topic: 'muscle_actions', difficulty: 2,
      stem: 'In the front-crawl pull, the arm sweeps down and back through the water. Which muscle extends, adducts and medially rotates the shoulder?',
      options: ['Latissimus dorsi', 'Deltoid (anterior)', 'Infraspinatus', 'Biceps brachii'],
      answer: 0,
      explain: 'The latissimus dorsi extends, adducts and medially rotates the shoulder.',
      whyWrong: [null, 'The anterior deltoid flexes the shoulder (the opposite).', 'The infraspinatus laterally rotates the shoulder.', 'The biceps brachii mainly flexes the elbow.'],
    },
    {
      id: 'ma12', topic: 'muscle_actions', difficulty: 2,
      stem: 'Which muscle crosses both the knee and the ankle, so it plantarflexes the ankle and assists knee flexion?',
      options: ['Soleus', 'Gastrocnemius', 'Tibialis anterior', 'Quadriceps femoris'],
      answer: 1,
      explain: 'The gastrocnemius starts above the knee and attaches to the heel, so it acts at both joints.',
      whyWrong: ['The soleus starts below the knee, so it only plantarflexes the ankle.', null, 'The tibialis anterior dorsiflexes the ankle.', 'The quadriceps extend the knee and do not cross the ankle.'],
    },
    {
      id: 'ma13', topic: 'muscle_actions', difficulty: 3,
      stem: 'In the release of a throw, the shoulder medially rotates. Which group contains ONLY muscles that medially rotate the shoulder?',
      options: ['Subscapularis, pectoralis major, latissimus dorsi', 'Infraspinatus, posterior deltoid, subscapularis', 'Pectoralis major, infraspinatus, supinator', 'Latissimus dorsi, triceps brachii, supraspinatus'],
      answer: 0,
      explain: 'The subscapularis, pectoralis major and latissimus dorsi all medially rotate the shoulder.',
      whyWrong: [null, 'The infraspinatus and posterior deltoid laterally rotate the shoulder.', 'The infraspinatus laterally rotates and the supinator acts on the forearm.', 'The triceps extends the elbow and the supraspinatus starts abduction.'],
    },

    // ---------------- joints_levers ----------------
    {
      id: 'jl01', topic: 'joints_levers', difficulty: 1,
      stem: 'The elbow (humero-ulnar) joint is an example of which type of synovial joint?',
      options: ['Ball-and-socket', 'Hinge', 'Pivot', 'Saddle'],
      answer: 1,
      explain: 'The elbow is a hinge joint: it allows flexion and extension in one plane.',
      whyWrong: ['Ball-and-socket joints (hip, shoulder) move in all three planes.', null, 'Pivot joints allow rotation, as at the radio-ulnar joint.', 'The saddle joint is found at the base of the thumb.'],
    },
    {
      id: 'jl02', topic: 'joints_levers', difficulty: 1,
      stem: 'Which type of synovial joint allows movement in all three planes?',
      options: ['Hinge', 'Pivot', 'Ball-and-socket', 'Gliding'],
      answer: 2,
      explain: 'Ball-and-socket joints (shoulder, hip) allow flexion/extension, abduction/adduction and rotation.',
      whyWrong: ['A hinge joint moves in one plane only.', 'A pivot joint only rotates.', null, 'Gliding joints only allow small sliding movements.'],
    },
    {
      id: 'jl03', topic: 'joints_levers', difficulty: 2,
      stem: 'The proximal radio-ulnar joint allows pronation and supination. What type of synovial joint is it?',
      options: ['Hinge', 'Pivot', 'Condyloid', 'Saddle'],
      answer: 1,
      explain: 'The head of the radius rotates inside a ring of ligament: a pivot joint.',
      whyWrong: ['A hinge joint allows flexion and extension, not rotation.', null, 'A condyloid joint (e.g. the wrist) does not allow rotation.', 'A saddle joint is found at the base of the thumb.'],
    },
    {
      id: 'jl04', topic: 'joints_levers', difficulty: 2,
      stem: 'Shaking the head "no" happens at the atlanto-axial joint. Identify the joint type.',
      options: ['Pivot', 'Hinge', 'Ball-and-socket', 'Condyloid'],
      answer: 0,
      explain: 'The atlas turns around a peg on the axis: a pivot joint allowing rotation.',
      whyWrong: [null, 'A hinge joint allows flexion and extension only.', 'There is no ball-and-socket joint in the neck.', 'A condyloid joint does not allow rotation.'],
    },
    {
      id: 'jl05', topic: 'joints_levers', difficulty: 2,
      stem: 'Which pair of joints are both ball-and-socket joints?',
      options: ['Hip and shoulder', 'Knee and elbow', 'Hip and knee', 'Shoulder and wrist'],
      answer: 0,
      explain: 'The hip and shoulder are both ball-and-socket joints.',
      whyWrong: [null, 'The knee and elbow are hinge joints.', 'The knee is a hinge joint.', 'The wrist is a condyloid joint.'],
    },
    {
      id: 'jl06', topic: 'joints_levers', difficulty: 1,
      stem: 'In a third-class lever, which component is in the middle?',
      options: ['The fulcrum', 'The load', 'The effort', 'The effort and load at the same point'],
      answer: 2,
      explain: 'Third class: the effort lies between the fulcrum and the load.',
      whyWrong: ['Fulcrum in the middle is a first-class lever.', 'Load in the middle is a second-class lever.', null, 'In every lever class the effort and load act at different points.'],
    },
    {
      id: 'jl07', topic: 'joints_levers', difficulty: 2,
      stem: 'During a biceps curl, which class of lever operates at the elbow?',
      options: ['First class', 'Second class', 'Third class', 'It is not a lever'],
      answer: 2,
      explain: 'Fulcrum at the elbow, effort where the biceps attaches to the forearm, load in the hand: third class.',
      whyWrong: ['First class needs the fulcrum between effort and load.', 'Second class needs the load between fulcrum and effort.', null, 'Bones act as levers whenever muscles move them about a joint.'],
    },
    {
      id: 'jl08', topic: 'joints_levers', difficulty: 2,
      stem: 'Rising onto the toes in a calf raise is commonly used as an example of which lever class?',
      options: ['First class', 'Second class', 'Third class', 'It is not a lever'],
      answer: 1,
      explain: 'Fulcrum at the ball of the foot, load (body weight) through the ankle, effort at the heel: second class.',
      whyWrong: ['First class needs the fulcrum between effort and load.', null, 'Third class needs the effort between fulcrum and load.', 'The foot acts as a lever about the ball of the foot.'],
    },
    {
      id: 'jl09', topic: 'joints_levers', difficulty: 2,
      stem: 'Tilting the head back (neck extension) at the joint between the skull and the top vertebra is an example of which lever class?',
      options: ['First class', 'Second class', 'Third class', 'It is not a lever'],
      answer: 0,
      explain: 'The fulcrum (the joint) sits between the weight of the face and the pull of the neck muscles: first class.',
      whyWrong: [null, 'Second class needs the load between fulcrum and effort.', 'Third class needs the effort between fulcrum and load.', 'The skull acts as a lever about the top of the spine.'],
    },
    {
      id: 'jl10', topic: 'joints_levers', difficulty: 3,
      stem: 'Which statement about third-class levers in the body is correct?',
      options: ['They move heavy loads with little effort', 'They favour speed and range of motion but need a large effort', 'The fulcrum is always between the effort and the load', 'They are rare in the human body'],
      answer: 1,
      explain: 'The effort arm is shorter than the load arm, so a large force is needed but the end of the limb moves fast and far.',
      whyWrong: ['That describes a second-class lever (mechanical advantage above 1).', null, 'That describes a first-class lever.', 'Most limb movements in the body are third-class levers.'],
    },
    {
      id: 'jl11', topic: 'joints_levers', difficulty: 1,
      stem: 'The wrist (radiocarpal) joint allows flexion, extension, abduction and adduction but not rotation. What type of joint is it?',
      options: ['Condyloid', 'Pivot', 'Hinge', 'Ball-and-socket'],
      answer: 0,
      explain: 'The wrist is a condyloid joint: movement in two planes, no rotation.',
      whyWrong: [null, 'A pivot joint only rotates.', 'A hinge joint moves in one plane only.', 'A ball-and-socket joint also allows rotation.'],
    },
    {
      id: 'jl12', topic: 'joints_levers', difficulty: 3,
      stem: 'In an overhead triceps extension, the triceps pulls on the olecranon behind the elbow, and the load is in the hand. Which lever class is this?',
      options: ['First class', 'Second class', 'Third class', 'It depends on the speed of the movement'],
      answer: 0,
      explain: 'Effort (olecranon) and load (hand) are on opposite sides of the elbow fulcrum: first class.',
      whyWrong: [null, 'The load is not between the fulcrum and the effort.', 'The effort is not between the fulcrum and the load.', 'Lever class depends on positions, not speed.'],
    },
  ];

  // ---------------------------------------------------------------
  // ALLIES (Drone Defense). Gameplay numbers live in the level code;
  // only names and flavour text live here.
  // ---------------------------------------------------------------
  const ALLY_TYPES = {
    mechanic: {
      name: 'Mechanic',
      role: 'Speeds up the transport repair.',
      tagline: 'Give me a wrench and five quiet minutes.',
      banter: [
        'Torque settings: optimal. Drone settings: rude.',
        'This engine has more loose bolts than my knee joint.',
        'Keep them off me and this truck will purr.',
        'I fixed a hinge joint once. Now I only do ball-and-socket.',
        'Repair bar climbing. Stop looking at it. Look at the drones!',
        'If you see a spare spark plug, it is mine.',
      ],
    },
    medic: {
      name: 'Medic',
      role: 'Restores the android\'s energy cells.',
      tagline: 'Hold still. This will only sting a little.',
      banter: [
        'Energy cell recharged. Try not to need another.',
        'Your rotator cuff servos are squeaking again.',
        'Patch applied. Please stop catching drones with your face.',
        'Deep breaths. Oh wait, we do not breathe.',
        'Nice eccentric control on that landing. Gentle on the joints.',
        'Medic on standby. Snacks not included.',
      ],
    },
    scout: {
      name: 'Scout',
      role: 'Marks the side the next drones will come from.',
      tagline: 'I see them before they see you.',
      banter: [
        'Movement on the left flank. Rotate and face it!',
        'Three drones, high, coming in from behind.',
        'Next wave is heavy. Load your upgrades wisely.',
        'I climbed the crane. Worth it. View is great.',
        'Contact! Twist the trunk, not just the head!',
        'All quiet. Too quiet. I hate quiet.',
      ],
    },
    engineer: {
      name: 'Engineer',
      role: 'Builds a small auto-turret.',
      tagline: 'If it moves, I can build something to stop it.',
      banter: [
        'Turret online. It has a 360° swivel: pure transverse plane.',
        'I named the turret Pivot. It only rotates.',
        'Need scrap. Lots of scrap. All the scrap.',
        'Turret calibrated. Drones are about to have a bad day.',
        'Built it from a toaster and a drone wing.',
        'Upgrades from the workshop make my turret happy.',
      ],
    },
  };

  const ALLY_NAMES = [
    "UNIT-07 'Sprocket'",
    "UNIT-12 'Bolt'",
    "UNIT-03 'Widget'",
    "UNIT-21 'Gizmo'",
    "UNIT-09 'Rivet'",
    "UNIT-15 'Spark'",
    "UNIT-04 'Cog'",
    "UNIT-18 'Pixel'",
    "UNIT-26 'Ratchet'",
    "UNIT-11 'Ember'",
    "UNIT-30 'Tinker'",
    "UNIT-02 'Socket'",
    "UNIT-14 'Piston'",
    "UNIT-22 'Nova'",
    "UNIT-08 'Fuse'",
    "UNIT-19 'Gasket'",
    "UNIT-33 'Echo'",
    "UNIT-05 'Dynamo'",
    "UNIT-27 'Washer'",
    "UNIT-16 'Comet'",
  ];

  // Workshop upgrade names / descriptions. PLACEHOLDER: the level designer
  // is defining the upgrade ids; text will be filled in here once the ids
  // are agreed (keyed by upgrade id: { name, desc }).
  const UPGRADE_TEXT = {};

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
    DRONE_THREATS,
    MCQ_TOPICS,
    MCQ_BANK,
    ALLY_TYPES,
    ALLY_NAMES,
    UPGRADE_TEXT,
    LEVELS,
    TUTORIALS,
    REVIEW_CHECKS,
    planeOf,
    planeFailText,
  };
})();
