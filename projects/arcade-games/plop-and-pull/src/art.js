// Every character is drawn with canvas paths, then cached as sprites at two pixels per world unit.
// Local coordinates: the creature's centre at 0,0, facing right. Eyes stay live vectors so they can follow the ring.
const TAU = Math.PI * 2;
export const INK = '#12375a';
const LINE = 5;
const FINE = 3;
const RES = 2;

function shape(c, fill, build, width = LINE, stroke = INK) {
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

// Outline first, then fill: overlapping parts melt into one silhouette with one contour.
function blob(c, fill, build, width = LINE, stroke = INK) {
  c.beginPath();
  build();
  c.lineWidth = width * 2;
  c.strokeStyle = stroke;
  c.stroke();
  c.fillStyle = fill;
  c.fill();
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

function gloss(c, x, y, rx, ry, rotation = 0, alpha = 0.55) {
  c.fillStyle = `rgba(255,255,255,${alpha})`;
  c.beginPath();
  circle(c, x, y, rx, ry, rotation);
  c.fill();
}

function dots(c, color, list) {
  c.fillStyle = color;
  c.beginPath();
  for (const [x, y, r] of list) circle(c, x, y, r);
  c.fill();
}

// A solid form: base colour, whatever paint() adds, then one cel shadow that follows the form's own edge.
function mass(c, tone, build, paint, slide = [-6, -9], width = LINE) {
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
  c.rect(-2000, -2000, 4000, 4000);
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = tone.shade;
  c.fill('evenodd');
  c.restore();
  pen(c, INK, width, build);
}

function roundBox(c, x, y, w, h, r) {
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function cheek(c, x, y, rx = 9, ry = 6) {
  c.fillStyle = 'rgba(255,110,120,0.5)';
  c.beginPath();
  circle(c, x, y, rx, ry);
  c.fill();
}

function smile(c, x, y, r, from = 0.15, to = 1.25) {
  pen(c, INK, FINE + 0.5, () => c.arc(x, y, r, Math.PI * from, Math.PI * to * 0.8));
}

// Fan tail shared by the round fish. The pivot sits at the origin so the tail can wag.
function fanTail(c, fill, rays, size = 1) {
  c.save();
  c.scale(size, size);
  const build = () => {
    c.moveTo(6, 0);
    c.bezierCurveTo(-14, -8, -30, -32, -46, -32);
    c.quadraticCurveTo(-36, 0, -46, 32);
    c.bezierCurveTo(-30, 32, -14, 8, 6, 0);
    c.closePath();
  };
  shape(c, fill, build);
  pen(c, rays, FINE, () => {
    c.moveTo(-8, -3);
    c.lineTo(-30, -18);
    c.moveTo(-10, 0);
    c.lineTo(-33, 0);
    c.moveTo(-8, 3);
    c.lineTo(-30, 18);
  });
  c.restore();
}

const CREATURE_ART = {
  bobble: {
    box: [160, 136, 78, 70],
    wag: 0.38,
    eyes: [{ x: 26, y: -14, r: 14 }],
    tail: { box: [70, 84, 64, 42], at: [-46, 2], paint: (c) => fanTail(c, '#ffa62e', '#d9791b', 0.92) },
    paint(c) {
      blob(c, '#ffa62e', () => {
        c.moveTo(-20, -40);
        c.quadraticCurveTo(-6, -66, 22, -44);
        c.closePath();
        c.moveTo(-14, 42);
        c.quadraticCurveTo(0, 62, 20, 42);
        c.closePath();
      }, FINE);
      mass(c, { skin: '#ffd84d', shade: '#ffc86e' }, () => circle(c, 0, 0, 55, 48), () => {
        c.fillStyle = '#fff5c4';
        c.beginPath();
        circle(c, 12, 28, 42, 26);
        c.fill();
        dots(c, '#f4b23a', [[-24, -20, 6], [-6, -32, 5], [-34, 4, 5], [-20, 14, 4]]);
      });
      gloss(c, -14, -30, 15, 7, -0.45);
      cheek(c, 32, 12);
      smile(c, 37, 2, 12, 0.1, 1.2);
      shape(c, '#ffa62e', () => {
        c.moveTo(-6, 6);
        c.quadraticCurveTo(-26, 12, -28, 28);
        c.quadraticCurveTo(-8, 28, 4, 14);
        c.closePath();
      }, FINE);
    },
  },
  stripes: {
    box: [168, 136, 80, 70],
    wag: 0.42,
    eyes: [{ x: 34, y: -12, r: 13 }],
    tail: { box: [70, 84, 64, 42], at: [-52, 0], paint: (c) => fanTail(c, '#ff8a2a', '#c95c10', 0.86) },
    paint(c) {
      blob(c, '#ff8a2a', () => {
        c.moveTo(-34, -30);
        c.bezierCurveTo(-24, -62, 14, -60, 30, -34);
        c.closePath();
        c.moveTo(-18, 34);
        c.quadraticCurveTo(-4, 58, 16, 36);
        c.closePath();
      }, FINE);
      const body = () => {
        c.moveTo(62, 2);
        c.bezierCurveTo(52, -50, -30, -54, -60, -2);
        c.bezierCurveTo(-30, 50, 52, 52, 62, 2);
        c.closePath();
      };
      mass(c, { skin: '#ff8f33', shade: '#ffb26b' }, body, () => {
        for (const [x, w] of [[-34, 15], [8, 18]]) {
          c.fillStyle = '#fff9ef';
          c.beginPath();
          c.moveTo(x - w, -60);
          c.quadraticCurveTo(x + w * 1.1, 0, x - w, 60);
          c.lineTo(x + w, 60);
          c.quadraticCurveTo(x + w * 2.1, 0, x + w, -60);
          c.closePath();
          c.fill();
          c.strokeStyle = INK;
          c.lineWidth = FINE;
          c.stroke();
        }
      });
      gloss(c, 30, -30, 11, 5, -0.2);
      cheek(c, 41, 12, 8, 5);
      smile(c, 45, 2, 11, 0.15, 1.2);
      shape(c, '#ff8a2a', () => {
        c.moveTo(-8, 8);
        c.quadraticCurveTo(-26, 16, -24, 30);
        c.quadraticCurveTo(-6, 28, 6, 16);
        c.closePath();
      }, FINE);
    },
  },
  hoppa: {
    box: [150, 190, 72, 92],
    wag: 0.3,
    eyes: [{ x: 12, y: -46, r: 12 }],
    tail: {
      box: [64, 64, 44, 32],
      at: [-16, 10],
      paint(c) {
        shape(c, '#ffd0ec', () => {
          c.moveTo(4, -18);
          c.quadraticCurveTo(-32, -24, -32, 6);
          c.quadraticCurveTo(-10, 12, 6, 14);
          c.closePath();
        }, FINE);
        pen(c, '#ee8ac4', FINE, () => {
          c.moveTo(-2, -10);
          c.lineTo(-22, -8);
          c.moveTo(0, 0);
          c.lineTo(-22, 2);
        });
      },
    },
    paint(c) {
      const tailCurl = () => {
        c.moveTo(6, 26);
        c.bezierCurveTo(14, 54, 2, 78, -18, 74);
        c.bezierCurveTo(-34, 70, -30, 46, -14, 50);
        c.bezierCurveTo(-6, 52, -6, 62, -13, 62);
      };
      c.lineCap = 'round';
      pen(c, INK, 28, tailCurl);
      pen(c, '#ff7fbe', 18, tailCurl);
      const body = () => {
        circle(c, 2, -44, 34, 30);
        circle(c, 2, 2, 28, 42, 0.05);
        c.moveTo(24, -52);
        c.lineTo(62, -44);
        c.quadraticCurveTo(66, -36, 60, -30);
        c.lineTo(22, -30);
        c.closePath();
      };
      blob(c, '#ff7fbe', () => {
        for (let i = 0; i < 3; i++) {
          const a = -2.4 + i * 0.5;
          const x = -2 + Math.cos(a) * 30;
          const y = -46 + Math.sin(a) * 30;
          circle(c, x + Math.cos(a) * 13, y + Math.sin(a) * 13, 10);
        }
      }, FINE);
      blob(c, '#ff7fbe', body);
      c.save();
      c.beginPath();
      body();
      c.clip();
      c.fillStyle = '#ffd3ea';
      c.beginPath();
      circle(c, 22, 4, 16, 38);
      c.fill();
      pen(c, '#f062ad', FINE, () => {
        for (const y of [-22, -6, 10, 26]) {
          c.moveTo(4, y);
          c.quadraticCurveTo(22, y + 7, 40, y);
        }
      });
      c.restore();
      gloss(c, -8, -62, 12, 6, -0.5);
      cheek(c, 28, -30, 8, 5);
      pen(c, INK, FINE, () => {
        c.moveTo(62, -36);
        c.quadraticCurveTo(50, -30, 42, -33);
      });
    },
  },
  boxy: {
    box: [196, 136, 92, 70],
    wag: 0.34,
    eyes: [{ x: 36, y: -14, r: 14 }],
    tail: { box: [64, 76, 58, 38], at: [-68, 0], paint: (c) => fanTail(c, '#5ad0b0', '#2c9c82', 0.78) },
    paint(c) {
      blob(c, '#5ad0b0', () => {
        c.moveTo(-34, -38);
        c.quadraticCurveTo(-18, -62, 8, -38);
        c.closePath();
      }, FINE);
      const body = () => roundBox(c, -72, -48, 148, 96, 30);
      mass(c, { skin: '#c9ee6b', shade: '#d9e58f' }, body, () => {
        c.fillStyle = '#f2fbc0';
        c.fillRect(-80, 16, 170, 40);
        dots(c, '#3fae93', [[-48, -24, 8], [-20, -30, 7], [-34, -2, 7], [-6, -8, 6], [-52, 22, 6], [-16, 24, 7], [14, 30, 5]]);
      });
      gloss(c, -2, -36, 20, 5, -0.04);
      cheek(c, 50, 14, 9, 6);
      shape(c, '#ff9d8a', () => {
        circle(c, 76, 6, 8, 11);
      }, FINE);
      shape(c, '#5ad0b0', () => {
        c.moveTo(2, 4);
        c.quadraticCurveTo(-22, 12, -20, 30);
        c.quadraticCurveTo(0, 26, 14, 14);
        c.closePath();
      }, FINE);
    },
  },
  shelby: {
    box: [230, 170, 110, 80],
    wag: 0.32,
    eyes: [{ x: 84, y: -14, r: 12 }],
    tail: {
      box: [80, 80, 12, 16],
      at: [36, 30],
      paint(c) {
        shape(c, '#7fd27a', () => {
          c.moveTo(-6, -8);
          c.bezierCurveTo(16, -6, 52, 28, 58, 56);
          c.bezierCurveTo(36, 56, 4, 34, -8, 10);
          c.closePath();
        });
      },
    },
    paint(c) {
      shape(c, '#7fd27a', () => {
        c.moveTo(-54, 30);
        c.quadraticCurveTo(-96, 36, -104, 62);
        c.quadraticCurveTo(-66, 62, -38, 42);
        c.closePath();
      });
      blob(c, '#8bdc84', () => {
        circle(c, 80, -8, 30, 26);
        c.moveTo(44, 8);
        c.lineTo(66, -26);
        c.lineTo(70, 20);
        c.closePath();
      });
      gloss(c, 74, -24, 10, 5, -0.3, 0.5);
      cheek(c, 92, 6, 7, 5);
      smile(c, 92, -6, 11, 0.14, 1.2);
      shape(c, '#ffeeb0', () => {
        c.moveTo(-82, 26);
        c.quadraticCurveTo(0, 62, 72, 22);
        c.quadraticCurveTo(0, 30, -82, 26);
        c.closePath();
      });
      const shell = () => {
        c.moveTo(-88, 28);
        c.bezierCurveTo(-82, -74, 66, -74, 74, 26);
        c.quadraticCurveTo(-8, 44, -88, 28);
        c.closePath();
      };
      mass(c, { skin: '#34a77c', shade: '#6fc79d' }, shell, () => {
        c.fillStyle = '#59c592';
        c.strokeStyle = '#1d7a5a';
        c.lineWidth = FINE;
        for (const [x, y, r] of [[-6, -14, 25], [-52, 2, 19], [42, 0, 19], [-30, -40, 15], [20, -42, 15]]) {
          c.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (i * TAU) / 6 + Math.PI / 6;
            c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r * 0.86);
          }
          c.closePath();
          c.fill();
          c.stroke();
        }
      });
      gloss(c, -22, -44, 24, 6, -0.25, 0.4);
    },
  },
  glim: {
    box: [216, 172, 100, 96],
    wag: 0.36,
    eyes: [{ x: 26, y: -22, r: 16 }],
    lure: { from: [20, -46], tip: [66, -74] },
    tail: { box: [70, 84, 64, 42], at: [-62, 2], paint: (c) => fanTail(c, '#6d7cf0', '#3a47bb', 0.88) },
    paint(c) {
      blob(c, '#6d7cf0', () => {
        c.moveTo(-44, -30);
        c.quadraticCurveTo(-28, -64, -6, -42);
        c.closePath();
        c.moveTo(-24, 34);
        c.quadraticCurveTo(-8, 62, 12, 40);
        c.closePath();
      }, FINE);
      const body = () => {
        c.moveTo(82, 0);
        c.bezierCurveTo(78, -66, -32, -66, -68, 0);
        c.bezierCurveTo(-32, 62, 78, 62, 82, 0);
        c.closePath();
      };
      mass(c, { skin: '#5a8bf0', shade: '#7f9fe8' }, body, () => {
        c.fillStyle = '#bcd6ff';
        c.beginPath();
        circle(c, 20, 40, 62, 24);
        c.fill();
        dots(c, '#bff4ff', [[-36, -6, 4], [-18, -18, 3], [-44, 10, 3], [-22, 8, 4], [-6, -4, 3]]);
      });
      gloss(c, -8, -40, 18, 6, -0.25);
      // A wide gummy smile, no teeth anywhere.
      shape(c, '#ff8fa8', () => {
        c.moveTo(24, 6);
        c.quadraticCurveTo(54, 4, 78, 4);
        c.quadraticCurveTo(72, 40, 40, 34);
        c.quadraticCurveTo(26, 28, 24, 6);
        c.closePath();
      }, FINE + 1);
      shape(c, '#ffc2cc', () => circle(c, 52, 27, 14, 7), 0);
      cheek(c, 12, 10, 9, 6);
      shape(c, '#6d7cf0', () => {
        c.moveTo(-12, 2);
        c.quadraticCurveTo(-30, 14, -26, 30);
        c.quadraticCurveTo(-8, 24, 2, 12);
        c.closePath();
      }, FINE);
    },
  },
  swoop: {
    box: [320, 170, 170, 84],
    wag: 0.2,
    flap: 0.12,
    eyes: [{ x: 66, y: -6, r: 11 }],
    tail: {
      box: [130, 40, 122, 20],
      at: [-92, 6],
      paint(c) {
        c.lineCap = 'round';
        const whip = () => {
          c.moveTo(4, 0);
          c.quadraticCurveTo(-50, 8, -112, -6);
        };
        pen(c, INK, 13, whip);
        pen(c, '#6253c7', 5, whip);
      },
    },
    paint(c) {
      const wing = () => {
        c.moveTo(96, -12);
        c.bezierCurveTo(46, -34, 26, -48, -6, -72);
        c.bezierCurveTo(-24, -44, -54, -22, -112, 6);
        c.bezierCurveTo(-60, 30, -22, 50, -2, 72);
        c.bezierCurveTo(30, 50, 56, 34, 96, 12);
        c.closePath();
      };
      blob(c, '#6253c7', () => {
        circle(c, 104, -22, 20, 8, 0.6);
        circle(c, 104, 22, 20, 8, -0.6);
      }, FINE);
      mass(c, { skin: '#6a5ad8', shade: '#8c80dd' }, wing, () => {
        c.fillStyle = '#efe9ff';
        c.beginPath();
        circle(c, 34, 10, 58, 22);
        c.fill();
        dots(c, '#8e80ee', [[-34, -14, 9], [-16, -32, 7], [-50, 4, 7], [-22, 18, 6]]);
      });
      gloss(c, 8, -44, 24, 6, 0.55);
      cheek(c, 78, 10, 7, 5);
      smile(c, 84, 2, 10, 0.1, 1.15);
    },
  },
  hum: {
    box: [620, 280, 300, 150],
    wag: 0.22,
    eyes: [{ x: 170, y: -6, r: 13 }],
    tail: {
      box: [170, 200, 150, 100],
      at: [-212, -22],
      paint(c) {
        mass(c, { skin: '#4e8fd0', shade: '#7fa8d6' }, () => {
          c.moveTo(16, 12);
          c.quadraticCurveTo(-46, 6, -82, -30);
          c.bezierCurveTo(-96, -60, -130, -74, -142, -62);
          c.bezierCurveTo(-138, -34, -112, -4, -100, 2);
          c.bezierCurveTo(-112, 12, -136, 44, -142, 76);
          c.bezierCurveTo(-120, 84, -90, 66, -76, 42);
          c.quadraticCurveTo(-30, 26, 16, 34);
          c.closePath();
        });
      },
    },
    paint(c) {
      const body = () => {
        c.moveTo(286, 16);
        c.bezierCurveTo(286, -92, 150, -112, 40, -106);
        c.bezierCurveTo(-74, -100, -168, -70, -226, -24);
        c.bezierCurveTo(-218, 20, -210, 28, -196, 40);
        c.bezierCurveTo(-120, 92, 20, 112, 120, 106);
        c.bezierCurveTo(220, 100, 286, 76, 286, 16);
        c.closePath();
      };
      mass(c, { skin: '#4e8fd0', shade: '#7fa8d6' }, body, () => {
        c.fillStyle = '#e8f3fb';
        c.beginPath();
        c.moveTo(290, 22);
        c.bezierCurveTo(200, 30, 60, 34, -130, 62);
        c.lineTo(-40, 130);
        c.lineTo(300, 130);
        c.closePath();
        c.fill();
        pen(c, '#a9c8e4', FINE + 1, () => {
          for (let i = 0; i < 7; i++) {
            const y = 46 + i * 11;
            c.moveTo(262 - i * 12, y - 6);
            c.quadraticCurveTo(110, y + 8 + i * 2, -40 + i * 26, y + 26);
          }
        });
        dots(c, '#6fa6dc', [[-40, -60, 9], [-84, -40, 7], [20, -72, 8], [66, -56, 6], [-130, -24, 6]]);
      }, [-9, -14], LINE + 1);
      gloss(c, 56, -84, 64, 8, -0.04, 0.4);
      pen(c, INK, LINE, () => {
        c.moveTo(286, 18);
        c.bezierCurveTo(240, 42, 196, 30, 176, 18);
      });
      cheek(c, 200, 36, 14, 8);
      shape(c, '#3f7cbd', () => {
        c.moveTo(90, 50);
        c.bezierCurveTo(70, 96, 18, 122, -30, 118);
        c.bezierCurveTo(-2, 92, 26, 62, 46, 42);
        c.closePath();
      });
      pen(c, '#2d619c', FINE + 1, () => {
        c.arc(116, -98, 7, Math.PI * 1.1, Math.PI * 1.9);
      });
    },
  },
};

const FIND_ART = {
  boot: {
    box: [120, 120, 60, 62],
    paint(c) {
      const build = () => {
        c.moveTo(-34, -48);
        c.lineTo(14, -48);
        c.lineTo(14, 2);
        c.bezierCurveTo(30, 6, 52, 10, 50, 34);
        c.lineTo(-34, 34);
        c.closePath();
      };
      mass(c, { skin: '#c07a3e', shade: '#d0a06f' }, build);
      shape(c, '#6f4220', () => roundBox(c, -38, 28, 92, 14, 6));
      shape(c, '#e5c08a', () => roundBox(c, -38, -56, 56, 14, 6));
      pen(c, '#fff0cc', FINE, () => {
        for (const y of [-26, -12, 2]) {
          c.moveTo(4, y);
          c.lineTo(22, y + 4);
        }
      });
      gloss(c, -18, -24, 7, 16, 0, 0.3);
    },
  },
  teapot: {
    box: [140, 110, 70, 56],
    paint(c) {
      pen(c, INK, 14, () => c.arc(-44, 8, 22, Math.PI * 0.55, Math.PI * 1.5));
      pen(c, '#ff9fb8', 6, () => c.arc(-44, 8, 22, Math.PI * 0.55, Math.PI * 1.5));
      shape(c, '#ff9fb8', () => {
        c.moveTo(30, 18);
        c.quadraticCurveTo(50, 8, 58, -16);
        c.lineTo(68, -12);
        c.quadraticCurveTo(60, 22, 34, 36);
        c.closePath();
      });
      mass(c, { skin: '#ffb3c6', shade: '#ffc9b0' }, () => circle(c, 0, 8, 42, 36), () => {
        dots(c, '#fff', [[-18, -4, 6], [10, 18, 6], [16, -10, 5], [-12, 26, 5]]);
      });
      shape(c, '#ff9fb8', () => c.ellipse(0, -26, 26, 7, 0, 0, TAU));
      shape(c, '#ffd84d', () => circle(c, 0, -38, 8));
      gloss(c, -14, -8, 12, 6, -0.5);
    },
  },
  ducky: {
    box: [120, 110, 60, 58],
    paint(c) {
      blob(c, '#ffd93b', () => {
        circle(c, -4, 18, 44, 28);
        circle(c, 16, -22, 25);
        c.moveTo(-46, 8);
        c.lineTo(-58, -10);
        c.lineTo(-34, -2);
        c.closePath();
      });
      gloss(c, 8, -36, 9, 5, -0.4);
      gloss(c, -18, 6, 16, 6, -0.2, 0.45);
      shape(c, '#ff8a2a', () => {
        c.moveTo(36, -26);
        c.quadraticCurveTo(58, -24, 56, -14);
        c.quadraticCurveTo(46, -8, 36, -12);
        c.closePath();
      }, FINE);
      pen(c, '#e8a910', FINE + 1, () => {
        c.moveTo(-30, 18);
        c.quadraticCurveTo(-8, 34, 16, 14);
      });
      shape(c, INK, () => circle(c, 22, -28, 5), 0);
      gloss(c, 24, -30, 2, 2, 0, 1);
    },
  },
  sock: {
    box: [110, 130, 52, 66],
    paint(c) {
      const build = () => {
        c.moveTo(-26, -56);
        c.lineTo(22, -56);
        c.lineTo(22, 6);
        c.bezierCurveTo(26, 16, 46, 22, 46, 40);
        c.bezierCurveTo(46, 56, 22, 58, 6, 52);
        c.bezierCurveTo(-18, 44, -26, 22, -26, 2);
        c.closePath();
      };
      mass(c, { skin: '#fff6e0', shade: '#e6dcc0' }, build, () => {
        for (const [y, color] of [[-44, '#ff6b6b'], [-24, '#4db8e8'], [-4, '#ffc93b'], [16, '#6bd16b'], [36, '#ff6b6b']]) {
          c.fillStyle = color;
          c.fillRect(-60, y, 120, 11);
        }
      });
    },
  },
};

export const creatureBox = (type) => CREATURE_ART[type].box;

const creatureCache = new Map();
const spriteCache = new Map();

function sprite(w, h, ox, oy, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * RES);
  canvas.height = Math.ceil(h * RES);
  const c = canvas.getContext('2d');
  c.scale(RES, RES);
  c.translate(ox, oy);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  paint(c);
  return { canvas, w, h, ox, oy };
}

