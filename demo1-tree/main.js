// demo1 · 「生长」—— 参考 demo1.mp4
// 一颗光球沿细线降下，一棵点云树从中轴线「展开」；每次轻触，树会溶解 → 重聚 并切换色调与镜头；
// 最后树折回中轴线，光球升起，落到结尾卡片。

import * as THREE from 'three';
import { USER, formatMoney } from '../shared/data.js';

/* ------------------------------------------------------------------ utils */
const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || innerWidth < 600;
const Q = isMobile ? 0.55 : 1; // 粒子预算系数
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; // 近似正态 [-1,1]
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);

// 极简 tween
const tweens = [];
function tween(from, to, dur, ease, onUpdate) {
  return new Promise((resolve) => {
    tweens.push({ t0: performance.now(), from, to, dur, ease, onUpdate, resolve });
  });
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

/* ------------------------------------------------------------- renderer */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 1);
const DPR = Math.min(devicePixelRatio || 1, 2);
renderer.setPixelRatio(DPR);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

/* ------------------------------------------------------------ build tree */
function buildTree() {
  const P = [], C = [], K = [], S = [], SEED = [], DELAY = [];
  const col = new THREE.Color();
  const tmp = new THREE.Vector3(), dir = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3();

  const push = (x, y, z, c, kind, size) => {
    P.push(x, y, z); C.push(c.r, c.g, c.b); K.push(kind); S.push(size * 0.01);
    SEED.push(Math.random()); DELAY.push(Math.random());
  };
  // 霜蓝色的叶 / 棕色的干 / 沙金色的地
  const foliageColor = () => {
    const l = Math.random() < 0.1 ? rand(0.86, 1) : rand(0.4, 0.8);
    return col.setHSL(rand(0.58, 0.64), rand(0.25, 0.55), l).clone();
  };
  const barkColor = () => col.setHSL(rand(0.06, 0.09), rand(0.4, 0.6), rand(0.16, 0.3)).clone();
  const groundColor = () => {
    const l = Math.random() < 0.08 ? rand(0.85, 0.95) : rand(0.42, 0.72);
    return col.setHSL(rand(0.09, 0.13), rand(0.3, 0.5), l).clone();
  };

  function segment(a, b, radius, kind) {
    const len = a.distanceTo(b);
    const density = kind === 1 ? 9000 : 16000;
    const n = Math.max(3, Math.floor(len * radius * density * Q));
    dir.subVectors(b, a).normalize();
    u.crossVectors(dir, Math.abs(dir.y) < 0.9 ? UP : RIGHT).normalize();
    v.crossVectors(dir, u);
    for (let i = 0; i < n; i++) {
      const t = Math.random();
      tmp.lerpVectors(a, b, t);
      const ang = rand(0, Math.PI * 2), r = radius * (kind === 1 ? rand(0.6, 2.4) : Math.sqrt(Math.random()));
      tmp.addScaledVector(u, Math.cos(ang) * r).addScaledVector(v, Math.sin(ang) * r);
      push(tmp.x, tmp.y, tmp.z, kind === 1 ? foliageColor() : barkColor(), kind, kind === 1 ? rand(0.4, 0.9) : rand(0.5, 0.95));
    }
  }

  function foliage(center, d, size) {
    const n = Math.floor(rand(70, 130) * Q);
    for (let i = 0; i < n; i++) {
      tmp.set(gauss() * size * 0.45, gauss() * size * 0.45, gauss() * size * 0.45)
        .addScaledVector(d, (Math.random() - 0.2) * size * 0.8)
        .add(center);
      push(tmp.x, tmp.y, tmp.z, foliageColor(), 1, rand(0.35, 1.0));
    }
  }

  const MAX_DEPTH = 5;
  function branch(pos, d, len, radius, depth) {
    const end = pos.clone().addScaledVector(d, len);
    segment(pos, end, radius, depth >= 3 ? 1 : 0);
    if (depth >= MAX_DEPTH) { foliage(end, d, len * 1.1); return; }
    const kids = depth === 0 ? 3 : depth === 1 ? 2 + Math.floor(rand(0, 2.6)) : Math.random() < 0.65 ? 2 : 3;
    for (let i = 0; i < kids; i++) {
      const axis = new THREE.Vector3().crossVectors(d, new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1))).normalize();
      const nd = d.clone().applyAxisAngle(axis, rand(0.35, 0.8));
      nd.y += 0.3; nd.normalize();
      const start = pos.clone().lerp(end, rand(0.55, 1));
      branch(start, nd, len * rand(0.6, 0.76), radius * 0.64, depth + 1);
    }
  }

  // 三根主干从地面长出，微微外倾（参考视频里是一丛多干的树）
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rand(-0.3, 0.3);
    const base = new THREE.Vector3(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05);
    const d = new THREE.Vector3(Math.cos(a) * 0.26, 1, Math.sin(a) * 0.26).normalize();
    branch(base, d, rand(0.7, 0.85), 0.024, 0);
  }

  // 地面：不规则的岩板，边缘厚、中间薄
  const gn = Math.floor(11000 * Q);
  for (let i = 0; i < gn; i++) {
    const ang = rand(0, Math.PI * 2), rr = Math.sqrt(Math.random());
    const edge = 1 + 0.16 * Math.sin(ang * 3 + 1.2) + 0.1 * Math.sin(ang * 7 + 0.4);
    const r = rr * edge;
    const x = Math.cos(ang) * r * 1.1, z = Math.sin(ang) * r * 0.6;
    const y = -Math.pow(Math.random(), 2.2) * 0.1 - (rr > 0.86 ? Math.random() * 0.14 : 0);
    push(x, y, z, groundColor(), 2, rand(0.45, 1.05));
  }

  let treeH = 0;
  for (let i = 1; i < P.length; i += 3) treeH = Math.max(treeH, P[i]);

  return {
    count: K.length,
    pos: new Float32Array(P), col: new Float32Array(C), kind: new Float32Array(K),
    size: new Float32Array(S), seed: new Float32Array(SEED), delay: new Float32Array(DELAY),
    treeH,
  };
}

