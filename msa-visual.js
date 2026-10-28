// Static, same-origin media slots; configuration never grants access to data.
const files=new Set(['msa-visual-default.jpg','msa-visual-welcome.jpg','msa-visual-auth.jpg','msa-visual-dashboard.jpg','msa-visual-program.jpg','msa-visual-campaign.jpg']);
const slots=new Set(['welcome','login','registration','dashboard','program','campaign']);
const presets=new Set(['neutral','warm','bright']);
export async function mountVisuals(){
  let config;
  try{const response=await fetch('/msa-visual.json',{cache:'no-cache'});if(!response.ok)return;config=await response.json();}catch{return;}
  if(presets.has(config?.preset))document.body.dataset.visualPreset=config.preset;
  for(const node of document.querySelectorAll('[data-visual-slot]')){
    const slot=node.dataset.visualSlot,entry=config?.slots?.[slot];
    if(!slots.has(slot)||!entry||!files.has(entry.file))continue;
    const img=document.createElement('img');img.src='/assets/'+entry.file;
    img.alt=typeof entry.alt==='string'?entry.alt.slice(0,160):'';
    img.loading=slot==='welcome'?'eager':'lazy';
    if(typeof entry.position==='string'&&/^(?:100|[0-9]{1,2})% (?:100|[0-9]{1,2})%$/.test(entry.position))img.style.objectPosition=entry.position;
    img.addEventListener('error',()=>img.remove(),{once:true});node.replaceChildren(img);
  }
}