const stamp = (c, s) => c.drawImage(s.canvas, -s.ox, -s.oy, s.w, s.h);

function cached(key, make) {
  if (!spriteCache.has(key)) spriteCache.set(key, make());
  return spriteCache.get(key);
}

function creatureSprites(type) {
  if (!creatureCache.has(type)) {
    const art = CREATURE_ART[type];
    creatureCache.set(type, {
      body: sprite(...art.box, art.paint),
      tail: sprite(...art.tail.box, art.tail.paint),
    });
  }
  return creatureCache.get(type);
}

export function spriteBytes() {
  let bytes = 0;
  const add = (s) => { bytes += s.canvas.width * s.canvas.height * 4; };
  for (const parts of creatureCache.values()) {
    add(parts.body);
    add(parts.tail);
  }
  for (const s of spriteCache.values()) add(s);
  return bytes;
}

function drawEye(c, eye, { lookX, lookY, happy, blink }) {
  const { x, y, r } = eye;
  if (happy || blink) {
    c.lineCap = 'round';
    pen(c, INK, 4, () => {
      if (happy) c.arc(x, y + r * 0.35, r * 0.72, Math.PI * 1.1, Math.PI * 1.9);
      else {
        c.moveTo(x - r * 0.7, y);
        c.lineTo(x + r * 0.7, y);
      }
    });
    return;
  }
  shape(c, '#fff', () => circle(c, x, y, r), 3);
  c.fillStyle = INK;
  c.beginPath();
  circle(c, x + lookX * r * 0.3, y + lookY * r * 0.3, r * 0.62);
  c.fill();
  c.fillStyle = '#fff';
  c.beginPath();
  circle(c, x + lookX * r * 0.3 - r * 0.2, y + lookY * r * 0.3 - r * 0.24, r * 0.2);
  c.fill();
}

