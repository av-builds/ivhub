/* Roster design (clean and calm): slanted headers and duty names with square name cells, chip states, the phone's stacked cards,
   reduced motion, the saved flash, the exported image's slanted shapes, and AA contrast in both themes and both teams.
   Standalone: node tests/roster-design.cjs  (NODE_PATH=$(npm root -g)). Port: PORT env or a free one. */
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const SEED=fs.readFileSync(path.join(__dirname,'verify.cjs'),'utf8').match(/const SEED=`([\s\S]*?)`;\n/)[1];
function serve(){return new Promise((res,rej)=>{
  const s=http.createServer((q,r)=>{
    const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'index.html';
    const f=path.resolve(ROOT,rel);
    if(f!==ROOT&&!f.startsWith(ROOT+path.sep)){r.writeHead(403);return r.end();}
    fs.readFile(f,(e,b)=>{ if(e){r.writeHead(404);return r.end();}
      const T={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png'};
      r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'}); r.end(b); });
  });
  s.on('error',rej); s.listen(Number(process.env.PORT)||0,'127.0.0.1',()=>res(s)); });}
let bad=0; const chk=(c,l,x)=>{ if(!c)bad++; console.log((c?'PASS ':'FAIL ')+l+(!c&&x?'  ['+x+']':'')); };
(async()=>{
const srv=await serve(); const BASE='http://127.0.0.1:'+srv.address().port; const b=await chromium.launch({args:['--no-sandbox']});
const open=async(file,vp,o)=>{ o=o||{};
  const ctx=await b.newContext({viewport:vp,isMobile:!!o.touch,hasTouch:!!o.touch,reducedMotion:o.reduce?'reduce':'no-preference'});
  await ctx.addInitScript(t=>{ try{ localStorage.setItem('iv_theme',t); }catch(e){} },o.theme||'dark');
  const p=await ctx.newPage(); await ctx.route(u=>!String(u).startsWith(BASE),r=>r.abort());
  p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message));
  await p.goto(BASE+'/'+file,{waitUntil:'domcontentloaded'});
  await p.addStyleTag({content:'.noaccess{display:none!important}#loginScreen{display:none!important}#ivVeil{display:none!important}'});
  await p.waitForTimeout(2300);
  await p.evaluate(`(${SEED})(['tl_'+PAGE_TEAM.toLowerCase()])`);
  /* States worth styling: an away conflict, a cannot-do conflict, a hand-set duty and a long name; no database, so saves are stubbed. */
  await p.evaluate(()=>{
    const r=ROSTERS[1], keys=Object.keys(r.assign), dt=EVENTS[0].date;
    const first=(r.assign[keys[0]].m||[])[0]||(r.assign[keys[0]].f||[])[0]; MEMBERS.find(m=>m.id===first.id).away=[dt];
    const sec=(r.assign[keys[1]].f||[])[0]||(r.assign[keys[1]].m||[])[0]; MEMBERS.find(m=>m.id===sec.id).prefs={prefer:[],avoid:[],cannot:[keys[1]]};
    r.manual[keys[2]]=true; const l=(r.assign[keys[3]].m||[])[0]; if(l) l.name='Alexander Montgomery-Featherstone';
    saveRoster=async()=>true; setOnCalendar=async(ev,w)=>{ev.confirmed=w;return true;};
  });
  return p; };
const lum=c=>{ const f=v=>{ v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); }; return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2]); };
const ratio=(a,b)=>{ const x=lum(a),y=lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
const PARSE=`(s)=>{ let m=s.match(/color\\(srgb ([\\d.]+) ([\\d.]+) ([\\d.]+)/); if(m) return [m[1]*255,m[2]*255,m[3]*255];
  m=s.match(/rgba?\\(([\\d.]+)[, ]+([\\d.]+)[, ]+([\\d.]+)/); return m?[+m[1],+m[2],+m[3]]:null; }`;

for(const file of ['teama.html','teamb.html']){ for(const theme of ['dark','light']){
  const tag=file.replace('.html','').replace('team','Team ').toUpperCase().replace('TEAM ','Team ')+' '+theme;
  const p=await open(file,{width:1440,height:1000},{theme});
  await p.evaluate(()=>{ nav('roster'); openFullRoster(1); });
  await p.waitForTimeout(1700);
  // 1. shapes: headers, section bars and duty names lean; the name cells stay square
  const r=await p.evaluate(`(async()=>{ const P=${PARSE}, cs=e=>getComputedStyle(e), q=s=>document.querySelector('#body-roster '+s);
    const clip=s=>{ const e=q(s); return e?cs(e).clipPath:'missing'; };
    const o={th:clip('table.duty thead th'),dn:clip('table.duty td.dn2'),sec:clip('table.duty tr.sec td'),cell:clip('table.duty td[data-col]')};
    o.cellsAllSquare=[...document.querySelectorAll('#body-roster table.duty td[data-col]')].every(e=>cs(e).clipPath==='none');
    o.hasRec=!!document.querySelector('#body-roster table.duty tr.sec:last-of-type td')&&/REC/.test(document.querySelector('#body-roster table.duty tbody').textContent);
    const pairs={};
    const pair=(k,sel,bgSel)=>{ const e=q(sel); if(!e) return; const bg=P(cs(bgSel?q(bgSel):e).backgroundColor), fg=P(cs(e).color); pairs[k]=[fg,bg]; };
    pair('header','table.duty thead th'); pair('duty','table.duty td.dn2'); pair('section','table.duty tr.sec td'); pair('chip','.cellwrap button.chip:not(.blank):not(.add):not(.away):not(.cannot)');
    pair('away','.chip.away'); pair('cannot','.chip.cannot'); pair('banner','.ev-banner .t','.ev-banner'); pair('tag','.ev-banner .u');
    o.pairs=pairs; o.states={away:!!q('.chip.away'),cannot:!!q('.chip.cannot'),man:!!q('.chip.man'),blank:!!q('.chip.blank'),add:!!q('.chip.add'),note:/cannot do/.test(q('.chip.cannot')?q('.chip.cannot').textContent:'')};
    o.slantPx=(cs(q('table.duty thead th')).clipPath.match(/polygon\\(([\\d.]+)px/)||[])[1];
    o.chipSlant=(cs(q('.cellwrap button.chip')).clipPath.match(/polygon\\(([\\d.]+)px/)||[])[1];
    return o; })()`);
  chk(/^polygon/.test(r.th)&&/^polygon/.test(r.dn)&&/^polygon/.test(r.sec),tag+'  header, duty-name and section-bar cells are slanted (clip-path)',[r.th,r.dn,r.sec].join(' | '));
  chk(r.cell==='none'&&r.cellsAllSquare,tag+'  Male/Female name cells are plain rectangles',r.cell);
  chk(+r.slantPx>+r.chipSlant&&+r.chipSlant>=5,tag+'  headers lean harder than chips (bold on headers, light on tags)',r.slantPx+' vs '+r.chipSlant);
  chk(r.states.away&&r.states.cannot&&r.states.man&&r.states.blank&&r.states.add&&r.states.note,tag+'  chip states render: away, cannot do (in words), hand-set, blank, add',JSON.stringify(r.states));
  const bad2=Object.entries(r.pairs).map(([k,[f,g]])=>[k,ratio(f,g)]).filter(([k,v])=>v<4.5);
  chk(Object.keys(r.pairs).length>=7&&!bad2.length,tag+'  text contrast >= 4.5:1 (header, duty name, section bar, chips, banner, tag)',JSON.stringify(Object.fromEntries(Object.entries(r.pairs).map(([k,[f,g]])=>[k,+ratio(f,g).toFixed(2)]))));
  // huddle frame still wraps the roster, with the same slanted header inside
  const h=await p.evaluate(async()=>{ ROSTERS[1].huddle=true; renderRoster(); await new Promise(r=>setTimeout(r,300));
    const f=document.querySelector('#body-roster .vh-frame'), th=document.querySelector('#body-roster .vh-frame table.duty thead th');
    const de=document.documentElement, o={frame:!!f,th:th?getComputedStyle(th).clipPath.slice(0,8):'',over:de.scrollWidth-de.clientWidth};
    delete ROSTERS[1].huddle; renderRoster(); return o; });
  chk(h.frame&&h.th==='polygon('&&h.over<=0,tag+'  Volunteer Huddle frame wraps the redesigned roster, no horizontal scroll',JSON.stringify(h));
  // cycle view: day card, side column and the Satada cards use the same language
  const c=await p.evaluate(async()=>{ const k=CYCLES.find(c=>c.status!=='historic').k;
    for(let i=0;i<7;i++) EVENTS.push({id:60+i,team:i%3===2?(PAGE_TEAM==='A'?'B':'A'):PAGE_TEAM,date:addDaysLocal(weekStart(nzTodayISO()),i+7),name:'Satada - Day '+i,type:'satada',uniform:'Casual',confirmed:false});
    ROSTER_VIEW='cycles'; renderRoster(); await new Promise(r=>setTimeout(r,300));
    const o={sat:document.querySelectorAll('#body-roster .cy-grid.sat .cy-card').length, satClip:getComputedStyle(document.querySelector('#body-roster .cy-card')).clipPath.slice(0,8)};
    EVENTS.push({id:31,team:PAGE_TEAM,date:addDaysLocal(cyStart(k),1),name:'Day',type:'friday',uniform:'Casual',youth:true,confirmed:true}); ROSTERS[31]=generateEventData(EVENTS[EVENTS.length-1]);
    openCycle(k); openDay(31,true); await new Promise(r=>setTimeout(r,500));
    const q=s=>document.querySelector('#body-roster '+s);
    o.side=q('.cv-card')?getComputedStyle(q('.cv-card')).clipPath.slice(0,8):'';
    o.day=getComputedStyle(q('.cv-day')).clipPath.slice(0,8);
    return o; });
  chk(c.sat===7&&c.satClip==='polygon('&&c.side==='polygon('&&c.day==='polygon(',tag+'  cycle cards, Satada nights, side column and day cards are slanted',JSON.stringify(c));
  chk(p.errs.length===0,tag+'  no page errors',p.errs.slice(0,2).join(';')); await p.context().close(); } }

// phone: one duty per stacked card, no sideways scroll, 44px targets
for(const file of ['teama.html','teamb.html']){
  const p=await open(file,{width:390,height:844},{touch:true});
  await p.evaluate(()=>{ nav('roster'); openFullRoster(1); }); await p.waitForTimeout(1700);
  const r=await p.evaluate(()=>{ const de=document.documentElement, q=s=>[...document.querySelectorAll('#body-roster '+s)];
    const rows=q('table.duty tr[data-duty]'), cs=e=>getComputedStyle(e), o={};
    o.over=de.scrollWidth-de.clientWidth; o.head=cs(q('table.duty thead')[0]).display; o.rows=rows.length;
    o.stacked=rows.length>0&&rows.every(tr=>{ const d=tr.querySelector('td.dn2').getBoundingClientRect(), m=tr.querySelector('td[data-col="Male"]').getBoundingClientRect(),
      f=tr.querySelector('td[data-col="Female"]').getBoundingClientRect(), t=tr.getBoundingClientRect();
      return d.bottom<=m.top+1&&m.bottom<=f.top+1&&d.left>=t.left&&m.right<=t.right+1&&f.right<=t.right+1&&t.width<=innerWidth; });
    o.label=getComputedStyle(q('table.duty td[data-col="Male"]')[0],'::before').content+' '+getComputedStyle(q('table.duty td[data-col="Female"]')[0],'::before').content;
    o.cardClip=cs(rows[0]).clipPath.slice(0,8);
    const taps=[...document.querySelectorAll('#page-roster button,#page-roster .btn,#page-roster .chip')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;});
    o.small=taps.filter(e=>e.getBoundingClientRect().height<44).length; o.taps=taps.length; return o; });
  chk(r.over<=0&&r.head==='none'&&r.rows>10&&r.stacked,file+'  390px: stacked cards, one duty each, Male above Female, no horizontal scroll',JSON.stringify(r));
  chk(/Male/.test(r.label)&&/Female/.test(r.label),file+'  390px: each name row is labelled (Male, Female)',r.label);
  chk(r.small===0&&r.taps>20,file+'  390px: every roster tap target is at least 44px',JSON.stringify({small:r.small,taps:r.taps}));
  chk(p.errs.length===0,file+'  390px no page errors'); await p.context().close(); }

