// Every character is drawn with canvas paths, then cached as sprites. Local coordinates: feet on y = 0, facing right.
const TAU = Math.PI * 2;
const INK = '#3a2414';
const CELL = { w: 380, h: 235, x: 190, y: 205 };
// Back rows are drawn smaller, so their sprites can use less memory.
const resolutionFor = (haze) => (haze > 0.15 ? 1.2 : haze > 0 ? 1.5 : 2);
const RUN_FRAMES = 6;

function shape(c, fill, build, width = 5, stroke = INK) {
  c.beginPath();
  build();
  c.fillStyle = fill;
  c.fill();
  if (width) {
    c.lineWidth = width;
    c.strokeStyle = stroke;
    c.stroke();
  }
}

function circle(c, x, y, rx, ry = rx, rotation = 0) {
  c.moveTo(x + Math.cos(rotation) * rx, y + Math.sin(rotation) * rx);
  c.ellipse(x, y, rx, ry, rotation, 0, TAU);
}

function limb(c, x, y, length, width, angle, fill, hoof) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  shape(c, fill, () => c.roundRect(-width / 2, 0, width, length, width * 0.42));
  shape(c, hoof, () => c.roundRect(-width / 2 - 1, length - 12, width + 2, 13, 5), 4);
  c.restore();
}

function legSwing(pose, offset) {
  if (pose.kind === 'graze') return 0;
  if (pose.kind === 'dizzy') return Math.sin(offset * 3) * 0.28;
  return Math.sin(pose.phase * TAU + offset) * 0.55;
}

function bob(pose) {
  return pose.kind === 'run' ? Math.abs(Math.sin(pose.phase * TAU)) * 5 : 0;
}

function legSet(c, pose, { xs, top, length, width, near, far, hoof }) {
  const offsets = [0, Math.PI, Math.PI, 0];
  [1, 3, 0, 2].forEach((i) => {
    limb(c, xs[i], top, length, width, legSwing(pose, offsets[i]), i % 2 ? far : near, hoof);
  });
}

function tail(c, x, y, color, tuft, pose) {
  const swing = pose.kind === 'run' ? Math.sin(pose.phase * TAU) * 10 : 3;
  c.lineCap = 'round';
  c.strokeStyle = INK;
  c.lineWidth = 11;
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x - 26, y + 2 + swing, x - 34, y + 34 + swing);
  c.stroke();
  c.strokeStyle = color;
  c.lineWidth = 5;
  c.stroke();
  shape(c, tuft, () => circle(c, x - 35, y + 40 + swing, 10, 13), 4);
}

