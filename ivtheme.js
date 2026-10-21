/* IV Hub theme switch. Looks only: it sets data-theme on <html> and adds one
   floating button. Nothing here touches data, roles or page logic.
   Loaded in <head> so the saved choice is applied before the first paint. */
(function(){
  var KEY='iv_theme', root=document.documentElement;
  function saved(){ try{ return localStorage.getItem(KEY); }catch(e){ return null; } }
  function put(v){ try{ localStorage.setItem(KEY,v); }catch(e){} }
  function apply(v){
    root.setAttribute('data-theme',v);
    var m=document.querySelector('meta[name=theme-color]');
    if(m) m.setAttribute('content', v==='light' ? '#F3F6FB' : '#050B16');
    var b=document.getElementById('ivThemeBtn');
    if(b){
      b.setAttribute('aria-label', v==='light' ? 'Switch to dark mode' : 'Switch to light mode');
      b.setAttribute('title', v==='light' ? 'Dark mode' : 'Light mode');
      b.innerHTML = v==='light' ? MOON : SUN;
    }
  }
  var SUN='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>';
  apply(saved()==='light' ? 'light' : 'dark');
  /* Secondary colour by page. Hub and unlisted pages get none; pages still waiting for a colour keep the old pink. */
  (function(){
    var f=(location.pathname.split('/').pop()||'index.html').replace(/\.html$/,'').toLowerCase();
    var T={teama:'teal',safety:'amber',abeshafa:'green',ancillary:'green',cleaning:'green',cooking:'green',maintenance:'green',paat:'green',sukreet:'green',training:'green',teamb:'pending',av:'pending',setup:'pending'};
    if(T[f]) root.setAttribute('data-team',T[f]);
    /* Name shown on the welcome card: set as a CSS variable so every hero can print it */
    var N={teama:'Team A',teamb:'Team B',av:'AV Team',safety:'Safety & Security'};
    var nm=N[f]||(document.title||'').split(/\s+[\u2014-]\s+/)[0].trim();
    if(T[f]&&nm) root.style.setProperty('--iv-team-name','"'+nm.replace(/["\\]/g,'')+'"');
    window.IV_TEAM_NAME=nm;
    /* Brand mark as the tab icon on every page */
    try{
      var old=document.querySelectorAll('link[rel~="icon"]'); for(var i=0;i<old.length;i++) old[i].parentNode.removeChild(old[i]);
      var l=document.createElement('link'); l.rel='icon'; l.type='image/png'; l.href='logo.png'; document.head.appendChild(l);
    }catch(e){}
  })();
  function mount(){
    if(document.getElementById('ivThemeBtn')) return;
    var b=document.createElement('button');
    b.id='ivThemeBtn'; b.type='button'; b.className='iv-theme-btn';
    b.setAttribute('data-html2canvas-ignore','true');
    b.addEventListener('click',function(){
      var next = root.getAttribute('data-theme')==='light' ? 'dark' : 'light';
      put(next); apply(next);
      try{ document.dispatchEvent(new CustomEvent('ivthemechange',{detail:next})); }catch(e){}
    });
    document.body.appendChild(b);
    apply(root.getAttribute('data-theme'));
  }
  /* Pages without a welcome card of their own (Safety, division pages) get one at the top of their signed-in view. */
  function welcome(){
    var ok=document.getElementById('stOk');
    if(!ok||document.querySelector('.hero,.dash-hero,.iv-welcome')||!root.getAttribute('data-team')) return;
    var d=''; try{ d=new Date().toLocaleDateString('en-NZ',{weekday:'long',day:'numeric',month:'long',timeZone:'Pacific/Auckland'}); }catch(e){}
    var w=document.createElement('div'); w.className='iv-welcome';
    w.innerHTML='<div class="iv-w-t"><div class="iv-w-team"></div><div class="iv-w-greet">Ya Ali Madad</div><div class="iv-w-date"></div></div>'+
      '<img class="iv-w-logo" src="logo.png" alt="Ismaili Volunteers">';
    w.querySelector('.iv-w-team').textContent=window.IV_TEAM_NAME||'';
    w.querySelector('.iv-w-date').textContent=d+(d?' \u00b7 ':'')+'Auckland Jamatkhana';
    ok.insertBefore(w,ok.firstChild);
  }
  /* The side logo is the way to the dashboard, so the Dashboard menu item is hidden (CSS) and this takes its click. */
  function homeLogo(){
    var home=document.querySelector('.sb-nav .nav-item[data-page="dashboard"]'); if(!home) return;
    var go=function(){ home.click(); };
    document.querySelectorAll('.sb-logo').forEach(function(l){
      if(l.getAttribute('data-iv-home')) return; l.setAttribute('data-iv-home','1');
      l.setAttribute('role','button'); l.setAttribute('tabindex','0'); l.setAttribute('title','Go to the dashboard');
      l.addEventListener('click',go);
      l.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go(); } });
    });
  }
  /* Page changes: the seal lifts off the pressed button and grows into the loading screen's seal,
     while the screen opens out from that spot. The real page change follows a beat later. */
  var press=null;
  function rememberPress(el,x,y){
    var t=el&&el.closest&&el.closest('a,button,[role=button],.sb-logo,.tn-brand,.nav-item');
    press={el:t||el,x:x,y:y};
  }
  document.addEventListener('pointerdown',function(e){ rememberPress(e.target,e.clientX,e.clientY); },true);
  document.addEventListener('keydown',function(e){
    if(e.key==='Enter'||e.key===' '){ var t=e.target&&e.target.getBoundingClientRect&&e.target.getBoundingClientRect(); if(t) rememberPress(e.target,t.left+t.width/2,t.top+t.height/2); }
  },true);
  function growVeil(){
    var go=window.ivGo; if(typeof go!=='function'||go.ivGrown) return;
    var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    var w=function(){
      var args=arguments, self=this, v=document.getElementById('ivVeil');
      if(!v||reduce) return go.apply(self,args);
      var p=press||{x:window.innerWidth/2,y:window.innerHeight/2};
      var target=v.querySelector('.iv-logo'), tr=target&&target.getBoundingClientRect();
      if(!tr||!tr.width) return go.apply(self,args);
      /* where the flying seal starts: the logo image if the press was on one, else a seal-sized spot on the button */
      var img=p.el&&p.el.querySelector&&p.el.querySelector('img');
      var sr=(img&&img.getBoundingClientRect().width)?img.getBoundingClientRect():(p.el&&p.el.tagName==='IMG'?p.el.getBoundingClientRect():null);
      var sx=sr?sr.left+sr.width/2:p.x, sy=sr?sr.top+sr.height/2:p.y, ss=sr?Math.max(sr.width,28):44;
      if(p.el&&!sr&&p.el.getBoundingClientRect){ var br=p.el.getBoundingClientRect(); if(br.width){ sx=br.left+br.width/2; sy=br.top+br.height/2; } }
      v.style.setProperty('--ox',sx+'px'); v.style.setProperty('--oy',sy+'px');
      v.classList.add('iv-grow');
      var fly=document.createElement('div'); fly.className='iv-fly'; fly.setAttribute('aria-hidden','true');
      fly.style.cssText='position:fixed;z-index:5001;left:'+tr.left+'px;top:'+tr.top+'px;width:'+tr.width+'px;height:'+tr.height+'px;border-radius:50%;background:#fff;overflow:hidden;pointer-events:none;'+
        'box-shadow:0 0 0 5px rgba(255,255,255,.08),0 18px 50px rgba(0,20,50,.7),0 0 46px rgba(75,163,220,.35);';
      fly.innerHTML='<img src="logo.png" alt="" style="width:100%;height:100%;object-fit:contain;display:block">';
      document.body.appendChild(fly);
      var s=ss/tr.width, dx=sx-(tr.left+tr.width/2), dy=sy-(tr.top+tr.height/2);
      try{ fly.animate([{transform:'translate('+dx+'px,'+dy+'px) scale('+s+')'},{transform:'none'}],{duration:440,easing:'cubic-bezier(.2,.8,.2,1)',fill:'both'}); }catch(e){}
      setTimeout(function(){ go.apply(self,args); },160);
    };
    w.ivGrown=true; window.ivGo=w;
    window.addEventListener('pageshow',function(e){
      if(!e.persisted) return;
      var v=document.getElementById('ivVeil'); if(v) v.classList.remove('iv-grow');
      document.querySelectorAll('.iv-fly').forEach(function(n){ n.remove(); });
    });
  }
  function boot(){ mount(); welcome(); homeLogo(); growVeil(); }
  if(document.body) boot(); else document.addEventListener('DOMContentLoaded',boot);
})();
