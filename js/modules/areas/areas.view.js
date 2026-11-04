// =====================================================================
// ÁREAS · Componente (explorador Empresa → Área → Sector → Locación → Equipos + mapa)
// =====================================================================
import template from './areas.template.js';
import { comunes } from '../../core/comunes.js';
import { dbLocaciones, dbEquipos } from '../../core/store.js';
import { abrirPerfilEquipo } from '../inventario/perfil.service.js';
import * as S from './areas.service.js';

const { computed, watch, ref, nextTick, onBeforeUnmount } = Vue;

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default {
  name: 'AreasView',
  template,
  setup() {
    // Equipos que se listan según la carpeta abierta
    const equiposVisibles = computed(() => {
      if (S.nodoAbierto.value === 'SIN') return S.equiposSinLocacion.value;
      const n = S.nodoActual.value;
      if (!n) return [];
      return n.tipo === 'LOCACION' ? S.equiposDeLocacion(n.id) : S.equiposBajo(n.id);
    });
    const esAbierto = (n) => String(S.nodoAbierto.value) === String(n.id);
    const colorTipo = (t) => ({ EMPRESA: 'text-blue-600', AREA: 'text-amber-500', SECTOR: 'text-violet-600', LOCACION: 'text-emerald-600' }[t] || '');
    const fondoTipo = (t) => ({ EMPRESA: 'bg-blue-50/60 border-blue-100 hover:border-blue-400', AREA: 'bg-amber-50/60 border-amber-100 hover:border-amber-400', SECTOR: 'bg-violet-50/60 border-violet-100 hover:border-violet-400', LOCACION: 'bg-emerald-50/60 border-emerald-100 hover:border-emerald-400' }[t] || '');
    const rutaNodo = (n) => {
      const out = []; let x = n;
      while (x) { out.unshift(x.nombre); x = S.nodo(x.padreId); }
      return out.join(' › ');
    };
    // Si se recargan los datos y la carpeta abierta ya no existe, volver al inicio
    watch(dbLocaciones, S.validarNodoAbierto);

    // ------------------------------------------------------------------
    // MAPA (Leaflet + OpenStreetMap / satélite; cada punto abre Google Maps)
    // ------------------------------------------------------------------
    const errorMapa = ref('');
    let mapa = null, capaPuntos = null;
    const empresasEnMapa = computed(() => {
      const ids = new Set(S.puntosMapa.value.con.map(p => String(p.ruta.empresa?.id)));
      return S.empresas.value.filter(e => ids.has(String(e.id)));
    });

    const destruirMapa = () => { if (mapa) { mapa.remove(); mapa = null; capaPuntos = null; } };

    const pin = (L, p) => {
      const color = S.colorEmpresa(p.ruta.empresa?.id);
      const n = p.equipos.length;
      const aprox = p.coords.heredado;
      return L.divIcon({
        className: '',
        iconSize: [34, 42], iconAnchor: [17, 40], popupAnchor: [0, -36],
        html: `<div style="position:relative;width:34px;height:42px">
          <svg width="34" height="42" viewBox="0 0 34 42"><path d="M17 41C17 41 32 25 32 15.5A15 15 0 0 0 2 15.5C2 25 17 41 17 41Z" fill="${color}" stroke="white" stroke-width="2" ${aprox ? 'stroke-dasharray="4 3" fill-opacity="0.7"' : ''}/></svg>
          <span style="position:absolute;top:6px;left:0;width:34px;text-align:center;color:white;font:800 12px system-ui">${n}</span></div>`
      });
    };

    const popupHtml = (p) => {
      const r = p.ruta;
      const filas = p.equipos.map(e => `<tr>
          <td style="padding:2px 6px 2px 0"><a href="#" data-afi="${esc(e.id)}" style="font-weight:800;color:#b45309">${esc(e.afi)}</a></td>
          <td style="padding:2px 6px 2px 0">${esc(e.tipo)}</td><td style="padding:2px 0;color:#64748b">${esc(e.disponibilidad)}</td></tr>`).join('');
      return `<div style="font:12px system-ui;min-width:220px;max-width:300px">
        <div style="font-size:10px;color:#64748b;font-weight:700">${esc(r.empresa?.nombre)} › ${esc(r.area?.nombre)} › ${esc(r.sector?.nombre)}</div>
        <div style="font-weight:800;font-size:13px;margin-bottom:2px">${esc(p.loc.nombre)}</div>
        ${p.coords.heredado ? `<div style="font-size:10px;color:#b45309">Ubicación aprox. (de ${esc(p.coords.de.nombre)})</div>` : ''}
        <div style="max-height:180px;overflow:auto;margin:6px 0;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">
          ${filas ? `<table style="width:100%;font-size:11px">${filas}</table>` : '<div style="color:#94a3b8;padding:4px 0">Sin equipos</div>'}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <a href="${esc(S.googleMapsUrl(p.loc.id))}" target="_blank" rel="noopener" style="font-weight:700;color:#1d4ed8">Abrir en Google Maps</a>
          <a href="#" data-nodo="${esc(p.loc.id)}" style="font-weight:700;color:#047857">Ver carpeta</a></div></div>`;
    };

    const dibujarPuntos = () => {
      if (!mapa || !window.L) return;
      const L = window.L;
      capaPuntos.clearLayers();
      const pts = S.puntosMapa.value.con;
      // Puntos repetidos (varias locaciones con la misma coordenada heredada): se separan un poco
      const usados = new Map();
      const latlngs = pts.map(p => {
        const k = `${p.coords.lat.toFixed(5)},${p.coords.lng.toFixed(5)}`;
        const i = usados.get(k) || 0; usados.set(k, i + 1);
        const d = i ? 0.0004 * Math.ceil(i / 6) : 0, ang = (i % 6) * Math.PI / 3;
        const ll = [p.coords.lat + d * Math.sin(ang), p.coords.lng + d * Math.cos(ang)];
        L.marker(ll, { icon: pin(L, p), title: `${p.loc.nombre} (${p.equipos.length})` })
          .bindPopup(popupHtml(p), { maxWidth: 320 }).addTo(capaPuntos);
        return ll;
      });
      if (latlngs.length === 1) mapa.setView(latlngs[0], 15);
      else if (latlngs.length) mapa.fitBounds(L.latLngBounds(latlngs).pad(0.2), { maxZoom: 16 });
      else mapa.setView([-33.45, -70.66], 5);   // Chile
    };

    const crearMapa = async () => {
      errorMapa.value = '';
      await nextTick();
      const div = document.getElementById('mapaAreas');
      if (!div) return;
      let L;
      try { L = await S.cargarLeaflet(); } catch (err) { errorMapa.value = err.message; return; }
      if (!S.vistaMapa.value) return;
      destruirMapa();
      mapa = L.map(div, { scrollWheelZoom: true });
      const calles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
      const satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imágenes © Esri' });
      calles.addTo(mapa);
      L.control.layers({ 'Mapa': calles, 'Satélite': satelite }, null, { position: 'topright' }).addTo(mapa);
      capaPuntos = L.layerGroup().addTo(mapa);
      // Enlaces dentro del popup: AFI → perfil · Ver carpeta → abre la locación
      mapa.on('popupopen', (ev) => {
        const el = ev.popup.getElement(); if (!el) return;
        el.querySelectorAll('[data-afi]').forEach(a => a.addEventListener('click', (e) => {
          e.preventDefault();
          const eq = dbEquipos.value.find(x => String(x.id) === a.dataset.afi);
          if (eq) abrirPerfilEquipo(eq);
        }));
        el.querySelectorAll('[data-nodo]').forEach(a => a.addEventListener('click', (e) => {
          e.preventDefault(); S.vistaMapa.value = false; S.abrirNodo(a.dataset.nodo);
        }));
      });
      dibujarPuntos();
      setTimeout(() => mapa && mapa.invalidateSize(), 150);
    };

    watch(S.vistaMapa, (v) => { if (v) crearMapa(); else destruirMapa(); }, { immediate: true });
    watch(() => S.puntosMapa.value, () => { if (S.vistaMapa.value) dibujarPuntos(); });
    onBeforeUnmount(destruirMapa);

    return { ...comunes(), ...S, abrirPerfilEquipo, equiposVisibles, esAbierto, colorTipo, fondoTipo, rutaNodo, errorMapa, empresasEnMapa };
  }
};
