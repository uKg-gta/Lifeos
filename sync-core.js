'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LifeOSSyncCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function createRecordId(random=Math.random){
    const sample=random();
    if(!Number.isFinite(sample)||sample<0||sample>=1)throw new Error('Invalid record ID entropy');
    const id=Math.max(1,Math.floor(sample*Number.MAX_SAFE_INTEGER));
    if(!Number.isSafeInteger(id))throw new Error('Unable to create a safe record ID');
    return id;
  }
  function parseSaveResult(data){
    const row=Array.isArray(data)?data[0]:data;
    if(!row||typeof row.saved!=='boolean')throw new Error('Unexpected workspace save response');
    const revision=row.new_revision==null?null:Number(row.new_revision);
    if(row.saved&&(!Number.isSafeInteger(revision)||revision<1))throw new Error('Workspace save returned an invalid revision');
    return {saved:row.saved,newRevision:revision};
  }
  function hasRevisionConflict(localRevision,remoteRevision){
    return Number(localRevision)!==Number(remoteRevision);
  }
  return {createRecordId,parseSaveResult,hasRevisionConflict};
});
