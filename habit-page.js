'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LifeOSHabitPage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create(deps){
    const {$,queryAll,getState,dayKey,save,render,toast,wire,safe,modal,inPageConfirm}=deps;
    function weekdayKey(key){return new Date(key+'T12:00:00').getDay()}
    function habitScheduledOn(habit,key){const day=weekdayKey(key);return !habit.days||habit.days.length===0||habit.days.includes(day)}
    function habitScheduled(habit){return habitScheduledOn(habit,dayKey())}
    function habitHistory(habit){const history=Array.isArray(habit.history)?habit.history.slice():[];if(habit.doneDate&&!history.includes(habit.doneDate))history.push(habit.doneDate);return [...new Set(history.filter(value=>/^\d{4}-\d{2}-\d{2}$/.test(value)))].sort()}
    function habitDone(habit,key=dayKey()){return habitHistory(habit).includes(key)}
    function habitStreak(habit){const history=new Set(habitHistory(habit));let date=new Date();if(!history.has(dayKey(date))){date.setDate(date.getDate()-1);while(!habitScheduledOn(habit,dayKey(date))&&!history.has(dayKey(date))&&date.getTime()>Date.now()-40*86400000)date.setDate(date.getDate()-1)}let streak=0;for(let i=0;i<400;i++){const key=dayKey(date);if(habitScheduledOn(habit,key)){if(history.has(key))streak++;else break}date.setDate(date.getDate()-1)}return streak}
    function habitStats(){const state=getState();let total=0,done=0;const streaks=[],today=dayKey();for(const habit of state.habits){streaks.push(habitStreak(habit));for(let i=0;i<30;i++){const date=new Date();date.setDate(date.getDate()-i);const key=dayKey(date);if(habitScheduledOn(habit,key)){total++;if(habitDone(habit,key))done++}}}return {total,done,rate:total?Math.round(done/total*100):0,best:streaks.length?Math.max(...streaks):0}}
    function habitRow(habit,showUnscheduled=false){
      if(!habitScheduled(habit)&&!showUnscheduled)return '';
      const done=habitDone(habit),icons={
        '◉':['linear-gradient(135deg, rgba(16,185,129,0.22), rgba(52,211,153,0.12))','rgba(16,185,129,0.35)'],
        '📖':['linear-gradient(135deg, rgba(129,140,248,0.22), rgba(99,102,241,0.12))','rgba(129,140,248,0.35)'],
        '🚶':['linear-gradient(135deg, rgba(56,189,248,0.22), rgba(14,165,233,0.12))','rgba(56,189,248,0.35)'],
        '💧':['linear-gradient(135deg, rgba(96,165,250,0.22), rgba(59,130,246,0.12))','rgba(96,165,250,0.35)'],
        '✎':['linear-gradient(135deg, rgba(251,191,36,0.22), rgba(245,158,11,0.12))','rgba(251,191,36,0.35)'],
        '🧘':['linear-gradient(135deg, rgba(192,132,252,0.22), rgba(168,85,247,0.12))','rgba(192,132,252,0.35)'],
        '🏋️':['linear-gradient(135deg, rgba(251,113,133,0.22), rgba(244,63,94,0.12))','rgba(251,113,133,0.35)']
      };
      const icon=habit.icon||'◉',style=icons[icon]||['linear-gradient(135deg, rgba(16,185,129,0.22), rgba(56,189,248,0.12))','rgba(16,185,129,0.3)'];
      const days=habit.frequency==='selected'?(habit.days||[]).slice().sort((a,b)=>((a+6)%7)-((b+6)%7)).map(day=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day]).join(' · '):'Every day';
      const streak=habitStreak(habit);
      return '<div class="habitrow"><div class="habiticon" style="background:'+style[0]+'!important;border-color:'+style[1]+'!important">'+safe(icon)+'</div><div class="habitlabel"><b>'+safe(habit.name)+'</b><small>'+days+' · <span class="habit-streak">🔥 '+streak+' day streak</span></small></div><button class="habitcheck '+(done?'done':'')+'" data-hcheck="'+habit.id+'" aria-pressed="'+done+'" aria-label="'+(done?'Undo check-in for ':'Check in ')+safe(habit.name)+'">'+(done?'✓':'+')+'</button><button class="textbtn" title="Edit habit" aria-label="Edit habit" data-edit-habit="'+habit.id+'">✎</button><button class="textbtn" title="Delete habit" aria-label="Delete habit" data-delete-habit="'+habit.id+'">×</button></div>';
    }
    function habitsPage(){
      const state=getState();$('#habitList').innerHTML=state.habits.map(habit=>habitRow(habit,true)).join('')||'<div class="empty">Create a habit once. It will appear automatically on its scheduled days.</div>';
      const stats=habitStats(),scheduled=state.habits.filter(habitScheduled);$('#habitMetric').textContent=scheduled.filter(habit=>habitDone(habit)).length+' / '+scheduled.length;
      $('#habitStreakMetric').textContent=stats.best+' day'+(stats.best===1?'':'s');$('#habitCompletionMetric').textContent=stats.rate+'%';
      $('#routineList').innerHTML=state.routines.map(routine=>{const steps=Array.isArray(routine.steps)?routine.steps:[];return '<div class="routine-block"><div class="head"><div><b>'+safe(routine.name)+'</b><div class="rowsub">'+steps.filter(step=>step.done).length+' of '+steps.length+' steps complete</div></div><div><button class="btn" data-routine-reset="'+routine.id+'">Reset</button> <button class="textbtn" data-routine-delete="'+routine.id+'" aria-label="Delete routine '+safe(routine.name)+'">Delete</button></div></div>'+steps.map(step=>'<label class="checkline"><input type="checkbox" data-routine-step="'+routine.id+':'+step.id+'" '+(step.done?'checked':'')+'> '+safe(step.text)+'</label>').join('')+'</div>'}).join('')||'<div class="empty">Create a routine and add steps to build a repeatable sequence.</div>';
      wire();
      queryAll('[data-routine-step]').forEach(control=>control.onchange=()=>{const [routineId,stepId]=control.dataset.routineStep.split(':').map(Number),routine=getState().routines.find(item=>item.id===routineId),step=routine?.steps?.find(item=>item.id===stepId);if(step)step.done=control.checked;save();habitsPage()});
      queryAll('[data-routine-reset]').forEach(button=>button.onclick=()=>{const routine=getState().routines.find(item=>item.id===Number(button.dataset.routineReset));if(!routine)return;routine.steps.forEach(step=>step.done=false);save();habitsPage()});
      queryAll('[data-routine-delete]').forEach(button=>button.onclick=()=>{const state=getState(),index=state.routines.findIndex(item=>item.id===Number(button.dataset.routineDelete));if(index<0)return;const removed=state.routines.splice(index,1)[0];save();habitsPage();toast('Routine deleted.',()=>getState().routines.splice(Math.min(index,getState().routines.length),0,removed))});
    }
    return Object.freeze({habitScheduledOn,habitScheduled,habitHistory,habitDone,habitStreak,habitStats,habitRow,habitsPage});
  }
  return Object.freeze({create});
});
