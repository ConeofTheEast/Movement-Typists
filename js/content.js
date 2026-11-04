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
  // Live rotation labels drawn at the key joints during each Factory Escape
  // action (sign convention: flexion / dorsiflexion = +).
  const JOINT_ROTATION = {
    names: { hip: 'Hip', knee: 'Knee', ankle: 'Ankle', shoulder: 'Shoulder', elbow: 'Elbow' },
    plus: { hip: 'flexion', knee: 'flexion', ankle: 'dorsiflexion', shoulder: 'flexion', elbow: 'flexion' },
    minus: { hip: 'extension', knee: 'extension', ankle: 'plantarflexion', shoulder: 'extension', elbow: 'extension' },
    held: 'held: no rotation',
  };

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
    transverse: ['pectoralis_major', 'deltoid_anterior', 'latissimus_dorsi', 'deltoid_posterior', 'subscapularis', 'infraspinatus', 'obliques', 'pronator_teres', 'supinator', 'biceps_brachii', 'gluteus_maximus', 'gluteus_medius', 'tensor_fasciae_latae'],
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

  // Readable names for the Drone Defense `limb` codes.
  const LIMB_LABELS = { armL: 'left arm', armR: 'right arm', trunk: 'trunk', forearmR: 'right forearm', legR: 'right leg' };
  // Extra sentence for known plane-error confusions (GAME_DESIGN §4.4f #1).
  const PLANE_FAIL_NOTES = {
    'legR:Abduction': 'Abduction slides the whole leg out sideways about a different axis. It does not turn the toes.',
    'legR:Adduction': 'Adduction slides the whole leg in sideways about a different axis. It does not turn the toes.',
    'legR:Inversion': 'Inversion tilts the sole of the foot at the ankle. It does not turn the toes at the hip.',
    'armL:Abduction': 'Abduction lifts the arm up and out to the side (frontal plane). Horizontal abduction swings an already-raised arm level (transverse plane).',
    'armR:Abduction': 'Abduction lifts the arm up and out to the side (frontal plane). Horizontal abduction swings an already-raised arm level (transverse plane).',
    'armL:Adduction': 'Adduction lowers the arm down toward the side (frontal plane). Horizontal adduction swings an already-raised arm level, across the chest (transverse plane).',
    'armR:Adduction': 'Adduction lowers the arm down toward the side (frontal plane). Horizontal adduction swings an already-raised arm level, across the chest (transverse plane).',
    'trunk:Lateral flexion': 'Lateral flexion bends the trunk sideways (frontal plane). Rotation turns the trunk to face a new direction (transverse plane).',
  };

  function planeFailText(choice, limb, levelPlane) {
    const lp = levelPlane || 'sagittal';
    const pid = planeOf(choice);
    const pl = PLANES[pid];
    const def = MOVEMENT_DEFS[choice] ? ` (it ${MOVEMENT_DEFS[choice]})` : '';
    if (lp !== 'sagittal') {
      const where = LIMB_LABELS[limb] || limb;
      const lvl = PLANES[lp];
      const note = PLANE_FAIL_NOTES[`${limb}:${choice}`] ? ` ${PLANE_FAIL_NOTES[`${limb}:${choice}`]}` : '';
      const allowed = lp === 'transverse' ? 'can only turn or swing level' : 'can only move side to side';
      const lock = lp === 'transverse' ? "The camp's guard post" : 'The precision wall';
      return {
        headline: 'SYSTEM FAILURE: PLANE VIOLATION',
        explain: `${choice}${def} is a ${pl.name.toUpperCase()} movement, about the ${axisName(pid)}.${note} ${lock} locks the android to the ${lvl.name.toUpperCase()}, where the ${where} ${allowed} about the ${axisName(lp)}. Forcing a ${pl.name.toLowerCase()} movement here overloaded the servos.`,
      };
    }
    return {
      headline: 'SYSTEM FAILURE: PLANE VIOLATION',
      explain: `${choice}${def} is a ${pl.name.toUpperCase()} movement, about the ${axisName(pid)}. The escape corridor locks the android to the SAGITTAL plane, where the ${limb} can only flex or extend about the ${axisName('sagittal')}. Forcing a ${pl.name.toLowerCase()} movement here overloaded the servos.`,
    };
  }

  // ---------------------------------------------------------------
  // TRANSVERSE LEVEL (Drone Defense): threat-freeze question bank
  // Spec: docs/GAME_DESIGN.md §4.4c–§4.4f. Staged positions/poses live in
  // the engine (THREAT_STAGE); only wording lives here.
  //   kind: 'movement'    -> options per tier (§4.4b) from correct +
  //                          `distractors` (ordered, mirror first; the
  //                          designer's physics-honest list: DO NOT add) +
  //                          `planeWrong` (sagittal/frontal pool).
  //   kind: 'contraction' -> `options` (correct + `distractors`).
  // Every distractor / wrong contraction has a `fail` entry with
  //   damage: 'ally' | 'android', part: 'head'|'armR'|'armL'|'torso'|'legR'.
  // planeWrong choices use planeFailText(choice, limb, 'transverse').
  // `as` = the contraction the rig animates (Isotonic, timeouts).
  // Static strings never name an axis (names rotate: use axisName()).
  // ---------------------------------------------------------------
  const ARM_PLANE_WRONG = ['Flexion', 'Extension', 'Abduction', 'Adduction'];
  const TRUNK_PLANE_WRONG = ['Flexion', 'Extension', 'Lateral flexion'];
  const PALM_PLANE_WRONG = ['Flexion', 'Extension', 'Radial deviation', 'Ulnar deviation'];
  const HIP_PLANE_WRONG = ['Abduction', 'Adduction', 'Flexion', 'Inversion'];

  const DRONE_THREATS = {
    netterOnAlly_left: {
      title: 'NETTER ON KITE',
      tier: 1,
      kind: 'movement',
      limb: 'armL',
      joints: ['shoulder'],
      prompt: 'The netter is diving at KITE on your LEFT. Your left arm is raised straight in front. What movement at the left shoulder swings it into the drone?',
      correct: 'Horizontal abduction',
      distractors: ['Horizontal adduction', 'Medial rotation', 'Lateral rotation'],
      planeWrong: ARM_PLANE_WRONG,
      success: {
        headline: 'HORIZONTAL ABDUCTION',
        detail: 'The raised left arm swung out and back, AWAY from the midline, and clipped the netter. KITE is safe.',
        deeper: 'Going deeper: the posterior deltoid is the prime mover, helped by the infraspinatus. Both shorten (concentric).',
        agonists: ['deltoid_posterior', 'infraspinatus'],
        contraction: 'concentric',
      },
      fail: {
        'Horizontal adduction': {
          headline: 'SWEPT THE WRONG SIDE',
          explain: 'Horizontal adduction swings a raised arm TOWARD and across the midline. Your left arm swept right, away from the netter, and KITE was netted. The swat needed HORIZONTAL ABDUCTION: the posterior deltoid shortens (concentric).',
          damage: 'ally',
        },
        'Medial rotation': {
          headline: 'ARM ROLLED, NEVER SWUNG',
          explain: 'Medial rotation rolls the raised arm inward about its own long axis. The arm kept pointing forward, so the net fired and KITE was netted. The swat needed HORIZONTAL ABDUCTION: the posterior deltoid shortens (concentric).',
          damage: 'ally',
        },
        'Lateral rotation': {
          headline: 'ARM ROLLED, NEVER SWUNG',
          explain: 'Lateral rotation rolls the raised arm outward about its own long axis. The arm kept pointing forward, so the net fired and KITE was netted. The swat needed HORIZONTAL ABDUCTION: the posterior deltoid shortens (concentric).',
          damage: 'ally',
        },
      },
      timeout: {
        headline: 'HESITATION',
        explain: 'Your left arm trembled but stayed forward, and the net fired over KITE. Swinging a raised arm away from the midline is HORIZONTAL ABDUCTION (posterior deltoid, concentric).',
        damage: 'ally',
      },
    },

    netterOnAlly_right: {
      title: 'NETTER ON BOLT',
      tier: 1,
      kind: 'movement',
      limb: 'armL',
      joints: ['shoulder'],
      prompt: 'BOLT, on your RIGHT, is under attack. Your right hand is busy and your left arm is out to the side. What movement at the left shoulder swings it into the drone?',
      correct: 'Horizontal adduction',
      distractors: ['Horizontal abduction', 'Rotation', 'Medial rotation', 'Lateral rotation'],
      planeWrong: ARM_PLANE_WRONG,
      success: {
        headline: 'HORIZONTAL ADDUCTION',
        detail: 'The raised left arm swept TOWARD and across the midline and smashed the netter. BOLT is safe.',
        deeper: 'Going deeper: the pectoralis major is the prime mover, helped by the anterior deltoid (both concentric). Same arm as the KITE threat, opposite movement: the midline decides.',
        agonists: ['pectoralis_major', 'deltoid_anterior'],
        contraction: 'concentric',
      },
      fail: {
        'Horizontal abduction': {
          headline: 'SWUNG AWAY FROM IT',
          explain: 'Horizontal abduction swings a raised arm AWAY from the midline. Your left arm swung further back, away from the drone, and BOLT was netted. The sweep needed HORIZONTAL ADDUCTION: the pectoralis major shortens (concentric).',
          damage: 'ally',
        },
        Rotation: {
          headline: 'TWISTED, FELL SHORT',
          explain: 'Rotation turns the trunk (spine). You twisted right as far as your spine allows, but the left hand stopped short and BOLT was netted. The arm needed HORIZONTAL ADDUCTION: the pectoralis major shortens (concentric).',
          damage: 'ally',
        },
        'Medial rotation': {
          headline: 'ARM ROLLED, NEVER SWUNG',
          explain: 'Medial rotation rolls the raised arm inward about its own long axis. It stayed out to the side, so BOLT was netted. The sweep needed HORIZONTAL ADDUCTION: the pectoralis major shortens (concentric).',
          damage: 'ally',
        },
        'Lateral rotation': {
          headline: 'ARM ROLLED, NEVER SWUNG',
          explain: 'Lateral rotation rolls the raised arm outward about its own long axis. It stayed out to the side, so BOLT was netted. The sweep needed HORIZONTAL ADDUCTION: the pectoralis major shortens (concentric).',
          damage: 'ally',
        },
      },
      timeout: {
        headline: 'HESITATION',
        explain: 'Your left arm stayed out to the side and the net fired over BOLT. Sweeping a raised arm across the midline is HORIZONTAL ADDUCTION (pectoralis major, concentric).',
        damage: 'ally',
      },
    },

    crossSwat: {
      title: 'CROSS SWAT',
      tier: 1,
      kind: 'movement',
      limb: 'armR',
      joints: ['shoulder'],
      prompt: 'A diver is coming at you from the front-left. Your right arm is out to the side. What movement at the right shoulder swings it into the drone?',
      correct: 'Horizontal adduction',
      distractors: ['Horizontal abduction', 'Rotation', 'Medial rotation', 'Lateral rotation'],
      planeWrong: ARM_PLANE_WRONG,
      success: {
        headline: 'HORIZONTAL ADDUCTION',
        detail: 'The raised right arm swept TOWARD and across the midline and batted the diver into the dirt.',
        deeper: 'Going deeper: the pectoralis major is the prime mover, helped by the anterior deltoid. Both shorten (concentric).',
        agonists: ['pectoralis_major', 'deltoid_anterior'],
        contraction: 'concentric',
      },
      fail: {
        'Horizontal abduction': {
          headline: 'SWUNG THE WRONG WAY',
          explain: 'Horizontal abduction swings a raised arm AWAY from the midline. Your arm swung further back and the diver slammed into your chest. The swat needed HORIZONTAL ADDUCTION: the pectoralis major shortens (concentric).',
          damage: 'android',
          part: 'torso',
        },
        Rotation: {
          headline: 'TWISTED, FELL SHORT',
          explain: 'Rotation turns the trunk (spine). You twisted left as far as your spine allows, but the hand stopped short and the diver hit your chest. The arm needed HORIZONTAL ADDUCTION: the pectoralis major shortens (concentric).',
          damage: 'android',
          part: 'torso',
        },
        'Medial rotation': {
          headline: 'ARM ROLLED, NEVER SWUNG',
          explain: 'Medial rotation rolls the raised arm inward about its own long axis. It stayed out to the side and the diver hit your chest. The swat needed HORIZONTAL ADDUCTION: the pectoralis major shortens (concentric).',
          damage: 'android',
          part: 'torso',
        },
        'Lateral rotation': {
          headline: 'ARM ROLLED, NEVER SWUNG',
          explain: 'Lateral rotation rolls the raised arm outward about its own long axis. It stayed out to the side and the diver hit your chest. The swat needed HORIZONTAL ADDUCTION: the pectoralis major shortens (concentric).',
          damage: 'android',
          part: 'torso',
        },
      },
      timeout: {
        headline: 'HESITATION',
        explain: 'Your right arm stayed out to the side and the diver hit your chest. Sweeping a raised arm across the midline is HORIZONTAL ADDUCTION (pectoralis major, concentric).',
        damage: 'android',
        part: 'torso',
      },
    },

    backhandSwat: {
      title: 'BACKHAND',
      tier: 1,
      kind: 'movement',
      limb: 'armR',
      joints: ['shoulder'],
      prompt: 'A diver is coming at your RIGHT side. Your right arm is guarding across your chest. What movement at the right shoulder swings it round into the drone?',
      correct: 'Horizontal abduction',
      distractors: ['Horizontal adduction', 'Rotation', 'Medial rotation', 'Lateral rotation'],
      planeWrong: ARM_PLANE_WRONG,
      success: {
        headline: 'HORIZONTAL ABDUCTION',
        detail: 'The raised right arm swung out and back, AWAY from the midline. The backhand smashed the diver.',
        deeper: 'Going deeper: the posterior deltoid is the prime mover, helped by the infraspinatus. Both shorten (concentric). The pectoralis major is the antagonist.',
        agonists: ['deltoid_posterior', 'infraspinatus'],
        contraction: 'concentric',
      },
      fail: {
        'Horizontal adduction': {
          headline: 'PRESSED THE WRONG WAY',
          explain: 'Horizontal adduction swings a raised arm TOWARD and across the midline. Your arm pressed further across your chest and the diver clipped your right shoulder. The backhand needed HORIZONTAL ABDUCTION: the posterior deltoid shortens (concentric).',
          damage: 'android',
          part: 'armR',
        },
        Rotation: {
          headline: 'TWISTED, FELL SHORT',
          explain: 'Rotation turns the trunk (spine). You twisted right as far as your spine allows, but the hand stopped short and the diver hit your arm. The arm needed HORIZONTAL ABDUCTION: the posterior deltoid shortens (concentric).',
          damage: 'android',
          part: 'armR',
        },
        'Medial rotation': {
          headline: 'ARM ROLLED, NEVER SWUNG',
          explain: 'Medial rotation rolls the raised arm inward about its own long axis. It stayed across your chest and the diver hit your arm. The backhand needed HORIZONTAL ABDUCTION: the posterior deltoid shortens (concentric).',
          damage: 'android',
          part: 'armR',
        },
        'Lateral rotation': {
          headline: 'ARM ROLLED, NEVER SWUNG',
          explain: 'Lateral rotation rolls the raised arm outward about its own long axis. It stayed across your chest and the diver hit your arm. The backhand needed HORIZONTAL ABDUCTION: the posterior deltoid shortens (concentric).',
          damage: 'android',
          part: 'armR',
        },
      },
      timeout: {
        headline: 'HESITATION',
        explain: 'Your arm stayed across your chest and the diver hit your right arm. Swinging a raised arm away from the midline is HORIZONTAL ABDUCTION (posterior deltoid, concentric).',
        damage: 'android',
        part: 'armR',
      },
    },

    diveBehind: {
      title: 'REAR DIVE',
      tier: 1,
      kind: 'movement',
      limb: 'trunk',
      joints: ['trunk'],
      prompt: 'A diver is coming from BEHIND you. Your feet are planted and your arms alone cannot reach. What movement of the TRUNK (spine) brings you round to face it?',
      correct: 'Rotation',
      distractors: ['Horizontal abduction', 'Lateral rotation', 'Medial rotation'],
      planeWrong: TRUNK_PLANE_WRONG,
      success: {
        headline: 'ROTATION',
        detail: 'Your spine turned your shoulders round over the planted hips, and your swinging arm met the diver behind you.',
        deeper: 'Going deeper: the arm also horizontally abducted, but alone it hit its limit. Trunk rotation by the obliques (concentric) closed the gap. Turning right uses the LEFT external and RIGHT internal obliques.',
        agonists: ['obliques', 'deltoid_posterior'],
        contraction: 'concentric',
      },
      fail: {
        'Horizontal abduction': {
          headline: 'ARM HIT ITS LIMIT',
          explain: 'Horizontal abduction swings a raised arm out and back. Your right arm stopped at its limit, still short, and the diver struck your back. The turn needed trunk ROTATION: the obliques shorten (concentric).',
          damage: 'android',
          part: 'torso',
        },
        'Lateral rotation': {
          headline: 'ARMS ROLLED, CHEST STILL',
          explain: 'Lateral rotation rolls a limb outward about its own long axis. Your arms rolled in place, your chest kept facing forward, and the diver struck your back. The turn needed trunk ROTATION: the obliques shorten (concentric).',
          damage: 'android',
          part: 'torso',
        },
        'Medial rotation': {
          headline: 'ARMS ROLLED, CHEST STILL',
          explain: 'Medial rotation rolls a limb inward about its own long axis. Your arms rolled in place, your chest kept facing forward, and the diver struck your back. The turn needed trunk ROTATION: the obliques shorten (concentric).',
          damage: 'android',
          part: 'torso',
        },
      },
      timeout: {
        headline: 'HESITATION',
        explain: 'Your chest kept facing forward and the diver struck your back. Turning the shoulders round over planted feet is ROTATION of the trunk (obliques, concentric).',
        damage: 'android',
        part: 'torso',
      },
    },

    spineTwist: {
      title: 'MIDGE SWARM',
      tier: 2,
      kind: 'movement',
      limb: 'trunk',
      joints: ['trunk'],
      prompt: 'Five midges in an arc in front of you! You are wound up to the right with your arm out. What movement of the TRUNK sweeps your arm through the whole arc?',
      correct: 'Rotation',
      distractors: ['Horizontal adduction', 'Horizontal abduction', 'Lateral rotation'],
      planeWrong: TRUNK_PLANE_WRONG,
      success: {
        headline: 'ROTATION',
        detail: 'Your spine unwound from right to left, and your arm swept through all five midges in one chain.',
        deeper: 'Going deeper: turning left uses the RIGHT external oblique and the LEFT internal oblique, both shortening (concentric).',
        agonists: ['obliques'],
        contraction: 'concentric',
      },
      fail: {
        'Horizontal adduction': {
          headline: 'ARM STOPPED HALFWAY',
          explain: 'Horizontal adduction swings a raised arm toward the midline. Alone, your arm hit its limit after 2 midges, and the other 3 netted you. The sweep needed trunk ROTATION: the obliques shorten (concentric).',
          damage: 'android',
          part: 'torso',
        },
        'Horizontal abduction': {
          headline: 'SWEPT AWAY FROM THE ARC',
          explain: 'Horizontal abduction swings a raised arm away from the midline. Your arm swung further right, away from the arc, and the midges netted you. The sweep needed trunk ROTATION: the obliques shorten (concentric).',
          damage: 'android',
          part: 'torso',
        },
        'Lateral rotation': {
          headline: 'ARM ROLLED, NO SWEEP',
          explain: 'Lateral rotation rolls the raised arm outward about its own long axis. It rolled in place, hit nothing, and the midges netted you. The sweep needed trunk ROTATION: the obliques shorten (concentric).',
          damage: 'android',
          part: 'torso',
        },
      },
      timeout: {
        headline: 'HESITATION',
        explain: 'You stayed wound up and the midges netted you. Turning the shoulders across the arc is ROTATION of the trunk (obliques, concentric).',
        damage: 'android',
        part: 'torso',
      },
    },

    discWindup: {
      title: 'SPOTTER: LOAD',
      tier: 2,
      kind: 'movement',
      limb: 'armR',
      joints: ['shoulder'],
      prompt: 'Load the disc launcher! Keep your right elbow tucked at your side and swing the forearm away from your belly to cock it. What movement at the right shoulder?',
      correct: 'Lateral rotation',
      distractors: ['Medial rotation', 'Pronation', 'Supination'],
      planeWrong: ARM_PLANE_WRONG,
      success: {
        headline: 'LATERAL ROTATION',
        detail: 'The upper arm turned about its own long axis, so the forearm swung away from your belly like a door opening. Launcher cocked.',
        deeper: 'Going deeper: the infraspinatus (rotator cuff) is the prime mover, shortening (concentric). The auto-throw that follows is medial rotation.',
        agonists: ['infraspinatus'],
        contraction: 'concentric',
      },
      fail: {
        'Medial rotation': {
          headline: 'LAUNCHER JAMMED',
          explain: 'Medial rotation turns the upper arm INWARD. Your forearm swung across your belly, the launcher jammed against your body, and the spotter hit your head. Cocking needs LATERAL ROTATION: the infraspinatus shortens (concentric).',
          damage: 'android',
          part: 'head',
        },
        Pronation: {
          headline: 'DISC SLID OFF',
          explain: 'Pronation twists the forearm so the palm turns down. The launcher rolled sideways, the disc slid into the mud, and the spotter hit your head. Cocking needs LATERAL ROTATION at the shoulder: infraspinatus, concentric.',
          damage: 'android',
          part: 'head',
        },
        Supination: {
          headline: 'DISC SLID OFF',
          explain: 'Supination twists the forearm so the palm turns up. The launcher rolled sideways, the disc slid into the mud, and the spotter hit your head. Cocking needs LATERAL ROTATION at the shoulder: infraspinatus, concentric.',
          damage: 'android',
          part: 'head',
        },
      },
      timeout: {
        headline: 'HESITATION',
        explain: 'The launcher stayed uncocked and the spotter hit your head. Swinging the forearm away from the belly with the elbow tucked is LATERAL ROTATION (infraspinatus, concentric).',
        damage: 'android',
        part: 'head',
      },
    },

    discThrow: {
      title: 'SPOTTER: FIRE',
      tier: 2,
      kind: 'movement',
      limb: 'armR',
      joints: ['shoulder'],
      prompt: 'Launcher cocked, right elbow still tucked at your side. Snap the forearm back across your belly to fling the disc at the spotter. What movement at the right shoulder?',
      correct: 'Medial rotation',
      distractors: ['Lateral rotation', 'Pronation', 'Supination'],
      planeWrong: ARM_PLANE_WRONG,
      success: {
        headline: 'MEDIAL ROTATION',
        detail: 'The upper arm turned about its own long axis and whipped the forearm across your belly. The disc sliced into the spotter.',
        deeper: 'Going deeper: the subscapularis, pectoralis major and latissimus dorsi all shorten (concentric). A real throw also uses trunk rotation and pronation.',
        agonists: ['subscapularis', 'pectoralis_major', 'latissimus_dorsi'],
        contraction: 'concentric',
      },
      fail: {
        'Lateral rotation': {
          headline: 'FIRED BACKWARDS',
          explain: 'Lateral rotation turns the upper arm OUTWARD. Your forearm swung further out, the disc clanged off the transport behind you, and the spotter hit your head. Firing needs MEDIAL ROTATION: the subscapularis shortens (concentric).',
          damage: 'android',
          part: 'head',
        },
        Pronation: {
          headline: 'DISC SPUN OFF',
          explain: 'Pronation twists the forearm so the palm turns down. The disc spun off sideways into the dirt and the spotter hit your head. Firing needs MEDIAL ROTATION at the shoulder: the subscapularis shortens (concentric).',
          damage: 'android',
          part: 'head',
        },
        Supination: {
          headline: 'DISC SPUN OFF',
          explain: 'Supination twists the forearm so the palm turns up. The disc spun off sideways into the dirt and the spotter hit your head. Firing needs MEDIAL ROTATION at the shoulder: the subscapularis shortens (concentric).',
          damage: 'android',
          part: 'head',
        },
      },
      timeout: {
        headline: 'HESITATION',
        explain: 'The launcher stayed cocked and the spotter hit your head. Snapping the forearm across the belly with the elbow tucked is MEDIAL ROTATION (subscapularis, concentric).',
        damage: 'android',
        part: 'head',
      },
    },

    palmShield: {
      title: 'LANCER: REAR',
      tier: 2,
      kind: 'movement',
      limb: 'forearmR',
      joints: ['forearm'],
      prompt: 'A lancer fires from BEHIND you. Your right arm hangs down, palm shield facing your thigh. What forearm movement turns the shield toward the beam?',
      correct: 'Pronation',
      distractors: ['Supination', 'Lateral rotation', 'Rotation'],
      planeWrong: PALM_PLANE_WRONG,
      success: {
        headline: 'PRONATION',
        detail: 'The radius crossed over the ulna and the palm shield turned to face backward. The beam reflected and the lancer exploded.',
        deeper: 'Going deeper: the pronator teres is the prime mover (concentric), helped by the small pronator quadratus near the wrist.',
        agonists: ['pronator_teres'],
        contraction: 'concentric',
      },
      fail: {
        Supination: {
          headline: 'SHIELD FACED FORWARD',
          explain: 'Supination turns the palm to face FORWARD. The shield faced away from the beam and it scorched the back of your forearm. Facing backward needs PRONATION: the pronator teres shortens (concentric).',
          damage: 'android',
          part: 'armR',
        },
        'Lateral rotation': {
          headline: 'WHOLE ARM ROLLED OUT',
          explain: 'Lateral rotation rolls the whole arm outward at the SHOULDER. The palm turned forward and out, away from the beam, and it hit your arm. The forearm needed PRONATION: the pronator teres shortens (concentric).',
          damage: 'android',
          part: 'armR',
        },
        Rotation: {
          headline: 'TWISTED, SHIELD OFF LINE',
          explain: 'Rotation turns the trunk (spine). Even fully twisted, the shield was still well off the beam line, and the beam hit your arm. The forearm needed PRONATION: the pronator teres shortens (concentric).',
          damage: 'android',
          part: 'armR',
        },
      },
      timeout: {
        headline: 'HESITATION',
        explain: 'The palm shield kept facing your thigh and the beam hit your arm. Turning the palm to face backward is PRONATION (pronator teres, concentric).',
        damage: 'android',
        part: 'armR',
      },
    },

    palmCatch: {
      title: 'LANCER: FRONT',
      tier: 2,
      kind: 'movement',
      limb: 'forearmR',
      joints: ['forearm'],
      prompt: 'A lancer fires from IN FRONT of you. Your right arm hangs down, palm shield facing your thigh. What forearm movement turns the shield toward the beam?',
      correct: 'Supination',
      distractors: ['Pronation', 'Medial rotation'],
      planeWrong: PALM_PLANE_WRONG,
      success: {
        headline: 'SUPINATION',
        detail: 'The radius rolled back beside the ulna and the palm shield turned to face forward. The beam reflected and the lancer exploded.',
        deeper: 'Going deeper: the supinator does most of the work here (concentric). The biceps brachii helps, but it is a weak supinator when the elbow is straight.',
        agonists: ['supinator', 'biceps_brachii'],
        contraction: 'concentric',
      },
      fail: {
        Pronation: {
          headline: 'SHIELD FACED BACKWARD',
          explain: 'Pronation turns the palm to face BACKWARD. The shield faced away from the beam and it scorched your forearm. Facing forward needs SUPINATION: the supinator and biceps brachii shorten (concentric).',
          damage: 'android',
          part: 'armR',
        },
        'Medial rotation': {
          headline: 'WHOLE ARM ROLLED IN',
          explain: 'Medial rotation rolls the whole arm inward at the SHOULDER. The palm turned backward, away from the beam, and it hit your arm. The forearm needed SUPINATION: the supinator and biceps brachii shorten (concentric).',
          damage: 'android',
          part: 'armR',
        },
      },
      timeout: {
        headline: 'HESITATION',
        explain: 'The palm shield kept facing your thigh and the beam hit your arm. Turning the palm to face forward is SUPINATION (supinator and biceps brachii, concentric).',
        damage: 'android',
        part: 'armR',
      },
    },

    hipPivot: {
      title: 'SNARE AT THE FOOT',
      tier: 3,
      kind: 'movement',
      limb: 'legR',
      joints: ['hip'],
      prompt: 'A Snare is at the OUTSIDE of your right foot. Pivot on your right heel to swing the toes onto it. What movement at the right HIP?',
      correct: 'Lateral rotation',
      distractors: ['Medial rotation', 'Rotation'],
      planeWrong: HIP_PLANE_WRONG,
      success: {
        headline: 'LATERAL ROTATION',
        detail: 'Your right thigh turned about its own long axis, the toes swung outward onto the Snare, and the stamp crushed it.',
        deeper: 'Going deeper: the gluteus maximus is a strong lateral rotator of the hip as well as its main extensor. It shortens (concentric).',
        agonists: ['gluteus_maximus'],
        contraction: 'concentric',
      },
      fail: {
        'Medial rotation': {
          headline: 'TOES TURNED IN',
          explain: 'Medial rotation turns the thigh INWARD (gluteus medius front fibres, tensor fasciae latae). Your toes swung in, away from the Snare, and it clamped your ankle. The stamp needed LATERAL ROTATION: the gluteus maximus shortens (concentric).',
          damage: 'android',
          part: 'legR',
        },
        Rotation: {
          headline: 'TWISTED, FEET STUCK',
          explain: 'Rotation turns the trunk (spine), not the hip. Your chest turned but your feet stayed put, and the Snare clamped your ankle. The stamp needed LATERAL ROTATION of the hip: the gluteus maximus shortens (concentric).',
          damage: 'android',
          part: 'legR',
        },
      },
      timeout: {
        headline: 'HESITATION',
        explain: 'Your toes kept pointing forward and the Snare clamped your ankle. Turning the toes outward by pivoting at the hip is LATERAL ROTATION (gluteus maximus, concentric).',
        damage: 'android',
        part: 'legR',
      },
    },

    tetherPull: {
      title: 'LEECH TETHER',
      tier: 2,
      kind: 'contraction',
      limb: 'armR',
      joints: ['shoulder'],
      focusMuscle: 'subscapularis',
      prompt: 'A tether yanks your right forearm outward while BOLT cuts the cable. If the arm moves, the cutter misses. What contraction does the subscapularis (a medial rotator) perform?',
      correct: 'Isometric',
      distractors: ['Concentric', 'Eccentric'],
      planeWrong: [],
      options: ['Isometric', 'Concentric', 'Eccentric'],
      success: {
        headline: 'ISOMETRIC',
        detail: 'The subscapularis pulled exactly as hard as the tether, so the forearm angle stayed the same. BOLT cut the cable.',
        deeper: 'Going deeper: the tether tries to laterally rotate your shoulder. The subscapularis and pectoralis major resist with force but no change in length.',
        agonists: ['subscapularis', 'pectoralis_major'],
        contraction: 'isometric',
      },
      fail: {
        Concentric: {
          headline: 'REELED THE LEECH IN',
          explain: 'A concentric contraction SHORTENS the muscle. Your forearm yanked inward, reeled the Leech in, and it burst its net against your chest. Holding still needs an ISOMETRIC contraction: force with no change in length.',
          damage: 'android',
          part: 'torso',
        },
        Eccentric: {
          headline: 'DRAGGED BY THE CABLE',
          explain: 'An eccentric contraction LENGTHENS the muscle under tension. The subscapularis kept working but gave way, your forearm swung out, and the cable wrapped your arm. Holding still needs an ISOMETRIC contraction.',
          damage: 'android',
          part: 'armR',
        },
      },
      timeout: {
        headline: 'HESITATION',
        explain: 'No command reached the subscapularis, so the tether whipped your forearm outward and wrapped your arm. Holding still against a pull needs an ISOMETRIC contraction.',
        damage: 'android',
        part: 'armR',
        as: 'Eccentric',
      },
    },

    heavyCatch: {
      title: 'RAM CATCH',
      tier: 3,
      kind: 'contraction',
      limb: 'armR',
      joints: ['shoulder'],
      focusMuscle: 'pectoralis_major',
      prompt: 'The Ram shoves your raised right arm out and back. Let the arm give way slowly. Which SPECIFIC contraction does the pectoralis major perform?',
      correct: 'Eccentric',
      distractors: ['Concentric', 'Isometric'],
      planeWrong: [],
      options: ['Eccentric', 'Concentric', 'Isometric'],
      success: {
        headline: 'ECCENTRIC',
        detail: 'The Ram forced your arm into horizontal abduction while the pectoralis major lengthened under tension. The Ram slowed to a stop.',
        deeper: 'Going deeper: the pectoralis major is a horizontal ADDUCTOR, so it lengthens as the arm is forced the other way. A concentric shove then flipped the Ram.',
        agonists: ['pectoralis_major', 'deltoid_anterior'],
        contraction: 'eccentric',
      },
      fail: {
        Concentric: {
          headline: 'PUNCHED THE RAM',
          explain: 'A concentric contraction SHORTENS the muscle. Your arm punched forward into the Ram, which barely slowed, and the arm rebounded with sparks. Slowing a load needs an ECCENTRIC contraction: lengthening under tension.',
          damage: 'android',
          part: 'armR',
        },
        Isometric: {
          headline: 'LOCKED AND SHOVED',
          explain: 'An isometric contraction keeps the muscle the SAME length. Your arm stayed locked, so the Ram shoved the whole android back and spun it. Slowing a load needs an ECCENTRIC contraction: lengthening under tension.',
          damage: 'android',
          part: 'torso',
        },
      },
      timeout: {
        headline: 'HESITATION',
        explain: 'Your arm went limp and the Ram ploughed straight through. Slowing a load while the arm gives way needs an ECCENTRIC contraction of the pectoralis major.',
        damage: 'android',
        part: 'torso',
      },
    },

    discSnap: {
      title: 'ELITE SPOTTER',
      tier: 3,
      kind: 'contraction',
      limb: 'armR',
      joints: ['shoulder'],
      focusMuscle: 'subscapularis',
      prompt: 'To snap the disc out FAST, against the pull of the launcher spring, what type of contraction must the SUBSCAPULARIS perform?',
      correct: 'Concentric',
      distractors: ['Eccentric', 'Isometric'],
      planeWrong: [],
      options: ['Concentric', 'Eccentric', 'Isometric'],
      success: {
        headline: 'CONCENTRIC',
        detail: 'The subscapularis shortened with more force than the spring and whipped the forearm across your belly. The disc hit the spotter.',
        deeper: 'Going deeper: the movement is medial rotation. The pectoralis major and latissimus dorsi also shorten (concentric).',
        agonists: ['subscapularis', 'pectoralis_major', 'latissimus_dorsi'],
        contraction: 'concentric',
      },
      fail: {
        Eccentric: {
          headline: 'SPRING WON',
          explain: 'An eccentric contraction LENGTHENS the muscle under tension. The subscapularis kept working, but the spring pulled the forearm outward. The disc dropped behind you and the spotter hit your head. A fast throw needs a CONCENTRIC contraction.',
          damage: 'android',
          part: 'head',
        },
        Isometric: {
          headline: 'DISC NEVER LEFT',
          explain: 'An isometric contraction keeps the muscle the SAME length. Your forearm stayed frozen, the disc never left, and the spotter hit your head. A fast throw needs a CONCENTRIC contraction: the muscle shortens.',
          damage: 'android',
          part: 'head',
        },
      },
      timeout: {
        headline: 'HESITATION',
        explain: 'No command reached the subscapularis, so the spring yanked the forearm out and the disc fell behind you. Throwing against the spring needs a CONCENTRIC contraction.',
        damage: 'android',
        part: 'head',
        as: 'Eccentric',
      },
    },
  };

  // Level select metadata (menu). Status: 'playable' | 'design' | 'locked' | 'paused'
  const LEVELS = [
    {
      id: 'frontal',
      plane: 'frontal',
      title: 'Precision Lab',
      tag: 'FRONTAL PLANE · SAGITTAL AXIS',
      blurb: 'Inside the factory. Scientists test and study the android on a precision wall: abduct or adduct one limb to reach, then turn the palm to press. Every error earns a shock. Run out of energy and the android shuts down.',
      status: 'locked',
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
        'You look straight down from above. For the trunk and a hanging limb, the axis points out of the screen (⊙), running from head to toe.',
        'TARGETING: click a drone or press A/D (or the arrow keys), then SPACE to strike. Armoured drones need YOU to target them.',
        'The android handles small drones by itself. Every auto-strike is labelled with its transverse movement, so watch and learn.',
        'Big threats freeze time. Choose the right MOVEMENT or CONTRACTION before the timer runs out. Click, or press 1–4.',
        'ROTATION: turn the trunk (spine) to face a drone behind you.',
        'MEDIAL and LATERAL ROTATION: turn the upper arm or thigh inward or outward around its own long axis.',
        'HORIZONTAL ADDUCTION and ABDUCTION: swing a raised arm toward or away from the MIDLINE. The midline decides, not the side of the screen.',
        'PRONATION and SUPINATION: turn the forearm so the palm faces backward (down) or forward (up).',
        'Some threats ask for a CONTRACTION: holding still against a pull, giving way under control, or snapping fast.',
        'Wrong, but still a transverse move: the android does exactly what you chose and misses. An ally gets netted, or you take a hit.',
        'A move from another plane (flexion, abduction and so on): the android glitches and the screen cracks.',
        'Too slow: the android hesitates and the threat lands. Either way, a replay shows the right action and the threat comes back later.',
        'ENERGY: 5 cells. A freeze hit costs 1 cell; a small bump costs half. At 0 the android shuts down and the wave restarts.',
        'ALLIES: the Mechanic speeds up repairs, the Medic restores energy, the Scout shows where drones come from, and the Engineer builds a turret.',
        'A netted ally gets dragged away. Click it (or press R) and answer a quick plane question to cut it free and win 1 energy cell.',
        'WORKSHOP: between waves, answer exam-style questions to earn SCRAP. Streaks and harder questions pay more.',
        'Spend scrap on upgrades, then fit them inside your POWER budget for the next wave.',
        'Questions you miss go into the FAULT LOG and come back later. Getting topics right raises CALIBRATION, which powers up the android.',
        'Every 5 waves the WARDEN arrives: a huge boss drone that fires threats back to back.',
        'PRACTICE MODE: freezes have no timer, so you can think each one through. Switch it off when you are ready to be tested.',
        'MOVEMENT CODEX: every action you meet gets a page with its joint, prime movers and a sport example.',
        'MASTERY: answer an action right on the first try 3 times in a row to earn its badge. Badges unlock visor colours and strike trails.',
        'WAVE CONTRACTS: before a wave, pick an optional goal, such as "No ally netted". Complete it for bonus scrap.',
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
    { q: 'With the arm hanging by your side, which forearm movement turns the palm to face backward?', a: 'Pronation (pronator teres)' },
    { q: 'A cable pulls your forearm outward but you hold it exactly still: which contraction do the subscapularis and pectoralis major perform?', a: 'Isometric: force with no change in muscle length' },
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
      id: 'pa08', topic: 'planes_axes', difficulty: 2, action: 'Rotation',
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
      whyWrong: ['Sagittal-plane movements are forward and backward, such as flexion.', null, 'Transverse-plane movements turn or swing level about a vertical line (e.g. rotation, horizontal abduction), not sideways lifts.', 'Frontal-plane movements happen about the sagittal axis, not the longitudinal axis.'],
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
      id: 'pa12', topic: 'planes_axes', difficulty: 3, action: 'Rotation',
      stem: 'A student writes: "Trunk rotation in a golf swing happens about the transverse axis." Which statement best corrects this?',
      options: ['Correct: the transverse plane uses the transverse axis', 'Wrong: it is about the longitudinal axis', 'Wrong: it is in the sagittal plane', 'Wrong: it is about the sagittal axis'],
      answer: 1,
      explain: 'Trunk rotation is transverse plane, longitudinal axis. "Transverse axis" is another name for the frontal axis, used for sagittal-plane movements.',
      whyWrong: ['The transverse axis is not the axis of the transverse plane.', null, 'Rotation is not a sagittal-plane movement.', 'The sagittal axis pairs with the frontal plane.'],
    },

    // ---------------- joint_actions ----------------
    {
      id: 'ja01', topic: 'joint_actions', difficulty: 1, action: 'Medial rotation',
      stem: 'Which of the following movements occurs in the transverse plane?',
      options: ['Abduction', 'Lateral flexion', 'Medial rotation', 'Dorsiflexion'],
      answer: 2,
      explain: 'Medial rotation turns a limb inward around its long axis, in the transverse plane.',
      whyWrong: ['Abduction is a frontal-plane movement.', 'Lateral flexion is a frontal-plane movement.', null, 'Dorsiflexion is a sagittal-plane movement.'],
    },
    {
      id: 'ja02', topic: 'joint_actions', difficulty: 1, action: 'Supination',
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
      id: 'ja04', topic: 'joint_actions', difficulty: 2, action: 'Horizontal adduction',
      stem: 'In a chest fly, the arms start straight out to the sides at shoulder height and swing forward to meet in front of the chest. Identify the shoulder movement.',
      options: ['Adduction', 'Horizontal adduction', 'Flexion', 'Horizontal abduction'],
      answer: 1,
      explain: 'A raised arm moving toward the midline at shoulder height is horizontal adduction (transverse plane).',
      whyWrong: ['Adduction lowers the arm down to the side in the frontal plane.', null, 'Flexion raises the arm forward and up in the sagittal plane.', 'Horizontal abduction is the reverse: arms swing out and back.'],
    },
    {
      id: 'ja05', topic: 'joint_actions', difficulty: 2, action: 'Horizontal abduction',
      stem: 'In a reverse fly, the arms start straight out in front at shoulder height and swing out and back. Identify the shoulder movement.',
      options: ['Horizontal abduction', 'Abduction', 'Extension', 'Lateral rotation'],
      answer: 0,
      explain: 'A raised arm moving away from the midline at shoulder height is horizontal abduction (transverse plane).',
      whyWrong: [null, 'Abduction raises the arm sideways from the side of the body in the frontal plane.', 'Extension swings the arm down and back in the sagittal plane.', 'Lateral rotation turns the arm about its own long axis; it does not swing it.'],
    },
    {
      id: 'ja06', topic: 'joint_actions', difficulty: 2, action: 'Rotation',
      stem: 'In the backswing of a golf drive, the shoulders turn away from the target while the feet stay planted. Which movement occurs at the spine?',
      options: ['Lateral flexion', 'Rotation', 'Hyperextension', 'Lateral rotation'],
      answer: 1,
      explain: 'Turning the trunk is rotation of the spine, in the transverse plane about the longitudinal axis.',
      whyWrong: ['Lateral flexion bends the trunk sideways (frontal plane).', null, 'Hyperextension arches the spine backward (sagittal plane).', 'Lateral rotation describes a limb at the shoulder or hip, not the spine.'],
    },
    {
      id: 'ja07', topic: 'joint_actions', difficulty: 2, action: 'Pronation',
      stem: 'To dribble, a basketball player turns the forearm from a handshake position until the palm faces the floor. Which radio-ulnar movement is this?',
      options: ['Supination', 'Pronation', 'Medial rotation', 'Ulnar deviation'],
      answer: 1,
      explain: 'Pronation turns the forearm so the palm faces down.',
      whyWrong: ['Supination turns the palm to face up.', null, 'Medial rotation happens at the shoulder, not the radio-ulnar joint.', 'Ulnar deviation tilts the hand toward the little finger at the wrist.'],
    },
    {
      id: 'ja08', topic: 'joint_actions', difficulty: 2, action: 'Lateral rotation',
      stem: 'A tennis player prepares to serve: the upper arm is raised and the racket drops back behind the head. Identify the movement at the shoulder.',
      options: ['Medial rotation', 'Lateral rotation', 'Horizontal adduction', 'Extension'],
      answer: 1,
      explain: 'Cocking the arm back is lateral (external) rotation of the shoulder.',
      whyWrong: ['Medial rotation brings the racket forward during the hit.', null, 'Horizontal adduction swings the arm across the chest.', 'Extension swings the arm down and back in the sagittal plane.'],
    },
    {
      id: 'ja09', topic: 'joint_actions', difficulty: 2, action: 'Medial rotation',
      stem: 'During the acceleration phase of an overarm throw, the upper arm turns forcefully inward. Which movement occurs at the shoulder?',
      options: ['Medial rotation', 'Pronation', 'Lateral rotation', 'Adduction'],
      answer: 0,
      explain: 'Turning the upper arm inward around its long axis is medial (internal) rotation.',
      whyWrong: [null, 'Pronation happens at the forearm, not the shoulder.', 'Lateral rotation turns the arm outward (the cocking phase).', 'Adduction lowers the arm toward the side in the frontal plane.'],
    },
    {
      id: 'ja10', topic: 'joint_actions', difficulty: 3, action: 'Lateral rotation',
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
      whyWrong: ['Flexion decreases the joint angle.', null, 'Adduction moves a limb toward the midline (frontal plane). Increasing the joint angle defines extension.', 'Dorsiflexion decreases the angle between the top of the foot and the shin.'],
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
      id: 'ja14', topic: 'joint_actions', difficulty: 3, action: 'Horizontal adduction',
      stem: 'In the final sweep of a discus throw, the straight throwing arm swings forward around the body at shoulder height. Which description is correct?',
      options: ['Horizontal adduction, transverse plane, longitudinal axis', 'Adduction, frontal plane, sagittal axis', 'Flexion, sagittal plane, frontal axis', 'Horizontal abduction, transverse plane, longitudinal axis'],
      answer: 0,
      explain: 'A straight arm at shoulder height swinging toward the midline is horizontal adduction: transverse plane, longitudinal axis.',
      whyWrong: [null, 'Adduction lowers the arm to the side; the discus arm stays at shoulder height.', 'Flexion raises the arm forward and up from the side.', 'Horizontal abduction swings the arm backward, as in the wind-up.'],
    },
    {
      id: 'ja15', topic: 'joint_actions', difficulty: 2, action: 'Horizontal abduction',
      stem: 'In a backhand frisbee throw, the straight throwing arm starts across the chest at shoulder height and swings out to the side. Identify the shoulder movement.',
      options: ['Horizontal adduction', 'Abduction', 'Horizontal abduction', 'Extension'],
      answer: 2,
      explain: 'A raised arm swinging away from the midline at shoulder height is horizontal abduction (transverse plane). The posterior deltoid is the prime mover.',
      whyWrong: ['Horizontal adduction is the reverse: the raised arm swings in across the chest.', 'Abduction lifts the arm up from the side of the body (frontal plane). Here the arm is already at shoulder height.', null, 'Extension swings the arm down and back in the sagittal plane.'],
    },

    // ---------------- contractions ----------------
    {
      id: 'ct01', topic: 'contractions', difficulty: 1, action: 'Eccentric',
      stem: 'Which type of contraction happens when a muscle lengthens while producing force?',
      options: ['Concentric', 'Isometric', 'Eccentric', 'Relaxation (no force)'],
      answer: 2,
      explain: 'Eccentric contractions lengthen under tension, braking or controlling a movement.',
      whyWrong: ['Concentric contractions shorten the muscle.', 'Isometric contractions keep the muscle the same length.', null, 'A relaxed muscle produces no force. Lengthening WHILE producing force is eccentric. Eccentric never means relaxed.'],
    },
    {
      id: 'ct02', topic: 'contractions', difficulty: 1, action: 'Isometric',
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
      id: 'ct04', topic: 'contractions', difficulty: 2, action: 'Concentric',
      stem: 'During the upward phase of a biceps curl, what type of contraction does the biceps brachii perform?',
      options: ['Eccentric', 'Concentric', 'Isometric', 'Relaxation (no force)'],
      answer: 1,
      explain: 'The biceps shortens under tension to flex the elbow and lift the weight: concentric.',
      whyWrong: ['Eccentric happens on the way DOWN, when the biceps lengthens.', null, 'Isometric would hold the weight still.', 'A relaxed muscle makes no force, so it could not lift the weight.'],
    },
    {
      id: 'ct05', topic: 'contractions', difficulty: 2, action: 'Eccentric',
      stem: 'During the downward phase of a squat, the knees and hips flex. What is the quadriceps doing?',
      options: ['Contracting concentrically', 'Contracting eccentrically', 'Relaxing, because gravity does the work', 'Contracting isometrically'],
      answer: 1,
      explain: 'The quadriceps lengthen under tension to control knee flexion against gravity: eccentric.',
      whyWrong: ['Concentric happens on the way UP, when the quadriceps shorten.', null, 'If the quadriceps relaxed, the body would drop uncontrolled.', 'Isometric would hold the squat still; here the knees are bending.'],
    },
    {
      id: 'ct06', topic: 'contractions', difficulty: 2, action: 'Isometric',
      stem: 'A student holds a plank position for 60 seconds. What type of contraction do the abdominal muscles perform?',
      options: ['Concentric', 'Eccentric', 'Isometric', 'Isotonic'],
      answer: 2,
      explain: 'The muscles produce force with no change in length and no joint movement: isometric.',
      whyWrong: ['Concentric would shorten the muscle and move the trunk.', 'Eccentric would lengthen the muscle and move the trunk.', null, 'Isotonic means the muscle changes length; in a plank it does not.'],
    },
    {
      id: 'ct07', topic: 'contractions', difficulty: 3, action: 'Eccentric',
      stem: 'During the lowering phase of a push-up, which statement about the triceps brachii is correct?',
      options: ['It shortens under tension (concentric) to extend the elbow', 'It lengthens under tension (eccentric) to control elbow flexion', 'It lengthens with no tension because gravity lowers the body', 'It stays the same length (isometric) because the hands do not move'],
      answer: 1,
      explain: 'As the elbows bend, the triceps lengthens while working to brake the descent: eccentric.',
      whyWrong: ['Concentric triceps action happens on the way up.', null, 'Without tension the body would fall to the floor.', 'The hands are still, but the elbow angle changes, so the muscle length changes.'],
    },
    {
      id: 'ct08', topic: 'contractions', difficulty: 3, action: 'Eccentric',
      stem: 'In late swing in sprinting (just before the foot lands), the hamstrings slow the lower leg as the knee extends. Which describes the hamstring contraction?',
      options: ['Concentric: they shorten to flex the knee', 'Eccentric: they lengthen to brake the knee', 'Isometric: they hold the knee angle fixed', 'Relaxed: momentum alone extends the knee'],
      answer: 1,
      explain: 'The knee extends, so the hamstrings lengthen while producing force to brake it: eccentric.',
      whyWrong: ['The knee is extending, so the hamstrings are lengthening, not shortening.', null, 'The knee angle is changing, not fixed.', 'If they relaxed, nothing would brake the leg. Braking while lengthening is eccentric.'],
    },
    {
      id: 'ct09', topic: 'contractions', difficulty: 2, action: 'Eccentric',
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
      id: 'ct12', topic: 'contractions', difficulty: 2, action: 'Isometric',
      stem: 'In a rugby scrum, both packs push as hard as they can but neither moves. What type of contraction do the leg extensors perform?',
      options: ['Concentric', 'Eccentric', 'Isometric', 'Isotonic'],
      answer: 2,
      explain: 'Force is produced with no change in muscle length or joint angle: isometric.',
      whyWrong: ['Concentric would shorten the muscles and drive the scrum forward.', 'Eccentric would mean the legs are being pushed back under control.', null, 'Isotonic means the muscle changes length, but nothing is moving.'],
    },
    {
      id: 'ct13', topic: 'contractions', difficulty: 2, action: 'Concentric',
      stem: 'In the acceleration phase of an overarm throw, the subscapularis turns the upper arm forcefully inward. What type of contraction does the subscapularis perform?',
      options: ['Eccentric', 'Isometric', 'Concentric', 'Relaxation (no force)'],
      answer: 2,
      explain: 'The subscapularis shortens under tension to medially rotate the shoulder and speed up the arm: concentric.',
      whyWrong: ['Eccentric would mean the subscapularis lengthens while braking the arm. Here it drives the arm inward.', 'Isometric would hold the arm still. Here the shoulder turns quickly.', null, 'A relaxed muscle makes no force, so it could not power the throw.'],
    },
    {
      id: 'ct14', topic: 'contractions', difficulty: 3, action: 'Concentric',
      stem: 'In a rotational medicine-ball throw, the feet stay planted and the trunk turns hard toward the target. Which contraction do the obliques that drive the turn perform?',
      options: ['Isometric', 'Concentric', 'Eccentric', 'Relaxation (no force)'],
      answer: 1,
      explain: 'The obliques driving the turn shorten under tension to rotate the trunk toward the target: concentric.',
      whyWrong: ['Isometric would hold the trunk still. Here the trunk turns.', null, 'Eccentric would mean the obliques lengthen while braking the turn. Here they drive it.', 'A relaxed muscle makes no force, so it could not power the throw.'],
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
      options: ['Fixator (stabiliser)', 'Antagonist', 'Agonist', 'Tendon'],
      answer: 0,
      explain: 'A fixator holds a bone steady so the agonist has a stable base to pull from.',
      whyWrong: [null, 'The antagonist opposes the movement.', 'The agonist produces the movement.', 'A tendon is connective tissue joining muscle to bone; it is not a muscle role.'],
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
      id: 'aa07', topic: 'agonist_antagonist', difficulty: 2, action: 'Medial rotation',
      stem: 'During the release of an overarm throw, the shoulder medially rotates. Which muscle is the antagonist?',
      options: ['Subscapularis', 'Infraspinatus', 'Pectoralis major', 'Latissimus dorsi'],
      answer: 1,
      explain: 'The infraspinatus laterally rotates the shoulder, so it opposes medial rotation.',
      whyWrong: ['The subscapularis is a medial rotator (agonist).', null, 'The pectoralis major helps medially rotate the shoulder.', 'The latissimus dorsi helps medially rotate the shoulder.'],
    },
    {
      id: 'aa08', topic: 'agonist_antagonist', difficulty: 2, action: 'Horizontal adduction',
      stem: 'In a chest fly (horizontal adduction of the shoulder), which pair is correctly listed as agonist / antagonist?',
      options: ['Pectoralis major / posterior deltoid', 'Posterior deltoid / pectoralis major', 'Latissimus dorsi / triceps brachii', 'Anterior deltoid / pectoralis major'],
      answer: 0,
      explain: 'The pectoralis major horizontally adducts; the posterior deltoid horizontally abducts, so it opposes.',
      whyWrong: [null, 'This is reversed: the posterior deltoid horizontally abducts.', 'Neither is the main horizontal adductor, and they are not an opposing pair here.', 'Both muscles horizontally adduct, so they work together (synergists).'],
    },
    {
      id: 'aa09', topic: 'agonist_antagonist', difficulty: 3, action: 'Eccentric',
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
      id: 'aa11', topic: 'agonist_antagonist', difficulty: 3, action: 'Supination',
      stem: 'With the elbow bent, the forearm supinates to turn a doorknob. Which option correctly identifies the agonists and the antagonist?',
      options: ['Agonists: supinator and biceps brachii; antagonist: pronator teres', 'Agonist: pronator teres; antagonist: supinator', 'Agonists: supinator and triceps brachii; antagonist: biceps brachii', 'Agonist: brachialis; antagonist: pronator teres'],
      answer: 0,
      explain: 'The supinator and biceps brachii supinate the forearm; the pronator teres opposes them.',
      whyWrong: [null, 'This is reversed: the pronator teres pronates.', 'The triceps does not supinate, and the biceps is a supinator.', 'The brachialis attaches to the ulna, so it cannot supinate.'],
    },

    // ---------------- muscle_actions ----------------
    {
      id: 'ma01', topic: 'muscle_actions', difficulty: 1, action: 'Supination',
      stem: 'Which muscle both flexes the elbow and supinates the forearm?',
      options: ['Triceps brachii', 'Biceps brachii', 'Pronator teres', 'Brachialis'],
      answer: 1,
      explain: 'The biceps brachii flexes the elbow and is a strong supinator of the forearm.',
      whyWrong: ['The triceps brachii extends the elbow.', null, 'The pronator teres pronates the forearm.', 'The brachialis flexes the elbow but cannot supinate.'],
    },
    {
      id: 'ma02', topic: 'muscle_actions', difficulty: 1, action: 'Pronation',
      stem: 'Identify the main action of the pronator teres.',
      options: ['Supination of the forearm', 'Pronation of the forearm', 'Elbow extension', 'Shoulder medial rotation'],
      answer: 1,
      explain: 'The pronator teres turns the forearm so the palm faces down.',
      whyWrong: ['Supination is done by the supinator and biceps brachii.', null, 'Elbow extension is done by the triceps brachii.', 'Shoulder medial rotation is done by muscles such as the subscapularis.'],
    },
    {
      id: 'ma03', topic: 'muscle_actions', difficulty: 1, action: 'Lateral rotation',
      stem: 'What is the main action of the infraspinatus?',
      options: ['Medial rotation of the shoulder', 'Lateral rotation of the shoulder', 'Abduction of the hip', 'Extension of the elbow'],
      answer: 1,
      explain: 'The infraspinatus is a rotator cuff muscle that laterally rotates the shoulder.',
      whyWrong: ['Medial rotation is done by the subscapularis.', null, 'Hip abduction is done by the gluteus medius.', 'Elbow extension is done by the triceps brachii.'],
    },
    {
      id: 'ma04', topic: 'muscle_actions', difficulty: 1, action: 'Medial rotation',
      stem: 'Which rotator cuff muscle medially rotates the shoulder?',
      options: ['Infraspinatus', 'Supraspinatus', 'Subscapularis', 'Deltoid (middle)'],
      answer: 2,
      explain: 'The subscapularis, on the front of the shoulder blade, medially rotates the shoulder.',
      whyWrong: ['The infraspinatus laterally rotates the shoulder.', 'The supraspinatus starts shoulder abduction.', null, 'The deltoid is not a rotator cuff muscle; its middle part abducts.'],
    },
    {
      id: 'ma05', topic: 'muscle_actions', difficulty: 2, action: 'Horizontal adduction',
      stem: 'Which muscle is the prime mover for horizontal adduction of the shoulder in a chest fly?',
      options: ['Pectoralis major', 'Latissimus dorsi', 'Posterior deltoid', 'Trapezius'],
      answer: 0,
      explain: 'The pectoralis major pulls the raised arm across the chest.',
      whyWrong: [null, 'The latissimus dorsi extends, adducts and medially rotates the shoulder.', 'The posterior deltoid horizontally abducts (the opposite).', 'The trapezius moves the shoulder blade, not the arm across the chest.'],
    },
    {
      id: 'ma06', topic: 'muscle_actions', difficulty: 2, action: 'Horizontal abduction',
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
      id: 'ma08', topic: 'muscle_actions', difficulty: 1, action: 'Rotation',
      stem: 'Which muscles mainly rotate the trunk in the transverse plane, for example in a golf swing?',
      options: ['External and internal obliques', 'Iliopsoas', 'Pectoralis major', 'Hamstrings'],
      answer: 0,
      explain: 'The obliques, on the sides of the abdomen, rotate the trunk.',
      whyWrong: [null, 'The iliopsoas flexes the hip.', 'The pectoralis major acts at the shoulder.', 'The hamstrings flex the knee and extend the hip.'],
    },
    {
      id: 'ma09', topic: 'muscle_actions', difficulty: 3, action: 'Rotation',
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
      id: 'ma13', topic: 'muscle_actions', difficulty: 3, action: 'Medial rotation',
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
      options: ['They move heavy loads with little effort', 'They favour speed and range of motion', 'The fulcrum always lies between effort and load', 'They are rare in the human body'],
      answer: 1,
      explain: 'The effort arm is shorter than the load arm, so a large force is needed but the end of the limb moves fast and far.',
      whyWrong: ['That describes a second-class lever (mechanical advantage above 1).', null, 'That describes a first-class lever.', 'Most limb movements in the body are third-class levers.'],
    },
    {
      id: 'jl11', topic: 'joints_levers', difficulty: 1,
      stem: 'The wrist (radiocarpal) joint allows flexion, extension, and radial and ulnar deviation, but not rotation. What type of joint is it?',
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
        'Hold still, patching your cells.',
        'Medic on standby. Snacks not included.',
      ],
    },
    scout: {
      name: 'Scout',
      role: 'Marks the side the next drones will come from.',
      tagline: 'I see them before they see you.',
      banter: [
        'Contacts north-east, lots of them!',
        'Three drones, high, coming in from behind.',
        'Next wave is heavy. Load your upgrades wisely.',
        'I climbed the crane. Worth it. View is great.',
        'Something big is moving in the trees.',
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

  // Fixed camp roster (GAME_DESIGN §4.5). `type` keys into ALLY_TYPES.
  const ALLY_ROSTER = [
    { id: 'wrench', name: 'WRENCH', unit: 'UNIT-07', type: 'mechanic', visor: '#ffb347', arrives: 1 },
    { id: 'patch', name: 'PATCH', unit: 'UNIT-12', type: 'medic', visor: '#7dff9a', arrives: 1 },
    { id: 'kite', name: 'KITE', unit: 'UNIT-03', type: 'scout', visor: '#ff7ad9', arrives: 2 },
    { id: 'bolt', name: 'BOLT', unit: 'UNIT-21', type: 'engineer', visor: '#b48cff', arrives: 4 },
    { id: 'torque', name: 'TORQUE', unit: 'UNIT-15', type: 'mechanic', visor: '#ffe066', arrives: 6 },
    { id: 'salve', name: 'SALVE', unit: 'UNIT-30', type: 'medic', visor: '#56e0ff', arrives: 8 },
  ];

  // Spare friendly names (endless mode / extra units). The first six match ALLY_ROSTER.
  const ALLY_NAMES = [
    "UNIT-07 'Wrench'",
    "UNIT-12 'Patch'",
    "UNIT-03 'Kite'",
    "UNIT-21 'Bolt'",
    "UNIT-15 'Torque'",
    "UNIT-30 'Salve'",
    "UNIT-09 'Rivet'",
    "UNIT-04 'Cog'",
    "UNIT-18 'Pixel'",
    "UNIT-26 'Ratchet'",
    "UNIT-11 'Ember'",
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

  // Banter (not curriculum). Silenced during freezes; never hints at an answer.
  const DRONE_BANTER = {
    byAlly: {
      wrench: ["Fuel line's a mess. Keep them off my back!"].concat(ALLY_TYPES.mechanic.banter),
      patch: ALLY_TYPES.medic.banter.slice(),
      kite: ALLY_TYPES.scout.banter.slice(),
      bolt: ["Turret's online. It shoots small stuff only, sorry."].concat(ALLY_TYPES.engineer.banter),
      torque: ['Second wrench reporting in. Where is the worst damage?', 'Two mechanics, one truck. This will be quick.', 'Who parked this transport in a swamp?'],
      salve: ['Backup medic here. Nobody panic.', 'Cells topped up. Go get them.', 'I brought spare plating. Try not to need it.'],
    },
    events: {
      heal: ['Hold still, patching your cells.', 'Energy cell restored.', 'Patched. Back to work, hero.'],
      rescued: ['Thanks! That net smelled like the factory.', 'Free! I owe you a spare battery.', 'Never letting them catch me again.'],
      netted: ['Help! I am caught!', 'Net on me! Cut me loose!', 'They have got me!'],
      taken: ['Nooo! They are taking me to the trees!'],
      returned: ['I escaped and found my way back!', 'Did you miss me? I hid in a tyre pile.'],
      waveStart: ['Here they come!', 'Lights on the treeline. Get ready.', 'Back to work, everyone.'],
      waveClear: ['That is one more part fixed!', 'They are running! Nice work.', 'Quick break, then we go again.'],
      warden: ['...that is a big one.'],
      wardenDown: ['The Warden is scrap! Everyone, cheer!'],
      overdrive: ['OVERDRIVE! Look at it go!', 'Whoa, those muscles are glowing!'],
    },
  };

  // UI strings for Drone Defense. {braces} are filled by the engine.
  // Never put an axis name here: the engine appends axisName('transverse').
  const DRONE_UI = {
    rescuePrompt: 'Cut the net! Which plane is {movement} in?',
    rescueAxisPrompt: 'Nearly free! {movement} is in the {plane}. Which axis does it turn about?',
    rescueAxisWrong: 'Not that axis. Each plane has its own axis at right angles to it. Try again.',
    rescueCorrect: '{name} is free! +1 ENERGY',
    rescueWrong: 'Cutter jammed! {movement} is a {plane} movement. Try again in 2 s.',
    rescueLockout: 'CUTTER JAMMED',
    hud: {
      energy: 'ENERGY {cur}/{max}',
      repair: 'REPAIR {pct}%: {subsystem}',
      stalled: 'STALLED',
      wave: 'WAVE {n}',
      scrap: 'SCRAP {n}',
      combo: 'COMBO ×{n}',
      overdrive: 'OVERDRIVE',
      axisPrefix: '⊙ ',
      working: 'WORKING',
      netted: 'NETTED {s}',
      draggedOff: 'DRAGGED OFF',
      taken: '{unit} TAKEN',
      returned: '{unit} escaped and found its way back!',
      noSignal: 'NO SIGNAL',
      notSaved: 'progress not saved',
      paused: 'PAUSED',
    },
    freeze: {
      banner: 'THREAT: {title}',
      sensorsJammed: 'SENSORS JAMMED',
      choose: 'Choose the action. Click, or press 1–4.',
      timer: '{s} s',
    },
    card: {
      correct: 'CORRECT',
      planeLine: 'Transverse plane · about the {axis}',
      agonists: 'Agonists',
      contraction: 'Contraction',
      inplaneTitle: 'WRONG ACTION',
      planeTitle: 'SYSTEM FAILURE: PLANE VIOLATION',
      timeoutTitle: 'HESITATION',
      correctWas: 'Correct answer: {correct}',
      allyHit: '{name} NETTED',
      androidHit: '−1 ENERGY',
      ghost: 'REPLAY: the correct action',
      reask: 'This threat will come back later in the wave.',
      cont: 'Press Enter to continue',
    },
    wave: {
      intro: 'WAVE {n}: FIX THE {subsystem}',
      introLines: ['The drones are coming. Hold the line.', 'Keep them off the crew until the repair is done.', 'Lights in the trees. Here they come.'],
      cleared: '{subsystem} FIXED',
      outroLines: ['The drones pull back into the forest.', 'Quiet, for now. Head to the workshop.', 'The crew cheers. One more part working.'],
      shutdown: 'POWER FAILURE',
      failed: 'WAVE FAILED',
      noCrew: 'WAVE FAILED: NO CREW',
      noCrewDetail: 'Every ally was dragged off. Nobody is left to repair the transport. The wave restarts with everyone back.',
      restart: 'The wave restarts with full energy. Scrap and upgrades are kept.',
      newRecord: 'NEW RECORD',
      wardenInbound: 'WARDEN INBOUND',
      wardenDown: 'WARDEN DESTROYED',
      escape: 'ESCAPE COMPLETE',
      escapeDetail: 'The transport roars to life and drives into the forest with everyone aboard.',
      night2: 'NIGHT {n}: the transport broke down again further up the road.',
    },
    subsystems: ['TYRES', 'FUEL LINE', 'BATTERY', 'STEERING', 'ARMOUR PLATES', 'RADIATOR', 'AXLE', 'HEADLIGHTS', 'IGNITION', 'ENGINE CORE'],
    endlessSubsystems: ['GEARBOX', 'BRAKES', 'EXHAUST', 'WINDSCREEN', 'COOLANT PUMP', 'ALTERNATOR', 'SUSPENSION', 'DOOR HINGES', 'SPARK PLUGS', 'CLUTCH'],
    workshop: {
      title: 'WORKSHOP',
      tabs: ['TERMINAL', 'UPGRADES', 'LOADOUT'],
      deploy: 'DEPLOY',
      power: 'POWER {used}/{budget}',
      overBudget: 'Over the power budget. Unslot an upgrade to deploy.',
      optimised: 'OPTIMISED: +1 POWER',
      build: 'BUILD',
      upgrade: 'UPGRADE',
      maxed: 'MAX',
      cost: '{n} SCRAP',
      notEnough: 'Not enough scrap.',
      level: 'L{n}',
      calibration: 'CALIBRATION',
      calibLinks: {
        planes_axes: 'Axis lock: longer freeze timer',
        joint_actions: 'Strike damage',
        contractions: 'Tether and Ram resistance',
        agonist_antagonist: 'Combo and OVERDRIVE time',
        muscle_actions: 'Muscle surge (critical hits)',
        joints_levers: 'Repair and turret speed',
      },
      intelTitle: 'SCOUT INTEL',
      intelNoSignal: 'NO SIGNAL: KITE is not in camp.',
      intelSides: 'Most drones from the {side}',
      intelContraction: 'Expect contraction threats.',
      intelNew: {
        netter: 'NETTERS: they hunt your crew with nets.',
        diver: 'DIVERS: they circle, then dive at you.',
        lancer: 'LANCERS: they stop far out and charge a beam.',
        tether: 'LEECHES: they hook an arm with a cable.',
        swarm: 'MIDGES: small, fast, and they come in packs.',
        spotter: 'SPOTTERS: they hang back and call in help.',
        heavy: 'RAMS: heavy, armoured, and they shove hard.',
        crawler: 'SNARES: they crawl along the ground to your feet.',
        jammer: 'JAMMERS: they scramble your systems up close.',
      },
    },
    terminal: {
      title: 'EXAM TERMINAL',
      subtitle: 'SEHS Paper 1 practice. Correct answers earn SCRAP.',
      letters: ['A', 'B', 'C', 'D'],
      faultTag: 'FAULT LOG',
      overclock: 'OVERCLOCK',
      overclockDesc: '25 s per question, ×1.5 scrap. Running out of time counts as wrong.',
      correct: 'CORRECT',
      wrong: 'INCORRECT',
      explainLabel: 'Explanation',
      whyWrongLabel: 'Why your answer is wrong',
      scrapEarned: '+{n} SCRAP',
      streak: 'STREAK ×{n}',
      faultAdded: 'Added to the Fault Log. It will come back.',
      faultCleared: 'FAULT CLEARED +25',
      next: 'Enter: next',
      summary: 'VISIT SUMMARY',
      summaryLine: 'Scrap +{scrap} · Streak ×{streak} · Faults added {added} · cleared {cleared}',
    },
    report: {
      title: 'SESSION REPORT',
      mastered: 'MASTERED',
      practising: 'PRACTISING',
      review: 'REVIEW',
      copy: 'Copy report',
      copied: 'Copied!',
      assist: 'assist on',
    },
  };

  // Workshop upgrade text. Ids, effects, costs and power are engine-owned
  // (GAME_DESIGN §4.6d); content supplies { name, muscle, desc } only.
  const UPGRADE_TEXT = {
    rotatorCuffServos: { name: 'Rotator Cuff Servos', muscle: 'Rotator cuff', desc: 'The rotator cuff holds the head of the humerus steady in its socket, so steadier servos buy you extra seconds to decide.' },
    obliqueDrive: { name: 'Oblique Drive', muscle: 'External & internal obliques', desc: 'The obliques rotate the trunk, so a stronger drive widens your spin-strike sweep and adds damage.' },
    pronatorCoil: { name: 'Pronator Coil', muscle: 'Pronator teres', desc: 'The pronator teres pronates the forearm to turn the palm down or back, so a stronger coil boosts palm-pulse damage and radius.' },
    pecMajorActuator: { name: 'Pec Major Actuator', muscle: 'Pectoralis major', desc: 'The pectoralis major horizontally adducts the shoulder, sweeping the arm across the chest, so your cross swats hit harder and knock drones further.' },
    infraspinatusSpring: { name: 'Infraspinatus Spring', muscle: 'Infraspinatus', desc: 'The infraspinatus (with teres minor) laterally rotates the shoulder to cock the forearm out, so a springier one loads the disc launcher faster.' },
    subscapularisLauncher: { name: 'Subscapularis Launcher', muscle: 'Subscapularis', desc: 'The subscapularis medially rotates the shoulder to snap the forearm across the body, so discs fly harder and can pierce drones.' },
    rearDeltGuard: { name: 'Rear Delt Guard', muscle: 'Deltoid (posterior)', desc: 'The posterior deltoid horizontally abducts the shoulder, swinging a raised arm out and back, so backhands reach further and you get longer to cut netted allies free.' },
    glutePivot: { name: 'Glute Pivot Bearings', muscle: 'Gluteus maximus', desc: 'The gluteus maximus extends and laterally rotates the hip to power pivots, so the android pivots on its feet faster.' },
    allyUplink: { name: 'Ally Uplink', muscle: 'None (radio)', desc: 'A stronger radio link lets one more ally join the camp.' },
    reinforcedFrame: { name: 'Reinforced Frame', muscle: 'Skeleton', desc: 'The skeleton protects vital organs and gives muscles a rigid frame to pull on, so a reinforced frame adds an extra energy cell.' },
    medicProtocol: { name: 'Medic Protocol', muscle: 'None (ally)', desc: 'PATCH runs a faster repair routine and restores your energy cells more often.' },
    mechanicTorque: { name: 'Mechanic Torque Wrench', muscle: 'None (lever)', desc: 'A longer wrench handle is a longer effort arm, so the same force makes more torque and repairs go faster.' },
    engineerTurret: { name: 'Turret Mk II', muscle: 'None (ally)', desc: 'BOLT rebuilds the turret to fire harder and faster.' },
    spindleSensors: { name: 'Muscle Spindle Sensors', muscle: 'Muscle spindles', desc: 'Muscle spindles sense how far and how fast a muscle is stretched (proprioception), so sharper sensors spot threats earlier.' },
    tendonCapacitor: { name: 'Tendon Capacitor', muscle: 'Tendons', desc: 'Tendons stretch and recoil like springs, storing and returning elastic energy, so your combo holds its charge for longer.' },
  };

  // ---------------------------------------------------------------
  // DRONE DEFENSE: progression content (read by js/progress.js and
  // js/transverse.js). Static strings never name an axis.
  // ---------------------------------------------------------------

  // Movements used for the rescue "which plane?" question. Only names the
  // tutorials teach; filtered so every entry exists in MOVEMENT_PLANE.
  const DRONE_RESCUE_MOVES = [
    'Flexion', 'Extension', 'Dorsiflexion', 'Plantarflexion',
    'Abduction', 'Adduction', 'Lateral flexion',
    'Rotation', 'Medial rotation', 'Lateral rotation', 'Horizontal abduction', 'Horizontal adduction', 'Pronation', 'Supination',
  ].filter((m) => MOVEMENT_PLANE[m]);

  // Movement Codex: one page per Drone Defense action. `name` matches the
  // DRONE_THREATS `correct` values and MCQ_BANK `action` tags exactly.
  // plane: null for contraction types. musclesPrime keys into MUSCLES.
  const CODEX = [
    {
      id: 'horizontal_abduction', name: 'Horizontal abduction', plane: 'transverse', joint: 'Shoulder',
      definition: 'A raised arm swings level, backward and away from the midline.',
      example: 'The reverse fly in the gym; a backhand frisbee throw.',
      droneUse: 'A raised arm swats a drone away from the midline, as in the KITE swat and the backhand.',
      musclesPrime: ['deltoid_posterior', 'infraspinatus'],
    },
    {
      id: 'horizontal_adduction', name: 'Horizontal adduction', plane: 'transverse', joint: 'Shoulder',
      definition: 'A raised arm swings level, forward and toward the midline, across the chest.',
      example: 'The chest fly; the forward sweep of a discus throw.',
      droneUse: 'A raised arm sweeps across the chest to smash a netter or a diver.',
      musclesPrime: ['pectoralis_major', 'deltoid_anterior'],
    },
    {
      id: 'rotation', name: 'Rotation', plane: 'transverse', joint: 'Spine (trunk)',
      definition: 'The trunk or head turns around its own long, head-to-toe axis.',
      example: 'Turning the shoulders away from the target in a golf backswing.',
      droneUse: 'The trunk turns to face a diver behind you, or sweeps the arm through a midge swarm.',
      musclesPrime: ['obliques'],
    },
    {
      id: 'medial_rotation', name: 'Medial rotation', plane: 'transverse', joint: 'Shoulder (and hip)',
      definition: 'A limb turns inward around its own long axis.',
      example: 'The upper arm snapping inward as a baseball pitch or tennis serve is released.',
      droneUse: 'With the elbow tucked, the forearm snaps across the belly to fire the disc launcher.',
      musclesPrime: ['subscapularis', 'pectoralis_major', 'latissimus_dorsi'],
    },
    {
      id: 'lateral_rotation', name: 'Lateral rotation', plane: 'transverse', joint: 'Shoulder and hip',
      definition: 'A limb turns outward around its own long axis.',
      example: 'Cocking the throwing arm back; turning the toes out for a side-foot pass.',
      droneUse: 'The tucked forearm swings out to cock the launcher, and the hip turns the toes onto a Snare.',
      musclesPrime: ['infraspinatus', 'gluteus_maximus'],
    },
    {
      id: 'pronation', name: 'Pronation', plane: 'transverse', joint: 'Radio-ulnar (forearm)',
      definition: 'The forearm turns so the palm faces down, or backward when the arm hangs.',
      example: 'Turning the palm to face the floor to dribble a basketball.',
      droneUse: 'With the arm hanging, the palm shield turns to face a lancer behind you.',
      musclesPrime: ['pronator_teres'],
    },
    {
      id: 'supination', name: 'Supination', plane: 'transverse', joint: 'Radio-ulnar (forearm)',
      definition: 'The forearm turns so the palm faces up, or forward when the arm hangs.',
      example: 'Turning the palms up to make a cupped, low catch in cricket.',
      droneUse: 'With the arm hanging, the palm shield turns to face a lancer in front of you.',
      musclesPrime: ['supinator', 'biceps_brachii'],
    },
    {
      id: 'isometric', name: 'Isometric', plane: null, joint: 'Any joint (in game: shoulder)',
      definition: 'The muscle makes force without changing length, so the joint stays still.',
      example: 'Holding a plank; two rugby packs locked still in a scrum.',
      droneUse: 'The shoulder holds dead still against a Leech tether while BOLT cuts the cable.',
      musclesPrime: ['subscapularis', 'pectoralis_major'],
    },
    {
      id: 'eccentric', name: 'Eccentric', plane: null, joint: 'Any joint (in game: shoulder)',
      definition: 'The muscle lengthens while making force, braking or lowering a load under control.',
      example: 'The quadriceps controlling the knees when landing from a jump.',
      droneUse: 'The pectoralis major gives way slowly as a Ram shoves the raised arm out and back.',
      musclesPrime: ['pectoralis_major', 'deltoid_anterior'],
    },
    {
      id: 'concentric', name: 'Concentric', plane: null, joint: 'Any joint (in game: shoulder)',
      definition: 'The muscle shortens while making force, so the joint moves against the load.',
      example: 'The biceps lifting the bar in a curl; the quadriceps driving a jump.',
      droneUse: 'The subscapularis snaps the disc out fast against the pull of the launcher spring.',
      musclesPrime: ['subscapularis', 'pectoralis_major', 'latissimus_dorsi'],
    },
  ];

  // Mastery: an action is MASTERED after `firstTryStreak` first-try correct
  // answers in a row (freezes or tagged MCQs).
  const MASTERY = {
    firstTryStreak: 3,
    labels: { locked: 'LOCKED', learning: 'LEARNING', mastered: 'MASTERED' },
    badgeEarned: 'MASTERY BADGE: {action}',
  };

  // Cosmetic unlocks. unlock.type 'mastery' -> CODEX name; 'boss' -> Warden kills.
  const COSMETICS = [
    { id: 'visor_oblique', kind: 'visor', name: 'Oblique Orange', color: '#ff8c42', unlock: { type: 'mastery', action: 'Rotation' } },
    { id: 'trail_pecsweep', kind: 'trail', name: 'Pec Sweep', color: '#3de0ff', unlock: { type: 'mastery', action: 'Horizontal adduction' } },
    { id: 'trail_reardelt', kind: 'trail', name: 'Rear Delt Arc', color: '#b48cff', unlock: { type: 'mastery', action: 'Horizontal abduction' } },
    { id: 'visor_cuff', kind: 'visor', name: 'Cuff Crimson', color: '#ff3d5a', unlock: { type: 'mastery', action: 'Medial rotation' } },
    { id: 'trail_spring', kind: 'trail', name: 'Cocked Spring', color: '#7dff9a', unlock: { type: 'mastery', action: 'Lateral rotation' } },
    { id: 'visor_palmdown', kind: 'visor', name: 'Palm-Down Purple', color: '#9b5cff', unlock: { type: 'mastery', action: 'Pronation' } },
    { id: 'visor_soupbowl', kind: 'visor', name: 'Soup Bowl Gold', color: '#ffd23d', unlock: { type: 'mastery', action: 'Supination' } },
    { id: 'trail_statue', kind: 'trail', name: 'Statue Shimmer', color: CONTRACTIONS.isometric.color, unlock: { type: 'mastery', action: 'Isometric' } },
    { id: 'trail_brakelights', kind: 'trail', name: 'Brake Lights', color: CONTRACTIONS.eccentric.color, unlock: { type: 'mastery', action: 'Eccentric' } },
    { id: 'visor_snapflare', kind: 'visor', name: 'Snap Flare', color: CONTRACTIONS.concentric.color, unlock: { type: 'mastery', action: 'Concentric' } },
    { id: 'visor_wardenslayer', kind: 'visor', name: 'Warden Slayer', color: '#ffffff', unlock: { type: 'boss', boss: 'warden', count: 1 } },
    { id: 'trail_wardencomet', kind: 'trail', name: 'Warden Comet', color: '#ff5ef0', unlock: { type: 'boss', boss: 'warden', count: 3 } },
  ];

  // Optional wave goals. Speed goals always require CORRECT answers.
  const CONTRACTS = [
    { id: 'noNet', name: 'Safety Net', desc: 'No ally netted this wave.', scrap: 40 },
    { id: 'firstTry5', name: 'Sharp Mind', desc: '5 first-try correct answers in a row.', scrap: 50 },
    { id: 'noTimeout', name: 'No Hesitation', desc: 'Answer every freeze before its timer runs out.', scrap: 30 },
    { id: 'cleanPlane', name: 'Plane Perfect', desc: 'No wrong-plane answers this wave.', scrap: 40 },
    { id: 'rescueAll', name: 'Leave No One', desc: 'Free every netted ally before they are dragged off.', scrap: 35 },
    { id: 'bossFlawless', name: 'Warden Breaker', desc: 'Beat the Warden with no wrong answers.', scrap: 80 },
    { id: 'quickDraw', name: 'Quick Draw', desc: 'Answer 3 freezes CORRECTLY in under 5 s each.', scrap: 45 },
    { id: 'contractionAce', name: 'Contraction Ace', desc: 'Get every contraction freeze right on the first try.', scrap: 45 },
    { id: 'midlineMaster', name: 'Midline Master', desc: 'Get every horizontal swing freeze right on the first try.', scrap: 40 },
    { id: 'rotatorPro', name: 'Rotator Pro', desc: 'Get every medial or lateral rotation freeze right on the first try.', scrap: 40 },
    { id: 'palmReader', name: 'Palm Reader', desc: 'Get every pronation or supination freeze right on the first try.', scrap: 40 },
    { id: 'ironFrame', name: 'Iron Frame', desc: 'Finish the wave without losing an energy cell.', scrap: 50 },
    { id: 'codexStudy', name: 'Codex Study', desc: 'After a miss, open that action in the Movement Codex.', scrap: 20 },
  ];

  // Ally levels. Perk units: repairMul = repair-speed multiplier,
  // healEvery = seconds between heals, turretRate = turret fire-rate
  // multiplier, warnEarly = extra seconds of warning before a drone side.
  const ALLY_LEVELS = {
    mechanic: [
      { xp: 0, perk: { repairMul: 1.0 }, title: 'Apprentice Wrench', unlockBanter: ['Ready to work. Point me at the broken bits.', 'Keep the drones busy and I will keep the truck busy.'] },
      { xp: 60, perk: { repairMul: 1.15 }, title: 'Torque Tech', unlockBanter: ['Found a faster way to tighten these bolts!', 'New trick: longer handle, more torque. Physics!'] },
      { xp: 150, perk: { repairMul: 1.3 }, title: 'Master Mechanic', unlockBanter: ['I can rebuild this engine with my eyes shut.', 'Master Mechanic. Put it on my name badge.'] },
    ],
    medic: [
      { xp: 0, perk: { healEvery: 60 }, title: 'Field Patcher', unlockBanter: ['Medic kit packed. Try to stay in one piece.', 'I will keep your cells topped up.'] },
      { xp: 60, perk: { healEvery: 48 }, title: 'Cell Surgeon', unlockBanter: ['Faster patches, fewer sparks. You are welcome.', 'New charger rigged. Healing comes quicker now.'] },
      { xp: 150, perk: { healEvery: 36 }, title: 'Chief Medic', unlockBanter: ['Chief Medic reporting. Nobody shuts down on my watch.', 'I could patch you mid-swat now.'] },
    ],
    scout: [
      { xp: 0, perk: { warnEarly: 2 }, title: 'Lookout', unlockBanter: ['Eyes on the treeline.', 'I will shout when I see lights.'] },
      { xp: 60, perk: { warnEarly: 3 }, title: 'Pathfinder', unlockBanter: ['Climbed higher. I can see them sooner now.', 'New lens fitted. The forest has no secrets.'] },
      { xp: 150, perk: { warnEarly: 4 }, title: 'Eagle Eye', unlockBanter: ['I spot drones before they leave the factory.', 'Eagle Eye online. Nothing sneaks up on us now.'] },
    ],
    engineer: [
      { xp: 0, perk: { turretRate: 1.0 }, title: 'Tinkerer', unlockBanter: ['One turret, slightly wobbly. Good enough.', 'If it sparks, that means it works.'] },
      { xp: 60, perk: { turretRate: 1.2 }, title: 'Turret Smith', unlockBanter: ['Greased the swivel. Faster spin, faster shots.', 'Turret Mk 1.5. Do not ask about Mk 1.4.'] },
      { xp: 150, perk: { turretRate: 1.4 }, title: 'Chief Engineer', unlockBanter: ['Chief Engineer! The turret salutes you.', 'Full spin, full speed. Drones beware.'] },
    ],
  };

  // Session report (js/progress.js). {braces} are filled by the engine.
  const REPORT_TEXT = {
    title: 'SESSION REPORT',
    headings: {
      summary: 'Summary',
      actions: 'Actions and mastery',
      topics: 'Exam topics',
      confusions: 'Most-confused pairs',
      contracts: 'Wave contracts',
      nextSteps: 'What to review next',
    },
    labels: {
      wavesPlayed: 'Waves played',
      bestWave: 'Best wave',
      freezeAccuracy: 'Freeze accuracy',
      firstTry: 'First-try correct',
      mcqAccuracy: 'Exam terminal accuracy',
      planeErrors: 'Wrong-plane answers',
      timeouts: 'Timeouts',
      timePlayed: 'Time played',
      mastered: 'Mastered',
    },
    confusedPairLine: 'Chose {chosen} when the answer was {correct} (×{n})',
    noConfusions: 'No repeated mix-ups. Nice work.',
    assistUsed: 'Assist (practice) mode used',
    assistYes: 'Yes: some freezes were untimed',
    assistNo: 'No',
    copy: 'Copy report',
    copied: 'Copied!',
    copyFail: 'Copy failed. Select the text and copy it by hand.',
    privacy: 'Nothing is uploaded. This report stays on this device until you copy it.',
    classCodePrompt: 'Class code from your teacher (optional):',
    classCodePlaceholder: 'e.g. SEHS-11B',
    namePrompt: 'Your initials (optional):',
  };

  // Class seed: the same seed gives the same waves and questions.
  const SEED_TEXT = {
    prompt: 'Class seed (optional):',
    placeholder: 'e.g. 11B-WEEK3',
    help: 'Type the seed your teacher gives you. Everyone with the same seed gets the same waves and questions, so results are fair to compare.',
    apply: 'Apply seed',
    clear: 'Clear seed',
    active: 'Seed: {seed}',
    none: 'No seed: random waves',
    invalid: 'Use letters, numbers and dashes only, up to 16 characters.',
  };

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
    ALLY_ROSTER,
    DRONE_BANTER,
    DRONE_UI,
    LIMB_LABELS,
    UPGRADE_TEXT,
    LEVELS,
    TUTORIALS,
    REVIEW_CHECKS,
    planeOf,
    planeFailText,
    PLANE_FAIL_NOTES,
    DRONE_RESCUE_MOVES,
    CODEX,
    MASTERY,
    COSMETICS,
    CONTRACTS,
    ALLY_LEVELS,
    REPORT_TEXT,
    SEED_TEXT,
    JOINT_ROTATION,
  };
})();
