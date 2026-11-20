import { wrap, send, sb, httpError } from './_lib.js';
// Read small, non-sensitive scan summaries from pc_history, never full scan_pins.report.
// Credit scanner-license owners, never scanned players; respect explicit opt-outs.
export function aggregateLeaderboard(optRows=[], scans=[], licenses=[], profiles=[], metric='checks') {
  const hidden = new Set(optRows.filter(x=>x.opted_in===false).map(x=>String(x.discord_id)));
  const owners = new Map(licenses.map(x=>[String(x.id),String(x.owner_discord||'')]));
  const people = new Map(profiles.map(x=>[String(x.discord_id),x]));
  const totals = new Map();
  for (const scan of scans) {
    const id=owners.get(String(scan.license_id||''));
    if (!id || !/^\d{17,20}$/.test(id) || hidden.has(id)) continue;
    const current=totals.get(id)||{checks:0,findings:0};
    current.checks++;
    current.findings+=Math.max(0,Math.min(10000,Number(scan.detections)||0));
    totals.set(id,current);
  }
  return [...totals].map(([id,t])=>{
    const p=people.get(id)||{};
    const name=String(p.name||'Staff member').slice(0,48);
    const url=String(p.avatar||'');
    const avatar=/^https:\/\/cdn\.discordapp\.com\/avatars\/\d+\/[\w.-]+\.(?:png|jpg|jpeg|webp)(?:\?size=\d+)?$/.test(url) && url.includes('/'+id+'/')?url:null;
    return {name,avatar,value:t[metric]};
  }).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name)).slice(0,20);
}
export default wrap(async(req,res)=>{
  if(req.method!=='GET')throw httpError(405,'GET only');
  const metric=String(req.query?.metric||'checks');
  if(!['checks','findings'].includes(metric))throw httpError(400,'Invalid metric');
  // All requested columns are scalar. Avoid report JSON and expensive joins.
  const [scans,licenses,optRows,profiles]=await Promise.all([
    sb('pc_history?select=license_id,detections&order=scanned_at.desc&limit=5000'),
    sb('scanner_licenses?select=id,owner_discord&limit=5000'),
    sb('leaderboard_optins?select=discord_id,opted_in&limit=5000'),
    sb('user_access?select=discord_id,name,avatar&limit=5000')
  ]);
  res.setHeader('Cache-Control','public, max-age=30');
  return send(res,200,{metric,entries:aggregateLeaderboard(optRows,scans,licenses,profiles,metric)});
});
