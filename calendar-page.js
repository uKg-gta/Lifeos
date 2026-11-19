'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LifeOSCalendarPage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create(deps){
    const {$,getState,dateLabel,addDays,dayKey,safe,getWeekOffset}=deps;
    function calendarPage(){
      const todayDate=new Date(),start=new Date(todayDate);start.setHours(12,0,0,0);start.setDate(todayDate.getDate()-((todayDate.getDay()+6)%7)+getWeekOffset()*7);
      $('#calendarTitle').textContent=dateLabel(start)+' — '+dateLabel(addDays(6,start));
      const today=dayKey();let html='';
      for(let index=0;index<7;index++){
        const day=addDays(index,start),key=dayKey(day),tasks=getState().tasks.filter(task=>task.due===key);
        html+='<div class="eyebrow task-group-heading">'+safe(dateLabel(day))+(key===today?' · Today':'')+' · '+tasks.length+'</div>'+(tasks.length?tasks.map(task=>'<div class="row"><div class="rowmain"><div class="rowtitle">'+safe(task.title)+'</div><div class="rowsub">'+safe(task.priority)+' priority · '+safe(task.category)+'</div></div><span class="status '+(task.status==='done'?'done':'active')+'">'+(task.status==='done'?'Completed':'Planned')+'</span></div>').join(''):'<div class="rowsub calendar-empty">Nothing planned</div>');
      }
      $('#calendarList').innerHTML=html;
    }
    return Object.freeze({calendarPage});
  }
  return Object.freeze({create});
});
