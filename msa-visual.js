// Static, same-origin media slots; configuration never grants access to data.
const files=new Set(['msa-visual-default.jpg','msa-visual-welcome.jpg','msa-visual-auth.jpg','msa-visual-dashboard.jpg','msa-visual-program.jpg','msa-visual-campaign.jpg']);
const slots=new Set(['welcome','login','registration','dashboard','program','campaign']);
const presets=new Set(['neutral','warm','bright']);
export function applyVisualMetadata(img,meta={}){
  const x=Number.isInteger(meta.x)&&meta.x>=0&&meta.x<=100?meta.x:50,y=Number.isInteger(meta.y)&&meta.y>=0&&meta.y<=100?meta.y:50;
  const zoom=typeof meta.zoom==='number'&&Number.isFinite(meta.zoom)&&meta.zoom>=1&&meta.zoom<=3?meta.zoom:1;
  img.style.objectPosition=x+'% '+y+'%';img.style.transformOrigin=x+'% '+y+'%';img.style.transform=zoom===1?'':'scale('+zoom+')';
}
export function applyVisualCopy(root,slot,meta={}){
  if(!['welcome','login'].includes(slot))return;
  for(const [key,limit] of [['headline',120],['description',300]]){
    const node=root.querySelector('[data-visual-'+key+'="'+slot+'"]');if(!node)continue;
    if(node.dataset.visualDefault===undefined)node.dataset.visualDefault=node.textContent;
    if(key==='description')node.style.whiteSpace='pre-line';
    node.textContent=typeof meta[key]==='string'&&meta[key].trim()&&meta[key].length<=limit?meta[key]:node.dataset.visualDefault;
  }
}
export async function mountVisuals(){
  let config;
  try{const response=await fetch('/msa-visual.json',{cache:'no-cache'});if(!response.ok)return;config=await response.json();}catch{return;}
  if(presets.has(config?.preset))document.body.dataset.visualPreset=config.preset;
  for(const node of document.querySelectorAll('[data-visual-slot]')){
    const slot=node.dataset.visualSlot,entry=config?.slots?.[slot];
    if(!slots.has(slot)||!entry||!files.has(entry.file))continue;
    let published;
    if(['welcome','login','registration','dashboard'].includes(slot)){
      try{const response=await fetch('/visual/published/'+slot,{cache:'no-store'});if(response.ok){const result=await response.json();if(result.slot===slot&&Number.isSafeInteger(result.revision)&&result.revision>0&&(result.src===null||result.src==='/visual/published/'+slot+'/'+result.revision)&&typeof result.metadata?.alt==='string'&&[result.metadata.x,result.metadata.y].every(n=>Number.isInteger(n)&&n>=0&&n<=100))published=result;}}catch{}
    }
    const img=document.createElement('img');img.src=published?.src??('/assets/'+entry.file);
    img.alt=published?published.metadata.alt:typeof entry.alt==='string'?entry.alt.slice(0,160):'';
    img.loading=slot==='welcome'?'eager':'lazy';
    if(typeof entry.position==='string'&&/^(?:100|[0-9]{1,2})% (?:100|[0-9]{1,2})%$/.test(entry.position))img.style.objectPosition=entry.position;
    if(published){applyVisualMetadata(img,published.metadata);applyVisualCopy(document,slot,published.metadata);}
    img.addEventListener('error',()=>{if(published){published=null;img.style.transform='';img.alt=typeof entry.alt==='string'?entry.alt.slice(0,160):'';img.style.objectPosition=typeof entry.position==='string'&&/^(?:100|[0-9]{1,2})% (?:100|[0-9]{1,2})%$/.test(entry.position)?entry.position:'';img.src='/assets/'+entry.file;}else img.remove();});node.replaceChildren(img);
  }
}
