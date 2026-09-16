// demo2 · 「重塑」—— 参考 demo2.mp4
// 同一批粒子在不同「器物」之间变形：每次轻触，当前形体先以 碎片 / 尘埃 / 切环 三种方式之一炸开，
// 再重新聚合成下一个形体；长按可以把当前形体「预览式」打散，松手复原；拖拽旋转。

import * as THREE from 'three';
import { USER, formatMoney } from '../shared/data.js';

/* ------------------------------------------------------------------ utils */
const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || innerWidth < 600;
const N = isMobile ? 26000 : 40000; // 粒子总数（所有形体共用）
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

const tweens = [];
function tween(from, to, dur, ease, onUpdate) {
  return new Promise((resolve) => tweens.push({ t0: performance.now(), from, to, dur, ease, onUpdate, resolve }));
}
function updateTweens(now) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    const k = clamp((now - tw.t0) / tw.dur, 0, 1);
    tw.onUpdate(lerp(tw.from, tw.to, tw.ease(k)));
    if (k >= 1) { tweens.splice(i, 1); tw.resolve(); }
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* --------------------------------------------------------------- colors */
const C = {
  cyan: [0.49, 0.91, 0.86],
  cyanDim: [0.22, 0.42, 0.42],
  white: [0.93, 0.96, 0.94],
  whiteDim: [0.42, 0.47, 0.45],
  gold: [0.98, 0.80, 0.36],
  goldDim: [0.55, 0.42, 0.18],
  slate: [0.45, 0.52, 0.58],
  slateDim: [0.22, 0.26, 0.3],
};
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const sparkle = (c, p = 0.06) => (Math.random() < p ? [1, 1, 1] : c);

/* --------------------------------------------------------------- shapes */
// 每个形体生成 { pos: number[], col: number[] }，之后统一重采样成 N 个点
function sampleText(str, { font = '700 220px -apple-system, "Helvetica Neue", Arial, sans-serif', maxW = 2.6, maxH = 1.25, thick = 0.14, color, decorate } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = font;
  const tw = Math.ceil(g.measureText(str).width) + 40, th = 300;
  c.width = tw; c.height = th;
  g.font = font; g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.fillText(str, tw / 2, th / 2);
  if (decorate) decorate(g, tw, th);
  const data = g.getImageData(0, 0, tw, th).data;
  const cells = [];
  for (let y = 0; y < th; y += 2) for (let x = 0; x < tw; x += 2) if (data[(y * tw + x) * 4 + 3] > 120) cells.push(x, y);
  const scale = Math.min(maxW / tw, maxH / th);
  const pos = [], col = [];
  const n = cells.length / 2;
  for (let i = 0; i < n; i++) {
    const x = cells[i * 2], y = cells[i * 2 + 1];
    const wx = (x - tw / 2 + rand(-1.2, 1.2)) * scale, wy = -(y - th / 2 + rand(-1.2, 1.2)) * scale;
    const yN = clamp(0.5 - wy / (th * scale), 0, 1);
    pos.push(wx, wy, rand(-thick / 2, thick / 2));
    col.push(...(color ? color(wx, wy, yN) : sparkle(mixc(C.white, C.cyanDim, yN * 0.8))));
  }
  return { pos, col };
}

function shapeGlobe() {
  const pos = [], col = [], R = 1.25;
  const n1 = 14000;
  for (let i = 0; i < n1; i++) { // 表面：稀疏、暗
    const k = i + 0.5, phi = Math.acos(1 - (2 * k) / n1), th = Math.PI * (1 + Math.sqrt(5)) * k;
    pos.push(R * Math.sin(phi) * Math.cos(th), R * Math.cos(phi), R * Math.sin(phi) * Math.sin(th));
    col.push(...mixc(C.whiteDim, C.cyanDim, Math.random()));
  }
  for (let j = -3; j <= 3; j++) { // 纬线
    const lat = (j / 4) * Math.PI * 0.5, r = R * Math.cos(lat), y = R * Math.sin(lat);
    const m = Math.floor(900 * r);
    for (let i = 0; i < m; i++) { const a = rand(0, Math.PI * 2); pos.push(r * Math.cos(a), y, r * Math.sin(a)); col.push(...sparkle(C.cyan, 0.03)); }
  }
  for (let j = 0; j < 12; j++) { // 经线
    const lon = (j / 12) * Math.PI * 2;
    for (let i = 0; i < 700; i++) {
      const lat = rand(-Math.PI / 2, Math.PI / 2), r = R * Math.cos(lat);
      pos.push(r * Math.cos(lon), R * Math.sin(lat), r * Math.sin(lon)); col.push(...C.white);
    }
  }
  { // 「你在这里」：一个亮点簇 + 光柱
    const lat = 0.54, lon = 2.11, cx = R * Math.cos(lat) * Math.cos(lon), cy = R * Math.sin(lat), cz = R * Math.cos(lat) * Math.sin(lon);
    for (let i = 0; i < 900; i++) { const s = 0.07; pos.push(cx + gauss() * s, cy + gauss() * s, cz + gauss() * s); col.push(...C.gold); }
    for (let i = 0; i < 600; i++) { const t = Math.random(); const k = 1 + t * 0.55; pos.push(cx * k + gauss() * 0.01, cy * k + gauss() * 0.01, cz * k + gauss() * 0.01); col.push(...mixc(C.gold, C.goldDim, t)); }
  }
  return { pos, col };
}

