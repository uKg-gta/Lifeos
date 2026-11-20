import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const local=(d:Date,tz:string)=>Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d).map(p=>[p.type,p.value]));
const quiet=(hour:number,start:string,end:string)=>{const m=(v:string)=>{const [h,n]=v.split(":").map(Number);return h*60+n};const now=hour*60,a=m(start),b=m(end);return a===b?false:a<b?now>=a&&now<b:now>=a||now<b};
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const secret=Deno.env.get("PUSH_CRON_SECRET");if(!secret||req.headers.get("Authorization")!==`Bearer ${secret}`)return json({error:"Unauthorized"},401);
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),pub=Deno.env.get("VAPID_PUBLIC_KEY"),priv=Deno.env.get("VAPID_PRIVATE_KEY");
 if(!url||!key||!pub||!priv)return json({error:"Push secrets are not configured"},503);
 webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")||"mailto:lifeos@example.com",pub,priv);
 const db=createClient(url,key,{auth:{persistSession:false}}),{data:prefs,error}=await db.from("lifeos_push_preferences").select("*").eq("enabled",true);
 if(error)return json({error:error.message},500);
 let sent=0,removed=0,skipped=0;const now=new Date();
 for(const p of prefs||[]){
  let x:Record<string,string>;try{x=local(now,p.timezone||"Asia/Kolkata")}catch{skipped++;continue}
  const hour=Number(x.hour),today=`${x.year}-${x.month}-${x.day}`;
  if(quiet(hour,String(p.quiet_start).slice(0,5),String(p.quiet_end).slice(0,5))){skipped++;continue}
  const {data:r}=await db.from("lifeos_workspace").select("data").eq("user_id",p.user_id).maybeSingle(),w=r?.data?.workspace||{},cats=p.categories||{};
  const items:Array<{category:string;key:string;title:string;body:string}>=[];
  if(hour===8&&cats.tasks!==false)for(const t of w.tasks||[])if(t.status!=="done"&&t.due&&t.due<=today)items.push({category:"tasks",key:`${today}:task:${t.id}:${t.due}`,title:"Task due",body:t.title||"You have a task due."});
  if(hour===8&&cats.exams!==false)for(const e of w.exams||[])if(e.date){const days=Math.ceil((Date.parse(e.date+"T00:00:00Z")-Date.parse(today+"T00:00:00Z"))/86400000);if(days>=0&&days<=7)items.push({category:"exams",key:`${today}:exam:${e.name}`,title:"Exam coming up",body:`${e.name} is ${days===0?"today":days===1?"tomorrow":`in ${days} days`}.`})}
  if(hour===8&&cats.habits!==false){const pending=(w.habits||[]).filter((h:any)=>(h.frequency!=="selected"||(h.days||[]).includes(new Date(today+"T12:00:00").getDay()))&&h.doneDate!==today);if(pending.length)items.push({category:"habits",key:`${today}:habits`,title:"Habit check-in",body:`${pending.length} habit(s) still to complete today.`})}
  if(hour===19&&cats.study!==false&&!((w.sessions||[]).some((s:any)=>s.date===today)))items.push({category:"study",key:`${today}:study`,title:"Study reminder",body:"Your daily study session is still waiting. Start with one focused block."});
  if(!items.length){skipped++;continue}
  const {data:subs}=await db.from("lifeos_push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id",p.user_id);if(!subs?.length){skipped++;continue}
  for(const item of items){
   const {data:old}=await db.from("lifeos_push_delivery_log").select("id").eq("user_id",p.user_id).eq("category",item.category).eq("reminder_key",item.key).maybeSingle();if(old)continue;
   let ok=false;for(const s of subs)try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({...item,url:"./"}),{TTL:3600});ok=true}catch(e){const status=(e as any)?.statusCode;if(status===404||status===410){await db.from("lifeos_push_subscriptions").delete().eq("id",s.id);removed++}}
   if(ok){const {error:e}=await db.from("lifeos_push_delivery_log").insert({user_id:p.user_id,category:item.category,reminder_key:item.key});if(!e)sent++}
  }
 }
 return json({ok:true,sent,removed,skipped});
});
