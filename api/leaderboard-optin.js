import { wrap, send, getSession, sb, readBody, httpError, enc } from './_lib.js';
export default wrap(async (req,res)=>{
  const u=getSession(req);
  if(!u || !/^\d{15,22}$/.test(String(u.id))) throw httpError(401,'Discord login required');
  const id=String(u.id);
  if(req.method==='GET'){
    const rows=await sb(`leaderboard_optins?discord_id=eq.${enc(id)}&select=opted_in`);
    return send(res,200,{opted_in:!!rows?.[0]?.opted_in});
  }
  if(req.method!=='POST') throw httpError(405,'Method not allowed');
  const body=readBody(req);
  if(typeof body?.opted_in!=='boolean') throw httpError(400,'opted_in must be boolean');
  await sb('leaderboard_optins?on_conflict=discord_id',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',body:{discord_id:id,opted_in:body.opted_in,updated_at:new Date().toISOString()}});
  return send(res,200,{opted_in:body.opted_in});
});
