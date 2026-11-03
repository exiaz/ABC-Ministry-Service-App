// Validation shared by the isolated Visual Studio pilot. No route is enabled here.
const slots=new Set(['welcome','login','registration','dashboard']);
const fail=()=>{throw Object.assign(Error('Data media tidak valid.'),{status:400});};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const keys=(value,allowed)=>plain(value)&&Object.keys(value).every(key=>allowed.includes(key));

export function visualSlot(value){
  if(typeof value!=='string'||!slots.has(value))fail();
  return value;
}

export function visualMetadata(value){
  if(!keys(value,['alt','x','y','zoom','headline','description'])||typeof value.alt!=='string'||value.alt.length>160||/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value.alt)||![value.x,value.y].every(n=>Number.isInteger(n)&&n>=0&&n<=100))fail();
  const result={alt:value.alt.trim(),x:value.x,y:value.y};
  if(value.zoom!==undefined){if(typeof value.zoom!=='number'||!Number.isFinite(value.zoom)||value.zoom<1||value.zoom>3||Math.abs(value.zoom*100-Math.round(value.zoom*100))>0.000001)fail();result.zoom=value.zoom;}
  for(const [key,limit] of [['headline',120],['description',300]])if(value[key]!==undefined){if(typeof value[key]!=='string'||value[key].length>limit||/[\p{Cc}\p{Cf}\p{Cs}]/u.test(key==='description'?value[key].replace(/\n/g,''):value[key]))fail();result[key]=value[key].trim();}
  return result;
}

export function visualMutation(value){
  if(!keys(value,['expectedRevision','requestId','reason','confirmed'])||!Number.isSafeInteger(value.expectedRevision)||value.expectedRevision<0||typeof value.requestId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value.requestId)||typeof value.reason!=='string'||value.reason.trim().length<5||value.reason.length>300||/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value.reason)||value.confirmed!==true)fail();
  return {expectedRevision:value.expectedRevision,requestId:value.requestId,reason:value.reason.trim(),confirmed:true};
}
