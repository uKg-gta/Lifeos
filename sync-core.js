'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LifeOSSyncCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const collections=['tasks','habits','routines','notes','sessions','syllabus','transactions','budgets','resources','goals','projects','investments','assets','liabilities','exams','subjects'];
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
  const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const validTime=value=>{const n=Number(value);return Number.isFinite(n)&&n>0?n:0};
  function recordKey(value){
    if(value&&typeof value==='object'){
      if(value.id!=null&&value.id!=='')return 'i:'+String(value.id);
      if(typeof value.name==='string'&&value.name)return 'n:'+value.name;
    }
    return 'v:'+String(value);
  }
  function listMap(list){return new Map((Array.isArray(list)?list:[]).map(item=>[recordKey(item),item]))}
  function readSyncMeta(workspace){
    const raw=workspace&&workspace._lifeosSync&&typeof workspace._lifeosSync==='object'?workspace._lifeosSync:{};
    const tombstones={};
    for(const name of collections){
      const source=raw.tombstones&&raw.tombstones[name];
      const rows={};
      if(source&&typeof source==='object')for(const [key,value] of Object.entries(source)){const time=validTime(value);if(time)rows[key]=time}
      tombstones[name]=rows;
    }
    const numericMap=source=>{
      const out={};if(source&&typeof source==='object')for(const [key,value] of Object.entries(source)){const time=validTime(value);if(time)out[key]=time}
      return out;
    };
    return {tombstones,preferenceStamps:numericMap(raw.preferenceStamps),scalarStamps:numericMap(raw.scalarStamps),workspaceStamp:validTime(raw.workspaceStamp)};
  }
  function writeSyncMeta(workspace,meta){workspace._lifeosSync=meta;return workspace}
  function stampWorkspaceChanges(previous,workspace,timestamp=Date.now()){
    if(!workspace||typeof workspace!=='object')return workspace;
    const meta=readSyncMeta(workspace),old=previous&&typeof previous==='object'?previous:{};
    let changed=false;
    for(const name of collections){
      const before=listMap(old[name]),after=listMap(workspace[name]);
      for(const [key,item] of after){
        const prior=before.get(key);
        if(item&&typeof item==='object'&&(!prior||!equal(prior,item))){
          const prevTime=validTime(prior&&prior._lifeosUpdatedAt);
          item._lifeosUpdatedAt=Math.max(validTime(timestamp),prevTime+1,validTime(meta.tombstones[name][key])+1);
          if(item._lifeosUpdatedAt===0)item._lifeosUpdatedAt=1;
          changed=true;
        }
        const itemTime=validTime(item&&item._lifeosUpdatedAt);
        if(itemTime>validTime(meta.tombstones[name][key]))delete meta.tombstones[name][key];
      }
      for(const [key] of before)if(!after.has(key)){
        const prior=before.get(key),prevTime=validTime(prior&&prior._lifeosUpdatedAt);
        meta.tombstones[name][key]=Math.max(validTime(timestamp),prevTime+1,validTime(meta.tombstones[name][key]));
        changed=true;
      }
      if(!equal(old[name]||[],workspace[name]||[]))changed=true;
    }
    if(!equal(old.timer,workspace.timer)){
      meta.scalarStamps.timer=Math.max(validTime(timestamp),validTime(meta.scalarStamps.timer)+1);
      changed=true;
    }
    if(changed)meta.workspaceStamp=Math.max(validTime(timestamp),meta.workspaceStamp+1);
    return writeSyncMeta(workspace,meta);
  }
  function stampPreferenceChanges(previous,preferences,workspace,timestamp=Date.now()){
    const meta=readSyncMeta(workspace),old=previous&&typeof previous==='object'?previous:{};
    let changed=false;
    const keys=new Set([...Object.keys(old),...Object.keys(preferences||{})]);
    for(const key of keys){
      if(key==='summaries'){
        const a=old.summaries||{},b=(preferences&&preferences.summaries)||{};
        for(const field of new Set([...Object.keys(a),...Object.keys(b)]))if(!equal(a[field],b[field])){
          meta.preferenceStamps['summaries.'+field]=Math.max(validTime(timestamp),validTime(meta.preferenceStamps['summaries.'+field])+1);changed=true;
        }
      }else if(!equal(old[key],preferences&&preferences[key])){
        meta.preferenceStamps[key]=Math.max(validTime(timestamp),validTime(meta.preferenceStamps[key])+1);changed=true;
      }
    }
    if(changed)meta.workspaceStamp=Math.max(validTime(timestamp),meta.workspaceStamp+1);
    return writeSyncMeta(workspace,meta);
  }
  function mergeSnapshots(base,local,remote,options={}){
    base=base&&typeof base==='object'?base:{};local=local&&typeof local==='object'?local:{};remote=remote&&typeof remote==='object'?remote:{};
    const bws=base.workspace&&typeof base.workspace==='object'?base.workspace:{};
    const lws=local.workspace&&typeof local.workspace==='object'?local.workspace:{};
    const rws=remote.workspace&&typeof remote.workspace==='object'?remote.workspace:{};
    const bmeta=readSyncMeta(bws),lmeta=readSyncMeta(lws),rmeta=readSyncMeta(rws);
    const mergedMeta=readSyncMeta({ _lifeosSync: { tombstones:{},preferenceStamps:{},scalarStamps:{},workspaceStamp:0 } });
    for(const name of collections){
      const all=new Map();
      for(const item of [...(rws[name]||[]),...(lws[name]||[]),...(bws[name]||[])])all.set(recordKey(item),item);
      const bmap=listMap(bws[name]),lmap=listMap(lws[name]),rmap=listMap(rws[name]),out=[];
      for(const key of all.keys()){
        const b=bmap.get(key),l=lmap.get(key),r=rmap.get(key);
        const lc=!equal(l,b),rc=!equal(r,b);
        let chosen;
        if(!lc)chosen=r;
        else if(!rc)chosen=l;
        else if(equal(l,r))chosen=l;
        else{
          const lt=l?validTime(l._lifeosUpdatedAt):validTime(lmeta.tombstones[name][key])||validTime(options.localFallbackTime);
          const rt=r?validTime(r._lifeosUpdatedAt):validTime(rmeta.tombstones[name][key])||validTime(options.remoteFallbackTime);
          if(lt===0&&rt===0)chosen=l;
          else chosen=lt>rt?l:r;
        }
        const deleteAt=Math.max(validTime(lmeta.tombstones[name][key]),validTime(rmeta.tombstones[name][key]));
        const chosenAt=validTime(chosen&&chosen._lifeosUpdatedAt);
        if(chosen&&deleteAt>0&&deleteAt>=chosenAt){chosen=undefined;mergedMeta.tombstones[name][key]=deleteAt}
        else if(chosen){out.push(copy(chosen));if(deleteAt)mergedMeta.tombstones[name][key]=deleteAt}
        else if(deleteAt)mergedMeta.tombstones[name][key]=deleteAt;
        else if(lc||rc){
          const deleteAtFallback=Math.max(validTime(lmeta.workspaceStamp)||validTime(options.localFallbackTime),validTime(rmeta.workspaceStamp)||validTime(options.remoteFallbackTime));
          if(deleteAtFallback)mergedMeta.tombstones[name][key]=deleteAtFallback;
        }
      }
      // Match the remote ordering first, then append local-only entries.
      const order=[...(rws[name]||[]),...(lws[name]||[])].map(recordKey),rank=new Map(order.map((key,index)=>[key,index]));
      out.sort((a,b)=>(rank.get(recordKey(a))??Number.MAX_SAFE_INTEGER)-(rank.get(recordKey(b))??Number.MAX_SAFE_INTEGER));
      const tombstoneSources=[mergedMeta.tombstones[name],lmeta.tombstones[name],rmeta.tombstones[name]],tombstoneUnion={};
      for(const source of tombstoneSources)for(const [key,time] of Object.entries(source))tombstoneUnion[key]=Math.max(validTime(tombstoneUnion[key]),validTime(time));
      mergedMeta.tombstones[name]=tombstoneUnion;
      for(const item of out){const key=recordKey(item);if(validTime(item&&item._lifeosUpdatedAt)>validTime(mergedMeta.tombstones[name][key]))delete mergedMeta.tombstones[name][key]}
      mergedMeta.tombstones[name]=Object.fromEntries(Object.entries(mergedMeta.tombstones[name]).filter(([,time])=>validTime(time)>0));
      mergedMeta['__list_'+name]=out;
    }
    const arrayNames=new Set([...Object.keys(bws),...Object.keys(lws),...Object.keys(rws)].filter(key=>Array.isArray(bws[key])||Array.isArray(lws[key])||Array.isArray(rws[key])));
    const outWorkspace={...rws,...lws};
    for(const name of arrayNames)outWorkspace[name]=mergedMeta['__list_'+name]||[];
    for(const name of collections)delete mergedMeta['__list_'+name];
    const scalarNames=new Set([...Object.keys(bws),...Object.keys(lws),...Object.keys(rws)].filter(key=>key!=='_lifeosSync'&&!arrayNames.has(key)));
    for(const key of scalarNames){
      const b=bws[key],l=lws[key],r=rws[key],lc=!equal(l,b),rc=!equal(r,b);
      if(!lc)outWorkspace[key]=copy(r);
      else if(!rc)outWorkspace[key]=copy(l);
      else if(equal(l,r))outWorkspace[key]=copy(l);
      else{
        const lt=validTime(lmeta.scalarStamps[key])||validTime(lmeta.workspaceStamp)||validTime(options.localFallbackTime);
        const rt=validTime(rmeta.scalarStamps[key])||validTime(rmeta.workspaceStamp)||validTime(options.remoteFallbackTime);
        outWorkspace[key]=copy(lt>rt?l:r);
      }
    }
    mergedMeta.preferenceStamps={...lmeta.preferenceStamps,...rmeta.preferenceStamps};
    for(const key of new Set([...Object.keys(lmeta.preferenceStamps),...Object.keys(rmeta.preferenceStamps)]))
      mergedMeta.preferenceStamps[key]=Math.max(validTime(lmeta.preferenceStamps[key]),validTime(rmeta.preferenceStamps[key]));
    mergedMeta.scalarStamps={...lmeta.scalarStamps,...rmeta.scalarStamps};
    for(const key of new Set([...Object.keys(lmeta.scalarStamps),...Object.keys(rmeta.scalarStamps)]))
      mergedMeta.scalarStamps[key]=Math.max(validTime(lmeta.scalarStamps[key]),validTime(rmeta.scalarStamps[key]));
    mergedMeta.workspaceStamp=Math.max(bmeta.workspaceStamp,lmeta.workspaceStamp,rmeta.workspaceStamp,validTime(options.localFallbackTime),validTime(options.remoteFallbackTime));
    outWorkspace._lifeosSync=mergedMeta;
    const bp=base.preferences&&typeof base.preferences==='object'?base.preferences:{},lp=local.preferences&&typeof local.preferences==='object'?local.preferences:{},rp=remote.preferences&&typeof remote.preferences==='object'?remote.preferences:{};
    const outPrefs={...rp,...lp};
    for(const key of new Set([...Object.keys(bp),...Object.keys(lp),...Object.keys(rp)])){
      if(key==='summaries'){
        const bs=bp.summaries||{},ls=lp.summaries||{},rs=rp.summaries||{},summary={...rs,...ls};
        for(const field of new Set([...Object.keys(bs),...Object.keys(ls),...Object.keys(rs)])){
          const lc=!equal(ls[field],bs[field]),rc=!equal(rs[field],bs[field]);
          if(!lc)summary[field]=copy(rs[field]);
          else if(!rc)summary[field]=copy(ls[field]);
          else if(!equal(ls[field],rs[field])){
            const stampKey='summaries.'+field,lt=validTime(lmeta.preferenceStamps[stampKey])||validTime(options.localPreferenceFallbackTime),rt=validTime(rmeta.preferenceStamps[stampKey])||validTime(options.remotePreferenceFallbackTime)||validTime(options.remoteFallbackTime);
            summary[field]=copy(lt>rt?ls[field]:rs[field]);
          }
        }
        outPrefs.summaries=summary;
      }else{
        const lc=!equal(lp[key],bp[key]),rc=!equal(rp[key],bp[key]);
        if(!lc)outPrefs[key]=copy(rp[key]);
        else if(!rc)outPrefs[key]=copy(lp[key]);
        else if(!equal(lp[key],rp[key])){
          const lt=validTime(lmeta.preferenceStamps[key])||validTime(options.localPreferenceFallbackTime),rt=validTime(rmeta.preferenceStamps[key])||validTime(options.remotePreferenceFallbackTime)||validTime(options.remoteFallbackTime);
          outPrefs[key]=copy(lt>rt?lp[key]:rp[key]);
        }
      }
    }
    return {workspace:outWorkspace,preferences:outPrefs};
  }
  return {createRecordId,parseSaveResult,hasRevisionConflict,stampWorkspaceChanges,stampPreferenceChanges,mergeSnapshots};
});
