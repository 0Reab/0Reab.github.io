/* knowledge graph: an obsidian-style force graph of the vault. */
(function () {
  "use strict";

  const canvas = document.getElementById("kg-chart");
  const viewport = document.getElementById("kg-viewport");
  if (!canvas || !viewport) return;

  const ctx = canvas.getContext("2d");
  const meta = document.getElementById("kg-meta");
  const tip = document.getElementById("kg-tip");
  const legend = document.getElementById("kg-legend");
  const fitBtn = document.getElementById("kg-fit");
  const zoomIn = document.getElementById("kg-zoom-in");
  const zoomOut = document.getElementById("kg-zoom-out");

  const treeSrc = (window.KG_TREE || "").trim();
  if (!treeSrc) {
    if (meta) meta.textContent = "no tree data loaded yet.";
    return;
  }

  const UNIT = /^(?:[|│][ \t]{3}|\s{4})/;
  const CONNECTOR = /^(?:[├└][ \t]*─{2,}|[|\\.+`][ \t]?-{2,})[ \t]?/;
  const EXT = /\.(md|canvas|base|txt|pdf|png|jpe?g|gif|webp|svg|mp4|zip)$/i;
  const stripExt = (s) => s.replace(EXT, "");
  const TAU = Math.PI * 2;

  const root = { name: "Reab", path: "", depth: 0, children: [], dir: true };
  const stack = [root];
  let rootSeen = false;

  for (const raw of treeSrc.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) continue;
    if (!rootSeen) {
      rootSeen = true;
      if (!CONNECTOR.test(line)) {
        const seg = line.trim().replace(/[\\/]+$/, "").split(/[\\/]/).filter(Boolean);
        if (seg.length && line.trim() !== ".") root.name = seg[seg.length - 1];
        continue;
      }
    }
    if (/^\d+ director/.test(line)) continue;

    let i = 0;
    let depth = 0;
    let u;
    while ((u = line.slice(i).match(UNIT))) {
      depth++;
      i += u[0].length;
    }
    const m = line.slice(i).match(CONNECTOR);
    if (!m) continue;
    let name = line.slice(i + m[0].length).trim();
    if (!name) continue;
    const isDir = name.endsWith("/");
    name = name.replace(/\/+$/, "").replace(/^\[[^\]]*\]\s*/, "");

    const parent = stack[Math.min(depth, stack.length - 1)];
    const node = {
      name,
      depth: depth + 1,
      dir: isDir,
      path: parent.path ? parent.path + "/" + name : name,
      children: [],
    };
    parent.children.push(node);
    stack[depth + 1] = node;
    stack.length = depth + 2;
  }

  const all = [];
  const categories = root.children;

  function decorate(node, parent, cat) {
    node.parent = parent;
    node.isFolder = node.children.length > 0 || node.dir;
    node.label = stripExt(node.name);
    node.cat = node.depth === 1 ? node : cat;
    all.push(node);
    for (const child of node.children) decorate(child, node, node.cat);
  }
  decorate(root, null, null);

  function countNotes(node) {
    if (!node.children.length) {
      node.noteCount = 1;
      return 1;
    }
    let total = 0;
    for (const child of node.children) total += countNotes(child);
    node.noteCount = total;
    return total;
  }
  countNotes(root);

  categories.forEach((cat, i) => {
    cat.hue = 108 + ((i * 53) % 66);
    cat.sat = 62 + (i % 4) * 5;
    cat.light = 52 + (i % 3) * 4;
    cat.color = `hsl(${cat.hue}, ${cat.sat}%, ${cat.light}%)`;
  });

  const paint = (cat, alpha) =>
    cat ? `hsla(${cat.hue}, ${cat.sat}%, ${cat.light}%, ${alpha})` : `rgba(220,235,225,${alpha})`;

  const nodes = all;
  const edges = [];
  for (const node of nodes) {
    if (node.parent) edges.push({ a: node.parent, b: node });
  }

  const tagMaxCount = Math.max(...categories.map((c) => c.noteCount));
  const tagMin = Math.max(10, Math.round(tagMaxCount * 0.1));
  const tagCats = categories.filter((c) => c.noteCount >= tagMin);
  const panelCats = categories.filter((c) => c.children.length > 0);
  const panelSet = new Set(panelCats);
  const hiddenNodes = nodes.filter((n) => n.depth > 1 && panelSet.has(n.cat));
  const hiddenSet = new Set(hiddenNodes);
  const visibleNodes = nodes.filter((n) => !hiddenSet.has(n));
  const visibleEdges = edges.filter((e) => !hiddenSet.has(e.a) && !hiddenSet.has(e.b));

  const adjacency = new Map(visibleNodes.map((n) => [n, new Set()]));
  for (const edge of visibleEdges) {
    adjacency.get(edge.a).add(edge.b);
    adjacency.get(edge.b).add(edge.a);
  }

  const majorCategories = categories.filter((c) => c.children.length > 0);
  const groups = [];

  const totalFolders = nodes.filter((n) => n !== root && n.isFolder).length;

  function nodeRadius(node) {
    if (node === root) return 9;
    if (node.depth === 1 && node.children.length) return Math.min(14, 6 + Math.sqrt(node.noteCount) * 0.55);
    if (node.isFolder) return Math.min(8, 3.5 + Math.sqrt(node.noteCount) * 0.3);
    return 2.6;
  }

  function nodeType(node) {
    if (node === root) return "vault";
    if (node.depth === 1 && node.children.length) return "category";
    return node.isFolder ? "folder" : "note";
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rnd = mulberry32(0x51f15e);
  for (const node of nodes) {
    node.r = nodeRadius(node);
    node.x = 0;
    node.y = 0;
    node.vx = 0;
    node.vy = 0;
  }

  for (const node of nodes) {
    if (node === root) {
      node.x = 0;
      node.y = 0;
    } else if (node.depth === 1) {
      const angle = rnd() * TAU;
      const dist = 40 + 340 * Math.sqrt(rnd());
      node.x = Math.cos(angle) * dist;
      node.y = Math.sin(angle) * dist;
    } else {
      const parent = node.parent;
      const angle = rnd() * TAU;
      const dist = 22 + rnd() * 34;
      node.x = parent.x + Math.cos(angle) * dist;
      node.y = parent.y + Math.sin(angle) * dist;
    }
  }

  const REPULSION = 1000;
  const SPRING = 0.045;
  const GRAVITY = 0.0042;
  const DAMPING = 0.9;
  const TICKS = 350;

  function simulate() {
    for (let tick = 0; tick < TICKS; tick++) {
      const cool = 1 - (tick / TICKS) * 0.85;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 0.01) {
            dx = (rnd() - 0.5) * 0.1;
            dy = (rnd() - 0.5) * 0.1;
            d2 = dx * dx + dy * dy;
          }
          const d = Math.sqrt(d2);
          const min = a.r + b.r + 3;
          if (d < min) {
            const push = ((min - d) / d) * 0.5;
            if (a !== root) {
              a.x -= dx * push;
              a.y -= dy * push;
            }
            if (b !== root) {
              b.x += dx * push;
              b.y += dy * push;
            }
          }
          const f = Math.min(28, REPULSION / d2) * cool;
          const ux = dx / d;
          const uy = dy / d;
          if (a !== root) {
            a.vx -= ux * f;
            a.vy -= uy * f;
          }
          if (b !== root) {
            b.vx += ux * f;
            b.vy += uy * f;
          }
        }
      }

      for (const edge of edges) {
        const a = edge.a;
        const b = edge.b;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        let rest;
        if (a === root) {
          rest = a.r + b.r + 28 + Math.min(24, Math.sqrt(b.noteCount) * 2.5);
        } else {
          const fan = Math.min(36, Math.sqrt(a.children.length) * 6);
          const spread = Math.min(50, Math.sqrt(b.noteCount) * 4.5);
          rest = a.r + b.r + 20 + fan + spread;
        }
        const f = (d - rest) * SPRING * cool;
        const ux = dx / d;
        const uy = dy / d;
        if (a !== root) {
          a.vx += ux * f;
          a.vy += uy * f;
        }
        if (b !== root) {
          b.vx -= ux * f;
          b.vy -= uy * f;
        }
      }

      for (const node of nodes) {
        if (node === root) {
          node.x = 0;
          node.y = 0;
          continue;
        }
        node.vx -= node.x * GRAVITY * cool;
        node.vy -= node.y * GRAVITY * cool;
        node.x += node.vx;
        node.y += node.vy;
        node.vx *= DAMPING;
        node.vy *= DAMPING;
      }
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x - node.r);
      minY = Math.min(minY, node.y - node.r);
      maxX = Math.max(maxX, node.x + node.r);
      maxY = Math.max(maxY, node.y + node.r);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    for (const node of nodes) {
      node.x -= cx;
      node.y -= cy;
    }
  }

  function separateClusters() {
    const groups = majorCategories.map((cat) => {
      let radius = cat.r;
      const members = [];
      for (const n of nodes) {
        if (n !== cat && n.cat !== cat) continue;
        members.push(n);
        const d = Math.hypot(n.x - cat.x, n.y - cat.y) + n.r;
        if (d > radius) radius = d;
      }
      return { x: cat.x, y: cat.y, r: radius, members };
    });

    const GAP = 10;
    for (let iter = 0; iter < 80; iter++) {
      let moved = false;
      for (let i = 0; i < groups.length; i++) {
        const a = groups[i];
        for (let j = i + 1; j < groups.length; j++) {
          const b = groups[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.001;
          const min = a.r + b.r + GAP;
          if (d >= min) continue;
          const push = (min - d) * 0.5;
          const ux = dx / d;
          const uy = dy / d;
          const adx = -ux * push;
          const ady = -uy * push;
          const bdx = ux * push;
          const bdy = uy * push;
          for (const n of a.members) {
            n.x += adx;
            n.y += ady;
          }
          for (const n of b.members) {
            n.x += bdx;
            n.y += bdy;
          }
          a.x += adx;
          a.y += ady;
          b.x += bdx;
          b.y += bdy;
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  function buildGroups() {
    groups.length = 0;
    const font = "9.5px 'ubuntu sans mono', monospace";
    const rowH = 12.5;
    const dotGap = 9;
    const margin = 8;
    const sideGap = 16;
    const splitLimit = 24;

    for (const cat of panelCats) {
      const entries = hiddenNodes.filter((n) => n.cat === cat);
      if (!entries.length) continue;
      for (const n of entries) {
        n._indent = Math.min(4, Math.max(0, n.depth - 2)) * 12;
        ctx.font = font;
        n._w = ctx.measureText(n.label).width;
      }

      let leftEntries = [];
      let rightEntries = [];
      if (entries.length > splitLimit) {
        const mid = Math.ceil(entries.length / 2);
        leftEntries = entries.slice(0, mid);
        rightEntries = entries.slice(mid);
      } else if (cat.x >= 0) {
        rightEntries = entries;
      } else {
        leftEntries = entries;
      }

      const lists = [];
      const makeList = (rows, side) => {
        if (!rows.length) return;
        let maxW = 0;
        for (const n of rows) maxW = Math.max(maxW, n._indent + dotGap + n._w);
        const w = maxW + margin;
        const h = rows.length * rowH;
        const x = side > 0 ? cat.x + cat.r + sideGap : cat.x - cat.r - sideGap - w;
        const y = cat.y - h / 2;
        lists.push({
          side,
          x,
          y,
          w,
          h,
          rows: rows.map((node, i) => ({
            node,
            x,
            y: y + i * rowH,
            w,
            h: rowH,
            indent: node._indent,
          })),
        });
      };
      makeList(leftEntries, -1);
      makeList(rightEntries, 1);
      if (lists.length) groups.push({ cat, lists });
    }
  }

  function groupBounds(group) {
    let minX = group.cat.x - group.cat.r;
    let minY = group.cat.y - group.cat.r;
    let maxX = group.cat.x + group.cat.r;
    let maxY = group.cat.y + group.cat.r;
    for (const list of group.lists) {
      minX = Math.min(minX, list.x);
      minY = Math.min(minY, list.y);
      maxX = Math.max(maxX, list.x + list.w);
      maxY = Math.max(maxY, list.y + list.h);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function moveGroup(group, dx, dy) {
    group.cat.x += dx;
    group.cat.y += dy;
    for (const list of group.lists) {
      list.x += dx;
      list.y += dy;
      for (const row of list.rows) {
        row.x += dx;
        row.y += dy;
      }
    }
  }

  function spreadGroups() {
    const factor = 1.25;
    for (const group of groups) {
      moveGroup(group, group.cat.x * (factor - 1), group.cat.y * (factor - 1));
    }

    const gap = 18;
    for (let iter = 0; iter < 80; iter++) {
      let moved = false;
      for (let i = 0; i < groups.length; i++) {
        const a = groups[i];
        for (let j = i + 1; j < groups.length; j++) {
          const b = groups[j];
          const ba = groupBounds(a);
          const bb = groupBounds(b);
          const overlapX = Math.min(ba.x + ba.w, bb.x + bb.w) - Math.max(ba.x, bb.x);
          const overlapY = Math.min(ba.y + ba.h, bb.y + bb.h) - Math.max(ba.y, bb.y);
          if (overlapX <= -gap || overlapY <= -gap) continue;
          if (overlapX < overlapY) {
            const push = (overlapX + gap) * 0.5;
            const dir = ba.x + ba.w / 2 < bb.x + bb.w / 2 ? -1 : 1;
            moveGroup(a, dir * push, 0);
            moveGroup(b, -dir * push, 0);
          } else {
            const push = (overlapY + gap) * 0.5;
            const dir = ba.y + ba.h / 2 < bb.y + bb.h / 2 ? -1 : 1;
            moveGroup(a, 0, dir * push);
            moveGroup(b, 0, -dir * push);
          }
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  simulate();
  separateClusters();
  buildGroups();
  spreadGroups();

  let view = { x: 0, y: 0, k: 1 };
  let activeCat = null;
  let hover = null;
  let dpr = 1;
  let frameW = 0;
  let frameH = 0;

  function canvasSize() {
    return { w: viewport.clientWidth, h: viewport.clientHeight };
  }

  const screenX = (x) => frameW / 2 + view.x + x * view.k;
  const screenY = (y) => frameH / 2 + view.y + y * view.k;

  function worldFromScreen(sx, sy) {
    return {
      x: (sx - frameW / 2 - view.x) / view.k,
      y: (sy - frameH / 2 - view.y) / view.k,
    };
  }

  function graphBounds() {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of visibleNodes) {
      minX = Math.min(minX, node.x - node.r);
      minY = Math.min(minY, node.y - node.r);
      maxX = Math.max(maxX, node.x + node.r);
      maxY = Math.max(maxY, node.y + node.r);
    }
    for (const group of groups) {
      for (const list of group.lists) {
        minX = Math.min(minX, list.x);
        minY = Math.min(minY, list.y);
        maxX = Math.max(maxX, list.x + list.w);
        maxY = Math.max(maxY, list.y + list.h);
      }
    }
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
  }

  function fitView() {
    const { w, h } = canvasSize();
    const b = graphBounds();
    const pad = Math.max(8, Math.min(20, Math.min(w, h) * 0.025));
    const k = Math.max(0.05, Math.min(6, Math.min((w - pad * 2) / Math.max(1, b.w), (h - pad * 2) / Math.max(1, b.h))));
    view.k = k;
    view.x = -b.cx * k;
    view.y = -b.cy * k;
    draw();
  }

  function zoomAt(factor, sx, sy) {
    const { w, h } = canvasSize();
    const wx = (sx - w / 2 - view.x) / view.k;
    const wy = (sy - h / 2 - view.y) / view.k;
    const k = Math.max(0.05, Math.min(12, view.k * factor));
    view.k = k;
    view.x = sx - w / 2 - wx * k;
    view.y = sy - h / 2 - wy * k;
    draw();
  }

  function nodeAlpha(node) {
    if (node === root) return 1;
    if (activeCat && node.cat !== activeCat) return 0.12;
    if (hover) {
      if (node === hover) return 1;
      if (adjacency.get(hover) && adjacency.get(hover).has(node)) return 1;
      return 0.16;
    }
    return 1;
  }

  function strokeEdges(list, color) {
    if (!list.length) return;
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (const edge of list) {
      ctx.moveTo(edge.a.x, edge.a.y);
      ctx.lineTo(edge.b.x, edge.b.y);
    }
    ctx.stroke();
  }

  function drawEdges() {
    ctx.lineWidth = Math.max(0.7, 1 / view.k);
    const bright = [];
    const normal = [];
    const faint = [];
    for (const edge of visibleEdges) {
      const connected = hover && (edge.a === hover || edge.b === hover);
      const inCat = !activeCat || edge.b.cat === activeCat;
      if (hover) {
        (connected ? bright : faint).push(edge);
      } else if (!inCat) {
        faint.push(edge);
      } else {
        normal.push(edge);
      }
    }
    strokeEdges(faint, "rgba(126, 164, 143, 0.04)");
    strokeEdges(normal, "rgba(126, 164, 143, 0.2)");
    strokeEdges(bright, "rgba(176, 238, 203, 0.62)");
  }

  function drawNodes() {
    for (const node of visibleNodes) {
      const alpha = nodeAlpha(node);
      if (alpha < 0.02) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = node === root ? "rgba(233,246,238,0.96)" : paint(node.cat, 0.95);
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (hover) {
      ctx.beginPath();
      ctx.arc(hover.x, hover.y, hover.r + 4 / view.k, 0, TAU);
      ctx.strokeStyle = "rgba(230, 255, 240, 0.85)";
      ctx.lineWidth = 1.4 / view.k;
      ctx.stroke();
    }
  }

  function measureText(text, size, bold) {
    ctx.font = `${bold ? "700 " : ""}${size}px 'ubuntu sans mono', monospace`;
    return ctx.measureText(text).width;
  }

  function boxOverlap(a, b) {
    return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
  }

  function drawLabel(node, text, size, bold, alpha, placed) {
    const sx = screenX(node.x);
    const sy = screenY(node.y);
    const radius = Math.max(2, node.r * view.k);
    const font = `${bold ? "700 " : ""}${size}px 'ubuntu sans mono', monospace`;
    ctx.font = font;
    const width = ctx.measureText(text).width;
    const height = size + 2;
    const gap = radius + 4;

    const candidates = [
      { x: sx + gap, y: sy, align: "left" },
      { x: sx - gap, y: sy, align: "right" },
      { x: sx, y: sy + radius + 7, align: "center" },
      { x: sx, y: sy - radius - 7, align: "center" },
    ];

    for (const c of candidates) {
      let bx;
      if (c.align === "left") bx = c.x;
      else if (c.align === "right") bx = c.x - width;
      else bx = c.x - width / 2;
      const by = c.y - height / 2;
      const box = { x: bx - 2, y: by - 1, w: width + 4, h: height + 2 };
      if (box.x < 2 || box.y < 2 || box.x + box.w > frameW - 2 || box.y + box.h > frameH - 2) continue;
      let clash = false;
      for (const other of placed) {
        if (boxOverlap(box, other)) {
          clash = true;
          break;
        }
      }
      if (clash) continue;

      placed.push(box);
      ctx.globalAlpha = alpha;
      ctx.textAlign = c.align;
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(7, 13, 9, 0.9)";
      ctx.lineWidth = 3;
      ctx.strokeText(text, c.x, c.y);
      ctx.fillStyle = "#e3efe7";
      ctx.fillText(text, c.x, c.y);
      ctx.globalAlpha = 1;
      return true;
    }
    return false;
  }

  function drawLabels() {
    const placed = [];
    const zoom = view.k;
    const cats = visibleNodes.filter((n) => n.depth === 1 && n.children.length);
    cats.sort((a, b) => b.r - a.r);

    for (const node of cats) {
      const alpha = nodeAlpha(node);
      if (alpha < 0.1) continue;
      drawLabel(node, node.label, 11, true, alpha, placed);
    }

    if (zoom >= 0.55) {
      const folders = visibleNodes.filter((n) => n.isFolder && !(n.depth === 1 && n.children.length));
      folders.sort((a, b) => b.r - a.r);
      for (const node of folders) {
        const alpha = nodeAlpha(node);
        if (alpha < 0.1) continue;
        drawLabel(node, node.label, 10, false, alpha * 0.9, placed);
      }
    }

    if (zoom >= 0.8) {
      for (const node of visibleNodes) {
        if (node.isFolder) continue;
        const alpha = nodeAlpha(node);
        if (alpha < 0.1) continue;
        drawLabel(node, node.label, 10, false, alpha * 0.85, placed);
      }
    }

    if (hover) {
      drawLabel(hover, hover.label, 11.5, true, 1, placed);
    }
  }

  function drawLists() {
    const font = "9.5px 'ubuntu sans mono', monospace";
    for (const group of groups) {
      const alpha = activeCat && group.cat !== activeCat ? 0.16 : 1;
      for (const list of group.lists) {
        const innerX = list.side > 0 ? list.x : list.x + list.w;
        ctx.strokeStyle = paint(group.cat, 0.28 * alpha);
        ctx.lineWidth = 1 / view.k;
        ctx.beginPath();
        ctx.moveTo(innerX, list.y);
        ctx.lineTo(innerX, list.y + list.h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(group.cat.x, group.cat.y);
        ctx.lineTo(innerX, group.cat.y);
        ctx.stroke();

        ctx.font = font;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        for (const row of list.rows) {
          const node = row.node;
          const cy = row.y + row.h / 2;
          const dx = row.x + row.indent + 2;
          if (row.indent > 0) {
            const px = dx - 12;
            ctx.globalAlpha = alpha * 0.35;
            ctx.strokeStyle = paint(group.cat, 0.55);
            ctx.lineWidth = 1 / view.k;
            ctx.beginPath();
            ctx.moveTo(px, cy - row.h / 2);
            ctx.lineTo(px, cy);
            ctx.lineTo(dx - 3, cy);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          ctx.globalAlpha = alpha;
          ctx.fillStyle = paint(group.cat, 0.95);
          if (node.isFolder) {
            ctx.fillRect(dx - 1.7, cy - 1.7, 3.4, 3.4);
          } else {
            ctx.beginPath();
            ctx.arc(dx, cy, 1.8, 0, TAU);
            ctx.fill();
          }
          ctx.strokeStyle = "rgba(7, 13, 9, 0.92)";
          ctx.lineWidth = 2;
          ctx.lineJoin = "round";
          ctx.strokeText(node.label, row.x + row.indent + 9, cy);
          ctx.fillStyle = node.isFolder ? "#dce5de" : "#a8bbad";
          ctx.fillText(node.label, row.x + row.indent + 9, cy);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  function draw() {
    const { w, h } = canvasSize();
    frameW = w;
    frameH = h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (!nodes.length) return;

    ctx.save();
    ctx.translate(w / 2 + view.x, h / 2 + view.y);
    ctx.scale(view.k, view.k);
    drawEdges();
    drawNodes();
    drawLists();
    ctx.restore();

    drawLabels();
  }

  function showTip(node, sx, sy) {
    if (!tip) return;
    if (!node) {
      tip.classList.remove("is-visible");
      return;
    }
    const path = node === root
      ? "everything"
      : node.depth === 1
        ? "top level"
        : node.path.split("/").map(stripExt).join(" / ");
    const count = `${node.noteCount} note${node.noteCount === 1 ? "" : "s"}`;
    const title = node === root ? "vault" : node.label || node.name;
    tip.innerHTML =
      `<strong>${escapeHtml(title)}</strong>` +
      `<span class="kg-tip-path">${escapeHtml(path)} · ${nodeType(node)}</span>` +
      `<span class="kg-tip-count">${count}${node.isFolder ? " inside" : ""}</span>`;
    const vw = viewport.clientWidth;
    const anchor = sx < 130 ? "0%" : sx > vw - 130 ? "-100%" : "-50%";
    const below = sy < 110;
    tip.style.left = sx + "px";
    tip.style.top = sy + "px";
    tip.style.transform = `translate(${anchor}, ${below ? "14px" : "calc(-100% - 14px)"})`;
    tip.classList.add("is-visible");
  }

  function updateMeta() {
    if (!meta) return;
    if (activeCat) {
      const n = activeCat.noteCount;
      meta.textContent = `${activeCat.label} · ${n} note${n === 1 ? "" : "s"} · click again to show all`;
    } else {
      meta.textContent = `${all.length - 1} items · ${root.noteCount} notes in ${totalFolders} folders`;
    }
  }

  function updateChips() {
    if (!legend) return;
    for (const chip of legend.children) {
      chip.classList.toggle("is-active", chip.dataset.path === (activeCat ? activeCat.path : ""));
    }
  }

  function setActive(cat) {
    activeCat = activeCat === cat ? null : cat;
    updateChips();
    updateMeta();
    draw();
  }

  function pointerCoords(e) {
    const rect = viewport.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function nodeAt(sx, sy) {
    let found = null;
    let best = Infinity;
    for (const node of visibleNodes) {
      const cx = screenX(node.x);
      const cy = screenY(node.y);
      const r = Math.max(6, node.r * view.k + 4);
      const d = Math.hypot(sx - cx, sy - cy);
      if (d <= r && d < best) {
        best = d;
        found = node;
      }
    }
    return found;
  }

  let drag = null;
  let point = { x: 0, y: 0 };
  let moved = 0;

  canvas.addEventListener("pointerdown", (e) => {
    const p = pointerCoords(e);
    point = p;
    const hit = nodeAt(p.x, p.y);
    if (hit) {
      drag = { type: "node", node: hit, sx: p.x, sy: p.y };
    } else {
      drag = { type: "pan", sx: p.x, sy: p.y, vx: view.x, vy: view.y };
      viewport.classList.add("is-panning");
    }
    moved = 0;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove", (e) => {
    const p = pointerCoords(e);
    if (drag) {
      const dx = p.x - point.x;
      const dy = p.y - point.y;
      moved += Math.abs(dx) + Math.abs(dy);
      point = p;
      if (drag.type === "pan") {
        view.x = drag.vx + (p.x - drag.sx);
        view.y = drag.vy + (p.y - drag.sy);
      } else {
        const world = worldFromScreen(p.x, p.y);
        const oldX = drag.node.x;
        const oldY = drag.node.y;
        const dx = world.x - oldX;
        const dy = world.y - oldY;
        drag.node.x = world.x;
        drag.node.y = world.y;
        for (const group of groups) {
          if (group.cat !== drag.node) continue;
          for (const list of group.lists) {
            list.x += dx;
            list.y += dy;
            for (const row of list.rows) {
              row.x += dx;
              row.y += dy;
            }
          }
        }
      }
      if (tip) tip.classList.remove("is-visible");
      draw();
      return;
    }

    const hit = nodeAt(p.x, p.y);
    const changed = (hover && hover !== hit) || (!hover && hit);
    if (changed) {
      hover = hit;
      canvas.style.cursor = hit ? "pointer" : "grab";
      viewport.classList.toggle("is-over-node", !!hit);
      showTip(hit, p.x, p.y);
      draw();
    } else if (hit) {
      showTip(hit, p.x, p.y);
    }
  });

  canvas.addEventListener("pointerup", (e) => {
    if (!drag) return;
    const wasClick = moved < 5;
    const type = drag.type;
    drag = null;
    viewport.classList.remove("is-panning");
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (_) {}

    if (wasClick && type === "node") {
      const hit = nodeAt(point.x, point.y);
      if (hit) {
        if (hit === root) {
          activeCat = null;
          updateChips();
          updateMeta();
          draw();
        } else {
          setActive(hit.cat);
        }
      }
    } else if (wasClick && type === "pan") {
      activeCat = null;
      updateChips();
      updateMeta();
      draw();
    }
  });

  canvas.addEventListener("pointerleave", () => {
    if (drag) return;
    hover = null;
    showTip(null);
    viewport.classList.remove("is-over-node");
    canvas.style.cursor = "grab";
    draw();
  });

  canvas.addEventListener("pointercancel", () => {
    drag = null;
    viewport.classList.remove("is-panning");
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const p = pointerCoords(e);
    zoomAt(Math.pow(1.0018, -e.deltaY), p.x, p.y);
  }, { passive: false });

  canvas.addEventListener("dblclick", (e) => {
    e.preventDefault();
    fitView();
  });

  if (fitBtn) fitBtn.addEventListener("click", fitView);
  if (zoomIn) {
    zoomIn.addEventListener("click", () => {
      const { w, h } = canvasSize();
      zoomAt(1.35, w / 2, h / 2);
    });
  }
  if (zoomOut) {
    zoomOut.addEventListener("click", () => {
      const { w, h } = canvasSize();
      zoomAt(1 / 1.35, w / 2, h / 2);
    });
  }

  const fullscreenBtn = document.getElementById("kg-fullscreen");
  const stage = document.querySelector(".kg-stage");
  if (fullscreenBtn && stage) {
    const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
    const onChange = () => {
      fullscreenBtn.textContent = fsElement() ? "exit" : "fullscreen";
      requestAnimationFrame(fitView);
    };
    fullscreenBtn.addEventListener("click", () => {
      if (fsElement()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
      } else {
        const request = stage.requestFullscreen || stage.webkitRequestFullscreen;
        if (request) {
          const result = request.call(stage);
          if (result && result.catch) result.catch(() => {});
        }
      }
    });
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    if (!(stage.requestFullscreen || stage.webkitRequestFullscreen)) fullscreenBtn.style.display = "none";
  }

  if (legend) {
    const chips = tagCats
      .slice()
      .sort((a, b) => b.noteCount - a.noteCount || a.label.localeCompare(b.label));
    for (const cat of chips) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "kg-chip";
      chip.dataset.path = cat.path;
      chip.innerHTML =
        `<span class="dot" style="background:${cat.color}"></span>` +
        `${escapeHtml(cat.label)} <span class="faint">(${cat.noteCount})</span>`;
      chip.addEventListener("click", () => setActive(cat));
      legend.appendChild(chip);
    }
  }

  function resize() {
    const { w, h } = canvasSize();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    fitView();
  }

  if (window.ResizeObserver) {
    new ResizeObserver(resize).observe(viewport);
  } else {
    window.addEventListener("resize", resize);
  }

  updateMeta();
  fitView();
})();
