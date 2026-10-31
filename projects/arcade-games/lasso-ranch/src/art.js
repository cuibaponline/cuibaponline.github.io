// Every character is drawn with canvas paths, then cached as sprites. Local coordinates: feet on y = 0, facing right.
const TAU = Math.PI * 2;
const INK = '#3a2414';
const CELL = { w: 380, h: 235, x: 190, y: 205 };
// Back rows are drawn smaller, so their sprites can use less memory.
const resolutionFor = (haze) => (haze > 0.15 ? 1.2 : haze > 0 ? 1.5 : 2);
const RUN_FRAMES = 6;

// Line weights: a heavy contour holds the character together, fine lines stay inside it.
const LINE = 6.5;
const FINE = 3.5;
const PIVOT = 78;

const lerp = (a, b, t) => a + (b - a) * t;

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

function pen(c, color, width, build) {
  c.beginPath();
  build();
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}

function gloss(c, x, y, rx, ry, rotation = 0, alpha = 0.6) {
  c.fillStyle = `rgba(255,255,255,${alpha})`;
  c.beginPath();
  circle(c, x, y, rx, ry, rotation);
  c.fill();
}

function twinkle(c, x, y, size, fill = '#fff', ink = null) {
  shape(c, fill, () => {
    for (let i = 0; i < 8; i++) {
      const reach = i % 2 ? size * 0.3 : size;
      const angle = (i * TAU) / 8 - Math.PI / 2;
      c[i ? 'lineTo' : 'moveTo'](x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
    }
    c.closePath();
  }, ink ? FINE : 0, ink);
}

// A solid form: base colour, whatever paint() adds, then one cel shadow that follows the form's own edge.
function mass(c, tone, build, paint, slide = [-8, -11], width = LINE) {
  c.save();
  c.beginPath();
  build();
  c.fillStyle = tone.skin;
  c.fill();
  c.clip();
  paint?.();
  c.translate(slide[0], slide[1]);
  c.beginPath();
  build();
  c.rect(-500, -500, 1000, 1000);
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = tone.shade;
  c.fill('evenodd');
  c.restore();
  pen(c, tone.ink, width, build);
}

// Gaits. Feet are planned on the ground and legs reach for them, so a planted hoof really stays planted.
// phases: back far, back near, front far, front near.
const GAITS = {
  toddle: { stride: 13, lift: 15, bob: 9, tilt: 0.05, stretch: 0.05, beat: 2, phases: [0.5, 0, 0, 0.5], sit: 16 },
  lope: { stride: 25, lift: 22, bob: 15, tilt: 0.09, stretch: 0.09, beat: 1, air: 0.5, phases: [0.1, 0, 0.6, 0.5], sit: 26 },
  plod: { stride: 17, lift: 13, bob: 6, tilt: 0.035, stretch: 0.04, beat: 2, phases: [0.5, 0, 0, 0.5], sit: 20 },
  leap: { stride: 34, lift: 26, bob: 15, tilt: 0.12, stretch: 0.12, beat: 1, air: 0.7, phases: [0.08, 0, 0.58, 0.5], sit: 26 },
  charge: { stride: 28, lift: 20, bob: 10, tilt: 0.08, stretch: 0.08, beat: 1, air: 0.35, phases: [0.14, 0, 0.64, 0.5], sit: 18 },
  scurry: { stride: 12, lift: 12, bob: 6, tilt: 0.04, stretch: 0.06, beat: 2, phases: [0.5, 0, 0, 0.5], sit: 8 },
  prance: { stride: 24, lift: 26, bob: 15, tilt: 0.09, stretch: 0.08, beat: 1, air: 0.6, phases: [0.12, 0, 0.62, 0.5], sit: 24 },
};

function step(u, g, air) {
  const at = ((u % 1) + 1) % 1;
  if (at < 0.5) return { dx: lerp(g.stride, -g.stride, at * 2), lift: air, tilt: lerp(0.12, -0.2, at * 2) };
  const v = (at - 0.5) * 2;
  return { dx: lerp(-g.stride, g.stride, v * v * (3 - 2 * v)), lift: air + Math.sin(v * Math.PI) * g.lift, tilt: lerp(-0.75, 0.4, v) };
}

function rig(pose, g) {
  const t = pose.phase;
  if (pose.kind === 'graze') {
    const chew = t > 0 ? 1 : 0;
    const feet = g.phases.map((_, i) => ({ dx: i < 2 ? -4 : -8, lift: 0, tilt: 0 }));
    return { y: 0, tilt: 0.09, stretch: 1, nod: 0, flap: chew ? 1 : -1, swish: chew ? 1 : -1, feet, chew };
  }
  if (pose.kind === 'dizzy') {
    const feet = [{ dx: 26, lift: 0, tilt: -0.3 }, { dx: 34, lift: 0, tilt: -0.5 }, { dx: 12, lift: 0, tilt: 0.3 }, { dx: -6, lift: 0, tilt: -0.3 }];
    return { y: -g.sit, tilt: -0.1, stretch: 1.03, nod: 0, flap: 1, swish: 1, feet, chew: 0 };
  }
  const swell = g.beat === 2 ? Math.abs(Math.sin(t * Math.PI * 2)) : 0.5 - 0.5 * Math.cos(t * TAU);
  return {
    y: swell * g.bob,
    tilt: -Math.sin(t * TAU) * g.tilt,
    stretch: 1 + (swell - 0.5) * g.stretch,
    nod: Math.sin((t - 0.12) * TAU * g.beat),
    flap: Math.sin((t - 0.22) * TAU * g.beat),
    swish: Math.sin((t - 0.3) * TAU),
    feet: g.phases.map((shift) => step(t + shift, g, swell * (g.air ?? 0) * g.bob)),
    chew: 0,
  };
}

function moveBody(c, r) {
  c.translate(0, -r.y - PIVOT);
  c.rotate(r.tilt);
  c.scale(r.stretch, 2 - r.stretch);
  c.translate(0, PIVOT);
}

function bodyPoint(r, x, y) {
  const px = x * r.stretch;
  const py = (y + PIVOT) * (2 - r.stretch);
  const cos = Math.cos(r.tilt);
  const sin = Math.sin(r.tilt);
  return [px * cos - py * sin, px * sin + py * cos - r.y - PIVOT];
}

function inBody(c, r, paint) {
  c.save();
  moveBody(c, r);
  paint();
  c.restore();
}

function legPath(c, hip, foot, w) {
  const dx = foot[0] - hip[0];
  const dy = foot[1] - hip[1];
  const span = Math.hypot(dx, dy);
  c.save();
  c.translate(hip[0], hip[1]);
  c.rotate(Math.atan2(-dx, dy));
  c.moveTo(-w * 0.66, 0);
  c.bezierCurveTo(-w * 0.74, span * 0.45, -w * 0.54, span * 0.7, -w * 0.5, span);
  c.lineTo(w * 0.5, span);
  c.bezierCurveTo(w * 0.54, span * 0.7, w * 0.74, span * 0.45, w * 0.66, 0);
  c.restore();
}

function hoof(c, x, y, tilt, w, fill, ink) {
  const h = w * 0.62;
  c.save();
  c.translate(x, y);
  c.rotate(tilt);
  shape(c, fill, () => c.roundRect(-w * 0.64, -h, w * 1.28, h, [w * 0.34, w * 0.34, w * 0.2, w * 0.2]), LINE * 0.8, ink);
  pen(c, ink, FINE * 0.8, () => {
    c.moveTo(w * 0.24, -h * 0.7);
    c.lineTo(w * 0.3, 0);
  });
  gloss(c, -w * 0.2, -h * 0.68, w * 0.26, h * 0.13, 0, 0.45);
  c.restore();
}

// Far legs sit behind the body. Near legs sit in front of it and grow out of it: the heavy contour
// only runs where the leg leaves the body, so body and legs read as one soft form.
function legs(c, r, set, tone, near, body, picks = near ? [1, 3] : [0, 2]) {
  const skin = near ? tone.skin : tone.far;
  const parts = picks.map((i) => {
    const foot = r.feet[i];
    const x = set.xs[i] + foot.dx;
    return { hip: bodyPoint(r, set.xs[i], set.hip), ankle: [x, -foot.lift - set.width * 0.4], foot: [x, -foot.lift], tilt: foot.tilt };
  });
  for (const { hip, ankle } of parts) {
    shape(c, skin, () => legPath(c, hip, ankle, set.width), near ? FINE : LINE, tone.ink);
  }
  if (near) {
    c.save();
    c.save();
    moveBody(c, r);
    c.beginPath();
    c.rect(-500, -500, 1000, 1000);
    body();
    c.restore();
    c.clip('evenodd');
    for (const { hip, ankle } of parts) pen(c, tone.ink, LINE, () => legPath(c, hip, ankle, set.width));
    c.restore();
  }
  for (const { foot, tilt } of parts) hoof(c, foot[0], foot[1], tilt, set.width, tone.hoof, tone.ink);
}

function tail(c, tone, from, bend, to, tuft) {
  const curve = () => {
    c.moveTo(...from);
    c.quadraticCurveTo(...bend, ...to);
  };
  pen(c, tone.ink, 16, curve);
  pen(c, tone.skin, 8, curve);
  tuft(to[0], to[1]);
}

function ear(c, r, tone, side, e, flap) {
  c.save();
  c.translate(side * r * e.x + r * 0.08, -r * e.y);
  c.rotate(side * (e.angle + flap * (e.flop ?? 0.1)));
  c.scale(side, 1);
  const leaf = (k) => {
    c.moveTo(r * 0.02, -r * e.wide * 0.5 * k);
    c.bezierCurveTo(r * e.long * 0.5, -r * e.wide * 0.95 * k, r * e.long * 0.98, -r * e.wide * 0.6 * k, r * e.long * (0.5 + 0.5 * k), 0);
    c.bezierCurveTo(r * e.long * 0.9, r * e.wide * 0.75 * k, r * e.long * 0.4, r * e.wide * 0.8 * k, r * 0.02, r * e.wide * 0.5 * k);
  };
  shape(c, e.skin, () => leaf(1), LINE * 0.85, tone.ink);
  shape(c, e.inner, () => leaf(0.62), 0);
  c.restore();
}

function horn(c, r, tone, side, h) {
  const bx = side * r * h.x + r * 0.1;
  const by = -r * h.y;
  const tx = bx + side * r * h.out;
  const ty = by - r * h.up;
  const thick = r * h.thick;
  shape(c, h.fill, () => {
    c.moveTo(bx + side * thick, by + thick * 0.6);
    c.quadraticCurveTo(tx + side * thick * 0.9, by + thick * 0.2, tx, ty);
    c.quadraticCurveTo(bx + side * r * h.out * 0.3, by - thick * 0.5, bx - side * thick, by + thick * 0.2);
    c.closePath();
  }, LINE * 0.8, tone.ink);
}

function eye(c, x, y, rx, ry, o) {
  const { ink, iris, glow } = o;
  const gaze = o.gaze ?? [0.16, 0.08];
  shape(c, '#fff', () => circle(c, x, y, rx, ry), 0);
  c.save();
  c.beginPath();
  circle(c, x, y, rx, ry);
  c.clip();
  const ix = x + gaze[0] * rx;
  const iy = y + gaze[1] * ry;
  const fade = c.createLinearGradient(0, iy - ry, 0, iy + ry);
  fade.addColorStop(0.25, ink);
  fade.addColorStop(0.68, iris);
  fade.addColorStop(1, glow);
  c.fillStyle = fade;
  c.beginPath();
  circle(c, ix, iy, rx * 0.88, ry * 0.92);
  c.fill();
  c.fillStyle = ink;
  c.beginPath();
  circle(c, ix, iy - ry * 0.08, rx * 0.5, ry * 0.56);
  c.fill();
  c.restore();
  if (o.star) {
    twinkle(c, ix + rx * 0.26, iy - ry * 0.3, rx * 0.72);
    gloss(c, ix - rx * 0.36, iy + ry * 0.42, rx * 0.16, ry * 0.14, 0, 0.95);
  } else {
    gloss(c, ix + rx * 0.32, iy - ry * 0.38, rx * 0.36, ry * 0.32, 0, 1);
    gloss(c, ix - rx * 0.36, iy + ry * 0.42, rx * 0.17, ry * 0.15, 0, 0.9);
  }
  if (o.lid) {
    c.save();
    c.beginPath();
    circle(c, x, y, rx + 0.5, ry + 0.5);
    c.clip();
    c.translate(x, y - ry + ry * 2 * o.lid);
    c.rotate(o.slant ?? 0);
    c.fillStyle = o.skin;
    c.fillRect(-rx * 2, -ry * 3, rx * 4, ry * 3);
    pen(c, ink, 6, () => {
      c.moveTo(-rx * 2, 0);
      c.lineTo(rx * 2, 0);
    });
    c.restore();
  }
  pen(c, ink, FINE, () => circle(c, x, y, rx, ry));
}

function closedEye(c, x, y, rx, ink) {
  pen(c, ink, 5.5, () => {
    c.moveTo(x - rx, y + rx * 0.28);
    c.quadraticCurveTo(x, y - rx * 0.9, x + rx, y + rx * 0.28);
  });
}

function dizzyEye(c, x, y, rx, ry, ink) {
  shape(c, '#fff', () => circle(c, x, y, rx, ry), FINE, ink);
  pen(c, ink, 3.5, () => {
    for (let a = 0; a < TAU * 2.1; a += 0.3) {
      const d = (a / (TAU * 2.1)) * 0.92;
      c.lineTo(x + Math.cos(a) * d * rx, y + Math.sin(a) * d * ry);
    }
  });
}

function lashes(c, x, y, rx, ry, side, ink, count) {
  const spots = [-0.1, -0.42, -0.74].slice(0, count);
  for (const a of spots) {
    const px = x + side * Math.cos(a) * rx;
    const py = y + Math.sin(a) * ry;
    pen(c, ink, 4, () => {
      c.moveTo(px, py);
      c.quadraticCurveTo(px + side * rx * 0.3, py - ry * 0.06, px + side * rx * 0.44, py - ry * 0.26);
    });
  }
}

function mouth(c, r, o, x, y, kind) {
  const { ink } = o.tone;
  const tongue = o.tongue ?? '#ff7f96';
  if (kind === 'laugh') {
    shape(c, '#8c2439', () => {
      c.moveTo(x - r * 0.42, y - r * 0.05);
      c.quadraticCurveTo(x, y + r * 0.1, x + r * 0.42, y - r * 0.05);
      c.bezierCurveTo(x + r * 0.4, y + r * 0.42, x - r * 0.4, y + r * 0.42, x - r * 0.42, y - r * 0.05);
    }, FINE + 0.5, ink);
    c.save();
    c.beginPath();
    c.moveTo(x - r * 0.42, y - r * 0.05);
    c.quadraticCurveTo(x, y + r * 0.1, x + r * 0.42, y - r * 0.05);
    c.bezierCurveTo(x + r * 0.4, y + r * 0.42, x - r * 0.4, y + r * 0.42, x - r * 0.42, y - r * 0.05);
    c.clip();
    shape(c, tongue, () => circle(c, x + r * 0.03, y + r * 0.36, r * 0.27, r * 0.2), 0);
    c.restore();
  } else if (kind === 'grin') {
    const lip = () => {
      c.moveTo(x - r * 0.48, y - r * 0.08);
      c.quadraticCurveTo(x, y + r * 0.12, x + r * 0.46, y - r * 0.12);
      c.quadraticCurveTo(x + r * 0.36, y + r * 0.32, x, y + r * 0.3);
      c.quadraticCurveTo(x - r * 0.36, y + r * 0.32, x - r * 0.48, y - r * 0.08);
      c.closePath();
    };
    shape(c, '#fff', lip, FINE + 0.5, ink);
  } else if (kind === 'pout') {
    pen(c, ink, 5, () => {
      c.moveTo(x - r * 0.36, y + r * 0.16);
      c.quadraticCurveTo(x, y - r * 0.12, x + r * 0.36, y + r * 0.16);
    });
    pen(c, ink, FINE, () => {
      c.moveTo(x - r * 0.12, y + r * 0.2);
      c.quadraticCurveTo(x, y + r * 0.27, x + r * 0.12, y + r * 0.2);
    });
  } else if (kind === 'hum') {
    pen(c, ink, 4.5, () => {
      c.moveTo(x - r * 0.26, y + r * 0.02);
      c.quadraticCurveTo(x, y + r * 0.13, x + r * 0.26, y);
    });
  } else if (kind === 'chew') {
    pen(c, ink, 4.5, () => {
      c.moveTo(x - r * 0.3, y);
      c.quadraticCurveTo(x - r * 0.15, y + r * 0.14, x, y + r * 0.02);
      c.quadraticCurveTo(x + r * 0.15, y + r * 0.14, x + r * 0.3, y);
    });
  } else if (kind === 'dizzy') {
    shape(c, tongue, () => c.roundRect(x - r * 0.02, y, r * 0.3, r * 0.5, [r * 0.04, r * 0.04, r * 0.15, r * 0.15]), FINE, ink);
    pen(c, ink, 4.5, () => {
      c.moveTo(x - r * 0.34, y + r * 0.04);
      c.quadraticCurveTo(x - r * 0.16, y - r * 0.12, x, y + r * 0.03);
      c.quadraticCurveTo(x + r * 0.17, y + r * 0.16, x + r * 0.36, y - r * 0.02);
    });
    pen(c, '#d94d6c', 2.5, () => {
      c.moveTo(x + r * 0.13, y + r * 0.08);
      c.lineTo(x + r * 0.13, y + r * 0.3);
    });
  } else {
    pen(c, ink, 4.5, () => {
      c.moveTo(x - r * 0.32, y - r * 0.02);
      c.quadraticCurveTo(x, y + r * 0.24, x + r * 0.32, y - r * 0.04);
    });
  }
}

function grass(c, x, y) {
  c.save();
  c.translate(x, y);
  for (const [dx, lean, tall, fill] of [[-15, -9, 24, '#5cb338'], [13, 12, 22, '#5cb338'], [-5, -3, 34, '#7fd14a'], [6, 5, 29, '#6ec23f']]) {
    shape(c, fill, () => {
      c.moveTo(dx - 5, 2);
      c.quadraticCurveTo(dx + lean * 0.4, -tall * 0.5, dx + lean, -tall);
      c.quadraticCurveTo(dx + lean * 0.5 + 4, -tall * 0.4, dx + 5, 2);
      c.closePath();
    }, FINE - 0.5, '#2d6b1c');
  }
  c.restore();
}

// A big soft head in three-quarter view: the features sit toward the way the animal is facing.
function cowHead(c, x, y, tilt, r, o, pose, rg) {
  const { tone: t, skull = {} } = o;
  const dizzy = pose.kind === 'dizzy';
  const graze = pose.kind === 'graze';
  const turn = r * 0.15;
  const wide = r * (skull.wide ?? 1.08);
  const tall = r * (skull.tall ?? 0.98);
  const jaw = r * (skull.jaw ?? 0.9);
  const flap = dizzy ? 1 : rg.flap;

  c.save();
  c.translate(x, y);
  c.rotate(tilt + (dizzy ? 0.2 : graze ? 0.16 : 0));

  o.back?.(r);
  if (o.horn) horn(c, r, t, 1, o.horn);
  if (o.ear) ear(c, r, t, 1, o.ear, flap);
  const skullPath = () => {
    c.moveTo(0, -tall);
    c.bezierCurveTo(wide * 0.76, -tall, wide * 1.02, -tall * 0.56, wide, -tall * 0.04);
    c.bezierCurveTo(wide * 0.98, tall * 0.5, jaw * 0.8, tall * 1.02, 0, tall);
    c.bezierCurveTo(-jaw * 0.8, tall * 1.02, -wide * 0.98, tall * 0.5, -wide, -tall * 0.04);
    c.bezierCurveTo(-wide * 1.02, -tall * 0.56, -wide * 0.76, -tall, 0, -tall);
    c.closePath();
  };
  mass(c, t, skullPath, () => {
    o.paint?.(r);
    gloss(c, -r * 0.42, -r * 0.62, r * 0.3, r * 0.15, -0.5, 0.5);
  }, [-r * 0.09, -r * 0.1]);
  if (o.horn) horn(c, r, t, -1, o.horn);
  if (o.ear) ear(c, r, t, -1, o.ear, flap);

  // Muzzle
  const mx = turn * 1.1;
  const [mw, mh] = o.snout ?? [0.8, 0.46];
  const my = r * 0.5;
  const muzzle = () => circle(c, mx, my, r * mw, r * mh);
  mass(c, { skin: o.muzzle, shade: t.shade, ink: t.ink }, muzzle, () => gloss(c, mx - r * 0.3, my - r * 0.22, r * 0.26, r * 0.1, -0.2, 0.5), [-3, -6], FINE + 0.5);
  c.fillStyle = o.nostril ?? t.ink;
  c.beginPath();
  circle(c, mx - r * 0.25, my - r * 0.1, r * 0.075, r * 0.1, 0.35);
  circle(c, mx + r * 0.27, my - r * 0.1, r * 0.075, r * 0.1, -0.35);
  c.fill();

  if (o.cheek) {
    c.fillStyle = o.cheek;
    c.beginPath();
    circle(c, turn - r * 0.72, r * 0.22, r * 0.19, r * 0.12);
    circle(c, turn + r * 0.78, r * 0.2, r * 0.16, r * 0.11);
    c.fill();
  }

  // Eyes
  const nearX = turn - r * 0.42;
  const farX = turn + r * 0.46;
  const ey = o.eyeY !== undefined ? r * o.eyeY : -r * 0.14;
  const rx = r * (o.eyeW ?? 0.27);
  const ry = r * (o.eyeH ?? 0.33);
  const look = { ink: t.ink, iris: o.iris[0], glow: o.iris[1], skin: t.skin, star: o.star, gaze: o.gaze };
  if (dizzy) {
    dizzyEye(c, nearX, ey, rx, ry, t.ink);
    dizzyEye(c, farX, ey, rx * 0.9, ry * 0.95, t.ink);
  } else if (graze) {
    closedEye(c, nearX, ey + ry * 0.2, rx, t.ink);
    closedEye(c, farX, ey + ry * 0.2, rx * 0.9, t.ink);
  } else {
    eye(c, nearX, ey, rx, ry, { ...look, lid: o.lid, slant: o.slant });
    eye(c, farX, ey, rx * 0.9, ry * 0.96, { ...look, lid: o.lid, slant: o.slant ? -o.slant : 0 });
    if (o.lashes) {
      lashes(c, nearX, ey, rx, ry, -1, t.ink, o.lashes);
      lashes(c, farX, ey, rx * 0.9, ry * 0.96, 1, t.ink, o.lashes);
    }
    o.brows?.(nearX, farX, ey, rx, ry);
  }

  const mood = dizzy ? 'dizzy' : graze ? 'chew' : o.mouth;
  mouth(c, r, o, mx, my + r * 0.14, mood);
  if (graze) grass(c, mx + r * 0.06, my + r * 0.6 - rg.chew * 2);
  o.front?.(r);
  c.restore();
}

function daisy(c, pose) {
  const r = rig(pose, GAITS.toddle);
  const t = { skin: '#ffd84f', shade: '#ffbf8a', ink: '#5a2a10', far: '#f2b23a', hoof: '#e8824a' };
  const set = { hip: -50, width: 25, xs: [-22, -44, 50, 26] };
  const body = () => {
    c.moveTo(20, -122);
    c.bezierCurveTo(-26, -134, -84, -120, -86, -76);
    c.bezierCurveTo(-88, -38, -50, -24, -12, -24);
    c.bezierCurveTo(28, -24, 56, -42, 56, -78);
    c.bezierCurveTo(56, -102, 44, -116, 20, -122);
    c.closePath();
  };
  legs(c, r, set, t, false);
  inBody(c, r, () => {
    tail(c, t, [-80, -92], [-112, -104 + r.swish * 6], [-112 + r.swish * 4, -68 + r.swish * 8], (x, y) => {
      shape(c, '#ff9d5c', () => circle(c, x, y + 6, 11, 14), LINE * 0.8, t.ink);
    });
    mass(c, t, body, () => {
      shape(c, '#ffb54d', () => {
        circle(c, -64, -106, 34, 26, 0.3);
        circle(c, 8, -128, 22, 12);
      }, 0);
      shape(c, '#fff3bf', () => circle(c, -14, -28, 46, 22), 0);
      gloss(c, -50, -112, 24, 9, -0.4, 0.5);
    });
  });
  legs(c, r, set, t, true, body);
  const graze = pose.kind === 'graze';
  const [x, y] = bodyPoint(r, graze ? 76 : 60, graze ? -54 : -104 + r.nod * 3);
  cowHead(c, x, y, r.tilt + (graze ? 0.1 : 0.04), 58, {
    tone: t,
    skull: { wide: 1.1, tall: 0.98, jaw: 1 },
    muzzle: '#ffdccb',
    nostril: '#c9694f',
    cheek: 'rgba(255,120,110,0.55)',
    iris: ['#8a4a12', '#e8a33c'],
    ear: { skin: '#ffc24a', inner: '#ff9fa0', x: 0.92, y: 0.46, long: 0.98, wide: 0.5, angle: 0.5, flop: 0.2 },
    mouth: 'smile',
    lashes: 2,
    front: (s) => {
      // Curl and a daisy tucked by the ear.
      const curl = () => {
        c.moveTo(s * 0.06, -s * 0.86);
        c.bezierCurveTo(-s * 0.12, -s * 1.3, s * 0.42, -s * 1.46, s * 0.46, -s * 1.14);
        c.bezierCurveTo(s * 0.48, -s * 0.96, s * 0.2, -s * 1, s * 0.24, -s * 1.14);
      };
      pen(c, t.ink, 17, curl);
      pen(c, '#ff9d5c', 8.5, curl);
      for (let i = 0; i < 7; i++) {
        const a = (i * TAU) / 7;
        shape(c, '#fff', () => circle(c, -s * 0.6 + Math.cos(a) * s * 0.17, -s * 0.72 + Math.sin(a) * s * 0.17, s * 0.13, s * 0.09, a), FINE, t.ink);
      }
      shape(c, '#ff9d3c', () => circle(c, -s * 0.6, -s * 0.72, s * 0.12), FINE, t.ink);
    },
  }, pose, r);
}

function patch(c, pose) {
  const r = rig(pose, GAITS.lope);
  const t = { skin: '#fffdf6', shade: '#c9d2f2', ink: '#2c2a4a', far: '#cfd3ea', hoof: '#6a5a8c' };
  const spot = '#35325c';
  const set = { hip: -74, width: 24, xs: [-38, -66, 66, 38] };
  const body = () => {
    c.moveTo(46, -150);
    c.bezierCurveTo(8, -140, -36, -138, -68, -146);
    c.bezierCurveTo(-100, -150, -112, -114, -104, -88);
    c.bezierCurveTo(-98, -60, -60, -54, -20, -52);
    c.bezierCurveTo(16, -50, 60, -56, 70, -88);
    c.bezierCurveTo(78, -116, 70, -146, 46, -150);
    c.closePath();
  };
  legs(c, r, set, t, false);
  inBody(c, r, () => {
    shape(c, '#ff9eb5', () => circle(c, -18, -50, 22, 13), LINE * 0.8, t.ink);
    // Happy tail, up in the air with a heart on the end.
    tail(c, t, [-98, -116], [-136, -128], [-128 + r.swish * 5, -166 - r.swish * 4], (x, y) => {
      shape(c, spot, () => {
        c.moveTo(x, y + 13);
        c.bezierCurveTo(x - 22, y - 2, x - 12, y - 19, x, y - 8);
        c.bezierCurveTo(x + 12, y - 19, x + 22, y - 2, x, y + 13);
        c.closePath();
      }, LINE * 0.8, t.ink);
    });
    mass(c, t, body, () => {
      shape(c, spot, () => {
        c.moveTo(-108, -128);
        c.bezierCurveTo(-92, -152, -46, -150, -46, -122);
        c.bezierCurveTo(-46, -100, -80, -92, -108, -96);
        c.closePath();
      }, 0);
      shape(c, spot, () => {
        circle(c, 34, -142, 26, 15, 0.1);
        circle(c, -12, -148, 15, 9);
      }, 0);
      gloss(c, -14, -132, 22, 7, -0.05, 0.9);
    });
  });
  legs(c, r, set, t, true, body);
  const graze = pose.kind === 'graze';
  const [x, y] = bodyPoint(r, graze ? 100 : 88, graze ? -60 : -142 + r.nod * 4);
  inBody(c, r, () => {
    if (!graze) bandana(c, t);
  });
  cowHead(c, x, y, r.tilt - (graze ? -0.1 : 0.05), 52, {
    tone: t,
    skull: { wide: 1.02, tall: 1.02, jaw: 0.92 },
    muzzle: '#ffb6c6',
    nostril: '#c2476a',
    cheek: 'rgba(255,130,160,0.5)',
    iris: ['#2f6f9e', '#6fd0e8'],
    ear: { skin: spot, inner: '#ff9eb5', x: 0.98, y: 0.72, long: 0.8, wide: 0.46, angle: -0.04, flop: 0.3 },
    horn: { fill: '#ffe6a8', x: 0.4, y: 0.86, out: 0.12, up: 0.44, thick: 0.17 },
    mouth: 'laugh',
    paint: (s) => shape(c, spot, () => {
      // A heart-shaped patch around the near eye.
      const x0 = s * -0.27;
      c.moveTo(x0, s * 0.3);
      c.bezierCurveTo(x0 - s * 0.8, -s * 0.2, x0 - s * 0.6, -s * 0.84, x0 - s * 0.02, -s * 0.54);
      c.bezierCurveTo(x0 + s * 0.46, -s * 0.84, x0 + s * 0.74, -s * 0.2, x0, s * 0.3);
      c.closePath();
    }, 0),
  }, pose, r);
}

function bandana(c, t) {
  shape(c, '#17bdb1', () => {
    c.moveTo(24, -116);
    c.quadraticCurveTo(70, -86, 122, -100);
    c.lineTo(74, -46);
    c.closePath();
  }, LINE * 0.85, t.ink);
  shape(c, '#fff', () => {
    circle(c, 74, -80, 5);
    circle(c, 94, -90, 4);
    circle(c, 74, -60, 4);
    circle(c, 52, -94, 4);
  }, 0);
}

function bluebell(c, pose) {
  const r = rig(pose, GAITS.plod);
  const t = { skin: '#6a9bfa', shade: '#a9a6f0', ink: '#1b2a72', far: '#4a78de', hoof: '#2f4ba8' };
  const set = { hip: -60, width: 31, xs: [-48, -78, 66, 34] };
  const body = () => {
    c.moveTo(40, -136);
    c.bezierCurveTo(4, -146, -40, -134, -70, -130);
    c.bezierCurveTo(-104, -124, -116, -94, -108, -70);
    c.bezierCurveTo(-100, -44, -56, -38, -14, -38);
    c.bezierCurveTo(36, -38, 72, -46, 78, -82);
    c.bezierCurveTo(82, -112, 70, -132, 40, -136);
    c.closePath();
  };
  legs(c, r, set, t, false);
  inBody(c, r, () => {
    tail(c, t, [-102, -104], [-130, -92], [-124 + r.swish * 4, -56], (x, y) => {
      shape(c, '#2f4ba8', () => circle(c, x, y + 6, 11, 15), LINE * 0.8, t.ink);
    });
    mass(c, t, body, () => {
      shape(c, '#cfe2ff', () => circle(c, -14, -36, 66, 24), 0);
      gloss(c, -56, -118, 30, 9, -0.2, 0.45);
    });
  });
  legs(c, r, set, t, true, body);
  const graze = pose.kind === 'graze';
  const [x, y] = bodyPoint(r, graze ? 104 : 98, graze ? -60 : -94 + r.nod * 2.5);
  cowHead(c, x, y, r.tilt + (graze ? 0.1 : 0.1 + r.nod * 0.02), 54, {
    tone: t,
    skull: { wide: 1.14, tall: 0.9, jaw: 1.06 },
    muzzle: '#d8e6ff',
    snout: [0.92, 0.48],
    nostril: '#3a55b8',
    cheek: 'rgba(255,150,190,0.5)',
    iris: ['#3a3f9c', '#a9b6ff'],
    ear: { skin: '#4a78de', inner: '#ffb3cf', x: 0.98, y: 0.28, long: 0.86, wide: 0.42, angle: 0.72, flop: 0.14 },
    horn: { fill: '#fff4d2', x: 0.74, y: 0.54, out: 0.56, up: 0.5, thick: 0.15 },
    lid: 0.52,
    gaze: [0.1, 0.34],
    mouth: 'hum',
    front: (s) => {
      // Striped nightcap, flopping back over the shoulders.
      const sway = pose.kind === 'run' ? r.flap * s * 0.08 : 0;
      nightcap(c, s, t, sway);
    },
  }, pose, r);
  if (pose.kind !== 'dizzy') snooze(c, x, y, pose);
}

function nightcap(c, s, t, sway) {
  const sock = () => {
    c.moveTo(s * 0.74, -s * 0.66);
    c.bezierCurveTo(s * 0.6, -s * 1.5, s * 0.1, -s * 1.98, -s * 0.5, -s * 1.86);
    c.bezierCurveTo(-s * 1.06, -s * 1.76, -s * 1.56, -s * 1.36 + sway, -s * 1.84, -s * 0.62 + sway);
    c.bezierCurveTo(-s * 1.46, -s * 1.1 + sway, -s * 1.1, -s * 1.2, -s * 0.76, -s * 0.66);
    c.closePath();
  };
  c.save();
  c.beginPath();
  sock();
  c.fillStyle = '#fff4d2';
  c.fill();
  c.clip();
  c.fillStyle = '#ffc62e';
  for (let i = -3; i < 6; i++) {
    c.save();
    c.translate(-s * 0.3 + i * s * 0.4, -s * 1.1);
    c.rotate(0.5);
    c.fillRect(-s * 0.1, -s * 1.4, s * 0.2, s * 2.8);
    c.restore();
  }
  c.restore();
  pen(c, t.ink, LINE * 0.85, sock);
  shape(c, '#fff4d2', () => c.roundRect(-s * 0.84, -s * 0.84, s * 1.72, s * 0.32, s * 0.16), LINE * 0.8, t.ink);
  shape(c, '#fff', () => circle(c, -s * 1.86, -s * 0.5 + sway, s * 0.23), LINE * 0.8, t.ink);
  gloss(c, -s * 0.34, -s * 1.5, s * 0.26, s * 0.08, -0.3, 0.7);
}

function snooze(c, x, y, pose) {
  const drift = pose.kind === 'run' ? (pose.phase * 2) % 1 : pose.phase > 0 ? 0.6 : 0.2;
  const zed = (zx, zy, size, alpha) => {
    c.save();
    c.globalAlpha = alpha;
    c.translate(zx, zy);
    c.rotate(-0.2);
    const path = () => {
      c.moveTo(-size, -size);
      c.lineTo(size, -size);
      c.lineTo(-size, size);
      c.lineTo(size, size);
    };
    pen(c, '#1b2a72', 7, path);
    pen(c, '#fff', 3.5, path);
    c.restore();
  };
  zed(x + 66 + drift * 14, y - 62 - drift * 18, 7 + drift * 2, 1);
  zed(x + 88 + drift * 12, y - 92 - drift * 16, 10 + drift * 2, 1 - drift * 0.5);
}

function captain(c, pose) {
  const r = rig(pose, GAITS.leap);
  const t = { skin: '#fff0d0', shade: '#ffc9b0', ink: '#5a1626', far: '#ecc9a0', hoof: '#d9303f' };
  const set = { hip: -74, width: 23, xs: [-36, -60, 62, 36] };
  const graze = pose.kind === 'graze';
  const body = () => {
    c.moveTo(30, -158);
    c.bezierCurveTo(-14, -152, -54, -138, -78, -120);
    c.bezierCurveTo(-102, -100, -96, -66, -62, -58);
    c.bezierCurveTo(-30, -52, 24, -54, 54, -78);
    c.bezierCurveTo(82, -102, 72, -154, 30, -158);
    c.closePath();
  };
  const flap = pose.kind === 'run' ? Math.sin((pose.phase - 0.15) * TAU) : 0.3;
  const flutter = pose.kind === 'run' ? Math.sin((pose.phase - 0.15) * TAU * 2) : 0;
  inBody(c, r, () => {
    const cape = () => {
      c.moveTo(38, -158);
      c.bezierCurveTo(-30, -180 - flap * 6, -84, -158 + flap * 8, -162, -170 + flap * 22);
      c.lineTo(-136, -130 + flap * 14);
      c.lineTo(-168, -96 + flap * 12 + flutter * 8);
      c.bezierCurveTo(-110, -84 + flap * 8, -50, -96, 26, -110);
      c.closePath();
    };
    mass(c, { skin: '#ee2f3f', shade: '#d8a0d8', ink: t.ink }, cape, () => {
      pen(c, '#ffd23f', 7, () => {
        c.moveTo(-162, -170 + flap * 22);
        c.lineTo(-136, -130 + flap * 14);
        c.lineTo(-168, -96 + flap * 12 + flutter * 8);
      });
      pen(c, 'rgba(120,10,40,0.3)', 7, () => {
        c.moveTo(-20, -160);
        c.quadraticCurveTo(-70, -136, -128, -128 + flap * 14);
      });
      twinkle(c, -96, -128 + flap * 8, 20, '#ffd23f');
    }, [-3, -9]);
  });
  legs(c, r, set, t, false);
  inBody(c, r, () => {
    tail(c, t, [-90, -96], [-112, -88], [-112 + r.swish * 6, -62], (x, y) => {
      shape(c, '#e23a3a', () => circle(c, x, y + 5, 10, 13), LINE * 0.8, t.ink);
    });
    mass(c, t, body, () => {
      shape(c, '#f0463f', () => {
        circle(c, -66, -94, 19, 17);
        circle(c, -32, -128, 14);
        circle(c, 16, -66, 16, 13);
      }, 0);
      gloss(c, -6, -138, 22, 7, -0.3, 0.8);
    });
  });
  legs(c, r, set, t, true, body);
  const [x, y] = bodyPoint(r, graze ? 92 : 76, graze ? -60 : -148 + r.nod * 3);
  cowHead(c, x, y, r.tilt - (graze ? -0.1 : 0.12), 48, {
    tone: t,
    skull: { wide: 1, tall: 1, jaw: 0.96 },
    muzzle: '#ffc7b8',
    nostril: '#b5383f',
    cheek: 'rgba(255,110,100,0.45)',
    iris: ['#1f7fd0', '#7ad6ff'],
    ear: { skin: '#f0463f', inner: '#ffc7b8', x: 0.94, y: 0.5, long: 0.76, wide: 0.42, angle: -0.34, flop: 0.2 },
    horn: { fill: '#ffd23f', x: 0.62, y: 0.7, out: 0.2, up: 0.5, thick: 0.18 },
    mouth: 'grin',
    gaze: [0.22, -0.02],
    brows: (nx, fx, ey, rx, ry) => {
      pen(c, t.ink, 7, () => {
        c.moveTo(nx - rx, ey - ry * 1.16);
        c.quadraticCurveTo(nx, ey - ry * 1.4, nx + rx * 0.9, ey - ry * 1.02);
        c.moveTo(fx - rx * 0.8, ey - ry * 1.02);
        c.quadraticCurveTo(fx, ey - ry * 1.4, fx + rx, ey - ry * 1.16);
      });
    },
    front: (s) => {
      // Flying goggles pushed up, and a heroic quiff.
      shape(c, '#7a3d1e', () => c.roundRect(-s * 0.98, -s * 0.72, s * 2, s * 0.16, 4), FINE, t.ink);
      for (const gx of [-s * 0.24, s * 0.46]) {
        shape(c, '#ffd23f', () => circle(c, gx, -s * 0.72, s * 0.27), FINE + 1, t.ink);
        shape(c, '#8fe0ff', () => circle(c, gx, -s * 0.72, s * 0.16), 0);
        gloss(c, gx - s * 0.05, -s * 0.77, s * 0.06, s * 0.045, 0, 0.95);
      }
      shape(c, '#f0463f', () => {
        c.moveTo(-s * 0.36, -s * 0.94);
        c.bezierCurveTo(-s * 0.5, -s * 1.62, s * 0.6, -s * 1.74, s * 0.92, -s * 1.36);
        c.bezierCurveTo(s * 0.56, -s * 1.38, s * 0.42, -s * 1.14, s * 0.34, -s * 0.94);
        c.closePath();
      }, LINE * 0.8, t.ink);
    },
  }, pose, r);
}

function shag(c, points) {
  c.moveTo(...points[0]);
  for (let i = 1; i <= points.length; i++) {
    const [x, y] = points[i % points.length];
    const [px, py] = points[i - 1];
    const mx = (x + px) / 2;
    const my = (y + py) / 2;
    const cx = mx + (y - py) * 0.42;
    const cy = my - (x - px) * 0.42;
    c.quadraticCurveTo(cx, cy, x, y);
  }
  c.closePath();
}

function rusty(c, pose) {
  const r = rig(pose, GAITS.charge);
  const t = { skin: '#e8582c', shade: '#ffa98c', ink: '#3b120a', far: '#b83a1c', hoof: '#4a2010' };
  const mane = { skin: '#8a3a1c', shade: '#c9a0a8', ink: t.ink };
  const set = { hip: -56, width: 31, xs: [-40, -70, 66, 34] };
  const graze = pose.kind === 'graze';
  const rump = () => {
    c.moveTo(-10, -124);
    c.bezierCurveTo(-54, -128, -100, -116, -102, -84);
    c.bezierCurveTo(-104, -50, -60, -44, -14, -40);
    c.closePath();
  };
  const hump = () => shag(c, [
    [-34, -46], [-58, -92], [-50, -138], [-14, -176], [34, -182], [76, -152], [100, -112], [94, -66], [60, -36], [10, -32],
  ]);
  legs(c, r, set, t, false);
  inBody(c, r, () => {
    tail(c, t, [-96, -100], [-126, -112], [-128 + r.swish * 6, -74], (x, y) => {
      shape(c, '#6a2c14', () => circle(c, x, y + 6, 11, 15), LINE * 0.8, t.ink);
    });
    mass(c, t, rump, null);
  });
  legs(c, r, set, t, true, rump, [1]);
  inBody(c, r, () => mass(c, mane, hump, () => {
    gloss(c, -2, -158, 34, 10, -0.2, 0.28);
  }, [-9, -12]));
  legs(c, r, set, t, true, hump, [3]);
  const [x, y] = bodyPoint(r, 98, graze ? -82 : -84 + r.nod * 3);
  cowHead(c, x, y, r.tilt + (graze ? 0.12 : 0.14), 52, {
    tone: t,
    skull: { wide: 1.08, tall: 0.92, jaw: 1 },
    muzzle: '#ffc9a0',
    snout: [0.86, 0.46],
    nostril: '#8a3a1c',
    iris: ['#a8611c', '#ffc95c'],
    ear: { skin: '#b83a1c', inner: '#7a2a14', x: 1.0, y: 0.34, long: 0.56, wide: 0.34, angle: 0.3, flop: 0.2 },
    horn: { fill: '#fff0d2', x: 0.78, y: 0.56, out: 0.44, up: 0.66, thick: 0.2 },
    lid: 0.24,
    slant: 0.24,
    eyeW: 0.24,
    eyeH: 0.27,
    eyeY: -0.08,
    gaze: [0.1, 0.1],
    mouth: 'pout',
    tongue: '#ff8f8f',
    back: (s) => {
      // Beard under the chin.
      shape(c, mane.skin, () => {
        c.moveTo(-s * 0.46, s * 0.7);
        c.quadraticCurveTo(-s * 0.3, s * 1.5, -s * 0.02, s * 1.76);
        c.quadraticCurveTo(s * 0.16, s * 1.5, s * 0.34, s * 1.5);
        c.quadraticCurveTo(s * 0.56, s * 1.2, s * 0.68, s * 0.7);
        c.closePath();
      }, LINE, t.ink);
    },
    brows: (nx, fx, ey, rx, ry) => {
      pen(c, t.ink, 9, () => {
        c.moveTo(nx - rx * 1.2, ey - ry * 1.3);
        c.lineTo(nx + rx * 0.95, ey - ry * 0.72);
        c.moveTo(fx + rx * 1.1, ey - ry * 1.3);
        c.lineTo(fx - rx * 0.85, ey - ry * 0.72);
      });
    },
    front: (s) => {
      shape(c, mane.skin, () => shag(c, [
        [-s * 0.74, -s * 0.5], [-s * 0.44, -s * 0.66], [-s * 0.08, -s * 0.5], [s * 0.3, -s * 0.66], [s * 0.66, -s * 0.5], [s * 0.96, -s * 0.56],
        [s * 0.78, -s * 1.0], [s * 0.2, -s * 1.2], [-s * 0.44, -s * 1.04],
      ]), LINE * 0.8, t.ink);
      gloss(c, -s * 0.06, -s * 0.94, s * 0.26, s * 0.07, -0.1, 0.3);
    },
  }, pose, r);
  if (pose.kind === 'run') {
    const puff = pose.phase;
    gloss(c, x + 76 + puff * 22, y + 18 - puff * 8, 7 + puff * 7, 6 + puff * 6, 0, 0.9 - puff * 0.5);
    gloss(c, x + 90 + puff * 24, y + 8 - puff * 10, 4 + puff * 5, 4 + puff * 4, 0, 0.8 - puff * 0.5);
  }
}

function golden(c, pose) {
  const r = rig(pose, GAITS.prance);
  const t = { skin: '#ffc824', shade: '#ffb35a', ink: '#7a3f00', far: '#e89c07', hoof: '#fff0ae' };
  const set = { hip: -62, width: 21, xs: [-30, -54, 54, 30] };
  const body = () => {
    c.moveTo(34, -130);
    c.bezierCurveTo(-8, -136, -74, -128, -84, -92);
    c.bezierCurveTo(-90, -62, -50, -50, -10, -50);
    c.bezierCurveTo(26, -50, 60, -62, 62, -92);
    c.bezierCurveTo(64, -112, 54, -126, 34, -130);
    c.closePath();
  };
  legs(c, r, set, t, false);
  inBody(c, r, () => {
    tail(c, t, [-78, -104], [-120, -120], [-118 + r.swish * 4, -158 - r.swish * 4], (x, y) => {
      twinkle(c, x, y, 22, '#fff6c8', t.ink);
    });
    mass(c, t, body, () => {
      const sheen = c.createLinearGradient(-80, -130, 40, -40);
      sheen.addColorStop(0, '#fff3a8');
      sheen.addColorStop(0.5, '#ffcf2e');
      sheen.addColorStop(1, '#f59f0a');
      c.fillStyle = sheen;
      c.fillRect(-200, -200, 400, 200);
      gloss(c, -34, -112, 34, 10, -0.2, 0.85);
      twinkle(c, -46, -82, 13, '#fff');
    });
  });
  legs(c, r, set, t, true, body);
  const graze = pose.kind === 'graze';
  const [x, y] = bodyPoint(r, graze ? 82 : 66, graze ? -58 : -128 + r.nod * 3);
  cowHead(c, x, y, r.tilt + (graze ? 0.1 : -0.04), 52, {
    tone: t,
    skull: { wide: 1.04, tall: 0.98, jaw: 0.84 },
    muzzle: '#fff2b8',
    nostril: '#c9801a',
    cheek: 'rgba(255,120,120,0.55)',
    iris: ['#c2570c', '#ffd25c'],
    star: true,
    lashes: 3,
    ear: { skin: '#ffb512', inner: '#fff0ae', x: 0.92, y: 0.6, long: 0.8, wide: 0.42, angle: -0.5, flop: 0.2 },
    mouth: 'laugh',
    tongue: '#ff8fa6',
    paint: () => {
      const sheen = c.createLinearGradient(0, -52, 0, 52);
      sheen.addColorStop(0, '#fff09a');
      sheen.addColorStop(1, '#ffc21f');
      c.fillStyle = sheen;
      c.fillRect(-90, -90, 180, 180);
    },
    front: (s) => {
      // Crest of sun rays.
      shape(c, '#ffe45c', () => {
        const rays = 7;
        c.moveTo(-s * 0.56, -s * 0.8);
        for (let i = 0; i < rays; i++) {
          const a = -2.5 + (i * 1.86) / (rays - 1);
          const length = i % 2 ? s * 1.3 : s * 1.72;
          c.lineTo(Math.cos(a) * length * 0.8, s * 0.1 + Math.sin(a) * length);
          c.lineTo(Math.cos(a + 0.15) * s * 1.1 * 0.8, s * 0.1 + Math.sin(a + 0.15) * s * 1.1);
        }
        c.lineTo(s * 0.6, -s * 0.76);
        c.closePath();
      }, LINE * 0.8, t.ink);
    },
  }, pose, r);
  const spin = pose.kind === 'run' ? pose.phase : pose.phase > 0 ? 0.5 : 0;
  [[-104, -50, 0], [-36, -166, 0.4], [132, -58, 0.7], [-142, -112, 0.2]].forEach(([sx, sy, shift]) => {
    const pulse = 0.5 + 0.5 * Math.sin((spin + shift) * TAU);
    twinkle(c, sx, sy - r.y, 7 + pulse * 11, '#fff8cc', t.ink);
  });
}

function skunk(c, pose) {
  const r = rig(pose, GAITS.scurry);
  const t = { skin: '#4a4470', shade: '#b4a8e0', ink: '#1a1638', far: '#322d54', hoof: '#221d42' };
  const set = { hip: -32, width: 20, xs: [-16, -38, 44, 22] };
  const wag = r.swish * 8;
  const body = () => {
    c.moveTo(30, -88);
    c.bezierCurveTo(-6, -98, -58, -90, -66, -56);
    c.bezierCurveTo(-70, -30, -36, -20, 0, -20);
    c.bezierCurveTo(34, -20, 56, -34, 54, -58);
    c.bezierCurveTo(52, -76, 44, -84, 30, -88);
    c.closePath();
  };
  const plume = () => {
    c.moveTo(-44, -30);
    c.bezierCurveTo(-118, -30, -128, -112, -96 + wag, -158);
    c.bezierCurveTo(-68, -194, -14 + wag, -176, -24 + wag, -134);
    c.bezierCurveTo(-30, -112, -44, -100, -28, -66);
    c.closePath();
  };
  legs(c, r, set, t, false);
  inBody(c, r, () => {
    mass(c, t, plume, () => {
      shape(c, '#fff', () => {
        c.moveTo(-58, -44);
        c.bezierCurveTo(-98, -74, -96, -128, -74 + wag, -152);
        c.bezierCurveTo(-58, -170, -38 + wag, -160, -46 + wag, -136);
        c.bezierCurveTo(-56, -112, -66, -84, -46, -58);
        c.closePath();
      }, 0);
    }, [-5, -7]);
    mass(c, t, body, () => {
      shape(c, '#fff', () => {
        c.moveTo(-70, -66);
        c.bezierCurveTo(-30, -104, 24, -100, 60, -74);
        c.bezierCurveTo(24, -82, -24, -82, -70, -46);
        c.closePath();
      }, 0);
    }, [-6, -8]);
  });
  legs(c, r, set, t, true, body);
  const graze = pose.kind === 'graze';
  const [x, y] = bodyPoint(r, graze ? 66 : 54, graze ? -40 : -68 + r.nod * 2);
  cowHead(c, x, y, r.tilt + 0.04, 40, {
    tone: t,
    skull: { wide: 1.08, tall: 0.94, jaw: 0.9 },
    muzzle: '#8d86c2',
    nostril: '#ff8fb0',
    cheek: 'rgba(255,130,170,0.5)',
    iris: ['#2f8f3f', '#b8f06a'],
    ear: { skin: t.skin, inner: '#ff9fbf', x: 0.82, y: 0.72, long: 0.56, wide: 0.56, angle: -0.5, flop: 0.2 },
    lid: 0.2,
    slant: -0.16,
    mouth: 'smile',
    paint: (s) => shape(c, '#fff', () => c.roundRect(s * 0.02, -s * 1.1, s * 0.26, s * 1, s * 0.13), 0),
  }, pose, r);
}

function porcupine(c, pose) {
  const r = rig(pose, GAITS.scurry);
  const t = { skin: '#a8743f', shade: '#e8c0a0', ink: '#3f2210', far: '#7f5429', hoof: '#4a2a14' };
  const set = { hip: -28, width: 19, xs: [-12, -32, 34, 14] };
  const body = () => circle(c, -8, -54, 62, 46);
  const quills = (reach, base, fill, tip) => {
    for (let angle = -3.4; angle < 0.34; angle += 0.26) {
      const nudge = pose.kind === 'run' ? Math.sin((pose.phase + angle * 0.5) * TAU) * 3 : 0;
      const far = reach + nudge;
      const px = -8 + Math.cos(angle) * far;
      const py = -54 + Math.sin(angle) * far * 0.9;
      const sideX = Math.cos(angle + Math.PI / 2) * base;
      const sideY = Math.sin(angle + Math.PI / 2) * base;
      const baseX = -8 + Math.cos(angle) * 50;
      const baseY = -54 + Math.sin(angle) * 38;
      shape(c, fill, () => {
        c.moveTo(baseX - sideX, baseY - sideY);
        c.lineTo(px, py);
        c.lineTo(baseX + sideX, baseY + sideY);
        c.closePath();
      }, FINE + 0.5, t.ink);
      shape(c, tip, () => {
        c.moveTo(lerp(px, baseX, 0.3) - sideX * 0.3, lerp(py, baseY, 0.3) - sideY * 0.3);
        c.lineTo(px, py);
        c.lineTo(lerp(px, baseX, 0.3) + sideX * 0.3, lerp(py, baseY, 0.3) + sideY * 0.3);
        c.closePath();
      }, 0);
    }
  };
  legs(c, r, set, t, false);
  inBody(c, r, () => {
    quills(96, 12, '#fff3d6', '#e23a3a');
    mass(c, t, body, () => gloss(c, -30, -84, 22, 7, -0.3, 0.4));
  });
  legs(c, r, set, t, true, body);
  const graze = pose.kind === 'graze';
  const [x, y] = bodyPoint(r, graze ? 58 : 50, graze ? -36 : -50 + r.nod * 2);
  cowHead(c, x, y, r.tilt + 0.04, 35, {
    tone: t,
    skull: { wide: 1.06, tall: 0.96, jaw: 0.94 },
    muzzle: '#f6dfb8',
    nostril: t.ink,
    cheek: 'rgba(255,130,110,0.5)',
    iris: ['#6a3a1a', '#d89a4a'],
    ear: { skin: '#8f5f30', inner: '#ffb3a0', x: 0.86, y: 0.5, long: 0.46, wide: 0.5, angle: -0.2, flop: 0.14 },
    mouth: 'smile',
  }, pose, r);
}

// Overall size of each character, so hitboxes in data.js stay fair.
const SIZE = { A1: 0.8, A2: 0.8, A3: 0.8, A4: 0.8, A5: 0.82, S1: 0.8, H1: 1, H2: 1 };

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
  c.scale(SIZE[type], SIZE[type]);
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

function spriteBounds(sprite) {
  const { width, height } = sprite;
  const pixels = sprite.getContext('2d').getImageData(0, 0, width, height).data;
  let left = width;
  let right = 0;
  let top = height;
  let bottom = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 8) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

// Paints one animal into a small canvas for menus, intro cards and stickers, cropped to fill it.
// With sticker on, it gets the white die-cut edge of a real sticker.
export function portrait(type, size, kind = 'run', sticker = false) {
  const canvas = makeCanvas(size * 2, size * 2);
  const c = canvas.getContext('2d');
  const sprite = animalSprite(type, kind, kind === 'run' ? 1 : 0, 0);
  const box = spriteBounds(sprite);
  const edge = sticker ? size * 0.05 : 0;
  const room = size * 2 - edge * 2 - size * 0.04;
  const fit = room / Math.max(box.w, box.h);
  const w = box.w * fit;
  const h = box.h * fit;
  const x = size - w / 2;
  const y = size - h / 2;
  if (sticker) {
    const cut = makeCanvas(size * 2, size * 2);
    const ctx = cut.getContext('2d');
    ctx.drawImage(sprite, box.x, box.y, box.w, box.h, x, y, w, h);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cut.width, cut.height);
    c.shadowColor = 'rgba(58,36,20,0.35)';
    c.shadowBlur = size * 0.03;
    c.shadowOffsetY = size * 0.015;
    for (let i = 0; i < 20; i++) {
      const angle = (i * TAU) / 20;
      c.drawImage(cut, Math.cos(angle) * edge, Math.sin(angle) * edge);
      if (i === 0) c.shadowColor = 'transparent';
    }
  }
  c.drawImage(sprite, box.x, box.y, box.w, box.h, x, y, w, h);
  return canvas;
}

