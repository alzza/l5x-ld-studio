(function (global) {
  'use strict';

  const KEYWORDS = new Set([
    'if', 'then', 'elsif', 'else', 'end_if',
    'case', 'of', 'end_case',
    'for', 'to', 'by', 'do', 'end_for',
    'while', 'end_while',
    'repeat', 'until', 'end_repeat',
    'exit', 'return',
    'and', 'or', 'xor', 'not', 'mod',
    'true', 'false'
  ]);
  const TYPES = new Set([
    'bool', 'sint', 'int', 'dint', 'lint',
    'usint', 'uint', 'udint', 'ulint',
    'real', 'lreal', 'string'
  ]);
  const COLORS = {
    kw: '#c586c0',
    type: '#4ec9b0',
    fn: '#dcdcaa',
    num: '#b5cea8',
    str: '#ce9178',
    cm: '#6a9955',
    op: '#d4d4d4',
    id: '#9cdcfe',
    punct: '#d4d4d4',
    text: '#d4d4d4'
  };

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function tokenize(src) {
    const s = String(src ?? '');
    const out = [];
    let i = 0;
    const n = s.length;
    function push(type, text) { if (text) out.push({ type, text }); }
    while (i < n) {
      const c = s[i];
      if (c === '\r') { i++; continue; }
      if (c === '\n') { push('nl', '\n'); i++; continue; }
      if (c === ' ' || c === '\t') {
        let j = i + 1;
        while (j < n && (s[j] === ' ' || s[j] === '\t')) j++;
        push('ws', s.slice(i, j));
        i = j;
        continue;
      }
      if (c === '/' && s[i + 1] === '/') {
        let j = i + 2;
        while (j < n && s[j] !== '\n') j++;
        push('cm', s.slice(i, j));
        i = j;
        continue;
      }
      if (c === '/' && s[i + 1] === '*') {
        let j = i + 2;
        while (j < n - 1 && !(s[j] === '*' && s[j + 1] === '/')) j++;
        j = Math.min(n, j + 2);
        push('cm', s.slice(i, j));
        i = j;
        continue;
      }
      if (c === '(' && s[i + 1] === '*') {
        let j = i + 2;
        while (j < n - 1 && !(s[j] === '*' && s[j + 1] === ')')) j++;
        j = Math.min(n, j + 2);
        push('cm', s.slice(i, j));
        i = j;
        continue;
      }
      if (c === "'") {
        let j = i + 1;
        while (j < n) {
          if (s[j] === "'" && s[j + 1] === "'") { j += 2; continue; }
          if (s[j] === "'") { j++; break; }
          if (s[j] === '\n') break;
          j++;
        }
        push('str', s.slice(i, j));
        i = j;
        continue;
      }
      if (c === '[' && s.slice(i, i + 4) === '[:=]') {
        push('op', '[:=]');
        i += 4;
        continue;
      }
      if (s.slice(i, i + 2) === ':=' || s.slice(i, i + 2) === '<>' || s.slice(i, i + 2) === '<=' || s.slice(i, i + 2) === '>=' || s.slice(i, i + 2) === '**') {
        push('op', s.slice(i, i + 2));
        i += 2;
        continue;
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) {
        let j = i;
        while (j < n && /[0-9]/.test(s[j])) j++;
        if (s[j] === '#') {
          j++;
          while (j < n && /[0-9A-Za-z_]/.test(s[j])) j++;
        } else {
          if (s[j] === '.' && /[0-9]/.test(s[j + 1] || '')) {
            j++;
            while (j < n && /[0-9_]/.test(s[j])) j++;
          }
          if (s[j] === 'e' || s[j] === 'E') {
            j++;
            if (s[j] === '+' || s[j] === '-') j++;
            while (j < n && /[0-9]/.test(s[j])) j++;
          }
        }
        push('num', s.slice(i, j));
        i = j;
        continue;
      }
      if (/[A-Za-z_\u00C0-\u024F]/.test(c)) {
        let j = i + 1;
        while (j < n && /[A-Za-z0-9_\u00C0-\u024F]/.test(s[j])) j++;
        const raw = s.slice(i, j);
        const low = raw.toLowerCase();
        let k = j;
        while (k < n && (s[k] === ' ' || s[k] === '\t')) k++;
        if (KEYWORDS.has(low)) push('kw', raw);
        else if (TYPES.has(low)) push('type', raw);
        else if (s[k] === '(') push('fn', raw);
        else push('id', raw);
        i = j;
        continue;
      }
      if ('=<>+-*/&,;:.()[]'.includes(c)) {
        push('op', c);
        i++;
        continue;
      }
      push('text', c);
      i++;
    }
    return out;
  }

  const BLANK_RE = /[\s\u00A0\u1680\u2000-\u200D\u2028\u2029\u202F\u205F\u3000\uFEFF]/g;
  function isBlankLine(l) {
    return !String(l || '').replace(BLANK_RE, '');
  }
  function compactSource(src) {
    return String(src || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter(l => !isBlankLine(l))
      .map(l => l.replace(/[ \t\u00A0]+$/g, ''))
      .join('\n');
  }

  function tokenHtml(tok) {
    if (tok.type === 'nl') return '';
    if (tok.type === 'ws') return esc(tok.text);
    const cls = tok.type;
    return `<span class="st-${cls}">${esc(tok.text)}</span>`;
  }

  function highlightHtml(src) {
    const tokens = tokenize(compactSource(src));
    const lines = [[]];
    tokens.forEach(tok => {
      if (tok.type === 'nl') lines.push([]);
      else lines[lines.length - 1].push(tok);
    });
    const kept = lines.filter(toks => !isBlankLine(toks.map(t => t.text).join('')));
    const rows = kept.length ? kept : [[]];
    const width = String(Math.max(1, rows.length)).length;
    return rows.map((toks, i) => {
      const ln = String(i + 1).padStart(width, ' ');
      const code = toks.map(tokenHtml).join('') || ' ';
      return `<div class="st-line"><span class="st-ln">${ln}</span><span class="st-code">${code}</span></div>`;
    }).join('');
  }

  function svgFill(type) {
    return COLORS[type] || COLORS.text;
  }

  function svgTspans(src) {
    return tokenize(src).filter(t => t.type !== 'nl').map(t => {
      if (t.type === 'ws') return esc(t.text);
      return `<tspan fill="${svgFill(t.type)}">${esc(t.text)}</tspan>`;
    }).join('');
  }

  const api = { tokenize, highlightHtml, svgTspans, compactSource, isBlankLine, COLORS };
  global.L5XST = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