function shapeCandles() {
  const pos = [], col = [];
  const n = 15, gap = 0.19, w = 0.1, x0 = -((n - 1) * gap) / 2;
  let price = 0;
  const bars = [];
  for (let i = 0; i < n; i++) {
    const o = price, c = o + gauss() * 0.42 + 0.06, h = Math.max(o, c) + rand(0.02, 0.22), l = Math.min(o, c) - rand(0.02, 0.22);
    bars.push({ o, c, h, l }); price = c;
  }
  const ys = bars.flatMap((b) => [b.h, b.l]);
  const yMin = Math.min(...ys), yMax = Math.max(...ys), sc = 2.0 / (yMax - yMin), yc = (yMax + yMin) / 2;
  const Y = (v) => (v - yc) * sc;
  bars.forEach((b, i) => {
    const x = x0 + i * gap, up = b.c >= b.o;
    const base = up ? C.gold : C.slate, dim = up ? C.goldDim : C.slateDim;
    const y1 = Y(Math.min(b.o, b.c)), y2 = Math.max(Y(Math.max(b.o, b.c)), y1 + 0.05);
    for (let k = 0; k < 1500; k++) { // 实体：盒子的六个面
      const f = Math.random(), yy = rand(y1, y2);
      if (f < 0.4) pos.push(x + (Math.random() < 0.5 ? -w : w) / 2, yy, rand(-w, w) / 2);
      else if (f < 0.8) pos.push(x + rand(-w, w) / 2, yy, (Math.random() < 0.5 ? -w : w) / 2);
      else pos.push(x + rand(-w, w) / 2, Math.random() < 0.5 ? y1 : y2, rand(-w, w) / 2);
      col.push(...sparkle(mixc(base, dim, Math.random() * 0.6), 0.02));
    }
    for (let k = 0; k < 360; k++) { // 影线
      pos.push(x + gauss() * 0.006, rand(Y(b.l), Y(b.h)), gauss() * 0.006); col.push(...mixc(base, dim, 0.3));
    }
  });
  for (let k = 0; k < 2200; k++) { // 底部一条淡淡的时间轴
    pos.push(rand(-1.55, 1.55), -1.12 + gauss() * 0.004, gauss() * 0.02); col.push(...C.whiteDim);
  }
  return { pos, col };
}

function shapeCoin() {
  const pos = [], col = [], R = 1.12, H = 0.2;
  for (let i = 0; i < 12000; i++) { // 两面
    const a = rand(0, Math.PI * 2), r = R * Math.sqrt(Math.random()), z = Math.random() < 0.5 ? H / 2 : -H / 2;
    pos.push(r * Math.cos(a), r * Math.sin(a), z);
    const ring = Math.abs(r - R * 0.86) < 0.03 || Math.abs(r - R * 0.97) < 0.02; // 面上的两道刻环
    col.push(...(ring ? C.gold : mixc(C.goldDim, C.gold, Math.random() * 0.35)));
  }
  for (let i = 0; i < 6000; i++) { // 边缘
    const a = rand(0, Math.PI * 2);
    pos.push(R * Math.cos(a), R * Math.sin(a), rand(-H / 2, H / 2)); col.push(...sparkle(C.gold, 0.04));
  }
  // 系统字体大多没有 ₿ 字形：用 B 加上下两道竖线自己拼一个
  const sym = sampleText('B', {
    font: '700 240px -apple-system, "Helvetica Neue", Arial, sans-serif', maxW: 1.3, maxH: 1.3, thick: 0.05,
    color: () => sparkle(C.white, 0.08),
    decorate: (g, tw, th) => {
      const w = g.measureText('B').width;
      const x1 = tw / 2 - w * 0.12, x2 = tw / 2 + w * 0.1, bw = 16, bh = 32;
      g.fillRect(x1, th / 2 - 120 - bh + 6, bw, bh); g.fillRect(x2, th / 2 - 120 - bh + 6, bw, bh);
      g.fillRect(x1, th / 2 + 114, bw, bh); g.fillRect(x2, th / 2 + 114, bw, bh);
    },
  });
  for (let i = 0; i < sym.pos.length; i += 3) { pos.push(sym.pos[i], sym.pos[i + 1], H / 2 + 0.02 + sym.pos[i + 2]); }
  col.push(...sym.col);
  return { pos, col };
}

