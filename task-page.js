'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LifeOSTaskPage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create(deps){
    const {$,getState,getTaskView,safe,wire}=deps;
    function taskRow(task,full=false){
      const priorityClass=task.priority==='High'?'prio-high':task.priority==='Low'?'prio-low':'prio-medium';
      const category=String(task.category||'').toLowerCase();
      const categoryClass=category==='study'?'cat-study':category==='health'?'cat-health':category==='work'?'cat-work':category==='projects'?'cat-projects':'cat-personal';
      return '<div class="'+(full?'row':'taskrow')+' '+(task.status==='done'?'done':'')+'"><input type="checkbox" class="check" data-check="'+task.id+'" '+(task.status==='done'?'checked':'')+' aria-label="Complete '+safe(task.title)+'"><div class="'+(full?'rowmain':'taskmain')+'"><div class="'+(full?'rowtitle':'taskname')+'">'+safe(task.title)+'</div><div class="'+(full?'rowsub':'taskmeta')+'"><span class="'+priorityClass+'"><span class="dot '+String(task.priority||'Medium').toLowerCase()+'"></span>'+safe(task.priority)+'</span><span class="cat-tag '+categoryClass+'">'+safe(task.category)+'</span>'+(task.estimate?'<span class="tiny muted">⏱ '+task.estimate+'m</span>':'')+'</div></div><div class="task-actions"><button class="task-btn" data-edit-task="'+task.id+'" aria-label="Edit task '+safe(task.title)+'">Edit</button><button class="task-btn task-btn-danger" data-delete-task="'+task.id+'" aria-label="Delete task '+safe(task.title)+'">Delete</button></div></div>';
    }
    function tasksPage(){
      const state=getState(),query=($('#taskSearch')?.value||'').toLowerCase(),priority=$('#taskPriority')?.value||'all';
      const list=state.tasks.filter(task=>(task.title+' '+task.category).toLowerCase().includes(query)&&(priority==='all'||task.priority===priority));
      const view=getTaskView();
      if(view==='status')$('#taskList').innerHTML=[['To do',list.filter(task=>task.status!=='done')],['Completed',list.filter(task=>task.status==='done')]].map(([label,items])=>'<div class="eyebrow task-group-heading">'+label+' · '+items.length+'</div>'+items.map(task=>taskRow(task,true)).join('')).join('');
      else if(view==='time')$('#taskList').innerHTML=[['Today',list.filter(task=>task.date==='today')],['Upcoming',list.filter(task=>task.date==='tomorrow'||task.date==='later')],['No date',list.filter(task=>task.date==='none')]].map(([label,items])=>'<div class="eyebrow task-group-heading">'+label+' · '+items.length+'</div>'+items.map(task=>taskRow(task,true)).join('')).join('');
      else $('#taskList').innerHTML=list.map(task=>taskRow(task,true)).join('')||'<div class="empty">No tasks match your search.</div>';
      wire();
    }
    return Object.freeze({taskRow,tasksPage});
  }
  return Object.freeze({create});
});
