// =====================================================================
// CORE · EQUIVALENCIAS DE FILTROS (libro de referencia cruzada FRC) · 2026-11-16
// ---------------------------------------------------------------------
// Para que al escribir un código de filtro (en una mantención, bodega, etc.) se sepa al tiro
// de qué MARCA es y cuáles son sus EQUIVALENTES en las otras marcas.
//   identificarMarca('BF7915')  → { marca: 'BALDWIN', seguro: true }
//   equivalentesDe('P550345')   → [{ familia, tipo, marca, codigo, ... }]  (Fleetguard FF5040, Baldwin BF7915, ...)
// Datos: investigación web (finditparts, industrialstop, oilfilter-crossreference, fridayparts, filterfinder).
// conf: CONFIRMADO = 2+ fuentes coinciden · 1 FUENTE = verificar medidas (rosca, alto, Ø) antes de usar.
// Más adelante: pasar a tabla editable en Supabase (bd_filtros_equivalencias).
// =====================================================================

export const FAMILIAS_FILTROS = [
 {
  "id": "ACE-01",
  "tipo": "ACEITE MOTOR",
  "ref": "LF3345",
  "spec": "Rosca 1-16 UN · alto 138 mm · Ø 93 mm",
  "conf": "1 FUENTE",
  "fuentes": [
   "finditparts.com"
  ],
  "notas": "El código Atlas Copco 1092471700 de la lista FRC aparece como equivalente.",
  "marcas": {
   "FLEETGUARD": [
    "LF3345"
   ],
   "BALDWIN": [
    "BT427",
    "B7117"
   ],
   "DONALDSON": [
    "P558616"
   ],
   "WIX": [
    "51602"
   ],
   "MANN": [
    "W940/34"
   ],
   "FRAM": [
    "PH3900"
   ],
   "HENGST": [],
   "ATLAS COPCO": [
    "1092471700"
   ],
   "CUMMINS": [
    "3908616",
    "3903224"
   ],
   "LUBER-FINER": [
    "LFP3900"
   ]
  }
 },
 {
  "id": "ACE-02",
  "tipo": "ACEITE MOTOR",
  "ref": "LF3403",
  "spec": "Alto 65 mm · Ø 76 mm",
  "conf": "CONFIRMADO",
  "fuentes": [
   "oilfilter-crossreference.com",
   "finditparts.com"
  ],
  "notas": "LF3403 y LF3591 cruzan con el mismo Baldwin B179 / Mann W811/80 / WIX 51064 (casi iguales; revisar alto).",
  "marcas": {
   "FLEETGUARD": [
    "LF3403"
   ],
   "BALDWIN": [
    "B179",
    "B7276"
   ],
   "DONALDSON": [
    "P550162"
   ],
   "MANN": [
    "W811/80"
   ],
   "WIX": [
    "51064"
   ],
   "FRAM": [
    "PH5796"
   ],
   "HENGST": [
    "H13W01"
   ]
  }
 },
 {
  "id": "ACE-03",
  "tipo": "ACEITE MOTOR",
  "ref": "LF3591",
  "spec": "Rosca M20 x 1.5 · alto 72 mm · Ø 80 mm",
  "conf": "CONFIRMADO",
  "fuentes": [
   "finditparts.com",
   "oilfilter-crossreference.com"
  ],
  "notas": "Mismo Baldwin B179 que LF3403.",
  "marcas": {
   "FLEETGUARD": [
    "LF3591"
   ],
   "BALDWIN": [
    "B179"
   ],
   "DONALDSON": [
    "P550726"
   ],
   "MANN": [
    "W811/80"
   ],
   "WIX": [
    "51064"
   ],
   "CUMMINS": [
    "1220833"
   ],
   "LUBER-FINER": [
    "PH2808"
   ]
  }
 },
 {
  "id": "ACE-04",
  "tipo": "ACEITE MOTOR",
  "ref": "LF3959",
  "spec": "Rosca 1-16 UN · alto 177 mm · Ø 93 mm",
  "conf": "1 FUENTE",
  "fuentes": [
   "finditparts.com"
  ],
  "notas": "",
  "marcas": {
   "FLEETGUARD": [
    "LF3959"
   ],
   "BALDWIN": [
    "BT7349",
    "BT7339"
   ],
   "MANN": [
    "W10004"
   ],
   "FRAM": [
    "PH3976A"
   ],
   "CUMMINS": [
    "3937695"
   ]
  }
 },
 {
  "id": "ACE-05",
  "tipo": "ACEITE MOTOR",
  "ref": "LF14000NN",
  "spec": "Rosca M95 x 2.5 · alto 295 mm · Ø 120 mm",
  "conf": "1 FUENTE",
  "fuentes": [
   "finditparts.com"
  ],
  "notas": "Filtro combinado NanoNet (Cummins ISX/X15).",
  "marcas": {
   "FLEETGUARD": [
    "LF14000NN"
   ],
   "BALDWIN": [
    "BD7154",
    "BD50000"
   ],
   "DONALDSON": [
    "P559000",
    "DBL7900"
   ],
   "WIX": [
    "57744XE"
   ],
   "FRAM": [
    "PH8691"
   ],
   "LUBER-FINER": [
    "LFP9001XL"
   ],
   "CUMMINS": [
    "4367100"
   ],
   "ATLAS COPCO": [
    "2657899346"
   ]
  }
 },
 {
  "id": "ACE-06",
  "tipo": "ACEITE MOTOR",
  "ref": "LF17475",
  "spec": "Rosca M24 x 1.5 · alto 210 mm · Ø 92 mm",
  "conf": "1 FUENTE",
  "fuentes": [
   "finditparts.com"
  ],
  "notas": "El Baldwin B7378 de la lista FRC es su equivalente.",
  "marcas": {
   "FLEETGUARD": [
    "LF17475"
   ],
   "BALDWIN": [
    "B7378"
   ],
   "DONALDSON": [
    "P550920"
   ],
   "MANN": [
    "W96250",
    "W9071"
   ],
   "WIX": [
    "57325"
   ],
   "CAT": [
    "2698325"
   ],
   "PERKINS": [
    "2654A111"
   ],
   "FRAM": [
    "PH11583"
   ],
   "HENGST": [
    "H384W"
   ],
   "LUBER-FINER": [
    "LFP2698"
   ]
  }
 },
 {
  "id": "ACE-07",
  "tipo": "ACEITE MOTOR",
  "ref": "B7177",
  "spec": "Spin-on (medidas: revisar)",
  "conf": "CONFIRMADO",
  "fuentes": [
   "finditparts.com",
   "allprodiesel.net"
  ],
  "notas": "",
  "marcas": {
   "BALDWIN": [
    "B7177"
   ],
   "FLEETGUARD": [
    "LF3970"
   ],
   "DONALDSON": [
    "P559675",
    "P551019"
   ],
   "MANN": [
    "W951"
   ],
   "WIX": [
    "57182"
   ],
   "FRAM": [
    "PH8942"
   ],
   "LUBER-FINER": [
    "LFP3970"
   ],
   "CUMMINS": [
    "3937736"
   ]
  }
 },
 {
  "id": "ACE-08",
  "tipo": "ACEITE MOTOR",
  "ref": "BT216",
  "spec": "Alto 136 mm · Ø 94 mm",
  "conf": "1 FUENTE",
  "fuentes": [
   "finditparts.com"
  ],
  "notas": "Usado en Perkins / FG Wilson.",
  "marcas": {
   "BALDWIN": [
    "BT216"
   ],
   "FLEETGUARD": [
    "LF701"
   ],
   "DONALDSON": [
    "P550403",
    "P554403"
   ],
   "MANN": [
    "W940/24"
   ],
   "WIX": [
    "51806"
   ],
   "CAT": [
    "7W2327"
   ],
   "PERKINS": [
    "2654403"
   ],
   "FG WILSON": [
    "901102"
   ],
   "FRAM": [
    "PH2821A"
   ],
   "HENGST": [
    "H17W06"
   ]
  }
 },
 {
  "id": "ACE-09",
  "tipo": "ACEITE MOTOR",
  "ref": "1R1808",
  "spec": "CAT C9-C18 / 3406-3508",
  "conf": "CONFIRMADO",
  "fuentes": [
   "industrialstop.com",
   "thedieselstore.com"
  ],
  "notas": "",
  "marcas": {
   "CAT": [
    "1R1808",
    "2752604"
   ],
   "BALDWIN": [
    "B7299"
   ],
   "DONALDSON": [
    "P551808"
   ],
   "WIX": [
    "57792"
   ],
   "LUBER-FINER": [
    "LFP4005RN"
   ]
  }
 },
 {
  "id": "ACE-10",
  "tipo": "ACEITE MOTOR",
  "ref": "P502051",
  "spec": "Rosca M20 x 1.5 · alto 100 mm · Ø 80 mm",
  "conf": "1 FUENTE",
  "fuentes": [
   "finditparts.com"
  ],
  "notas": "El Baldwin B161S de la lista FRC es su equivalente (B161-S).",
  "marcas": {
   "DONALDSON": [
    "P502051"
   ],
   "BALDWIN": [
    "B161S"
   ],
   "ATLAS COPCO": [
    "2913311200"
   ],
   "FRAM": [
    "PH8172"
   ]
  }
 },
 {
  "id": "COM-01",
  "tipo": "COMBUSTIBLE",
  "ref": "FF5040",
  "spec": "Spin-on · alto 86 mm",
  "conf": "1 FUENTE",
  "fuentes": [
   "finditparts.com"
  ],
  "notas": "Baldwin BF7915 y Donaldson P550345 (ambos en la lista FRC) son el MISMO filtro. OJO: en el sistema P550345 está como BALDWIN y es DONALDSON.",
  "marcas": {
   "FLEETGUARD": [
    "FF5040"
   ],
   "BALDWIN": [
    "BF7915",
    "BF790"
   ],
   "DONALDSON": [
    "P550345",
    "P553045"
   ],
   "MANN": [
    "WK712/2"
   ],
   "WIX": [
    "33361"
   ],
   "FRAM": [
    "P4506"
   ],
   "HENGST": [
    "H30WK01"
   ],
   "ATLAS COPCO": [
    "9712540102"
   ],
   "LUBER-FINER": [
    "LFF3518"
   ]
  }
 },
 {
  "id": "COM-02",
  "tipo": "COMBUSTIBLE SEPARADOR",
  "ref": "FS1007",
  "spec": "Separador de agua · alto 294 mm",
  "conf": "1 FUENTE",
  "fuentes": [
   "finditparts.com"
  ],
  "notas": "",
  "marcas": {
   "FLEETGUARD": [
    "FS1007"
   ],
   "BALDWIN": [
    "BF1274-SPS"
   ],
   "MANN": [
    "WK1270"
   ],
   "WIX": [
    "33423"
   ],
   "CUMMINS": [
    "3101871"
   ],
   "LUBER-FINER": [
    "LFF1007"
   ]
  }
 },
 {
  "id": "COM-03",
  "tipo": "COMBUSTIBLE",
  "ref": "FF5507",
  "spec": "Secundario · alto 264 mm",
  "conf": "CONFIRMADO",
  "fuentes": [
   "finditparts.com",
   "ebay (FF5507 = BF7814)"
  ],
  "notas": "OJO: el equivalente Baldwin es BF7814; en la lista FRC está BF7813 (es OTRO filtro).",
  "marcas": {
   "FLEETGUARD": [
    "FF5507"
   ],
   "BALDWIN": [
    "BF7814"
   ],
   "DONALDSON": [
    "P550529"
   ],
   "MANN": [
    "WDK11102"
   ],
   "WIX": [
    "33721"
   ],
   "HENGST": [
    "H200WDK"
   ],
   "ATLAS COPCO": [
    "2914984900"
   ],
   "VOLVO": [
    "20430751"
   ]
  }
 },
 {
  "id": "COM-04",
  "tipo": "COMBUSTIBLE",
  "ref": "1R0749",
  "spec": "Rosca 1-14 · Ø 94 mm · 2 micras",
  "conf": "CONFIRMADO",
  "fuentes": [
   "industrialstop.com",
   "thedieselstore.com",
   "finditparts.com"
  ],
  "notas": "",
  "marcas": {
   "CAT": [
    "1R0749"
   ],
   "BALDWIN": [
    "BF7587"
   ],
   "FLEETGUARD": [
    "FF5319"
   ],
   "DONALDSON": [
    "P551311"
   ],
   "WIX": [
    "33674"
   ],
   "FRAM": [
    "P8335"
   ],
   "LUBER-FINER": [
    "LFF2749"
   ],
   "VOLVO": [
    "85114045"
   ]
  }
 },
 {
  "id": "AIR-01",
  "tipo": "AIRE PRIMARIO",
  "ref": "P772578",
  "spec": "Radial seal · alto 300 mm · Ø 104 mm",
  "conf": "CONFIRMADO",
  "fuentes": [
   "finditparts.com",
   "fridayparts.com",
   "filterfinder"
  ],
  "notas": "Fleetguard AF25539, Donaldson P772578 y Baldwin RS3954 (los 3 en la lista FRC) son el MISMO filtro.",
  "marcas": {
   "DONALDSON": [
    "P772578",
    "P775631"
   ],
   "FLEETGUARD": [
    "AF25539"
   ],
   "BALDWIN": [
    "RS3954",
    "RS3546"
   ],
   "WIX": [
    "42801"
   ],
   "ATLAS COPCO": [
    "4700939802"
   ],
   "PERKINS": [
    "26510362"
   ],
   "FG WILSON": [
    "901-046"
   ]
  }
 }
];

