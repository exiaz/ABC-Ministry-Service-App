import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrototypeServer} from '../server.mjs';

test('Standalone fictional attendance preview serves its local assets without exposing agent or backend files',async t=>{
  const server=createPrototypeServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  for(const file of ['ui-absen.html','ui/absen.js','ui/absen-charts.js','ui/absen-data.js','ui/absen.css','ui/absen-kit.css','assets/fonts/geist-variable.ttf','assets/fonts/geist-mono-variable.ttf']){
    const response=await fetch(base+'/'+file);assert.equal(response.status,200,file);
    if(file.endsWith('.ttf'))assert.equal(response.headers.get('content-type'),'font/ttf');
    assert.ok((await response.arrayBuffer()).byteLength>0,file);
  }
  for(const file of ['.agents/hooks/collab-guard.mjs','.codex/hooks.json','backend/msa-xlsx.mjs','.taste/brief.json'])assert.equal((await fetch(base+'/'+file)).status,404,file);
});
