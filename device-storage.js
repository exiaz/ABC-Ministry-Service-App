// CryptoKeys are structured-cloned by IndexedDB, never exported or put in
// localStorage. Encryption avoids a plaintext bearer in persistent records;
// same-origin script compromise can still use these keys (no XSS protection).
const DATABASE='abc-mentor-device-v1';
async function access(mode,operation){
  const db=await new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('device');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(Error('Penyimpanan perangkat tidak tersedia.'));
    request.onblocked=()=>reject(Error('Tutup tab lain lalu coba kembali.'));
  });
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction('device',mode),request=operation(tx.objectStore('device'));
    tx.oncomplete=()=>resolve(request.result);
    tx.onerror=tx.onabort=()=>reject(Error('Penyimpanan perangkat tidak tersedia.'));
  });}finally{db.close();}
}
const text=new TextEncoder();
export const removeDevice=()=>access('readwrite',store=>store.clear());
export async function prepareDevice(){
  if(!globalThis.isSecureContext||!globalThis.crypto?.subtle||!globalThis.indexedDB)throw Error('Browser ini belum mendukung penyimpanan perangkat yang diperlukan. Gunakan Chrome terbaru pada localhost.');
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
  const wrappingKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const publicKey=bytes64(await crypto.subtle.exportKey('spki',pair.publicKey));
  const pending={version:1,privateKey:pair.privateKey,wrappingKey,publicKey};
  // Verify persistence support before consuming a one-time code.
  const slot='pending-'+crypto.randomUUID();let restored;
  try{await access('readwrite',store=>store.put(pending,slot));restored=await access('readonly',store=>store.get(slot));}
  finally{await access('readwrite',store=>store.delete(slot));}
  if(!restored?.privateKey||restored.privateKey.extractable||!restored.wrappingKey||restored.wrappingKey.extractable)throw Error('Kunci perangkat tidak dapat disimpan dengan aman pada browser ini.');
  await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},restored.privateKey,text.encode('uji-penyimpanan-perangkat'));
  return restored;
}
export function bytes64(value){return btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export async function storeDevice(keys,session,apiOrigin){
  const iv=crypto.getRandomValues(new Uint8Array(12)),deviceId=session.deviceId;
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:text.encode(location.origin+'|'+apiOrigin+'|'+deviceId)},keys.wrappingKey,text.encode(JSON.stringify(session)));
  await access('readwrite',store=>store.put({...keys,deviceId,apiOrigin,iv,cipher},'current'));
}
export async function loadDevice(apiOrigin){
  const record=await access('readonly',store=>store.get('current'));
  if(!record)return null;
  if(record.version!==1||record.apiOrigin!==apiOrigin||record.privateKey?.extractable!==false||record.wrappingKey?.extractable!==false)throw Error('Penyimpanan perangkat tidak sesuai. Hapus izin lokal lalu aktivasi ulang.');
  const decoded=await crypto.subtle.decrypt({name:'AES-GCM',iv:record.iv,additionalData:text.encode(location.origin+'|'+apiOrigin+'|'+record.deviceId)},record.wrappingKey,record.cipher);
  return {keys:record,session:JSON.parse(new TextDecoder().decode(decoded))};
}
