// Bot Builder guide: lesson navigation, checklists, quizzes, progress.
(function () {
  if (!USER) return;
  const progress = loadProgress();
  progress.checks = progress.checks || {};
  const save = (p) => saveProgress(p);

  const lessons = [...document.querySelectorAll(".lesson")];
  const total = lessons.length;
  const nav = document.getElementById("lesson-nav");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const completeBtn = document.getElementById("complete-btn");
  const hint = document.getElementById("complete-hint");
  let current = Math.min(Math.max(progress.current || 1, 1), total);

  const isDone = (n) => progress.completed.includes(n);

  function renderNav() {
    nav.innerHTML = lessons.map((l) => {
      const n = +l.dataset.lesson;
      return `<button class="nav-item${n === current ? " active" : ""}${isDone(n) ? " done" : ""}" data-n="${n}">
        <span class="nav-dot">${isDone(n) ? "✓" : n}</span><span class="nav-title">${l.dataset.title}</span></button>`;
    }).join("");
  }

  function renderProgress() {
    const done = progress.completed.length;
    document.getElementById("guide-progress-text").textContent = `${done} of ${total} lessons`;
    document.getElementById("guide-progress-bar").style.width = `${Math.max((done / total) * 100, 2)}%`;
  }

  function quizPassed(lesson) {
    return [...lesson.querySelectorAll(".q")].every((q) => q.classList.contains("correct"));
  }

  function renderFooter() {
    const lesson = lessons[current - 1];
    prevBtn.disabled = current === 1;
    nextBtn.disabled = current === total;
    if (isDone(current)) {
      completeBtn.textContent = "✓ Completed";
      completeBtn.disabled = true;
      hint.textContent = "";
    } else {
      completeBtn.textContent = "Mark lesson complete";
      completeBtn.disabled = !quizPassed(lesson);
      hint.textContent = quizPassed(lesson) ? "" : "Answer the knowledge check correctly to complete this lesson.";
    }
  }

  function show(n, scroll) {
    current = n;
    progress.current = n;
    save(progress);
    lessons.forEach((l) => (l.hidden = +l.dataset.lesson !== n));
    renderNav();
    renderFooter();
    if (scroll) document.querySelector(".guide-layout").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Quizzes: check each answer instantly; restore passed lessons as correct.
  lessons.forEach((lesson) => {
    const n = +lesson.dataset.lesson;
    lesson.querySelectorAll(".q").forEach((q) => {
      const answer = +q.dataset.answer;
      const opts = [...q.querySelectorAll("input")];
      const fb = document.createElement("p");
      fb.className = "feedback";
      q.appendChild(fb);
      const mark = (i) => {
        q.classList.toggle("correct", i === answer);
        q.classList.toggle("wrong", i !== answer);
        fb.textContent = i === answer ? "✓ Correct!" : "Not quite. Try again.";
      };
      opts.forEach((o, i) => o.addEventListener("change", () => { mark(i); if (n === current) renderFooter(); }));
      if (isDone(n)) { opts[answer].checked = true; mark(answer); }
    });

    // Checklists are saved per lesson.
    lesson.querySelectorAll("[data-checklist] input").forEach((box, i) => {
      const key = `${n}-${i}`;
      box.checked = !!progress.checks[key];
      box.addEventListener("change", () => { progress.checks[key] = box.checked; save(progress); });
    });
  });

  // Copy buttons on code blocks.
  document.querySelectorAll(".code .copy").forEach((btn) =>
    btn.addEventListener("click", () => copyText(btn.previousElementSibling.textContent, btn)));

  nav.addEventListener("click", (e) => {
    const b = e.target.closest(".nav-item");
    if (b) show(+b.dataset.n, true);
  });
  prevBtn.addEventListener("click", () => current > 1 && show(current - 1, true));
  nextBtn.addEventListener("click", () => current < total && show(current + 1, true));
  completeBtn.addEventListener("click", () => {
    if (!isDone(current)) progress.completed.push(current);
    save(progress);
    renderProgress();
    if (current < total) show(current + 1, true);
    else { renderNav(); renderFooter(); hint.textContent = "🎉 You finished the guide! Your agent is ready to help you every day."; }
  });

  initDesigner(progress, save);
  renderProgress();
  show(current, false);
})();
