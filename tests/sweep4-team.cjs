/* Sweep 4, team-page fixes: roster stale-save, huddle toggle guard, satada night names,
   attendance seen loop, huddle frame type, accessible name, touch targets, boundary Fridays.
   Standalone: node tests/sweep4-team.cjs  (NODE_PATH=$(npm root -g)). PORT env overrides the free port picked by default. */
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
      r.writeHead(200,{'Content-Type':path.extname(f)==='.html'?'text/html; charset=utf-8':'application/octet-stream'}); r.end(b); });
  });
  s.on('error',rej); s.listen(Number(process.env.PORT)||0,'127.0.0.1',()=>res(s)); });}
let bad=0; const chk=(c,l,x)=>{ if(!c)bad++; console.log((c?'PASS ':'FAIL ')+l+(!c&&x?'  ['+x+']':'')); };
(async()=>{
const srv=await serve(); const BASE='http://127.0.0.1:'+srv.address().port; const b=await chromium.launch({args:['--no-sandbox']});
const open=async(vp,touch)=>{ const ctx=await b.newContext({viewport:vp||{width:1300,height:950},isMobile:!!touch,hasTouch:!!touch}); const pg=await ctx.newPage();
  await ctx.route(u=>!String(u).startsWith(BASE),r=>r.abort());
  pg.errs=[]; pg.on('pageerror',e=>pg.errs.push(e.message));
  await pg.goto(BASE+'/teama.html',{waitUntil:'domcontentloaded'});
  await pg.addStyleTag({content:'.noaccess{display:none!important}#loginScreen{display:none!important}'});
  await pg.waitForTimeout(2300); await pg.evaluate(`(${SEED})(['tl_a'])`); return pg; };
const STUB=`window.mkSb=(handler)=>{ const log=[];
  const chain=(t)=>{ const calls=[]; const c=new Proxy(function(){},{get:(_,k)=>{
      if(k==='then') return (res,rej)=>Promise.resolve(handler(t,calls,log)).then(res,rej);
      return (...a)=>{ calls.push([k,a]); return c; }; },apply:()=>c}); return c; };
  return {from:t=>chain(t),rpc:async(n,a)=>handler('rpc:'+n,[['args',[a]]],log),channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel(){},log}; };`;

const p=await open();
await p.evaluate(STUB);

// 3. satada night names
const r3=await p.evaluate(()=>{
  const ev=(name,type)=>({id:900,team:'A',date:'2027-03-10',name,type:type||'custom'});
  const o={}; for(const n of ['Evening Satada','Satada Day 1','Satada - Sunday','Satada','Late Satada Night 2']) o[n]=isSatNight(ev(n));
  for(const n of ['Satada Prep Meeting','Pre-Satada briefing','Satada planning']) o[n]=isSatNight(ev(n));
  o.hubRow=isSatNight(ev('Anything','satada'));
  const fri='2027-03-12'; EVENTS=[ev('Satada Prep Meeting')]; o.weekSupp=inSatWeek(fri); o.mapKeys=Object.keys(satWeekMap()).length;
  EVENTS=[ev('Evening Satada')]; o.weekReal=inSatWeek(fri);
  return o; });
chk(r3['Evening Satada']&&r3['Satada Day 1']&&r3['Satada - Sunday']&&r3['Satada']&&r3['Late Satada Night 2']&&r3.hubRow,'real satada night names are recognised',JSON.stringify(r3));
chk(!r3['Satada Prep Meeting']&&!r3['Pre-Satada briefing']&&!r3['Satada planning'],'names that merely contain satada are not nights',JSON.stringify(r3));
chk(!r3.weekSupp&&r3.mapKeys===0&&r3.weekReal,'Satada Prep Meeting does not suppress that week; Evening Satada does',JSON.stringify(r3));
const r3b=await p.evaluate(async()=>{
  const ups=[];
  sb=mkSb((t,calls)=>{ const m=calls.map(c=>c[0]); if(t==='iv_events'&&m.includes('upsert')){ const rows=calls.find(c=>c[0]==='upsert')[1][0]; ups.push(rows); return {data:rows.map((r,i)=>Object.assign({id:700+i},r)),error:null}; }
    return {data:[],error:null}; });
  DB_MISSING=false; IS_EDIT=true; AUTO_SKIP=new Set(); CYCLES=buildCycles();
  const far=CYCLES.find(c=>c.end>nzTodayISO());
  const fri=[]; { const d=new Date(far.start+'T12:00'); for(let i=0;i<30;i++){ const iso=d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); if(d.getDay()===5&&iso>nzTodayISO()&&iso<far.end){ fri.push(iso); } d.setDate(d.getDate()+1);} }
  const f=fri[0]; const wed=new Date(f+'T12:00'); wed.setDate(wed.getDate()-2); const wi=wed.getFullYear()+'-'+pad2(wed.getMonth()+1)+'-'+pad2(wed.getDate());
  EVENTS=[{id:901,team:'A',date:wi,name:'Satada Prep Meeting',type:'custom',uniform:'Casual',youth:false,confirmed:false}];
  await autoCreateEvents();
  const made=ups.flat().map(r=>r&&r.date); return {f,made,has:made.includes(f)}; });
chk(r3b.has,'autoCreateEvents still creates that week Friday Majlis with a Satada Prep Meeting in the week',JSON.stringify(r3b));

// 1. roster stale-save
const r1=await p.evaluate(async()=>{
  const o={}; let stamp=100, confirms=0; const store={}; const upserts=[];
  window.confirm=()=>{ confirms++; return false; };
  sb=mkSb((t,calls)=>{ if(t!=='iv_roster') return {data:[],error:null};
    const m=calls.map(c=>c[0]);
    if(m.includes('upsert')){ const row=calls.find(c=>c[0]==='upsert')[1][0]; upserts.push(row); return new Promise(r=>setTimeout(()=>{ store[row.event_id]={data:JSON.parse(JSON.stringify(row.data)),updated_at:'t'+(++stamp)}; r({data:null,error:null}); },30)); }
    const e=store[1];
    if(m.includes('maybeSingle')) return {data:e?{updated_at:e.updated_at}:null,error:null};
    return {data:e?[{event_id:1,data:e.data,updated_at:e.updated_at}]:[],error:null}; });
  DB_MISSING=false; IS_EDIT=true; ROSTER_SEEN={}; ROSTER_UNSAVED={};
  ROSTERS[1]=ROSTERS[1]||{assign:{},manual:{}};
  store[1]={data:JSON.parse(JSON.stringify(ROSTERS[1])),updated_at:'t100'}; ROSTER_SEEN[1]='t100';
  ROSTERS[1].n=1; const a=saveRoster(1,{quiet:true}); ROSTERS[1].n=2; const b2=saveRoster(1,{quiet:true});
  const [ra,rb]=await Promise.all([a,b2]); o.quick=ra&&rb&&confirms===0&&upserts.length===2; o.stored=store[1].data.n;
  o.clone=upserts[0].data!==ROSTERS[1];
  store[1]={data:{assign:{},manual:{},n:99},updated_at:'t900'}; const old=ROSTER_SEEN[1];
  ROSTERS[1].n=3; const r1a=await saveRoster(1,{quiet:true}); const keptOld=ROSTER_SEEN[1]===old; const c1=confirms;
  ROSTERS[1].n=4; const r1b=await saveRoster(1,{quiet:true});
  o.cancel={r1a,r1b,keptOld,stillOld:ROSTER_SEEN[1]===old,asked:confirms-c1,flagged:!!ROSTER_UNSAVED[1],notOverwritten:store[1].data.n===99};
  const realLoadAll=loadAll, realCov=loadCovering;
  loadAll=async()=>{ ROSTER_SEEN[1]='fromRead'; ROSTERS={}; return true; }; loadCovering=async()=>{};
  ROSTER_SEEN[1]='mine'; _pauseRT=0; _lastWrite=Date.now()+100000;
  rtReload(5); await new Promise(r=>setTimeout(r,200)); o.rt={seen:ROSTER_SEEN[1]};
  _lastWrite=0; loadAll=realLoadAll; loadCovering=realCov; if(_rtT) clearTimeout(_rtT);
  return o; });
chk(r1.quick&&r1.stored===2,'two quick saves from one tab: both succeed, serialised, no false conflict',JSON.stringify(r1));
chk(r1.clone,'upsert sends a deep clone of the roster');
chk(!r1.cancel.r1a&&!r1.cancel.r1b&&r1.cancel.keptOld&&r1.cancel.stillOld&&r1.cancel.asked===1&&r1.cancel.flagged&&r1.cancel.notOverwritten,
  'declining the reload keeps the old stamp: next save is checked again and blocked, edit stays flagged',JSON.stringify(r1.cancel));
chk(r1.rt.seen==='mine','rtReload restores ROSTER_SEEN together with ROSTERS',JSON.stringify(r1.rt));

// 2. huddle double tap + 6. accessible name
await p.evaluate(`(${SEED})(['tl_a'])`);
const r2=await p.evaluate(async()=>{
  const o={}; let up=0; const toasts=[]; const rt=toast; toast=(m)=>toasts.push(m);
  const store={};
  sb=mkSb((t,calls)=>{ if(t!=='iv_roster') return {data:[],error:null}; const m=calls.map(c=>c[0]);
    if(m.includes('upsert')){ up++; const row=calls.find(c=>c[0]==='upsert')[1][0]; return new Promise(r=>setTimeout(()=>{ store.d=JSON.parse(JSON.stringify(row.data)); store.u='x'+up; r({data:null,error:null}); },120)); }
    if(m.includes('maybeSingle')) return {data:store.u?{updated_at:store.u}:null,error:null};
    return {data:store.u?[{event_id:1,data:store.d,updated_at:store.u}]:[],error:null}; });
  DB_MISSING=false; IS_EDIT=true; ROSTER_SEEN={}; ROSTER_UNSAVED={}; delete ROSTERS[1].huddle; selEventId=1;
  nav('roster'); openFullRoster(1); await new Promise(r=>setTimeout(r,300));
  const btn=document.querySelector('.btn-vh'); o.btn=!!btn;
  o.label=btn&&btn.getAttribute('aria-label'); o.pressedBefore=btn&&btn.getAttribute('aria-pressed');
  btn.click(); btn.click(); toggleHuddle(1);
  o.disabledWhileSaving=!!document.querySelector('.btn-vh').disabled;
  await new Promise(r=>setTimeout(r,700));
  o.upserts=up; o.on=ROSTERS[1].huddle===true; o.err=toasts.filter(x=>/NOT saved/.test(x));
  const b2=document.querySelector('.btn-vh'); o.pressedAfter=b2.getAttribute('aria-pressed'); o.label2=b2.getAttribute('aria-label'); o.enabled=!b2.disabled;
  o.hidden=!!b2.querySelector('span[aria-hidden="true"]');
  toast=rt; return o; });
chk(r2.btn&&r2.upserts===1&&r2.on&&r2.err.length===0&&r2.disabledWhileSaving&&r2.enabled,'huddle double tap: one save, button disabled meanwhile, no false NOT saved',JSON.stringify(r2));
chk(r2.label==='Volunteer Huddle'&&r2.label2==='Volunteer Huddle'&&r2.pressedBefore==='false'&&r2.pressedAfter==='true'&&r2.hidden,'huddle button keeps the fixed name Volunteer Huddle; aria-pressed carries state',JSON.stringify(r2));

// 5. huddle-on type checks
const r5=await p.evaluate(async()=>{
  const o={tiny:[],heavy:[]}; ROSTERS[1].huddle=true; nav('roster'); openFullRoster(1); await new Promise(r=>setTimeout(r,800));
  const w=document.createTreeWalker(document.querySelector('#body-roster .vh-band'),NodeFilter.SHOW_TEXT);
  while(w.nextNode()){ const t=w.currentNode, el=t.parentElement, tx=t.textContent.trim(); if(!tx) continue; const cs=getComputedStyle(el);
    if(cs.display==='none'||!el.getBoundingClientRect().width) continue;
    if(parseFloat(cs.fontSize)<12) o.tiny.push(el.className+':'+tx.slice(0,12)+':'+cs.fontSize);
    if(+cs.fontWeight>=800&&parseFloat(cs.fontSize)<40) o.heavy.push(el.className+':'+cs.fontWeight+':'+cs.fontSize); }
  const sm=document.querySelector('#body-roster .vh-rec small'); const cs=sm&&getComputedStyle(sm); o.opacity=cs&&cs.opacity; o.size=cs&&cs.fontSize;
  const bg=getComputedStyle(document.querySelector('#body-roster .vh-rec')).backgroundImage; o.bg=bg;
  const lum=c=>{ const v=c.map(x=>{x/=255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4);}); return .2126*v[0]+.7152*v[1]+.0722*v[2]; };
  const cols=[...bg.matchAll(/rgb\((\d+), (\d+), (\d+)\)/g)].map(m=>[+m[1],+m[2],+m[3]]);
  o.contrast=Math.min(...cols.map(c=>1.05/(lum(c)+.05)));
  return o; });
