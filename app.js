
(()=>{'use strict';
const $=s=>document.querySelector(s), $=s=>[...document.querySelectorAll(s)];
const formatUtils=window.LifeOSFormatUtils;
const now=new Date(), dateLabel=(d=new Date())=>dateUtils.dateLabel(d,prefs.dateFormat), safe=s=>formatUtils.escapeHtml(s);
const seed=()=>({tasks:[],habits:[],routines:[],notes:[],sessions:[],syllabus:[],transactions:[],budgets:[],resources:[],goals:[],projects:[],investments:[],assets:[],liabilities:[],exams:[],subjects:[],studyToday:0,studyWeek:0,timer:{mode:'countdown',duration:1500,remaining:1500,running:false,startedAt:null,paused:false}});
let s=seed(), prefs={theme:'dark',accent:'amber',density:'comfortable',font:'default',name:'',motto:'',avatar:'UG',picture:'',hiddenModules:[],summaries:{tasks:true,study:true,habits:true},weekStart:1,clock:'12',dateFormat:'dmy',budgetResetDay:1}, pendingBackup=null, taskView='all',bookView='cards',weekOffset=0,financeMonth=null,tick=null,toastTimer=null,modalSaveFn=null,modalReturnFocus=null,searchReturnFocus=null;
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
  $('#continueOffline').onclick=()=>{offlineModeChosen=true;gate.style.display='none';setSync('Offline mode. Changes are saved on this device and will sync after you connect Google.')};
  try{
    if(!window.supabase?.createClient)throw new Error('Could not load the Supabase client. Check your internet connection and reload.');
    if(!supabase)supabase=window.supabase.createClient('https://dtnyyqnyfksxvgedswhj.supabase.co','sb_publishable_-Bppvb1O6mYvca2y8GNFXQ_m0adWMEh');
    // Sign-in button and auth listener are attached up front, so they also work after signing out of a session that was already active on load.
    const startGoogleSignIn=async()=>{if(!supabase){await startCloud();if(!supabase)return}msg.textContent='Opening Google sign-in…';const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.href.split('#')[0]}});if(error)msg.textContent='Sign-in failed: '+error.message};
    $('#googleSignIn').onclick=startGoogleSignIn;$('#connectCloudBtn').onclick=startGoogleSignIn;
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
    if(!cacheEligible){try{localStorage.removeItem(BASE_KEY);CACHE_KEYS.slice(0,2).forEach(k=>localStorage.removeItem(k))}catch(e){}meta.user=nextUser.id;meta.dirty=false;meta.revision=0;meta.stamp=null;meta.localUpdatedAt=0;baseStamp=null;baseRevision=0;s=seed();prefs=defaultPrefs();activationStartSnapshot=currentSnapshot()}
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
      if((cached&&latestMeta.dirty)||localChanged){
        const localSnapshot=liveSnapshot,storedBase=meta.user===nextUser.id?readBaseSnapshot():null;
        if(!storedBase&&latestMeta.dirty){const stamp=latestMeta.localUpdatedAt||logicalNow();window.LifeOSSyncCore.stampWorkspaceChanges(null,localSnapshot.workspace,stamp)}
        const baseSnapshot=storedBase?{workspace:normalizeWorkspace(storedBase.workspace),preferences:mergePrefs(defaultPrefs(),storedBase.preferences)}:(latestMeta.dirty?{workspace:normalizeWorkspace({}),preferences:{}}:activationStartSnapshot);
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
    $('#signOutBtn').onclick=async()=>{
      clearTimeout(cloudTimer);cloudTimer=null;
      const ok=await pushCloud();
      const doSignOut=async()=>{
        cloudReady=false;
        if(window.__lifeosChannel){await supabase.removeChannel(window.__lifeosChannel);window.__lifeosChannel=null}
        const {error}=await supabase.auth.signOut();
        if(error){cloudReady=true;toast('Could not sign out: '+error.message);return}
        clearLocalCache();s=seed();prefs=defaultPrefs();baseStamp=null;baseRevision=0;lastCloudPayload='';dirty=false;pendingCloudConflict=null;
        cloudUser=null;window.__lifeosCloudLoaded=false;
        try{applyPrefs();render()}catch(e){}
        $('#authGate').style.display='flex';$('#authMessage').textContent='You have signed out of LifeOS.';
      };
      if(!ok){toast('Sign-out paused: cloud save was not confirmed. Your local data is still here; resolve the sync conflict or retry before signing out.');return;}
      await doSignOut();
    };
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
    cloudReady=false;console.error(e);
    $('#accountStatus').textContent='Offline';$('#connectCloudBtn').hidden=false;$('#signOutBtn').hidden=true;
    setSync('Could not reach the cloud. Your device copy is still available and will sync when connected.');
    $('#authGate').style.display=initialLocalCachePresent||offlineModeChosen?'none':'flex';
    $('#authMessage').textContent='Cloud connection is unavailable. Continue offline or connect when online.';
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
const dateUtils=window.LifeOSDateUtils;
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
function showModal(){
  const overlay=$('#modalBack');
  if(!overlay.classList.contains('open'))modalReturnFocus=document.activeElement;
  overlay.classList.add('open');
  const first=$('#modalBody input,#modalBody select,#modalBody textarea')||$('#modalCancel');
  setTimeout(()=>first?.focus(),0);
}
function closeModal(){
  const overlay=$('#modalBack'),wasOpen=overlay.classList.contains('open');
  overlay.classList.remove('open');
  const target=modalReturnFocus;modalReturnFocus=null;
  if(wasOpen&&target?.isConnected)target.focus();
}
function closeSearchModal(){
  const dialog=$('#searchModal');if(!dialog)return;
  dialog.remove();
  const target=searchReturnFocus;searchReturnFocus=null;
  if(target?.isConnected)target.focus();
}
function trapDialogTab(event,dialog){
  const selector='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const items=[...dialog.querySelectorAll(selector)].filter(x=>!x.hidden&&x.getAttribute('aria-hidden')!=='true'&&x.getClientRects().length);
  if(!items.length){event.preventDefault();return}
  const first=items[0],last=items[items.length-1];
  if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus()}
}

function inPageConfirm(title,msg,onOk,isDanger=false){
  $('#modalTitle').textContent=title||'Confirm';
  $('#modalBody').innerHTML=`<p class="modal-confirm-copy">${safe(msg)}</p>`;
  $('#modalSave').textContent=isDanger?'Delete':'Confirm';
  $('#modalSave').className=isDanger?'btn danger-btn':'primary';
  showModal();
  bindModalClose();
  $('#modalSave').onclick=()=>{closeModal();$('#modalSave').className='primary';onOk();};
}
function inPagePrompt(title,msg,defVal,onOk,inpType='text'){
  $('#modalTitle').textContent=title||'Input';
  $('#modalBody').innerHTML=`<div class="form"><label class="prompt-label">${safe(msg)}</label><input id="fPromptVal" type="${inpType}" class="input u-full-width" value="${safe(defVal||'')}"></div>`;
  $('#modalSave').textContent='Save';
  $('#modalSave').className='primary';
  showModal();
  bindModalClose();
  setTimeout(()=>$('#fPromptVal')?.focus(),50);
  $('#modalSave').onclick=()=>{let v=$('#fPromptVal').value;closeModal();onOk(v);};
}

