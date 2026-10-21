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

// ── Divisions and teams ──
{ const p=await open('index.html',{width:1200,height:900});
  const r=await p.evaluate(()=>{ const o={};
    const menu=perms=>{ CU={user:'x',display:'X',perms,uid:'u'}; applyNavVisibility(); return ['phmuNav','soloNav','ancNav'].map(i=>document.getElementById(i).innerText).join(' ').replace(/\s+/g,' ').trim(); };
    o.cook=menu(['ck_team']); o.head=menu(['an_lead']); o.director=menu(['director']); o.tl=menu(['tl_a']); o.safety=menu(['ss_alead']);
    o.rank=[PERM_RANK.an_lead,PERM_RANK.an_alead,PERM_RANK.mt_team];
    CU={user:'x',display:'X',perms:['director'],uid:'u'}; o.grant=grantableRoles().filter(r=>/^(an|pt|ss|td|mt|ck|cl|ab|sk)_/.test(r)).length;
    CU={user:'x',display:'X',perms:['facilitator'],uid:'u'}; o.facGrant=grantableRoles().filter(r=>/^(an|pt|ss|td|mt|ck|cl|ab|sk)_/.test(r)).length;
    CU={user:'x',display:'X',perms:['an_alead'],uid:'u'}; o.leadTeams=myLeadTeams().join();
    CU={user:'x',display:'X',perms:['an_lead'],uid:'u'}; renderQuickAccess(); o.quick=document.getElementById('quickPanel').innerText.replace(/\s+/g,' ');
    CU={user:'x',display:'X',perms:['an_lead'],uid:'u'}; o.noAdmin=[USERS_ADMIN(),STATS_VIEW(),canManageAccounts()].join();
    return o; });
  chk(/Cooking/.test(r.cook)&&!/Maintenance|Cleaning|Paat/.test(r.cook),'teams   a cooking volunteer sees only Cooking',r.cook);
  chk(/🛠️ Overview/.test(r.head)&&/Maintenance/.test(r.head)&&/Cooking/.test(r.head)&&/Cleaning/.test(r.head)&&!/Paat|Safety/.test(r.head),'teams   a division head sees the division and its teams only',r.head);
  chk(/Paat/.test(r.director)&&/Safety/.test(r.director)&&/Training/.test(r.director)&&/Abeshafa/.test(r.director)&&/Maintenance/.test(r.director),'teams   a director sees every division and team');
  chk(r.tl==='','teams   a Team A lead sees none of them');
  chk(/Safety & Security/.test(r.safety),'teams   a Safety & Security assistant lead sees their division',r.safety);
  chk(r.rank.join()==='6,7,10','teams   leads rank 6, assistants 7, volunteers 10',r.rank.join());
  const y=await p.evaluate(()=>{ const o={};
    o.ranks=[PERM_RANK.av_atl,PERM_RANK.av_yatl,PERM_RANK.av_coord,PERM_RANK.av_team].join();
    CU={user:'x',display:'X',perms:['av_yatl'],uid:'u'};
    o.admin=[AV_ADMIN(),AV_VIEW(),rapidVisible(),myLeadTeams().join()].join();
    CU={user:'x',display:'X',perms:['av_coord'],uid:'u'}; o.coord=[AV_ADMIN(),rapidVisible()].join();
    CU={user:'x',display:'X',perms:['director'],uid:'u'}; o.grant=grantableRoles().includes('av_yatl');
    o.label=ROLE_LABELS.av_yatl; return o; });
  chk(y.ranks==='7,8,9,10','av role av_atl 7, AV Youth Assistant Lead 8, co-ordinator 9, volunteer 10',y.ranks);
  chk(y.admin.startsWith('true,true,true')&&y.coord==='true,false'&&y.grant===true&&y.label==='AV Youth Assistant Lead','av role AV Youth Assistant Lead has the Assistant Lead powers, a director can grant it',JSON.stringify(y));
  chk(r.grant===23&&r.facGrant===0,'teams   directors grant all 23 roles, facilitators none',r.grant+' / '+r.facGrant);
  chk(r.leadTeams==='AN','teams   a division assistant lead is treated as a lead for landing');
  chk(/Division page/.test(r.quick)&&/Maintenance/.test(r.quick)&&/Cooking/.test(r.quick),'teams   a division head gets tiles for the division and each team',r.quick);
  chk(r.noAdmin==='false,false,false','teams   a division head gets no Hub admin powers',r.noAdmin);
  chk(p.errs.length===0,'teams   hub no page errors'); await p.context().close(); }
{ const cases=[
    ['ancillary.html',['an_lead'],true,3,'division head opens their division, 3 team tiles'],
    ['ancillary.html',['ck_lead'],false,0,'a team lead cannot open the division page'],
    ['cooking.html',['an_alead'],true,0,'a division head opens a team beneath'],
    ['cooking.html',['ck_team'],true,0,'a team volunteer opens their own team'],
    ['cooking.html',['pt_lead'],false,0,'another division head cannot open it'],
    ['paat.html',['pt_lead'],true,2,'Paat Team Lead sees both groups'],
    ['abeshafa.html',['sk_lead'],false,0,'Sukreet lead cannot open Abeshafa'],
    ['safety.html',['ss_lead'],true,0,'Safety & Security Lead opens their page'],
    ['training.html',['director'],true,0,'a director opens Training & Development'],
    ['maintenance.html',['tl_a'],false,0,'a Team A lead cannot open Maintenance'],
  ];
  for(const [f,perms,ok,tiles,label] of cases){
    const p=await open(f,{width:390,height:800},true);
    const r=await p.evaluate(perms=>{ render(perms); return {ok:!document.getElementById('stOk').classList.contains('hide'), tiles:document.querySelectorAll('#tiles a').length}; },perms);
    chk(r.ok===ok&&r.tiles===tiles,'pages   '+f+' — '+label,JSON.stringify(r));
    chk(p.errs.length===0,'pages   '+f+' no page errors'); await p.context().close(); }
}

