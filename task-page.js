'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LifeOSTaskPage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create(deps){
    const {$,getState,getTaskView,getToday=()=>new Date().toISOString().slice(0,10),safe,wire}=deps;
    function taskRow(task,full=false){
      const priorityClass=task.priority==='High'?'prio-high':task.priority==='Low'?'prio-low':'prio-medium';
      const category=String(task.category||'').toLowerCase();
      const categoryClass=category==='study'?'cat-study':category==='health'?'cat-health':category==='work'?'cat-work':category==='projects'?'cat-projects':'cat-personal';
      const due=task.due?'<span class="tiny muted">Due '+safe(new Date(task.due+'T12:00:00').toLocaleDateString(undefined,{day:'numeric',month:'short'}))+'</span>':'';
      return '<div class="'+(full?'row':'taskrow')+' '+(task.status==='done'?'done':'')+'"><input type="checkbox" class="check" data-check="'+task.id+'" '+(task.status==='done'?'checked':'')+' aria-label="Complete '+safe(task.title)+'"><div class="'+(full?'rowmain':'taskmain')+'"><div class="'+(full?'rowtitle':'taskname')+'">'+safe(task.title)+'</div><div class="'+(full?'rowsub':'taskmeta')+'"><span class="'+priorityClass+'"><span class="dot '+String(task.priority||'Medium').toLowerCase()+'"></span>'+safe(task.priority)+'</span><span class="cat-tag '+categoryClass+'">'+safe(task.category)+'</span>'+due+(task.estimate?'<span class="tiny muted">⏱ '+task.estimate+'m</span>':'')+'</div></div><div class="task-actions"><button class="task-btn" data-edit-task="'+task.id+'" aria-label="Edit task '+safe(task.title)+'">Edit</button><button class="task-btn task-btn-danger" data-delete-task="'+task.id+'" aria-label="Delete task '+safe(task.title)+'">Delete</button></div></div>';
    }
    function bucket(task,today){
      if(task.status==='done')return 'completed';
      if(task.due){if(task.due<today)return 'overdue';if(task.due===today)return 'today';return 'upcoming'}
      if(task.date==='today')return 'today';
      if(task.date==='tomorrow'||task.date==='later')return 'upcoming';
      return 'none';
    }
    function tasksPage(){
      const state=getState(),query=($('#taskSearch')?.value||'').toLowerCase(),priority=$('#taskPriority')?.value||'all';
      const today=getToday();
      const list=state.tasks.filter(task=>(task.title+' '+task.category).toLowerCase().includes(query)&&(priority==='all'||task.priority===priority));
      const view=getTaskView(),items=list.filter(task=>bucket(task,today)===view);
      const labels={today:'Today',upcoming:'Upcoming',overdue:'Overdue',completed:'Completed',none:'No Date'};
      $('#taskList').innerHTML=items.map(task=>taskRow(task,true)).join('')||'<div class="empty">No '+(labels[view]||'')+' tasks'+(view==='overdue'?' right now.':'.')+'</div>';
      wire();
    }
    return Object.freeze({taskRow,tasksPage,bucket});
  }
  return Object.freeze({create});
});
