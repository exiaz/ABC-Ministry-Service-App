import {AttendanceError} from './attendance.mjs';
import {SCOPE_KEYS} from './access-control.mjs';
import {requestProof} from './pairing-http.mjs';

async function jsonBody(req,mentorOrigin){
  if(req.headers.origin&&req.headers.origin!==mentorOrigin)throw new AttendanceError(403,'Origin mentor tidak diizinkan.');
  if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type']??''))throw new AttendanceError(400,'Permintaan absensi harus berupa JSON.');
  let size=0;const chunks=[];
  if(Number(req.headers['content-length'])>32768){req.resume();throw new AttendanceError(413,'Permintaan absensi terlalu besar.');}
  req.setTimeout(5000,()=>req.destroy());
  try{
    for await(const chunk of req.iterator({destroyOnReturn:false})){
      size+=chunk.length;
      if(size>32768){req.resume();throw new AttendanceError(413,'Permintaan absensi terlalu besar.');}
      chunks.push(chunk);
    }
  }finally{req.setTimeout(0);}
  const raw=Buffer.concat(chunks).toString('utf8');let body;
  try{body=JSON.parse(raw);}catch{throw new AttendanceError(400,'JSON absensi tidak valid.');}
  return {body,raw};
}

export async function attendanceRoute({req,url,authorization,local,pairing,attendance,mentorOrigin,send}){
  const base=url.pathname==='/api/attendance',finalize=url.pathname==='/api/attendance/finalize',correct=url.pathname==='/api/attendance/corrections';
  if(!base&&!finalize&&!correct)return false;
  const methods=base?['GET','PUT']:['POST'];
  if(!methods.includes(req.method)){send(405,{error:'Metode tidak diizinkan.'},{Allow:methods.join(', ')});return true;}
  if(!local||!pairing||!attendance)throw new AttendanceError(503,'API absensi emulator lokal tidak tersedia.');
  if(req.headers.origin&&req.headers.origin!==mentorOrigin)throw new AttendanceError(403,'Origin mentor tidak diizinkan.');
  const action=base?(req.method==='GET'?'read':'save'):finalize?'finalize':'correct';
  const {body,raw}=action==='read'?{body:undefined,raw:''}:await jsonBody(req,mentorOrigin);
  const proof=await pairing.verifyRequest(authorization,requestProof(req,raw));
  const validParameters=[...url.searchParams.keys()].every(k=>SCOPE_KEYS.includes(k))&&SCOPE_KEYS.every(k=>url.searchParams.getAll(k).length===1);
  const scope=validParameters?Object.fromEntries(SCOPE_KEYS.map(k=>[k,url.searchParams.get(k)])):null;
  const result=await attendance.executeAuthorized({authorization,proof,scope,action,body});
  send(200,result);return true;
}