function hatShape(c, hat) {
  const felt = (skin) => ({ skin, shade: '#e0b8a8', ink: INK });
  if (hat === 'hat_cowboy' || hat === 'hat_sheriff') {
    const tone = felt(hat === 'hat_cowboy' ? '#c07a38' : '#4e4860');
    mass(c, tone, () => {
      c.moveTo(-80, 2);
      c.bezierCurveTo(-58, -2, -40, -8, -36, -14);
      c.bezierCurveTo(-14, -8, 14, -8, 36, -14);
      c.bezierCurveTo(40, -8, 58, -2, 80, 2);
      c.bezierCurveTo(62, 28, -62, 28, -80, 2);
      c.closePath();
    }, () => gloss(c, -26, 8, 26, 4, 0.06, 0.3), [-3, -6], 5.5);
    mass(c, tone, () => {
      c.moveTo(-40, 4);
      c.bezierCurveTo(-46, -66, -16, -72, 0, -56);
      c.bezierCurveTo(16, -72, 46, -66, 40, 4);
      c.bezierCurveTo(14, 12, -14, 12, -40, 4);
      c.closePath();
    }, () => gloss(c, -18, -44, 11, 6, -0.5, 0.35), [-4, -4], 5.5);
    shape(c, '#e5412f', () => {
      c.moveTo(-40, -14);
      c.quadraticCurveTo(0, -4, 40, -14);
      c.lineTo(40, 2);
      c.quadraticCurveTo(0, 12, -40, 2);
      c.closePath();
    }, 4.5);
    if (hat === 'hat_sheriff') {
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 ? 8 : 18;
        const angle = -Math.PI / 2 + (i * TAU) / 10;
        c.lineTo(Math.cos(angle) * radius, -34 + Math.sin(angle) * radius);
      }
      c.closePath();
      c.fillStyle = '#ffd23f';
      c.fill();
      c.lineWidth = 3.5;
      c.strokeStyle = INK;
      c.stroke();
    }
  } else if (hat === 'hat_straw') {
    const tone = felt('#f6d683');
    mass(c, tone, () => circle(c, 0, 4, 82, 17), () => {
      for (let ring = 30; ring < 82; ring += 13) pen(c, 'rgba(160,110,40,0.3)', 2, () => circle(c, 0, 4, ring, ring * 0.2));
    }, [-3, -5], 5.5);
    mass(c, tone, () => {
      c.moveTo(-38, 6);
      c.bezierCurveTo(-36, -50, 36, -50, 38, 6);
      c.bezierCurveTo(14, 14, -14, 14, -38, 6);
      c.closePath();
    }, null, [-4, -4], 5.5);
    shape(c, '#22c1b6', () => {
      c.moveTo(-38, -10);
      c.quadraticCurveTo(0, -1, 38, -10);
      c.lineTo(38, 5);
      c.quadraticCurveTo(0, 14, -38, 5);
      c.closePath();
    }, 4.5);
  } else if (hat === 'hat_party') {
    mass(c, felt('#ee5da8'), () => {
      c.moveTo(-38, 6);
      c.lineTo(0, -74);
      c.lineTo(38, 6);
      c.quadraticCurveTo(0, 18, -38, 6);
      c.closePath();
    }, () => {
      shape(c, '#fff', () => {
        circle(c, -11, -8, 7);
        circle(c, 14, -24, 6);
        circle(c, -3, -42, 5);
        circle(c, 16, 2, 5);
      }, 0);
    }, [-5, -3], 5.5);
    shape(c, '#ffe066', () => circle(c, 0, -78, 13), 4.5);
  } else if (hat === 'hat_crown') {
    mass(c, felt('#ffd23f'), () => {
      c.moveTo(-46, 8);
      c.lineTo(-56, -46);
      c.lineTo(-23, -20);
      c.lineTo(0, -62);
      c.lineTo(23, -20);
      c.lineTo(56, -46);
      c.lineTo(46, 8);
      c.quadraticCurveTo(0, 18, -46, 8);
      c.closePath();
    }, () => gloss(c, -22, -6, 16, 5, -0.1, 0.6), [-4, -5], 5.5);
    shape(c, '#e23a3a', () => circle(c, 0, -12, 10), 4);
    shape(c, '#22c1b6', () => {
      circle(c, -31, -12, 6);
      circle(c, 31, -12, 6);
    }, 3.5);
    gloss(c, -3, -15, 3, 2.5, 0, 0.95);
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
  const t = { skin: '#e39a55', shade: '#ffb98c', ink: '#45210f' };
  const mane = { skin: '#7e3c1c', shade: '#d0a8b0', ink: t.ink };
  const cream = { skin: '#fff1d6', shade: '#ffd0b0', ink: t.ink };

  c.save();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.translate(0, -lift);

  mass(c, mane, () => {
    c.moveTo(-74, 44);
    c.bezierCurveTo(-108, -30, -100, -122, -30, -178);
    c.bezierCurveTo(-8, -150, -14, -40, -20, 44);
    c.closePath();
  }, null, [-6, -8]);
  mass(c, t, () => {
    c.moveTo(-52, 44);
    c.bezierCurveTo(-60, -40, -42, -112, 10, -150);
    c.lineTo(72, -110);
    c.bezierCurveTo(58, -60, 60, -10, 68, 44);
    c.closePath();
  }, null, [-9, -5]);
  // Neckerchief, for a proper ranch hand.
  shape(c, '#e5412f', () => {
    c.moveTo(-54, -34);
    c.quadraticCurveTo(6, -6, 66, -44);
    c.lineTo(62, -22);
    c.lineTo(12, 30);
    c.lineTo(-48, -10);
    c.closePath();
  }, 5.5, t.ink);
  shape(c, '#fff', () => {
    circle(c, 12, 0, 5.5);
    circle(c, -18, -12, 4.5);
    circle(c, 38, -16, 4.5);
    circle(c, 12, -22, 4);
  }, 0);

  c.translate(18, -150);
  c.rotate(0.1 + nod);

  const earLeaf = (x, y, tilt, size) => {
    c.save();
    c.translate(x, y);
    c.rotate(tilt);
    shape(c, t.skin, () => {
      c.moveTo(-16 * size, 8);
      c.bezierCurveTo(-24 * size, -30 * size, -6, -52 * size, 4, -60 * size);
      c.bezierCurveTo(16 * size, -46 * size, 24 * size, -24 * size, 16 * size, 8);
      c.closePath();
    }, 5.5, t.ink);
    shape(c, '#ffb3a0', () => {
      c.moveTo(-7 * size, 4);
      c.bezierCurveTo(-11 * size, -22 * size, -3, -36 * size, 3, -42 * size);
      c.bezierCurveTo(9 * size, -32 * size, 12 * size, -16 * size, 8 * size, 4);
      c.closePath();
    }, 0);
    c.restore();
  };
  earLeaf(34, -58, 0.32, 0.95);

  const skull = () => {
    c.moveTo(-72, -6);
    c.bezierCurveTo(-74, -62, -24, -74, 10, -72);
    c.bezierCurveTo(54, -72, 80, -38, 80, 0);
    c.bezierCurveTo(82, 40, 30, 72, -8, 64);
    c.bezierCurveTo(-46, 58, -70, 34, -72, -6);
    c.closePath();
  };
  mass(c, t, skull, () => {
    shape(c, cream.skin, () => {
      c.moveTo(10, -76);
      c.bezierCurveTo(34, -44, 40, -14, 44, 12);
      c.lineTo(8, 12);
      c.bezierCurveTo(10, -14, 4, -44, 10, -76);
      c.closePath();
    }, 0);
    gloss(c, -38, -44, 20, 9, -0.6, 0.45);
  }, [-7, -8]);
  earLeaf(-34, -56, -0.26, 1);

  const muzzle = () => circle(c, 46, 36, 70, 46, -0.05);
  mass(c, cream, muzzle, () => gloss(c, 14, 14, 24, 8, -0.2, 0.7), [-4, -6], 5);
  c.fillStyle = t.ink;
  c.beginPath();
  circle(c, 24, 20, 6, 8, 0.4);
  circle(c, 80, 16, 6, 8, -0.3);
  c.fill();

  c.fillStyle = 'rgba(255,120,110,0.45)';
  c.beginPath();
  circle(c, -44, 22, 15, 10);
  c.fill();

  const look = { ink: t.ink, iris: '#7a3f12', glow: '#f0ad45', skin: t.skin, gaze: [0.18, 0.06] };
  const grow = state === 'excited' ? 1.14 : 1;
  const nearEye = [-16, -14];
  const farEye = [46, -20];
  if (state === 'laugh') {
    closedEye(c, nearEye[0], nearEye[1], 21, t.ink);
    closedEye(c, farEye[0], farEye[1], 19, t.ink);
  } else if (state === 'wince' || state === 'nose') {
    const squint = (x, y, side) => pen(c, t.ink, 6, () => {
      c.moveTo(x - side * 15, y - 12);
      c.lineTo(x + side * 13, y);
      c.lineTo(x - side * 15, y + 12);
    });
    squint(nearEye[0], nearEye[1], 1);
    squint(farEye[0], farEye[1], -1);
  } else {
    eye(c, nearEye[0], nearEye[1], 23 * grow, 28 * grow, look);
    eye(c, farEye[0], farEye[1], 20 * grow, 26 * grow, look);
  }
  pen(c, t.ink, 6, () => {
    c.moveTo(nearEye[0] - 16, nearEye[1] - 38);
    c.quadraticCurveTo(nearEye[0], nearEye[1] - 46 - (state === 'excited' ? 8 : 0), nearEye[0] + 16, nearEye[1] - 38);
    c.moveTo(farEye[0] - 13, farEye[1] - 36);
    c.quadraticCurveTo(farEye[0], farEye[1] - 44 - (state === 'excited' ? 8 : 0), farEye[0] + 15, farEye[1] - 36);
  });

  const face = { tone: t };
  if (state === 'cheer') mouth(c, 66, face, 52, 54, 'laugh');
  else if (state === 'laugh') mouth(c, 84, face, 52, 50, 'laugh');
  else if (state === 'excited') mouth(c, 54, face, 52, 54, 'laugh');
  else if (state === 'wince' || state === 'nose') {
    pen(c, t.ink, 5, () => {
      c.moveTo(24, 60);
      c.quadraticCurveTo(36, 48, 48, 60);
      c.quadraticCurveTo(60, 72, 78, 56);
    });
  } else mouth(c, 62, face, 52, 54, 'smile');

  if (state === 'nose') {
    mass(c, t, () => {
      c.moveTo(62, 170);
      c.bezierCurveTo(60, 120, 62, 80, 66, 46);
      c.lineTo(98, 28);
      c.bezierCurveTo(112, 70, 116, 120, 112, 170);
      c.closePath();
    }, null, [-4, -5], 5.5);
    c.save();
    c.translate(80, 34);
    c.rotate(-0.72);
    shape(c, '#6f3418', () => c.roundRect(-30, -13, 60, 26, 11), 5.5, t.ink);
    gloss(c, -8, -6, 12, 3, 0, 0.4);
    c.restore();
  }

  // Forelock
  mass(c, mane, () => {
    c.moveTo(-32, -66);
    c.bezierCurveTo(-24, -104, 36, -104, 42, -64);
    c.bezierCurveTo(30, -74, 24, -60, 20, -42);
    c.bezierCurveTo(10, -60, -2, -62, -8, -46);
    c.bezierCurveTo(-14, -60, -24, -62, -32, -66);
    c.closePath();
  }, () => gloss(c, 0, -84, 15, 4, -0.2, 0.3), [-3, -5], 5.5);

  if (hat) {
    c.save();
    c.translate(-2, -74);
    c.rotate(-0.1);
    hatShape(c, hat);
    c.restore();
  }
  c.restore();
}

