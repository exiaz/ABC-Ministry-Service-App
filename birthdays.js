import {jakartaToday} from './dates.js';
import {isValidDate} from './scheduling.js';

const leap=year=>year%4===0&&(year%100!==0||year%400===0);
export function birthdayInYear(birthdate,year){
  if(!isValidDate(birthdate))return null;
  const monthDay=birthdate.slice(5)==='02-29'&&!leap(year)?'02-28':birthdate.slice(5);
  return String(year).padStart(4,'0')+'-'+monthDay;
}
export function ageOn(birthdate,today=jakartaToday()){
  if(!isValidDate(birthdate)||birthdate>today)return null;
  const year=Number(today.slice(0,4));
  return year-Number(birthdate.slice(0,4))-(today<birthdayInYear(birthdate,year)?1:0);
}
export function birthdayOverview(db,{month=Number(jakartaToday().slice(5,7)),schoolId='',groupId='',admin=false}={},today=jakartaToday()){
  if(!admin)throw Error('Ulang tahun hanya tersedia bagi admin.');
  const students=db.students.filter(s=>s.active&&(!schoolId||s.schoolId===schoolId)&&(!groupId||s.groupId===groupId));
  const valid=[],missing=[];
  for(const student of students){
    const birthdate=db.studentPrivateProfiles?.[student.id]?.dateOfBirth;
    if(!isValidDate(birthdate||'')||birthdate>today){missing.push(student);continue;}
    const year=Number(today.slice(0,4));let nextBirthday=birthdayInYear(birthdate,year);
    if(nextBirthday<today)nextBirthday=birthdayInYear(birthdate,year+1);
    const days=Math.round((Date.parse(nextBirthday+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000);
    valid.push({student,birthdate,age:ageOn(birthdate,today),nextBirthday,days,turningAge:Number(nextBirthday.slice(0,4))-Number(birthdate.slice(0,4))});
  }
  return {total:students.length,missing:missing.length,monthly:valid.filter(e=>Number(e.birthdate.slice(5,7))===Number(month)).sort((a,b)=>a.birthdate.slice(8).localeCompare(b.birthdate.slice(8))||a.student.name.localeCompare(b.student.name,'id')),upcoming:valid.filter(e=>e.days<=30).sort((a,b)=>a.days-b.days||a.student.name.localeCompare(b.student.name,'id'))};
}