/** Código normalizado para comparar: sin espacios, guiones, puntos ni barras, en mayúsculas. */
export const normCodigo = (c) => String(c || '').toUpperCase().replace(/[\s\-./]/g, '');

// Índice código → [{ familia, marca }]
const INDICE = new Map();
FAMILIAS_FILTROS.forEach(f => Object.entries(f.marcas).forEach(([marca, cods]) => cods.forEach(codigo => {
  const k = normCodigo(codigo);
  if (!INDICE.has(k)) INDICE.set(k, []);
  INDICE.get(k).push({ familia: f, marca, codigo });
})));

/** Reglas por forma del código (cuando no está en el libro). El orden importa. */
const REGLAS = [
  ['BALDWIN', /^(BF|BT|BD|BK|RS|PA|PF|PT|SA)\d/],
  ['BALDWIN', /^B\d{1,4}(S|-S)?$/],
  ['FLEETGUARD', /^(LF|FF|FS|AF|HF|WF|CS|UF)\d/],
  ['DONALDSON', /^(P\d{6}|DBL\d|DBA\d|DBF\d|DBH\d)/],
  ['TURBO', /^(TBC|TCE|TB|TC|TR)\d/],
  ['MANN', /^(WDK|WK|HU|CF|C|W)\d/],
  ['FRAM', /^(PH|CA|CH|P)\d{3,5}[A-Z]*$/],
  ['LUBER-FINER', /^LF[FP]\d/],
  ['HENGST', /^H\d+W/],
  ['KOHLER', /^ED\d/],
  ['PARKER', /^R\d{2,3}[A-Z]/],   // Racor
  ['ZENKAN', /^(9013\d{4}|9016\d{4}|KW\d)/],
  ['FG WILSON', /^(CH\d{8}|\d[A-Z]\d{4}100)$/],   // CH10930.310 · 7C1571.100
  ['ATLAS COPCO', /^\d{10}$/],
  ['CAT', /^\d[A-Z]\d{4}$/],
  ['CAT o PERKINS', /^\d{7}$/],
  ['WIX', /^\d{5}(MP|XE)?$/]
];

