import {msaBrand} from './msa-brand.js';
import {msaFetch,resumeMsaSession} from './msa-session.js';
import {prepareVisualImage} from './visual-image-client.js';
import {applyVisualMetadata,applyVisualCopy} from './msa-visual.js';
const $=id=>document.getElementById(id),base=()=>'/api/visual/'+$('slot').value;
let status=null,draftUrl='',fileUrl='',pending=null,busy=false,epoch=0,previewSlot='',previewDoc=null,config=null;
let selected={file:null,blob:null,url:''},cropSnapshot=null,dirty=false,drag=null;
const sources=new Map(),files=new Set(['msa-visual-default.jpg','msa-visual-welcome.jpg','msa-visual-auth.jpg','msa-visual-dashboard.jpg','msa-visual-program.jpg','msa-visual-campaign.jpg']);
const say=message=>{$('feedback').textContent=message;};
function saved(message){say(message);$('save-message').textContent=message;$('save-result').showModal();}
$('save-result-close').onclick=()=>$('save-result').close();
function revoke(url){if(url?.startsWith('blob:'))URL.revokeObjectURL(url);}
function clearPrivate(){
  epoch++;pending=null;status=null;dirty=false;drag=null;
  for(const url of new Set([fileUrl,draftUrl,cropSnapshot?.selected.url]))revoke(url);
  selected={file:null,blob:null,url:''};cropSnapshot=null;fileUrl=draftUrl='';previewSlot='';previewDoc=null;
  if($('image-editor').open)$('image-editor').close();
  if($('save-result').open)$('save-result').close();
  for(const id of ['crop-image','image-thumb'])$(id).removeAttribute('src');
  for(const id of ['image','alt','headline','description'])$(id).value='';
  $('image-info').textContent='';$('layout-preview').srcdoc='';$('layout-preview').hidden=true;$('studio').hidden=true;
}
window.addEventListener('msa-session-ended',clearPrivate);window.addEventListener('pagehide',clearPrivate);
async function request(path,body){
  let r;try{r=await msaFetch(path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});}catch{throw Object.assign(Error('Koneksi terputus. Hasil simpan belum pasti.'),{uncertain:true});}
  if(r.status===401||r.status===403){clearPrivate();throw Object.assign(Error(r.status===401?'Sesi berakhir. Masuk kembali.':'Akses Visual Studio tidak tersedia.'),{denied:true});}
  let value;try{value=await r.json();}catch{throw Object.assign(Error('Respons belum dapat dibaca.'),{uncertain:body!==undefined});}
  if(!r.ok)throw Object.assign(Error(value.error||'Perubahan belum tersimpan.'),{status:r.status,uncertain:body!==undefined&&r.status>=500});return value;
}
function metadata(){
  const value={alt:$('alt').value,x:Number($('x').value),y:Number($('y').value),zoom:Number($('zoom').value)};
  if(['welcome','login'].includes($('slot').value)){value.headline=$('headline').value;value.description=$('description').value;}return value;
}
function controls(){
  document.querySelectorAll('#studio button,#studio select,#studio input,#studio textarea').forEach(el=>el.disabled=busy||!!pending);
  $('save').disabled=busy||!!pending||(!dirty&&!status?.draft)||!status;$('cancel').hidden=!dirty;$('cancel').disabled=busy||!!pending;
  $('retry').hidden=!pending;$('retry').disabled=busy;$('save-state').textContent=pending?'Hasil simpan belum pasti.':dirty?'Ada perubahan belum disimpan.':status?.draft?'Draf lama siap diterapkan.':'Semua perubahan tersimpan.';
}
function changed(){dirty=true;controls();previewImage();}
async function run(fn){if(busy)return;busy=true;controls();try{await fn();}catch(error){say(error.message);}finally{busy=false;controls();}}
async function previewSource(slot){
  if(!sources.has(slot)){const r=await fetch('/visual-preview-source/'+slot,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Tata letak pratinjau tidak tersedia.');sources.set(slot,await r.text());}
  if(!config){const r=await fetch('/msa-visual.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Konfigurasi gambar bawaan tidak tersedia.');config=await r.json();}
}
function previewImage(){
  const slot=$('slot').value,entry=config?.slots?.[slot],meta=metadata();
  const src=fileUrl||draftUrl||status?.published?.src||(files.has(entry?.file)?'/assets/'+entry.file:'');
  for(const id of ['crop-image','image-thumb']){const image=$(id);if(src&&image.getAttribute('src')!==src)image.src=src;else if(!src)image.removeAttribute('src');applyVisualMetadata(image,meta);}
  $('zoom-value').textContent=Math.round(meta.zoom*100)+'%';
  $('preview-state').textContent=dirty||fileUrl?'Belum disimpan':status?.draft?'Pratinjau draf privat; belum diterbitkan.':status?.published?'Tidak ada draf; menampilkan publikasi saat ini.':'Tidak ada draf; menampilkan gambar bawaan.';
  const image=previewDoc?.querySelector('[data-visual-slot="'+slot+'"] img');if(!image)return;
  if(src)image.src=src;else image.removeAttribute('src');image.alt=meta.alt;applyVisualMetadata(image,meta);applyVisualCopy(previewDoc,slot,meta);
  const box=image.parentElement.getBoundingClientRect();if(box.width&&box.height)$('crop-stage').style.aspectRatio=box.width+' / '+box.height;
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
      if(!fileUrl&&!draftUrl&&status?.published&&files.has(entry?.file)&&img.getAttribute('src')===status.published.src){img.alt=entry.alt??'';img.style.transform='';img.style.objectPosition=/^(?:100|[0-9]{1,2})% (?:100|[0-9]{1,2})%$/.test(entry.position??'')?entry.position:'';img.src='/assets/'+entry.file;}
      else img.removeAttribute('src');
    });
    previewImage();
  };frame.srcdoc='<!doctype html>'+doc.documentElement.outerHTML;
}

