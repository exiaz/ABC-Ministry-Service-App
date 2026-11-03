// Targeted admin/gender/birthday/XLSX checks; isolated profile, fictional data only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {createPrototypeServer} from '../server.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {seed,KEY,getSession} from '../data.js';
import {saveRegisteredStudent} from '../student-data.js';
import {saveService} from '../scheduling.js';
import {buildWorkbook} from '../xlsx.js';
import {studentExportData,attendanceExportData} from '../reports.js';
const require=createRequire(import.meta.url);let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}const dir=path.resolve('qa-artifacts/admin-revision');await mkdir(dir,{recursive:true});
const fixture=seed();fixture.authorized=true;fixture.mentorPreferences={schoolId:'s1',groupId:'g13'};
for(const [id,name,schoolId,groupId,gender,dateOfBirth] of [
  ['qa-female','Anak Fiktif Éléna','s1','g13','female','2016-10-03'],['qa-male','Anak Fiktif Budi','s2','g4','male','2015-11-20'],['qa-empty','Anak Fiktif C','s1','g13','male',null],['qa-today','Anak Fiktif Hari Ini','s1','g1','female','2014-10-21']]){
  saveRegisteredStudent(fixture,{name,schoolClass:'3A',schoolId,groupId,gender,dateOfBirth,guardianName:id==='qa-female'?'Wali Fiktif Privat':null,address:id==='qa-female'?'Alamat Fiktif Privat':null},{newId:id,admin:true});
}
fixture.mentorConfigRevision=2;fixture.mentors.push({id:'demo-raka',name:'Kak Raka'});fixture.defaultMentorAssignments.push({id:'legacy-plan',groupId:'g1',mentorId:'demo-raka',effectiveFrom:'2026-11-01'});
const current=getSession(fixture,'g1','demo-pakel-2026-10-23');current.records[0].status='excused';current.records[0].schoolClass='3A';
const visit=saveService(fixture,{schoolId:'s1',date:'2026-10-16',groupIds:fixture.groups.filter(g=>g.schoolId==='s1'&&!g.retired).map(g=>g.id)});getSession(fixture,'g13',visit.id);
const oldSessions=structuredClone(fixture.sessions);
const importRows=[['ID siswa','Nama lengkap','Sekolah','Kelas sekolah','Kelompok ABC','Jenis kelamin','Tanggal lahir'],['import-001','Impor Fiktif Ñana','SDN Airlangga III','4B','Amos','Perempuan','42429'],['import-002','Impor Fiktif Danu','SDN Kertajaya IV','2','Amos','Laki-laki','']];
const importPath=path.join(dir,'import-source.xlsx');await writeFile(importPath,new Uint8Array(await buildWorkbook(importRows).arrayBuffer()));
const badPath=path.join(dir,'invalid-source.xlsx');await writeFile(badPath,new Uint8Array(await buildWorkbook([importRows[0],['bad-id','Impor Fiktif Salah','SDN Airlangga III','3','Hagai','Perempuan','']]).arrayBuffer()));
// Repack to DEFLATE + shared strings, as commonly produced by Excel.
await new Promise((resolve,reject)=>{
  const python=spawn('C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',['-X','utf8','-c',`import zipfile,xml.etree.ElementTree as E,sys
p=sys.argv[1]; ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'; E.register_namespace('',ns)
with zipfile.ZipFile(p) as z: files={n:z.read(n) for n in z.namelist()}
root=E.fromstring(files['xl/worksheets/sheet1.xml']); strings=[]
for cell in root.iter('{'+ns+'}c'):
 value=''.join(t.text or '' for t in cell.iter('{'+ns+'}t')); index=len(strings); strings.append(value)
 for child in list(cell): cell.remove(child)
 cell.set('t','s'); E.SubElement(cell,'{'+ns+'}v').text=str(index)
shared=E.Element('{'+ns+'}sst',count=str(len(strings)),uniqueCount=str(len(strings)))
for value in strings: E.SubElement(E.SubElement(shared,'{'+ns+'}si'),'{'+ns+'}t').text=value
files['xl/worksheets/sheet1.xml']=E.tostring(root,encoding='utf-8',xml_declaration=True); files['xl/sharedStrings.xml']=E.tostring(shared,encoding='utf-8',xml_declaration=True)
ct=E.fromstring(files['[Content_Types].xml']); E.SubElement(ct,'{http://schemas.openxmlformats.org/package/2006/content-types}Override',PartName='/xl/sharedStrings.xml',ContentType='application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml');files['[Content_Types].xml']=E.tostring(ct)
rels=E.fromstring(files['xl/_rels/workbook.xml.rels']);E.SubElement(rels,'{http://schemas.openxmlformats.org/package/2006/relationships}Relationship',Id='shared',Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings',Target='sharedStrings.xml');files['xl/_rels/workbook.xml.rels']=E.tostring(rels)
with zipfile.ZipFile(p,'w',zipfile.ZIP_DEFLATED) as z:
 for n,b in files.items(): z.writestr(n,b)
`,importPath],{windowsHide:true,stdio:'pipe'});let error='';python.stderr.on('data',s=>error+=s);python.once('error',reject);python.once('exit',code=>code?reject(Error(error)):resolve());
});
const server=createPrototypeServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;let browser;
try{
  await mkdir('screenshots',{recursive:true});
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width:1365,height:900},locale:'id-ID',timezoneId:'Asia/Jakarta',acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-21T05:00:00Z')});
  await page.addInitScript(({key,value})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(value));},{key:KEY,value:fixture});
  await page.goto('http://127.0.0.1:'+port+'/');
  const action=(name,id)=>page.locator(`[data-action="${name}"]${id?`[data-id="${id}"]`:''}`),submit=()=>page.locator('#modal button[type=submit]'),close=()=>page.locator('#modal .close').click(),db=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  await action('admin').first().click();await page.locator('#field-code').fill('ABC2026');await submit().click();
  await action('admin-tab','groups').click();assert.equal(await page.locator('tbody tr').count(),16);
  await page.locator('#groups-school').selectOption('s1');assert.equal(await page.locator('tbody tr').count(),8);
  await page.locator('#groups-group').selectOption('g13');assert.equal(await page.locator('tbody tr').count(),1);assert.match(await page.locator('tbody').innerText(),/Kak Louis/);
  await page.locator('#groups-school').selectOption('s2');assert.equal(await page.locator('#groups-group').inputValue(),'');assert.equal(await page.locator('tbody tr').count(),4);
  await action('assignment-edit','g4').click();assert.equal(await page.locator('#assignment-mentor option').count(),8);assert.ok(!(await page.locator('#assignment-mentor').innerText()).includes('Raka'));await close();
  assert.ok((await db()).defaultMentorAssignments.find(a=>a.id==='legacy-plan').disabledFrom);
  await page.screenshot({path:'screenshots/admin-group-filters.png',fullPage:true});
  await action('admin-tab','students').click();await action('student-form').filter({hasText:'Tambah siswa'}).click();
  assert.equal(await page.locator('[name=gender]').count(),2);assert.equal(await page.locator('[name=gender]:checked').count(),0);
  await page.locator('#field-name').fill('Siswa Fiktif Form Gender');await page.locator('#field-schoolClass').fill('5B');await page.locator('#student-school').selectOption('s3');await page.locator('#student-group').selectOption('g18');
  const before=(await db()).students.length;await submit().click();assert.equal((await db()).students.length,before);
  await page.locator('[name=gender][value=female]').check();await submit().click();assert.equal((await db()).students.at(-1).gender,'female');
  // Context-preserving mentor form requires explicit gender and no private fields.
  await action('mentor').first().click();await action('calendar-toggle').click();await action('calendar-date','2026-10-16').click();await action('continue-date').click();await action('select-group','g13').click();await action('add-provisional').click();
  assert.equal(await page.locator('#modal select').count(),0);assert.equal(await page.locator('[name=gender]:checked').count(),0);assert.match(await page.locator('.student-context').innerText(),/Hagai · Kak Louis/);
  await page.locator('#field-name').fill('Siswa Fiktif Sementara Gender');await page.locator('#field-schoolClass').fill('2A');await page.locator('[name=gender][value=male]').check();await submit().click();
  let stored=await db(),temporary=stored.provisionals.at(-1),batch=structuredClone(stored.sessions.find(s=>s.id===temporary.sessionId));
  await action('admin').first().click();await action('admin-tab','students').click();await action('review-provisionals').click();await action('approve-provisional',temporary.id).click();assert.equal(await page.locator('[name=gender][value=male]').isChecked(),true);await submit().click();await close();
  stored=await db();assert.equal(stored.students.find(s=>s.id===temporary.id).gender,'male');assert.deepEqual(stored.sessions.find(s=>s.id===temporary.sessionId),batch);
  await action('admin-tab','birthdays').click();assert.match(await page.locator('h1').innerText(),/Ulang Tahun Siswa/);
  await page.locator('#birthday-school').selectOption('s1');await page.locator('#birthday-group').selectOption('g13');assert.match(await page.locator('section.panel').filter({hasText:'Ulang tahun bulan terpilih'}).innerText(),/Anak Fiktif Éléna/);
  await page.locator('#birthday-month').selectOption('11');assert.match(await page.locator('section.panel').filter({hasText:'Ulang tahun bulan terpilih'}).innerText(),/Tidak ada siswa/);
  await page.locator('#birthday-school').selectOption('s2');assert.equal(await page.locator('#birthday-group').inputValue(),'');assert.match(await page.locator('.birthday-upcoming').innerText(),/Anak Fiktif Budi/);
  await page.screenshot({path:'screenshots/admin-birthdays-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'screenshots/admin-birthdays-mobile.png',fullPage:true});await page.setViewportSize({width:1365,height:900});
  async function download(type,scope,name){
    await action('export').click();await page.locator('#export-type').selectOption(type);await page.locator('#export-scope').selectOption(scope);
    const output=path.join(dir,name),event=page.waitForEvent('download');await submit().click();await(await event).saveAs(output);return output;
  }
  async function rowsIn(file){return page.evaluate(async bytes=>{const {readWorkbook}=await import('./xlsx-reader.js');return (await readWorkbook(new Blob([new Uint8Array(bytes)]))).rows;},Array.from(await readFile(file)));}
  const strings=rows=>rows.map(row=>row.map(value=>String(value??'')));
  await action('admin-tab','students').click();const publicFile=await download('students','all','students-public.xlsx');
  let publicRows=await rowsIn(publicFile);assert.deepEqual(publicRows,strings(studentExportData(await db(),{admin:true,scope:'all'}).rows));assert.ok(!JSON.stringify(publicRows).includes('Wali Fiktif Privat'));
  const privateFile=await download('private-students','all','students-private.xlsx');const privateExpected=strings(studentExportData(await db(),{admin:true,scope:'all',privateProfiles:true}).rows);assert.deepEqual(await rowsIn(privateFile),privateExpected);
  await page.locator('#filter-school').selectOption('s1');await page.locator('#admin-search').fill('Éléna');
  const filteredFile=await download('students','filtered','students-filtered.xlsx');const filteredRows=await rowsIn(filteredFile);assert.equal(filteredRows.length,5);assert.equal(filteredRows[4][0],'qa-female');
  // Importing an unchanged actual export must keep all IDs, unknown legacy gender and attendance.
  async function importFile(file){await action('import-students').click();await page.locator('#student-import-file').setInputFiles(file);await page.waitForFunction(()=>/baru.*diperbarui.*tetap/.test(document.querySelector('#import-preview').innerText)||document.querySelector('#import-error').textContent);const message=await page.locator('#import-error').innerText();assert.equal(message,'');}
  const existingIds=(await db()).students.map(s=>s.id);await importFile(publicFile);assert.equal(await page.locator('#commit-import').isDisabled(),false);await submit().click();assert.deepEqual((await db()).students.map(s=>s.id),existingIds);
  await importFile(importPath);assert.match(await page.locator('#import-preview').innerText(),/2 baru/);await submit().click();
  stored=await db();assert.equal(stored.students.find(s=>s.id==='import-001').gender,'female');assert.equal(stored.studentPrivateProfiles['import-001'].dateOfBirth,'2016-02-29');
  await importFile(importPath);assert.match(await page.locator('#import-preview').innerText(),/0 baru.*0 diperbarui.*2 tetap/);await submit().click();assert.equal((await db()).students.filter(s=>s.id==='import-001').length,1);
  await importFile(badPath);assert.equal(await page.locator('#commit-import').isDisabled(),true);await close();
  await action('admin-tab','overview').click();await page.locator('#filter-school').selectOption('s1');await page.locator('#filter-date').selectOption('demo-pakel-2026-10-23');await page.locator('#filter-group').selectOption('g1');
  assert.match(await page.locator('tbody').innerText(),/Berlangsung|Draf/);
  const attendanceFile=await download('attendance','filtered','attendance-filtered.xlsx');assert.deepEqual(await rowsIn(attendanceFile),strings(attendanceExportData(await db(),{schoolId:'s1',month:'2026-10',serviceSessionId:'demo-pakel-2026-10-23',groupId:'g1'}).rows));
  const allAttendance=await download('attendance','all','attendance-all.xlsx');assert.deepEqual(await rowsIn(allAttendance),strings(attendanceExportData(await db(),{},'all').rows));
  stored=await db();for(const session of oldSessions)if(session.id!==batch.id)assert.deepEqual(stored.sessions.find(s=>s.id===session.id),session);
  await action('mentor').first().click();assert.equal(await action('admin-tab','birthdays').count(),0);const mentorText=await page.locator('body').innerText();for(const privateText of ['Wali Fiktif Privat','Alamat Fiktif Privat','2016-10-03','3 Oktober 2016'])assert.ok(!mentorText.includes(privateText));
  await page.reload();assert.ok((await db()).students.some(s=>s.id==='import-001'));
  assert.deepEqual(errors,[]);await writeFile(path.join(dir,'expected-export-rows.json'),JSON.stringify({public:publicRows,private:privateExpected}));
  console.log('Admin browser checks passed: dependent group filters, 8 mentors, mandatory gender/approval, birthday month/school/group/mobile, public/private XLSX accuracy, compressed/shared-string import + re-import, stable IDs/history.');
}finally{await browser?.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
