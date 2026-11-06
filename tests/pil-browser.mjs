import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createPrototypeServer} from '../server.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=createPrototypeServer({review:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;let browser;
const results={viewports:[],fonts:null,digits:null,assertions:0,interactions:[]},errors=[];
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='assert')errors.push(m.text());});
 await mkdir('.emulator-data/pil-build',{recursive:true});
 await page.goto(base);await page.locator('.auth-copy').waitFor();
 assert.equal(await page.locator('h1').count(),1);await page.screenshot({path:'.emulator-data/pil-build/welcome-desktop.png',fullPage:true});
 await page.getByRole('link',{name:'Masuk',exact:true}).click();await page.locator('#pil-username').fill('fictional.user');await page.locator('#pil-password').fill('fictional-password');
 await page.getByRole('button',{name:'Tampilkan',exact:true}).click();assert.equal(await page.locator('#pil-password').getAttribute('type'),'text');
 await page.locator('#pil-submit').click();await page.getByText('Layanan masuk belum tersedia.',{exact:false}).waitFor();assert.equal(await page.locator('#pil-password').inputValue(),'');assert.equal(page.url().split('#')[1],'/masuk');results.interactions.push('No fake login success; password cleared');
 await page.goto(base+'/#/beranda');await page.locator('.service-card').first().waitFor();assert.equal(await page.locator('.service-card').count(),6);await page.screenshot({path:'.emulator-data/pil-build/admin-desktop.png',fullPage:true});
 await page.goto(base+'/#/pelayanan');await page.locator('#service-search').fill('DRAMA');assert.equal(await page.locator('.service-card').count(),1);
 await page.getByRole('button',{name:'Atur ulang',exact:true}).click();assert.equal(await page.locator('.service-card').count(),7);
 await page.getByRole('button',{name:'Filter',exact:true}).click();await page.locator('#filter-status').selectOption('draft');await page.locator('#filter-org').selectOption('test-org-yayasan');await page.getByRole('button',{name:'Terapkan',exact:true}).click();assert.equal(await page.locator('.service-card').count(),2);
 await page.getByRole('button',{name:'Filter',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.getByRole('button',{name:'Filter',exact:true}).evaluate(e=>e===document.activeElement),true);await page.locator('.service-card').first().click();await page.locator('.service-detail').waitFor();await page.goBack();await page.locator('.service-card').first().waitFor();assert.equal(await page.locator('.service-card').count(),2);await page.goForward();await page.locator('.service-detail').waitFor();results.interactions.push('Service query, AND filters, reset, Escape, focus return, Back and Forward');
 await page.goto(base+'/#/kalender');assert.equal(await page.locator('.service-card').count(),2);await page.locator('[data-day="2026-11-03"]').click();assert.equal(await page.locator('.service-card').count(),0);await page.getByRole('button',{name:'Pekan berikutnya'}).click();await page.getByRole('button',{name:'Pekan ini',exact:true}).click();results.interactions.push('Calendar date, empty day, week navigation');
 await page.goto(base+'/#/absensi');assert.equal(await page.locator('.student-row').count(),24);await page.locator('#student-search').fill('citra');assert.equal(await page.locator('.student-row').count(),1);await page.locator('[data-student]').click();await page.getByRole('button',{name:'Tidak hadir',exact:true}).click();assert.match(await page.locator('.student-status').innerText(),/Tidak hadir/);await page.locator('#student-search').fill('');await page.locator('[data-status-filter="unmarked"]').click();assert.equal(await page.locator('.student-row').count(),3,JSON.stringify(await page.evaluate(()=>({q:document.querySelector('#student-search').value,text:document.querySelector('#absensi-siswa').innerText}))));assert.equal(await page.getByRole('button',{name:'Tinjau & selesaikan',exact:true}).isDisabled(),true);await page.locator('[data-status-filter=""]').click();for(const q of ['al','bi','ci','els',''])await page.locator('#student-search').fill(q);assert.equal(await page.locator('.student-row').count(),24);results.interactions.push('Student search, rapid input, status dialog, absent enum, recomputed counts and disabled writes');
 await page.goto(base+'/#/dasbor');await page.locator('#attendance-chart svg').waitFor();await page.locator('#group').selectOption('test-group-3');assert.match(await page.locator('.dashboard-main').innerText(),/24 siswa/);await page.locator('[data-chart-week="2026-10-02"]').click();await page.getByRole('button',{name:'Volunteer',exact:true}).click();assert.equal(await page.locator('.slot-row').count(),3);await page.getByRole('button',{name:'Anak',exact:true}).click();await page.locator('#period').selectOption('1');assert.equal(await page.locator('[data-chart-week]').count(),1);results.interactions.push('Dashboard metric tab, group, selected week and period');
 for(const width of [360,390,768,1440]){
  await page.setViewportSize({width,height:900});
  await page.goto(base+'/#/absensi');
  const filters=page.locator('.student-tools .segmented button');
  assert(await filters.evaluateAll(nodes=>nodes.every(e=>e.scrollWidth<=e.clientWidth+1)),`${width}: attendance filter labels fit`);
  for(const key of ['Space','Enter']){
   const target=page.locator('[data-status-filter="unmarked"]');await target.focus();const scroll=await target.evaluate(e=>e.parentElement.scrollLeft);await page.keyboard.press(key);
   assert(await target.evaluate(e=>e===document.activeElement),`${width}: status filter retains focus`);
   assert.equal(await target.getAttribute('aria-pressed'),'true');
   assert(Math.abs(await target.evaluate(e=>e.parentElement.scrollLeft)-scroll)<1,`${width}: filter scroll retained`);
  }
  await page.locator('[data-status-filter=""]').click();
  await page.goto(base+'/#/dasbor');await page.getByRole('button',{name:'Anak',exact:true}).click();await page.locator('#period').selectOption('6');
  for(const selector of ['[data-chart-week="2026-10-02"]','[data-action="tab-volunteer"]','[data-action="tab-anak"]']){
   const target=page.locator(selector).first();await target.focus();await page.keyboard.press('Space');
   assert(await target.evaluate(e=>e===document.activeElement),`${width}: ${selector} retains focus`);
   assert.equal(await target.getAttribute('aria-pressed'),'true');
  }
  results.assertions+=13;
 }
 results.interactions.push('Filter labels fit; status, chart and dashboard tab focus retained on keyboard activation');
 const routes=['welcome','masuk','admin','mentor','absensi','dasbor','pelayanan','kalender','jadwal','riwayat','akun','perangkat','missing'];
 for(const width of [360,390,768,1100,1365,1440]){
  await page.setViewportSize({width,height:900});
  for(const route of routes){await page.goto(base+'/#/'+route);await page.locator('h1').waitFor();await page.evaluate(()=>document.fonts.ready);
   const audit=await page.evaluate(()=>({h1:document.querySelectorAll('h1').length,overflow:document.documentElement.scrollWidth>innerWidth+1,small:[...document.querySelectorAll('a,button,input,select,summary,[role="button"]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<48-.1||r.height<48-.1)}).map(e=>({text:(e.textContent||e.getAttribute('aria-label')||e.id).trim().slice(0,35),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))}));
   assert.equal(audit.h1,1,`${width} ${route}: h1`);assert.equal(audit.overflow,false,`${width} ${route}: overflow ${JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,cls:e.className,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})).filter(e=>e.right>innerWidth+1||e.left< -1).slice(0,15)))}`);assert.deepEqual(audit.small,[],`${width} ${route}: targets ${JSON.stringify(audit.small)}`);results.assertions+=3;
   if(route==='pelayanan'){
    const layout=await page.locator('.filter-bar').evaluate(el=>{const input=el.querySelector('input').getBoundingClientRect(),bar=el.getBoundingClientRect();return {contained:input.left>=bar.left&&input.right<=bar.right+1,clear:[...el.querySelectorAll('button')].every(button=>{const r=button.getBoundingClientRect();return input.right<=r.left||r.right<=input.left||input.bottom<=r.top||r.bottom<=input.top;})};});
    assert.equal(layout.contained,true,`${width}: search stays inside filter bar`);assert.equal(layout.clear,true,`${width}: search does not overlap actions`);results.assertions+=2;
   }
   if(width===390&&['welcome','mentor','absensi','dasbor','pelayanan'].includes(route))await page.screenshot({path:`.emulator-data/pil-build/${route}-mobile.png`,fullPage:true});
  }results.viewports.push(width);
 }
 await page.setViewportSize({width:390,height:900});await page.goto(base+'/#/absensi');await page.locator('.student-row').nth(10).waitFor();const edit=page.locator('[data-student]').nth(10);await edit.scrollIntoViewIfNeeded();const oldScroll=await page.locator('.pil-canvas').evaluate(e=>e.scrollTop);await edit.click();await page.getByRole('button',{name:'Hadir',exact:true}).click();assert(Math.abs(await page.locator('.pil-canvas').evaluate(e=>e.scrollTop)-oldScroll)<2);results.interactions.push('Scroll retained after editing a student');
 for(const mode of ['empty','loading','error','zero']){await page.goto(base+'/?state='+mode+'#/dasbor');await page.locator('h1').waitFor();assert.equal(await page.locator('h1').count(),1);if(mode==='error'){await page.getByRole('button',{name:'Coba lagi',exact:true}).first().click();await page.locator('#attendance-chart').waitFor();}results.interactions.push('State '+mode);}
 await page.goto(base+'/#/beranda');await page.locator('h1').waitFor();
 results.fonts=await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([400,600,700,800].map(w=>document.fonts.load(`${w} 16px "Nunito Sans"`)));await Promise.all([700,800].map(w=>document.fonts.load(`${w} 28px "Baloo 2"`)));return {loaded:[...document.fonts].filter(f=>f.status==='loaded').map(f=>({family:f.family,weight:f.weight})),nunito:[400,600,700,800].map(w=>document.fonts.check(`${w} 16px "Nunito Sans"`)),baloo:[700,800].map(w=>document.fonts.check(`${w} 28px "Baloo 2"`))};});
 assert(results.fonts.nunito.every(Boolean)&&results.fonts.baloo.every(Boolean));assert(results.fonts.loaded.some(f=>f.family==='Nunito Sans'));assert(results.fonts.loaded.some(f=>f.family==='Baloo 2'));
 results.digits=await page.evaluate(()=>{const s=document.createElement('span');s.style.cssText='position:absolute;display:inline-block;font-size:28px;';document.body.append(s);const out={};for(const f of ['Nunito Sans','Baloo 2']){s.style.fontFamily='"'+f+'"';out[f]={};for(const variant of ['normal','tabular-nums']){s.style.fontVariantNumeric=variant;out[f][variant]=[...'0123456789'].map(d=>{s.textContent=d;return s.getBoundingClientRect().width});}}s.remove();return out;});
 assert(Math.max(...results.digits['Baloo 2']['tabular-nums'])-Math.min(...results.digits['Baloo 2']['tabular-nums'])<.1);assert(new Set(results.digits['Baloo 2'].normal).size>1);
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.btn').first().evaluate(e=>getComputedStyle(e).transitionDuration),'0s');results.interactions.push('Reduced motion');assert.deepEqual(errors,[]);
 await writeFile('.emulator-data/pil-build/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser?.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