const tree = buildTree();

/* ------------------------------------------------------------- material */
const uniforms = {
  uUnfold: { value: 0 },
  uDissolve: { value: 0 },
  uTime: { value: 0 },
  uScale: { value: 1 },
  uOpacity: { value: 1 },
  uTreeH: { value: tree.treeH },
  uTint: { value: new THREE.Color(1, 1, 1) },
  uTintAmt: { value: 0 },
};

const vert = /* glsl */ `
  uniform float uUnfold, uDissolve, uTime, uScale, uOpacity, uTreeH, uTintAmt;
  uniform vec3 uTint;
  attribute vec3 aColor;
  attribute float aKind, aSize, aSeed, aDelay;
  varying vec3 vColor;
  varying float vAlpha;
  float easeOut(float t) { return 1.0 - pow(1.0 - t, 3.0); }
  void main() {
    vec3 P = position;
    float yN = clamp(P.y / uTreeH, 0.0, 1.0);
    float t = clamp(uUnfold * 1.3 - aDelay * 0.3, 0.0, 1.0);
    float sy = easeOut(clamp(t * 1.5, 0.0, 1.0));
    float so = easeOut(clamp((t - 0.2) / 0.8, 0.0, 1.0));
    float rf = so * mix(yN, 1.0, so);           // 先竖起来，再由上到下扇开（锥形 → 全展）
    vec3 p;
    if (aKind > 1.5) {                          // 地面最后从中心铺开
      float g = easeOut(clamp((t - 0.55) / 0.45, 0.0, 1.0));
      p = P * g;
    } else {
      p = vec3(P.x * rf, P.y * sy, P.z * rf);
    }
    // 溶解：粒子随机散开、变大、变淡
    vec3 n = vec3(sin(uTime * 1.7 + aSeed * 61.0), cos(uTime * 1.3 + aSeed * 37.0), sin(uTime * 1.1 + aSeed * 91.0));
    p += n * uDissolve * 0.3 * (0.4 + aSeed * 0.6);
    // 叶子微微摇曳
    if (aKind > 0.5 && aKind < 1.5) p.x += sin(uTime * 0.8 + P.y * 2.0 + aSeed * 6.28) * 0.006 * yN;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float size = aSize * (1.0 + 2.4 * uDissolve);
    gl_PointSize = size * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;

    float lum = dot(aColor, vec3(0.299, 0.587, 0.114));
    vColor = mix(aColor, uTint * lum * 1.25, uTintAmt);
    vAlpha = uOpacity * (1.0 - 0.7 * uDissolve) * smoothstep(0.0, 0.06, t);
  }
`;
const frag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.12, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(tree.pos, 3));
geo.setAttribute('aColor', new THREE.BufferAttribute(tree.col, 3));
geo.setAttribute('aKind', new THREE.BufferAttribute(tree.kind, 1));
geo.setAttribute('aSize', new THREE.BufferAttribute(tree.size, 1));
geo.setAttribute('aSeed', new THREE.BufferAttribute(tree.seed, 1));
geo.setAttribute('aDelay', new THREE.BufferAttribute(tree.delay, 1));
const mat = new THREE.ShaderMaterial({
  uniforms, vertexShader: vert, fragmentShader: frag,
  transparent: true, depthWrite: false, blending: THREE.NormalBlending,
});
const points = new THREE.Points(geo, mat);
points.frustumCulled = false;
scene.add(points);

