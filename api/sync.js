// FiveM: unbans + settings from the dashboard
import { wrap, send, requireLicense, sb } from './_lib.js';

export default wrap(async (req, res) => {
  const server = await requireLicense(req);
  const [info] = await sb(`servers?id=eq.${server.id}&select=settings`);
  const rows = await sb(`bans?server_id=eq.${server.id}&unban_pending=eq.true&select=id,ban_id`);
  const unbans = (rows || []).map((r) => r.ban_id);
  if (rows && rows.length) {
    await sb(`bans?id=in.(${rows.map((r) => r.id).join(',')})`, {
      method: 'PATCH',
      body: { unban_pending: false },
    });
  }
  send(res, 200, { ok: true, server: server.name, unbans, settings: (info && info.settings) || {} });
});
