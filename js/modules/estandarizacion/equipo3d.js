// =====================================================================
// FIGURA 3D DEL EQUIPO (2026-11-18) · three.js desde CDN, sin archivos de modelo
//   · Figura genérica por TIPO (generador, torre de iluminación, compresor, bomba de hormigón,
//     manipulador telescópico, minicargador, camión), pintada verde, sin marca, con el logo FRC.
//   · Los elementos del estándar (baliza, extintor, paradas de emergencia, GPS, huincha reflectante,
//     rótulos, señaléticas, bandeja, termoseal) se dibujan sobre el equipo según la ÚLTIMA estandarización:
//       Bueno = normal · Malo = rojo parpadeando · N/A = transparente · sin registro = normal.
//   · Arrastrar = girar · rueda / pellizco = acercar · tocar un elemento = lo marca en la lista.
// =====================================================================
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
let threeP = null;
const cargarThree = () => (threeP = threeP || import(THREE_URL));

const VERDE = 0x2f8a4c, VERDE_OSC = 0x1f5f35, OSCURO = 0x27313b, ACERO = 0x9aa4ae, GOMA = 0x16181b, AMARILLO = 0xf2c200, ROJO = 0xd62828, AMBAR = 0xffa31a;

/** Tipo de figura según el tipo del equipo. */
export const figuraDe = (tipo) => {
  const t = String(tipo || '').toUpperCase();
  if (/TIJERA|PLATAFORMA|ELEVADOR|ALZA ?HOMBRE|MANLIFT|SCISSOR/.test(t)) return 'tijera';
  if (/RETRO/.test(t)) return 'retro';
  if (/EXCAVADOR/.test(t)) return 'excavadora';
  if (/TORRE|ILUMIN/.test(t)) return 'torre';
  if (/COMPRESOR/.test(t)) return 'compresor';
  if (/BOMBA|HORMIG/.test(t)) return 'bomba';
  if (/MANIPULADOR|TELESC|TELEHANDLER/.test(t)) return 'manipulador';
  if (/MINI\s*-?\s*CARG|CARGADOR|BOBCAT|SKID/.test(t)) return 'minicargador';
  if (/CAMION|CAMIONETA|PLUMA/.test(t)) return 'camion';
  return 'generador';
};

