import { motionEnabled } from "../systems/presentation.js";
const palette = {
  o: 0xe88768,
  a: 0xffb291,
  b: 0x9e4f46,
  w: 0xffedd3,
  k: 0x242335,
  g: 0x77cda3,
  d: 0x347761,
  p: 0xac91d9,
  q: 0x655183,
  s: 0xc6cec8,
};
const patterns = {
  guardian: [
    "...pp......pp...",
    "..pqqp....pqqp..",
    ".ppqqppppppqqpp.",
    "..pwwwwwwwwwwp..",
    "..pwkkwwwwkkwp..",
    "..pwkkwwwwkkwp..",
    "..pwwwwkkwwwwp..",
    "...pwwwwwwwwp...",
    "....pwwwwwwp....",
    "..qqppppppppqq..",
    ".qqqqppppppqqqq.",
    "qqqqqppppppqqqqq",
    ".qq..pppppp..qq.",
    ".....qq..qq.....",
    "....qqq..qqq....",
    "...qqqq..qqqq...",
  ],
  hero: [
    "................",
    ".....oo..oo.....",
    "....oao..oao....",
    "...oooooooooo...",
    "..ooaaaaaaaaoo..",
    "..oaakkaakkaao..",
    "..oaakkaakkaao..",
    "..oaaaaaaaaaao..",
    "..ooaaawwaaaoo..",
    "...oooooooooo...",
    "..oo.oooooo.oo..",
    "..o..oo..oo..o..",
    ".....bb..bb.....",
    "....bbb..bbb....",
  ],
  slime: [
    "................",
    "................",
    ".....gggggg.....",
    "...gggggggggg...",
    "..ggwggggggggg..",
    "..ggggkggkgggg..",
    "..gggggggggggg..",
    "..dggggkkggggd..",
    "...dddddddddd...",
    "..ddd.dddd.ddd..",
  ],
  bat: [
    "................",
    ".pp..........pp.",
    ".ppp........ppp.",
    ".pqp...pp...pqp.",
    "..pqqppppppqqp..",
    "...pppkppkppp...",
    "....pppppppp....",
    ".....qqwwqq.....",
    "......qqqq......",
    "......q..q......",
  ],
  skull: [
    "................",
    ".....ssssss.....",
    "....swwwwwws....",
    "...swwwwwwwws...",
    "...swkkwwkkws...",
    "...swkkwwkkws...",
    "....swwkkwws....",
    ".....swwwws.....",
    ".....swswsw.....",
    "......qqqq......",
    ".....qqqqqq.....",
    "....qq.qq.qq....",
  ],
};
export function prepareArt(scene) {
  const poses = { ...patterns };
  const hero = (rows) => patterns.hero.map((row, i) => rows[i] ?? row);
  poses['hero-step-a'] = hero({ 12: '....bbb..bb.....', 13: '...bbb....bb....' });
  poses['hero-step-b'] = hero({ 12: '.....bb..bbb....', 13: '....bb....bbb...' });
  poses['hero-ready'] = hero({ 10: '..oo.oooooo.oo..', 11: '...oooo..oooo...', 12: '....bbb..bbb...' });
  poses['hero-strike'] = hero({ 10: '..oo.oooooooooww', 11: '..o..oo..oo...ww', 12: '....bbb...bb....', 13: '...bbb.....bbb..' });
  poses['hero-hurt'] = hero({ 5: '..oaakaaakaao...', 6: '..oaaakkaaaao...', 10: '..oooooooooooo..', 11: '.....oo..oo.....' });
  poses['slime-step'] = patterns.slime.map((row, i) => i === 2 ? '................' : i === 8 ? '..dddddddddddd..' : i === 9 ? '.dddd.dddd.dddd.' : row);
  poses['slime-hurt'] = patterns.slime.map((row, i) => i === 5 ? '..gggkkggkkggg..' : i === 7 ? '..dggkkkkggggd..' : row);
  poses['bat-flap-a'] = patterns.bat.map((row, i) => ({1:'ppp..........ppp',2:'ppp..........ppp',3:'pqp....pp....pqp'}[i] || row));
  poses['bat-flap-b'] = patterns.bat.map((row, i) => ({1:'................',2:'...p........p...',3:'...pqp....pqp...'}[i] || row));
  poses['skull-hover-a'] = patterns.skull.map((row, i) => i === 1 ? '....ssssssss....' : i === 11 ? '.....qq..qq.....' : row);
  poses['skull-hover-b'] = patterns.skull.map((row, i) => i === 1 ? '......ssss......' : i === 11 ? '...qq..qq..qq...' : row);
  poses['guardian-ready'] = patterns.guardian.map((row, i) => i === 10 ? '.qqqppppppppqqq.' : row);
  poses['guardian-strike'] = patterns.guardian.map((row, i) => i === 8 ? '...pwwwwwwwwp....' : i === 9 ? '....pwwwwwwp....' : row);
  for (const [name, pixels] of Object.entries(poses)) {
    if (scene.textures.exists(name)) continue;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    pixels.forEach((line, y) =>
      [...line].forEach((p, x) => {
        if (palette[p]) {
          g.fillStyle(palette[p]);
          g.fillRect(x, y, 1, 1);
        }
      }),
    );
    g.generateTexture(name, 16, 16);
    g.destroy();
  }
}

