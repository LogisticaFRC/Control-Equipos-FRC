// =====================================================================
// ÍCONOS del check list de vehículo (EVL-FRC) · 2026-11-25
// SVG propios (viewBox 64×64), estilo plano FRC. Se usan en el formulario de la app,
// en la hoja imprimible (plantillas/checklist-vehiculo-FRC.pdf) y en el perfil.
// =====================================================================
const S = (cuerpo) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke-linecap="round" stroke-linejoin="round">${cuerpo}</svg>`;
const O = '#1f2937', V = '#1f8a4c', R = '#dc2626', A = '#f5b400', G = '#9aa4ae';

export const ICONOS_VEH = {
  gata: S(`<rect x="10" y="50" width="44" height="6" rx="2" fill="${O}"/><path d="M32 46 L18 32 L32 18 L46 32 Z" stroke="${V}" stroke-width="5"/><rect x="24" y="12" width="16" height="5" rx="1.5" fill="${O}"/><path d="M8 32 H56" stroke="${G}" stroke-width="3"/><circle cx="56" cy="32" r="3.5" fill="${O}"/><path d="M32 46 V50" stroke="${O}" stroke-width="4"/>`),
  llave_rueda: S(`<path d="M12 12 L52 52 M52 12 L12 52" stroke="${G}" stroke-width="6"/><circle cx="12" cy="12" r="6" fill="${O}"/><circle cx="52" cy="12" r="6" fill="${O}"/><circle cx="12" cy="52" r="6" fill="${O}"/><circle cx="52" cy="52" r="6" fill="${O}"/><circle cx="32" cy="32" r="4" fill="${V}"/>`),
  repuesto: S(`<circle cx="32" cy="32" r="26" fill="${O}"/><circle cx="32" cy="32" r="15" fill="${G}"/><circle cx="32" cy="32" r="5" fill="${O}"/>${[0, 72, 144, 216, 288].map(a => `<circle cx="${(32 + 10 * Math.cos(a * Math.PI / 180)).toFixed(1)}" cy="${(32 + 10 * Math.sin(a * Math.PI / 180)).toFixed(1)}" r="2" fill="${O}"/>`).join('')}<path d="M10 24 A24 24 0 0 1 20 11" stroke="#4b5563" stroke-width="3"/>`),
  triangulos: S(`<path d="M32 8 L58 52 H6 Z" fill="${R}"/><path d="M32 22 L46 46 H18 Z" fill="#fff"/><path d="M20 52 L14 60 M44 52 L50 60" stroke="${O}" stroke-width="3"/>`),
  extintor: S(`<rect x="22" y="18" width="18" height="40" rx="7" fill="${R}"/><rect x="26" y="10" width="10" height="9" rx="2" fill="${O}"/><path d="M36 13 H48 M27 11 L22 6" stroke="${O}" stroke-width="3"/><path d="M40 22 C52 24 52 40 46 46" stroke="${O}" stroke-width="3"/><rect x="25" y="30" width="12" height="10" rx="1.5" fill="#fff"/><circle cx="31" cy="35" r="2.5" fill="${V}"/>`),
  chaleco: S(`<path d="M20 8 L26 8 L32 18 L38 8 L44 8 L54 18 L50 30 L50 58 L14 58 L14 30 L10 18 Z" fill="#c6e632" stroke="#8aa61d" stroke-width="2"/><rect x="14" y="36" width="36" height="5" fill="#e5e7eb"/><rect x="14" y="46" width="36" height="5" fill="#e5e7eb"/><path d="M32 18 V58" stroke="#8aa61d" stroke-width="2"/>`),
  botiquin: S(`<rect x="8" y="18" width="48" height="38" rx="5" fill="#fff" stroke="${O}" stroke-width="3"/><path d="M24 18 V12 H40 V18" stroke="${O}" stroke-width="3"/><path d="M32 26 V48 M21 37 H43" stroke="${R}" stroke-width="7"/>`),
  cunas: S(`<path d="M6 56 L30 56 L30 34 Z" fill="${A}" stroke="${O}" stroke-width="2"/><path d="M34 56 L58 56 L34 34 Z" fill="${A}" stroke="${O}" stroke-width="2"/><circle cx="32" cy="22" r="14" fill="${O}" opacity=".85"/><circle cx="32" cy="22" r="6" fill="${G}"/><path d="M4 58 H60" stroke="${O}" stroke-width="3"/>`),
  caballete: S(`<path d="M20 22 H44" stroke="${O}" stroke-width="5"/><path d="M22 16 V22 M42 16 V22" stroke="${O}" stroke-width="4"/><rect x="29" y="22" width="6" height="22" fill="${G}"/><path d="M32 30 L12 56 M32 30 L52 56 M32 30 V56" stroke="${R}" stroke-width="5"/><path d="M8 58 H56" stroke="${O}" stroke-width="3"/>`),
  documentos: S(`<rect x="14" y="8" width="32" height="44" rx="3" fill="#fff" stroke="${O}" stroke-width="3"/><rect x="20" y="14" width="32" height="44" rx="3" fill="#fff" stroke="${O}" stroke-width="3"/><path d="M26 26 H46 M26 33 H46 M26 40 H40" stroke="${G}" stroke-width="3"/><circle cx="44" cy="50" r="6" fill="${V}"/><path d="M41 50 L43.5 52.5 L47.5 47.5" stroke="#fff" stroke-width="2"/>`),
  baliza: S(`<rect x="16" y="46" width="32" height="10" rx="2" fill="${O}"/><path d="M20 46 V34 A12 12 0 0 1 44 34 V46 Z" fill="${A}"/><path d="M32 6 V14 M12 14 L17 20 M52 14 L47 20 M6 30 H12 M52 30 H58" stroke="${A}" stroke-width="3"/>`),
  pertiga: S(`<path d="M18 60 V6" stroke="${O}" stroke-width="4"/><path d="M18 8 L50 15 L18 24 Z" fill="#f97316"/><rect x="18" y="13" width="30" height="3" fill="#fff" opacity=".9"/><circle cx="18" cy="6" r="3" fill="${R}"/><path d="M10 60 H26" stroke="${O}" stroke-width="3"/>`),
  alarma_retro: S(`<path d="M8 26 H18 L30 14 V50 L18 38 H8 Z" fill="${O}"/><path d="M38 22 A14 14 0 0 1 38 42 M44 16 A22 22 0 0 1 44 48" stroke="${A}" stroke-width="4"/><path d="M50 56 H34 M38 52 L34 56 L38 60" stroke="${R}" stroke-width="3"/>`),
  antiderrame: S(`<path d="M14 18 H50 L46 58 H18 Z" fill="${V}"/><rect x="12" y="12" width="40" height="7" rx="2" fill="${O}"/><path d="M32 26 C26 34 24 38 24 42 A8 8 0 0 0 40 42 C40 38 38 34 32 26 Z" fill="#111827"/><path d="M14 30 H50" stroke="#fff" stroke-width="2" opacity=".6"/>`),
  gps: S(`<path d="M32 58 C20 42 14 34 14 25 A18 18 0 0 1 50 25 C50 34 44 42 32 58 Z" fill="${V}"/><circle cx="32" cy="25" r="7" fill="#fff"/><path d="M44 8 A12 12 0 0 1 54 18 M46 2 A18 18 0 0 1 60 16" stroke="${O}" stroke-width="3"/>`)
};
/** Ícono como dataURL (para <img> o para dibujarlo en un PDF). */
export const iconoUrl = (k) => (ICONOS_VEH[k] ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ICONOS_VEH[k]) : '');
