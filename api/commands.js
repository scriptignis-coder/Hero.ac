// FiveM: get pending dashboard commands (x-license header)
import { wrap, send, requireLicense, sb } from './_lib.js';

export default wrap(async (req, res) => {
  const server = await requireLicense(req);
  const since = Date.now() - 60000;
  const rows = await sb(`commands?server_id=eq.${server.id}&select=id,type,target,reason,created_at&order=created_at.asc&limit=20`);
  if (rows && rows.length) {
    await sb(`commands?id=in.(${rows.map((r) => r.id).join(',')})`, { method: 'DELETE' });
  }
  const commands = (rows || []).filter((r) => new Date(r.created_at).getTime() >= since);
  send(res, 200, { commands });
});
