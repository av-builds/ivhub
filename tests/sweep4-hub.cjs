/* Hub fixes: startup does not wait on app_users, satada attendance read is paged,
   member delete warns about attendance marks, toggle names stay fixed.
   Standalone: node tests/sweep4-hub.cjs  (NODE_PATH=$(npm root -g)). PORT env optional, default a free port. */
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
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

/* Fake supabase-js: app_users never answers; getSession answers after 700ms. */
const STUB=`(()=>{
  const ok=d=>({data:d,error:null});
  const chain=(t)=>{ const st={t,f:[],rng:null,head:false};
    const c=new Proxy(function(){},{get:(_,k)=>{
      if(k==='then') return (res,rej)=>{ if(t==='app_users') return; return Promise.resolve(window.__resp(st)).then(res,rej); };
      if(k==='maybeSingle'||k==='single') return ()=>Promise.resolve(t==='profiles'?ok({id:'u1',username:'tester',display:'Tester',perms:['owner'],member_id:null}):ok(null));
      return (...a)=>{ if(k==='range') st.rng=a; if(k==='in'||k==='eq') st.f.push([k,...a]); if(k==='select'&&a[1]&&a[1].head) st.head=true; return c; }; },apply:()=>c}); return c; };
  window.__resp=st=>ok([]);
  window.__calls=[];
  window.supabase={createClient:()=>({
    auth:{getSession:()=>new Promise(r=>setTimeout(()=>r({data:{session:{user:{id:'u1',email:'t@x.nz'}}}}),700)),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};},signOut:async()=>({})},
    from:t=>{ window.__calls.push(t); return chain(t); },
    rpc:async()=>ok([]),channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel(){} })};
})();`;

(async()=>{
const srv=await serve(); const BASE='http://127.0.0.1:'+srv.address().port; const b=await chromium.launch({args:['--no-sandbox']});
const ctx=await b.newContext({viewport:{width:1300,height:950}}); const p=await ctx.newPage();
await ctx.route(u=>!String(u).startsWith(BASE),r=>r.abort());
p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message));
await p.addInitScript(STUB);
const t0=Date.now();
await p.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});

// 1. startup with app_users stalled
await p.waitForTimeout(300);
const early=await p.evaluate(()=>({box:getComputedStyle(document.querySelector('#loginScreen .lbox')).visibility,app:getComputedStyle(document.getElementById('app')).display}));
chk(early.box==='hidden'&&early.app==='none','while sign-in state is unknown the Sign In form is not shown',JSON.stringify(early));
await p.waitForFunction(()=>getComputedStyle(document.getElementById('app')).display!=='none',null,{timeout:2000}).then(()=>chk(true,'app shows within 2s although app_users never resolves ('+(Date.now()-t0)+'ms)'),()=>chk(false,'app shows within 2s although app_users never resolves'));
const late=await p.evaluate(()=>getComputedStyle(document.getElementById('loginScreen')).display);
chk(late==='none','Sign In screen is hidden for the signed-in user',late);

// 2. saReload pages attendance
const r2=await p.evaluate(async()=>{
  const evs=[]; for(let i=0;i<3;i++){ evs.push({id:100+i,date:'2026-12-0'+(6+i),type:'satada',name:'Satada',team:'A'}); }
  const att=[]; for(let i=0;i<1200;i++) att.push({event_id:100+(i%3),member_id:i,status:'present'});
  const ranges=[];
  window.__resp=st=>{
    if(st.t==='iv_events') return {data:evs,error:null};
    if(st.t==='iv_attendance'){ ranges.push(st.rng); const ids=(st.f.find(x=>x[0]==='in')||[])[2]||[]; let rows=att.filter(r=>ids.includes(r.event_id));
      const [a,z]=st.rng||[0,999]; return {data:rows.slice(a,z+1),error:null}; }
    return {data:[],error:null}; };
  const ok=await saReload();
  return {ok,att:SA.att,ranges:JSON.stringify(ranges),err:SA.err}; });
const tot=Object.values(r2.att||{}).reduce((a,n)=>a+n,0);
chk(r2.ok&&tot===1200&&r2.att[100]===400&&r2.att[101]===400&&r2.att[102]===400,'saReload counts all 1200 attendance rows (not 1000) across nights',JSON.stringify(r2));
chk(/\[0,999\],\[1000,1999\]/.test(r2.ranges),'attendance read pages with .range in 1000-row pages',r2.ranges);

// 3. deleteMember confirm text
const r3=await p.evaluate(async()=>{
  let msg=''; window.confirm=m=>{ msg=m; return false; };
  window.__resp=st=>st.head&&st.t==='iv_attendance'?{data:null,count:7,error:null}:{data:[],error:null};
  await deleteMember({id:5,name:'Test Person',team:'A'});
  const m1=msg;
  window.__resp=st=>st.head&&st.t==='iv_attendance'?{data:null,count:null,error:{message:'x'}}:{data:[],error:null};
  await deleteMember({id:5,name:'Test Person',team:'A'});
  return {m1,m2:msg}; });
chk(/7 attendance marks will be permanently deleted/.test(r3.m1)&&/They have left - revoke access/.test(r3.m1)&&/inactive/.test(r3.m1),'delete confirm states the attendance count and the keep-history options',r3.m1);
chk(!/attendance mark/.test(r3.m2)&&/cannot be undone/.test(r3.m2),'a failed count read does not block the confirm',r3.m2);

// 4. toggles keep a fixed name; aria-pressed carries state
const r4b=await p.evaluate(()=>{
  const src=String(saSet)+String(saRender); return /aria-label[^;]*(on|pressed|selected)\b/i.test(src); });
chk(!r4b,'satada team picker label does not carry state');
chk(p.errs.length===0,'no page errors',p.errs.join(' | '));
await b.close(); srv.close(); process.exit(bad?1:0);
})();
