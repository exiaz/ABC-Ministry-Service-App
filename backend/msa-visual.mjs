import {randomUUID} from 'node:crypto';
import {fail,hash} from './msa-accounts.mjs';
import {visualMetadata,visualMutation,visualSlot} from './msa-visual-contract.mjs';
import {sanitizeVisualPng} from './msa-visual-image.mjs';

// Emulator-only private chunk storage. Only the current published pointer can
// be read without an actor; chunk identifiers are never accepted from clients.
const chunkSize=180000,maxImage=5*1024*1024;
const keys=(v,allowed)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>allowed.includes(k));
const digest=b=>hash(b);
export function createMsaVisual({db,root,accounts,enabled,now=Date.now}){
  const col=n=>root.collection(n),states=col('msaVisualSlots'),assets=col('msaVisualAssets'),chunks=col('msaVisualChunks'),history=col('msaVisualHistory'),receipts=col('msaVisualReceipts'),audit=col('msaVisualAudit');
  const href=(slot,revision)=>'/visual/published/'+slot+'/'+revision;
  const id=(slot,revision)=>slot+'-'+revision;
  const authorize=async(tx,actor)=>{enabled();await accounts.authorizeManager(tx,actor);};
  const state=(slot,row)=>row??{slot,revision:0,draft:null,published:null};
  const metadata=m=>visualMetadata(m);
  async function readAsset(tx,slot,assetId){
    if(typeof assetId!=='string'||!/^[a-f0-9-]{36}$/.test(assetId))fail(503,'Media tidak tersedia.');
    const asset=(await tx.get(assets.doc(assetId))).data();
    if(!asset||asset.slot!==slot||!Number.isInteger(asset.count)||asset.count<1||asset.count>30||!Number.isInteger(asset.size)||asset.size<1||asset.size>maxImage||!/^[a-f0-9]{64}$/.test(asset.digest??''))fail(503,'Media tidak tersedia.');
    const docs=await tx.getAll(...Array.from({length:asset.count},(_,i)=>chunks.doc(assetId+'-'+i)));
    const parts=docs.map((d,i)=>{const c=d.data();if(!c||c.assetId!==assetId||c.slot!==slot||c.index!==i||typeof c.data!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(c.data))fail(503,'Media tidak tersedia.');return Buffer.from(c.data,'base64');});
    const bytes=Buffer.concat(parts);if(bytes.length!==asset.size||digest(bytes)!==asset.digest)fail(503,'Media tidak tersedia.');
    return bytes;
  }
  async function mutate(actor,slot,operation,mutation,extra,prepare){
    visualSlot(slot);const command=visualMutation(mutation),fingerprint=hash(JSON.stringify([slot,operation,command,extra]));
    enabled();
    return db.runTransaction(async tx=>{
      await authorize(tx,actor);
      const ref=states.doc(slot),receipt=receipts.doc(hash(actor.uid+':'+command.requestId));
      const [snapshot,old]=await tx.getAll(ref,receipt);
      if(old.exists){if(old.data().fingerprint!==fingerprint)fail(409,'ID permintaan sudah digunakan.');return old.data().result;}
      const previous=state(slot,snapshot.data());if(previous.slot!==slot||previous.revision!==command.expectedRevision||previous.revision>=Number.MAX_SAFE_INTEGER)fail(409,'Media sudah berubah. Muat ulang sebelum mencoba lagi.');
      const change=await prepare(tx,previous);
      await authorize(tx,actor);enabled();
      const revision=previous.revision+1,at=now(),next={...previous,...change.fields,slot,revision};
      const result={slot,revision,published:next.published?{revision:next.published.revision}:null};
      change.write?.(tx);tx.set(ref,next);
      if(change.publication)tx.create(history.doc(id(slot,revision)),{slot,revision,publication:change.publication,actorUid:actor.uid,reason:command.reason,requestId:command.requestId,at});
      tx.create(audit.doc(randomUUID()),{slot,operation,actorUid:actor.uid,reason:command.reason,requestId:command.requestId,at,previousRevision:previous.revision,revision});
      tx.create(receipt,{fingerprint,result});return result;
    });
  }
  return {
    enabled,
    async authorize(actor){enabled();return db.runTransaction(tx=>authorize(tx,actor));},
    async status(actor,slot){
      visualSlot(slot);enabled();return db.runTransaction(async tx=>{await authorize(tx,actor);const row=state(slot,(await tx.get(states.doc(slot))).data());await authorize(tx,actor);return {slot,revision:row.revision,draft:row.draft?{metadata:row.draft.metadata}:null,published:row.published?{revision:row.published.revision,metadata:row.published.metadata,src:row.published.assetId?href(slot,row.published.revision):null}:null};});
    },
    async history(actor,slot){
      visualSlot(slot);enabled();return db.runTransaction(async tx=>{
        await authorize(tx,actor);
        const [versions,events]=await Promise.all([tx.get(history.where('slot','==',slot).limit(201)),tx.get(audit.where('slot','==',slot).limit(201))]);
        if(versions.size>200||events.size>200)fail(409,'Riwayat media melampaui batas pilot.');
        await authorize(tx,actor);
        return {publications:versions.docs.map(d=>d.data()).map(v=>({revision:v.revision,fallback:!!v.publication.fallback,actorUid:v.actorUid,reason:v.reason,requestId:v.requestId,at:v.at})).sort((a,b)=>b.revision-a.revision),audit:events.docs.map(d=>d.data()).sort((a,b)=>b.revision-a.revision)};
      });
    },
    async upload(actor,slot,value){
      visualSlot(slot);if(!keys(value,['mutation','metadata','image'])||typeof value.image!=='string'||value.image.length>Math.ceil(maxImage/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.image))fail(400,'Gambar PNG tidak valid.');
      const command=visualMutation(value.mutation),meta=metadata(value.metadata);
      // Reject unauthorized clients before decoding or processing their image.
      await db.runTransaction(tx=>authorize(tx,actor));
      const input=Buffer.from(value.image,'base64'),image=sanitizeVisualPng(input);
      if(image.bytes.length>maxImage)fail(400,'Gambar hasil pemrosesan melebihi batas.');
      const imageHash=digest(image.bytes),assetId=randomUUID(),parts=[];for(let i=0;i<image.bytes.length;i+=chunkSize)parts.push(image.bytes.subarray(i,i+chunkSize).toString('base64'));
      return mutate(actor,slot,'draft',command,{metadata:meta,digest:imageHash},async()=>({fields:{draft:{assetId,metadata:meta}},write:tx=>{
        tx.create(assets.doc(assetId),{slot,count:parts.length,size:image.bytes.length,digest:imageHash,width:image.width,height:image.height});
        parts.forEach((data,index)=>tx.create(chunks.doc(assetId+'-'+index),{assetId,slot,index,data}));
      }}));
    },
    async preview(actor,slot){
      visualSlot(slot);enabled();return db.runTransaction(async tx=>{await authorize(tx,actor);const row=state(slot,(await tx.get(states.doc(slot))).data());if(!row.draft)fail(404,'Draf tidak tersedia.');const bytes=await readAsset(tx,slot,row.draft.assetId);await authorize(tx,actor);return {revision:row.revision,metadata:metadata(row.draft.metadata),image:bytes.toString('base64')};});
    },
    async save(actor,slot,value){
      visualSlot(slot);if(!keys(value,['mutation','metadata','image']))fail(400,'Permintaan tidak valid.');
      const command=visualMutation(value.mutation),meta=metadata(value.metadata);
      await db.runTransaction(tx=>authorize(tx,actor));
      let image=null,assetId=null,parts=[];
      if(value.image!==undefined){
        if(typeof value.image!=='string'||value.image.length>Math.ceil(maxImage/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.image))fail(400,'Gambar PNG tidak valid.');
        image=sanitizeVisualPng(Buffer.from(value.image,'base64'));if(image.bytes.length>maxImage)fail(400,'Gambar hasil pemrosesan melebihi batas.');
        assetId=randomUUID();for(let i=0;i<image.bytes.length;i+=chunkSize)parts.push(image.bytes.subarray(i,i+chunkSize).toString('base64'));
      }
      return mutate(actor,slot,'save',command,{metadata:meta,digest:image?digest(image.bytes):null},async(tx,row)=>{
        const currentAsset=image?assetId:row.draft?.assetId??row.published?.assetId??null;
        if(!image&&currentAsset)await readAsset(tx,slot,currentAsset);
        const publication={assetId:currentAsset,metadata:meta,revision:row.revision+1};
        return {fields:{published:publication,draft:null},publication,write:image?tx=>{
          tx.create(assets.doc(assetId),{slot,count:parts.length,size:image.bytes.length,digest:digest(image.bytes),width:image.width,height:image.height});
          parts.forEach((data,index)=>tx.create(chunks.doc(assetId+'-'+index),{assetId,slot,index,data}));
        }:undefined};
      });
    },
    async publish(actor,slot,value){
      if(!keys(value,['mutation']))fail(400,'Permintaan tidak valid.');
      return mutate(actor,slot,'publish',value.mutation,{},async(tx,row)=>{
        if(!row.draft)fail(409,'Draf tidak tersedia.');await readAsset(tx,slot,row.draft.assetId);
        const publication={assetId:row.draft.assetId,metadata:metadata(row.draft.metadata),revision:row.revision+1};
        return {fields:{published:publication,draft:null},publication};
      });
    },
    async revert(actor,slot,value){
      if(!keys(value,['mutation','targetRevision'])||!Number.isSafeInteger(value.targetRevision)||value.targetRevision<0)fail(400,'Revisi tujuan tidak valid.');
      return mutate(actor,slot,'revert',value.mutation,{targetRevision:value.targetRevision},async(tx,row)=>{
        let publication=null;
        if(value.targetRevision){const old=(await tx.get(history.doc(id(slot,value.targetRevision)))).data();if(!old||old.slot!==slot||old.revision!==value.targetRevision||!old.publication)fail(404,'Revisi publikasi tidak ditemukan.');if(!old.publication.fallback){if(old.publication.assetId)await readAsset(tx,slot,old.publication.assetId);publication={assetId:old.publication.assetId,metadata:metadata(old.publication.metadata),revision:row.revision+1};}}
        return {fields:{published:publication},publication:publication??{fallback:true}};
      });
    },
    async publicRead(slot,revision){
      visualSlot(slot);enabled();return db.runTransaction(async tx=>{const row=(await tx.get(states.doc(slot))).data();const p=row?.published;if(!p||revision!==undefined&&p.revision!==revision)return null;const bytes=p.assetId?await readAsset(tx,slot,p.assetId):null;enabled();return {slot,revision:p.revision,metadata:metadata(p.metadata),src:bytes?href(slot,p.revision):null,bytes};});
    }
  };
}
