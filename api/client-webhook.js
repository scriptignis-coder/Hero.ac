import {wrap,send,requireUser,readBody,httpError,sb,enc,audit} from './_lib.js';
import {requireLicense} from './_license.js';
import {encryptUrl,validDiscordUrl} from './_client-webhook.js';
export default wrap(async(req,res)=>{
 const user=requireUser(req);await requireLicense(user);const owner=String(user.id);
 if(req.method==='GET'){const rows=await sb(`hs_client_webhooks?owner_discord=eq.${enc(owner)}&select=enabled&limit=1`);return send(res,200,{configured:!!rows?.length,enabled:!!rows?.[0]?.enabled});}
 if(req.method==='DELETE'){await sb(`hs_client_webhooks?owner_discord=eq.${enc(owner)}`,{method:'DELETE'});await audit(user,'webhook.remove',{target:owner});return send(res,200,{ok:true});}
 if(req.method!=='POST')throw httpError(405,'Method not allowed');
 const {url,enabled}=readBody(req);const old=await sb(`hs_client_webhooks?owner_discord=eq.${enc(owner)}&select=owner_discord&limit=1`);
 if(!url && old?.length){await sb(`hs_client_webhooks?owner_discord=eq.${enc(owner)}`,{method:'PATCH',body:{enabled:!!enabled}});return send(res,200,{ok:true});}
 if(!validDiscordUrl(url))throw httpError(400,'Enter a valid Discord webhook URL');
 await sb('hs_client_webhooks?on_conflict=owner_discord',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',body:{owner_discord:owner,url_encrypted:encryptUrl(url),enabled:!!enabled}});
 await audit(user,'webhook.update',{target:owner,detail:{enabled:!!enabled}});return send(res,200,{ok:true});
});
