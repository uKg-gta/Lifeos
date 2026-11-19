
(()=>{'use strict';
const $=s=>document.querySelector(s), queryAll=s=>[...document.querySelectorAll(s)];
const formatUtils=window.LifeOSFormatUtils;
const dateUtils=window.LifeOSDateUtils;
const now=new Date(), dateLabel=(d=new Date())=>dateUtils.dateLabel(d,prefs.dateFormat), safe=s=>formatUtils.escapeHtml(s);
const seed=()=>({tasks:[],habits:[],routines:[],notes:[],sessions:[],syllabus:[],transactions:[],budgets:[],resources:[],goals:[],projects:[],investments:[],assets:[],liabilities:[],exams:[],subjects:[],studyToday:0,studyWeek:0,timer:{mode:'countdown',duration:1500,remaining:1500,running:false,startedAt:null,paused:false}});
let s=seed(), prefs={theme:'dark',accent:'amber',density:'comfortable',font:'default',name:'',motto:'',avatar:'UG',picture:'',hiddenModules:[],summaries:{tasks:true,study:true,habits:true},weekStart:1,clock:'12',dateFormat:'dmy',budgetResetDay:1}, taskView='all',bookView='cards',weekOffset=0,financeMonth=null,toastTimer=null;
const weight=p=>formatUtils.priorityWeight(p), todayTasks=()=>s.tasks.filter(t=>t.date==='today'), score=()=>{let a=todayTasks(),total=a.reduce((n,t)=>n+weight(t.priority),0);return total?Math.round(a.filter(t=>t.status==='done').reduce((n,t)=>n+weight(t.priority),0)/total*100):null}, mins=m=>formatUtils.formatMinutes(m), money=n=>formatUtils.formatRupees(n), fmtsec=n=>formatUtils.formatClockSeconds(n);
let supabase=null, cloudUser=null, cloudReady=false, cloudTimer=null, applyingRemote=false, lastCloudPayload='', baseStamp=null, baseRevision=0, pushingStamp=null, pushing=false, pushQueued=false, pushPromise=null, pendingCloudConflict=null, activating=false, retryTimer=null, retryCount=0, dirty=false, lastDay=dayKey();
/* ===== Data hygiene, sync and auth (rewritten) ===== */
const META_KEY='lifeos-sync-meta',BASE_KEY='lifeos-cloud-base',CACHE_KEYS=['lifeos-review-v2','lifeos-review-prefs',BASE_KEY];
let initialLocalCachePresent=false,offlineModeChosen=false,setupComplete=false,lastLocalSnapshot=null,authSubscription=null,pauseForConflict=false;
try{const initial=JSON.parse(localStorage.getItem(CACHE_KEYS[0]));initialLocalCachePresent=!!(initial&&Array.isArray(initial.tasks))}catch(e){}
const defaultPrefs=()=>({theme:'dark',accent:'amber',density:'comfortable',font:'default',name:'',motto:'',avatar:'UG',picture:'',hiddenModules:[],summaries:{tasks:true,study:true,habits:true},weekStart:1,clock:'12',dateFormat:'dmy',budgetResetDay:1,studyTargetMins:180});
const num=(v,d=0)=>{v=Number(v);return Number.isFinite(v)?v:d};
const str=(v,d='',n=500)=>typeof v==='string'?v.slice(0,n):(typeof v==='number'&&Number.isFinite(v)?String(v):d);
const pick=(v,list,d)=>list.includes(v)?v:d;
const newRecordId=()=>window.LifeOSSyncCore.createRecordId();
const objs=a=>Array.isArray(a)?a.filter(x=>x&&typeof x==='object'&&!Array.isArray(x)):[];
const dayRe=/^\d{4}-\d{2}-\d{2}$/;
const safePic=p=>typeof p==='string'&&p.length<400000&&/^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(p)?p:'';
const stampMs=v=>{const t=new Date(v).getTime();return Number.isFinite(t)?t:0};
const logicalNow=()=>Math.max(Date.now(),stampMs(baseStamp)+1,num(s?._lifeosSync?.workspaceStamp)+1);
function addDays(n,from=new Date()){return dateUtils.addDays(n,from)}
function withIds(list){const seen=new Set();return list.map(x=>{const n=Number(x.id);const ok=x.id!=null&&x.id!==''&&Number.isSafeInteger(n)&&n>=0&&!seen.has(n);let id=ok?n:newRecordId();while(seen.has(id))id=newRecordId();seen.add(id);return {...x,id}})}
function normalizePrefs(p){
  const d=defaultPrefs();p=p&&typeof p==='object'?p:{};const sm=p.summaries&&typeof p.summaries==='object'?p.summaries:{};
  const word=(v,def)=>typeof v==='string'&&/^[a-z-]{1,20}$/.test(v)?v:def;
  return{theme:pick(p.theme,['dark','light'],d.theme),accent:pick(p.accent,['amber','green','coral','slate'],p.accent==='blue'?'amber':p.accent==='violet'?'green':d.accent),density:word(p.density,d.density),font:word(p.font,d.font),name:str(p.name,'',60),motto:str(p.motto,'',120),avatar:str(p.avatar,d.avatar,8),picture:safePic(p.picture),hiddenModules:(Array.isArray(p.hiddenModules)?p.hiddenModules:[]).filter(x=>typeof x==='string'&&/^[a-z]{1,20}$/.test(x)),summaries:{tasks:sm.tasks!==false,study:sm.study!==false,habits:sm.habits!==false},weekStart:1,clock:pick(p.clock,['12','24'],'12'),dateFormat:pick(p.dateFormat,['dmy','mdy','iso'],'dmy'),budgetResetDay:(()=>{const n=Math.round(Number(p.budgetResetDay));return Number.isInteger(n)&&n>=1&&n<=28?n:d.budgetResetDay})(),studyTargetMins:(()=>{const m=Math.round(Number(p.studyTargetMins));return Number.isFinite(m)&&m>=5&&m<=1440?m:d.studyTargetMins})()}
}
function mergePrefs(base,over){over=over&&typeof over==='object'?over:{};return normalizePrefs({...base,...over,summaries:{...((base&&base.summaries)||{}),...(over.summaries||{})}})}
// Forces every record into the shape the UI expects, so a bad backup or cloud row can never crash rendering or inject markup.
function normalizeWorkspace(w){
  w=w&&typeof w==='object'?w:{};const tm=w.timer&&typeof w.timer==='object'?w.timer:{};
  const sa=Number(tm.startedAt),running=tm.running===true&&tm.startedAt!=null&&Number.isFinite(sa);
  const ex=v=>v==null?undefined:str(v,'',80),syncStamp=x=>({_lifeosUpdatedAt:num(x&&x._lifeosUpdatedAt)});
  const steps=a=>withIds(objs(a).map(x=>({...syncStamp(x),id:x.id,text:str(x.text,'',200),done:x.done===true})));
  return{
    tasks:withIds(objs(w.tasks).map(t=>({...syncStamp(t),id:t.id,title:str(t.title,'Untitled',140),date:pick(t.date,['today','tomorrow','later','none'],'none'),due:dayRe.test(t.due)?t.due:'',priority:pick(t.priority,['High','Medium','Low'],'Medium'),category:str(t.category,'Personal',40),estimate:Math.max(0,Math.min(1440,num(t.estimate))),status:t.status==='done'?'done':'todo'}))),
    habits:withIds(objs(w.habits).map(h=>({...syncStamp(h),id:h.id,name:str(h.name,'Habit',80),icon:str(h.icon,'◉',8),frequency:h.frequency==='selected'?'selected':'daily',days:[...new Set((Array.isArray(h.days)?h.days:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=6))],history:(Array.isArray(h.history)?h.history:[]).filter(x=>typeof x==='string'&&dayRe.test(x)),doneDate:dayRe.test(h.doneDate)?h.doneDate:'',streak:0}))),
    routines:withIds(objs(w.routines).map(r=>({...syncStamp(r),id:r.id,name:str(r.name,'Routine',80),steps:steps(r.steps)}))),
    notes:withIds(objs(w.notes).map(n=>({...syncStamp(n),id:n.id,title:str(n.title,'Untitled',140),body:str(n.body,'',20000),category:str(n.category,'Personal',40),pinned:n.pinned===true}))),
    sessions:withIds(objs(w.sessions).map(x=>({...syncStamp(x),id:x.id,subject:str(x.subject,'',80),topic:str(x.topic,'',140),date:str(x.date,'',20),minutes:Math.max(0,num(x.minutes)),type:str(x.type,'Study',40),exam:ex(x.exam)}))),
    syllabus:withIds(objs(w.syllabus).map(x=>({...syncStamp(x),id:x.id,subject:str(x.subject,'',80),topic:str(x.topic,'',140),status:pick(x.status,['Not started','In progress','Completed'],'Not started'),revisions:Math.max(0,Math.round(num(x.revisions))),exam:ex(x.exam)}))),
    transactions:withIds(objs(w.transactions).map(t=>({...syncStamp(t),id:t.id,title:str(t.title,'',140),amount:Math.max(0,num(t.amount)),type:t.type==='income'?'income':'expense',category:str(t.category,'Other',40),date:str(t.date,'',40)}))),
    budgets:objs(w.budgets).map(b=>({...syncStamp(b),name:str(b.name,'',40),total:Math.max(0,num(b.total)),used:Math.max(0,num(b.used))})).filter(b=>b.name),
    resources:withIds(objs(w.resources).map(r=>({...syncStamp(r),id:r.id,title:str(r.title,'Untitled',200),author:str(r.author,'',120),type:str(r.type,'Other',40),status:pick(r.status,['Want to Read','Not started','Reading','Completed'],'Want to Read'),rating:(Number.isInteger(Number(r.rating))&&r.rating>=1&&r.rating<=5)?Number(r.rating):null,pinned:r.pinned===true}))),
    goals:withIds(objs(w.goals).map(g=>({...syncStamp(g),id:g.id,title:str(g.title,'Untitled',140),area:str(g.area,'Personal Growth',40),date:str(g.date,'',40),status:pick(g.status,['Not started','Active','Ongoing','Completed'],'Not started'),desc:str(g.desc,'',5000),subgoals:steps(g.subgoals),timeline:objs(g.timeline).map(x=>({date:str(x.date,'',40),text:str(x.text,'',300)}))}))),
    projects:withIds(objs(w.projects).map(p=>({...syncStamp(p),id:p.id,title:str(p.title,'Untitled',140),status:str(p.status,'Not started',40),tasks:Math.max(0,num(p.tasks)),done:Math.max(0,num(p.done))}))),
    investments:withIds(objs(w.investments).map(x=>({...syncStamp(x),id:x.id,name:str(x.name,'Investment',140),type:str(x.type,'Other',40),units:str(x.units,'',40),invested:Math.max(0,num(x.invested)),currentValue:Math.max(0,num(x.currentValue)),date:str(x.date,'',20)}))),
    assets:withIds(objs(w.assets).map(x=>({...syncStamp(x),id:x.id,name:str(x.name,'Asset',140),type:str(x.type,'Asset',40),value:Math.max(0,num(x.value))}))),
    liabilities:withIds(objs(w.liabilities).map(x=>({...syncStamp(x),id:x.id,name:str(x.name,'Liability',140),type:str(x.type,'Liability',40),amount:Math.max(0,num(x.amount))}))),
    exams:objs(w.exams).map(e=>({...syncStamp(e),name:str(e.name,'',80),date:dayRe.test(e.date)?e.date:''})).filter(e=>e.name),
    subjects:(Array.isArray(w.subjects)?w.subjects:[]).filter(x=>typeof x==='string'&&x.trim()).map(x=>x.slice(0,80)),
    studyToday:0,studyWeek:0,
    _lifeosSync:w._lifeosSync&&typeof w._lifeosSync==='object'?w._lifeosSync:{tombstones:{},preferenceStamps:{},scalarStamps:{},workspaceStamp:0},
    timer:{mode:pick(tm.mode,['countdown','stopwatch'],'countdown'),duration:Math.max(0,num(tm.duration,1500)),remaining:Math.max(0,num(tm.remaining,1500)),running,startedAt:running?sa:null,paused:running?false:tm.paused===true}
  };
}
// Union by id (or name). On a clash the "local" copy wins.
function mergeList(remote,local){
  const key=x=>x&&typeof x==='object'?(x.id!=null?'i:'+x.id:(x.name!=null?'n:'+x.name:'j:'+JSON.stringify(x))):'v:'+x;
  const have=new Set(local.map(key)),out=local.slice();remote.forEach(x=>{if(!have.has(key(x)))out.push(x)});return out;
}
function mergeWorkspace(remote,local){
  const out={...remote,...local};
  Object.keys(out).forEach(k=>{if(Array.isArray(remote[k])&&Array.isArray(local[k]))out[k]=mergeList(remote[k],local[k])});
  return out;
}

/* ----- local cache + sync metadata ----- */
function readMeta(){try{return JSON.parse(localStorage.getItem(META_KEY))||{}}catch(e){return {}}}
function writeMeta(p){try{localStorage.setItem(META_KEY,JSON.stringify({...readMeta(),...p}))}catch(e){}}
function readBaseSnapshot(){try{const value=JSON.parse(localStorage.getItem(BASE_KEY));return value&&value.workspace?value:null}catch(e){return null}}
function writeBaseSnapshot(value){try{localStorage.setItem(BASE_KEY,JSON.stringify(value))}catch(e){console.warn('LifeOS could not store its last cloud version on this device.')}}
function currentSnapshot(){return JSON.parse(JSON.stringify({workspace:s,preferences:prefs}))}
function clearLocalCache(){try{CACHE_KEYS.concat(META_KEY).forEach(k=>localStorage.removeItem(k));initialLocalCachePresent=false;lastLocalSnapshot=null}catch(e){}}
function writeCache(){try{localStorage.setItem('lifeos-review-v2',JSON.stringify(s));localStorage.setItem('lifeos-review-prefs',JSON.stringify(prefs))}catch(e){return false}return true}
function setSync(t){const el=$('#syncStatus');if(el)el.textContent=t}
function save(){
  if(!applyingRemote){
    const before=lastLocalSnapshot,stamp=logicalNow();
    if(before){window.LifeOSSyncCore.stampWorkspaceChanges(before.workspace,s,stamp);window.LifeOSSyncCore.stampPreferenceChanges(before.preferences,prefs,s,stamp)}
    const next=currentSnapshot();
    if(before&&JSON.stringify(next)!==JSON.stringify(before)){dirty=true;s._lifeosSync.workspaceStamp=Math.max(num(s._lifeosSync.workspaceStamp),stamp)}
    if(!writeCache())toast('Browser cache is full. Cloud sync may still work.');else lastLocalSnapshot=next;
    if(dirty){const meta=readMeta();writeMeta({user:cloudUser?.id||meta.user||null,dirty:true,revision:baseRevision,localUpdatedAt:logicalNow()})}
  }else if(!writeCache())toast('Browser cache is full. Cloud sync may still work.');
  if(cloudReady&&!applyingRemote){clearTimeout(cloudTimer);cloudTimer=setTimeout(()=>{cloudTimer=null;pushCloud()},650);setSync('Changes waiting to sync…')}
}
function load(){
  if(window.__lifeosCloudLoaded)return;
  try{let v=JSON.parse(localStorage.getItem('lifeos-review-v2'));if(v&&v.tasks&&v.habits)s=normalizeWorkspace(v)}catch(e){}
  try{let p=JSON.parse(localStorage.getItem('lifeos-review-prefs'));if(p&&typeof p==='object')prefs=mergePrefs(prefs,p)}catch(e){}
  const meta=readMeta();dirty=!!meta.dirty;baseStamp=meta.stamp||null;baseRevision=Number(meta.revision)||0;lastLocalSnapshot=currentSnapshot();
}

/* ----- cloud sync (optimistic concurrency + merge on conflict) ----- */
function markClean(ser){
  if(ser===JSON.stringify({workspace:s,preferences:prefs})){
    dirty=false;
    const snapshot=JSON.parse(ser);writeBaseSnapshot(snapshot);lastLocalSnapshot=currentSnapshot();
    if(cloudUser)writeMeta({user:cloudUser.id,dirty:false,revision:baseRevision,stamp:baseStamp});
  }
}
async function fetchRemote(){
  const {data,error}=await supabase.from('lifeos_workspace').select('data,updated_at,revision').eq('user_id',cloudUser.id).maybeSingle();
  if(error)throw error;
  return data&&data.data?data:null;
}
function clearConflictActions(){
  const el=$('#syncConflictActions');
  pauseForConflict=false;
  if(el){el.hidden=true;el.style.display='none';el.innerHTML=''}
}
function showCloudConflict(row){
  pendingCloudConflict=row||{_deleted:true,revision:0};
  pauseForConflict=true;
  setSync('Automatic merge paused after repeated changes. Both copies are preserved; choose how to continue.');
  const el=$('#syncConflictActions');
  if(!el)return;
  el.hidden=false;el.style.display='block';
  el.innerHTML='<div class="tiny muted">Your local changes have not been uploaded or discarded.</div><div class="setting-control"><button class="btn" id="conflictExport">Download local backup</button><button class="btn" id="conflictLoadCloud">Use cloud version</button><button class="btn danger-btn" id="conflictKeepLocal">Replace cloud with this device</button></div>';
  $('#conflictExport').onclick=()=>exportData();
  $('#conflictLoadCloud').onclick=()=>resolveCloudConflict('cloud');
  $('#conflictKeepLocal').onclick=()=>resolveCloudConflict('local');
}
async function resolveCloudConflict(choice){
  if(choice==='cloud'){
    inPageConfirm('Use cloud version','A backup of this device will be downloaded first. The latest cloud workspace will then replace the local copy.',async()=>{
      exportData();
      try{
        const remote=await fetchRemote();
        if(pendingCloudConflict&&Number(pendingCloudConflict.revision)>Number(remote?.revision||0)){
          showCloudConflict(pendingCloudConflict);return;
        }
        s=normalizeWorkspace(remote?.data?.workspace||{});
        prefs=mergePrefs(defaultPrefs(),remote?.data?.preferences);
        baseRevision=Number(remote?.revision)||0;baseStamp=remote?.updated_at||null;
        const snapshot={workspace:s,preferences:prefs};lastCloudPayload=JSON.stringify(snapshot);writeBaseSnapshot(snapshot);dirty=false;pendingCloudConflict=null;
        lastLocalSnapshot=currentSnapshot();writeCache();writeMeta({user:cloudUser.id,revision:baseRevision,stamp:baseStamp,dirty:false});
        clearConflictActions();applyPrefs();render();setSync('Loaded the latest cloud workspace. Local backup downloaded.');
      }catch(e){toast('Could not load the cloud copy: '+(e.message||'check your connection'))}
    });
    return;
  }
  if(choice==='local'){
    inPageConfirm('Replace cloud workspace','This will replace the latest cloud workspace with the copy on this device. A local backup will be downloaded first. Continue only if this device has the version you want to keep.',async()=>{
      exportData();
      try{
        const remote=await fetchRemote();
        baseRevision=Number(remote?.revision)||0;baseStamp=remote?.updated_at||null;
        const remoteSnapshot=remote?.data?{workspace:normalizeWorkspace(remote.data.workspace),preferences:mergePrefs(defaultPrefs(),remote.data.preferences)}:{workspace:normalizeWorkspace({}),preferences:defaultPrefs()};
        lastCloudPayload=JSON.stringify(remoteSnapshot);writeBaseSnapshot(remoteSnapshot);
        pendingCloudConflict=null;clearConflictActions();dirty=true;
        writeMeta({user:cloudUser.id,revision:baseRevision,dirty:true});
        const ok=await pushCloud();
        if(!ok&&!pendingCloudConflict)setSync('Cloud replacement was not confirmed. Your local copy remains available.');
      }catch(e){showCloudConflict(await fetchRemote().catch(()=>null));toast('Could not prepare the cloud replacement: '+(e.message||'check your connection'))}
    },true);
  }
}
function applyRemoteRow(row){
  if(!row||!row.data||!cloudUser)return;
  const revision=Number(row.revision)||0;
  if(revision<=baseRevision)return;
  if(dirty||!!cloudTimer||pushing||!!pushPromise){pendingCloudConflict=row;if(!cloudTimer&&!pushing&&!pushPromise)pushCloud();return}
  s=normalizeWorkspace(row.data.workspace);prefs=mergePrefs(defaultPrefs(),row.data.preferences);
  baseRevision=revision;baseStamp=row.updated_at||null;
  const remoteSnapshot={workspace:s,preferences:prefs};lastCloudPayload=JSON.stringify(remoteSnapshot);writeBaseSnapshot(remoteSnapshot);dirty=false;
  lastLocalSnapshot=currentSnapshot();writeCache();writeMeta({user:cloudUser.id,revision:baseRevision,stamp:baseStamp,dirty:false});
  applyPrefs();render();setSync('Updated from another device.');
}
function mergeRemoteRow(row){
  if(!cloudUser)return;
  const remoteSnapshot={workspace:normalizeWorkspace(row?.data?.workspace||{}),preferences:mergePrefs(defaultPrefs(),row?.data?.preferences)};
  const remoteSer=JSON.stringify(remoteSnapshot),meta=readMeta(),storedBase=readBaseSnapshot();
  const localSnapshot=currentSnapshot();
  if(!storedBase&&meta.dirty){const stamp=meta.localUpdatedAt||logicalNow();window.LifeOSSyncCore.stampWorkspaceChanges(null,localSnapshot.workspace,stamp)}
  const baseSnapshot=storedBase?{workspace:normalizeWorkspace(storedBase.workspace),preferences:mergePrefs(defaultPrefs(),storedBase.preferences)}:{workspace:normalizeWorkspace({}),preferences:{}};
  const merged=window.LifeOSSyncCore.mergeSnapshots(baseSnapshot,localSnapshot,remoteSnapshot,{localFallbackTime:meta.localUpdatedAt||Date.now(),remoteFallbackTime:stampMs(row?.updated_at)});
  s=normalizeWorkspace(merged.workspace);prefs=mergePrefs(defaultPrefs(),merged.preferences);
  baseRevision=Number(row?.revision)||0;baseStamp=row?.updated_at||null;lastCloudPayload=remoteSer;writeBaseSnapshot(remoteSnapshot);
  pendingCloudConflict=null;pauseForConflict=false;dirty=JSON.stringify({workspace:s,preferences:prefs})!==lastCloudPayload;
  lastLocalSnapshot=currentSnapshot();writeCache();writeMeta({user:cloudUser.id,revision:baseRevision,stamp:baseStamp,dirty,localUpdatedAt:dirty?Date.now():meta.localUpdatedAt});
  clearConflictActions();applyPrefs();render();
  setSync(dirty?'Merged this device with the latest cloud entries; syncing…':'Your latest entries are synced.');
}
async function doPush(){
  const payload={workspace:s,preferences:prefs},ser=JSON.stringify(payload);
  if(ser===lastCloudPayload){markClean(ser);return true}
  const {data,error}=await supabase.rpc('save_lifeos_workspace',{p_data:payload,p_expected_revision:baseRevision});
  if(error)throw error;
  const result=window.LifeOSSyncCore.parseSaveResult(data);
  if(!result.saved){
    const remote=await fetchRemote();
    const conflict=new Error('The cloud workspace changed after this device last loaded it.');
    conflict.code='LIFEOS_REVISION_CONFLICT';conflict.remote=remote;throw conflict;
  }
  baseRevision=result.newRevision;baseStamp=null;
  lastCloudPayload=ser;writeBaseSnapshot(payload);writeMeta({user:cloudUser.id,revision:baseRevision,stamp:baseStamp,dirty:JSON.stringify({workspace:s,preferences:prefs})!==ser,localUpdatedAt:readMeta().localUpdatedAt});
  if(pendingCloudConflict&&Number(pendingCloudConflict.revision)<=baseRevision)pendingCloudConflict=null;
  markClean(ser);retryCount=0;clearConflictActions();
  setSync('Synced just now · changes are saved to your cloud workspace.');
  const st=$('#accountStatus');if(st)st.textContent='Connected';
  return true;
}
async function runPushLoop(){
  let conflicts=0;
  while(true){
    if(pendingCloudConflict&&Number(pendingCloudConflict.revision)<=baseRevision)pendingCloudConflict=null;
    if(pendingCloudConflict&&Number(pendingCloudConflict.revision)>baseRevision){
      if(++conflicts>5){showCloudConflict(pendingCloudConflict);return false}
      const latest=pendingCloudConflict;pendingCloudConflict=null;mergeRemoteRow(latest);
    }
    const current=JSON.stringify({workspace:s,preferences:prefs});
    if(current===lastCloudPayload){if(dirty)markClean(current);if(!pushQueued)break}
    pushQueued=false;pushing=true;
    try{await doPush()}
    catch(e){
      if(e?.code!=='LIFEOS_REVISION_CONFLICT')throw e;
      if(++conflicts>5){showCloudConflict(e.remote);return false}
      mergeRemoteRow(e.remote);
    }finally{pushing=false;pushingStamp=null}
    if(!pushQueued&&JSON.stringify({workspace:s,preferences:prefs})===lastCloudPayload&&!(pendingCloudConflict&&Number(pendingCloudConflict.revision)>baseRevision))break;
  }
  return true;
}
async function pushCloud(){
  clearTimeout(cloudTimer);cloudTimer=null;
  if(!supabase||!cloudUser||!cloudReady)return false;
  if(pauseForConflict)return false;
  if(pushPromise){pushQueued=true;return pushPromise}
  const task=(async()=>{
    try{return await runPushLoop()}
    catch(e){
      if(e?.code==='LIFEOS_REVISION_CONFLICT'){showCloudConflict(e.remote);return false}
      console.error('LifeOS cloud sync:',e);
      setSync('Sync paused: '+(e.message||'check connection and database setup')+' · will retry.');
      scheduleRetry();return false;
    }
  })();
  pushPromise=task;
  try{return await task}
  finally{if(pushPromise===task)pushPromise=null}
}
function scheduleRetry(){
  retryCount++;clearTimeout(retryTimer);
  retryTimer=setTimeout(()=>{if(cloudReady&&dirty&&!pauseForConflict)pushCloud()},Math.min(60000,2000*Math.pow(2,Math.min(retryCount,5))));
}
async function flushCloud(){
  clearTimeout(cloudTimer);cloudTimer=null;
  if(!cloudReady)return false;
  return pushCloud();
}
async function syncNow(){
  if(!cloudReady||!supabase||!cloudUser)return;
  try{const row=await fetchRemote();if(row)applyRemoteRow(row)}catch(e){console.warn('LifeOS refresh failed:',e)}
}

function preserveForeignLocalCache(meta){
  const sourceUser=String(meta?.user||'unknown').replace(/[^a-zA-Z0-9_-]/g,'_');
  const recoveryKey='lifeos-recovery-'+sourceUser+'-'+Date.now();
  const recovery={
    sourceUserId:meta?.user||null,
    savedAt:new Date().toISOString(),
    workspace:localStorage.getItem('lifeos-review-v2'),
    preferences:localStorage.getItem('lifeos-review-prefs'),
    cloudBase:localStorage.getItem(BASE_KEY),
    syncMeta:localStorage.getItem(META_KEY)
  };
  try{
    // Never replace an existing recovery copy; every account switch gets its own archive.
    localStorage.setItem(recoveryKey,JSON.stringify(recovery));
    return recoveryKey;
  }catch(error){
    console.error('LifeOS could not preserve the previous account cache:',error);
    throw new Error('Could not preserve this device’s previous workspace. No local data was changed. Free some device storage and retry.');
  }
}
async function signOutFromLifeOS(){
  const btn=$('#signOutBtn');
  if(!supabase){toast('Cloud client is unavailable. Your local workspace is unchanged.');return}
  if(btn?.disabled)return;
  const user=cloudUser,wasDirty=dirty,wasCloudReady=cloudReady,meta=readMeta();
  if(user){
    // Persist the latest local snapshot before asking Supabase to end the session.
    if(!writeCache()){toast('Could not save the local workspace. Sign-out was cancelled to protect your entries.');return}
    writeMeta({user:user.id,revision:baseRevision,stamp:baseStamp,dirty:wasDirty,localUpdatedAt:wasDirty?(meta.localUpdatedAt||logicalNow()):meta.localUpdatedAt});
  }
  clearTimeout(cloudTimer);cloudTimer=null;cloudReady=false;
  if(btn)btn.disabled=true;
  try{
    // Do not wait for Realtime teardown: it must never block authentication logout.
    const {error}=await supabase.auth.signOut({scope:'local'});
    if(error)throw error;
    if(cloudUser)handleSignedOut('Signed out. Your saved workspace remains on this device.');
    else{
      $('#accountStatus').textContent='On this device';
      $('#accountEmail').textContent='Signed out. Your saved workspace remains on this device.';
      $('#connectCloudBtn').hidden=false;$('#signOutBtn').hidden=true;
      setSync(wasDirty?'Signed out. Unsynced changes remain saved on this device.':'Signed out. Your workspace remains saved on this device.');
    }
    $('#authGate').style.display='flex';
    $('#authMessage').textContent='You have signed out of LifeOS. Your device data has been kept.';
  }catch(error){
    cloudReady=wasCloudReady&&!!cloudUser;
    toast('Could not sign out: '+(error?.message||'Please retry.'));
  }finally{
    if(btn)btn.disabled=false;
  }
}
function handleSignedOut(msg){
  const retainedUnsyncedChanges=dirty;
  cloudReady=false;activating=false;clearTimeout(cloudTimer);cloudTimer=null;pendingCloudConflict=null;baseRevision=0;clearConflictActions();
  if(window.__lifeosChannel&&supabase){supabase.removeChannel(window.__lifeosChannel);window.__lifeosChannel=null}
  cloudUser=null;window.__lifeosCloudLoaded=false;
  $('#accountStatus').textContent='On this device';$('#accountEmail').textContent='Your saved workspace remains available here. Connect Google to sync across devices.';$('#connectCloudBtn').hidden=false;$('#signOutBtn').hidden=true;
  setSync(retainedUnsyncedChanges?'Session ended. Unsynced changes are saved on this device.':'Offline-ready. Connect Google when you want cloud sync.');
  $('#authGate').style.display='none';$('#authMessage').textContent=msg||'Your session ended. You can keep working offline and reconnect Google later.';
}
async function startCloud(){
  const gate=$('#authGate'),msg=$('#authMessage');
  $('#signOutBtn').onclick=signOutFromLifeOS;
  // Bind the controls before checking the Supabase SDK. If the SDK fails to load,
  // the button must still respond with a visible error instead of doing nothing.
  const startGoogleSignIn=async()=>{
    if(!supabase){await startCloud();if(!supabase)return}
    msg.textContent='Opening Google sign-in…';
    try{
      const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.href.split('#')[0]}});
      if(error)msg.textContent='Sign-in failed: '+error.message;
    }catch(error){msg.textContent='Sign-in failed: '+(error?.message||'Please reload and try again.')}
  };
  $('#googleSignIn').onclick=startGoogleSignIn;
  $('#connectCloudBtn').onclick=startGoogleSignIn;
  $('#continueOffline').onclick=()=>{offlineModeChosen=true;gate.style.display='none';setSync('Offline mode. Changes are saved on this device and will sync after you connect Google.')};
  try{
    if(!window.supabase?.createClient)throw new Error('Could not load the Supabase client. Check your internet connection and reload.');
    if(!supabase)supabase=window.supabase.createClient('https://dtnyyqnyfksxvgedswhj.supabase.co','sb_publishable_-Bppvb1O6mYvca2y8GNFXQ_m0adWMEh');
    if(!authSubscription){
      const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
        if(session&&event==='SIGNED_IN')setTimeout(()=>activateSession(session),0);
        if(event==='SIGNED_OUT'&&cloudUser)handleSignedOut();
      });
      authSubscription=subscription;window.addEventListener('beforeunload',()=>authSubscription?.unsubscribe());
    }
    const {data:{session},error}=await supabase.auth.getSession();
    if(error)throw error;
    if(session){await activateSession(session);return}
    cloudUser=null;cloudReady=false;$('#accountStatus').textContent='On this device';$('#accountEmail').textContent='Your workspace is available here. Connect Google to sync it across devices.';$('#connectCloudBtn').hidden=false;$('#signOutBtn').hidden=true;setSync(dirty?'Saved on this device; waiting to sync.':'Offline-ready. Sign in when you want cloud sync.');gate.style.display=initialLocalCachePresent||offlineModeChosen?'none':'flex';
  }catch(e){cloudReady=false;$('#accountStatus').textContent='Offline';$('#connectCloudBtn').hidden=false;$('#signOutBtn').hidden=true;setSync('Offline mode. Changes are saved on this device. Connect Google when online to sync.');gate.style.display=initialLocalCachePresent||offlineModeChosen?'none':'flex';msg.textContent='Cloud connection is unavailable. You can continue offline and connect when online.'}
}
async function activateSession(session){
  if(!supabase||!session?.user)return;
  const nextUser=session.user;
  pendingCloudConflict=null;
  if(cloudUser?.id===nextUser.id&&(cloudReady||activating))return; // duplicate auth event
  activating=true;cloudReady=false;cloudUser=nextUser;
  $('#authGate').style.display='none';
  try{
    window.__lifeosCloudLoaded=true;
    let activationStartSnapshot=currentSnapshot();
    // A local copy is only trusted if it belongs to this same account.
    const meta=readMeta(),cacheEligible=meta.user===nextUser.id||!meta.user;let cached=null;
    if(cacheEligible){try{const v=JSON.parse(localStorage.getItem('lifeos-review-v2')),p=JSON.parse(localStorage.getItem('lifeos-review-prefs'));if(v&&Array.isArray(v.tasks))cached={ws:normalizeWorkspace(v),pr:mergePrefs(defaultPrefs(),p)}}catch(e){}}
    if(!cacheEligible){
      // Archive the previous account's local workspace before changing account context.
      // Never merge another account's private data into this account automatically.
      const recoveryKey=preserveForeignLocalCache(meta);
      console.warn('LifeOS preserved a previous account workspace for recovery:',recoveryKey);
      meta.user=nextUser.id;meta.dirty=false;meta.revision=0;meta.stamp=null;meta.localUpdatedAt=0;
      baseStamp=null;baseRevision=0;s=seed();prefs=defaultPrefs();activationStartSnapshot=currentSnapshot();
    }
    let remote=null,offline=false,status='';
    try{remote=await fetchRemote()}catch(e){offline=true;console.warn('LifeOS: keeping this device available offline',e)}
    if(cloudUser?.id!==nextUser.id)return;
    const latestMeta=readMeta(),liveSnapshot=currentSnapshot(),localChanged=!!latestMeta.dirty||JSON.stringify(liveSnapshot)!==JSON.stringify(activationStartSnapshot);
    if(offline){
      baseStamp=latestMeta.stamp||null;baseRevision=Number(latestMeta.revision)||0;dirty=!!latestMeta.dirty;
      lastCloudPayload=dirty?'':JSON.stringify({workspace:s,preferences:prefs});
      status='Offline: this device keeps working and will sync after reconnecting.';
    }else if(remote){
      const remoteSnapshot={workspace:normalizeWorkspace(remote.data.workspace),preferences:mergePrefs(defaultPrefs(),remote.data.preferences)},remoteSer=JSON.stringify(remoteSnapshot),remoteRevision=Number(remote.revision)||0;
      // A device cache without a recorded cloud baseline is not safe to discard.
      // Treat it as local-only data and merge it with the remote workspace, even
      // when its dirty flag was never set by an earlier offline session.
      if(cached||localChanged){
        const localSnapshot=cached?{workspace:cached.ws,preferences:cached.pr}:liveSnapshot,storedBase=meta.user===nextUser.id?readBaseSnapshot():null;
        if(!storedBase){const stamp=latestMeta.localUpdatedAt||logicalNow();window.LifeOSSyncCore.stampWorkspaceChanges(null,localSnapshot.workspace,stamp)}
        const baseSnapshot=storedBase?{workspace:normalizeWorkspace(storedBase.workspace),preferences:mergePrefs(defaultPrefs(),storedBase.preferences)}:{workspace:normalizeWorkspace({}),preferences:defaultPrefs()};
        const merged=window.LifeOSSyncCore.mergeSnapshots(baseSnapshot,localSnapshot,remoteSnapshot,{localFallbackTime:latestMeta.localUpdatedAt||logicalNow(),remoteFallbackTime:stampMs(remote.updated_at)});
        s=normalizeWorkspace(merged.workspace);prefs=mergePrefs(defaultPrefs(),merged.preferences);baseRevision=remoteRevision;baseStamp=remote.updated_at||null;lastCloudPayload=remoteSer;writeBaseSnapshot(remoteSnapshot);
        dirty=JSON.stringify({workspace:s,preferences:prefs})!==remoteSer;status=dirty?'Merged this device with the latest cloud entries; syncing…':'Cloud entries are up to date.';
      }else{
        s=remoteSnapshot.workspace;prefs=remoteSnapshot.preferences;baseRevision=remoteRevision;baseStamp=remote.updated_at||null;lastCloudPayload=remoteSer;writeBaseSnapshot(remoteSnapshot);dirty=false;status='Cloud sync is active.';
      }
    }else{
      baseStamp=null;baseRevision=0;lastCloudPayload='';dirty=true;
      writeBaseSnapshot({workspace:normalizeWorkspace({}),preferences:defaultPrefs()});status='New cloud workspace ready; saving this device’s entries.';
    }
    lastLocalSnapshot=currentSnapshot();
    writeCache();writeMeta({user:nextUser.id,revision:baseRevision,dirty});
    cloudReady=true;
    $('#accountStatus').textContent=offline?'Offline':'Connected';
    $('#accountEmail').textContent=cloudUser.email||'Signed in with Google';
    $('#connectCloudBtn').hidden=true;$('#signOutBtn').hidden=false;
    setSync(status);
    $('#signOutBtn').onclick=signOutFromLifeOS;
    setup();
    if(!offline&&dirty&&!pendingCloudConflict)await pushCloud();
    if(pendingCloudConflict)showCloudConflict(pendingCloudConflict);
    if(window.__lifeosChannel)supabase.removeChannel(window.__lifeosChannel);
    window.__lifeosChannel=supabase.channel('lifeos-workspace-sync')
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'lifeos_workspace',filter:'user_id=eq.'+cloudUser.id},payload=>{
        if(!cloudReady||!payload.new?.data)return;
        try{applyRemoteRow(payload.new)}catch(e){console.error(e)}
      }).subscribe();
  }catch(e){
    cloudReady=false;console.error('LifeOS cloud activation failed:',e);
    $('#accountStatus').textContent='Offline';$('#connectCloudBtn').hidden=false;
    // Keep sign-out available even when activation fails; it never clears local data.
    $('#signOutBtn').hidden=!cloudUser;
    const detail=String(e?.message||e||'Unknown activation error');
    setSync('Cloud activation failed: '+detail);
    $('#authGate').style.display=initialLocalCachePresent||offlineModeChosen?'none':'flex';
    $('#authMessage').textContent='Cloud activation failed: '+detail;
  }finally{activating=false}
}
/* ===== end rewritten block ===== */


