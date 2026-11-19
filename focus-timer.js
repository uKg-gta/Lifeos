'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LifeOSFocusTimer=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create(deps){
    const {$,getState,formatClock,save,newRecordId,dayKey,render,toast,formatMinutes}=deps;
    let interval=null;
    function timerSeconds(){const timer=getState().timer;if(timer.running&&timer.startedAt){const elapsed=Math.floor((Date.now()-timer.startedAt)/1000);return timer.mode==='countdown'?Math.max(0,timer.remaining-elapsed):timer.remaining+elapsed}return timer.remaining}
    function ensureTick(){if(interval||!getState().timer.running)return;interval=setInterval(timerTick,500)}
    function timerRender(){
      ensureTick();const timer=getState().timer,display=formatClock(timerSeconds());
      $('#miniTime').textContent=display;$('#fullTime').textContent=display;
      $('#timerStatus').textContent=timer.running?'Session in progress':timer.paused?'Session paused':'Ready when you are';
      $('#focusState').textContent=timer.running?'Running':timer.paused?'Paused':'Ready';
      $('#focusModeText').textContent=timer.mode==='countdown'?'Countdown · '+Math.round(timer.duration/60)+' minutes':'Open-ended stopwatch';
      $('#fullCaption').textContent=timer.mode==='countdown'?'FOCUS SESSION':'STOPWATCH';
      $('#startTimer').textContent=timer.running?'Running':timer.paused?'Resume':'Start focus';
      $('#startTimer').disabled=timer.running;$('#pauseTimer').disabled=!timer.running;$('#finishTimer').disabled=!(timer.running||timer.paused);
      $('#timerTopicLabel').textContent=$('#timerTopic').value?$('#timerSubject').value+' · '+$('#timerTopic').value:'No topic linked · optional';
      $('#miniStart').textContent=timer.running?'Running':timer.paused?'Resume':'Start';$('#miniStart').disabled=timer.running;$('#miniStop').disabled=!timer.running;$('#miniFinish').disabled=!(timer.running||timer.paused);
    }
    function timerTick(){const timer=getState().timer;if(!timer.running){clearInterval(interval);interval=null;return}timerRender();if(timer.mode==='countdown'&&timerSeconds()<=0)timerComplete()}
    function timerStart(){const timer=getState().timer;if(timer.running)return;if(timer.mode==='countdown'&&timer.remaining<=0)timer.remaining=timer.duration;timer.startedAt=Date.now();timer.running=true;timer.paused=false;save();timerRender()}
    function logFocusSession(seconds){const minutes=Math.max(1,Math.round(seconds/60));getState().sessions.unshift({id:newRecordId(),subject:$('#timerSubject').value,topic:$('#timerTopic').value,date:dayKey(),minutes,type:'Study',exam:$('#examSelect').value});return minutes}
    function timerReset(){const timer=getState().timer;timer.running=false;timer.paused=false;timer.startedAt=null;timer.remaining=timer.duration;save();timerRender()}
    function timerComplete(){const timer=getState().timer;if(!timer.running)return;clearInterval(interval);interval=null;const minutes=logFocusSession(timer.duration);timerReset();render();toast('Focus session complete · '+formatMinutes(minutes)+' saved')}
    function timerPause(){const timer=getState().timer;if(!timer.running)return;const elapsed=Math.floor((Date.now()-timer.startedAt)/1000);timer.remaining=timer.mode==='countdown'?Math.max(0,timer.remaining-elapsed):timer.remaining+elapsed;timer.running=false;timer.paused=true;timer.startedAt=null;save();timerRender()}
    function timerFinish(){const timer=getState().timer;if(!(timer.running||timer.paused))return;const elapsed=timer.running?Math.floor((Date.now()-timer.startedAt)/1000):0;const seconds=timer.mode==='countdown'?Math.max(0,timer.duration-timer.remaining+elapsed):timer.remaining+elapsed;const minutes=logFocusSession(seconds);timerReset();render();toast('Session saved · '+formatMinutes(minutes))}
    return Object.freeze({timerSeconds,timerRender,timerTick,ensureTick,timerStart,logFocusSession,timerComplete,timerPause,timerReset,timerFinish});
  }
  return Object.freeze({create});
});