chk(r5.tiny.length===0&&r5.size==='12px'&&r5.opacity==='1','huddle on: no text under 12px, REC caption 12px at full opacity',JSON.stringify(r5));
chk(r5.heavy.length===0,'huddle on: no weight 800+ below display size',JSON.stringify(r5.heavy));
chk(r5.contrast>=4.5,'huddle REC caption contrast is at least 4.5:1 on its background',String(r5.contrast));

// 4. attendance seen loop
await p.evaluate(`(${SEED})(['tl_a'])`);
const r4=await p.evaluate(async()=>{
  let n=0; sb=mkSb((t)=>{ if(t==='rpc:roster_seen'){ n++; return {data:null,error:{message:'boom'}}; } return {data:[],error:null}; });
  DB_MISSING=false; SEEN={}; SEEN_TRIED.clear(); const ev=EVENTS.find(e=>e.confirmed); selEventId=ev.id; attEventId=ev.id; nav('attendance');
  await new Promise(r=>setTimeout(r,200)); n=0; SEEN_TRIED.clear();
  let renders=0; const rr=renderAttendance; renderAttendance=function(){ renders++; return rr.apply(this,arguments); };
  for(let i=0;i<3;i++){ renderAttendance(); await new Promise(r=>setTimeout(r,100)); }
  await new Promise(r=>setTimeout(r,300)); const after=n; await new Promise(r=>setTimeout(r,300));
  renderAttendance=rr; const o={calls:n,stable:after===n,renders};
  sb=null; SEEN={}; SEEN_TRIED.clear(); renders=0; renderAttendance=function(){ renders++; return rr.apply(this,arguments); };
  renderAttendance(); await new Promise(r=>setTimeout(r,300)); renderAttendance=rr; o.noSbRenders=renders; return o; });