function shapeTorus() {
  const pos = [], col = [], R = 1.05, r = 0.36;
  for (let i = 0; i < 30000; i++) {
    const u = rand(0, Math.PI * 2), v = rand(0, Math.PI * 2);
    const rr = r * (Math.random() < 0.85 ? 1 : Math.sqrt(Math.random()));
    pos.push((R + rr * Math.cos(v)) * Math.cos(u), rr * Math.sin(v), (R + rr * Math.cos(v)) * Math.sin(u));
    const t = (Math.sin(u * 2) + 1) / 2;
    col.push(...sparkle(mixc(C.cyan, C.white, t * 0.7), 0.03));
  }
  return { pos, col };
}

// 把任意点集重采样为 N 个（允许重复，抖动后看不出来），并打乱顺序
function fitN(shape) {
  const m = shape.pos.length / 3;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const j = Math.floor(Math.random() * m);
    pos[i * 3] = shape.pos[j * 3] + gauss() * 0.004;
    pos[i * 3 + 1] = shape.pos[j * 3 + 1] + gauss() * 0.004;
    pos[i * 3 + 2] = shape.pos[j * 3 + 2] + gauss() * 0.004;
    col[i * 3] = shape.col[j * 3]; col[i * 3 + 1] = shape.col[j * 3 + 1]; col[i * 3 + 2] = shape.col[j * 3 + 2];
  }
  return { pos, col };
}

/* ------------------------------------------------------------ storyline */
const STEPS = [
  { shape: () => sampleText(String(USER.year)), explode: 'shards', accent: '#7ce8dc', tiltX: 0 },
  { shape: shapeGlobe, explode: 'dust', accent: '#7ce8dc', tiltX: 0.25 },
  { shape: shapeCandles, explode: 'rings', accent: '#f2c94c', tiltX: 0.1 },
  { shape: () => sampleText('$' + USER.totalVolumeShort, { color: (x, y, yN) => sparkle(mixc(C.gold, C.white, yN)) }), explode: 'shards', accent: '#f2c94c', tiltX: 0 },
  { shape: shapeCoin, explode: 'dust', accent: '#f2c94c', tiltX: 0.35 },
  { shape: shapeTorus, explode: 'rings', accent: '#7ce8dc', tiltX: 0.6 },
];
const shapes = STEPS.map((s) => fitN(s.shape()));

/* --------------------------------------------------------------- scene */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 0);
const DPR = Math.min(devicePixelRatio || 1, 2);
renderer.setPixelRatio(DPR);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, 5.2);
const group = new THREE.Group();
group.position.y = 0.35;
scene.add(group);