export function glimGlow(c, t) {
  const art = CREATURE_ART.glim.lure;
  const sway = Math.sin(t * 2.2) * 5;
  const x = art.tip[0] + sway;
  const y = art.tip[1];
  c.lineCap = 'round';
  pen(c, INK, 7, () => {
    c.moveTo(art.from[0], art.from[1]);
    c.quadraticCurveTo(art.from[0] + 20, art.tip[1] - 8, x, y);
  });
  pen(c, '#5a8bf0', 3, () => {
    c.moveTo(art.from[0], art.from[1]);
    c.quadraticCurveTo(art.from[0] + 20, art.tip[1] - 8, x, y);
  });
  const pulse = 0.55 + Math.sin(t * 3) * 0.2;
  c.fillStyle = `rgba(255,244,150,${pulse * 0.45})`;
  c.beginPath();
  circle(c, x, y, 26);
  c.fill();
  shape(c, '#fff4a0', () => circle(c, x, y, 11), FINE);
  gloss(c, x - 3, y - 4, 3, 3, 0, 0.9);
}

// options: t for animation, lookX/lookY as -1..1, happy for riding eyes.
export function drawCreature(c, type, { t = 0, lookX = 0.4, lookY = 0.2, happy = false, big = 1 } = {}) {
  const art = CREATURE_ART[type];
  const parts = creatureSprites(type);
  const wag = Math.sin(t * (happy ? 12 : 7)) * art.wag;
  c.save();
  if (big !== 1) c.scale(big, big);
  if (art.flap) c.scale(1, 1 + Math.sin(t * 3) * art.flap);
  c.save();
  c.translate(art.tail.at[0], art.tail.at[1]);
  c.rotate(wag);
  stamp(c, parts.tail);
  c.restore();
  stamp(c, parts.body);
  if (art.lure) glimGlow(c, t);
  const blink = Math.sin(t * 0.9) > 0.992;
  for (const eye of art.eyes) drawEye(c, eye, { lookX, lookY, happy, blink });
  if (type === 'hoppa') {
    // The body-side fin is the part that flutters on a seahorse, so it rides on top of the body.
    c.save();
    c.translate(art.tail.at[0] + 18, art.tail.at[1]);
    c.scale(0.8, 0.8);
    c.rotate(wag * 1.5);
    stamp(c, parts.tail);
    c.restore();
  }
  c.restore();
}

