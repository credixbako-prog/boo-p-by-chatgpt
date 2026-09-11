const PROJECT = 'boo-p-a4461';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function cleanPreferences(value) {
  return Object.fromEntries(['friends','traces','encouragements','clubs','salons','goals'].map(key=>[key,value?.[key] !== false]));
}
export function permits(preferences,type) {
  const key = {friend:'friends',trace:'traces',encouragement:'encouragements'}[type];
  return !key || preferences?.[key] !== false;
}
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const encode = value => b64(new TextEncoder().encode(JSON.stringify(value)));
export async function googleAccessToken(account,http,cryptoImpl=crypto) {
  if (account.project_id !== PROJECT || !account.client_email?.endsWith('.iam.gserviceaccount.com') || !account.private_key) throw new Error('firebase_config');
  const now = Math.floor(Date.now()/1000);
  const input = encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:account.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const pem = account.private_key.replace(/-----[^-]+-----|\s/g,'');
  const key = await cryptoImpl.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature = new Uint8Array(await cryptoImpl.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(input)));
  const response = await http('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:input+'.'+b64(signature)})});
  if (!response.ok) throw new Error('firebase_auth');
  const result = await response.json();
  if (!result.access_token) throw new Error('firebase_auth');
  return result.access_token;
}
export function createHandler({env,fetchImpl=fetch,getGoogleToken=googleAccessToken}) {
  let cachedToken,validUntil=0;
  return async req => {
    const origin=req.headers.get('origin') || '';
    const allowed=origin==='https://credixbako-prog.github.io' || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(allowed?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})};
    const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
    if(origin&&!allowed)return reply({error:'Origine non autorisée.'},403);
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(req.method!=='POST')return reply({error:'Méthode non autorisée.'},405);
    let claimedJob;
    const sb=env('SUPABASE_URL'),service=env('SUPABASE_SERVICE_ROLE_KEY');
    const http=(url,options={})=>fetchImpl(url,{...options,signal:AbortSignal.timeout(12000)});
    const db=async(path,method='GET',body,returnRows=false)=>{
      const response=await http(`${sb}/rest/v1/${path}`,{method,headers:{apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json',...(returnRows?{Prefer:'return=representation'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
      if(!response.ok)throw new Error('database');
      return response.status===204?null:response.json().catch(()=>null);
    };
    try {
      if(!sb||!service)return reply({error:'Configuration serveur indisponible.'},503);
      const raw=await req.text();if(raw.length>6500)return reply({error:'Demande trop longue.'},413);
      let body;try{body=JSON.parse(raw);}catch{return reply({error:'Demande invalide.'},400);}
      const firebase=env('FIREBASE_SERVICE_ACCOUNT');
      let user;
      if(body.action!=='dispatch') {
        const authorization=req.headers.get('authorization')||'';
        if(!/^Bearer \S+$/.test(authorization))return reply({error:'Connectez-vous à BOO-P.'},401);
        const auth=await http(`${sb}/auth/v1/user`,{headers:{apikey:service,Authorization:authorization}});
        if(!auth.ok)return reply({error:'Session expirée. Reconnectez-vous.'},401);
        user=await auth.json();
        if(!UUID.test(user.id)||user.is_anonymous)return reply({error:'Un compte BOO-P est nécessaire.'},403);
      }
      if(body.action==='status') {
        let ready=false;try{const a=JSON.parse(firebase);ready=a.project_id===PROJECT&&Boolean(a.client_email&&a.private_key);}catch{}
        return reply({ready});
      }
      if(body.action==='preferences') {
        await db(`push_devices?user_id=eq.${user.id}`,'PATCH',{preferences:cleanPreferences(body.preferences)});
        return reply({ok:true});
      }
      if(body.action==='disable') {
        if(!UUID.test(body.deviceId))return reply({error:'Appareil invalide.'},400);
        await db(`push_devices?device_id=eq.${body.deviceId}&user_id=eq.${user.id}`,'DELETE');
        return reply({ok:true});
      }
      if(!['register','test','dispatch'].includes(body.action))return reply({error:'Action invalide.'},400);
      if(!firebase)return reply({error:'Ajoutez FIREBASE_SERVICE_ACCOUNT dans les secrets Supabase.'},503);
      if(body.action==='register') {
        if(!UUID.test(body.deviceId)||typeof body.token!=='string'||!/^[\w:.-]{20,4096}$/.test(body.token))return reply({error:'Inscription de l’appareil invalide.'},400);
        await db('rpc/register_boop_push_device','POST',{p_user:user.id,p_device:body.deviceId,p_token:body.token,p_preferences:cleanPreferences(body.preferences)});
        return reply({ok:true});
      }
      let devices,notification;
      if(body.action==='test') {
        if(!UUID.test(body.deviceId))return reply({error:'Appareil invalide.'},400);
        devices=await db(`push_devices?device_id=eq.${body.deviceId}&user_id=eq.${user.id}&last_test_at=lt.${encodeURIComponent(new Date(Date.now()-60000).toISOString())}`,'PATCH',{last_test_at:new Date().toISOString()},true);
        if(!devices?.length)return reply({error:'Activez cet appareil ou attendez une minute avant un nouveau test.'},429);
        notification={id:crypto.randomUUID(),recipient_id:user.id,route:'#profile?section=settings',type:'info'};
      } else {
        if(!UUID.test(body.jobId)||!UUID.test(body.capability))return reply({error:'Envoi non autorisé.'},403);
        const jobs=await db(`push_jobs?id=eq.${body.jobId}&capability=eq.${body.capability}&status=eq.pending&created_at=gt.${encodeURIComponent(new Date(Date.now()-3600000).toISOString())}`,'PATCH',{status:'sending'},true);
        if(!jobs?.length)return reply({error:'Envoi expiré ou déjà traité.'},403);
        claimedJob=jobs[0].id;
        [notification]=await db(`notifications?id=eq.${jobs[0].notification_id}&select=id,recipient_id,type,route,read_at`);
        devices=notification&&!notification.read_at?await db(`push_devices?user_id=eq.${notification.recipient_id}&updated_at=gt.${encodeURIComponent(new Date(Date.now()-60*86400000).toISOString())}`):[];
        devices=devices.filter(device=>permits(device.preferences,notification.type));
      }
      let sent=0,failed=0;
      // Validate the configured sender even if a queued recipient just unsubscribed.
      if(!cachedToken||Date.now()>validUntil){cachedToken=await getGoogleToken(JSON.parse(firebase),http);validUntil=Date.now()+3000000;}
      if(devices.length) {
        for(const device of devices) {
          // Recheck revocation immediately before sending an already queued alert.
          const active=await db(`push_devices?device_id=eq.${device.device_id}&user_id=eq.${device.user_id}&select=device_id`);
          if(!active.length)continue;
          const result=await http(`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`,{method:'POST',headers:{Authorization:`Bearer ${cachedToken}`,'Content-Type':'application/json'},body:JSON.stringify({message:{token:device.token,data:{boop:'1',owner:device.user_id,id:String(notification.id),route:notification.route,test:body.action==='test'?'1':'0'},webpush:{headers:{TTL:'3600',Urgency:'normal'}}}})});
          if(result.ok){sent++;continue;}
          failed++;
          const error=await result.json().catch(()=>({}));
          if(error.error?.details?.some(item=>item.errorCode==='UNREGISTERED'))await db(`push_devices?device_id=eq.${device.device_id}&token=eq.${encodeURIComponent(device.token)}`,'DELETE');
          if(result.status===401)validUntil=0;
        }
      }
      if(claimedJob)await db(`push_jobs?id=eq.${claimedJob}`,'PATCH',{status:failed?'failed':'sent',completed_at:new Date().toISOString()});
      if(failed)return reply({error:'Firebase n’a pas pu livrer la notification. Vérifiez la clé serveur et réactivez cet appareil.'},502);
      return reply({ok:true,sent});
    } catch {
      if(claimedJob)await db(`push_jobs?id=eq.${claimedJob}`,'PATCH',{status:'failed',completed_at:new Date().toISOString()}).catch(()=>{});
      return reply({error:'Envoi indisponible. Vérifiez la configuration Firebase et réessayez.'},502);
    }
  };
}