const uniforms = {
  uProgress: { value: 0 }, uHold: { value: 0 }, uTime: { value: 0 }, uScale: { value: 1 }, uOpacity: { value: 0 },
};
const vert = /* glsl */ `
  uniform float uProgress, uHold, uTime, uScale, uOpacity;
  attribute vec3 aPosB, aColA, aColB, aCenter, aAxis, aVel;
  attribute float aSpin, aDelay, aSize, aSeed;
  varying vec3 vColor;
  varying float vAlpha;
  vec3 rot(vec3 v, vec3 a, float ang) { float c = cos(ang), s = sin(ang); return v * c + cross(a, v) * s + a * dot(a, v) * (1.0 - c); }
  void main() {
    float spread = 0.45;
    float t = clamp(uProgress * (1.0 + spread) - aDelay * spread, 0.0, 1.0);
    float m = smoothstep(0.3, 0.85, t);          // A → B 的基础插值
    vec3 base = mix(position, aPosB, m);
    float e = sin(t * 3.14159265);               // 炸开强度：0 → 1 → 0
    vec3 local = position - aCenter;
    vec3 turb = vec3(sin(uTime * 1.3 + aSeed * 6.28), cos(uTime * 1.1 + aSeed * 3.1), sin(uTime * 0.9 + aSeed * 9.4));
    vec3 off = (rot(local, aAxis, aSpin * t) - local) + aVel * t * 1.4 + turb * 0.12;
    // 长按：用同一套碎片参数小幅打散
    vec3 hold = (rot(local, aAxis, aSpin * 0.3 * uHold) - local) + aVel * 0.45 * uHold + turb * 0.05 * uHold;
    vec3 p = base + off * e + hold;
    p += 0.004 * vec3(sin(uTime * 0.7 + aSeed * 20.0), cos(uTime * 0.6 + aSeed * 13.0), 0.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSize * uScale * (1.0 + 0.7 * e + 0.4 * uHold) / -mv.z;
    gl_Position = projectionMatrix * mv;
    vColor = mix(aColA, aColB, m);
    vAlpha = uOpacity * (1.0 - 0.35 * e - 0.2 * uHold);
  }
`;
const frag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.1, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

const geo = new THREE.BufferGeometry();
const A = {
  pos: new Float32Array(shapes[0].pos), posB: new Float32Array(shapes[0].pos),
  colA: new Float32Array(shapes[0].col), colB: new Float32Array(shapes[0].col),
  center: new Float32Array(N * 3), axis: new Float32Array(N * 3), vel: new Float32Array(N * 3),
  spin: new Float32Array(N), delay: new Float32Array(N), size: new Float32Array(N), seed: new Float32Array(N),
};
for (let i = 0; i < N; i++) { A.size[i] = rand(0.45, 1.15) * 0.011; A.seed[i] = Math.random(); }
geo.setAttribute('position', new THREE.BufferAttribute(A.pos, 3));
geo.setAttribute('aPosB', new THREE.BufferAttribute(A.posB, 3));
geo.setAttribute('aColA', new THREE.BufferAttribute(A.colA, 3));
geo.setAttribute('aColB', new THREE.BufferAttribute(A.colB, 3));
geo.setAttribute('aCenter', new THREE.BufferAttribute(A.center, 3));
geo.setAttribute('aAxis', new THREE.BufferAttribute(A.axis, 3));
geo.setAttribute('aVel', new THREE.BufferAttribute(A.vel, 3));
geo.setAttribute('aSpin', new THREE.BufferAttribute(A.spin, 1));
geo.setAttribute('aDelay', new THREE.BufferAttribute(A.delay, 1));
geo.setAttribute('aSize', new THREE.BufferAttribute(A.size, 1));
geo.setAttribute('aSeed', new THREE.BufferAttribute(A.seed, 1));
const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false });
const points = new THREE.Points(geo, mat);
points.frustumCulled = false;
group.add(points);

