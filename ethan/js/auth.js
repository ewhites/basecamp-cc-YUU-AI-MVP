// Client-side demo auth. Not secure; for MVP navigation only.
const SESSION_KEY = "yuu-session";

function login(email, username) {
  const e = String(email).trim().toLowerCase();
  const u = String(username).trim();
  const user = USERS.find((x) => x.email.toLowerCase() === e && x.username === u);
  if (!user) return false;
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: user.username })); } catch (_) {}
  return true;
}

function currentUser() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (_) { return null; }
}

function requireAuth() {
  const user = currentUser();
  if (!user) window.location.replace("index.html");
  return user;
}

function logout() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
  window.location.replace("index.html");
}
