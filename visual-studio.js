import {msaBrand} from './msa-brand.js';
import {msaFetch,resumeMsaSession} from './msa-session.js';
import {prepareVisualImage} from './visual-image-client.js';
const $=id=>document.getElementById(id),base=()=>'/api/visual/'+$('slot').value;
let status=null,draftUrl='',fileUrl='',pending=null,busy=false,epoch=0,previewSlot='',previewDoc=null,config=null;
let preparedImage=null,draftBlob=null;
const sources=new Map(),files=new Set(['msa-visual-default.jpg','msa-visual-welcome.jpg','msa-visual-auth.jpg','msa-visual-dashboard.jpg','msa-visual-program.jpg','msa-visual-campaign.jpg']);
const say=message=>{$('feedback').textContent=message;};
function clearPrivate(){epoch++;pending=null;status=null;preparedImage=null;draftBlob=null;drag=null;$('crop-image').removeAttribute('src');$('image-info').textContent='';for(const url of [draftUrl,fileUrl])if(url)URL.revokeObjectURL(url);draftUrl=fileUrl='';previewSlot='';previewDoc=null;$('layout-preview').hidden=true;$('layout-preview').srcdoc='';for(const id of ['draft']){$(id).removeAttribute('src');$(id).hidden=true;}$('image').value='';$('alt').value='';$('reason').value='';$('confirm').checked=false;$('history').replaceChildren();$('studio').hidden=true;}
window.addEventListener('msa-session-ended',clearPrivate);
window.addEventListener('pagehide',clearPrivate);
async function request(path,body){
  let r;try{r=await msaFetch(path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});}catch{throw Object.assign(Error('Koneksi tidak tersedia atau hasil belum pasti.'),{uncertain:true});}
  if(r.status===401||r.status===403){clearPrivate();throw Object.assign(Error(r.status===401?'Sesi berakhir. Masuk kembali.':'Akses Visual Studio tidak tersedia.'),{denied:true});}
  let value;try{value=await r.json();}catch{throw Object.assign(Error('Respons server tidak dapat dibaca.'),{uncertain:body!==undefined});}
  if(!r.ok)throw Object.assign(Error(value.error||'Permintaan gagal.'),{status:r.status,uncertain:body!==undefined&&r.status>=500});return value;
}
function showImage(id,url,meta){const img=$(id);img.hidden=!url;if(url){img.src=url;img.alt=meta?.alt??'';img.style.objectPosition=(meta?.x??50)+'% '+(meta?.y??50)+'%';}else img.removeAttribute('src');}
async function previewSource(slot){
  if(!sources.has(slot)){const r=await fetch('/visual-preview-source/'+slot,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Tata letak pratinjau tidak tersedia.');sources.set(slot,await r.text());}
  if(!config){const r=await fetch('/msa-visual.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Konfigurasi gambar bawaan tidak tersedia.');config=await r.json();}
}
function previewImage(){
  const slot=$('slot').value,entry=config?.slots?.[slot],hasDraft=!!(fileUrl||draftUrl),published=status?.published;
  const src=fileUrl||draftUrl||published?.src||(files.has(entry?.file)?'/assets/'+entry.file:'');
  const meta=hasDraft?{alt:$('alt').value,x:Number($('x').value),y:Number($('y').value)}:published?.metadata;
  $('preview-state').textContent=fileUrl?'Pratinjau pilihan lokal yang belum tentu tersimpan.':draftUrl?'Pratinjau draf privat; belum diterbitkan.':published?'Tidak ada draf; menampilkan publikasi saat ini.':'Tidak ada draf; menampilkan gambar bawaan.';
  const crop=$('crop-image');if(src){if(crop.getAttribute('src')!==src)crop.src=src;crop.style.objectPosition=meta?meta.x+'% '+meta.y+'%':'50% 50%';}else crop.removeAttribute('src');
  $('position-x').value=$('x').value;$('position-y').value=$('y').value;
  const img=previewDoc?.querySelector('[data-visual-slot="'+slot+'"] img');if(!img)return;
  if(src)img.src=src;else img.removeAttribute('src');img.alt=meta?.alt??entry?.alt??'';
  img.style.objectPosition=meta?meta.x+'% '+meta.y+'%':(/^(?:100|[0-9]{1,2})% (?:100|[0-9]{1,2})%$/.test(entry?.position??'')?entry.position:'');
  const box=img.getBoundingClientRect();if(box.width&&box.height)$('crop-stage').style.aspectRatio=box.width+' / '+box.height;
}
function fitPreview(){
  const wrap=document.querySelector('.preview-wrap'),frame=$('layout-preview'),width=$('mode').value==='desktop'?1365:390;
  const scale=Math.min(1,wrap.clientWidth/width,(innerWidth<=1050?600:680)/900);
  frame.style.transform='scale('+scale+')';frame.style.left=Math.max(0,(wrap.clientWidth-width*scale)/2)+'px';wrap.style.height=900*scale+'px';
}
window.addEventListener('resize',fitPreview);
function layout(){
  const slot=$('slot').value,frame=$('layout-preview');frame.className=$('mode').value;frame.hidden=false;
  fitPreview();
  if(previewSlot===slot&&previewDoc){previewImage();return;}
  if(!sources.has(slot))return;
  const doc=new DOMParser().parseFromString(sources.get(slot),'text/html');doc.querySelectorAll('script').forEach(n=>n.remove());
  doc.body.inert=true;
  if(['neutral','warm','bright'].includes(config?.preset))doc.body.dataset.visualPreset=config.preset;
  const brand=doc.querySelector('#portal-brand,#account-brand,#brand');if(brand)brand.innerHTML=msaBrand();
  if(slot==='login'||slot==='dashboard'){const home=doc.createElement('a');home.href='#';home.className='btn';home.textContent='Beranda aplikasi';brand.append(home);}
  if(slot==='welcome'){
    doc.body.dataset.msaPortal='true';
    const entry=doc.createElement('a');entry.href='#';entry.textContent='Masuk sebagai Mentor';doc.querySelector('#portal-mentor-entry').append(entry);
  }
  if(slot==='registration'){
    doc.body.dataset.msaPortal='true';const stylesheet=doc.createElement('link');stylesheet.rel='stylesheet';stylesheet.href='/msa-shell.css';doc.head.append(stylesheet);
  }
  if(slot==='dashboard'){
    doc.body.classList.add('account-signed-in');doc.querySelector('#account-login').hidden=true;doc.querySelector('#account-profile').hidden=false;doc.querySelector('#account-navigation').hidden=false;
    doc.querySelector('#account-name').textContent='Mentor fiktif';
    const dates=doc.querySelector('#account-dates');dates.innerHTML='<p class="account-week-heading">Minggu penugasan pertama · Oktober 2026</p><ol class="account-week"><li><span>Sen</span><strong>26</strong></li><li><span>Sel</span><strong>27</strong></li><li><span>Rab</span><strong>28</strong></li><li><span>Kam</span><strong>29</strong></li><li class="account-week-selected"><span>Jum</span><strong>30</strong></li><li><span>Sab</span><strong>31</strong></li><li><span>Min</span><strong>1</strong></li></ol>';
    doc.querySelector('#account-groups').innerHTML='<article class="account-group"><p class="eyebrow">KELOMPOK UTAMA</p><h2>Kelompok fiktif</h2><p class="mentor-subtitle">Mentor fiktif</p><p>Sekolah fiktif · Jumat, 30 Oktober 2026</p></article>';
  }
  const target=doc.querySelector('[data-visual-slot="'+slot+'"]');if(!target)throw Error('Slot pratinjau tidak ditemukan.');target.replaceChildren(doc.createElement('img'));
  previewSlot=slot;previewDoc=null;frame.onload=()=>{
    if(previewSlot!==slot)return;previewDoc=frame.contentDocument;
    const img=previewDoc?.querySelector('[data-visual-slot="'+slot+'"] img');
    img?.addEventListener('error',()=>{
      const entry=config?.slots?.[slot];
      if(!fileUrl&&!draftUrl&&status?.published&&files.has(entry?.file)&&img.getAttribute('src')===status.published.src){img.alt=entry.alt??'';img.style.objectPosition=/^(?:100|[0-9]{1,2})% (?:100|[0-9]{1,2})%$/.test(entry.position??'')?entry.position:'';img.src='/assets/'+entry.file;}
      else img.removeAttribute('src');
    });
    previewImage();
  };frame.srcdoc='<!doctype html>'+doc.documentElement.outerHTML;
}
function historyView(result){const host=$('history'),select=$('target');host.replaceChildren();select.replaceChildren(new Option('0 · Gambar bawaan','0'));if(!result.publications.length){host.textContent='Belum ada riwayat publikasi.';return;}for(const v of result.publications){const a=document.createElement('article'),h=document.createElement('strong'),p=document.createElement('p');h.textContent='Revisi '+v.revision+(v.fallback?' · Gambar bawaan':'');p.textContent=v.reason+' · '+new Date(v.at).toLocaleString('id-ID');a.append(h,p);host.append(a);select.add(new Option('Revisi '+v.revision+(v.fallback?' · Gambar bawaan':''),String(v.revision)));}}
async function load(){const version=++epoch,slot=$('slot').value;const s=await request('/api/visual/'+slot),h=await request('/api/visual/'+slot+'/history');await previewSource(slot);let d=null;if(s.draft)d=await request('/api/visual/'+slot+'/preview');if(version!==epoch)return;status=s;$('image').required=!s.draft;if(draftUrl)URL.revokeObjectURL(draftUrl);draftUrl='';draftBlob=null;if(d){const raw=atob(d.image),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));draftBlob=new Blob([bytes],{type:'image/png'});draftUrl=URL.createObjectURL(draftBlob);}showImage('draft',draftUrl,s.draft?.metadata);showImage('published',s.published?.src??'/assets/msa-visual-default.jpg',s.published?.metadata);$('published-state').textContent=s.published?'Revisi publikasi '+s.published.revision:'Menggunakan gambar bawaan.';$('draft-state').textContent=s.draft?'Draf tersedia secara privat.':'Belum ada draf.';$('revision').textContent='Revisi slot: '+s.revision;historyView(h);if(s.draft&&!fileUrl){$('alt').value=s.draft.metadata.alt;$('x').value=s.draft.metadata.x;$('y').value=s.draft.metadata.y;}layout();$('studio').hidden=false;}
function locked(on){busy=on;document.querySelectorAll('#studio button,#studio select,#studio input,#studio textarea').forEach(el=>el.disabled=on);}
async function run(fn){if(busy)return;locked(true);try{await fn();}catch(e){say(e.message);}finally{locked(false);$('retry').hidden=!pending;}}
function mutation(){if(!$('reason').reportValidity()||!$('confirm').reportValidity())throw Error('Isi alasan dan konfirmasi tindakan.');return {expectedRevision:status.revision,requestId:crypto.randomUUID(),reason:$('reason').value,confirmed:true};}
async function sendPending(){if(!pending)return;const version=epoch;try{await request(pending.path,pending.body);if(version!==epoch)return;}catch(e){if(!e.uncertain)pending=null;if(e.status===409){status=null;say('Revisi berubah atau permintaan tidak sesuai. Muat ulang status sebelum mencoba lagi.');}else say(e.message+(e.uncertain?' Ulangi permintaan yang sama untuk memastikan hasil.':''));return;}pending=null;$('confirm').checked=false;say('Perubahan tersimpan.');try{await load();}catch(e){status=null;say('Perubahan tersimpan, tetapi status belum dapat dimuat. '+e.message);}}
function start(action,body){if(pending)throw Error('Selesaikan retry permintaan sebelumnya terlebih dahulu.');pending={path:base()+'/'+action,body};return sendPending();}
async function prepareSelection(){
  if(pending)throw Error('Selesaikan retry permintaan sebelumnya terlebih dahulu.');
  const file=$('image').files[0],dimension=Number($('compression-size').value),version=epoch;
  if(preparedImage?.file===file&&preparedImage.dimension===dimension)return preparedImage.result;
  preparedImage=null;if(fileUrl)URL.revokeObjectURL(fileUrl);fileUrl='';$('image-info').textContent='Menyiapkan dan mengompres gambar…';
  try{
    const result=await prepareVisualImage(file,{maxDimension:dimension});
    if(version!==epoch)throw Error('Pilihan gambar dibatalkan karena sesi atau bagian berubah.');
    preparedImage={file,dimension,result};fileUrl=URL.createObjectURL(result.blob);
    const mib=bytes=>(bytes/1024/1024).toFixed(2)+' MiB';
    $('image-info').textContent=`${result.format}: ${result.originalWidth} × ${result.originalHeight} (${mib(result.originalBytes)}) → PNG ${result.width} × ${result.height} (${mib(result.blob.size)}). Siap untuk pratinjau dan upload.`;
    layout();return result;
  }catch(error){if(version===epoch){$('image-info').textContent=error.message;layout();}throw error;}
}
$('editor').addEventListener('submit',e=>{e.preventDefault();void run(async()=>{if(!status||!$('editor').reportValidity())return;const blob=$('image').files[0]?(await prepareSelection()).blob:draftBlob;if(!blob)throw Error('Pilih gambar terlebih dahulu.');const data=await blob.arrayBuffer();const bytes=new Uint8Array(data);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));await start('draft',{mutation:mutation(),metadata:{alt:$('alt').value,x:Number($('x').value),y:Number($('y').value)},image:btoa(binary)});});});
$('publish').onclick=()=>void run(async()=>{if(!status?.draft)throw Error('Belum ada draf untuk diterbitkan.');if(Number($('x').value)!==status.draft.metadata.x||Number($('y').value)!==status.draft.metadata.y||$('alt').value.trim()!==status.draft.metadata.alt)throw Error('Simpan perubahan draf sebelum menerbitkan.');await start('publish',{mutation:mutation()});});
$('revert').onclick=()=>void run(async()=>{if(!status)return;await start('revert',{mutation:mutation(),targetRevision:Number($('target').value)});});
$('retry').onclick=()=>void run(sendPending);
$('reload').onclick=()=>void run(async()=>{if(pending)throw Error('Ulangi permintaan yang belum pasti terlebih dahulu.');say('Memuat status…');await load();say('Status diperbarui.');});
$('slot').onchange=()=>void run(async()=>{if(pending){$('slot').value=pending.path.split('/')[3];throw Error('Ulangi permintaan yang belum pasti terlebih dahulu.');}status=null;preparedImage=null;$('image-info').textContent='';$('layout-preview').hidden=true;if(fileUrl)URL.revokeObjectURL(fileUrl);fileUrl='';$('image').value='';$('alt').value='';$('x').value='50';$('y').value='50';say('Memuat status…');await load();say('Status diperbarui.');});
$('image').onchange=()=>void run(prepareSelection);
$('compress').onclick=()=>void run(prepareSelection);
$('compression-size').onchange=()=>{if($('image').files[0])void run(prepareSelection);};
for(const id of ['alt','x','y','mode'])$(id).addEventListener('input',layout);
function position(x,y){if(busy||pending||!(fileUrl||draftUrl))return;const clamp=n=>Math.round(Math.max(0,Math.min(100,n)));$('x').value=clamp(x);$('y').value=clamp(y);layout();}
for(const axis of ['x','y'])$('position-'+axis).addEventListener('input',()=>position($('position-x').value,$('position-y').value));
$('position-reset').onclick=()=>position(50,50);
const cropStage=$('crop-stage');let drag=null;
cropStage.addEventListener('pointerdown',event=>{
  if(busy||pending||!(fileUrl||draftUrl)||event.button!==0)return;
  const image=$('crop-image'),box=cropStage.getBoundingClientRect(),scale=Math.max(box.width/image.naturalWidth,box.height/image.naturalHeight);
  if(!Number.isFinite(scale))return;drag={id:event.pointerId,left:event.clientX,top:event.clientY,x:Number($('x').value),y:Number($('y').value),overflowX:Math.max(0,image.naturalWidth*scale-box.width),overflowY:Math.max(0,image.naturalHeight*scale-box.height)};
  cropStage.setPointerCapture(event.pointerId);event.preventDefault();
});
cropStage.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;position(drag.x-(drag.overflowX>1?(event.clientX-drag.left)/drag.overflowX*100:0),drag.y-(drag.overflowY>1?(event.clientY-drag.top)/drag.overflowY*100:0));});
for(const event of ['pointerup','pointercancel','lostpointercapture'])cropStage.addEventListener(event,()=>{drag=null;});
cropStage.addEventListener('keydown',event=>{const step=event.shiftKey?10:1,move={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[event.key];if(!move)return;event.preventDefault();position(Number($('x').value)+move[0],Number($('y').value)+move[1]);});
document.querySelectorAll('[data-slot]').forEach(button=>button.onclick=()=>{if(busy||button.dataset.slot===$('slot').value)return;$('slot').value=button.dataset.slot;$('slot').dispatchEvent(new Event('change'));});
function slotNavigation(){const slot=$('slot');$('section-title').textContent=slot.options[slot.selectedIndex].textContent;document.querySelectorAll('[data-slot]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.slot===slot.value)));}
$('slot').addEventListener('change',slotNavigation);slotNavigation();
void resumeMsaSession(async()=>{await run(async()=>{await load();say('Status tersedia.');});});
