import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {listen} from '../local-demo.mjs';
import {sanitizeVisualPng} from '../backend/msa-visual-image.mjs';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}

test('Browser converts PNG/JPEG/WebP and compresses oversized pixels/bytes into server-validated PNG',{timeout:120000},async()=>{
  const source=await readFile(new URL('../visual-image-client.js',import.meta.url));
  const server=await listen(http.createServer((req,res)=>{res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/html');res.end(req.url.endsWith('.js')?source:'<!doctype html><title>Fixture gambar fiktif</title>');}),0);let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
    const results=await page.evaluate(async()=>{
      const {prepareVisualImage}=await import('/visual-image-client.js'),canvas=document.createElement('canvas');canvas.width=320;canvas.height=200;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#296dab';ctx.fillRect(0,0,320,200);
      const encode=type=>new Promise(resolve=>canvas.toBlob(resolve,type));
      const summarize=async result=>({...result,blob:undefined,image:await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(result.blob);})});
      const results=[];
      for(const type of ['image/png','image/jpeg','image/webp']){const blob=await encode(type);if(blob.type!==type)throw Error('Codec not available');results.push(await summarize(await prepareVisualImage(new File([blob],'fictional',{type}))));}
      canvas.width=2400;canvas.height=2000;const pixels=ctx.createImageData(canvas.width,canvas.height);
      for(let offset=0;offset<pixels.data.length;offset+=65536)crypto.getRandomValues(pixels.data.subarray(offset,Math.min(offset+65536,pixels.data.length)));
      ctx.putImageData(pixels,0,0);const large=await encode('image/png');results.push(await summarize(await prepareVisualImage(new File([large],'large.png',{type:'image/png'}))));
      results.push(await summarize(await prepareVisualImage(new File([large],'large.png'),{maxDimension:1280})));
      for(const file of [new File(['<svg/>'],'fake.png',{type:'image/png'}),new File([new Uint8Array(25*1024*1024+1)],'huge.jpg',{type:'image/jpeg'}),new File([new Uint8Array([255,216,255,0])],'broken.jpg',{type:'image/jpeg'})]){
        let rejected=false;try{await prepareVisualImage(file);}catch{rejected=true;}if(!rejected)throw Error('Invalid input accepted');
      }
      return results;
    });
    assert.deepEqual(results.slice(0,3).map(result=>result.format),['PNG','JPEG','WebP']);
    for(const result of results){const data=Buffer.from(result.image,'base64');let offset=8,chunks=0;while(offset+12<=data.length){chunks++;offset+=data.readUInt32BE(offset)+12;}console.log({format:result.format,size:data.length,chunks,width:result.width,height:result.height});const png=sanitizeVisualPng(data);assert.equal(png.width,result.width);assert.equal(png.height,result.height);assert.ok(png.bytes.length<=5*1024*1024);assert.ok(result.width*result.height<=4_000_000);}
    assert.ok(results[3].originalBytes>5*1024*1024);assert.ok(results[3].width<results[3].originalWidth);assert.ok(results[4].width<=1280);
  }finally{await browser?.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
});