// A big cartoon face turned toward the player.
function face(c, x, y, r, o, pose) {
  c.save();
  c.translate(x, y);
  if (pose.kind === 'graze') c.rotate(0.5);
  if (pose.kind === 'dizzy') c.rotate(0.3);

  if (o.horn) {
    const hornPath = (side) => {
      c.moveTo(side * r * 0.48 + r * 0.14, -r * 0.72);
      c.quadraticCurveTo(side * r * 1.2 + r * 0.14, -r * 0.9, side * r * 1.08 + r * 0.14, -r * 1.56);
      c.quadraticCurveTo(side * r * 0.86 + r * 0.14, -r * 1.02, side * r * 0.16 + r * 0.14, -r * 0.92);
      c.closePath();
    };
    shape(c, o.horn, () => hornPath(-1), 4);
    shape(c, o.horn, () => hornPath(1), 4);
  }
  shape(c, o.ear, () => circle(c, -r * 0.92, -r * 0.46, r * 0.46, r * 0.24, -0.35), 4);
  shape(c, o.ear, () => circle(c, r * 1.16, -r * 0.46, r * 0.46, r * 0.24, 0.35), 4);
  shape(c, o.skin, () => c.roundRect(-r * 0.76, -r, r * 1.76, r * 1.86, r * 0.82));
  o.markings?.(c, r);
  shape(c, o.muzzle, () => circle(c, r * 0.13, r * 0.5, r * 0.83, r * 0.56));
  c.fillStyle = INK;
  c.beginPath();
  circle(c, -r * 0.16, r * 0.42, r * 0.09, r * 0.13);
  circle(c, r * 0.42, r * 0.42, r * 0.09, r * 0.13);
  c.fill();

  const eyeXs = [-r * 0.3, r * 0.56];
  const eyeY = -r * 0.32;
  if (pose.kind === 'dizzy') {
    c.lineWidth = 6;
    c.strokeStyle = INK;
    c.lineCap = 'round';
    for (const ex of eyeXs) {
      c.beginPath();
      c.moveTo(ex - 11, eyeY - 11);
      c.lineTo(ex + 11, eyeY + 11);
      c.moveTo(ex + 11, eyeY - 11);
      c.lineTo(ex - 11, eyeY + 11);
      c.stroke();
    }
    shape(c, '#f36f8e', () => c.roundRect(r * 0.2, r * 0.74, r * 0.34, r * 0.56, r * 0.15), 4);
  } else {
    for (const ex of eyeXs) {
      shape(c, '#fff', () => circle(c, ex, eyeY, r * 0.3, r * 0.34), 4);
      c.fillStyle = INK;
      c.beginPath();
      circle(c, ex + r * 0.1, eyeY + r * 0.03, r * 0.16, r * 0.19);
      c.fill();
      c.fillStyle = '#fff';
      c.beginPath();
      circle(c, ex + r * 0.16, eyeY - r * 0.08, r * 0.06);
      c.fill();
      if (o.eyes === 'sleepy') {
        shape(c, o.skin, () => c.roundRect(ex - r * 0.33, eyeY - r * 0.38, r * 0.66, r * 0.36, r * 0.1), 4);
      }
    }
    if (o.eyes === 'angry') {
      c.lineWidth = 8;
      c.strokeStyle = INK;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(eyeXs[0] - r * 0.36, eyeY - r * 0.48);
      c.lineTo(eyeXs[0] + r * 0.3, eyeY - r * 0.24);
      c.moveTo(eyeXs[1] + r * 0.36, eyeY - r * 0.48);
      c.lineTo(eyeXs[1] - r * 0.3, eyeY - r * 0.24);
      c.stroke();
    }
    c.lineWidth = 4;
    c.strokeStyle = INK;
    c.lineCap = 'round';
    c.beginPath();
    if (o.eyes === 'angry') c.arc(r * 0.13, r * 0.95, r * 0.26, TAU * 0.6, TAU * 0.9);
    else c.arc(r * 0.13, r * 0.58, r * 0.3, TAU * 0.1, TAU * 0.4);
    c.stroke();
  }
  o.topper?.(c, r);
  c.restore();
}

const head = (pose, x, y) => (pose.kind === 'graze' ? [x + 16, y + 56] : [x, y]);

function daisy(c, pose) {
  const y = -bob(pose);
  legSet(c, pose, { xs: [-44, -24, 28, 48], top: -46, length: 46, width: 22, near: '#f8cc3f', far: '#dfae29', hoof: '#a06a2c' });
  c.save();
  c.translate(0, y);
  tail(c, -62, -80, '#f8cc3f', '#e08d2b', pose);
  shape(c, '#fcd84d', () => circle(c, -4, -80, 70, 46));
  shape(c, '#fff0ae', () => circle(c, 0, -60, 46, 22), 0);
  shape(c, '#f6b83a', () => circle(c, -34, -104, 18, 13, 0.4), 0);
  const [x, hy] = head(pose, 66, -104);
  face(c, x, hy, 39, {
    skin: '#fcd84d', muzzle: '#ffc6b3', ear: '#f6b83a',
    topper: (ctx, r) => shape(ctx, '#e08d2b', () => {
      ctx.moveTo(-r * 0.14, -r * 0.92);
      ctx.quadraticCurveTo(r * 0.1, -r * 1.42, r * 0.32, -r * 1.06);
      ctx.quadraticCurveTo(r * 0.46, -r * 1.4, r * 0.62, -r * 0.9);
      ctx.closePath();
    }, 4),
  }, pose);
  c.restore();
}