// The gloved hand that holds the rope at the bottom of each lane.
export function drawHand(c, x, y, colors, action) {
  const glove = { skin: '#d99a54', shade: '#ffc49c', ink: INK };
  const sleeve = { skin: '#3f86dc', shade: '#b8b4ec', ink: INK };
  const coil = (dy, rx, ry, front) => {
    const ring = () => {
      if (front) c.ellipse(0, dy, rx, ry, 0, 0.1, Math.PI - 0.1);
      else circle(c, 0, dy, rx, ry);
    };
    pen(c, INK, 14, ring);
    pen(c, colors[0], 8.5, ring);
    c.setLineDash([3, 11]);
    pen(c, 'rgba(255,255,255,0.7)', 3.5, ring);
    c.setLineDash([]);
  };
  c.save();
  c.translate(x, y + (action === 'throw' ? -16 : 0));
  c.rotate(action === 'throw' ? -0.08 : 0.06);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  mass(c, sleeve, () => {
    c.moveTo(-27, 56);
    c.lineTo(-31, 150);
    c.lineTo(31, 150);
    c.lineTo(27, 56);
    c.closePath();
  }, () => {
    c.setLineDash([7, 7]);
    pen(c, '#ffe6a8', 2.5, () => {
      c.moveTo(-14, 62);
      c.lineTo(-16, 150);
    });
    c.setLineDash([]);
  }, [-7, 0]);
  for (const [dy, rx, ry] of [[-19, 45, 14], [-10, 51, 16]]) coil(dy, rx, ry, false);
  // Fringed gauntlet cuff with a star.
  for (let i = 0; i < 6; i++) {
    const fx = -30 + i * 12;
    shape(c, '#b56f33', () => c.roundRect(fx - 4, 54, 9, 20, 4), 3);
  }
  mass(c, glove, () => {
    c.moveTo(-34, 32);
    c.lineTo(34, 32);
    c.quadraticCurveTo(42, 46, 37, 62);
    c.quadraticCurveTo(0, 70, -37, 62);
    c.quadraticCurveTo(-42, 46, -34, 32);
    c.closePath();
  }, null, [-4, -5], 5.5);
  twinkle(c, 0, 49, 11, '#ffd23f', INK);
  mass(c, glove, () => c.roundRect(-36, -14, 72, 54, 24), () => gloss(c, -14, 2, 15, 5, -0.2, 0.4), [-6, -6], 5.5);
  coil(0, 58, 19, true);
  shape(c, glove.skin, () => {
    c.roundRect(-33, -24, 17, 34, 8.5);
    c.roundRect(-15, -29, 17, 38, 8.5);
    c.roundRect(3, -27, 17, 36, 8.5);
    c.roundRect(21, -20, 15, 30, 7.5);
  }, 4.5);
  gloss(c, -7, -21, 4, 2.5, 0, 0.5);
  gloss(c, 11, -19, 4, 2.5, 0, 0.5);
  c.restore();
}
