import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPrototypeServer} from '../server.mjs';
import * as data from '../ui/pil-data.js';

test('Pil fixture reconciles program, group, session and slot denominators',()=>{
 assert(data.dataChecks.every(c=>c.ok));
 assert.equal(data.students.length,148);assert.equal(data.sessions.length,36);assert.equal(data.attendance.length,888);
 assert.equal(data.attendance.filter(r=>r.status==='present').length,726);
 assert.deepEqual(data.countStatuses(data.sessionRoster()),{present:18,excused:2,absent:0,unmarked:4});
 assert.equal(data.weeklyRows().at(-1).total,148);assert.equal(data.weeklyRows(data.groups[2].id).at(-1).total,24);
 const source=data.sessionRoster(),changed=data.sessionRoster(undefined,{[source[2].id]:'absent'});
 assert.equal(data.countStatuses(changed).absent,1);assert.equal(data.countStatuses(data.sessionRoster()).absent,0);
 assert.equal(data.percent(0,0),null);assert.equal(data.percent(0,24),0);
});
test('Pil search combines filters without mutating source records',()=>{
 assert.equal(data.filterServices({status:'draft'}).length,3);
 assert.equal(data.filterServices({query:'  PAKEL ',status:'published'}).length,2);
 assert.equal(data.filterServices({status:'draft',organization:data.organizations[1].id}).length,2);
 assert.equal(data.filterServices({query:'tidak cocok'}).length,0);
 assert.equal(data.filterServices({from:'2026-11-06',to:'2026-11-06'}).length,2);
 assert.equal(data.services.length,7);
});
test('Pil entry serves exact public assets, archives the prior review, and keeps protected paths closed',async()=>{
 const server=createPrototypeServer({review:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const path of ['/','/ui/pil.js','/ui/pil-data.js','/ui/pil.css','/ui/pil-kit.css','/ui/pil-charts.js','/assets/msa-auth-documentation.png','/ui-review.html']){const response=await fetch(base+path);assert.equal(response.status,200,path);await response.arrayBuffer();}
  for(const path of ['/.env','/.taste/page.json','/AGENTS.md','/backend/msa-portal-session.mjs','/mentor-account.html','/api/portal/login'])assert.equal((await fetch(base+path)).status,404,path);
  const charts=await readFile(new URL('../ui/pil-charts.js',import.meta.url));assert.deepEqual(charts,await readFile(new URL('../.taste/app-kit/charts.js',import.meta.url)));
  const css=await readFile(new URL('../ui/pil-kit.css',import.meta.url),'utf8');assert(css.startsWith('/* tasteskill v2.5 app.css (MIT License'));assert(!css.includes('"Inter"'));
 }finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
});