/* ----------------------------------------------- 光球 + 细线 + 悬丝 */
const sphereGroup = new THREE.Group();
scene.add(sphereGroup);
const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 24), new THREE.MeshBasicMaterial({ color: 0xffffff }));
sphereGroup.add(bulb);

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.2, 'rgba(220,232,255,0.45)');
  grd.addColorStop(0.55, 'rgba(180,200,255,0.10)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
glow.scale.setScalar(0.7);
sphereGroup.add(glow);

// 垂线：用一条始终朝向相机的细长面片，而不是 GL 线（GL 线只有 1 物理像素，高分屏上几乎看不见）
const DROP_TOP = 12;
const dropLine = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ color: 0xd6dfee, transparent: true, opacity: 0.6, depthWrite: false }),
);
scene.add(dropLine);

// 悬丝：从光球到树冠上部若干粒子
const WIRES = 9;
const wireIdx = [];
{
  const cand = [];
  for (let i = 0; i < tree.count; i++) {
    if (tree.kind[i] === 1 && tree.pos[i * 3 + 1] > tree.treeH * 0.62) cand.push(i);
  }
  for (let k = 0; k < WIRES && cand.length; k++) {
    wireIdx.push(cand.splice(Math.floor(Math.random() * cand.length), 1)[0]);
  }
}
const wireGeo = new THREE.BufferGeometry();
wireGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WIRES * 2 * 3), 3));
const wireMat = new THREE.LineBasicMaterial({ color: 0xc9d4e6, transparent: true, opacity: 0 });
const wires = new THREE.LineSegments(wireGeo, wireMat);
wires.frustumCulled = false;
scene.add(wires);

const _p = new THREE.Vector3();
function unfoldPos(i, out) { // 与 shader 里的展开公式保持一致（干/叶）
  const P = tree.pos, x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
  const t = clamp(uniforms.uUnfold.value * 1.3 - tree.delay[i] * 0.3, 0, 1);
  const sy = easeOutCubic(clamp(t * 1.5, 0, 1));
  const so = easeOutCubic(clamp((t - 0.2) / 0.8, 0, 1));
  const yN = clamp(y / tree.treeH, 0, 1);
  const rf = so * lerp(yN, 1, so);
  return out.set(x * rf, y * sy, z * rf);
}
function updateWires() {
  const arr = wireGeo.attributes.position.array;
  const s = sphereGroup.position;
  for (let k = 0; k < WIRES; k++) {
    unfoldPos(wireIdx[k], _p);
    arr[k * 6] = s.x; arr[k * 6 + 1] = s.y; arr[k * 6 + 2] = s.z;
    arr[k * 6 + 3] = _p.x; arr[k * 6 + 4] = _p.y; arr[k * 6 + 5] = _p.z;
  }
  wireGeo.attributes.position.needsUpdate = true;
  wireMat.opacity = 0.32 * smoothstep(0.15, 0.6, uniforms.uUnfold.value);
  const len = DROP_TOP - s.y;
  dropLine.position.set(0, s.y + len / 2, 0);
  dropLine.scale.set(0.0017 * cam.r, len, 1);
  dropLine.rotation.y = cam.theta;
}

/* -------------------------------------------------------------- camera */
const SPHERE_REST = tree.treeH + 0.22;
const SPHERE_END = SPHERE_REST + 0.9;
sphereGroup.position.set(0, 6, 0);

// 镜头：r 距离 · elev 仰角 · ty 注视高度。窄屏会自动拉远，并把画面重心上移，给底部文案留位置。
const cam = { r: 5.2, elev: 0.05, ty: 2.2, theta: 0.4 };       // 当前
const camTarget = { r: 5.2, elev: 0.05, ty: 2.2 };              // 目标
const SHOTS = [
  { r: 5.2, elev: 0.05, ty: 2.2 },   // 0 intro：只看光球
  { r: 5.0, elev: 0.12, ty: 1.0 },   // 1 加入：整棵树
  { r: 4.2, elev: 0.0, ty: 0.7 },    // 2 第一笔：贴近树干
  { r: 5.2, elev: 0.36, ty: 0.95 },  // 3 交易额：俯视树冠
  { r: 4.5, elev: 0.16, ty: 1.15 },  // 4 最爱
  { r: 5.6, elev: 0.06, ty: 2.0 },   // 5 结尾：光球悬在卡片上方
];
const drag = { on: false, x: 0, y: 0, vx: 0, moved: 0, t0: 0 };

