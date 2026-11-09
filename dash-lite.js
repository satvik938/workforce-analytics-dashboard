/*
 * dash-lite.js — a tiny data/drawing layer for a static dashboard.
 *  - dash.data(id)        -> { status, data } where data is the parsed rows of a CSV table
 *  - dash.draw(name, fn)  -> calls fn(el) for every element with data-draw="name",
 *                            on load and again whenever the window is resized
 * Tables are bundled in data.js (window.DASH_DATA) by src/build_metrics.py.
 */
(function () {
  const cache = {};
  const drawings = [];
  window.dash = {
    colors: ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'],
    data(id) {
      const src = (window.DASH_DATA || {})[id];
      if (src == null) return { status: 'error', data: [] };
      if (!cache[id]) cache[id] = d3.csvParse(src.trim());
      return { status: 'ok', data: cache[id] };
    },
    draw(name, fn) { drawings.push([name, fn]); }
  };
  function run() {
    drawings.forEach(([name, fn]) => {
      document.querySelectorAll(`[data-draw="${name}"]`).forEach((el) => {
        try { fn(el); } catch (e) { console.error(`Drawing "${name}" failed`, e); }
      });
    });
  }
  let lastW = 0, t;
  window.addEventListener('load', () => { lastW = window.innerWidth; run(); });
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(t); t = setTimeout(run, 150);
  });
})();