/* ===== Day rollover, study totals, dates ===== */
function migrate(){
  let ch=false,today=dayKey(),tom=dayKey(addDays(1));
  s.tasks.forEach(t=>{if(!t.due&&(t.date==='today'||t.date==='tomorrow')){t.due=t.date==='today'?today:tom;ch=true}});
  s.sessions.forEach(x=>{if(x.date==='Today'){x.date='';ch=true}});
  if(s.exams.length){const first=s.exams[0].name;s.syllabus.forEach(t=>{if(t.exam===undefined){t.exam=first;ch=true}});s.sessions.forEach(x=>{if(x.exam===undefined){x.exam=first;ch=true}})}
  return ch;
}
// Tasks carry a real due date; "today / tomorrow / later" is recalculated from it every day.
function rollover(){
  let ch=migrate();const today=dayKey(),tom=dayKey(addDays(1));
  s.tasks.forEach(t=>{
    if(!t.due)return;let nd=t.date;
    if(t.due<today){if(t.status==='done')nd='none';else{t.due=today;nd='today';ch=true}}
    else if(t.due===today)nd='today';else if(t.due===tom)nd='tomorrow';else nd='later';
    if(nd!==t.date){t.date=nd;ch=true}
  });
  return ch;
}
function adoptOrphans(name){s.syllabus.forEach(t=>{if(t.exam===undefined)t.exam=name});s.sessions.forEach(x=>{if(x.exam===undefined)x.exam=name})}
function weekStartKey(d=new Date()){return dateUtils.weekStartKey(d)}
function studyTargetMins(){const m=Math.round(Number(prefs&&prefs.studyTargetMins));return Number.isFinite(m)&&m>=5&&m<=1440?m:180}
const studyUtils=window.LifeOSStudyUtils;
function dur(m){return studyUtils.formatDuration(m)}
function hm(m){return studyUtils.formatHoursMinutes(m)}
function studyProgressText(done,target){return studyUtils.progressText(done,target)}