export function drawFind(c, type) {
  const art = FIND_ART[type];
  stamp(c, cached(`find-${type}`, () => sprite(...art.box, art.paint)));
}

export function drawThing(c, type, options) {
  if (type in FIND_ART) drawFind(c, type);
  else drawCreature(c, type, options);
}

export function portrait(type, size, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size * RES;
  canvas.height = size * RES;
  const c = canvas.getContext('2d');
  const box = (CREATURE_ART[type] ?? FIND_ART[type]).box;
  const fit = (size * 0.92) / Math.max(box[0], box[1]);
  c.scale(RES * fit, RES * fit);
  c.translate((size / fit - box[0]) / 2 + box[2], (size / fit - box[1]) / 2 + box[3]);
  drawThing(c, type, { t: 1.1, lookX: 0.5, lookY: 0.1, ...options });
  return canvas;
}

// The silhouette a sleeping friend leaves in the sand above its level.
export function drawShadow(c, type, x, y, color, scale = 1) {
  const box = CREATURE_ART[type].box;
  const shadow = cached(`shadow-${type}`, () => sprite(box[0] + 20, box[1] + 20, box[2] + 10, box[3] + 10, (s) => {
    drawCreature(s, type, { t: 1.1 });
    s.globalCompositeOperation = 'source-in';
    s.fillStyle = color;
    s.fillRect(-box[2] - 20, -box[3] - 20, box[0] + 60, box[1] + 60);
  }));
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  stamp(c, shadow);
  c.restore();
}

