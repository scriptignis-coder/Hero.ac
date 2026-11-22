/**
 * v82.3 — a signature that cannot belong to a cheat is not sent to the scanner.
 *
 * ── WHAT WENT WRONG ─────────────────────────────────────────────────────────────────────────
 * A signature is just a row in a table, and anything can end up in it: a file dropped onto the
 * page to try the feature, a bad import, a rule somebody wrote while half asleep. One of those
 * was "Signatures / signatures.json". From then on every scan reported the player's own
 * signatures.json — and the operator's own project files — as a known cheat, six times over.
 *
 * Fixing the matcher was not enough. The matcher did exactly what the list told it to do, and
 * the list was wrong. A bad row keeps producing accusations until somebody notices and deletes
 * it, and the person who sees the accusation is usually not the person who can delete it.
 *
 * So the guard is here, on the feed the scanner reads. A name that cannot single out a cheat is
 * dropped before it ever reaches a player's PC, whatever is sitting in the database.
 *
 * ── WHAT IS DROPPED, AND WHY ────────────────────────────────────────────────────────────────
 *   data and source files      .json .js .ts .css .html .md .txt .csv .xml .yml .log .sql .map
 *                              Cheats ship as programs. These extensions are what every other
 *                              program on the disk is made of, including this very product.
 *   everyday file names        config.exe, update.exe, setup.exe, launcher.exe … the name says
 *                              nothing: a thousand innocent programs are called this.
 *
 * A file name being dropped does not drop the signature: a rule may list eulen.exe AND
 * eulen.json, and the first one is worth keeping. A signature is dropped only when nothing
 * usable is left — no file name, no hash, no domain — because at that point it can only ever
 * match by accident.
 *
 * Hashes and domains are never touched. A hash is the exact file and cannot be a coincidence.
 */

/** Extensions a cheat is not, and the rest of the disk is. */
const DATA_EXT = /\.(json|js|mjs|cjs|ts|tsx|jsx|css|scss|html?|md|txt|csv|xml|ya?ml|log|sql|map|ini|cfg|lock|svg|png|jpe?g|gif|ico|webp|woff2?|ttf|pdf|docx?|xlsx?)$/i;

/** Program names so ordinary that matching on them is matching on nothing. */
const GENERIC_NAMES = new Set([
  'config', 'settings', 'setup', 'install', 'installer', 'update', 'updater', 'launcher',
  'loader', 'main', 'app', 'index', 'start', 'run', 'client', 'server', 'service', 'helper',
  'tool', 'tools', 'script', 'data', 'test', 'temp', 'new', 'file', 'program', 'default',
  'signature', 'signatures', 'cheat', 'cheats', 'hack', 'hacks', 'menu', 'driver', 'drivers',
]);

const stem = (f) => String(f || '').replace(/\.[^.]*$/, '').toLowerCase().trim();

/** Why this file name cannot be used, or null if it is fine. */
export function fileNameProblem(f) {
  const name = String(f || '').trim().toLowerCase();
  if (!name) return 'empty';
  if (DATA_EXT.test(name)) return 'a data or source file, not a program';
  if (GENERIC_NAMES.has(stem(name))) return 'an everyday program name that matches innocent files';
  if (stem(name).length < 3) return 'too short to single out anything';
  return null;
}

/**
 * Returns the signature with unusable file names removed, plus what was removed and why.
 * `usable` is false when nothing is left that could ever match on purpose.
 */
export function guardSignature(sig) {
  const files = Array.isArray(sig.fileNames) ? sig.fileNames : (sig.file_names || []);
  const kept = [], dropped = [];
  for (const f of files) {
    const why = fileNameProblem(f);
    if (why) dropped.push({ file: f, why }); else kept.push(String(f).toLowerCase());
  }
  const hashes = sig.hashes || [];
  const domains = sig.domains || [];
  return {
    sig: { ...sig, fileNames: kept, file_names: kept },
    dropped,
    usable: kept.length > 0 || hashes.length > 0 || domains.length > 0,
  };
}

/** The whole list, cleaned. Nothing unusable survives. */
export function guardList(list) {
  const out = [];
  for (const s of list || []) {
    const g = guardSignature(s);
    if (g.usable) out.push(g.sig);
  }
  return out;
}

/** The problems in a list, for showing the operator what his own list is doing. */
export function auditList(list) {
  const problems = [];
  for (const s of list || []) {
    const g = guardSignature(s);
    if (g.dropped.length || !g.usable) {
      problems.push({ id: s.id, name: s.name, dropped: g.dropped, usable: g.usable });
    }
  }
  return problems;
}
