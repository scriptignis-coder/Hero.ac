import { getSession, httpError, wrap } from './_lib.js';
import { paidStatus } from './_billing.js';
export default wrap(async(req,res)=>{ const u=getSession(req); if(!u) throw httpError(401,'Not logged in'); res.status(200).json(await paidStatus(String(u.id))); });
