// Interaksi minimal galeri lokal: banner, centang, chip, tab, sheet.
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
for(const b of $$('[data-banner-close]'))b.addEventListener('click',()=>{b.closest('.ui-banner').hidden=true;});
for(const b of $$('.ui-check'))b.addEventListener('click',()=>b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true')));
for(const c of $$('.ui-chip'))c.addEventListener('click',()=>c.setAttribute('aria-pressed',String(c.getAttribute('aria-pressed')!=='true')));
for(const group of $$('.ui-tabs'))for(const t of $$('.ui-tab',group))t.addEventListener('click',()=>{for(const o of $$('.ui-tab',group))o.setAttribute('aria-selected',String(o===t));});
const sheet=$('#gallery-sheet');
$('[data-sheet-open]')?.addEventListener('click',()=>{sheet.hidden=false;$('[data-sheet-close]',sheet).focus();});
for(const b of $$('[data-sheet-close]'))b.addEventListener('click',()=>{sheet.hidden=true;$('[data-sheet-open]').focus();});
document.addEventListener('keydown',e=>{
 if(!sheet||sheet.hidden)return;
 if(e.key==='Escape')$('[data-sheet-close]',sheet).click();
 if(e.key==='Tab'){
  const controls=$$('button,a[href],input,select,[tabindex="0"]',sheet).filter(el=>!el.disabled);
  const first=controls[0],last=controls.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 }
});
document.addEventListener('click',e=>{if(e.target.closest('[aria-disabled="true"]'))e.preventDefault();});
