// Draws the field. Reads the simulation, never changes it.
import { ANIMALS, LASSO_ORIGIN_Y, ROWS, WORLD } from './data.js';
import { drawAnimal, drawHand, drawMascot } from './art.js';
import { t } from './strings.js';

const TAU = Math.PI * 2;
const FONT = '"Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';
const HAZE = [0, 0.1, 0.22];
const MAX_PARTICLES = 160;
const MIN_NUMBER_PT = 28;

const THEMES = {
  bg_sunny: { sky: ['#54b8f0', '#b8e8f7'], far: ['#c98a5a', '#dca571'], hill: '#8fcf63', tree: '#57b548', grass: ['#8ed44f', '#5cb338'], stripe: 'rgba(255,255,255,0.07)', sun: '#fff0a0', cloud: '#ffffff', flower: ['#fff', '#ffd23f', '#ff8fb5'] },
  bg_sunset: { sky: ['#f2734f', '#ffd27f'], far: ['#8e4a4f', '#b4635b'], hill: '#c98a4a', tree: '#a8a33a', grass: ['#c2bf4a', '#8f9a35'], stripe: 'rgba(255,220,160,0.08)', sun: '#fff2c0', cloud: '#ffd0b0', flower: ['#fff2c0', '#ff9a5a', '#e5412f'] },
  bg_blossom: { sky: ['#8fd3f4', '#fbe0ee'], far: ['#b78fc6', '#d3aad8'], hill: '#a6dc8c', tree: '#ff9ccb', grass: ['#a3e27a', '#6ec858'], stripe: 'rgba(255,255,255,0.08)', sun: '#fff7c8', cloud: '#fff4fa', flower: ['#ff9ccb', '#ffffff', '#ffd0e8'] },
};

function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