chk(r4.calls===1&&r4.stable&&r4.renders===3,'failing roster_seen: asked once, no re-render loop',JSON.stringify(r4));
chk(r4.noSbRenders===1,'no database: attendance does not re-render itself',JSON.stringify(r4));

// 8. boundary Friday held by the other team
const r8=await p.evaluate(async()=>{
  const o={}; const toasts=[]; const rt=toast; toast=(m,t)=>toasts.push([m,t]); const ups=[];
  CYCLES=buildCycles(); const far=CYCLES.find(c=>c.end>nzTodayISO()); const fr=[];
  { const d=new Date(far.start+'T12:00'); for(let i=0;i<30;i++){ const iso=d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); if(d.getDay()===5&&iso>nzTodayISO()&&iso<far.end) fr.push(iso); d.setDate(d.getDate()+1);} }
  const held=fr[0]; EVENTS=[]; AUTO_SKIP=new Set(); DB_MISSING=false; IS_EDIT=true;
  sb=mkSb((t,calls)=>{ const m=calls.map(c=>c[0]); if(t!=='iv_events') return {data:[],error:null};
    if(m.includes('neq')) return {data:[{date:held,name:'Friday Majlis',team:'B'}],error:null};
    if(m.includes('upsert')){ const rows=calls.find(c=>c[0]==='upsert')[1][0]; ups.push(rows); return {data:rows.map((r,i)=>Object.assign({id:500+i},r)),error:null}; }
    return {data:[],error:null}; });
  await autoCreateEvents(); await autoCreateEvents();
  o.held=held; o.toasts=toasts; o.sentHeld=ups.flat().some(r=>r.date===held); o.upsertCalls=ups.length; o.created=EVENTS.length;
  toast=rt; return o; });
