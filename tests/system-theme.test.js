'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const profileModule=require('../profile-ui');

function makeElement(){
  return {value:'',textContent:'',innerHTML:'',checked:false,style:{},classList:{toggle(){}},closest(){return null}};
}
function installDom(){
  const elements=new Map();
  global.document={
    documentElement:{dataset:{}},
    querySelectorAll(){return []}
  };
  global.window={matchMedia(){return mediaQuery}};
  const mediaQuery={matches:false,listener:null,addEventListener(type,fn){if(type==='change')this.listener=fn},addListener(fn){this.listener=fn}};
  const $=selector=>{if(!elements.has(selector))elements.set(selector,makeElement());return elements.get(selector)};
  return {elements,$,mediaQuery};
}
function createController(prefs,dom){
  return profileModule.create({$:dom.$,queryAll:()=>[],getPrefs:()=>prefs,save(){},toast(){},safe:String,safePic:value=>value,updateDateLabels(){},nav(){}});
}

test('System theme follows the browser preference and reacts to live changes',()=>{
  const dom=installDom(),prefs={theme:'system',accent:'amber',density:'comfortable',font:'default',summaries:{}};
  const controller=createController(prefs,dom);
  controller.applyPrefs();
  assert.equal(document.documentElement.dataset.theme,'light');
  assert.equal(dom.$('#prefTheme').value,'system');
  dom.mediaQuery.matches=true;
  dom.mediaQuery.listener({matches:true});
  assert.equal(document.documentElement.dataset.theme,'dark');
  dom.mediaQuery.matches=false;
  dom.mediaQuery.listener({matches:false});
  assert.equal(document.documentElement.dataset.theme,'light');
});

test('explicit Light and Dark choices ignore system preference changes',()=>{
  const dom=installDom(),prefs={theme:'light',accent:'amber',density:'comfortable',font:'default',summaries:{}};
  const controller=createController(prefs,dom);
  controller.applyPrefs();
  assert.equal(document.documentElement.dataset.theme,'light');
  dom.mediaQuery.matches=true;
  dom.mediaQuery.listener({matches:true});
  assert.equal(document.documentElement.dataset.theme,'light');
  prefs.theme='dark';
  controller.applyPrefs();
  dom.mediaQuery.matches=false;
  dom.mediaQuery.listener({matches:false});
  assert.equal(document.documentElement.dataset.theme,'dark');
});

test('the theme toggle leaves System mode by choosing the opposite of the currently resolved theme',()=>{
  const dom=installDom(),prefs={theme:'system',accent:'amber',density:'comfortable',font:'default',summaries:{}};
  const controller=createController(prefs,dom);
  dom.mediaQuery.matches=true;
  controller.applyPrefs();
  controller.toggleTheme();
  assert.equal(prefs.theme,'light');
  assert.equal(document.documentElement.dataset.theme,'light');
});

test('preference normalization and Settings expose System, Dark, and Light',()=>{
  const root=path.join(__dirname,'..');
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(app,/theme:pick\(p\.theme,\['dark','light','system'\],d\.theme\)/);
  const selector=html.match(/<select id="prefTheme">([\s\S]*?)<\/select>/);
  assert.ok(selector);
  assert.deepEqual([...selector[1].matchAll(/<option value="([^"]+)"/g)].map(match=>match[1]),['system','dark','light']);
});
