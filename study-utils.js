'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LifeOSStudyUtils=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function normalizedMinutes(value){
    const minutes=Math.round(Number(value)||0);
    return Math.max(0,minutes);
  }
  function formatDuration(value){
    const minutes=normalizedMinutes(value);
    const hours=Math.floor(minutes/60),remainder=minutes%60;
    return hours?(remainder?hours+'h '+remainder+'m':hours+'h'):remainder+'m';
  }
  function formatHoursMinutes(value){
    const minutes=normalizedMinutes(value);
    return Math.floor(minutes/60)+'h '+String(minutes%60).padStart(2,'0')+'m';
  }
  function progressText(done,target){
    const completed=normalizedMinutes(done),goal=normalizedMinutes(target);
    const pct=goal?Math.round(completed/goal*100):0;
    return formatDuration(completed)+' studied · '+formatDuration(goal)+' target · '+pct+'%' +(completed>goal?' · '+formatDuration(completed-goal)+' over':'');
  }
  return Object.freeze({formatDuration,formatHoursMinutes,progressText});
});