/** ¿De qué marca es este código? Primero busca en el libro (seguro); si no, adivina por la forma (probable). */
export const identificarMarca = (codigo) => {
  const k = normCodigo(codigo);
  if (!k) return null;
  const enLibro = INDICE.get(k);
  if (enLibro && enLibro.length) return { marca: enLibro[0].marca, seguro: true };
  const r = REGLAS.find(([, re]) => re.test(k));
  return r ? { marca: r[0], seguro: false } : { marca: 'DESCONOCIDA', seguro: false };
};

/** Familias donde aparece el código (normalmente 1). */
export const familiasDe = (codigo) => [...new Set((INDICE.get(normCodigo(codigo)) || []).map(x => x.familia))];

/** Equivalentes de un código en las otras marcas: [{ familia, tipo, conf, marca, codigo }] (sin el propio código). */
export const equivalentesDe = (codigo) => {
  const k = normCodigo(codigo);
  const propia = (identificarMarca(codigo) || {}).marca;
  const vistos = new Set([k]);
  return familiasDe(codigo).flatMap(f => Object.entries(f.marcas).flatMap(([marca, cods]) =>
    cods.map(c => ({ familia: f.id, tipo: f.tipo, conf: f.conf, spec: f.spec, notas: f.notas, marca, codigo: c }))))
    .filter(e => { const n = normCodigo(e.codigo); if (vistos.has(n)) return false; vistos.add(n); return true; })
    .sort((a, b) => (a.marca === propia) - (b.marca === propia));   // primero las OTRAS marcas
};

/** Texto corto para mostrar: "BALDWIN BF7915 · equivale a Fleetguard FF5040, Donaldson P550345…" */
export const resumenFiltro = (codigo, max = 4) => {
  const m = identificarMarca(codigo);
  if (!m) return '';
  const eq = equivalentesDe(codigo);
  const marcaTxt = m.marca + (m.seguro ? '' : ' (probable)');
  if (!eq.length) return `${marcaTxt} · sin equivalencias en el libro`;
  return `${marcaTxt} · equivale a ${eq.slice(0, max).map(e => e.marca + ' ' + e.codigo).join(', ')}${eq.length > max ? '…' : ''}`;
};
