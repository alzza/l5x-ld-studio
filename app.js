(function () {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = { project: null, selected: null, tab: 'ladder', zoom: 1, showRaw: false, showRungMeta: true, rendered: [], tagValues: {} };
  const outputOps = new Set(['OTE','OTL','OTU','RES','MOV','COP','CPS','JSR','JMP','RET','SFR','FOR','BRK','FFL','FFU','BSL','BSR','SQL','SQO','FBC']);
  const contactOps = new Set(['XIC','XIO','ONS','OSR','OSF']);
  const compareOps = new Set(['EQU','NEQ','LES','LEQ','GRT','GEQ','LIM','MEQ','CMP']);
  const timerOps = new Set(['TON','TOF','RTO','CTU','CTD']);
  const instructionNames = {
    TON:'Timer On Delay',TOF:'Timer Off Delay',RTO:'Retentive Timer On',CTU:'Count Up',CTD:'Count Down',
    MOV:'Move',CLR:'Clear',SWPB:'Swap Byte',ADD:'Add',SUB:'Subtract',MUL:'Multiply',DIV:'Divide',ABS:'Absolute Value',CPT:'Compute',
    EQU:'Equal',NEQ:'Not Equal',LES:'Less Than',LEQ:'Less Than or Equal',GRT:'Greater Than',GEQ:'Greater Than or Equal',LIM:'Limit Test',CMP:'Compare',
    JSR:'Jump to Subroutine',SBR:'Subroutine',RET:'Return',SFR:'SFC Reset',FOR:'For Loop',BRK:'Break',AFI:'Always False',RES:'Reset',BSR:'Bit Shift Right',
    MSG:'Message',PID:'PID',OR:'Bitwise OR',ONS:'One Shot',OSR:'One Shot Rising',OSF:'One Shot Falling'
  };
  const operandNames = {
    TON:['Timer','Preset','Accum'],TOF:['Timer','Preset','Accum'],RTO:['Timer','Preset','Accum'],CTU:['Counter','Preset','Accum'],CTD:['Counter','Preset','Accum'],
    MOV:['Source','Dest'],CLR:['Dest'],SWPB:['Source','Dest'],ADD:['Source A','Source B','Dest'],SUB:['Source A','Source B','Dest'],MUL:['Source A','Source B','Dest'],DIV:['Source A','Source B','Dest'],ABS:['Source','Dest'],CPT:['Dest','Expression'],
    EQU:['Source A','Source B'],NEQ:['Source A','Source B'],LES:['Source A','Source B'],LEQ:['Source A','Source B'],GRT:['Source A','Source B'],GEQ:['Source A','Source B'],LIM:['Low Limit','Test','High Limit'],CMP:['Expression'],
    JSR:['Routine Name','Input Count'],SBR:['Input Count'],RET:['Return Count'],SFR:['SFC Name','Restart Step'],FOR:['Index','Initial','Terminal','Step'],BRK:[],RES:['Structure'],BSR:['Array','Control','Bit Address','Length'],
    MSG:['Message Control'],PID:['PID','Process Variable','Tieback','Control Variable','Master Loop','Inhold'],OR:['Source A','Source B','Dest']
  };

  class RLLParser {
    constructor(text) { this.text = text || ''; this.i = 0; this.warnings = []; }
    parse() {
      const node = this.sequence(new Set([';']));
      if (this.peek() === ';') this.i++;
      if (this.i < this.text.length) this.warnings.push(`해석되지 않은 문자열: ${this.text.slice(this.i, this.i + 60)}`);
      return node;
    }
    sequence(stops) {
      const children = [];
      while (this.i < this.text.length) {
        this.ws(); const c = this.peek();
        if (!c || stops.has(c)) break;
        if (c === '[') children.push(this.parallel());
        else {
          const inst = this.instruction();
          if (inst) children.push(inst);
          else { this.warnings.push(`위치 ${this.i}의 '${c}'를 건너뜀`); this.i++; }
        }
      }
      return { type: 'sequence', children };
    }
    parallel() {
      this.i++; const branches = [];
      while (this.i < this.text.length) {
        branches.push(this.sequence(new Set([',', ']'])));
        this.ws();
        if (this.peek() === ',') { this.i++; continue; }
        if (this.peek() === ']') { this.i++; break; }
        this.warnings.push('닫히지 않은 병렬 분기'); break;
      }
      return { type: 'parallel', branches };
    }
    instruction() {
      this.ws(); const start = this.i;
      while (/[A-Za-z0-9_]/.test(this.peek() || '')) this.i++;
      if (this.i === start) return null;
      const op = this.text.slice(start, this.i).toUpperCase(); this.ws();
      if (this.peek() !== '(') return { type: 'instruction', op, args: [], raw: op };
      const argStart = ++this.i; let depth = 1, quote = '', commaAt = [];
      while (this.i < this.text.length && depth) {
        const c = this.text[this.i];
        if (quote) { if (c === quote && this.text[this.i - 1] !== '\\') quote = ''; }
        else if (c === '"' || c === "'") quote = c;
        else if (c === '(' || c === '[') depth++;
        else if (c === ')' || c === ']') depth--;
        else if (c === ',' && depth === 1) commaAt.push(this.i);
        this.i++;
      }
      if (depth) this.warnings.push(`${op} 괄호가 닫히지 않음`);
      const inside = this.text.slice(argStart, Math.max(argStart, this.i - 1));
      const args = splitArgs(inside);
      return { type: 'instruction', op, args, raw: this.text.slice(start, this.i) };
    }
    ws() { while (/\s/.test(this.peek() || '')) this.i++; }
    peek() { return this.text[this.i]; }
  }

  function splitArgs(s) {
    const out = []; let start = 0, depth = 0, quote = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (quote) { if (c === quote && s[i - 1] !== '\\') quote = ''; }
      else if (c === '"' || c === "'") quote = c;
      else if ('(['.includes(c)) depth++;
      else if (')]'.includes(c)) depth--;
      else if (c === ',' && depth === 0) { out.push(s.slice(start, i).trim()); start = i + 1; }
    }
    out.push(s.slice(start).trim()); return out;
  }

  function parseProject(text, filename) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const error = doc.querySelector('parsererror');
    if (error) throw new Error('유효한 XML/L5X 파일이 아닙니다. ' + error.textContent.slice(0, 100));
    const controller = doc.querySelector('Controller');
    const programs = [];
    $$('Programs > Program', doc).forEach((program, pi) => {
      const routines = [];
      $$(':scope > Routines > Routine', program).forEach((routine, ri) => {
        const type = routine.getAttribute('Type') || 'Unknown';
        const item = {
          id: `p${pi}r${ri}`, name: routine.getAttribute('Name') || `Routine ${ri + 1}`, type,
          program: program.getAttribute('Name') || `Program ${pi + 1}`, element: routine,
          source: '', rungs: [], comments: []
        };
        if (type === 'RLL') {
          item.rungs = $$(':scope > RLLContent > Rung', routine).map(r => ({
            number: r.getAttribute('Number') || '', type: r.getAttribute('Type') || 'N',
            text: ($(':scope > Text', r)?.textContent || '').trim(),
            comment: ($(':scope > Comment', r)?.textContent || '').trim()
          }));
          item.source = item.rungs.map(r => `Rung ${r.number}:\n${r.text}`).join('\n\n');
        } else if (type === 'ST') {
          const lines = $$(':scope > STContent > Line', routine).map(l => ({ number: l.getAttribute('Number'), text: l.textContent || '' }));
          item.source = lines.map(l => l.text).join('\n');
        } else {
          item.source = serializeRoutineXML(routine);
        }
        routines.push(item);
      });
      if (routines.length) programs.push({ name: program.getAttribute('Name') || `Program ${pi + 1}`, routines });
    });
    const all = programs.flatMap(p => p.routines);
    return {
      filename, name: controller?.getAttribute('Name') || filename.replace(/\.l5x$/i, ''),
      software: doc.documentElement.getAttribute('SoftwareRevision') || '', programs, all,
      tags: $$('Controller > Tags > Tag, Program > Tags > Tag', doc).length,
      rungCount: all.filter(r => r.type === 'RLL').reduce((n, r) => n + r.rungs.length, 0)
    };
  }

  function serializeRoutineXML(routine) {
    return new XMLSerializer().serializeToString(routine).replace(/></g, '>\n<');
  }

  /* Logix Designer uses a fixed horizontal signal path.  Parallel paths keep
     the first branch on that path and add the remaining branches underneath. */
  function measure(node) {
    if (!node || node.type === 'instruction') {
      const block = node && (timerOps.has(node.op) || compareOps.has(node.op) || (!contactOps.has(node.op) && !outputOps.has(node.op)));
      const longest = Math.max(node?.op.length || 3, ...(node?.args || []).map(a => a.length));
      return block
        ? {w:Math.max(178,longest*7+76),h:Math.max(84,52+(node?.args.length||0)*20)}
        : {w:Math.max(116,longest*7+44),h:72};
    }
    if (node.type === 'sequence') {
      const ms = node.children.map(measure);
      return { w: Math.max(48, ms.reduce((n,m)=>n+m.w,0) + Math.max(0,ms.length-1)*18), h: Math.max(72, ...ms.map(m=>m.h)) };
    }
    const ms = node.branches.map(measure);
    return { w: Math.max(104, ...ms.map(m=>m.w)), h: Math.max(72, ms.reduce((n,m)=>n+m.h,0) + Math.max(0,ms.length-1)*BRANCH_GAP) };
  }
  function leafCount(node){if(node.type==='instruction')return 1;if(node.type==='sequence')return node.children.reduce((n,x)=>n+leafCount(x),0);return Math.max(0,...node.branches.map(leafCount));}
  const BRANCH_GAP = 88;

  function renderRung(rung, index, viewportWidth = 900, showIndex = false) {
    const parser = new RLLParser(rung.text); const ast = parser.parse(); const m = measure(ast);
    // Number column used to reserve 72px on the left.  Captured SVGs keep the
    // smaller right pad on both sides so the ladder can scale up on notes.
    const pad = 22;
    const railL = showIndex ? 72 : pad;
    const nodePadL = 32;
    const nodePadR = 34;
    const contentW = m.w + railL + pad + nodePadL + nodePadR;
    const fill = viewportWidth > 0;
    const W = Math.max(contentW, fill ? Math.max(1040, viewportWidth) : 0);
    const H = Math.max(118, m.h + 54), y = 42;
    const railR = W - pad, nodeL = railL + nodePadL, nodeR = W - pad - nodePadR, drawW = nodeR - nodeL;
    const indexText = showIndex ? `<text class="rung-index" x="18" y="${y+4}">${esc(rung.number)}</text>` : '';
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rung ${esc(rung.number)} ladder diagram">`, svgDefs(), `${indexText}<line class="rail" x1="${railL}" y1="0" x2="${railL}" y2="${H}"/><line class="rail" x1="${railR}" y1="0" x2="${railR}" y2="${H}"/>`];
    parts.push(`<line class="wire" x1="${railL}" y1="${y}" x2="${nodeL}" y2="${y}"/>`);
    renderRoot(ast,nodeL,y,drawW,parts);
    parts.push(`<line class="wire" x1="${nodeR}" y1="${y}" x2="${railR}" y2="${y}"/>`, '</svg>');
    const warnings = [...parser.warnings];
    return { svg: parts.join(''), ast, warnings, rung, index, width:W };
  }

  function svgDefs() { return `<style>.wire,.rail,.device{fill:none;stroke:#243b7a;stroke-width:1.45;vector-effect:non-scaling-stroke}.wire.active,.device.active{stroke:#15b84e;stroke-width:4}.rail{stroke:#243b7a;stroke-width:1.7}.junction{fill:#243b7a}.rung-index{font:14px Georgia,'Times New Roman',serif;fill:#243b7a}.label{font:13px Arial,'Segoe UI',sans-serif;fill:#111;text-anchor:middle}.op{font:700 10px Arial,'Segoe UI',sans-serif;fill:#243b7a;text-anchor:middle}.mnemonic{fill:#243b7a}.arg-label{font:11px Arial,'Segoe UI',sans-serif;fill:#243b7a}.arg-value{font:12px Arial,'Segoe UI',sans-serif;fill:#111;text-anchor:end}.block{fill:#fff;stroke:#243b7a;stroke-width:1.25}.divider{stroke:#243b7a;stroke-width:1}.unknown{fill:#fff8e8;stroke:#9a6b18}</style>`; }
  function isActionNode(node){
    if(node.type==='instruction')return outputOps.has(node.op)||timerOps.has(node.op)||['ADD','SUB','MUL','DIV','ABS','CPT','CLR','SWPB','OR','PID','MSG'].includes(node.op);
    if(node.type==='sequence')return node.children.length>0&&isActionNode(node.children.at(-1));
    return node.branches.length>0&&node.branches.every(isActionNode);
  }
  function renderRoot(ast,x,cy,width,out){
    if(ast.type==='sequence'&&ast.children.length){
      const last=ast.children.at(-1);
      if(isActionNode(last)){
        const outputW=Math.min(width,measure(last).w),outputX=x+width-outputW;
        const prefix={type:'sequence',children:ast.children.slice(0,-1)},prefixNatural=ast.children.length>1?measure(prefix).w:0;
        const prefixW=Math.min(prefixNatural,Math.max(0,outputX-x-72));
        if(prefix.children.length)renderNode(prefix,x,cy,prefixW,out);
        out.push(`<line class="wire" x1="${x+prefixW}" y1="${cy}" x2="${outputX}" y2="${cy}"/>`);
        renderNode(last,outputX,cy,outputW,out);return;
      }
    }
    if(isActionNode(ast)){
      const natural=Math.min(width,measure(ast).w),xx=x+width-natural;
      out.push(`<line class="wire" x1="${x}" y1="${cy}" x2="${xx}" y2="${cy}"/>`);renderNode(ast,xx,cy,natural,out);return;
    }
    const natural=Math.min(width,measure(ast).w);renderNode(ast,x,cy,natural,out);out.push(`<line class="wire" x1="${x+natural}" y1="${cy}" x2="${x+width}" y2="${cy}"/>`);
  }
  function renderNode(node, x, cy, width, out) {
    if (node.type === 'instruction') return renderInstruction(node, x, cy, width, out);
    if (node.type === 'sequence') {
      const ms = node.children.map(measure), natural = ms.reduce((n,m)=>n+m.w,0) || 1; let xx = x;
      node.children.forEach((child,i) => { const w = width * ms[i].w / natural; renderNode(child, xx, cy, w, out); xx += w; });
      if (!node.children.length) out.push(`<line class="wire" x1="${x}" y1="${cy}" x2="${x+width}" y2="${cy}"/>`); return;
    }
    const ms = node.branches.map(measure), gap = BRANCH_GAP;
    /* Do not center branches around the main line.  The first branch is the
       main rung and every additional path is routed downward like Logix. */
    let yy = cy; const centers = [];
    node.branches.forEach((b,i)=>{ centers.push(i===0 ? cy : yy + ms[i].h/2 - 36); yy += ms[i].h + gap; });
    if (centers.length) {
      const top = cy, bottom = centers.at(-1);
      out.push(`<line class="wire" x1="${x}" y1="${top}" x2="${x}" y2="${bottom}"/><line class="wire" x1="${x+width}" y1="${top}" x2="${x+width}" y2="${bottom}"/>`);
      centers.forEach((bc,i)=>{ out.push(`<circle class="junction" cx="${x}" cy="${bc}" r="3"/><circle class="junction" cx="${x+width}" cy="${bc}" r="3"/>`); renderNode(node.branches[i],x,bc,width,out); });
    }
  }
  function renderInstruction(n, x, cy, width, out) {
    const cx=x+width/2, label=String(n.args[0] || ''), wireL=x+8, wireR=x+width-8, active=instructionActive(n), live=active?' active':'';
    out.push(`<line class="wire${live}" x1="${x}" y1="${cy}" x2="${wireL}" y2="${cy}"/><line class="wire${live}" x1="${wireR}" y1="${cy}" x2="${x+width}" y2="${cy}"/>`);
    if (n.op==='XIC'||n.op==='XIO') {
      out.push(`<title>${esc(n.raw)}</title><text class="label" x="${cx}" y="${cy-17}">${esc(label)}</text><line class="device${live}" x1="${cx-10}" y1="${cy-12}" x2="${cx-10}" y2="${cy+12}"/><line class="device${live}" x1="${cx+10}" y1="${cy-12}" x2="${cx+10}" y2="${cy+12}"/>`);
      if(n.op==='XIO') out.push(`<line class="device${live}" x1="${cx-14}" y1="${cy+14}" x2="${cx+14}" y2="${cy-14}"/>`);
      out.push(`<line class="wire${live}" x1="${wireL}" y1="${cy}" x2="${cx-10}" y2="${cy}"/><line class="wire${live}" x1="${cx+10}" y1="${cy}" x2="${wireR}" y2="${cy}"/>`); return;
    }
    if (['OTE','OTL','OTU'].includes(n.op)) {
      const mark=n.op==='OTE'?'':n.op==='OTL'?'L':'U';
      out.push(`<title>${esc(n.raw)}</title><text class="label" x="${cx}" y="${cy-17}">${esc(label)}</text><path class="device${live}" d="M ${cx-15} ${cy-15} Q ${cx-25} ${cy} ${cx-15} ${cy+15} M ${cx+15} ${cy-15} Q ${cx+25} ${cy} ${cx+15} ${cy+15}"/><line class="wire${live}" x1="${wireL}" y1="${cy}" x2="${cx-21}" y2="${cy}"/><line class="wire${live}" x1="${cx+21}" y1="${cy}" x2="${wireR}" y2="${cy}"/><text class="label" x="${cx}" y="${cy+4}">${mark}</text>`); return;
    }
    if (['ONS','OSR','OSF'].includes(n.op)) {
      out.push(`<text class="label" x="${cx}" y="${cy-24}">${esc(label)}</text><rect class="block" x="${cx-23}" y="${cy-15}" width="46" height="30"/><text class="op" x="${cx}" y="${cy+3}">${n.op}</text><line class="wire" x1="${wireL}" y1="${cy}" x2="${cx-23}" y2="${cy}"/><line class="wire" x1="${cx+23}" y1="${cy}" x2="${wireR}" y2="${cy}"/>`); return;
    }
    const m=measure(n), bh=Math.min(m.h-8,Math.max(54,30+n.args.length*21)), bw=Math.min(width-18,Math.max(138,m.w-20)), bx=cx-bw/2, by=cy-bh/2;
    const known=contactOps.has(n.op)||compareOps.has(n.op)||timerOps.has(n.op)||outputOps.has(n.op)||instructionNames[n.op];
    out.push(`<title>${esc(instructionNames[n.op]||n.op)} · ${esc(n.raw)}</title><rect class="block ${known?'':'unknown'}" x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="1"/><text class="op mnemonic" x="${cx}" y="${by+13}">${esc(n.op)}</text><line class="divider" x1="${bx}" y1="${by+19}" x2="${bx+bw}" y2="${by+19}"/>`);
    n.args.slice(0,6).forEach((a,i)=>{const label=(operandNames[n.op]||[])[i]||(i?`Operand ${i+1}`:'Operand');const yy=by+35+i*21;out.push(`<text class="arg-label" x="${bx+7}" y="${yy}">${esc(label)}</text><text class="arg-value" x="${bx+bw-7}" y="${yy}">${esc(String(a))}</text>`)});
    out.push(`<line class="wire" x1="${wireL}" y1="${cy}" x2="${bx}" y2="${cy}"/><line class="wire" x1="${bx+bw}" y1="${cy}" x2="${wireR}" y2="${cy}"/>`);
  }
  function instructionActive(n){
    const key=n.args[0]; if(!key||!Object.prototype.hasOwnProperty.call(state.tagValues,key))return false;
    const value=!!state.tagValues[key]; return n.op==='XIO'?!value:value;
  }
  function splitRLLText(source){
    const rungs=[];let start=0,depth=0,quote='';
    for(let i=0;i<source.length;i++){
      const c=source[i];
      if(quote){if(c===quote&&source[i-1]!=='\\')quote='';}
      else if(c==='"'||c==="'")quote=c;
      else if(c==='('||c==='[')depth++;
      else if(c===')'||c===']')depth=Math.max(0,depth-1);
      else if(c===';'&&depth===0){const text=source.slice(start,i+1).trim();if(text)rungs.push(text);start=i+1;}
    }
    const tail=source.slice(start).trim();if(tail)rungs.push(tail.endsWith(';')?tail:tail+';');
    return rungs.map(s=>s.replace(/^\s*(?:Rung\s+)?\d+\s*:\s*/i,''));
  }
  function loadTextLogic(name,source){
    name=(name||'Text_Logic').trim()||'Text_Logic';source=source.trim();if(!source)throw new Error('변환할 텍스트 로직을 입력하세요.');
    const type='RLL';
    const rungs=splitRLLText(source).map((text,i)=>({number:i,type:'N',text,comment:'붙여넣은 RLL 텍스트'}));
    if(!rungs.length)throw new Error('변환 가능한 로직 문장을 찾지 못했습니다.');
    const routine={id:'text-routine',name,type,program:'Text_Import',source,rungs,comments:[],origin:'text'};
    state.project={filename:`${name}.${type.toLowerCase()}`,name:'Text Logic',software:'',programs:[{name:'Text_Import',routines:[routine]}],all:[routine],tags:0,rungCount:rungs.length};
    updateProjectUI();selectRoutine(routine);toast(`${rungs.length}개 LD Rung으로 변환했습니다.`);
  }

  function loadFile(file) {
    const reader=new FileReader();
    reader.onload=()=>{ try { state.project=parseProject(reader.result,file.name); updateProjectUI(); toast(`${file.name} 분석 완료`); } catch(e){ toast(e.message,true); } };
    reader.onerror=()=>toast('파일을 읽지 못했습니다.',true); reader.readAsText(file);
  }
  function updateProjectUI(){
    const p=state.project, audit=auditProject(); $('#welcome').hidden=true; $('#viewer').hidden=false; $('#projectSummary').hidden=false;
    Object.entries(audit).forEach(([k,v])=>$('#viewer').dataset[k]=String(v));
    $('#fileBadge').textContent=`${p.name} · ${p.filename}`; $('#routineCount').textContent=p.all.length; $('#rungCount').textContent=p.rungCount; $('#tagCount').textContent=p.tags; $('#searchInput').disabled=false;$('#searchInput').value='';renderTree();
    const first=p.all.find(r=>r.type==='RLL')||p.all[0]; if(first) selectRoutine(first);
  }
  function renderTree(filter=''){
    const q=filter.trim().toLowerCase(); const root=$('#routineTree'); root.innerHTML='';
    state.project.programs.forEach((p,pi)=>{
      const routines=p.routines.filter(r=>!q||`${p.name} ${r.name} ${r.type}`.toLowerCase().includes(q)); if(!routines.length)return;
      const g=document.createElement('section');g.className='program-group';g.innerHTML=`<button class="program-head"><span class="program-name">${esc(p.name)}</span><span>${routines.length}</span></button><div class="routine-list"></div>`;
      const list=$('.routine-list',g); routines.forEach(r=>{const b=document.createElement('button');b.className='routine-item'+(state.selected===r?' active':'');b.innerHTML=`<span class="mini-type">${esc(r.type)}</span><span class="name">${esc(r.name)}</span>`;b.onclick=()=>selectRoutine(r);list.appendChild(b);});
      $('.program-head',g).onclick=e=>{e.currentTarget.classList.toggle('closed');list.hidden=!list.hidden};root.appendChild(g);
    });
    if(!root.children.length)root.innerHTML='<div class="empty-side">일치하는 루틴이 없습니다.</div>';
  }
  function selectRoutine(r){state.selected=r;renderTree($('#searchInput').value);$('#breadcrumb').textContent=`${state.project.name} / Programs / ${r.program}`;$('#routineTitle').textContent=r.name;$('#typeBadge').textContent=r.type;$('#routineMeta').textContent=metaText(r);$('#sourceCode').textContent=r.source||'표시할 원본 로직이 없습니다.';renderRoutine();setTab(r.type==='RLL'?'ladder':'source');}
  function metaText(r){if(r.type==='RLL')return `${r.rungs.length} Rungs · ${r.origin==='text'?'텍스트 RLL 변환':'원본 RLL'}`;if(r.type==='ST')return 'Structured Text 원문 보존';if(r.type==='SFC')return 'Sequential Function Chart 원본 구조 보존';return `${r.type} 루틴 · 원본 구조 보존`;}
  function renderRoutine(){
    const r=state.selected, canvas=$('#ladderCanvas'); state.rendered=[];
    if(r.type!=='RLL'){canvas.innerHTML=`<div class="report-card"><h3>${esc(r.type)} 원본 보존</h3><p>이 형식은 래더로 변환하지 않습니다. 원본 로직 탭에서 그대로 확인할 수 있습니다.</p></div>`;$('#conversionBadge').textContent='원본 보존';renderReport();return;}
    const sheet=document.createElement('div');sheet.className='ladder-sheet logix-page';const viewportWidth=Math.max(1040,(canvas.clientWidth-38)/state.zoom);
    const now=new Date().toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
    sheet.innerHTML=`<header class="logix-print-head"><div><strong>${esc(r.name)} - Ladder Diagram</strong><span>${esc(state.project.name)}:${esc(r.program)}:${esc(r.name)}</span><span>Total number of rungs in routine: ${r.rungs.length}</span></div><div><b>Page 1</b><span>${esc(now)}</span><span>${esc(state.project.filename)}</span></div></header><div class="logix-rule"></div><section class="logix-rungs"></section>`;
    const rungRoot=$('.logix-rungs',sheet);
    r.rungs.forEach((rung,i)=>{const rr=renderRung(rung,i,viewportWidth,false);state.rendered.push(rr);const card=document.createElement('article');card.className='logix-rung';const visibleComment=rung.comment&&rung.comment!=='붙여넣은 RLL 텍스트';const status=rr.warnings.length?`<span class="rung-status warn">검토 필요 · 경고 ${rr.warnings.length}</span>`:'<span class="rung-status ok">정상</span>';const meta=state.showRungMeta?`<div class="rung-meta"><span class="rung-meta-number">Rung ${esc(rung.number)}</span>${status}</div>`:'';card.innerHTML=`${meta}${visibleComment?`<div class="logix-comment">${esc(rung.comment)}</div>`:''}<div class="rung-svg-wrap">${rr.svg}</div>${rr.warnings.length?`<span class="rung-warning logix-warning">△ ${rr.warnings.length}</span>`:''}<div class="rung-source" ${state.showRaw?'':'hidden'}>${esc(rung.text)}</div>`;rungRoot.appendChild(card);});
    const footer=document.createElement('footer');footer.className='logix-print-foot';footer.innerHTML='<span>(End)</span><b>Logix Designer</b>';sheet.appendChild(footer);
    const sheetWidth=Math.max(viewportWidth,...state.rendered.map(x=>x.width));sheet.style.width=`${sheetWidth}px`;sheet.style.minWidth=`${sheetWidth}px`;
    if(!r.rungs.length)sheet.innerHTML='<div class="report-card"><h3>변환 가능한 명령이 없습니다.</h3><p>원본 로직 탭에서 내용을 확인하세요.</p></div>';canvas.innerHTML='';canvas.appendChild(sheet);applyZoom();
    $('#conversionBadge').textContent=r.origin==='text'?'RLL 텍스트 파싱':'원본 RLL 파싱';renderReport();
  }
  function renderReport(){
    const r=state.selected; const warnings=state.rendered.flatMap(x=>x.warnings.map(w=>`Rung ${x.rung.number}: ${w}`)); $('#warningCount').textContent=warnings.length||'';
    const preserved=r.type!=='RLL';
    let html=`<div class="report-card"><h3>${preserved?'보존 상태':'변환 상태'}</h3><p class="${warnings.length?'report-warn':'report-ok'}">${preserved?'래더 변환 없이 원본 형식을 보존했습니다.':warnings.length?'일부 항목에 엔지니어 검토가 필요합니다.':'파서가 모든 RLL Rung을 정상적으로 해석했습니다.'}</p><ul><li>루틴 형식: ${esc(r.type)}</li><li>${preserved?'원본 보존':'표시 Rung'}: ${preserved?'예':r.rungs.length}</li><li>파서 경고: ${warnings.length}</li></ul></div>`;
    if(warnings.length)html+=`<div class="report-card"><h3>검토 목록</h3><ul>${warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`;
    $('#reportPanel').innerHTML=html;
  }
  function applyZoom(){const sheet=$('.ladder-sheet');if(!sheet)return;sheet.style.transform=`scale(${state.zoom})`;sheet.style.marginBottom=`${Math.max(0,(state.zoom-1)*sheet.offsetHeight)}px`;$('#zoomValue').textContent=`${Math.round(state.zoom*100)}%`;}
  function setTab(name){state.tab=name;$$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));$('#ladderPanel').hidden=name!=='ladder';$('#sourcePanel').hidden=name!=='source';$('#reportPanel').hidden=name!=='report';}
  function download(name, content, type){const blob=new Blob([content],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  function exportSVG(){if(!state.rendered.length)return toast('내보낼 래더가 없습니다.',true);const svgs=state.rendered.map(r=>new DOMParser().parseFromString(r.svg,'image/svg+xml').documentElement);const width=Math.max(...svgs.map(s=>+s.getAttribute('width'))),heights=svgs.map(s=>+s.getAttribute('height')+20),height=heights.reduce((a,b)=>a+b,0)+20;let y=20,body='';svgs.forEach((s,i)=>{body+=`<g transform="translate(0 ${y})">${s.innerHTML}</g>`;y+=heights[i]});download(`${safeName(state.selected.name)}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/>${body}</svg>`,'image/svg+xml');}
  function exportTXT(){if(!state.rendered.length)return toast('내보낼 래더가 없습니다.',true);const lines=[];state.rendered.forEach(({rung,ast})=>{lines.push(`RUNG ${rung.number}${rung.comment?' · '+rung.comment:''}`,...astToText(ast), '');});download(`${safeName(state.selected.name)}.txt`,lines.join('\n'),'text/plain;charset=utf-8');}
  function astToText(ast){const paths=flattenPaths(ast).map(p=>p.map(formatTextInst));const inner=Math.max(70,...paths.flat().map(vw))+4;const top='┌'+'─'.repeat(inner)+'┐',bottom='└'+'─'.repeat(inner)+'┘',rows=[top];paths.forEach((p,i)=>{const s=` ${i?'├':'│'}─ ${p.join(' ── ')} ─`;rows.push('│'+s+' '.repeat(Math.max(0,inner-vw(s)))+'│')});rows.push(bottom);return rows;}
  function flattenPaths(n){if(n.type==='instruction')return [[n]];if(n.type==='parallel')return n.branches.flatMap(flattenPaths);let paths=[[]];for(const c of n.children){const cp=flattenPaths(c),next=[];for(const a of paths)for(const b of cp)next.push([...a,...b]);paths=next}return paths;}
  function formatTextInst(n){if(n.op==='XIC')return `──] [── ${n.args[0]}`;if(n.op==='XIO')return `──]/[── ${n.args[0]}`;if(n.op==='OTE')return `──( )── ${n.args[0]}`;if(n.op==='OTL')return `──(L)── ${n.args[0]}`;if(n.op==='OTU')return `──(U)── ${n.args[0]}`;return `[${n.op} ${n.args.join(', ')}]`;}
  function vw(s){let w=0;for(const c of s){const cp=c.codePointAt(0);w+=(cp>=0x1100&&(cp<=0x115f||cp===0x2329||cp===0x232a||(cp>=0x2e80&&cp<=0xa4cf&&cp!==0x303f)||(cp>=0xac00&&cp<=0xd7a3)||(cp>=0xf900&&cp<=0xfaff)||(cp>=0xfe10&&cp<=0xfe19)||(cp>=0xfe30&&cp<=0xfe6f)||(cp>=0xff00&&cp<=0xff60)||(cp>=0xffe0&&cp<=0xffe6)||(cp>=0x1f300&&cp<=0x1faff)))?2:1}return w;}
  function safeName(s){return s.replace(/[^\w.-]+/g,'_');}
  function auditProject(){
    if(!state.project)return {};
    let parsed=0,warningRungs=0,warnings=0,maxBranchDepth=0;const ops=new Set(),unknownOps=new Set();
    state.project.all.filter(r=>r.type==='RLL').forEach(r=>r.rungs.forEach(rung=>{
      const p=new RLLParser(rung.text),ast=p.parse();parsed++;if(p.warnings.length){warningRungs++;warnings+=p.warnings.length;}
      (function walk(n,depth=0){if(n.type==='instruction'){ops.add(n.op);if(!(contactOps.has(n.op)||outputOps.has(n.op)||compareOps.has(n.op)||timerOps.has(n.op)||instructionNames[n.op]))unknownOps.add(n.op);}else if(n.type==='parallel'){maxBranchDepth=Math.max(maxBranchDepth,depth+1);n.branches.forEach(x=>walk(x,depth+1));}else n.children.forEach(x=>walk(x,depth));})(ast);
    }));
    return {routines:state.project.all.length,rllRoutines:state.project.all.filter(r=>r.type==='RLL').length,stRoutines:state.project.all.filter(r=>r.type==='ST').length,sfcRoutines:state.project.all.filter(r=>r.type==='SFC').length,rungs:parsed,warningRungs,warnings,instructionTypes:ops.size,unknownInstructionTypes:unknownOps.size,maxBranchDepth};
  }
  let toastTimer;function toast(msg,error=false){const t=$('#toast');t.textContent=msg;t.style.background=error?'#9c2020':'';t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3000);}

  $('#fileInput').addEventListener('change',e=>e.target.files[0]&&loadFile(e.target.files[0]));
  $('#searchInput').addEventListener('input',e=>renderTree(e.target.value));
  $$('.tab').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
  $('#zoomRange').addEventListener('input',e=>{state.zoom=+e.target.value/100;renderRoutine()});
  $('#showRungMeta').addEventListener('change',e=>{state.showRungMeta=e.target.checked;renderRoutine()});
  $('#showRaw').addEventListener('change',e=>{state.showRaw=e.target.checked;$$('.rung-source').forEach(x=>x.hidden=!state.showRaw)});
  $('#exportSvg').onclick=exportSVG;$('#exportTxt').onclick=exportTXT;$('#printBtn').onclick=()=>window.print();
  const textDialog=$('#textDialog');
  $('#textImportBtn').onclick=()=>textDialog.showModal();
  $('#textDialogClose').onclick=()=>textDialog.close();
  $('#textConvertBtn').onclick=()=>{try{loadTextLogic($('#textRoutineName').value,$('#textLogicInput').value);textDialog.close();}catch(e){toast(e.message,true);}};
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(state.selected&&!$('#viewer').hidden)renderRoutine();},180)});
  const dz=$('#dropZone');['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag')}));['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag')}));dz.addEventListener('drop',e=>e.dataTransfer.files[0]&&loadFile(e.dataTransfer.files[0]));
  window.L5XLadder={
    RLLParser,parseProject,measure,renderRung,vw,
    loadTextLogic,loadFile,selectRoutine,renderRoutine,
    setTagValues(values){state.tagValues={...(values||{})};if(state.selected)renderRoutine();},
    diagnostics:auditProject,getState:()=>state
  };

  // Optional auto-preload: window.LD_PRELOAD or window.SC1_LD_PRELOAD = { name, source }
  function tryPreload(){
    if(window.LD_TAG_VALUES)state.tagValues={...window.LD_TAG_VALUES};
    const p = window.LD_PRELOAD || window.SC1_LD_PRELOAD;
    if(!p || !p.source) return;
    try { loadTextLogic(p.name || 'Text_Logic', p.source); }
    catch(e){ toast(e.message || String(e), true); }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryPreload);
  else setTimeout(tryPreload, 0);
})();
