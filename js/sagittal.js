/*
 * sagittal.js: LEVEL 2 "FACTORY ESCAPE" (sagittal plane side-scroller)
 * -----------------------------------------------------------------
 * Owned by the "level-designer" (data/pacing) + "game-engineer" agents.
 *
 * The android stays centred; the world scrolls left. As each hazard
 * approaches, time slows to a near-freeze while the android settles
 * into an anticipation pose. The student picks a movement or
 * contraction type before the timer ends:
 *   correct          -> success animation, keep running
 *   wrong, sagittal  -> the muscles do what was chosen (e.g. legs flex
 *                       tighter and the android rolls into the pit)
 *   wrong plane      -> malfunction, screen crack, SYSTEM FAILURE
 * Hybrid damage system (GAME_DESIGN §2b):
 *   fatal   (fell into a hole / crushed) -> full explosion, fail card,
 *           reboot at the same hazard (checkpoint), energy unchanged.
 *   partial (one body part hit, or a plane error) -> -1 energy, partial
 *           explosion at that part (none for plane errors), the part stays
 *           damaged, fail card, then rewindToDecision() re-asks the SAME
 *           question. Energy 0 -> shutdown -> checkpoint, energy refilled.
 */
(function () {
  'use strict';
  const SEHS = window.SEHS;
  const C = SEHS.content;
  const Android = SEHS.Android;
  const { mk, lerpPose, clonePose, jitterPose } = SEHS.Pose;
  const Audio = SEHS.Audio;

  const W = 1280, H = 720, GY = 560, PX = 640;
  const G = 1700;
  const CYCLE = 300; // world px per running cycle (two steps)
  const TAU = Math.PI * 2;
  // back catwalk for the friend androids
  const LANE_Y = GY - 96, LANE_P = 0.85, LANE_SCALE = 0.6, LANE_GAP_EVERY = 1150, LANE_GAP_W = 120;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const MAX_ENERGY = 5;
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function hash(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  function withMus(p, mus) { const o = clonePose(p); o.mus = mus; return o; }

  // ---------------- pose library ----------------
  const POSES = {
    stand: mk(),
    crouch: mk({ lean: 30, legN: [88, 108, 28], legF: [80, 100, 26], arms: [-45, 25] }),
    extend: mk({ lean: 12, legN: [-8, 0, -35], legF: [-12, 2, -32], arms: [150, 15] }),
    tuck: mk({ lean: 20, legN: [80, 100, 10], legF: [70, 95, 10], arms: [60, 60] }),
    landPrep: mk({ lean: 15, legN: [40, 30, 5], legF: [30, 25, 5], arms: [50, 30] }),
    absorb: mk({ lean: 28, legN: [75, 92, 26], legF: [70, 88, 24], arms: [30, 40] }),
    superTuck: mk({ lean: 35, legN: [122, 150, 35], legF: [118, 148, 35], arms: [70, 135], head: 20 }),
    halfCrouch: mk({ lean: 22, legN: [45, 55, 18], legF: [30, 48, 15], armN: [25, 70], armF: [-10, 70] }),
    slide: mk({ lean: -50, legN: [38, 22, -12], legF: [-22, 118, -20], armN: [-30, 20], armF: [-40, 25], head: 30 }),
    tall: mk({ lean: -4, legs: [-3, 0, -28], arms: [165, 5], head: -15 }),
    pushReady: mk({ lean: 22, legN: [45, 42, 15], legF: [-18, 18, 10], arms: [-20, 125] }),
    push: mk({ lean: 28, legN: [40, 30, 5], legF: [-28, 4, -22], arms: [114, 2] }), // arms horizontal: shoulder flexion is measured from the leaning trunk
    pull: mk({ lean: -12, legN: [30, 30, 10], legF: [-10, 25, 5], arms: [-40, 150] }),
    stepOff: mk({ lean: 6, legN: [55, 12, -15], legF: [-8, 22, 5], armN: [70, 20], armF: [55, 25] }),
    dropAir: mk({ lean: 10, legN: [35, 28, -10], legF: [25, 30, -12], arms: [80, 20] }),
    deepAbsorb: mk({ lean: 32, legs: [88, 112, 30], arms: [40, 40] }),
    stiffLegs: mk({ lean: 4, legs: [0, -2, 0], arms: [60, 10] }),
    kneesBroken: mk({ lean: 24, legN: [12, -38, 0], legF: [8, -30, 0], arms: [20, 10], head: 25 }),
    reachPrep: mk({ lean: 22, legs: [50, 62, 22], arms: [35, 25], head: -20 }),
    reach: mk({ lean: 2, legN: [15, 25, -25], legF: [5, 30, -25], armN: [170, 8], armF: [164, 10], head: -15 }),
    hold: mk({ lean: -6, legN: [18, 30, -20], legF: [6, 38, -20], armN: [96, 86], armF: [92, 88], head: -10 }),
    pullUp: mk({ lean: -4, legN: [25, 45, -20], legF: [12, 50, -20], armN: [38, 145], armF: [34, 148], head: -25 }),
    lowered: mk({ lean: 0, legN: [8, 10, -30], legF: [2, 14, -30], armN: [174, 3], armF: [170, 4] }),
    armsBack: mk({ lean: 10, legN: [-5, 10, -25], legF: [-15, 12, -25], arms: [-55, 10] }),
    slump: mk({ lean: 55, legs: [95, 125, 30], arms: [-5, 10], head: 35 }),
    // rigid landing (partial): bounced and fell back onto its seat, legs out in front
    seated: mk({ lean: -18, legN: [78, 18, -8], legF: [72, 26, -8], armN: [-40, 20], armF: [-30, 25], head: 12 }),
  };

  POSES.crouchHold = withMus(POSES.crouch, { quadriceps: ['i', 0.45], gluteus_maximus: ['i', 0.4], soleus: ['i', 0.3] });
  POSES.halfCrouchHold = withMus(POSES.halfCrouch, { quadriceps: ['i', 0.35], gluteus_maximus: ['i', 0.25] });
  POSES.pushReadyHold = withMus(POSES.pushReady, { biceps_brachii: ['i', 0.3], quadriceps: ['i', 0.35], gastrocnemius: ['i', 0.3] });
  POSES.stepOffHold = withMus(POSES.stepOff, { quadriceps: ['i', 0.4], gluteus_maximus: ['i', 0.3], deltoid_anterior: ['i', 0.3] });
  POSES.reachPrepHold = withMus(POSES.reachPrep, { quadriceps: ['i', 0.4], gluteus_maximus: ['i', 0.35] });
  POSES.holdHang = withMus(POSES.hold, { biceps_brachii: ['i', 0.6], brachialis: ['i', 0.6], latissimus_dorsi: ['i', 0.3] });

  // ---- blast door ----
  // Feet stay flat when ankle = lean + knee - hip (see doorLegs).
  const doorLegs = (lean, hip, knee) => [hip, knee, lean + knee - hip];
  // doorReach / doorHold: under the door, both arms overhead (shoulder 166° from
  // the trunk, elbows 18°), knees 44°, hips 38°, trunk 6° forward. Both arms use
  // the same angles so both fists share one top height:
  //   Android.handTopRel(POSES.doorHold) = y of the fist tops relative to the hip
  //   (door bottom edge = pl.y + handTopRel). Hand centre: Android.handRel(p)[1].
  POSES.doorReach = mk({ lean: 6, legs: doorLegs(6, 38, 44), arms: [166, 18], head: -12 });
  // Isometric hold: same angles, agonists amber (triceps, anterior deltoid push the
  // door; quadriceps, gluteus maximus hold the half squat; calves stabilise).
  POSES.doorHold = withMus(POSES.doorReach, {
    triceps_brachii: ['i', 0.85], deltoid_anterior: ['i', 0.85], quadriceps: ['i', 0.85], gluteus_maximus: ['i', 0.85],
    gastrocnemius: ['i', 0.4], soleus: ['i', 0.4],
  });
  // Concentric end pose (wrong answer): elbows, shoulders, knees and hips extend; agonists shorten.
  POSES.doorShove = mk({
    lean: 2, legs: doorLegs(2, 5, 10), arms: [175, 0], head: -18,
    mus: { triceps_brachii: ['c', 1], deltoid_anterior: ['c', 0.95], quadriceps: ['c', 1], gluteus_maximus: ['c', 0.9] },
  });
  // Eccentric end pose (wrong answer): elbows/knees/hips flex under the load while the
  // extensors stay active and lengthen. Elbows 108° keeps the fists level with the head
  // top (deeper elbow flexion would put the head above the hands).
  POSES.doorGive = mk({
    lean: 28, legs: doorLegs(28, 90, 100), arms: [142, 108], head: 25,
    mus: { triceps_brachii: ['e', 0.9], deltoid_anterior: ['e', 0.8], quadriceps: ['e', 0.9], gluteus_maximus: ['e', 0.8], soleus: ['e', 0.4] },
  });
  // Freeze pose for the door question: same angles as doorReach; the loaded
  // muscles carry tension so they show the neutral "SENSORS JAMMED" white like
  // the other contraction questions (draw neutral hides the C/E/I colour, and
  // the monitor is jammed, so this does not give the answer away).
  POSES.doorReachJam = withMus(POSES.doorReach, {
    triceps_brachii: ['i', 0.6], deltoid_anterior: ['i', 0.6], quadriceps: ['i', 0.6], gluteus_maximus: ['i', 0.6],
  });
  // Duck-out after success: low forward dive, arms dropped, far leg driving off the floor.
  POSES.doorDuck = mk({ lean: 42, legN: [108, 96, 30], legF: [40, 72, 6], armN: [-45, 35], armF: [50, 60], head: -10 });
  // Failed friend android: kneeling on the far knee (toes tucked behind), near foot flat,
  // trunk slumped forward, arms hanging, head dropped.
  POSES.friendKneel = mk({ lean: 34, legN: [122, 86, -2], legF: [34, 112, -8], arms: [22, 28], head: 38 });

  function runPose(ph, lean) {
    const leg = (f) => [
      10 + 34 * Math.sin(f),
      18 + 80 * Math.pow(Math.max(0, Math.cos(f + 0.25)), 2) + 14 * Math.max(0, -Math.cos(f)),
      10 * Math.max(0, Math.cos(f)) - 24 * Math.max(0, -Math.sin(f + 0.35)),
    ];
    const arm = (f) => [8 - 42 * Math.sin(f), 88 - 12 * Math.sin(f)];
    return mk({ lean: lean == null ? 12 : lean, legN: leg(ph), legF: leg(ph + Math.PI), armN: arm(ph), armF: arm(ph + Math.PI) });
  }


  // ======================================================================
  class SagittalLevel {
    constructor(game) {
      this.game = game;
      this.fx = game.fx;
      this.android = new Android();
      this.bgfx = new SEHS.FX();
      this.friends = [];
      this.friendT = 1.5;
      this.doorFriends = [];
      this.floaters = [];
      this.time = 0;
      this.phase = 0;
      this.energy = MAX_ENERGY;
      this.damage = {};
      this.unitPool = [];
      this.measure();
      this.stats = {
        correct: 0, decisions: 0, streak: 0, best: 0, plane: 0, wrongSagittal: 0, contraction: 0, timeout: 0, reboots: 0,
        firstTries: 0, firstTryCorrect: 0, partials: 0, shutdowns: 0, friendsSaved: 0, energyLeft: MAX_ENERGY, log: [],
      };
      this.buildCourse();
      this.restartAt(0);
    }

    // geometry measured from the rig so obstacles always fit the android
    measure() {
      const headH = (p) => Android.lowestRel(p) - Android.headTopRel(p);
      this.slideHead = headH(POSES.slide);
      this.crouchHead = headH(POSES.halfCrouch);
      this.beamBottom = GY - Math.min(this.slideHead + 30, this.crouchHead - 25);
      const hr = (p) => Android.handRel(p);
      this.handleDrop = 52;
      this.feetBelowHand = (p) => Android.lowestRel(p) - hr(p)[1];
    }

    // ---------------- course generation ----------------
    buildCourse() {
      // Difficulty ramps by tier (content.js): simple joint actions first
      // (tier 1: jump = extension, push = extension), then tier 2 (reach +
      // isometric hold, slide), then tier 3 (eccentric landing), then a mix.
      const tierOf = (t) => C.OBSTACLES[t].tier || 1;
      const types = Object.keys(C.OBSTACLES);
      const pick = (maxTier, avoid) => {
        const opts = types.filter((t) => tierOf(t) <= maxTier && t !== avoid);
        return opts[Math.floor(Math.random() * opts.length)];
      };
      // the blast door follows the laser (GAME_DESIGN §2: tiered order)
      const seq = ['gap', 'crate', 'gap', 'zipline', 'laser', 'door'];
      seq.push(pick(2, 'door')); // slot 7: never two doors in a row
      seq.push('drop');
      while (seq.length < 10) seq.push(pick(3, seq[seq.length - 1]));
      this.obs = [];
      let x = 1500;
      seq.forEach((type, i) => {
        const ob = this.makeOb(type, x, i);
        this.obs.push(ob);
        x = ob.end + 1050 + Math.random() * 350;
      });
      this.exitX = x + 250;
    }

    makeOb(type, x0, i) {
      const ob = { type, i, data: C.OBSTACLES[type] };
      switch (type) {
        case 'gap':
          ob.x = x0; ob.w = Math.min(300, 220 + i * 9);
          ob.start = x0; ob.end = x0 + ob.w; ob.triggers = [ob.x - 70];
          break;
        case 'laser':
          ob.x = x0 + 40; ob.w = 250;
          ob.start = x0; ob.end = ob.x + ob.w + 40; ob.triggers = [ob.x - 150];
          break;
        case 'crate':
          ob.x = x0; ob.w = 96;
          ob.start = x0; ob.end = x0 + 96;
          // freeze where the fully extended push just reaches the crate face
          ob.triggers = [ob.x - Android.handRel(POSES.push)[0] + 18];
          break;
        case 'drop':
          ob.h = 120; ob.rampA = x0; ob.rampB = x0 + 240; ob.x = x0 + 240 + 220;
          ob.start = x0; ob.end = ob.x + 20; ob.triggers = [ob.x - 26];
          break;
        case 'zipline': {
          ob.x = x0 + 200; ob.w = 900;
          ob.railY = GY - 410; ob.railA = ob.x - 200; ob.railB = ob.x + ob.w + 200;
          ob.zoneA = ob.x + 320; ob.zoneB = ob.x + 640;
          ob.start = x0; ob.end = ob.x + ob.w + 200;
          ob.triggers = [ob.x - 78, ob.zoneA - 60];
          ob.dismount = ob.x + ob.w + 40;
          const handleY = ob.railY + this.handleDrop;
          const fHold = handleY + this.feetBelowHand(POSES.hold);
          const fLow = handleY + this.feetBelowHand(POSES.lowered);
          ob.grinderTop = (fHold + fLow) / 2 + 4;
          break;
        }
        case 'door': {
          // ob.x = door near face. Freeze when the hands are under the middle
          // of the door's bottom edge; the door touches the fists exactly then.
          ob.x = x0 + 120; ob.w = 70;
          ob.start = x0; ob.end = ob.x + ob.w + 120;
          ob.triggers = [ob.x + ob.w / 2 - Android.handRel(POSES.doorHold)[0]];
          ob.handY = GY - Android.lowestRel(POSES.doorHold) + Android.handTopRel(POSES.doorHold);
          ob.openY = GY - 470;
          break;
        }
        default:
          throw new Error('makeOb: unknown hazard type ' + type);
      }
      ob.reset = () => {
        ob.stage = 0; ob.done = false;
        if (type === 'crate') { ob.cx = ob.x; ob.cy = 0; ob.ang = 0; ob.vx = 0; ob.vy = 0; ob.va = 0; ob.flying = false; ob.pivot = false; ob.gone = false; }
        if (type === 'zipline') { ob.trolleyX = ob.triggers[0] + Android.handRel(POSES.reach)[0]; ob.attached = false; ob.free = false; ob.K = 0; }
        if (type === 'door') { ob.doorY = ob.openY; ob.vy = 0; ob.slammed = false; ob.alarm = false; ob.override = false; ob.falling = false; ob.friendsSpawned = false; }
      };
      ob.reset();
      return ob;
    }

    groundAt(wx) {
      if (this.mode === 'attract') return GY;
      for (let k = Math.max(0, this.cur - 1); k < Math.min(this.obs.length, this.cur + 3); k++) {
        const ob = this.obs[k];
        if (wx < ob.start - 5 || wx > ob.end + 5) continue;
        if ((ob.type === 'gap' || ob.type === 'zipline') && wx >= ob.x && wx <= ob.x + ob.w) return null;
        if (ob.type === 'drop') {
          if (wx >= ob.rampA && wx < ob.rampB) return GY - (ob.h * (wx - ob.rampA)) / (ob.rampB - ob.rampA);
          if (wx >= ob.rampB && wx <= ob.x) return GY - ob.h;
        }
      }
      return GY;
    }
    sx(wx) { return PX + (wx - this.scrollX); }

    // ---------------- state control ----------------
    // Checkpoint reboot: energy is NOT touched here (GAME_DESIGN §2b);
    // cosmetic damage is cleared because it is a rebooted chassis.
    restartAt(i) {
      this.cur = i;
      for (let j = i; j < this.obs.length; j++) this.obs[j].reset();
      this.scrollX = i === 0 ? 0 : this.obs[i].start - 650;
      this.speed = 380 + 14 * i;
      this.decisionTime = Math.max(4.5, 8 - 0.35 * i);
      this.mode = 'run';
      this.act = null;
      this.decision = null;
      this.snap = null;
      this.failInfo = null;
      this.scrollMul = 1;
      this.ts = 1; this.blend = 0;
      this.sysFail = 0;
      this.powerFail = 0;
      this.neutralAct = false;
      this.winT = 0;
      this.camFocus = 0;
      this.damage = {};
      this.pl = { pose: runPose(this.phase), x: PX, y: GY - 150, mode: 'ground', vy: 0, visible: true, status: 'ok', onLand: null, onFall: null };
      this.android.reset();
      this.fx.reset();
      this.doorFriends = [];
      if (this.bgfx) { this.bgfx.reset(); this.friends = []; this.friendT = 2; this.floaters = []; }
    }

    setAttract(on) {
      if (on) { this.mode = 'attract'; this.scrollX = 0; this.pl.visible = true; this.pl.status = 'ok'; this.pl.mode = 'ground'; this.pl.x = 1010; }
    }

    stageDone(ob) {
      ob.stage++;
      this.act = null;
      this.neutralAct = false;
      if (ob.type === 'zipline' && !ob.done && ob.attached) { this.mode = 'ride'; return; }
      ob.done = true;
      this.cur++;
      this.speed = 380 + 14 * this.cur;
      this.decisionTime = Math.max(4.5, 8 - 0.35 * this.cur);
      this.mode = 'run';
    }

    // Ready positions are HELD, so their muscles work isometrically
    anticipation(ob) {
      switch (ob.type) {
        case 'gap': return POSES.crouchHold;
        case 'laser': return POSES.halfCrouchHold;
        case 'crate': return POSES.pushReadyHold;
        case 'drop': return POSES.stepOffHold;
        case 'zipline': return ob.stage === 0 ? POSES.reachPrepHold : POSES.holdHang;
        case 'door': return POSES.doorReachJam; // drawn neutral white during the freeze
      }
      return POSES.stand;
    }

    buildOptions(st) {
      if (st.options) return shuffle(st.options.slice());
      if (st.kind === 'contraction') return shuffle(['Concentric', 'Eccentric', 'Isometric']);
      const d = shuffle(st.distractors.slice()).slice(0, 2);
      return shuffle([st.correct, st.sagittalWrong].concat(d));
    }

    // o.options: reuse this option set (re-ask keeps the same distractors)
    // o.reask: true when the question is asked again after a partial hit
    enterDecide(ob, o) {
      o = o || {};
      const st = ob.data.stages[ob.stage];
      const options = o.options ? shuffle(o.options.slice()) : this.buildOptions(st);
      // Snapshot for rewindToDecision(): everything needed to re-ask from here.
      const obState = {};
      for (const k in ob) { const v = ob[k]; if (v == null || typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') obState[k] = v; }
      const pl = this.pl;
      this.snap = {
        ob, obState, options: options.slice(), cur: this.cur, scrollX: this.scrollX, phase: this.phase,
        speed: this.speed, decisionTime: this.decisionTime,
        pl: { x: pl.x, y: pl.y, mode: pl.mode, vy: pl.vy, pose: clonePose(pl.pose) },
      };
      // friends never act out the questioned movement during a freeze
      for (const f of this.friends) if (f.mode === 'jump') { f.mode = 'run'; f.y = 0; f.lx += 40; }
      this.mode = 'decide';
      this.decision = { ob, st, timer: this.decisionTime, total: this.decisionTime, options, pose: this.anticipation(ob), beat: 0, lastSec: Math.ceil(this.decisionTime), reask: !!o.reask };
      this.game.ui.showDecision({
        title: ob.data.title,
        prompt: st.prompt,
        kind: st.kind,
        options,
        stage: ob.stage,
        stages: ob.data.stages.length,
        reask: !!o.reask,
        side: ob.type === 'door' ? 'right' : null,
      });
      Audio.slow();
    }

    choose(i) {
      if (this.mode !== 'decide' || !this.decision) return;
      const opt = this.decision.options[i];
      if (opt) this.resolve(opt);
    }

    // Fatal per the GAME_DESIGN §2b outcome table. A `fatal` flag in
    // content.js wins; otherwise: falling into a pit (gap, trolley step 1)
    // or being crushed (crate, door) is fatal, everything else is partial.
    isFatal(ob, result, txt) {
      if (result === 'plane') return false;
      if (txt && txt.fatal != null) return !!txt.fatal;
      if (ob.type === 'door' || ob.type === 'gap' || ob.type === 'crate') return true;
      if (ob.type === 'zipline' && ob.stage === 0) return true;
      return false;
    }

    resolve(choice) {
      if (this.mode !== 'decide') return;
      const { ob, st, reask } = this.decision;
      this.lastTimerFrac = Math.max(0, this.decision.timer / this.decision.total);
      this.game.ui.hideDecision();
      this.stats.decisions++;
      if (!reask) this.stats.firstTries++;
      let result;
      if (choice == null) result = 'timeout';
      else if (choice === st.correct) result = 'correct';
      else if (st.kind === 'movement' && C.planeOf(choice) !== 'sagittal') result = 'plane';
      else result = 'wrong';
      this.stats.log.push({ obstacle: ob.type, stage: ob.stage, kind: st.kind, choice: choice || '(timeout)', correct: st.correct, result, reask });
      this.decision = null;
      if (result === 'correct') {
        this.stats.correct++;
        if (!reask) this.stats.firstTryCorrect++;
        this.stats.streak++;
        this.stats.best = Math.max(this.stats.best, this.stats.streak);
        Audio.good();
        this.game.ui.toast(st, this.plane());
        this.startAct(this.successAct(ob, st));
        return;
      }
      this.stats.streak = 0;
      if (result === 'timeout') this.stats.timeout++;
      else if (result === 'plane') this.stats.plane++;
      else if (st.kind === 'contraction') this.stats.contraction++;
      else this.stats.wrongSagittal++;

      if (result === 'plane') {
        this.failInfo = Object.assign({ choice, correct: st.correct, st, kind: 'plane', fatal: false }, C.planeFailText(choice, st.limb));
        this.startAct(this.actPlaneFail(ob, st));
      } else {
        const txt = result === 'timeout' ? st.timeout : st.fail[choice];
        // `as` = which failure animation to reuse (e.g. Isotonic plays as Concentric)
        const asChoice = (txt && txt.as) || (result === 'timeout' ? st.sagittalWrong : choice);
        this.failInfo = { headline: txt.headline, explain: txt.explain, choice: choice || 'No answer (time ran out)', correct: st.correct, st, kind: result, fatal: this.isFatal(ob, result, txt), shownAs: choice && txt.as ? txt.as : null };
        this.startAct(this.failAct(ob, st, asChoice, result === 'timeout'));
      }
    }

    plane() { return C.PLANES.sagittal; }

    // Muscles drawn neutral white + monitor "SENSORS JAMMED": during a
    // contraction question, while blending into one (the anticipation pose
    // must not show its contraction colour early), on the trolley ride, and
    // in acts that keep the sensors jammed (door timeout, shutdown).
    jammed() {
      if (this.neutralAct) return true;
      const ob = this.obs && this.obs[this.cur];
      if (this.mode === 'decide') return !!(this.decision && this.decision.st.kind === 'contraction');
      if (this.mode === 'ride') return !!(ob && ob.stage === 1);
      if (this.mode === 'run' && ob && this.blend > 0.02) { const st = ob.data.stages[ob.stage]; return !!(st && st.kind === 'contraction'); }
      return false;
    }

    startAct(act) {
      this.mode = 'act';
      this.act = act;
      this.actT = 0;
      if (act.scroll0 != null) this.scrollMul = act.scroll0;
    }

    // End of a failure script. A partial hit that emptied the energy bar
    // plays the shutdown first; the card comes after it.
    fail() {
      if (this.mode === 'failed') return;
      const info = this.failInfo;
      if (info && !info.fatal && !info.shutdown && this.energy <= 0) {
        info.shutdown = true;
        this.stats.shutdowns++;
        this.startAct(this.actShutdown());
        return;
      }
      this.mode = 'failed';
      this.act = null;
      Audio.fail();
      if (info) info.energy = this.energy;
      this.game.ui.showFail(info, this.stats);
    }

    // Fail-card button (R / Enter): fatal or shutdown -> checkpoint, partial -> re-ask.
    retry() {
      if (this.mode !== 'failed') return;
      const info = this.failInfo || {};
      if (info.shutdown) { this.energy = MAX_ENERGY; this.reboot(); }
      else if (info.fatal || !this.snap) this.reboot();
      else this.startRewind();
    }

    reboot() {
      this.stats.reboots++;
      this.restartAt(this.cur);
    }

    loseEnergy() {
      this.energy = Math.max(0, this.energy - 1);
      this.stats.partials++;
    }

    gainEnergy() {
      const c = this.jointPos('chest');
      if (this.energy >= MAX_ENERGY) {
        this.floaters.push({ x: c[0], y: c[1] - 90, t: 0, text: 'ENERGY FULL', color: '170,200,215', subtle: true });
        return;
      }
      this.energy += 1;
      this.fx.energyGain(c[0], c[1] - 20);
      Audio.energyUp();
      this.floaters.push({ x: c[0], y: c[1] - 90, t: 0, text: '+1 ENERGY', color: '77,255,160' });
    }

    // Non-fatal hit on one body part: partial explosion there, the part stays
    // damaged until a checkpoint reboot, and one energy cell is lost.
    // Returns false if this hit took the LAST cell: then there is no
    // explosion at all and the shutdown (power-down) starts right away (§2b).
    partialHit(parts, at, power) {
      const pl = this.pl;
      if (this.energy <= 1) {
        parts.forEach((p) => { this.damage[p] = 1; });
        this.loseEnergy();
        if (this.failInfo) this.failInfo.shutdown = true;
        this.stats.shutdowns++;
        this.startAct(this.actShutdown());
        return false;
      }
      const pt = Android.partPoint(pl.pose, pl.x, pl.y, at);
      this.fx.partialExplosion(pt[0], pt[1], power || 0.5, { dir: -1 });
      Audio.pop();
      parts.forEach((p) => { this.damage[p] = 1; });
      this.loseEnergy();
      return true;
    }

    // ---- rewind: 0.5 s VHS rewind, then the same question again ----
    startRewind() {
      this.mode = 'rewind';
      this.act = null;
      this.rewT = 0;
      this.rewFrom = this.scrollX;
      this.rewGlitch = this.fx.glitch;
      this.rewSys = this.sysFail;
      this.pl.mode = 'fixed';
      this.pl.onLand = null; this.pl.onFall = null;
      Audio.whoosh();
    }

    updateRewind(dt) {
      this.rewT += dt;
      const k = ease(this.rewT / 0.5);
      this.scrollX = lerp(this.rewFrom, this.snap.scrollX, k);
      this.fx.glitch = lerp(this.rewGlitch, 0, k);
      this.sysFail = lerp(this.rewSys, 0, k);
      const ob = this.snap.ob;
      if (ob.type === 'door' && ob.override) ob.doorY = lerp(ob.doorY, this.snap.obState.doorY, k);
      if (this.rewT >= 0.5) this.rewindToDecision();
    }

    rewindToDecision() {
      const s = this.snap;
      if (!s) { this.reboot(); return; }
      const ob = s.ob, pl = this.pl;
      this.cur = s.cur;
      this.scrollX = s.scrollX;
      this.phase = s.phase;
      this.speed = s.speed;
      this.decisionTime = s.decisionTime;
      Object.assign(ob, s.obState);
      pl.x = s.pl.x; pl.y = s.pl.y; pl.mode = s.pl.mode; pl.vy = s.pl.vy;
      pl.pose = clonePose(s.pl.pose);
      pl.visible = true; pl.status = 'ok'; pl.onLand = null; pl.onFall = null; pl.g = null;
      this.act = null;
      this.scrollMul = 1;
      this.ts = 0.03; this.blend = 1;
      this.sysFail = 0; this.powerFail = 0; this.neutralAct = false;
      this.fx.crack = null; this.fx.glitch = 0; this.fx.flash = 0; this.fx.shake = 0;
      this.doorFriends = [];
      this.android.reset();
      this.enterDecide(ob, { reask: true, options: s.options });
    }

    // ---------------- main update ----------------
    update(dt) {
      this.time += dt;
      const pl = this.pl;
      const before = this.scrollX;

      if (this.mode === 'attract') {
        this.scrollX += 260 * dt;
        pl.pose = runPose(this.phase, 10);
        pl.mode = 'ground';
      } else if (this.mode === 'run' || this.mode === 'ride') {
        this.updateTravel(dt);
      } else if (this.mode === 'decide') {
        const d = this.decision;
        d.timer -= dt;
        this.ts = 0.02;
        this.blend = 1;
        const k = 1 - d.timer / d.total;
        // tremble: muscles under tension while frozen
        const trem = (0.6 + 2.2 * k) * (d.ob.type === 'door' ? 0.5 : 1);
        const keys = d.ob.type === 'door' ? ['shN', 'elN', 'shF', 'elF', 'hipN', 'kneeN']
          : d.st.limb === 'legs' ? ['hipN', 'kneeN', 'ankleN', 'hipF', 'kneeF'] : ['shN', 'elN', 'shF', 'elF'];
        const p = jitterPose(d.pose, trem, keys);
        p.mus = d.pose.mus;
        pl.pose = p;
        if (pl.mode !== 'hang') pl.mode = 'ground';
        // heartbeat accelerates as time runs out
        d.beat -= dt;
        if (d.beat <= 0) { Audio.heartbeat(); d.beat = lerp(0.95, 0.32, k); }
        const sec = Math.ceil(d.timer);
        if (sec < d.lastSec) { d.lastSec = sec; Audio.tick(); }
        this.game.ui.setTimer(Math.max(0, d.timer / d.total), Math.max(0, d.timer));
        if (d.timer <= 0) this.resolve(null);
      } else if (this.mode === 'act') {
        this.actT += dt;
        this.act.update(this.actT, dt);
        this.scrollX += this.speed * this.scrollMul * dt;
      } else if (this.mode === 'rewind') {
        this.updateRewind(dt);
      } else if (this.mode === 'won') {
        this.winT += dt;
        this.scrollX += this.speed * dt;
        pl.pose = runPose(this.phase);
      }
      this.emitDamageSmoke();

      this.phase += ((this.scrollX - before) / CYCLE) * TAU;
      this.updatePhysics(dt);
      this.updateWorld(dt);
      if (this.mode !== 'decide') this.android.update(pl.pose, dt);
      else this.android.update(pl.pose, dt * 0.5);
    }

    updateTravel(dt) {
      const pl = this.pl;
      const ob = this.obs[this.cur];
      let ts = 1, blend = 0;
      if (ob && ob.stage < ob.triggers.length) {
        const trig = ob.triggers[ob.stage];
        const d = trig - this.scrollX;
        const L = this.speed * 0.95;
        if (d < L) { const f = clamp(d / L, 0, 1); ts = 0.03 + 0.97 * ease(f); blend = 1 - ease(f); }
        const move = this.speed * ts * dt;
        if (this.scrollX + move >= trig) { this.scrollX = trig; this.ts = ts; this.blend = 1; this.enterDecide(ob); }
        else this.scrollX += move;
      } else {
        this.scrollX += this.speed * dt;
        if (ob && this.mode === 'ride' && this.scrollX >= ob.dismount) this.startAct(this.actDismount(ob));
        if (!ob && this.scrollX >= this.exitX - 30 && this.mode === 'run') this.win();
      }
      if (this.mode === 'decide' || this.mode === 'act') return;
      this.ts = ts; this.blend = blend;
      const ant = ob && blend > 0 ? this.anticipation(ob) : null;
      if (this.mode === 'run') {
        let p = runPose(this.phase);
        if (this.damage.legN) p.kneeN += 4 * Math.sin(this.phase * 0.5); // limp on a damaged knee
        if (ant) p = lerpPose(p, ant, blend);
        pl.pose = p;
        pl.mode = 'ground';
      } else {
        let p = clonePose(POSES.hold);
        p.hipN += 10 * Math.sin(this.time * 2.2); p.hipF += 10 * Math.sin(this.time * 2.2 + 0.6);
        p.kneeN += 8 * Math.sin(this.time * 2.2 + 1);
        p.mus = { biceps_brachii: ['i', 0.6], brachialis: ['i', 0.6], latissimus_dorsi: ['i', 0.3] };
        if (ant) { const m = p.mus; p = lerpPose(p, ant, blend); p.mus = m; }
        pl.pose = p;
        pl.mode = 'hang';
      }
    }

    updatePhysics(dt) {
      const pl = this.pl;
      const wx = this.scrollX + (pl.x - PX);
      if (pl.mode === 'ground') {
        const g = this.groundAt(wx);
        if (g == null) { pl.mode = 'air'; pl.vy = 0; }
        else pl.y = g - Android.lowestRel(pl.pose);
      } else if (pl.mode === 'air') {
        pl.vy += (pl.g || G) * dt;
        pl.y += pl.vy * dt;
        const g = this.groundAt(wx);
        const low = Android.lowestRel(pl.pose);
        if (pl.vy > 0 && g != null && pl.y + low >= g && pl.y + low - pl.vy * dt <= g + 30) {
          pl.y = g - low;
          pl.mode = 'ground';
          const cb = pl.onLand; pl.onLand = null;
          if (cb) cb(); else Audio.thud();
        }
        if (pl.y > H + 260 && pl.onFall) { const cb = pl.onFall; pl.onFall = null; cb(); }
      } else if (pl.mode === 'hang') {
        const ob = this.obs[this.cur];
        if (ob && ob.type === 'zipline') {
          const hr = Android.handRel(pl.pose);
          pl.x = this.sx(ob.trolleyX) - hr[0];
          pl.y = ob.railY + this.handleDrop - hr[1];
        }
      }
    }

    updateWorld(dt) {
      // obstacle state (crate flight, trolley)
      for (let k = Math.max(0, this.cur - 1); k < Math.min(this.obs.length, this.cur + 2); k++) {
        const ob = this.obs[k];
        if (ob.type === 'crate' && ob.flying) {
          ob.cx += ob.vx * dt; ob.cy -= ob.vy * dt; ob.vy -= G * dt; ob.ang += ob.va * dt;
          if (ob.cy < -400 || this.sx(ob.cx) > W + 300) { ob.flying = false; ob.gone = true; }
        }
        if (ob.type === 'zipline') {
          if (ob.attached) ob.trolleyX = this.scrollX + ob.K;
          else if (ob.free) { ob.trolleyX = Math.min(ob.railB - 40, ob.trolleyX + this.speed * dt); }
        }
      }
      // pit embers
      if (this.mode !== 'attract' && Math.random() < 0.5) {
        const ob = this.obs[this.cur];
        if (ob && (ob.type === 'gap' || ob.type === 'zipline')) {
          const a = this.sx(ob.x);
          if (a < W && a + ob.w > 0) this.fx.embers(a, H - 10, ob.w);
        }
      }
      const dob = this.obs[this.cur];
      if (dob && dob.type === 'door' && this.mode !== 'attract') this.updateDoor(dob, dt);
      this.updateDoorFriends(dt);
      this.fx.update(dt);
      this.updateFriends(dt);
    }

    // Smoke and the odd spark from damaged parts until the next reboot.
    emitDamageSmoke() {
      const pl = this.pl;
      if (!pl.visible || this.mode === 'attract') return;
      const at = { head: 'head', torso: 'chest', armN: 'elbowN', armF: 'elbowF', legN: 'kneeN', legF: 'ankleF' };
      const rate = this.mode === 'decide' ? 0.25 : 0.8;
      for (const part in this.damage) {
        if (!this.damage[part] || !at[part]) continue;
        const p = Android.partPoint(pl.pose, pl.x, pl.y, at[part]);
        this.fx.smokeTrail(p[0], p[1], { rate: part.endsWith('F') ? rate * 0.5 : rate, spark: this.fx.reduce ? 0.4 : 1 });
      }
    }

    // ---- BLAST DOOR ----
    // Before the freeze the door height is driven by SCROLL, not time, so
    // slow motion keeps the door and the android in sync and the door
    // touches the fists exactly at the freeze. Acts set ob.override and
    // drive ob.doorY themselves. The door never sinks below the hands or
    // the head while they are under it (unless an act is crushing).
    updateDoor(ob, dt) {
      if (ob.override || ob.slammed) return;
      const trig = ob.triggers[0];
      const k = clamp((this.scrollX - (trig - 900)) / 900, 0, 1);
      if (k > 0 && !ob.alarm) { ob.alarm = true; Audio.hiss(); }
      let y = lerp(ob.openY, ob.handY, ease(k));
      const pl = this.pl;
      const d = this.decision;
      if (this.mode === 'decide' && d && d.ob === ob) {
        // creeps 1-2 px onto the palms and grinds sparks off them
        const prog = 1 - d.timer / d.total;
        y = ob.handY + 2 * prog;
        if (Math.random() < 0.35) {
          for (const h of ['handN', 'handF']) { const p = Android.partPoint(POSES.doorReach, pl.x, pl.y, h); this.fx.doorStrain(p[0], y); }
        }
      } else {
        const a = this.sx(ob.x) - 6, b = this.sx(ob.x + ob.w) + 6;
        const hand = Android.handRel(pl.pose);
        if (pl.x + hand[0] > a && pl.x + hand[0] < b) y = Math.min(y, pl.y + Android.handTopRel(pl.pose));
        const head = Android.partPoint(pl.pose, pl.x, pl.y, 'head');
        if (head[0] > a - 12 && head[0] < b + 12) y = Math.min(y, pl.y + Android.headTopRel(pl.pose) - 2);
      }
      ob.doorY = y;
    }

    // Door y the act should use so it rests on the fists of `pose` (flat floor).
    doorRest(pose) {
      const low = Android.lowestRel(pose);
      return Math.min(GY - low + Android.handTopRel(pose), GY - low + Android.headTopRel(pose) - 2);
    }

    // Gravity slam of the door to the floor; returns true on the frame it lands.
    doorFall(ob, dt, g) {
      if (ob.slammed) return false;
      ob.vy += (g || 3200) * dt;
      ob.doorY += ob.vy * dt;
      if (ob.doorY >= GY) {
        ob.doorY = GY; ob.slammed = true; ob.vy = 0;
        this.fx.doorSlam(this.sx(ob.x + ob.w / 2), GY, ob.w);
        Audio.slam();
        return true;
      }
      return false;
    }

    // Friends who escape under the held door: main floor, behind the player.
    spawnDoorFriends(n) {
      const visors = ['#ffb347', '#7dff9a', '#ff7ad9', '#b48cff', '#ffe066'];
      this.doorFriends = [];
      for (let i = 0; i < n; i++) {
        this.doorFriends.push({
          a: new Android(), x: -70 - i * 210 - rand(0, 40), ph: rand(0, TAU), v: rand(760, 820), saved: false, k: i,
          visor: visors[i % visors.length], unit: this.nextUnit(), pose: runPose(0, 18), y: 0,
        });
      }
    }

    // Door friends run on the BACK CATWALK (lane line, LANE_SCALE) in screen
    // space, so they read as passing behind the player and under the door,
    // which spans both levels. Over a catwalk gap they hop it.
    updateDoorFriends(dt) {
      if (!this.doorFriends.length) return;
      const ob = this.obs[this.cur];
      const doorEnd = ob && ob.type === 'door' ? this.sx(ob.x + ob.w) : -Infinity;
      for (let i = this.doorFriends.length - 1; i >= 0; i--) {
        const f = this.doorFriends[i];
        f.x += f.v * dt;
        f.ph += ((f.v * dt) / (CYCLE * LANE_SCALE)) * TAU;
        const lx = this.scrollX * LANE_P + (f.x - PX);
        const gx = this.laneGapAt(lx);
        if (gx != null) {
          const s = (lx - gx) / LANE_GAP_W;
          f.y = -55 * Math.sin(Math.PI * clamp(s, 0, 1));
          f.pose = clonePose(POSES.tuck);
        } else { f.y = 0; f.pose = runPose(f.ph, 18); }
        if (!f.saved && f.x > doorEnd + 10) {
          f.saved = true;
          this.stats.friendsSaved++;
          this.addFloater({ x: f.x + 30, y: LANE_Y - 205, t: 0, text: f.unit + ' SAFE', color: '77,255,160' }, 'safe');
        }
        f.a.update(f.pose, dt);
        if (f.x > W + 200) this.doorFriends.splice(i, 1);
      }
    }

    // ======================================================================
    // FRIEND ANDROIDS: fellow escapees on a back catwalk. They overtake you
    // (or get overtaken) and jump the catwalk gaps. A failing friend only
    // STUMBLES: it trips at a gap edge (never falls in) or on the flat, its
    // light turns red, "UNIT-xx DOWN" floats up and it kneels. No explosion,
    // ever. They live in the same slowed time as the player and never act
    // out the questioned movement during a freeze (see enterDecide).
    // ======================================================================
    worldTimeScale() {
      if (this.mode === 'decide') return 0.02;
      if (this.mode === 'run' || this.mode === 'ride') return this.ts;
      if (this.mode === 'failed') return 0.35;
      return 1;
    }
    laneSX(lx) { return PX + (lx - this.scrollX * LANE_P); }
    laneGapAt(lx) {
      const k = Math.floor(lx / LANE_GAP_EVERY);
      const gx = k * LANE_GAP_EVERY + 500 + hash(k + 99) * 400;
      return lx >= gx && lx <= gx + LANE_GAP_W ? gx : null;
    }
    nextLaneGap(lx) {
      for (let k = Math.floor(lx / LANE_GAP_EVERY); k < Math.floor(lx / LANE_GAP_EVERY) + 2; k++) {
        const gx = k * LANE_GAP_EVERY + 500 + hash(k + 99) * 400;
        if (gx > lx) return gx;
      }
      return Infinity;
    }

    spawnFriend() {
      const fromLeft = Math.random() < 0.75;
      const base = this.speed * LANE_P;
      const lx = this.scrollX * LANE_P + (fromLeft ? -PX - 120 : W - PX + 120);
      if (this.laneGapAt(lx) != null) return;
      const visors = ['#ffb347', '#7dff9a', '#ff7ad9', '#b48cff', '#ffe066'];
      this.friends.push({
        a: new Android(), lx, v: fromLeft ? base + rand(80, 190) : base - rand(70, 130),
        ph: Math.random() * TAU, mode: 'run', t: 0, y: 0,
        visor: visors[Math.floor(Math.random() * visors.length)],
        unit: this.nextUnit(),
        skill: rand(0.55, 0.9), status: 'ok', pose: runPose(0),
      });
    }

    // Unit IDs are unique per run: one shuffled pool shared by lane friends
    // and door friends (refilled only if a very long run exhausts it).
    nextUnit() {
      if (!this.unitPool.length) { for (let i = 2; i <= 98; i++) this.unitPool.push(i); shuffle(this.unitPool); }
      return 'UNIT-' + String(this.unitPool.pop()).padStart(2, '0');
    }

    // Floaters queue up: each one starts at least 0.45 s after the previous
    // one with the same tag, and alternates between three heights.
    addFloater(f, tag) {
      const q = (this.floatQ = this.floatQ || {});
      const slot = q[tag] || { at: -1, n: 0 };
      const delay = Math.max(0, slot.at + 0.45 - this.time);
      slot.at = this.time + delay; slot.n++;
      q[tag] = slot;
      f.t = -delay;
      f.y -= ((slot.n - 1) % 3) * 22;
      this.floaters.push(f);
    }

    // Start a stumble: trip, red light, floater, then kneel and stay put.
    friendDown(r) {
      r.mode = 'trip'; r.t = 0; r.status = 'fail'; r.from = clonePose(r.pose);
      const x = this.laneSX(r.lx);
      if (x > -40 && x < W + 40) {
        Audio.stumble();
        this.addFloater({ x, y: LANE_Y - 150 * LANE_SCALE, t: 0, text: r.unit + ' DOWN', color: '255,90,90' }, 'down');
        this.bgfx.dust(x, LANE_Y, 5);
      }
    }

    updateFriends(dt) {
      const wdt = dt * this.worldTimeScale();
      this.bgfx.update(wdt);
      for (let i = this.floaters.length - 1; i >= 0; i--) { const f = this.floaters[i]; f.t += dt; if (f.t > 0) f.y -= 18 * dt; if (f.t > 2.2) this.floaters.splice(i, 1); }
      if (this.mode !== 'decide' && this.mode !== 'won') {
        this.friendT -= wdt;
        if (this.friendT <= 0 && this.friends.length < 3) { this.spawnFriend(); this.friendT = rand(4, 9); }
      }
      const k = LANE_SCALE;
      // no stumbles during a freeze, or around the blast door (question, hold, duck-out)
      const cob = this.obs && this.obs[this.cur];
      const noStumble = this.mode === 'decide' || this.doorFriends.length > 0 ||
        (cob && cob.type === 'door' && (this.mode === 'act' || this.blend > 0));
      for (let i = this.friends.length - 1; i >= 0; i--) {
        const r = this.friends[i];
        r.t += wdt;
        if (r.mode === 'run') {
          r.lx += r.v * wdt;
          r.ph += ((r.v * wdt) / (CYCLE * k)) * TAU;
          r.pose = runPose(r.ph);
          r.y = 0;
          const g = this.nextLaneGap(r.lx);
          if (g - r.lx < 40) {
            if (noStumble || Math.random() < r.skill) { r.mode = 'jump'; r.t = 0; r.T = (LANE_GAP_W + 90) / r.v; }
            else { r.lx = Math.min(r.lx, g - 26); this.friendDown(r); } // trips at the edge, never falls in
          } else if (!noStumble && Math.random() < 0.0004 * wdt * 60) this.friendDown(r);
        } else if (r.mode === 'jump') {
          r.lx += r.v * wdt;
          const s = Math.min(1, r.t / r.T);
          r.y = -95 * 4 * s * (1 - s);
          r.pose = s < 0.15 ? lerpPose(POSES.crouch, POSES.extend, s / 0.15) : s < 0.6 ? lerpPose(POSES.extend, POSES.tuck, (s - 0.15) / 0.45) : lerpPose(POSES.tuck, POSES.landPrep, (s - 0.6) / 0.4);
          r.pose.mus = null;
          if (s >= 1) { r.mode = 'run'; r.y = 0; }
        } else if (r.mode === 'trip') {
          // stumble forward a little, then sink to its knees
          r.lx += r.v * 0.25 * Math.max(0, 1 - r.t / 0.35) * wdt;
          const kk = ease(r.t / 0.7);
          r.pose = lerpPose(r.from, POSES.friendKneel, kk);
          if (r.t < 0.35) r.pose = jitterPose(r.pose, 6 * (1 - r.t / 0.35));
          if (r.t >= 0.7) { r.mode = 'down'; r.pose = clonePose(POSES.friendKneel); }
        }
        // 'down': stays kneeling where it fell; the world scrolls it away
        const sx = this.laneSX(r.lx);
        if (sx < -400 || sx > W + 400) { this.friends.splice(i, 1); continue; }
        r.a.update(r.pose, wdt);
      }
    }

    drawFriendLane(ctx) {
      const k = LANE_SCALE;
      // catwalk with gaps
      const step = 8;
      ctx.fillStyle = '#1d2a37';
      ctx.strokeStyle = '#3e5266';
      ctx.lineWidth = 2;
      let runA = null;
      const flush = (a, b) => {
        ctx.fillStyle = '#1d2a37'; ctx.fillRect(a, LANE_Y, b - a, 12);
        ctx.fillStyle = '#2f4155'; ctx.fillRect(a, LANE_Y, b - a, 3);
        ctx.strokeStyle = '#2a3a4b';
        ctx.beginPath(); ctx.moveTo(a, LANE_Y - 34); ctx.lineTo(b, LANE_Y - 34); ctx.stroke();
        for (let x = a - (a % 40); x < b; x += 40) { if (x < a) continue; ctx.beginPath(); ctx.moveTo(x, LANE_Y); ctx.lineTo(x, LANE_Y - 34); ctx.stroke(); }
      };
      for (let x = -20; x <= W + 20; x += step) {
        const lx = this.scrollX * LANE_P + (x - PX);
        const gap = this.laneGapAt(lx) != null;
        if (!gap && runA == null) runA = x;
        if (gap && runA != null) { flush(runA, x); runA = null; }
      }
      if (runA != null) flush(runA, W + 20);
      // friends (small, behind the main floor)
      for (const r of this.friends) {
        const sx = this.laneSX(r.lx);
        ctx.save();
        ctx.translate(sx, LANE_Y + r.y);
        ctx.scale(k, k);
        const low = Android.lowestRel(r.pose);
        r.a.draw(ctx, r.pose, 0, -low, { status: r.status, visor: r.visor, reduce: true, neutral: this.mode === 'decide', skin: SEHS.Sprites ? SEHS.Sprites.get('sagittal') : null });
        ctx.restore();
      }
      // door friends escaping under the held blast door (screen-space x)
      for (const f of this.doorFriends) {
        ctx.save();
        ctx.translate(f.x, LANE_Y + f.y);
        ctx.scale(k, k);
        f.a.draw(ctx, f.pose, 0, -Android.lowestRel(f.pose), { status: 'ok', visor: f.visor, reduce: true, skin: SEHS.Sprites ? SEHS.Sprites.get('sagittal') : null });
        ctx.restore();
      }
      this.bgfx.drawWorld(ctx);
      // depth haze over the whole back lane
      const hz = ctx.createLinearGradient(0, LANE_Y - 200, 0, LANE_Y + 40);
      hz.addColorStop(0, 'rgba(12,20,30,0)');
      hz.addColorStop(0.4, 'rgba(12,20,30,0.38)');
      hz.addColorStop(1, 'rgba(12,20,30,0.5)');
      ctx.fillStyle = hz;
      ctx.fillRect(-200, LANE_Y - 200, W + 400, 240);
    }

    drawFloaters(ctx) {
      if (!this.floaters.length) return;
      ctx.save();
      ctx.font = '700 13px ui-monospace, monospace';
      ctx.textAlign = 'center';
      for (const f of this.floaters) {
        if (f.t < 0) continue; // queued
        const a = Math.max(0, 1 - f.t / 2.2) * (f.subtle ? 0.6 : 1);
        ctx.font = f.subtle ? '600 11px ui-monospace, monospace' : '700 13px ui-monospace, monospace';
        ctx.fillStyle = `rgba(0,0,0,${0.5 * a})`;
        ctx.fillText(f.text, f.x + 1, f.y + 1);
        ctx.fillStyle = `rgba(${f.color || '255,90,90'},${a})`;
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.restore();
    }

    win() {
      this.mode = 'won';
      this.winT = 0;
      this.stats.energyLeft = this.energy;
      Audio.win();
      this.fx.doFlash(0.6, '220,255,230');
      setTimeout(() => this.game.ui.showWin(this.stats), 1400);
    }

    // ======================================================================
    // OUTCOME SCRIPTS
    // ======================================================================
    successAct(ob, st) {
      switch (ob.type) {
        case 'gap': return this.actJump(ob);
        case 'laser': return this.actSlide(ob);
        case 'crate': return this.actPush(ob);
        case 'drop': return this.actSoftLanding(ob);
        case 'zipline': return ob.stage === 0 ? this.actGrab(ob) : this.actHold(ob);
        case 'door': return this.actDoorHold(ob, this.lastTimerFrac);
      }
    }

    failAct(ob, st, choice, timeout) {
      switch (ob.type) {
        case 'gap': return this.actTuckRoll(ob);
        case 'laser': return this.actStandIntoLaser(ob, timeout);
        case 'crate': return this.actCrateCrush(ob, timeout);
        case 'drop': return choice === 'Concentric' ? this.actLockedKnees(ob) : this.actRigidLanding(ob);
        case 'zipline':
          if (ob.stage === 0) return this.actMissRail(ob, timeout);
          return choice === 'Concentric' ? this.actPullIntoRail(ob) : this.actLowerIntoGrinder(ob);
        case 'door':
          if (timeout) return this.actDoorGive(ob, true);
          return choice === 'Concentric' ? this.actDoorShove(ob) : this.actDoorGive(ob, false);
      }
    }

    // ---- shared helpers ----
    toRun(from, s, dur) {
      const p = lerpPose(from, runPose(this.phase), ease(s / dur));
      return p;
    }
    explodeBelow(x) {
      this.fx.explosion(x, H + 20, 2.2, { fromBelow: true });
      Audio.boom();
    }
    jointPos(name) {
      return this.android.joints(this.pl.pose, this.pl.x, this.pl.y)[name];
    }

    // ---- GAP: success = extension jump ----
    actJump(ob) {
      const self = this, pl = this.pl, start = clonePose(pl.pose);
      const PUSH = { gluteus_maximus: ['c', 1], quadriceps: ['c', 1], gastrocnemius: ['c', 1], soleus: ['c', 0.9], deltoid_anterior: ['c', 0.7] };
      const LAND = { quadriceps: ['e', 1], gluteus_maximus: ['e', 0.8], soleus: ['e', 0.6], gastrocnemius: ['e', 0.6] };
      let phase = 0, tAir = 0, Tf = 1, tLand = 0;
      Audio.whoosh();
      return {
        scroll0: 0.4,
        update(t) {
          if (phase === 0) {
            self.scrollMul = 0.4 + 0.6 * ease(t / 0.14);
            pl.pose = withMus(lerpPose(start, POSES.extend, ease(t / 0.14)), PUSH);
            pl.mode = 'ground';
            if (t >= 0.14) {
              phase = 1; tAir = t;
              const land = ob.x + ob.w + 70;
              Tf = Math.max(0.55, (land - self.scrollX) / self.speed);
              self.scrollMul = 1;
              pl.mode = 'air';
              pl.g = 1250; pl.vy = -0.5 * pl.g * Tf;
              const j = self.jointPos('toe');
              self.fx.dust(j[0], j[1], 6);
              pl.onLand = () => { phase = 2; tLand = self.actT; pl.g = null; Audio.thud(); const f = self.jointPos('toe'); self.fx.dust(f[0], f[1], 8); };
            }
          } else if (phase === 1) {
            const s = (t - tAir) / Tf;
            pl.pose = s < 0.45 ? lerpPose(POSES.extend, POSES.tuck, ease(s / 0.45)) : lerpPose(POSES.tuck, POSES.landPrep, ease((s - 0.45) / 0.45));
          } else {
            const s = t - tLand;
            if (s < 0.2) pl.pose = withMus(lerpPose(POSES.landPrep, POSES.absorb, ease(s / 0.2)), LAND);
            else {
              pl.pose = self.toRun(POSES.absorb, s - 0.2, 0.3);
              if (s < 0.4) pl.pose.mus = { quadriceps: ['c', 0.8], gluteus_maximus: ['c', 0.8] };
              if (s > 0.5) self.stageDone(ob);
            }
          }
        },
      };
    }

    // ---- GAP: wrong (flexion) = tuck tighter, roll into pit ----
    actTuckRoll(ob) {
      const self = this, pl = this.pl, start = clonePose(pl.pose);
      const MUS = { iliopsoas: ['c', 1], hamstrings: ['c', 1], biceps_brachii: ['c', 0.6], tibialis_anterior: ['c', 0.7] };
      let vx = 0, vy = 0, boom = 0;
      return {
        scroll0: 0,
        update(t, dt) {
          self.scrollMul = 0;
          if (t < 0.35) {
            pl.pose = withMus(lerpPose(start, POSES.superTuck, ease(t / 0.35)), MUS);
            pl.mode = 'ground';
            pl.status = 'warn';
            return;
          }
          if (pl.mode !== 'fixed') { pl.mode = 'fixed'; vx = 150; vy = 0; Audio.servo && Audio.servo(); }
          const p = clonePose(pl.pose);
          p.rot += 420 * dt;
          p.mus = MUS;
          pl.pose = p;
          pl.x += vx * dt;
          const edge = self.sx(ob.x);
          if (pl.x > edge + 18) { vy += G * dt; pl.y += vy * dt; vx = Math.max(60, vx - 40 * dt); }
          if (!boom && pl.y > H + 140) { boom = t; pl.visible = false; self.explodeBelow(pl.x + 10); pl.status = 'fail'; }
          if (boom && t - boom > 1.4) self.fail();
        },
      };
    }

    // ---- LASER: success = flexion slide ----
    actSlide(ob) {
      const self = this, pl = this.pl, start = clonePose(pl.pose);
      const T = (ob.x + ob.w + 90 - this.scrollX) / this.speed;
      let sparkT = 0;
      Audio.whoosh();
      return {
        scroll0: 1,
        update(t, dt) {
          self.scrollMul = 1;
          pl.mode = 'ground';
          if (t < 0.18) pl.pose = withMus(lerpPose(start, POSES.slide, ease(t / 0.18)), { quadriceps: ['e', 0.9], gluteus_maximus: ['e', 0.7], iliopsoas: ['c', 0.5] });
          else if (t < T) {
            pl.pose = withMus(POSES.slide, { quadriceps: ['i', 0.4], iliopsoas: ['i', 0.4], tibialis_anterior: ['i', 0.3] });
            sparkT -= dt;
            if (sparkT <= 0) { sparkT = 0.03; const h = self.jointPos('heel'); self.fx.sparks(h[0], h[1], 2, { dir: Math.PI + 0.3, spread: 0.4, vmax: 380, g: 600 }); }
          } else {
            const s = t - T;
            pl.pose = self.toRun(POSES.slide, s, 0.3);
            pl.pose.mus = { quadriceps: ['c', 0.9], gluteus_maximus: ['c', 0.9] };
            if (s > 0.32) self.stageDone(ob);
          }
        },
      };
    }

    // ---- LASER: wrong (extension) / timeout = head into the beams ----
    // PARTIAL: only the head is hit (partial explosion at the head); the
    // android flinches down, survives, and the same question is asked again.
    actStandIntoLaser(ob, timeout) {
      const self = this, pl = this.pl, start = clonePose(pl.pose);
      let zap = 0, hit = 0, arcT = 0, done = false;
      const target = timeout ? POSES.halfCrouch : POSES.tall;
      const MUS = timeout ? { quadriceps: ['i', 0.5] } : { quadriceps: ['c', 1], gluteus_maximus: ['c', 1], gastrocnemius: ['c', 1], soleus: ['c', 0.8], deltoid_anterior: ['c', 0.7] };
      return {
        scroll0: 0.55,
        update(t, dt) {
          pl.mode = 'ground';
          if (!zap) {
            self.scrollMul = 0.55;
            pl.pose = withMus(lerpPose(start, target, ease(t / 0.25)), MUS);
            const head = self.jointPos('head');
            if (head[0] >= self.sx(ob.x) - 6 || t > 2) { zap = t; Audio.zap(); pl.status = 'fail'; self.fx.addShake(8); }
            return;
          }
          self.scrollMul = 0;
          if (!hit) {
            pl.pose = jitterPose(withMus(target, MUS), 9);
            pl.pose.mus = MUS;
            arcT -= dt;
            const head = self.jointPos('head');
            if (arcT <= 0) {
              arcT = 0.05;
              self.fx.arc(head[0] + rand(-5, 15), self.beamBottom - rand(0, 26), head[0] + rand(-10, 10), head[1] + rand(-10, 10), 0.12);
              self.fx.sparks(head[0], head[1], 5, { vmax: 400 });
            }
            if (t - zap > 0.6) { hit = t; self.partialHit(['head'], 'head', 0.55); }
            return;
          }
          // flinch down out of the beams, stunned but intact
          const k = t - hit;
          pl.pose = jitterPose(lerpPose(target, POSES.crouch, ease(k / 0.35)), 3 * Math.max(0, 1 - k));
          pl.pose.mus = { quadriceps: ['e', 0.6], gluteus_maximus: ['e', 0.5] };
          if (k > 1.3 && !done) { done = true; self.fail(); }
        },
      };
    }

    // ---- CRATE: success = elbow extension push ----
    actPush(ob) {
      const self = this, pl = this.pl, start = clonePose(pl.pose);
      let launched = false;
      const MUS = { triceps_brachii: ['c', 1], deltoid_anterior: ['c', 0.8], pectoralis_major: ['c', 0.8], gluteus_maximus: ['c', 0.6], quadriceps: ['c', 0.5], gastrocnemius: ['c', 0.5] };
      return {
        scroll0: 0,
        update(t) {
          pl.mode = 'ground';
          if (t < 0.12) { self.scrollMul = 0; pl.pose = withMus(lerpPose(start, POSES.push, ease(t / 0.12)), MUS); }
          else if (t < 0.45) {
            pl.pose = withMus(POSES.push, MUS);
            self.scrollMul = ease((t - 0.12) / 0.33);
            if (!launched) {
              launched = true;
              ob.flying = true; ob.vx = 1300; ob.vy = 260; ob.va = 7;
              const h = self.jointPos('hand');
              self.fx.sparks(h[0] + 8, h[1], 18, { dir: 0, spread: 0.8, vmax: 500 });
              self.fx.addShake(6);
              Audio.clank(); Audio.whoosh();
            }
          } else {
            self.scrollMul = 1;
            pl.pose = self.toRun(POSES.push, t - 0.45, 0.3);
            if (t > 0.78) self.stageDone(ob);
          }
        },
      };
    }

    // ---- CRATE: wrong (flexion) = pull crate onto self ----
    actCrateCrush(ob, timeout) {
      const self = this, pl = this.pl, start = clonePose(pl.pose);
      const MUS = timeout ? { triceps_brachii: ['i', 0.4] } : { biceps_brachii: ['c', 1], brachialis: ['c', 1], brachioradialis: ['c', 0.8], deltoid_posterior: ['c', 0.8], latissimus_dorsi: ['c', 0.8] };
      let boom = 0, hit = false;
      const cx0 = ob.cx;
      return {
        scroll0: 0,
        update(t) {
          self.scrollMul = 0;
          pl.mode = 'ground';
          if (t < 0.3) {
            pl.pose = withMus(lerpPose(start, timeout ? start : POSES.pull, ease(t / 0.3)), MUS);
            ob.cx = cx0 - 22 * ease(t / 0.3);
            return;
          }
          ob.pivot = true;
          ob.ang = 100 * ease((t - 0.3) / 0.5);
          if (t > 0.72 && !hit) { hit = true; self.fx.addShake(14); Audio.crunch(); pl.status = 'fail'; const c = self.jointPos('chest'); self.fx.sparks(c[0], c[1], 30); }
          if (hit && !boom) pl.pose = jitterPose(lerpPose(pl.pose, POSES.slump, 0.2), 4);
          if (t > 0.9 && !boom) { boom = t; const c = self.jointPos('chest'); self.fx.explosion(c[0], c[1], 1.3); Audio.boom(); pl.visible = false; }
          if (boom && t - boom > 1.4) self.fail();
        },
      };
    }

    // ---- DROP: success = eccentric landing ----
    actSoftLanding(ob) {
      const self = this, pl = this.pl, start = clonePose(pl.pose);
      let phase = 0, tLand = 0, tAir = 0;
      const ECC = { quadriceps: ['e', 1], gluteus_maximus: ['e', 1], soleus: ['e', 0.8], gastrocnemius: ['e', 0.8], hamstrings: ['e', 0.4] };
      return {
        scroll0: 0.9,
        update(t) {
          if (phase === 0) {
            phase = 1; tAir = t; pl.mode = 'air'; pl.vy = -230;
            pl.onLand = () => { phase = 2; tLand = self.actT; Audio.thud(); const f = self.jointPos('toe'); self.fx.dust(f[0], f[1], 10); self.fx.addShake(3); };
          }
          if (phase === 1) { self.scrollMul = 0.9; pl.pose = lerpPose(start, POSES.dropAir, ease((t - tAir) / 0.25)); }
          if (phase === 2) {
            const s = t - tLand;
            if (s < 0.34) { self.scrollMul = 0.45; pl.pose = withMus(lerpPose(POSES.dropAir, POSES.deepAbsorb, ease(s / 0.34)), ECC); }
            else {
              self.scrollMul = lerp(0.45, 1, ease((s - 0.34) / 0.35));
              pl.pose = self.toRun(POSES.deepAbsorb, s - 0.34, 0.4);
              pl.pose.mus = s < 0.6 ? { quadriceps: ['c', 0.9], gluteus_maximus: ['c', 0.9] } : null;
              if (s > 0.78) self.stageDone(ob);
            }
          }
        },
      };
    }

    // ---- DROP: wrong (concentric) = knees lock straight and buckle ----
    // PARTIAL: knee damage only (partial explosion at the knees), no chest blast.
    actLockedKnees(ob) {
      const self = this, pl = this.pl, start = clonePose(pl.pose);
      let phase = 0, tLand = 0, hit = 0, sparkT = 0, done = false;
      const CON = { quadriceps: ['c', 1], gluteus_maximus: ['c', 1] };
      return {
        scroll0: 0.9,
        update(t, dt) {
          if (phase === 0) {
            phase = 1; pl.mode = 'air'; pl.vy = -230;
            pl.onLand = () => { phase = 2; tLand = self.actT; Audio.crunch(); self.fx.addShake(12); pl.status = 'fail'; const k = self.jointPos('knee'); self.fx.sparks(k[0], k[1], 30); };
          }
          if (phase === 1) { self.scrollMul = 0.9; pl.pose = withMus(lerpPose(start, POSES.stiffLegs, ease(t / 0.2)), CON); if (t > 3) { phase = 2; tLand = t; } return; }
          self.scrollMul = 0;
          const s = t - tLand;
          pl.pose = jitterPose(withMus(lerpPose(POSES.stiffLegs, POSES.kneesBroken, ease(s / 0.12)), CON), hit ? 1.5 : 3);
          pl.pose.mus = CON;
          pl.mode = 'ground';
          sparkT -= dt;
          if (sparkT <= 0 && !hit) { sparkT = 0.06; const k = self.jointPos('knee'); self.fx.sparks(k[0], k[1], 4); const k2 = self.jointPos('kneeF'); self.fx.sparks(k2[0], k2[1], 3); }
          if (!hit && s > 0.45) { hit = t; self.partialHit(['legN', 'legF'], 'kneeN', 0.5); }
          if (hit && t - hit > 1.3 && !done) { done = true; self.fail(); }
        },
      };
    }

    // ---- DROP: wrong (isometric) / timeout = rigid landing, bounce onto its seat ----
    // PARTIAL: ankles/shins damaged (partial explosion at the ankles). No chest blast.
    actRigidLanding(ob) {
      const self = this, pl = this.pl, start = clonePose(pl.pose);
      let phase = 0, tSeat = 0, tBounce = 0, done = false;
      const ISO = { quadriceps: ['i', 1], gluteus_maximus: ['i', 1], hamstrings: ['i', 0.6] };
      return {
        scroll0: 0.9,
        update(t, dt) {
          if (phase === 0) {
            phase = 1; pl.mode = 'air'; pl.vy = -230;
            pl.onLand = () => {
              phase = 2; tBounce = self.actT; Audio.crunch(); self.fx.addShake(10); pl.status = 'fail';
              const f = self.jointPos('ankle'); self.fx.sparks(f[0], f[1], 30);
              if (!self.partialHit(['legN', 'legF'], 'ankleN', 0.5)) return; // last cell: shutdown instead
              pl.mode = 'air'; pl.vy = -360;
              pl.onLand = () => { phase = 3; tSeat = self.actT; Audio.thud(); self.fx.addShake(5); const c = self.jointPos('hip'); self.fx.dust(c[0], c[1] + 20, 10); };
            };
          }
          if (phase === 1) { self.scrollMul = 0.9; pl.pose = withMus(lerpPose(start, POSES.stepOff, ease(t / 0.2)), ISO); if (t > 3) phase = 2; }
          if (phase === 2) { self.scrollMul = 0.35; pl.pose = withMus(lerpPose(POSES.stepOff, POSES.seated, ease((t - tBounce) / 0.4)), ISO); }
          if (phase === 3) {
            self.scrollMul = 0;
            pl.pose = jitterPose(POSES.seated, Math.max(0, 2 * (1 - (t - tSeat))));
            pl.mode = 'ground';
            if (t - tSeat > 1.2 && !done) { done = true; self.fail(); }
          }
        },
      };
    }

    // ---- ZIPLINE stage 1: success = shoulder flexion grab ----
    actGrab(ob) {
      const self = this, pl = this.pl, start = clonePose(pl.pose);
      const x0 = pl.x, y0 = pl.y;
      const REACH = { deltoid_anterior: ['c', 1], pectoralis_major: ['c', 0.8], quadriceps: ['c', 0.8], gluteus_maximus: ['c', 0.8], gastrocnemius: ['c', 0.8] };
      const PULL = { biceps_brachii: ['c', 1], brachialis: ['c', 1], brachioradialis: ['c', 0.8], latissimus_dorsi: ['c', 0.8] };
      let grabbed = false;
      Audio.whoosh();
      return {
        scroll0: 0.3,
        update(t) {
          if (t < 0.32) {
            self.scrollMul = 0.3;
            pl.mode = 'fixed';
            const k = ease(t / 0.32);
            pl.pose = withMus(lerpPose(start, POSES.reach, k), REACH);
            const hr = Android.handRel(pl.pose);
            const tx = self.sx(ob.trolleyX) - hr[0], ty = ob.railY + self.handleDrop - hr[1];
            pl.x = lerp(x0, tx, k); pl.y = lerp(y0, ty, k) - 40 * Math.sin(Math.PI * k) * 0.5;
            return;
          }
          if (!grabbed) {
            grabbed = true; ob.attached = true; ob.K = ob.trolleyX - self.scrollX; pl.mode = 'hang';
            Audio.clank();
            const h = self.jointPos('hand'); self.fx.sparks(h[0], h[1] - 10, 14, { dir: -Math.PI / 2, spread: 1.2 });
          }
          self.scrollMul = lerp(0.3, 1, ease((t - 0.32) / 0.33));
          pl.pose = withMus(lerpPose(POSES.reach, POSES.hold, ease((t - 0.32) / 0.3)), PULL);
          if (t > 0.65) self.stageDone(ob);
        },
      };
    }

    // ---- ZIPLINE stage 1: wrong (extension) = arms swing back, miss ----
    actMissRail(ob, timeout) {
      const self = this, pl = this.pl, start = clonePose(pl.pose);
      const MUS = timeout ? null : { deltoid_posterior: ['c', 1], latissimus_dorsi: ['c', 1], triceps_brachii: ['c', 0.6], quadriceps: ['c', 0.8], gluteus_maximus: ['c', 0.8] };
      let jumped = false, boom = 0;
      return {
        scroll0: 1,
        update(t) {
          self.scrollMul = boom ? 0 : 1;
          if (!timeout && !jumped && t > 0.06) { jumped = true; pl.mode = 'air'; pl.vy = -620; Audio.whoosh(); }
          const tgt = timeout ? POSES.reachPrep : POSES.armsBack;
          pl.pose = withMus(lerpPose(start, tgt, ease(t / 0.25)), MUS);
          if (pl.mode === 'air' && pl.vy > 200) pl.status = 'warn';
          if (!pl.onFall && !boom) pl.onFall = () => { boom = self.actT; pl.visible = false; self.explodeBelow(pl.x); pl.status = 'fail'; };
          if (boom && t - boom > 1.4) self.fail();
        },
      };
    }

    // ---- ZIPLINE stage 2: success = isometric hold ----
    actHold(ob) {
      const self = this, pl = this.pl;
      const ISO = { biceps_brachii: ['i', 1], brachialis: ['i', 1], brachioradialis: ['i', 0.8], deltoid_anterior: ['i', 0.5], latissimus_dorsi: ['i', 0.6] };
      return {
        scroll0: 0.6,
        update(t) {
          self.scrollMul = lerp(0.6, 1, ease(t / 0.3));
          const p = clonePose(POSES.hold);
          p.hipN += 6 * Math.sin(self.time * 2); p.hipF += 6 * Math.sin(self.time * 2 + 0.6);
          p.mus = ISO;
          pl.pose = p;
          pl.mode = 'hang';
          if (self.scrollX > ob.zoneB + 30) self.stageDone(ob);
        },
      };
    }

    // ---- ZIPLINE stage 2: wrong (concentric) = pull up into the live rail ----
    // PARTIAL: head (and hands) hit; the android drops back to the hold and stays hanging.
    actPullIntoRail(ob) {
      const self = this, pl = this.pl, start = clonePose(pl.pose);
      const CON = { biceps_brachii: ['c', 1], brachialis: ['c', 1], brachioradialis: ['c', 0.9], latissimus_dorsi: ['c', 1] };
      const HOLD = { biceps_brachii: ['i', 0.5], brachialis: ['i', 0.5] };
      let zap = 0, hit = 0, arcT = 0, done = false;
      return {
        scroll0: 0.4,
        update(t, dt) {
          pl.mode = 'hang';
          if (t < 0.4) { self.scrollMul = 0.4; pl.pose = withMus(lerpPose(start, POSES.pullUp, ease(t / 0.4)), CON); return; }
          self.scrollMul = 0;
          if (!zap) { zap = t; Audio.zap(); pl.status = 'fail'; self.fx.addShake(10); }
          if (!hit) {
            pl.pose = jitterPose(withMus(POSES.pullUp, CON), 6);
            pl.pose.mus = CON;
            arcT -= dt;
            if (arcT <= 0) {
              arcT = 0.04;
              const h = self.jointPos('head');
              self.fx.arc(h[0] + rand(-20, 20), ob.railY + 4, h[0] + rand(-8, 8), h[1] + rand(-8, 8), 0.1);
              self.fx.sparks(h[0], h[1] - 8, 4);
            }
            if (t - zap > 0.6) { hit = t; self.partialHit(['head', 'armN', 'armF'], 'head', 0.55); }
            return;
          }
          const k = t - hit;
          pl.pose = withMus(jitterPose(lerpPose(POSES.pullUp, POSES.hold, ease(k / 0.4)), 2 * Math.max(0, 1 - k)), HOLD);
          if (k > 1.3 && !done) { done = true; self.fail(); }
        },
      };
    }

    // ---- ZIPLINE stage 2: wrong (eccentric) / timeout = lowered into the grinder ----
    // PARTIAL: feet/shins chewed; yanked back up to the hold height, still hanging.
    actLowerIntoGrinder(ob) {
      const self = this, pl = this.pl, start = clonePose(pl.pose);
      const ECC = { biceps_brachii: ['e', 1], brachialis: ['e', 1], brachioradialis: ['e', 0.8] };
      const YANK = { biceps_brachii: ['c', 1], brachialis: ['c', 1], latissimus_dorsi: ['c', 0.6] };
      let grind = 0, hit = 0, sT = 0, from = null, done = false;
      return {
        scroll0: 0.5,
        update(t, dt) {
          pl.mode = 'hang';
          if (!hit) {
            self.scrollMul = grind ? 0 : 0.5;
            pl.pose = withMus(lerpPose(start, POSES.lowered, ease(t / 0.75)), ECC);
            const feet = Math.max(self.jointPos('toe')[1], self.jointPos('heel')[1]);
            const ftX = self.jointPos('toe')[0];
            const inZone = ftX >= self.sx(ob.zoneA) && ftX <= self.sx(ob.zoneB);
            if (!grind && inZone && feet >= ob.grinderTop - 2) { grind = t; pl.status = 'fail'; }
            if (!grind && t > 2.5) { grind = t; pl.status = 'fail'; }
            if (grind) {
              pl.pose = jitterPose(pl.pose, 4); pl.pose.mus = ECC;
              sT -= dt;
              if (sT <= 0) { sT = 0.05; const f = self.jointPos('toe'); self.fx.sparks(f[0], ob.grinderTop, 8, { dir: -Math.PI / 2, spread: 1.3, vmax: 600 }); self.fx.addShake(4); Audio.grind(); }
              if (t - grind > 0.6) { hit = t; from = clonePose(pl.pose); if (self.partialHit(['legN', 'legF'], 'ankleN', 0.5)) Audio.clank(); }
            }
            return;
          }
          self.scrollMul = 0;
          const k = t - hit;
          pl.pose = withMus(lerpPose(from, POSES.hold, ease(k / 0.35)), k < 0.4 ? YANK : { biceps_brachii: ['i', 0.6], brachialis: ['i', 0.6] });
          if (k > 1.3 && !done) { done = true; self.fail(); }
        },
      };
    }

    // ---- ZIPLINE end: let go and land (eccentric) ----
    actDismount(ob) {
      const self = this, pl = this.pl, start = clonePose(pl.pose);
      let phase = 0, tLand = 0;
      return {
        scroll0: 1,
        update(t) {
          self.scrollMul = phase === 2 ? 0.7 : 1;
          if (phase === 0) {
            phase = 1; ob.attached = false; ob.free = true; pl.mode = 'air'; pl.vy = -120;
            pl.onLand = () => { phase = 2; tLand = self.actT; Audio.thud(); const f = self.jointPos('toe'); self.fx.dust(f[0], f[1], 8); };
          }
          if (phase === 1) pl.pose = lerpPose(start, POSES.landPrep, ease(t / 0.3));
          if (phase === 2) {
            const s = t - tLand;
            if (s < 0.2) pl.pose = withMus(lerpPose(POSES.landPrep, POSES.absorb, ease(s / 0.2)), { quadriceps: ['e', 0.9], gluteus_maximus: ['e', 0.7] });
            else { pl.pose = self.toRun(POSES.absorb, s - 0.2, 0.3); if (s > 0.5) { pl.x = PX; self.stageDone(ob); } }
            // drift back to centre
            pl.x = lerp(pl.x, PX, 0.1);
          }
        },
      };
    }

    // ---- BLAST DOOR: success = isometric hold, friends escape, duck out ----
    actDoorHold(ob, frac) {
      const self = this, pl = this.pl;
      const n = frac > 0.5 ? 4 : frac > 0.25 ? 3 : 2;
      const MUS = POSES.doorHold.mus;
      let phase = 0, tDuck = 0, slamT = 0, gained = false, strainT = 0;
      ob.override = true;
      ob.doorY = ob.handY + 1.5;
      this.spawnDoorFriends(n);
      return {
        scroll0: 0,
        update(t, dt) {
          pl.mode = 'ground';
          if (phase === 0) {
            // HOLD: joint angles do not change; agonists amber, small steady tremble
            self.scrollMul = 0;
            const p = jitterPose(POSES.doorHold, 0.5, ['shN', 'elN', 'shF', 'elF', 'hipN', 'kneeN']);
            p.mus = MUS;
            pl.pose = p;
            ob.doorY = ob.handY + 1.5;
            for (const h of ['handN', 'handF']) { const q = Android.partPoint(POSES.doorHold, pl.x, pl.y, h); self.fx.doorStrain(q[0], ob.doorY); }
            strainT -= dt;
            if (strainT <= 0) { strainT = 1.2; Audio.strain(); }
            if (t > 2.4 && self.doorFriends.every((f) => f.saved)) { phase = 1; tDuck = t; Audio.whoosh(); }
            return;
          }
          // DUCK OUT: arms drop, dive forward and down, then run; the door slams behind
          const s = t - tDuck;
          self.scrollMul = gained ? 1 : lerp(0, 1.3, ease(s / 0.3));
          pl.pose = s < 0.25 ? lerpPose(POSES.doorHold, POSES.doorDuck, ease(s / 0.25)) : self.toRun(POSES.doorDuck, s - 0.25, 0.35);
          if (!ob.falling && self.scrollX - 60 > ob.x + ob.w) { ob.falling = true; ob.vy = 0; }
          if (ob.falling && self.doorFall(ob, dt, 3600)) slamT = t;
          if (ob.slammed && !gained && t - slamT > 0.2) { gained = true; self.gainEnergy(); }
          if (gained && t - slamT > 0.6) self.stageDone(ob);
        },
      };
    }

    // Shared crush ending for the door: slam to the floor, full explosion at the chest.
    doorCrush(ob, t, dt, st) {
      const pl = this.pl;
      if (!st.crushing) { st.crushing = true; ob.vy = 250; }
      const headTop = pl.y + Android.headTopRel(pl.pose);
      if (!st.hit && ob.doorY + ob.vy * dt >= headTop) {
        st.hit = true; Audio.crunch(); pl.status = 'fail'; this.fx.addShake(14);
        const c = this.jointPos('chest'); this.fx.sparks(c[0], c[1], 30);
      }
      if (st.hit && !st.boom) pl.pose = jitterPose(lerpPose(pl.pose, POSES.slump, 0.25), 4);
      if (this.doorFall(ob, dt, 5200) && !st.boom) {
        st.boom = t;
        const c = this.jointPos('chest');
        this.fx.explosion(c[0], c[1], 1.3); Audio.boom();
        pl.visible = false;
      }
      if (st.boom && t - st.boom > 1.4 && !st.done) { st.done = true; this.fail(); }
    }

    // ---- BLAST DOOR: wrong (concentric, and isotonic via `as`) = shove up, slam, crushed ----
    actDoorShove(ob) {
      const self = this, pl = this.pl, start = clonePose(pl.pose);
      const MUS = POSES.doorShove.mus;
      const st = {};
      let screamed = false;
      ob.override = true;
      Audio.strain();
      return {
        scroll0: 0,
        update(t, dt) {
          self.scrollMul = 0;
          pl.mode = 'ground';
          if (t < 0.3) {
            const k = ease(t / 0.3);
            pl.pose = withMus(lerpPose(start, POSES.doorShove, k), MUS);
            ob.doorY = self.doorRest(pl.pose) - 20 * k; // the door lurches up off the fists
            return;
          }
          if (t < 0.7) {
            if (!screamed) { screamed = true; Audio.strain(); Audio.hiss(); self.fx.addShake(5); }
            pl.pose = withMus(jitterPose(POSES.doorShove, 1.5), MUS);
            ob.doorY = self.doorRest(POSES.doorShove) - 20 + rand(-1.5, 1.5); // motor screams
            return;
          }
          self.doorCrush(ob, t, dt, st);
        },
      };
    }

    // ---- BLAST DOOR: wrong (eccentric) = arms and knees give slowly, crushed ----
    // timeout: muscles stay jammed white and the door grinds down fast (~0.4 s).
    actDoorGive(ob, timeout) {
      const self = this, pl = this.pl, start = clonePose(pl.pose);
      const dur = timeout ? 0.4 : 1.2;
      // explicit zeros stop antagonists auto-glowing concentric as the joints flex
      const MUS = Object.assign({ biceps_brachii: ['c', 0], brachialis: ['c', 0], brachioradialis: ['c', 0], pectoralis_major: ['c', 0], latissimus_dorsi: ['c', 0], hamstrings: ['c', 0], iliopsoas: ['c', 0], tibialis_anterior: ['c', 0] }, POSES.doorGive.mus);
      const st = {};
      let strainT = 0;
      ob.override = true;
      Audio.strain();
      return {
        scroll0: 0,
        update(t, dt) {
          self.scrollMul = 0;
          pl.mode = 'ground';
          if (timeout) self.neutralAct = true;
          if (t < dur) {
            const k = timeout ? t / dur : ease(t / dur);
            pl.pose = lerpPose(start, POSES.doorGive, k);
            pl.pose.mus = timeout ? null : MUS;
            ob.doorY = self.doorRest(pl.pose); // the door follows the hands down
            for (const h of ['handN', 'handF']) { const q = Android.partPoint(pl.pose, pl.x, GY - Android.lowestRel(pl.pose), h); self.fx.doorStrain(q[0], ob.doorY); }
            strainT -= dt;
            if (strainT <= 0 && !timeout) { strainT = 0.6; Audio.strain(); }
            return;
          }
          if (t < dur + 0.15) { pl.pose = jitterPose(POSES.doorGive, 2); pl.pose.mus = timeout ? null : MUS; return; }
          self.doorCrush(ob, t, dt, st);
        },
      };
    }

    // ---- ENERGY 0: shutdown (no explosion) -> checkpoint, energy refilled ----
    actShutdown() {
      const self = this, pl = this.pl, start = clonePose(pl.pose);
      const hanging = pl.mode === 'hang';
      const limp = hanging ? POSES.lowered : POSES.slump;
      let done = false;
      pl.onLand = null; pl.onFall = null; pl.g = null; pl.vy = 0;
      if (!hanging) pl.mode = 'ground';
      this.fx.glitch = 0;
      this.sysFail = 0;
      this.fx.shutdown(1.4);
      Audio.powerDown();
      pl.status = 'fail';
      this.neutralAct = true;
      return {
        scroll0: 0,
        update(t) {
          self.scrollMul = 0;
          self.neutralAct = true;
          const k = ease(t / 0.9);
          pl.pose = lerpPose(start, limp, k);
          pl.pose.mus = null;
          if (!hanging) pl.mode = 'ground';
          self.powerFail = clamp((t - 0.3) / 0.4, 0, 1);
          if (t > 2.2 && !done) { done = true; self.fail(); }
        },
      };
    }

    // ---- WRONG PLANE: malfunction, screen crack, system failure ----
    actPlaneFail(ob, st) {
      const self = this, pl = this.pl, start = clonePose(pl.pose);
      const legs = st.limb === 'legs';
      const LM = legs ? { legN: 0.5, legF: 0.65 } : { armN: 0.5, armF: 0.65 };
      const JK = legs ? ['hipN', 'kneeN', 'ankleN', 'hipF', 'kneeF', 'lean'] : ['shN', 'elN', 'shF', 'elF', 'lean', 'head'];
      const jointsFx = legs ? ['hip', 'knee', 'ankle'] : ['shoulder', 'elbow', 'hand'];
      let cracked = false, sT = 0, done = false;
      Audio.glitch();
      pl.status = 'warn';
      const hanging = pl.mode === 'hang';
      return {
        scroll0: 0,
        update(t, dt) {
          self.scrollMul = 0;
          const k = ease(t / 0.3);
          const base = clonePose(start);
          base.lenMul = {};
          for (const key in LM) base.lenMul[key] = lerp(1, LM[key], k);
          let p = jitterPose(base, 6 + 22 * k * (t < 1.1 ? 1 : Math.max(0, 1 - (t - 1.1) * 2)), JK);
          p.lenMul = base.lenMul;
          // random contradictory activations: the controller is confused
          const mus = {};
          SEHS.Android.MUSCLES.forEach((m) => { if ((legs && m.limb === 'leg') || (!legs && m.limb === 'arm')) mus[m.id] = [Math.random() < 0.5 ? 'c' : 'e', Math.random()]; });
          p.mus = mus;
          if (t > 1.1 && !hanging) { const s = lerpPose(p, POSES.slump, ease((t - 1.1) / 0.6)); s.lenMul = p.lenMul; s.mus = mus; p = s; }
          pl.pose = p;
          if (!hanging) pl.mode = 'ground';
          sT -= dt;
          if (sT <= 0 && t < 1.8) {
            sT = 0.07;
            const j = self.jointPos(jointsFx[Math.floor(Math.random() * jointsFx.length)]);
            self.fx.sparks(j[0], j[1], 6, { vmax: 380 });
          }
          if (t > 0.3 && !cracked) {
            cracked = true;
            const h = self.jointPos('head');
            self.fx.makeCrack(h[0], h[1], W, H);
            self.fx.doFlash(0.5, '255,60,60');
            self.fx.addShake(12);
            Audio.crack(); Audio.glitch();
            pl.status = 'fail';
            self.loseEnergy(); // plane error: -1 energy, no explosion
          }
          self.fx.glitch = t < 0.3 ? 0.2 : Math.min(0.85, 0.2 + (t - 0.3));
          if (t > 1.3) self.sysFail = Math.min(1, (t - 1.3) * 2);
          if (t > 2.3 && !done) { done = true; self.fx.glitch = 0.25; self.fail(); }
        },
      };
    }

    // ======================================================================
    // RENDERING
    // ======================================================================
    tension() {
      if (this.mode === 'decide' && this.decision) return 0.35 + 0.65 * (1 - this.decision.timer / this.decision.total);
      if (this.mode === 'run' || this.mode === 'ride') return this.blend * 0.35;
      return 0;
    }

    draw(ctx, opts) {
      const fx = this.fx;
      const tension = this.tension();
      const pl = this.pl;
      ctx.save();
      // camera: shake + slight zoom toward the android during slow-mo
      let sx = 0, sy = 0;
      const shakeAmt = fx.shake + (fx.reduce ? 0 : tension * tension * 3);
      if (shakeAmt > 0) { sx = rand(-shakeAmt, shakeAmt); sy = rand(-shakeAmt, shakeAmt); }
      const focus = this.mode === 'decide' ? 1 : this.mode === 'act' ? Math.max(0, this.camFocus - 0.02) : this.blend;
      this.camFocus = focus;
      const zoom = 1 + 0.08 * focus;
      const fy = clamp(pl.y - 40, 200, 520);
      // pan up while a decision is on screen so the panel never hides the legs
      ctx.translate(PX + sx, fy + sy - focus * clamp(pl.y - 320, 0, 95));
      ctx.scale(zoom, zoom);
      ctx.translate(-PX, -fy);

      this.drawBackground(ctx);
      this.drawFriendLane(ctx);
      if (this.mode !== 'attract') this.drawPits(ctx);
      this.drawFloor(ctx);
      if (this.mode !== 'attract') { this.drawObstaclesBack(ctx); this.drawExit(ctx); }

      // drain colour from the world while time is frozen (android stays vivid)
      if (tension > 0.05) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'saturation';
        ctx.globalAlpha = Math.min(0.85, tension);
        ctx.fillStyle = 'rgb(128,128,128)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();
        this.drawFrozenLines(ctx, tension);
      }

      if (pl.visible) {
        const d = this.decision;
        const contractionQ = this.jammed();
        const hl = this.mode === 'decide' && d ? { joints: d.st.joints } : null;
        // Door freeze: arms overhead cross the head in side view, so the head is
        // redrawn on top and the joint rings go over it at reduced alpha.
        const dob = this.obs[this.cur];
        const headUp = !!(hl && d.ob.type === 'door') || (this.mode === 'act' && dob && dob.type === 'door' && !dob.falling);
        const dopts = {
          status: pl.status,
          highlight: headUp ? null : hl,
          labels: opts.labels ? 'all' : null,
          neutral: contractionQ,
          damage: this.damage,
          reduce: fx.reduce,
          skin: SEHS.Sprites ? SEHS.Sprites.get('sagittal') : null,
        };
        const rig = this.android.draw(ctx, pl.pose, pl.x, pl.y, dopts);
        if (headUp) {
          const A = this.android;
          ctx.save();
          ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          if (this.damage.head) A.drawDamaged(ctx, rig, 'head', 1, dopts, () => A.drawHead(ctx, rig, dopts));
          else A.drawHead(ctx, rig, dopts);
          ctx.globalAlpha = 0.55;
          if (hl) A.drawHighlights(ctx, rig, hl);
          ctx.restore();
        }
      }
      if (this.mode !== 'attract') this.drawObstaclesFront(ctx);
      fx.drawWorld(ctx);
      this.drawFloaters(ctx);
      ctx.restore();

      // ---- screen-space overlays ----
      this.drawTensionOverlay(ctx, tension);
      if (this.mode === 'rewind' && fx.crack) fx.crackT = Math.max(0, 1 - this.rewT / 0.45); // crack retracts
      fx.drawScreen(ctx, W, H);
      if (this.sysFail > 0) this.drawSystemFailure(ctx);
      if (this.mode === 'rewind') this.drawRewind(ctx);
      if (this.powerFail > 0) this.drawPowerFailure(ctx);
      if (this.mode === 'won') {
        ctx.fillStyle = `rgba(230,255,240,${Math.min(0.9, this.winT * 0.7)})`;
        ctx.fillRect(0, 0, W, H);
      }
    }

    drawBackground(ctx) {
      const X = this.scrollX;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0a1017');
      g.addColorStop(0.6, '#152030');
      g.addColorStop(1, '#0d141c');
      ctx.fillStyle = g;
      ctx.fillRect(-200, -200, W + 400, H + 400);

      // far layer: tanks, chimneys, pipes
      const p1 = 0.15, T1 = 220;
      const o1 = X * p1;
      for (let i = Math.floor((o1 - 200) / T1); i < (o1 + W + 200) / T1; i++) {
        const x = i * T1 - o1;
        const r = hash(i);
        ctx.fillStyle = '#111a25';
        if (r < 0.35) {
          const h = 220 + hash(i + 7) * 160;
          ctx.fillRect(x + 40, GY - h, 70, h);
          ctx.fillRect(x + 32, GY - h - 10, 86, 14);
        } else if (r < 0.7) {
          const h = 150 + hash(i + 3) * 120;
          ctx.beginPath(); ctx.ellipse(x + 110, GY - h, 80, 26, 0, Math.PI, 0); ctx.fill();
          ctx.fillRect(x + 30, GY - h, 160, h);
        } else {
          for (let k = 0; k < 4; k++) ctx.fillRect(x + 20 + k * 40, 40, 14, GY - 40);
        }
      }
      // alarm wash
      const alarm = 0.5 + 0.5 * Math.sin(this.time * 2.6);
      ctx.fillStyle = `rgba(255,30,30,${0.03 + 0.05 * alarm})`;
      ctx.fillRect(-200, -200, W + 400, H + 400);

      // mid layer: girders + lamps + gears
      const p2 = 0.45, T2 = 340;
      const o2 = X * p2;
      for (let i = Math.floor((o2 - 400) / T2); i < (o2 + W + 400) / T2; i++) {
        const x = i * T2 - o2;
        ctx.fillStyle = '#1a2533';
        ctx.fillRect(x, 50, 22, GY - 50);
        ctx.strokeStyle = '#1a2533'; ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x + 22, 70); ctx.lineTo(x + T2, 250);
        ctx.moveTo(x + 22, 250); ctx.lineTo(x + T2, 70);
        ctx.stroke();
        ctx.fillRect(x, 60, T2, 10);
        ctx.fillRect(x, 250, T2, 10);
        // lamp
        const lx = x + T2 / 2;
        ctx.fillStyle = '#2b3746';
        ctx.fillRect(lx - 2, 70, 4, 40);
        ctx.beginPath(); ctx.moveTo(lx - 16, 118); ctx.lineTo(lx + 16, 118); ctx.lineTo(lx + 8, 108); ctx.lineTo(lx - 8, 108); ctx.fill();
        const lg = ctx.createLinearGradient(lx, 118, lx, GY);
        lg.addColorStop(0, 'rgba(255,220,150,0.16)');
        lg.addColorStop(1, 'rgba(255,220,150,0)');
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.moveTo(lx - 12, 118); ctx.lineTo(lx + 12, 118); ctx.lineTo(lx + 110, GY); ctx.lineTo(lx - 110, GY); ctx.fill();
        if (hash(i + 11) < 0.4) this.gear(ctx, x + 90, 380, 52, this.time * (hash(i) < 0.5 ? 0.8 : -0.8), '#162130');
      }
      // ceiling pipes
      const p3 = 0.8, o3 = X * p3;
      ctx.fillStyle = '#1e2a38';
      ctx.fillRect(-200, 0, W + 400, 34);
      ctx.fillStyle = '#26364a';
      ctx.fillRect(-200, 20, W + 400, 8);
      for (let i = Math.floor((o3 - 100) / 160); i < (o3 + W + 100) / 160; i++) {
        const x = i * 160 - o3;
        ctx.fillStyle = '#33465c';
        ctx.fillRect(x, 16, 10, 16);
        if (hash(i + 5) < 0.25) {
          const a = 0.5 + 0.5 * Math.sin(this.time * 6 + i);
          ctx.fillStyle = `rgba(255,40,40,${0.4 + 0.6 * a})`;
          ctx.beginPath(); ctx.arc(x + 5, 40, 6, 0, Math.PI * 2); ctx.fill();
          if (!this.fx.reduce) {
            const rg = ctx.createRadialGradient(x + 5, 40, 0, x + 5, 40, 90);
            rg.addColorStop(0, `rgba(255,40,40,${0.2 * a})`); rg.addColorStop(1, 'rgba(255,40,40,0)');
            ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x + 5, 40, 90, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }

    gear(ctx, x, y, r, a, col) {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = col;
      ctx.beginPath();
      const n = 12;
      for (let i = 0; i < n * 2; i++) {
        const rr = i % 2 ? r : r * 0.8;
        const ang = (i / (n * 2)) * Math.PI * 2;
        ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0d141c';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    drawPits(ctx) {
      for (let k = Math.max(0, this.cur - 1); k < Math.min(this.obs.length, this.cur + 2); k++) {
        const ob = this.obs[k];
        if (ob.type !== 'gap' && ob.type !== 'zipline') continue;
        const a = this.sx(ob.x);
        if (a > W + 50 || a + ob.w < -50) continue;
        const g = ctx.createLinearGradient(0, GY, 0, H + 40);
        g.addColorStop(0, '#05080c');
        g.addColorStop(0.6, '#2a0d05');
        g.addColorStop(1, '#ff6a1a');
        ctx.fillStyle = g;
        ctx.fillRect(a, GY - 2, ob.w, H - GY + 60);
        const flick = 0.6 + 0.4 * Math.sin(this.time * 7 + k);
        ctx.fillStyle = `rgba(255,140,40,${0.25 * flick})`;
        ctx.fillRect(a, H - 30, ob.w, 40);
        if (ob.type === 'zipline') this.drawGrinder(ctx, ob);
      }
    }

    drawGrinder(ctx, ob) {
      const a = this.sx(ob.zoneA), b = this.sx(ob.zoneB);
      const top = ob.grinderTop;
      ctx.fillStyle = '#20262e';
      ctx.fillRect(a, top + 26, b - a, H - top);
      const n = Math.floor((b - a) / 44);
      for (let i = 0; i < n; i++) this.gear(ctx, a + 22 + i * 44, top + 22, 22, this.time * 9 * (i % 2 ? 1 : -1), '#5d6772');
      ctx.fillStyle = 'rgba(255,200,0,0.9)';
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.fillText('⚠ GRINDER', a + 6, top + 70);
    }

    drawFloor(ctx) {
      const step = 6;
      let run = [];
      const flush = () => {
        if (run.length < 2) { run = []; return; }
        ctx.beginPath();
        ctx.moveTo(run[0][0], H + 60);
        run.forEach((p) => ctx.lineTo(p[0], p[1]));
        ctx.lineTo(run[run.length - 1][0], H + 60);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, GY - 120, 0, H);
        g.addColorStop(0, '#2d3846');
        g.addColorStop(1, '#10161d');
        ctx.fillStyle = g;
        ctx.fill();
        // top edge + conveyor strip
        ctx.strokeStyle = '#7a8a9c'; ctx.lineWidth = 3;
        ctx.beginPath(); run.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
        ctx.strokeStyle = '#1b232c'; ctx.lineWidth = 12;
        ctx.beginPath(); run.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1] + 9) : ctx.moveTo(p[0], p[1] + 9))); ctx.stroke();
        // chevrons that scroll with the world
        ctx.strokeStyle = 'rgba(255,190,40,0.35)'; ctx.lineWidth = 2;
        for (let i = 0; i < run.length; i += 1) {
          const wx = this.scrollX + (run[i][0] - PX);
          if (((wx % 48) + 48) % 48 < step) {
            const [x, y] = run[i];
            ctx.beginPath(); ctx.moveTo(x - 4, y + 5); ctx.lineTo(x + 2, y + 9); ctx.lineTo(x - 4, y + 13); ctx.stroke();
          }
        }
        // hazard stripes at edges that border a gap
        const edge = (x, y, dir) => {
          ctx.save();
          ctx.beginPath(); ctx.rect(dir > 0 ? x - 40 : x, y - 2, 40, 16); ctx.clip();
          for (let k = -2; k < 8; k++) {
            ctx.fillStyle = k % 2 ? '#111' : '#f5c400';
            ctx.beginPath();
            const bx = (dir > 0 ? x - 40 : x) + k * 10;
            ctx.moveTo(bx, y + 14); ctx.lineTo(bx + 10, y - 2); ctx.lineTo(bx + 20, y - 2); ctx.lineTo(bx + 10, y + 14); ctx.fill();
          }
          ctx.restore();
        };
        const first = run[0], last = run[run.length - 1];
        if (first[0] > -10) edge(first[0], first[1], -1);
        if (last[0] < W + 10) edge(last[0], last[1], 1);
        run = [];
      };
      let prevG = null;
      for (let x = -220; x <= W + 220; x += step) {
        const g = this.groundAt(this.scrollX + (x - PX));
        if (g == null) { flush(); prevG = null; continue; }
        // vertical cliff (drop): close the run and start a new one
        if (prevG != null && Math.abs(g - prevG) > 40) { run.push([x - step + 0.01, prevG]); flush(); run.push([x - step + 0.02, g]); }
        run.push([x, g]);
        prevG = g;
      }
      flush();
      // cliff face for drops
      for (let k = Math.max(0, this.cur - 1); k < Math.min(this.obs.length, this.cur + 2); k++) {
        const ob = this.obs[k];
        if (ob.type !== 'drop') continue;
        const x = this.sx(ob.x);
        if (x < -100 || x > W + 100) continue;
        ctx.fillStyle = '#222c37';
        ctx.fillRect(x - 14, GY - ob.h, 14, ob.h);
        ctx.save();
        ctx.beginPath(); ctx.rect(x - 14, GY - ob.h, 14, ob.h); ctx.clip();
        for (let y = GY - ob.h - 20; y < GY; y += 20) {
          ctx.fillStyle = '#f5c400';
          ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x, y + 10); ctx.lineTo(x, y + 20); ctx.lineTo(x - 14, y + 10); ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle = '#f5c400';
        ctx.font = '700 15px system-ui, sans-serif';
        // label hangs on the cliff face (below the ledge top), clear of the android's legs
        ctx.fillStyle = 'rgba(10,14,20,0.75)';
        ctx.fillRect(x + 6, GY - ob.h + 26, 84, 24);
        ctx.fillStyle = '#f5c400';
        ctx.fillText('⚠ DROP', x + 12, GY - ob.h + 44);
      }
    }

    drawObstaclesBack(ctx) {
      for (let k = Math.max(0, this.cur - 1); k < Math.min(this.obs.length, this.cur + 2); k++) {
        const ob = this.obs[k];
        const a = this.sx(ob.start), b = this.sx(ob.end);
        if (b < -300 || a > W + 300) continue;
        if (ob.type === 'laser') {
          for (const wx of [ob.x - 18, ob.x + ob.w]) {
            const x = this.sx(wx);
            ctx.fillStyle = '#2c3a4a';
            ctx.fillRect(x + 6, 30, 8, this.beamBottom - 70);
            ctx.fillStyle = '#3d4d60';
            ctx.fillRect(x, this.beamBottom - 50, 20, 62);
            ctx.fillStyle = '#ff3344';
            ctx.fillRect(x + 6, this.beamBottom - 36, 8, 8);
            ctx.fillRect(x + 6, this.beamBottom - 8, 8, 8);
          }
          ctx.fillStyle = '#f5c400';
          ctx.font = '700 14px system-ui, sans-serif';
          ctx.fillText('⚠ LASER GRID', this.sx(ob.x) + 60, this.beamBottom - 70);
        }
        if (ob.type === 'door') this.drawDoorFrame(ctx, ob);
        if (ob.type === 'zipline') {
          const ra = this.sx(ob.railA), rb = this.sx(ob.railB);
          // supports
          for (const wx of [ob.railA + 20, ob.x + ob.w / 2, ob.railB - 20]) {
            const x = this.sx(wx);
            ctx.fillStyle = '#26343f'; ctx.fillRect(x - 4, 30, 8, ob.railY - 30);
          }
          ctx.fillStyle = '#4b5b6c';
          ctx.fillRect(ra, ob.railY - 6, rb - ra, 12);
          ctx.fillStyle = '#8a9aab';
          ctx.fillRect(ra, ob.railY - 6, rb - ra, 3);
          // electrified section
          const za = this.sx(ob.zoneA), zb = this.sx(ob.zoneB);
          ctx.fillStyle = 'rgba(120,200,255,0.35)';
          ctx.fillRect(za, ob.railY - 8, zb - za, 16);
          if (Math.random() < 0.5) {
            const x = rand(za, zb);
            SEHS.drawBolt(ctx, x, ob.railY + 6, x + rand(-30, 30), ob.railY + rand(20, 50), '150,210,255', 0.8);
          }
          ctx.fillStyle = '#9fd8ff';
          ctx.font = '700 13px system-ui, sans-serif';
          ctx.fillText('⚡ LIVE RAIL', za + 4, ob.railY - 14);
          // trolley
          const tx = this.sx(ob.trolleyX);
          ctx.fillStyle = '#5b6b7c';
          ctx.fillRect(tx - 22, ob.railY - 14, 44, 16);
          ctx.fillStyle = '#20262e';
          ctx.beginPath(); ctx.arc(tx - 12, ob.railY - 6, 6, 0, Math.PI * 2); ctx.arc(tx + 12, ob.railY - 6, 6, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#9aa7b4'; ctx.lineWidth = 3;
          const hy = ob.railY + this.handleDrop;
          ctx.beginPath(); ctx.moveTo(tx - 14, ob.railY + 2); ctx.lineTo(tx - 14, hy); ctx.moveTo(tx + 14, ob.railY + 2); ctx.lineTo(tx + 14, hy); ctx.stroke();
          ctx.strokeStyle = '#f5c400'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(tx - 18, hy); ctx.lineTo(tx + 18, hy); ctx.stroke();
        }
      }
    }

    drawObstaclesFront(ctx) {
      for (let k = Math.max(0, this.cur - 1); k < Math.min(this.obs.length, this.cur + 2); k++) {
        const ob = this.obs[k];
        if (ob.type === 'laser') {
          const a = this.sx(ob.x), b = this.sx(ob.x + ob.w);
          if (b < -50 || a > W + 50) continue;
          for (let i = 0; i < 3; i++) {
            const y = this.beamBottom - 4 - i * 13;
            const fl = 0.7 + 0.3 * Math.sin(this.time * 40 + i * 2);
            ctx.strokeStyle = `rgba(255,40,60,${0.25 * fl})`; ctx.lineWidth = 9;
            ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(b, y); ctx.stroke();
            ctx.strokeStyle = `rgba(255,170,180,${fl})`; ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
        if (ob.type === 'door') this.drawDoorPanel(ctx, ob);
        if (ob.type === 'crate' && !ob.gone) {
          const s = 96;
          ctx.save();
          if (ob.pivot) {
            ctx.translate(this.sx(ob.cx), GY);
            ctx.rotate(-ob.ang * Math.PI / 180);
            ctx.translate(0, -s);
          } else {
            ctx.translate(this.sx(ob.cx) + s / 2, GY - ob.cy - s / 2);
            ctx.rotate(ob.ang);
            ctx.translate(-s / 2, -s / 2);
          }
          ctx.fillStyle = '#6d5a3c'; ctx.fillRect(0, 0, s, s);
          ctx.strokeStyle = '#2a2116'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, s - 4, s - 4);
          ctx.beginPath(); ctx.moveTo(6, 6); ctx.lineTo(s - 6, s - 6); ctx.moveTo(s - 6, 6); ctx.lineTo(6, s - 6); ctx.stroke();
          ctx.fillStyle = '#f5c400'; ctx.fillRect(12, s / 2 - 11, s - 24, 22);
          ctx.fillStyle = '#111'; ctx.font = '800 13px system-ui, sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('400 kg', s / 2, s / 2 + 5);
          ctx.restore();
        }
      }
    }

    // Blast door frame: spans the main floor and the back catwalk. Two
    // rotating amber warning lights and a LOCKDOWN sign once the alarm is on.
    drawDoorFrame(ctx, ob) {
      const a = this.sx(ob.x), b = this.sx(ob.x + ob.w);
      if (b < -200 || a > W + 200) return;
      const top = 40;
      // housing the door retracts into
      ctx.fillStyle = '#1f2a36';
      ctx.fillRect(a - 30, top - 10, ob.w + 60, 70);
      ctx.fillStyle = '#2f3e4f';
      ctx.fillRect(a - 30, top + 52, ob.w + 60, 8);
      // pillars (from the catwalk level down to the floor)
      for (const x of [a - 26, b + 8]) {
        ctx.fillStyle = '#26323f'; ctx.fillRect(x, top, 18, GY - top);
        ctx.fillStyle = '#34465a'; ctx.fillRect(x + 3, top, 4, GY - top);
        ctx.save();
        ctx.beginPath(); ctx.rect(x, GY - 90, 18, 90); ctx.clip();
        for (let y = GY - 110; y < GY; y += 18) { ctx.fillStyle = '#f5c400'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18, y + 9); ctx.lineTo(x + 18, y + 18); ctx.lineTo(x, y + 9); ctx.fill(); }
        ctx.restore();
      }
      // LOCKDOWN sign
      const on = ob.alarm && !ob.slammed;
      const blink = on ? 0.55 + 0.45 * Math.sin(this.time * 7) : 0.25;
      ctx.fillStyle = '#121a22'; ctx.fillRect(a - 8, top + 8, ob.w + 16, 26);
      ctx.fillStyle = on ? `rgba(255,${this.fx.reduce ? 150 : Math.round(120 + 60 * blink)},40,${this.fx.reduce ? 0.9 : 0.45 + 0.55 * blink})` : 'rgba(255,190,90,0.35)';
      ctx.font = '800 12px ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.fillText('LOCKDOWN', (a + b) / 2, top + 26); ctx.textAlign = 'left';
      // rotating amber lights on both sides of the housing
      for (const x of [a - 40, b + 40]) {
        const ly = top + 22;
        ctx.fillStyle = '#3a2c10'; ctx.fillRect(x - 9, ly + 6, 18, 8);
        ctx.fillStyle = on ? '#ffb020' : '#6b5420';
        ctx.beginPath(); ctx.arc(x, ly, 9, Math.PI, 0); ctx.fill();
        if (!on) continue;
        if (this.fx.reduce) {
          const g = ctx.createRadialGradient(x, ly, 0, x, ly, 40);
          g.addColorStop(0, 'rgba(255,176,32,0.35)'); g.addColorStop(1, 'rgba(255,176,32,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, ly, 40, 0, TAU); ctx.fill();
        } else {
          const ang = this.time * 5 + (x > a ? Math.PI : 0);
          const dx = Math.cos(ang);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(x, ly, 0, x, ly, 220);
          g.addColorStop(0, `rgba(255,170,40,${0.3 * Math.abs(dx)})`); g.addColorStop(1, 'rgba(255,170,40,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(x, ly);
          ctx.lineTo(x + dx * 220, ly - 40); ctx.lineTo(x + dx * 220, ly + 60); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
    }

    // Steel door panel (drawn in front of the android); bottom edge = ob.doorY.
    drawDoorPanel(ctx, ob) {
      const a = this.sx(ob.x), w = ob.w;
      if (a + w < -100 || a > W + 100) return;
      const bot = ob.doorY, top = Math.min(bot - 520, -200);
      const g = ctx.createLinearGradient(a, 0, a + w, 0);
      g.addColorStop(0, '#46525e'); g.addColorStop(0.5, '#69757f'); g.addColorStop(1, '#3a444e');
      ctx.fillStyle = g;
      ctx.fillRect(a, top, w, bot - top);
      // panel seams and rivets
      ctx.strokeStyle = '#2a323b'; ctx.lineWidth = 2;
      for (let y = bot - 90; y > top; y -= 90) { ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(a + w, y); ctx.stroke(); }
      ctx.fillStyle = '#8b97a2';
      for (let y = bot - 30; y > Math.max(top, -40); y -= 45) { ctx.fillRect(a + 7, y, 4, 4); ctx.fillRect(a + w - 11, y, 4, 4); }
      // yellow/black chevrons on the bottom edge
      ctx.save();
      ctx.beginPath(); ctx.rect(a, bot - 18, w, 18); ctx.clip();
      ctx.fillStyle = '#111'; ctx.fillRect(a, bot - 18, w, 18);
      for (let x = a - 20; x < a + w + 20; x += 18) { ctx.fillStyle = '#f5c400'; ctx.beginPath(); ctx.moveTo(x, bot); ctx.lineTo(x + 9, bot - 18); ctx.lineTo(x + 18, bot - 18); ctx.lineTo(x + 9, bot); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#20262d'; ctx.fillRect(a, bot - 3, w, 3);
      ctx.strokeStyle = '#2a323b'; ctx.lineWidth = 2; ctx.strokeRect(a + 1, top, w - 2, bot - top);
    }

    drawExit(ctx) {
      const x = this.sx(this.exitX);
      if (x > W + 300 || x < -400) return;
      const top = GY - 320;
      const lg = ctx.createRadialGradient(x + 90, GY - 150, 10, x + 90, GY - 150, 320);
      lg.addColorStop(0, 'rgba(220,255,230,0.6)'); lg.addColorStop(1, 'rgba(220,255,230,0)');
      ctx.fillStyle = lg; ctx.fillRect(x - 250, top - 100, 700, 500);
      ctx.fillStyle = '#e8fff0'; ctx.fillRect(x, top, 180, GY - top);
      ctx.strokeStyle = '#3b4a5a'; ctx.lineWidth = 16; ctx.strokeRect(x - 8, top - 8, 196, GY - top + 8);
      ctx.fillStyle = '#0b3'; ctx.fillRect(x + 40, top - 70, 100, 40);
      ctx.fillStyle = '#eaffef'; ctx.font = '800 26px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('EXIT', x + 90, top - 40); ctx.textAlign = 'left';
    }

    drawFrozenLines(ctx, k) {
      ctx.save();
      ctx.strokeStyle = `rgba(160,220,255,${0.12 * k})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const y = 80 + hash(i * 3.1) * 520;
        const x = hash(i * 7.7) * W;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 80 + hash(i) * 160, y); ctx.stroke();
      }
      ctx.restore();
    }

    drawTensionOverlay(ctx, k) {
      if (k <= 0.01) return;
      const pulse = this.mode === 'decide' ? 0.5 + 0.5 * Math.sin(this.time * (4 + 8 * k)) : 0;
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(${Math.round(60 + 140 * k * pulse)},0,0,${0.35 + 0.45 * k})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // scanlines
      ctx.fillStyle = `rgba(0,0,0,${0.12 * k})`;
      for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
      if (this.mode === 'decide') {
        ctx.save();
        ctx.font = '800 15px ui-monospace, monospace';
        ctx.fillStyle = `rgba(160,230,255,${0.5 + 0.3 * pulse})`;
        ctx.fillText('◉ TIME DILATION ACTIVE', 24, 92);
        ctx.restore();
      }
    }

    // VHS rewind: scanlines, colour bands and a REWIND tag
    drawRewind(ctx) {
      const k = clamp(this.rewT / 0.5, 0, 1);
      ctx.save();
      ctx.fillStyle = `rgba(10,20,40,${0.25 * (1 - k * 0.5)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
      if (!this.fx.reduce) {
        for (let i = 0; i < 3; i++) {
          const y = ((this.time * 900 + i * 260) % (H + 60)) - 30;
          ctx.fillStyle = 'rgba(200,230,255,0.08)';
          ctx.fillRect(0, y, W, 14 + i * 6);
        }
      }
      ctx.font = '900 34px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(230,245,255,0.9)';
      ctx.fillText('◀◀ REWIND', W / 2, 140);
      ctx.restore();
    }

    drawPowerFailure(ctx) {
      ctx.save();
      ctx.globalAlpha = this.powerFail;
      ctx.textAlign = 'center';
      ctx.font = '900 54px ui-monospace, monospace';
      ctx.fillStyle = '#ff5a5a';
      ctx.fillText('POWER FAILURE', W / 2, H / 2 - 30);
      ctx.font = '700 18px ui-monospace, monospace';
      ctx.fillStyle = '#ffc0c0';
      ctx.fillText('ENERGY 0/5 · SHUTTING DOWN · REBOOT AT CHECKPOINT', W / 2, H / 2 + 10);
      ctx.restore();
    }

    drawSystemFailure(ctx) {
      const k = this.sysFail;
      ctx.save();
      ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(40,0,0,0.45)';
      ctx.fillRect(0, H / 2 - 70, W, 140);
      ctx.textAlign = 'center';
      ctx.font = '900 64px ui-monospace, monospace';
      const jx = this.fx.reduce ? 0 : rand(-4, 4);
      ctx.fillStyle = 'rgba(0,255,255,0.6)'; ctx.fillText('SYSTEM FAILURE', W / 2 + jx - 3, H / 2 + 10);
      ctx.fillStyle = 'rgba(255,0,60,0.8)'; ctx.fillText('SYSTEM FAILURE', W / 2 + jx + 3, H / 2 + 10);
      ctx.fillStyle = '#fff'; ctx.fillText('SYSTEM FAILURE', W / 2 + jx, H / 2 + 10);
      ctx.font = '700 18px ui-monospace, monospace';
      ctx.fillStyle = '#ffb3b3';
      ctx.fillText('ERR 0x5A6 · PLANE VIOLATION · MOTION OUTSIDE SAGITTAL PLANE', W / 2, H / 2 + 46);
      ctx.restore();
    }
  }

  SEHS.SagittalLevel = SagittalLevel;
  SEHS.SagittalPoses = POSES;
})();