const BOAT_TONES = {
  capy: { hull: '#ff6f61', trim: '#fff3d6', dark: '#d94d44', shade: '#ffa08f' },
  duck: { hull: '#2fb8c6', trim: '#fff3d6', dark: '#1d8a99', shade: '#7fd4db' },
};

function paintCapy(c) {
  shape(c, '#8f6240', () => circle(c, -4, -110, 11, 10), FINE + 1);
  const body = () => {
    c.moveTo(-74, -28);
    c.bezierCurveTo(-86, -74, -56, -100, -18, -102);
    c.bezierCurveTo(-6, -114, 14, -120, 30, -116);
    c.bezierCurveTo(50, -112, 68, -102, 72, -88);
    c.bezierCurveTo(75, -72, 62, -66, 46, -66);
    c.bezierCurveTo(38, -56, 34, -44, 32, -28);
    c.closePath();
  };
  mass(c, { skin: '#b98a60', shade: '#cdb092' }, body, () => {
    c.fillStyle = '#dcb88f';
    c.beginPath();
    circle(c, 8, -30, 30, 26);
    c.fill();
    c.fillStyle = '#a9794f';
    c.beginPath();
    circle(c, 62, -86, 16, 20);
    c.fill();
  });
  shape(c, '#6f4a2f', () => circle(c, 66, -92, 4.5, 3.5, 0.4), 0);
  pen(c, INK, FINE, () => {
    c.moveTo(66, -76);
    c.quadraticCurveTo(56, -70, 46, -76);
  });
  cheek(c, 34, -80, 9, 6);
  shape(c, INK, () => circle(c, 28, -98, 6), 0);
  gloss(c, 30, -100, 2, 2, 0, 1);
  // A little orange, balanced on the head, which capybaras are known to tolerate.
  shape(c, '#ffa62e', () => circle(c, 8, -128, 14, 13), FINE + 1);
  pen(c, '#3fa34d', FINE + 1, () => {
    c.moveTo(8, -140);
    c.quadraticCurveTo(14, -148, 22, -144);
  });
  gloss(c, 3, -132, 4, 3, -0.5, 0.7);
  shape(c, '#a9794f', () => circle(c, 34, -52, 13, 11), FINE + 1);
}

