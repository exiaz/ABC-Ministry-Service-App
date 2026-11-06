import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sources, categories, areas, findings, recommendations, verdict, filterSources, filterFindings, parseRoute} from '../ui/review-data.js';
import {createPrototypeServer} from '../server.mjs';

test('Review data distinguishes unavailable evidence, unassessed scores and zero findings', () => {
  assert.equal(sources.length, 8);
  assert.equal(sources.filter(s => s.availability === 'available').length, 4);
  assert.equal(sources.filter(s => s.availability === 'unavailable').length, 4);
  assert.equal(sources.filter(s => s.selectedDirection).length, 1);
  assert.equal(sources.find(s => s.selectedDirection).id, areas.absensi.referenceDirectionId);
  assert.equal(categories.length, 8);
  assert(categories.every(c => c.rating === null));
  assert.deepEqual(findings, []);assert.deepEqual(recommendations, []);assert.equal(verdict, null);
});
test('Review filters combine query, area and availability without inventing records', () => {
  assert.equal(filterSources({query:'  MENTOR ',area:'absensi',status:'unavailable'})[0].id,'user-reference-4');
  assert.equal(filterSources({area:'rundown',status:'unavailable'}).length,1);
  assert.equal(filterSources({query:'not-present'}).length,0);
  assert.equal(filterSources().length,8);
  assert.deepEqual(filterFindings({priority:'P0'}),[]);
  assert.equal(parseRoute('').view,'tinjauan');
  assert.equal(parseRoute('#/sumber?source=c10-preview').params.get('source'),'c10-preview');
  assert.equal(parseRoute('#/unknown').view,'unknown');
});
test('Review entry and exact assets are served without opening arbitrary project paths', async () => {
  const server=createPrototypeServer({review:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    for(const path of ['/','/index.html','/ui/review.js','/ui/review-data.js','/ui/review.css','/ui/review-kit.css','/ui/review-charts.js','/docs/ui-overhaul/C10-preview.png','/docs/ui-overhaul/BRIEF.md']) {
      const response=await fetch(base+path);assert.equal(response.status,200,path);await response.arrayBuffer();
    }
    for(const path of ['/.taste/page.json','/.env','/AGENTS.md'])assert.equal((await fetch(base+path)).status,404,path);
    const kit=await readFile(new URL('../ui/review-kit.css',import.meta.url),'utf8');
    assert(kit.startsWith('/* tasteskill v2.5 app.css (MIT License'));
    assert(!kit.includes('"Inter"'));assert(!kit.includes('"Geist"'));
  } finally {await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
});
