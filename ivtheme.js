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
    var T={teama:'mint',safety:'amber',abeshafa:'green',ancillary:'green',cleaning:'green',cooking:'green',maintenance:'green',paat:'green',sukreet:'green',training:'green',teamb:'coral',av:'cobalt',setup:'pending'};
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
  /* Page changes: the pressed button itself grows, keeping its shape and colour, until it fills the screen and
     turns into the dark welcome backdrop. The next page then opens straight into the welcome animation
     (Ya Ali Madad), which lifts to load it in. */
  var press=null;
  function rememberPress(el,x,y){
    var t=el&&el.closest&&el.closest('a,button,[role=button],.sb-logo,.tn-brand,.nav-item');
    press={el:t||el,x:x,y:y};
  }
  document.addEventListener('pointerdown',function(e){ rememberPress(e.target,e.clientX,e.clientY); },true);
  document.addEventListener('keydown',function(e){
    if(e.key==='Enter'||e.key===' '){ var t=e.target&&e.target.getBoundingClientRect&&e.target.getBoundingClientRect(); if(t) rememberPress(e.target,t.left+t.width/2,t.top+t.height/2); }
  },true);
  var flies=[];
  function resetGrow(){
    flies.forEach(function(n){ if(n.parentNode) n.parentNode.removeChild(n); }); flies=[];
    var v=document.getElementById('ivVeil'); if(v) v.classList.remove('iv-show');
  }
  function px(v,w,h){ v=String(v||'0'); var n=parseFloat(v)||0; return /%$/.test(v)?Math.min(w,h)*n/100:n; }
  function growVeil(){
    var go=window.ivGo; if(typeof go!=='function'||go.ivGrown) return;
    var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    var busy=false;
    var DARK=root.getAttribute('data-theme')==='light'?'rgb(243, 247, 251)':'rgb(2, 11, 24)';
    var w=function(){
      var args=arguments, self=this, v=document.getElementById('ivVeil');
      if(!v||reduce||busy||!document.body.animate) return go.apply(self,args);
      busy=true;
      var p=press||{x:window.innerWidth/2,y:window.innerHeight/2}, el=p.el&&p.el.getBoundingClientRect?p.el:null;
      var r=el?el.getBoundingClientRect():null;
      if(!r||!r.width){ r={left:p.x-40,top:p.y-22,width:80,height:44,right:p.x+40,bottom:p.y+22}; el=null; }
      var cs=el?getComputedStyle(el):null, W=r.width, H=r.height;
      var rad=cs?[cs.borderTopLeftRadius,cs.borderTopRightRadius,cs.borderBottomRightRadius,cs.borderBottomLeftRadius].map(function(x){ return Math.min(px(x,W,H),Math.min(W,H)/2); }):[12,12,12,12];
      var bg=cs&&cs.backgroundColor, clear=!bg||/rgba\(.*,\s*0\)$|transparent/.test(bg);
      if(clear){ bg=getComputedStyle(document.documentElement).getPropertyValue('--iv-ac').trim()||'#4BA3DC'; }
      var vw=window.innerWidth, vh=window.innerHeight;
      var start='inset('+r.top+'px '+(vw-r.right)+'px '+(vh-r.bottom)+'px '+r.left+'px round '+rad.map(function(x){return x+'px';}).join(' ')+')';
      var end='inset(0px 0px 0px 0px round 0px 0px 0px 0px)';
      var fly=document.createElement('div'); fly.setAttribute('aria-hidden','true');
      fly.style.cssText='position:fixed;inset:0;z-index:5001;pointer-events:none;background:'+bg+';clip-path:'+start+';';
      document.body.appendChild(fly); flies.push(fly);
      /* the button's own label, so it does not vanish the instant the shape starts to grow */
      var label=el&&(el.innerText||'').trim();
      if(cs&&label&&label.length<=32){
        var t=document.createElement('div'); t.textContent=label;
        t.style.cssText='position:fixed;z-index:5002;pointer-events:none;display:flex;align-items:center;justify-content:center;white-space:nowrap;left:'+r.left+'px;top:'+r.top+'px;width:'+W+'px;height:'+H+'px;font:'+cs.font+';color:'+cs.color+';letter-spacing:'+cs.letterSpacing+';';
        document.body.appendChild(t); flies.push(t);
        t.animate([{opacity:1},{opacity:0}],{duration:200,easing:'ease-out',fill:'forwards'});
      }
      var anim=fly.animate([
        {clipPath:start,backgroundColor:bg,offset:0},
        {backgroundColor:bg,offset:.35},
        {clipPath:end,backgroundColor:DARK,offset:1}
      ],{duration:600,easing:'cubic-bezier(.7,0,.2,1)',fill:'forwards'});
      var next=function(){ v.classList.add('iv-show'); setTimeout(function(){ go.apply(self,args); },60); };
      if(anim.finished&&anim.finished.then) anim.finished.then(next,next); else setTimeout(next,620);
    };
    w.ivGrown=true; window.ivGo=w;
    window.addEventListener('pageshow',function(e){ if(e.persisted){ busy=false; resetGrow(); } });
  }
  /* The dashboard banner: the opening welcome, held still, at the top of every dashboard (Hub, AV, Team A, Team B).
     Only the seal moves, on hover. The page's own greeting text is hidden by CSS but kept in the page, because its
     scripts still write the date, today's duty and the clock into it. */
  function banner(){
    var pg=document.getElementById('page-dashboard');
    if(!pg||pg.querySelector('.iv-banner')) return;
    var f=(location.pathname.split('/').pop()||'index.html').replace(/\.html$/,'').toLowerCase();
    var K={teama:'a',teamb:'b',av:'av',index:'hub'}; var k=K[f]; if(!k) return;
    var NM={a:'Team A',b:'Team B',av:'AV Team',hub:'Ya Ali Madad'}, MONO={a:'A',b:'B',av:'AV',hub:'IV'};
    var words=NM[k].split(' '), last=words.pop(), first=words.join(' ');
    var d=''; try{ d=new Date().toLocaleDateString('en-NZ',{weekday:'long',day:'numeric',month:'long',timeZone:'Pacific/Auckland'}); }catch(e){}
    var b=document.createElement('section'); b.className='iv-banner'; b.setAttribute('data-k',k); b.setAttribute('aria-label',NM[k]);
    b.innerHTML='<i class="ivb-hair" style="left:12.5%"></i><i class="ivb-hair" style="left:37.5%"></i><i class="ivb-hair" style="left:62.5%"></i><i class="ivb-hair" style="left:87.5%"></i>'+
      '<div class="ivb-mono" aria-hidden="true"></div><div class="ivb-glow"></div>'+
      '<div class="ivb-in">'+
        '<div class="ivb-seal" title="Ismaili Volunteers"><svg viewBox="0 0 176 176" aria-hidden="true"><circle cx="88" cy="88" r="79"/></svg><i class="ivb-arc"></i><img alt="Ismaili Volunteers seal" src="logo.png"></div>'+
        '<div class="ivb-kick"><i class="ivb-rule l"></i><i class="ivb-dia"></i><span></span><i class="ivb-dia"></i><i class="ivb-rule r"></i></div>'+
        '<div class="ivb-title"></div><div class="ivb-name"></div><div class="ivb-sub"></div>'+
      '</div>';
    b.querySelector('.ivb-mono').textContent=MONO[k];
    b.querySelector('.ivb-kick span').textContent=(k==='hub'?'Welcome':'Welcome to');
    var t=b.querySelector('.ivb-title');
    if(first){ t.appendChild(document.createTextNode(first+' ')); }
    var em=document.createElement('span'); em.textContent=last; t.appendChild(em);
    b.querySelector('.ivb-sub').textContent=(d?d+' \u00b7 ':'')+'Auckland Jamatkhana';
    pg.insertBefore(b,pg.firstChild);
    /* No box: the banner runs up to the very top of the site (behind the floating menu) and fades out sideways. */
    var fit=function(){
      var cur=parseFloat(b.getAttribute('data-pull')||'0')||0;
      var natural=Math.max(0,Math.round(b.getBoundingClientRect().top+(window.pageYOffset||0)+cur));
      if(String(natural)!==b.getAttribute('data-pull')){ b.setAttribute('data-pull',natural); b.style.setProperty('--ivb-top',natural+'px'); }
    };
    fit(); try{ if(window.ResizeObserver) new ResizeObserver(function(){ fit(); }).observe(b); }catch(e){}
    window.addEventListener('resize',function(){ clearTimeout(fit.t); fit.t=setTimeout(fit,120); });
    window.addEventListener('load',fit);
    /* the signed-in person's name, on the line under the title in smaller text; filled in once sign-in lands */
    var nameEl=b.querySelector('.ivb-name'), tries=0, iv=setInterval(function(){
      var cu=(typeof CU!=='undefined')?CU:window.CU, who=cu&&(cu.display||cu.user); tries++;
      if(who){ nameEl.textContent=String(who); clearInterval(iv); }
      else if(tries>60) clearInterval(iv);
    },500);
  }
  function boot(){ mount(); welcome(); homeLogo(); growVeil(); banner(); }
  if(document.body) boot(); else document.addEventListener('DOMContentLoaded',boot);
})();