function paintDuck(c) {
  const body = () => {
    c.moveTo(-58, -26);
    c.bezierCurveTo(-66, -62, -46, -84, -16, -82);
    c.bezierCurveTo(-22, -106, -2, -122, 18, -120);
    c.bezierCurveTo(42, -118, 50, -96, 42, -80);
    c.bezierCurveTo(38, -70, 34, -66, 30, -60);
    c.bezierCurveTo(42, -50, 40, -36, 36, -26);
    c.closePath();
  };
  shape(c, '#ffdb4d', () => {
    c.moveTo(2, -114);
    c.quadraticCurveTo(-2, -134, 12, -132);
    c.quadraticCurveTo(8, -124, 18, -128);
    c.quadraticCurveTo(20, -120, 14, -114);
    c.closePath();
  }, FINE + 1);
  mass(c, { skin: '#ffdb4d', shade: '#ffd27f' }, body, () => {
    c.fillStyle = '#fff2b3';
    c.beginPath();
    circle(c, 4, -30, 28, 24);
    c.fill();
  });
  shape(c, '#ff8a2a', () => {
    c.moveTo(42, -98);
    c.quadraticCurveTo(70, -96, 68, -84);
    c.quadraticCurveTo(56, -76, 40, -82);
    c.closePath();
  }, FINE + 1);
  cheek(c, 32, -78, 8, 5);
  shape(c, INK, () => circle(c, 28, -100, 6), 0);
  gloss(c, 30, -102, 2, 2, 0, 1);
  shape(c, '#f7c52e', () => circle(c, 30, -50, 15, 11, 0.3), FINE + 1);
}