// laptop: the top bar carries the four categories
{ const p=await open('index.html',{width:1300,height:900});
  const r=await p.evaluate(async()=>{ const o={};
    const bar=async pm=>{ CU={user:'x',display:'X',perms:pm,uid:'u'}; applyNavVisibility(); await new Promise(r=>setTimeout(r,250));
      const groups={}; document.querySelectorAll('#topnav .tn-group').forEach(g=>{ groups[g.querySelector('.tn-b').textContent.replace('▾','').trim()]=g.querySelector('.tn-menu').innerText.replace(/\s+/g,' ').trim(); });
      const direct=[...document.querySelectorAll('#topnav .tn-row > .tn-b')].map(b=>b.innerText.replace(/\s+/g,' ').trim());
      return {groups,direct}; };
    o.head=await bar(['an_lead']); o.cook=await bar(['ck_team']); o.safety=await bar(['ss_lead']); o.tl=await bar(['tl_a']); o.paat=await bar(['ab_team']); o.dir=await bar(['director']);
    return o; });
  chk(/Overview/.test(r.head.groups['Ancillary Services']||'')&&/Maintenance/.test(r.head.groups['Ancillary Services']||'')&&!r.head.groups['PHMU'],'topbar  a division head sees Ancillary Services with its teams',JSON.stringify(r.head.groups));
  chk(/Cooking/.test(r.cook.groups['Ancillary Services']||'')&&!/Maintenance/.test(r.cook.groups['Ancillary Services']||''),'topbar  a team volunteer sees only their team',JSON.stringify(r.cook.groups));
  chk(r.safety.direct.some(x=>/Safety & Security/.test(x))&&!r.safety.groups['PHMU'],'topbar  Safety & Security stands alone on the bar',r.safety.direct.join('|'));
  chk(/Team A/.test(r.tl.groups['PHMU']||'')&&!r.tl.groups['Ancillary Services'],'topbar  a Team A lead sees PHMU with Team A only',JSON.stringify(r.tl.groups));
  chk(/Paat Team/.test(r.paat.groups['PHMU']||'')&&/Abeshafa/.test(r.paat.groups['PHMU']||''),'topbar  a Paat group member sees the Paat Team group under PHMU',r.paat.groups['PHMU']);
  chk(['PHMU','Ancillary Services'].every(k=>r.dir.groups[k])&&r.dir.direct.some(x=>/Training/.test(x))&&r.dir.direct.some(x=>/Safety/.test(x)),'topbar  a director sees all four categories');
  chk(p.errs.length===0,'topbar  no page errors'); await p.context().close(); }

// roles: team-then-level picker, and team assignment in User Management
{ const p=await open('index.html',{width:1200,height:900});
  const r=await p.evaluate(()=>{ const o={};
    CU={user:'x',display:'X',perms:['director'],uid:'u'};
    const all=grantableRoles(); const gs=rpGroups(all);
    o.cats=[...new Set(gs.map(g=>g.cat))].join('|');
    o.cooking=(gs.find(g=>g.id==='ck')||{levels:[]}).levels.map(l=>l[0]).join();
    document.body.insertAdjacentHTML('beforeend','<div id="rpT"></div>'); document.getElementById('rpT').innerHTML=rolePickerHTML('rpT1',all,'None');
    document.getElementById('rpT1-team').value='ck'; rpTeam('rpT1'); o.beforeLevel=rpValue('rpT1');
    document.getElementById('rpT1-level').value='ck_lead'; o.afterLevel=rpValue('rpT1');
    CU={user:'x',display:'X',perms:['facilitator'],uid:'u'}; o.facTeams=rpGroups(grantableRoles()).map(g=>g.id).join();
    o.spec=SPEC_TEAMS.map(t=>t.id).join(); o.chips=(specChipsHTML(['COOKING','XYZ'],'').match(/spec-chip active/g)||[]).length;
    return o; });
  chk(r.cats==='Leadership|PHMU|Training & Development|Safety & Security|Ancillary Services','roles   picker groups follow the four categories',r.cats);
  chk(r.cooking==='ck_lead,ck_alead,ck_team','roles   a team offers Team Lead, Assistant Team Lead and Volunteer',r.cooking);
  chk(r.beforeLevel===''&&r.afterLevel==='ck_lead','roles   no role until a level is chosen',r.beforeLevel+' / '+r.afterLevel);
  chk(r.facTeams==='A,B','roles   a facilitator is still offered Teams A and B only',r.facTeams);
  chk(/COOKING/.test(r.spec)&&/ABESHAFA/.test(r.spec)&&r.chips===2,'roles   User Management can assign every team, and keeps unknown values',r.spec);
  chk(p.errs.length===0,'roles   no page errors'); await p.context().close(); }

