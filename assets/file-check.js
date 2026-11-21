/* HeRo Shield — File Check.
 *
 * Drop an .exe, .dll, .sys or .jar on the page and it says whether the file is a cheat, with
 * the reasons.
 *
 * It runs ENTIRELY IN THE BROWSER. The file is read with FileReader and never uploaded: the
 * hashes, the import table and the strings are all worked out on this machine. That is not a
 * shortcut, it is the point — staff drop files they were sent by strangers into this box, and
 * a tool that quietly ships those to a server is a tool nobody should trust with them.
 *
 * How it decides, in order of how much a finding is worth:
 *
 *   1. SHA-256 against the operator's own signature list   — an exact match is certainty
 *   2. What the program is WIRED TO DO, from its import table — opening another process and
 *      writing into its memory is what a cheat does and what almost nothing else does
 *   3. Brand markers in the strings — a lead, never proof on its own
 *
 * The order matters. Judging a file by the words inside it is what produced reports that
 * accused people over a single-player mod's effect list; here the words can only ever raise a
 * file to "suspicious", and the verdict "cheat" has to be earned by the first two.
 */
(function (w) {
  'use strict';

  // ── hashing ────────────────────────────────────────────────────────────────────────────
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

  async function sha(algo, bytes) {
    try { return hex(await crypto.subtle.digest(algo, bytes)); } catch { return null; }
  }

  // MD5 is not in SubtleCrypto (it is broken for security and browsers dropped it), but it is
  // still what most malware lists are keyed by, so it is computed here. It is used for LOOKUP
  // ONLY — never to decide anything — because two different files can share an MD5.
  function md5(bytes) {
    const S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22, 5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
               4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23, 6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
    const K = new Uint32Array(64);
    for (let i = 0; i < 64; i++) K[i] = (Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
    const len = bytes.length;
    const withPad = new Uint8Array((((len + 8) >> 6) + 1) << 6);
    withPad.set(bytes);
    withPad[len] = 0x80;
    const bits = len * 8;
    new DataView(withPad.buffer).setUint32(withPad.length - 8, bits >>> 0, true);
    new DataView(withPad.buffer).setUint32(withPad.length - 4, Math.floor(bits / 4294967296), true);

    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    const M = new Uint32Array(16);
    const view = new DataView(withPad.buffer);
    const rol = (x, c) => (x << c) | (x >>> (32 - c));

    for (let off = 0; off < withPad.length; off += 64) {
      for (let i = 0; i < 16; i++) M[i] = view.getUint32(off + i * 4, true);
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16)      { F = (B & C) | (~B & D);      g = i; }
        else if (i < 32) { F = (D & B) | (~D & C);      g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D;               g = (3 * i + 5) % 16; }
        else             { F = C ^ (B | ~D);            g = (7 * i) % 16; }
        F = (F + A + K[i] + M[g]) >>> 0;
        A = D; D = C; C = B;
        B = (B + rol(F, S[i])) >>> 0;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    const out = new Uint8Array(16);
    new DataView(out.buffer).setUint32(0, a0, true);
    new DataView(out.buffer).setUint32(4, b0, true);
    new DataView(out.buffer).setUint32(8, c0, true);
    new DataView(out.buffer).setUint32(12, d0, true);
    return hex(out.buffer);
  }

  // ── the import table ───────────────────────────────────────────────────────────────────
  // A port of the scanner's PeBehaviour, checked against pefile on real 32- and 64-bit
  // binaries: same algorithm, so the website and the exe agree about what a file does.

  const API = [
    ['writeprocessmemory',   "writes into another program's memory",            'write'],
    ['ntwritevirtualmemory', "writes into another program's memory (native)",   'write'],
    ['virtualallocex',       'allocates memory inside another program',         'write'],
    ['createremotethread',   'starts code running inside another program',      'inject'],
    ['ntcreatethreadex',     'starts code running inside another program',      'inject'],
    ['queueuserapc',         "queues code into another program's thread",       'inject'],
    ['ntmapviewofsection',   'maps its own memory into another program',        'inject'],
    ['setwindowshookex',     "hooks another program's keyboard or mouse",       'hook'],
    ['ntloaddriver',         'loads a kernel driver',                           'driver'],
    ['readprocessmemory',    "reads another program's memory",                  'read'],
    ['openprocess',          'opens another program',                           'open'],
  ];

  const TARGETS = [
    ['gta5.exe', 'GTA V'], ['fivem_gtaprocess.exe', 'FiveM'], ['fivem.exe', 'FiveM'],
    ['rdr2.exe', 'RDR2'], ['redm.exe', 'RedM'], ['javaw.exe', 'Minecraft'],
    ['robloxplayerbeta.exe', 'Roblox'], ['cs2.exe', 'CS'],
  ];

  function imports(b) {
    try {
      const d = new DataView(b.buffer, b.byteOffset, b.byteLength);
      if (b.length < 0x40 || b[0] !== 0x4d || b[1] !== 0x5a) return null;   // MZ
      const pe = d.getInt32(0x3c, true);
      if (pe <= 0 || pe + 0x78 >= b.length || d.getUint32(pe, true) !== 0x4550) return null;
      const opt = pe + 24;
      const plus = d.getUint16(opt, true) === 0x20b;
      const importRva = d.getInt32(opt + (plus ? 112 : 96) + 8, true);
      if (!importRva) return [];

      const nSec = d.getUint16(pe + 6, true), optSize = d.getUint16(pe + 20, true);
      const secTable = opt + optSize, secs = [];
      for (let i = 0; i < nSec; i++) {
        const s = secTable + i * 40;
        if (s + 40 > b.length) break;
        secs.push([d.getUint32(s + 12, true), d.getUint32(s + 8, true),
                   d.getUint32(s + 20, true), d.getUint32(s + 16, true)]);
      }
      const off = (rva) => {
        for (const [va, vsz, raw, rsz] of secs)
          if (rva >= va && rva < va + Math.max(vsz, rsz)) return raw + (rva - va);
        return -1;
      };
      const str = (o) => {
        if (o < 0 || o >= b.length) return null;
        let e = o;
        while (e < b.length && b[e] !== 0 && e - o < 128) e++;
        return String.fromCharCode.apply(null, b.subarray(o, e));
      };

      const names = [];
      const base = off(importRva);
      if (base < 0) return [];
      for (let i = 0; i < 256; i++) {
        const rec = base + i * 20;
        if (rec + 20 > b.length) break;
        const lookup = d.getUint32(rec, true), first = d.getUint32(rec + 16, true);
        if (!lookup && !first) break;
        let t = off(lookup || first);
        if (t < 0) continue;
        const step = plus ? 8 : 4;
        for (let k = 0; k < 4096; k++) {
          const at = t + k * step;
          if (at + step > b.length) break;
          const entry = plus ? d.getBigUint64(at, true) : BigInt(d.getUint32(at, true));
          if (entry === 0n) break;
          const ordinal = plus ? 0x8000000000000000n : 0x80000000n;
          if (entry & ordinal) continue;
          const nm = str(off(Number(entry & 0x7fffffffn)) + 2);
          if (nm) names.push(nm);
          if (names.length > 20000) return names;
        }
      }
      return names;
    } catch { return null; }
  }

  /** Printable ASCII runs, lowercased. */
  function strings(b, cap) {
    const out = [];
    let cur = [];
    const n = Math.min(b.length, cap || 24 * 1024 * 1024);
    for (let i = 0; i < n; i++) {
      const c = b[i];
      if (c >= 32 && c < 127) { cur.push(String.fromCharCode(c)); if (cur.length > 400) cur.shift(); }
      else { if (cur.length >= 6) out.push(cur.join('').toLowerCase()); cur = []; }
    }
    if (cur.length >= 6) out.push(cur.join('').toLowerCase());
    return out.join('\n');
  }

  // Brand markers only — the same conservative list the scanner ships. Feature words such as
  // "aimbot" or "wallhack" are deliberately absent: they live in anti-cheat blocklists, in
  // single-player mod menus and in saved web pages, and matching them is how clean people end
  // up in a report.
  const MARKERS = [
    ['eulen.cc', 'Eulen'], ['eulencheats', 'Eulen'], ['skript.gg', 'Skript'],
    ['redengine.io', 'RedEngine'], ['hx-software', 'HX Software'], ['2take1menu', '2Take1'],
    ['kiddions mod menu', 'Kiddions'], ['wurstclient.net', 'Wurst'],
    ['meteorclient.com', 'Meteor'], ['liquidbounce.net', 'LiquidBounce'],
    ['impactclient.net', 'Impact'], ['aristois.net', 'Aristois'],
    ['synapse x', 'Synapse X'], ['script-ware', 'Script-Ware'], ['krnl executor', 'KRNL'],
    ['fluxus executor', 'Fluxus'], ['delta executor', 'Delta'],
    ['hwid spoofer', 'Spoofer'], ['smbios spoofer', 'Spoofer'], ['kdmapper', 'Mapper'],
    ['your hwid is not whitelisted', null],
  ];

  /**
   * @param {File} file
   * @param {(p:number,label:string)=>void} onProgress
   * @param {Array<{sha256?:string,name?:string,label?:string}>} sigs  the operator's own list
   */
  async function analyze(file, onProgress, sigs) {
    const step = (p, l) => onProgress && onProgress(p, l);
    step(0.05, 'Reading the file');
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);

    step(0.3, 'Hashing');
    const sha256 = await sha('SHA-256', buf);
    const sha1 = await sha('SHA-1', buf);
    const md5sum = md5(bytes);

    step(0.55, 'Reading the import table');
    const imps = imports(bytes);
    const flags = new Set();
    const does = [];
    for (const nm of imps || []) {
      const low = nm.toLowerCase();
      for (const [fn, means, flag] of API) {
        if (!low.startsWith(fn)) continue;
        flags.add(flag);
        if (flag !== 'open' && !does.includes(means)) does.push(means);
      }
    }

    step(0.75, 'Reading the strings');
    const text = strings(bytes);
    let target = null;
    for (const [needle, game] of TARGETS) if (text.includes(needle)) { target = game; break; }
    const markers = [];
    for (const [needle, brand] of MARKERS)
      if (text.includes(needle)) markers.push({ needle, brand });

    step(0.92, 'Deciding');
    const known = (sigs || []).find((s) => s.sha256 && sha256 && s.sha256.toLowerCase() === sha256);
    const touches = flags.has('write') || flags.has('inject') || flags.has('driver') || flags.has('hook') || flags.has('read');
    const reaches = !!target && (flags.has('write') || flags.has('inject') || flags.has('driver') || flags.has('hook'));

    let verdict, why;
    if (known) {
      verdict = 'cheat';
      why = [`Exact SHA-256 match with your signature "${known.label || known.name || 'known cheat'}".`];
    } else if (reaches) {
      verdict = 'cheat';
      why = [`It reaches into ${target}: ` + does.join(', ') + '.',
             'Writing into a running game from outside is what a cheat does and what almost nothing else does.'];
    } else if (touches) {
      verdict = 'suspicious';
      why = ['It reaches into other programs (' + does.join(', ') + ') but never names a game.',
             'Debuggers, anti-cheats and some installers do this too — find out what it is before acting on it.'];
    } else if (markers.length) {
      verdict = 'suspicious';
      why = ['It mentions ' + [...new Set(markers.map((m) => m.brand || m.needle))].join(', ') + '.',
             'A name inside a file is a lead, not proof: blocklists and saved pages contain the same words.'];
    } else {
      verdict = 'clean';
      why = imps === null
        ? ['Not a Windows program this can read, and nothing known about it.']
        : ['It never touches another program\'s memory, loads no driver, and carries no cheat marker.'];
    }

    step(1, 'Done');
    return {
      name: file.name, size: file.size,
      md5: md5sum, sha1, sha256,
      isPe: imps !== null, importCount: (imps || []).length,
      does, target, markers, verdict, why,
      knownAs: known ? (known.label || known.name || null) : null,
    };
  }

  w.HSFileCheck = { analyze, md5, imports, strings };
})(window);
