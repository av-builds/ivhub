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
  if(document.body) mount(); else document.addEventListener('DOMContentLoaded',mount);
})();
