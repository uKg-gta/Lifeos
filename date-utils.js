'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LifeOSDateUtils=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function dayKey(date=new Date()){
    return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  }
  function weekdayKey(key){return new Date(key+'T12:00:00').getDay()}
  function addDays(amount,from=new Date()){const date=new Date(from);date.setDate(date.getDate()+amount);return date}
  function weekStartKey(date=new Date()){const start=new Date(date);start.setDate(start.getDate()-((start.getDay()+6)%7));return dayKey(start)}
  function examDaysLeft(value){const target=new Date(value+'T00:00:00');if(Number.isNaN(target.getTime()))return '—';const today=new Date();today.setHours(0,0,0,0);const difference=Math.round((target-today)/86400000);return difference<0?'—':difference}
  function formatTime(date=new Date(),clock='12'){const use24=clock==='24';return date.toLocaleTimeString(use24?'en-GB':'en-US',{hour:use24?'2-digit':'numeric',minute:'2-digit',hour12:!use24})}
  function fullDateLabel(date=new Date(),format='dmy'){
    if(format==='iso')return date.toLocaleDateString('en-CA')+' ('+date.toLocaleDateString('en-IN',{weekday:'short'})+')';
    if(format==='mdy')return date.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
    return date.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
  }
  function dateLabel(date=new Date(),format='dmy'){
    if(format==='iso')return date.toLocaleDateString('en-CA');
    if(format==='mdy')return date.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
    return date.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});
  }
  return Object.freeze({dayKey,weekdayKey,addDays,weekStartKey,examDaysLeft,formatTime,fullDateLabel,dateLabel});
});
