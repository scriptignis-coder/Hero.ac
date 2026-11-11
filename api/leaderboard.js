import { wrap, send, sb, httpError } from './_lib.js';
// Public aggregate only. Never return raw scan reports, Discord IDs, PINs or unconsented players.
// v28: every staff member with a scanner license is on the leaderboard automatically (no "join" button).
// Only the scanner license OWNER (staff) is credited — never the scanned player.
// Someone who explicitly left before (opted_in = false) stays hidden.
export function aggregateLeaderboard(optRows, pins, metric='checks', licenses=[], profiles=[]) {
  const hidden=new Set((optRows||[]).filter(x=>x.opted_in===false).map(x=>String(x.discord_id)));
  const licenseOwners=new Map((licenses||[]).map(x=>[String(x.id),String(x.owner_discord)]));
  const profileMap=new Map((profiles||[]).map(x=>[String(x.discord_id),x]));
  const users=new Map();
  for(const row of pins||[]){
    if(!row.used || !row.report || typeof row.report !== 'object')continue;
    const id=String(licenseOwners.get(String(row.license_id)) || '');
    if(!/^\d{17,20}$/.test(id) || hidden.has(id))continue;
    const profile=profileMap.get(id)||{};
    const name=String(profile.name||'Staff member').slice(0,48);
    const url=String(profile.avatar||'');
    const avatar=url.startsWith(`https://cdn.discordapp.com/avatars/${id}/`) && /^https:\/\/cdn\.discordapp\.com\/avatars\/\d+\/[\w.-]+\.(?:png|jpg|jpeg|webp)(?:\?size=\d+)?$/.test(url) ? url : null;
    const det=row.report.Detections||row.report.detections;
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
  const optRows=await sb('leaderboard_optins?opted_in=eq.false&select=discord_id,opted_in&limit=5000').catch(()=>[]);
  // Bounded read; for large sites replace with paginated server-side SQL aggregation.
  const pins=await sb('scan_pins?used=eq.true&select=used,report,discord_check,license_id&order=created_at.desc&limit=1000');
  const licenses=await sb('scanner_licenses?select=id,owner_discord&limit=5000');
  const profiles=await sb('user_access?select=discord_id,name,avatar&limit=5000');
  res.setHeader('Cache-Control','public, max-age=30');
  return send(res,200,{metric,entries:aggregateLeaderboard(optRows,pins,metric,licenses,profiles)});
});