function studyTodayMins(){const k=dayKey();return s.sessions.filter(x=>x.date===k).reduce((a,x)=>a+(+x.minutes||0),0)}
function studyWeekMins(){const k=weekStartKey(),t=dayKey();return s.sessions.filter(x=>x.date>=k&&x.date<=t).reduce((a,x)=>a+(+x.minutes||0),0)}
function sessionDateLabel(d){if(!dayRe.test(d||''))return 'Earlier';return d===dayKey()?'Today':dateLabel(new Date(d+'T12:00:00'))}
function examDaysLeft(d){return dateUtils.examDaysLeft(d)}
function fmtTime(d=new Date()){return dateUtils.formatTime(d,prefs.clock)}
function fullDateLabel(d=new Date()){return dateUtils.fullDateLabel(d,prefs.dateFormat)}
function updateDateLabels(){
  const d=new Date(),e=$('#eyebrow'),t=$('#topdate'),c=$('#datechip');
  if(e)e.textContent='YOUR SPACE';
  if(t)t.textContent='A little progress, every day.';
  if(c)c.textContent='Today · '+fullDateLabel(d)+' · '+fmtTime(d);
}
const modalUI=window.LifeOSModalUI.create({$, safe});
function showModal(){return modalUI.showModal()}
function closeModal(){return modalUI.closeModal()}
function closeSearchModal(){return modalUI.closeSearchModal()}
function trapDialogTab(event,dialog){return modalUI.trapDialogTab(event,dialog)}
function inPageConfirm(title,msg,onOk,isDanger=false){return modalUI.inPageConfirm(title,msg,onOk,isDanger)}
function inPagePrompt(title,msg,defVal,onOk,inpType='text'){return modalUI.inPagePrompt(title,msg,defVal,onOk,inpType)}
function bindModalClose(){return modalUI.bindModalClose()}

