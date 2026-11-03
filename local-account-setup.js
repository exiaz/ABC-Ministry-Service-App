const form=document.querySelector('#setup-form'),status=document.querySelector('#setup-status');
let timer;
const request=async(url,options={})=>{
  const response=await fetch(url,{...options,headers:{'Content-Type':'application/json','X-MSA-Local-Setup':'1'},credentials:'omit',cache:'no-store',redirect:'error'}),result=await response.json();
  if(!response.ok)throw Error(result.error);return result;
};
form.addEventListener('submit',async event=>{
  event.preventDefault();clearTimeout(timer);
  const button=form.querySelector('button'),username=document.querySelector('#setup-username').value;button.disabled=true;
  const poll=async()=>{
    try{const result=await request('/api/local-account-setup?username='+encodeURIComponent(username));status.textContent=result.message;if(result.state==='pending'){timer=setTimeout(poll,1000);return;}}
    catch{status.textContent='Status belum dapat diperiksa. Periksa dialog Windows dan launcher.';}
    button.disabled=false;
  };
  try{const result=await request('/api/local-account-setup',{method:'POST',body:JSON.stringify({username})});status.textContent=result.message;timer=setTimeout(poll,1000);}
  catch(error){status.textContent=error.message||'Layanan belum dapat dihubungi.';button.disabled=false;}
});
addEventListener('pagehide',()=>clearTimeout(timer));
