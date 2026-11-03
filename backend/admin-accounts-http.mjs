import {requireAdminOrigin} from './admin-session-http.mjs';
export async function accountRoute({req,url,result,adminAuthentication,stillAuthorized,send}){
  const list=url.pathname==='/api/admin/accounts',match=/^\/api\/admin\/accounts\/([A-Za-z0-9_-]{1,128})$/.exec(url.pathname);
  if(!list&&!match)return false;
  const fail=(status,message)=>{throw Object.assign(Error(message),{status,adminAccountError:true});};
  if(result.role!=='superadmin')fail(403,'Hanya Superadmin yang dapat mengelola akun PIC.');
  if(!adminAuthentication.accounts)fail(503,'Pengelolaan akun belum tersedia.');
  if(url.search)fail(400,'Parameter akun tidak valid.');
  if(req.method==='GET'&&list){send(200,await adminAuthentication.accounts.list(result.uid,stillAuthorized));return true;}
  if(req.method!=='POST')fail(405,'Metode tidak diizinkan.');
  requireAdminOrigin(req);
  if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type']??''))fail(400,'Permintaan harus berupa JSON.');
  const chunks=[];let size=0;
  req.setTimeout(5000,()=>req.destroy());
  try{for await(const chunk of req.iterator({destroyOnReturn:false})){size+=chunk.length;if(size>8192){req.resume();fail(413,'Permintaan akun terlalu besar.');}chunks.push(chunk);}}finally{req.setTimeout(0);}
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail(400,'JSON tidak valid.');}
  if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Data akun tidak valid.');
  const response=match?await adminAuthentication.accounts.update(result.uid,match[1],body,stillAuthorized):await adminAuthentication.accounts.create(result.uid,body,stillAuthorized);
  send(match?200:201,response);return true;
}