function dayCheck(){if(dayKey()!==lastDay){lastDay=dayKey();if(rollover())save();render()}}
function bindGlobalsOnce(){
  if(window.__lifeosGlobals)return;window.__lifeosGlobals=true;
  document.addEventListener('keydown',e=>{
    const dialog=$('#searchModal')||($('#modalBack').classList.contains('open')?$('#modalBack'):null);
    if(e.key==='Escape'&&dialog){e.preventDefault();e.stopImmediatePropagation();if(dialog.id==='searchModal')closeSearchModal();else closeModal();return}
    if(e.key==='Tab'&&dialog)trapDialogTab(e,dialog);
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();$('#moreMenu').classList.remove('open');closeSearchModal();}if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();search()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();search()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='n'){e.preventDefault();modal('quick')}});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){flushCloud();return}
    dayCheck();ensureTick();timerRender();syncNow();
  });
  window.addEventListener('pagehide',flushCloud);
  window.addEventListener('online',()=>{if(!cloudReady){startCloud();return}if(dirty)pushCloud();else syncNow()});
  setInterval(()=>{updateDateLabels();updateLifeOSGreeting();dayCheck()},30000);
}

function toast(msg,undo){let el=$('#toast');el.innerHTML=safe(msg)+(undo?' <button id="undo">Undo</button>':'');el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3200);if(undo)$('#undo').onclick=()=>{undo();save();render();el.classList.remove('show')}}
function nav(p){if(!$(`#page-${p}`))return;queryAll('.page').forEach(x=>x.classList.toggle('active',x.id===`page-${p}`));queryAll('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===p));$('#moreMenu').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});renderPage(p)}
function renderPage(p){({home:home,tasks:tasksPage,habits:habitsPage,study:studyPage,focus:focusPage,notes:notesPage,finance:financePage,library:libraryPage,projects:projectsPage,calendar:calendarPage,settings:settingsPage})[p]?.()}
const taskPageUI=window.LifeOSTaskPage.create({$, getState:()=>s, getTaskView:()=>taskView, safe, wire});
function taskRow(task,full=false){return taskPageUI.taskRow(task,full)}
const studyPageUI=window.LifeOSStudyPage.create({$, queryAll, getState:()=>s, safe, examDaysLeft, formatMinutes:mins, studyWeekMins, studyTodayMins, studyTargetMins, studyProgressText, formatHoursMinutes:hm, save, render, toast, sessionDateLabel});
function subjectNames(){return studyPageUI.subjectNames()}
function subjectOptions(selected=''){return studyPageUI.subjectOptions(selected)}
function refreshSubjectControls(){return studyPageUI.refreshSubjectControls()}

function dayKey(d=new Date()){return dateUtils.dayKey(d)}function weekdayKey(key){return dateUtils.weekdayKey(key)}const habitPageUI=window.LifeOSHabitPage.create({$, queryAll, getState:()=>s, dayKey, save, render, toast, wire, safe, modal, inPageConfirm});
function habitScheduledOn(habit,key){return habitPageUI.habitScheduledOn(habit,key)}
function habitScheduled(habit){return habitPageUI.habitScheduled(habit)}
function habitHistory(habit){return habitPageUI.habitHistory(habit)}
function habitDone(habit,key=dayKey()){return habitPageUI.habitDone(habit,key)}
function habitStreak(habit){return habitPageUI.habitStreak(habit)}
function habitStats(){return habitPageUI.habitStats()}
function habitRow(habit,showUnscheduled=false){return habitPageUI.habitRow(habit,showUnscheduled)}

function wire(){ queryAll('[data-check]').forEach(b=>b.onchange=()=>{let t=s.tasks.find(t=>t.id===+b.dataset.check),old=t.status;t.status=b.checked?'done':'todo';save();render();toast(t.status==='done'?'Task completed.':'Task marked unfinished.',()=>t.status=old)});queryAll('[data-hcheck]').forEach(b=>b.onclick=()=>{let h=s.habits.find(h=>h.id===+b.dataset.hcheck);if(!h)return;h.history=habitHistory(h);let key=dayKey(),was=habitDone(h,key);h.history=was?h.history.filter(x=>x!==key):[...h.history,key];h.doneDate=was?'':key;save();render();toast(was?'Check-in undone.':'Habit checked in.')});queryAll('[data-edit-habit]').forEach(b=>b.onclick=()=>modal('habit',s.habits.find(h=>h.id===+b.dataset.editHabit)));queryAll('[data-delete-habit]').forEach(b=>b.onclick=()=>{let h=s.habits.find(h=>h.id===+b.dataset.deleteHabit);if(!h)return;inPageConfirm('Delete habit',`Delete habit “${h.name}”? Its check-in history will also be removed.`,()=>{s.habits=s.habits.filter(x=>x.id!==h.id);save();render();toast('Habit deleted.');},true);});queryAll('[data-edit-task]').forEach(b=>b.onclick=()=>modal('task',s.tasks.find(t=>t.id===+b.dataset.editTask)));queryAll('[data-delete-task]').forEach(b=>b.onclick=()=>{let i=s.tasks.findIndex(t=>t.id===+b.dataset.deleteTask);if(i<0)return;let removed=s.tasks.splice(i,1)[0];save();render();toast('Task deleted.',()=>s.tasks.splice(Math.min(i,s.tasks.length),0,removed))});queryAll('[data-go]').forEach(b=>b.onclick=()=>nav(b.dataset.go));queryAll('[data-add]').forEach(b=>b.onclick=()=>modal(b.dataset.add));}
function home(){let n=score();$('#scoreNum').textContent=n===null?'—':n+'%';$('#scoreRing').style.background=n===null?'var(--panel2)':`conic-gradient(var(--mint) 0 ${n}%,var(--panel2) ${n}% 100%)`;$('#scoreMood').textContent=n===null?'A fresh start.':n>=80?'A strong day.':n>=50?'A steady day.':'Room to reset.';$('#scoreDesc').textContent=n===null?'Add planned tasks to start tracking your day.':'Completed tasks weighted by priority.';(()=>{const up=s.tasks.filter(t=>t.status!=='done'&&(t.date==='tomorrow'||t.date==='later')).sort((a,b)=>(a.date==='tomorrow'?0:1)-(b.date==='tomorrow'?0:1));$('#dashUpcoming').innerHTML=up.slice(0,3).map(t=>taskRow(t)).join('')||'<div class="empty">No upcoming tasks. Plan ahead by adding one for tomorrow.</div>';$('#upcomingCount').textContent=up.length?(up.length>3?`Next 3 of ${up.length}`:`${up.length} upcoming`):'Nothing scheduled ahead'})();$('#dashTasks').innerHTML=todayTasks().slice(0,3).map(t=>taskRow(t)).join('')||'<div class="empty">Nothing planned for today. Add a task when you are ready.</div>';$('#taskCount').textContent=`${todayTasks().filter(t=>t.status==='done').length} of ${todayTasks().length} complete`;$('#dashHabits').innerHTML=s.habits.map(habitRow).join('')||'<div class="empty">Your habits will appear here.</div>';let schedH=s.habits.filter(habitScheduled),doneH=schedH.filter(h=>habitDone(h)).length;$('#habitCount').textContent=`${doneH} of ${schedH.length} complete`;$('#habitMetric').textContent=`${doneH} / ${schedH.length}`;let todayExpenses=s.transactions.filter(t=>t.type==='expense'&&transactionDate(t)===dayKey()),todayTotal=todayExpenses.reduce((a,t)=>a+(+t.amount||0),0);$('#dashTodayExpenses').textContent=money(todayTotal);$('#dashExpenseBreakdown').textContent=todayExpenses.length?Object.entries(todayExpenses.reduce((a,t)=>{let k=t.category||'Other';a[k]=(a[k]||0)+(+t.amount||0);return a},{})).map(([k,v])=>`${k}: ${money(v)}`).join(' · '):'No expenses recorded today.';let stToday=studyTodayMins();$('#studyToday').textContent=mins(stToday);let stTarget=studyTargetMins();$('#studyBar').style.width=Math.min(100,stToday/stTarget*100)+'%';$('#studyBarWrap').setAttribute('aria-valuenow',String(Math.min(100,Math.round(stToday/stTarget*100))));$('#studyTargetLabel').textContent='Target: '+dur(stTarget);$('#studyProgressText').textContent=studyProgressText(stToday,stTarget);wire();timerRender()}
function tasksPage(){return taskPageUI.tasksPage()}
function habitsPage(){return habitPageUI.habitsPage()}
function focusPage(){ $('#focusHistory').innerHTML=s.sessions.map(sessionRow).join('')||'<div class="empty">No sessions logged yet.</div>';wireSessions();timerRender()}
const notesPageUI=window.LifeOSNotesPage.create({$, queryAll, getState:()=>s, safe, modal, save, toast});
function notesPage(){return notesPageUI.notesPage()}
const financePageUI=window.LifeOSFinancePage.create({$,queryAll,getState:()=>s,getPrefs:()=>prefs,dayKey,money,safe,save,toast,modal,getFinanceMonth:()=>financeMonth,setFinanceMonth:value=>{financeMonth=value}});
function transactionDate(t){return financePageUI.transactionDate(t)}
function budgetCycleStart(dateKey,resetDay){return financePageUI.budgetCycleStart(dateKey,resetDay)}
function transactionCycle(t){return financePageUI.transactionCycle(t)}
function cycleLabel(startKey){return financePageUI.cycleLabel(startKey)}
function inCurrentBudgetCycle(t){return financePageUI.inCurrentBudgetCycle(t)}
function financePage(){return financePageUI.financePage()}

const libraryPageUI=window.LifeOSLibraryPage.create({$, queryAll, getState:()=>s, getBookView:()=>bookView, safe, save, toast, modal, inPageConfirm});
function libraryPage(){return libraryPageUI.libraryPage()}

const projectsPageUI=window.LifeOSProjectsPage.create({$, queryAll, getState:()=>s, safe, save, render, toast, modal, inPageConfirm, bindModalClose, showModal, closeModal});
function renderProjectCards(){return projectsPageUI.renderProjectCards()}
function projectsPage(){return projectsPageUI.projectsPage()}
function openGoal(id){return projectsPageUI.openGoal(id)}

const calendarPageUI=window.LifeOSCalendarPage.create({$, getState:()=>s, dateLabel, addDays, dayKey, safe, getWeekOffset:()=>weekOffset});
function calendarPage(){return calendarPageUI.calendarPage()}

const focusTimer=window.LifeOSFocusTimer.create({$, getState:()=>s, formatClock:fmtsec, save, newRecordId, dayKey, render, toast, formatMinutes:mins});
function timerSeconds(){return focusTimer.timerSeconds()}
function timerRender(){return focusTimer.timerRender()}
function timerTick(){return focusTimer.timerTick()}
function ensureTick(){return focusTimer.ensureTick()}
function timerStart(){return focusTimer.timerStart()}
function logFocusSession(seconds){return focusTimer.logFocusSession(seconds)}
function timerComplete(){return focusTimer.timerComplete()}
function timerPause(){return focusTimer.timerPause()}
function timerReset(){return focusTimer.timerReset()}
function timerFinish(){return focusTimer.timerFinish()}

const entryModalUI=window.LifeOSEntryModal.create({$,queryAll,getState:()=>s,safe,dayKey,addDays,dayRe,toast,newRecordId,transactionDate,subjectOptions,habitHistory,showModal,closeModal,save,render,bindModalClose});
function modal(type,item=null){return entryModalUI.modal(type,item)}

function settingsPage(){applyPrefs()}
function render(){if(rollover())save();refreshSubjectControls();home();tasksPage();habitsPage();studyPage();focusPage();notesPage();financePage();libraryPage();projectsPage();calendarPage();timerRender()}
const searchUI=window.LifeOSSearchUI.create({$, queryAll, getState:()=>s, safe, nav, closeSearchModal, setSearchReturnFocus:target=>modalUI.setSearchReturnFocus(target)});
function search(){return searchUI.search()}

const backupUI=window.LifeOSBackupUI.create({getState:()=>s,getPrefs:()=>prefs,setPrefs:value=>{prefs=value},normalizeWorkspace,mergeWorkspace,mergePrefs,safe,toast,confirm:inPageConfirm,save,applyPrefs,render,nav,pushCloud,restorePrevious:(workspace,preferences,markDirty)=>{s=workspace;prefs=preferences;if(markDirty){dirty=true;writeMeta({user:cloudUser?.id,revision:baseRevision,dirty:true})}writeCache()}});
function exportData(){return backupUI.exportData()}
function backupPreview(file){return backupUI.backupPreview(file)}
function restoreBackup(mode){return backupUI.restoreBackup(mode)}

const profileUI=window.LifeOSProfileUI.create({$, queryAll, getPrefs:()=>prefs, save, toast, safe, safePic, updateDateLabels, nav});
function saveProfile(){profileUI.saveProfile()}
function applyPrefs(){profileUI.applyPrefs()}
function applyModuleVisibility(){profileUI.applyModuleVisibility()}
function applySummaries(){profileUI.applySummaries()}
function toggleTheme(){profileUI.toggleTheme()}
function toggleSidebar(){profileUI.toggleSidebar()}
function getLifeOSGreeting(){return profileUI.getLifeOSGreeting()}
function updateLifeOSGreeting(){profileUI.updateLifeOSGreeting()}

function setup(){
  if(setupComplete){applyPrefs();render();return}
  setupComplete=true;
  updateLifeOSGreeting();if(!window.__lifeosCloudLoaded)load();s.exams=s.exams||[];s.subjects=s.subjects||[];[...s.syllabus.map(x=>x.subject),...s.sessions.map(x=>x.subject)].filter(Boolean).forEach(x=>{if(!s.subjects.includes(x))s.subjects.push(x)});s.investments=s.investments||[];s.assets=s.assets||[];s.liabilities=s.liabilities||[];let es=$('#examSelect');s.exams.forEach(e=>{if(![...es.options].some(o=>o.value===e.name)){let o=document.createElement('option');o.value=e.name;o.textContent=e.name;es.append(o)}});updateDateLabels();queryAll('[data-page]').forEach(b=>b.onclick=()=>nav(b.dataset.page));queryAll('[data-go]').forEach(b=>b.onclick=()=>nav(b.dataset.go));queryAll('[data-add]').forEach(b=>b.onclick=()=>modal(b.dataset.add));$('#quickAdd').onclick=()=>modal('quick');$('#searchBtn').onclick=search;$('#themeBtn').onclick=toggleTheme;$('#collapse').onclick=toggleSidebar;$('#settingsSidebar').onclick=toggleSidebar;$('#prefTheme').onchange=()=>{prefs.theme=$('#prefTheme').value;save();applyPrefs()};$('#prefDensity').onchange=()=>{prefs.density=$('#prefDensity').value;save();applyPrefs()};$('#prefFont').onchange=()=>{prefs.font=$('#prefFont').value;save();applyPrefs()};$('#prefAccent').onchange=()=>{prefs.accent=$('#prefAccent').value;save();applyPrefs();toast('Accent colour updated.')};prefs.weekStart=1;$('#prefClock').onchange=()=>{prefs.clock=$('#prefClock').value;save();updateDateLabels();toast('Clock format updated.')};$('#prefDate').onchange=()=>{prefs.dateFormat=$('#prefDate').value;save();updateDateLabels();render();toast('Date format updated.')};$('#prefBudgetResetDay').onchange=()=>{prefs.budgetResetDay=Number($('#prefBudgetResetDay').value)||1;financeMonth=null;save();render();toast('Income and budget cycle updated.')};$('#saveProfilePage').onclick=saveProfile;$('#profileRemovePicture').onclick=()=>{prefs.picture='';save();applyPrefs();toast('Profile picture removed.')};$('#profilePictureInput').onchange=async e=>{let f=e.target.files?.[0];if(!f)return;try{prefs.picture=await compressImage(f);prefs.avatar='';save();applyPrefs();toast('Profile picture saved.')}catch(err){toast(err.message||'Could not save that picture.')}e.target.value=''};$('#profileAvatarChoices').onclick=e=>{let b=e.target.closest('[data-profile-avatar]');if(!b)return;prefs.avatar=b.dataset.profileAvatar;prefs.picture='';save();applyPrefs();toast('Avatar updated.')};$('#summaryTasks').onchange=()=>{prefs.summaries.tasks=$('#summaryTasks').checked;save();applyPrefs()};$('#summaryStudy').onchange=()=>{prefs.summaries.study=$('#summaryStudy').checked;save();applyPrefs()};$('#summaryHabits').onchange=()=>{prefs.summaries.habits=$('#summaryHabits').checked;save();applyPrefs()};if($('#resetPrefsBtn'))$('#resetPrefsBtn').onclick=resetPreferences;$('#moreBtn').onclick=()=>$('#moreMenu').classList.toggle('open');$('#taskViews').onclick=e=>{let b=e.target.closest('[data-view]');if(!b)return;taskView=b.dataset.view;queryAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));tasksPage()};$('#taskSearch').oninput=tasksPage;$('#taskPriority').onchange=tasksPage;$('#noteSearch').oninput=notesPage;$('#librarySearch').oninput=libraryPage;$('#libraryStatus').onchange=libraryPage;$('#libraryType').onchange=libraryPage;$('#libraryLayout').onclick=e=>{let b=e.target.closest('[data-layout]');if(!b)return;bookView=b.dataset.layout;queryAll('[data-layout]').forEach(x=>x.classList.toggle('active',x===b));libraryPage()};$('#miniStart').onclick=timerStart;$('#miniStop').onclick=timerPause;$('#miniFinish').onclick=timerFinish;$('#startTimer').onclick=timerStart;$('#pauseTimer').onclick=timerPause;$('#finishTimer').onclick=timerFinish;$('#resetTimer').onclick=timerReset;$('#timerModes').onclick=e=>{let b=e.target.closest('[data-mode]');if(!b)return;if(s.timer.running){toast('Pause or finish the session first.');return}s.timer.mode=b.dataset.mode;s.timer.duration=b.dataset.mode==='countdown'?1500:0;s.timer.remaining=s.timer.duration;s.timer.paused=false;queryAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));$('#presets').style.display=b.dataset.mode==='countdown'?'flex':'none';save();timerRender()};$('#presetButtons').onclick=e=>{let b=e.target.closest('[data-min]');if(!b||s.timer.running)return;s.timer.duration=+b.dataset.min*60;s.timer.remaining=s.timer.duration;queryAll('[data-min]').forEach(x=>x.classList.toggle('active',x===b));save();timerRender()};$('#customTimer').onclick=()=>{inPagePrompt('Custom timer','Countdown minutes (1–240):','30',(val)=>{let n=Number(val);if(Number.isInteger(n)&&n>=1&&n<=240&&!s.timer.running){s.timer.duration=n*60;s.timer.remaining=n*60;save();timerRender();}else{toast('Enter a whole number between 1 and 240.');}},'number');};$('#timerTopic').oninput=timerRender;$('#timerSubject').onchange=timerRender;$('#addRoutine').onclick=()=>modal('routine');$('#addTopic').onclick=()=>modal('topic');$('#manageSubjects').onclick=()=>{inPagePrompt('Add subject','Add a subject name:','',(val)=>{let name=val?.trim();if(!name)return;if(!(s.subjects||[]).includes(name))s.subjects.push(name);save();refreshSubjectControls();toast('Subject added. It is available in Exams and Focus Timer.');});};$('#addExam').onclick=()=>{inPagePrompt('New exam workspace','Name this exam workspace:','',(val)=>{let n=val?.trim();if(n&&!s.exams.some(e=>e.name===n)){let first=!s.exams.length;s.exams.push({name:n,date:''});if(first)adoptOrphans(n);refreshSubjectControls();$('#examSelect').value=n;save();studyPage();}});};
