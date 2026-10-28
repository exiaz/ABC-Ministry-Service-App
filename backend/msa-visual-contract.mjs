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
  if(!keys(value,['alt','x','y'])||typeof value.alt!=='string'||value.alt.length>160||/[\p{Cc}\p{Cf}]/u.test(value.alt)||![value.x,value.y].every(n=>Number.isInteger(n)&&n>=0&&n<=100))fail();
  return {alt:value.alt.trim(),x:value.x,y:value.y};
}

export function visualMutation(value){
  if(!keys(value,['expectedRevision','requestId','reason','confirmed'])||!Number.isSafeInteger(value.expectedRevision)||value.expectedRevision<0||typeof value.requestId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value.requestId)||typeof value.reason!=='string'||value.reason.trim().length<5||value.reason.length>300||/[\p{Cc}\p{Cf}]/u.test(value.reason)||value.confirmed!==true)fail();
  return {expectedRevision:value.expectedRevision,requestId:value.requestId,reason:value.reason.trim(),confirmed:true};
}
