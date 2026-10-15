/* Regression suite. Starts its own static server, drives the real pages in
   Chromium, exits non-zero on any failure. `npm test` is the whole command.
   Cannot check saving: there is no database here, so storage is untested. */
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
function serve(){return new Promise((res,rej)=>{
  const s=http.createServer((q,r)=>{
    const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'index.html';
    const f=path.resolve(ROOT,rel);
    if(f!==ROOT&&!f.startsWith(ROOT+path.sep)){r.writeHead(403);return r.end();}
    fs.readFile(f,(e,b)=>{ if(e){r.writeHead(404);return r.end();}
      r.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream'}); r.end(b); });
  });
  s.on('error',rej); s.listen(Number(process.env.PORT)||0,'127.0.0.1',()=>res(s)); });}
const pass=[],fail=[]; const chk=(c,l,x)=>{(c?pass:fail).push(l+(x?'  ['+x+']':''));};

const SEED=`(perms)=>{
  CU={user:'u',display:'U',perms:perms,uid:'u1'}; recomputeAccess(); applyNavScope();
  OVERRIDES={}; clearCycleCache(); CYCLES=buildCycles();
  const today=nzTodayISO();
  const d=n=>{const x=new Date(today+'T12:00');x.setDate(x.getDate()+n);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');};
  MEMBERS=[];for(let i=0;i<40;i++)MEMBERS.push({id:i+1,name:'M'+i,status:'active',gender:i%2?'Female':'Male',age_group:i<10?'child':i<24?'youth':'adult',nandi:i>=24&&i<26,away:[],prefs:{}});
  EVENTS=[{id:1,team:PAGE_TEAM,date:today,name:'Friday Majlis',type:'friday',uniform:'Casual',youth:true,confirmed:false},
          {id:2,team:PAGE_TEAM,date:d(1),name:'PBS',type:'pbs',uniform:'Casual',youth:false,confirmed:true},
          {id:3,team:PAGE_TEAM,date:d(2),name:'Unbuilt',type:'friday',uniform:'Casual',youth:true,confirmed:false}];
  ROSTERS={1:generateEventData(EVENTS[0]),2:generateEventData(EVENTS[1])};
  const t=new Date(today+'T12:00'); CAL={y:t.getFullYear(),m:t.getMonth()};
  document.getElementById('app').style.display='block';
}`;
(async()=>{
const A=fs.readFileSync(path.join(ROOT,'teama.html'),'utf8'), B=fs.readFileSync(path.join(ROOT,'teamb.html'),'utf8');
chk(B===A.replace(/^const PAGE_TEAM='A';$/m,"const PAGE_TEAM='B';")&&/^const PAGE_TEAM='B';$/m.test(B),
  'sync   teamb.html matches teama.html with PAGE_TEAM flipped',
  'if red: sed "s/^const PAGE_TEAM=\'A\';$/const PAGE_TEAM=\'B\';/" teama.html > teamb.html');
const srv=await serve(); const BASE='http://127.0.0.1:'+srv.address().port;
const b=await chromium.launch({args:['--no-sandbox']});
const open=async(file,vp,touch)=>{
  const ctx=await b.newContext({viewport:vp,isMobile:!!touch,hasTouch:!!touch}); const p=await ctx.newPage();
  // The suite runs the pages offline. Where the CDN is reachable, Supabase
  // loads, finds no session and redirects to the Hub mid-test, so block it.
  await ctx.route(u=>!String(u).startsWith(BASE),r=>r.abort());
  p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message));
  await p.goto(BASE+'/'+file,{waitUntil:'domcontentloaded'});
  await p.addStyleTag({content:'.noaccess{display:none!important}#loginScreen{display:none!important}'});
  await p.waitForTimeout(2300); return p; };

// ── leader experience ──
{ const p=await open('teama.html',{width:1300,height:950});
  await p.evaluate(`(${SEED})(['tl_a'])`);
  const r=await p.evaluate(async()=>{
    nav('calendar'); renderCalendar();
    const vis=e=>getComputedStyle(e).display!=='none';
    const o={};
    o.menu=[...document.querySelectorAll('.sb-nav .nav-item')].filter(vis).map(e=>e.innerText.replace(/\W+/g,' ').trim());
    o.sections=document.querySelectorAll('.nav-sec').length;
    o.landing=curPage;
    o.states=[...document.querySelectorAll('.cal-st')].map(e=>e.innerText);
    o.theirs=document.querySelectorAll('.cal-cell.theirs:not(.out)').length;
    o.tonight=(document.querySelector('.tonight')||{}).innerText||'';
    o.bell=bellItems().map(x=>x.kind);
    // publish with gaps: default refuses, force reaches the write
    let writes=0; const real=setOnCalendar; setOnCalendar=async(ev,w)=>{writes++;ev.confirmed=w;return true;};
    const ev=EVENTS[0]; ev.confirmed=false;
    o.gaps=slotCounts(ev).missing; o.defaultRefuses=(await publishIfComplete(ev))===false&&writes===0;
    o.forceWorks=(await publishIfComplete(ev,{force:true}))===true&&writes===1; setOnCalendar=real;
    o.cantSwitch=!CAN_SWITCH_TEAM();
    return o; });
  chk(r.menu.join()==='Calendar,Roster,Attendance,Numbers,People,Announcements','menu    one flat list, calendar first',r.menu.join(' / '));
  chk(r.sections===0,'menu    no General/Management split');
  chk(r.landing==='calendar','landing leaders open on the calendar');
  chk(r.states.some(s=>/^Draft/.test(s))&&r.states.some(s=>/^On the calendar/.test(s))&&r.states.some(s=>/^Not built/.test(s)),'chips   built state is shown in words',r.states.join(' | '));
  chk(r.states.some(s=>/short/.test(s)),'chips   slots short are shown');
  chk(r.theirs>0,'calendar the other team\'s days are dimmed',r.theirs+' days');
  chk(/tonight/i.test(r.tonight)&&/mark attendance/i.test(r.tonight),'tonight strip with Mark attendance appears on an event day');
  chk(r.bell.indexOf('gap')>=0,'bell    unfilled gaps appear');
  chk(r.gaps>0&&r.defaultRefuses,'publish an automatic publish still refuses incomplete rosters');
  chk(r.forceWorks,'publish a deliberate press can put an incomplete roster up');
  chk(r.cantSwitch,'switcher not offered to a Team Lead');
  chk(p.errs.length===0,'leader  no page errors',p.errs.slice(0,1).join('')); await p.context().close(); }

// ── facilitator switcher; volunteer redirect ──
{ const p=await open('teama.html',{width:1300,height:900});
  const r=await p.evaluate(`(async()=>{ await (${SEED})(['facilitator']); const o={can:CAN_SWITCH_TEAM()}; openTeamSwitch();
    o.dlg=document.getElementById('dcard').innerText; cM();
    CU={user:'v',display:'V',perms:['team_a'],uid:'v'}; recomputeAccess(); applyNavScope(); nav('roster'); o.volPage=curPage;
    o.volMenu=[...document.querySelectorAll('.sb-nav .nav-item')].filter(e=>getComputedStyle(e).display!=='none').length; return o; })()`);
  chk(r.can&&/Switch to Team B/.test(r.dlg),'switcher a Facilitator can switch teams');
  chk(r.volPage==='dashboard'&&r.volMenu===0,'access  a volunteer gets no leader pages or menu');
  chk(p.errs.length===0,'switch  no page errors'); await p.context().close(); }

// ── roster: cycles → a cycle with its days opening in place ──
{ const p=await open('teama.html',{width:1300,height:950});
  await p.evaluate(`(${SEED})(['tl_a'])`);
  const r=await p.evaluate(async()=>{
    const o={}, q=s=>document.querySelector('#body-roster '+s);
    /* A cycle this team owns, whatever today is: a hidden draft (11), a day
       on the calendar (12), one not built (13), another hidden one (14). */
    const k=CYCLES.find(c=>c.status!=='historic').k, d0=cyStart(k), d=n=>addDaysLocal(d0,n);
    const mk=(id,n,name,type,conf)=>EVENTS.push({id,team:PAGE_TEAM,date:d(n),name,type,uniform:'Casual',youth:type==='friday',confirmed:conf});
    mk(11,1,'Draft one','friday',false); mk(12,2,'Live one','pbs',true); mk(13,3,'Not built','friday',false); mk(14,4,'Hidden one','friday',false);
    for(const id of [11,12,14]) ROSTERS[id]=generateEventData(EVENTS.find(e=>e.id===id));
    /* No database here: stand in for the two writes and count them. */
    let pubs=[]; const realSet=setOnCalendar, realSave=saveRoster;
    setOnCalendar=async(ev,w)=>{pubs.push((w?'+':'-')+ev.id);ev.confirmed=w;return true;};
    saveRoster=async()=>true;
    nav('calendar'); nav('roster'); renderRoster();   // seeded without LOADED, so nav alone draws the skeleton
    o.home=ROSTER_VIEW==='cycles'&&document.querySelectorAll('#body-roster .cy-card').length===CYCLES.length;
    openCycle(k);
    o.layout=!!q('.cv-layout .cv-side')&&!!q('.cv-layout .cv-main');
    o.days=document.querySelectorAll('#body-roster .cv-day').length===eventsInCycle(k).length;
    o.sideList=document.querySelectorAll('#body-roster .cv-ev').length===eventsInCycle(k).length;
    o.noSummaryYet=!q('.cv-sum');
    openDay(11);
    o.inPlace=ROSTER_VIEW==='cycle'&&!!q('#day-11.open .duty')&&selEventId===11;
    o.blankSlots=!!q('#day-11 .chip.blank')&&!q('.chip.un');
    /* Generate: new days go up, gaps and all; built days keep their state. */
    const r12=JSON.stringify(ROSTERS[12]);
    pubs=[]; await runGenerate(k,false);
    o.pubs=pubs.join();
    o.newDayUp=pubs.join()==='+13'&&EVENTS.find(e=>e.id===13).confirmed===true;
    o.hiddenStayHidden=!EVENTS.find(e=>e.id===11).confirmed&&!EVENTS.find(e=>e.id===14).confirmed;
    o.liveUntouched=JSON.stringify(ROSTERS[12])===r12;
    o.summary=!!q('.cv-sum .gp.receipt')&&/Cycle summary/.test(q('.cv-sum').textContent);
    /* Mid-cycle: one new day built on its own, straight onto the calendar. */
    mk(15,6,'Added late','friday',false);
    const before=JSON.stringify([ROSTERS[11],ROSTERS[12],ROSTERS[13],ROSTERS[14]]);
    pubs=[]; await generateDay(15,{midCycle:4});
    o.midOnlyNew=ROSTER_PLAN.scope==='event'&&ROSTER_PLAN.events.length===1&&pubs.join()==='+15';
    o.midOthersSame=JSON.stringify([ROSTERS[11],ROSTERS[12],ROSTERS[13],ROSTERS[14]])===before;
    o.midNote=/mid-cycle/i.test((q('.cv-sum .gp-sub')||{}).textContent||'');
    o.midOpen=ROSTER_OPEN===15&&!!q('#day-15.open .duty');
    /* Hiding is the manual act. */
    pubs=[]; await toggleDayCalendar(12); o.hide=pubs.join()==='-12';
    /* Manual edit: any slot opens the name search; a filled one can be left blank. */
    openDay(11,true);
    const filled=q('#day-11 .cellwrap button.chip:not(.blank):not(.add)'); filled.click();
    o.pickFilled=!!document.querySelector('#dcard #pickSearch')&&/Leave blank/.test(document.getElementById('dcard').textContent);
    cM();
    q('#day-11 .chip.blank').click();
    o.pickBlank=!!document.querySelector('#dcard #pickSearch')&&!/Leave blank/.test(document.getElementById('dcard').textContent)&&
      document.querySelectorAll('#dcard .pick-row').length>0;
    pubs=[]; document.querySelector('#dcard .pick-row').click(); await new Promise(res=>setTimeout(res,50));
    o.editNoPublish=pubs.length===0&&!EVENTS.find(e=>e.id===11).confirmed;
    setOnCalendar=realSet; saveRoster=realSave;
    /* Links that name an event open its cycle with that day expanded. */
    nav('calendar'); selectEvent(12); o.jump=curPage==='roster'&&ROSTER_VIEW==='cycle'&&ROSTER_OPEN===12;
    openFullRoster(11); o.full=ROSTER_VIEW==='event'&&!!q('.ro-crumbs [onclick^="openCycle"]')&&!!q('.duty');
    nav('calendar'); nav('roster'); o.menuHome=ROSTER_VIEW==='cycles';
    return o; });
  chk(r.home,'roster  opens on the list of cycles');
  chk(r.layout&&r.sideList,'cycle   side column with the event days, days in the middle');
  chk(r.days,'cycle   every event day is listed in the middle');
  chk(r.noSummaryYet,'cycle   no Cycle summary until something is generated');
  chk(r.inPlace,'cycle   clicking a day opens its roster in place');
  chk(r.blankSlots,'cycle   unfilled slots show blank, not UNASSIGNED');
  chk(r.newDayUp,'generate new days go on the calendar, gaps and all',r.pubs);
  chk(r.hiddenStayHidden,'generate a day a lead hid stays hidden');
  chk(r.liveUntouched,'generate days on the calendar are not re-rolled unless asked');
  chk(r.summary,'generate the Cycle summary appears after a generate');
  chk(r.midOnlyNew&&r.midOthersSame,'midcycle only the new day is built; nothing else changes');
  chk(r.midNote&&r.midOpen,'midcycle the summary says so and the new day is opened');
  chk(r.hide,'calendar hiding a day takes it off the calendar');
  chk(r.pickFilled,'edit    a filled slot opens the name search, with Leave blank');
  chk(r.pickBlank,'edit    a blank slot opens the name search');
  chk(r.editNoPublish,'edit    a hand edit does not put a hidden day back up');
  chk(r.jump,'roster  links that name an event open its day in the cycle');
  chk(r.full,'roster  the full roster page has a way back to its cycle');
  chk(r.menuHome,'roster  the menu item returns to the list of cycles');
  chk(p.errs.length===0,'roster  no page errors',p.errs.slice(0,1).join('')); await p.context().close(); }

// ── layout ──
for(const vp of [{w:390,h:844,t:1},{w:820,h:1180,t:1},{w:1440,h:950,t:0}]){
  const p=await open('teama.html',{width:vp.w,height:vp.h},vp.t);
  await p.evaluate(`(${SEED})(['tl_a'])`);
  /* Each of the roster's three screens: the cycle list, one cycle, one event. */
  const r=await p.evaluate(async()=>{
    const wait=()=>new Promise(res=>setTimeout(res,900)), de=document.documentElement, o={ovf:[],small:[]};
    const k=CYCLES.find(c=>c.status!=='historic').k;
    for(const [name,go] of [['cycles',()=>nav('roster')],['cycle',()=>openCycle(k)],['day',()=>{ EVENTS.push({id:21,team:PAGE_TEAM,date:addDaysLocal(cyStart(k),1),name:'Day',type:'friday',uniform:'Casual',youth:true,confirmed:true}); ROSTERS[21]=generateEventData(EVENTS[EVENTS.length-1]); openDay(21,true); }],['event',()=>openFullRoster(1)]]){
      go(); await wait();
      const taps=[...document.querySelectorAll('#page-roster button,#page-roster .btn,#page-roster .chip')].filter(e=>{const q=e.getBoundingClientRect();return q.width>0&&q.height>0;});
      if(de.scrollWidth>de.clientWidth+2) o.ovf.push(name);
      const n=taps.filter(e=>e.getBoundingClientRect().height<44).length; if(n) o.small.push(name+':'+n);
    }
    return o; });
  chk(!r.ovf.length,vp.w+'px no horizontal overflow',r.ovf.join(' '));
  if(vp.t) chk(!r.small.length,vp.w+'px every roster target is at least 44px',r.small.join(' '));
  chk(p.errs.length===0,vp.w+'px no page errors'); await p.context().close(); }

// ── Hub ──
{ const p=await open('index.html',{width:1200,height:900});
  const r=await p.evaluate(()=>{ const vis=id=>{const e=document.getElementById(id);return !!e&&getComputedStyle(e).display!=='none';}; const o={};
    for(const [k,perms,cv] of [['vol',['team_a'],[]],['cover',['team_a'],['A']],['lead',['tl_a'],[]]]){
      CU={user:'x',display:'X',perms,uid:'u'}; COVER_TEAMS.clear(); cv.forEach(t=>COVER_TEAMS.add(t)); applyNavVisibility(); o[k]=vis('navTeamA'); }
    return o; });
  chk(r.vol===false,'hub     a plain volunteer no longer sees the team link');
  chk(r.cover===true&&r.lead===true,'hub     a stand-in and a lead still do');
  chk(p.errs.length===0,'hub     no page errors'); await p.context().close(); }

// saving: the payload must carry the event's date (the column is NOT NULL)
{ const p=await open('teama.html',{width:1300,height:900});
  const r=await p.evaluate(`(async()=>{ await (${SEED})(['tl_a']); let sent=null;
    sb={from:t=>({upsert:async row=>{ if(t==='iv_roster') sent=row; return {error:null}; },
      select:()=>({eq:async()=>({data:[{event_id:1,data:ROSTERS[1]}],error:null})})})};
    DB_MISSING=false; await saveRoster(1,{quiet:true}); return {sent, date:EVENTS[0].date}; })()`);
  chk(r.sent&&r.sent.date===r.date&&r.sent.event_id===1,'save    the roster is saved with its event date',r.sent?String(r.sent.date):'nothing sent');
  await p.context().close(); }

await b.close(); srv.close();
console.log('\n'+'='.repeat(64)); pass.forEach(x=>console.log('  PASS  '+x)); fail.forEach(x=>console.log('  FAIL  '+x));
console.log('='.repeat(64)); console.log(pass.length+' passed, '+fail.length+' failed'); process.exit(fail.length?1:0);
})().catch(e=>{console.error('SUITE CRASHED',e&&e.stack||e);process.exit(1);});
