'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LifeOSProfileUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create(deps){
    const {$,queryAll,getPrefs,save,toast,safe,safePic,updateDateLabels,nav}=deps;
    function getLifeOSGreeting(){
      const hour=new Date().getHours();
      const period=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
      const name=getPrefs()?.name?String(getPrefs().name).trim():'';
      return period+(name?', '+name:'')+'.';
    }
    function updateLifeOSGreeting(){
      const candidates=document.querySelectorAll('#page-home h1, #page-home .heading h1, #page-home h1.greeting');
      for(const element of candidates){
        if(/^Good (morning|afternoon|evening)/i.test((element.textContent||'').trim())){element.textContent=getLifeOSGreeting();return}
      }
    }
    function applyModuleVisibility(){
      const prefs=getPrefs(),always=['home','settings'];
      queryAll('[data-page]').forEach(button=>{const id=button.dataset.page;if(!id)return;button.style.display=!always.includes(id)&&(prefs.hiddenModules||[]).includes(id)?'none':''});
      $('#moduleToggles').innerHTML=[['tasks','Tasks'],['habits','Habits & routines'],['projects','Goals'],['study','Exams'],['focus','Focus timer'],['library','Library'],['notes','Notes'],['finance','Finance'],['calendar','Calendar']].map(([id,label])=>'<label><input type="checkbox" data-module-toggle="'+id+'" '+(!(prefs.hiddenModules||[]).includes(id)?'checked':'')+'> '+label+'</label>').join('');
      queryAll('[data-module-toggle]').forEach(control=>control.onchange=()=>{const id=control.dataset.moduleToggle;const current=getPrefs();current.hiddenModules=current.hiddenModules||[];current.hiddenModules=control.checked?current.hiddenModules.filter(value=>value!==id):[...new Set([...current.hiddenModules,id])];save();applyModuleVisibility();if(!control.checked&&$('#page-'+id)?.classList.contains('active'))nav('home');toast(control.checked?'Module shown in navigation.':'Module hidden; its data is unchanged.')});
    }
    function applySummaries(){
      const prefs=getPrefs();
      [['tasks','dashTasks'],['study','studyToday'],['habits','dashHabits']].forEach(([key,id])=>{const element=$('#'+id);if(!element)return;const card=element.closest('.card');if(card)card.style.display=prefs.summaries?.[key]===false?'none':''});
    }
    function applyPrefs(){
      const prefs=getPrefs();
      prefs.picture=safePic(prefs.picture);
      const systemPrefersDark=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)').matches:false;
      const resolvedTheme=prefs.theme==='system'?(systemPrefersDark?'dark':'light'):prefs.theme;
      document.documentElement.dataset.theme=resolvedTheme==='light'?'light':'dark';
      document.documentElement.dataset.accent=prefs.accent||'amber';
      document.documentElement.dataset.density=prefs.density||'comfortable';
      document.documentElement.dataset.font=prefs.font||'default';
      $('#themeBtn').textContent=resolvedTheme==='light'?'☾':'☼';
      $('#prefTheme').value=prefs.theme;$('#prefAccent').value=prefs.accent||'amber';$('#prefDensity').value=prefs.density;$('#prefFont').value=prefs.font;
      prefs.weekStart=1;$('#prefClock').value=prefs.clock||'12';$('#prefDate').value=prefs.dateFormat||'dmy';$('#prefBudgetResetDay').value=String(prefs.budgetResetDay||1);
      $('#summaryTasks').checked=prefs.summaries?.tasks!==false;$('#summaryStudy').checked=prefs.summaries?.study!==false;$('#summaryHabits').checked=prefs.summaries?.habits!==false;
      const avatar=$('#profileAvatar');avatar.innerHTML=prefs.picture?'<img src="'+prefs.picture+'" alt="Profile picture">':safe(prefs.avatar||'UG');
      $('#profileDisplayName').textContent=prefs.name||'Your workspace';$('#profileNameInput').value=prefs.name||'';$('#profileMottoInput').value=prefs.motto||'';
      $('#profilePageAvatar').innerHTML=prefs.picture?'<img src="'+prefs.picture+'" alt="Profile picture">':safe(prefs.avatar||'UG');$('#profileMotto').textContent=prefs.motto||'Personal workspace';
      queryAll('[data-avatar]').forEach(button=>button.classList.toggle('selected',button.dataset.avatar===prefs.avatar&&!prefs.picture));
      applyModuleVisibility();applySummaries();updateLifeOSGreeting();updateDateLabels();
    }
    function saveProfile(){const prefs=getPrefs();prefs.name=$('#profileNameInput').value.trim().slice(0,60);prefs.motto=$('#profileMottoInput').value.trim().slice(0,120);save();applyPrefs();toast('Profile saved.')}
    function toggleTheme(){const prefs=getPrefs();const current=document.documentElement.dataset.theme||'dark';prefs.theme=current==='light'?'dark':'light';save();applyPrefs()}
    function toggleSidebar(){const sidebar=$('#sidebar');sidebar.classList.toggle('collapsed');$('#collapse').textContent=sidebar.classList.contains('collapsed')?'›':'‹';$('#settingsSidebar').textContent=sidebar.classList.contains('collapsed')?'Expand sidebar':'Collapse'}
    if(typeof window!=='undefined'&&window.matchMedia){
      const systemThemeQuery=window.matchMedia('(prefers-color-scheme: dark)');
      const onSystemThemeChange=()=>{if(getPrefs().theme==='system')applyPrefs()};
      if(systemThemeQuery.addEventListener)systemThemeQuery.addEventListener('change',onSystemThemeChange);
      else if(systemThemeQuery.addListener)systemThemeQuery.addListener(onSystemThemeChange);
    }
    return Object.freeze({saveProfile,applyPrefs,applyModuleVisibility,applySummaries,toggleTheme,toggleSidebar,getLifeOSGreeting,updateLifeOSGreeting});
  }
  return Object.freeze({create});
});