export async function montarEquipo3D(host, opciones = {}) {
  const THREE = await cargarThree();
  const { tipo = '', afi = '', logoUrl = 'icons/logo-frc-neon.png', onPick = null } = opciones;
  let estados = opciones.estados || {};

  // ---------- escena ----------
  const W0 = Math.max(260, host.clientWidth || 600), H0 = Math.max(260, host.clientHeight || 420);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W0, H0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;cursor:grab';
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, W0 / H0, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a8f, 1.1));
  const sol = new THREE.DirectionalLight(0xffffff, 2.2);
  sol.position.set(5, 9, 6); sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
  scene.add(sol);
  const relleno = new THREE.DirectionalLight(0xdfe9ff, 0.7); relleno.position.set(-6, 4, -5); scene.add(relleno);
  const piso = new THREE.Mesh(new THREE.CircleGeometry(5.5, 64), new THREE.ShadowMaterial({ opacity: 0.22 }));
  piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; scene.add(piso);
  const anillo = new THREE.Mesh(new THREE.RingGeometry(3.6, 3.66, 96), new THREE.MeshBasicMaterial({ color: 0x2f8a4c, transparent: true, opacity: 0.35 }));
  anillo.rotation.x = -Math.PI / 2; anillo.position.y = 0.002; scene.add(anillo);

  const equipo = new THREE.Group(); scene.add(equipo);

  // ---------- ayudas ----------
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness: 0.25, roughness: 0.5, ...extra });
  const M = { verde: mat(VERDE, { metalness: 0.35, roughness: 0.38 }), verdeOsc: mat(VERDE_OSC), oscuro: mat(OSCURO, { roughness: 0.7 }), acero: mat(ACERO, { metalness: 0.7, roughness: 0.3 }),
    goma: mat(GOMA, { roughness: 0.9, metalness: 0 }), vidrio: mat(0x1d2a33, { metalness: 0.6, roughness: 0.15 }), amarillo: mat(AMARILLO, { roughness: 0.35 }), rojo: mat(ROJO, { roughness: 0.4 }),
    blanco: mat(0xf4f4f0, { roughness: 0.6, metalness: 0 }), luz: mat(0xfff6d8, { emissive: 0xfff1b8, emissiveIntensity: 1.4 }) };
  const sombra = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const caja = (w, h, d, m, x, y, z, padre = equipo) => { const o = sombra(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)); o.position.set(x, y, z); padre.add(o); return o; };
  const cil = (rt, rb, h, m, x, y, z, rot = null, seg = 28, padre = equipo) => { const o = sombra(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m)); o.position.set(x, y, z); if (rot) o.rotation.set(rot[0], rot[1], rot[2]); padre.add(o); return o; };
  const rueda = (x, z, r = 0.33, ancho = 0.24) => {
    const g = new THREE.Group(); g.position.set(x, r, z); equipo.add(g);
    cil(r, r, ancho, M.goma, 0, 0, 0, [Math.PI / 2, 0, 0], 32, g);
    cil(r * 0.55, r * 0.55, ancho + 0.02, M.acero, 0, 0, 0, [Math.PI / 2, 0, 0], 24, g);
    return g;
  };
  const textura = (dibujar, w = 512, h = 256) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); dibujar(ctx, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  };
  const placa = (w, h, tex, x, y, z, rotY = 0) => {
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, transparent: true }));
    o.position.set(x, y, z); o.rotation.y = rotY; equipo.add(o); return o;
  };
  // logo FRC sobre placa oscura (se dibuja cuando carga la imagen)
  const texLogo = textura((ctx, w, h) => { ctx.fillStyle = '#0d1b14'; ctx.beginPath(); ctx.roundRect(4, 4, w - 8, h - 8, 28); ctx.fill(); ctx.fillStyle = '#4ade80'; ctx.font = 'bold 120px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('FRC', w / 2, h / 2); });
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => { const c = texLogo.image, ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); ctx.fillStyle = '#0d1b14'; ctx.beginPath(); ctx.roundRect(4, 4, c.width - 8, c.height - 8, 28); ctx.fill();
    const k = Math.min((c.width - 60) / img.width, (c.height - 40) / img.height); const w = img.width * k, h = img.height * k; ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h); texLogo.needsUpdate = true; };
  img.src = logoUrl;
  const texAfi = textura((ctx, w, h) => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#111'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10); ctx.fillStyle = '#111'; ctx.font = 'bold 120px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`AFI ${afi}`, w / 2, h / 2 + 6); });
  const texRotulo = (titulo) => textura((ctx, w, h) => { ctx.fillStyle = '#fbfbf6'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#1f5f35'; ctx.fillRect(0, 0, w, 64); ctx.fillStyle = '#fff'; ctx.font = 'bold 40px Arial'; ctx.textAlign = 'center'; ctx.fillText(titulo, w / 2, 46); ctx.fillStyle = '#9aa'; for (let i = 0; i < 5; i++) ctx.fillRect(40, 96 + i * 30, w - 80 - (i % 2) * 120, 12); });
  const texSenal = (simbolo) => textura((ctx, w, h) => { ctx.fillStyle = '#f2c200'; ctx.strokeStyle = '#111'; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(w / 2, 14); ctx.lineTo(w - 14, h - 14); ctx.lineTo(14, h - 14); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#111'; ctx.font = 'bold 110px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(simbolo, w / 2, h * 0.62); }, 256, 224);

  // ---------- figuras por tipo: devuelven anclas para los elementos del estándar ----------
  const remolque = (L, W, yChasis, xRueda) => {
    caja(L, 0.14, W - 0.1, M.oscuro, 0, yChasis, 0);
    rueda(xRueda, W / 2 + 0.1); rueda(xRueda, -W / 2 - 0.1);
    caja(0.9, 0.08, 0.08, M.oscuro, L / 2 + 0.45, yChasis - 0.05, 0.18).rotation.y = 0.25;
    caja(0.9, 0.08, 0.08, M.oscuro, L / 2 + 0.45, yChasis - 0.05, -0.18).rotation.y = -0.25;
    cil(0.07, 0.07, 0.12, M.acero, L / 2 + 0.9, yChasis - 0.05, 0, [0, 0, Math.PI / 2]);
    cil(0.03, 0.03, yChasis - 0.1, M.acero, L / 2 + 0.6, (yChasis - 0.1) / 2 + 0.08, 0);
    cil(0.08, 0.08, 0.06, M.goma, L / 2 + 0.6, 0.08, 0, [Math.PI / 2, 0, 0]);
    cil(0.05, 0.05, yChasis - 0.1, M.acero, -L / 2 + 0.15, (yChasis - 0.1) / 2, 0);
  };
  const FIG = {
    generador() {
      const L = 3.2, H = 1.55, Wd = 1.3, y0 = 0.34, top = y0 + H;
      caja(L + 0.25, 0.12, Wd + 0.2, M.oscuro, 0, 0.06, 0);
      const bandeja = caja(L + 0.1, 0.22, Wd + 0.08, M.verdeOsc, 0, 0.23, 0);
      caja(L, H, Wd, M.verde, 0, y0 + H / 2, 0);
      caja(L + 0.05, 0.06, Wd + 0.05, M.verdeOsc, 0, top, 0);
      [-0.8, 0, 0.8].forEach(x => { caja(0.02, H - 0.25, 0.012, M.verdeOsc, x, y0 + H / 2, Wd / 2 + 0.006); caja(0.02, H - 0.25, 0.012, M.verdeOsc, x, y0 + H / 2, -Wd / 2 - 0.006); });
      for (let i = 0; i < 8; i++) caja(0.012, 0.05, Wd - 0.3, M.oscuro, L / 2 + 0.006, y0 + 0.35 + i * 0.13, 0);
      caja(0.012, H - 0.4, Wd - 0.3, M.oscuro, -L / 2 - 0.006, y0 + H / 2, 0);
      caja(0.42, 0.3, 0.02, M.vidrio, 1.18, y0 + 1.05, Wd / 2 + 0.01);
      const escape = cil(0.07, 0.07, 0.55, M.oscuro, -1.05, top + 0.27, 0.25);
      cil(0.09, 0.07, 0.06, M.oscuro, -1.05, top + 0.56, 0.25);
      const ojo = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 12, 24), M.acero); ojo.position.set(0, top + 0.1, 0); equipo.add(ojo);
      return { top, Wd, baliza: [1.3, top + 0.04, 0.42], gps: [0.45, top + 0.04, -0.35], extintor: [L / 2 + 0.13, y0 + 0.5, 0.42], extintorRot: 0,
        paradas: [[1.18, y0 + 0.65, Wd / 2 + 0.035, 0], [1.18, y0 + 0.65, -Wd / 2 - 0.035, Math.PI]],
        logos: [[-0.35, y0 + 1.0, Wd / 2 + 0.008, 0], [-0.35, y0 + 1.0, -Wd / 2 - 0.008, Math.PI]], logoW: 1.05,
        afi: [-1.25, y0 + 0.3, Wd / 2 + 0.008, 0], rotulos: [[0.45, y0 + 1.15, Wd / 2 + 0.008, 0], [0.45, y0 + 0.75, Wd / 2 + 0.008, 0], [0.45, y0 + 0.35, Wd / 2 + 0.008, 0]],
        senales: { y: y0 + 0.45, z: -Wd / 2 - 0.008, rot: Math.PI, xs: [0.9, 0.55, 0.2, -0.15, -0.5] }, huincha: { L: L + 0.01, W: Wd + 0.01, y: y0 + 0.12 }, bandeja, escape };
    },
    torre() {
      const L = 2.6, Wd = 1.1, yc = 0.6;
      remolque(L, Wd + 0.1, yc, -0.2);
      const bandeja = caja(1.85, 0.06, Wd + 0.04, M.oscuro, -0.25, yc + 0.1, 0);
      const H = 1.05, y0 = yc + 0.13, top = y0 + H;
      caja(1.8, H, Wd, M.verde, -0.25, y0 + H / 2, 0);
      caja(1.85, 0.05, Wd + 0.04, M.verdeOsc, -0.25, top, 0);
      caja(0.02, H - 0.2, 0.012, M.verdeOsc, -0.25, y0 + H / 2, Wd / 2 + 0.006);
      const xm = -0.95;
      cil(0.1, 0.1, 1.2, M.acero, xm, top + 0.6, 0); cil(0.08, 0.08, 1.1, M.acero, xm, top + 1.7, 0); cil(0.06, 0.06, 0.9, M.acero, xm, top + 2.6, 0);
      const yb = top + 3.05; caja(0.06, 0.06, 1.3, M.oscuro, xm, yb, 0);
      [[-0.35, 0.18], [0.35, 0.18], [-0.35, -0.18], [0.35, -0.18]].forEach(([z, dy]) => { caja(0.16, 0.24, 0.32, M.oscuro, xm, yb + dy, z); caja(0.012, 0.2, 0.28, M.luz, xm + 0.085, yb + dy, z); });
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => { const p = caja(0.9, 0.07, 0.07, M.amarillo, -0.25 + sx * 0.75, yc - 0.05, sz * 0.75); p.rotation.y = sx * sz * 0.8; cil(0.03, 0.03, yc - 0.1, M.acero, -0.25 + sx * 1.1, (yc - 0.1) / 2, sz * 1.05); cil(0.12, 0.12, 0.03, M.oscuro, -0.25 + sx * 1.1, 0.015, sz * 1.05); });
      const escape = cil(0.05, 0.05, 0.35, M.oscuro, 0.4, top + 0.17, -0.3);
      return { top, Wd, baliza: [0.45, top + 0.03, 0.32], gps: [0.05, top + 0.03, 0.32], extintor: [1.15, yc + 0.3, 0.3], extintorRot: 0,
        paradas: [[0.42, y0 + 0.6, Wd / 2 + 0.035, 0], [0.42, y0 + 0.6, -Wd / 2 - 0.035, Math.PI]],
        logos: [[-0.55, y0 + 0.62, Wd / 2 + 0.008, 0], [-0.55, y0 + 0.62, -Wd / 2 - 0.008, Math.PI]], logoW: 0.85,
        afi: [-0.7, y0 + 0.2, Wd / 2 + 0.008, 0], rotulos: [[0.2, y0 + 0.82, Wd / 2 + 0.008, 0], [0.2, y0 + 0.45, Wd / 2 + 0.008, 0], [0.2, y0 + 0.1, -Wd / 2 - 0.008, Math.PI]],
        senales: { y: y0 + 0.3, z: -Wd / 2 - 0.008, rot: Math.PI, xs: [0.35, 0.05, -0.25, -0.55, -0.85] }, huincha: { L: L, W: Wd, y: yc, cx: 0 }, bandeja, escape };
    },
    compresor() {
      const L = 2.6, Wd = 1.15, yc = 0.6;
      remolque(L, Wd + 0.1, yc, -0.25);
      const bandeja = caja(2.3, 0.06, Wd + 0.04, M.oscuro, -0.15, yc + 0.1, 0);
      const H = 0.95, y0 = yc + 0.13, top = y0 + H;
      caja(2.25, H, Wd, M.verde, -0.15, y0 + H / 2, 0);
      const techo = cil(Wd / 2, Wd / 2, 2.25, M.verde, -0.15, top, 0, [0, 0, Math.PI / 2], 40); techo.scale.set(1, 1, 0.45);
      for (let i = 0; i < 7; i++) caja(0.25, 0.012, 0.02, M.oscuro, 0.75, y0 + 0.2 + i * 0.09, Wd / 2 + 0.006);
      caja(0.02, H - 0.15, 0.012, M.verdeOsc, -0.15, y0 + H / 2, Wd / 2 + 0.006);
      const escape = cil(0.05, 0.05, 0.3, M.oscuro, -0.9, top + 0.35, 0.2);
      const t2 = top + 0.26;
      return { top: t2, Wd, baliza: [0.45, t2 - 0.02, 0], gps: [-0.5, t2 - 0.02, 0], extintor: [1.15, yc + 0.3, 0.3], extintorRot: 0,
        paradas: [[0.95, y0 + 0.7, Wd / 2 + 0.035, 0], [0.95, y0 + 0.7, -Wd / 2 - 0.035, Math.PI]],
        logos: [[-0.55, y0 + 0.58, Wd / 2 + 0.008, 0], [-0.55, y0 + 0.58, -Wd / 2 - 0.008, Math.PI]], logoW: 0.9,
        afi: [-0.95, y0 + 0.15, Wd / 2 + 0.008, 0], rotulos: [[0.25, y0 + 0.72, Wd / 2 + 0.008, 0], [0.25, y0 + 0.38, Wd / 2 + 0.008, 0], [0.6, y0 + 0.5, -Wd / 2 - 0.008, Math.PI]],
        senales: { y: y0 + 0.25, z: -Wd / 2 - 0.008, rot: Math.PI, xs: [0.25, -0.05, -0.35, -0.65, -0.95] }, huincha: { L: L, W: Wd, y: yc }, bandeja, escape };
    },
    bomba() {
      const L = 3.2, Wd = 1.15, yc = 0.6;
      remolque(L, Wd + 0.1, yc, -0.1);
      const bandeja = caja(2.1, 0.06, Wd + 0.04, M.oscuro, 0.45, yc + 0.1, 0);
      const H = 0.95, y0 = yc + 0.13, top = y0 + H;
      caja(2.1, H, Wd, M.verde, 0.45, y0 + H / 2, 0);
      caja(2.15, 0.05, Wd + 0.04, M.verdeOsc, 0.45, top, 0);
      const tolva = cil(0.75, 0.32, 0.6, M.verdeOsc, -1.15, y0 + 0.75, 0, [0, Math.PI / 4, 0], 4); tolva.scale.set(1, 1, 0.9);
      caja(0.6, 0.35, 0.6, M.oscuro, -1.15, y0 + 0.28, 0);
      cil(0.11, 0.11, 0.7, M.acero, -1.7, y0 + 0.25, 0, [0, 0, Math.PI / 2]);
      cil(0.11, 0.11, 0.5, M.acero, -2.05, y0 + 0.5, 0);
      const escape = cil(0.05, 0.05, 0.3, M.oscuro, 1.2, top + 0.15, -0.3);
      return { top, Wd, baliza: [1.25, top + 0.03, 0.3], gps: [0.6, top + 0.03, 0.3], extintor: [1.75, yc + 0.3, 0.3], extintorRot: 0,
        paradas: [[1.2, y0 + 0.6, Wd / 2 + 0.035, 0], [-0.45, y0 + 0.5, -Wd / 2 - 0.035, Math.PI]],
        logos: [[0.25, y0 + 0.6, Wd / 2 + 0.008, 0], [0.25, y0 + 0.6, -Wd / 2 - 0.008, Math.PI]], logoW: 0.95,
        afi: [-0.35, y0 + 0.2, Wd / 2 + 0.008, 0], rotulos: [[1.05, y0 + 0.82, Wd / 2 + 0.008, 0], [1.05, y0 + 0.2, Wd / 2 + 0.008, 0], [1.15, y0 + 0.25, -Wd / 2 - 0.008, Math.PI]],
        senales: { y: y0 + 0.25, z: -Wd / 2 - 0.008, rot: Math.PI, xs: [0.85, 0.55, 0.25, -0.05, 1.15] }, huincha: { L: L, W: Wd, y: yc }, bandeja, escape };
    },
    manipulador() {
      const Wd = 1.6, yc = 0.95;
      [[-1.25, 1], [-1.25, -1], [1.25, 1], [1.25, -1]].forEach(([x, s]) => rueda(x, s * (Wd / 2 + 0.05), 0.55, 0.42));
      caja(3.6, 0.55, Wd - 0.3, M.verde, 0, yc, 0);
      const bandeja = caja(3.0, 0.08, Wd - 0.35, M.oscuro, 0, yc - 0.32, 0);
      caja(0.95, 1.25, 0.8, M.verde, 0.15, yc + 0.9, 0.35);
      caja(0.8, 0.7, 0.02, M.vidrio, 0.15, yc + 1.05, 0.76); caja(0.02, 0.7, 0.65, M.vidrio, 0.63, yc + 1.05, 0.35);
      const top = yc + 1.53; caja(1.0, 0.05, 0.85, M.verdeOsc, 0.15, top, 0.35);
      const pluma = new THREE.Group(); pluma.position.set(-1.45, yc + 0.5, -0.25); pluma.rotation.z = 0.22; equipo.add(pluma);
      caja(4.1, 0.38, 0.42, M.verde, 2.05, 0, 0, pluma); caja(1.2, 0.3, 0.34, M.verdeOsc, 4.4, 0, 0, pluma);
      const horq = new THREE.Group(); horq.position.set(3.65, yc + 1.32, -0.25); equipo.add(horq);
      caja(0.08, 0.7, 1.0, M.oscuro, 0, -0.2, 0, horq); caja(0.9, 0.05, 0.1, M.acero, 0.45, -0.52, 0.3, horq); caja(0.9, 0.05, 0.1, M.acero, 0.45, -0.52, -0.3, horq);
      const escape = cil(0.05, 0.05, 0.4, M.oscuro, -1.4, yc + 0.47, 0.5);
      return { top, Wd: Wd - 0.3, baliza: [0.35, top + 0.03, 0.55], gps: [-0.1, top + 0.03, 0.55], extintor: [-1.0, yc + 0.0, (Wd - 0.3) / 2 + 0.12], extintorRot: 0,
        paradas: [[0.62, yc + 0.6, 0.55, Math.PI / 2], [-1.82, yc + 0.1, 0, -Math.PI / 2]],
        logos: [[-0.6, yc + 0.02, (Wd - 0.3) / 2 + 0.008, 0], [0.3, yc + 0.02, -(Wd - 0.3) / 2 - 0.008, Math.PI]], logoW: 0.9,
        afi: [1.2, yc + 0.02, (Wd - 0.3) / 2 + 0.008, 0], rotulos: [[0.15, yc + 0.6, 0.761, 0], [-1.3, yc + 0.02, -(Wd - 0.3) / 2 - 0.008, Math.PI], [1.3, yc + 0.02, -(Wd - 0.3) / 2 - 0.008, Math.PI]],
        senales: { y: yc + 0.02, z: (Wd - 0.3) / 2 + 0.008, rot: 0, xs: [0.35, 0.6, 1.6, -1.45, -1.7] }, huincha: { L: 3.6, W: Wd - 0.3, y: yc - 0.2 }, bandeja, escape };
    },
    minicargador() {
      const Wd = 1.2, yc = 0.65;
      [[-0.45, 1], [-0.45, -1], [0.45, 1], [0.45, -1]].forEach(([x, s]) => rueda(x, s * (Wd / 2 + 0.05), 0.32, 0.26));
      caja(1.5, 0.75, Wd - 0.15, M.verde, -0.1, yc + 0.1, 0);
      const bandeja = caja(1.2, 0.06, Wd - 0.2, M.oscuro, -0.1, yc - 0.3, 0);
      caja(0.85, 0.95, Wd - 0.25, M.verde, 0.05, yc + 0.95, 0);
      caja(0.012, 0.6, Wd - 0.45, M.vidrio, 0.48, yc + 1.0, 0);
      [1, -1].forEach(s => caja(0.6, 0.55, 0.012, M.vidrio, 0.05, yc + 1.02, s * ((Wd - 0.25) / 2 + 0.006)));
      const top = yc + 1.45; caja(0.95, 0.06, Wd - 0.15, M.verde, 0.05, top, 0);
      [1, -1].forEach(s => { const b = caja(1.85, 0.13, 0.1, M.verdeOsc, 0.2, yc + 0.45, s * (Wd / 2 + 0.08)); b.rotation.z = -0.55; });
      caja(0.35, 0.45, Wd + 0.2, M.oscuro, 1.05, yc - 0.25, 0);
      const escape = cil(0.04, 0.04, 0.3, M.oscuro, -0.75, yc + 0.65, 0.3);
      return { top, Wd: Wd - 0.15, baliza: [0.3, top + 0.03, 0.3], gps: [-0.2, top + 0.03, 0.3], extintor: [-0.88, yc, 0.2], extintorRot: -Math.PI / 2,
        paradas: [[0.48, yc + 0.95, 0.4, Math.PI / 2], [-0.86, yc + 0.3, -0.2, -Math.PI / 2]],
        logos: [[-0.35, yc + 0.18, (Wd - 0.15) / 2 + 0.008, 0], [-0.35, yc + 0.18, -(Wd - 0.15) / 2 - 0.008, Math.PI]], logoW: 0.65,
        afi: [0.35, yc - 0.12, (Wd - 0.15) / 2 + 0.008, 0], rotulos: [[0.35, yc + 0.32, (Wd - 0.15) / 2 + 0.008, 0], [0.3, yc + 0.32, -(Wd - 0.15) / 2 - 0.008, Math.PI], [0.3, yc - 0.12, -(Wd - 0.15) / 2 - 0.008, Math.PI]],
        senales: { y: yc - 0.14, z: -(Wd - 0.15) / 2 - 0.008, rot: Math.PI, xs: [-0.05, -0.3, -0.55, -0.8, 0.0] }, huincha: { L: 1.5, W: Wd - 0.15, y: yc - 0.18, cx: -0.1 }, bandeja, escape };
    },
    camion() {
      const Wd = 2.0, yc = 0.9, pluma = /PLUMA/i.test(tipo);
      [[1.9, 1], [1.9, -1], [-1.1, 1], [-1.1, -1], [-2.0, 1], [-2.0, -1]].forEach(([x, s]) => rueda(x, s * (Wd / 2 - 0.15), 0.48, 0.32));
      caja(5.6, 0.25, 1.0, M.oscuro, 0, yc, 0);
      const bandeja = caja(3.8, 0.08, Wd, M.oscuro, -0.8, yc + 0.16, 0);
      caja(1.5, 1.7, Wd, M.verde, 2.2, yc + 0.95, 0);
      caja(0.02, 0.75, Wd - 0.3, M.vidrio, 2.96, yc + 1.3, 0); caja(0.7, 0.55, 0.02, M.vidrio, 2.35, yc + 1.35, Wd / 2 + 0.01);
      const top = yc + 1.8; caja(1.5, 0.06, Wd, M.verdeOsc, 2.2, top, 0);
      [1, -1].forEach(s => caja(3.8, 0.45, 0.06, M.verde, -0.8, yc + 0.42, s * (Wd / 2 - 0.03)));
      if (pluma) { cil(0.18, 0.2, 1.0, M.verdeOsc, 1.1, yc + 0.7, 0); const b = caja(3.4, 0.25, 0.28, M.verde, -0.4, yc + 1.25, 0); b.rotation.z = 0.08; }
      const escape = cil(0.06, 0.06, 1.0, M.acero, 1.35, yc + 1.2, -0.75);
      return { top, Wd, baliza: [2.2, top + 0.03, 0.55], gps: [2.2, top + 0.03, -0.55], extintor: [1.3, yc + 0.15, Wd / 2 + 0.05], extintorRot: 0,
        paradas: [[1.4, yc + 0.55, 0.55, 0], [-2.7, yc + 0.3, 0, -Math.PI / 2]],
        logos: [[2.2, yc + 0.6, Wd / 2 + 0.008, 0], [2.2, yc + 0.6, -Wd / 2 - 0.008, Math.PI]], logoW: 0.9,
        afi: [2.96, yc + 0.35, 0, Math.PI / 2], rotulos: [[-0.3, yc + 0.42, Wd / 2 + 0.035, 0], [-1.3, yc + 0.42, Wd / 2 + 0.035, 0], [-0.8, yc + 0.42, -Wd / 2 - 0.035, Math.PI]],
        senales: { y: yc + 0.42, z: -Wd / 2 - 0.035, rot: Math.PI, xs: [0.6, 0.3, -1.6, -1.9, -2.2] }, huincha: { L: 5.6, W: Wd, y: yc + 0.18, cx: 0 }, bandeja, escape };
    }
  };
  // ---------- 2026-11-18: plataforma tijera, retroexcavadora, excavadora ----------
  FIG.tijera = () => {
    const L = 2.4, Wd = 1.1, yc = 0.5, top = yc + 0.25;
    [[-0.85, 1], [-0.85, -1], [0.85, 1], [0.85, -1]].forEach(([x, s]) => rueda(x, s * (Wd / 2 + 0.02), 0.22, 0.18));
    caja(L, 0.5, Wd, M.verde, 0, yc, 0);
    const bandeja = caja(L - 0.3, 0.06, Wd - 0.2, M.oscuro, 0, yc - 0.27, 0);
    caja(L + 0.04, 0.05, Wd + 0.04, M.verdeOsc, 0, top, 0);
    // tijeras: 3 niveles de brazos cruzados a cada lado
    const niv = 3, hN = 0.55, largo = 2.0, ang = Math.asin(hN / largo);
    for (let n = 0; n < niv; n++) [1, -1].forEach(s => [1, -1].forEach(d => { const b = caja(largo, 0.07, 0.06, M.oscuro, 0, top + 0.05 + hN * n + hN / 2, s * 0.42); b.rotation.z = d * ang; }));
    const yp = top + 0.1 + hN * niv;
    caja(L + 0.1, 0.08, Wd + 0.1, M.oscuro, 0, yp, 0);
    const baranda = (x, z, w, d) => caja(w, 0.04, d, M.verde, x, yp + 1.0, z);
    [[-(L + 0.1) / 2, (Wd + 0.1) / 2], [(L + 0.1) / 2, (Wd + 0.1) / 2], [-(L + 0.1) / 2, -(Wd + 0.1) / 2], [(L + 0.1) / 2, -(Wd + 0.1) / 2], [0, (Wd + 0.1) / 2], [0, -(Wd + 0.1) / 2]].forEach(([x, z]) => caja(0.04, 1.0, 0.04, M.verde, x, yp + 0.5, z));
    baranda(0, (Wd + 0.1) / 2, L + 0.1, 0.04); baranda(0, -(Wd + 0.1) / 2, L + 0.1, 0.04); baranda((L + 0.1) / 2, 0, 0.04, Wd + 0.1); baranda(-(L + 0.1) / 2, 0, 0.04, Wd + 0.1);
    [1, -1].forEach(s => caja(L + 0.1, 0.03, 0.03, M.verde, 0, yp + 0.5, s * (Wd + 0.1) / 2));
    caja(0.3, 0.25, 0.18, M.oscuro, 0.9, yp + 1.15, 0.35);
    return { top, Wd, baliza: [-0.95, top + 0.03, 0.38], gps: [-0.6, top + 0.03, -0.35], extintor: [L / 2 + 0.08, yc, 0.25], extintorRot: 0,
      paradas: [[0.75, yc + 0.05, Wd / 2 + 0.035, 0], [0.9, yp + 1.15, 0.47, 0]],
      logos: [[-0.35, yc + 0.02, Wd / 2 + 0.008, 0], [-0.35, yc + 0.02, -Wd / 2 - 0.008, Math.PI]], logoW: 0.7,
      afi: [0.25, yc + 0.08, Wd / 2 + 0.008, 0], rotulos: [[0.25, yc - 0.13, Wd / 2 + 0.008, 0], [0.5, yc + 0.05, -Wd / 2 - 0.008, Math.PI], [0.8, yc + 0.05, -Wd / 2 - 0.008, Math.PI]],
      senales: { y: yc + 0.05, z: -Wd / 2 - 0.008, rot: Math.PI, xs: [0.2, -0.95, -1.05, 0.05, -0.1] }, huincha: { L, W: Wd, y: yc - 0.18 }, bandeja, escape: null };
  };
  FIG.retro = () => {
    const Wd = 1.7, yc = 1.0;
    rueda(1.3, Wd / 2 + 0.05, 0.5, 0.35); rueda(1.3, -Wd / 2 - 0.05, 0.5, 0.35); rueda(-1.0, Wd / 2 + 0.08, 0.72, 0.45); rueda(-1.0, -Wd / 2 - 0.08, 0.72, 0.45);
    caja(3.4, 0.45, Wd - 0.4, M.verde, 0, yc, 0);
    const bandeja = caja(2.6, 0.08, Wd - 0.5, M.oscuro, 0, yc - 0.26, 0);
    caja(1.2, 0.55, Wd - 0.5, M.verde, 1.2, yc + 0.5, 0);
    caja(1.1, 1.3, Wd - 0.3, M.verde, -0.35, yc + 0.88, 0);
    caja(0.9, 0.75, 0.02, M.vidrio, -0.35, yc + 1.05, (Wd - 0.3) / 2 + 0.01); caja(0.02, 0.75, Wd - 0.5, M.vidrio, 0.21, yc + 1.05, 0);
    const top = yc + 1.55; caja(1.2, 0.06, Wd - 0.2, M.verdeOsc, -0.35, top, 0);
    // pala delantera
    [1, -1].forEach(s => { const b = caja(1.7, 0.14, 0.12, M.verdeOsc, 1.85, yc + 0.35, s * (Wd / 2 - 0.1)); b.rotation.z = -0.35; });
    const pala = caja(0.45, 0.55, Wd + 0.1, M.oscuro, 2.75, yc - 0.45, 0); pala.rotation.z = 0.15;
    // brazo trasero (retro)
    const g = new THREE.Group(); g.position.set(-1.75, yc + 0.3, 0); equipo.add(g);
    const b1 = caja(1.6, 0.22, 0.24, M.verde, -0.65, 0.55, 0, g); b1.rotation.z = -0.75;
    const b2 = caja(1.3, 0.18, 0.2, M.verdeOsc, -1.55, 0.6, 0, g); b2.rotation.z = 0.95;
    caja(0.35, 0.35, 0.5, M.oscuro, -2.0, -0.05, 0, g);
    [1, -1].forEach(s => { const e = caja(0.12, 0.9, 0.12, M.oscuro, -1.65, yc - 0.45, s * (Wd / 2 + 0.05)); e.rotation.x = s * 0.25; });
    const escape = cil(0.05, 0.05, 0.5, M.oscuro, 1.55, yc + 1.0, 0.35);
    return { top, Wd: Wd - 0.4, baliza: [-0.1, top + 0.03, 0.5], gps: [-0.6, top + 0.03, -0.5], extintor: [0.55, yc - 0.05, (Wd - 0.4) / 2 + 0.12], extintorRot: 0,
      paradas: [[0.21, yc + 0.55, 0.35, Math.PI / 2], [-1.72, yc, 0, -Math.PI / 2]],
      logos: [[1.2, yc + 0.52, (Wd - 0.5) / 2 + 0.008, 0], [1.2, yc + 0.52, -(Wd - 0.5) / 2 - 0.008, Math.PI]], logoW: 0.75,
      afi: [-1.35, yc + 0.02, (Wd - 0.4) / 2 + 0.008, 0], rotulos: [[-0.35, yc + 0.4, (Wd - 0.3) / 2 + 0.008, 0], [0.55, yc + 0.05, -(Wd - 0.4) / 2 - 0.008, Math.PI], [-0.4, yc + 0.4, -(Wd - 0.3) / 2 - 0.008, Math.PI]],
      senales: { y: yc + 0.02, z: -(Wd - 0.4) / 2 - 0.008, rot: Math.PI, xs: [0.2, -0.05, -1.35, -1.55, 0.95] }, huincha: { L: 3.4, W: Wd - 0.4, y: yc - 0.15 }, bandeja, escape };
  };
  FIG.excavadora = () => {
    const Wt = 2.3, yT = 0.45;
    [1, -1].forEach(s => {
      caja(3.2, 0.7, 0.55, M.goma, 0, yT, s * (Wt / 2 - 0.27));
      cil(0.35, 0.35, 0.55, M.goma, 1.6, yT, s * (Wt / 2 - 0.27), [Math.PI / 2, 0, 0]); cil(0.35, 0.35, 0.55, M.goma, -1.6, yT, s * (Wt / 2 - 0.27), [Math.PI / 2, 0, 0]);
      for (let i = -3; i <= 3; i++) cil(0.14, 0.14, 0.57, M.acero, i * 0.45, yT - 0.05, s * (Wt / 2 - 0.27), [Math.PI / 2, 0, 0], 12);
    });
    caja(2.4, 0.3, Wt - 1.0, M.oscuro, 0, yT + 0.3, 0);
    const bandeja = caja(2.2, 0.06, Wt - 1.1, M.oscuro, 0, yT + 0.47, 0);
    const yc = 1.35, Wd = 2.2;
    caja(2.8, 0.9, Wd, M.verde, -0.25, yc, 0);
    caja(0.9, 0.95, Wd, M.verdeOsc, -1.6, yc + 0.05, 0);
    caja(1.0, 1.1, 0.95, M.verde, 0.65, yc + 0.95, 0.55);
    caja(0.85, 0.8, 0.02, M.vidrio, 0.65, yc + 1.0, 1.03); caja(0.02, 0.8, 0.8, M.vidrio, 1.16, yc + 1.0, 0.55);
    const top = yc + 1.52; caja(1.05, 0.05, 1.0, M.verdeOsc, 0.65, top, 0.55);
    const g = new THREE.Group(); g.position.set(0.9, yc + 0.35, -0.25); equipo.add(g);
    const b1 = caja(2.6, 0.38, 0.36, M.verde, 1.0, 0.75, 0, g); b1.rotation.z = 0.6;
    const b2 = caja(2.0, 0.28, 0.28, M.verde, 2.85, 0.6, 0, g); b2.rotation.z = -1.05;
    const cuch = caja(0.55, 0.55, 0.75, M.oscuro, 3.3, -0.35, 0, g); cuch.rotation.z = 0.4;
    const escape = cil(0.06, 0.06, 0.45, M.oscuro, -0.9, yc + 0.65, 0.6);
    return { top, Wd, baliza: [0.4, top + 0.03, 0.8], gps: [0.9, top + 0.03, 0.3], extintor: [-0.3, yc - 0.05, Wd / 2 + 0.12], extintorRot: 0,
      paradas: [[1.16, yc + 0.6, 0.55, Math.PI / 2], [-2.06, yc + 0.05, 0, -Math.PI / 2]],
      logos: [[-0.85, yc + 0.08, Wd / 2 + 0.008, 0], [-0.4, yc + 0.08, -Wd / 2 - 0.008, Math.PI]], logoW: 0.85,
      afi: [0.65, yc + 0.25, 1.031, 0], rotulos: [[-1.6, yc + 0.25, Wd / 2 + 0.008, 0], [-1.6, yc - 0.15, Wd / 2 + 0.008, 0], [0.5, yc + 0.0, -Wd / 2 - 0.008, Math.PI]],
      senales: { y: yc - 0.25, z: -Wd / 2 - 0.008, rot: Math.PI, xs: [0.85, 0.6, 0.35, 0.1, -0.15] }, huincha: { L: 2.8, W: Wd, y: yc - 0.35, cx: -0.25 }, bandeja, escape };
  };
  // ---------- 2026-11-25: CAMIONETA (pickup doble cabina con barra antivuelco) para el check list de vehículo ----------
  FIG.camioneta = () => {
    const Wd = 1.85, yb = 0.9;
    [[1.55, 1], [1.55, -1], [-1.6, 1], [-1.6, -1]].forEach(([x, sg]) => rueda(x, sg * (Wd / 2 - 0.08), 0.4, 0.3));
    caja(4.6, 0.2, 1.3, M.oscuro, 0, 0.55, 0);
    caja(5.2, 0.5, Wd, M.verde, 0, yb, 0);                          // carrocería baja
    caja(1.35, 0.22, Wd - 0.04, M.verde, 1.88, yb + 0.36, 0);        // capó
    const cab = caja(1.8, 0.78, Wd - 0.04, M.verde, 0.17, yb + 0.64, 0);
    const techo = yb + 1.03; caja(1.7, 0.05, Wd - 0.08, M.verdeOsc, 0.12, techo, 0);
    const pb = caja(0.74, 0.04, Wd - 0.12, M.vidrio, 1.25, yb + 0.69, 0); pb.rotation.z = -0.95;   // parabrisas inclinado
    [1, -1].forEach(sg => { caja(0.7, 0.42, 0.02, M.vidrio, 0.6, yb + 0.72, sg * (Wd / 2 - 0.01)); caja(0.72, 0.42, 0.02, M.vidrio, -0.18, yb + 0.72, sg * (Wd / 2 - 0.01)); });
    caja(0.02, 0.4, Wd - 0.4, M.vidrio, -0.73, yb + 0.72, 0);         // vidrio trasero
    // tolva
    const xT = -1.72, LT = 1.9;
    caja(LT, 0.05, Wd - 0.12, M.oscuro, xT, yb + 0.26, 0);
    [1, -1].forEach(sg => caja(LT, 0.42, 0.06, M.verde, xT, yb + 0.46, sg * (Wd / 2 - 0.03)));
    caja(0.06, 0.42, Wd, M.verde, xT - LT / 2, yb + 0.46, 0);
    // barra antivuelco
    const xR = -0.86, hR = 0.62, yR = yb + 0.67;
    [1, -1].forEach(sg => cil(0.035, 0.035, hR + 0.4, M.acero, xR, yR + hR / 2 - 0.2, sg * (Wd / 2 - 0.12), null, 12));
    cil(0.035, 0.035, Wd - 0.24, M.acero, xR, yR + hR + 0.02, 0, [Math.PI / 2, 0, 0], 12);
    // parachoques, focos, espejos
    caja(0.16, 0.22, Wd + 0.04, M.oscuro, 2.62, 0.72, 0); caja(0.14, 0.2, Wd + 0.04, M.oscuro, -2.68, 0.72, 0);
    [1, -1].forEach(sg => { caja(0.02, 0.13, 0.32, M.luz, 2.6, yb + 0.12, sg * 0.62); caja(0.02, 0.16, 0.14, M.rojo, -2.67, yb + 0.15, sg * 0.78); caja(0.08, 0.14, 0.18, M.oscuro, 1.1, yb + 0.72, sg * (Wd / 2 + 0.1)); });
    caja(0.02, 0.18, 1.0, M.oscuro, 2.58, yb + 0.12, 0);              // parrilla
    return { top: techo, Wd, yb, xT, LT, xR, yR, hR, cab,
      logos: [[0.28, yb + 0.08, Wd / 2 + 0.006, 0], [0.28, yb + 0.08, -Wd / 2 - 0.006, Math.PI]], logoW: 0.85 };
  };
  const esVeh = !!opciones.vehiculo;
  const fig = esVeh ? 'camioneta' : figuraDe(tipo);
  const A = (FIG[fig] || FIG.generador)();

  // ---------- elementos del estándar ----------
  const items = {};   // k → [objetos]
  const reg = (k, o) => { (items[k] = items[k] || []).push(o); o.traverse(x => { x.userData.k = k; }); return o; };
  const grupo = (x, y, z, rotY = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; equipo.add(g); return g; };
  if (esVeh) {
    // ---------- elementos del check list de VEHÍCULO (EVL-FRC) ----------
    const { yb, xT, LT, xR, yR, hR, Wd, top } = A, piso = yb + 0.29, zI = Wd / 2 - 0.12;
    const naranjo = mat(0xf97316, { roughness: 0.6 }), lima = mat(0xc6e632, { roughness: 0.8, metalness: 0 }), gris = mat(0x8b949c, { roughness: 0.6 });
    // logos FRC en las puertas y patente
    A.logos.forEach(([x, y, z, r]) => placa(A.logoW, A.logoW / 2, texLogo, x, y, z, r));
    const texPat = textura((ctx, w, h) => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#111'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10); ctx.fillStyle = '#111'; ctx.font = 'bold 110px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(afi || 'PATENTE'), w / 2, h / 2 + 6); });
    placa(0.42, 0.13, texPat, 2.71, 0.72, 0, Math.PI / 2); placa(0.42, 0.13, texPat, -2.76, 0.72, 0, -Math.PI / 2);
    // baliza sobre la barra antivuelco
    { const g = grupo(xR, yR + hR + 0.06, 0); cil(0.08, 0.09, 0.05, M.oscuro, 0, 0.025, 0, null, 24, g); const luz = cil(0.06, 0.07, 0.14, new THREE.MeshStandardMaterial({ color: AMBAR, emissive: AMBAR, emissiveIntensity: 1.2, transparent: true, opacity: 0.92 }), 0, 0.12, 0, null, 24, g); luz.userData.baliza = true; reg('baliza', g); }
    // GPS en el techo
    { const g = grupo(0.55, top + 0.03, -0.45); caja(0.18, 0.05, 0.12, M.goma, 0, 0.0, 0, g); cil(0.012, 0.012, 0.12, M.goma, 0.06, 0.08, 0, null, 8, g); reg('gps', g); }
    // pértiga con banderín (esquina trasera de la tolva)
    { const g = grupo(xT - LT / 2 + 0.12, piso, -zI + 0.04); cil(0.022, 0.022, 3.0, mat(0xffffff, { roughness: 0.5 }), 0, 1.5, 0, null, 10, g); for (let i = 0; i < 6; i++) cil(0.024, 0.024, 0.18, M.rojo, 0, 0.4 + i * 0.42, 0, null, 10, g);
      const ban = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 3.0, 0), new THREE.Vector3(0.55, 2.86, 0), new THREE.Vector3(0, 2.7, 0)]), new THREE.MeshStandardMaterial({ color: 0xf97316, side: THREE.DoubleSide, emissive: 0x7a2e00, emissiveIntensity: 0.25 })); ban.geometry.computeVertexNormals(); g.add(ban); reg('pertiga', g); }
    // extintor en la pared delantera de la tolva
    { const g = grupo(xT + LT / 2 - 0.12, piso + 0.24, zI - 0.18); cil(0.075, 0.075, 0.42, M.rojo, 0, 0, 0, null, 24, g); cil(0.03, 0.04, 0.06, M.oscuro, 0, 0.24, 0, null, 12, g); caja(0.1, 0.02, 0.03, M.oscuro, 0.05, 0.28, 0, g); caja(0.04, 0.22, 0.16, M.oscuro, 0.09, 0, 0, g); reg('extintor', g); }
    // neumático de repuesto parado contra la pared delantera
    { const g = grupo(xT + LT / 2 - 0.2, piso + 0.36, -0.3); cil(0.36, 0.36, 0.25, M.goma, 0, 0, 0, [0, 0, Math.PI / 2], 32, g); cil(0.2, 0.2, 0.27, M.acero, 0, 0, 0, [0, 0, Math.PI / 2], 24, g); reg('repuesto', g); }
    // gata (tijera) en el piso de la tolva
    { const g = grupo(xT + 0.1, piso, zI - 0.25); caja(0.36, 0.03, 0.12, M.oscuro, 0, 0.015, 0, g); [1, -1].forEach(sg => { const b = caja(0.24, 0.035, 0.05, M.verdeOsc, sg * 0.08, 0.1, 0, g); b.rotation.z = sg * 0.7; const c = caja(0.24, 0.035, 0.05, M.verdeOsc, sg * 0.08, 0.24, 0, g); c.rotation.z = -sg * 0.7; }); caja(0.2, 0.03, 0.1, M.oscuro, 0, 0.33, 0, g); cil(0.012, 0.012, 0.6, M.acero, 0, 0.17, 0, [0, 0, Math.PI / 2], 8, g); reg('gata', g); }
    // llave de rueda (cruz)
    { const g = grupo(xT - 0.35, piso + 0.03, 0.25); caja(0.5, 0.03, 0.03, M.acero, 0, 0, 0, g).rotation.y = 0.78; caja(0.5, 0.03, 0.03, M.acero, 0, 0, 0, g).rotation.y = -0.78; [[0.18, 0.18], [-0.18, 0.18], [0.18, -0.18], [-0.18, -0.18]].forEach(([x, z]) => cil(0.03, 0.03, 0.05, M.oscuro, x, 0, z, null, 10, g)); reg('llave_rueda', g); }
    // triángulos (2) parados
    [-0.05, 0.12].forEach((dz, i) => { const g = grupo(xT - LT / 2 + 0.3 + i * 0.12, piso + 0.02, -0.25 + dz); const tri = new THREE.Mesh(new THREE.CircleGeometry(0.2, 3), M.rojo); tri.rotation.set(0, Math.PI / 2, Math.PI / 2); tri.position.y = 0.17; g.add(tri); caja(0.04, 0.02, 0.26, M.oscuro, 0, 0.0, 0, g); reg('triangulos', g); });
    // caballete de seguridad (torre de apoyo)
    { const g = grupo(xT + 0.25, piso, -0.05); [[0.12, 0.12], [-0.12, 0.12], [0.12, -0.12], [-0.12, -0.12]].forEach(([x, z]) => { const p = cil(0.018, 0.018, 0.4, M.rojo, x * 0.6, 0.18, z * 0.6, null, 8, g); p.rotation.set(z * 1.6, 0, -x * 1.6); }); cil(0.035, 0.035, 0.25, gris, 0, 0.3, 0, null, 12, g); caja(0.16, 0.03, 0.08, M.oscuro, 0, 0.43, 0, g); reg('caballete', g); }
    // kit antiderrame (balde verde)
    { const g = grupo(xT - LT / 2 + 0.3, piso, zI - 0.25); cil(0.15, 0.12, 0.34, M.verdeOsc, 0, 0.17, 0, null, 20, g); cil(0.16, 0.16, 0.04, M.oscuro, 0, 0.35, 0, null, 20, g); reg('antiderrame', g); }
    // cuñas (2) en la rueda trasera
    [-1.6 + 0.48, -1.6 - 0.48].forEach((x, i) => { const g = grupo(x, 0, Wd / 2 - 0.08); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.24, 3, 1), M.amarillo); c.rotation.set(Math.PI / 2, 0, i ? Math.PI / 6 : -Math.PI / 6 + Math.PI); c.position.y = 0.07; sombra(c); g.add(c); reg('cunas', g); });
    // alarma de retroceso bajo el parachoques trasero
    { const g = grupo(-2.55, 0.55, 0.35); caja(0.1, 0.1, 0.14, M.goma, 0, 0, 0, g); cil(0.04, 0.04, 0.02, mat(0x444444), -0.06, 0, 0, [0, 0, Math.PI / 2], 16, g); reg('alarma_retro', g); }
    // dentro de la cabina (se ven por las ventanas): chaleco, botiquín y documentos
    { const g = grupo(0.15, yb + 0.55, zI - 0.1); caja(0.04, 0.38, 0.3, lima, 0, 0, 0, g); caja(0.045, 0.04, 0.3, M.blanco, 0, -0.06, 0, g); caja(0.045, 0.04, 0.3, M.blanco, 0, 0.08, 0, g); reg('chaleco', g); }
    { const g = grupo(-0.55, yb + 0.5, -0.35); caja(0.22, 0.16, 0.3, M.blanco, 0, 0, 0, g); caja(0.225, 0.1, 0.03, M.rojo, 0, 0, 0, g); caja(0.225, 0.03, 0.1, M.rojo, 0, 0, 0, g); reg('botiquin', g); }
    { const g = grupo(0.95, yb + 0.42, 0.45); caja(0.2, 0.02, 0.26, M.blanco, 0, 0, 0, g).rotation.z = -0.3; caja(0.2, 0.02, 0.26, mat(0x2563eb), 0.02, -0.02, 0, g).rotation.z = -0.3; reg('documentos', g); }
  } else {
  // baliza
  { const g = grupo(...A.baliza); cil(0.08, 0.09, 0.05, M.oscuro, 0, 0.025, 0, null, 24, g); const luz = cil(0.06, 0.07, 0.14, new THREE.MeshStandardMaterial({ color: AMBAR, emissive: AMBAR, emissiveIntensity: 1.2, transparent: true, opacity: 0.92 }), 0, 0.12, 0, null, 24, g); luz.userData.baliza = true; reg('baliza', g); }
  // GPS
  { const g = grupo(...A.gps); caja(0.18, 0.05, 0.12, M.goma, 0, 0.025, 0, g); cil(0.012, 0.012, 0.12, M.goma, 0.06, 0.1, 0, null, 8, g); reg('gps', g); }
  // extintor
  { const g = grupo(...A.extintor, A.extintorRot || 0); cil(0.075, 0.075, 0.42, M.rojo, 0, 0, 0, null, 24, g); cil(0.03, 0.04, 0.06, M.oscuro, 0, 0.24, 0, null, 12, g); caja(0.1, 0.02, 0.03, M.oscuro, 0.05, 0.28, 0, g); caja(0.2, 0.05, 0.05, M.oscuro, 0, -0.1, -0.06, g); reg('extintor', g); }
  // paradas de emergencia
  A.paradas.forEach(([x, y, z, r]) => { const g = grupo(x, y, z, r); caja(0.16, 0.16, 0.03, M.amarillo, 0, 0, -0.015, g); cil(0.055, 0.045, 0.05, M.rojo, 0, 0, 0.02, [Math.PI / 2, 0, 0], 24, g); reg('parada', g); });
  // logos FRC (rótulos empresa)
  A.logos.forEach(([x, y, z, r]) => reg('rotulo_frc', placa(A.logoW, A.logoW / 2, texLogo, x, y, z, r)));
  // número AFI
  reg('afi', placa(0.46, 0.23, texAfi, ...A.afi));
  // rótulos de capacidades / uso / mantención
  ['rotulo_cap', 'rotulo_uso', 'rotulo_mant'].forEach((k, i) => { const [x, y, z, r] = A.rotulos[i]; reg(k, placa(0.26, 0.2, texRotulo(['CAPACIDADES', 'USO PASO A PASO', 'MANTENCIÓN'][i]), x, y, z, r)); });
  // señaléticas
  [['sen_bloqueo', '🔒'], ['sen_bateria', '+−'], ['sen_atrap', '✋'], ['sen_energias', '⚡'], ['sen_comb', '⛽']].forEach(([k, s], i) => reg(k, placa(0.17, 0.15, texSenal(s), A.senales.xs[i], A.senales.y, A.senales.z, A.senales.rot)));
  // huincha reflectante perimetral
  { const h = A.huincha, cx = h.cx || 0, g = grupo(cx, h.y, 0); const t = 0.012, a = 0.05;
    caja(h.L + 0.02, a, t, M.amarillo, 0, 0, h.W / 2 + 0.006, g); caja(h.L + 0.02, a, t, M.amarillo, 0, 0, -h.W / 2 - 0.006, g);
    caja(t, a, h.W + 0.02, M.amarillo, h.L / 2 + 0.006, 0, 0, g); caja(t, a, h.W + 0.02, M.amarillo, -h.L / 2 - 0.006, 0, 0, g); reg('huincha', g); }
  // bandeja antiderrame y termoseal
  if (A.bandeja) reg('bandeja', A.bandeja);
  if (A.escape) { const e = A.escape; const w = cil(0.085, 0.085, 0.22, mat(0xc9ccc4, { metalness: 0.2, roughness: 0.9 }), e.position.x, e.position.y - 0.08, e.position.z, null, 20); reg('termoseal', w); }

  // ---------- más elementos del estándar (2026-11-18): bloqueo, batería, guardas, barra Cooper, hoja de seguridad ----------
  {
    const h = A.huincha, cx = h.cx || 0, L = h.L, Wz = h.W, yb = h.y, zF = Wz / 2, xE = cx + L / 2, xO = cx - L / 2;
    const cobre = mat(0xb87333, { metalness: 0.8, roughness: 0.3 }), gris = mat(0x8b949c, { roughness: 0.6 });
    // punto de bloqueo: caja con manilla roja y candado amarillo
    const bx = xE - 0.8, by = yb + 0.42;
    { const g = grupo(bx, by, zF + 0.035); caja(0.2, 0.24, 0.06, gris, 0, 0, 0, g); caja(0.05, 0.12, 0.05, M.rojo, 0, 0.02, 0.05, g); const c = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 8, 16, Math.PI), M.acero); c.position.set(0.06, -0.06, 0.05); g.add(c); caja(0.06, 0.06, 0.03, M.amarillo, 0.06, -0.11, 0.05, g); reg('bloqueo', g); }
    // batería con espuma azul en los bornes
    const tx = xE - 0.35, ty = yb + 0.08;
    { const g = grupo(tx, ty, zF + 0.1); caja(0.32, 0.2, 0.16, M.goma, 0, 0, 0, g); [-0.09, 0.09].forEach((dx, i) => { cil(0.022, 0.022, 0.05, i ? M.rojo : M.goma, dx, 0.12, 0, null, 10, g); cil(0.04, 0.04, 0.04, mat(0x2b7bd6, { roughness: 0.95, metalness: 0 }), dx, 0.15, 0, null, 12, g); }); reg('bateria', g); }
    // señaléticas de bloqueo y de batería junto a lo que señalan
    const mover = (k, x, y, z, r) => (items[k] || []).forEach(o => { o.position.set(x, y, z); o.rotation.y = r; });
    mover('sen_bloqueo', bx + 0.22, by + 0.02, zF + 0.009, 0);
    mover('sen_bateria', tx, ty + 0.27, zF + 0.009, 0);
    // guardas y protecciones de partes móviles: rejilla amarilla en el extremo
    { const g = grupo(xO - 0.012, yb + 0.4, 0, Math.PI / 2); caja(0.55, 0.42, 0.02, M.amarillo, 0, 0, 0, g); for (let i = -2; i <= 2; i++) caja(0.012, 0.36, 0.03, M.oscuro, i * 0.1, 0, 0, g); for (let j = -1; j <= 1; j++) caja(0.48, 0.012, 0.03, M.oscuro, 0, j * 0.1, 0, g); reg('guardas', g); }
    // barra Cooper (puesta a tierra): barra de cobre enterrada con su cable al chasis
    { const g = grupo(xO + 0.25, 0, zF + 0.32); cil(0.025, 0.025, 0.45, cobre, 0, 0.12, 0, null, 12, g); caja(0.12, 0.03, 0.06, cobre, 0, 0.35, 0, g); const cab = cil(0.012, 0.012, 0.45, mat(0x4caf50, { roughness: 0.7 }), 0, 0.42, -0.16, [Math.PI / 3.2, 0, 0], 8, g); cab.userData.cable = true; reg('barra_cooper', g); }
    // hoja de seguridad del combustible: porta-documento con hoja blanca
    { const g = grupo(xE - 0.32, yb + 0.62, -zF - 0.03, Math.PI); caja(0.24, 0.3, 0.03, mat(0xd8e2e8, { transparent: true, opacity: 0.85, roughness: 0.2 }), 0, 0, 0, g); caja(0.19, 0.25, 0.005, M.blanco, 0, 0.0, 0.018, g); caja(0.12, 0.02, 0.006, M.rojo, 0, 0.09, 0.022, g); reg('hoja_comb', g); }
  }

  }
  // ---------- encuadre ----------
  const caj = new THREE.Box3().setFromObject(equipo), centro = caj.getCenter(new THREE.Vector3()), tam = caj.getSize(new THREE.Vector3());
  equipo.position.x -= centro.x; equipo.position.z -= centro.z;
  const radio = Math.max(tam.x, tam.y * 1.2, tam.z) * 0.95;
  const ALT0 = esVeh ? 0.6 : 0.32;
  let dist = radio * 2.3, alt = ALT0, ang = -0.65, auto = true;
  const objetivo = new THREE.Vector3(0, tam.y * 0.42, 0);
  const ubicarCamara = () => { camera.position.set(Math.sin(ang) * Math.cos(alt) * dist, objetivo.y + Math.sin(alt) * dist, Math.cos(ang) * Math.cos(alt) * dist); camera.lookAt(objetivo); };

  // ---------- estado de cada elemento ----------
  const rojo = new THREE.MeshStandardMaterial({ color: ROJO, emissive: ROJO, emissiveIntensity: 0.6, transparent: true, opacity: 0.95 });
  const originales = new Map();
  Object.values(items).flat().forEach(g => g.traverse(o => { if (o.isMesh && !originales.has(o)) originales.set(o, o.material); }));
  let malos = [], resaltado = null;
  const aplicarEstados = () => {
    malos = [];
    Object.entries(items).forEach(([k, objs]) => {
      const e = estados[k];
      objs.forEach(g => {
        g.visible = true;
        g.traverse(o => {
          if (!o.isMesh) return;
          const base = originales.get(o);
          if (e === 'MALO') o.material = rojo;
          else if (e === 'NA') { o.material = base.clone(); o.material.transparent = true; o.material.opacity = 0.18; }
          else o.material = base;
        });
        if (e === 'MALO') malos.push(g);
      });
    });
  };
  aplicarEstados();

  // ---------- interacción ----------
  const el = renderer.domElement;
  let arrastre = null, movio = false;
  const raton = new THREE.Vector2(), rayo = new THREE.Raycaster();
  el.addEventListener('pointerdown', (e) => { arrastre = { x: e.clientX, y: e.clientY, ang, alt }; movio = false; auto = false; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; });
  el.addEventListener('pointermove', (e) => {
    if (!arrastre) return;
    const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) movio = true;
    ang = arrastre.ang - dx * 0.008; alt = Math.max(0.05, Math.min(1.2, arrastre.alt + dy * 0.006));
  });
  el.addEventListener('pointerup', (e) => {
    el.style.cursor = 'grab';
    if (arrastre && !movio && onPick) {
      const r = el.getBoundingClientRect(); raton.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      rayo.setFromCamera(raton, camera);
      const hit = rayo.intersectObjects(equipo.children, true).find(h => h.object.userData.k);
      onPick(hit ? hit.object.userData.k : null);
    }
    arrastre = null;
  });
  el.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.max(radio * 1.2, Math.min(radio * 4, dist * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });

  // ---------- nombres sobre la figura (2026-11-18) ----------
  // Etiqueta por elemento, pegada a su posición en pantalla; se oculta si el elemento queda detrás del equipo.
  const NOMBRES = { baliza: 'Baliza', gps: 'GPS', extintor: 'Extintor', parada: 'Parada de emergencia', rotulo_frc: 'Rótulo FRC', afi: 'N° AFI',
    rotulo_cap: 'Rótulo capacidades', rotulo_uso: 'Rótulo uso', rotulo_mant: 'Rótulo mantención',
    sen_bloqueo: 'Señalética bloqueo', sen_bateria: 'Señalética batería', sen_atrap: 'Señalética atrapamiento', sen_energias: 'Señalética energías', sen_comb: 'Señalética combustible',
    huincha: 'Huincha reflectante', bandeja: 'Bandeja antiderrame', termoseal: 'Termoseal escape',
    bloqueo: 'Punto de bloqueo', bateria: 'Batería', guardas: 'Guardas partes móviles', barra_cooper: 'Barra Cooper', hoja_comb: 'Hoja seguridad combustible',
    gata: 'Gata', llave_rueda: 'Llave de rueda', repuesto: 'Neumático repuesto', triangulos: 'Triángulos', chaleco: 'Chaleco reflectante', botiquin: 'Botiquín', documentos: 'Documentos',
    cunas: 'Cuñas', caballete: 'Caballete', pertiga: 'Pértiga', alarma_retro: 'Alarma retroceso', antiderrame: 'Kit antiderrame' };
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const capa = document.createElement('div');
  capa.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;font-family:Inter,system-ui,sans-serif';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svgL = document.createElementNS(SVGNS, 'svg'); svgL.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible';
  capa.appendChild(svgL); host.appendChild(capa);
  let conNombres = opciones.nombres !== false;
  const etiquetas = [];
  Object.entries(NOMBRES).forEach(([k, txt]) => (items[k] || []).forEach(obj => {
    const caja3 = new THREE.Box3().setFromObject(obj), p = caja3.getCenter(new THREE.Vector3());
    if (k === 'huincha' || k === 'bandeja') p.z = caja3.max.z;   // en la cara de adelante, no en el centro del equipo
    const local = equipo.worldToLocal(p.clone());
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;left:0;top:0;pointer-events:auto;cursor:pointer;white-space:nowrap;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.95);border:1.5px solid #2f8a4c;color:#1f2937;box-shadow:0 1px 3px rgba(0,0,0,.15)';
    d.textContent = txt;
    d.addEventListener('click', (ev) => { ev.stopPropagation(); onPick && onPick(k); });
    const linea = document.createElementNS(SVGNS, 'polyline'); linea.setAttribute('fill', 'none'); linea.setAttribute('stroke-width', '1.3');
    const punto = document.createElementNS(SVGNS, 'circle'); punto.setAttribute('r', '3.5'); punto.setAttribute('stroke', '#fff'); punto.setAttribute('stroke-width', '1.5');
    svgL.appendChild(linea); svgL.appendChild(punto); capa.appendChild(d);
    etiquetas.push({ k, local, d, linea, punto, col: '#2f8a4c' });
  }));
  const pintarEtiquetas = () => etiquetas.forEach(et => {
    const e = estados[et.k];
    et.col = e === 'MALO' ? '#dc2626' : e === 'NA' ? '#94a3b8' : '#2f8a4c';
    et.d.style.borderColor = et.col; et.d.style.color = e === 'MALO' ? '#b91c1c' : '#1f2937';
    et.linea.setAttribute('stroke', et.col); et.punto.setAttribute('fill', et.col);
  });
  pintarEtiquetas();
  // Los nombres van en dos columnas (izquierda y derecha) con una línea hasta su punto: así no se tapan entre ellos
  const vW = new THREE.Vector3(), dirR = new THREE.Vector3(), rayoE = new THREE.Raycaster();
  const ALTO = 22, MARGEN = 14, ARRIBA = 64, ABAJO = 54;
  const moverEtiquetas = () => {
    const w = host.clientWidth, h = host.clientHeight;
    const vis = [];
    etiquetas.forEach(et => {
      const ocultar = () => { et.d.style.display = 'none'; et.linea.style.display = 'none'; et.punto.style.display = 'none'; };
      if (!conNombres) return ocultar();
      vW.copy(et.local); equipo.localToWorld(vW);
      dirR.copy(vW).sub(camera.position); const dist = dirR.length(); dirR.normalize();
      rayoE.set(camera.position, dirR); rayoE.far = dist + 0.02;
      const hit = rayoE.intersectObjects(equipo.children, true)[0];
      if (hit && hit.distance < dist - 0.06 && hit.object.userData.k !== et.k) return ocultar();   // queda detrás del equipo
      const sp = vW.clone().project(camera);
      et.ax = (sp.x * 0.5 + 0.5) * w; et.ay = (-sp.y * 0.5 + 0.5) * h;
      vis.push(et);
    });
    // un solo nombre por elemento aunque tenga dos (paradas, rótulos FRC): el más cercano al borde de su lado
    const unicos = new Map();
    vis.forEach(et => { const o = unicos.get(et.k); if (!o || Math.abs(et.ax - w / 2) > Math.abs(o.ax - w / 2)) unicos.set(et.k, et); });
    vis.forEach(et => { if (unicos.get(et.k) !== et) { et.d.style.display = 'none'; et.linea.style.display = 'none'; et.punto.style.display = 'none'; } });
    const lista = [...unicos.values()];
    [lista.filter(et => et.ax < w / 2), lista.filter(et => et.ax >= w / 2)].forEach((lado, iz) => {
      const izq = iz === 0;
      lado.sort((a, b) => a.ay - b.ay);
      let y = ARRIBA - ALTO;
      lado.forEach(et => { y = Math.max(et.ay, y + ALTO + 4); et.ly = y; });
      const exceso = (lado.length ? lado[lado.length - 1].ly : 0) - (h - ABAJO);
      if (exceso > 0) { let lim = h - ABAJO; for (let i = lado.length - 1; i >= 0; i--) { lado[i].ly = Math.min(lado[i].ly, lim); lim = lado[i].ly - ALTO - 4; } }
      lado.forEach(et => {
        const dw = et.d.offsetWidth || 90, lx = izq ? MARGEN : w - MARGEN - dw, bordeX = izq ? lx + dw : lx, codo = izq ? bordeX + 14 : bordeX - 14;
        et.d.style.display = 'block'; et.linea.style.display = ''; et.punto.style.display = '';
        et.d.style.transform = `translate(${lx}px, ${et.ly - ALTO / 2}px)`;
        et.linea.setAttribute('points', `${bordeX},${et.ly} ${codo},${et.ly} ${et.ax},${et.ay}`);
        et.punto.setAttribute('cx', et.ax); et.punto.setAttribute('cy', et.ay);
      });
    });
  };

  // ---------- animación ----------
  let vivo = true, t0 = performance.now();
  const tick = (t) => {
    if (!vivo) return;
    const s = (t - t0) / 1000;
    if (auto) ang += 0.004;
    ubicarCamara();
    const pulso = 0.5 + 0.5 * Math.sin(s * 5);
    rojo.emissiveIntensity = 0.25 + pulso * 0.9;
    Object.values(items).flat().forEach(g => g.scale.setScalar(1));
    if (resaltado && items[resaltado]) items[resaltado].forEach(g => g.scale.setScalar(1.25 + 0.1 * pulso));
    (items.baliza || []).forEach(g => g.traverse(o => { if (o.userData.baliza && estados.baliza !== 'MALO') o.material.emissiveIntensity = 0.6 + pulso * 1.4; }));
    renderer.render(scene, camera);
    moverEtiquetas();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const ro = new ResizeObserver(() => { const w = host.clientWidth, h = host.clientHeight; if (w && h) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); } });
  ro.observe(host);

  return {
    figura: fig,
    actualizar(nuevos) { estados = nuevos || {}; aplicarEstados(); pintarEtiquetas(); },
    nombres(v) { conNombres = v; },
    resaltar(k) { resaltado = k; },
    vista(v) { auto = false; ang = { frente: 0, lado: -Math.PI / 2, atras: Math.PI, arriba: ang }[v] ?? ang; if (v === 'arriba') alt = 1.1; else alt = ALT0; },
    girar(v) { auto = v; },
    destruir() { vivo = false; ro.disconnect(); renderer.dispose(); el.remove(); capa.remove(); }
  };
}
