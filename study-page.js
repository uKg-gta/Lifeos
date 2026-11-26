'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LifeOSStudyPage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create(deps){
    const {$,queryAll,getState,safe,examDaysLeft,formatMinutes,studyWeekMins,studyTodayMins,studyTargetMins,studyProgressText,formatHoursMinutes,save,render,toast,sessionDateLabel}=deps;
    function subjectNames(){const state=getState();return [...new Set([...(state.subjects||[]),...state.syllabus.map(item=>item.subject),...state.sessions.map(item=>item.subject)].filter(Boolean))].sort((a,b)=>a.localeCompare(b))}
    function subjectOptions(selected=''){const names=subjectNames();if(selected&&!names.includes(selected))names.push(selected);return names.map(name=>'<option '+(name===selected?'selected':'')+'>'+safe(name)+'</option>').join('')}
    function refreshSubjectControls(){
      const state=getState(),timerExam=$('#timerExam'),timerSubject=$('#timerSubject'),timerTopic=$('#timerTopic');
      const examSelect=$('#examSelect');
      if(examSelect){const current=examSelect.value;examSelect.innerHTML='<option value="">Select an exam</option>'+state.exams.map(exam=>'<option value="'+safe(exam.name)+'">'+safe(exam.name)+'</option>').join('');if(current&&state.exams.some(exam=>exam.name===current))examSelect.value=current}
      if(timerExam){
        const current=timerExam.value;
        timerExam.innerHTML='<option value="">No exam selected</option>'+state.exams.map(exam=>'<option value="'+safe(exam.name)+'">'+safe(exam.name)+'</option>').join('');
        if(current&&state.exams.some(exam=>exam.name===current))timerExam.value=current;
      }
      const examName=timerExam?.value||'';
      const subjects=[...new Set(state.syllabus.filter(item=>item.exam===examName&&item.subject).map(item=>item.subject))].sort((a,b)=>a.localeCompare(b));
      const selectedSubject=timerSubject?.value||'';
      if(timerSubject){
        timerSubject.innerHTML='<option value="">Select a subject</option>'+subjects.map(name=>'<option value="'+safe(name)+'">'+safe(name)+'</option>').join('');
        timerSubject.disabled=!examName||!subjects.length;
        if(selectedSubject&&subjects.includes(selectedSubject))timerSubject.value=selectedSubject;
      }
      const subjectName=timerSubject?.value||'';
      const topics=state.syllabus.filter(item=>item.exam===examName&&item.subject===subjectName&&item.topic);
      const selectedTopic=timerTopic?.value||'';
      if(timerTopic){
        timerTopic.innerHTML='<option value="">Select a topic</option>'+topics.map(item=>'<option value="'+safe(item.topic)+'">'+safe(item.topic)+'</option>').join('');
        timerTopic.disabled=!examName||!subjectName||!topics.length;
        if(selectedTopic&&topics.some(item=>item.topic===selectedTopic))timerTopic.value=selectedTopic;
      }
    }
    function sessionRow(session){return '<div class="row"><div class="rowmain"><div class="rowtitle">'+safe(session.subject||'No subject')+(session.topic?' · '+safe(session.topic):'')+'</div><div class="rowsub">'+safe(sessionDateLabel(session.date))+' · '+safe(session.type||'Study')+'</div></div><span class="status active">'+formatMinutes(session.minutes)+'</span><button class="textbtn" data-del-session="'+session.id+'" aria-label="Delete session">×</button></div>'}
    function wireSessions(){queryAll('[data-del-session]').forEach(button=>button.onclick=()=>{const state=getState(),index=state.sessions.findIndex(item=>item.id===Number(button.dataset.delSession));if(index<0)return;const old=state.sessions.splice(index,1)[0];save();render();toast('Session deleted.',()=>{getState().sessions.splice(Math.min(index,getState().sessions.length),0,old)})})}
    function studyPage(){
      const state=getState(),examName=$('#examSelect').value,exam=examName?state.exams.find(item=>item.name===examName):null;
      const topics=examName?state.syllabus.filter(topic=>topic.exam===examName):[],sessions=examName?state.sessions.filter(session=>session.exam===examName):[];
      $('#examDays').textContent=exam&&exam.date?examDaysLeft(exam.date):'—';$('#studyWeek').textContent=formatMinutes(studyWeekMins());$('#sessionCount').textContent=state.sessions.length;
      $('#syllabusPercent').textContent=Math.round(topics.filter(topic=>topic.status==='Completed').length/Math.max(1,topics.length)*100)+'%';
      $('#syllabus').innerHTML=topics.map(topic=>'<div class="row"><div class="rowmain"><div class="rowtitle">'+safe(topic.topic)+'</div><div class="rowsub">'+safe(topic.subject)+' · '+topic.revisions+' revisions</div></div><select data-topic="'+topic.id+'" aria-label="Status of '+safe(topic.topic)+'">'+['Not started','In progress','Completed'].map(value=>'<option '+(topic.status===value?'selected':'')+'>'+value+'</option>').join('')+'</select><button class="textbtn" data-revise="'+topic.id+'" aria-label="Record a revision" title="Record a revision">↻</button><button class="textbtn" data-del-topic="'+topic.id+'" aria-label="Delete topic" title="Delete topic">×</button></div>').join('')||(examName?'<div class="empty">No topics yet. Add the first topic for this exam.</div>':'<div class="empty">Select or create an exam, then add syllabus topics.</div>');
      $('#studyRecent').innerHTML=sessions.slice(0,5).map(sessionRow).join('')||'<div class="empty">'+(examName?'No sessions logged for this exam yet.':'Select or create an exam to see its sessions.')+'</div>';
      $('#addTopic').disabled=!examName;$('#editExam').disabled=!examName;$('#deleteExam').disabled=!examName;
      queryAll('[data-topic]').forEach(control=>control.onchange=()=>{const topic=getState().syllabus.find(item=>item.id===Number(control.dataset.topic));if(!topic)return;topic.status=control.value;save();studyPage()});
      queryAll('[data-revise]').forEach(control=>control.onclick=()=>{const topic=getState().syllabus.find(item=>item.id===Number(control.dataset.revise));if(!topic)return;topic.revisions++;save();studyPage();toast('Revision recorded.')});
      queryAll('[data-del-topic]').forEach(control=>control.onclick=()=>{const state=getState(),index=state.syllabus.findIndex(item=>item.id===Number(control.dataset.delTopic));if(index<0)return;const removed=state.syllabus.splice(index,1)[0];save();studyPage();toast('Topic deleted.',()=>{getState().syllabus.splice(Math.min(index,getState().syllabus.length),0,removed)})});
      const target=studyTargetMins(),hours=$('#targetH'),minutes=$('#targetM');$('#targetDisplay').textContent=formatHoursMinutes(target);$('#targetSummary').textContent=studyProgressText(studyTodayMins(),target);
      if(document.activeElement!==hours&&document.activeElement!==minutes){hours.value=Math.floor(target/60);minutes.value=target%60}
      $('#saveTarget').onclick=()=>{const h=Math.floor(Number(hours.value||0)),m=Math.floor(Number(minutes.value||0)),total=h*60+m;if(!Number.isFinite(total)||h<0||m<0||m>59||total<5||total>1440){toast('Enter a target between 5 minutes and 24 hours.');return}deps.getPrefs().studyTargetMins=total;save();render();toast('Daily target saved.')};
      wireSessions();
    }
    return Object.freeze({subjectNames,subjectOptions,refreshSubjectControls,sessionRow,studyPage,wireSessions});
  }
  return Object.freeze({create});
});
