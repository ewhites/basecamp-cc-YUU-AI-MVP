if (USER) {
  document.getElementById("greeting").textContent = `Welcome, ${USER.username}`;
  document.getElementById("avatar").textContent = USER.username.charAt(0);

  const done = loadProgress().completed.length;
  const botFinished = done >= BOT_LESSON_COUNT;

  document.getElementById("features").innerHTML = FEATURES.map((f) => {
    let badge = "Coming soon";
    if (f.id === "bot-builder") {
      badge = botFinished ? "Completed" : done ? `${done}/${BOT_LESSON_COUNT} lessons` : "Start here";
    }
    return `
    <a class="card accent-${f.accent}" href="${f.href || `feature.html?f=${f.id}`}">
      <div class="icon">${ICONS[f.icon]}</div>
      <h3>${f.title}</h3>
      <p>${f.blurb}</p>
      <div class="meta"><span class="badge">${badge}</span><span class="go">Open &rarr;</span></div>
    </a>`;
  }).join("");

  // Overall progress: Bot Builder is 1 of 4 modules; the others aren't built yet.
  const pct = Math.round((done / BOT_LESSON_COUNT) * 25);
  document.getElementById("progress-bar").style.width = `${Math.max(pct, 3)}%`;
  document.getElementById("progress-text").textContent =
    `${botFinished ? 1 : 0} of 4 modules · Bot Builder ${done}/${BOT_LESSON_COUNT} lessons`;
}
