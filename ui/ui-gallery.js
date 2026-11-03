// Interaksi minimal galeri lokal: banner, centang, chip, tab, sheet.
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
$('[data-banner-close]')?.addEventListener('click',()=>{$('.ui-banner').hidden=true;});
for(const b of $$('.ui-check'))b.addEventListener('click',()=>b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true')));
for(const c of $$('.ui-chip'))c.addEventListener('click',()=>c.setAttribute('aria-pressed',String(c.getAttribute('aria-pressed')!=='true')));
for(const group of $$('.ui-tabs'))for(const t of $$('.ui-tab',group))t.addEventListener('click',()=>{for(const o of $$('.ui-tab',group))o.setAttribute('aria-selected',String(o===t));});
const sheet=$('#gallery-sheet');
$('[data-sheet-open]')?.addEventListener('click',()=>{sheet.hidden=false;$('[data-sheet-close]',sheet).focus();});
for(const b of $$('[data-sheet-close]'))b.addEventListener('click',()=>{sheet.hidden=true;$('[data-sheet-open]').focus();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sheet&&!sheet.hidden)$('[data-sheet-close]',sheet).click();});