// motion: the reveal animates normally, is off under prefers-reduced-motion, and never blocks a click
for(const reduce of [false,true]){
  const p=await open('teama.html',{width:1440,height:1000},{reduce});
  const r=await p.evaluate(async()=>{ nav('roster'); openFullRoster(1); await new Promise(r=>setTimeout(r,120));
    const cs=e=>getComputedStyle(e), tr=document.querySelectorAll('#body-roster table.duty tbody tr')[3], el=document.getElementById('body-roster');
    const o={cls:el.classList.contains('rs-enter'),row:cs(tr).animationName,delay:cs(tr).animationDelay};
    /* a click lands on a chip while the reveal is still running */
    const chip=document.querySelector('#body-roster .cellwrap button.chip.add'); let hit=false; const old=window.addToSlot; window.addToSlot=function(){ hit=true; };
    const r2=chip.getBoundingClientRect(); const top=document.elementFromPoint(r2.left+r2.width/2,r2.top+r2.height/2); o.hit=!!top&&(top===chip||chip.contains(top)); window.addToSlot=old;
    await new Promise(r=>setTimeout(r,1700)); o.after=el.classList.contains('rs-enter');
    o.flashNone=true; const c=document.querySelector('#body-roster .cellwrap button.chip'); c.classList.add('flash'); o.flash=cs(c).animationName; c.classList.remove('flash');
    return o; });
  chk(reduce?(r.row==='none'&&r.flash==='none'):(r.cls&&/rsRise/.test(r.row)&&r.delay!=='0s'&&/rsChipSaved/.test(r.flash)),'motion  '+(reduce?'reduced motion: reveal and flash animations are off':'staggered reveal and the flash animation run'),JSON.stringify(r));
  chk(r.hit&&!r.after,'motion  '+(reduce?'reduced: ':'')+'a chip is clickable during the reveal, and the reveal class clears itself',JSON.stringify(r));
  chk(p.errs.length===0,'motion  no page errors'); await p.context().close(); }

