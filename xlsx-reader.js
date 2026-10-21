// Bounded OOXML reader for student import. Uses browser XML and native ZIP decompression.
const limit=20*1024*1024,expandedLimit=64*1024*1024;
export async function readWorkbook(input){
  const bytes=new Uint8Array(input instanceof ArrayBuffer?input:await input.arrayBuffer());
  if(bytes.length>limit||bytes.length<22)throw Error('Berkas XLSX harus valid dan maksimal 20 MB.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),decoder=new TextDecoder('utf-8',{fatal:true});
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
  if(end<0)throw Error('Berkas bukan XLSX ZIP yang didukung.');
  const count=view.getUint16(end+10,true),central=view.getUint32(end+16,true);
  if(count>512||central>=end||view.getUint16(end+4,true)||view.getUint16(end+6,true))throw Error('Struktur XLSX tidak didukung.');
  const files=new Map();let offset=central,total=0;
  for(let i=0;i<count;i++){
    if(offset+46>end||view.getUint32(offset,true)!==0x02014b50)throw Error('Direktori XLSX rusak.');
    const flags=view.getUint16(offset+8,true),method=view.getUint16(offset+10,true),crc=view.getUint32(offset+16,true),size=view.getUint32(offset+20,true),expanded=view.getUint32(offset+24,true),nameLength=view.getUint16(offset+28,true),extra=view.getUint16(offset+30,true),comment=view.getUint16(offset+32,true),local=view.getUint32(offset+42,true);
    if(offset+46+nameLength+extra+comment>end)throw Error('Direktori XLSX terpotong.');
    const name=decoder.decode(bytes.slice(offset+46,offset+46+nameLength));
    total+=expanded;
    if(flags&1||![0,8].includes(method)||total>expandedLimit||name.startsWith('/')||name.includes('..')||name.includes('\\')||files.has(name))throw Error('XLSX terenkripsi, terlalu besar atau tidak didukung.');
    files.set(name,{method,crc,size,expanded,local});offset+=46+nameLength+extra+comment;
  }
  async function xml(name,optional=false){
    const file=files.get(name);if(!file){if(optional)return null;throw Error('Bagian XLSX tidak ditemukan: '+name);}
    const p=file.local;
    if(p+30>central||view.getUint32(p,true)!==0x04034b50)throw Error('Bagian ZIP rusak.');
    const start=p+30+view.getUint16(p+26,true)+view.getUint16(p+28,true);
    if(start+file.size>central)throw Error('Bagian ZIP terpotong.');
    let data=bytes.slice(start,start+file.size);
    if(file.method===8){
      const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')),reader=stream.getReader(),parts=[];let length=0;
      while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>file.expanded||length>expandedLimit){await reader.cancel();throw Error('Ukuran data XLSX tidak valid.');}parts.push(value);}
      data=new Uint8Array(length);let at=0;for(const part of parts){data.set(part,at);at+=part.length;}
    }
    if(data.length!==file.expanded)throw Error('Ukuran bagian XLSX tidak cocok.');
    let crc=-1;for(const b of data){crc^=b;for(let n=0;n<8;n++)crc=crc>>>1^((crc&1)?0xedb88320:0);}
    if(((crc^-1)>>>0)!==file.crc)throw Error('Checksum XLSX tidak cocok.');
    const text=decoder.decode(data);
    if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('Deklarasi entitas XML tidak didukung.');
    const doc=new DOMParser().parseFromString(text,'application/xml');
    if(doc.getElementsByTagNameNS('*','parsererror').length)throw Error('XML pada XLSX rusak.');return doc;
  }
  const workbook=await xml('xl/workbook.xml'),relationships=await xml('xl/_rels/workbook.xml.rels');
  const sheet=workbook.getElementsByTagNameNS('*','sheet')[0];
  if(!sheet)throw Error('Tidak ada worksheet.');
  const relationship=[...relationships.getElementsByTagNameNS('*','Relationship')].find(r=>r.getAttribute('Id')===(sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||sheet.getAttribute('r:id')));
  if(!relationship||relationship.getAttribute('TargetMode')==='External')throw Error('Worksheet eksternal tidak didukung.');
  let target=relationship.getAttribute('Target');
  if(target.startsWith('/'))target=target.slice(1);else target='xl/'+target.replace(/^\.\//,'');
  if(target.includes('..'))throw Error('Lokasi worksheet tidak valid.');
  const shared=await xml('xl/sharedStrings.xml',true),strings=shared?[...shared.getElementsByTagNameNS('*','si')].map(si=>[...si.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join('')):[];
  const worksheet=await xml(target),rows=[];
  for(const row of worksheet.getElementsByTagNameNS('*','row')){
    if(rows.length>=5004)throw Error('Maksimal 5000 siswa dalam satu impor.');
    const cells=[];
    for(const cell of row.getElementsByTagNameNS('*','c')){
      if(cell.getElementsByTagNameNS('*','f').length)throw Error('Impor hanya menerima nilai, bukan formula. Salin sebagai nilai di Excel terlebih dahulu.');
      const ref=cell.getAttribute('r'),match=/^([A-Z]+)\d+$/.exec(ref||'');
      if(!match)throw Error('Referensi sel XLSX tidak valid.');
      let column=0;for(const char of match[1])column=column*26+char.charCodeAt(0)-64;column--;
      if(column>=50)throw Error('Maksimal 50 kolom untuk impor siswa.');
      const type=cell.getAttribute('t'),value=cell.getElementsByTagNameNS('*','v')[0]?.textContent||'';
      cells[column]=type==='s'?strings[Number(value)]??'':type==='inlineStr'?[...cell.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join(''):value;
    }
    rows.push(cells);
  }
  const date1904=workbook.getElementsByTagNameNS('*','workbookPr')[0]?.getAttribute('date1904');
  return {rows,date1904:date1904==='1'||date1904==='true',sheetName:sheet.getAttribute('name')};
}
