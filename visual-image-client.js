const maxInput=25*1024*1024,maxOutput=5*1024*1024,maxPixels=4_000_000,maxSide=4096;
async function boundedPngChunks(blob){
  const view=new DataView(await blob.arrayBuffer());let offset=8,count=0;
  while(offset+12<=view.byteLength){if(++count>1000)return false;offset+=view.getUint32(offset)+12;}
  return offset===view.byteLength;
}
export async function prepareVisualImage(file,{maxDimension=4096}={}){
  if(![4096,1920,1280].includes(maxDimension))throw Error('Batas resolusi tidak valid.');
  if(!file||!file.size||file.size>maxInput)throw Error('Pilih PNG, JPG/JPEG atau WebP maksimal 25 MiB.');
  const header=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const matches=bytes=>bytes.every((byte,i)=>header[i]===byte);
  const format=matches([137,80,78,71,13,10,26,10])?'PNG':matches([255,216,255])?'JPEG':matches([82,73,70,70])&&[87,69,66,80].every((byte,i)=>header[i+8]===byte)?'WebP':null;
  if(!format)throw Error('Isi berkas harus berupa PNG, JPG/JPEG atau WebP.');
  let bitmap;
  try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw Error('Gambar tidak dapat dibaca oleh browser. Pilih berkas gambar lain.');}
  try{
    const {width,height}=bitmap;
    if(!width||!height||width*height>40_000_000||Math.max(width,height)>16000)throw Error('Gambar sumber maksimal 40 juta piksel dan 16000 piksel per sisi.');
    let scale=Math.min(1,Math.min(maxSide,maxDimension)/width,Math.min(maxSide,maxDimension)/height,Math.sqrt(maxPixels/(width*height)));
    const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
    if(!context)throw Error('Pemrosesan gambar tidak tersedia di browser ini.');
    for(let attempt=0;attempt<12;attempt++){
      canvas.width=Math.max(1,Math.floor(width*scale));canvas.height=Math.max(1,Math.floor(height*scale));
      context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if(!blob)throw Error('Gambar belum dapat dikompres. Coba gambar lain.');
      if(blob.size<=maxOutput&&await boundedPngChunks(blob))return {blob,format,originalBytes:file.size,originalWidth:width,originalHeight:height,width:canvas.width,height:canvas.height};
      scale*=0.8;
    }
    throw Error('Gambar belum mencapai batas 5 MiB. Pilih gambar beresolusi lebih kecil.');
  }finally{bitmap.close();}
}