// Texture changes only: world positions and collision bounds remain model-owned.
export function poseActor(sprite, kind, time, { moving = false, ready = false, strike = false, hurt = false } = {}) {
  let suffix = '';
  if (motionEnabled()) {
    if (kind === 'hero') suffix = hurt ? '-hurt' : strike ? '-strike' : ready ? '-ready' : moving ? (Math.floor(time / 130) % 2 ? '-step-a' : '-step-b') : '';
    if (kind === 'slime') suffix = hurt ? '-hurt' : moving && Math.floor(time / 180) % 2 ? '-step' : '';
    if (kind === 'bat') suffix = moving ? (Math.floor(time / 120) % 2 ? '-flap-a' : '-flap-b') : '';
    if (kind === 'skull') suffix = moving && Math.floor(time / 240) % 2 ? '-hover-a' : moving ? '-hover-b' : '';
    if (kind === 'guardian') suffix = strike ? '-strike' : ready ? '-ready' : '';
  }
  sprite.setTexture(kind + suffix);
}
export function drawRoom(scene, width, height, combat = false) {
  const g = scene.add.graphics().setDepth(-10);
  g.fillStyle(0x111c25);
  g.fillRect(0, 0, width, height);
  const horizon = combat ? 76 : Math.max(110, height * 0.53);
  for (let row = 0; row < Math.ceil(horizon / 22); row++)
    for (let col = -1; col < width / 48 + 1; col++) {
      const x = col * 48 + (row % 2) * 24,
        y = row * 22;
      g.fillStyle((row + col) % 3 === 0 ? 0x1c2d35 : 0x192930);
      g.fillRect(x + 1, y + 1, 46, 20);
      g.fillStyle(0x24353c);
      g.fillRect(x + 2, y + 1, 44, 1);
    }
  if (!combat) {
    // Large architectural shapes replace competing small detail in the distance.
    const archHeight = Math.min(190, horizon - 104);
    if (archHeight > 42) for (let x = 56; x < width; x += 224) {
      const y = horizon - archHeight - 18;
      g.fillStyle(0x33464b);
      g.fillRoundedRect(x, y, 102, archHeight, { tl: 50, tr: 50, bl: 0, br: 0 });
      g.fillStyle(0x0d1d28);
      g.fillRoundedRect(x + 7, y + 8, 88, archHeight - 8, { tl: 44, tr: 44, bl: 0, br: 0 });
      g.fillStyle(0x7aabae, 0.13);
      g.fillTriangle(x + 12, horizon - 18, x + 90, horizon - 18, x + 130, horizon + 90);
      g.fillStyle(0x9ac2c5, 0.7);
      g.fillRect(x + 30, y + 35, 2, 2);
      g.fillRect(x + 70, y + 57, 2, 2);
      g.fillStyle(0x30454b);
      g.fillRect(x + 49, y + 12, 4, archHeight - 12);
      g.fillRect(x + 8, y + archHeight * 0.58, 85, 4);
    }
  }
  for (let x = 28; x < width; x += 112) {
    if (!combat && horizon < 220) {
      g.fillStyle(0x10191f);
      g.fillRect(x + 4, horizon - 111, 55, 102);
      g.fillStyle(0x314148);
      g.fillRect(x, horizon - 115, 63, 9);
      g.fillRect(x, horizon - 108, 8, 101);
      g.fillRect(x + 55, horizon - 108, 8, 101);
      for (let i = 0; i < 3; i++) {
        g.fillStyle(0x283b40);
        g.fillRect(x + 12 + i * 14, horizon - 100, 5, 70);
      }
    }
    g.fillStyle(0x5c4635);
    g.fillRect(x + 26, horizon - 45, 6, 20);
    g.fillStyle(0xad603d, 0.16);
    g.fillCircle(x + 29, horizon - 48, 28);
    g.fillStyle(0xe59657);
    g.fillRect(x + 25, horizon - 53, 8, 12);
    g.fillStyle(0xffd58b);
    g.fillRect(x + 28, horizon - 58, 4, 14);
  }
  g.fillStyle(0x24343a);
  g.fillRect(0, horizon, width, height - horizon);
  for (let y = horizon; y < height; y += 32)
    for (let x = -16; x < width; x += 48) {
      g.fillStyle(
        combat ? ((Math.floor(y / 32) + Math.floor(x / 48)) % 3 ? 0x26383e : 0x293b40)
          : ((Math.floor(y / 32) + Math.floor(x / 48)) % 3 ? 0x2a3b3f : 0x304146),
      );
      g.fillRect(x + (Math.floor(y / 32) % 2) * 24 + 1, y + 1, 46, 30);
      g.lineStyle(1, combat ? 0x22343a : 0x1a2b30);
      g.strokeRect(x + (Math.floor(y / 32) % 2) * 24, y, 48, 32);
    }
  g.fillStyle(0x131f28);
  g.fillRect(0, horizon - 4, width, 8);
  for (let i = 0; i < 30; i++) {
    const x = (i * 83 + 39) % width,
      y = horizon + ((i * 53 + 20) % Math.max(1, height - horizon));
    g.fillStyle(i % 3 ? 0x45604a : 0x66755b, combat ? 0.22 : 0.65);
    g.fillRect(x, y, 3, 5);
    g.fillRect(x + 3, y + 2, 4, 2);
  }
  g.fillStyle(0x09121a, 0.3);
  g.fillRect(0, 0, 10, height);
  g.fillRect(width - 10, 0, 10, height);
  const distant = scene.add.graphics().setDepth(-9);
  if (!combat) {
    for (let x = 36; x < width + 120; x += 280) {
      const archTop = Math.max(0, horizon - 162);
      distant.fillStyle(0x55747a, 0.08);
      distant.fillRect(x + 8, archTop + 36, 9, horizon - archTop - 36);
      distant.fillRect(x + 104, archTop + 36, 9, horizon - archTop - 36);
      distant.fillRect(x, archTop + 30, 122, 6);
      distant.fillStyle(0x9bb8b1, 0.08);
      distant.fillRect(x + 56, archTop + 64, 3, horizon - archTop - 64);
    }
  }
  return {
    base: g,
    distant,
    get x() { return g.x; },
    set x(value) {
      g.x = value;
      distant.x = value * 0.35;
    },
    destroy() { g.destroy(); distant.destroy(); },
  };
}
export function floatingText(scene, x, y, text, color = "#efd59a") {
  scene.feedbackLabels ||= new Set();
  for (const old of scene.feedbackLabels) if (!old.active) scene.feedbackLabels.delete(old);
  if (scene.feedbackLabels.size >= 24) return;
  const label = scene.add
    .text(x, y, text, {
      fontFamily: "system-ui",
      fontSize: "12px",
      fontStyle: "bold",
      color,
      stroke: "#14202a",
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(12);
  scene.feedbackLabels.add(label);
  scene.tweens.add({
    targets: label,
    y: motionEnabled() ? y - 28 : y,
    alpha: 0,
    duration: 800,
    onComplete: () => { scene.feedbackLabels.delete(label); label.destroy(); },
  });
}
