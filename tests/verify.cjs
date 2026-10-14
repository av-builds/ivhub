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

// ── roster flow: cycles → cycle → event ──
{ const p=await open('teama.html',{width:1300,height:950});
  await p.evaluate(`(${SEED})(['tl_a'])`);
  const r=await p.evaluate(async()=>{
    const o={}, q=s=>document.querySelector('#body-roster '+s);
    /* Events in a cycle this team owns, whatever today is: one draft, one
       on the calendar, one not built. */
    const k=CYCLES.find(c=>c.status!=='historic').k, d0=cyStart(k);
    const d=n=>addDaysLocal(d0,n);
    EVENTS.push({id:11,team:PAGE_TEAM,date:d(1),name:'Draft one',type:'friday',uniform:'Casual',youth:true,confirmed:false},
                {id:12,team:PAGE_TEAM,date:d(2),name:'Live one',type:'pbs',uniform:'Casual',youth:false,confirmed:true},
                {id:13,team:PAGE_TEAM,date:d(3),name:'Added late',type:'friday',uniform:'Casual',youth:true,confirmed:false});
    ROSTERS[11]=generateEventData(EVENTS.find(e=>e.id===11)); ROSTERS[12]=generateEventData(EVENTS.find(e=>e.id===12));
    nav('calendar'); nav('roster'); renderRoster();   // seeded without LOADED, so nav alone draws the skeleton
    o.home=ROSTER_VIEW; o.cards=document.querySelectorAll('#body-roster .cy-card').length; o.cycles=CYCLES.length;
    o.noSidebar=!q('.rl-side')&&!q('.rl-info');
    openCycle(k);
    o.cycleView=ROSTER_VIEW==='cycle'&&!!q('.cy-hero'); o.cta=!!q('.gen-cta'); o.pubBar=!!q('.pub-bar');
    o.rows=document.querySelectorAll('#body-roster .cy-ev').length===eventsInCycle(k).length;
    const before=JSON.stringify(ROSTERS);
    previewCycle(k);
    o.previewMiddle=!!q('.gp-wide .gp.preview')&&ROSTER_VIEW==='cycle';
    o.previewSavesNothing=JSON.stringify(ROSTERS)===before;
    o.liveLeftAlone=ROSTER_PLAN.events.find(e=>e.id===12).skipped===true;
    o.twoSaves=!!q('[onclick="commitPlan(true)"]')===!!ROSTER_PLAN.events.some(e=>!e.skipped&&!e.missing)&&!!q('[onclick="commitPlan(false)"]');
    discardPlan();
    /* Mid-cycle: only the new event is built, against the others' duties. */
    const r11=JSON.stringify(ROSTERS[11]);
    previewEventInCycle(13,{midCycle:2});
    o.midOnlyNew=ROSTER_PLAN.scope==='event'&&ROSTER_PLAN.events.length===1&&ROSTER_PLAN.events[0].id===13;
    o.midOthersSame=JSON.stringify(ROSTERS[11])===r11&&JSON.stringify(ROSTERS)===before;
    o.midNote=/mid-cycle/i.test((q('.gp-sub')||{}).textContent||'');
    discardPlan();
    /* Publish bar: gaps never go up without the second press. */
    /* Seeded members always leave gaps, so call one draft complete; another
       draft keeps its gaps. */
    EVENTS.push({id:14,team:PAGE_TEAM,date:d(4),name:'Gappy',type:'friday',uniform:'Casual',youth:true,confirmed:false});
    ROSTERS[14]=generateEventData(EVENTS.find(e=>e.id===14));
    const realSC=slotCounts; slotCounts=e=>e.id===11?Object.assign({},realSC(e),{missing:0}):realSC(e);
    let writes=[]; const real=setOnCalendar; setOnCalendar=async(ev,w)=>{writes.push(ev.id);ev.confirmed=w;return true;};
    const sum=cycleSummary(k); o.gapIds=sum.gapDrafts.map(e=>e.id).join(); o.readyIds=sum.ready.map(e=>e.id).join();
    await publishCycle(k); o.completeOnly=writes.every(id=>sum.ready.some(e=>e.id===id))&&writes.length===sum.ready.length;
    writes=[]; await doPublishCycleGaps(k); o.gapsOnPress=writes.length===sum.gapDrafts.length;
    setOnCalendar=real; slotCounts=realSC;
    /* Into one event and back out. */
    selectEvent(11); o.eventView=ROSTER_VIEW==='event'&&!!q('.ro-crumbs [onclick^="openCycle"]')&&!!q('.duty');
    nav('calendar'); selectEvent(12); o.jump=curPage==='roster'&&ROSTER_VIEW==='event';
    nav('calendar'); nav('roster'); o.menuHome=ROSTER_VIEW==='cycles';
    return o; });
  chk(r.home==='cycles'&&r.cards===r.cycles&&r.noSidebar,'roster  opens on the list of cycles, no sidebar',r.cards+'/'+r.cycles);
  chk(r.cycleView&&r.rows,'roster  a cycle opens with its events listed');
  chk(r.cta,'roster  generate is offered while events are not built');
  chk(r.pubBar,'roster  publish bar shows once something is built');
  chk(r.previewMiddle,'roster  the build preview sits in the middle of the cycle view');
  chk(r.previewSavesNothing,'roster  previewing stores nothing');
  chk(r.liveLeftAlone,'roster  generating leaves rosters on the calendar alone');
  chk(r.twoSaves,'roster  saving offers publish or drafts');
  chk(r.midOnlyNew&&r.midOthersSame,'roster  a mid-cycle event is built on its own; nothing else changes');
  chk(r.midNote,'roster  the preview says it was built against the rest of the cycle');
  chk(r.gapIds==='14','roster  a draft with gaps is held back',r.gapIds);
  chk(r.readyIds==='11'&&r.completeOnly,'publish the bar puts up complete drafts only',r.readyIds||'none ready');
  chk(r.gapsOnPress,'publish drafts with gaps go up on the deliberate press');
  chk(r.eventView,'roster  an event opens with a way back to its cycle');
  chk(r.jump,'roster  links that name an event go straight to it');
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
    for(const [name,go] of [['cycles',()=>nav('roster')],['cycle',()=>openCycle(k)],['event',()=>selectEvent(1)]]){
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

await b.close(); srv.close();
console.log('\n'+'='.repeat(64)); pass.forEach(x=>console.log('  PASS  '+x)); fail.forEach(x=>console.log('  FAIL  '+x));
console.log('='.repeat(64)); console.log(pass.length+' passed, '+fail.length+' failed'); process.exit(fail.length?1:0);
})().catch(e=>{console.error('SUITE CRASHED',e&&e.stack||e);process.exit(1);});
