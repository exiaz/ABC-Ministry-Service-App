// Keep Tuesday fixtures in the future in every supported Indonesian timezone.
export function scheduleDate(offset=0,at=Date.now()){
  const day=new Date(at);day.setUTCHours(0,0,0,0);day.setUTCDate(day.getUTCDate()+2);
  day.setUTCDate(day.getUTCDate()+(2-day.getUTCDay()+7)%7+offset);
  return day.toISOString().slice(0,10);
}
