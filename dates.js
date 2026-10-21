export const TIME_ZONE='Asia/Jakarta';
export function jakartaToday(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-');
}
export function recentFriday(today=jakartaToday()){
  const d=new Date(today+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+2)%7);
  return d.toISOString().slice(0,10);
}
export function shiftMonth(month,offset){
  const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+offset);return d.toISOString().slice(0,7);
}