function patch(c, pose) {
  const y = -bob(pose);
  legSet(c, pose, { xs: [-54, -34, 32, 54], top: -60, length: 60, width: 21, near: '#fbfbf4', far: '#d9d9cf', hoof: '#57524c' });
  c.save();
  c.translate(0, y);
  tail(c, -76, -112, '#fbfbf4', '#3b3b3f', pose);
  shape(c, '#fbfbf4', () => c.roundRect(-82, -136, 150, 76, 36));
  c.save();
  c.beginPath();
  c.roundRect(-80, -134, 146, 72, 34);
  c.clip();
  shape(c, '#33333b', () => {
    circle(c, -56, -116, 34, 28, 0.4);
    circle(c, 30, -72, 30, 22, -0.3);
    circle(c, -16, -66, 12);
    circle(c, 48, -130, 20, 12);
  }, 0);
  c.restore();
  shape(c, '#ffa9b9', () => circle(c, 8, -55, 18, 11), 4);
  const [x, hy] = head(pose, 78, -130);
  face(c, x, hy, 38, {
    skin: '#fbfbf4', muzzle: '#ffb9c4', ear: '#33333b', horn: '#eadcb8',
    markings: (ctx, r) => shape(ctx, '#33333b', () => circle(ctx, r * 0.56, -r * 0.42, r * 0.5, r * 0.46), 0),
  }, pose);
  c.restore();
}

function bluebell(c, pose) {
  const y = -bob(pose);
  legSet(c, pose, { xs: [-54, -32, 34, 58], top: -56, length: 56, width: 27, near: '#4f8fe8', far: '#3672c8', hoof: '#274a7e' });
  c.save();
  c.translate(0, y);
  tail(c, -80, -104, '#4f8fe8', '#274a7e', pose);
  shape(c, '#5a9bf0', () => {
    c.moveTo(-82, -82);
    c.bezierCurveTo(-90, -130, -40, -128, 0, -132);
    c.bezierCurveTo(30, -158, 90, -150, 92, -96);
    c.bezierCurveTo(92, -56, 40, -50, 0, -50);
    c.bezierCurveTo(-40, -50, -80, -50, -82, -82);
  });
  shape(c, '#a8ccfa', () => circle(c, 6, -62, 56, 14), 0);
  const [x, hy] = head(pose, 92, -112);
  face(c, x, hy, 41, {
    skin: '#5a9bf0', muzzle: '#c5defc', ear: '#3672c8', horn: '#fff3cf', eyes: 'sleepy',
    topper: (ctx, r) => {
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#f2b52a';
      ctx.beginPath();
      ctx.arc(r * 0.13, r * 0.98, r * 0.2, 0, TAU);
      ctx.stroke();
    },
  }, pose);
  c.restore();
}

