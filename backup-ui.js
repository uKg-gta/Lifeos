'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LifeOSBackupUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
function create({getState,getPrefs,setPrefs,normalizeWorkspace,mergeWorkspace,mergePrefs,safe,toast,confirm:inPageConfirm,save,applyPrefs,render,nav,pushCloud,restorePrevious}){
 let pendingBackup=null;
 const $=s=>document.querySelector(s);
 function exportData(){let payload={app:'LifeOS',backupVersion:1,exportedAt:new Date().toISOString(),workspace:getState(),preferences:getPrefs()};let blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='lifeos-workspace-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);toast('Workspace backup exported.')}
 function validBackup(x){let w=x?.workspace||x;if(!w||typeof w!=='object'||!Array.isArray(w.tasks)||!Array.isArray(w.habits))return false;for(let k of ['routines','notes','sessions','syllabus','transactions','budgets','resources','goals','projects','investments','assets','liabilities','exams','subjects'])if(w[k]!==undefined&&!Array.isArray(w[k]))return false;return true}
 function backupArrays(w){return ['tasks','habits','routines','notes','sessions','syllabus','transactions','budgets','resources','goals','projects','investments','assets','liabilities','exams','subjects'].filter(k=>Array.isArray(w[k]))}
 function backupPreview(file){let fr=new FileReader();fr.onerror=()=>toast('Could not read the backup file.');fr.onload=()=>{try{let x=JSON.parse(fr.result);if(!validBackup(x))throw new Error('This does not look like a valid LifeOS backup.');let w=x.workspace||x;pendingBackup={data:x,fileName:file.name};let keys=backupArrays(w),counts=keys.reduce((a,k)=>a+(w[k]?.length||0),0);let current=keys.reduce((a,k)=>a+(getState()[k]?.length||0),0);let conflicts=keys.reduce((a,k)=>a+(w[k]||[]).filter(r=>r&&r.id!=null&&(getState()[k]||[]).some(q=>q.id===r.id)).length,0);$('#restorePreview').style.display='block';$('#restorePreview').innerHTML=`<b>Backup validated: ${safe(file.name)}</b><p>${keys.length} data categories · ${counts} imported records · ${current} current records · ${conflicts} matching record IDs to review.</p><div class="setting-control"><button class="btn" id="restoreReplace">Replace workspace</button><button class="btn" id="restoreMerge">Merge records</button><button class="textbtn" id="cancelRestore">Cancel</button></div><div class="settings-help">Replace overwrites current workspace records. Merge updates records with matching IDs and appends new ones; records without IDs are appended. A safety copy is downloaded before either action.</div>`;$('#restoreReplace').onclick=()=>restoreBackup('replace');$('#restoreMerge').onclick=()=>restoreBackup('merge');$('#cancelRestore').onclick=()=>{pendingBackup=null;$('#restorePreview').style.display='none';$('#importFile').value=''}}catch(e){pendingBackup=null;$('#restorePreview').style.display='block';$('#restorePreview').textContent=e.message||'Invalid backup file.'}};fr.readAsText(file)}
 function restoreBackup(mode){if(!pendingBackup)return;let x=pendingBackup.data,w=x.workspace||x;if(!validBackup(x)){toast('Backup validation failed.');return}let keys=backupArrays(w),conflicts=keys.reduce((a,k)=>a+(w[k]||[]).filter(r=>r&&r.id!=null&&(getState()[k]||[]).some(q=>q.id===r.id)).length,0);const doRestore=async()=>{
  exportData();const oldS=JSON.parse(JSON.stringify(getState())),oldPrefs=JSON.parse(JSON.stringify(getPrefs()));
  try{
    let next;
    if(mode==='replace')next=normalizeWorkspace(w);
    else{next=mergeWorkspace(JSON.parse(JSON.stringify(getState())),normalizeWorkspace(w));next.timer=getState().timer}
    Object.assign(getState(),next);if(x.preferences&&typeof x.preferences==='object')setPrefs(mergePrefs(getPrefs(),x.preferences));
    pendingBackup=null;$('#restorePreview').style.display='none';$('#importFile').value='';
    save();applyPrefs();render();nav('home');
    const ok=await pushCloud();
    if(!ok){
      restorePrevious(oldS,oldPrefs,true);applyPrefs();render();toast('Restore was not saved to the cloud. Your previous local workspace has been restored.');
      return;
    }
    toast(mode==='replace'?'Workspace restored and saved to the cloud.':'Backup merged and saved to the cloud.');
  }catch(e){restorePrevious(oldS,oldPrefs,false);applyPrefs();render();toast(e.message||'Restore failed. Existing workspace was preserved.')}
 };if(mode==='merge'){inPageConfirm('Merge backup',`Merge ${pendingBackup.fileName}? Preview: ${keys.map(k=>`${k}: ${(w[k]||[]).length} imported`).join(', ')}. ${conflicts} matching IDs will be updated; records without IDs will be appended. A safety backup will be downloaded first. Continue?`,doRestore);}else{inPageConfirm('Replace workspace',`Replace the current workspace with ${pendingBackup.fileName}? This cannot be undone unless you have a backup.`,doRestore,true);}}
 return {exportData,backupPreview,restoreBackup,validBackup,backupArrays};
}
return Object.freeze({create});
});