/* ------------------------------------------- 三种炸开方式：写入碎片属性 */
function randUnit() {
  const v = new THREE.Vector3(gauss(), gauss(), gauss());
  return v.lengthSq() < 1e-6 ? v.set(0, 1, 0) : v.normalize();
}
function prepareExplode(mode) {
  const P = A.pos;
  const setCluster = (i, cx, cy, cz, ax, ay, az, vx, vy, vz, spin, delay) => {
    A.center[i * 3] = cx; A.center[i * 3 + 1] = cy; A.center[i * 3 + 2] = cz;
    A.axis[i * 3] = ax; A.axis[i * 3 + 1] = ay; A.axis[i * 3 + 2] = az;
    A.vel[i * 3] = vx; A.vel[i * 3 + 1] = vy; A.vel[i * 3 + 2] = vz;
    A.spin[i] = spin; A.delay[i] = delay;
  };

  if (mode === 'shards') {
    // 用一组随机正交基把空间切成「薄片」，每片作为刚体各自翻滚飞散
    const n1 = randUnit(), n2 = new THREE.Vector3().crossVectors(n1, randUnit()).normalize(), n3 = new THREE.Vector3().crossVectors(n1, n2);
    const S = [0.42, 0.42, 0.09];
    const clusters = new Map();
    const key = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const a = Math.floor((x * n1.x + y * n1.y + z * n1.z) / S[0]);
      const b = Math.floor((x * n2.x + y * n2.y + z * n2.z) / S[1]);
      const c = Math.floor((x * n3.x + y * n3.y + z * n3.z) / S[2]);
      const k = ((a + 512) << 20) | ((b + 512) << 10) | (c + 512);
      key[i] = k;
      let cl = clusters.get(k);
      if (!cl) { cl = { sx: 0, sy: 0, sz: 0, n: 0 }; clusters.set(k, cl); }
      cl.sx += x; cl.sy += y; cl.sz += z; cl.n++;
    }
    for (const cl of clusters.values()) {
      cl.cx = cl.sx / cl.n; cl.cy = cl.sy / cl.n; cl.cz = cl.sz / cl.n;
      const ax = randUnit(); cl.ax = ax.x; cl.ay = ax.y; cl.az = ax.z;
      cl.spin = rand(2, 5) * (Math.random() < 0.5 ? -1 : 1);
      const out = new THREE.Vector3(cl.cx, cl.cy, cl.cz).normalize().multiplyScalar(rand(0.5, 1.4));
      cl.vx = out.x + gauss() * 0.35; cl.vy = out.y + gauss() * 0.35 + 0.15; cl.vz = out.z + gauss() * 0.35;
      cl.delay = Math.random();
    }
    for (let i = 0; i < N; i++) {
      const cl = clusters.get(key[i]);
      setCluster(i, cl.cx, cl.cy, cl.cz, cl.ax, cl.ay, cl.az, cl.vx + gauss() * 0.04, cl.vy + gauss() * 0.04, cl.vz + gauss() * 0.04, cl.spin, cl.delay);
    }
  } else if (mode === 'dust') {
    // 每个粒子独立：向外随机飘散，偏上
    for (let i = 0; i < N; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const v = new THREE.Vector3(x + gauss() * 0.4, y + gauss() * 0.4, z + gauss() * 0.4).normalize().multiplyScalar(rand(0.4, 2.0));
      setCluster(i, x, y, z, 0, 1, 0, v.x, v.y + rand(0, 0.7), v.z, 0, Math.random());
    }
  } else {
    // rings：按高度切成一层层「环」，各层绕 Y 轴反向旋转并上下拉开（参考视频里的塔）
    let yMin = Infinity, yMax = -Infinity;
    for (let i = 0; i < N; i++) { const y = P[i * 3 + 1]; if (y < yMin) yMin = y; if (y > yMax) yMax = y; }
    const H = 0.1, layers = Math.ceil((yMax - yMin) / H) + 1;
    const spin = new Float32Array(layers), lift = new Float32Array(layers);
    for (let l = 0; l < layers; l++) { spin[l] = rand(1.5, 3.5) * (l % 2 ? 1 : -1); lift[l] = (l / layers - 0.5) * 1.6 + gauss() * 0.15; }
    for (let i = 0; i < N; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const l = Math.floor((y - yMin) / H);
      const r = Math.hypot(x, z) || 1;
      const rad = rand(0.1, 0.5);
      setCluster(i, 0, yMin + (l + 0.5) * H, 0, 0, 1, 0, (x / r) * rad, lift[l], (z / r) * rad, spin[l], l / layers);
    }
  }
  for (const k of ['aCenter', 'aAxis', 'aVel', 'aSpin', 'aDelay']) geo.attributes[k].needsUpdate = true;
}

/* ------------------------------------------------------------------- UI */
const slidesEl = document.getElementById('slides');
const segEl = document.getElementById('seg');
const hintEl = document.getElementById('hint');
const toastEl = document.getElementById('toast');

