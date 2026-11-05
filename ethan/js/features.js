// Feature list shared by the dashboard and the placeholder page.
const ICONS = {
  prompt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/></svg>',
  compare: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/><path d="M6.5 9v6M17.5 11v4"/></svg>',
  bot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13v1M15 13v1M9 17h6"/><circle cx="12" cy="3" r="1"/></svg>',
  journey: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h6a4 4 0 0 0 0-8h-2a4 4 0 0 1 0-8h6"/></svg>',
};

const FEATURES = [
  {
    id: "prompting", title: "AI Prompting Lab", accent: "blue", icon: "prompt",
    blurb: "Learn to write effective prompts, test them, and get guided feedback.",
  },
  {
    id: "compare", title: "Model Comparison", accent: "red", icon: "compare",
    blurb: "Compare how different AI models respond to the same task, and learn how to judge them.",
  },
  {
    id: "bot-builder", title: "Bot Builder", accent: "green", icon: "bot", href: "bot-builder.html",
    blurb: "Create your own agent step by step: pick a model, write its instructions, and try it out.",
  },
  {
    id: "journey", title: "Course Journey", accent: "yellow", icon: "journey",
    blurb: "See your path through the AI curriculum from the first lesson to the last.",
  },
];