// ── Who sees which category: every role against the menu and every page ──
{ const p=await open('index.html',{width:1300,height:900});
  const MENU={
    'team_a':'', 'team_b':'', 'tl_a':'PHMU:Team A', 'ytl_b':'PHMU:Team B', 'facilitator':'PHMU:Team A,Team B',
    'av_team':'PHMU:AV Team', 'av_admin':'PHMU:AV Team',
    'pt_lead':'PHMU:Paat Team,Abeshafa Paat Group,Sukreet Paat Group', 'ab_team':'PHMU:Abeshafa Paat Group',
    'td_lead':'+Training & Development', 'ss_alead':'+Safety & Security',
    'an_lead':'Ancillary Services:Overview,Maintenance,Cooking Team,Cleaning Volunteers', 'mt_team':'Ancillary Services:Maintenance', 'ck_alead':'Ancillary Services:Cooking Team',
    'phmu_lead':'ALL','director':'ALL','owner':'ALL','nobody':'' };
  const got=await p.evaluate(async roles=>{ const o={};
    for(const role of roles){
      CU={user:'x',display:'X',perms:role==='nobody'?[]:[role],uid:'u'}; COVER_TEAMS.clear(); applyNavVisibility(); await new Promise(r=>setTimeout(r,220));
      const groups={}; document.querySelectorAll('#topnav .tn-group').forEach(g=>{ const n=g.querySelector('.tn-b').textContent.replace('▾','').trim(); groups[n]=[...g.querySelectorAll('.tn-menu .tn-b')].map(b=>b.innerText.replace(/^[^A-Za-z]+/,'').replace(/^[AB] (?=Team)/,'').replace(/\s*⚠\s*Soon/i,'').replace(/\s+/g,' ').trim()); });
      const direct=[...document.querySelectorAll('#topnav .tn-row > .tn-b')].map(b=>b.innerText.replace(/^[^A-Za-z]+/,'').replace(/\s+/g,' ').replace(/\s*⚠\s*Soon/i,'').trim()).filter(x=>!/^(Dashboard|My Duties)$/.test(x));
      o[role]={groups,direct};
    } return o; }, Object.keys(MENU));
  for(const role of Object.keys(MENU)){
    const g=got[role].groups, d=got[role].direct, exp=MENU[role];
    const cats=Object.keys(g).filter(k=>k!=='Management');
    let ok;
    if(exp==='') ok=cats.length===0&&!d.some(x=>/Training|Safety/.test(x));
    else if(exp==='ALL') ok=['PHMU','Ancillary Services'].every(k=>g[k])&&d.some(x=>/Training/.test(x))&&d.some(x=>/Safety/.test(x));
    else if(exp[0]==='+') ok=cats.length===0&&d.filter(x=>!/^Management/.test(x)).join()===exp.slice(1);
    else { const [cat,items]=exp.split(':'); ok=cats.join()===cat&&g[cat].join()===items.split(',').join()&&!d.some(x=>/Training|Safety/.test(x)); }
    chk(ok,'access  '+role+' sees '+(exp||'no categories'),JSON.stringify({g:Object.fromEntries(cats.map(c=>[c,g[c]])),d}));
  }
  chk(p.errs.length===0,'access  hub no page errors'); await p.context().close(); }
{ const ROLES=['team_a','tl_a','av_admin','facilitator','pt_lead','ab_team','sk_team','td_lead','ss_alead','an_lead','an_alead','mt_team','ck_lead','cl_team','phmu_lead','director','owner'];
  const PAGES={ 'paat.html':{own:['pt_lead','pt_alead'],kids:[]}, 'abeshafa.html':{own:['ab_lead','ab_alead','ab_team'],kids:['pt_lead','pt_alead']},
    'sukreet.html':{own:['sk_lead','sk_alead','sk_team'],kids:['pt_lead','pt_alead']}, 'training.html':{own:['td_lead','td_alead'],kids:[]},
    'safety.html':{own:['ss_lead','ss_alead'],kids:[]}, 'ancillary.html':{own:['an_lead','an_alead'],kids:[]},
    'maintenance.html':{own:['mt_lead','mt_alead','mt_team'],kids:['an_lead','an_alead']}, 'cooking.html':{own:['ck_lead','ck_alead','ck_team'],kids:['an_lead','an_alead']},
    'cleaning.html':{own:['cl_lead','cl_alead','cl_team'],kids:['an_lead','an_alead']} };
  const TOP=['owner','developer','director','deputy_director','phmu_lead'];
  for(const [f,def] of Object.entries(PAGES)){
    const p=await open(f,{width:1300,height:800});
    const r=await p.evaluate(roles=>Object.fromEntries(roles.map(x=>{ render([x]); return [x,!document.getElementById('stOk').classList.contains('hide')]; })),ROLES);
    const bad=ROLES.filter(x=>{ const allowed=TOP.includes(x)||def.own.includes(x)||def.kids.includes(x); return r[x]!==allowed; });
    // the roles above that are the page's own: ensure at least the intended ones exist in ROLES list
    chk(bad.length===0,'access  '+f+' opens only for its own roles, its division head and leadership',bad.join()||'ok');
    await p.context().close(); }
}