// the saved flash: a hand assign marks the row that stored, a generate marks every row shown
{ const p=await open('teama.html',{width:1440,height:1000});
  const r=await p.evaluate(async()=>{ nav('roster'); openFullRoster(1); await new Promise(r=>setTimeout(r,1700));
    const ev=EVENTS[0], key=dutiesForEvent(ev)[4].key, o={before:document.querySelectorAll('#body-roster tr.saved').length};
    PICKER_CTX={dutyKey:key,arr:'m',idx:0,gender:'Male'}; await applyPick(MEMBERS.find(m=>m.gender==='Male'&&m.id>30).id);
    await new Promise(r=>setTimeout(r,150));
    const rows=[...document.querySelectorAll('#body-roster tr.saved')]; o.rows=rows.map(x=>x.getAttribute('data-duty')); o.key=key; o.chip=!!document.querySelector('#body-roster .chip.flash');
    o.anim=rows[0]?getComputedStyle(rows[0].querySelector('td.dn2')).animationName:'';
    await new Promise(r=>setTimeout(r,2300)); o.cleared=document.querySelectorAll('#body-roster tr.saved').length===0;
    await generateDay(ev.id); await new Promise(r=>setTimeout(r,200)); o.gen=document.querySelectorAll('#body-roster tr.saved').length;
    return o; });
  chk(r.before===0&&r.rows.length===1&&r.rows[0]===r.key&&r.chip&&/rsRowSaved/.test(r.anim),'flash   a hand assign flashes the saved duty row and its chip',JSON.stringify(r));
  chk(r.cleared&&r.gen>5,'flash   the flash clears itself, and a generate flashes the rows it stored',JSON.stringify(r));
  chk(p.errs.length===0,'flash   no page errors',p.errs.slice(0,2).join(';')); await p.context().close(); }

