// Remembers this tab's seat (game ID + player token) so a page refresh drops
// the player straight back into their game. sessionStorage is per tab, so
// two tabs in one browser can hold the two seats of an online game (handy
// for testing); the seat is forgotten when the tab closes.

const STORAGE_KEY = "pentago-seat";

export function loadSeat() {
  try {
    const seat = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    return seat?.gameId && seat?.token ? seat : null;
  } catch {
    return null;
  }
}

export function saveSeat(seat) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(seat));
  } catch {
    // Storage unavailable: the game still works, it just won't survive a refresh.
  }
}

export function clearSeat() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
