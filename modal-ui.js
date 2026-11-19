'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LifeOSModalUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create(deps){
    const {$,safe}=deps;let modalReturnFocus=null,searchReturnFocus=null;
    function showModal(){const overlay=$('#modalBack');if(!overlay.classList.contains('open'))modalReturnFocus=document.activeElement;overlay.classList.add('open');const first=$('#modalBody input,#modalBody select,#modalBody textarea')||$('#modalCancel');setTimeout(()=>first?.focus(),0)}
    function closeModal(){const overlay=$('#modalBack'),wasOpen=overlay.classList.contains('open');overlay.classList.remove('open');const target=modalReturnFocus;modalReturnFocus=null;if(wasOpen&&target?.isConnected)target.focus()}
    function setSearchReturnFocus(target){searchReturnFocus=target}
    function closeSearchModal(){const dialog=$('#searchModal');if(!dialog)return;dialog.remove();const target=searchReturnFocus;searchReturnFocus=null;if(target?.isConnected)target.focus()}
    function trapDialogTab(event,dialog){const selector='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';const items=[...dialog.querySelectorAll(selector)].filter(item=>!item.hidden&&item.getAttribute('aria-hidden')!=='true'&&item.getClientRects().length);if(!items.length){event.preventDefault();return}const first=items[0],last=items[items.length-1];if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus()}else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus()}}
    function inPageConfirm(title,message,onOk,isDanger=false){$('#modalTitle').textContent=title||'Confirm';$('#modalBody').innerHTML='<p class="modal-confirm-copy">'+safe(message)+'</p>';$('#modalSave').textContent=isDanger?'Delete':'Confirm';$('#modalSave').className=isDanger?'btn danger-btn':'primary';showModal();bindModalClose();$('#modalSave').onclick=()=>{closeModal();$('#modalSave').className='primary';onOk()}}
    function inPagePrompt(title,message,defaultValue,onOk,inputType='text'){$('#modalTitle').textContent=title||'Input';$('#modalBody').innerHTML='<div class="form"><label class="prompt-label">'+safe(message)+'</label><input id="fPromptVal" type="'+inputType+'" class="input u-full-width" value="'+safe(defaultValue||'')+'"></div>';$('#modalSave').textContent='Save';$('#modalSave').className='primary';showModal();bindModalClose();setTimeout(()=>$('#fPromptVal')?.focus(),50);$('#modalSave').onclick=()=>{const value=$('#fPromptVal').value;closeModal();onOk(value)}}
    function bindModalClose(){$('#modalClose').onclick=$('#modalCancel').onclick=closeModal;$('#modalBack').onclick=event=>{if(event.target===$('#modalBack'))closeModal()}}
    return Object.freeze({showModal,closeModal,closeSearchModal,setSearchReturnFocus,trapDialogTab,inPageConfirm,inPagePrompt,bindModalClose});
  }
  return Object.freeze({create});
});
