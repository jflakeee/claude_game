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
  for (const [name, pixels] of Object.entries(patterns)) {
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
export function drawRoom(scene, width, height, combat = false) {
  const g = scene.add.graphics().setDepth(-10);
  g.fillStyle(0x111c25);
  g.fillRect(0, 0, width, height);
  const horizon = combat ? 76 : Math.max(110, height * 0.53);
  for (let row = 0; row < Math.ceil(horizon / 22); row++)
    for (let col = -1; col < width / 48 + 1; col++) {
      const x = col * 48 + (row % 2) * 24,
        y = row * 22;
      g.fillStyle((row + col) % 3 === 0 ? 0x203039 : 0x1a2932);
      g.fillRect(x + 1, y + 1, 46, 20);
      g.fillStyle(0x2a3b42);
      g.fillRect(x + 2, y + 1, 44, 1);
    }
  for (let x = 28; x < width; x += 112) {
    if (!combat) {
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
        (Math.floor(y / 32) + Math.floor(x / 48)) % 3 ? 0x2a3b3f : 0x304146,
      );
      g.fillRect(x + (Math.floor(y / 32) % 2) * 24 + 1, y + 1, 46, 30);
      g.lineStyle(1, 0x1a2b30);
      g.strokeRect(x + (Math.floor(y / 32) % 2) * 24, y, 48, 32);
    }
  g.fillStyle(0x131f28);
  g.fillRect(0, horizon - 4, width, 8);
  for (let i = 0; i < 30; i++) {
    const x = (i * 83 + 39) % width,
      y = horizon + ((i * 53 + 20) % Math.max(1, height - horizon));
    g.fillStyle(i % 3 ? 0x45604a : 0x66755b, 0.65);
    g.fillRect(x, y, 3, 5);
    g.fillRect(x + 3, y + 2, 4, 2);
  }
  g.fillStyle(0x09121a, 0.3);
  g.fillRect(0, 0, 10, height);
  g.fillRect(width - 10, 0, 10, height);
  return g;
}
export function floatingText(scene, x, y, text, color = "#efd59a") {
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
  scene.tweens.add({
    targets: label,
    y: y - 28,
    alpha: 0,
    duration: 800,
    onComplete: () => label.destroy(),
  });
}