function bindModalClose(){$('#modalClose').onclick=$('#modalCancel').onclick=closeModal;$('#modalBack').onclick=e=>{if(e.target===$('#modalBack'))closeModal()}}
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
function nav(p){if(!$(`#page-${p}`))return;$$('.page').forEach(x=>x.classList.toggle('active',x.id===`page-${p}`));$$('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===p));$('#moreMenu').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});renderPage(p)}
function renderPage(p){({home:home,tasks:tasksPage,habits:habitsPage,study:studyPage,focus:focusPage,notes:notesPage,finance:financePage,library:libraryPage,projects:projectsPage,calendar:calendarPage,settings:settingsPage})[p]?.()}
function taskRow(t,full=false){
  const pCls = t.priority === 'High' ? 'prio-high' : t.priority === 'Low' ? 'prio-low' : 'prio-medium';
  const cCat = String(t.category || '').toLowerCase();
  const cCls = cCat === 'study' ? 'cat-study' : cCat === 'health' ? 'cat-health' : cCat === 'work' ? 'cat-work' : cCat === 'projects' ? 'cat-projects' : 'cat-personal';
  return `<div class="${full?'row':'taskrow'} ${t.status==='done'?'done':''}">
    <input type="checkbox" class="check" data-check="${t.id}" ${t.status==='done'?'checked':''} aria-label="Complete ${safe(t.title)}">
    <div class="${full?'rowmain':'taskmain'}">
      <div class="${full?'rowtitle':'taskname'}">${safe(t.title)}</div>
      <div class="${full?'rowsub':'taskmeta'}">
        <span class="${pCls}"><span class="dot ${t.priority.toLowerCase()}"></span>${safe(t.priority)}</span>
        <span class="cat-tag ${cCls}">${safe(t.category)}</span>
        ${t.estimate ? `<span class="tiny muted">⏱ ${t.estimate}m</span>` : ''}
      </div>
    </div>
    <div class="task-actions">
      <button class="task-btn" data-edit-task="${t.id}" aria-label="Edit task ${safe(t.title)}">Edit</button>
      <button class="task-btn task-btn-danger" data-delete-task="${t.id}" aria-label="Delete task ${safe(t.title)}">Delete</button>
    </div>
  </div>`;
}
function subjectNames(){return [...new Set([...(s.subjects||[]),...s.syllabus.map(x=>x.subject),...s.sessions.map(x=>x.subject)].filter(Boolean))].sort((a,b)=>a.localeCompare(b))}function subjectOptions(selected=''){let names=subjectNames();if(selected&&!names.includes(selected))names.push(selected);return names.map(x=>`<option ${x===selected?'selected':''}>${safe(x)}</option>`).join('')}function refreshSubjectControls(){let names=subjectNames();let timer=$('#timerSubject');if(timer){let current=timer.value;timer.innerHTML='<option value="">Select subject</option>'+names.map(x=>`<option>${safe(x)}</option>`).join('');if(current&&names.includes(current))timer.value=current}let examSel=$('#examSelect');if(examSel){let current=examSel.value;examSel.innerHTML='<option value="">Select an exam</option>'+s.exams.map(e=>`<option value="${safe(e.name)}">${safe(e.name)}</option>`).join('');if(current&&s.exams.some(e=>e.name===current))examSel.value=current}}
function dayKey(d=new Date()){return dateUtils.dayKey(d)}function weekdayKey(key){return dateUtils.weekdayKey(key)}function habitScheduledOn(h,key){let d=weekdayKey(key);return !h.days||h.days.length===0||h.days.includes(d)}function habitScheduled(h){return habitScheduledOn(h,dayKey())}function habitHistory(h){let hist=Array.isArray(h.history)?h.history.slice():[];if(h.doneDate&&!hist.includes(h.doneDate))hist.push(h.doneDate);return [...new Set(hist.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)))].sort()}function habitDone(h,key=dayKey()){return habitHistory(h).includes(key)}function habitStreak(h){let hist=new Set(habitHistory(h)),d=new Date();if(!hist.has(dayKey(d))){d.setDate(d.getDate()-1);while(!habitScheduledOn(h,dayKey(d))&&!hist.has(dayKey(d))&&d.getTime()>Date.now()-40*86400000)d.setDate(d.getDate()-1)}let n=0;for(let i=0;i<400;i++){let key=dayKey(d);if(habitScheduledOn(h,key)){if(hist.has(key))n++;else break}d.setDate(d.getDate()-1)}return n}function habitStats(){let total=0,done=0,streaks=[];let today=dayKey();for(let h of s.habits){streaks.push(habitStreak(h));for(let i=0;i<30;i++){let d=new Date();d.setDate(d.getDate()-i);let key=dayKey(d);if(habitScheduledOn(h,key)){total++;if(habitDone(h,key))done++}}}return {total,done,rate:total?Math.round(done/total*100):0,best:streaks.length?Math.max(...streaks):0}}function habitRow(h,showUnscheduled=false){
  if(!habitScheduled(h)&&!showUnscheduled)return '';
  let done=habitDone(h);
  const iconGradients = {
    '◉': 'linear-gradient(135deg, rgba(16,185,129,0.22), rgba(52,211,153,0.12))',
    '📖': 'linear-gradient(135deg, rgba(129,140,248,0.22), rgba(99,102,241,0.12))',
    '🚶': 'linear-gradient(135deg, rgba(56,189,248,0.22), rgba(14,165,233,0.12))',
    '💧': 'linear-gradient(135deg, rgba(96,165,250,0.22), rgba(59,130,246,0.12))',
    '✎': 'linear-gradient(135deg, rgba(251,191,36,0.22), rgba(245,158,11,0.12))',
    '🧘': 'linear-gradient(135deg, rgba(192,132,252,0.22), rgba(168,85,247,0.12))',
    '🏋️': 'linear-gradient(135deg, rgba(251,113,133,0.22), rgba(244,63,94,0.12))'
  };
  const iconBorders = {
    '◉': 'rgba(16,185,129,0.35)',
    '📖': 'rgba(129,140,248,0.35)',
    '🚶': 'rgba(56,189,248,0.35)',
    '💧': 'rgba(96,165,250,0.35)',
    '✎': 'rgba(251,191,36,0.35)',
    '🧘': 'rgba(192,132,252,0.35)',
    '🏋️': 'rgba(251,113,133,0.35)'
  };
  const ic = h.icon || '◉';
  const bg = iconGradients[ic] || 'linear-gradient(135deg, rgba(16,185,129,0.22), rgba(56,189,248,0.12))';
  const bd = iconBorders[ic] || 'rgba(16,185,129,0.3)';
  const daysText = h.frequency==='selected'?(h.days||[]).slice().sort((a,b)=>((a+6)%7)-((b+6)%7)).map(d=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(' · '):'Every day';
  const streak = habitStreak(h);
  return `<div class="habitrow">
    <div class="habiticon" style="background:${bg}!important;border-color:${bd}!important">${safe(ic)}</div>
    <div class="habitlabel">
      <b>${safe(h.name)}</b>
      <small>${daysText} · <span class="habit-streak">🔥 ${streak} day streak</span></small>
    </div>
    <button class="habitcheck ${done?'done':''}" data-hcheck="${h.id}" aria-pressed="${done}" aria-label="${done?'Undo check-in for ':'Check in '}${safe(h.name)}">${done?'✓':'+'}</button>
    <button class="textbtn" title="Edit habit" aria-label="Edit habit" data-edit-habit="${h.id}">✎</button>
    <button class="textbtn" title="Delete habit" aria-label="Delete habit" data-delete-habit="${h.id}">×</button>
  </div>`;
}
function wire(){ $$('[data-check]').forEach(b=>b.onchange=()=>{let t=s.tasks.find(t=>t.id===+b.dataset.check),old=t.status;t.status=b.checked?'done':'todo';save();render();toast(t.status==='done'?'Task completed.':'Task marked unfinished.',()=>t.status=old)});$$('[data-hcheck]').forEach(b=>b.onclick=()=>{let h=s.habits.find(h=>h.id===+b.dataset.hcheck);if(!h)return;h.history=habitHistory(h);let key=dayKey(),was=habitDone(h,key);h.history=was?h.history.filter(x=>x!==key):[...h.history,key];h.doneDate=was?'':key;save();render();toast(was?'Check-in undone.':'Habit checked in.')});$$('[data-edit-habit]').forEach(b=>b.onclick=()=>modal('habit',s.habits.find(h=>h.id===+b.dataset.editHabit)));$$('[data-delete-habit]').forEach(b=>b.onclick=()=>{let h=s.habits.find(h=>h.id===+b.dataset.deleteHabit);if(!h)return;inPageConfirm('Delete habit',`Delete habit “${h.name}”? Its check-in history will also be removed.`,()=>{s.habits=s.habits.filter(x=>x.id!==h.id);save();render();toast('Habit deleted.');},true);});$$('[data-edit-task]').forEach(b=>b.onclick=()=>modal('task',s.tasks.find(t=>t.id===+b.dataset.editTask)));$$('[data-delete-task]').forEach(b=>b.onclick=()=>{let i=s.tasks.findIndex(t=>t.id===+b.dataset.deleteTask);if(i<0)return;let removed=s.tasks.splice(i,1)[0];save();render();toast('Task deleted.',()=>s.tasks.splice(Math.min(i,s.tasks.length),0,removed))});$$('[data-go]').forEach(b=>b.onclick=()=>nav(b.dataset.go));$$('[data-add]').forEach(b=>b.onclick=()=>modal(b.dataset.add));}
function home(){let n=score();$('#scoreNum').textContent=n===null?'—':n+'%';$('#scoreRing').style.background=n===null?'var(--panel2)':`conic-gradient(var(--mint) 0 ${n}%,var(--panel2) ${n}% 100%)`;$('#scoreMood').textContent=n===null?'A fresh start.':n>=80?'A strong day.':n>=50?'A steady day.':'Room to reset.';$('#scoreDesc').textContent=n===null?'Add planned tasks to start tracking your day.':'Completed tasks weighted by priority.';(()=>{const up=s.tasks.filter(t=>t.status!=='done'&&(t.date==='tomorrow'||t.date==='later')).sort((a,b)=>(a.date==='tomorrow'?0:1)-(b.date==='tomorrow'?0:1));$('#dashUpcoming').innerHTML=up.slice(0,3).map(t=>taskRow(t)).join('')||'<div class="empty">No upcoming tasks. Plan ahead by adding one for tomorrow.</div>';$('#upcomingCount').textContent=up.length?(up.length>3?`Next 3 of ${up.length}`:`${up.length} upcoming`):'Nothing scheduled ahead'})();$('#dashTasks').innerHTML=todayTasks().slice(0,3).map(t=>taskRow(t)).join('')||'<div class="empty">Nothing planned for today. Add a task when you are ready.</div>';$('#taskCount').textContent=`${todayTasks().filter(t=>t.status==='done').length} of ${todayTasks().length} complete`;$('#dashHabits').innerHTML=s.habits.map(habitRow).join('')||'<div class="empty">Your habits will appear here.</div>';let schedH=s.habits.filter(habitScheduled),doneH=schedH.filter(h=>habitDone(h)).length;$('#habitCount').textContent=`${doneH} of ${schedH.length} complete`;$('#habitMetric').textContent=`${doneH} / ${schedH.length}`;let todayExpenses=s.transactions.filter(t=>t.type==='expense'&&transactionDate(t)===dayKey()),todayTotal=todayExpenses.reduce((a,t)=>a+(+t.amount||0),0);$('#dashTodayExpenses').textContent=money(todayTotal);$('#dashExpenseBreakdown').textContent=todayExpenses.length?Object.entries(todayExpenses.reduce((a,t)=>{let k=t.category||'Other';a[k]=(a[k]||0)+(+t.amount||0);return a},{})).map(([k,v])=>`${k}: ${money(v)}`).join(' · '):'No expenses recorded today.';let stToday=studyTodayMins();$('#studyToday').textContent=mins(stToday);let stTarget=studyTargetMins();$('#studyBar').style.width=Math.min(100,stToday/stTarget*100)+'%';$('#studyBarWrap').setAttribute('aria-valuenow',String(Math.min(100,Math.round(stToday/stTarget*100))));$('#studyTargetLabel').textContent='Target: '+dur(stTarget);$('#studyProgressText').textContent=studyProgressText(stToday,stTarget);wire();timerRender()}
function tasksPage(){let q=($('#taskSearch')?.value||'').toLowerCase(),pri=$('#taskPriority')?.value||'all',list=s.tasks.filter(t=>(t.title+' '+t.category).toLowerCase().includes(q)&&(pri==='all'||t.priority===pri));if(taskView==='status')$('#taskList').innerHTML=[['To do',list.filter(t=>t.status!=='done')],['Completed',list.filter(t=>t.status==='done')]].map(([n,a])=>`<div class="eyebrow task-group-heading">${n} · ${a.length}</div>${a.map(t=>taskRow(t,true)).join('')}`).join('');else if(taskView==='time')$('#taskList').innerHTML=[['Today',list.filter(t=>t.date==='today')],['Upcoming',list.filter(t=>t.date==='tomorrow'||t.date==='later')],['No date',list.filter(t=>t.date==='none')]].map(([n,a])=>`<div class="eyebrow task-group-heading">${n} · ${a.length}</div>${a.map(t=>taskRow(t,true)).join('')}`).join('');else $('#taskList').innerHTML=list.map(t=>taskRow(t,true)).join('')||'<div class="empty">No tasks match your search.</div>';wire()}
function habitsPage(){$('#habitList').innerHTML=s.habits.map(h=>habitRow(h,true)).join('')||'<div class="empty">Create a habit once. It will appear automatically on its scheduled days.</div>';let hs=habitStats();{let sc=s.habits.filter(habitScheduled);$('#habitMetric').textContent=`${sc.filter(h=>habitDone(h)).length} / ${sc.length}`}$('#habitStreakMetric').textContent=hs.best+' day'+(hs.best===1?'':'s');$('#habitCompletionMetric').textContent=hs.rate+'%';$('#routineList').innerHTML=s.routines.map(r=>{let steps=Array.isArray(r.steps)?r.steps:[];return `<div class="routine-block"><div class="head"><div><b>${safe(r.name)}</b><div class="rowsub">${steps.filter(x=>x.done).length} of ${steps.length} steps complete</div></div><div><button class="btn" data-routine-reset="${r.id}">Reset</button> <button class="textbtn" data-routine-delete="${r.id}" aria-label="Delete routine ${safe(r.name)}">Delete</button></div></div>${steps.map(x=>`<label class="checkline"><input type="checkbox" data-routine-step="${r.id}:${x.id}" ${x.done?'checked':''}> ${safe(x.text)}</label>`).join('')}</div>`}).join('')||'<div class="empty">Create a routine and add steps to build a repeatable sequence.</div>';wire();$$('[data-routine-step]').forEach(cb=>cb.onchange=()=>{let [rid,sid]=cb.dataset.routineStep.split(':').map(Number),r=s.routines.find(x=>x.id===rid),step=r?.steps?.find(x=>x.id===sid);if(step)step.done=cb.checked;save();habitsPage()});$$('[data-routine-reset]').forEach(b=>b.onclick=()=>{let r=s.routines.find(x=>x.id===+b.dataset.routineReset);if(!r)return;r.steps.forEach(x=>x.done=false);save();habitsPage()});$$('[data-routine-delete]').forEach(b=>b.onclick=()=>{let i=s.routines.findIndex(x=>x.id===+b.dataset.routineDelete);if(i<0)return;let removed=s.routines.splice(i,1)[0];save();habitsPage();toast('Routine deleted.',()=>s.routines.splice(Math.min(i,s.routines.length),0,removed))})}
function sessionRow(x){return `<div class="row"><div class="rowmain"><div class="rowtitle">${safe(x.subject||'No subject')}${x.topic?' · '+safe(x.topic):''}</div><div class="rowsub">${safe(sessionDateLabel(x.date))} · ${safe(x.type||'Study')}</div></div><span class="status active">${mins(x.minutes)}</span><button class="textbtn" data-del-session="${x.id}" aria-label="Delete session">×</button></div>`}
function studyPage(){
  let exam=$('#examSelect').value,ex=exam?s.exams.find(e=>e.name===exam):null;
  let topics=exam?s.syllabus.filter(t=>t.exam===exam):[],sess=exam?s.sessions.filter(x=>x.exam===exam):[];
  $('#examDays').textContent=ex&&ex.date?examDaysLeft(ex.date):'—';
  $('#studyWeek').textContent=mins(studyWeekMins());
  $('#sessionCount').textContent=s.sessions.length;
  $('#syllabusPercent').textContent=Math.round(topics.filter(t=>t.status==='Completed').length/Math.max(1,topics.length)*100)+'%';
  $('#syllabus').innerHTML=topics.map(t=>`<div class="row"><div class="rowmain"><div class="rowtitle">${safe(t.topic)}</div><div class="rowsub">${safe(t.subject)} · ${t.revisions} revisions</div></div><select data-topic="${t.id}" aria-label="Status of ${safe(t.topic)}">${['Not started','In progress','Completed'].map(v=>`<option ${t.status===v?'selected':''}>${v}</option>`).join('')}</select><button class="textbtn" data-revise="${t.id}" aria-label="Record a revision" title="Record a revision">↻</button><button class="textbtn" data-del-topic="${t.id}" aria-label="Delete topic" title="Delete topic">×</button></div>`).join('')||(exam?'<div class="empty">No topics yet. Add the first topic for this exam.</div>':'<div class="empty">Select or create an exam, then add syllabus topics.</div>');
  $('#studyRecent').innerHTML=sess.slice(0,5).map(sessionRow).join('')||`<div class="empty">${exam?'No sessions logged for this exam yet.':'Select or create an exam to see its sessions.'}</div>`;
  $('#addTopic').disabled=!exam;$('#editExam').disabled=!exam;$('#deleteExam').disabled=!exam;
  $$('[data-topic]').forEach(x=>x.onchange=()=>{let t=s.syllabus.find(t=>t.id===+x.dataset.topic);if(!t)return;t.status=x.value;save();studyPage()});
  $$('[data-revise]').forEach(x=>x.onclick=()=>{let t=s.syllabus.find(t=>t.id===+x.dataset.revise);if(!t)return;t.revisions++;save();studyPage();toast('Revision recorded.')});
  $$('[data-del-topic]').forEach(x=>x.onclick=()=>{let i=s.syllabus.findIndex(t=>t.id===+x.dataset.delTopic);if(i<0)return;let removed=s.syllabus.splice(i,1)[0];save();studyPage();toast('Topic deleted.',()=>s.syllabus.splice(Math.min(i,s.syllabus.length),0,removed))});
  (()=>{const tg=studyTargetMins(),H=$('#targetH'),M=$('#targetM');$('#targetDisplay').textContent=hm(tg);$('#targetSummary').textContent=studyProgressText(studyTodayMins(),tg);if(document.activeElement!==H&&document.activeElement!==M){H.value=Math.floor(tg/60);M.value=tg%60}
    $('#saveTarget').onclick=()=>{const h=Math.floor(Number(H.value||0)),m=Math.floor(Number(M.value||0)),total=h*60+m;if(!Number.isFinite(total)||h<0||m<0||m>59||total<5||total>1440){toast('Enter a target between 5 minutes and 24 hours.');return}prefs.studyTargetMins=total;save();render();toast('Daily target saved.')}})();
  wireSessions();
}
function wireSessions(){$$('[data-del-session]').forEach(b=>b.onclick=()=>{let i=s.sessions.findIndex(x=>x.id===+b.dataset.delSession);if(i<0)return;let old=s.sessions.splice(i,1)[0];save();render();toast('Session deleted.',()=>{s.sessions.splice(Math.min(i,s.sessions.length),0,old)})})}
function focusPage(){ $('#focusHistory').innerHTML=s.sessions.map(sessionRow).join('')||'<div class="empty">No sessions logged yet.</div>';wireSessions();timerRender()}
function notesPage(){let q=($('#noteSearch')?.value||'').toLowerCase(),arr=[...s.notes].sort((a,b)=>+b.pinned-+a.pinned).filter(n=>(n.title+' '+n.body+' '+n.category).toLowerCase().includes(q));$('#notesGrid').innerHTML=arr.map(n=>`<article class="notecard"><div class="head head-tight"><span class="pill">${safe(n.category)}</span>${n.pinned?'<span class="pill pinned-pill">📌 Pinned</span>':''}</div><h3 class="note-title"><button class="note-open" data-edit-note="${n.id}" aria-label="Open note ${safe(n.title)}">${safe(n.title)}</button></h3><footer class="note-actions"><button class="textbtn" data-edit-note="${n.id}" aria-label="Edit note ${safe(n.title)}">Edit</button><button class="textbtn" data-pin-note="${n.id}" aria-label="${n.pinned?'Unpin':'Pin'} note ${safe(n.title)}">${n.pinned?'Unpin':'Pin'}</button><button class="textbtn note-delete" data-delete-note="${n.id}" aria-label="Delete note ${safe(n.title)}">Delete</button></footer></article>`).join('')||'<div class="empty">No notes match your search.</div>';$$('[data-edit-note]').forEach(b=>b.onclick=()=>modal('note',s.notes.find(n=>n.id===+b.dataset.editNote)));$$('[data-pin-note]').forEach(b=>b.onclick=()=>{let n=s.notes.find(n=>n.id===+b.dataset.pinNote);if(!n)return;n.pinned=!n.pinned;save();notesPage()});$$('[data-delete-note]').forEach(b=>b.onclick=()=>{let i=s.notes.findIndex(n=>n.id===+b.dataset.deleteNote);if(i<0)return;let removed=s.notes.splice(i,1)[0];save();notesPage();toast('Note deleted.',()=>s.notes.splice(Math.min(i,s.notes.length),0,removed))})}
function transactionDate(t){let raw=String(t.date||'').trim();if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;let parsed=new Date(raw);if(!Number.isNaN(parsed.getTime())){if(!/\b\d{4}\b/.test(raw))parsed.setFullYear(new Date().getFullYear());return dayKey(parsed)}let m=raw.match(/^(\d{1,2})\s+([A-Za-z]{3,})$/);if(m){let parsed2=new Date(`${m[2]} ${m[1]}, ${new Date().getFullYear()} 12:00:00`);if(!Number.isNaN(parsed2.getTime()))return dayKey(parsed2)}return ''}function budgetCycleStart(dateKey,resetDay=prefs.budgetResetDay||1){if(!dateKey||!/^\d{4}-\d{2}-\d{2}$/.test(dateKey))return '';let d=new Date(dateKey+'T12:00:00');if(Number.isNaN(d.getTime()))return '';if(d.getDate()<resetDay)d.setMonth(d.getMonth()-1);d.setDate(resetDay);return dayKey(d)}function transactionCycle(t){return budgetCycleStart(transactionDate(t))}function cycleLabel(startKey){let start=new Date(startKey+'T12:00:00'),end=new Date(start);end.setMonth(end.getMonth()+1);end.setDate((prefs.budgetResetDay||1)-1);let a=start.toLocaleDateString('en-IN',{day:'numeric',month:'short'}),b=end.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});return a+' – '+b}function inCurrentBudgetCycle(t){let d=transactionDate(t);return d&&budgetCycleStart(d)===budgetCycleStart(dayKey())}function financePage(){let monthly=s.transactions.filter(inCurrentBudgetCycle),inc=monthly.filter(t=>t.type==='income').reduce((a,t)=>a+(+t.amount||0),0),exp=monthly.filter(t=>t.type==='expense').reduce((a,t)=>a+(+t.amount||0),0);$('#income').textContent=money(inc);$('#expenses').textContent=money(exp);$('#savings').textContent=money(inc-exp);let investmentValue=s.investments.reduce((a,x)=>a+(+x.currentValue||0),0),otherAssets=s.assets.reduce((a,x)=>a+(+x.value||0),0),assets=otherAssets+investmentValue,liabs=s.liabilities.reduce((a,x)=>a+(+x.amount||0),0);$('#totalAssets').textContent=money(assets);$('#totalLiabilities').textContent=money(liabs);$('#netWorth').textContent=money(assets-liabs);let curKey=budgetCycleStart(dayKey()),monthKeys=[...new Set([curKey,...s.transactions.map(t=>transactionCycle(t)||'undated')])].sort().reverse().sort((a,b)=>(a==='undated')-(b==='undated')),selKey=monthKeys.includes(financeMonth)?financeMonth:curKey;$('#txnMonth').innerHTML=monthKeys.map(k=>`<option value="${k}" ${k===selKey?'selected':''}>${k==='undated'?'Undated':cycleLabel(k)}</option>`).join('');$('#txnMonth').onchange=()=>{financeMonth=$('#txnMonth').value;financePage()};let shown=s.transactions.filter(t=>(transactionCycle(t)||'undated')===selKey);$('#transactions').innerHTML=[...shown].reverse().map(t=>`<div class="row is-editable-row" data-edit-txn="${t.id}" role="button" tabindex="0" aria-label="Edit transaction ${safe(t.title)}" ><div class="rowmain"><div class="rowtitle">${safe(t.title)}</div><div class="rowsub">${safe(t.category)} · ${safe(t.date)}</div></div><b class="amount-nowrap" style="color:var(--${t.type==='income'?'mint':'coral'})">${t.type==='income'?'+':'−'}${money(t.amount)}</b><button class="textbtn" data-del-txn="${t.id}" aria-label="Delete transaction ${safe(t.title)}">×</button></div>`).join('')||'<div class="empty">No transactions for this cycle.</div>';$('#budgets').innerHTML=s.budgets.map(b=>{let used=monthly.filter(t=>t.type==='expense'&&String(t.category||'').trim().toLowerCase()===String(b.name||'').trim().toLowerCase()).reduce((a,t)=>a+(+t.amount||0),0);b.used=used;return `<div data-edit-budget="${safe(b.name)}" role="button" tabindex="0" class="budget-row"><div class="head head-budget"><span>${safe(b.name)}</span><span><span class="small muted">${money(used)} / ${money(b.total||0)}</span> <button class="textbtn" data-del-budget="${safe(b.name)}" aria-label="Delete budget ${safe(b.name)}">×</button></span></div><div class="bar"><div style="width:${b.total?Math.min(100,used/b.total*100):0}%;background:${b.total&&used/b.total>.9?'var(--coral)':'var(--mint)'}"></div></div><div class="tiny muted u-mt-5">${money(Math.max(0,(+b.total||0)-used))} remaining</div></div>`}).join('')||'<div class="empty">No budgets yet. Add one to start tracking spending.</div>';$('#assets').innerHTML=s.assets.map(x=>`<div class="row is-editable-row" data-edit-asset="${x.id}" role="button" tabindex="0" ><div class="rowmain"><div class="rowtitle">${safe(x.name)}</div><div class="rowsub">${safe(x.type||'Asset')}</div></div><b>${money(x.value)}</b><button class="textbtn" data-del-asset="${x.id}" aria-label="Delete asset">×</button></div>`).join('')||'<div class="empty">Add cash, bank balances or other assets to calculate net worth.</div>';$$('[data-del-asset]').forEach(b=>b.onclick=()=>{s.assets=s.assets.filter(x=>x.id!==+b.dataset.delAsset);save();financePage()});$('#investments').innerHTML=s.investments.map(x=>`<div class="row is-editable-row" data-edit-invest="${x.id}" role="button" tabindex="0" ><div class="rowmain"><div class="rowtitle">${safe(x.name)}</div><div class="rowsub">${safe(x.type)} · Invested ${money(x.invested)} · ${x.units?safe(x.units)+' units · ':''}${safe(x.date||'No date')}</div></div><div class="text-right"><b>${money(x.currentValue)}</b><div class="rowsub" style="color:var(--${x.currentValue>=x.invested?'mint':'coral'})">${money(x.currentValue-x.invested)} (${x.invested?((x.currentValue-x.invested)/x.invested*100).toFixed(1):'0.0'}%)</div></div><button class="textbtn" data-del-invest="${x.id}" aria-label="Delete investment ${safe(x.name)}">×</button></div>`).join('')||'<div class="empty">No investments recorded yet.</div>';$('#liabilities').innerHTML=s.liabilities.map(x=>`<div class="row is-editable-row" data-edit-liability="${x.id}" role="button" tabindex="0" ><div class="rowmain"><div class="rowtitle">${safe(x.name)}</div><div class="rowsub">${safe(x.type||'Liability')}</div></div><b>${money(x.amount)}</b><button class="textbtn" data-del-liability="${x.id}" aria-label="Delete liability">×</button></div>`).join('')||'<div class="empty">No liabilities recorded.</div>';$$('[data-del-liability]').forEach(b=>b.onclick=()=>{s.liabilities=s.liabilities.filter(x=>x.id!==+b.dataset.delLiability);save();financePage()});
  const undoable=(list,find,label)=>{let i=s[list].findIndex(find);if(i<0)return;let removed=s[list].splice(i,1)[0];save();financePage();toast(label+' deleted.',()=>s[list].splice(Math.min(i,s[list].length),0,removed))};
  $$('[data-edit-txn]').forEach(row=>{const open=()=>{const txn=s.transactions.find(x=>String(x.id)===row.dataset.editTxn);if(txn)modal('expense',txn)};row.onclick=e=>{if(e.target.closest('[data-del-txn]'))return;open()};row.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target===row){e.preventDefault();open()}}});$$('[data-del-txn]').forEach(b=>b.onclick=e=>{e.stopPropagation();undoable('transactions',x=>String(x.id)===b.dataset.delTxn,'Transaction')});
  $$('[data-del-budget]').forEach(b=>b.onclick=()=>undoable('budgets',x=>x.name===b.dataset.delBudget,'Budget'));
  $$('[data-del-invest]').forEach(b=>b.onclick=e=>{e.stopPropagation();undoable('investments',x=>String(x.id)===b.dataset.delInvest,'Investment')});
  const bindRows=(selector,list,type,del)=>$$(selector).forEach(row=>{const key=Object.keys(row.dataset).find(k=>k.startsWith('edit'));const open=()=>{const item=s[list].find(x=>String(x.id)===row.dataset[key]);if(item)modal(type,item)};row.onclick=e=>{if(e.target.closest(del))return;open()};row.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target===row){e.preventDefault();open()}}});
  bindRows('[data-edit-asset]','assets','asset','[data-del-asset]');
  bindRows('[data-edit-invest]','investments','investment','[data-del-invest]');
  bindRows('[data-edit-liability]','liabilities','liability','[data-del-liability]');
  $$('[data-edit-budget]').forEach(row=>{const open=()=>{const item=s.budgets.find(x=>x.name===row.dataset.editBudget);if(item)modal('budget',item)};row.onclick=e=>{if(e.target.closest('[data-del-budget]'))return;open()};row.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target===row){e.preventDefault();open()}}});}
