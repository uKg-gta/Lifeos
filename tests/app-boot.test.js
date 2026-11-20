'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.join(__dirname,'..');
const workspace={
 tasks:[],habits:[],routines:[],notes:[],sessions:[],syllabus:[],transactions:[],budgets:[],
 resources:[],goals:[],projects:[],investments:[],assets:[],liabilities:[],exams:[],subjects:[],
 timer:{mode:'countdown',duration:1500,remaining:1500,running:false,startedAt:null,paused:false}
};
function createSupabaseMock(){
 const session={user:{id:'boot-test-user',email:'umangghiria90@gmail.com'}};
 return {
  auth:{
   onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}},
   async getSession(){return {data:{session},error:null}},
   async signOut(){return {error:null}},
   async signInWithOAuth(){return {error:null}}
  },
  from(){const query={select(){return query},eq(){return query},async maybeSingle(){return {data:{data:{workspace,preferences:{}},revision:94,updated_at:'2026-11-19T20:00:00.000Z'},error:null}}};return query},
  async rpc(){return {data:{saved:true,new_revision:95},error:null}},
  channel(){return {on(){return this},subscribe(){return this}}},
  removeChannel(){}
 };
}
test('the complete app loads, authenticates, and renders without boot-time reference errors',async()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const scripts=[...html.matchAll(/<script[^>]*src=["']([^"']+)["'][^>]*>/g)].map(match=>match[1]);
 const documentHtml=html.replace(/<script[^>]*src=["'][^"']+["'][^>]*>\s*<\/script>/g,'');
 const dom=new JSDOM(documentHtml,{url:'https://lifeos.test/',runScripts:'outside-only',pretendToBeVisual:true});
 const {window}=dom,errors=[];
 window.scrollTo=()=>{};
 window.setInterval=()=>1;
 window.clearInterval=()=>{};
 window.supabase={createClient(){return createSupabaseMock()}};
 window.addEventListener('error',event=>errors.push(event.error||event.message));
 window.addEventListener('unhandledrejection',event=>errors.push(event.reason));
 try{
  for(const src of scripts){
   if(src.includes('/vendor/supabase.js'))continue;
   const file=path.join(root,src.replace(/^\.\//,''));
   window.eval(fs.readFileSync(file,'utf8')+'\n//# sourceURL='+src);
  }
  await new Promise(resolve=>setTimeout(resolve,50));
  assert.equal(window.document.querySelector('#accountStatus').textContent,'Connected');
  assert.equal(window.document.querySelector('#authGate').style.display,'none');
  assert.ok(window.document.querySelector('#income').textContent.length>=0);
  assert.deepEqual(errors,[]);
 }finally{dom.window.close()}
});