// export: slanted header, section bars and duty names built from SVG caps (html2canvas cannot clip-path)
for(const [file,fill] of [['teama.html','#D3E9DC'],['teamb.html','#F6DDD9']]){ for(const hud of [false,true]){
  const p=await open(file,{width:1440,height:1000});
  const r=await p.evaluate(async(hud)=>{ const o={}; ensureH2C=async()=>{}; window.html2canvas=async el=>{
      const sh=[...el.querySelectorAll('.rx-sh')], cap=s=>[...s.children].filter(x=>x.tagName.toLowerCase()==='svg');
      o.hd=el.querySelectorAll('thead .rx-hd').length; o.dn=el.querySelectorAll('.rx-d .rx-dn').length; o.bars=el.querySelectorAll('.rx-bar').length; o.title=!!el.querySelector('.rx-title .rx-bar');
      o.capsOk=sh.length>10&&sh.every(s=>{ const c=cap(s), h=s.getBoundingClientRect().height; return c.length===2&&c.every(v=>v.querySelector('polygon')&&Math.abs(v.getBoundingClientRect().height-h)<1.5&&v.getBoundingClientRect().width>=+s.getAttribute('data-slant')); });
      o.fills=[...el.querySelectorAll('.rx-hd polygon')].map(x=>x.getAttribute('fill'))[0];
      o.textClear=sh.every(s=>{ const t=s.querySelector('.rx-sh-t'), sl=+s.getAttribute('data-slant'); return t.getBoundingClientRect().left>=s.getBoundingClientRect().left+sl-1.5; });
      o.namesPlain=[...el.querySelectorAll('td.rx-n')].every(td=>!td.querySelector('.rx-sh'))&&el.querySelectorAll('td.rx-n').length>10;
      o.noClip=[...el.querySelectorAll('.rx-sh,.rx-t td,.rx-t th')].every(x=>getComputedStyle(x).clipPath==='none');
      o.huddle=!!el.querySelector('.rx-vf'); o.rec=el.querySelectorAll('.rx-bar').length>=3;
      return {toDataURL:()=>'data:image/png;base64,AAAA'}; };
    selEventId=1; if(hud) ROSTERS[1].huddle=true; else delete ROSTERS[1].huddle; nav('roster'); openFullRoster(1); sb=null; await exportPNG(); return o; },hud);
  const t=file+(hud?' with huddle':'')+'  ';
  chk(r.hd===3&&r.dn>10&&r.bars>=3&&r.title&&r.capsOk,t+'export has slanted header cells, duty-name cells, section bars and title, each with measured SVG end caps',JSON.stringify(r));
  chk(r.fills===fill,t+'export header uses the team colour ('+fill+')',r.fills);
  chk(r.textClear&&r.namesPlain&&r.noClip,t+'export text sits clear of the slants; name cells stay plain; nothing relies on clip-path',JSON.stringify(r));
  chk(r.huddle===hud,t+'export frame follows the huddle switch',JSON.stringify(r));
  chk(p.errs.length===0,t+'no page errors',p.errs.slice(0,2).join(';')); await p.context().close(); } }

await b.close(); srv.close();
console.log(bad?('\n'+bad+' FAILED'):'\nALL PASSED'); process.exit(bad?1:0);
})().catch(e=>{console.error('CRASHED',e&&e.stack||e);process.exit(1);});
