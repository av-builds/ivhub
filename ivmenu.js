/* IV Hub menus as parallelograms.

   One small popup used everywhere a menu opens: the list under a dropdown field,
   the team switcher, the menu on a roster name. Each entry is a slanted block, all
   the same width, hanging from its trigger. Short lists step down one diagonal from
   the trigger's bottom left corner, as the Hub's top bar dropdowns do; long lists
   (which scroll) hang straight.

   Selects keep working exactly as they did: the real <select> stays in the page, its
   value, change events and form behaviour are untouched. Only the list that opens is
   ours. On touch screens the browser's own picker is kept, which is better under a
   thumb. */
(function(){
  'use strict';
  var SL=8.5, H=44, GAP=2, CASCADE_MAX=8;
  var open=null;               // {pop, trigger, onClose}
  var coarse=window.matchMedia&&matchMedia('(pointer:coarse)').matches;

  function mk(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }

  function close(restoreFocus){
    if(!open) return;
    var o=open; open=null;
    if(o.pop.parentNode) o.pop.parentNode.removeChild(o.pop);
    o.trigger.setAttribute('aria-expanded','false');
    document.removeEventListener('mousedown',onDoc,true);
    document.removeEventListener('keydown',onKey,true);
    window.removeEventListener('resize',onAway); window.removeEventListener('scroll',onAway,true);
    if(restoreFocus!==false&&o.trigger.isConnected&&o.trigger.focus) try{ o.trigger.focus({preventScroll:true}); }catch(e){}
    if(o.onClose) o.onClose();
  }
  function onDoc(e){ if(open&&!open.pop.contains(e.target)&&!open.trigger.contains(e.target)) close(false); }
  function onAway(e){ if(open&&e&&e.target&&open.pop.contains(e.target)) return; close(false); }
  function opts(){ return open?[].slice.call(open.pop.querySelectorAll('.ivp-opt:not([disabled])')):[]; }
  function onKey(e){
    if(!open) return;
    var list=opts(), i=list.indexOf(document.activeElement);
    if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); close(); return; }
    // Focus goes back to the field first so the browser's own Tab then moves on from it, not from the top of the page.
    if(e.key==='Tab'){ close(true); return; }
    var next=null;
    if(e.key==='ArrowDown') next=list[Math.min(list.length-1,i+1)];
    else if(e.key==='ArrowUp') next=list[i<=0?0:i-1];
    else if(e.key==='Home') next=list[0];
    else if(e.key==='End') next=list[list.length-1];
    else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
      var t=(open.type=(open.type||'')+e.key.toLowerCase()); clearTimeout(open.tt); open.tt=setTimeout(function(){ if(open) open.type=''; },700);
      next=list.filter(function(o){ return o.textContent.trim().toLowerCase().indexOf(t)===0; })[0];
    }
    if(next){ e.preventDefault(); next.focus(); }
  }

  /* items: [{label, sub, caption:true, on, danger, disabled, value, run}] */
  function popup(trigger,items,o){
    o=o||{}; close(false);
    var pop=mk('div','ivp-pop'); pop.setAttribute('role',o.role||'menu');
    var real=items.filter(function(x){ return !x.caption; });
    var cascade=!o.noCascade&&real.length<=CASCADE_MAX;
    var n=0;
    items.forEach(function(it){
      if(it.caption){ pop.appendChild(mk('div','ivp-cap',it.label)); return; }
      var b=mk('button','ivp-opt'+(it.on?' on':'')+(it.danger?' danger':'')+(it.sub?' two':''));
      b.type='button'; b.setAttribute('role',o.role==='listbox'?'option':'menuitem');
      if(o.role==='listbox') b.setAttribute('aria-selected',it.on?'true':'false');
      if(it.disabled) b.disabled=true;
      var t=mk('span','ivp-t'); if(it.html) t.innerHTML=it.html; else t.textContent=it.label;
      b.appendChild(t);
      if(it.sub){ b.appendChild(mk('small','ivp-s',it.sub)); }
      b.addEventListener('click',function(){ close(); if(it.run) it.run(); });
      pop.appendChild(b); n++;
    });
    document.body.appendChild(pop);
    var tr=trigger.getBoundingClientRect(), vw=document.documentElement.clientWidth, vh=window.innerHeight;
    var min=Math.max(o.minWidth||0,Math.round(tr.width));
    pop.style.minWidth=min+'px';
    var w=Math.min(pop.offsetWidth,vw-16);
    var maxH=Math.max(160,Math.min(360,vh-tr.bottom-16));
    var up=o.up||(vh-tr.bottom<Math.min(pop.offsetHeight+16,240)&&tr.top>vh-tr.bottom);
    if(up) maxH=Math.max(160,Math.min(360,tr.top-16));
    pop.style.maxHeight=maxH+'px';
    var scroll=pop.scrollHeight>maxH+1; if(scroll) cascade=false;
    pop.classList.toggle('ivp-scroll',scroll);
    var left=tr.left;
    if(cascade&&!up){
      // The first block's top left corner sits on the trigger's bottom left corner; each next one starts where the one above ends.
      var y=0;
      [].forEach.call(pop.children,function(c){
        if(c.classList.contains('ivp-cap')){ y+=c.offsetHeight+GAP; return; }
        c.style.setProperty('--lean',(-SL-((y+GAP)*SL/H)).toFixed(1)+'px'); y+=c.offsetHeight+GAP;
      });
      pop.classList.add('ivp-lean');
      // Leaning left must stay on screen.
      var worst=-SL-((y+GAP)*SL/H); left=Math.max(left,8-worst);
    }
    left=Math.max(8,Math.min(left,vw-w-8));
    pop.style.left=left+'px';
    if(up){ pop.style.bottom=(vh-tr.top+GAP)+'px'; pop.style.top='auto'; pop.classList.add('ivp-up'); }
    else { pop.style.top=(tr.bottom+GAP)+'px'; }
    trigger.setAttribute('aria-expanded','true');
    open={pop:pop,trigger:trigger,onClose:o.onClose};
    document.addEventListener('mousedown',onDoc,true);
    document.addEventListener('keydown',onKey,true);
    window.addEventListener('resize',onAway); window.addEventListener('scroll',onAway,true);
    var start=pop.querySelector('.ivp-opt.on:not([disabled])')||pop.querySelector('.ivp-opt:not([disabled])');
    if(start){ start.focus({preventScroll:true}); if(scroll&&start.scrollIntoView) start.scrollIntoView({block:'nearest'}); }
    return pop;
  }

  /* ── selects ── */
  function itemsOf(sel){
    var out=[];
    function add(o,gd){ if(o.hidden) return; out.push({label:o.text,value:o.value,on:o.selected,disabled:o.disabled||!!gd,run:function(){
      if(sel.value!==o.value||!o.selected){ sel.value=o.value; o.selected=true;
        sel.dispatchEvent(new Event('input',{bubbles:true})); sel.dispatchEvent(new Event('change',{bubbles:true})); } }}); }
    [].forEach.call(sel.children,function(c){
      if(c.tagName==='OPTGROUP'){ out.push({caption:true,label:c.label}); [].forEach.call(c.children,function(o){ add(o,c.disabled); }); } else if(c.tagName==='OPTION') add(c);
    });
    return out;
  }
  function openSelect(sel){
    if(!sel.isConnected) return;
    var items=itemsOf(sel); if(!items.length) return;
    var p=popup(sel,items,{role:'listbox',minWidth:sel.offsetWidth});
    sel.classList.add('ivp-open');
    if(open) open.onClose=function(){ sel.classList.remove('ivp-open'); };
  }
  function wire(sel){
    if(sel.__ivp||sel.multiple||sel.size>1||sel.hasAttribute('data-native')) return;
    sel.__ivp=true; sel.classList.add('ivp-sel'); sel.setAttribute('aria-haspopup','listbox'); sel.setAttribute('aria-expanded','false');
    if(coarse) return;                                   // touch: the browser's own picker
    sel.addEventListener('mousedown',function(e){ if(e.button!==0||sel.disabled) return; e.preventDefault(); sel.focus(); open&&open.trigger===sel?close():openSelect(sel); });
    sel.addEventListener('keydown',function(e){
      if(sel.disabled) return;
      if(e.key==='Enter'||e.key===' '||(e.altKey&&e.key==='ArrowDown')){ e.preventDefault(); openSelect(sel); }
    });
  }
  function scan(root){ [].forEach.call((root||document).querySelectorAll('select'),wire); }

  window.IVP={popup:popup,close:close,scan:scan};
  function boot(){
    scan();
    // Pages build most of their selects after load.
    try{ new MutationObserver(function(muts){
      // A menu whose select was replaced or whose options were rebuilt would otherwise write the pick into a stale element.
      if(open&&open.trigger){
        var stale=!open.trigger.isConnected;
        if(!stale&&open.trigger.tagName==='SELECT') for(var k=0;k<muts.length;k++) if(muts[k].target!==document.body&&open.trigger.contains(muts[k].target)){ stale=true; break; }
        if(stale) close(false);
      }
      for(var i=0;i<muts.length;i++) for(var j=0;j<muts[i].addedNodes.length;j++){
        var n=muts[i].addedNodes[j]; if(n.nodeType!==1) continue;
        if(n.tagName==='SELECT') wire(n); else if(n.querySelectorAll) scan(n);
      }
    }).observe(document.body,{childList:true,subtree:true}); }catch(e){}
  }
  /* ── dialogs: move focus in, keep Tab inside, give focus back ──
     Anything with role=dialog or aria-modal (Team A/B's #dcard and #mbox, the Hub's sheets) is watched. When one becomes
     visible, focus enters it unless the page already put it there; Tab wraps inside it; when the last one closes, focus
     returns to where it was. A dialog already open at load is tracked but never steals focus. */
  var DLG='[role=dialog],[aria-modal=true]', FOC='a[href],button,input,select,textarea,[tabindex]', activeDlg=null, lastOut=null, dq=0;
  function shown(d){
    if(!d.getClientRects().length) return false;
    var cs=getComputedStyle(d); if(cs.visibility==='hidden') return false;
    return !d.closest('.dlg:not(.show),.mo:not(.show),[hidden],[inert]');
  }
  function focusable(d){
    return [].filter.call(d.querySelectorAll(FOC),function(x){ return !x.disabled&&x.tabIndex>=0&&x.getClientRects().length&&getComputedStyle(x).visibility!=='hidden'; });
  }
  function topDialog(){
    var all=document.querySelectorAll(DLG), t=null;
    for(var i=0;i<all.length;i++) if(shown(all[i])) t=all[i];
    return t;
  }
  function syncDialogs(first){
    dq=0;
    var t=topDialog();
    if(t===activeDlg) return;
    var was=activeDlg; activeDlg=t;
    if(t){
      if(!was&&!first&&!t.contains(document.activeElement)){
        var f=focusable(t)[0];
        if(!f){ if(!t.hasAttribute('tabindex')) t.setAttribute('tabindex','-1'); f=t; }
        try{ f.focus({preventScroll:true}); }catch(e){}
      }
    } else if(was&&lastOut&&lastOut.isConnected&&lastOut.focus){
      try{ lastOut.focus({preventScroll:true}); }catch(e){}
      lastOut=null;
    }
  }
  function queueDialogs(){ if(!dq) dq=requestAnimationFrame(function(){ syncDialogs(false); }); }
  function bootDialogs(){
    document.addEventListener('focusin',function(e){ if(!(e.target.closest&&e.target.closest(DLG))&&!(e.target.classList&&e.target.classList.contains('ivp-opt'))) lastOut=e.target; },true);
    document.addEventListener('keydown',function(e){
      if(e.key!=='Tab'||!activeDlg||open) return;
      var d=activeDlg, list=focusable(d), a=document.activeElement;
      if(!list.length){ e.preventDefault(); return; }
      if(!d.contains(a)){ e.preventDefault(); list[0].focus(); return; }
      if(e.shiftKey&&(a===list[0]||a===d)){ e.preventDefault(); list[list.length-1].focus(); }
      else if(!e.shiftKey&&a===list[list.length-1]){ e.preventDefault(); list[0].focus(); }
    });
    try{ new MutationObserver(queueDialogs).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','open','inert']}); }catch(e){}
    syncDialogs(true);
  }
  function boot2(){ boot(); bootDialogs(); }
  if(document.body) boot2(); else document.addEventListener('DOMContentLoaded',boot2);
})();
