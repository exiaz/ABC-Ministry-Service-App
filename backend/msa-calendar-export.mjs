import {hash,fail} from './msa-accounts.mjs';
import {eventDate,eventTimezones} from './msa-events.mjs';

// Google prefilled links and RFC 5545 downloads only, no remote API calls.
// https://developers.google.com/workspace/calendar/api/concepts/inviting-attendees-to-events
// https://www.rfc-editor.org/rfc/rfc5545.html
const stamp=at=>new Date(at).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
export const icsText=value=>String(value).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
export function icsFoldLine(line){
  const result=[];let current='',bytes=0;
  for(const char of line){const size=Buffer.byteLength(char,'utf8');if(bytes+size>75){result.push(current);current=' ';bytes=1;}current+=char;bytes+=size;}
  return [...result,current].join('\r\n');
}
const safeText=(v,max)=>typeof v==='string'&&v.trim().length>=2&&v.length<=max&&!/[\p{Cc}\p{Cf}\p{Cs}]/u.test(v);
export function manualCalendarExport({namespace,event,value,now=Date.now()}){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['expectedRevision','durationMinutes','format'].includes(k))||!Number.isSafeInteger(value.expectedRevision)||value.expectedRevision<1||!Number.isSafeInteger(value.durationMinutes)||value.durationMinutes<1||!['google','ics'].includes(value.format))fail(400,'Isi durasi menit bulat positif dan format kalender yang valid.');
  if(event.status!=='published')fail(403,'Hanya pelayanan terbit yang dapat ditambahkan ke kalender.');
  if(event.revision!==value.expectedRevision)fail(409,'Pelayanan sudah berubah. Buka detail terbaru sebelum menambahkan ke kalender.');
  if(!safeText(event.name,120)||!safeText(event.venue,180)||typeof event.timezone!=='string'||!Object.hasOwn(eventTimezones,event.timezone)||typeof event.startTime!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(event.startTime))fail(409,'Data pelayanan perlu ditinjau sebelum diekspor.');
  eventDate(event.startDate);const offset=eventTimezones[event.timezone]*3600000,startAt=Date.parse(event.startDate+'T'+event.startTime+':00Z')-offset,endAt=startAt+value.durationMinutes*60000;
  if(startAt!==event.startAt||!Number.isSafeInteger(endAt)||endAt<=startAt||endAt+offset>Date.parse('2100-12-31T23:59:00Z'))fail(400,'Waktu mulai atau durasi tidak valid; waktu selesai harus berada dalam rentang tanggal pilot sampai 2100.');
  // Only the published title/venue and generated public-safe description leave
  // MSA. No PIC, account, student, contact, notes, actor, token or internal URL.
  const description='Salinan manual pelayanan dari MSA.\nZona waktu: '+event.timezone+'.\nPerubahan atau pembatalan di MSA tidak tersinkron otomatis. Periksa MSA untuk jadwal terbaru.';
  const result={format:value.format,startAt,endAt,timezone:event.timezone};
  if(value.format==='google'){
    const url=new URL('https://calendar.google.com/calendar/r/eventedit');url.search=new URLSearchParams({action:'TEMPLATE',dates:stamp(startAt)+'/'+stamp(endAt),stz:event.timezone,etz:event.timezone,text:event.name,location:event.venue,details:description}).toString();return {...result,googleUrl:url.href};
  }
  const identity=hash(JSON.stringify([namespace,event.organizationId,event.id])),zoneOffset='+'+String(eventTimezones[event.timezone]).padStart(2,'0')+'00',local=at=>stamp(at+offset).slice(0,-1),modified=event.updatedAt;
  if(!Number.isSafeInteger(modified)||modified<0||modified>253402300799000||!Number.isSafeInteger(now)||now<0||now>253402300799000||event.revision>2147483647)fail(409,'Metadata waktu atau revisi pelayanan tidak valid.');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ABC//MSA Manual Calendar Export//ID','CALSCALE:GREGORIAN','BEGIN:VTIMEZONE','TZID:'+event.timezone,'BEGIN:STANDARD','DTSTART:20000101T000000','TZOFFSETFROM:'+zoneOffset,'TZOFFSETTO:'+zoneOffset,'END:STANDARD','END:VTIMEZONE','BEGIN:VEVENT','UID:'+identity+'@msa.example.invalid','DTSTAMP:'+stamp(now),'LAST-MODIFIED:'+stamp(modified),'SEQUENCE:'+event.revision,'DTSTART;TZID='+event.timezone+':'+local(startAt),'DTEND;TZID='+event.timezone+':'+local(endAt),'SUMMARY:'+icsText(event.name),'LOCATION:'+icsText(event.venue),'DESCRIPTION:'+icsText(description),'STATUS:CONFIRMED','CLASS:PRIVATE','END:VEVENT','END:VCALENDAR'];
  return {...result,filename:'pelayanan-'+identity.slice(0,16)+'.ics',ics:lines.map(icsFoldLine).join('\r\n')+'\r\n'};
}
