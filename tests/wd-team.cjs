/* Weekday Team Lead, team-page part: 'cannot' duty chips, Extra Duty report.
   Standalone: node tests/wd-team.cjs  (NODE_PATH=$(npm root -g)). Port 8136. */
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
  s.on('error',rej); s.listen(process.env.PORT!==undefined?Number(process.env.PORT):8136,'127.0.0.1',()=>res(s)); });}
let bad=0; const chk=(c,l,x)=>{ if(!c)bad++; console.log((c?'PASS ':'FAIL ')+l+(!c&&x?'  ['+x+']':'')); };
(async()=>{
const srv=await serve(); const BASE='http://127.0.0.1:'+srv.address().port; const b=await chromium.launch({args:['--no-sandbox']});
const p=await (async()=>{ const ctx=await b.newContext({viewport:{width:1300,height:950}}); const pg=await ctx.newPage();
  await ctx.route(u=>!String(u).startsWith(BASE),r=>r.abort());
  pg.errs=[]; pg.on('pageerror',e=>pg.errs.push(e.message)); pg.warns=[]; pg.on('console',m=>{ if(m.type()==='warning') pg.warns.push(m.text()); });
  await pg.goto(BASE+'/teama.html',{waitUntil:'domcontentloaded'});
  await pg.addStyleTag({content:'.noaccess{display:none!important}#loginScreen{display:none!important}'});
  await pg.waitForTimeout(2300); return pg; })();
await p.evaluate(`(${SEED})(['tl_a'])`);

// 1. cannot cycling + persistence payload
const r1=await p.evaluate(async()=>{
  const o={}, writes=[]; const ok={data:[{}],error:null};
  const chain=t=>{ const c=new Proxy(function(){},{get:(_,k)=>k==='then'?(res,rej)=>Promise.resolve(ok).then(res,rej):(...a)=>{ if(k==='update') writes.push([t,a[0]]); return c; },apply:()=>c}); return c; };
  sb={from:t=>chain(t),rpc:async()=>ok,channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel(){}};
  DB_MISSING=false;
  const m=MEMBERS[0], names=Object.keys(DUTY_INFO), key=DUTY_INFO[names[0]].key, key2=DUTY_INFO[names[1]].key;
  const st=()=>{ const p=m.prefs; return (p.prefer||[]).includes(key)?'prefer':(p.avoid||[]).includes(key)?'avoid':(p.cannot||[]).includes(key)?'cannot':'none'; };
  o.norm=Array.isArray(normMember({prefs:{}}).prefs.cannot);
  const d=normMember({prefs:{prefer:['a','b'],avoid:['c'],cannot:['b','c']}}).prefs; o.dedupe=d.prefer.join()==='a'&&d.avoid.length===0&&d.cannot.join()==='b,c';
  const seq=[st()]; const pay=[];
  for(let i=0;i<4;i++){ writes.length=0; cyclePref(m.id,key); await new Promise(r=>setTimeout(r,60)); seq.push(st()); pay.push(JSON.stringify((writes[0]||[])[1])); }
  o.seq=seq.join('>'); o.pay=pay.map(x=>JSON.stringify(JSON.parse(x).prefs));
  cyclePref(m.id,key); await new Promise(r=>setTimeout(r,60)); cyclePref(m.id,key); await new Promise(r=>setTimeout(r,60)); cyclePref(m.id,key); await new Promise(r=>setTimeout(r,60)); // key now cannot
  cyclePref(m.id,key2); await new Promise(r=>setTimeout(r,60));   // key2 prefer, key stays cannot
  o.table=writes[writes.length-1][0]; o.last=writes[writes.length-1][1].prefs;
  o.both=o.last.cannot.includes(key)&&o.last.prefer.includes(key2)&&!o.last.prefer.includes(key)&&!o.last.avoid.includes(key);
  openMemberDrawer(m.id); const dr=document.getElementById('mbox')||document.body; o.chip=!!document.querySelector('.dchip-tog.cannot'); o.legend=/Cannot: the Weekday Team Lead cannot assign this duty/.test(document.body.innerText);
  closeDrawer&&closeDrawer();
  return o; });
chk(r1.norm&&r1.dedupe,'normMember creates cannot; duty is in at most one list',JSON.stringify(r1));
chk(r1.seq==='none>prefer>avoid>cannot>none','cycle none>prefer>avoid>cannot>none',r1.seq);
chk(r1.pay[0]&&JSON.parse(r1.pay[0]).prefer.length===1&&JSON.parse(r1.pay[0]).cannot.length===0
  &&JSON.parse(r1.pay[1]).avoid.length===1&&JSON.parse(r1.pay[1]).prefer.length===0
  &&JSON.parse(r1.pay[2]).cannot.length===1&&JSON.parse(r1.pay[2]).avoid.length===0
  &&JSON.parse(r1.pay[3]).cannot.length===0,'each step writes prefs {prefer,avoid,cannot} via iv_members update',r1.pay.join(' | '));
chk(r1.table==='iv_members'&&r1.both,'write goes to iv_members; a duty sits in one list only',JSON.stringify(r1.last));
chk(r1.chip&&r1.legend,'drawer shows red cannot chip and the legend line');

// 2. engine ignores cannot
const r2=await p.evaluate(()=>{
  const rng=()=>{ let a=12345; return ()=>{ a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296; }; };
  const realR=Math.random; const gen=()=>{ Math.random=rng(); const out=[]; for(const ev of EVENTS.slice(0,2)) out.push(JSON.stringify(generateEventData(ev)).replace(/"gen_at":"[^"]*"/,'')); Math.random=realR; return out.join('|'); };
  MEMBERS.forEach(m=>{ m.prefs={prefer:[],avoid:[],cannot:[]}; });
  const base=gen(), again=gen();
  const keys=Object.keys(DUTY_INFO).map(n=>DUTY_INFO[n].key);
  MEMBERS.forEach(m=>{ m.prefs.cannot=keys.slice(); });
  const withC=gen();
  MEMBERS.forEach(m=>{ m.prefs.cannot=[]; });
  return {det:base===again,same:base===withC,len:base.length}; });
chk(r2.det&&r2.len>100,'engine deterministic under seeded random (harness sanity)',JSON.stringify(r2));
chk(r2.same,'engine output identical with every duty flagged cannot',JSON.stringify(r2));

// 3. Extra Duty report, drawer, CSV
const r3=await p.evaluate(()=>{
  const o={}; const k=fairnessCycleK(); repMode='attendance';
  const act=MEMBERS.filter(m=>m.status==='active');
  const snap=()=>JSON.stringify(act.map(m=>attendanceStats(m.id,k)));
  const before=snap(); const tb=JSON.stringify(ATT_TOTALS), relB=JSON.stringify(act.map(m=>memberReliability(m.id)));
  const html0=renderAttendanceReport(k);
  EXTRA={}; EXTRA[MEMBERS[0].id]=[{date:'2026-01-02',duty:'Chai Station'},{date:'2026-03-05',duty:'Sukreet'}]; EXTRA[MEMBERS[1].id]=[{date:'2026-02-01',duty:'Nandi Trolley'}];
  const box=document.createElement('div'); box.innerHTML=renderAttendanceReport(k);
  const ths=[...box.querySelectorAll('th')].map(t=>t.textContent.trim());
  const ei=ths.findIndex(t=>/^Extra Duty/.test(t)); o.ths=ths.join('|'); o.lifetime=/all time/.test(ths[ei]||'');
  const col={}; [...box.querySelectorAll('tbody tr')].forEach(tr=>{ const c=tr.querySelectorAll('td'); col[c[0].textContent]=c[ei].textContent; });
  o.counts=[col[MEMBERS[0].name],col[MEMBERS[1].name],col[MEMBERS[2].name]].join(',');
  o.untouched=snap()===before&&JSON.stringify(ATT_TOTALS)===tb&&relB===JSON.stringify(act.map(m=>memberReliability(m.id)));
  // the old columns render the same, ignoring the new one
  const strip=h=>{ const d=document.createElement('div'); d.innerHTML=h; d.querySelectorAll('tr').forEach(tr=>{ const c=tr.children; if(c.length) c[c.length-1].remove(); }); return d.querySelector('tbody').innerHTML; };
  const d0=document.createElement('div'); d0.innerHTML=html0; const hdr0=d0.querySelectorAll('th').length; o.oneMoreCol=ths.length===hdr0&&ei===ths.length-1&&/Walk-ins/.test(ths[ei-1]); o.sameRest=strip(box.innerHTML)===strip(html0).replace(/<td class="num"><\/td>\s*$/,'')||strip(box.innerHTML)===strip(renderAttendanceReport(k));
  const csv=reportCSV(k).split('\n'); o.csvHead=csv[0]; const row=csv.find(l=>l.indexOf('"'+MEMBERS[0].name+'"')===0); o.csvRow=row;
  openMemberDrawer(MEMBERS[0].id); const t=document.getElementById('mbox').textContent;
  o.drawer=/Extra duties/.test(t)&&/Sukreet/.test(t)&&/Chai Station/.test(t)&&t.indexOf('Sukreet')<t.indexOf('Chai Station');
  EXTRA[MEMBERS[0].id]=Array.from({length:13},(_,i)=>({date:'2026-04-'+String(i+10).padStart(2,'0'),duty:'D'+i}));
  openMemberDrawer(MEMBERS[0].id); const t2=document.getElementById('mbox').textContent; o.cap=/latest 10/.test(t2)&&/Extra Duty total: 13/.test(t2)&&t2.includes('D12')&&/D3(?!\d)/.test(t2)&&!/D[012](?!\d)/.test(t2);
  return o; });
chk(/^Extra Duty/.test((r3.ths.split('|').find(t=>/^Extra Duty/.test(t))||''))&&r3.lifetime,'report has an Extra Duty (all time) column',r3.ths);
chk(r3.counts==='2,1,0','Extra Duty counts per member are right',r3.counts);
chk(r3.untouched,'present/late/rates/totals unchanged by Extra Duty');
chk(r3.oneMoreCol,'Extra Duty is one separate last column after Walk-ins');
chk(/,Extra Duty \(all time\)$/.test(r3.csvHead)&&/,2$/.test(r3.csvRow||''),'CSV has the Extra Duty column',r3.csvHead+' / '+r3.csvRow);
chk(r3.drawer,'drawer lists extra duties, newest first');
chk(r3.cap,'drawer shows max 10 with a count');

// 4. loadAll with iv_wd_attendance failing / working
const r4=await p.evaluate(async()=>{
  const o={}; let toasts=0; const realT=toast; toast=()=>{ toasts++; };
  const mk=(wd)=>{ const sel={}; return {from:t=>{ const q={ select(c){ if(t==='iv_wd_attendance') sel.cols=c; return q; }, eq(){return q;}, in(){return q;}, or(){return q;}, order(){return q;}, limit(){return q;}, gte(){return q;}, lte(){return q;},
      then(res,rej){ let r; if(t==='iv_members') r={data:[{id:1,name:'A',team:PAGE_TEAM,status:'active',gender:'Male',age_group:'adult'}],error:null};
        else if(t==='iv_wd_attendance') r=wd; else r={data:[],error:null}; return Promise.resolve(r).then(res,rej); } }; return q; },
      rpc:async()=>({data:[],error:null}), channel:()=>({on(){return this;},subscribe(){return this;}}), removeChannel(){}, sel}; };
  const warns=[]; const rw=console.warn; console.warn=(...a)=>{ warns.push(a.join(' ')); };
  sb=mk({data:null,error:{message:'permission denied for table iv_wd_attendance'}}); DB_MISSING=false;
  let threw=false; try{ await loadAll(); }catch(e){ threw=true; }
  o.threw=threw; o.members=MEMBERS.length; o.extraEmpty=Object.keys(EXTRA).length===0; o.warns=warns.filter(w=>/iv_wd_attendance/.test(w)).length; o.toasts=toasts;
  o.dbMissing=DB_MISSING;
  CYCLES=buildCycles(); let rendered=true; try{ renderAttendanceReport(CYCLES[0].k); }catch(e){ rendered=false; } o.rendered=rendered;
  const good=mk({data:[{member_id:1,date:'2026-02-02',duty:'X'},{member_id:1,date:'2026-01-01',duty:'Y'}],error:null}); sb=good; await loadAll();
  o.cols=good.sel.cols; o.ok=EXTRA[1]&&EXTRA[1].length===2&&EXTRA[1][0].date==='2026-01-01';
  console.warn=rw; toast=realT; return o; });
chk(!r4.threw&&r4.members===1&&r4.extraEmpty&&r4.rendered,'unreadable iv_wd_attendance does not break loadAll or the report',JSON.stringify(r4));
chk(r4.warns===1&&r4.toasts===0&&!r4.dbMissing,'one console.warn, no toast, DB_MISSING untouched',JSON.stringify(r4));
chk(r4.cols==='member_id,date,duty'&&r4.ok,'loads member_id,date,duty into EXTRA',JSON.stringify(r4));
chk(p.errs.length===0,'no page errors',p.errs.join(' | '));
await b.close(); srv.close();
console.log(bad?bad+' FAILED':'ALL PASS'); process.exit(bad?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