function captain(c, pose) {
  const y = -bob(pose);
  const flap = pose.kind === 'run' ? Math.sin(pose.phase * TAU) * 12 : 0;
  c.save();
  c.translate(0, y);
  shape(c, '#e23a3a', () => {
    c.moveTo(34, -128);
    c.bezierCurveTo(-30, -150, -72, -138 + flap, -134, -120 - flap);
    c.lineTo(-112, -92 + flap);
    c.lineTo(-138, -68 + flap);
    c.bezierCurveTo(-90, -62 - flap, -30, -78, 34, -96);
    c.closePath();
  });
  c.restore();
  legSet(c, pose, { xs: [-48, -28, 28, 48], top: -54, length: 54, width: 21, near: '#fff1d6', far: '#e0cca6', hoof: '#a13030' });
  c.save();
  c.translate(0, y);
  shape(c, '#fff1d6', () => c.roundRect(-72, -130, 136, 76, 36));
  shape(c, '#e8554f', () => {
    circle(c, -46, -90, 15);
    circle(c, -12, -112, 11);
    circle(c, 26, -80, 13);
    circle(c, -22, -72, 8);
  }, 0);
  shape(c, '#f2b52a', () => c.roundRect(40, -132, 20, 44, 7), 4);
  const [x, hy] = head(pose, 76, -132);
  face(c, x, hy, 37, {
    skin: '#fff1d6', muzzle: '#ffc9c0', ear: '#e8554f', horn: '#f2b52a',
    topper: (ctx, r) => {
      shape(ctx, '#7a4a22', () => ctx.roundRect(-r * 0.86, -r * 0.68, r * 1.98, r * 0.16, 4), 3);
      shape(ctx, 'rgba(160,220,255,0.35)', () => {
        circle(ctx, -r * 0.3, -r * 0.32, r * 0.42);
        circle(ctx, r * 0.56, -r * 0.32, r * 0.42);
      }, 5, '#7a4a22');
    },
  }, pose);
  c.restore();
}

function rusty(c, pose) {
  const y = -bob(pose);
  legSet(c, pose, { xs: [-56, -40, 36, 56], top: -46, length: 46, width: 26, near: '#a8391d', far: '#83290f', hoof: '#3a2414' });
  c.save();
  c.translate(0, y);
  tail(c, -74, -94, '#a8391d', '#4f2410', pose);
  shape(c, '#c9472a', () => c.roundRect(-82, -112, 130, 70, 32));
  shape(c, '#5e2c14', () => {
    c.moveTo(-20, -72);
    c.bezierCurveTo(-44, -130, -12, -170, 36, -170);
    c.bezierCurveTo(84, -170, 112, -130, 100, -92);
    c.bezierCurveTo(90, -50, 34, -34, -6, -50);
    c.closePath();
  });
  c.lineWidth = 4;
  c.strokeStyle = '#874822';
  for (const [x1, y1] of [[10, -144], [38, -152], [66, -136], [0, -108], [28, -118], [20, -76]]) {
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x1 - 12, y1 + 14);
    c.stroke();
  }
  const [x, hy] = head(pose, 94, -92);
  shape(c, '#5e2c14', () => {
    c.moveTo(x - 22, hy + 36);
    c.lineTo(x + 6, hy + 72);
    c.lineTo(x + 30, hy + 36);
    c.closePath();
  }, 4);
  face(c, x, hy, 40, {
    skin: '#c9472a', muzzle: '#6e3a20', ear: '#83290f', horn: '#f2e4c4', eyes: 'angry',
    topper: (ctx, r) => shape(ctx, '#5e2c14', () => circle(ctx, r * 0.13, -r * 0.92, r * 0.62, r * 0.28), 4),
  }, pose);
  c.restore();
}

function golden(c, pose) {
  const y = -bob(pose);
  legSet(c, pose, { xs: [-44, -24, 28, 48], top: -46, length: 46, width: 22, near: '#f4b816', far: '#c98f0a', hoof: '#fff0ae' });
  c.save();
  c.translate(0, y);
  tail(c, -62, -82, '#f4b816', '#fff0ae', pose);
  const gleam = c.createLinearGradient(-70, -126, 50, -36);
  gleam.addColorStop(0, '#fff1a0');
  gleam.addColorStop(0.5, '#ffc61f');
  gleam.addColorStop(1, '#e89c07');
  shape(c, gleam, () => circle(c, -4, -80, 70, 46));
  shape(c, 'rgba(255,255,255,0.7)', () => circle(c, -26, -104, 26, 8, -0.3), 0);
  const [x, hy] = head(pose, 66, -104);
  face(c, x, hy, 39, {
    skin: '#ffd23f', muzzle: '#fff0ae', ear: '#e89c07', horn: '#fffbe8',
  }, pose);
  c.restore();
}

