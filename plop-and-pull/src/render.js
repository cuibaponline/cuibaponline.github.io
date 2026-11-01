// Draws the sea. Reads the simulation, never changes it.
import { BIG_TUG, CREATURES, LEVELS, RIDER_SLOTS, SEA_SCALE, WORLD } from './data.js';
import {
  circle, drawBoat, drawBubble, drawCloud, drawCreature, drawFind, drawHand, drawPearl, drawRingBack, drawRingFront,
  drawShadow, drawStar, drawThing, INK, pen, shape, sprite, spriteBytes, stamp,
} from './art.js';

const TAU = Math.PI * 2;
const FONT = '"Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';
const MAX_PARTICLES = 150;
const MAX_PEARLS = 40;
const SURFACE = WORLD.surface;
const LEAP_TOP = 70;
const HULL_REACH = [96, 724];

const SKIES = [
  { from: ['#7fd6f8', '#ffeccb'], to: ['#ffb27a', '#ffe7ae'] },
  { from: ['#4db6f2', '#d8f3ff'], to: ['#ff9a6a', '#ffdc96'] },
  { from: ['#ffb27a', '#ffe7ae'], to: ['#5c4aa3', '#ff8c70'] },
];

// Friends still asleep under the sand on each level, as a promise of what is below.
const SHADOWS = {
  1: [['boxy', 150, 800], ['shelby', 420, 900], ['glim', 660, 780]],
  2: [['glim', 190, 980], ['swoop', 560, 1010]],
  3: [],
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

function mix(a, b, t) {
  const read = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgb(${[0, 1, 2].map((i) => Math.round(lerp(read(a, i), read(b, i), t))).join(',')})`;
}

function paintCoral(c, x, y, size, color, rng) {
  c.strokeStyle = color;
  c.lineCap = 'round';
  const branch = (bx, by, angle, length, width) => {
    if (width < 2.4) return;
    const ex = bx + Math.cos(angle) * length;
    const ey = by + Math.sin(angle) * length;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(bx, by);
    c.lineTo(ex, ey);
    c.stroke();
    branch(ex, ey, angle - 0.45 - rng() * 0.25, length * 0.76, width * 0.72);
    branch(ex, ey, angle + 0.42 + rng() * 0.25, length * 0.72, width * 0.72);
  };
  branch(x, y, -Math.PI / 2, size, size * 0.3);
}

function paintKelp(c, x, y, height, color, rng) {
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 9;
  c.lineCap = 'round';
  const bend = 18 + rng() * 22;
  c.beginPath();
  c.moveTo(x, y);
  for (let i = 1; i <= 8; i++) c.lineTo(x + Math.sin(i * 0.9) * bend, y - (height * i) / 8);
  c.stroke();
  for (let i = 1; i <= 7; i++) {
    const lx = x + Math.sin(i * 0.9) * bend;
    const ly = y - (height * i) / 8;
    const side = i % 2 ? 1 : -1;
    c.beginPath();
    c.ellipse(lx + side * 17, ly - 4, 20, 8, side * -0.5, 0, TAU);
    c.fill();
  }
}

function paintShell(c, x, y, color) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, 13, Math.PI, 0);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(120,70,50,0.45)';
  c.lineWidth = 2;
  c.beginPath();
  for (let a = -0.7; a <= 0.7; a += 0.35) {
    c.moveTo(x, y);
    c.lineTo(x + Math.sin(a) * 12, y - Math.cos(a) * 12);
  }
  c.stroke();
}

function paintStarfish(c, x, y, r, color) {
  c.fillStyle = color;
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const reach = i % 2 ? r * 0.48 : r;
    const a = (i * TAU) / 10 - 1.2;
    c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * reach, y + Math.sin(a) * reach * 0.8);
  }
  c.closePath();
  c.fill();
}

export class View {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.level = 3;
    this.sea = null;
    this.rays = null;
    this.time = 0;
    this.shake = 0;
    this.particles = [];
    this.ripples = [];
    this.leapers = [];
    this.pearls = [];
    this.popups = [];
    this.starBursts = [];
    this.jarShown = 0;
    this.crumble = null;
    this.extras = [];
    this.cheer = [0, 0];
    this.onPearl = null;
    this.onStar = null;
    this.resize();
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.scale = Math.min(width / WORLD.width, height / WORLD.height);
    const viewW = width / this.scale;
    const viewH = height / this.scale;
    this.left = (WORLD.width - viewW) / 2;
    this.right = this.left + viewW;
    // Spare height goes mostly below the sea, so the boats stay near the top of a tall phone.
    this.top = -(viewH - WORLD.height) * 0.3;
    this.bottom = this.top + viewH;
    this.releaseSea();
  }

  // Safari holds on to canvas memory until it is told otherwise, so an old sea is emptied straight away.
  releaseSea() {
    if (this.sea) this.sea.canvas.width = 0;
    this.sea = null;
  }

  toWorld(clientX, clientY) {
    return { x: clientX / this.scale + this.left, y: clientY / this.scale + this.top };
  }

  setLevel(config, { reveal = false } = {}) {
    const previous = LEVELS[config.level - 2]?.floor;
    if (config.level !== this.level) this.releaseSea();
    this.level = config.level;
    this.jarShown = 0;
    this.particles = [];
    this.ripples = [];
    this.leapers = [];
    this.pearls = [];
    this.popups = [];
    this.starBursts = [];
    this.crumble = reveal && previous ? { from: previous, to: config.floor, t: 0 } : null;
  }

  memoryBytes() {
    const sea = this.sea ? this.sea.canvas.width * this.sea.canvas.height * 4 : 0;
    return this.canvas.width * this.canvas.height * 4 + sea + spriteBytes();
  }

  bakeSea() {
    const level = LEVELS[this.level - 1];
    const k = this.scale * this.dpr;
    const top = SURFACE - 14;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil((this.right - this.left) * k);
    canvas.height = Math.ceil((this.bottom - top) * k);
    const c = canvas.getContext('2d', { alpha: false });
    c.setTransform(k, 0, 0, k, -this.left * k, -top * k);
    const rng = seeded(4242 + this.level * 97);

    const water = c.createLinearGradient(0, SURFACE, 0, WORLD.height);
    water.addColorStop(0, '#4fd6e8');
    water.addColorStop(0.14, '#2cb4e6');
    water.addColorStop(0.42, '#1b86d8');
    water.addColorStop(0.72, '#1656b4');
    water.addColorStop(1, '#14337f');
    c.fillStyle = water;
    c.fillRect(this.left, top, this.right - this.left, this.bottom - top);

    c.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 26; i++) {
      c.beginPath();
      circle(c, rng() * WORLD.width, SURFACE + rng() * 420, 40 + rng() * 80, 10 + rng() * 16, rng() * 0.3);
      c.fill();
    }

    const floor = level.floor;
    const sandTop = (x) => floor + Math.sin(x * 0.012) * 12 + Math.sin(x * 0.031 + 1) * 6;

    // Distant reef, kept pale so the bright characters stay in front.
    for (const [depth, alpha] of [[150, 0.14], [64, 0.2]]) {
      c.fillStyle = `rgba(14,44,110,${alpha})`;
      c.beginPath();
      c.moveTo(this.left, floor + 40);
      for (let x = this.left; x <= this.right + 40; x += 40) {
        const side = Math.abs(x - WORLD.halfway) / WORLD.halfway;
        const lift = depth * (0.5 + side * side * 1.6) + Math.sin(x * 0.03 + depth) * 26;
        c.lineTo(x, floor - lift);
      }
      c.lineTo(this.right, floor + 40);
      c.closePath();
      c.fill();
    }

    if (this.level >= 2) {
      for (const x of [34, 92, 716, 782, 150, 664]) {
        paintKelp(c, x, floor + 6, 170 + rng() * 150, rng() < 0.5 ? 'rgba(38,150,120,0.75)' : 'rgba(30,125,110,0.7)', rng);
      }
    }
    for (const [x, size, color] of [[70, 46, '#ff7f9c'], [250, 36, '#ffb24d'], [560, 40, '#c78bff'], [742, 50, '#ff7f7f'], [430, 30, '#5ee0c4']]) {
      paintCoral(c, x + rng() * 20, floor + 8, size, color, rng);
    }
    c.fillStyle = '#ff9db4';
    for (const [x, r] of [[176, 30], [640, 34]]) {
      c.beginPath();
      circle(c, x, floor, r, r * 0.7);
      c.fill();
      c.fillStyle = '#ffc2d2';
      c.beginPath();
      circle(c, x - r * 0.2, floor - r * 0.3, r * 0.45, r * 0.26);
      c.fill();
      c.fillStyle = '#ff9db4';
    }

    const sand = c.createLinearGradient(0, floor - 14, 0, this.bottom);
    sand.addColorStop(0, '#ffe6a6');
    sand.addColorStop(0.2, '#f0c777');
    sand.addColorStop(1, '#b98a4a');
    c.fillStyle = sand;
    c.beginPath();
    c.moveTo(this.left, this.bottom);
    for (let x = this.left; x <= this.right + 20; x += 20) c.lineTo(x, sandTop(x));
    c.lineTo(this.right, this.bottom);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(255,250,225,0.7)';
    c.lineWidth = 5;
    c.beginPath();
    for (let x = this.left; x <= this.right + 20; x += 20) c[x === this.left ? 'moveTo' : 'lineTo'](x, sandTop(x));
    c.stroke();

    c.strokeStyle = 'rgba(150,100,50,0.2)';
    c.lineWidth = 5;
    c.lineCap = 'round';
    const layers = Math.floor((this.bottom - floor) / 62);
    for (let i = 1; i <= layers; i++) {
      c.beginPath();
      const y = floor + i * 62;
      for (let x = this.left; x <= this.right + 40; x += 40) c[x === this.left ? 'moveTo' : 'lineTo'](x, y + Math.sin(x * 0.01 + i) * 12);
      c.stroke();
    }
    paintShell(c, 300, floor + 34, '#ffc7d4');
    paintShell(c, 520, floor + 48, '#ffe0a8');
    paintStarfish(c, 118, floor + 40, 22, '#ff8a5c');
    paintStarfish(c, 690, floor + 56, 18, '#ff6f8f');

    for (const [type, x, y] of SHADOWS[this.level]) {
      if (y < this.bottom - 40) drawShadow(c, type, x, y, 'rgba(120,78,36,0.32)', SEA_SCALE);
    }

    const rays = this.ctx.createLinearGradient(0, SURFACE, 0, SURFACE + 640);
    rays.addColorStop(0, 'rgba(255,255,255,0.2)');
    rays.addColorStop(1, 'rgba(255,255,255,0)');
    this.rays = rays;
    const wall = this.ctx.createLinearGradient(0, SURFACE, 0, WORLD.height);
    wall.addColorStop(0, '#1f6bab');
    wall.addColorStop(0.5, '#143f86');
    wall.addColorStop(1, '#0f2a5e');
    this.wallFill = wall;
    this.sea = { canvas, top };
  }

  // On anything wider than the sea, rock walls hide where fish come and go, so they are drawn over the fish.
  drawWalls() {
    if (this.left >= 0) return;
    const c = this.ctx;
    const top = SURFACE + 36;
    c.fillStyle = this.wallFill;
    for (const [outer, inner] of [[this.left, 0], [this.right, WORLD.width]]) {
      const dir = Math.sign(outer - inner);
      c.beginPath();
      c.moveTo(outer, top);
      c.lineTo(inner + dir * 70, top);
      c.quadraticCurveTo(inner + dir * 8, top + 2, inner + dir * 6, top + 40);
      for (let y = top + 70; y <= this.bottom + 30; y += 30) {
        c.lineTo(inner + dir * (6 + Math.sin(y * 0.02) * 10 + Math.sin(y * 0.053) * 5), y);
      }
      c.lineTo(outer, this.bottom + 30);
      c.closePath();
      c.fill();
    }
  }

  shakeBy(amount) {
    this.shake = Math.max(this.shake, amount);
  }

  spray(x, y, count, power, color = 'rgba(255,255,255,0.9)') {
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const speed = power * (0.4 + Math.random() * 0.8);
      this.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, g: 900, life: 0.5 + Math.random() * 0.4, age: 0, r: 3 + Math.random() * 6, color });
    }
  }

  sparkle(x, y, count, color = '#fff6b0') {
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * TAU;
      const speed = 60 + Math.random() * 160;
      this.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, g: 0, life: 0.4 + Math.random() * 0.3, age: 0, r: 3 + Math.random() * 4, color });
    }
  }

  popup(x, y, text, color = '#fff') {
    this.popups.push({ x, y, text, color, age: 0 });
  }

  addPearls(x, y, total, limit = 10) {
    const count = clamp(total, 1, limit);
    const base = Math.floor(total / count);
    let extra = total - base * count;
    for (let i = 0; i < count && this.pearls.length < MAX_PEARLS; i++) {
      const value = base + (extra-- > 0 ? 1 : 0);
      this.pearls.push({ x, y, cx: x + (Math.random() - 0.5) * 200, cy: y - 120 - Math.random() * 60, t: -i * 0.09, value });
    }
  }

  handleEvent(event, round) {
    if (event.type === 'touch') {
      this.ripples.push({ x: event.x, y: event.y, age: 0 });
    } else if (event.type === 'plop') {
      this.spray(event.x, SURFACE, 12, 300);
    } else if (event.type === 'hop' || event.type === 'hopOn') {
      this.sparkle(event.fish.x, event.fish.y, 8);
    } else if (event.type === 'find') {
      this.sparkle(round.boats[event.boat].ring.x, round.boats[event.boat].ring.y, 8);
    } else if (event.type === 'leap') {
      const side = event.x < WORLD.halfway ? 1 : -1;
      this.spray(event.x, SURFACE, 14 + event.riders.length * 5, 420);
      this.shakeBy(4);
      this.cheer[event.boat] = 1;
      event.riders.forEach((rider, i) => {
        const spread = (i % 2 ? -1 : 1) * Math.ceil(i / 2) * 60;
        this.leapers.push({
          ...rider, t: -i * 0.1, dur: 1.05, x0: event.x + RIDER_SLOTS[i][0] * 0.4, x1: event.x + side * 150 + spread,
          spin: side, flashed: false, splashed: false, pearls: i === 0 ? event.pearls : 0, multiplier: event.multiplier,
        });
      });
    } else if (event.type === 'bubble') {
      this.spray(event.x, event.y, 14, 220, 'rgba(210,245,255,0.9)');
      this.sparkle(event.x, event.y, 8, event.kind === 'double' ? '#ffd84d' : '#ff9db4');
    } else if (event.type === 'breach') {
      this.shakeBy(12);
      this.spray(event.x, SURFACE, 60, 760);
      this.addPearls(event.x, SURFACE - 40, event.pearls, 20);
    }
  }

  stepEffects(round, dt) {
    this.shake = Math.max(0, this.shake - dt * 30);
    this.cheer = this.cheer.map((value) => Math.max(0, value - dt * 2));
    for (const p of this.particles) {
      p.age += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
    for (const r of this.ripples) r.age += dt;
    this.ripples = this.ripples.filter((r) => r.age < 0.55);
    for (const p of this.popups) p.age += dt;
    this.popups = this.popups.filter((p) => p.age < 1.2);
    for (const s of this.starBursts) s.age += dt;
    this.starBursts = this.starBursts.filter((s) => s.age < 1.1);

    for (const leaper of this.leapers) {
      leaper.t += dt;
      const p = leaper.t / leaper.dur;
      if (p >= 0.5 && !leaper.flashed) {
        leaper.flashed = true;
        const x = lerp(leaper.x0, leaper.x1, 0.5);
        this.sparkle(x, LEAP_TOP, 12, '#ffffff');
        if (leaper.pearls) {
          this.addPearls(x, LEAP_TOP, leaper.pearls);
          this.popup(x, LEAP_TOP - 8, `+${leaper.pearls}`, leaper.multiplier > 1 ? '#ffd84d' : '#fff');
        }
      }
      if (p >= 1 && !leaper.splashed) {
        leaper.splashed = true;
        this.spray(leaper.x1, SURFACE, 10, 300);
      }
    }
    this.leapers = this.leapers.filter((leaper) => leaper.t < leaper.dur);

    const jar = this.jarSpot(round);
    for (const pearl of this.pearls) {
      pearl.t += dt / 0.62;
      if (pearl.t < 1 || pearl.done) continue;
      pearl.done = true;
      const before = this.jarShown;
      this.jarShown += pearl.value;
      this.onPearl?.();
      for (const [i, line] of (round?.config.stars ?? []).entries()) {
        if (before >= line || this.jarShown < line) continue;
        this.starBursts.push({ x: jar.x + jar.w / 2, y: this.jarY(jar, line), age: 0, index: i });
        this.onStar?.(i);
      }
    }
    this.pearls = this.pearls.filter((pearl) => !pearl.done);

    if (this.crumble) {
      this.crumble.t += dt / 1.3;
      if (Math.random() < 0.7 && this.crumble.t < 0.9) {
        const y = lerp(this.crumble.from, this.crumble.to, ease(this.crumble.t));
        this.particles.push({ x: Math.random() * WORLD.width, y, vx: 0, vy: 80, g: 500, life: 0.6, age: 0, r: 4 + Math.random() * 5, color: '#f0c777' });
      }
      if (this.crumble.t >= 1) this.crumble = null;
    }
  }

  draw(round, dt, { playing = false, boat = false } = {}) {
    const c = this.ctx;
    this.time += dt;
    this.stepEffects(playing ? round : null, dt);
    if (!this.sea) this.bakeSea();
    const k = this.scale * this.dpr;
    const shakeX = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    c.setTransform(k, 0, 0, k, (shakeX - this.left) * k, (shakeY - this.top) * k);
    c.lineJoin = 'round';
    c.lineCap = 'round';

    this.drawSky(round, playing);
    c.drawImage(this.sea.canvas, this.left, this.sea.top, this.right - this.left, this.bottom - this.sea.top);
    this.drawRays();
    this.drawMotes();
    if (this.crumble) this.drawCrumble();

    if (round.hum && round.hum.state !== 'hidden' && round.hum.state !== 'gone' && round.hum.state !== 'breach') this.drawHum(round.hum);
    for (const bubble of round.bubbles) {
      c.save();
      c.translate(bubble.x, bubble.y);
      drawBubble(c, bubble.kind, this.time + bubble.id);
      c.restore();
    }
    this.drawFish(round);
    this.drawRipples();
    for (const b of round.boats) this.drawLine(b);
    this.drawWalls();
    this.drawWave(10, 8, 0.0105, 1.1, 'rgba(255,255,255,0.28)');
    for (const b of round.boats) this.drawBoatAt(b);
    if (boat) this.drawDecorBoat();
    this.drawWave(22, 6, 0.014, -1.5, 'rgba(79,214,232,0.55)');

    this.drawLeapers();
    if (round.hum?.state === 'breach') this.drawBreach(round.hum);
    this.drawParticles();
    if (playing) this.drawJar(round);
    this.drawPearls(round);
    this.drawPopups();
    if (playing && round.golden) this.drawGlow();
    if (playing) this.drawHands(round);
  }

  drawSky(round, playing) {
    const c = this.ctx;
    const sky = SKIES[playing ? this.level - 1 : 1];
    const p = playing ? round.day / round.duration : 0.3;
    const gradient = c.createLinearGradient(0, this.top, 0, SURFACE);
    gradient.addColorStop(0, mix(sky.from[0], sky.to[0], p));
    gradient.addColorStop(1, mix(sky.from[1], sky.to[1], p));
    c.fillStyle = gradient;
    c.fillRect(this.left, this.top, this.right - this.left, SURFACE - this.top + 2);

    const sunX = lerp(60, 680, p);
    const sunY = SURFACE - 8 - Math.sin(p * Math.PI) * 196;
    const warm = this.level === 3 ? p : p * p;
    const glow = c.createRadialGradient(sunX, sunY, 16, sunX, sunY, 110);
    glow.addColorStop(0, `rgba(255,244,190,${0.75 - warm * 0.2})`);
    glow.addColorStop(1, 'rgba(255,244,190,0)');
    c.fillStyle = glow;
    c.beginPath();
    c.arc(sunX, sunY, 110, 0, TAU);
    c.fill();
    shape(c, mix('#fff3a8', '#ff9a4d', warm), () => c.arc(sunX, sunY, 40, 0, TAU), 0);

    const span = this.right - this.left + 340;
    for (const [id, speed, offset, y] of [[0, 9, 40, 62], [1, 6, 410, 120], [1, 11, 690, 44]]) {
      c.save();
      c.translate(this.left - 170 + ((this.time * speed + offset) % span), y + (this.top < 0 ? this.top * 0.3 : 0));
      c.globalAlpha = 0.9 - p * 0.3;
      drawCloud(c, id);
      c.restore();
    }
    c.globalAlpha = 1;

    const far = this.skyline();
    c.save();
    c.translate(WORLD.halfway, SURFACE + 6);
    stamp(c, far);
    c.restore();
    c.fillStyle = mix('#b8ecf7', '#ffb98a', p * 0.6);
    c.fillRect(this.left, SURFACE - 10, this.right - this.left, 14);
  }

  skyline() {
    if (!this.far) {
      this.far = sprite(880, 90, 440, 84, (c) => {
        c.fillStyle = 'rgba(96,158,178,0.6)';
        c.beginPath();
        c.moveTo(-430, 0);
        c.bezierCurveTo(-370, -66, -280, -60, -210, 0);
        c.closePath();
        c.moveTo(160, 0);
        c.bezierCurveTo(240, -74, 350, -58, 430, 0);
        c.closePath();
        c.fill();
        c.fillStyle = 'rgba(70,140,160,0.6)';
        c.beginPath();
        c.moveTo(-340, 0);
        c.bezierCurveTo(-300, -40, -240, -38, -150, 0);
        c.closePath();
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.75)';
        c.fillRect(-330, -80, 12, 32);
        c.fillStyle = 'rgba(230,90,80,0.8)';
        c.fillRect(-330, -70, 12, 8);
      });
    }
    return this.far;
  }

  drawRays() {
    const c = this.ctx;
    c.fillStyle = this.rays;
    for (let i = 0; i < 5; i++) {
      const x = 90 + i * 160 + Math.sin(this.time * 0.25 + i * 1.7) * 36;
      const lean = 60 + Math.sin(this.time * 0.2 + i) * 30;
      c.beginPath();
      c.moveTo(x - 26, SURFACE);
      c.lineTo(x + 26 + i * 4, SURFACE);
      c.lineTo(x + lean + 70, SURFACE + 640);
      c.lineTo(x + lean - 50, SURFACE + 640);
      c.closePath();
      c.fill();
    }
  }

  drawMotes() {
    const c = this.ctx;
    const height = this.bottom - SURFACE;
    c.fillStyle = 'rgba(255,255,255,0.32)';
    c.beginPath();
    for (let i = 0; i < 22; i++) {
      const speed = 16 + (i % 5) * 7;
      const y = this.bottom - ((this.time * speed + i * 137) % height);
      const x = ((i * 151) % WORLD.width) + Math.sin(this.time + i) * 10;
      const r = 2 + (i % 4);
      c.moveTo(x + r, y);
      c.arc(x, y, r, 0, TAU);
    }
    c.fill();
  }

  drawCrumble() {
    const c = this.ctx;
    const y = lerp(this.crumble.from, this.crumble.to, ease(this.crumble.t));
    c.fillStyle = '#f0c777';
    c.beginPath();
    c.moveTo(this.left, this.crumble.to + 10);
    for (let x = this.left; x <= this.right + 20; x += 20) c.lineTo(x, y + Math.sin(x * 0.02 + this.time * 9) * 10);
    c.lineTo(this.right, this.crumble.to + 10);
    c.closePath();
    c.fill();
  }

  drawHum(hum) {
    const c = this.ctx;
    c.save();
    c.translate(hum.x + Math.sin(this.time * 0.8) * 10, hum.y + Math.sin(this.time * 1.2) * 6);
    drawCreature(c, 'hum', { t: this.time, happy: hum.state === 'tug', lookX: 0.2, lookY: -0.4 });
    c.restore();
  }

  drawBreach(hum) {
    const c = this.ctx;
    const t = hum.t / BIG_TUG.breachTime;
    const up = clamp(t / 0.42, 0, 1);
    const down = clamp((t - 0.42) / 0.45, 0, 1);
    const y = up < 1 ? lerp(BIG_TUG.breachY + 60, 120, ease(up)) : lerp(120, 760, down * down);
    const tilt = up < 1 ? -1.18 : lerp(-1.18, 0.5, ease(down));
    c.save();
    c.translate(hum.x, y);
    c.rotate(tilt);
    c.scale(1.2, 1.2);
    drawCreature(c, 'hum', { t: this.time, happy: true });
    c.restore();
    if (t > 0.72 && !hum.splashed) {
      hum.splashed = true;
      this.spray(hum.x, SURFACE, 70, 860);
      this.shakeBy(10);
      this.onSplash?.();
    }
  }

  drawFish(round) {
    const c = this.ctx;
    const hint = round.hintFish;
    const list = [...round.fish].sort((a, b) => a.y - b.y);
    for (const fish of list) {
      if (fish.state === 'riding') continue;
      c.save();
      c.translate(fish.x, fish.y);
      const glowing = fish.held || fish === hint;
      if (glowing) this.drawHalo(CREATURES[fish.type].radius * (fish.held ? 1.3 : 1));
      if (fish.dir < 0) c.scale(-1, 1);
      if (fish.state === 'waiting') c.translate(0, Math.sin(this.time * 9) * 3);
      drawCreature(c, fish.type, { t: this.time + fish.phase, big: SEA_SCALE * (fish.held ? 1.3 : 1), lookX: 0.5, lookY: fish.state === 'swim' ? 0.1 : -0.8 });
      c.restore();
    }
  }

  drawHalo(radius) {
    const c = this.ctx;
    const pulse = 1 + Math.sin(this.time * 5) * 0.08;
    c.strokeStyle = 'rgba(255,246,176,0.85)';
    c.lineWidth = 7;
    c.beginPath();
    c.arc(0, 0, radius * 1.12 * pulse, 0, TAU);
    c.stroke();
  }

  drawRipples() {
    const c = this.ctx;
    for (const ripple of this.ripples) {
      const p = ripple.age / 0.55;
      c.strokeStyle = `rgba(255,255,255,${0.85 * (1 - p)})`;
      c.lineWidth = 5;
      c.beginPath();
      c.arc(ripple.x, ripple.y, 16 + p * 62, 0, TAU);
      c.stroke();
    }
  }

  rig(boat) {
    const dir = boat.index === 1 ? -1 : 1;
    const hull = clamp(boat.x - dir * 44, HULL_REACH[0], HULL_REACH[1]);
    const bob = Math.sin(this.time * 1.8 + boat.index * 2) * 4;
    const tension = boat.state === 'pull' || boat.state === 'tug' ? 1 : 0;
    return { dir, hull, bob, tension, tipX: hull + dir * (104 - tension * 8), tipY: SURFACE - 128 + bob + tension * 24 };
  }

  drawLine(boat) {
    const c = this.ctx;
    const { tipX, tipY, tension } = this.rig(boat);
    const ring = boat.ring;
    const rest = clamp((ring.y - (SURFACE - 34)) / 110, 0, 1);
    const x = lerp(tipX, ring.x, rest);
    const riders = boat.riders.length > 0;
    const ringY = riders ? ring.y + RIDER_SLOTS[0][1] : ring.y;

    const midX = (tipX + x) / 2 + (tension ? Math.sin(this.time * 44) * 1.5 : -8 * (1 - tension));
    const midY = (tipY + ringY) / 2;
    for (const [color, width] of [['rgba(18,55,90,0.45)', 4.5], ['#ffffff', 2.4]]) {
      c.strokeStyle = color;
      c.lineWidth = width;
      c.beginPath();
      c.moveTo(tipX, tipY);
      c.quadraticCurveTo(midX, midY, x, ringY - 12);
      c.stroke();
    }

    const lead = boat.riders[0];
    const size = lead && !lead.find ? clamp(CREATURES[lead.type].w / 120, 1, 1.5) : 1;
    c.save();
    c.translate(x, ringY);
    c.scale(size * (boat.bigRing ? 1.3 : 1), size * (boat.bigRing ? 1.3 : 1));
    drawRingBack(c);
    c.restore();
    boat.riders.forEach((rider, i) => {
      c.save();
      c.translate(i === 0 ? x : rider.x, rider.y + Math.sin(this.time * 6 + i) * 3);
      if (rider.dir < 0) c.scale(-1, 1);
      c.rotate(-0.28);
      if (rider.find) drawFind(c, rider.type);
      else drawCreature(c, rider.type, { t: this.time + rider.phase, happy: true, big: SEA_SCALE });
      c.restore();
    });
    c.save();
    c.translate(x, ringY);
    c.scale(size * (boat.bigRing ? 1.3 : 1), size * (boat.bigRing ? 1.3 : 1));
    drawRingFront(c);
    c.restore();
  }

  drawWave(y, amplitude, length, speed, fill) {
    const c = this.ctx;
    c.fillStyle = fill;
    c.beginPath();
    c.moveTo(this.left, SURFACE + y + 16);
    for (let x = this.left; x <= this.right + 24; x += 24) {
      c.lineTo(x, SURFACE + y - 14 + Math.sin(x * length + this.time * speed) * amplitude);
    }
    c.lineTo(this.right, SURFACE + y + 16);
    c.closePath();
    c.fill();
  }

  drawBoatAt(boat) {
    const c = this.ctx;
    const { dir, hull, bob, tension, tipX, tipY } = this.rig(boat);
    const cheer = this.cheer[boat.index];
    c.save();
    c.translate(hull, SURFACE - 4 + bob - cheer * 18);
    c.rotate(Math.sin(this.time * 1.4 + boat.index) * 0.025 - tension * 0.05 * dir);
    c.scale(dir, 1);
    drawBoat(c, boat.rider, this.extras);
    c.restore();
    c.lineCap = 'round';
    const handX = hull + dir * 34;
    const handY = SURFACE - 56 + bob - cheer * 18;
    const bendX = (handX + tipX) / 2 + dir * tension * 18;
    const bendY = (handY + tipY) / 2 - tension * 8;
    pen(c, INK, 10, () => {
      c.moveTo(handX, handY);
      c.quadraticCurveTo(bendX, bendY, tipX, tipY);
    });
    pen(c, '#ffd27a', 5, () => {
      c.moveTo(handX, handY);
      c.quadraticCurveTo(bendX, bendY, tipX, tipY);
    });
  }

  drawDecorBoat() {
    const c = this.ctx;
    c.save();
    c.translate(WORLD.halfway - 40, SURFACE - 4 + Math.sin(this.time * 1.8) * 4);
    c.rotate(Math.sin(this.time * 1.4) * 0.025);
    drawBoat(c, 'capy', this.extras);
    c.restore();
  }

  drawLeapers() {
    const c = this.ctx;
    for (const leaper of this.leapers) {
      if (leaper.t < 0) continue;
      const p = clamp(leaper.t / leaper.dur, 0, 1);
      const x = lerp(leaper.x0, leaper.x1, p);
      const y = SURFACE - (SURFACE - LEAP_TOP) * 4 * p * (1 - p);
      c.save();
      c.translate(x, y);
      c.scale(leaper.spin, 1);
      c.rotate(lerp(-1.1, 1.1, p));
      drawThing(c, leaper.type, { t: this.time * 2, happy: true, big: SEA_SCALE });
      c.restore();
    }
  }

  drawParticles() {
    const c = this.ctx;
    for (const p of this.particles) {
      c.globalAlpha = 1 - p.age / p.life;
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(p.x, p.y, p.r, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  jarSpot(round) {
    return { x: Math.min(this.right, WORLD.width) - 130, y: Math.max(this.top, 0) + 26, w: 84, h: 112, cap: (round?.config.stars[1] ?? 1) * 1.1 };
  }

  jarY(jar, value) {
    return jar.y + 16 + (jar.h - 22) * (1 - clamp(value / jar.cap, 0, 1));
  }

  drawJar(round) {
    const c = this.ctx;
    const jar = this.jarSpot(round);
    const glass = () => {
      c.moveTo(jar.x + 12, jar.y);
      c.lineTo(jar.x + jar.w - 12, jar.y);
      c.quadraticCurveTo(jar.x + jar.w, jar.y + 8, jar.x + jar.w, jar.y + 26);
      c.lineTo(jar.x + jar.w, jar.y + jar.h - 16);
      c.quadraticCurveTo(jar.x + jar.w, jar.y + jar.h, jar.x + jar.w - 16, jar.y + jar.h);
      c.lineTo(jar.x + 16, jar.y + jar.h);
      c.quadraticCurveTo(jar.x, jar.y + jar.h, jar.x, jar.y + jar.h - 16);
      c.lineTo(jar.x, jar.y + 26);
      c.quadraticCurveTo(jar.x, jar.y + 8, jar.x + 12, jar.y);
      c.closePath();
    };
    shape(c, 'rgba(235,250,255,0.55)', glass, 0);
    c.save();
    c.beginPath();
    glass();
    c.clip();
    const level = this.jarY(jar, this.jarShown);
    const fill = c.createLinearGradient(0, jar.y, 0, jar.y + jar.h);
    fill.addColorStop(0, '#fff6ff');
    fill.addColorStop(1, '#cfc6ff');
    c.fillStyle = fill;
    c.beginPath();
    c.moveTo(jar.x - 4, jar.y + jar.h + 4);
    for (let x = 0; x <= jar.w + 8; x += 8) c.lineTo(jar.x - 4 + x, level + Math.sin(x * 0.2 + this.time * 3) * 2.5);
    c.lineTo(jar.x + jar.w + 4, jar.y + jar.h + 4);
    c.closePath();
    c.fill();
    c.restore();
    for (const line of round.config.stars) {
      const y = this.jarY(jar, line);
      const reached = this.jarShown >= line;
      c.strokeStyle = reached ? '#ffb32e' : 'rgba(18,55,90,0.55)';
      c.lineWidth = 3;
      c.beginPath();
      c.setLineDash([7, 6]);
      c.moveTo(jar.x + 4, y);
      c.lineTo(jar.x + jar.w - 4, y);
      c.stroke();
      c.setLineDash([]);
      c.save();
      c.translate(jar.x + jar.w + 16, y);
      drawStar(c, 13, reached ? '#ffd84d' : '#dfe9f2');
      c.restore();
    }
    pen(c, INK, 5, glass);
    shape(c, '#c98a4a', () => c.rect(jar.x + 8, jar.y - 11, jar.w - 16, 14), 4);
    // The count sits beside the jar, up in the sky, so a boat passing underneath never covers it.
    this.label(String(this.jarShown), jar.x - 48, jar.y + 92, 40, '#fff');
    if (round.multiplier > 1) {
      c.save();
      c.translate(jar.x - 48, jar.y + 30);
      c.scale(1 + Math.sin(this.time * 7) * 0.06, 1 + Math.sin(this.time * 7) * 0.06);
      this.label('x2', 0, 12, 40, '#ffd84d');
      c.restore();
    }
  }

  label(text, x, y, size, fill) {
    const c = this.ctx;
    c.font = `${size}px ${FONT}`;
    c.textAlign = 'center';
    c.lineWidth = size * 0.22;
    c.strokeStyle = INK;
    c.strokeText(text, x, y);
    c.fillStyle = fill;
    c.fillText(text, x, y);
  }

  drawPearls(round) {
    const c = this.ctx;
    const jar = this.jarSpot(round);
    const endX = jar.x + jar.w / 2;
    const endY = jar.y + 10;
    for (const pearl of this.pearls) {
      if (pearl.t < 0) continue;
      const t = clamp(pearl.t, 0, 1);
      const x = (1 - t) * (1 - t) * pearl.x + 2 * (1 - t) * t * pearl.cx + t * t * endX;
      const y = (1 - t) * (1 - t) * pearl.y + 2 * (1 - t) * t * pearl.cy + t * t * endY;
      c.save();
      c.translate(x, y);
      drawPearl(c, 1 - t * 0.2);
      c.restore();
    }
  }

  drawPopups() {
    const c = this.ctx;
    for (const popup of this.popups) {
      const p = popup.age / 1.2;
      c.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
      this.label(popup.text, popup.x, popup.y - p * 46, 46, popup.color);
    }
    for (const burst of this.starBursts) {
      const p = burst.age / 1.1;
      c.globalAlpha = 1 - p * p;
      c.save();
      c.translate(burst.x - p * 120, burst.y + p * 40);
      c.rotate(p * 2);
      drawStar(c, 22 + Math.sin(p * Math.PI) * 26);
      c.restore();
    }
    c.globalAlpha = 1;
  }

  drawGlow() {
    const c = this.ctx;
    const pulse = 0.12 + Math.sin(this.time * 2.4) * 0.03;
    c.fillStyle = `rgba(255,190,70,${pulse})`;
    c.fillRect(this.left, this.top, this.right - this.left, this.bottom - this.top);
  }

  drawHands(round) {
    const c = this.ctx;
    const press = (Math.sin(this.time * 4.4) + 1) / 2;
    const place = (x, y) => {
      c.save();
      c.translate(x, y + press * 18);
      c.rotate(-0.16);
      drawHand(c);
      c.restore();
    };
    if (round.tutorial) {
      const pulling = round.boats.find((boat) => boat.state === 'pull');
      if (pulling) place(clamp(pulling.ring.x + 150, 120, WORLD.width - 110), pulling.ring.y + 60);
      else if (round.boats.every((boat) => boat.state === 'ready')) {
        for (const fish of round.fish) place(fish.x + 10, fish.y + 30);
      }
    } else if (round.hintFish) {
      place(round.hintFish.x + 10, round.hintFish.y + 30);
    }
  }
}