function paintBoat(c, rider, extras) {
  const tone = BOAT_TONES[rider];
  if (extras.includes('parasol')) {
    c.lineCap = 'round';
    pen(c, INK, 7, () => {
      c.moveTo(-68, -26);
      c.lineTo(-68, -140);
    });
    pen(c, '#fff3d6', 3, () => {
      c.moveTo(-68, -26);
      c.lineTo(-68, -140);
    });
    shape(c, '#ffd84d', () => {
      c.moveTo(-132, -112);
      c.quadraticCurveTo(-68, -186, -4, -112);
      c.quadraticCurveTo(-36, -124, -68, -112);
      c.quadraticCurveTo(-100, -124, -132, -112);
      c.closePath();
    });
    pen(c, '#ff8a2a', FINE, () => {
      c.moveTo(-68, -152);
      c.quadraticCurveTo(-96, -136, -100, -118);
      c.moveTo(-68, -152);
      c.quadraticCurveTo(-40, -136, -36, -118);
    });
  }
  if (extras.includes('flag')) {
    pen(c, INK, 5, () => {
      c.moveTo(-104, -20);
      c.lineTo(-114, -96);
    });
    shape(c, tone.dark, () => {
      c.moveTo(-114, -96);
      c.lineTo(-164, -82);
      c.lineTo(-110, -64);
      c.closePath();
    }, FINE + 1);
  }
  if (rider === 'capy') paintCapy(c);
  else paintDuck(c);
  const hull = () => {
    c.moveTo(-112, -30);
    c.quadraticCurveTo(-4, -16, 118, -40);
    c.quadraticCurveTo(108, 14, 74, 30);
    c.lineTo(-76, 30);
    c.quadraticCurveTo(-104, 12, -112, -30);
    c.closePath();
  };
  mass(c, { skin: tone.hull, shade: tone.shade }, hull, () => {
    c.fillStyle = tone.trim;
    c.beginPath();
    c.moveTo(-120, -30);
    c.quadraticCurveTo(-4, -16, 126, -40);
    c.lineTo(126, -22);
    c.quadraticCurveTo(-4, 0, -120, -12);
    c.closePath();
    c.fill();
    pen(c, tone.dark, FINE, () => {
      c.moveTo(-104, 8);
      c.quadraticCurveTo(0, 22, 112, 0);
    });
  });
  gloss(c, -40, -24, 40, 2.4, 0.06, 0.6);
  if (extras.includes('lights')) {
    pen(c, INK, 2.5, () => {
      c.moveTo(-112, -34);
      c.quadraticCurveTo(-60, -6, 0, -30);
      c.quadraticCurveTo(60, -8, 118, -44);
    });
    const colors = ['#ff6b6b', '#ffd84d', '#6bd16b', '#4db8e8', '#c98bff'];
    for (let i = 0; i < 9; i++) {
      const s = i / 8;
      const x = -106 + s * 218;
      const y = -30 + Math.abs(Math.sin(s * Math.PI * 2)) * 12;
      shape(c, colors[i % colors.length], () => circle(c, x, y, 5), 2);
    }
  }
}

export function drawBoat(c, rider, extras) {
  const key = `boat-${rider}-${extras.join(',')}`;
  stamp(c, cached(key, () => sprite(330, 270, 170, 210, (s) => paintBoat(s, rider, extras))));
}

export function boatPortrait(rider, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size * RES;
  canvas.height = size * RES;
  const c = canvas.getContext('2d');
  const fit = size / 300;
  c.scale(RES * fit, RES * fit);
  c.translate(150, 214);
  drawBoat(c, rider, []);
  return canvas;
}

