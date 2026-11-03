import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {msaBrand} from '../msa-brand.js';
import {usernameFields} from '../username-login.js';
import {createAdminClient} from '../admin-client.js';

test('MSA identity preserves app installation ID, program labels and original logo reference',()=>{
  const manifest=JSON.parse(readFileSync('manifest.webmanifest','utf8'));
  assert.equal(manifest.id,'./');assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.short_name,'ABC MSA');assert.match(manifest.name,/Ministry Service App/);
  assert.match(msaBrand(),/assets\/abc-movement-logo.png/);assert.match(msaBrand(),/MINISTRY<br>SERVICE APP/);
  for(const file of ['admin.html','mentor.html','index.html','a1.html'])assert.match(readFileSync(file,'utf8'),/<title>ABC \| Ministry Service App/);
  for(const programFile of ['reports.js','app.js'])assert.match(readFileSync(programFile,'utf8'),/GOES TO SCHOOL|Goes to School/);
  assert.match(readFileSync('sw.js','utf8'),/msa-brand.js/);
});
test('Reusable username fields and Admin pilot use username broker, opaque admission and server policy',async()=>{
  assert.match(usernameFields(),/autocomplete="username"/);assert.doesNotMatch(usernameFields(),/type="email"/);assert.throws(()=>usernameFields({nameId:'bad"id'}));
  const calls=[],token='a'.repeat(43),identity={uid:'fictional-pilot',mode:'emulator-lokal',role:'pic',actions:['pairing:read']};
  const client=createAdminClient(()=>{},{request:async(path,options)=>{calls.push({path,options});return {status:200,ok:true,json:async()=>path==='/api/a1/login'?{token,uid:identity.uid}:path.endsWith('logout')?{signedOut:true}:identity};}});
  await client.login('pilot.pic','Fictional-password',{username:true});assert.equal(client.state.phase,'active');assert.equal(client.state.role,'pic');assert.equal(client.state.token,undefined);
  assert.deepEqual(JSON.parse(calls[0].options.body),{username:'pilot.pic',password:'Fictional-password'});assert.equal(calls[0].path,'/api/a1/login');assert.equal(calls[1].path,'/api/admin/session');assert.equal(calls[1].options.headers.Authorization,'Bearer '+token);
  await client.logout();assert.equal(client.state.phase,'signed-out');
});
