# Uso: python tools/generar_formato_ot.py plantillas/FORMATO_OT.xlsx js/modules/ot/ot.formato.js  (requiere: pip install openpyxl)
# Genera js/modules/ot/ot.formato.js a partir de FORMATO_OT.xlsx (réplica HTML exacta de la hoja)
import sys, json, base64, zipfile, re
import openpyxl
from openpyxl.utils import get_column_letter, column_index_from_string as ci

src, out = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(src); ws = wb.active
MAXC, MAXR = ci('AO'), 68

def colpx(c):
    d = ws.column_dimensions.get(get_column_letter(c))
    w = d.width if d is not None and d.width else 11.5546875
    # openpyxl agrupa rangos min..max en la letra "min"
    for k, v in ws.column_dimensions.items():
        if v.min and v.max and v.min <= c <= v.max and v.width: w = v.width
    return max(3, round(w * 7))   # px ≈ ancho × 7 (Arial/Calibri, 96 dpi)
cols = [colpx(c) for c in range(1, MAXC + 1)]
rows = []
for r in range(1, MAXR + 1):
    h = ws.row_dimensions[r].height if r in ws.row_dimensions and ws.row_dimensions[r].height else 13.2
    rows.append(round(h * 4 / 3, 1))

merged = {}
covered = set()
for m in ws.merged_cells.ranges:
    if m.min_col > MAXC: continue
    merged[(m.min_row, m.min_col)] = (m.max_row, min(m.max_col, MAXC))
    for rr in range(m.min_row, m.max_row + 1):
        for cc in range(m.min_col, min(m.max_col, MAXC) + 1):
            if (rr, cc) != (m.min_row, m.min_col): covered.add((rr, cc))

W = {'thin': 1, 'hair': 1, 'dotted': 1, 'dashed': 1, 'medium': 2, 'mediumDashed': 2, 'thick': 3, 'double': 3}
def side(cell, s):
    b = getattr(cell.border, s)
    return W.get(b.style, 1) if b is not None and b.style else 0

# campos editables: celda -> clave
campos = {'AL1': 'folio', 'G5': 'equipo', 'U5': 'marca', 'AF5': 'modelo', 'G7': 'afi', 'S7': 'hrs_actual', 'AG7': 'hrs_prox',
          'S9': 'tipo:PREVENTIVA', 'AB9': 'tipo:CORRECTIVA', 'AK9': 'tipo:PREDICTIVA', 'B65': 'mecanico', 'W65': 'supervisor'}
for i, r in enumerate(range(17, 37)):
    for c, k in zip(['C', 'Q', 'Y', 'AC', 'AG', 'AK'], ['descripcion', 'ejecutante', 'f_inicio', 'f_term', 'h_inicio', 'h_term']):
        campos[f'{c}{r}'] = f'act.{i}.{k}'
for i, r in enumerate(range(44, 54)):
    for c, k in zip(['C', 'K', 'Z', 'AF'], ['aceites', 'repuestos', 'fecha', 'retira']):
        campos[f'{c}{r}'] = f'ins.{i}.{k}'
for i, r in enumerate(range(57, 61)):
    campos[f'C{r}'] = f'per.{i}.nombre'; campos[f'N{r}'] = f'per.{i}.cargo'
for r, p in zip(range(57, 61), ['250', '500', '1000', '5000']):
    campos[f'AJ{r}'] = f'pauta:{p}'

celdas = []
for r in range(1, MAXR + 1):
    for c in range(1, MAXC + 1):
        if (r, c) in covered: continue
        r2, c2 = merged.get((r, c), (r, c))
        cell = ws.cell(r, c)
        top = max(side(ws.cell(r, cc), 'top') for cc in range(c, c2 + 1))
        bot = max(side(ws.cell(r2, cc), 'bottom') for cc in range(c, c2 + 1))
        lef = max(side(ws.cell(rr, c), 'left') for rr in range(r, r2 + 1))
        rig = max(side(ws.cell(rr, c2), 'right') for rr in range(r, r2 + 1))
        # bordes de las celdas vecinas (Excel los dibuja aunque estén en la otra celda)
        if r > 1: top = max(top, max(side(ws.cell(r - 1, cc), 'bottom') for cc in range(c, c2 + 1)))
        if c > 1: lef = max(lef, max(side(ws.cell(rr, c - 1), 'right') for rr in range(r, r2 + 1)))
        f = cell.font; a = cell.alignment
        v = cell.value
        t = '' if v is None else (str(int(v)) if isinstance(v, (int, float)) and float(v).is_integer() else str(v)).strip()
        d = {'r': r, 'c': c}
        if r2 > r: d['rs'] = r2 - r + 1
        if c2 > c: d['cs'] = c2 - c + 1
        if t: d['t'] = t
        b = [top, rig, bot, lef]
        if any(b): d['b'] = b
        if f.sz and f.sz != 10: d['fs'] = f.sz
        if f.b: d['fb'] = 1
        if f.name and 'Rockwell' in f.name: d['ff'] = 'r'
        h = a.horizontal
        if h in ('center', 'centerContinuous'): d['al'] = 'c'
        elif h == 'right': d['al'] = 'r'
        if a.wrap_text: d['wr'] = 1
        if a.vertical == 'top': d['va'] = 't'
        elif a.vertical == 'center': d['va'] = 'm'
        k = campos.get(f'{get_column_letter(c)}{r}')
        if k: d['k'] = k
        celdas.append(d)

z = zipfile.ZipFile(src)
img = base64.b64encode(z.read('xl/media/image1.png')).decode()
data = {'cols': cols, 'rows': rows, 'celdas': celdas,
        'logo': {'left': 19, 'top': 0, 'width': 134, 'height': 51, 'src': 'data:image/png;base64,' + img}}
with open(out, 'w', encoding='utf-8') as fh:
    fh.write('// =====================================================================\n')
    fh.write('// OT · Formato FRC-RE-OPE-006 (generado automáticamente desde plantillas/FORMATO_OT.xlsx)\n')
    fh.write('// cols/rows en px, celdas con combinaciones (rs/cs), bordes [arriba, der, abajo, izq] y campo editable (k).\n')
    fh.write('// No editar a mano: si cambia el Excel, volver a generar.\n')
    fh.write('// =====================================================================\n')
    fh.write('export const FORMATO_OT = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(len(celdas), 'celdas', sum(cols), 'px ancho', sum(rows), 'px alto')
