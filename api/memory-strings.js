import { wrap, send, requireAccess, readBody, sb, enc, str, httpError, audit } from './_lib.js';

// Memory strings: "find THIS text inside THAT process".
// Owner-scoped, exactly like signatures. The scanner reads them through api/scanner-strings.js.

// The services the scanner already opens on every scan. Anything else is a process the operator
// added themselves, and the scanner only looks inside it if it is running at the time.
const BUILTIN = ['dps', 'pcasvc', 'sysmain', 'dnscache', 'explorer'];

// Reading another program's memory is a real thing to ask for, so these are refused: they are
// not where a cheat keeps its secrets, and naming them would only slow the scan down.
const BLOCKED = ['system', 'csrss.exe', 'wininit.exe', 'smss.exe', 'lsass.exe', 'services.exe', 'winlogon.exe'];

const cleanProcess = (v) => str(v, 60).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');

export default wrap(async (req, res) => {
  const user = await requireAccess(req, 'herocheck');

  if (req.method === 'GET') {
    const strings = await sb(`memory_strings?owner_discord=eq.${enc(user.id)}&select=*&order=created_at.desc&limit=500`);
    const procs = await sb(`memory_processes?owner_discord=eq.${enc(user.id)}&select=*&order=created_at.asc`);
    return send(res, 200, {
      strings: strings || [],
      processes: (procs || []).map((p) => p.process_name),
      builtin: BUILTIN,
    });
  }

  if (req.method === 'POST') {
    const b = readBody(req);

    // ── add a process to scan ────────────────────────────────────────────
    if (b.action === 'add_process') {
      const name = cleanProcess(b.process);
      if (!name) throw httpError(400, 'Enter a process name, for example discord.exe');
      if (BLOCKED.includes(name)) throw httpError(400, `${name} is a Windows core process. Its memory is not where a cheat keeps anything, and it cannot be read.`);
      if (BUILTIN.includes(name.replace(/\.exe$/, ''))) throw httpError(400, `${name} is already scanned on every check — you can use it straight away.`);
      await sb('memory_processes', { method: 'POST', body: { owner_discord: user.id, process_name: name }, prefer: 'return=minimal' })
        .catch((e) => { if (!/duplicate|unique/i.test(e.message)) throw e; });
      await audit(user, 'memory_process.add', { target: name });
      return send(res, 200, { ok: true });
    }

    if (b.action === 'remove_process') {
      const name = cleanProcess(b.process);
      await sb(`memory_processes?owner_discord=eq.${enc(user.id)}&process_name=eq.${enc(name)}`, { method: 'DELETE', prefer: 'return=minimal' });
      return send(res, 200, { ok: true });
    }

    // ── add one string, or many at once ──────────────────────────────────
    // bulk text is "Client Name::String", one per line — the same shape the Import box shows.
    const rows = [];
    const push = (process, client, value, severity) => {
      const p = cleanProcess(process);
      const v = str(value, 400).trim();
      if (!p || v.length < 3) return;
      rows.push({
        owner_discord: user.id,
        process_name: p,
        client_name: str(client, 80).trim(),
        string: v,
        severity: severity === 'warning' ? 'warning' : 'detect',
      });
    };

    if (typeof b.bulk === 'string' && b.bulk.trim()) {
      for (const line of b.bulk.split('\n').slice(0, 500)) {
        const t = line.trim();
        if (!t) continue;
        const i = t.indexOf('::');
        if (i < 0) { push(b.process, '', t, b.severity); continue; }
        push(b.process, t.slice(0, i), t.slice(i + 2), b.severity);
      }
      if (!rows.length) throw httpError(400, 'Nothing to import. Each line is “Client Name::String”, or just the string on its own.');
    } else {
      push(b.process, b.clientName, b.string, b.severity);
      if (!rows.length) throw httpError(400, 'Pick a process and enter a string of at least 3 characters.');
    }

    // a string this short matches stray bytes in almost any program
    for (const r of rows) {
      if (r.string.length < 3) throw httpError(400, `“${r.string}” is too short to look for in memory.`);
    }

    let added = 0;
    for (const r of rows) {
      try { await sb('memory_strings', { method: 'POST', body: r, prefer: 'return=minimal' }); added++; }
      catch (e) { if (!/duplicate|unique/i.test(e.message)) throw e; }   // already there: not an error
    }
    await audit(user, 'memory_string.add', { target: String(added), detail: { process: rows[0]?.process_name } });
    return send(res, 200, { ok: true, added, skipped: rows.length - added });
  }

  if (req.method === 'DELETE') {
    await sb(`memory_strings?id=eq.${enc(req.query.id)}&owner_discord=eq.${enc(user.id)}`, { method: 'DELETE', prefer: 'return=minimal' });
    return send(res, 200, { ok: true });
  }

  throw httpError(405, 'Method not allowed');
});
