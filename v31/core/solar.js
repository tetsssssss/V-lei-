/* V3.1 · solar.js — pôr do sol/nascer/elevação do Sol (algoritmo NOAA simplificado). ESTIMATIVA ±2 min. Sem DOM. */
(function (root, factory) {
  const api = factory(root.V31 || (root.V31 = {}));
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (V31) {
  'use strict';
  const R = Math.PI / 180;
  function dayOfYear(y, m, d) { return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000); }
  function core(iso, minutesLocal, lat, lon, tz) {
    const [y, m, d] = iso.split('-').map(Number), n = dayOfYear(y, m, d);
    const g = (2 * Math.PI / 365) * (n - 1 + (minutesLocal / 60 - 12) / 24);
    const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    return { eqt, decl };
  }
  /** Minutos locais (desde 00:00) de nascer e pôr do sol. null se não houver (polar). */
  function sunTimes(iso, lat, lon, tz = -3) {
    const out = {};
    for (const k of ['rise', 'set']) {
      let t = k === 'rise' ? 360 : 1080;
      for (let i = 0; i < 3; i++) {
        const { eqt, decl } = core(iso, t, lat, lon, tz);
        const cosH = (Math.cos(90.833 * R) / (Math.cos(lat * R) * Math.cos(decl))) - Math.tan(lat * R) * Math.tan(decl);
        if (cosH < -1 || cosH > 1) return null;
        const ha = Math.acos(cosH) / R;
        t = k === 'rise' ? 720 - 4 * (lon + ha) - eqt + tz * 60 : 720 - 4 * (lon - ha) - eqt + tz * 60;
      }
      out[k] = t;
    }
    return out;
  }
  /** Elevação do Sol em graus no minuto local dado. */
  function elevation(iso, minutesLocal, lat, lon, tz = -3) {
    const { eqt, decl } = core(iso, minutesLocal, lat, lon, tz);
    const ha = ((minutesLocal + eqt + 4 * lon - 60 * tz) / 4 - 180) * R;
    const el = Math.asin(Math.sin(lat * R) * Math.sin(decl) + Math.cos(lat * R) * Math.cos(decl) * Math.cos(ha));
    return el / R;
  }
  /** 0 = pleno dia … 1 = noite fechada (crepúsculo suave entre +2° e −12°). */
  const darkness = el => Math.min(1, Math.max(0, (2 - el) / 14));
  Object.assign(V31, { solar: { sunTimes, elevation, darkness } });
  return V31.solar;
});
