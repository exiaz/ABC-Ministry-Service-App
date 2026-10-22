export function localOrigin(value){
  if(typeof value!=='string'||!/^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})$/.test(value)||Number(new URL(value).port)>65535||new URL(value).port==='4173')throw Error('Origin mentor/API harus loopback eksplisit dan terpisah dari demo port 4173.');
  return value;
}
const headers=new Set(['authorization','content-type','x-device-timestamp','x-device-nonce','x-device-signature']);
export function mentorCors(req,url,origin){
  if(!origin||!['/api/pairing/redeem','/api/device/status'].includes(url.pathname))return null;
  if(!req.headers.origin)return null;
  if(req.headers.origin!==origin)return {denied:true};
  const method=url.pathname==='/api/pairing/redeem'?'POST':'GET';
  if(req.method==='OPTIONS'){
    const requested=(req.headers['access-control-request-headers']??'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
    if(req.headers['access-control-request-method']!==method||requested.some(h=>!headers.has(h)))return {denied:true};
  }
  return {headers:{'Access-Control-Allow-Origin':origin,Vary:'Origin',...(req.method==='OPTIONS'?{'Access-Control-Allow-Methods':method,'Access-Control-Allow-Headers':[...headers].join(', '),'Access-Control-Max-Age':'60'}:{})}};
}
