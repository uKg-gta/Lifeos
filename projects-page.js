'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LifeOSGoalsPage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create(deps){
    const {$,queryAll,getState,safe,save,render,toast,modal,inPageConfirm,bindModalClose,showModal,closeModal}=deps;
    function projectsPage(){
      const state=getState();const active=state.goals.filter(goal=>goal.status!=='Completed').length;$('#goalTotal').textContent=state.goals.length;$('#goalCount').textContent=active;
      $('#goalGrid').innerHTML=state.goals.map(goal=>{const subgoals=goal.subgoals||[],done=subgoals.filter(item=>item.done).length,percent=subgoals.length?Math.round(done/subgoals.length*100):0;return '<article class="module goal-card" data-open-goal="'+goal.id+'" tabindex="0"><div class="moduleicon">'+(goal.area==='Studies'?'▤':goal.area==='Health'?'◉':'◇')+'</div><b>'+safe(goal.title)+'</b>'+(subgoals.length?'<div class="bar"><div style="width:'+percent+'%"></div></div><div class="tiny muted">'+done+' of '+subgoals.length+' sub-goals · '+percent+'%</div>':'<div class="tiny muted">No sub-goals added</div>')+'<div class="modulefoot"><span>'+safe(goal.area)+(goal.date?' · '+safe(goal.date):' · No target date')+'</span><span>'+safe(goal.status)+'</span></div></article>'}).join('')||'<div class="empty">Your long-term goals will appear here. Create your first goal when you are ready.</div>';
      queryAll('[data-open-goal]').forEach(element=>{const open=()=>openGoal(Number(element.dataset.openGoal));element.onclick=open;element.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}}});
    }
    function openGoal(id){
      const goal=getState().goals.find(item=>item.id===id);if(!goal)return;const subgoals=goal.subgoals||[],done=subgoals.filter(item=>item.done).length,percent=subgoals.length?Math.round(done/subgoals.length*100):0;
      $('#modalTitle').textContent=goal.title;
      $('#modalBody').innerHTML='<div class="form"><div class="pill">'+safe(goal.area)+' · '+safe(goal.status)+'</div><p>'+safe(goal.desc||'No description added.')+'</p><div class="small muted">Target: '+safe(goal.date||'No target date')+'</div><div class="bar"><div style="width:'+percent+'%"></div></div><b>'+percent+'% progress</b><div class="field"><label>Sub-goals</label>'+(subgoals.length?subgoals.map(item=>'<label class="checkline"><input type="checkbox" data-goal-sub="'+item.id+'" '+(item.done?'checked':'')+'> '+safe(item.text)+'</label>').join(''):'<p class="tiny muted">No sub-goals for this goal.</p>')+'</div><div class="field"><label>Timeline</label>'+((goal.timeline||[]).map(item=>'<div class="rowsub">'+safe(new Date(item.date).toLocaleDateString())+' · '+safe(item.text)+'</div>').join('')||'<div class="rowsub">Goal created</div>')+'</div><div class="field"><label>Goal status</label><select id="goalStatus"><option '+(goal.status==='Not started'?'selected':'')+'>Not started</option><option '+(goal.status==='Active'?'selected':'')+'>Active</option><option '+(goal.status==='Ongoing'?'selected':'')+'>Ongoing</option><option '+(goal.status==='Completed'?'selected':'')+'>Completed</option></select></div><div class="goal-actions"><button class="btn" id="editGoal">Edit goal details</button><button class="btn danger-btn" id="deleteGoal">Delete goal</button></div></div>';
      $('#modalSave').textContent='Done';bindModalClose();showModal();
      $('#modalSave').onclick=()=>{closeModal();save();render()};
      queryAll('[data-goal-sub]').forEach(control=>control.onchange=()=>{const subgoal=goal.subgoals.find(item=>item.id===Number(control.dataset.goalSub));subgoal.done=control.checked;goal.timeline=goal.timeline||[];goal.timeline.unshift({date:new Date().toISOString(),text:(control.checked?'Completed: ':'Reopened: ')+subgoal.text});save();openGoal(id)});
      $('#goalStatus').onchange=event=>{goal.status=event.target.value;goal.timeline=goal.timeline||[];goal.timeline.unshift({date:new Date().toISOString(),text:'Goal marked '+goal.status.toLowerCase()});save();openGoal(id)};
      $('#editGoal').onclick=()=>modal('goal',goal);
      $('#deleteGoal').onclick=()=>inPageConfirm('Delete goal','Delete goal “'+goal.title+'”? Its sub-goals and timeline will also be removed.',()=>{const state=getState(),index=state.goals.findIndex(item=>item.id===goal.id);if(index<0)return;const removed=state.goals.splice(index,1)[0];closeModal();save();render();toast('Goal deleted.',()=>state.goals.splice(Math.min(index,state.goals.length),0,removed))},true);
    }
    return Object.freeze({goalsPage:projectsPage,openGoal});
  }
  return Object.freeze({create});
});