const SLIDES = [
  `<div class="eyebrow">NOVA · ANNUAL REPORT</div>
   <div class="title">${USER.year} 年度账单</div>
   <div class="sub">@${USER.nickname} · UID ${USER.uid}</div>`,
  `<div class="eyebrow">01 / 初遇</div>
   <div class="big">${USER.registerDate}</div>
   <div class="label">这一天，你加入了我们</div>
   <div class="sub">至今同行 ${USER.daysWithUs} 天 · 比 ${USER.earlierThanPct}% 的用户更早</div>`,
  `<div class="eyebrow">02 / 第一笔</div>
   <div class="big">${USER.firstTrade.pair}</div>
   <div class="label">${USER.firstTrade.date} ${USER.firstTrade.time} · ${USER.firstTrade.side} ${USER.firstTrade.amount}</div>
   <div class="sub">成交价 ${USER.firstTrade.price} USDT<br>现在回头看，这是个不错的开始</div>`,
  `<div class="eyebrow">03 / 交易额</div>
   <div class="big"><span data-count="${USER.totalVolumeUSD}" data-prefix="$">$0</span></div>
   <div class="label">全年累计成交额</div>
   <div class="sub">${USER.tradeCount} 笔 · 活跃 ${USER.activeDays} 天 · 超过 ${100 - USER.rankTopPct}% 的用户</div>`,
  `<div class="eyebrow">04 / 最爱</div>
   <div class="big">${USER.favoriteCoin}<small>${USER.favoriteCoinPct}%</small></div>
   <div class="label">近一半的交易都给了它</div>
   <div class="bars">${USER.topCoins.map(([n, p]) => `<div class="bar"><b>${n}</b><i style="--w:${p}%"></i><em>${p}%</em></div>`).join('')}</div>`,
  `<div class="card">
     <div class="eyebrow">${USER.year} · 年度账单</div>
     <div class="title">谢谢你的 ${USER.year}<br>${USER.year + 1}，再来一圈</div>
     <div class="rows">
       <div class="row">同行天数<b>${USER.daysWithUs}</b></div>
       <div class="row">累计成交<b>$${USER.totalVolumeShort}</b></div>
       <div class="row">最爱币种<b>${USER.favoriteCoin}</b></div>
       <div class="row">最晚一单<b>${USER.latestNight}</b></div>
     </div>
     <div class="actions">
       <button class="btn" id="btnReplay">再看一遍</button>
       <button class="btn primary" id="btnShare">生成海报</button>
     </div>
   </div>`,
];
const slideEls = SLIDES.map((html, i) => {
  const el = document.createElement('article');
  el.className = 'slide' + (i === 0 ? ' is-top' : '');
  el.innerHTML = html; slidesEl.appendChild(el); return el;
});
SLIDES.forEach(() => segEl.appendChild(document.createElement('i')));

let current = -1;
function hideSlide() {
  if (current < 0) return;
  const el = slideEls[current];
  el.classList.remove('is-active'); el.classList.add('is-leaving');
  setTimeout(() => el.classList.remove('is-leaving'), 450);
  current = -1;
}
function showSlide(i) {
  hideSlide();
  current = i;
  slideEls[i].classList.add('is-active');
  document.documentElement.style.setProperty('--accent', STEPS[i].accent);
  [...segEl.children].forEach((d, k) => { d.classList.toggle('on', k === i); d.classList.toggle('done', k < i); });
  slideEls[i].querySelectorAll('[data-count]').forEach((n) => {
    const to = +n.dataset.count, prefix = n.dataset.prefix || '';
    tween(0, to, 1800, easeOutCubic, (v) => { n.textContent = prefix + formatMoney(Math.round(v)); });
  });
}
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); setTimeout(() => toastEl.classList.remove('show'), 1800); }
function setHint(show) { hintEl.classList.toggle('hide', !show); }

/* ------------------------------------------------------------- 状态机 */
let step = 0, busy = true;
const rot = { x: 0, y: 0, tx: 0, vy: 0 };

async function intro() {
  prepareExplode(STEPS[0].explode);
  // 开场：从尘埃聚合成 2026
  const save = new Float32Array(A.pos);
  for (let i = 0; i < N; i++) { A.pos[i * 3] = gauss() * 2.2; A.pos[i * 3 + 1] = gauss() * 2.2; A.pos[i * 3 + 2] = gauss() * 2.2; }
  geo.attributes.position.needsUpdate = true;
  prepareExplode('dust');
  await wait(300);
  tween(0, 1, 900, easeOutCubic, (v) => { uniforms.uOpacity.value = v; });
  await tween(0, 1, 2400, easeInOutSine, (v) => { uniforms.uProgress.value = v; });
  A.pos.set(save); geo.attributes.position.needsUpdate = true; uniforms.uProgress.value = 0;
  prepareExplode(STEPS[0].explode);
  showSlide(0);
  busy = false; setHint(true);
}

