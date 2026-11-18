import { sb, enc } from './_lib.js';
import { idsFromReport } from './_pchistory.js';

// Recognising the licence holder's OWN PC.
//
// The first version of this compared the Discord account signed in on the scanned machine with
// the account the licence belongs to. That works until somebody signs out of Discord, and
// signing out takes one click — so on its own it catches nobody who is trying.
//
// The scanner already reads five things that identify the machine itself: the HWID, the Windows
// machine GUID, the motherboard UUID, the BIOS serial and the disk serials. Those do not change
// when you sign out of anything. Once a licence holder's own PC has been seen, every later scan
// on that same machine is known to be their own, whatever account is signed in.
//
// Two identifiers must match, never one. A single shared value happens: two PCs from the same
// batch can carry the same useless BIOS string, and the junk filter in _pchistory.js does not
// catch every one of them. Two matching is a machine, not a coincidence.
//
// What this does NOT claim: it is not proof of anything, and it is not unbeatable. A second PC,
// a virtual machine or spoofed identifiers all defeat it. It is here to make the ordinary case
// visible, not to win an arms race — the heartbeat is what does not depend on identity at all.

const MIN_OVERLAP = 2;

/** Remember this machine as the owner's. Called when a scan is known to be a self-scan. */
export async function rememberOwnPc(ownerDiscord, report) {
  const ids = idsFromReport(report);
  if (!ownerDiscord || ids.length < MIN_OVERLAP) return;
  try {
    await sb('hs_owner_machines?on_conflict=owner_discord,ident', {
      method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
      body: ids.map((ident) => ({
        owner_discord: String(ownerDiscord), ident, last_seen: new Date().toISOString(),
      })),
    });
  } catch { }       // before the v36 migration: nothing is remembered, nothing breaks
}

/**
 * Is this scan running on a machine already known to be the owner's?
 * Returns true only when at least MIN_OVERLAP identifiers match.
 */
export async function isOwnPc(ownerDiscord, report) {
  const ids = idsFromReport(report);
  if (!ownerDiscord || ids.length < MIN_OVERLAP) return false;
  try {
    const rows = await sb(`hs_owner_machines?owner_discord=eq.${enc(String(ownerDiscord))}`
      + `&ident=in.(${ids.map((i) => enc(i)).join(',')})&select=ident`);
    return (rows?.length || 0) >= MIN_OVERLAP;
  } catch { return false; }
}
