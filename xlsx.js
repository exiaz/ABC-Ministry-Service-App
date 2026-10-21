// Small, dependency-free OOXML workbook packaged in a ZIP with uncompressed entries.
export function buildWorkbook(rows,{sheetName='SIMULASI - Data Fiktif'}={}) {
  const enc = new TextEncoder();
  const xml = s => String(s??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
  const col = n => {let s=''; for(n++;n;n=Math.floor((n-1)/26)) s=String.fromCharCode(65+(n-1)%26)+s; return s;};
  const files = {
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(sheetName.slice(0,31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="8" width="25" customWidth="1"/></cols><sheetData>${rows.map((r,i)=>`<row r="${i+1}">${r.map((v,j)=>`<c r="${col(j)}${i+1}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`
  };
  function crc32(bytes) { let crc=-1; for (const b of bytes) {crc^=b; for(let i=0;i<8;i++) crc=(crc>>>1)^((crc&1)?0xedb88320:0);} return (crc^-1)>>>0; }
  const chunks=[], central=[]; let offset=0, centralLength=0;
  function header(size) { const a=new Uint8Array(size); return [a,new DataView(a.buffer)]; }
  for(const [name,body] of Object.entries(files)) {
    const n=enc.encode(name),b=enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+body),crc=crc32(b);
    const [h,v]=header(30); v.setUint32(0,0x04034b50,true); v.setUint16(4,20,true); v.setUint32(14,crc,true); v.setUint32(18,b.length,true); v.setUint32(22,b.length,true); v.setUint16(26,n.length,true);
    chunks.push(h,n,b);
    const [c,d]=header(46); d.setUint32(0,0x02014b50,true); d.setUint16(4,20,true); d.setUint16(6,20,true); d.setUint32(16,crc,true); d.setUint32(20,b.length,true); d.setUint32(24,b.length,true); d.setUint16(28,n.length,true); d.setUint32(42,offset,true);
    central.push(c,n); centralLength+=46+n.length; offset+=30+n.length+b.length;
  }
  const [end,e]=header(22); e.setUint32(0,0x06054b50,true); e.setUint16(8,5,true); e.setUint16(10,5,true); e.setUint32(12,centralLength,true); e.setUint32(16,offset,true);
  return new Blob([...chunks,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
export function exportWorkbook(rows, filename) {
  const blob=buildWorkbook(rows,{sheetName:'Data ABC'});
  const url=URL.createObjectURL(blob),a=document.createElement('a'); a.href=url;a.download=filename;a.click(); setTimeout(()=>URL.revokeObjectURL(url),2000);
}
