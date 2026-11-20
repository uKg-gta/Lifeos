import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"GET, OPTIONS"};
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="GET")return new Response("Method not allowed",{status:405,headers:cors});
 const publicKey=Deno.env.get("VAPID_PUBLIC_KEY");
 if(!publicKey)return new Response(JSON.stringify({ready:false,message:"Push delivery is not configured yet."}),{status:503,headers:{...cors,"Content-Type":"application/json"}});
 return new Response(JSON.stringify({ready:true,publicKey}),{headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
});
