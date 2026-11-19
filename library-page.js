'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LifeOSLibraryPage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create(deps){
    const {$,queryAll,getState,getBookView,safe,save,toast,modal,inPageConfirm}=deps;
    function libraryPage(){
      const state=getState(),query=($('#librarySearch')?.value||'').toLowerCase(),status=$('#libraryStatus').value,type=$('#libraryType').value,view=getBookView();
      const resources=state.resources.filter(item=>(status==='all'||item.status===status)&&(type==='all'||item.type===type)&&(item.title+' '+item.author+' '+item.type).toLowerCase().includes(query)).sort((a,b)=>Number(b.pinned)-Number(a.pinned));
      $('#readingCount').textContent=state.resources.filter(item=>item.status==='Reading').length;$('#wantCount').textContent=state.resources.filter(item=>item.status==='Want to Read').length;$('#completedCount').textContent=state.resources.filter(item=>item.status==='Completed').length;
      $('#booksGrid').style.gridTemplateColumns=view==='cards'?'':'1fr';
      $('#booksGrid').innerHTML=resources.map(item=>view==='cards'?'<article class="bookcard"><div class="cover">'+safe(item.title)+'</div><div class="head head-tight"><span class="pill">'+safe(item.type)+'</span><button class="textbtn" data-edit-resource="'+item.id+'" aria-label="Edit resource" title="Edit resource">✎</button><button class="textbtn" data-delete-resource="'+item.id+'" title="Delete resource">×</button></div><h3>'+(item.pinned?'📌 ':'')+safe(item.title)+'</h3><div class="tiny muted">'+safe(item.author)+'</div><div class="head head-tight"><span class="status '+(item.status==='Completed'?'done':'')+'">'+safe(item.status)+'</span><span>'+(item.rating?'★'.repeat(item.rating):'')+'</span></div><select data-rstatus="'+item.id+'">'+['Want to Read','Not started','Reading','Completed'].map(value=>'<option '+(item.status===value?'selected':'')+'>'+value+'</option>').join('')+'</select></article>':'<div class="row"><div class="rowmain"><div class="rowtitle">'+(item.pinned?'📌 ':'')+safe(item.title)+'</div><div class="rowsub">'+safe(item.author)+' · '+safe(item.type)+'</div></div><select data-rstatus="'+item.id+'">'+['Want to Read','Not started','Reading','Completed'].map(value=>'<option '+(item.status===value?'selected':'')+'>'+value+'</option>').join('')+'</select><button class="textbtn" data-edit-resource="'+item.id+'" title="Edit resource">✎</button><button class="textbtn" data-delete-resource="'+item.id+'" title="Delete resource">×</button></div>').join('')||'<div class="empty">No resources match. <button class="linkbtn" data-add="resource">＋ Add your first resource</button></div>';
      queryAll('[data-rstatus]').forEach(control=>control.onchange=()=>{getState().resources.find(item=>item.id===Number(control.dataset.rstatus)).status=control.value;save();libraryPage();toast('Reading status updated.')});
      queryAll('[data-edit-resource]').forEach(button=>button.onclick=()=>modal('resource',getState().resources.find(item=>item.id===Number(button.dataset.editResource))));
      queryAll('[data-delete-resource]').forEach(button=>button.onclick=()=>{const item=getState().resources.find(resource=>resource.id===Number(button.dataset.deleteResource));if(!item)return;inPageConfirm('Delete resource','Delete “'+item.title+'” from your library?',()=>{const state=getState();state.resources=state.resources.filter(resource=>resource.id!==item.id);save();libraryPage();toast('Resource deleted.')},true)});
    }
    return Object.freeze({libraryPage});
  }
  return Object.freeze({create});
});
