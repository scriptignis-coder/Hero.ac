import { getSession, getAccess, httpError, wrap } from './_lib.js';
import { paidStatus } from './_billing.js';
export default wrap(async (req, res) => {
  const u = getSession(req);
  if (!u) throw httpError(401, 'Not logged in');
  const access = await getAccess(u);
  // Authorized scanner staff must not depend on the paid_entitlements table.
  if (access.admin || access.herocheck) {
    return res.status(200).json({ active: false, plan: null, lifetime: false, expires_at: null, staffAccess: true });
  }
  res.status(200).json({ ...await paidStatus(String(u.id)), staffAccess: false });
});
