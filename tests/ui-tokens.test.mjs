import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const tokens=readFileSync(new URL('../ui/msa-tokens.css',import.meta.url),'utf8');
const components=readFileSync(new URL('../ui/msa-components.css',import.meta.url),'utf8');
const token=name=>{const m=tokens.match(new RegExp('--'+name+':(#[0-9a-f]{6})','i'));assert.ok(m,'token '+name);return m[1];};
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const lum=hex=>{const [r,g,b]=rgb(hex).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;};
const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05);};

test('Token blue-pale = 24% accent-3 di atas putih',()=>{
  const base=rgb(token('accent-3')).map(v=>.24*v+.76);
  const hex='#'+base.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
  assert.equal(hex,token('blue-pale'));
});

test('Pasangan token memenuhi kontras WCAG yang dijanjikan BRIEF',()=>{
  const white=token('surface-100');
  const pairs=[ // [teks, latar, minimum, nama]
    ['ink','accent-3',6.1,'ink/accent-3'],['surface-100','primary',5.74,'putih/primary'],
    ['ink','accent-yellow',13.3,'ink/accent-yellow'],['ink','blue-pale',13.2,'ink/blue-pale'],
    ['ink-muted','blue-pale',6.0,'ink-muted/blue-pale'],['accent-3-text','blue-pale',5.4,'accent-3-text/blue-pale'],
    ['primary','surface-200',5.4,'primary/surface-200'],['primary','blue-pale',4.64,'primary/blue-pale'],
    ['ink-muted','surface-200',7.0,'ink-muted/surface-200'],['control-border','surface-100',4.16,'control-border/putih'],
    // pasangan komponen di luar daftar BRIEF
    ['ink','surface-200',4.5,'ink/surface-200'],['ink-muted','surface-100',4.5,'ink-muted/putih'],
    ['primary','surface-100',4.5,'primary/putih (badge Dibatalkan)'],['accent-3-text','surface-100',4.5,'accent-3-text/putih'],
    ['accent-3-text','surface-200',4.5,'accent-3-text/surface-200'],['disabled-ink','disabled-bg',4.5,'teks nonaktif'],
    ['ink-muted','disabled-bg',4.5,'ink-muted/line (nonaktif)'],
    ['primary-hover','surface-100',4.5,'putih/primary-hover'],['accent-3-text','accent-yellow',4.5,'(info)'],
  ];
  for(const [fg,bg,min,name] of pairs){
    if(!min)continue;
    if(name==='putih/primary-hover'){assert.ok(ratio(white,token('primary-hover'))>=4.5,name);continue;}
    assert.ok(ratio(token(fg),token(bg))>=min-.05,`${name}: ${ratio(token(fg),token(bg)).toFixed(2)} < ${min}`);
  }
  // Biru dan kuning di atas putih hanya untuk bentuk grafis (>= 3 tidak dijamin untuk teks).
  assert.ok(ratio(token('accent-3'),white)<3&&ratio(token('accent-yellow'),white)<3);
  // Tepi kontrol minimal 3:1.
  assert.ok(ratio(token('control-border'),white)>=3);
  assert.ok(ratio(token('ink'),token('accent-yellow'))>=3,'tepi ink pada kuning');
});

test('Komponen: semua class berawalan ui-, tanpa sudut 8/16px pada tombol, input, chip',()=>{
  const selectors=components.replace(/\/\*[\s\S]*?\*\//g,'').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g,'').match(/\.[A-Za-z_][\w-]*/g)??[];
  const bad=[...new Set(selectors)].filter(s=>!s.startsWith('.ui-')&&!/^\.\d/.test(s)&&!['.is-yellow','.is-pale','.is-selected'].includes(s));
  assert.deepEqual(bad,[]);
  assert.doesNotMatch(components,/border-radius:\s*(8|16)px/);
  // Latest D0 replaces the historical C10 dimensions; contrast checks stay intact.
  for(const v of ['--radius-pill:999px','--radius-lg:32px','--radius-xl:40px','--nav-height:72px','--fab-size:56px','--control-primary:60px','--nav-clearance:112px'])assert.ok(tokens.includes(v),v);
});

test('Berkas aset ada dan diizinkan server statis tanpa mengubah header keamanan',()=>{
  for(const f of ['assets/fonts/baloo2-latin.woff2','assets/fonts/nunito-sans-latin.woff2','assets/fonts/OFL-Baloo2.txt','assets/fonts/OFL-NunitoSans.txt','assets/icons/ui-sprite.svg','assets/icons/LICENSE-lucide.txt','ui-gallery.html'])assert.ok(existsSync(new URL('../'+f,import.meta.url)),f);
  const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8'),admin=readFileSync(new URL('../admin-server.mjs',import.meta.url),'utf8');
  for(const f of ['ui/msa-tokens.css','ui/msa-components.css','ui/msa-auth.css','assets/fonts/baloo2-latin.woff2','assets/fonts/nunito-sans-latin.woff2','assets/icons/ui-sprite.svg']){assert.ok(server.includes(f),'server '+f);assert.ok(admin.includes(f),'admin '+f);}
  assert.match(server,/'\.woff2':'font\/woff2'/);assert.match(admin,/woff2'\)\?'font\/woff2'/);
  assert.match(admin,/ABC_MSA_UI_GALLERY==='1'/);
  // Ikon sprite: setiap symbol yang dirujuk galeri tersedia.
  const sprite=readFileSync(new URL('../assets/icons/ui-sprite.svg',import.meta.url),'utf8'),html=readFileSync(new URL('../ui-gallery.html',import.meta.url),'utf8');
  for(const id of new Set([...html.matchAll(/ui-sprite\.svg#(ui-i-[\w-]+)/g)].map(m=>m[1])))assert.ok(sprite.includes('id="'+id+'"'),id);
});

test('Pil: token tipografi, jarak dan fokus dua warna memenuhi D0',()=>{
 for(const value of ['--type-hero:800 48px/52px var(--font-display)','--type-subtitle:700 24px/28px var(--font-display)','--type-row:600 16px/20px var(--font-body)','--type-body:400 16px/24px var(--font-body)','--gap-row:8px','--gap-card:10px','--pad-card:16px','--pad-screen:24px'])assert.ok(tokens.includes(value),value);
 for(const [a,b] of [['focus-ring','surface-100'],['surface-100','primary'],['surface-100','ink']]){
  const contrast=ratio(token(a),token(b));assert.ok(contrast>=3,a+'/'+b);console.log(a+'/'+b+': '+contrast.toFixed(2)+':1');
 }
 assert.match(components,/outline:3px solid var\(--focus-ring\);outline-offset:2px;box-shadow:0 0 0 2px #fff/);
});
