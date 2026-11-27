// =====================================================================
// FOTOS · CÁMARA O GALERÍA (2026-11-27)
// En celular/tablet, al tocar cualquier botón para subir una foto (input type=file que acepta imágenes)
// aparece una hoja con dos opciones: "Tomar foto" (abre la cámara) o "Galería / archivos".
// Funciona en toda la app sin cambiar cada pantalla. En computador se abre el selector de archivos normal.
// =====================================================================
let pasar = null;   // input que se deja abrir (la segunda vez, ya elegida la opción)
const esTactil = () => window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

const cerrarHoja = () => { const h = document.getElementById('hoja-foto'); if (h) h.remove(); };

const abrirCon = (inp, camara) => {
  const capOriginal = inp.getAttribute('capture');
  if (camara) inp.setAttribute('capture', 'environment'); else inp.removeAttribute('capture');
  pasar = inp;
  inp.click();
  // se deja el atributo como estaba para la próxima vez
  setTimeout(() => { if (capOriginal == null) inp.removeAttribute('capture'); else inp.setAttribute('capture', capOriginal); }, 500);
};

const mostrarHoja = (inp) => {
  cerrarHoja();
  const acepta = String(inp.accept || '');
  const conArchivos = /pdf|xls|doc/i.test(acepta);
  const h = document.createElement('div');
  h.id = 'hoja-foto';
  h.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(2,6,23,.55);display:flex;align-items:flex-end;justify-content:center';
  h.innerHTML = `
    <div style="background:#fff;width:100%;max-width:520px;border-radius:22px 22px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom));box-shadow:0 -10px 30px rgba(0,0,0,.25);font-family:inherit">
      <div style="width:44px;height:5px;border-radius:9px;background:#cbd5e1;margin:0 auto 12px"></div>
      <p style="font-weight:900;color:#1f4d3a;font-size:15px;margin:0 0 12px;text-align:center">Agregar foto</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button type="button" data-op="camara" style="padding:18px 8px;border-radius:16px;border:2px solid #047857;background:#059669;color:#fff;font-weight:900;font-size:15px;display:flex;flex-direction:column;align-items:center;gap:8px">
          <i class="fa-solid fa-camera" style="font-size:28px"></i>Tomar foto</button>
        <button type="button" data-op="galeria" style="padding:18px 8px;border-radius:16px;border:2px solid #64748b;background:#fff;color:#1e293b;font-weight:900;font-size:15px;display:flex;flex-direction:column;align-items:center;gap:8px">
          <i class="fa-solid ${conArchivos ? 'fa-folder-open' : 'fa-images'}" style="font-size:28px"></i>${conArchivos ? 'Galería / archivo' : 'Galería'}</button>
      </div>
      <button type="button" data-op="cancelar" style="margin-top:10px;width:100%;padding:13px;border-radius:14px;border:2px solid #e2e8f0;background:#f8fafc;color:#475569;font-weight:800">Cancelar</button>
    </div>`;
  h.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-op]');
    if (!b) { if (ev.target === h) cerrarHoja(); return; }
    const op = b.dataset.op;
    cerrarHoja();
    if (op === 'camara') abrirCon(inp, true);
    else if (op === 'galeria') abrirCon(inp, false);
  });
  document.body.appendChild(h);
};

export const activarElegirFoto = () => {
  if (window.__elegirFoto) return;
  window.__elegirFoto = true;
  document.addEventListener('click', (ev) => {
    const inp = ev.target;
    if (!(inp instanceof HTMLInputElement) || inp.type !== 'file' || inp.disabled) return;
    if (!/image/i.test(inp.accept || '')) return;
    if (inp === pasar) { pasar = null; return; }   // ya se eligió cámara o galería
    if (!esTactil()) return;                        // computador: selector normal
    ev.preventDefault(); ev.stopPropagation();
    mostrarHoja(inp);
  }, true);
};