// ── Management menu: Rapid Link, Data Management, Admin / Volunteer Logins ──
{ const p=await open('index.html',{width:1300,height:900});
  const r=await p.evaluate(async()=>{ const o={};
    const mgmt=async pm=>{ CU={user:'x',display:'X',perms:pm,uid:'u'}; COVER_TEAMS.clear(); applyNavVisibility(); await new Promise(r=>setTimeout(r,450));
      const g=[...document.querySelectorAll('#topnav .tn-group')].find(x=>/Management/.test(x.querySelector('.tn-b').textContent));
      return g?[...g.querySelectorAll('.tn-menu .tn-b')].map(b=>{ const c=b.cloneNode(true); c.querySelectorAll('[style*="display: none"]').forEach(x=>x.remove()); return c.textContent.replace(/^[^A-Za-z]+/,'').replace(/\s+/g,' ').replace(/\d+$/,'').trim(); }):[]; };
    o.dev=await mgmt(['developer']); o.owner=await mgmt(['owner']); o.tl=await mgmt(['tl_a']); o.atl=await mgmt(['ytl_b']); o.fac=await mgmt(['facilitator']); o.vol=await mgmt(['team_a']); o.an=await mgmt(['an_alead']);
    CU={user:'x',display:'X',perms:['tl_a'],uid:'u'}; nav('submit'); o.tlActive=document.getElementById('page-submit').classList.contains('active'); o.toast=(document.querySelector('.toast')||{}).innerText||'';
    CU={user:'x',display:'X',perms:['developer'],uid:'u'}; nav('submit'); o.devActive=document.getElementById('page-submit').classList.contains('active');
    CU={user:'x',display:'X',perms:['facilitator'],uid:'u'}; PROFILES=[{id:'a',email:'a@x',display:'Lead One',perms:['tl_a']},{id:'b',email:'b@x',display:'Vol One',perms:['team_a']},{id:'c',email:'c@x',display:'New Person',perms:[]}];
    renderUserList(); o.adminRows=[...document.querySelectorAll('#umList .um-name')].map(e=>e.innerText).join(); o.profilesKept=PROFILES.length;
    o.age=[ageFromDob('2000-01-01')>=25, groupForAge(11), groupForAge(12), groupForAge(17), groupForAge(18)].join();
    return o; });
  chk((['Rapid Link','Data Management','Admin Logins','Volunteer Logins'].every(x=>r.dev.includes(x))&&!r.dev.includes('Invitations')&&!r.dev.includes('Duty Stats')&&!r.dev.includes('Rapid Link ⚠ Soon')),'mgmt    a developer sees Rapid Link (no warning tag), Data Management and both logins pages, no Invitations or Duty Stats',r.dev.join('|'));
  chk(['Rapid Link','Data Management','Admin Logins','Volunteer Logins'].every(x=>r.owner.includes(x))&&!r.owner.includes('Invitations')&&!r.owner.includes('Duty Stats'),'mgmt    the owner has the same list',r.owner.join('|'));
  chk(r.tl.join()==='Rapid Link ⚠ Soon'&&r.atl.join()==='Rapid Link ⚠ Soon'&&r.an.join()==='Rapid Link ⚠ Soon','mgmt    assistant leads and above see only Rapid Link, with a warning tag',r.tl.join('|')+' / '+r.an.join('|'));
  chk(/⚠/.test(await p.evaluate(()=>{CU={user:'x',display:'X',perms:['tl_a'],uid:'u'};applyNavVisibility();return document.getElementById('navSubmit').innerText;})),'mgmt    the warning tag shows beside Rapid Link for them');
  chk(r.tlActive===false&&/Under Development/.test(r.toast),'mgmt    clicking Rapid Link as a lead says Under Development and goes nowhere',r.toast);
  chk(r.devActive===true,'mgmt    a developer can open Rapid Link');
  chk(r.fac.includes('Data Management')&&r.fac.includes('Admin Logins')&&r.fac.includes('Volunteer Logins'),'mgmt    a facilitator manages data and both logins pages',r.fac.join('|'));
  chk(r.vol.length===0,'mgmt    a plain volunteer sees no Management menu');
  chk(r.adminRows==='Lead One,New Person'&&r.profilesKept===3,'mgmt    Admin Logins lists everyone above volunteer plus new accounts, not volunteers',r.adminRows);
  chk(r.age==='true,child,youth,youth,adult','mgmt    age comes from date of birth and sets child, youth or adult',r.age);
  chk(p.errs.length===0,'mgmt    no page errors'); await p.context().close(); }
{ const p=await open('index.html',{width:1000,height:900});
  const r=await p.evaluate(async()=>{ const o={}; let sent=null;
    CU={user:'x',display:'X',perms:['facilitator'],uid:'u'};
    const rows=[{id:1,name:'Aly Kotadia',rank:'Member',status:'active',team:'A',spec:[],gender:'Male',dob:'2010-05-05',phone:null,email:null},{id:2,name:'Team Lead Person',rank:'Team Leader',status:'active',team:'A',spec:[]},{id:3,name:'Zahra Ali',rank:'Member',status:'active',team:null,spec:['COOKING'],gender:'Female',dob:null,phone:null,email:null}];
    const q=(t,data)=>({select(){return q(t,data)},order(){return q(t,data)},update(patch){ sent=patch; return {eq(){return {select:async()=>({data:[{id:1}],error:null})}}}},then(f,r){return Promise.resolve({data,error:null}).then(f,r)}});
    sb={from:t=>t==='iv_members'?q(t,rows):q(t,[{id:'p1',email:'a@x',member_id:1,perms:['team_a']}])};
    await loadVLogins();
    o.names=[...document.querySelectorAll('#vlList .um-name')].map(e=>e.innerText).join();
    o.meta=document.querySelector('#vlList .um-meta').innerText;
    VL.filter='nologin'; renderVLogins(); o.nologin=[...document.querySelectorAll('#vlList .um-name')].map(e=>e.innerText).join();
    VL.filter='all'; vlEdit(1); const box=document.getElementById('vl-1');
    box.querySelector('[data-vf="dob"]').value='2005-03-03'; box.querySelector('[data-vf="phone"]').value='021 555 1234'; box.querySelector('[data-vf="email"]').value='aly@example.com';
    await vlSave(1); o.sent=sent;
    return o; });
  chk(r.names==='Aly Kotadia,Zahra Ali','volunteer logins list volunteers only (not leads)',r.names);
  chk(/Team A/.test(r.meta)&&/Has a login/.test(r.meta),'volunteer logins show team and login status',r.meta);
  chk(r.nologin==='Zahra Ali','volunteer logins "No login yet" filter works');
  chk(r.sent&&r.sent.phone==='021 555 1234'&&r.sent.email==='aly@example.com'&&r.sent.dob==='2005-03-03'&&r.sent.age_group==='adult','volunteer logins save DOB, phone and email, and set the age group',JSON.stringify(r.sent));
  chk(p.errs.length===0,'volunteer logins no page errors'); await p.context().close(); }

