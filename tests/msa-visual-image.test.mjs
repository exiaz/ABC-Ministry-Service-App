import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {sanitizeVisualPng} from '../backend/msa-visual-image.mjs';
const sig=Buffer.from([137,80,78,71,13,10,26,10]);
function crc(data){let c=0xffffffff;for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);t.copy(b,4);data.copy(b,8);b.writeUInt32BE(crc(Buffer.concat([t,data])),8+data.length);return b;}
function png({width=2,height=1,filter=0,extra=[],color=6,depth=8}={}){const h=Buffer.alloc(13);h.writeUInt32BE(width);h.writeUInt32BE(height,4);h[8]=depth;h[9]=color;const raw=Buffer.alloc((width*4+1)*height);for(let i=0;i<height;i++)raw[i*(width*4+1)]=filter;return Buffer.concat([sig,chunk('IHDR',h),...extra,chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
test('Visual PNG decoder rebuilds bounded raster and removes metadata',()=>{const raw=png({extra:[chunk('tEXt',Buffer.from('location\0private'))]}),result=sanitizeVisualPng(raw);assert.equal(result.width,2);assert.equal(result.height,1);assert.equal(result.contentType,'image/png');assert.equal(result.bytes.includes(Buffer.from('private')),false);assert.deepEqual(sanitizeVisualPng(result.bytes).bytes,result.bytes);});
test('Visual PNG decoder rejects malformed, oversized, invalid raster and animation',()=>{const invalid=png();invalid[20]^=1;for(const data of [Buffer.from('<svg/>'),Buffer.alloc(5*1024*1024+1),invalid,png({width:4097}),png({filter:5}),png({depth:16}),png({extra:[chunk('acTL',Buffer.alloc(8))]}),Buffer.concat([png(),Buffer.from('trailing')])])assert.throws(()=>sanitizeVisualPng(data),e=>e.status===400);});
