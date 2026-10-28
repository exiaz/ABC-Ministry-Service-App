import {inflateSync,deflateSync} from 'node:zlib';

// Narrow pilot format: non-interlaced, 8-bit RGB/RGBA PNG only. All ancillary
// chunks are removed and compressed pixels are rebuilt after bounded decoding.
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const maxBytes=5*1024*1024,maxPixels=4_000_000,maxSide=4096;
const fail=()=>{throw Object.assign(Error('Gambar PNG tidak valid atau melebihi batas.'),{status:400});};
function crc32(data){let crc=0xffffffff;for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(name,data){const type=Buffer.from(name,'ascii'),out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length,0);type.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([type,data])),8+data.length);return out;}
export function sanitizeVisualPng(input){
  if(!Buffer.isBuffer(input)||input.length>maxBytes||input.length<57||!input.subarray(0,8).equals(signature))fail();
  let offset=8,header,ended=false,idatEnded=false,count=0;const parts=[];
  while(offset<input.length){
    if(++count>1000||offset+12>input.length)fail();
    const length=input.readUInt32BE(offset),end=offset+12+length;if(end>input.length||end<offset)fail();
    const type=input.subarray(offset+4,offset+8),name=type.toString('ascii'),data=input.subarray(offset+8,offset+8+length);
    if(!/^[A-Za-z]{4}$/.test(name)||crc32(input.subarray(offset+4,offset+8+length))!==input.readUInt32BE(offset+8+length))fail();
    if(!header&&name!=='IHDR')fail();
    if(name==='IHDR'){if(header||length!==13)fail();header=Buffer.from(data);}
    else if(name==='IDAT'){if(idatEnded||!header)fail();parts.push(data);}
    else if(name==='IEND'){if(length||!parts.length||end!==input.length)fail();ended=true;offset=end;break;}
    else{if(parts.length)idatEnded=true;if((type[0]&32)===0||['acTL','fcTL','fdAT'].includes(name))fail();}
    offset=end;
  }
  if(!ended||!header||!parts.length)fail();
  const width=header.readUInt32BE(0),height=header.readUInt32BE(4),depth=header[8],color=header[9];
  if(!width||!height||width>maxSide||height>maxSide||width*height>maxPixels||depth!==8||![2,6].includes(color)||header[10]||header[11]||header[12])fail();
  const stride=width*(color===2?3:4)+1,expected=stride*height;let pixels;
  try{pixels=inflateSync(Buffer.concat(parts),{maxOutputLength:expected});}catch{fail();}
  if(pixels.length!==expected)fail();for(let row=0;row<height;row++)if(pixels[row*stride]>4)fail();
  const result=Buffer.concat([signature,chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
  return {bytes:result,width,height,contentType:'image/png'};
}