// ── Safety & Security roster ──
{ const p=await open('safety.html',{width:1200,height:900});
  const r=await p.evaluate(async()=>{ const o={};
    const dates=[]; for(let d=1;d<=31;d++) dates.push('2026-10-'+String(d).padStart(2,'0'));
    const pool=['Ana','Ben','Cy','Dee','Eli','Fay'].map((n,i)=>({id:i+1,name:n,away:n==='Ben'?['2026-10-05']:[]}));
    const avail={2:['Mon','Tue','Wed','Thu','Fri','Sun'], 3:['Sat','Sun']};   // Ben not Saturdays; Cy weekends only
    const head={}; DAYS.forEach(d=>head[d]=2);
    const plan=planMonth(dates,{},pool,avail,head);
    o.days=Object.keys(plan).length; o.sizes=[...new Set(Object.values(plan).map(x=>x.length))].join();
    o.dupes=Object.values(plan).filter(x=>new Set(x).size!==x.length).length;
    const cnt={}; Object.values(plan).forEach(x=>x.forEach(n=>cnt[n]=(cnt[n]||0)+1));
    o.benSat=dates.filter(d=>dowName(dateOf(d))==='Sat'&&plan[d].includes('Ben')).length;
    o.cyWeekday=dates.filter(d=>!['Sat','Sun'].includes(dowName(dateOf(d)))&&plan[d].includes('Cy')).length;
    o.benAway=plan['2026-10-05'].includes('Ben');
    o.spread=Math.max(...Object.values(cnt))-Math.min(...Object.values(cnt));
    const locked={'2026-10-06':{people:['Fay','Eli'],manual:true}};
    const plan2=planMonth(dates,locked,pool,avail,head);
    o.lockedKept=!('2026-10-06' in plan2);
    const solo=planMonth(['2026-10-07'],{},[{id:1,name:'Ana',away:[]}],{},{Wed:3}); o.short=solo['2026-10-07'].length;
    return o; });
  chk(r.days===31&&r.sizes==='2'&&r.dupes===0,'safety  auto-fill puts two people on every day, nobody twice',JSON.stringify({d:r.days,s:r.sizes,x:r.dupes}));
  chk(r.benSat===0&&r.cyWeekday===0&&r.benAway===false,'safety  it respects weekday availability and away dates');
  chk(r.lockedKept===true,'safety  a day locked by hand is left alone');
  chk(r.short===1,'safety  a short pool gives a short day, not a crash');
  chk(r.spread<=3,'safety  duty is spread fairly across the pool',String(r.spread));
  chk(p.errs.length===0,'safety  no page errors'); await p.context().close(); }
{ const p=await open('safety.html',{width:1200,height:900});
  const r=await p.evaluate(async()=>{ const o={};
    const rows={}; let upserts=[], refuse=false;
    sb={from:t=>({upsert:(rws)=>({select:async()=>{ upserts.push([t,rws]); return refuse?{data:[],error:null}:{data:Array.isArray(rws)?rws:[rws],error:null}; }}),
                  delete:()=>({eq:()=>({select:async()=>({data:[{}],error:null})})})})};
    S.pool=[{id:1,name:'Ana',away:[]},{id:2,name:'Ben',away:[]}];
    render(['ss_lead']); S.y=2026; S.m=9; S.head={Mon:2,Tue:2,Wed:2,Thu:2,Fri:2,Sat:2,Sun:2};
    renderCal(); o.cells=document.querySelectorAll('#cal .cell').length;
    await saveDay('2026-10-07',['Ana']); o.saved=upserts.length&&upserts[0][1][0].data.manual===true&&S.roster['2026-10-07'].people.join()==='Ana';
    const cell=document.querySelector('#cal .cell[data-ds="2026-10-07"]'); o.cell=cell.innerText.replace(/\s+/g,' ')+'|'+cell.className;
    refuse=true; await saveDay('2026-10-08',['Ben']); o.refused=!S.roster['2026-10-08']&&/refused/.test(document.getElementById('toastHost').innerText);
    refuse=false; await autoFill(); o.autoRows=upserts[upserts.length-1][1].length;
    // volunteer view
    render(['ss_team']); S.me={name:'Ana'}; S.roster={}; const d=new Date(); d.setDate(d.getDate()+3); const ds=ymd(d); S.roster[ds]={people:['Ana','Ben']}; renderMine();
    o.mine=document.getElementById('myList').innerText.replace(/\s+/g,' '); o.volMgr=document.getElementById('mgrView').classList.contains('hide'); o.volMem=!document.getElementById('memView').classList.contains('hide');
    return o; });
  chk(r.cells%7===0&&r.cells>=28,'safety  the month grid is whole weeks',String(r.cells));
  chk(r.saved===true&&/Ana/.test(r.cell)&&/1\/2/.test(r.cell),'safety  adding a person locks and saves the day',r.cell);
  chk(r.refused===true,'safety  a save the database refuses is reported and not shown as saved');
  chk(r.autoRows>=28,'safety  auto-fill saves a row per unlocked day',String(r.autoRows));
  chk(/With Ben/.test(r.mine)&&r.volMgr&&r.volMem,'safety  a volunteer sees only their own duties',r.mine);
  chk(p.errs.length===0,'safety  roster no page errors'); await p.context().close(); }
{ const p=await open('av.html',{width:1200,height:900});
  const r=await p.evaluate(()=>{ const T=todayDS(); const d=new Date(T+'T12:00'); d.setDate(d.getDate()+2); const ds=localDS(d);
    _mdIV={t:Date.now(),events:[],rosters:{},members:[],notes:[],safety:[{date:ds,data:{people:['Ana Ali','Ben Khan'],manual:false}}]};
    roster={}; trainings=[]; majalisEvs=[]; _md={name:'Ana Ali',range:3,past:false,items:[],notes:[]};
    const items=mdCollect('Ana Ali',mdWindow()); return {n:items.length, t:items[0]&&items[0].title, div:items[0]&&items[0].div, label:mdDivLabel('SS'), sub:items[0]&&items[0].subs.join()}; });
  chk(r.n===1&&r.div==='SS'&&/Safety/.test(r.t)&&r.label==='Safety'&&/Ben Khan/.test(r.sub),'safety  duties show in My Duties with the others on the day',JSON.stringify(r));
  chk(p.errs.length===0,'safety  my duties no page errors'); await p.context().close(); }

