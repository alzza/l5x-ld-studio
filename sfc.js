(function (global) {
  'use strict';

  const INK = '#243b7a';
  const TEXT = '#111';
  const ST = '#9c2020';
  const PAPER = '#fff';
  const SCALE = 1;
  const STEP_W = 118;
  const STEP_H = 64;
  const TRANS_W = 36;
  const QUAL_MAP = {
    QualifierTypeNull: 'N',
    NonStored: 'N', N: 'N',
    Reset: 'R', R: 'R',
    Stored: 'S', S: 'S',
    TimeLimited: 'L', L: 'L',
    TimeDelayed: 'D', D: 'D',
    Pulse: 'P', P: 'P',
    PulseRisingEdge: 'P1', P1: 'P1',
    PulseFallingEdge: 'P0', P0: 'P0',
    StoredTimeLimited: 'SL', SL: 'SL',
    StoredTimeDelayed: 'SD', SD: 'SD',
    TimeDelayedStored: 'DS', DS: 'DS'
  };

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function attr(el, name, fallback) {
    if (!el || !el.getAttribute) return fallback;
    const v = el.getAttribute(name);
    return v == null || v === '' ? fallback : v;
  }
  function num(el, name) {
    const v = attr(el, name, '');
    if (v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function isTrue(el, name) {
    const v = String(attr(el, name, '')).toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  }
  function kids(el, tag) {
    if (!el) return [];
    return [...el.children].filter(c => c.localName === tag || c.nodeName === tag);
  }
  function find(el, tag) {
    return kids(el, tag)[0] || null;
  }
  function stLines(block) {
    if (!block) return [];
    const content = find(block, 'STContent') || block.querySelector && block.querySelector('STContent');
    if (!content) return [];
    return kids(content, 'Line').map(line => (line.textContent || '').replace(/\r\n/g, '\n'));
  }
  function textBoxValue(el) {
    const text = find(el, 'Text');
    if (!text) return (el.textContent || '').trim();
    const loc = find(text, 'LocalizedText');
    const src = loc || text;
    const value = find(src, 'Value');
    if (value) return (value.textContent || '').trim();
    return (src.textContent || '').trim();
  }
  function qualifierAbbrev(raw, warnings, where) {
    if (raw == null || raw === '') return 'N';
    if (Object.prototype.hasOwnProperty.call(QUAL_MAP, raw)) return QUAL_MAP[raw];
    warnings.push(`${where}: 모르는 한정자 ${raw}`);
    return raw;
  }

  function emptyChart(warnings) {
    return {
      sheetSize: 'Letter',
      sheetOrientation: 'Portrait',
      steps: [],
      transitions: [],
      branches: [],
      stops: [],
      textBoxes: [],
      sbrRets: [],
      links: [],
      attachments: [],
      byId: {},
      warnings: warnings || []
    };
  }

  function parseSFC(root) {
    const warnings = [];
    if (!root) {
      warnings.push('SFC 루틴 요소가 없습니다.');
      return emptyChart(warnings);
    }
    let content = root;
    const nodeName = root.localName || root.nodeName;
    if (nodeName !== 'SFCContent') {
      content = (root.querySelector && root.querySelector('SFCContent')) || null;
    }
    if (!content) {
      warnings.push('SFCContent가 없습니다.');
      return emptyChart(warnings);
    }
    const chart = emptyChart(warnings);
    chart.sheetSize = attr(content, 'SheetSize', 'Letter');
    chart.sheetOrientation = attr(content, 'SheetOrientation', 'Portrait');

    function register(node) {
      if (node.id == null) return;
      chart.byId[String(node.id)] = node;
    }

    kids(content, 'Step').forEach(el => {
      const id = num(el, 'ID');
      const x = num(el, 'X');
      const y = num(el, 'Y');
      if (id == null) {
        warnings.push('ID가 없는 Step을 건너뜁니다.');
        return;
      }
      if (x == null || y == null) {
        warnings.push(`Step ${id}: X/Y가 없어 그리지 않습니다.`);
        return;
      }
      const actions = kids(el, 'Action').map(ael => {
        const aid = num(ael, 'ID');
        const rawQ = attr(ael, 'Qualifier', 'N');
        const action = {
          kind: 'action',
          id: aid,
          operand: attr(ael, 'Operand', ''),
          qualifierRaw: rawQ,
          qualifier: qualifierAbbrev(rawQ, warnings, `Action ${aid ?? attr(ael, 'Operand', '?')}`),
          isBoolean: isTrue(ael, 'IsBoolean'),
          indicatorTag: attr(ael, 'IndicatorTag', ''),
          body: stLines(find(ael, 'Body')),
          preset: stLines(find(ael, 'Preset'))
        };
        if (aid != null) register(action);
        return action;
      });
      const step = {
        kind: 'step',
        id, x, y,
        operand: attr(el, 'Operand', ''),
        initialStep: isTrue(el, 'InitialStep'),
        hideDesc: isTrue(el, 'HideDesc'),
        descX: num(el, 'DescX'),
        descY: num(el, 'DescY'),
        descWidth: num(el, 'DescWidth'),
        actions
      };
      step.showActions = attr(el, 'ShowActions', null) == null ? true : isTrue(el, 'ShowActions');
      chart.steps.push(step);
      register(step);
    });

    kids(content, 'Transition').forEach(el => {
      const id = num(el, 'ID');
      const x = num(el, 'X');
      const y = num(el, 'Y');
      if (id == null) {
        warnings.push('ID가 없는 Transition을 건너뜁니다.');
        return;
      }
      if (x == null || y == null) {
        warnings.push(`Transition ${id}: X/Y가 없어 그리지 않습니다.`);
        return;
      }
      const trans = {
        kind: 'transition',
        id, x, y,
        operand: attr(el, 'Operand', ''),
        hideDesc: isTrue(el, 'HideDesc'),
        force: isTrue(el, 'Force'),
        condition: stLines(find(el, 'Condition'))
      };
      if (trans.force) warnings.push(`Transition ${trans.operand || id}: Force 속성이 있습니다.`);
      chart.transitions.push(trans);
      register(trans);
    });

    kids(content, 'Branch').forEach(el => {
      const id = num(el, 'ID');
      const y = num(el, 'Y');
      if (id == null) {
        warnings.push('ID가 없는 Branch를 건너뜁니다.');
        return;
      }
      if (y == null) {
        warnings.push(`Branch ${id}: Y가 없어 그리지 않습니다.`);
        return;
      }
      const branchType = attr(el, 'BranchType', '');
      const branchFlow = attr(el, 'BranchFlow', '');
      if (branchType && branchType !== 'Selection' && branchType !== 'Simultaneous') {
        warnings.push(`Branch ${id}: 모르는 BranchType ${branchType}`);
      }
      if (branchFlow && branchFlow !== 'Diverge' && branchFlow !== 'Converge') {
        warnings.push(`Branch ${id}: 모르는 BranchFlow ${branchFlow}`);
      }
      const legs = kids(el, 'Leg').map(leg => {
        const lid = num(leg, 'ID');
        const force = attr(leg, 'Force', 'NoForce');
        const node = { kind: 'leg', id: lid, parent: id, force };
        if (lid != null) register(node);
        if (force && force !== 'NoForce') warnings.push(`Branch ${id} Leg ${lid}: Force=${force}`);
        return node;
      });
      const branch = {
        kind: 'branch',
        id, y,
        branchType: branchType || 'Selection',
        branchFlow: branchFlow || 'Diverge',
        priority: attr(el, 'Priority', 'Default'),
        legs
      };
      chart.branches.push(branch);
      register(branch);
    });

    kids(content, 'Stop').forEach(el => {
      const id = num(el, 'ID');
      const x = num(el, 'X');
      const y = num(el, 'Y');
      if (id == null || x == null || y == null) {
        warnings.push('Stop에 ID 또는 X/Y가 없어 그리지 않습니다.');
        return;
      }
      const stop = { kind: 'stop', id, x, y, operand: attr(el, 'Operand', '') };
      chart.stops.push(stop);
      register(stop);
    });

    kids(content, 'SbrRet').forEach(el => {
      const id = num(el, 'ID');
      const x = num(el, 'X');
      const y = num(el, 'Y');
      if (id == null || x == null || y == null) {
        warnings.push('SbrRet에 ID 또는 X/Y가 없어 그리지 않습니다.');
        return;
      }
      const node = {
        kind: 'sbrret',
        id, x, y,
        inn: attr(el, 'In', ''),
        ret: attr(el, 'Ret', '')
      };
      chart.sbrRets.push(node);
      register(node);
    });

    kids(content, 'TextBox').forEach(el => {
      const id = num(el, 'ID');
      const x = num(el, 'X');
      const y = num(el, 'Y');
      if (id == null || x == null || y == null) {
        warnings.push('TextBox에 ID 또는 X/Y가 없어 그리지 않습니다.');
        return;
      }
      const box = {
        kind: 'textbox',
        id, x, y,
        width: num(el, 'Width') || 180,
        text: textBoxValue(el)
      };
      chart.textBoxes.push(box);
      register(box);
    });

    kids(content, 'DirectedLink').forEach(el => {
      const fromId = num(el, 'FromID');
      const toId = num(el, 'ToID');
      if (fromId == null || toId == null) {
        warnings.push('DirectedLink에 FromID/ToID가 없습니다.');
        return;
      }
      chart.links.push({
        fromId, toId,
        show: attr(el, 'Show', 'true').toLowerCase() !== 'false'
      });
    });

    kids(content, 'Attachment').forEach(el => {
      const fromId = num(el, 'FromID');
      const toId = num(el, 'ToID');
      if (fromId == null || toId == null) {
        warnings.push('Attachment 형태를 몰라 건너뜁니다.');
        return;
      }
      chart.attachments.push({ fromId, toId });
    });

    return chart;
  }

  function parseSFCFromXml(xml) {
    if (typeof DOMParser === 'undefined') {
      throw new Error('DOMParser가 필요합니다.');
    }
    const doc = new DOMParser().parseFromString(String(xml), 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) throw new Error('유효한 XML이 아닙니다. ' + (err.textContent || '').slice(0, 100));
    return parseSFC(doc);
  }

  function sx(n) { return n * SCALE; }

  function wrapToWidth(text, maxW, charW) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    if (!s) return [];
    const cw = charW || 6.6;
    const limit = Math.max(24, maxW);
    if (s.length * cw <= limit) return [s];
    const tokens = s.split(/(\s+|;|:=|\(|\)|,)/).filter(t => t !== '');
    const lines = [];
    let cur = '';
    function fits(t) { return t.length * cw <= limit; }
    tokens.forEach(tok => {
      if (fits(cur + tok)) cur += tok;
      else {
        if (cur.trim()) lines.push(cur.replace(/\s+$/, ''));
        let rest = tok.replace(/^\s+/, '');
        while (!fits(rest) && rest.length > 1) {
          const n = Math.max(1, Math.floor(limit / cw));
          lines.push(rest.slice(0, n));
          rest = rest.slice(n);
        }
        cur = rest;
      }
    });
    if (cur.trim()) lines.push(cur.replace(/\s+$/, ''));
    return lines.length ? lines : [s];
  }

  function measureStepName(name) {
    const pad = 22;
    const minW = STEP_W;
    const maxW = 248;
    const natural = Math.min(maxW, Math.max(minW, String(name || '').length * 7.1 + pad));
    let w = natural;
    let lines = wrapToWidth(name, w - pad, 7.1);
    if (lines.length > 2) {
      w = maxW;
      lines = wrapToWidth(name, w - pad, 7.1);
    }
    const h = Math.max(STEP_H, 20 + lines.length * 16);
    return { w, h, lines };
  }

  function measureAction(action, showBody, maxW) {
    const w = Math.max(80, Math.min(400, maxW || 220));
    const inner = w - 18;
    const nameLines = wrapToWidth(action.operand || '', inner - 26, 6.4);
    const raw = showBody && !action.isBoolean ? (action.body || []) : [];
    const lines = raw.flatMap(l => wrapToWidth(l, inner, 6.6));
    const titleH = Math.max(22, 8 + nameLines.length * 14);
    const bodyH = lines.length ? 6 + lines.length * 14 : 0;
    return { w, h: titleH + bodyH, nameLines: nameLines.length ? nameLines : [''], lines, titleH };
  }

  function overlap(a, b, pad) {
    const p = pad == null ? 4 : pad;
    return a.x < b.x + b.w + p && a.x + a.w + p > b.x && a.y < b.y + b.h + p && a.y + a.h + p > b.y;
  }

  function layout(chart) {
    const boxes = {};
    const stepList = [];
    chart.steps.forEach(step => {
      const name = step.operand || `Step ${step.id}`;
      const m = measureStepName(name);
      const x = sx(step.x);
      const y = sx(step.y);
      const box = {
        node: step, nameLines: m.lines,
        x, y, w: m.w, h: m.h,
        cx: x + m.w / 2, cy: y + m.h / 2,
        acts: [], actW: 0, actH: 0, actX: x + m.w + 16, actY: y
      };
      boxes[step.id] = box;
      stepList.push(box);
    });

    stepList.forEach(box => {
      const others = stepList.filter(o => o !== box && o.x > box.x + 4);
      const band = others.filter(o => o.y < box.y + box.h + 48 && o.y + o.h > box.y - 12);
      const nextX = band.length ? Math.min(...band.map(o => o.x)) : Infinity;
      const gap = Number.isFinite(nextX) ? nextX - (box.x + box.w) - 20 : 280;
      if (gap > 0 && box.w > STEP_W && box.x + box.w > nextX - 8) {
        const cap = Math.max(STEP_W, nextX - box.x - 12);
        if (cap < box.w) {
          const lines = wrapToWidth(box.node.operand || '', cap - 22, 7.1);
          box.w = cap;
          box.h = Math.max(STEP_H, 20 + lines.length * 16);
          box.nameLines = lines;
          box.cx = box.x + box.w / 2;
          box.cy = box.y + box.h / 2;
        }
      }
      const remain = Number.isFinite(nextX) ? nextX - (box.x + box.w) - 24 : 280;
      const actMax = Math.max(72, Math.min(360, remain));
      const show = box.node.showActions;
      box.actX = box.x + box.w + 16;
      box.actY = box.y;
      box.acts = box.node.actions.map(a => ({ action: a, m: measureAction(a, show, actMax) }));
      box.actW = box.acts.reduce((n, a) => Math.max(n, a.m.w), 0);
      box.actH = box.acts.reduce((n, a) => n + a.m.h + 4, 0);
    });

    chart.transitions.forEach(tr => {
      const x = sx(tr.x);
      const y = sx(tr.y);
      boxes[tr.id] = {
        node: tr,
        x, y, w: TRANS_W, h: 28,
        cx: x + TRANS_W / 2, cy: y + 10,
        label: null
      };
    });
    chart.stops.forEach(st => {
      const x = sx(st.x);
      const y = sx(st.y);
      const name = st.operand || 'Stop';
      const w = Math.max(80, name.length * 7.1 + 20);
      boxes[st.id] = { node: st, x, y, w, h: 36, cx: x + w / 2, cy: y + 18 };
    });
    chart.sbrRets.forEach(sb => {
      const x = sx(sb.x);
      const y = sx(sb.y);
      const w = Math.max(88, Math.max(String(sb.inn||'').length, String(sb.ret||'').length) * 6.6 + 40);
      boxes[sb.id] = { node: sb, x, y, w, h: 48, cx: x + w / 2, cy: y + 24 };
    });
    chart.textBoxes.forEach(tb => {
      const x = sx(tb.x);
      const y = sx(tb.y);
      const w = sx(tb.width) || 180;
      const lines = wrapToWidth(tb.text || '', w - 16, 6.4);
      const h = Math.max(36, 16 + lines.length * 14);
      boxes[tb.id] = { node: tb, x, y, w, h, cx: x + w / 2, cy: y + h / 2, lines };
    });

    function occupy() {
      const rects = [];
      Object.keys(boxes).forEach(id => {
        const b = boxes[id];
        if (!b || !b.node || b.node.kind === 'leg' || b.node.kind === 'branch' || b.node.kind === 'transition') return;
        rects.push({ x: b.x, y: b.y, w: b.w, h: b.h, id: b.node.id });
        if (b.acts && b.acts.length && b.actW) {
          rects.push({ x: b.actX, y: b.actY, w: b.actW, h: Math.max(b.actH, b.h), id: b.node.id });
        }
      });
      return rects;
    }

    const transBoxes = chart.transitions.map(tr => boxes[tr.id]).filter(Boolean).sort((a, b) => a.x - b.x || a.y - b.y);
    transBoxes.forEach(box => {
      const rects = occupy();
      transBoxes.forEach(other => {
        if (other !== box && other.label && other.label.r) rects.push(other.label.r);
      });
      const cx = box.cx;
      const y = box.y;
      const name = box.node.operand || '';
      const rawCond = (box.node.condition || []).join(' ');
      function attempt(side, maxW, yOff) {
        const condLines = wrapToWidth(rawCond, maxW, 6.6);
        const textW = Math.max(name.length * 6.2, ...condLines.map(l => l.length * 6.6), 36);
        const textH = 12 + (name ? 12 : 0) + condLines.length * 13;
        const lx = side === 'left' ? cx - 22 - textW : cx + 22;
        const ly = y + (yOff || -2);
        const r = { x: lx, y: ly, w: textW + 6, h: textH + 4, id: box.node.id };
        const hit = rects.some(o => o.id !== box.node.id && overlap(r, o, 2));
        return { hit, side, lx, ly, name, condLines, r };
      }
      let placed = null;
      const sides = ['right', 'left'];
      const widths = [220, 170, 130, 96];
      const yOffs = [-2, 18, 28];
      outer: for (let yi = 0; yi < yOffs.length; yi++) {
        for (let si = 0; si < sides.length; si++) {
          for (let wi = 0; wi < widths.length; wi++) {
            const p = attempt(sides[si], widths[wi], yOffs[yi]);
            if (!p.hit) { placed = p; break outer; }
            placed = p;
          }
        }
      }
      if (!placed || placed.hit) {
        const condLines = wrapToWidth(rawCond, 160, 6.6);
        const textW = Math.max(name.length * 6.2, ...condLines.map(l => l.length * 6.6), 36);
        const lx = cx + 22;
        const blockers = rects.filter(o => o.id !== box.node.id && o.x < lx + textW && o.x + o.w > lx);
        const topBlock = blockers.filter(o => o.y >= y).sort((a, b) => a.y - b.y)[0];
        const ly = topBlock ? Math.max(y - 4 - (12 + (name ? 12 : 0) + condLines.length * 13), y - 48) : y + 22;
        const r = { x: lx, y: ly, w: textW + 6, h: 16 + condLines.length * 13, id: box.node.id };
        placed = { hit: false, side: 'right', lx, ly, name, condLines, r };
      }
      box.label = placed;
    });

    chart.branches.forEach(br => {
      const linkedXs = [];
      chart.links.forEach(link => {
        const touch = String(link.fromId) === String(br.id) || String(link.toId) === String(br.id)
          || br.legs.some(l => String(l.id) === String(link.fromId) || String(l.id) === String(link.toId));
        if (!touch) return;
        const otherId = String(link.fromId) === String(br.id) || br.legs.some(l => String(l.id) === String(link.fromId))
          ? link.toId : link.fromId;
        const other = boxes[otherId] || boxes[String(otherId)];
        if (other) linkedXs.push(other.cx);
      });
      br.legs.forEach(leg => {
        if (boxes[leg.id] && boxes[leg.id].cx) linkedXs.push(boxes[leg.id].cx);
      });
      const y = sx(br.y);
      const x0 = linkedXs.length ? Math.min(...linkedXs) : 80;
      const x1 = linkedXs.length ? Math.max(...linkedXs) : x0 + 160;
      const box = {
        node: br,
        x: x0 - 8, y: y - 4,
        w: Math.max(40, x1 - x0 + 16),
        h: br.branchType === 'Simultaneous' ? 10 : 4,
        cx: (x0 + x1) / 2, cy: y,
        x0, x1, yLine: y
      };
      boxes[br.id] = box;
      br.legs.forEach(leg => { if (leg.id != null) boxes[leg.id] = box; });
    });
    return boxes;
  }

  function resolveBox(boxes, id) {
    return boxes[id] || boxes[String(id)] || null;
  }

  function pin(box, side, other) {
    if (box.node.kind === 'branch') {
      const x = other ? other.cx : box.cx;
      const y = box.yLine;
      if (side === 'top') return { x, y };
      return { x, y: y + (box.node.branchType === 'Simultaneous' ? 6 : 0) };
    }
    if (side === 'top') return { x: box.cx, y: box.y };
    if (side === 'bottom') return { x: box.cx, y: box.y + (box.node.kind === 'transition' ? 22 : box.h) };
    return { x: box.cx, y: box.cy };
  }

  function ortho(a, b) {
    if (Math.abs(a.x - b.x) < 1) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
    const mid = (a.y + b.y) / 2;
    return `M ${a.x} ${a.y} L ${a.x} ${mid} L ${b.x} ${mid} L ${b.x} ${b.y}`;
  }

  function svgDefs() {
    return `<defs>
      <marker id="sfc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="${INK}"/>
      </marker>
      <marker id="sfc-jump" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
        <path d="M 0 1 L 9 5 L 0 9 z" fill="${INK}"/>
      </marker>
    </defs>
    <style>
      .sfc-wire{fill:none;stroke:${INK};stroke-width:1.4;vector-effect:non-scaling-stroke}
      .sfc-branch{fill:none;stroke:${INK};stroke-width:2.1;vector-effect:non-scaling-stroke}
      .sfc-box{fill:${PAPER};stroke:${INK};stroke-width:1.35}
      .sfc-name{font:700 12px Arial,'Segoe UI',sans-serif;fill:${TEXT};text-anchor:middle}
      .sfc-st{font:11px 'Consolas','SFMono-Regular',ui-monospace,monospace;fill:${ST}}
      .sfc-qual{font:700 11px Arial,'Segoe UI',sans-serif;fill:${INK}}
      .sfc-label{font:11px Arial,'Segoe UI',sans-serif;fill:${TEXT}}
      .sfc-note{font:11px Arial,'Segoe UI',sans-serif;fill:#333}
      .sfc-dash{stroke-dasharray:4 3}
    </style>`;
  }

  function drawStep(box) {
    const s = box.node;
    const { x, y, w, h } = box;
    const clip = `sfc-clip-${s.id}`;
    const parts = [];
    parts.push(`<clipPath id="${clip}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="11" ry="11"/></clipPath>`);
    parts.push(`<rect class="sfc-box" x="${x}" y="${y}" width="${w}" height="${h}" rx="11" ry="11"/>`);
    if (s.initialStep) {
      parts.push(`<rect x="${x + 4}" y="${y + 4}" width="5" height="${h - 8}" rx="1" fill="${INK}"/>`);
    }
    parts.push(`<circle cx="${x + w / 2}" cy="${y}" r="3.2" fill="${PAPER}" stroke="${INK}" stroke-width="1.2"/>`);
    parts.push(`<circle cx="${x + w / 2}" cy="${y + h}" r="3.2" fill="${PAPER}" stroke="${INK}" stroke-width="1.2"/>`);
    const names = box.nameLines && box.nameLines.length ? box.nameLines : [s.operand || `Step ${s.id}`];
    const nameTop = y + h / 2 - (names.length - 1) * 8 + 4;
    names.forEach((ln, i) => {
      parts.push(`<text class="sfc-name" clip-path="url(#${clip})" x="${x + w / 2}" y="${nameTop + i * 16}">${esc(ln)}</text>`);
    });
    const ax = box.actX || x + w + 16;
    let ay = box.actY || y;
    box.acts.forEach((item, i) => {
      const aw = item.m.w;
      const ah = item.m.h;
      const aclip = `sfc-aclip-${s.id}-${i}`;
      if (i === 0) {
        parts.push(`<line class="sfc-wire" x1="${x + w}" y1="${y + h / 2}" x2="${ax}" y2="${y + h / 2}"/>`);
        parts.push(`<rect class="sfc-box" x="${ax - 6}" y="${y + h / 2 - 6}" width="12" height="12" rx="1"/>`);
      }
      parts.push(`<clipPath id="${aclip}"><rect x="${ax}" y="${ay}" width="${aw}" height="${ah}"/></clipPath>`);
      parts.push(`<rect class="sfc-box" x="${ax}" y="${ay}" width="${aw}" height="${ah}" rx="1"/>`);
      const nameLines = item.m.nameLines || [item.action.operand];
      nameLines.forEach((ln, li) => {
        if (li === 0) {
          parts.push(`<text class="sfc-qual" clip-path="url(#${aclip})" x="${ax + 8}" y="${ay + 15}">${esc(item.action.qualifier)}</text>`);
          parts.push(`<text class="sfc-label" clip-path="url(#${aclip})" x="${ax + 28}" y="${ay + 15}">${esc(ln)}</text>`);
        } else {
          parts.push(`<text class="sfc-label" clip-path="url(#${aclip})" x="${ax + 28}" y="${ay + 15 + li * 14}">${esc(ln)}</text>`);
        }
      });
      const titleH = item.m.titleH || 22;
      if (item.m.lines.length) {
        parts.push(`<line class="sfc-wire" x1="${ax}" y1="${ay + titleH}" x2="${ax + aw}" y2="${ay + titleH}"/>`);
        item.m.lines.forEach((ln, li) => {
          parts.push(`<text class="sfc-st" clip-path="url(#${aclip})" x="${ax + 8}" y="${ay + titleH + 14 + li * 14}">${esc(ln)}</text>`);
        });
      }
      ay += ah + 4;
    });
    return parts.join('');
  }

  function drawTransition(box) {
    const cx = box.cx;
    const y = box.y;
    const parts = [
      `<line class="sfc-wire" x1="${cx - 18}" y1="${y + 8}" x2="${cx + 18}" y2="${y + 8}"/>`,
      `<path d="M ${cx} ${y + 8} L ${cx - 7} ${y + 20} L ${cx + 7} ${y + 20} Z" fill="${INK}"/>`
    ];
    const lab = box.label;
    if (lab) {
      let ty = lab.ly + 12;
      if (lab.name) {
        parts.push(`<text class="sfc-label" x="${lab.lx}" y="${ty}">${esc(lab.name)}</text>`);
        ty += 13;
      }
      (lab.condLines || []).forEach(ln => {
        parts.push(`<text class="sfc-st" x="${lab.lx}" y="${ty}">${esc(ln)}</text>`);
        ty += 13;
      });
    }
    return parts.join('');
  }

  function drawBranch(box) {
    const br = box.node;
    const y = box.yLine;
    const x0 = box.x0;
    const x1 = box.x1;
    if (br.branchType === 'Simultaneous') {
      return `<line class="sfc-branch" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>` +
        `<line class="sfc-branch" x1="${x0}" y1="${y + 6}" x2="${x1}" y2="${y + 6}"/>`;
    }
    return `<line class="sfc-branch" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>`;
  }

  function drawStop(box) {
    const s = box.node;
    const { x, y, w, h, cx } = box;
    return `<rect class="sfc-box" x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>` +
      `<rect x="${x}" y="${y + h - 7}" width="${w}" height="7" fill="${INK}"/>` +
      `<text class="sfc-name" x="${cx}" y="${y + 18}">${esc(s.operand || 'Stop')}</text>`;
  }

  function drawSbrRet(box) {
    const s = box.node;
    const { x, y, w, h } = box;
    return `<rect class="sfc-box" x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>` +
      `<text class="sfc-qual" x="${x + 8}" y="${y + 18}">In</text>` +
      `<text class="sfc-label" x="${x + 28}" y="${y + 18}">${esc(s.inn)}</text>` +
      `<text class="sfc-qual" x="${x + 8}" y="${y + 36}">Ret</text>` +
      `<text class="sfc-label" x="${x + 28}" y="${y + 36}">${esc(s.ret)}</text>`;
  }

  function drawTextBox(box) {
    const { x, y, w, h, lines } = box;
    const body = (lines || []).map((ln, i) =>
      `<text class="sfc-note" x="${x + 8}" y="${y + 16 + i * 14}">${esc(ln)}</text>`
    ).join('');
    return `<rect class="sfc-box sfc-dash" x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#fafafa"/>${body}`;
  }

  function drawLink(chart, boxes, link, warnings) {
    const from = resolveBox(boxes, link.fromId);
    const to = resolveBox(boxes, link.toId);
    if (!from) {
      warnings.push(`DirectedLink FromID ${link.fromId}를 찾지 못했습니다.`);
      return '';
    }
    if (!to) {
      warnings.push(`DirectedLink ToID ${link.toId}를 찾지 못했습니다.`);
      return '';
    }
    const a = pin(from, 'bottom', to);
    const b = pin(to, 'top', from);
    if (!link.show) {
      const label = (to.node.operand || to.node.inn || `ID ${to.node.id}`) + '';
      const jx = a.x + 28;
      const jy = a.y + 18;
      return `<path class="sfc-wire" d="M ${a.x} ${a.y} L ${a.x} ${jy} L ${jx} ${jy}" marker-end="url(#sfc-jump)"/>` +
        `<text class="sfc-label" x="${jx + 8}" y="${jy + 4}">${esc(label)}</text>`;
    }
    return `<path class="sfc-wire" d="${ortho(a, b)}" marker-end="url(#sfc-arrow)"/>`;
  }

  function renderSFC(chart) {
    const warnings = [...(chart && chart.warnings || [])];
    if (!chart || (!chart.steps.length && !chart.transitions.length && !chart.branches.length && !chart.stops.length)) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="200" viewBox="0 0 640 200" role="img" aria-label="empty SFC">` +
        `<rect width="100%" height="100%" fill="${PAPER}"/>` +
        `<text x="24" y="48" fill="#666" font-size="14">그릴 SFC 요소가 없습니다.</text></svg>`;
      return { svg, width: 640, height: 200, warnings, kind: 'sfc', chart };
    }
    const boxes = layout(chart);
    const parts = [];
    chart.links.forEach(link => parts.push(drawLink(chart, boxes, link, warnings)));
    chart.branches.forEach(br => { const b = boxes[br.id]; if (b) parts.push(drawBranch(b)); });
    chart.steps.forEach(st => { const b = boxes[st.id]; if (b) parts.push(drawStep(b)); });
    chart.transitions.forEach(tr => { const b = boxes[tr.id]; if (b) parts.push(drawTransition(b)); });
    chart.stops.forEach(st => { const b = boxes[st.id]; if (b) parts.push(drawStop(b)); });
    chart.sbrRets.forEach(sb => { const b = boxes[sb.id]; if (b) parts.push(drawSbrRet(b)); });
    chart.textBoxes.forEach(tb => { const b = boxes[tb.id]; if (b) parts.push(drawTextBox(b)); });

    let minX = 24, minY = 24, maxX = 400, maxY = 300;
    Object.keys(boxes).forEach(id => {
      const b = boxes[id];
      if (!b || b.node.kind === 'leg') return;
      const right = b.x + b.w + (b.actW ? b.actW + 24 : 0);
      const bottom = b.y + Math.max(b.h, b.actH || 0) + (b.label && b.label.r ? b.label.r.h : 0);
      minX = Math.min(minX, b.x, b.label && b.label.r ? b.label.r.x : b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, right, b.label && b.label.r ? b.label.r.x + b.label.r.w : right);
      maxY = Math.max(maxY, bottom);
    });
    const pad = 36;
    const width = Math.max(640, Math.ceil(maxX - Math.min(0, minX) + pad * 2));
    const height = Math.max(320, Math.ceil(maxY + pad * 2));
    const ox = minX < pad ? pad - minX : 0;
    const oy = minY < pad ? pad - minY : 0;
    const inner = `<g transform="translate(${ox} ${oy})">${parts.join('')}</g>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Sequential function chart">` +
      `<rect width="100%" height="100%" fill="${PAPER}"/>${svgDefs()}${inner}</svg>`;
    return { svg, width, height, warnings, kind: 'sfc', chart, boxes };
  }

  function chartToText(chart) {
    const lines = [];
    (chart.steps || []).forEach(s => {
      lines.push(`STEP ${s.operand || s.id}${s.initialStep ? '  (initial)' : ''}`);
      s.actions.forEach(a => {
        lines.push(`  ${a.qualifier} ${a.operand}`);
        a.body.forEach(b => lines.push(`    ${b}`));
      });
    });
    (chart.transitions || []).forEach(t => {
      lines.push(`TRANS ${t.operand || t.id}`);
      t.condition.forEach(c => lines.push(`  ${c}`));
    });
    (chart.branches || []).forEach(b => {
      lines.push(`BRANCH ${b.branchType} ${b.branchFlow}`);
    });
    (chart.stops || []).forEach(s => lines.push(`STOP ${s.operand || s.id}`));
    return lines.join('\n');
  }

  const api = { parseSFC, parseSFCFromXml, renderSFC, chartToText, qualifierAbbrev };
  global.L5XSFC = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
