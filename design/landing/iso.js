(function () {
  const C = {
    white: ['#FFFFFF', '#F0F0EE', '#DFDFDB', '#0B0B0D'],
    gray: ['#F0F0EE', '#DFDFDB', '#CFCFCA', '#0B0B0D'],
    accent: ['#4353FF', '#2443F5', '#1322C4', '#0B0B0D'],
    dark: ['#1C1C20', '#0B0B0D', '#141417', 'rgba(243,243,241,.45)'],
    ghost: ['rgba(255,255,255,.6)', 'rgba(240,240,238,.6)', 'rgba(223,223,219,.6)', 'rgba(11,11,13,.25)']
  };
  const K = 0.8660254;
  function svg(React, o) {
    const h = React.createElement, s = o.s || 20, ox = o.ox || 0, oy = o.oy || 0;
    const P = (x, y, z) => [ox + (x - y) * K * s, oy + (x + y) * 0.5 * s - z * s];
    const pts = a => a.map(p => P(p[0], p[1], p[2]).map(n => n.toFixed(1)).join(',')).join(' ');
    const out = [];
    let k = 0;
    (o.floor || []).slice().sort((a, b) => (a.x + a.y) - (b.x + b.y)).forEach(b => {
      const { x, y, w, d } = b, z = b.z || 0, H = b.h || 0;
      out.push(h('g', { key: k++, onClick: b.on || null, style: b.on ? { cursor: 'pointer' } : null }, [
        h('polygon', { key: 'r', points: pts([[x + w, y, z + H], [x + w, y + d, z + H], [x + w, y + d, z], [x + w, y, z]]), fill: '#DFDFDB', stroke: b.stroke || '#0B0B0D', strokeWidth: 1 }),
        h('polygon', { key: 'l', points: pts([[x, y + d, z + H], [x + w, y + d, z + H], [x + w, y + d, z], [x, y + d, z]]), fill: '#F0F0EE', stroke: b.stroke || '#0B0B0D', strokeWidth: 1 }),
        h('polygon', { key: 't', points: pts([[x, y, z + H], [x + w, y, z + H], [x + w, y + d, z + H], [x, y + d, z + H]]), fill: b.top || '#FFFFFF', stroke: b.stroke || '#0B0B0D', strokeWidth: 1 })
      ]));
    });
    (o.rings || []).forEach(r => {
      const c = P(r.cx, r.cy, r.z || 0);
      out.push(h('ellipse', { key: k++, cx: c[0], cy: c[1], rx: r.r * s * 1.2247, ry: r.r * s * 0.7071, fill: r.fill || 'none', stroke: r.color || '#2443F5', strokeWidth: r.sw || 1.5, strokeDasharray: r.dash === false ? null : (r.dash || '5 4') }));
    });
    (o.lines || []).forEach(l => out.push(h('polyline', { key: k++, points: pts(l.pts), fill: 'none', stroke: l.color || '#0B0B0D', strokeWidth: l.sw || 1, strokeDasharray: l.dash || null })));
    const items = [];
    (o.boxes || []).forEach(b => items.push({ t: 'b', b, d: b.x + b.w / 2 + b.y + b.d / 2 + (b.z || 0) * 0.5 + (b.dz || 0) }));
    (o.cyls || []).forEach(c => items.push({ t: 'c', c, d: c.cx + c.cy + (c.z || 0) * 0.5 + (c.dz || 0) }));
    items.sort((a, b) => a.d - b.d);
    items.forEach(it => {
      if (it.t === 'b') {
        const { x, y, w, d } = it.b, z = it.b.z || 0, H = it.b.h, col = C[it.b.c || 'white'];
        const st = it.b.stroke || col[3], sw = it.b.sw || 1;
        const g = [
          h('polygon', { key: 'r', points: pts([[x + w, y, z + H], [x + w, y + d, z + H], [x + w, y + d, z], [x + w, y, z]]), fill: it.b.right || col[2], stroke: st, strokeWidth: sw, strokeLinejoin: 'round' }),
          h('polygon', { key: 'l', points: pts([[x, y + d, z + H], [x + w, y + d, z + H], [x + w, y + d, z], [x, y + d, z]]), fill: it.b.left || col[1], stroke: st, strokeWidth: sw, strokeLinejoin: 'round' }),
          h('polygon', { key: 't', points: pts([[x, y, z + H], [x + w, y, z + H], [x + w, y + d, z + H], [x, y + d, z + H]]), fill: it.b.top || col[0], stroke: it.b.topStroke || st, strokeWidth: sw, strokeLinejoin: 'round', strokeDasharray: it.b.dash || null })
        ];
        out.push(h('g', { key: k++, opacity: it.b.op == null ? 1 : it.b.op, onClick: it.b.on || null, style: it.b.on ? { cursor: 'pointer' } : null }, g));
      } else {
        const c = it.c, col = C[c.c || 'white'], z = c.z || 0;
        const b = P(c.cx, c.cy, z), t = P(c.cx, c.cy, z + c.h), rx = c.r * s * 1.2247, ry = c.r * s * 0.7071;
        out.push(h('g', { key: k++ }, [
          h('path', { key: 's', d: `M${b[0] - rx},${t[1]} L${b[0] - rx},${b[1]} A${rx},${ry} 0 0 0 ${b[0] + rx},${b[1]} L${b[0] + rx},${t[1]} Z`, fill: col[1], stroke: col[3], strokeWidth: 1 }),
          h('ellipse', { key: 't', cx: t[0], cy: t[1], rx, ry, fill: col[0], stroke: col[3], strokeWidth: 1 })
        ]));
      }
    });
    (o.labels || []).forEach(l => {
      const p = P(l.x, l.y, l.z || 0);
      out.push(h('text', { key: k++, x: p[0] + (l.dx || 0), y: p[1] + (l.dy || 0), fill: l.color || '#47474E', fontSize: l.size || 9, fontFamily: "'Martian Mono',monospace", letterSpacing: '0.04em', textAnchor: l.anchor || 'start', fontWeight: l.weight || 400 }, l.t));
      if (l.lead) {
        const q = P(l.lead[0], l.lead[1], l.lead[2]);
        out.push(h('line', { key: k++, x1: p[0] + (l.lx || 0), y1: p[1] + (l.ly || -3), x2: q[0], y2: q[1], stroke: l.color || '#47474E', strokeWidth: 0.75 }));
      }
    });
    return h('svg', { width: o.w, height: o.h, viewBox: `0 0 ${o.w} ${o.h}`, style: { display: 'block', overflow: 'visible', maxWidth: '100%', height: 'auto' } }, out);
  }
  const FONT = {
    a: ['01110', '00001', '01111', '10001', '01111'],
    d: ['00001', '00001', '01111', '10001', '01111'],
    o: ['00000', '01110', '10001', '10001', '01110'],
    n: ['00000', '11110', '10001', '10001', '10001'],
    e: ['01110', '10001', '11111', '10000', '01111']
  };
  function word(text, accentIdx) {
    const boxes = [];
    let off = 0;
    text.split('').forEach((ch, ci) => {
      const g = FONT[ch];
      g.forEach((row, r) => row.split('').forEach((v, c) => {
        if (v === '1') boxes.push({ x: off + c, y: 0, z: 4 - r, w: 1, d: 1, h: 1, c: ci === accentIdx && r === 2 && c === 4 ? 'accent' : 'white' });
      }));
      off += 6;
    });
    return boxes;
  }
  window.ISO = { svg, word };
})();
