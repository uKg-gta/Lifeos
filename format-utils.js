'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LifeOSFormatUtils=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
  function priorityWeight(priority){return priority==='High'?3:priority==='Low'?1:2}
  function formatMinutes(value){const minutes=Math.max(0,Math.round(value||0));return minutes>=60?Math.floor(minutes/60)+'h '+minutes%60+'m':minutes+'m'}
  function formatRupees(value){const amount=Math.round(Number(value)||0);return (amount<0?'−':'')+'₹'+Math.abs(amount).toLocaleString('en-IN')}
  function formatClockSeconds(value){const seconds=Math.max(0,Number(value)||0);return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(Math.floor(seconds)%60).padStart(2,'0')}
  return Object.freeze({escapeHtml,priorityWeight,formatMinutes,formatRupees,formatClockSeconds});
});
