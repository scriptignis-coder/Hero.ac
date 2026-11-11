// Games a scan PIN can be made for (v30). The scanner reads the game from the PIN
// and runs the common checks + only the checks of that game.
export const GAMES = {
  fivem: 'FiveM',
  redm: 'RedM',
  minecraft: 'Minecraft',
  roblox: 'Roblox',
};
export const gameOf = (v) => (Object.prototype.hasOwnProperty.call(GAMES, String(v || '').toLowerCase()) ? String(v).toLowerCase() : 'fivem');