function skunk(c, pose) {
  const y = -bob(pose) * 0.6;
  const wave = pose.kind === 'run' ? Math.sin(pose.phase * TAU) * 6 : 0;
  legSet(c, pose, { xs: [-30, -14, 26, 42], top: -30, length: 30, width: 18, near: '#2c2c36', far: '#1d1d25', hoof: '#14141a' });
  c.save();
  c.translate(0, y);
  shape(c, '#2c2c36', () => {
    c.moveTo(-40, -44);
    c.bezierCurveTo(-110, -30, -116, -120, -86 + wave, -152);
    c.bezierCurveTo(-58, -178, -18 + wave, -160, -30, -128);
    c.bezierCurveTo(-46, -112, -44, -84, -26, -70);
    c.closePath();
  });
  shape(c, '#fafafa', () => {
    c.moveTo(-58, -68);
    c.bezierCurveTo(-92, -82, -92, -126, -70 + wave, -150);
    c.bezierCurveTo(-58, -160, -48 + wave, -152, -56, -136);
    c.bezierCurveTo(-68, -114, -66, -92, -50, -76);
    c.closePath();
  }, 0);
  shape(c, '#2c2c36', () => circle(c, 2, -58, 56, 34));
  shape(c, '#fafafa', () => {
    c.moveTo(-50, -74);
    c.bezierCurveTo(-20, -102, 26, -100, 58, -78);
    c.bezierCurveTo(26, -84, -18, -84, -50, -60);
    c.closePath();
  }, 0);
  const [x, hy] = head(pose, 60, -68);
  face(c, x, hy, 31, {
    skin: '#2c2c36', muzzle: '#46465a', ear: '#2c2c36',
    markings: (ctx, r) => shape(ctx, '#fafafa', () => ctx.roundRect(r * 0.03, -r, r * 0.2, r * 1.2, r * 0.1), 0),
  }, pose);
  c.restore();
}

function porcupine(c, pose) {
  const y = -bob(pose) * 0.5;
  legSet(c, pose, { xs: [-28, -14, 16, 30], top: -22, length: 22, width: 17, near: '#7a5634', far: '#5e4026', hoof: '#3a2414' });
  c.save();
  c.translate(0, y);
  for (let angle = -3.3; angle < 0.35; angle += 0.26) {
    const nudge = pose.kind === 'run' ? Math.sin(pose.phase * TAU + angle * 3) * 3 : 0;
    const reach = 92 + nudge;
    const px = -8 + Math.cos(angle) * reach;
    const py = -50 + Math.sin(angle) * reach * 0.92;
    const sideX = Math.cos(angle + Math.PI / 2) * 11;
    const sideY = Math.sin(angle + Math.PI / 2) * 11;
    const baseX = -8 + Math.cos(angle) * 46;
    const baseY = -50 + Math.sin(angle) * 40;
    shape(c, '#f4ead2', () => {
      c.moveTo(baseX - sideX, baseY - sideY);
      c.lineTo(px, py);
      c.lineTo(baseX + sideX, baseY + sideY);
      c.closePath();
    }, 4);
    shape(c, '#3a2414', () => {
      c.moveTo(px - (px - baseX) * 0.22 - sideX * 0.2, py - (py - baseY) * 0.22 - sideY * 0.2);
      c.lineTo(px, py);
      c.lineTo(px - (px - baseX) * 0.22 + sideX * 0.2, py - (py - baseY) * 0.22 + sideY * 0.2);
      c.closePath();
    }, 0);
  }
  shape(c, '#8c6540', () => circle(c, -6, -50, 58, 42));
  const [x, hy] = head(pose, 52, -50);
  face(c, x, hy, 28, { skin: '#b08a5d', muzzle: '#e7cfa8', ear: '#8c6540' }, pose);
  c.restore();
}

const DRAW = { A1: daisy, A2: patch, A3: bluebell, A4: captain, A5: rusty, S1: golden, H1: skunk, H2: porcupine };

