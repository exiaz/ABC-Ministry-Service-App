import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {createPrototypeServer} from '../server.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

test('Review browser: routes, filters, evidence, keyboard, mobile and reduced motion', async () => {
  const server=createPrototypeServer({review:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;let browser;
  try {
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='assert')errors.push(message.text());});
    await page.goto(base+'/ui-review.html');await page.locator('#tinjauan-ringkasan').waitFor();
    assert.equal(await page.locator('h1').count(),1);
    assert.equal(await page.locator('#tinjauan-scorecard li').count(),8);
    assert.equal((await page.locator('#tinjauan-scorecard').textContent()).match(/Belum dinilai/g)?.length,1);
    assert.equal(await page.locator('.select-field svg use').first().getAttribute('href'),'./assets/icons/ui-sprite.svg#ui-i-chevron-down');
    const desktopPair=await page.evaluate(()=>{
      const score=document.querySelector('#tinjauan-scorecard').getBoundingClientRect();
      const comparison=document.querySelector('#tinjauan-perbandingan').getBoundingClientRect();
      const list=document.querySelector('.baseline-list').getBoundingClientRect();
      const footer=document.querySelector('.comparison .panel-footer').getBoundingClientRect();
      return {height:score.height,bottomDifference:Math.abs(score.bottom-comparison.bottom),blankBand:footer.top-list.bottom};
    });
    assert(desktopPair.height<260);assert(desktopPair.bottomDifference<1);assert(desktopPair.blankBand<=40);
    await page.locator('#finding-priority').selectOption('P0');await page.locator('#reset-findings').click();
    assert.equal(await page.locator('#finding-priority').inputValue(),'');
    assert(await page.locator('#tinjauan-keputusan').evaluate(n=>n.getBoundingClientRect().top<900));
    await mkdir('.emulator-data/review-build',{recursive:true});
    await page.screenshot({path:'.emulator-data/review-build/desktop.png',fullPage:true});
    await page.locator('#tinjauan-ringkasan').getByRole('link',{name:'Periksa sumber',exact:true}).click();
    await page.locator('#source-search').fill('MENTOR');
    assert.equal(await page.locator('[data-source]').count(),1);
    await page.locator('[data-source]').click();assert(await page.locator('#source-detail').textContent().then(t=>t.includes('belum diverifikasi')||t.includes('Pemilihan bukan')));
    await page.locator('#source-status').selectOption('available');assert.equal(await page.locator('[data-source]').count(),0);
    await page.locator('#reset-sources').click();assert.equal(await page.locator('[data-source]').count(),8);
    await page.locator('#source-area').selectOption('rundown');await page.locator('#source-status').selectOption('unavailable');assert.equal(await page.locator('[data-source]').count(),1);
    await page.locator('#reset-sources').click();await page.locator('[data-source="c10-preview"]').click();
    await page.locator('#enlarge-image:not([disabled])').waitFor();await page.locator('#enlarge-image').click();
    assert(await page.locator('#image-dialog').evaluate(n=>n.open));await page.keyboard.press('Escape');
    assert.equal(await page.locator('#enlarge-image').evaluate(n=>n===document.activeElement),true);
    await page.route('**/docs/ui-overhaul/C10-preview.png*',route=>route.abort());
    await page.locator('[data-source="logo"]').click();await page.locator('[data-source="c10-preview"]').click();
    await page.locator('[data-retry-image]').waitFor();await page.unroute('**/docs/ui-overhaul/C10-preview.png*');
    await page.locator('[data-retry-image]').click();await page.locator('#enlarge-image:not([disabled])').waitFor();
    await page.locator('[data-source="tokens"]').click();await page.locator('#source-text pre').waitFor();
    for(const view of ['autentikasi','absensi','siswa','rundown']){
      await page.locator(`.nav a[href="#/${view}"]`).click();
      await page.locator('[data-topic]').first().waitFor();
      assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('[data-topic]').count(),4);
      await page.locator('[data-topic="1"]').click();assert.equal(await page.locator('[data-topic="1"]').getAttribute('aria-pressed'),'true');
    }
    await page.goto(base+'/ui-review.html#/missing');await page.getByRole('heading',{name:'Halaman tidak ditemukan',level:1}).waitFor();
    await page.getByRole('link',{name:'Kembali ke tinjauan'}).click();
    const font=await page.evaluate(async()=>{await document.fonts.ready;return {faces:[...document.fonts].filter(f=>f.family==='Nunito Sans'&&f.status==='loaded').length,weights:[400,500,700].map(w=>document.fonts.check(`${w} 14px "Nunito Sans"`))};});
    assert(font.faces>0);assert(font.weights.every(Boolean));
    console.log('FONT',JSON.stringify(font));
    console.log('DIGITS',JSON.stringify(await page.evaluate(()=>{
      const span=document.createElement('span');span.style.font='14px "Nunito Sans"';document.body.append(span);
      const measure=variant=>{span.style.fontVariantNumeric=variant;return [...'0123456789'].map(digit=>{span.textContent=digit;return span.getBoundingClientRect().width;});};
      const normal=measure('normal'),tabular=measure('tabular-nums');span.remove();return {normal,tabular};
    })));
    for(const width of [360,390,768,1365,1440]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${width}`);
      const small=await page.locator('a,button,input,select').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden').filter(n=>{const r=n.getBoundingClientRect();return r.width<48||r.height<48}).map(n=>({text:n.textContent,w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height})));
      assert.deepEqual(small,[],`small controls ${width}`);
      assert.equal(await page.locator('h1').count(),1);
      if(width===390){
        assert(await page.locator('.mobile-bar').textContent().then(text=>text.includes('ABC MSA')));
        const mobile=await page.evaluate(()=>{
          const rect=selector=>document.querySelector(selector).getBoundingClientRect();
          return {scoreHeight:rect('#tinjauan-scorecard').height,comparisonHeight:rect('#tinjauan-perbandingan').height,summaryHeight:rect('#tinjauan-ringkasan').height,footerGap:rect('.comparison .panel-footer').top-rect('.comparison-compact').bottom,headingAlignment:getComputedStyle(document.querySelector('.decision')).alignItems,actionAlignment:getComputedStyle(document.querySelector('.decision .panel-footer')).justifyContent};
        });
        assert(mobile.scoreHeight<250);assert(mobile.footerGap<=40);assert.equal(mobile.headingAlignment,'stretch');assert.equal(mobile.actionAlignment,'flex-start');
        assert(mobile.comparisonHeight<=mobile.summaryHeight,'Mobile evidence must not dominate the primary finding');
        assert.equal(await page.locator('.comparison .baseline-list').isVisible(),false);
        assert(await page.locator('.comparison-compact').textContent().then(text=>(text.match(/C10/g)||[]).length===1));
        await page.screenshot({path:'.emulator-data/review-build/mobile.png',fullPage:true});
        await page.locator('#tinjauan-perbandingan').getByRole('link',{name:'Lihat baseline'}).click();
        await page.locator('#enlarge-image:not([disabled])').waitFor();
        await page.goto(base+'/ui-review.html#/tinjauan');await page.locator('#tinjauan-ringkasan').waitFor();
      }
      if(width<=1100){assert.equal(await page.locator('.sidebar').isVisible(),false);await page.locator('#open-menu').click();assert.equal(await page.locator('.sidebar').getAttribute('role'),'dialog');await page.keyboard.press('Escape');assert.equal(await page.locator('#open-menu').evaluate(n=>n===document.activeElement),true);}
      for(const route of ['sumber','absensi']) {
        await page.goto(base+'/ui-review.html#/'+route);await page.locator('h1').filter({hasText:route==='sumber'?'Sumber':'Absensi'}).waitFor();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${route} overflow ${width}`);
        assert.equal(await page.locator('h1').count(),1);
      }
      await page.goto(base+'/ui-review.html#/tinjauan');await page.locator('#tinjauan-ringkasan').waitFor();
    }
    await page.setViewportSize({width:390,height:900});await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('#open-menu').click();await page.locator('.nav a[href="#/absensi"]').click();
    await page.locator('[data-topic="0"]').click();assert(await page.locator('#topic-detail').isVisible());
    await page.getByRole('button',{name:'Kembali ke pemeriksaan'}).click();assert(await page.locator('.topic-list').isVisible());
    await page.locator('#open-menu').click();await page.locator('.nav a[href="#/sumber"]').click();
    await page.locator('#source-search').fill('zzzz');assert.equal(await page.locator('[data-source]').count(),0);
    await page.locator('#reset-sources').click();assert.equal(await page.locator('[data-source]').count(),8);
    await page.locator('#open-menu').click();await page.locator('.nav a[href="#/sumber"]').click();
    assert.equal(await page.locator('.sidebar').isVisible(),false);
    await page.locator('#open-menu').click();
    await page.locator('.nav a[href="#/autentikasi"]').click();
    await page.goBack();await page.locator('#source-search').waitFor();
    await page.goForward();await page.locator('[data-topic]').first().waitFor();
    await page.route('**/ui/review-data.js',route=>route.abort());
    await page.goto(base+'/ui-review.html');await page.locator('#retry-app').waitFor();
    await page.unroute('**/ui/review-data.js');await page.locator('#retry-app').click();
    await page.locator('#tinjauan-ringkasan').waitFor();
    assert.deepEqual(errors,[]);
  } finally {await browser?.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
});
