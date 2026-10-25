export function localOrigin(value){
  if(typeof value!=='string'||!/^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})$/.test(value)||Number(new URL(value).port)>65535||new URL(value).port==='4173')throw Error('Origin mentor/API harus loopback eksplisit dan terpisah dari demo port 4173.');
  return value;
}
const headers=new Set(['authorization','content-type','x-device-timestamp','x-device-nonce','x-device-signature']);
export function mentorCors(req,url,origin,personalEnabled=false){
  const routes={'/api/pairing/redeem':['POST'],'/api/device/status':['GET'],'/api/roster':['GET'],'/api/roster-context':['GET'],'/api/attendance':['GET','PUT'],'/api/attendance/finalize':['POST'],'/api/attendance/corrections':['POST']};
  if(personalEnabled)Object.assign(routes,{'/api/a2-3/login':['POST'],'/api/a2-3/context':['GET'],'/api/a2-3/logout':['POST'],'/api/a2-3/device-status':['GET'],'/api/a2-3/associate':['POST']});
  if(personalEnabled){routes['/api/a2-3/devices']=['GET'];if(/^\/api\/a2-3\/devices\/[A-Za-z0-9_-]{1,128}\/revoke$/.test(url.pathname))routes[url.pathname]=['POST'];}
  const allowedHeaders=personalEnabled?new Set([...headers,'x-msa-session']):headers;
  if(!origin||!routes[url.pathname])return null;
  if(!req.headers.origin)return null;
  if(req.headers.origin!==origin)return {denied:true};
  const methods=routes[url.pathname];
  if(req.method==='OPTIONS'){
    const requested=(req.headers['access-control-request-headers']??'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
    if(!methods.includes(req.headers['access-control-request-method'])||requested.some(h=>!allowedHeaders.has(h)))return {denied:true};
  }
  return {headers:{'Access-Control-Allow-Origin':origin,Vary:'Origin',...(req.method==='OPTIONS'?{'Access-Control-Allow-Methods':methods.join(', '),'Access-Control-Allow-Headers':[...allowedHeaders].join(', '),'Access-Control-Max-Age':'60'}:{})}};
}