// The soft swim ring. It is drawn in two halves so a rider can sit through the hole.
function paintRing(c, front) {
  c.save();
  c.beginPath();
  c.rect(-70, front ? 0 : -40, 140, 40);
  c.clip();
  c.save();
  c.beginPath();
  circle(c, 0, 0, 56, 23);
  c.clip();
  c.fillStyle = '#ff5a5f';
  c.fillRect(-70, -40, 140, 80);
  c.fillStyle = '#fff6e6';
  for (let i = 0; i < 4; i++) {
    const a = (i * TAU) / 4 + 0.5;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.cos(a) * 80, Math.sin(a) * 34);
    c.lineTo(Math.cos(a + 0.5) * 80, Math.sin(a + 0.5) * 34);
    c.closePath();
    c.fill();
  }
  c.restore();
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = '#000';
  c.beginPath();
  circle(c, 0, 0, 30, 10);
  c.fill();
  c.globalCompositeOperation = 'source-over';
  pen(c, INK, LINE, () => circle(c, 0, 0, 56, 23));
  pen(c, INK, LINE - 1, () => circle(c, 0, 0, 30, 10));
  if (!front) gloss(c, -32, -11, 12, 2.4, -0.1, 0.8);
  c.restore();
}

export function drawRingBack(c) {
  stamp(c, cached('ring-back', () => sprite(130, 60, 65, 30, (s) => paintRing(s, false))));
}

export function drawRingFront(c) {
  stamp(c, cached('ring-front', () => sprite(130, 60, 65, 30, (s) => paintRing(s, true))));
}

export function drawPearl(c, size = 1) {
  const pearl = cached('pearl', () => sprite(44, 44, 22, 22, (s) => {
    const fill = s.createRadialGradient(-5, -6, 2, 0, 0, 18);
    fill.addColorStop(0, '#ffffff');
    fill.addColorStop(0.6, '#f3ecff');
    fill.addColorStop(1, '#c8c4f0');
    shape(s, fill, () => circle(s, 0, 0, 16), 3);
    gloss(s, -6, -7, 4, 3, -0.5, 0.95);
  }));
  c.save();
  c.scale(size, size);
  stamp(c, pearl);
  c.restore();
}

export function drawStar(c, size, fill = '#ffd84d') {
  shape(c, fill, () => {
    for (let i = 0; i < 10; i++) {
      const reach = i % 2 ? size * 0.46 : size;
      const angle = (i * TAU) / 10 - Math.PI / 2;
      c[i ? 'lineTo' : 'moveTo'](Math.cos(angle) * reach, Math.sin(angle) * reach);
    }
    c.closePath();
  }, 3);
}

const BUBBLE_TINT = { double: '#ffd84d', bigRing: '#ff8fa8' };

// Contents show on the outside, so nothing about a bubble is a mystery prize.
export function drawBubble(c, kind, t) {
  const body = cached(`bubble-${kind}`, () => sprite(140, 140, 70, 70, (s) => {
    s.fillStyle = 'rgba(190,240,255,0.32)';
    s.beginPath();
    circle(s, 0, 0, 58);
    s.fill();
    s.lineWidth = 4;
    s.strokeStyle = 'rgba(255,255,255,0.95)';
    s.stroke();
    gloss(s, -24, -28, 16, 8, -0.7, 0.9);
    if (kind === 'double') {
      s.save();
      s.translate(-14, 2);
      drawPearl(s, 1.05);
      s.translate(26, 8);
      drawPearl(s, 1.05);
      s.restore();
      s.font = '30px "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
      s.textAlign = 'center';
      s.lineWidth = 6;
      s.strokeStyle = INK;
      s.strokeText('x2', 2, -14);
      s.fillStyle = BUBBLE_TINT.double;
      s.fillText('x2', 2, -14);
    } else {
      s.save();
      s.scale(0.8, 0.8);
      drawRingBack(s);
      drawRingFront(s);
      s.restore();
    }
  }));
  c.save();
  c.scale(1 + Math.sin(t * 2) * 0.03, 1 - Math.sin(t * 2) * 0.03);
  stamp(c, body);
  c.restore();
}

// A ghost hand, never a word. The fingertip is at 0,0.
export function drawHand(c) {
  stamp(c, cached('hand', () => sprite(120, 150, 40, 8, (s) => {
    blob(s, 'rgba(255,255,255,0.96)', () => {
      roundBox(s, -14, 0, 28, 84, 14);
      roundBox(s, 12, 40, 24, 56, 12);
      roundBox(s, 32, 46, 22, 52, 11);
      roundBox(s, -34, 56, 24, 40, 12);
      circle(s, 8, 96, 44, 36);
    }, FINE + 1);
    pen(s, 'rgba(18,55,90,0.3)', FINE, () => {
      s.moveTo(14, 70);
      s.lineTo(14, 88);
      s.moveTo(33, 72);
      s.lineTo(33, 90);
    });
  })));
}

export function paintCloud(c, scale, alpha = 1) {
  c.save();
  c.scale(scale, scale);
  c.fillStyle = `rgba(255,255,255,${alpha})`;
  c.beginPath();
  circle(c, 0, 0, 62, 22);
  circle(c, -26, -12, 28);
  circle(c, 12, -22, 36);
  circle(c, 42, -6, 22);
  c.fill();
  c.restore();
}

export function drawCloud(c, id) {
  const shapeOf = cached(`cloud-${id}`, () => sprite(260, 110, 130, 70, (s) => paintCloud(s, id === 0 ? 1.3 : 0.95, 0.94)));
  stamp(c, shapeOf);
}

export { shape, pen, circle, gloss, roundBox, sprite, stamp, cheek };