const sprites = new Map();

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function animalSprite(type, kind, frame, haze) {
  const key = `${type}.${kind}.${frame}.${haze}`;
  let sprite = sprites.get(key);
  if (sprite) return sprite;
  const resolution = resolutionFor(haze);
  sprite = makeCanvas(Math.ceil(CELL.w * resolution), Math.ceil(CELL.h * resolution));
  const c = sprite.getContext('2d');
  c.scale(resolution, resolution);
  c.translate(CELL.x, CELL.y);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  DRAW[type](c, { kind, phase: frame / RUN_FRAMES });
  if (haze) {
    c.globalCompositeOperation = 'source-atop';
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = `rgba(214, 232, 214, ${haze})`;
    c.fillRect(0, 0, sprite.width, sprite.height);
  }
  sprites.set(key, sprite);
  return sprite;
}

export function drawAnimal(c, type, pose, x, y, scale, flip, haze = 0) {
  const frame = pose.kind === 'run' ? Math.floor(pose.phase * RUN_FRAMES) % RUN_FRAMES : pose.kind === 'graze' ? Math.floor(pose.phase * 2) % 2 : 0;
  const sprite = animalSprite(type, pose.kind === 'graze' ? 'graze' : pose.kind, frame, haze);
  c.save();
  c.translate(x, y);
  c.scale(flip ? -scale : scale, scale);
  c.drawImage(sprite, -CELL.x, -CELL.y, CELL.w, CELL.h);
  c.restore();
}

// Paints one animal into a small canvas for menus, intro cards and stickers.
export function portrait(type, size, kind = 'run') {
  const canvas = makeCanvas(size * 2, size * 2);
  const c = canvas.getContext('2d');
  c.scale(2, 2);
  drawAnimal(c, type, { kind, phase: 0.2 }, size * 0.47, size * 0.88, size / 335, false);
  return canvas;
}

function hatShape(c, hat) {
  if (hat === 'hat_cowboy' || hat === 'hat_sheriff') {
    const felt = hat === 'hat_cowboy' ? '#a4622c' : '#3f3a46';
    shape(c, felt, () => {
      c.moveTo(-74, 8);
      c.bezierCurveTo(-52, -14, 52, -14, 74, 8);
      c.bezierCurveTo(44, 24, -44, 24, -74, 8);
    });
    shape(c, felt, () => {
      c.moveTo(-38, 4);
      c.bezierCurveTo(-42, -62, -14, -66, 0, -52);
      c.bezierCurveTo(14, -66, 42, -62, 38, 4);
      c.closePath();
    });
    shape(c, '#e23a3a', () => c.roundRect(-38, -14, 76, 13, 5), 4);
    if (hat === 'hat_sheriff') {
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 ? 7 : 16;
        const angle = -Math.PI / 2 + (i * TAU) / 10;
        c.lineTo(Math.cos(angle) * radius, -32 + Math.sin(angle) * radius);
      }
      c.closePath();
      c.fillStyle = '#ffd23f';
      c.fill();
      c.lineWidth = 3;
      c.strokeStyle = INK;
      c.stroke();
    }
  } else if (hat === 'hat_straw') {
    shape(c, '#f0cf78', () => circle(c, 0, 4, 78, 15));
    shape(c, '#f0cf78', () => {
      c.moveTo(-36, 4);
      c.bezierCurveTo(-34, -46, 34, -46, 36, 4);
      c.closePath();
    });
    shape(c, '#3fa7a0', () => c.roundRect(-36, -10, 72, 12, 5), 4);
  } else if (hat === 'hat_party') {
    shape(c, '#ee5da8', () => {
      c.moveTo(-36, 6);
      c.lineTo(0, -74);
      c.lineTo(36, 6);
      c.closePath();
    });
    shape(c, '#ffe066', () => circle(c, 0, -76, 12), 4);
    shape(c, '#fff', () => {
      circle(c, -9, -12, 7);
      circle(c, 12, -30, 6);
      circle(c, -4, -44, 5);
    }, 0);
  } else if (hat === 'hat_crown') {
    shape(c, '#ffd23f', () => {
      c.moveTo(-44, 6);
      c.lineTo(-52, -44);
      c.lineTo(-22, -20);
      c.lineTo(0, -58);
      c.lineTo(22, -20);
      c.lineTo(52, -44);
      c.lineTo(44, 6);
      c.closePath();
    });
    shape(c, '#e23a3a', () => circle(c, 0, -14, 9), 4);
  }
}

