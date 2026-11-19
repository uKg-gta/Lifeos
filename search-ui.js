'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LifeOSSearchUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create(deps){
    const {$,queryAll,getState,safe,nav,closeSearchModal,setSearchReturnFocus}=deps;
    function search(){
      closeSearchModal();setSearchReturnFocus(document.activeElement);
      const dialog=document.createElement('div');dialog.className='modalback open';dialog.id='searchModal';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','searchTitle');dialog.tabIndex=-1;
      dialog.innerHTML='<div class="modal"><div class="modalhead"><h2 id="searchTitle">Search LifeOS</h2><button class="close" id="searchClose" aria-label="Close search">×</button></div><input class="search u-full-width" id="globalQ" aria-label="Search tasks, notes, study and library" placeholder="Search tasks, notes, study…"><div class="tiny muted u-mt-9">Finance is excluded from global search.</div><div id="globalResults" class="table"></div></div>';
      document.body.append(dialog);const input=$('#globalQ');
      input.oninput=()=>{
        const query=input.value.toLowerCase(),results=[],state=getState();
        state.tasks.filter(item=>item.title.toLowerCase().includes(query)&&query).forEach(item=>results.push({title:item.title,type:'Task',page:'tasks'}));
        state.notes.filter(item=>(item.title+' '+item.body).toLowerCase().includes(query)&&query).forEach(item=>results.push({title:item.title,type:'Note',page:'notes'}));
        state.syllabus.filter(item=>(item.topic+' '+item.subject).toLowerCase().includes(query)&&query).forEach(item=>results.push({title:item.topic,type:'Syllabus',page:'study'}));
        state.resources.filter(item=>(item.title+' '+item.author).toLowerCase().includes(query)&&query).forEach(item=>results.push({title:item.title,type:'Library',page:'library'}));
        $('#globalResults').innerHTML=results.length?results.map((item,index)=>'<button class="row global-result-row" data-result="'+index+'"><div class="rowmain"><div class="rowtitle">'+safe(item.title)+'</div><div class="rowsub">'+item.type+'</div></div>↗</button>').join(''):'<div class="empty">Start typing to search.</div>';
        queryAll('[data-result]').forEach(button=>button.onclick=()=>{const item=results[Number(button.dataset.result)];closeSearchModal();nav(item.page)});
      };
      $('#searchClose').onclick=closeSearchModal;dialog.onclick=event=>{if(event.target===dialog)closeSearchModal()};input.focus();
    }
    return Object.freeze({search});
  }
  return Object.freeze({create});
});
