'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LifeOSLegacyMigration=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create(storage){
    let store=storage;try{if(!store)store=localStorage}catch(e){}
    if(!store)return Object.freeze({read:()=>[],clear:()=>false});
    const parse=value=>{try{return value?JSON.parse(value):null}catch(e){return null}};
    const validWorkspace=value=>value&&typeof value==='object'&&Array.isArray(value.tasks)&&Array.isArray(value.habits);
    function read(userId){
      try{
      const found=[],meta=parse(store.getItem('lifeos-sync-meta'));
      if(meta?.user===userId){
        const workspace=parse(store.getItem('lifeos-review-v2'));
        if(validWorkspace(workspace))found.push({
          source:'active',workspace,preferences:parse(store.getItem('lifeos-review-prefs'))||{},
          base:parse(store.getItem('lifeos-cloud-base')),meta
        });
      }
      for(let i=0;i<store.length;i++){
        const key=store.key(i);if(!key||!key.startsWith('lifeos-recovery-'))continue;
        const archive=parse(store.getItem(key));
        if(archive?.sourceUserId!==userId)continue;
        const workspace=parse(archive.workspace);
        if(validWorkspace(workspace))found.push({
          source:key,workspace,preferences:parse(archive.preferences)||{},
          base:parse(archive.cloudBase),meta:parse(archive.syncMeta)||{}
        });
      }
      return found;
      }catch(e){return []}
    }
    function clear(userId,sources){
      try{
      const allowed=new Set(sources||[]);
      const meta=parse(store.getItem('lifeos-sync-meta'));
      if(meta?.user===userId&&allowed.has('active')){
        ['lifeos-review-v2','lifeos-review-prefs','lifeos-cloud-base','lifeos-sync-meta'].forEach(key=>store.removeItem(key));
      }
      for(const source of allowed)if(source!=='active'&&source.startsWith('lifeos-recovery-')){
        const archive=parse(store.getItem(source));
        if(archive?.sourceUserId===userId)store.removeItem(source);
      }
      return true;
      }catch(e){return false}
    }
    return Object.freeze({read,clear});
  }
  return Object.freeze({create});
});
