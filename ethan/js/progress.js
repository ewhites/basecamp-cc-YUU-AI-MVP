// Per-user lesson progress, saved in this browser only.
const BOT_LESSON_COUNT = 10;

function progressKey() {
  const u = (typeof currentUser === "function" && currentUser()) || { username: "guest" };
  return `yuu-progress-${u.username}`;
}

function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(progressKey()));
    if (p && Array.isArray(p.completed)) return p;
  } catch (_) {}
  return { completed: [], current: 1, designer: null };
}

function saveProgress(p) {
  try { localStorage.setItem(progressKey(), JSON.stringify(p)); } catch (_) {}
}