export function hatIcon(hat, size) {
  const canvas = makeCanvas(size * 2, size * 2);
  const c = canvas.getContext('2d');
  c.scale(2, 2);
  c.translate(size / 2, size * 0.68);
  c.scale(size / 180, size / 180);
  c.lineJoin = 'round';
  hatShape(c, hat);
  return canvas;
}

// Biscuit the horse: origin at the bottom of the neck.
export function drawMascot(c, state, time, hat) {
  const lift = state === 'excited' ? Math.abs(Math.sin(time * 9)) * 12 : Math.sin(time * 2) * 3;
  const nod = state === 'laugh' ? Math.sin(time * 14) * 0.05 : state === 'cheer' ? Math.sin(time * 9) * 0.04 : 0;
  const skin = '#c97a3a';
  const dark = '#8e4f22';
  const mane = '#4f2b18';
  const cream = '#f5e2c1';

  c.save();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.translate(0, -lift);

  shape(c, mane, () => {
    c.moveTo(-74, 34);
    c.bezierCurveTo(-96, -60, -74, -140, -14, -190);
    c.bezierCurveTo(-10, -160, -22, -60, -30, 34);
    c.closePath();
  });
  shape(c, skin, () => {
    c.moveTo(-56, 34);
    c.bezierCurveTo(-64, -60, -34, -130, 6, -160);
    c.lineTo(66, -130);
    c.bezierCurveTo(44, -70, 54, -20, 64, 34);
    c.closePath();
  });

  c.translate(20, -150);
  c.rotate(0.12 + nod);

  shape(c, skin, () => circle(c, -32, -62, 13, 26, -0.3));
  shape(c, skin, () => circle(c, 24, -66, 13, 26, 0.25));
  shape(c, '#eeaf88', () => circle(c, -32, -60, 6, 15, -0.3), 0);
  shape(c, '#eeaf88', () => circle(c, 24, -64, 6, 15, 0.25), 0);
  shape(c, skin, () => {
    c.moveTo(-54, -26);
    c.bezierCurveTo(-48, -64, 28, -68, 50, -26);
    c.bezierCurveTo(84, -4, 118, 18, 116, 48);
    c.bezierCurveTo(112, 86, 44, 96, 8, 72);
    c.bezierCurveTo(-30, 50, -60, 6, -54, -26);
  });
  shape(c, cream, () => {
    c.moveTo(-14, -54);
    c.bezierCurveTo(6, -58, 18, -38, 34, -16);
    c.bezierCurveTo(46, 2, 30, 12, 18, 2);
    c.bezierCurveTo(4, -14, -16, -34, -14, -54);
  }, 0);
  shape(c, cream, () => {
    c.moveTo(36, 20);
    c.bezierCurveTo(70, 0, 116, 18, 116, 48);
    c.bezierCurveTo(112, 86, 44, 96, 20, 76);
    c.bezierCurveTo(10, 60, 18, 34, 36, 20);
  });

  c.fillStyle = dark;
  c.beginPath();
  circle(c, 84, 28, 7, 5, 0.3);
  c.fill();

  const eye = (x, y) => {
    if (state === 'laugh') {
      c.lineWidth = 6;
      c.strokeStyle = INK;
      c.beginPath();
      c.arc(x, y + 6, 13, Math.PI, 0);
      c.stroke();
    } else if (state === 'wince' || state === 'nose') {
      c.lineWidth = 6;
      c.strokeStyle = INK;
      c.beginPath();
      c.moveTo(x - 12, y - 7);
      c.lineTo(x + 10, y);
      c.lineTo(x - 12, y + 7);
      c.stroke();
    } else {
      const radius = state === 'excited' ? 19 : 16;
      shape(c, '#fff', () => circle(c, x, y, radius, radius + 2), 4);
      c.fillStyle = INK;
      c.beginPath();
      circle(c, x + 4, y + 1, radius * 0.56);
      c.fill();
      c.fillStyle = '#fff';
      c.beginPath();
      circle(c, x + 7, y - 4, 3.5);
      c.fill();
    }
  };
  eye(-16, -14);
  eye(34, -24);

  if (state === 'cheer' || state === 'laugh') {
    const depth = state === 'laugh' ? 36 : 24;
    shape(c, '#7c2230', () => {
      c.moveTo(26, 50);
      c.quadraticCurveTo(70, 66, 108, 44);
      c.quadraticCurveTo(84, 50 + depth + 12, 42, 56 + depth * 0.7);
      c.closePath();
    }, 4);
    shape(c, '#fff', () => {
      c.moveTo(30, 51);
      c.quadraticCurveTo(70, 66, 104, 46);
      c.lineTo(100, 60);
      c.quadraticCurveTo(68, 76, 36, 62);
      c.closePath();
    }, 3);
  } else if (state === 'wince' || state === 'nose') {
    c.lineWidth = 5;
    c.strokeStyle = INK;
    c.beginPath();
    c.moveTo(36, 60);
    c.quadraticCurveTo(48, 50, 60, 60);
    c.quadraticCurveTo(72, 70, 88, 58);
    c.stroke();
  } else {
    c.lineWidth = 5;
    c.strokeStyle = INK;
    c.beginPath();
    c.moveTo(34, 56);
    c.quadraticCurveTo(66, 74, 100, 50);
    c.stroke();
  }

  if (state === 'nose') {
    shape(c, skin, () => c.roundRect(40, 26, 86, 34, 16));
    shape(c, dark, () => c.roundRect(100, 24, 30, 38, 10), 4);
  }
  shape(c, mane, () => {
    c.moveTo(-26, -52);
    c.bezierCurveTo(-30, -82, 6, -92, 20, -60);
    c.bezierCurveTo(4, -66, 0, -52, -8, -44);
    c.closePath();
  }, 4);
  if (hat) {
    c.save();
    c.translate(-4, -68);
    c.rotate(-0.1);
    hatShape(c, hat);
    c.restore();
  }
  c.restore();
}

