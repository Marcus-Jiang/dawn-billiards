(() => {
  'use strict';

  const WORLD = { width: 1100, height: 550 };
  const PLAY = { left: 69, right: 1031, top: 67, bottom: 483 };
  const MAX_DPR = 2;
  const FRICTION = 0.982;
  const STOP_SPEED = 2.2;
  const MODE_META = {
    eight: {
      mark: '8', label: '8 球', eyebrow: '经典分组对抗', title: '一杆定胜负',
      description: '先清空自己的全色或花色，再稳稳打进黑 8。'
    },
    nine: {
      mark: '9', label: '9 球', eyebrow: '极速最小号挑战', title: '每一杆都要更准',
      description: '每次必须先碰到台面最小号球，合法打进 9 号球即可获胜。'
    },
    snooker: {
      mark: 'S', label: '斯诺克', eyebrow: '红彩交替计分赛', title: '把分数打满',
      description: '红球与彩球交替得分，红球清完后按顺序打进彩球。'
    }
  };
  const SNOOKER_COLORS = [
    { id: 16, key: 'yellow', name: '黄球', value: 2, color: '#e8c62d', spot: { x: 292, y: 426 } },
    { id: 17, key: 'green', name: '绿球', value: 3, color: '#258b50', spot: { x: 292, y: 124 } },
    { id: 18, key: 'brown', name: '咖啡球', value: 4, color: '#79512b', spot: { x: 292, y: 275 } },
    { id: 19, key: 'blue', name: '蓝球', value: 5, color: '#2371b7', spot: { x: 558, y: 275 } },
    { id: 20, key: 'pink', name: '粉球', value: 6, color: '#dd7893', spot: { x: 720, y: 275 } },
    { id: 21, key: 'black', name: '黑球', value: 7, color: '#111313', spot: { x: 920, y: 275 } }
  ];
  const SNOOKER_COLOR_BY_ID = Object.fromEntries(SNOOKER_COLORS.map(item => [item.id, item]));
  const SNOOKER_ORDER = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];
  const BALL_COLORS = {
    1: '#f2c52d', 2: '#285eb8', 3: '#dc4334', 4: '#71428d',
    5: '#e77f2f', 6: '#17896a', 7: '#8b3034', 8: '#111313',
    9: '#f2c52d', 10: '#285eb8', 11: '#dc4334', 12: '#71428d',
    13: '#e77f2f', 14: '#17896a', 15: '#8b3034',
    16: '#e8c62d', 17: '#258b50', 18: '#79512b', 19: '#2371b7', 20: '#dd7893', 21: '#111313'
  };
  const POCKETS = [
    { x: 55, y: 53, corner: true }, { x: 550, y: 48, corner: false },
    { x: 1045, y: 53, corner: true }, { x: 55, y: 497, corner: true },
    { x: 550, y: 502, corner: false }, { x: 1045, y: 497, corner: true }
  ];

  const canvas = document.getElementById('gameCanvas');
  const stage = document.getElementById('tableStage');
  const ctx = canvas.getContext('2d');
  const ui = {
    start: document.getElementById('startButton'),
    welcome: document.getElementById('welcomeOverlay'),
    welcomeEyebrow: document.getElementById('welcomeEyebrow'),
    welcomeTitle: document.getElementById('welcomeTitle'),
    welcomeDescription: document.getElementById('welcomeDescription'),
    modePicker: document.getElementById('modePicker'),
    modeOptions: Array.from(document.querySelectorAll('.mode-option')),
    modeMark: document.getElementById('modeMark'),
    modeBadge: document.getElementById('modeBadge'),
    modeButton: document.getElementById('modeButton'),
    install: document.getElementById('installButton'),
    offlineStatus: document.getElementById('offlineStatus'),
    result: document.getElementById('resultOverlay'),
    playAgain: document.getElementById('playAgainButton'),
    reset: document.getElementById('resetButton'),
    shoot: document.getElementById('shootButton'),
    power: document.getElementById('powerSlider'),
    powerValue: document.getElementById('powerValue'),
    powerGlow: document.getElementById('powerGlow'),
    sound: document.getElementById('soundButton'),
    playerOneCard: document.getElementById('playerOneCard'),
    playerTwoCard: document.getElementById('playerTwoCard'),
    playerOneScore: document.getElementById('playerOneScore'),
    playerTwoScore: document.getElementById('playerTwoScore'),
    playerOneBalls: document.getElementById('playerOneBalls'),
    playerTwoBalls: document.getElementById('playerTwoBalls'),
    turnPill: document.getElementById('turnPill'),
    turnText: document.querySelector('#turnPill span'),
    foulToast: document.getElementById('foulToast'),
    aimTip: document.getElementById('aimTip'),
    controlTitle: document.getElementById('controlTitle'),
    targetText: document.getElementById('targetText'),
    stateText: document.getElementById('stateText'),
    progress: document.getElementById('progressBar'),
    resultIcon: document.getElementById('resultIcon'),
    resultEyebrow: document.getElementById('resultEyebrow'),
    resultTitle: document.getElementById('resultTitle'),
    resultMessage: document.getElementById('resultMessage'),
    finalPlayerScore: document.getElementById('finalPlayerScore'),
    finalAiScore: document.getElementById('finalAiScore'),
    resultMode: document.getElementById('resultModeButton')
  };

  const state = {
    mode: 'eight',
    balls: [],
    groups: [null, null],
    scores: [0, 0],
    snookerTarget: 'red',
    snookerAwaitingFinalColor: false,
    snookerColorIndex: 0,
    targetAtShot: null,
    snookerTargetAtShot: null,
    turn: 0,
    phase: 'idle',
    started: false,
    aimAngle: 0,
    power: 0.52,
    aiming: false,
    pocketedThisShot: [],
    firstHit: null,
    cueScratched: false,
    shotOwner: 0,
    token: 0,
    sounds: true,
    audio: null,
    dpr: 1,
    viewport: { width: 1, height: 1, scale: 1, portrait: false },
    clothPattern: null,
    clothColor: null,
    lastCollisionSound: 0,
    installPrompt: null
  };

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function normalize(x, y) {
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length, length };
  }
  function isSolid(id) { return id >= 1 && id <= 7; }
  function isStripe(id) { return id >= 9 && id <= 15; }
  function groupOf(id) { return isSolid(id) ? 'solid' : isStripe(id) ? 'stripe' : null; }
  function groupLabel(group) { return group === 'solid' ? '全色 1-7' : group === 'stripe' ? '花色 9-15' : '待定'; }
  function random(min, max) { return min + Math.random() * (max - min); }
  function modeMeta() { return MODE_META[state.mode]; }
  function ballRadiusForMode(mode = state.mode) { return mode === 'snooker' ? 10.5 : 13.4; }
  function pocketRadiusForMode() { return state.mode === 'snooker' ? 24 : 29; }
  function isSnookerColor(ball) { return ball && ball.kind === 'color'; }
  function isRed(ball) { return ball && ball.kind === 'red'; }
  function getBall(id) { return state.balls.find(ball => ball.id === id); }
  function getCueBall() { return state.balls.find(ball => ball.id === 0); }
  function activeBalls() { return state.balls.filter(ball => ball.active && ball.id !== 0); }
  function activeReds() { return state.balls.filter(ball => ball.active && ball.kind === 'red'); }
  function activeColors() { return state.balls.filter(ball => ball.active && ball.kind === 'color'); }
  function activeNumberedBalls() { return activeBalls().filter(ball => ball.kind !== 'red' && ball.kind !== 'color'); }
  function lowestNineBall() { return activeNumberedBalls().filter(ball => ball.id !== 9).sort((a, b) => a.id - b.id)[0] || null; }
  function snookerColorMeta(idOrKey) {
    if (typeof idOrKey === 'string') return SNOOKER_COLORS.find(item => item.key === idOrKey) || null;
    return SNOOKER_COLOR_BY_ID[idOrKey] || null;
  }
  function nextSnookerColor() {
    for (const key of SNOOKER_ORDER) {
      const meta = snookerColorMeta(key);
      const ball = state.balls.find(item => item.id === meta.id && item.active);
      if (ball) return meta;
    }
    return null;
  }
  function loadPreferredMode() {
    try {
      const saved = localStorage.getItem('dawn-billiards-mode');
      if (saved && MODE_META[saved]) return saved;
    } catch (_) {}
    return 'eight';
  }

  function roundRectPath(context, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + w, y, x + w, y + h, radius);
    context.arcTo(x + w, y + h, x, y + h, radius);
    context.arcTo(x, y + h, x, y, radius);
    context.arcTo(x, y, x + w, y, radius);
    context.closePath();
  }

  function createClothPattern(color = '#08735d') {
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 80;
    patternCanvas.height = 80;
    const pctx = patternCanvas.getContext('2d');
    pctx.fillStyle = color;
    pctx.fillRect(0, 0, 80, 80);
    const image = pctx.getImageData(0, 0, 80, 80);
    for (let i = 0; i < image.data.length; i += 4) {
      const grain = Math.floor(Math.random() * 11) - 5;
      image.data[i] = clamp(image.data[i] + grain, 0, 255);
      image.data[i + 1] = clamp(image.data[i + 1] + grain, 0, 255);
      image.data[i + 2] = clamp(image.data[i + 2] + grain, 0, 255);
    }
    pctx.putImageData(image, 0, 0);
    state.clothPattern = ctx.createPattern(patternCanvas, 'repeat');
    state.clothColor = color;
  }

  function ensureClothPattern() {
    const color = state.mode === 'snooker' ? '#087149' : '#08735d';
    if (!state.clothPattern || state.clothColor !== color) createClothPattern(color);
  }

  function createBall(id, x, y, options = {}) {
    const mode = state.mode;
    const kind = options.kind || (id === 0 ? 'cue' : id === 8 ? 'eight' : id === 9 ? 'nine' : mode === 'eight' && isStripe(id) ? 'stripe' : 'solid');
    return {
      id,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: options.radius || ballRadiusForMode(mode),
      active: true,
      rotation: Math.random() * Math.PI * 2,
      kind,
      value: options.value || (id >= 1 && id <= 7 ? 1 : id === 9 ? 9 : 0),
      ballColor: options.color || BALL_COLORS[id] || '#ddd',
      key: options.key || SNOOKER_COLOR_BY_ID[id]?.key || null,
      spot: options.spot ? { ...options.spot } : null
    };
  }

  function createRackOrder() {
    const solids = [1, 2, 3, 4, 5, 6, 7];
    const stripes = [9, 10, 11, 12, 13, 14, 15];
    for (let i = solids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [solids[i], solids[j]] = [solids[j], solids[i]];
    }
    for (let i = stripes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [stripes[i], stripes[j]] = [stripes[j], stripes[i]];
    }

    const order = [];
    for (let i = 0; i < 7; i++) order.push(i % 2 === 0 ? solids.pop() : stripes.pop());
    order.splice(4, 0, 8);
    while (solids.length || stripes.length) order.push((order.length % 2 ? solids : stripes).pop());
    if (order.length > 15) order.length = 15;
    return order;
  }

  function rackEightBalls() {
    const order = createRackOrder();
    const radius = ballRadiusForMode('eight');
    const gap = radius * 2 + 1.1;
    let index = 0;
    const startX = 785;
    for (let row = 0; row < 5; row++) {
      for (let column = 0; column <= row; column++) {
        const id = order[index++] || 1 + index;
        const x = startX + row * gap * 0.88;
        const y = WORLD.height / 2 + (column - row / 2) * gap;
        state.balls.push(createBall(id, x, y));
      }
    }
  }

  function rackNineBalls() {
    const order = [1, 2, 3, 4, 9, 5, 6, 7, 8];
    const radius = ballRadiusForMode('nine');
    const gap = radius * 2 + 1.4;
    const startX = 798;
    let index = 0;
    for (let row = 0; row < 5; row++) {
      const count = row < 3 ? row + 1 : 5 - row;
      for (let column = 0; column < count; column++) {
        const y = WORLD.height / 2 + (column - (count - 1) / 2) * gap;
        const x = startX + row * gap * 0.9;
        state.balls.push(createBall(order[index++], x, y));
      }
    }
  }

  function rackSnookerBalls() {
    const radius = ballRadiusForMode('snooker');
    const gap = radius * 2 + 0.45;
    const startX = 748;
    let redId = 1;
    for (let row = 0; row < 5; row++) {
      for (let column = 0; column <= row; column++) {
        const x = startX + row * gap * 0.9;
        const y = WORLD.height / 2 + (column - row / 2) * gap;
        state.balls.push(createBall(redId++, x, y, { kind: 'red', value: 1, radius, color: '#b82427' }));
      }
    }
    for (const meta of SNOOKER_COLORS) {
      state.balls.push(createBall(meta.id, meta.spot.x, meta.spot.y, {
        kind: 'color', value: meta.value, radius, color: meta.color, spot: meta.spot
      }));
    }
  }

  function rackBalls() {
    const cueX = state.mode === 'snooker' ? 238 : 292;
    state.balls = [createBall(0, cueX, WORLD.height / 2, { kind: 'cue' })];
    if (state.mode === 'nine') rackNineBalls();
    else if (state.mode === 'snooker') rackSnookerBalls();
    else rackEightBalls();
  }

  function resetGame() {
    state.token += 1;
    state.groups = [null, null];
    state.scores = [0, 0];
    state.snookerTarget = 'red';
    state.snookerAwaitingFinalColor = false;
    state.snookerColorIndex = 0;
    state.targetAtShot = null;
    state.snookerTargetAtShot = null;
    state.turn = 0;
    state.phase = 'idle';
    state.started = false;
    state.aimAngle = 0;
    state.power = 0.52;
    state.aiming = false;
    state.pocketedThisShot = [];
    state.firstHit = null;
    state.cueScratched = false;
    state.shotOwner = 0;
    document.body.classList.toggle('mode-eight', state.mode === 'eight');
    document.body.classList.toggle('mode-nine', state.mode === 'nine');
    document.body.classList.toggle('mode-snooker', state.mode === 'snooker');
    ensureClothPattern();
    rackBalls();
    ui.power.value = '52';
    syncPowerUi();
    ui.result.classList.remove('is-visible');
    ui.welcome.classList.add('is-visible');
    updateModePresentation();
    updateUi();
  }

  function beginGame() {
    state.token += 1;
    state.started = true;
    state.phase = 'aim';
    state.turn = 0;
    updateModePresentation();
    initAudio();
    ui.welcome.classList.remove('is-visible');
    ui.aimTip.style.opacity = '1';
    updateUi();
  }

  function updateModePresentation() {
    const meta = modeMeta();
    ui.modeMark.textContent = meta.mark;
    ui.modeBadge.textContent = meta.label;
    ui.welcomeEyebrow.textContent = meta.eyebrow;
    ui.welcomeTitle.textContent = meta.title;
    ui.welcomeDescription.textContent = meta.description;
    document.title = `破晓台球 · ${meta.label}`;
    for (const button of ui.modeOptions) {
      const selected = button.dataset.mode === state.mode;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-checked', String(selected));
    }
  }

  function snookerTargetLabel(target = state.snookerTarget) {
    if (target === 'red') return '红球';
    if (target === 'color') return '任意彩球';
    return snookerColorMeta(target)?.name || '彩球';
  }

  function currentTargetLabel(index = state.turn) {
    if (state.mode === 'eight') {
      const group = state.groups[index];
      if (!group) return '任意花色';
      return isGroupCleared(group) ? '黑 8' : groupLabel(group);
    }
    if (state.mode === 'nine') {
      const target = state.phase === 'simulating' && state.targetAtShot ? getBall(state.targetAtShot) : lowestNineBall();
      return target ? `最低号 · ${target.id} 号球` : '等待 9 号球';
    }
    return snookerTargetLabel();
  }

  function playerModeLabel(index) {
    if (state.mode === 'eight') return groupLabel(state.groups[index]);
    if (state.mode === 'nine') return '最小号优先';
    return activeReds().length ? '红球阶段' : '彩球阶段';
  }

  function modeProgress(index) {
    if (state.mode === 'eight') return state.groups[index] ? clamp(state.scores[index] / 7, 0, 1) : 0;
    if (state.mode === 'nine') return clamp(state.scores[index] / 9, 0, 1);
    return clamp(state.scores[index] / 147, 0, 1);
  }

  function updateUi() {
    const isPlayer = state.turn === 0;
    ui.playerOneCard.classList.toggle('is-active', isPlayer && state.phase !== 'over');
    ui.playerTwoCard.classList.toggle('is-active', !isPlayer && state.phase !== 'over');
    ui.playerOneBalls.textContent = playerModeLabel(0);
    ui.playerTwoBalls.textContent = playerModeLabel(1);
    ui.playerOneScore.textContent = state.scores[0];
    ui.playerTwoScore.textContent = state.scores[1];
    ui.turnPill.classList.toggle('ai', !isPlayer);
    ui.turnText.textContent = isPlayer ? '你的回合' : '电脑回合';
    ui.modeBadge.textContent = modeMeta().label;
    ui.targetText.textContent = currentTargetLabel();

    const playerCanShoot = state.started && state.phase === 'aim' && isPlayer;
    ui.shoot.disabled = !playerCanShoot;
    ui.power.disabled = !playerCanShoot;

    const phaseText = {
      idle: '等待开始',
      aim: isPlayer ? '等待瞄准' : '正在计算',
      simulating: '球体运动中',
      ai: '电脑思考中',
      over: '本局结束'
    };
    ui.stateText.textContent = phaseText[state.phase] || '准备中';
    ui.controlTitle.textContent = playerCanShoot ? '安排你的下一杆' : isPlayer ? '观察球路' : '对手正在击球';
    const progress = modeProgress(state.turn);
    ui.progress.style.width = `${progress * 100}%`;
    ui.progress.parentElement.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
  }

  function syncPowerUi() {
    const percent = Math.round(state.power * 100);
    ui.power.value = String(percent);
    ui.powerValue.textContent = `${percent}%`;
    ui.powerGlow.style.width = `${percent}%`;
  }

  function isGroupCleared(group) {
    return state.balls.filter(ball => ball.active && groupOf(ball.id) === group).length === 0;
  }

  function activeGroupCount(group) {
    return state.balls.filter(ball => ball.active && groupOf(ball.id) === group).length;
  }

  function updateScoreForGroup(index, group) {
    if (!group) {
      state.scores[index] = 0;
      return;
    }
    state.scores[index] = state.balls.filter(ball => !ball.active && groupOf(ball.id) === group).length;
  }

  function initAudio() {
    if (!state.audio) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) state.audio = new AudioContext();
    }
    if (state.audio?.state === 'suspended') state.audio.resume();
  }

  function playTone(frequency, duration = 0.05, volume = 0.04, type = 'sine', endFrequency = null) {
    if (!state.sounds || !state.audio) return;
    const now = state.audio.currentTime;
    const oscillator = state.audio.createOscillator();
    const gain = state.audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(state.audio.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
  }

  function playCollisionSound(speed) {
    const now = performance.now();
    if (now - state.lastCollisionSound < 34) return;
    state.lastCollisionSound = now;
    const volume = clamp(speed / 1350 * 0.075, 0.008, 0.075);
    playTone(720 + Math.random() * 420, 0.028 + volume * 0.3, volume, 'triangle', 170);
  }

  function playPocketSound() {
    playTone(120, 0.16, 0.075, 'sine', 52);
    setTimeout(() => playTone(320, 0.09, 0.025, 'triangle', 100), 35);
  }

  function formatReason(reason) {
    if (reason === 'early-eight') return '黑 8 提前落袋，本局惜败。';
    if (reason === 'ai-eight') return '对手清台后打进黑 8，比赛结束。';
    if (reason === 'ai-early-eight') return '对手提前打进黑 8，你拿下本局。';
    if (reason === 'eight') return '黑 8 稳稳落袋，比赛结束。';
    if (reason === 'nine') return '合法打进 9 号球，比赛结束。';
    if (reason === 'ai-nine') return '对手合法打进 9 号球，本局结束。';
    if (reason === 'snooker-clear') return '彩球清台完成，按总比分决出胜负。';
    return reason;
  }

  function finishGame(winner, reason) {
    state.phase = 'over';
    state.aiming = false;
    updateUi();
    const playerWon = winner === 0;
    ui.resultIcon.textContent = playerWon ? '🏆' : '🎱';
    ui.resultEyebrow.textContent = playerWon ? '漂亮的一杆' : '差一点';
    ui.resultTitle.textContent = playerWon ? '你赢了' : '电脑获胜';
    ui.resultMessage.textContent = formatReason(reason);
    ui.finalPlayerScore.textContent = state.scores[0];
    ui.finalAiScore.textContent = state.scores[1];
    setTimeout(() => ui.result.classList.add('is-visible'), 350);
    playTone(playerWon ? 660 : 180, 0.4, 0.055, 'sine', playerWon ? 1120 : 80);
  }

  function pocketBall(ball) {
    if (!ball.active) return;
    ball.active = false;
    ball.vx = 0;
    ball.vy = 0;
    state.pocketedThisShot.push(ball.id);
    if (ball.id === 0) state.cueScratched = true;
    playPocketSound();
  }

  function ballIsNearPocket(ball) {
    return POCKETS.some(pocket => {
      if (pocket.corner) return Math.hypot(ball.x - pocket.x, ball.y - pocket.y) < 52;
      return Math.abs(ball.x - pocket.x) < 34 && Math.abs(ball.y - pocket.y) < 57;
    });
  }

  function checkPockets(ball) {
    const pocketRadius = pocketRadiusForMode();
    for (const pocket of POCKETS) {
      const captureRadius = pocket.corner ? pocketRadius * 0.88 : pocketRadius * 0.82;
      if (Math.hypot(ball.x - pocket.x, ball.y - pocket.y) < captureRadius) {
        pocketBall(ball);
        return true;
      }
    }
    return false;
  }

  function stepPhysics(rawDt) {
    const dt = clamp(rawDt, 0, 0.026);
    const friction = Math.pow(FRICTION, dt * 60);
    for (const ball of state.balls) {
      if (!ball.active) continue;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.rotation += (Math.hypot(ball.vx, ball.vy) / ball.radius) * dt * 0.08;
      ball.vx *= friction;
      ball.vy *= friction;
      if (Math.hypot(ball.vx, ball.vy) < STOP_SPEED) {
        ball.vx = 0;
        ball.vy = 0;
      }
      if (checkPockets(ball)) continue;
      bounceOffRails(ball);
    }
    collideBalls();
  }

  function bounceOffRails(ball) {
    if (ballIsNearPocket(ball)) return;
    const restitution = 0.91;
    if (ball.x - ball.radius < PLAY.left) {
      ball.x = PLAY.left + ball.radius;
      if (ball.vx < 0) { ball.vx = -ball.vx * restitution; playCollisionSound(Math.abs(ball.vx)); }
    } else if (ball.x + ball.radius > PLAY.right) {
      ball.x = PLAY.right - ball.radius;
      if (ball.vx > 0) { ball.vx = -ball.vx * restitution; playCollisionSound(Math.abs(ball.vx)); }
    }
    if (ball.y - ball.radius < PLAY.top) {
      ball.y = PLAY.top + ball.radius;
      if (ball.vy < 0) { ball.vy = -ball.vy * restitution; playCollisionSound(Math.abs(ball.vy)); }
    } else if (ball.y + ball.radius > PLAY.bottom) {
      ball.y = PLAY.bottom - ball.radius;
      if (ball.vy > 0) { ball.vy = -ball.vy * restitution; playCollisionSound(Math.abs(ball.vy)); }
    }
  }

  function collideBalls() {
    for (let i = 0; i < state.balls.length; i++) {
      const a = state.balls[i];
      if (!a.active) continue;
      for (let j = i + 1; j < state.balls.length; j++) {
        const b = state.balls[j];
        if (!b.active) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDistance = a.radius + b.radius;
        const distSq = dx * dx + dy * dy;
        if (distSq >= minDistance * minDistance || distSq < 0.0001) continue;

        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDistance - dist;
        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;

        const relativeX = b.vx - a.vx;
        const relativeY = b.vy - a.vy;
        const relativeSpeed = relativeX * nx + relativeY * ny;
        if (relativeSpeed > 0) continue;

        const impulse = -(1 + 0.96) * relativeSpeed * 0.5;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;

        if ((a.id === 0 || b.id === 0) && state.firstHit === null) {
          state.firstHit = a.id === 0 ? b.id : a.id;
        }
        playCollisionSound(Math.abs(relativeSpeed));
      }
    }
  }

  function anyBallMoving() {
    return state.balls.some(ball => ball.active && Math.hypot(ball.vx, ball.vy) > STOP_SPEED * 0.82);
  }

  function fireShot(power, angle) {
    const cue = state.balls[0];
    if (!cue?.active || state.phase !== 'aim') return;
    const speed = 315 + power * 1010;
    cue.vx = Math.cos(angle) * speed;
    cue.vy = Math.sin(angle) * speed;
    state.phase = 'simulating';
    state.shotOwner = state.turn;
    state.targetAtShot = state.mode === 'nine' ? lowestNineBall()?.id || null : null;
    state.snookerTargetAtShot = state.mode === 'snooker' ? state.snookerTarget : null;
    state.pocketedThisShot = [];
    state.firstHit = null;
    state.cueScratched = false;
    state.aiming = false;
    ui.aimTip.style.opacity = '0';
    playTone(190, 0.08, 0.05 + power * 0.04, 'triangle', 72);
    updateUi();
  }

  function findOpenSpot(base, movingBall, ignoredIds = []) {
    const radius = movingBall.radius;
    const offsets = [
      { x: 0, y: 0 }, { x: radius * 2.4, y: 0 }, { x: -radius * 2.4, y: 0 },
      { x: 0, y: radius * 2.4 }, { x: 0, y: -radius * 2.4 },
      { x: radius * 2.1, y: radius * 2.1 }, { x: -radius * 2.1, y: radius * 2.1 },
      { x: radius * 2.1, y: -radius * 2.1 }, { x: -radius * 2.1, y: -radius * 2.1 }
    ];
    for (const offset of offsets) {
      const candidate = { x: clamp(base.x + offset.x, PLAY.left + radius, PLAY.right - radius), y: clamp(base.y + offset.y, PLAY.top + radius, PLAY.bottom - radius) };
      const open = state.balls.every(ball => {
        if (!ball.active || ball === movingBall || ignoredIds.includes(ball.id)) return true;
        return Math.hypot(candidate.x - ball.x, candidate.y - ball.y) > radius + ball.radius + 0.8;
      });
      if (open) return candidate;
    }
    return base;
  }

  function placeBall(ball, base, ignoredIds = []) {
    const spot = findOpenSpot(base, ball, ignoredIds);
    ball.x = spot.x;
    ball.y = spot.y;
    ball.vx = 0;
    ball.vy = 0;
    ball.active = true;
  }

  function removePocketedCueAndRespawn() {
    const cue = getCueBall();
    if (!cue || !state.cueScratched) return;
    const base = { x: state.mode === 'snooker' ? 238 : 292, y: WORLD.height / 2 };
    placeBall(cue, base, [0]);
  }

  function respotSnookerColor(ball) {
    if (!ball?.spot) return;
    placeBall(ball, ball.spot, [ball.id]);
  }

  function respotPocketedSnookerColors(pottedIds) {
    for (const id of pottedIds) {
      const ball = getBall(id);
      if (ball?.kind === 'color') respotSnookerColor(ball);
    }
  }

  function restoreNineBall() {
    const nine = getBall(9);
    if (!nine || nine.active) return;
    placeBall(nine, { x: 810, y: WORLD.height / 2 }, [9]);
  }

  function assignGroups(firstPocketedId) {
    if (state.groups[0] || !groupOf(firstPocketedId)) return;
    const starterGroup = groupOf(firstPocketedId);
    state.groups[state.shotOwner] = starterGroup;
    state.groups[1 - state.shotOwner] = starterGroup === 'solid' ? 'stripe' : 'solid';
    updateScoreForGroup(0, state.groups[0]);
    updateScoreForGroup(1, state.groups[1]);
  }

  function legalEightFirstHit(id, group) {
    if (!id) return false;
    if (group) return isGroupCleared(group) ? id === 8 : groupOf(id) === group;
    return id !== 8;
  }

  function legalSnookerFirstHit(ball, target) {
    if (!ball) return false;
    if (target === 'red') return ball.kind === 'red';
    if (target === 'color') return ball.kind === 'color';
    return ball.kind === 'color' && ball.key === target;
  }

  function showFoul(message) {
    ui.foulToast.textContent = message;
    ui.foulToast.classList.add('show');
    clearTimeout(showFoul.timer);
    showFoul.timer = setTimeout(() => ui.foulToast.classList.remove('show'), 1800);
  }

  function settleTurn(continueShooting = false) {
    if (!continueShooting) state.turn = 1 - state.shotOwner;
    state.phase = 'aim';
    state.pocketedThisShot = [];
    updateUi();
    scheduleAiIfNeeded();
  }

  function setSnookerNextTargetAfterMiss() {
    if (activeReds().length) {
      state.snookerTarget = 'red';
      state.snookerAwaitingFinalColor = false;
      return;
    }
    state.snookerTarget = nextSnookerColor()?.key || null;
    state.snookerAwaitingFinalColor = false;
  }

  function resolveEightShot(shooter, potted) {
    const pottedObjects = potted.filter(id => id !== 0);
    const eightPocketed = potted.includes(8);
    const groupBefore = state.groups[shooter];
    if (pottedObjects.some(id => id !== 8)) assignGroups(pottedObjects.find(id => id !== 8));
    const group = state.groups[shooter];

    if (eightPocketed) {
      const groupWon = group && isGroupCleared(group);
      if (groupWon) finishGame(shooter, shooter === 0 ? 'eight' : 'ai-eight');
      else finishGame(1 - shooter, shooter === 0 ? 'early-eight' : 'ai-early-eight');
      return;
    }

    if (state.cueScratched || !legalEightFirstHit(state.firstHit, groupBefore)) {
      removePocketedCueAndRespawn();
      showFoul(state.cueScratched ? '犯规 · 白球落袋，球已复位' : '犯规 · 未先碰到本方目标球');
      settleTurn(false);
      return;
    }

    let scored = 0;
    if (group) {
      scored = pottedObjects.filter(id => groupOf(id) === group).length;
      state.scores[shooter] += scored;
    }
    updateScoreForGroup(0, state.groups[0]);
    updateScoreForGroup(1, state.groups[1]);
    if (scored > 0) playTone(580, 0.12, 0.035, 'sine', 840);
    settleTurn(scored > 0);
  }

  function resolveNineShot(shooter, potted) {
    const pottedObjects = potted.filter(id => id !== 0);
    const ninePotted = potted.includes(9);
    const legalHit = state.firstHit !== null && state.firstHit === state.targetAtShot;
    const foul = state.cueScratched || !legalHit;

    if (ninePotted && !foul) {
      state.scores[shooter] += pottedObjects.length;
      finishGame(shooter, shooter === 0 ? 'nine' : 'ai-nine');
      return;
    }

    if (foul) {
      if (ninePotted) restoreNineBall();
      removePocketedCueAndRespawn();
      showFoul(state.cueScratched ? '犯规 · 白球落袋，球已复位' : `犯规 · 必须先碰 ${state.targetAtShot || '最小号'} 号球`);
      settleTurn(false);
      return;
    }

    const scored = pottedObjects.length;
    state.scores[shooter] += scored;
    if (scored > 0) playTone(580, 0.12, 0.035, 'sine', 840);
    settleTurn(scored > 0);
  }

  function snookerPenalty(target, firstHit, pottedIds) {
    let penalty = 4;
    const targetValue = target === 'red' ? 1 : target === 'color' ? 7 : snookerColorMeta(target)?.value || 4;
    penalty = Math.max(penalty, targetValue);
    if (firstHit) penalty = Math.max(penalty, firstHit.value || 1);
    for (const id of pottedIds) {
      const ball = getBall(id);
      if (ball?.kind === 'color') penalty = Math.max(penalty, ball.value || 4);
    }
    return penalty;
  }

  function resolveSnookerShot(shooter, potted) {
    const target = state.snookerTargetAtShot;
    const firstHit = state.firstHit ? getBall(state.firstHit) : null;
    const pottedObjects = potted.filter(id => id !== 0);
    const pottedColors = pottedObjects.filter(id => getBall(id)?.kind === 'color');
    const pottedReds = pottedObjects.filter(id => getBall(id)?.kind === 'red');
    const legalHit = legalSnookerFirstHit(firstHit, target);
    const foul = state.cueScratched || !legalHit;

    if (foul) {
      const penalty = snookerPenalty(target, firstHit, pottedObjects);
      state.scores[1 - shooter] += penalty;
      respotPocketedSnookerColors(pottedObjects);
      removePocketedCueAndRespawn();
      setSnookerNextTargetAfterMiss();
      showFoul(`犯规 · 对手获得 ${penalty} 分`);
      settleTurn(false);
      return;
    }

    if (target === 'red') {
      if (pottedReds.length) {
        state.scores[shooter] += pottedReds.length;
        const redsLeft = activeReds().length;
        state.snookerTarget = 'color';
        state.snookerAwaitingFinalColor = redsLeft === 0;
        playTone(580, 0.12, 0.035, 'sine', 840);
        settleTurn(true);
      } else {
        setSnookerNextTargetAfterMiss();
        settleTurn(false);
      }
      return;
    }

    if (target === 'color') {
      if (pottedColors.length) {
        const scoringBall = getBall(pottedColors[0]);
        state.scores[shooter] += scoringBall?.value || 0;
        const wasFinalColor = state.snookerAwaitingFinalColor;
        respotPocketedSnookerColors(pottedColors);
        if (wasFinalColor) {
          const next = nextSnookerColor();
          state.snookerTarget = next?.key || null;
          state.snookerAwaitingFinalColor = false;
        } else {
          state.snookerTarget = 'red';
        }
        playTone(620, 0.12, 0.035, 'sine', 900);
        settleTurn(true);
      } else {
        const wasFinalColor = state.snookerAwaitingFinalColor;
        if (wasFinalColor) {
          respotPocketedSnookerColors(pottedColors);
          state.snookerAwaitingFinalColor = false;
          state.snookerTarget = nextSnookerColor()?.key || null;
        } else {
          state.snookerTarget = 'red';
        }
        settleTurn(false);
      }
      return;
    }

    const expected = snookerColorMeta(target);
    if (expected && pottedObjects.includes(expected.id)) {
      state.scores[shooter] += expected.value;
      const isBlack = expected.key === 'black';
      const next = nextSnookerColor();
      if (isBlack || !next) {
        const winner = state.scores[0] === state.scores[1] ? shooter : (state.scores[0] > state.scores[1] ? 0 : 1);
        finishGame(winner, 'snooker-clear');
        return;
      }
      state.snookerTarget = next.key;
      playTone(580 + expected.value * 35, 0.12, 0.035, 'sine', 900);
      settleTurn(true);
      return;
    }

    state.snookerTarget = nextSnookerColor()?.key || null;
    settleTurn(false);
  }

  function resolveShot() {
    if (state.phase !== 'simulating') return;
    const shooter = state.shotOwner;
    const potted = [...state.pocketedThisShot];
    if (state.mode === 'nine') resolveNineShot(shooter, potted);
    else if (state.mode === 'snooker') resolveSnookerShot(shooter, potted);
    else resolveEightShot(shooter, potted);
  }

  function scheduleAiIfNeeded() {
    if (state.turn === 1 && state.phase === 'aim') scheduleAiTurn(920);
  }

  function scheduleAiTurn(delay) {
    const token = ++state.token;
    state.phase = 'ai';
    updateUi();
    setTimeout(() => {
      if (token !== state.token || !state.started || state.phase !== 'ai') return;
      calculateAiShot();
      state.phase = 'aim';
      updateUi();
      setTimeout(() => {
        if (token !== state.token || !state.started || state.phase !== 'aim' || state.turn !== 1) return;
        fireShot(state.power, state.aimAngle);
      }, 720);
    }, delay);
  }

  function pathObstruction(from, to, ignoredIds = [], movingRadius = 13.4) {
    const segment = { x: to.x - from.x, y: to.y - from.y };
    const length = Math.hypot(segment.x, segment.y) || 1;
    const ux = segment.x / length;
    const uy = segment.y / length;
    let penalty = 0;
    for (const ball of state.balls) {
      if (!ball.active || ignoredIds.includes(ball.id)) continue;
      const relX = ball.x - from.x;
      const relY = ball.y - from.y;
      const projection = clamp(relX * ux + relY * uy, 0, length);
      const closestX = from.x + ux * projection;
      const closestY = from.y + uy * projection;
      const clearance = Math.hypot(ball.x - closestX, ball.y - closestY);
      const safeDistance = movingRadius + ball.radius + 3;
      if (clearance < safeDistance && projection > movingRadius) {
        penalty += (safeDistance - clearance) * 15 + 180;
      }
    }
    return penalty;
  }

  function aiTargetCandidates() {
    if (state.mode === 'eight') {
      const aiGroup = state.groups[1];
      const aiHasCleared = aiGroup && isGroupCleared(aiGroup);
      let candidates = state.balls.filter(ball => ball.active && ball.id !== 0 && ball.id !== 8);
      if (aiGroup) candidates = candidates.filter(ball => groupOf(ball.id) === aiGroup);
      if (aiHasCleared || !candidates.length) {
        const eight = getBall(8);
        candidates = eight?.active ? [eight] : [];
      }
      return candidates;
    }
    if (state.mode === 'nine') {
      const target = lowestNineBall();
      return target ? [target] : [];
    }
    if (state.mode === 'snooker') {
      if (state.snookerTarget === 'red') return activeReds();
      if (state.snookerTarget === 'color') return activeColors();
      const meta = snookerColorMeta(state.snookerTarget);
      const ball = meta ? getBall(meta.id) : null;
      return ball?.active ? [ball] : [];
    }
    return [];
  }

  function calculateAiShot() {
    const cue = getCueBall();
    const candidates = aiTargetCandidates();
    let best = null;
    const maxPower = state.mode === 'snooker' ? 0.72 : state.mode === 'nine' ? 0.78 : 0.88;

    for (const target of candidates) {
      for (const pocket of POCKETS) {
        const sumRadius = cue.radius + target.radius;
        const toPocket = normalize(pocket.x - target.x, pocket.y - target.y);
        const cueTarget = {
          x: target.x - toPocket.x * sumRadius * 1.02,
          y: target.y - toPocket.y * sumRadius * 1.02
        };
        const toTarget = normalize(cueTarget.x - cue.x, cueTarget.y - cue.y);
        const targetToCue = normalize(cue.x - target.x, cue.y - target.y);
        const cut = toTarget.x * targetToCue.x + toTarget.y * targetToCue.y;
        if (cut < 0.16) continue;
        const cueDistance = distance(cue, cueTarget);
        const pocketDistance = distance(target, pocket);
        const blockerPenalty = pathObstruction(cue, cueTarget, [0, target.id], cue.radius)
          + pathObstruction(target, pocket, [target.id], target.radius);
        const cutPenalty = (1 - cut) * (state.mode === 'snooker' ? 430 : 340);
        const score = cueDistance + pocketDistance * 0.74 + blockerPenalty + cutPenalty + Math.random() * 34;
        if (!best || score < best.score) {
          best = { target, pocket, cueTarget, direction: toTarget, score, cut, cueDistance, pocketDistance };
        }
      }
    }

    if (!best && candidates[0]) {
      const target = candidates[0];
      best = { direction: normalize(target.x - cue.x, target.y - cue.y), cut: 0.2, cueDistance: distance(cue, target), pocketDistance: 500 };
    }
    if (!best) {
      state.aimAngle = Math.random() * Math.PI * 2;
      state.power = 0.5;
      syncPowerUi();
      return;
    }

    const baseAccuracy = state.mode === 'snooker' ? 0.018 : 0.024;
    const accuracy = clamp(baseAccuracy - best.cut * 0.012, 0.007, baseAccuracy);
    state.aimAngle = Math.atan2(best.direction.y, best.direction.x) + random(-accuracy, accuracy);
    const suggested = clamp(0.46 + (best.cueDistance + best.pocketDistance) / 2500, 0.5, maxPower);
    state.power = suggested;
    syncPowerUi();
  }

  function resizeCanvas() {
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, Math.round(stage.clientWidth || rect.width));
    const height = Math.max(1, Math.round(stage.clientHeight || rect.height));
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    state.dpr = dpr;
    state.viewport.width = width;
    state.viewport.height = height;
    state.viewport.portrait = height > width * 1.05;
    state.viewport.scale = Math.min(
      width / (state.viewport.portrait ? WORLD.height : WORLD.width),
      height / (state.viewport.portrait ? WORLD.width : WORLD.height)
    ) * 0.975;
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  }

  function scheduleCanvasResize() {
    requestAnimationFrame(resizeCanvas);
    setTimeout(resizeCanvas, 80);
    setTimeout(resizeCanvas, 350);
  }

  function withWorldTransform(callback) {
    const { width, height, portrait, scale } = state.viewport;
    ctx.save();
    ctx.translate(width / 2, height / 2);
    if (portrait) ctx.rotate(Math.PI / 2);
    ctx.scale(scale, scale);
    ctx.translate(-WORLD.width / 2, -WORLD.height / 2);
    callback();
    ctx.restore();
  }

  function createLinearGradient(x0, y0, x1, y1, stops) {
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [offset, color] of stops) gradient.addColorStop(offset, color);
    return gradient;
  }

  function drawDiamond(x, y, rotation = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.moveTo(0, -4.5);
    ctx.lineTo(3.7, 0);
    ctx.lineTo(0, 4.5);
    ctx.lineTo(-3.7, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 238, 192, .58)';
    ctx.shadowColor = 'rgba(255, 218, 141, .34)';
    ctx.shadowBlur = 5;
    ctx.fill();
    ctx.restore();
  }

  function drawPocket(pocket) {
    const pocketScale = state.mode === 'snooker' ? 0.9 : 1;
    const radius = (pocket.corner ? 34 : 31) * pocketScale;
    ctx.save();
    ctx.translate(pocket.x, pocket.y);

    const bezel = ctx.createRadialGradient(-6, -7, 2, 0, 0, radius + 4);
    bezel.addColorStop(0, 'rgba(228, 202, 145, .72)');
    bezel.addColorStop(0.45, 'rgba(91, 64, 35, .9)');
    bezel.addColorStop(1, 'rgba(20, 15, 11, .2)');
    ctx.beginPath();
    ctx.arc(0, 0, radius + 4.5, 0, Math.PI * 2);
    ctx.fillStyle = bezel;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    const hole = ctx.createRadialGradient(-5, -6, 1, 0, 0, radius);
    hole.addColorStop(0, '#101414');
    hole.addColorStop(0.56, '#030505');
    hole.addColorStop(1, '#000');
    ctx.fillStyle = hole;
    ctx.shadowColor = 'rgba(0,0,0,.72)';
    ctx.shadowBlur = 13;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, radius - 3, Math.PI * 1.1, Math.PI * 1.84);
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawTable() {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.48)';
    ctx.shadowBlur = 25;
    ctx.shadowOffsetY = 12;
    roundRectPath(ctx, 2, 2, WORLD.width - 4, WORLD.height - 4, 36);
    ctx.fillStyle = state.mode === 'snooker' ? '#2a100c' : '#42230f';
    ctx.fill();
    ctx.restore();

    const snooker = state.mode === 'snooker';
    const wood = createLinearGradient(0, 0, WORLD.width, WORLD.height, snooker ? [
      [0, '#32130e'], [0.24, '#6c3120'], [0.5, '#28100d'],
      [0.76, '#713421'], [1, '#1f0d0a']
    ] : [
      [0, '#7d4926'], [0.22, '#ad6d39'], [0.5, '#6c3d21'],
      [0.76, '#a56335'], [1, '#4d2917']
    ]);
    roundRectPath(ctx, 0, 0, WORLD.width, WORLD.height, 35);
    ctx.fillStyle = wood;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 221, 163, .22)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const railHighlight = createLinearGradient(0, 10, 0, 57, [
      [0, 'rgba(255,231,184,.22)'], [0.26, 'rgba(255,255,255,.03)'], [1, 'rgba(0,0,0,.18)']
    ]);
    roundRectPath(ctx, 18, 18, WORLD.width - 36, WORLD.height - 36, 26);
    ctx.fillStyle = railHighlight;
    ctx.fill();
    ctx.strokeStyle = 'rgba(36, 17, 7, .55)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.save();
    roundRectPath(ctx, 59, 57, WORLD.width - 118, WORLD.height - 114, 25);
    ctx.fillStyle = state.clothPattern || '#08735d';
    ctx.fill();
    const clothLight = ctx.createRadialGradient(WORLD.width * 0.5, WORLD.height * 0.44, 40, WORLD.width * 0.5, WORLD.height * 0.5, 575);
    clothLight.addColorStop(0, snooker ? 'rgba(176, 239, 196, .07)' : 'rgba(80, 210, 165, .09)');
    clothLight.addColorStop(0.62, 'rgba(255,255,255,0)');
    clothLight.addColorStop(1, snooker ? 'rgba(16, 39, 24, .38)' : 'rgba(0, 29, 23, .34)');
    ctx.fillStyle = clothLight;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = snooker ? 'rgba(3, 39, 24, .68)' : 'rgba(2, 49, 39, .57)';
    ctx.lineWidth = 6;
    ctx.strokeRect(PLAY.left - 8, PLAY.top - 8, PLAY.right - PLAY.left + 16, PLAY.bottom - PLAY.top + 16);
    ctx.strokeStyle = 'rgba(139, 255, 213, .12)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(PLAY.left - 3, PLAY.top - 3, PLAY.right - PLAY.left + 6, PLAY.bottom - PLAY.top + 6);
    ctx.restore();

    const longDiamondXs = [154, 253, 352, 451, 649, 748, 847, 946];
    for (const x of longDiamondXs) {
      drawDiamond(x, 34);
      drawDiamond(x, WORLD.height - 34);
    }
    const shortDiamondYs = [164, 275, 386];
    for (const y of shortDiamondYs) {
      drawDiamond(28, y);
      drawDiamond(WORLD.width - 28, y);
    }

    if (snooker) {
      const baulkX = 292;
      const dRadius = 94;
      ctx.save();
      ctx.strokeStyle = 'rgba(226, 255, 238, .2)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(baulkX, PLAY.top + 6);
      ctx.lineTo(baulkX, PLAY.bottom - 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(baulkX, WORLD.height / 2, dRadius, Math.PI / 2, Math.PI * 1.5);
      ctx.stroke();
      for (const meta of SNOOKER_COLORS) {
        ctx.beginPath();
        ctx.arc(meta.spot.x, meta.spot.y, 2.1, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(235, 255, 243, .22)';
        ctx.fill();
      }
      ctx.restore();
    } else {
      const headLineX = 292;
      ctx.beginPath();
      ctx.moveTo(headLineX, PLAY.top + 6);
      ctx.lineTo(headLineX, PLAY.bottom - 6);
      ctx.strokeStyle = 'rgba(218, 255, 242, .13)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const pocket of POCKETS) drawPocket(pocket);

    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.moveTo(45, 47);
    ctx.lineTo(140, 47);
    ctx.moveTo(960, 503);
    ctx.lineTo(1055, 503);
    ctx.strokeStyle = '#fff2cd';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawBall(ball) {
    const r = ball.radius;
    ctx.save();
    ctx.translate(ball.x, ball.y);

    ctx.beginPath();
    ctx.ellipse(r * 0.14, r * 0.32, r * 1.09, r * 0.82, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.shadowColor = 'rgba(0,0,0,.42)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();

    if (ball.id === 0) {
      ctx.fillStyle = '#f6f0d7';
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.beginPath();
      ctx.arc(-r * 0.34, -r * 0.28, r * 0.11, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(166, 49, 40, .72)';
      ctx.fill();
    } else if (ball.kind === 'red' || ball.kind === 'color') {
      ctx.fillStyle = ball.ballColor;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      if (ball.kind === 'red') {
        ctx.beginPath();
        ctx.arc(-r * 0.28, -r * 0.32, r * 0.13, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,.12)';
        ctx.fill();
      }
    } else {
      const stripe = ball.kind === 'stripe' || isStripe(ball.id);
      ctx.fillStyle = stripe ? '#f6f3e7' : (BALL_COLORS[ball.id] || '#ddd');
      ctx.fillRect(-r, -r, r * 2, r * 2);
      if (stripe) {
        ctx.save();
        ctx.rotate(ball.rotation * 0.16);
        ctx.fillStyle = BALL_COLORS[ball.id];
        ctx.fillRect(-r * 1.15, -r * 0.47, r * 2.3, r * 0.94);
        ctx.restore();
      }

      ctx.save();
      ctx.rotate(ball.rotation * 0.11);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.39, 0, Math.PI * 2);
      ctx.fillStyle = '#fbfaf2';
      ctx.fill();
      ctx.font = `800 ${r * 0.61}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = ball.id === 8 ? '#18201f' : '#171919';
      ctx.fillText(String(ball.id), 0, r * 0.04);
      ctx.restore();
    }

    const shade = ctx.createRadialGradient(-r * 0.38, -r * 0.42, r * 0.05, 0, 0, r * 1.04);
    shade.addColorStop(0, 'rgba(255,255,255,.82)');
    shade.addColorStop(0.13, 'rgba(255,255,255,.24)');
    shade.addColorStop(0.52, 'rgba(255,255,255,0)');
    shade.addColorStop(0.78, 'rgba(0,0,0,.12)');
    shade.addColorStop(1, 'rgba(0,0,0,.58)');
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(0, 0, r - 0.4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,.19)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.restore();
  }

  function predictShot() {
    const cue = state.balls[0];
    if (!cue?.active) return null;
    const dx = Math.cos(state.aimAngle);
    const dy = Math.sin(state.aimAngle);
    let best = null;

    for (const ball of state.balls) {
      if (!ball.active || ball.id === 0) continue;
      const relX = ball.x - cue.x;
      const relY = ball.y - cue.y;
      const projection = relX * dx + relY * dy;
      if (projection <= 0) continue;
      const perpendicularSq = relX * relX + relY * relY - projection * projection;
      const collisionRadius = cue.radius + ball.radius;
      if (perpendicularSq > collisionRadius * collisionRadius) continue;
      const t = projection - Math.sqrt(Math.max(0, collisionRadius * collisionRadius - perpendicularSq));
      if (t < 0) continue;
      if (!best || t < best.t) best = { t, ball };
    }

    let railT = Infinity;
    if (dx > 0) railT = Math.min(railT, (PLAY.right - cue.radius - cue.x) / dx);
    if (dx < 0) railT = Math.min(railT, (PLAY.left + cue.radius - cue.x) / dx);
    if (dy > 0) railT = Math.min(railT, (PLAY.bottom - cue.radius - cue.y) / dy);
    if (dy < 0) railT = Math.min(railT, (PLAY.top + cue.radius - cue.y) / dy);
    if (railT >= 0 && (!best || railT < best.t)) {
      best = { t: railT, ball: null };
    }

    if (!best) return null;
    return {
      ball: best.ball,
      endpoint: { x: cue.x + dx * best.t, y: cue.y + dy * best.t }
    };
  }

  function drawAim() {
    const cue = state.balls[0];
    if (!cue?.active || !state.started || !['aim', 'ai'].includes(state.phase)) return;
    const dx = Math.cos(state.aimAngle);
    const dy = Math.sin(state.aimAngle);
    const prediction = predictShot();
    const visible = state.phase === 'aim' || state.turn === 1;

    if (visible && prediction) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cue.x, cue.y);
      ctx.lineTo(prediction.endpoint.x, prediction.endpoint.y);
      ctx.strokeStyle = state.turn === 0 ? 'rgba(236,255,248,.7)' : 'rgba(255,208,119,.55)';
      ctx.lineWidth = 1.7;
      ctx.setLineDash([10, 9]);
      ctx.shadowColor = state.turn === 0 ? 'rgba(151,255,220,.32)' : 'rgba(255,192,75,.3)';
      ctx.shadowBlur = 7;
      ctx.stroke();
      ctx.setLineDash([]);

      if (prediction.ball) {
        ctx.beginPath();
        ctx.arc(prediction.endpoint.x, prediction.endpoint.y, cue.radius, 0, Math.PI * 2);
        ctx.strokeStyle = state.turn === 0 ? 'rgba(235,255,248,.68)' : 'rgba(255,213,133,.58)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        const objectDirection = normalize(prediction.ball.x - prediction.endpoint.x, prediction.ball.y - prediction.endpoint.y);
        ctx.beginPath();
        ctx.moveTo(prediction.ball.x, prediction.ball.y);
        ctx.lineTo(prediction.ball.x + objectDirection.x * 115, prediction.ball.y + objectDirection.y * 115);
        ctx.strokeStyle = 'rgba(255, 220, 144, .46)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 8]);
        ctx.stroke();
      }
      ctx.restore();
    }

    const pull = 25 + state.power * 42;
    const stickLength = 245;
    const tipX = cue.x - dx * (cue.radius + 7 + pull);
    const tipY = cue.y - dy * (cue.radius + 7 + pull);
    const endX = tipX - dx * stickLength;
    const endY = tipY - dy * stickLength;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(endX, endY);
    const stickGradient = ctx.createLinearGradient(tipX, tipY, endX, endY);
    stickGradient.addColorStop(0, '#f4d69b');
    stickGradient.addColorStop(0.16, '#b87135');
    stickGradient.addColorStop(1, '#3b1b0e');
    ctx.strokeStyle = stickGradient;
    ctx.lineWidth = 8;
    ctx.shadowColor = 'rgba(0,0,0,.42)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - dx * 12, tipY - dy * 12);
    ctx.strokeStyle = '#3f91a4';
    ctx.lineWidth = 7;
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
  }

  function drawWorld() {
    drawTable();
    const activeBalls = state.balls.filter(ball => ball.active && ball.id !== 0);
    for (const ball of activeBalls) drawBall(ball);
    if (state.balls[0]?.active) drawBall(state.balls[0]);
    drawAim();
  }

  function draw() {
    const { width, height } = state.viewport;
    const dpr = state.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    withWorldTransform(drawWorld);
  }

  function pointerToWorld(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const { width, height, portrait, scale } = state.viewport;
    if (portrait) {
      return {
        x: WORLD.width / 2 + (y - height / 2) / scale,
        y: WORLD.height / 2 - (x - width / 2) / scale
      };
    }
    return {
      x: WORLD.width / 2 + (x - width / 2) / scale,
      y: WORLD.height / 2 + (y - height / 2) / scale
    };
  }

  function aimAtPointer(event) {
    if (!state.started || state.phase !== 'aim' || state.turn !== 0) return;
    const cue = state.balls[0];
    if (!cue?.active) return;
    const point = pointerToWorld(event);
    const dx = point.x - cue.x;
    const dy = point.y - cue.y;
    if (Math.hypot(dx, dy) < 14) return;
    state.aimAngle = Math.atan2(dy, dx);
    ui.aimTip.style.opacity = '0';
  }

  canvas.addEventListener('pointerdown', event => {
    if (state.phase !== 'aim' || state.turn !== 0) return;
    state.aiming = true;
    canvas.setPointerCapture?.(event.pointerId);
    aimAtPointer(event);
  });
  canvas.addEventListener('pointermove', event => {
    if (!state.aiming) return;
    event.preventDefault();
    aimAtPointer(event);
  });
  canvas.addEventListener('pointerup', event => {
    state.aiming = false;
    try { canvas.releasePointerCapture?.(event.pointerId); } catch (_) {}
  });
  canvas.addEventListener('pointercancel', () => { state.aiming = false; });

  ui.shoot.addEventListener('click', () => {
    initAudio();
    if (state.phase === 'aim' && state.turn === 0 && state.started) {
      fireShot(state.power, state.aimAngle);
    }
  });

  ui.power.addEventListener('input', event => {
    state.power = Number(event.target.value) / 100;
    syncPowerUi();
  });

  function selectMode(mode) {
    if (!MODE_META[mode]) return;
    state.mode = mode;
    try { localStorage.setItem('dawn-billiards-mode', mode); } catch (_) {}
    resetGame();
  }

  ui.modePicker.addEventListener('click', event => {
    const button = event.target.closest('.mode-option');
    if (button) selectMode(button.dataset.mode);
  });
  ui.start.addEventListener('click', beginGame);
  ui.playAgain.addEventListener('click', () => {
    resetGame();
    beginGame();
  });
  ui.resultMode.addEventListener('click', resetGame);
  ui.modeButton.addEventListener('click', resetGame);
  ui.reset.addEventListener('click', () => {
    resetGame();
    beginGame();
  });
  ui.sound.addEventListener('click', () => {
    state.sounds = !state.sounds;
    ui.sound.classList.toggle('is-muted', !state.sounds);
    ui.sound.textContent = state.sounds ? '♪' : '×';
    if (state.sounds) {
      initAudio();
      playTone(520, 0.08, 0.025, 'sine', 720);
    }
  });

  window.addEventListener('keydown', event => {
    if (!state.started || state.phase !== 'aim' || state.turn !== 0) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      fireShot(state.power, state.aimAngle);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      state.aimAngle -= event.shiftKey ? 0.06 : 0.018;
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      state.aimAngle += event.shiftKey ? 0.06 : 0.018;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      state.power = clamp(state.power + 0.03, 0.12, 1);
      syncPowerUi();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      state.power = clamp(state.power - 0.03, 0.12, 1);
      syncPowerUi();
    }
  });

  let previousTime = performance.now();
  function frame(time) {
    const dt = Math.min(0.035, Math.max(0, (time - previousTime) / 1000));
    previousTime = time;
    if (state.phase === 'simulating') {
      const substeps = 4;
      for (let i = 0; i < substeps; i++) stepPhysics(dt / substeps);
      if (!anyBallMoving()) resolveShot();
    }
    draw();
    requestAnimationFrame(frame);
  }

  if ('ResizeObserver' in window) {
    new ResizeObserver(scheduleCanvasResize).observe(stage);
  } else {
    window.addEventListener('resize', scheduleCanvasResize);
  }
  window.addEventListener('orientationchange', () => setTimeout(scheduleCanvasResize, 180));
  window.visualViewport?.addEventListener('resize', scheduleCanvasResize);
  document.fonts?.ready.then(scheduleCanvasResize);

  function updateOfflineStatus(ready = false) {
    const status = ui.offlineStatus.querySelector('span');
    if (!navigator.onLine) {
      ui.offlineStatus.className = 'offline-status is-offline';
      status.textContent = '离线模式 · 游戏仍可继续';
    } else if (ready) {
      ui.offlineStatus.className = 'offline-status is-ready';
      status.textContent = '已缓存 · 断网也能玩';
    } else if (location.protocol === 'file:') {
      status.textContent = '部署后支持离线安装';
    } else {
      status.textContent = '正在准备离线资源';
    }
  }

  function setupOfflineMode() {
    updateOfflineStatus(false);
    window.addEventListener('online', () => updateOfflineStatus(Boolean(navigator.serviceWorker?.controller)));
    window.addEventListener('offline', () => updateOfflineStatus(false));

    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      state.installPrompt = event;
      ui.install.hidden = false;
    });

    ui.install.addEventListener('click', async () => {
      if (!state.installPrompt) return;
      state.installPrompt.prompt();
      await state.installPrompt.userChoice;
      state.installPrompt = null;
      ui.install.hidden = true;
    });

    window.addEventListener('appinstalled', () => {
      state.installPrompt = null;
      ui.install.hidden = true;
      updateOfflineStatus(true);
    });

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then(() => {
        updateOfflineStatus(true);
      }).catch(() => {
        const status = ui.offlineStatus.querySelector('span');
        status.textContent = '离线缓存准备失败';
      });
    }
  }

  state.mode = loadPreferredMode();
  ensureClothPattern();
  resetGame();
  setupOfflineMode();
  scheduleCanvasResize();
  requestAnimationFrame(frame);
})();