async function goTo(to) {
  busy = true; setHint(false);
  const from = step; step = to;
  // B = 下一形体；碎片参数已按「当前形体」准备好
  A.posB.set(shapes[to].pos); A.colB.set(shapes[to].col);
  geo.attributes.aPosB.needsUpdate = true; geo.attributes.aColB.needsUpdate = true;
  rot.tx = STEPS[to].tiltX;
  hideSlide();
  const p = tween(0, 1, 2600, easeInOutSine, (v) => { uniforms.uProgress.value = v; });
  await wait(1500); showSlide(to);
  await p;
  // 落位：B 变成新的 A
  A.pos.set(A.posB); A.colA.set(A.colB);
  geo.attributes.position.needsUpdate = true; geo.attributes.aColA.needsUpdate = true;
  uniforms.uProgress.value = 0;
  prepareExplode(STEPS[to].explode); // 为下一次炸开（以及长按预览）准备参数
  if (to === STEPS.length - 1) { busy = true; return; } // 结尾停留
  busy = false; setHint(true);
}
const next = () => { if (!busy) goTo(step + 1); };

async function replay() {
  busy = true; setHint(false);
  hideSlide(); step = 0;
  A.posB.set(shapes[0].pos); A.colB.set(shapes[0].col);
  geo.attributes.aPosB.needsUpdate = true; geo.attributes.aColB.needsUpdate = true;
  rot.tx = 0;
  await tween(0, 1, 2600, easeInOutSine, (v) => { uniforms.uProgress.value = v; });
  A.pos.set(A.posB); A.colA.set(A.colB);
  geo.attributes.position.needsUpdate = true; geo.attributes.aColA.needsUpdate = true;
  uniforms.uProgress.value = 0;
  prepareExplode(STEPS[0].explode);
  showSlide(0); busy = false; setHint(true);
}
document.getElementById('btnReplay').addEventListener('click', (e) => { e.stopPropagation(); replay(); });
document.getElementById('btnShare').addEventListener('click', (e) => { e.stopPropagation(); toast('MVP：这里接海报生成 / 分享'); });

/* -------------------------------------------------- 手势：轻触 / 长按 / 拖拽 */
const ptr = { down: false, x: 0, y: 0, moved: 0, t0: 0, holdTimer: 0, holding: false };
function startHold() { if (busy) return; ptr.holding = true; tween(uniforms.uHold.value, 1, 700, easeOutCubic, (v) => { uniforms.uHold.value = v; }); }
function endHold() { if (!ptr.holding) return; ptr.holding = false; tween(uniforms.uHold.value, 0, 1100, easeOutCubic, (v) => { uniforms.uHold.value = v; }); }

window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.btn')) return;
  ptr.down = true; ptr.x = e.clientX; ptr.y = e.clientY; ptr.moved = 0; ptr.t0 = performance.now(); rot.vy = 0;
  clearTimeout(ptr.holdTimer); ptr.holdTimer = setTimeout(startHold, 260);
});
window.addEventListener('pointermove', (e) => {
  if (!ptr.down) return;
  const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
  ptr.moved += Math.abs(dx) + Math.abs(dy);
  if (ptr.moved > 10) { clearTimeout(ptr.holdTimer); }
  rot.y += dx * 0.006; rot.vy = dx * 0.0025;
  rot.tx = clamp(rot.tx + dy * 0.003, -0.6, 0.9);
  ptr.x = e.clientX; ptr.y = e.clientY;
});
const release = () => {
  if (!ptr.down) return;
  ptr.down = false; clearTimeout(ptr.holdTimer);
  const wasHolding = ptr.holding; endHold();
  if (!wasHolding && ptr.moved < 10 && performance.now() - ptr.t0 < 400) next();
};
window.addEventListener('pointerup', release);
window.addEventListener('pointercancel', release);

/* ---------------------------------------------------------------- loop */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  uniforms.uScale.value = (h * DPR) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  // 窄屏下把形体整体缩小，保证最宽的文字形体也能放下
  const halfW = camera.position.z * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
  group.scale.setScalar(clamp(halfW / 1.42, 0.62, 1.05));
}
addEventListener('resize', resize);
resize();

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  updateTweens(now);
  uniforms.uTime.value = now / 1000;
  if (!ptr.down) { rot.y += dt * 0.16 + rot.vy; rot.vy *= Math.pow(0.02, dt); }
  rot.x = lerp(rot.x, rot.tx, 1 - Math.exp(-dt * 3));
  group.rotation.set(rot.x, rot.y, 0);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
intro();