// The gloved hand that holds the rope at the bottom of each lane.
export function drawHand(c, x, y, colors, action) {
  c.save();
  c.translate(x, y + (action === 'throw' ? -16 : 0));
  c.rotate(action === 'throw' ? -0.08 : 0.06);
  c.lineJoin = 'round';
  shape(c, '#6e3f1d', () => c.roundRect(-24, 48, 48, 90, 12));
  shape(c, '#d9a35b', () => c.roundRect(-30, 36, 60, 20, 8));
  c.lineWidth = 9;
  c.lineCap = 'round';
  for (const [rx, ry, dy] of [[56, 19, 0], [50, 16, -10], [44, 14, -19]]) {
    c.strokeStyle = INK;
    c.lineWidth = 13;
    c.beginPath();
    circle(c, 0, dy, rx, ry);
    c.stroke();
    c.strokeStyle = colors[0];
    c.lineWidth = 8;
    c.beginPath();
    circle(c, 0, dy, rx, ry);
    c.stroke();
  }
  shape(c, '#b5763a', () => c.roundRect(-34, -14, 68, 56, 22));
  shape(c, '#c98a4a', () => {
    c.roundRect(-30, -22, 16, 30, 8);
    c.roundRect(-13, -26, 16, 34, 8);
    c.roundRect(4, -24, 16, 32, 8);
    c.roundRect(21, -18, 15, 28, 7);
  }, 4);
  c.restore();
}