chk(r8.toasts.length===1&&r8.toasts[0][1]==='err'&&r8.toasts[0][0]==='Friday Majlis on '+r8.held+' belongs to Team B. Ask a Facilitator to move it.'&&!/refused/.test(r8.toasts[0][0]),'boundary Friday held by the other team: one clear toast naming date and team',JSON.stringify(r8.toasts));
chk(!r8.sentHeld&&r8.created>0,'held Friday is not inserted, the rest still are, no retry loop',JSON.stringify(r8));
chk(p.errs.length===0,'no page errors',p.errs.join(' | '));
await p.context().close();

// 7. touch targets
const t=await open({width:390,height:844},true);
const r7=await t.evaluate(async()=>{ IS_EDIT=true; selEventId=1; nav('roster'); openFullRoster(1); await new Promise(r=>setTimeout(r,500));
  const w=[...document.querySelectorAll('#body-roster .btn-sm')].filter(b=>b.getBoundingClientRect().width).map(b=>[b.textContent.trim().slice(0,10),Math.round(b.getBoundingClientRect().width)]);
  return {w,min:Math.min(...w.map(x=>x[1]))}; });
chk(r7.w.length>0&&r7.min>=44,'touch: every .btn-sm is at least 44px wide (previous/next/gear included)',JSON.stringify(r7));
await t.context().close();
await b.close(); srv.close();
console.log(bad?bad+' FAILED':'ALL PASS'); process.exit(bad?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
