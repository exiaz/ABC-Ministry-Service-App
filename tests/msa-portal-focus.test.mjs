import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('Portal keeps authenticated workspace during focus validation and clears it on 401',async()=>{
  const source=(await readFile(new URL('../msa-portal.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
  const nodes=new Map(),listeners=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,value:'',textContent:'',setAttribute(){},replaceChildren(){},append(){},focus(){},cloneNode(){return node(id+'-clone');}});return nodes.get(id);};
  const profile={username:'fictional-owner',role:'superadmin',modules:[],expiresAt:Date.now()+1800000};
  let pending,delay=false,requests=0;
  const location={pathname:'/',hash:''};
  const context=vm.createContext({location,history:{replaceState(_state,_title,url){location.hash=url.includes('#')?'#'+url.split('#')[1]:'';}},document:{getElementById:node,querySelectorAll:()=>[],createElement:()=>node('link'),body:{dataset:{mentorOrigin:'http://127.0.0.1:4276'}}},window:{addEventListener:(name,fn)=>listeners.set(name,fn)},msaBrand:()=>'',mountVisuals:async()=>{},mountMsaShell(){},clearMsaShell(){},msaRoleLabel:()=> 'Superadmin',setTimeout:()=>1,clearTimeout(){},AbortSignal,Date,URLSearchParams,
    msaFetch:async()=>{requests++;if(delay)return new Promise(resolve=>pending=resolve);return {ok:true,json:async()=>profile};}});
  vm.runInContext(source,context);const settle=()=>new Promise(resolve=>setImmediate(resolve));await settle();
  assert.equal(node('portal-workspace').hidden,false);assert.equal(node('portal-login').hidden,true);
  delay=true;listeners.get('focus')();await settle();
  assert.equal(node('portal-workspace').hidden,false,'A pending session check must not show the login page');
  assert.equal(node('portal-login').hidden,true);
  const count=requests;listeners.get('focus')();await settle();assert.equal(requests,count,'Concurrent focus events must not duplicate session checks');
  pending({ok:true,json:async()=>profile});await settle();assert.equal(node('portal-login').hidden,true);
  listeners.get('focus')();await settle();pending({ok:false,status:401,json:async()=>({error:'Sesi berakhir.'})});await settle();
  assert.equal(node('portal-workspace').hidden,true);assert.equal(node('portal-login').hidden,false);
});