function updateCamera(dt) {
  const k = 1 - Math.exp(-dt * 2.2);
  cam.r = lerp(cam.r, camTarget.r, k);
  cam.elev = lerp(cam.elev, camTarget.elev, k);
  cam.ty = lerp(cam.ty, camTarget.ty, k);
  if (!drag.on) { cam.theta += dt * 0.11 + drag.vx; drag.vx *= Math.pow(0.02, dt); }
  const fit = clamp(0.62 / camera.aspect, 1, 1.45);
  const R = cam.r * fit;
  const shift = 0.3 * R * Math.tan((camera.fov * Math.PI) / 360); // 注视点下移 → 树在画面上半部
  const ty = cam.ty - shift;
  const ce = Math.cos(cam.elev), se = Math.sin(cam.elev);
  camera.position.set(Math.sin(cam.theta) * R * ce, ty + R * se, Math.cos(cam.theta) * R * ce);
  camera.lookAt(0, ty, 0);
}

/* ------------------------------------------------------------------- UI */
const slidesEl = document.getElementById('slides');
const dotsEl = document.getElementById('dots');
const hintEl = document.getElementById('hint');
const toastEl = document.getElementById('toast');

const SLIDES = [
  `<div class="eyebrow">ANNUAL REPORT · ${USER.year}</div>
   <div class="title">你的 ${USER.year}<br>是一棵树生长的一年</div>
   <div class="sub">@${USER.nickname} · 轻触，点亮它</div>`,
  `<div class="eyebrow">01 · 种下</div>
   <div class="big">${USER.registerDate.slice(5)}<small>${USER.year}</small></div>
   <div class="label">这一天，你加入了 NOVA</div>
   <div class="sub">至今同行 ${USER.daysWithUs} 天 · 比 ${USER.earlierThanPct}% 的用户更早</div>`,
  `<div class="eyebrow">02 · 发芽</div>
   <div class="big">${USER.firstTrade.pair}</div>
   <div class="label">第一笔交易 · ${USER.firstTrade.date} ${USER.firstTrade.time}</div>
   <div class="sub">${USER.firstTrade.side} ${USER.firstTrade.amount} @ ${USER.firstTrade.price} USDT<br>回头看，这是一个不错的开始</div>`,
  `<div class="eyebrow">03 · 生长</div>
   <div class="big"><span data-count="${USER.totalVolumeUSD}" data-prefix="$">$0</span></div>
   <div class="label">全年累计成交额</div>
   <div class="sub">${USER.tradeCount} 笔交易 · 活跃 ${USER.activeDays} 天<br>超过 ${100 - USER.rankTopPct}% 的用户</div>`,
  `<div class="eyebrow">04 · 枝叶</div>
   <div class="big">${USER.favoriteCoin}<small>${USER.favoriteCoinPct}%</small></div>
   <div class="label">你最偏爱的币种</div>
   <div class="bars">${USER.topCoins.map(([n, p]) => `<div class="bar"><b>${n}</b><i style="--w:${p}%"></i><em>${p}%</em></div>`).join('')}</div>`,
  `<div class="card">
     <div class="eyebrow">${USER.year} · 年度账单</div>
     <div class="title">谢谢你的 ${USER.year}<br>${USER.year + 1}，继续生长</div>
     <div class="rows">
       <div class="row">同行天数<b>${USER.daysWithUs}</b></div>
       <div class="row">累计成交<b>$${USER.totalVolumeShort}</b></div>
       <div class="row">最爱币种<b>${USER.favoriteCoin}</b></div>
       <div class="row">年度关键词<b>${USER.keyword}</b></div>
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
  el.innerHTML = html;
  slidesEl.appendChild(el);
  return el;
});
SLIDES.forEach(() => { const d = document.createElement('i'); dotsEl.appendChild(d); });

let current = -1;
function showSlide(i) {
  if (current >= 0) {
    const prev = slideEls[current];
    prev.classList.remove('is-active'); prev.classList.add('is-leaving');
    setTimeout(() => prev.classList.remove('is-leaving'), 500);
  }
  current = i;
  const el = slideEls[i];
  el.classList.add('is-active');
  [...dotsEl.children].forEach((d, k) => d.classList.toggle('on', k === i));
  el.querySelectorAll('[data-count]').forEach((n) => {
    const to = +n.dataset.count, prefix = n.dataset.prefix || '';
    tween(0, to, 1800, easeOutCubic, (v) => { n.textContent = prefix + formatMoney(Math.round(v)); });
  });
}
function toast(msg) {
  toastEl.textContent = msg; toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 1800);
}

/* -------------------------------------------------------------- 故事线 */
const TINTS = [
  [1, 1, 1, 0],
  [1, 1, 1, 0],
  [1.0, 0.84, 0.58, 0.4],   // 02 暖金
  [0.62, 0.92, 1.0, 0.45],  // 03 青蓝
  [0.95, 0.72, 1.0, 0.4],   // 04 淡紫
  [1, 1, 1, 0],
];
let step = 0;       // 当前故事步
let busy = true;    // 动画进行中，忽略点击

function setShot(i) { Object.assign(camTarget, SHOTS[i]); }
async function setTint(i) {
  const [r, g, b, amt] = TINTS[i];
  const from = uniforms.uTint.value.clone(), to = new THREE.Color(r, g, b), a0 = uniforms.uTintAmt.value;
  await tween(0, 1, 900, easeInOutCubic, (k) => {
    uniforms.uTint.value.copy(from).lerp(to, k);
    uniforms.uTintAmt.value = lerp(a0, amt, k);
  });
}
function setHint(show) { hintEl.classList.toggle('hide', !show); }

async function intro() {
  await wait(500);
  await tween(6, SPHERE_REST, 1700, easeOutCubic, (v) => { sphereGroup.position.y = v; });
  showSlide(0);
  busy = false; setHint(true);
}

async function next() {
  if (busy) return;
  busy = true; setHint(false);
  const from = step, to = step + 1;
  step = to;

  if (to === 1) {
    // 展开
    setShot(1);
    const p = tween(0, 1, 2600, easeInOutCubic, (v) => { uniforms.uUnfold.value = v; });
    await wait(1100); showSlide(1);
    await p;
  } else if (to <= 4) {
    // 溶解 → 重聚，同时换色调、换镜头
    setShot(to);
    await tween(0, 1, 620, easeInCubic, (v) => { uniforms.uDissolve.value = v; });
    setTint(to); showSlide(to);
    await tween(1, 0, 1100, easeOutCubic, (v) => { uniforms.uDissolve.value = v; });
  } else if (to === 5) {
    // 折回中轴线，光球升起
    setShot(5); setTint(5);
    await tween(1, 0, 2000, easeInOutCubic, (v) => { uniforms.uUnfold.value = v; });
    const p = tween(SPHERE_REST, SPHERE_END, 1600, easeInOutCubic, (v) => { sphereGroup.position.y = v; });
    await wait(600); showSlide(5);
    await p;
    busy = true; // 结尾停留
    return;
  }
  busy = false; setHint(true);
}

async function replay() {
  busy = true; setHint(false);
  slideEls[current].classList.remove('is-active');
  current = -1; step = 0;
  uniforms.uUnfold.value = 0; uniforms.uDissolve.value = 0; uniforms.uTintAmt.value = 0;
  setShot(0);
  sphereGroup.position.y = 6;
  await intro();
}

document.getElementById('btnReplay').addEventListener('click', (e) => { e.stopPropagation(); replay(); });
document.getElementById('btnShare').addEventListener('click', (e) => { e.stopPropagation(); toast('MVP：这里接海报生成 / 分享'); });

/* --------------------------------------------------------- 手势：拖拽 / 轻触 */
window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.btn')) return;
  drag.on = true; drag.x = e.clientX; drag.y = e.clientY; drag.moved = 0; drag.t0 = performance.now(); drag.vx = 0;
});
window.addEventListener('pointermove', (e) => {
  if (!drag.on) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  cam.theta += dx * 0.006; drag.vx = dx * 0.0025;
  camTarget.elev = clamp(camTarget.elev - dy * 0.003, -0.15, 0.9);
  drag.x = e.clientX; drag.y = e.clientY;
});
window.addEventListener('pointerup', () => {
  if (!drag.on) return;
  drag.on = false;
  if (drag.moved < 10 && performance.now() - drag.t0 < 450) next();
});
window.addEventListener('pointercancel', () => { drag.on = false; });

/* ---------------------------------------------------------------- loop */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  uniforms.uScale.value = (h * DPR) / (2 * Math.tan((camera.fov * Math.PI) / 360));
}
addEventListener('resize', resize);
resize();

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  updateTweens(now);
  uniforms.uTime.value = now / 1000;
  glow.material.opacity = 0.75 + 0.2 * Math.sin(now / 900);
  updateCamera(dt);
  updateWires();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
intro();
