// Shared read-only route for portal and Mentor origins. The service resolves
// only the current pointer; clients never supply storage identifiers.
export async function visualPublicRoute(req,res,url,visual){
  if(!url.pathname.startsWith('/visual/published/'))return false;
  const match=/^\/visual\/published\/(welcome|login|registration|dashboard)(?:\/([1-9][0-9]*))?$/.exec(url.pathname);
  const missing=()=>{res.writeHead(404,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end();return true;};
  if(!visual||!match||url.search||!['GET','HEAD'].includes(req.method))return missing();
  try{
    const revision=match[2]===undefined?undefined:Number(match[2]);
    if(revision!==undefined&&!Number.isSafeInteger(revision))return missing();
    const result=await visual.publicRead(match[1],revision);if(!result)return missing();
    const body=revision===undefined?Buffer.from(JSON.stringify({slot:result.slot,revision:result.revision,metadata:result.metadata,src:result.src})):result.bytes;
    res.writeHead(200,{'Content-Type':revision===undefined?'application/json; charset=utf-8':'image/png','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"});
    res.end(req.method==='HEAD'?undefined:body);return true;
  }catch{return missing();}
}
