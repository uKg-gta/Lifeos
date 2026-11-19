'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LifeOSNotesPage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create(deps){
    const {$,queryAll,getState,safe,modal,save,toast}=deps;
    function notesPage(){
      const state=getState(),query=($('#noteSearch')?.value||'').toLowerCase();
      const notes=[...state.notes].sort((a,b)=>Number(b.pinned)-Number(a.pinned)).filter(note=>(note.title+' '+note.body+' '+note.category).toLowerCase().includes(query));
      $('#notesGrid').innerHTML=notes.map(note=>'<article class="notecard"><div class="head head-tight"><span class="pill">'+safe(note.category)+'</span>'+(note.pinned?'<span class="pill pinned-pill">📌 Pinned</span>':'')+'</div><h3 class="note-title"><button class="note-open" data-edit-note="'+note.id+'" aria-label="Open note '+safe(note.title)+'">'+safe(note.title)+'</button></h3><footer class="note-actions"><button class="textbtn" data-edit-note="'+note.id+'" aria-label="Edit note '+safe(note.title)+'">Edit</button><button class="textbtn" data-pin-note="'+note.id+'" aria-label="'+(note.pinned?'Unpin':'Pin')+' note '+safe(note.title)+'">'+(note.pinned?'Unpin':'Pin')+'</button><button class="textbtn note-delete" data-delete-note="'+note.id+'" aria-label="Delete note '+safe(note.title)+'">Delete</button></footer></article>').join('')||'<div class="empty">No notes match your search.</div>';
      queryAll('[data-edit-note]').forEach(button=>button.onclick=()=>modal('note',getState().notes.find(note=>note.id===Number(button.dataset.editNote))));
      queryAll('[data-pin-note]').forEach(button=>button.onclick=()=>{const note=getState().notes.find(item=>item.id===Number(button.dataset.pinNote));if(!note)return;note.pinned=!note.pinned;save();notesPage()});
      queryAll('[data-delete-note]').forEach(button=>button.onclick=()=>{const state=getState(),index=state.notes.findIndex(note=>note.id===Number(button.dataset.deleteNote));if(index<0)return;const removed=state.notes.splice(index,1)[0];save();notesPage();toast('Note deleted.',()=>getState().notes.splice(Math.min(index,getState().notes.length),0,removed))});
    }
    return Object.freeze({notesPage});
  }
  return Object.freeze({create});
});
