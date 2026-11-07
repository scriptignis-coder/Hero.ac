import { wrap, send, sb, httpError } from './_lib.js';
// Public aggregate only. Never return raw scan reports, Discord IDs, PINs or unconsented players.
export function aggregateLeaderboard(optins, pins, metric='checks') {
  const allowed=new Set((optins||[]).filter(x=>x.opted_in===true).map(x=>String(x.discord_id)));
  const users=new Map();
  for(const row of pins||[]){
    if(!row.used || !row.report || typeof row.report !== 'object')continue;
    const user=row.discord_check?.user;
    const id=String(user?.id||'');
    if(!allowed.has(id))continue;
    const name=String(user.name||user.username||'Discord user').slice(0,48);
    // Discord avatar URL must originate from the verified OAuth result and match this user ID.
    const url=String(user.avatar||'');
    const avatar=url.startsWith(`https://cdn.discordapp.com/avatars/${id}/`) && /^https:\/\/cdn\.discordapp\.com\/avatars\/\d+\/[\w.-]+\.png(?:\?size=\d+)?$/.test(url) ? url : null;
    const det=row.report.Detections||row.report.detections;
    // Count scanner findings; never label people cheaters or claim a confirmed violation.
    const findings=Array.isArray(det)?Math.min(det.length,2000):0;
    const old=users.get(id)||{name,avatar,checks:0,findings:0};
    old.name=name;old.avatar=avatar;old.checks++;old.findings+=findings;users.set(id,old);
  }
  const key=metric==='findings'?'findings':'checks';
  return [...users.values()].map(x=>({name:x.name,avatar:x.avatar,value:x[key]})).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name)).slice(0,20);
}
export default wrap(async (req,res)=>{
  if(req.method!=='GET')throw httpError(405,'GET only');
  const metric=String(req.query?.metric||'checks');
  if(!['checks','findings'].includes(metric))throw httpError(400,'Invalid metric');
  const optins=await sb('leaderboard_optins?opted_in=eq.true&select=discord_id,opted_in&limit=2000');
  if(!optins?.length)return send(res,200,{metric,entries:[]});
  // Bounded read; for large sites replace with paginated server-side SQL aggregation.
  const pins=await sb('scan_pins?used=eq.true&select=used,report,discord_check&order=created_at.desc&limit=1000');
  res.setHeader('Cache-Control','public, max-age=30');
  return send(res,200,{metric,entries:aggregateLeaderboard(optins,pins,metric)});
});