// ── Under Construction tags ──
{ const p=await open('index.html',{width:1300,height:900});
  const r=await p.evaluate(async()=>{ const o={};
    const tagged=async pm=>{ CU={user:'x',display:'X',perms:pm,uid:'u'}; applyNavVisibility(); await new Promise(r=>setTimeout(r,450));
      return [...document.querySelectorAll('.sb-nav .nav-wrap a.nav-item')].map(a=>({n:a.innerText.replace(/\s*⚠ Soon/,'').replace(/^[^A-Za-z]+/,'').trim(), tag:!!a.querySelector('.ntag[data-tip="UNDER CONSTRUCTION"]')})); };
    o.dir=await tagged(['director']);
    o.bar=(()=>{ const g=[...document.querySelectorAll('#topnav .tn-b')].filter(b=>/Cooking/.test(b.innerText)||/Safety/.test(b.innerText)); return g.map(b=>({n:b.innerText.replace(/\s+/g,' ').trim(), tag:!!b.querySelector('.ntag[data-tip]')})); })();
    CU={user:'x',display:'X',perms:['an_lead'],uid:'u'}; renderQuickAccess(); o.tiles=[...document.querySelectorAll('#quickPanel .qa-tile')].filter(t=>t.tagName==='A').map(t=>({n:t.innerText.replace(/\s+/g,' ').replace('⚠','').trim(), tag:!!t.querySelector('.qa-wip[data-tip="UNDER CONSTRUCTION"]')}));
    CU={user:'x',display:'X',perms:['ss_lead'],uid:'u'}; renderQuickAccess(); o.ss=[...document.querySelectorAll('#quickPanel .qa-tile')].filter(t=>t.tagName==='A').map(t=>t.querySelector('.qa-wip')?'tag':'clean').join();
    o.css=getComputedStyle(document.querySelector('.ntag[data-tip]'),'::after').content;
    return o; });
  const by=n=>r.dir.find(x=>x.n===n)||{};
  chk(['Paat Team','Abeshafa Paat Group','Sukreet Paat Group','Training & Development','Overview','Maintenance','Cooking Team','Cleaning Volunteers'].every(n=>by(n).tag===true),'tags    every page still under construction carries the warning tag',JSON.stringify(r.dir.filter(x=>!x.tag).map(x=>x.n)));
  chk(by('Safety & Security').tag===false&&r.dir.some(x=>x.n==='Safety & Security'),'tags    Safety & Security, which is built, has none');
  chk(r.bar.some(x=>/Cooking/.test(x.n)&&x.tag),'tags    the laptop bar shows them too',JSON.stringify(r.bar));
  chk(r.tiles.length===4&&r.tiles.every(t=>t.tag),'tags    Quick access tiles for those pages carry the tag',JSON.stringify(r.tiles));
  chk(/^"?UNDER CONSTRUCTION"?$/.test(r.css),'tags    hovering shows UNDER CONSTRUCTION',r.css);
  chk(r.ss==='clean'||r.ss==='clean,clean','tags    Safety & Security\'s own tile is clean',r.ss);
  chk(p.errs.length===0,'tags    no page errors'); await p.context().close(); }