function libraryPage(){let q=($('#librarySearch')?.value||'').toLowerCase(),st=$('#libraryStatus').value,ty=$('#libraryType').value,arr=s.resources.filter(r=>(st==='all'||r.status===st)&&(ty==='all'||r.type===ty)&&(r.title+' '+r.author+' '+r.type).toLowerCase().includes(q)).sort((a,b)=>+b.pinned-+a.pinned);$('#readingCount').textContent=s.resources.filter(r=>r.status==='Reading').length;$('#wantCount').textContent=s.resources.filter(r=>r.status==='Want to Read').length;$('#completedCount').textContent=s.resources.filter(r=>r.status==='Completed').length;$('#booksGrid').style.gridTemplateColumns=bookView==='cards'?'':'1fr';$('#booksGrid').innerHTML=arr.map(r=>bookView==='cards'?`<article class="bookcard"><div class="cover">${safe(r.title)}</div><div class="head head-tight"><span class="pill">${safe(r.type)}</span><button class="textbtn" data-edit-resource="${r.id}" aria-label="Edit resource" title="Edit resource">✎</button><button class="textbtn" data-delete-resource="${r.id}" title="Delete resource">×</button></div><h3>${r.pinned?'📌 ':''}${safe(r.title)}</h3><div class="tiny muted">${safe(r.author)}</div><div class="head head-tight"><span class="status ${r.status==='Completed'?'done':''}">${safe(r.status)}</span><span>${r.rating?'★'.repeat(r.rating):''}</span></div><select data-rstatus="${r.id}">${['Want to Read','Not started','Reading','Completed'].map(v=>`<option ${r.status===v?'selected':''}>${v}</option>`).join('')}</select></article>`:`<div class="row"><div class="rowmain"><div class="rowtitle">${r.pinned?'📌 ':''}${safe(r.title)}</div><div class="rowsub">${safe(r.author)} · ${safe(r.type)}</div></div><select data-rstatus="${r.id}">${['Want to Read','Not started','Reading','Completed'].map(v=>`<option ${r.status===v?'selected':''}>${v}</option>`).join('')}</select><button class="textbtn" data-edit-resource="${r.id}" title="Edit resource">✎</button><button class="textbtn" data-delete-resource="${r.id}" title="Delete resource">×</button></div>`).join('')||'<div class="empty">No resources match. <button class="linkbtn" data-add="resource">＋ Add your first resource</button></div>';$$('[data-rstatus]').forEach(x=>x.onchange=()=>{s.resources.find(r=>r.id===+x.dataset.rstatus).status=x.value;save();libraryPage();toast('Reading status updated.')});$$('[data-edit-resource]').forEach(b=>b.onclick=()=>modal('resource',s.resources.find(r=>r.id===+b.dataset.editResource)));$$('[data-delete-resource]').forEach(b=>b.onclick=()=>{let r=s.resources.find(r=>r.id===+b.dataset.deleteResource);if(!r)return;inPageConfirm('Delete resource',`Delete “${r.title}” from your library?`,()=>{s.resources=s.resources.filter(x=>x.id!==r.id);save();libraryPage();toast('Resource deleted.');},true);})}
function renderProjectCards(){
  const grid=$('#projectGrid');
  if(!grid)return;
  grid.replaceChildren();
  if(!s.projects.length){
    const empty=document.createElement('div');empty.className='empty';empty.textContent='No projects yet. Add a project to track a small piece of work.';
    grid.append(empty);return;
  }
  s.projects.forEach(project=>{
    const card=document.createElement('article');card.className='module goal-card';
    const heading=document.createElement('div');heading.className='head';
    const title=document.createElement('b');title.textContent=project.title;
    const remove=document.createElement('button');remove.type='button';remove.className='textbtn';remove.textContent='Delete';remove.setAttribute('aria-label','Delete project '+project.title);
    heading.append(title,remove);
    const detail=document.createElement('div');detail.className='rowsub';detail.textContent=(project.status||'Not started')+' · '+(project.done||0)+' of '+(project.tasks||0)+' linked tasks';
    card.append(heading,detail);grid.append(card);
    remove.onclick=()=>{
      const index=s.projects.findIndex(item=>item.id===project.id);if(index<0)return;
      const removed=s.projects.splice(index,1)[0];save();renderProjectCards();
      toast('Project deleted.',()=>{s.projects.splice(Math.min(index,s.projects.length),0,removed);save();renderProjectCards()});
    };
  });
}function projectsPage(){renderProjectCards();let active=s.goals.filter(g=>g.status!=='Completed').length;$('#goalTotal').textContent=s.goals.length;$('#goalCount').textContent=active;$('#goalGrid').innerHTML=s.goals.map(g=>{let subs=g.subgoals||[],done=subs.filter(x=>x.done).length,pct=subs.length?Math.round(done/subs.length*100):0;return `<article class="module goal-card" data-open-goal="${g.id}" tabindex="0"><div class="moduleicon">${g.area==='Studies'?'▤':g.area==='Health'?'◉':'◇'}</div><b>${safe(g.title)}</b><p>${safe(g.desc||'No description added yet.')}</p>${subs.length?`<div class="bar"><div style="width:${pct}%"></div></div><div class="tiny muted">${done} of ${subs.length} sub-goals · ${pct}%</div>`:'<div class="tiny muted">No sub-goals added</div>'}<div class="modulefoot"><span>${safe(g.area)}${g.date?' · '+safe(g.date):' · No target date'}</span><span>${safe(g.status)}</span></div></article>`}).join('')||'<div class="empty">Your long-term goals will appear here. Create your first goal when you are ready.</div>';$$('[data-open-goal]').forEach(el=>{let open=()=>openGoal(+el.dataset.openGoal);el.onclick=open;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}})}
function openGoal(id){let g=s.goals.find(x=>x.id===id);if(!g)return;let subs=g.subgoals||[],done=subs.filter(x=>x.done).length,pct=subs.length?Math.round(done/subs.length*100):0;$('#modalTitle').textContent=g.title;$('#modalBody').innerHTML=`<div class="form"><div class="pill">${safe(g.area)} · ${safe(g.status)}</div><p>${safe(g.desc||'No description added.')}</p><div class="small muted">Target: ${safe(g.date||'No target date')}</div><div class="bar"><div style="width:${pct}%"></div></div><b>${pct}% progress</b><div class="field"><label>Sub-goals</label>${subs.length?subs.map(x=>`<label class="checkline"><input type="checkbox" data-goal-sub="${x.id}" ${x.done?'checked':''}> ${safe(x.text)}</label>`).join(''):'<p class="tiny muted">No sub-goals for this goal.</p>'}</div><div class="field"><label>Timeline</label>${(g.timeline||[]).map(x=>`<div class="rowsub">${safe(new Date(x.date).toLocaleDateString())} · ${safe(x.text)}</div>`).join('')||'<div class="rowsub">Goal created</div>'}</div><div class="field"><label>Goal status</label><select id="goalStatus"><option ${g.status==='Not started'?'selected':''}>Not started</option><option ${g.status==='Active'?'selected':''}>Active</option><option ${g.status==='Ongoing'?'selected':''}>Ongoing</option><option ${g.status==='Completed'?'selected':''}>Completed</option></select></div><div class="goal-actions"><button class="btn" id="editGoal">Edit goal details</button><button class="btn danger-btn" id="deleteGoal">Delete goal</button></div></div>`;$('#modalSave').textContent='Done';bindModalClose();showModal();$('#modalSave').onclick=()=>{closeModal();save();render()};$$('[data-goal-sub]').forEach(cb=>cb.onchange=()=>{let sub=g.subgoals.find(x=>x.id===+cb.dataset.goalSub);sub.done=cb.checked;g.timeline=g.timeline||[];g.timeline.unshift({date:new Date().toISOString(),text:(cb.checked?'Completed: ':'Reopened: ')+sub.text});save();openGoal(id)});$('#goalStatus').onchange=e=>{g.status=e.target.value;g.timeline=g.timeline||[];g.timeline.unshift({date:new Date().toISOString(),text:'Goal marked '+g.status.toLowerCase()});save();openGoal(id)};$('#editGoal').onclick=()=>modal('goal',g);$('#deleteGoal').onclick=()=>{inPageConfirm('Delete goal',`Delete goal “${g.title}”? Its sub-goals and timeline will also be removed.`,()=>{let i=s.goals.findIndex(x=>x.id===g.id);if(i<0)return;let removed=s.goals.splice(i,1)[0];closeModal();save();render();toast('Goal deleted.',()=>s.goals.splice(Math.min(i,s.goals.length),0,removed));},true);}}
function calendarPage(){
  let d=new Date(),start=new Date(d);start.setHours(12,0,0,0);start.setDate(d.getDate()-((d.getDay()+6)%7)+weekOffset*7);
  $('#calendarTitle').textContent=`${dateLabel(start)} — ${dateLabel(addDays(6,start))}`;
  let today=dayKey(),html='';
  for(let i=0;i<7;i++){
    let day=addDays(i,start),key=dayKey(day),list=s.tasks.filter(t=>t.due===key);
    html+=`<div class="eyebrow task-group-heading">${safe(dateLabel(day))}${key===today?' · Today':''} · ${list.length}</div>`+(list.length?list.map(t=>`<div class="row"><div class="rowmain"><div class="rowtitle">${safe(t.title)}</div><div class="rowsub">${safe(t.priority)} priority · ${safe(t.category)}</div></div><span class="status ${t.status==='done'?'done':'active'}">${t.status==='done'?'Completed':'Planned'}</span></div>`).join(''):'<div class="rowsub calendar-empty">Nothing planned</div>');
  }
  $('#calendarList').innerHTML=html;
}
function timerSeconds(){let t=s.timer;if(t.running&&t.startedAt){let e=Math.floor((Date.now()-t.startedAt)/1000);return t.mode==='countdown'?Math.max(0,t.remaining-e):t.remaining+e}return t.remaining}
function timerRender(){ensureTick();let t=s.timer,txt=fmtsec(timerSeconds());$('#miniTime').textContent=txt;$('#fullTime').textContent=txt;$('#timerStatus').textContent=t.running?'Session in progress':t.paused?'Session paused':'Ready when you are';$('#focusState').textContent=t.running?'Running':t.paused?'Paused':'Ready';$('#focusModeText').textContent=t.mode==='countdown'?`Countdown · ${Math.round(t.duration/60)} minutes`:'Open-ended stopwatch';$('#fullCaption').textContent=t.mode==='countdown'?'FOCUS SESSION':'STOPWATCH';$('#startTimer').textContent=t.running?'Running':t.paused?'Resume':'Start focus';$('#startTimer').disabled=t.running;$('#pauseTimer').disabled=!t.running;$('#finishTimer').disabled=!(t.running||t.paused);$('#timerTopicLabel').textContent=$('#timerTopic').value?`${$('#timerSubject').value} · ${$('#timerTopic').value}`:'No topic linked · optional';$('#miniStart').textContent=t.running?'Running':t.paused?'Resume':'Start';$('#miniStart').disabled=t.running;$('#miniStop').disabled=!t.running;$('#miniFinish').disabled=!(t.running||t.paused)}
function timerTick(){if(!s.timer.running){clearInterval(tick);tick=null;return}timerRender();if(s.timer.mode==='countdown'&&timerSeconds()<=0)timerComplete()}
function ensureTick(){if(tick||!s.timer.running)return;tick=setInterval(timerTick,500)}
function timerStart(){let t=s.timer;if(t.running)return;if(t.mode==='countdown'&&t.remaining<=0)t.remaining=t.duration;t.startedAt=Date.now();t.running=true;t.paused=false;save();timerRender()}
function logFocusSession(sec){let m=Math.max(1,Math.round(sec/60));s.sessions.unshift({id:newRecordId(),subject:$('#timerSubject').value,topic:$('#timerTopic').value,date:dayKey(),minutes:m,type:'Study',exam:$('#examSelect').value});return m}
function timerComplete(){let t=s.timer;if(!t.running)return;clearInterval(tick);tick=null;let m=logFocusSession(t.duration);timerReset();render();toast(`Focus session complete · ${mins(m)} saved`)}
function timerPause(){let t=s.timer;if(!t.running)return;let e=Math.floor((Date.now()-t.startedAt)/1000);t.remaining=t.mode==='countdown'?Math.max(0,t.remaining-e):t.remaining+e;t.running=false;t.paused=true;t.startedAt=null;save();timerRender()}
function timerReset(){let t=s.timer;t.running=false;t.paused=false;t.startedAt=null;t.remaining=t.duration;save();timerRender()}
function timerFinish(){let t=s.timer;if(!(t.running||t.paused))return;let el=t.running?Math.floor((Date.now()-t.startedAt)/1000):0,sec=t.mode==='countdown'?Math.max(0,t.duration-t.remaining+el):t.remaining+el;let m=logFocusSession(sec);timerReset();render();toast(`Session saved · ${mins(m)}`)}
function modal(type,item=null){let title='',body='',saveText='Save',submit=null, v=k=>safe(item?.[k]??'');if(type==='quick'){title='Quick add';body=`<div class="form"><div class="field"><label>What would you like to add?</label><select id="fType"><option value="task">Task</option><option value="note">Note</option><option value="expense">Expense</option><option value="study">Study session</option><option value="habit">Habit entry</option></select></div><div class="tiny muted">Choose a type to open a compact form.</div></div>`;saveText='Continue';submit=()=>{modal($('#fType').value)}}
else if(type==='task'){title=item?'Edit task':'New task';let dsel=!item?'today':(item.date==='later'?'date':(item.date||'none'));body=`<div class="form"><div class="field"><label>Task</label><input id="fTitle" maxlength="140" value="${v('title')}" placeholder="What needs doing?"></div><div class="formrow"><div class="field"><label>When?</label><select id="fDate"><option value="today" ${dsel==='today'?'selected':''}>Today</option><option value="tomorrow" ${dsel==='tomorrow'?'selected':''}>Tomorrow</option><option value="date" ${dsel==='date'?'selected':''}>Pick a date…</option><option value="none" ${dsel==='none'?'selected':''}>No date</option></select><input id="fDue" type="date" min="${dayKey()}" value="${dsel==='date'?v('due'):''}" class="due-date-input" style="display:${dsel==='date'?'block':'none'}" aria-label="Due date"></div><div class="field"><label>Priority</label><select id="fPriority">${['High','Medium','Low'].map(x=>`<option ${v('priority')===x||(!item&&x==='Medium')?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="formrow"><div class="field"><label>Category</label><select id="fCategory">${['Study','Personal','Health','Work','Projects'].map(x=>`<option ${v('category')===x||(!item&&x==='Study')?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Estimate in minutes (optional)</label><input id="fEstimate" type="number" min="0" max="1440" value="${v('estimate')}" placeholder="e.g. 30"></div></div></div>`;submit=()=>{let title=$('#fTitle').value.trim();if(!title){$('#fTitle').focus();return false}let sel=$('#fDate').value,due='',dt=sel;if(sel==='today')due=dayKey();else if(sel==='tomorrow')due=dayKey(addDays(1));else if(sel==='date'){due=$('#fDue').value;if(!dayRe.test(due)||due<dayKey()){toast('Pick a due date from today onwards.');return false}dt='later'}
let data={title,date:dt,due,priority:$('#fPriority').value,category:$('#fCategory').value,estimate:+$('#fEstimate').value||0};if(item)Object.assign(item,data);else s.tasks.unshift({id:newRecordId(),...data,status:'todo'});return true}}
else if(type==='note'){title=item?'Edit note':'New note';body=`<div class="form"><div class="field"><label>Title</label><input id="fTitle" value="${v('title')}" placeholder="A thought to keep"></div><div class="field"><label>Note</label><textarea id="fBody" placeholder="Write freely…">${v('body')}</textarea></div><div class="field"><label>Category</label><select id="fCategory">${['Personal','Study','Writing','Other'].map(x=>`<option ${v('category')===x||(!item&&x==='Personal')?'selected':''}>${x}</option>`).join('')}</select></div><label class="small"><input type="checkbox" id="fPin" ${item?.pinned?'checked':''}> Pin this note</label></div>`;submit=()=>{let title=$('#fTitle').value.trim();if(!title)return false;let data={title,body:$('#fBody').value,category:$('#fCategory').value,pinned:$('#fPin').checked};if(item)Object.assign(item,data);else s.notes.unshift({id:newRecordId(),...data});return true}}
else if(type==='expense'){title=item?'Edit transaction':'Add transaction';body=`<div class="form"><div class="field"><label>Type</label><select id="fType"><option value="expense" ${item?.type==='expense'?'selected':''}>Expense</option><option value="income" ${item?.type==='income'?'selected':''}>Income</option></select></div><div class="field"><label>Description</label><input id="fTitle" value="${v('title')}" placeholder="e.g. Books, allowance"></div><div class="formrow"><div class="field"><label>Amount (₹)</label><input id="fAmount" type="number" min="0.01" step="0.01" value="${v('amount')}" placeholder="0"></div><div class="field"><label>Category</label><select id="fCategory">${['Living','Study','Health','Personal','Income','Investment','Other'].map(x=>`<option ${item?.category===x?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="field"><label>Date</label><input id="fTxnDate" type="date" value="${item?safe(transactionDate(item)):dayKey()}"></div></div>`;submit=()=>{let title=$('#fTitle').value.trim(),amount=Number($('#fAmount').value),date=$('#fTxnDate').value;if(!title||!Number.isFinite(amount)||amount<=0||!dayRe.test(date)){toast('Enter a description, valid amount and date.');return false}let data={title,amount,type:$('#fType').value,category:$('#fCategory').value,date};if(item)Object.assign(item,data);else s.transactions.push({id:newRecordId(),...data});return true}}
else if(type==='study'){title='Log study session';body=`<div class="form"><div class="field"><label>Subject</label><select id="fSubject">${subjectOptions(item?.subject||'')}</select></div><div class="field"><label>Topic (optional)</label><input id="fTopic" placeholder="What did you study?"></div><div class="formrow"><div class="field"><label>Duration (minutes)</label><input id="fMinutes" type="number" min="1" max="1440" value="45"></div><div class="field"><label>Session type</label><select id="fSessionType">${['Reading','Lecture','Practice/Test','Revision','Other'].map(x=>`<option>${x}</option>`).join('')}</select></div></div><div class="tiny muted">Date: today · Backdating is part of the full version.</div></div>`;submit=()=>{let m=+$('#fMinutes').value;if(m<=0||m>1440)return false;s.sessions.unshift({id:newRecordId(),subject:$('#fSubject').value,topic:$('#fTopic').value.trim(),minutes:m,date:dayKey(),type:$('#fSessionType').value,exam:$('#examSelect').value});return true}}
else if(type==='habit'){title=item?'Edit habit':'New habit';let daysOrder=[1,2,3,4,5,6,0],dayNames=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];body=`<div class="form"><div class="field"><label>Habit name</label><input id="fTitle" value="${v('name')}" placeholder="e.g. Stretch for five minutes"></div><div class="field"><label>Icon</label><select id="fIcon">${['◉','📖','🚶','💧','✎','🧘','🏋️'].map(x=>`<option ${item?.icon===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Repeat</label><select id="fFrequency"><option value="daily" ${!item||item.frequency!=='selected'?'selected':''}>Every day</option><option value="selected" ${item?.frequency==='selected'?'selected':''}>Selected days</option></select></div><div class="field" id="habitDays" style="display:${item?.frequency==='selected'?'block':'none'}"><label>Choose days (Monday first)</label><div class="daychoices">${daysOrder.map((d,i)=>`<label><input type="checkbox" value="${d}" class="fDay" ${(item?.days||[]).includes(d)?'checked':''}> ${dayNames[i]}</label>`).join('')}</div></div></div>`;setTimeout(()=>{let f=$('#fFrequency');f.onchange=()=>$('#habitDays').style.display=f.value==='selected'?'block':'none'},0);submit=()=>{let name=$('#fTitle').value.trim();if(!name)return false;let frequency=$('#fFrequency').value,days=$$('.fDay:checked').map(x=>+x.value);if(frequency==='selected'&&!days.length){toast('Choose at least one day.');return false}let data={name,icon:$('#fIcon').value,frequency,days:frequency==='selected'?days:[],history:habitHistory(item||{}),doneDate:item?.doneDate||''};if(item)Object.assign(item,data);else s.habits.push({id:newRecordId(),...data,streak:0});return true}}
else if(type==='resource'){title=item?'Edit resource':'Add library resource';body=`<div class="form"><div class="field"><label>Title</label><input id="fTitle" value="${v('title')}" placeholder="Resource title"></div><div class="field"><label>Author (optional)</label><input id="fAuthor" value="${v('author')}" placeholder="Author or source"></div><div class="formrow"><div class="field"><label>Type</label><select id="fType">${['Books','Articles','Research Papers','PDFs','Websites','Other'].map(x=>`<option ${v('type')===x||(!item&&x==='Books')?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Status</label><select id="fStatus">${['Want to Read','Not started','Reading','Completed'].map(x=>`<option ${v('status')===x||(!item&&x==='Want to Read')?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="field"><label>Rating (optional)</label><select id="fRating"><option value="">No rating</option>${[1,2,3,4,5].map(n=>`<option value="${n}" ${item?.rating===n?'selected':''}>${n} / 5</option>`).join('')}</select></div></div>`;submit=()=>{let title=$('#fTitle').value.trim();if(!title)return false;let data={title,author:$('#fAuthor').value.trim(),type:$('#fType').value,status:$('#fStatus').value,rating:+$('#fRating').value||null,pinned:item?.pinned||false};if(item)Object.assign(item,data);else s.resources.unshift({id:newRecordId(),...data});return true}}
else if(type==='asset'){title=item?'Edit asset or account':'Add asset or account';body='<div class="form"><div class="field"><label>Name</label><input id="fTitle" value="'+v('name')+'" placeholder="e.g. Savings account"></div><div class="field"><label>Type</label><select id="fType">'+['Cash','Bank account','Savings','Property','Other'].map(x=>'<option '+((item?.type||'Cash')===x?'selected':'')+'>'+x+'</option>').join('')+'</select></div><div class="field"><label>Current value (₹)</label><input id="fAmount" type="number" min="0" step="0.01" value="'+v('value')+'"></div></div>';submit=()=>{let name=$('#fTitle').value.trim(),value=Number($('#fAmount').value);if(!name||!Number.isFinite(value)||value<0){toast('Enter a name and valid non-negative value.');return false}let data={name,type:$('#fType').value,value};if(item)Object.assign(item,data);else s.assets.push({id:newRecordId(),...data});return true}}
else if(type==='investment'){title=item?'Edit investment record':'Add investment record';body='<div class="form"><div class="field"><label>Investment name</label><input id="fTitle" value="'+v('name')+'" placeholder="e.g. Nifty 50 index fund"></div><div class="formrow"><div class="field"><label>Type</label><select id="fType">'+['Mutual fund','SIP','Stock','ETF','Fixed deposit','Other'].map(x=>'<option '+((item?.type||'Mutual fund')===x?'selected':'')+'>'+x+'</option>').join('')+'</select></div><div class="field"><label>Units / quantity (optional)</label><input id="fUnits" value="'+v('units')+'" placeholder="e.g. 12.5"></div></div><div class="formrow"><div class="field"><label>Amount invested (₹)</label><input id="fInvested" type="number" min="0" step="0.01" value="'+v('invested')+'" required></div><div class="field"><label>Current value (₹)</label><input id="fCurrent" type="number" min="0" step="0.01" value="'+v('currentValue')+'" required></div></div><div class="field"><label>Date (optional)</label><input id="fDate" type="date" value="'+v('date')+'"></div></div>';submit=()=>{let name=$('#fTitle').value.trim(),invested=Number($('#fInvested').value),currentValue=Number($('#fCurrent').value);if(!name||!Number.isFinite(invested)||!Number.isFinite(currentValue)||invested<0||currentValue<0){toast('Enter a name and valid non-negative amounts.');return false}let data={name,type:$('#fType').value,units:$('#fUnits').value.trim(),invested,currentValue,date:$('#fDate').value};if(item)Object.assign(item,data);else s.investments.push({id:newRecordId(),...data});return true}}
else if(type==='liability'){title=item?'Edit liability':'Add liability';body='<div class="form"><div class="field"><label>Name</label><input id="fTitle" value="'+v('name')+'" placeholder="e.g. Education loan"></div><div class="field"><label>Type</label><input id="fType" value="'+v('type')+'" placeholder="Loan, credit balance…"></div><div class="field"><label>Outstanding amount (₹)</label><input id="fAmount" type="number" min="0" step="0.01" value="'+v('amount')+'"></div></div>';submit=()=>{let name=$('#fTitle').value.trim(),amount=Number($('#fAmount').value);if(!name||!Number.isFinite(amount)||amount<0){toast('Enter a name and valid non-negative amount.');return false}let data={name,type:$('#fType').value.trim(),amount};if(item)Object.assign(item,data);else s.liabilities.push({id:newRecordId(),...data});return true}}
else if(type==='budget'){title=item?'Edit monthly budget':'Add monthly budget';body='<div class="form"><div class="field"><label>Expense category</label><select id="fTitle">'+['Living','Study','Health','Personal','Other'].map(x=>'<option '+((item?.name||'Living')===x?'selected':'')+'>'+x+'</option>').join('')+'</select><div class="tiny muted">Choose the same category you use when adding an expense.</div></div><div class="field"><label>Monthly limit (₹)</label><input id="fAmount" type="number" min="0.01" step="0.01" value="'+v('total')+'"></div></div>';submit=()=>{let name=$('#fTitle').value.trim(),total=Number($('#fAmount').value);if(!name||!Number.isFinite(total)||total<=0){toast('Enter a category and positive budget amount.');return false}if(item){let duplicate=s.budgets.find(b=>b!==item&&String(b.name).toLowerCase()===name.toLowerCase());if(duplicate){toast('A budget for that category already exists.');return false}Object.assign(item,{name,total})}else{let existing=s.budgets.find(b=>String(b.name).toLowerCase()===name.toLowerCase());if(existing)existing.total=total;else s.budgets.push({name,total,used:0})}return true}}
else if(type==='routine'){title='New routine';body=`<div class="form"><div class="field"><label>Routine name</label><input id="fTitle" placeholder="e.g. Morning reset"></div><div class="field"><label>Steps (one per line, up to 10)</label><textarea id="fRoutineSteps" placeholder="Drink water\nMake the bed\nReview priorities"></textarea></div></div>`;submit=()=>{let name=$('#fTitle').value.trim(),steps=$('#fRoutineSteps').value.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,10);if(!name||!steps.length)return false;s.routines.push({id:newRecordId(),name,steps:steps.map((text,i)=>({id:i+1,text,done:false}))});return true}}
else if(type==='topic'){title='Add syllabus topic';body=`<div class="form"><div class="field"><label>Subject</label><select id="fSubject">${subjectOptions()}</select></div><div class="field"><label>Or add a new subject</label><input id="fNewSubject" placeholder="Optional: new subject name"></div><div class="field"><label>Topic</label><input id="fTitle" placeholder="Topic name"></div></div>`;submit=()=>{let topic=$('#fTitle').value.trim(),newSubject=$('#fNewSubject').value.trim(),subject=newSubject||$('#fSubject').value;if(!topic)return false;s.subjects=s.subjects||[];if(!s.subjects.includes(subject))s.subjects.push(subject);s.syllabus.push({id:newRecordId(),subject,topic,status:'Not started',revisions:0,exam:$('#examSelect').value});refreshSubjectControls();return true}}
else if(type==='goal'){title=item?'Edit goal':'New goal';let subs=item?.subgoals||[];body=`<div class="form"><div class="field"><label>Goal name</label><input id="fTitle" value="${v('title')}" placeholder="What do you want to work towards?" required></div><div class="formrow"><div class="field"><label>Life area</label><select id="fArea">${['Studies','Health','Finance','Career','Personal Growth'].map(x=>`<option ${v('area')===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Status</label><select id="fGoalStatus">${['Not started','Active','Ongoing','Completed'].map(x=>`<option ${((item?.status||'Not started')===x || (!item&&x==='Not started'))?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="field"><label>Target date (optional)</label><input id="fDate" value="${v('date')}" placeholder="e.g. 2028"></div><div class="field"><label>Description</label><textarea id="fBody" placeholder="Why does this goal matter?">${v('desc')}</textarea></div><div class="field"><label>Sub-goals (one per line)</label><textarea id="fSubgoals" placeholder="Finish a course\nComplete a project">${safe(subs.map(x=>x.text).join('\n'))}</textarea><div class="tiny muted">Existing completed sub-goals are preserved when their text stays the same.</div></div></div>`;submit=()=>{let title=$('#fTitle').value.trim();if(!title)return false;let lines=$('#fSubgoals').value.split('\n').map(x=>x.trim()).filter(Boolean),old=item?.subgoals||[],used=new Set(),nextSubs=lines.map((text,i)=>{let existing=old.find(x=>x.text===text&&!used.has(x.id));if(existing)used.add(existing.id);return existing?{...existing}:{id:newRecordId(),text,done:false}});let data={title,area:$('#fArea').value,date:$('#fDate').value.trim(),status:$('#fGoalStatus').value,desc:$('#fBody').value,subgoals:nextSubs,timeline:item?.timeline||[]};data.timeline.unshift({date:new Date().toISOString(),text:item?'Goal details updated':'Goal created'});if(item)Object.assign(item,data);else s.goals.push({id:newRecordId(),...data});return true}}
else if(type==='project'){title='New project';body=`<div class="form"><div class="field"><label>Project name</label><input id="fTitle" placeholder="What are you working on?"></div><div class="field"><label>Linked task count (demo)</label><input id="fSteps" type="number" min="0" value="0"></div></div>`;submit=()=>{let title=$('#fTitle').value.trim();if(!title)return false;let n=Math.max(0,+$('#fSteps').value||0);s.projects.push({id:newRecordId(),title,status:'Not started',tasks:n,done:0});return true}}
$('#modalTitle').textContent=title;$('#modalBody').innerHTML=body;showModal();if(type==='task')$('#fDate').onchange=()=>$('#fDue').style.display=$('#fDate').value==='date'?'block':'none';$('#modalSave').textContent=saveText;$('#modalSave').onclick=()=>{if(!submit||submit()===false)return;if(type==='quick')return;closeModal();save();render();toast(item?'Changes saved.':'Added to your workspace.')};bindModalClose();setTimeout(()=>$('#modalBody input,#modalBody select,#modalBody textarea')?.focus(),30)}
function settingsPage(){applyPrefs()}
function render(){if(rollover())save();refreshSubjectControls();home();tasksPage();habitsPage();studyPage();focusPage();notesPage();financePage();libraryPage();projectsPage();calendarPage();timerRender()}
function search(){closeSearchModal();searchReturnFocus=document.activeElement;let d=document.createElement('div');d.className='modalback open';d.id='searchModal';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.setAttribute('aria-labelledby','searchTitle');d.tabIndex=-1;d.innerHTML=`<div class="modal"><div class="modalhead"><h2 id="searchTitle">Search LifeOS</h2><button class="close" id="searchClose" aria-label="Close search">×</button></div><input class="search u-full-width" id="globalQ" aria-label="Search tasks, notes, study and library" placeholder="Search tasks, notes, study…"><div class="tiny muted u-mt-9">Finance is excluded from global search.</div><div id="globalResults" class="table"></div></div>`;document.body.append(d);let inp=$('#globalQ');inp.oninput=()=>{let q=inp.value.toLowerCase(),r=[];s.tasks.filter(x=>x.title.toLowerCase().includes(q)&&q).forEach(x=>r.push({title:x.title,type:'Task',page:'tasks'}));s.notes.filter(x=>(x.title+' '+x.body).toLowerCase().includes(q)&&q).forEach(x=>r.push({title:x.title,type:'Note',page:'notes'}));s.syllabus.filter(x=>(x.topic+' '+x.subject).toLowerCase().includes(q)&&q).forEach(x=>r.push({title:x.topic,type:'Syllabus',page:'study'}));s.resources.filter(x=>(x.title+' '+x.author).toLowerCase().includes(q)&&q).forEach(x=>r.push({title:x.title,type:'Library',page:'library'}));$('#globalResults').innerHTML=r.length?r.map((x,i)=>`<button class="row global-result-row" data-result="${i}"><div class="rowmain"><div class="rowtitle">${safe(x.title)}</div><div class="rowsub">${x.type}</div></div>↗</button>`).join(''):'<div class="empty">Start typing to search.</div>';$$('[data-result]').forEach(b=>b.onclick=()=>{let x=r[+b.dataset.result];closeSearchModal();nav(x.page)})};$('#searchClose').onclick=closeSearchModal;d.onclick=e=>{if(e.target===d)closeSearchModal()};inp.focus()}

function exportData(){let payload={app:'LifeOS',backupVersion:1,exportedAt:new Date().toISOString(),workspace:s,preferences:prefs};let blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='lifeos-workspace-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);toast('Workspace backup exported.')}
async function resetWorkspaceSafely(){
  const oldWorkspace=JSON.parse(JSON.stringify(s));
  s=seed();save();render();
  const ok=await pushCloud();
  if(!ok){
    s=oldWorkspace;dirty=true;writeCache();writeMeta({user:cloudUser?.id,revision:baseRevision,dirty:true});
    render();toast('Reset was not saved to the cloud. Your previous local workspace has been restored.');
    return;
  }
  render();nav('home');toast('Workspace reset and saved to the cloud. Preferences were kept.');
}
function reset(){inPageConfirm('Reset workspace','This permanently clears your LifeOS workspace in the cloud and on all synced devices. Continue?',()=>{inPageConfirm('Final confirmation','Delete tasks, notes, goals, study records, finance records and all other workspace data?',()=>resetWorkspaceSafely(),true);},true);}
function resetPreferences(){inPageConfirm('Reset preferences','Reset appearance, profile and planning preferences? Workspace records will remain unchanged.',()=>{prefs={theme:'dark',accent:'amber',density:'comfortable',font:'default',name:'',motto:'',avatar:'UG',picture:'',hiddenModules:[],summaries:{tasks:true,study:true,habits:true},weekStart:1,clock:'12',dateFormat:'dmy',studyTargetMins:180};save();applyPrefs();render();toast('Preferences reset. Your records are unchanged.');});}
async function compressImage(file){if(!file||!file.type||!file.type.startsWith('image/'))throw new Error('Choose an image file.');if(file.size>20*1024*1024)throw new Error('Choose an image smaller than 20 MB.');let bitmap;try{if('createImageBitmap' in window)bitmap=await createImageBitmap(file)}catch(e){}let canvas=document.createElement('canvas'),side=256;canvas.width=side;canvas.height=side;let ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image processing is not available in this browser.');if(bitmap){let scale=Math.max(side/bitmap.width,side/bitmap.height),w=bitmap.width*scale,h=bitmap.height*scale;ctx.drawImage(bitmap,(side-w)/2,(side-h)/2,w,h);bitmap.close?.()}else{let url=URL.createObjectURL(file);try{let img=await new Promise((resolve,reject)=>{let im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('This image could not be opened. Try saving it as JPG or PNG.'));im.src=url});let scale=Math.max(side/img.naturalWidth,side/img.naturalHeight),w=img.naturalWidth*scale,h=img.naturalHeight*scale;ctx.drawImage(img,(side-w)/2,(side-h)/2,w,h)}finally{URL.revokeObjectURL(url)}}let data=canvas.toDataURL('image/jpeg',0.72);if(data.length>300000)throw new Error('Could not compress this picture enough. Try a smaller image.');return data}
function validBackup(x){let w=x?.workspace||x;if(!w||typeof w!=='object'||!Array.isArray(w.tasks)||!Array.isArray(w.habits))return false;for(let k of ['routines','notes','sessions','syllabus','transactions','budgets','resources','goals','projects','investments','assets','liabilities','exams','subjects'])if(w[k]!==undefined&&!Array.isArray(w[k]))return false;return true}
function backupArrays(w){return ['tasks','habits','routines','notes','sessions','syllabus','transactions','budgets','resources','goals','projects','investments','assets','liabilities','exams','subjects'].filter(k=>Array.isArray(w[k]))}
function backupPreview(file){let fr=new FileReader();fr.onerror=()=>toast('Could not read the backup file.');fr.onload=()=>{try{let x=JSON.parse(fr.result);if(!validBackup(x))throw new Error('This does not look like a valid LifeOS backup.');let w=x.workspace||x;pendingBackup={data:x,fileName:file.name};let keys=backupArrays(w),counts=keys.reduce((a,k)=>a+(w[k]?.length||0),0);let current=keys.reduce((a,k)=>a+(s[k]?.length||0),0);let conflicts=keys.reduce((a,k)=>a+(w[k]||[]).filter(r=>r&&r.id!=null&&(s[k]||[]).some(q=>q.id===r.id)).length,0);$('#restorePreview').style.display='block';$('#restorePreview').innerHTML=`<b>Backup validated: ${safe(file.name)}</b><p>${keys.length} data categories · ${counts} imported records · ${current} current records · ${conflicts} matching record IDs to review.</p><div class="setting-control"><button class="btn" id="restoreReplace">Replace workspace</button><button class="btn" id="restoreMerge">Merge records</button><button class="textbtn" id="cancelRestore">Cancel</button></div><div class="settings-help">Replace overwrites current workspace records. Merge updates records with matching IDs and appends new ones; records without IDs are appended. A safety copy is downloaded before either action.</div>`;$('#restoreReplace').onclick=()=>restoreBackup('replace');$('#restoreMerge').onclick=()=>restoreBackup('merge');$('#cancelRestore').onclick=()=>{pendingBackup=null;$('#restorePreview').style.display='none';$('#importFile').value=''}}catch(e){pendingBackup=null;$('#restorePreview').style.display='block';$('#restorePreview').textContent=e.message||'Invalid backup file.'}};fr.readAsText(file)}
function restoreBackup(mode){if(!pendingBackup)return;let x=pendingBackup.data,w=x.workspace||x;if(!validBackup(x)){toast('Backup validation failed.');return}let keys=backupArrays(w),conflicts=keys.reduce((a,k)=>a+(w[k]||[]).filter(r=>r&&r.id!=null&&(s[k]||[]).some(q=>q.id===r.id)).length,0);const doRestore=async()=>{
  exportData();const oldS=JSON.parse(JSON.stringify(s)),oldPrefs=JSON.parse(JSON.stringify(prefs));
  try{
    let next;
    if(mode==='replace')next=normalizeWorkspace(w);
    else{next=mergeWorkspace(JSON.parse(JSON.stringify(s)),normalizeWorkspace(w));next.timer=s.timer}
    s=next;if(x.preferences&&typeof x.preferences==='object')prefs=mergePrefs(prefs,x.preferences);
    try{localStorage.setItem('lifeos-review-v2',JSON.stringify(s));localStorage.setItem('lifeos-review-prefs',JSON.stringify(prefs))}
    catch(err){s=oldS;prefs=oldPrefs;throw new Error('Browser storage is full. Existing workspace was preserved; export data or remove the profile picture before retrying.')}
    pendingBackup=null;$('#restorePreview').style.display='none';$('#importFile').value='';
    save();applyPrefs();render();nav('home');
    const ok=await pushCloud();
    if(!ok){
      s=oldS;prefs=oldPrefs;dirty=true;writeCache();writeMeta({user:cloudUser?.id,revision:baseRevision,dirty:true});
      applyPrefs();render();toast('Restore was not saved to the cloud. Your previous local workspace has been restored.');
      return;
    }
    toast(mode==='replace'?'Workspace restored and saved to the cloud.':'Backup merged and saved to the cloud.');
  }catch(e){s=oldS;prefs=oldPrefs;writeCache();applyPrefs();render();toast(e.message||'Restore failed. Existing workspace was preserved.')}
};if(mode==='merge'){inPageConfirm('Merge backup',`Merge ${pendingBackup.fileName}? Preview: ${keys.map(k=>`${k}: ${(w[k]||[]).length} imported`).join(', ')}. ${conflicts} matching IDs will be updated; records without IDs will be appended. A safety backup will be downloaded first. Continue?`,doRestore);}else{inPageConfirm('Replace workspace',`Replace the current workspace with ${pendingBackup.fileName}? This cannot be undone unless you have a backup.`,doRestore,true);}}

function saveProfile(){prefs.name=$('#profileNameInput').value.trim().slice(0,60);prefs.motto=$('#profileMottoInput').value.trim().slice(0,120);save();applyPrefs();toast('Profile saved.')}

function applyPrefs(){prefs.picture=safePic(prefs.picture);document.documentElement.dataset.theme=prefs.theme==='light'?'light':'dark';document.documentElement.dataset.accent=prefs.accent||'amber';document.documentElement.dataset.density=prefs.density||'comfortable';document.documentElement.dataset.font=prefs.font||'default';$('#themeBtn').textContent=prefs.theme==='light'?'☾':'☼';$('#prefTheme').value=prefs.theme;$('#prefAccent').value=prefs.accent||'amber';$('#prefDensity').value=prefs.density;$('#prefFont').value=prefs.font;prefs.weekStart=1;$('#prefClock').value=prefs.clock||'12';$('#prefDate').value=prefs.dateFormat||'dmy';$('#prefBudgetResetDay').value=String(prefs.budgetResetDay||1);$('#summaryTasks').checked=prefs.summaries?.tasks!==false;$('#summaryStudy').checked=prefs.summaries?.study!==false;$('#summaryHabits').checked=prefs.summaries?.habits!==false;let av=$('#profileAvatar');av.innerHTML=prefs.picture?`<img src="${prefs.picture}" alt="Profile picture">`:safe(prefs.avatar||'UG');$('#profileDisplayName').textContent=prefs.name||'Your workspace';$('#profileNameInput').value=prefs.name||'';$('#profileMottoInput').value=prefs.motto||'';$('#profilePageAvatar').innerHTML=prefs.picture?`<img src="${prefs.picture}" alt="Profile picture">`:safe(prefs.avatar||'UG');$('#profileMotto').textContent=prefs.motto||'Personal workspace';$$('[data-avatar]').forEach(b=>b.classList.toggle('selected',b.dataset.avatar===prefs.avatar&&!prefs.picture));applyModuleVisibility();applySummaries();updateLifeOSGreeting();updateDateLabels()}
function applyModuleVisibility(){let always=['home','settings'];$$('[data-page]').forEach(b=>{let id=b.dataset.page;if(!id)return;let hidden=!always.includes(id)&&(prefs.hiddenModules||[]).includes(id);b.style.display=hidden?'none':''});$('#moduleToggles').innerHTML=[['tasks','Tasks'],['habits','Habits & routines'],['projects','Goals'],['study','Exams'],['focus','Focus timer'],['library','Library'],['notes','Notes'],['finance','Finance'],['calendar','Calendar']].map(([id,label])=>`<label><input type="checkbox" data-module-toggle="${id}" ${!(prefs.hiddenModules||[]).includes(id)?'checked':''}> ${label}</label>`).join('');$$('[data-module-toggle]').forEach(c=>c.onchange=()=>{let id=c.dataset.moduleToggle;prefs.hiddenModules=prefs.hiddenModules||[];prefs.hiddenModules=c.checked?prefs.hiddenModules.filter(x=>x!==id):[...new Set([...prefs.hiddenModules,id])];save();applyModuleVisibility();if(!c.checked&&$('#page-'+id)?.classList.contains('active'))nav('home');toast(c.checked?'Module shown in navigation.':'Module hidden; its data is unchanged.')})}
function applySummaries(){[['tasks','dashTasks'],['study','studyToday'],['habits','dashHabits']].forEach(([k,id])=>{let el=$('#'+id);if(!el)return;let card=el.closest('.card');if(card)card.style.display=prefs.summaries?.[k]===false?'none':''})}
function toggleTheme(){prefs.theme=prefs.theme==='light'?'dark':'light';save();applyPrefs()}
function toggleSidebar(){let x=$('#sidebar');x.classList.toggle('collapsed');$('#collapse').textContent=x.classList.contains('collapsed')?'›':'‹';$('#settingsSidebar').textContent=x.classList.contains('collapsed')?'Expand sidebar':'Collapse'}

function getLifeOSGreeting(){
  const hour = new Date().getHours();
  const period = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = (typeof prefs !== 'undefined' && prefs && prefs.name) ? String(prefs.name).trim() : '';
  return period + (name ? ', ' + name : '') + '.';
}


function updateLifeOSGreeting(){
  const candidates = document.querySelectorAll('#page-home h1, #page-home .heading h1, #page-home h1.greeting');
  for (const el of candidates) {
    if (/^Good (morning|afternoon|evening)/i.test((el.textContent || '').trim())) {
      el.textContent = getLifeOSGreeting();
      return;
    }
  }
}

function setup(){
  if(setupComplete){applyPrefs();render();return}
  setupComplete=true;
  updateLifeOSGreeting();if(!window.__lifeosCloudLoaded)load();s.exams=s.exams||[];s.subjects=s.subjects||[];[...s.syllabus.map(x=>x.subject),...s.sessions.map(x=>x.subject)].filter(Boolean).forEach(x=>{if(!s.subjects.includes(x))s.subjects.push(x)});s.investments=s.investments||[];s.assets=s.assets||[];s.liabilities=s.liabilities||[];let es=$('#examSelect');s.exams.forEach(e=>{if(![...es.options].some(o=>o.value===e.name)){let o=document.createElement('option');o.value=e.name;o.textContent=e.name;es.append(o)}});updateDateLabels();$$('[data-page]').forEach(b=>b.onclick=()=>nav(b.dataset.page));$$('[data-go]').forEach(b=>b.onclick=()=>nav(b.dataset.go));$$('[data-add]').forEach(b=>b.onclick=()=>modal(b.dataset.add));$('#quickAdd').onclick=()=>modal('quick');$('#searchBtn').onclick=search;$('#themeBtn').onclick=toggleTheme;$('#collapse').onclick=toggleSidebar;$('#settingsSidebar').onclick=toggleSidebar;$('#prefTheme').onchange=()=>{prefs.theme=$('#prefTheme').value;save();applyPrefs()};$('#prefDensity').onchange=()=>{prefs.density=$('#prefDensity').value;save();applyPrefs()};$('#prefFont').onchange=()=>{prefs.font=$('#prefFont').value;save();applyPrefs()};$('#prefAccent').onchange=()=>{prefs.accent=$('#prefAccent').value;save();applyPrefs();toast('Accent colour updated.')};prefs.weekStart=1;$('#prefClock').onchange=()=>{prefs.clock=$('#prefClock').value;save();updateDateLabels();toast('Clock format updated.')};$('#prefDate').onchange=()=>{prefs.dateFormat=$('#prefDate').value;save();updateDateLabels();render();toast('Date format updated.')};$('#prefBudgetResetDay').onchange=()=>{prefs.budgetResetDay=Number($('#prefBudgetResetDay').value)||1;financeMonth=null;save();render();toast('Income and budget cycle updated.')};$('#saveProfilePage').onclick=saveProfile;$('#profileRemovePicture').onclick=()=>{prefs.picture='';save();applyPrefs();toast('Profile picture removed.')};$('#profilePictureInput').onchange=async e=>{let f=e.target.files?.[0];if(!f)return;try{prefs.picture=await compressImage(f);prefs.avatar='';save();applyPrefs();toast('Profile picture saved.')}catch(err){toast(err.message||'Could not save that picture.')}e.target.value=''};$('#profileAvatarChoices').onclick=e=>{let b=e.target.closest('[data-profile-avatar]');if(!b)return;prefs.avatar=b.dataset.profileAvatar;prefs.picture='';save();applyPrefs();toast('Avatar updated.')};$('#summaryTasks').onchange=()=>{prefs.summaries.tasks=$('#summaryTasks').checked;save();applyPrefs()};$('#summaryStudy').onchange=()=>{prefs.summaries.study=$('#summaryStudy').checked;save();applyPrefs()};$('#summaryHabits').onchange=()=>{prefs.summaries.habits=$('#summaryHabits').checked;save();applyPrefs()};if($('#resetPrefsBtn'))$('#resetPrefsBtn').onclick=resetPreferences;$('#moreBtn').onclick=()=>$('#moreMenu').classList.toggle('open');$('#taskViews').onclick=e=>{let b=e.target.closest('[data-view]');if(!b)return;taskView=b.dataset.view;$$('[data-view]').forEach(x=>x.classList.toggle('active',x===b));tasksPage()};$('#taskSearch').oninput=tasksPage;$('#taskPriority').onchange=tasksPage;$('#noteSearch').oninput=notesPage;$('#librarySearch').oninput=libraryPage;$('#libraryStatus').onchange=libraryPage;$('#libraryType').onchange=libraryPage;$('#libraryLayout').onclick=e=>{let b=e.target.closest('[data-layout]');if(!b)return;bookView=b.dataset.layout;$$('[data-layout]').forEach(x=>x.classList.toggle('active',x===b));libraryPage()};$('#miniStart').onclick=timerStart;$('#miniStop').onclick=timerPause;$('#miniFinish').onclick=timerFinish;$('#startTimer').onclick=timerStart;$('#pauseTimer').onclick=timerPause;$('#finishTimer').onclick=timerFinish;$('#resetTimer').onclick=timerReset;$('#timerModes').onclick=e=>{let b=e.target.closest('[data-mode]');if(!b)return;if(s.timer.running){toast('Pause or finish the session first.');return}s.timer.mode=b.dataset.mode;s.timer.duration=b.dataset.mode==='countdown'?1500:0;s.timer.remaining=s.timer.duration;s.timer.paused=false;$$('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));$('#presets').style.display=b.dataset.mode==='countdown'?'flex':'none';save();timerRender()};$('#presetButtons').onclick=e=>{let b=e.target.closest('[data-min]');if(!b||s.timer.running)return;s.timer.duration=+b.dataset.min*60;s.timer.remaining=s.timer.duration;$$('[data-min]').forEach(x=>x.classList.toggle('active',x===b));save();timerRender()};$('#customTimer').onclick=()=>{inPagePrompt('Custom timer','Countdown minutes (1–240):','30',(val)=>{let n=Number(val);if(Number.isInteger(n)&&n>=1&&n<=240&&!s.timer.running){s.timer.duration=n*60;s.timer.remaining=n*60;save();timerRender();}else{toast('Enter a whole number between 1 and 240.');}},'number');};$('#timerTopic').oninput=timerRender;$('#timerSubject').onchange=timerRender;$('#addRoutine').onclick=()=>modal('routine');$('#addTopic').onclick=()=>modal('topic');$('#manageSubjects').onclick=()=>{inPagePrompt('Add subject','Add a subject name:','',(val)=>{let name=val?.trim();if(!name)return;if(!(s.subjects||[]).includes(name))s.subjects.push(name);save();refreshSubjectControls();toast('Subject added. It is available in Exams and Focus Timer.');});};$('#addExam').onclick=()=>{inPagePrompt('New exam workspace','Name this exam workspace:','',(val)=>{let n=val?.trim();if(n&&!s.exams.some(e=>e.name===n)){let first=!s.exams.length;s.exams.push({name:n,date:''});if(first)adoptOrphans(n);refreshSubjectControls();$('#examSelect').value=n;save();studyPage();}});};
$('#editExam').onclick=()=>{let n=$('#examSelect').value,ex=s.exams.find(e=>e.name===n);if(!ex)return;inPagePrompt('Set exam date','Exam date (YYYY-MM-DD). Leave empty to clear:',ex.date||'',(val)=>{let v=val?.trim()||'';if(v&&!(dayRe.test(v)&&dayKey(new Date(v+'T12:00:00'))===v)){toast('Use the format YYYY-MM-DD, for example 2026-12-15.');return;}ex.date=v;save();studyPage();toast(v?'Exam date saved.':'Exam date cleared.');});};
$('#deleteExam').onclick=()=>{let n=$('#examSelect').value;if(!n)return;let topics=s.syllabus.filter(t=>t.exam===n).length;inPageConfirm('Delete exam',`Delete exam “${n}”? Its ${topics} syllabus topic(s) will be removed. Study sessions stay in your Focus history.`,()=>{s.exams=s.exams.filter(e=>e.name!==n);s.syllabus=s.syllabus.filter(t=>t.exam!==n);s.sessions.forEach(x=>{if(x.exam===n)x.exam=''});save();refreshSubjectControls();$('#examSelect').value='';studyPage();toast('Exam deleted.');},true);};$('#examSelect').onchange=studyPage;$('#prevWeek').onclick=()=>{weekOffset--;calendarPage()};$('#nextWeek').onclick=()=>{weekOffset++;calendarPage()};$('#thisWeek').onclick=()=>{weekOffset=0;calendarPage()};$('#resetBtn').onclick=reset;bindGlobalsOnce();bindModalClose();try{if(!localStorage.getItem('lifeos-review-prefs')&&localStorage.getItem('lifeos-review-theme')==='light')prefs.theme='light'}catch(e){}applyPrefs();render();save()}
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('LifeOS offline shell could not be installed.',error));
setup();
startCloud();
})();