$('#editExam').onclick=()=>{let n=$('#examSelect').value,ex=s.exams.find(e=>e.name===n);if(!ex)return;inPagePrompt('Set exam date','Exam date (YYYY-MM-DD). Leave empty to clear:',ex.date||'',(val)=>{let v=val?.trim()||'';if(v&&!(dayRe.test(v)&&dayKey(new Date(v+'T12:00:00'))===v)){toast('Use the format YYYY-MM-DD, for example 2026-12-15.');return;}ex.date=v;save();studyPage();toast(v?'Exam date saved.':'Exam date cleared.');});};
$('#deleteExam').onclick=()=>{let n=$('#examSelect').value;if(!n)return;let topics=s.syllabus.filter(t=>t.exam===n).length;inPageConfirm('Delete exam',`Delete exam “${n}”? Its ${topics} syllabus topic(s) will be removed. Study sessions stay in your Focus history.`,()=>{s.exams=s.exams.filter(e=>e.name!==n);s.syllabus=s.syllabus.filter(t=>t.exam!==n);s.sessions.forEach(x=>{if(x.exam===n)x.exam=''});save();refreshSubjectControls();$('#examSelect').value='';studyPage();toast('Exam deleted.');},true);};$('#examSelect').onchange=studyPage;$('#prevWeek').onclick=()=>{weekOffset--;calendarPage()};$('#nextWeek').onclick=()=>{weekOffset++;calendarPage()};$('#thisWeek').onclick=()=>{weekOffset=0;calendarPage()};$('#resetBtn').onclick=reset;bindGlobalsOnce();bindModalClose();try{if(!localStorage.getItem('lifeos-review-prefs')&&localStorage.getItem('lifeos-review-theme')==='light')prefs.theme='light'}catch(e){}applyPrefs();render();save()}
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('LifeOS offline shell could not be installed.',error));
startCloud();
setup();
})();