// ── Opening animations ──
for(const [file,key,words] of [['index.html','hub',/YA ALI|Ya Ali/i],['teama.html','A',/Welcome to[\s\S]*Team\s*A/i],['teamb.html','B',/Welcome to[\s\S]*Team\s*B/i],['av.html','AV',/Welcome to[\s\S]*AV\s*Team/i]]){
  const p=await open(file,{width:1200,height:800});
  const r=await p.evaluate(async key=>{ const o={};
    o.automated=(()=>{ ivSplashReset(); ivSplash(key); return !document.getElementById('ivs'); })();   // tests are skipped by default
    window.__ivsForce=true; ivSplashReset(); ivSplash(key);
    const el=document.getElementById('ivs'); o.shown=!!el; o.text=el?el.innerText.replace(/\s+/g,' '):'';
    o.acc=el?getComputedStyle(el).getPropertyValue('--acc').trim():''; o.skip=!!(el&&el.querySelector('.ivs-skip'));
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await new Promise(r=>setTimeout(r,350));
    o.closed=!document.getElementById('ivs');
    ivSplash(key); o.noReplay=!document.getElementById('ivs');     // not twice in one load
    o.replaysAfterReset=(()=>{ ivSplashReset(); ivSplash(key); return !!document.getElementById('ivs'); })();   // a fresh load plays it again document.getElementById('ivs')&&document.getElementById('ivs').remove();
    return o; }, key);
  chk(r.automated===true,'opening '+file+' is skipped for automated browsers');
  chk(r.shown&&words.test(r.text),'opening '+file+' says the right words',r.text);
  chk(r.skip&&r.closed,'opening '+file+' can be skipped with Esc');
  chk(r.noReplay&&r.replaysAfterReset,'opening '+file+' plays every time the page opens (once per load)');
  if(key!=='hub') chk(/#(34D399|F472B6|4FC3F7)/i.test(r.acc)||/rgb/.test(r.acc)||r.acc.length>0,'opening '+file+' has its team accent',r.acc);
  chk(p.errs.length===0,'opening '+file+' no page errors'); await p.context().close(); }

// ── My Duties name suggestions (Hub) ──
{ const p=await open('index.html',{width:1100,height:900});
  const r=await p.evaluate(async()=>{ const o={};
    CU={user:'x',display:'Sam Lead',perms:['team_a'],uid:'u'}; sb=null; _mdNames=null;
    dutyCache={entries:['Aly Kotadia','Aly Khan','Zahra Ali','Ben Noor'].map(n=>({person:n,date:'2026-12-01',source:'IV',title:'x'})),warns:[]};
    let searched=null; window.runDutySearch=async function(){ searched=document.getElementById('mdName').value; };
    document.getElementById('app').style.display='block'; nav('myduties'); const input=document.getElementById('mdName');
    input.value=''; input.dispatchEvent(new Event('focus')); await new Promise(r=>setTimeout(r,200));
    o.all=[...document.querySelectorAll('#mdSug .md-sug-i')].map(e=>e.innerText).join('|'); o.open=document.getElementById('mdSug').classList.contains('open'); o.expanded=input.getAttribute('aria-expanded');
    input.value='aly'; input.dispatchEvent(new Event('input')); await new Promise(r=>setTimeout(r,200));
    o.filtered=[...document.querySelectorAll('#mdSug .md-sug-i')].map(e=>e.innerText).join('|'); o.mark=document.querySelector('#mdSug mark')&&document.querySelector('#mdSug mark').innerText;
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})); input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
    o.sel=((document.querySelector('#mdSug .md-sug-i.sel')||{}).innerText||'').replace(/\s+/g,' ').trim();
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})); await new Promise(r=>setTimeout(r,100));
    o.picked=input.value; o.searched=searched; o.closed=!document.getElementById('mdSug').classList.contains('open');
    input.value='zzz'; input.dispatchEvent(new Event('input')); await new Promise(r=>setTimeout(r,200)); o.none=document.getElementById('mdSug').innerText;
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); o.esc=!document.getElementById('mdSug').classList.contains('open');
    input.value='ben'; input.dispatchEvent(new Event('input')); await new Promise(r=>setTimeout(r,200)); searched=null; o.height=Math.round(document.querySelector('#mdSug .md-sug-i').getBoundingClientRect().height);
    document.querySelector('#mdSug .md-sug-i').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true})); await new Promise(r=>setTimeout(r,50)); o.clicked=searched;
    return o; });
  chk(r.open&&r.expanded==='true'&&/Aly Kotadia/.test(r.all)&&/Zahra Ali/.test(r.all)&&/Sam Lead/.test(r.all),'dropdown My Duties lists every name when the box is focused',r.all);
  chk(r.filtered==='Aly Khan|Aly Kotadia'&&r.mark==='aly'.replace('a','A')||r.mark==='Aly','dropdown typing narrows the list and highlights the match',r.filtered+' / '+r.mark);
  chk(r.sel==='Aly Kotadia'&&r.picked==='Aly Kotadia'&&r.searched==='Aly Kotadia'&&r.closed,'dropdown arrow keys and Enter pick a name and search straight away',r.sel+' → '+r.picked);
  chk(/No matching names/.test(r.none)&&r.esc,'dropdown says so when nothing matches, and Esc closes it');
  chk(r.clicked==='Ben Noor','dropdown clicking a name searches for it',r.clicked);
  chk(r.height>=40,'dropdown rows are a comfortable tap size',String(r.height));
  chk(p.errs.length===0,'dropdown no page errors'); await p.context().close(); }