function defaultCopy(slot,key){const doc=new DOMParser().parseFromString(sources.get(slot),'text/html');return doc.querySelector('[data-visual-'+key+'="'+slot+'"]')?.textContent??'';}
async function load(){
  if(pending)throw Error('Pastikan hasil simpan melalui Coba lagi terlebih dahulu.');
  const version=++epoch,slot=$('slot').value;let s,d;
  try{s=await request('/api/visual/'+slot);await previewSource(slot);d=s.draft?await request('/api/visual/'+slot+'/preview'):null;}catch(error){if(version===epoch&&status){$('slot').value=status.slot;slotNavigation();}throw error;}
  if(version!==epoch)return;
  for(const url of new Set([fileUrl,draftUrl]))revoke(url);selected={file:null,blob:null,url:''};fileUrl=draftUrl='';status=s;dirty=false;
  if(d){const raw=atob(d.image);draftUrl=URL.createObjectURL(new Blob([Uint8Array.from(raw,c=>c.charCodeAt(0))],{type:'image/png'}));}
  const entry=config?.slots?.[slot],position=/^(100|[0-9]{1,2})% (100|[0-9]{1,2})%$/.exec(entry?.position??'');
  const meta=s.draft?.metadata??s.published?.metadata??{alt:entry?.alt??'',x:position?Number(position[1]):50,y:position?Number(position[2]):50};
  $('alt').value=meta.alt;$('x').value=meta.x;$('y').value=meta.y;$('zoom').value=meta.zoom??1;
  for(const key of ['headline','description']){$(key).placeholder=defaultCopy(slot,key);$(key).value=meta[key]??defaultCopy(slot,key);}
  $('copy-settings').hidden=!['welcome','login'].includes(slot);$('image').value='';$('image-info').textContent='';$('revision').textContent='Revisi slot: '+s.revision;
  $('published-state').textContent=s.published?'Tampilan aktif':'Gambar bawaan';slotNavigation();layout();$('studio').hidden=false;controls();
}
function slotNavigation(){const slot=$('slot');$('section-title').textContent=slot.options[slot.selectedIndex].textContent;document.querySelectorAll('[data-slot]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.slot===slot.value)));}
function snapshot(){return {selected,dirty,x:$('x').value,y:$('y').value,zoom:$('zoom').value};}
function openCrop(saved=snapshot()){cropSnapshot=saved;previewImage();if(!$('image-editor').open)$('image-editor').showModal();$('crop-stage').focus();}
function cancelCrop(){if(!cropSnapshot)return;if(selected.url!==cropSnapshot.selected.url)revoke(selected.url);selected=cropSnapshot.selected;fileUrl=selected.url;dirty=cropSnapshot.dirty;for(const key of ['x','y','zoom'])$(key).value=cropSnapshot[key];cropSnapshot=null;$('image-editor').close();previewImage();controls();}
$('crop-cancel').onclick=cancelCrop;$('image-editor').addEventListener('cancel',event=>{event.preventDefault();cancelCrop();});
$('crop-apply').onclick=()=>{if(cropSnapshot?.selected.url!==selected.url)revoke(cropSnapshot?.selected.url);cropSnapshot=null;$('image-editor').close();changed();};
$('image-change').onclick=()=>{if(!busy&&!pending)$('image').click();};$('image-edit').onclick=()=>{if(!busy&&!pending)openCrop();};
$('image').onchange=()=>{const file=$('image').files[0];if(!file)return;const saved=snapshot(),version=epoch;void run(async()=>{
  const result=await prepareVisualImage(file,{maxDimension:Number($('compression-size').value)});if(version!==epoch)return;
  const url=URL.createObjectURL(result.blob);selected={file,blob:result.blob,url};fileUrl=url;$('x').value='50';$('y').value='50';$('zoom').value='1';$('image').value='';
  $('image-info').textContent=result.width+' × '+result.height+' · '+(result.blob.size/1024/1024).toFixed(2)+' MiB';openCrop(saved);
});};
$('compression-size').onchange=()=>{if(!selected.file)return;const version=epoch;void run(async()=>{const result=await prepareVisualImage(selected.file,{maxDimension:Number($('compression-size').value)});if(version!==epoch)return;revoke(selected.url);selected={...selected,blob:result.blob,url:URL.createObjectURL(result.blob)};fileUrl=selected.url;$('image-info').textContent=result.width+' × '+result.height+' · '+(result.blob.size/1024/1024).toFixed(2)+' MiB';changed();});};
function position(x,y){if(busy||pending)return;const clamp=n=>Math.round(Math.max(0,Math.min(100,n)));$('x').value=clamp(x);$('y').value=clamp(y);previewImage();}
$('position-reset').onclick=()=>{position(50,50);$('zoom').value='1';previewImage();};$('zoom').oninput=previewImage;
const cropStage=$('crop-stage');
cropStage.addEventListener('pointerdown',event=>{if(busy||pending||event.button!==0)return;const image=$('crop-image'),box=cropStage.getBoundingClientRect(),scale=Math.max(box.width/image.naturalWidth,box.height/image.naturalHeight)*Number($('zoom').value);if(!Number.isFinite(scale))return;drag={id:event.pointerId,left:event.clientX,top:event.clientY,x:Number($('x').value),y:Number($('y').value),overflowX:Math.max(0,image.naturalWidth*scale-box.width),overflowY:Math.max(0,image.naturalHeight*scale-box.height)};cropStage.setPointerCapture(event.pointerId);event.preventDefault();});
cropStage.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;position(drag.x-(drag.overflowX>1?(event.clientX-drag.left)/drag.overflowX*100:0),drag.y-(drag.overflowY>1?(event.clientY-drag.top)/drag.overflowY*100:0));});
for(const event of ['pointerup','pointercancel','lostpointercapture'])cropStage.addEventListener(event,()=>{drag=null;});
cropStage.addEventListener('keydown',event=>{const step=event.shiftKey?10:1,move={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[event.key];if(move){event.preventDefault();position(Number($('x').value)+move[0],Number($('y').value)+move[1]);}});
for(const key of ['headline','description','alt'])$(key).addEventListener('input',changed);$('mode').addEventListener('input',layout);
async function sendPending(){
  if(!pending)return;const version=epoch;
  try{await request(pending.path,pending.body);}catch(error){
    if(version!==epoch)return;if(!error.uncertain)pending=null;
    if(error.status===409){status=null;say('Tampilan sudah berubah. Pilih Batalkan untuk memuat versi terbaru.');return;}
    say(error.status===404?'Perubahan belum disimpan. Layanan simpan tidak tersedia. Jika pilot belum dimulai ulang setelah pembaruan, jalankan Stop MSA.cmd lalu Start MSA.cmd dan pilih gambar kembali. Restart membuat data uji baru.':error.message+(pending?' Gunakan Coba lagi untuk memastikan hasil.':''));
    $('feedback').focus();return;
  }
  if(version!==epoch)return;pending=null;dirty=false;
  try{await load();if(version+1===epoch)saved('Perubahan tersimpan.');}catch(error){
    if(version+1!==epoch||error.denied)return;
    status=null;saved('Tersimpan. Muat ulang untuk melihat hasilnya.');
  }
}
$('editor').onsubmit=event=>{event.preventDefault();if($('image-editor').open||pending||(!dirty&&!status?.draft))return;void run(async()=>{
  if(!status||!$('editor').reportValidity())return;const version=epoch,body={mutation:{expectedRevision:status.revision,requestId:crypto.randomUUID(),reason:'Pembaruan tampilan '+$('section-title').textContent+' melalui Visual Studio',confirmed:true},metadata:metadata()};
  if(selected.blob){const bytes=new Uint8Array(await selected.blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));body.image=btoa(binary);}
  if(version!==epoch)return;pending={path:base()+'/save',body};await sendPending();
});};
$('retry').onclick=()=>void run(sendPending);$('cancel').onclick=()=>void run(load);
$('reload').onclick=()=>void run(async()=>{if(dirty)throw Error('Simpan atau batalkan perubahan terlebih dahulu.');await load();say('Status diperbarui.');});
$('slot').onchange=()=>{if(pending||dirty){$('slot').value=status?.slot??'welcome';say('Simpan atau batalkan perubahan sebelum berpindah bagian.');return;}void run(load);};
document.querySelectorAll('[data-slot]').forEach(button=>button.onclick=()=>{if(busy||button.dataset.slot===$('slot').value)return;$('slot').value=button.dataset.slot;$('slot').dispatchEvent(new Event('change'));});
slotNavigation();void resumeMsaSession(async()=>{await run(async()=>{await load();say('');});});
