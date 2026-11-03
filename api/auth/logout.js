import { clearSession } from '../_lib.js';

export default function handler(req, res) {
  clearSession(res);
  res.writeHead(302, { Location: '/' });
  res.end();
}