// saving: the payload must carry the event's date (the column is NOT NULL)
{ const p=await open('teama.html',{width:1300,height:900});
  const r=await p.evaluate(`(async()=>{ await (${SEED})(['tl_a']); let sent=null;
    sb={from:t=>({upsert:async row=>{ if(t==='iv_roster') sent=row; return {error:null}; },
      select:()=>({eq:async()=>({data:[{event_id:1,data:ROSTERS[1]}],error:null})})})};
    DB_MISSING=false; await saveRoster(1,{quiet:true}); return {sent, date:EVENTS[0].date}; })()`);
  chk(r.sent&&r.sent.date===r.date&&r.sent.event_id===1,'save    the roster is saved with its event date',r.sent?String(r.sent.date):'nothing sent');
  await p.context().close(); }

// ── My Duties: save as image ──
{ const p=await open('index.html',{width:1200,height:850});
  const r=await p.evaluate(async()=>{ const o={};
    const E=(d,duty,team)=>({date:d,duty,event:'Friday Majlis',team,uniform:'Casual',person:'Test Person',source:team});
    window.fetchDutyData=async()=>({warns:[],entries:[E('2026-10-24','Sound','AV'),E('2026-10-31','Door','A'),E('2026-11-07','Tea','B')]});
    document.getElementById('mdName').value='Test Person'; await runDutySearch();
    o.btn=!!document.getElementById('mdShotBtn'); o.months=document.querySelectorAll('.md-month').length; o.edges=document.querySelectorAll('.dcard.t-av,.dcard.t-a,.dcard.t-b').length;
    const rows=mdShotData&&mdShotData.rows;
    for(const f of ['phone','laptop']){ const cv=await mdDrawCard('Test Person',rows,f); o[f]=cv.width+'x'+cv.height; const blob=await new Promise(r=>cv.toBlob(r,'image/png')); o[f+'Png']=!!blob&&blob.size>5000; }
    document.getElementById('mdName').value='Zzzz Nobody'; await runDutySearch(); o.clearedBtn=!document.getElementById('mdShotBtn')&&mdShotData===null;
    return o; });
  chk(r.btn,'duties  a single person gets a Save as image button',JSON.stringify(r));
  chk(r.months===2&&r.edges===3,'duties  results are grouped by month with team colour edges',JSON.stringify(r));
  chk(/^1080x/.test(r.phone)&&/^1600x/.test(r.laptop),'duties  phone card is 1080 wide, laptop card 1600 wide',r.phone+' '+r.laptop);
  chk(r.phonePng&&r.laptopPng,'duties  both cards export as real PNG images');
  chk(r.clearedBtn,'duties  no button when nothing is found');
  chk(p.errs.length===0,'duties  no page errors'); await p.context().close(); }

await b.close(); srv.close();
console.log('\n'+'='.repeat(64)); pass.forEach(x=>console.log('  PASS  '+x)); fail.forEach(x=>console.log('  FAIL  '+x));
console.log('='.repeat(64)); console.log(pass.length+' passed, '+fail.length+' failed'); process.exit(fail.length?1:0);
})().catch(e=>{console.error('SUITE CRASHED',e&&e.stack||e);process.exit(1);});
