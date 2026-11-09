(function () {
  const parseM = d3.utcParse('%Y-%m');
  const fmtM = d3.utcFormat('%b %Y');
  const fmtMs = d3.utcFormat('%b');
  const C = () => (window.dash && dash.colors && dash.colors.length ? dash.colors : ['var(--color-fg)']);
  const reduce = !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function placeholder(el, st) {
    el.replaceChildren();
    const p = document.createElement('div');
    p.className = 'dc-empty';
    p.textContent = st === 'error' ? 'Failed to load' : (st === 'loading' ? '' : '—');
    if (st === 'loading') el.classList.add('dash-skeleton'); else el.classList.remove('dash-skeleton');
    el.appendChild(p);
  }

  function rowsOf(id, el) {
    const r = dash.data(id);
    if (r.status !== 'ok') { placeholder(el, r.status); return null; }
    el.classList.remove('dash-skeleton');
    return r.data;
  }

  function tip(el) {
    const t = document.createElement('div');
    t.className = 'dc-tip';
    t.hidden = true;
    el.appendChild(t);
    return {
      show(lines, x, y) {
        t.replaceChildren();
        lines.forEach((l, i) => {
          const d = document.createElement('div');
          if (i === 0) d.className = 'dc-tip-h';
          if (l.color) {
            const s = document.createElement('span');
            s.className = 'dc-sw'; s.style.background = l.color; d.appendChild(s);
          }
          d.appendChild(document.createTextNode(l.text));
          t.appendChild(d);
        });
        t.hidden = false;
        const w = el.clientWidth, tw = t.offsetWidth;
        let left = x + 12; if (left + tw > w) left = Math.max(0, x - tw - 12);
        t.style.left = left + 'px'; t.style.top = Math.max(0, y - 10) + 'px';
      },
      hide() { t.hidden = true; }
    };
  }

  function legend(el, items) {
    const l = document.createElement('div');
    l.className = 'dc-legend';
    items.forEach((it) => {
      const s = document.createElement('span');
      const sw = document.createElement('i');
      sw.className = it.dash ? 'dc-sw dc-sw-dash' : 'dc-sw';
      sw.style.background = it.dash ? 'transparent' : it.color;
      if (it.dash) sw.style.borderTopColor = it.color;
      s.appendChild(sw); s.appendChild(document.createTextNode(it.label));
      l.appendChild(s);
    });
    el.appendChild(l);
  }

  function measure(sel) {
    let m = 0;
    sel.selectAll('text').each(function () { m = Math.max(m, this.getComputedTextLength()); });
    return m;
  }

  // Line chart over months. o: {x, series:[{field,label}], fmt, ref:{value,label}, height, aria, yMin}
  function line(el, rows, o) {
    el.replaceChildren();
    const colors = C();
    const series = o.series.map((s, i) => ({ ...s, color: s.color || colors[i % colors.length] }));
    const items = series.map((s) => ({ label: s.label, color: s.color, dash: !!s.dashArray }));
    if (o.ref) items.push({ label: o.ref.label, color: 'var(--cds-chart-reference)', dash: true });
    if (items.length > 1 || o.showLegend) legend(el, items);
    const data = rows.map((r) => {
      const d = { x: parseM(r[o.x]) };
      series.forEach((s) => (d[s.field] = +r[s.field]));
      return d;
    });
    const W = Math.max(280, el.clientWidth), H = o.height || 240;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H)
      .attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', o.aria || '');
    const vals = data.flatMap((d) => series.map((s) => d[s.field]));
    if (o.ref) vals.push(o.ref.value);
    let lo = o.yMin != null ? o.yMin : d3.min(vals), hi = d3.max(vals);
    const pad = (hi - lo) * 0.12 || 1;
    const y0 = d3.scaleLinear().domain([o.yMin != null ? o.yMin : lo - pad, hi + pad]).nice();
    const m = { top: 10, right: 14, bottom: 26, left: 0 };
    const ya = svg.append('g').attr('class', 'dc-axis');
    y0.range([H - m.bottom, m.top]);
    ya.call(d3.axisLeft(y0).ticks(H < 220 ? 4 : 5).tickFormat(o.fmt).tickSize(0).tickPadding(6));
    m.left = measure(ya) + 10;
    ya.attr('transform', `translate(${m.left},0)`);
    ya.select('.domain').remove();
    const x = d3.scaleUtc().domain(d3.extent(data, (d) => d.x)).range([m.left + 6, W - m.right]);
    svg.insert('g', ':first-child').attr('class', 'dc-grid')
      .selectAll('line').data(y0.ticks(H < 220 ? 4 : 5)).join('line')
      .attr('x1', m.left).attr('x2', W - m.right).attr('y1', (d) => y0(d)).attr('y2', (d) => y0(d));
    const nT = W < 420 ? 4 : 6;
    const xa = svg.append('g').attr('class', 'dc-axis').attr('transform', `translate(0,${H - m.bottom})`)
      .call(d3.axisBottom(x).ticks(d3.utcMonth.every(Math.ceil(12 / nT))).tickFormat((d) => (d.getUTCMonth() === 0 || d === x.domain()[0] ? fmtM(d) : fmtMs(d))).tickSize(0).tickPadding(8));
    xa.select('.domain').attr('stroke', 'var(--cds-chart-axis)');
    if (o.ref) {
      svg.append('line').attr('class', 'dc-ref').attr('x1', m.left).attr('x2', W - m.right)
        .attr('y1', y0(o.ref.value)).attr('y2', y0(o.ref.value));
    }
    series.forEach((s) => {
      const p = svg.append('path').datum(data).attr('fill', 'none').style('stroke', s.color)
        .attr('stroke-width', 2.25).attr('stroke-linejoin', 'round')
        .attr('d', d3.line().x((d) => x(d.x)).y((d) => y0(d[s.field])));
      if (s.dashArray) p.attr('stroke-dasharray', s.dashArray);
      svg.append('g').selectAll('circle').data(data).join('circle').attr('r', 2.6)
        .attr('cx', (d) => x(d.x)).attr('cy', (d) => y0(d[s.field])).style('fill', s.color);
      if (!reduce && !el.dataset.played) {
        const L = p.node().getTotalLength();
        p.attr('stroke-dasharray', `${L} ${L}`).attr('stroke-dashoffset', L)
          .transition().duration(700).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0)
          .on('end', () => p.attr('stroke-dasharray', s.dashArray || null));
      }
    });
    el.dataset.played = '1';
    const rule = svg.append('line').attr('class', 'dc-rule').attr('y1', m.top).attr('y2', H - m.bottom).style('opacity', 0);
    const t = tip(el);
    svg.append('rect').attr('x', m.left).attr('y', 0).attr('width', W - m.left).attr('height', H)
      .attr('fill', 'transparent')
      .on('pointermove', (ev) => {
        const [px] = d3.pointer(ev);
        const i = d3.leastIndex(data, (d) => Math.abs(x(d.x) - px));
        const d = data[i];
        rule.attr('x1', x(d.x)).attr('x2', x(d.x)).style('opacity', 1);
        const [ex, ey] = d3.pointer(ev, el);
        t.show([{ text: fmtM(d.x) }, ...series.map((s) => ({ text: `${s.label}: ${o.fmt(d[s.field])}`, color: s.color }))], ex * (el.clientWidth / W > 0 ? 1 : 1), ey);
      })
      .on('pointerleave', () => { rule.style('opacity', 0); t.hide(); });
  }

  // Vertical bars over months. o: {x, y, fmt, height, aria, label}
  function bars(el, rows, o) {
    el.replaceChildren();
    const color = C()[o.colorIndex || 0];
    const data = rows.map((r) => ({ x: parseM(r[o.x]), y: +r[o.y] }));
    const W = Math.max(280, el.clientWidth), H = o.height || 220;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H)
      .attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', o.aria || '');
    const m = { top: 18, right: 8, bottom: 26, left: 0 };
    const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.y) * 1.1]).nice().range([H - m.bottom, m.top]);
    const ya = svg.append('g').attr('class', 'dc-axis').call(d3.axisLeft(y).ticks(4).tickFormat(o.axisFmt || o.fmt).tickSize(0).tickPadding(6));
    m.left = measure(ya) + 10; ya.attr('transform', `translate(${m.left},0)`); ya.select('.domain').remove();
    svg.insert('g', ':first-child').attr('class', 'dc-grid').selectAll('line').data(y.ticks(4)).join('line')
      .attr('x1', m.left).attr('x2', W - m.right).attr('y1', (d) => y(d)).attr('y2', (d) => y(d));
    const x = d3.scaleBand().domain(data.map((d) => d.x)).range([m.left + 4, W - m.right]).padding(0.28);
    const every = W < 420 ? 3 : 2;
    svg.append('g').attr('class', 'dc-axis').attr('transform', `translate(0,${H - m.bottom})`)
      .call(d3.axisBottom(x).tickValues(data.map((d) => d.x).filter((_, i) => i % every === 0)).tickFormat((d) => (d.getUTCMonth() === 0 || +d === +data[0].x ? fmtM(d) : fmtMs(d))).tickSize(0).tickPadding(8))
      .select('.domain').attr('stroke', 'var(--cds-chart-axis)');
    const b = svg.append('g').selectAll('rect').data(data).join('rect')
      .attr('x', (d) => x(d.x)).attr('width', x.bandwidth()).attr('rx', 2).style('fill', color)
      .attr('y', (d) => y(d.y)).attr('height', (d) => y(0) - y(d.y));
    if (!reduce && !el.dataset.played) b.attr('y', y(0)).attr('height', 0).transition().duration(600).ease(d3.easeCubicOut).attr('y', (d) => y(d.y)).attr('height', (d) => y(0) - y(d.y));
    el.dataset.played = '1';
    if (x.bandwidth() > 34) {
      svg.append('g').selectAll('text').data(data).join('text').attr('class', 'dc-val')
        .attr('x', (d) => x(d.x) + x.bandwidth() / 2).attr('y', (d) => y(d.y) - 4).attr('text-anchor', 'middle')
        .text((d) => (o.labelFmt || o.fmt)(d.y));
    }
    const t = tip(el);
    b.on('pointermove', (ev, d) => { const [ex, ey] = d3.pointer(ev, el); t.show([{ text: fmtM(d.x) }, { text: `${o.label}: ${o.fmt(d.y)}`, color }], ex, ey); })
      .on('pointerleave', () => t.hide());
  }

  // Horizontal bars. o: {label, value, fmt, ref:{value,label}, critBelow, extra:[{field,label,fmt}], aria, colorIndex, domainMin}
  function hbar(el, rows, o) {
    el.replaceChildren();
    const base = C()[o.colorIndex || 0];
    const data = rows.map((r) => ({ r, k: r[o.label], v: +r[o.value] }));
    const W = Math.max(280, el.clientWidth), rowH = 30;
    const m = { top: o.ref ? 18 : 4, right: 8, bottom: 4, left: 0 };
    const H = m.top + data.length * rowH + m.bottom;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H)
      .attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', o.aria || '');
    const lg = svg.append('g').attr('class', 'dc-axis');
    lg.selectAll('text').data(data).join('text').text((d) => d.k);
    m.left = Math.min(W * 0.45, measure(lg) + 12);
    lg.remove();
    const vt = svg.append('g').attr('class', 'dc-val');
    vt.selectAll('text').data(data).join('text').text((d) => o.fmt(d.v));
    const vw = measure(vt) + 8; vt.remove();
    const lo = o.domainMin != null ? o.domainMin : 0;
    const x = d3.scaleLinear().domain([lo, d3.max(data, (d) => d.v)]).range([m.left, W - m.right - vw]);
    const y = d3.scaleBand().domain(data.map((d) => d.k)).range([m.top, H - m.bottom]).padding(0.3);
    svg.append('g').attr('class', 'dc-axis').selectAll('text').data(data).join('text')
      .attr('x', m.left - 10).attr('y', (d) => y(d.k) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end')
      .text((d) => d.k);
    const fill = (d) => (o.ref && ((o.critBelow && d.v < o.ref.value) || (o.critAbove && d.v > o.ref.value)) ? 'var(--cds-chart-status-critical)' : base);
    const b = svg.append('g').selectAll('rect').data(data).join('rect')
      .attr('x', m.left).attr('y', (d) => y(d.k)).attr('height', y.bandwidth()).attr('rx', 2)
      .style('fill', fill).attr('width', (d) => Math.max(1, x(d.v) - m.left));
    if (!reduce && !el.dataset.played) b.attr('width', 0).transition().duration(600).ease(d3.easeCubicOut).attr('width', (d) => Math.max(1, x(d.v) - m.left));
    el.dataset.played = '1';
    svg.append('g').attr('class', 'dc-val').selectAll('text').data(data).join('text')
      .attr('x', (d) => x(d.v) + 6).attr('y', (d) => y(d.k) + y.bandwidth() / 2).attr('dy', '0.35em')
      .text((d) => o.fmt(d.v));
    if (o.ref) {
      const rx = x(o.ref.value);
      svg.append('line').attr('class', 'dc-ref').attr('x1', rx).attr('x2', rx).attr('y1', m.top - 4).attr('y2', H - m.bottom);
      svg.append('text').attr('class', 'dc-reflabel').attr('x', rx).attr('y', 10).attr('text-anchor', 'middle').text(o.ref.label);
    }
    const t = tip(el);
    b.on('pointermove', (ev, d) => {
      const [ex, ey] = d3.pointer(ev, el);
      t.show([{ text: d.k }, { text: `${o.valueLabel}: ${o.fmt(d.v)}`, color: fill(d) }, ...(o.extra || []).map((e) => ({ text: `${e.label}: ${e.fmt(+d.r[e.field])}` }))], ex, ey);
    }).on('pointerleave', () => t.hide());
  }

  // A number from one row of a dataset into an element.
  function cell(id, field, fmt, row) {
    return (el) => {
      const r = dash.data(id);
      if (r.status !== 'ok' || !r.data.length) { el.textContent = '—'; if (r.status === 'loading') el.classList.add('dash-skeleton'); else el.classList.remove('dash-skeleton'); return; }
      el.classList.remove('dash-skeleton');
      el.textContent = fmt(r.data[row || 0][field], r.data[row || 0]);
    };
  }
  // A change chip: good/bad coloring by direction preference.
  function chip(id, field, fmt, goodWhenUp) {
    return (el) => {
      const r = dash.data(id);
      if (r.status !== 'ok' || !r.data.length) { el.textContent = '—'; el.className = 'dc-chip'; return; }
      const v = +r.data[0][field];
      el.textContent = fmt(v);
      const good = v === 0 ? null : (v > 0) === goodWhenUp;
      el.className = 'dc-chip ' + (good === null ? '' : good ? 'dc-good' : 'dc-bad');
    };
  }

  const f = {
    int: d3.format(','),
    usd: d3.format('$,.0f'),
    usd2: d3.format('$,.2f'),
    usdK: (v) => d3.format('$,.0f')(v / 1000) + 'K',
    usdM: (v) => d3.format('$,.1f')(v / 1e6) + 'M',
    pct1: (v) => d3.format('.1f')(+v) + '%',
    pct0: (v) => d3.format('.0f')(+v) + '%',
    sPct: (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + d3.format('.1f')(Math.abs(v)) + '%',
    sPts: (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + d3.format('.1f')(Math.abs(v)) + ' pts',
    sNum: (d) => (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + d3.format(d)(Math.abs(v)),
    num: (d) => (v) => d3.format(d)(+v)
  };

  // Table body from a dataset. cols: [{field, fmt, num}]
  function tbody(id, cols, sort) {
    return (tb) => {
      const r = dash.data(id);
      if (r.status !== 'ok') { tb.replaceChildren(); return; }
      let data = r.data.slice();
      if (sort) data.sort(sort);
      tb.replaceChildren(...data.map((row) => {
        const tr = document.createElement('tr');
        cols.forEach((c) => {
          const td = document.createElement('td');
          td.textContent = c.fmt ? c.fmt(row[c.field]) : row[c.field];
          if (c.num) td.className = 'num';
          tr.appendChild(td);
        });
        return tr;
      }));
    };
  }

  window.DC = { line, bars, hbar, cell, chip, tbody, rowsOf, f, parseM, fmtM };
})();