export class View {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.theme = 'bg_sunny';
    this.layers = null;
    this.particles = [];
    this.popups = [];
    this.flash = 0;
    this.time = 0;
    this.camera = 0;
    this.ropeColors = ['#f7c62e', '#fff0a6'];
    this.hat = null;
    this.mascot = { state: 'idle', until: 0, text: '', icon: '' };
    this.resize();
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.scale = Math.min(width / WORLD.safeWidth, height / WORLD.safeHeight);
    this.viewW = width / this.scale;
    this.viewH = height / this.scale;
    this.ox = (this.viewW - WORLD.width) / 2;
    this.oy = (this.viewH - WORLD.height) / 2;
    this.layers = null;
  }

  get bounds() {
    return [-this.ox - 150, WORLD.width + this.ox + 150];
  }

  // Screen point to world point, for tap-on-lane.
  toWorld(clientX, clientY) {
    return { x: clientX / this.scale - this.ox, y: clientY / this.scale - this.oy };
  }

  setTheme(theme) {
    if (theme !== this.theme) {
      this.theme = theme;
      this.layers = null;
    }
  }

  layer(draw, margin = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil((this.viewW + margin * 2) * this.scale * this.dpr);
    canvas.height = this.canvas.height;
    const c = canvas.getContext('2d');
    const unit = this.scale * this.dpr;
    c.setTransform(unit, 0, 0, unit, (this.ox + margin) * unit, this.oy * unit);
    draw(c);
    return canvas;
  }

  buildLayers() {
    const theme = THEMES[this.theme];
    const left = -this.ox - 40;
    const right = WORLD.width + this.ox + 40;
    const top = -this.oy;
    const bottom = WORLD.height + this.oy;
    const span = right - left;
    const margin = 30;
    const rng = seeded(4242);

    const sky = this.layer((c) => {
      const gradient = c.createLinearGradient(0, top, 0, 330);
      gradient.addColorStop(0, theme.sky[0]);
      gradient.addColorStop(1, theme.sky[1]);
      c.fillStyle = gradient;
      c.fillRect(left, top, span, 340 - top);
      c.fillStyle = theme.sun;
      c.globalAlpha = 0.3;
      for (let i = 0; i < 12; i++) {
        const a = (i * TAU) / 12;
        c.beginPath();
        c.moveTo(980 + Math.cos(a - 0.11) * 70, 96 + Math.sin(a - 0.11) * 70);
        c.lineTo(980 + Math.cos(a) * (i % 2 ? 112 : 132), 96 + Math.sin(a) * (i % 2 ? 112 : 132));
        c.lineTo(980 + Math.cos(a + 0.11) * 70, 96 + Math.sin(a + 0.11) * 70);
        c.fill();
      }
      c.beginPath();
      c.arc(980, 96, 84, 0, TAU);
      c.fill();
      c.globalAlpha = 1;
      c.beginPath();
      c.arc(980, 96, 60, 0, TAU);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.45)';
      c.beginPath();
      c.ellipse(962, 76, 24, 14, -0.5, 0, TAU);
      c.fill();
    });

    const far = this.layer((c) => {
      const mesa = (fill, points, bands) => {
        const trace = () => {
          c.beginPath();
          points.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](x, y));
          c.closePath();
        };
        // A wide stroke in the same colour rounds off every corner.
        trace();
        c.fillStyle = fill;
        c.strokeStyle = fill;
        c.lineJoin = 'round';
        c.lineWidth = 20;
        c.fill();
        c.stroke();
        c.save();
        trace();
        c.lineWidth = 20;
        c.stroke();
        c.clip();
        const top = Math.min(...points.map((p) => p[1]));
        for (let i = 0; i < bands; i++) {
          c.fillStyle = i % 2 ? 'rgba(255,240,210,0.13)' : 'rgba(110,40,20,0.1)';
          c.fillRect(left, top + 18 + i * 24, span, 12);
        }
        c.fillStyle = 'rgba(255,245,220,0.26)';
        c.fillRect(left, top - 12, span, 16);
        c.restore();
      };
      mesa(theme.far[0], [[left, 300], [left + span * 0.06, 188], [left + span * 0.2, 180], [left + span * 0.25, 232], [left + span * 0.36, 228], [left + span * 0.4, 300]], 4);
      mesa(theme.far[0], [[left + span * 0.58, 300], [left + span * 0.64, 206], [left + span * 0.72, 150], [left + span * 0.84, 146], [left + span * 0.9, 214], [right, 226], [right, 300]], 6);
      mesa(theme.far[1], [[left + span * 0.1, 266], [left + span * 0.13, 226], [left + span * 0.2, 222], [left + span * 0.23, 266]], 1);
      mesa(theme.far[1], [[left + span * 0.68, 266], [left + span * 0.72, 200], [left + span * 0.8, 196], [left + span * 0.85, 266]], 2);
      c.fillStyle = theme.far[1];
      c.fillRect(left, 262, span, 40);
    }, margin);

    const middle = this.layer((c) => {
      c.fillStyle = theme.hill;
      c.beginPath();
      c.moveTo(left, 330);
      c.bezierCurveTo(left + span * 0.2, 262, left + span * 0.35, 306, left + span * 0.5, 294);
      c.bezierCurveTo(left + span * 0.68, 276, left + span * 0.82, 268, right, 306);
      c.lineTo(right, 340);
      c.lineTo(left, 340);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.14)';
      c.beginPath();
      c.moveTo(left, 330);
      c.bezierCurveTo(left + span * 0.2, 262, left + span * 0.35, 306, left + span * 0.5, 294);
      c.bezierCurveTo(left + span * 0.68, 276, left + span * 0.82, 268, right, 306);
      c.lineTo(right, 320);
      c.bezierCurveTo(left + span * 0.82, 284, left + span * 0.68, 292, left + span * 0.5, 310);
      c.bezierCurveTo(left + span * 0.35, 322, left + span * 0.2, 278, left, 346);
      c.fill();
      for (const [x, y, size] of [[396, 296, 0.8], [452, 300, 1], [706, 286, 0.9], [770, 282, 1.1], [858, 278, 0.75]]) this.drawTree(c, x, y, size, theme.tree);
      this.drawBarn(c, 170, 306);
      this.drawWindmill(c, 1040, 310);
      for (let x = left; x < right; x += 74) {
        c.fillStyle = '#8c5a30';
        c.strokeStyle = '#4f2f16';
        c.lineWidth = 3;
        c.beginPath();
        c.roundRect(x, 294, 16, 48, [8, 8, 2, 2]);
        c.fill();
        c.stroke();
        c.fillStyle = 'rgba(255,230,190,0.35)';
        c.fillRect(x + 3, 300, 3, 32);
      }
      for (const y of [306, 322]) {
        c.fillStyle = '#c08a4c';
        c.strokeStyle = '#4f2f16';
        c.beginPath();
        c.rect(left, y, span, 10);
        c.fill();
        c.stroke();
        c.fillStyle = 'rgba(255,235,200,0.4)';
        c.fillRect(left, y + 2, span, 2.5);
      }
    }, margin);

    const field = this.layer((c) => {
      const gradient = c.createLinearGradient(0, 334, 0, 660);
      gradient.addColorStop(0, theme.grass[0]);
      gradient.addColorStop(1, theme.grass[1]);
      c.fillStyle = gradient;
      c.fillRect(left, 334, span, bottom - 334);
      c.fillStyle = theme.stripe;
      for (let i = 0; i < 6; i++) {
        const y = 346 + i * i * 7.8 + i * 18;
        c.fillRect(left, y, span, 16 + i * 5);
      }
      for (const row of ROWS) {
        c.fillStyle = 'rgba(214,170,100,0.26)';
        c.beginPath();
        c.roundRect(left - 20, row.y - 15 * row.scale, span + 40, 30 * row.scale, 14);
        c.fill();
      }
      for (let i = 0; i < Math.round(span / 7); i++) {
        const x = left + rng() * span;
        const depth = rng();
        const y = 352 + depth * depth * 290;
        const size = 2 + depth * 5;
        const pick = rng();
        if (pick < 0.14) {
          c.fillStyle = theme.flower[Math.floor(rng() * 3)];
          for (let p = 0; p < 5; p++) {
            const a = (p * TAU) / 5;
            c.beginPath();
            c.arc(x + Math.cos(a) * size * 0.8, y + Math.sin(a) * size * 0.8, size * 0.7, 0, TAU);
            c.fill();
          }
          c.fillStyle = '#ffb12a';
          c.beginPath();
          c.arc(x, y, size * 0.6, 0, TAU);
          c.fill();
        } else {
          c.strokeStyle = 'rgba(40,110,40,0.42)';
          c.lineWidth = 1.5 + depth * 1.5;
          c.beginPath();
          c.moveTo(x - size, y);
          c.lineTo(x - size * 1.4, y - size * 1.8);
          c.moveTo(x, y);
          c.lineTo(x, y - size * 2.3);
          c.moveTo(x + size, y);
          c.lineTo(x + size * 1.5, y - size * 1.7);
          c.stroke();
        }
      }
      this.drawDeck(c, left, right, bottom, rng);
    });

    this.layers = { sky, far, middle, field, margin, top, left, right };
  }

  drawTree(c, x, y, size, leaf) {
    c.lineJoin = 'round';
    c.strokeStyle = '#3f2a18';
    c.lineWidth = 3;
    c.fillStyle = '#8c5a30';
    c.beginPath();
    c.roundRect(x - 5 * size, y - 26 * size, 10 * size, 28 * size, 3);
    c.fill();
    c.stroke();
    c.strokeStyle = 'rgba(30,60,30,0.75)';
    c.fillStyle = leaf;
    c.beginPath();
    for (const [dx, dy, radius] of [[-15, -34, 17], [15, -35, 18], [0, -52, 21]]) {
      c.moveTo(x + (dx + radius) * size, y + dy * size);
      c.arc(x + dx * size, y + dy * size, radius * size, 0, TAU);
    }
    c.stroke();
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.26)';
    c.beginPath();
    c.ellipse(x - 7 * size, y - 58 * size, 10 * size, 6 * size, -0.4, 0, TAU);
    c.fill();
  }

  drawBarn(c, x, y) {
    // Silo first, so the barn sits in front of it.
    c.lineWidth = 4;
    c.strokeStyle = '#4c1d13';
    c.fillStyle = '#e9e2d0';
    c.beginPath();
    c.roundRect(x + 62, y - 126, 54, 126, 4);
    c.fill();
    c.stroke();
    c.fillStyle = 'rgba(120,90,70,0.2)';
    c.fillRect(x + 98, y - 124, 16, 124);
    c.strokeStyle = 'rgba(76,29,19,0.4)';
    c.lineWidth = 2.5;
    for (let band = y - 104; band < y; band += 24) {
      c.beginPath();
      c.moveTo(x + 62, band);
      c.lineTo(x + 116, band);
      c.stroke();
    }
    c.lineWidth = 4;
    c.strokeStyle = '#4c1d13';
    c.fillStyle = '#6f8fc2';
    c.beginPath();
    c.moveTo(x + 58, y - 124);
    c.bezierCurveTo(x + 60, y - 176, x + 118, y - 176, x + 120, y - 124);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath();
    c.ellipse(x + 76, y - 146, 9, 6, -0.6, 0, TAU);
    c.fill();

    c.lineWidth = 4;
    c.strokeStyle = '#4c1d13';
    c.fillStyle = '#d8452f';
    c.beginPath();
    c.moveTo(x - 76, y);
    c.lineTo(x - 76, y - 74);
    c.lineTo(x - 42, y - 118);
    c.lineTo(x + 42, y - 118);
    c.lineTo(x + 76, y - 74);
    c.lineTo(x + 76, y);
    c.closePath();
    c.fill();
    c.stroke();
    c.save();
    c.clip();
    c.fillStyle = 'rgba(90,10,20,0.16)';
    c.fillRect(x + 40, y - 130, 40, 130);
    c.strokeStyle = 'rgba(90,20,15,0.3)';
    c.lineWidth = 2;
    for (let plank = x - 62; plank < x + 76; plank += 14) {
      c.beginPath();
      c.moveTo(plank, y - 118);
      c.lineTo(plank, y);
      c.stroke();
    }
    c.restore();
    c.strokeStyle = '#4c1d13';
    c.lineWidth = 4;
    c.fillStyle = '#6f5243';
    c.beginPath();
    c.moveTo(x - 90, y - 70);
    c.lineTo(x - 48, y - 128);
    c.lineTo(x + 48, y - 128);
    c.lineTo(x + 90, y - 70);
    c.lineTo(x + 76, y - 66);
    c.lineTo(x + 42, y - 112);
    c.lineTo(x - 42, y - 112);
    c.lineTo(x - 76, y - 66);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#fff';
    c.fillRect(x - 30, y - 56, 60, 56);
    c.strokeRect(x - 30, y - 56, 60, 56);
    c.strokeStyle = '#d8452f';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(x - 28, y - 54);
    c.lineTo(x + 28, y - 2);
    c.moveTo(x + 28, y - 54);
    c.lineTo(x - 28, y - 2);
    c.stroke();
    c.fillStyle = '#ffe9a0';
    c.strokeStyle = '#4c1d13';
    c.lineWidth = 3;
    c.fillRect(x - 13, y - 104, 26, 26);
    c.strokeRect(x - 13, y - 104, 26, 26);
    c.beginPath();
    c.moveTo(x, y - 104);
    c.lineTo(x, y - 78);
    c.moveTo(x - 13, y - 91);
    c.lineTo(x + 13, y - 91);
    c.stroke();
  }

  drawWindmill(c, x, y) {
    c.strokeStyle = '#5c4632';
    c.lineWidth = 7;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x - 22, y);
    c.lineTo(x, y - 136);
    c.lineTo(x + 22, y);
    c.moveTo(x - 15, y - 44);
    c.lineTo(x + 15, y - 44);
    c.moveTo(x - 9, y - 88);
    c.lineTo(x + 9, y - 88);
    c.stroke();
    c.fillStyle = '#f2f0e4';
    c.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8;
      c.beginPath();
      c.moveTo(x, y - 136);
      c.lineTo(x + Math.cos(a - 0.17) * 50, y - 136 + Math.sin(a - 0.17) * 50);
      c.lineTo(x + Math.cos(a + 0.17) * 50, y - 136 + Math.sin(a + 0.17) * 50);
      c.closePath();
      c.fill();
      c.stroke();
    }
  }

  drawDeck(c, left, right, bottom, rng) {
    c.fillStyle = '#b27a42';
    c.fillRect(left, 648, right - left, bottom - 648);
    c.fillStyle = '#d29a5a';
    c.fillRect(left, 648, right - left, 14);
    c.strokeStyle = 'rgba(70,38,16,0.55)';
    c.lineWidth = 3;
    for (let y = 662; y < bottom; y += 44) {
      c.beginPath();
      c.moveTo(left, y);
      c.lineTo(right, y);
      c.stroke();
    }
    for (let row = 0, y = 662; y < bottom; y += 44, row++) {
      c.fillStyle = row % 2 ? 'rgba(255,225,170,0.07)' : 'rgba(80,40,10,0.06)';
      c.fillRect(left, y + 2, right - left, 42);
      c.fillStyle = 'rgba(255,235,195,0.2)';
      c.fillRect(left, y + 2, right - left, 3);
      for (let x = left + (row % 2) * 90; x < right; x += 180) {
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x, y + 44);
        c.stroke();
        c.fillStyle = 'rgba(58,30,12,0.6)';
        for (const nail of [11, 33]) {
          c.beginPath();
          c.arc(x + 10, y + nail, 2.6, 0, TAU);
          c.arc(x - 10, y + nail, 2.6, 0, TAU);
          c.fill();
        }
        if (rng() < 0.35) {
          c.strokeStyle = 'rgba(70,38,16,0.3)';
          c.lineWidth = 2;
          c.beginPath();
          c.ellipse(x + 60 + rng() * 60, y + 22, 13, 5, 0, 0, TAU);
          c.stroke();
          c.strokeStyle = 'rgba(70,38,16,0.55)';
          c.lineWidth = 3;
        }
      }
    }
    c.fillStyle = '#6b3f1e';
    c.fillRect(left, 644, right - left, 6);
  }

  particle(kind, x, y, vx, vy, life, size, color) {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push({ kind, x, y, vx, vy, life, age: 0, size, color });
  }

  burst(kind, x, y, count, speed, life, size, colors) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU;
      const pace = speed * (0.4 + Math.random() * 0.6);
      this.particle(kind, x, y, Math.cos(angle) * pace, Math.sin(angle) * pace, life, size, colors[i % colors.length]);
    }
  }

  popup(x, y, text, color, size = 46) {
    this.popups.push({ x, y, text, color, size, age: 0 });
  }

  say(state, text = '', icon = '', length = 1.3) {
    this.mascot = { state, text, icon, until: this.time + length };
  }

  handleEvent(event, round) {
    if (event.type === 'catch') {
      const big = event.points >= 17;
      const label = event.multiplier > 1 ? `+${event.points} x${event.multiplier}` : `+${event.points}`;
      this.popup(event.x, event.y - 120, label, big ? '#ffd23f' : '#ffffff', big ? 62 : 48);
      this.burst('star', event.x, event.y - 60, big ? 12 : 7, 240, 0.7, 13, ['#ffd23f', '#fff', '#ff9a5a']);
      this.burst('heart', event.x, event.y - 70, big ? 6 : 3, 170, 0.8, 13, ['#ff6f91', '#ff9ccb']);
      if (event.animal.type === 'S1') this.say('laugh', t('saidGolden'), '🌟', 1.8);
      else if (big) this.say('laugh', t('saidBig'), '🤠');
      else this.say('cheer', t('saidCatch'), '👍', 0.9);
    } else if (event.type === 'miss') {
      this.burst('dust', event.x, event.y, 6, 90, 0.5, 18, ['#fff4dc']);
      if (event.missStreak >= 3) this.say('wince', t('saidEncourage'), '💪', 1.6);
      else this.say('wince', '', '', 0.7);
    } else if (event.type === 'hazard') {
      if (event.hazard === 'stink') {
        this.popup(event.x, event.y - 110, event.points ? `${event.points}` : '0', '#c8f06a', 54);
        this.say('nose', t('saidStink'), '🤢', 2.4);
      } else {
        this.popup(event.x, event.y - 110, t('saidJam'), '#ffb4a3', 46);
        this.burst('star', event.x, event.y - 50, 8, 200, 0.5, 11, ['#f4ead2']);
        this.say('wince', t('saidJam'), '🌵', 1.6);
      }
    } else if (event.type === 'hurry') {
      this.say('excited', t('saidHurry'), '⏰', 2.4);
    } else if (event.type === 'golden') {
      this.say('excited', t('saidGolden'), '🌟', 1.8);
    } else if (event.type === 'throw') {
      const lane = round.config.lanes[event.lane];
      this.burst('dust', lane, LASSO_ORIGIN_Y - 40, 3, 40, 0.3, 12, ['#fff4dc']);
    }
  }

  drawLayers(round) {
    const { ctx: c } = this;
    if (!this.layers) this.buildLayers();
    const { sky, far, middle, field, margin } = this.layers;
    const lanes = round?.config.lanes ?? [600];
    const selected = round ? lanes[round.selectedLane] : 600;
    const aim = (selected - 600) / 240;
    this.camera += (aim - this.camera) * 0.08;
    const device = this.scale * this.dpr;

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(sky, 0, 0);
    this.drawClouds();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(far, (-margin - this.camera * 5) * device, 0);
    c.drawImage(middle, (-margin - this.camera * 12) * device, 0);
    c.drawImage(field, 0, 0);
  }

  worldTransform() {
    const unit = this.scale * this.dpr;
    this.ctx.setTransform(unit, 0, 0, unit, this.ox * unit, this.oy * unit);
  }

  drawClouds() {
    const c = this.ctx;
    this.worldTransform();
    const theme = THEMES[this.theme];
    const left = -this.ox - 160;
    const span = this.viewW + 320;
    c.globalAlpha = 0.95;
    [[40, 92, 1], [420, 136, 0.72], [760, 72, 0.86], [1180, 150, 0.64]].forEach(([x, y, size], i) => {
      const drift = (x + this.time * (9 + i * 3)) % span;
      const cx = left + drift;
      c.fillStyle = theme.cloud;
      c.beginPath();
      c.arc(cx, y, 34 * size, 0, TAU);
      c.arc(cx + 40 * size, y - 18 * size, 42 * size, 0, TAU);
      c.arc(cx + 88 * size, y - 6 * size, 36 * size, 0, TAU);
      c.arc(cx + 122 * size, y + 6 * size, 24 * size, 0, TAU);
      c.roundRect(cx - 26 * size, y + 2 * size, 170 * size, 30 * size, 15 * size);
      c.fill();
      c.fillStyle = 'rgba(120,150,210,0.2)';
      c.beginPath();
      c.roundRect(cx - 22 * size, y + 14 * size, 162 * size, 18 * size, 9 * size);
      c.fill();
    });
    c.globalAlpha = 1;
  }

  drawLanes(round) {
    const c = this.ctx;
    const pulse = 0.5 + Math.sin(this.time * 6) * 0.5;
    const oneTap = round.config.oneTap;
    round.config.lanes.forEach((x, i) => {
      const active = oneTap ? round.ready : i === round.selectedLane;
      const gradient = c.createLinearGradient(0, 640, 0, 370);
      gradient.addColorStop(0, `rgba(255,255,255,${active ? 0.34 : 0.14})`);
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gradient;
      c.fillRect(x - 34, 370, 68, 276);

      c.save();
      c.translate(x, 626);
      c.globalAlpha = active ? 0.8 + pulse * 0.2 : 0.42;
      if (active) {
        c.shadowColor = '#fff7c0';
        c.shadowBlur = 12 + pulse * 18;
      }
      c.fillStyle = '#fff';
      c.strokeStyle = 'rgba(58,36,20,0.75)';
      c.lineWidth = 5;
      c.lineJoin = 'round';
      c.beginPath();
      c.moveTo(0, -34);
      c.lineTo(36, 4);
      c.lineTo(15, 4);
      c.lineTo(15, 24);
      c.lineTo(-15, 24);
      c.lineTo(-15, 4);
      c.lineTo(-36, 4);
      c.closePath();
      c.stroke();
      c.fill();
      c.restore();
    });
  }

  animalPose(animal) {
    if (animal.state === 'graze') return { kind: 'graze', phase: (this.time * 2) % 1 };
    if (animal.state === 'caught') return { kind: 'dizzy', phase: 0 };
    const pace = ANIMALS[animal.type].speed / 110;
    return { kind: 'run', phase: (this.time * 1.5 * pace + animal.id * 0.37) % 1 };
  }

  drawAnimalAt(animal) {
    const c = this.ctx;
    const row = ROWS[animal.row];
    const def = ANIMALS[animal.type];
    const caught = animal.state === 'caught';
    const scale = row.scale * (caught ? 1.05 : 1);
    const lift = animal.hop;

    if (!caught) {
      c.fillStyle = 'rgba(30,50,20,0.26)';
      c.beginPath();
      c.ellipse(animal.x, animal.y, (88 - lift * 0.3) * scale, 14 * scale, 0, 0, TAU);
      c.fill();
    }

    drawAnimal(c, animal.type, this.animalPose(animal), animal.x, animal.y - lift, scale, animal.dir < 0, HAZE[animal.row]);

    if (caught) this.drawDizzyStars(animal.x, animal.y - 150 * scale, scale);
    if (def.special && !caught && Math.random() < 0.35) {
      this.particle('spark', animal.x + (Math.random() - 0.5) * 130, animal.y - lift - Math.random() * 120, 0, -20, 0.5, 10, '#fff2a0');
    }
  }

  // A separate pass after the whole herd, so a neighbour's head never covers a number.
  drawLabel(animal) {
    const def = ANIMALS[animal.type];
    const scale = ROWS[animal.row].scale;
    const x = animal.x - animal.dir * 16 * scale;
    const y = animal.y - animal.hop - 76 * scale;
    if (def.hazard) this.drawHazardBadge(x, y - 6, 28 * Math.max(scale, 0.9));
    else this.drawNumber(def.points, x, y, scale);
  }

  drawNumber(points, x, y, scale) {
    const c = this.ctx;
    const size = Math.max(MIN_NUMBER_PT / this.scale, 46 * scale);
    c.font = `${size}px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = size * 0.26;
    c.strokeStyle = '#2b1a10';
    c.strokeText(points, x, y);
    c.fillStyle = '#fff';
    c.fillText(points, x, y);
  }

  drawHazardBadge(x, y, radius) {
    const c = this.ctx;
    c.fillStyle = '#e42f2f';
    c.strokeStyle = '#fff';
    c.lineWidth = 5;
    c.beginPath();
    c.arc(x, y, radius, 0, TAU);
    c.fill();
    c.stroke();
    const arm = radius * 0.5;
    c.lineCap = 'round';
    c.lineWidth = radius * 0.3;
    c.beginPath();
    c.moveTo(x - arm, y - arm);
    c.lineTo(x + arm, y + arm);
    c.moveTo(x + arm, y - arm);
    c.lineTo(x - arm, y + arm);
    c.stroke();
  }

  drawDizzyStars(x, y, scale) {
    const c = this.ctx;
    c.fillStyle = '#ffd23f';
    c.strokeStyle = '#7a4a10';
    c.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const angle = this.time * 7 + (i * TAU) / 3;
      this.star(x + Math.cos(angle) * 62 * scale, y + Math.sin(angle) * 16 * scale, 15 * scale);
    }
  }

  star(x, y, radius) {
    const c = this.ctx;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const size = i % 2 ? radius * 0.46 : radius;
      const angle = -Math.PI / 2 + (i * TAU) / 10;
      c.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
    }
    c.closePath();
    c.fill();
    c.stroke();
  }

  drawRope(round) {
    const c = this.ctx;
    const lasso = round.lasso;
    const laneX = round.config.lanes[lasso.lane];
    const flying = ['throwing', 'dragging', 'retracting'].includes(lasso.state);
    if (flying) {
      const sway = Math.sin(this.time * 24) * 16 * (lasso.state === 'throwing' ? 1 : 0.3);
      const midX = (laneX + lasso.x) / 2 + sway;
      const midY = (LASSO_ORIGIN_Y + lasso.y) / 2;
      const trace = () => {
        c.beginPath();
        c.moveTo(laneX, LASSO_ORIGIN_Y - 8);
        c.quadraticCurveTo(midX, midY, lasso.x, lasso.y);
      };
      c.lineCap = 'round';
      trace();
      c.strokeStyle = '#3a2414';
      c.lineWidth = 13;
      c.stroke();
      trace();
      c.strokeStyle = this.ropePaint(lasso.y);
      c.lineWidth = 8;
      c.stroke();
      trace();
      c.setLineDash([4, 14]);
      c.strokeStyle = 'rgba(255,255,255,0.55)';
      c.lineWidth = 3;
      c.stroke();
      c.setLineDash([]);

      const mega = round.bonus;
      const radius = (mega ? 74 : 54) * round.config.catchWindow;
      const spin = this.time * 16;
      const squash = 0.34 + Math.sin(spin) * 0.05;
      c.beginPath();
      c.ellipse(lasso.x, lasso.y, radius, radius * squash, 0, 0, TAU);
      c.strokeStyle = '#3a2414';
      c.lineWidth = 13;
      c.stroke();
      c.strokeStyle = this.ropePaint(lasso.y);
      c.lineWidth = 8;
      c.stroke();
      c.setLineDash([4, 14]);
      c.strokeStyle = 'rgba(255,255,255,0.6)';
      c.lineWidth = 3;
      c.stroke();
      c.setLineDash([]);
    }
    drawHand(c, laneOffsetHand(round), LASSO_ORIGIN_Y, this.ropeColors, flying ? 'throw' : 'idle');
  }

  ropePaint(y) {
    if (this.ropeColors.length <= 2) return this.ropeColors[0];
    const gradient = this.ctx.createLinearGradient(0, LASSO_ORIGIN_Y, 0, y);
    this.ropeColors.forEach((color, i) => gradient.addColorStop(i / (this.ropeColors.length - 1), color));
    return gradient;
  }

  drawParticles(dt) {
    const c = this.ctx;
    this.particles = this.particles.filter((p) => (p.age += dt) < p.life);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'confetti') p.vy += 340 * dt;
      const fade = 1 - p.age / p.life;
      c.globalAlpha = Math.min(1, fade * 1.5);
      c.fillStyle = p.color;
      if (p.kind === 'dust') {
        const puff = p.size * (1.4 - fade * 0.6);
        c.beginPath();
        c.arc(p.x, p.y, puff, 0, TAU);
        c.arc(p.x + puff * 0.8, p.y + puff * 0.2, puff * 0.66, 0, TAU);
        c.arc(p.x - puff * 0.8, p.y + puff * 0.24, puff * 0.6, 0, TAU);
        c.fill();
      } else if (p.kind === 'heart') {
        const size = p.size * (0.7 + fade * 0.5);
        c.beginPath();
        c.moveTo(p.x, p.y + size);
        c.bezierCurveTo(p.x - size * 1.7, p.y - size * 0.1, p.x - size * 0.9, p.y - size * 1.4, p.x, p.y - size * 0.5);
        c.bezierCurveTo(p.x + size * 0.9, p.y - size * 1.4, p.x + size * 1.7, p.y - size * 0.1, p.x, p.y + size);
        c.fill();
      } else if (p.kind === 'confetti') {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.age * 9);
        c.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
        c.restore();
      } else {
        c.lineWidth = 0;
        c.strokeStyle = 'transparent';
        this.star(p.x, p.y, p.size * (0.5 + fade * 0.5));
      }
    }
    c.globalAlpha = 1;

    this.popups = this.popups.filter((p) => (p.age += dt) < 1);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    for (const p of this.popups) {
      const pop = Math.min(1, p.age * 7);
      c.globalAlpha = p.age > 0.7 ? (1 - p.age) / 0.3 : 1;
      c.font = `${p.size * (0.6 + pop * 0.4)}px ${FONT}`;
      c.lineWidth = 10;
      c.strokeStyle = '#2b1a10';
      c.strokeText(p.text, p.x, p.y - p.age * 70);
      c.fillStyle = p.color;
      c.fillText(p.text, p.x, p.y - p.age * 70);
    }
    c.globalAlpha = 1;
  }

  drawMascotCorner() {
    const c = this.ctx;
    const x = -this.ox + 66;
    const bottom = WORLD.height + this.oy;
    const mascot = this.mascot;
    const state = this.time < mascot.until ? mascot.state : 'idle';
    c.save();
    c.translate(x, bottom - 24);
    c.scale(0.68, 0.68);
    drawMascot(c, state, this.time, this.hat);
    c.restore();
    if (this.time < mascot.until && (mascot.text || mascot.icon)) {
      this.drawBubble(x + 74, bottom - 268, `${mascot.icon} ${mascot.text}`.trim());
    }
  }

  drawBubble(x, y, text) {
    const c = this.ctx;
    const size = Math.max(16 / this.scale, 28);
    c.font = `${size}px ${FONT}`;
    const width = c.measureText(text).width + size * 1.4;
    const height = size * 1.9;
    c.fillStyle = '#fffdf3';
    c.strokeStyle = '#3a2414';
    c.lineWidth = 5;
    c.lineJoin = 'round';
    c.beginPath();
    c.roundRect(x - 44, y - height / 2, width, height, 22);
    c.moveTo(x - 14, y + height / 2);
    c.lineTo(x - 30, y + height / 2 + 24);
    c.lineTo(x + 16, y + height / 2);
    c.stroke();
    c.fill();
    c.fillStyle = '#3a2414';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(text, x - 44 + size * 0.7, y + 2);
  }

  drawStink(round) {
    if (round.stink <= 0) return;
    const c = this.ctx;
    const strength = Math.min(1, round.stink);
    c.save();
    for (let i = 0; i < 12; i++) {
      const x = (i * 197 + this.time * 32) % this.viewW - this.ox;
      const y = 170 + ((i * 131) % 460) + Math.sin(this.time * 2 + i) * 16;
      c.globalAlpha = 0.34 * strength;
      c.fillStyle = i % 2 ? '#a6cf3a' : '#7fa82a';
      c.beginPath();
      c.arc(x, y, 62, 0, TAU);
      c.arc(x + 52, y - 12, 46, 0, TAU);
      c.fill();
    }
    c.restore();
  }

  drawBonusGlow() {
    const c = this.ctx;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 0.14 + Math.sin(this.time * 6) * 0.03;
    c.fillStyle = '#ffb61f';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.restore();
  }

  celebrate() {
    const left = -this.ox;
    for (let i = 0; i < 70; i++) {
      this.particle('confetti', left + Math.random() * this.viewW, -this.oy - Math.random() * 60, (Math.random() - 0.5) * 140, 60 + Math.random() * 200, 2.6, 9, ['#e5412f', '#ffd23f', '#3fbf5f', '#2e8fe5', '#ee5da8'][i % 5]);
    }
  }

  draw(round, dt, { playing = true, mascot = true } = {}) {
    this.time += dt;
    const c = this.ctx;
    this.drawLayers(round);
    if (round?.bonus) this.drawBonusGlow();
    this.worldTransform();
    if (!round) return;

    if (playing) this.drawLanes(round);
    const herd = round.animals.filter((a) => a.state !== 'caught').sort((a, b) => b.row - a.row || a.id - b.id);
    for (const animal of herd) this.drawAnimalAt(animal);
    for (const animal of herd) this.drawLabel(animal);
    if (playing) this.drawRope(round);
    for (const animal of round.animals) {
      if (animal.state !== 'caught') continue;
      this.drawAnimalAt(animal);
      this.drawLabel(animal);
    }
    this.drawStink(round);
    if (playing && mascot) this.drawMascotCorner();
    this.drawParticles(dt);
    c.globalAlpha = 1;
  }
}

function laneOffsetHand(round) {
  return round.config.lanes[round.lasso.state === 'idle' ? round.selectedLane : round.lasso.lane];
}
