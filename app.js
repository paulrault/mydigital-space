(function(){
"use strict";

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
const safeLoad = (key, fallback) => {
  try {
    const x = localStorage.getItem("mds2_" + key);
    return x === null ? fallback : JSON.parse(x);
  } catch { return fallback; }
};
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const state = {
  tasks: safeLoad("tasks", []),
  projects: safeLoad("projects", [
    {id: uid(), name: "Mon laboratoire informatique", description: "Organiser les serveurs, les machines virtuelles et les services réseau.", category: "Informatique", progress: 35, color: "🖥️"},
    {id: uid(), name: "Mon site personnel", description: "Construire et améliorer mes projets web sur GitHub Pages.", category: "Développement", progress: 60, color: "🌐"},
    {id: uid(), name: "Objectifs personnels", description: "Centraliser mes idées et avancer régulièrement.", category: "Personnel", progress: 20, color: "🎯"}
  ]),
  goals: safeLoad("goals", [
    {id: uid(), name: "Apprendre une nouvelle compétence", description: "Consacrer du temps à l'apprentissage chaque semaine.", target: 10, current: 3, unit: "sessions"},
    {id: uid(), name: "Faire avancer mon projet web", description: "Améliorer le site et vérifier chaque fonctionnalité.", target: 8, current: 2, unit: "étapes"}
  ]),
  habits: safeLoad("habits", [
    {id: uid(), name: "Lire ou apprendre 15 minutes", icon: "📚", days: {}},
    {id: uid(), name: "Avancer sur un projet", icon: "💻", days: {}},
    {id: uid(), name: "Préparer les priorités du lendemain", icon: "📝", days: {}}
  ]),
  events: safeLoad("events", []),
  settings: safeLoad("settings", {name: "", theme: "dark", weekStart: 1, notif: false})
};

// Migration / normalisation
for (const k of ["tasks","projects","goals","habits","events"]) {
  if (!Array.isArray(state[k])) state[k] = [];
}
state.tasks.forEach(t => {
  if (!Array.isArray(t.subtasks)) t.subtasks = [];
  if (t.projectId === undefined) t.projectId = null;
  if (!Array.isArray(t.tags)) t.tags = [];
  if (!t.status) t.status = t.done ? "done" : "todo";
});

function persist(key) { localStorage.setItem("mds2_" + key, JSON.stringify(state[key])); }
function persistAll() { ["tasks","projects","goals","habits","events","settings"].forEach(persist); }

let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}

function dateLabel(s) {
  if (!s) return "Sans échéance";
  const d = new Date(s + "T12:00:00");
  return isNaN(d) ? "" : d.toLocaleDateString("fr-FR", {day: "numeric", month: "short", year: "numeric"});
}

const pageInfo = {
  dashboard: ["Vue d'ensemble", "Voici ce qui se passe dans ton espace aujourd'hui."],
  tasks: ["Mes tâches", "Clarifie tes priorités et transforme tes idées en actions."],
  projects: ["Mes projets", "Un espace pour structurer tes projets et suivre leur progression."],
  calendar: ["Mon calendrier", "Planifie tes rendez-vous, échéances et moments importants."],
  habits: ["Mes habitudes", "Les petites actions répétées construisent de grandes habitudes."],
  goals: ["Mes objectifs", "Définis une cible, mesure tes progrès et célèbre tes avancées."],
  focus: ["Mode Focus", "Concentrate-toi avec la technique Pomodoro."],
  stats: ["Statistiques", "Visualise tes progrès et ta régularité."],
  settings: ["Paramètres", "Gère ton profil, tes préférences et tes sauvegardes."]
};

function go(view) {
  if (!pageInfo[view]) view = "dashboard";
  $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + view));
  $$("[data-view]").forEach(a => a.classList.toggle("active", a.dataset.view === view));
  $("#pageTitle").textContent = pageInfo[view][0];
  $("#pageSubtitle").textContent = pageInfo[view][1];
  if (location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
  render();
  window.scrollTo({top: 0, behavior: "smooth"});
}

$("#navigation").addEventListener("click", e => {
  const a = e.target.closest("[data-view]");
  if (a) { e.preventDefault(); go(a.dataset.view); }
});
$$("[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));

// ——— TASKS ———
let taskViewMode = "list"; // list | kanban

function taskMarkup(t, full = false) {
  const project = t.projectId ? state.projects.find(p => p.id === t.projectId) : null;
  const subDone = (t.subtasks || []).filter(s => s.done).length;
  const subTotal = (t.subtasks || []).length;
  const dueSoon = t.due && !t.done && t.due <= today();
  return `<div class="task ${t.done ? "done" : ""}" draggable="${full}" data-task-id="${esc(t.id)}">
    ${full ? `<span class="drag-handle" title="Réordonner">⠿</span>` : ""}
    <input class="check" type="checkbox" data-task-check="${esc(t.id)}" ${t.done ? "checked" : ""} aria-label="Marquer comme terminée">
    <div class="task-body">
      <div class="task-title">${esc(t.title)}</div>
      <div class="task-meta">
        ${esc(t.category || "Personnel")}
        ${t.due ? " · " + esc(dateLabel(t.due)) : ""}
        ${t.priority ? ` · <span class="pill ${t.priority === "Haute" ? "orange" : ""}">${esc(t.priority)}</span>` : ""}
        ${project ? ` · <span class="pill blue">${esc(project.name)}</span>` : ""}
        ${dueSoon ? ` · <span class="pill red">Échéance</span>` : ""}
        ${subTotal ? ` · <span class="pill">${subDone}/${subTotal} sous-tâches</span>` : ""}
      </div>
      ${full && subTotal ? `<div class="subtasks">${(t.subtasks||[]).map(s => `
        <div class="subtask ${s.done?"done":""}">
          <input class="check" type="checkbox" data-sub-check="${esc(t.id)}" data-sub-id="${esc(s.id)}" ${s.done?"checked":""}>
          <span>${esc(s.title)}</span>
        </div>`).join("")}</div>` : ""}
    </div>
    <div class="row-actions">
      ${full ? `<button class="icon-btn" data-edit-task="${esc(t.id)}" aria-label="Modifier">✎</button>` : ""}
      <button class="icon-btn" data-delete-task="${esc(t.id)}" aria-label="Supprimer">×</button>
    </div>
  </div>`;
}

function renderTasks() {
  const open = state.tasks.filter(t => !t.done);
  const done = state.tasks.filter(t => t.done);
  $("#statOpen").textContent = open.length;
  $("#statDone").textContent = done.length;

  // Project filter options
  const pf = $("#taskProjectFilter");
  if (pf) {
    const cur = pf.value;
    pf.innerHTML = `<option value="">Tous les projets</option>` +
      state.projects.map(p => `<option value="${esc(p.id)}" ${cur===p.id?"selected":""}>${esc(p.name)}</option>`).join("");
  }

  const priorityOrder = {Haute:0, Moyenne:1, Basse:2};
  const priority = [...open].sort((a,b) => (priorityOrder[a.priority]??3) - (priorityOrder[b.priority]??3));
  $("#dashboardTasks").innerHTML = priority.slice(0,5).map(t => taskMarkup(t)).join("") ||
    '<div class="empty"><div class="big">✓</div>Aucune tâche en attente. Profite de ce temps ou ajoute une action !</div>';

  const q = ($("#taskSearch")?.value || "").toLowerCase();
  const filter = $("#taskFilter")?.value || "all";
  const projF = $("#taskProjectFilter")?.value || "";

  let arr = state.tasks.filter(t => {
    if (filter === "open" && t.done) return false;
    if (filter === "done" && !t.done) return false;
    if (filter === "high" && t.priority !== "Haute") return false;
    if (projF && t.projectId !== projF) return false;
    const hay = (t.title + " " + (t.category||"") + " " + (t.tags||[]).join(" ")).toLowerCase();
    return hay.includes(q);
  });

  // Keep original order for open tasks if no search, else by priority then due
  if (!q && filter === "all") {
    // preserve order
  } else {
    arr = arr.sort((a,b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (priorityOrder[a.priority]??3) - (priorityOrder[b.priority]??3);
    });
  }

  if (taskViewMode === "list") {
    $("#allTasks").classList.remove("hidden");
    $("#kanbanBoard").classList.add("hidden");
    $("#allTasks").innerHTML = arr.map(t => taskMarkup(t, true)).join("") ||
      '<div class="empty"><div class="big">📋</div>Aucune tâche ne correspond à ce filtre.</div>';
  } else {
    $("#allTasks").classList.add("hidden");
    $("#kanbanBoard").classList.remove("hidden");
    renderKanban(arr);
  }

  $("#taskCountLabel").textContent = `${state.tasks.length} tâche${state.tasks.length > 1 ? "s" : ""}`;
}

function renderKanban(arr) {
  const cols = {
    todo: arr.filter(t => !t.done && (t.status === "todo" || !t.status || t.status === "todo")),
    doing: arr.filter(t => !t.done && t.status === "doing"),
    done: arr.filter(t => t.done || t.status === "done")
  };
  // fallback: if no "doing", put non-done in todo
  if (cols.doing.length === 0 && cols.todo.length === 0) {
    cols.todo = arr.filter(t => !t.done);
  }
  const colHtml = (title, items, status) => `
    <div class="kanban-col" data-status="${status}">
      <h3>${title} <span class="count">${items.length}</span></h3>
      ${items.map(t => `
        <div class="kanban-card" draggable="true" data-task-id="${esc(t.id)}">
          <strong>${esc(t.title)}</strong>
          <div class="meta">${esc(t.priority || "")} ${t.due ? "· " + dateLabel(t.due) : ""}</div>
        </div>`).join("") || '<div class="empty" style="padding:12px">Vide</div>'}
    </div>`;
  $("#kanbanBoard").innerHTML =
    colHtml("À faire", cols.todo, "todo") +
    colHtml("En cours", cols.doing, "doing") +
    colHtml("Terminé", cols.done, "done");
}

// Drag & drop for list reorder + kanban
let dragTaskId = null;
document.addEventListener("dragstart", e => {
  const el = e.target.closest("[data-task-id]");
  if (!el) return;
  dragTaskId = el.dataset.taskId;
  el.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
});
document.addEventListener("dragend", e => {
  e.target.closest("[data-task-id]")?.classList.remove("dragging");
  dragTaskId = null;
});
document.addEventListener("dragover", e => {
  e.preventDefault();
  const col = e.target.closest(".kanban-col");
  if (col && dragTaskId) e.dataTransfer.dropEffect = "move";
});
document.addEventListener("drop", e => {
  e.preventDefault();
  if (!dragTaskId) return;
  const col = e.target.closest(".kanban-col");
  if (col) {
    const t = state.tasks.find(x => x.id === dragTaskId);
    if (t) {
      const st = col.dataset.status;
      t.status = st;
      t.done = st === "done";
      persist("tasks");
      renderTasks();
      toast("Statut mis à jour");
    }
    return;
  }
  // list reorder
  const target = e.target.closest(".task[data-task-id]");
  if (target && target.dataset.taskId !== dragTaskId) {
    const from = state.tasks.findIndex(x => x.id === dragTaskId);
    const to = state.tasks.findIndex(x => x.id === target.dataset.taskId);
    if (from >= 0 && to >= 0) {
      const [item] = state.tasks.splice(from, 1);
      state.tasks.splice(to, 0, item);
      persist("tasks");
      renderTasks();
    }
  }
});

$("#viewList").addEventListener("click", () => {
  taskViewMode = "list";
  $("#viewList").classList.add("active");
  $("#viewKanban").classList.remove("active");
  renderTasks();
});
$("#viewKanban").addEventListener("click", () => {
  taskViewMode = "kanban";
  $("#viewKanban").classList.add("active");
  $("#viewList").classList.remove("active");
  renderTasks();
});

// ——— PROJECTS ———
function renderProjects() {
  const q = ($("#projectSearch")?.value || "").toLowerCase();
  $("#statProjects").textContent = state.projects.length;
  const arr = state.projects.filter(p => (p.name + " " + p.description + " " + p.category).toLowerCase().includes(q));
  $("#allProjects").innerHTML = arr.map(p => {
    const linked = state.tasks.filter(t => t.projectId === p.id && !t.done).length;
    return `<article class="project-card">
      <div class="project-symbol">${esc(p.color || "📌")}</div>
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.description)}</p>
      <span class="pill blue">${esc(p.category || "Personnel")}</span>
      ${linked ? `<span class="pill" style="margin-left:6px">${linked} tâche${linked>1?"s":""}</span>` : ""}
      <div class="progress-line"><span style="width:${Math.max(0,Math.min(100,Number(p.progress)||0))}%"></span></div>
      <div class="project-foot">
        <span style="font-size:11px;color:var(--muted)">${Math.max(0,Math.min(100,Number(p.progress)||0))}% réalisé</span>
        <span>
          <button class="icon-btn" data-edit-project="${esc(p.id)}" aria-label="Modifier">✎</button>
          <button class="icon-btn" data-delete-project="${esc(p.id)}" aria-label="Supprimer">×</button>
        </span>
      </div>
    </article>`;
  }).join("") || '<div class="empty"><div class="big">▦</div>Aucun projet trouvé.</div>';
}

// ——— GOALS ———
function renderGoals() {
  const html = g => {
    const pct = g.target > 0 ? Math.min(100, Math.round(g.current / g.target * 100)) : 0;
    return `<div class="goal-row">
      <div class="goal-emoji">◎</div>
      <div class="goal-content">
        <div class="goal-title">${esc(g.name)}</div>
        <div class="goal-detail">${esc(g.description || "")} · ${g.current}/${g.target} ${esc(g.unit || "étapes")}</div>
        <div class="progress-line"><span style="width:${pct}%"></span></div>
      </div>
      <span class="goal-pct">${pct}%</span>
      <div>
        <button class="icon-btn" data-goal-step="${esc(g.id)}" aria-label="Augmenter">＋</button>
        <button class="icon-btn" data-edit-goal="${esc(g.id)}" aria-label="Modifier">✎</button>
        <button class="icon-btn" data-delete-goal="${esc(g.id)}" aria-label="Supprimer">×</button>
      </div>
    </div>`;
  };
  $("#dashboardGoals").innerHTML = state.goals.slice(0,4).map(html).join("") ||
    '<div class="empty">Ajoute ton premier objectif.</div>';
  $("#allGoals").innerHTML = state.goals.map(g => `
    <article class="project-card">
      <div class="project-symbol">◎</div>
      <h3>${esc(g.name)}</h3>
      <p>${esc(g.description || "Un objectif à atteindre à ton rythme.")}</p>
      ${html(g)}
    </article>`).join("") || '<div class="empty"><div class="big">◎</div>Aucun objectif enregistré.</div>';
}

// ——— HABITS + STREAKS ———
function calcStreak(days) {
  if (!days || typeof days !== "object") return 0;
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    if (days[key]) { streak++; d.setDate(d.getDate() - 1); }
    else if (i === 0) { d.setDate(d.getDate() - 1); continue; } // allow today not yet done
    else break;
  }
  return streak;
}

function renderHabits() {
  const todayKey = today();
  const count = state.habits.filter(h => h.days && h.days[todayKey]).length;
  $("#statHabits").textContent = `${count}/${state.habits.length}`;

  $("#habitList").innerHTML = state.habits.map(h => {
    const streak = calcStreak(h.days);
    const doneToday = h.days && h.days[todayKey];
    return `<div class="habit-item">
      <div class="goal-emoji">${esc(h.icon || "✓")}</div>
      <div class="grow">
        <strong>${esc(h.name)}</strong>
        <p>${doneToday ? "Terminé aujourd'hui" : "Un petit pas aujourd'hui"}
          ${streak > 0 ? ` · <span class="streak">🔥 ${streak} jour${streak>1?"s":""}</span>` : ""}
        </p>
      </div>
      <button class="btn small ${doneToday ? "" : "primary"}" data-habit-check="${esc(h.id)}">${doneToday ? "✓ Fait" : "Marquer fait"}</button>
      <button class="icon-btn" data-edit-habit="${esc(h.id)}" aria-label="Modifier">✎</button>
      <button class="icon-btn" data-delete-habit="${esc(h.id)}" aria-label="Supprimer">×</button>
    </div>`;
  }).join("") || '<div class="empty"><div class="big">↗</div>Ajoute une habitude à suivre.</div>';

  const monday = new Date();
  const day = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - day);
  const todayKey2 = today();
  $("#weekGrid").innerHTML = Array.from({length: 7}, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const n = state.habits.filter(h => h.days && h.days[key]).length;
    const isToday = key === todayKey2;
    return `<div class="day ${n ? "marked" : ""} ${isToday ? "today-mark" : ""}">
      ${d.toLocaleDateString("fr-FR", {weekday: "short"})}
      <strong>${d.getDate()}</strong>
      <span>${n ? `✓ ${n}` : "—"}</span>
    </div>`;
  }).join("");
}

// ——— CALENDAR ———
let monthCursor = new Date();
monthCursor.setDate(1);

function renderCalendar() {
  const year = monthCursor.getFullYear(), month = monthCursor.getMonth();
  $("#monthTitle").textContent = monthCursor.toLocaleDateString("fr-FR", {month: "long", year: "numeric"});
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const total = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((offset + total) / 7) * 7;
  let html = "";
  for (let i = 0; i < cells; i++) {
    const n = i - offset + 1;
    if (n < 1 || n > total) { html += '<div class="calendar-cell"></div>'; continue; }
    const key = `${year}-${String(month+1).padStart(2,"0")}-${String(n).padStart(2,"0")}`;
    const ev = state.events.filter(e => e.date === key);
    html += `<div class="calendar-cell ${key === today() ? "today" : ""}">
      <button class="icon-btn" data-calendar-date="${key}" style="font-weight:700;color:var(--text)">${n}</button>
      ${ev.slice(0,2).map(e => `<div class="event" title="${esc(e.title)}">${esc(e.title)}</div>`).join("")}
      ${ev.length > 2 ? `<div>+${ev.length-2}</div>` : ""}
    </div>`;
  }
  $("#calendarGrid").innerHTML = html;

  const upcoming = [...state.events].filter(e => e.date >= today()).sort((a,b) => (a.date + (a.time||"")).localeCompare(b.date + (b.time||"")));
  $("#eventList").innerHTML = upcoming.map(e => `
    <div class="task">
      <div class="goal-emoji">▣</div>
      <div class="task-body">
        <div class="task-title">${esc(e.title)}</div>
        <div class="task-meta">${esc(dateLabel(e.date))}${e.time ? " · " + esc(e.time) : ""}${e.note ? " · " + esc(e.note) : ""}</div>
      </div>
      <button class="icon-btn" data-edit-event="${esc(e.id)}" aria-label="Modifier">✎</button>
      <button class="icon-btn" data-delete-event="${esc(e.id)}" aria-label="Supprimer">×</button>
    </div>`).join("") || '<div class="empty">Aucun événement à venir.</div>';
}

function render() {
  renderTasks();
  renderProjects();
  renderGoals();
  renderHabits();
  renderCalendar();
  renderStats();
  updatePomoUI();
  const name = state.settings.name || "";
  $("#avatar").textContent = (name[0] || "P").toUpperCase();
  $("#todayLabel").textContent = new Date().toLocaleDateString("fr-FR", {weekday: "long", day: "numeric", month: "long"}).toUpperCase();
  document.title = (name ? name + " · " : "") + "MyDigital Space";
  updateNotifBanner();
}

/* ——— STATS / CHARTS ——— */
function getWeekKeys() {
  const keys = [];
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  for (let i = 0; i < 7; i++) {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    keys.push(`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`);
  }
  return keys;
}

function renderStats() {
  const weekKeys = getWeekKeys();
  const dayLabels = weekKeys.map(k => {
    const d = new Date(k + "T12:00:00");
    return d.toLocaleDateString("fr-FR", {weekday: "short"}).slice(0, 3);
  });

  // Tasks completed per day this week (we don't store completion date historically,
  // so we approximate: done tasks with due in the week, + count of currently done as soft signal.
  // Better: store completedAt when marking done. For now use a simple heuristic + local activity log.
  const activity = safeLoad("activity", {}); // { "YYYY-MM-DD": { tasks: n, habits: n, pomo: n } }
  const taskCounts = weekKeys.map(k => (activity[k] && activity[k].tasks) || 0);
  const maxT = Math.max(1, ...taskCounts);
  $("#chartTasksWeek").innerHTML = `
    <div class="chart-bars">
      ${taskCounts.map((v, i) => `
        <div class="chart-bar">
          <span class="bar-val">${v || ""}</span>
          <div class="bar" style="height:${Math.max(4, (v / maxT) * 90)}px"></div>
          <span class="bar-label">${dayLabels[i]}</span>
        </div>`).join("")}
    </div>
    <div class="chart-legend"><span><i style="background:var(--accent)"></i> Tâches terminées</span></div>`;

  // Habits completion % per day
  const habitCounts = weekKeys.map(k => {
    const n = state.habits.filter(h => h.days && h.days[k]).length;
    return state.habits.length ? Math.round(n / state.habits.length * 100) : 0;
  });
  const maxH = 100;
  $("#chartHabits").innerHTML = `
    <div class="chart-bars">
      ${habitCounts.map((v, i) => `
        <div class="chart-bar">
          <span class="bar-val">${v ? v + "%" : ""}</span>
          <div class="bar" style="height:${Math.max(4, (v / maxH) * 90)}px;background:linear-gradient(180deg,var(--good),var(--accent2))"></div>
          <span class="bar-label">${dayLabels[i]}</span>
        </div>`).join("")}
    </div>
    <div class="chart-legend"><span><i style="background:var(--good)"></i> % d'habitudes validées</span></div>`;

  // Goals rings / bars
  $("#chartGoals").innerHTML = state.goals.length ? state.goals.map(g => {
    const pct = g.target > 0 ? Math.min(100, Math.round(g.current / g.target * 100)) : 0;
    return `<div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
        <span>${esc(g.name)}</span><strong>${pct}%</strong>
      </div>
      <div class="progress-line"><span style="width:${pct}%"></span></div>
    </div>`;
  }).join("") : '<div class="empty">Aucun objectif</div>';

  // Summary
  const open = state.tasks.filter(t => !t.done).length;
  const done = state.tasks.filter(t => t.done).length;
  const totalPomo = Object.values(activity).reduce((s, a) => s + (a.pomo || 0), 0);
  const streakMax = Math.max(0, ...state.habits.map(h => calcStreak(h.days)));
  $("#statsSummary").innerHTML = `
    <div class="mini-stat">Tâches ouvertes<strong>${open}</strong></div>
    <div class="mini-stat">Tâches terminées<strong>${done}</strong></div>
    <div class="mini-stat">Meilleure série<strong>${streakMax} j</strong></div>
    <div class="mini-stat">Minutes focus<strong>${totalPomo}</strong></div>`;
}

function logActivity(type, amount = 1) {
  const key = today();
  const activity = safeLoad("activity", {});
  if (!activity[key]) activity[key] = {tasks: 0, habits: 0, pomo: 0};
  activity[key][type] = (activity[key][type] || 0) + amount;
  localStorage.setItem("mds2_activity", JSON.stringify(activity));
}

/* ——— POMODORO ——— */
const pomo = {
  duration: 25 * 60,
  remaining: 25 * 60,
  mode: "work", // work | break
  running: false,
  timerId: null,
  sessionsToday: 0,
  minutesToday: 0
};

function loadPomoStats() {
  const activity = safeLoad("activity", {});
  const a = activity[today()] || {};
  pomo.sessionsToday = a.sessions || 0;
  pomo.minutesToday = a.pomo || 0;
}

function savePomoStats() {
  const activity = safeLoad("activity", {});
  if (!activity[today()]) activity[today()] = {tasks: 0, habits: 0, pomo: 0, sessions: 0};
  activity[today()].pomo = pomo.minutesToday;
  activity[today()].sessions = pomo.sessionsToday;
  localStorage.setItem("mds2_activity", JSON.stringify(activity));
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function updatePomoUI() {
  loadPomoStats();
  const el = $("#pomoTimer");
  if (el) el.textContent = formatTime(pomo.remaining);
  const modeEl = $("#pomoMode");
  if (modeEl) {
    modeEl.textContent = pomo.mode === "work" ? "Session de travail" : "Pause";
    modeEl.className = "pomo-mode " + pomo.mode;
  }
  const total = pomo.duration || 1;
  const pct = (pomo.remaining / total) * 100;
  const bar = $("#pomoProgress");
  if (bar) {
    bar.style.width = pct + "%";
    bar.style.background = pomo.mode === "work" ? "var(--accent)" : "var(--good)";
  }
  $("#pomoStart") && ($("#pomoStart").disabled = pomo.running);
  $("#pomoPause") && ($("#pomoPause").disabled = !pomo.running);
  $("#pomoSessions") && ($("#pomoSessions").textContent = pomo.sessionsToday);
  $("#pomoMinutes") && ($("#pomoMinutes").textContent = pomo.minutesToday);

  // floating
  const float = $("#floatingPomo");
  if (float) {
    if (pomo.running) {
      float.classList.add("show");
      $("#floatTime").textContent = formatTime(pomo.remaining);
      $("#floatToggle").textContent = "⏸";
    } else if (pomo.remaining < pomo.duration) {
      float.classList.add("show");
      $("#floatTime").textContent = formatTime(pomo.remaining);
      $("#floatToggle").textContent = "▶";
    }
  }

  // task select
  const sel = $("#pomoTaskSelect");
  if (sel) {
    const cur = sel.value;
    sel.innerHTML = `<option value="">— Aucune —</option>` +
      state.tasks.filter(t => !t.done).map(t =>
        `<option value="${esc(t.id)}" ${cur === t.id ? "selected" : ""}>${esc(t.title)}</option>`
      ).join("");
  }
}

function pomoTick() {
  if (!pomo.running) return;
  pomo.remaining--;
  if (pomo.remaining <= 0) {
    pomo.running = false;
    clearInterval(pomo.timerId);
    pomo.timerId = null;
    if (pomo.mode === "work") {
      pomo.sessionsToday++;
      pomo.minutesToday += Math.round(pomo.duration / 60);
      savePomoStats();
      toast("Session terminée ! Prends une pause ☕");
      try {
        if (Notification.permission === "granted") {
          new Notification("MyDigital Space — Focus", {body: "Session terminée ! Pause de 5 min.", tag: "pomo"});
        }
      } catch {}
      // auto switch to break
      pomo.mode = "break";
      pomo.duration = 5 * 60;
      pomo.remaining = 5 * 60;
    } else {
      toast("Pause terminée. Prêt pour une nouvelle session ?");
      pomo.mode = "work";
      pomo.duration = 25 * 60;
      pomo.remaining = 25 * 60;
    }
    // subtle sound via Web Audio
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.value = 0.08;
      o.start(); o.stop(ctx.currentTime + 0.25);
    } catch {}
  }
  updatePomoUI();
}

function pomoStart() {
  if (pomo.running) return;
  pomo.running = true;
  if (!pomo.timerId) pomo.timerId = setInterval(pomoTick, 1000);
  updatePomoUI();
  toast(pomo.mode === "work" ? "Focus démarré" : "Pause démarrée");
}

function pomoPause() {
  pomo.running = false;
  clearInterval(pomo.timerId);
  pomo.timerId = null;
  updatePomoUI();
}

function pomoReset() {
  pomoPause();
  pomo.remaining = pomo.duration;
  updatePomoUI();
}

function setPomoDuration(min, mode) {
  pomoPause();
  pomo.mode = mode || (min <= 5 ? "break" : "work");
  pomo.duration = min * 60;
  pomo.remaining = min * 60;
  updatePomoUI();
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-pomo]");
  if (b) setPomoDuration(Number(b.dataset.pomo));
});

$("#pomoStart")?.addEventListener("click", pomoStart);
$("#pomoPause")?.addEventListener("click", pomoPause);
$("#pomoReset")?.addEventListener("click", pomoReset);
$("#floatToggle")?.addEventListener("click", () => {
  if (pomo.running) pomoPause(); else pomoStart();
});
$("#floatClose")?.addEventListener("click", () => {
  $("#floatingPomo").classList.remove("show");
});

// ——— MODAL ———
const backdrop = $("#modalBackdrop"), form = $("#modalForm");
function closeModal() { backdrop.classList.remove("open"); form.innerHTML = ""; }
$("#closeModal").addEventListener("click", closeModal);
backdrop.addEventListener("click", e => { if (e.target === backdrop) closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

function openForm(type, id = null, extra = {}) {
  const item = id ? ({task: state.tasks, project: state.projects, goal: state.goals, habit: state.habits, event: state.events}[type] || []).find(x => x.id === id) : null;
  const titles = {
    task: item ? "Modifier la tâche" : "Nouvelle tâche",
    project: item ? "Modifier le projet" : "Nouveau projet",
    goal: item ? "Modifier l'objectif" : "Nouvel objectif",
    habit: item ? "Modifier l'habitude" : "Nouvelle habitude",
    event: item ? "Modifier l'événement" : "Nouvel événement"
  };
  $("#modalTitle").textContent = titles[type];

  const input = (label, name, value = "", kind = "text", required = false) =>
    `<div class="field"><label for="f_${name}">${label}</label><input id="f_${name}" name="${name}" type="${kind}" value="${esc(value)}" ${required ? "required" : ""} ${kind === "number" ? 'min="0"' : ""}></div>`;
  const area = (label, name, value = "") =>
    `<div class="field full"><label for="f_${name}">${label}</label><textarea id="f_${name}" name="${name}">${esc(value)}</textarea></div>`;

  let body = "";
  if (type === "task") {
    const subText = (item?.subtasks || []).map(s => s.title).join("\n");
    body = `<div class="form-grid">
      ${input("Titre", "title", item?.title || "", "text", true)}
      ${input("Échéance", "due", item?.due || extra.date || "", "date")}
      <div class="field"><label for="f_priority">Priorité</label>
        <select id="f_priority" name="priority">
          <option ${item?.priority==="Haute"?"selected":""}>Haute</option>
          <option ${(!item || item.priority==="Moyenne")?"selected":""}>Moyenne</option>
          <option ${item?.priority==="Basse"?"selected":""}>Basse</option>
        </select>
      </div>
      <div class="field"><label for="f_category">Catégorie</label>
        <select id="f_category" name="category">
          ${["Personnel","Travail","Études","Informatique","Football","Autre"].map(c =>
            `<option ${item?.category===c?"selected":""}>${c}</option>`).join("")}
        </select>
      </div>
      <div class="field full"><label for="f_projectId">Projet lié</label>
        <select id="f_projectId" name="projectId">
          <option value="">— Aucun —</option>
          ${state.projects.map(p => `<option value="${esc(p.id)}" ${item?.projectId===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}
        </select>
      </div>
      <div class="field full"><label for="f_subtasks">Sous-tâches (une par ligne)</label>
        <textarea id="f_subtasks" name="subtasks" rows="3" placeholder="Sous-tâche 1&#10;Sous-tâche 2">${esc(subText)}</textarea>
      </div>
    </div>`;
  }
  if (type === "project") {
    body = `<div class="form-grid">
      ${input("Nom du projet", "name", item?.name || "", "text", true)}
      <div class="field"><label for="f_category">Catégorie</label>
        <select name="category" id="f_category">
          ${["Personnel","Informatique","Études","Football","Développement","Autre"].map(c =>
            `<option ${item?.category===c?"selected":""}>${c}</option>`).join("")}
        </select>
      </div>
      ${area("Description", "description", item?.description || "")}
      ${input("Progression (%)", "progress", item?.progress ?? 0, "number")}
      ${input("Icône (emoji)", "color", item?.color || "📌")}
    </div>`;
  }
  if (type === "goal") {
    body = `<div class="form-grid">
      ${input("Nom de l'objectif", "name", item?.name || "", "text", true)}
      ${input("Unité de progression", "unit", item?.unit || "étapes")}
      ${area("Description", "description", item?.description || "")}
      ${input("Progression actuelle", "current", item?.current ?? 0, "number")}
      ${input("Cible", "target", item?.target ?? 10, "number")}
    </div>`;
  }
  if (type === "habit") {
    body = `${input("Nom de l'habitude", "name", item?.name || "", "text", true)}
            ${input("Icône (emoji)", "icon", item?.icon || "✓")}`;
  }
  if (type === "event") {
    body = `<div class="form-grid">
      ${input("Nom de l'événement", "title", item?.title || "", "text", true)}
      ${input("Date", "date", item?.date || extra.date || today(), "date", true)}
      ${input("Heure", "time", item?.time || "", "time")}
      ${area("Note (facultatif)", "note", item?.note || "")}
    </div>`;
  }

  form.innerHTML = body + `<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px">
    <button class="btn" type="button" id="cancelModal">Annuler</button>
    <button class="btn primary" type="submit">Enregistrer</button>
  </div>`;
  $("#cancelModal").addEventListener("click", closeModal);

  form.onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(form);
    const v = Object.fromEntries(fd.entries());

    if (type === "task") {
      const lines = (v.subtasks || "").split("\n").map(s => s.trim()).filter(Boolean);
      const oldSubs = item?.subtasks || [];
      const subtasks = lines.map((title, i) => {
        const existing = oldSubs.find(s => s.title === title);
        return existing || {id: uid(), title, done: false};
      });
      // keep done state for matching titles
      const data = {
        id: item?.id || uid(),
        title: v.title.trim(),
        due: v.due || null,
        priority: v.priority,
        category: v.category,
        projectId: v.projectId || null,
        done: item?.done || false,
        status: item?.status || (item?.done ? "done" : "todo"),
        subtasks,
        tags: item?.tags || []
      };
      upsert("tasks", data);
    }
    if (type === "project") {
      upsert("projects", {
        id: item?.id || uid(),
        name: v.name.trim(),
        category: v.category,
        description: v.description.trim(),
        progress: Math.min(100, Number(v.progress) || 0),
        color: v.color || "📌"
      });
    }
    if (type === "goal") {
      upsert("goals", {
        id: item?.id || uid(),
        name: v.name.trim(),
        unit: v.unit.trim() || "étapes",
        description: v.description.trim(),
        current: Math.max(0, Number(v.current) || 0),
        target: Math.max(1, Number(v.target) || 1)
      });
    }
    if (type === "habit") {
      upsert("habits", {
        id: item?.id || uid(),
        name: v.name.trim(),
        icon: v.icon || "✓",
        days: item?.days || {}
      });
    }
    if (type === "event") {
      upsert("events", {
        id: item?.id || uid(),
        title: v.title.trim(),
        date: v.date,
        time: v.time || "",
        note: v.note.trim()
      });
    }
    persistAll();
    closeModal();
    render();
    toast(item ? "Modifications enregistrées" : "Ajout effectué");
    scheduleNotifications();
  };
  backdrop.classList.add("open");
  setTimeout(() => form.querySelector("input,textarea,select")?.focus(), 40);
}

function upsert(key, obj) {
  const i = state[key].findIndex(x => x.id === obj.id);
  if (i < 0) state[key].push(obj);
  else state[key][i] = obj;
}

$$("[data-action]").forEach(b => b.addEventListener("click", () => openForm(b.dataset.action)));

// ——— GLOBAL CLICK HANDLER ———
document.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;

  const edits = [
    ["edit-task","task"],["edit-project","project"],["edit-goal","goal"],
    ["edit-habit","habit"],["edit-event","event"]
  ];
  for (const [attr, type] of edits) {
    if (b.dataset[attr]) { openForm(type, b.dataset[attr]); return; }
  }

  const deletes = [
    ["delete-task","tasks","tâche"],["delete-project","projects","projet"],
    ["delete-goal","goals","objectif"],["delete-habit","habits","habitude"],
    ["delete-event","events","événement"]
  ];
  for (const [attr, key] of deletes) {
    if (b.dataset[attr]) {
      if (confirm("Supprimer cet élément ?")) {
        state[key] = state[key].filter(x => x.id !== b.dataset[attr]);
        persist(key);
        render();
        toast("Élément supprimé");
      }
      return;
    }
  }

  if (b.dataset.goalStep) {
    const g = state.goals.find(x => x.id === b.dataset.goalStep);
    if (g) {
      g.current = Math.min(g.target, g.current + 1);
      persist("goals");
      renderGoals();
      toast("Progression mise à jour");
    }
    return;
  }

  if (b.dataset.habitCheck) {
    const h = state.habits.find(x => x.id === b.dataset.habitCheck);
    if (h) {
      h.days = h.days || {};
      const key = today();
      if (h.days[key]) delete h.days[key];
      else {
        h.days[key] = true;
        logActivity("habits", 1);
      }
      persist("habits");
      renderHabits();
      renderStats();
      toast("Habitude mise à jour");
    }
    return;
  }

  if (b.dataset.calendarDate) {
    openForm("event", null, {date: b.dataset.calendarDate});
    return;
  }
});

document.addEventListener("change", e => {
  const el = e.target;
  if (el.matches("[data-task-check]")) {
    const t = state.tasks.find(x => x.id === el.dataset.taskCheck);
    if (t) {
      const wasDone = t.done;
      t.done = el.checked;
      t.status = el.checked ? "done" : (t.status === "done" ? "todo" : t.status);
      persist("tasks");
      if (el.checked && !wasDone) logActivity("tasks", 1);
      renderTasks();
      renderStats();
    }
  }
  if (el.matches("[data-sub-check]")) {
    const t = state.tasks.find(x => x.id === el.dataset.subCheck);
    if (t) {
      const s = (t.subtasks || []).find(x => x.id === el.dataset.subId);
      if (s) {
        s.done = el.checked;
        persist("tasks");
        renderTasks();
      }
    }
  }
});

$("#taskSearch").addEventListener("input", renderTasks);
$("#taskFilter").addEventListener("change", renderTasks);
$("#taskProjectFilter").addEventListener("change", renderTasks);
$("#projectSearch").addEventListener("input", renderProjects);
$("#prevMonth").addEventListener("click", () => { monthCursor.setMonth(monthCursor.getMonth() - 1); renderCalendar(); });
$("#nextMonth").addEventListener("click", () => { monthCursor.setMonth(monthCursor.getMonth() + 1); renderCalendar(); });

// ——— THEME ———
function applyTheme() {
  document.body.classList.toggle("light", state.settings.theme === "light");
  $("#themeToggle").textContent = state.settings.theme === "light" ? "☾" : "☼";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = state.settings.theme === "light" ? "#eef4fb" : "#0b1220";
}
function toggleTheme() {
  state.settings.theme = state.settings.theme === "light" ? "dark" : "light";
  persist("settings");
  applyTheme();
}
$("#themeToggle").addEventListener("click", toggleTheme);
$("#settingsTheme").addEventListener("click", toggleTheme);

$("#saveSettings").addEventListener("click", () => {
  state.settings.name = $("#nameInput").value.trim().slice(0, 40);
  state.settings.weekStart = Number($("#weekStart").value) === 0 ? 0 : 1;
  persist("settings");
  render();
  toast("Paramètres enregistrés");
});

// ——— EXPORT / IMPORT ———
function exportAll() {
  const data = {
    format: "MyDigitalSpaceBackup",
    version: 2,
    exportedAt: new Date().toISOString(),
    tasks: state.tasks,
    projects: state.projects,
    goals: state.goals,
    habits: state.habits,
    events: state.events,
    settings: state.settings
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mydigital-space-backup.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Sauvegarde exportée");
}
$("#exportData").addEventListener("click", exportAll);

$("#importFile").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (d.format !== "MyDigitalSpaceBackup" || !Array.isArray(d.tasks) || !Array.isArray(d.projects) ||
        !Array.isArray(d.goals) || !Array.isArray(d.habits) || !Array.isArray(d.events)) {
      throw new Error("Format incorrect");
    }
    if (!confirm("Importer cette sauvegarde remplacera les données actuelles. Continuer ?")) return;
    for (const k of ["tasks","projects","goals","habits","events"]) state[k] = d[k];
    state.settings = {...state.settings, ...(d.settings || {})};
    // normalize after import
    state.tasks.forEach(t => {
      if (!Array.isArray(t.subtasks)) t.subtasks = [];
      if (t.projectId === undefined) t.projectId = null;
      if (!t.status) t.status = t.done ? "done" : "todo";
    });
    persistAll();
    $("#nameInput").value = state.settings.name || "";
    $("#weekStart").value = String(state.settings.weekStart ?? 1);
    applyTheme();
    render();
    toast("Sauvegarde restaurée");
  } catch {
    alert("Fichier invalide ou incompatible. Choisis une sauvegarde MyDigital Space.");
  } finally {
    e.target.value = "";
  }
});

$("#clearData").addEventListener("click", () => {
  if (!confirm("Effacer toutes les tâches, projets, objectifs, habitudes et événements de ce navigateur ?")) return;
  if (!confirm("Dernière confirmation : as-tu exporté les données à conserver ?")) return;
  ["tasks","projects","goals","habits","events"].forEach(k => { state[k] = []; persist(k); });
  render();
  toast("Données effacées");
});

// ——— GLOBAL SEARCH ———
$("#globalSearch").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    const q = e.target.value.trim().toLowerCase();
    if (!q) return;
    go("tasks");
    $("#taskSearch").value = q;
    renderTasks();
    const foundTask = state.tasks.some(t => t.title.toLowerCase().includes(q));
    if (!foundTask) {
      go("projects");
      $("#projectSearch").value = q;
      renderProjects();
    }
  }
});

// ——— NOTIFICATIONS ———
function updateNotifBanner() {
  const banner = $("#notifBanner");
  if (!("Notification" in window)) { banner.classList.add("hidden"); return; }
  if (Notification.permission === "granted" || state.settings.notif === false) {
    banner.classList.add("hidden");
  } else if (Notification.permission === "default") {
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
  }
}

$("#enableNotif")?.addEventListener("click", async () => {
  if (!("Notification" in window)) return;
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    state.settings.notif = true;
    persist("settings");
    toast("Notifications activées");
    scheduleNotifications();
  }
  updateNotifBanner();
});

function scheduleNotifications() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const dueTasks = state.tasks.filter(t => !t.done && t.due && t.due === today());
  const todayEvents = state.events.filter(e => e.date === today());
  if (dueTasks.length || todayEvents.length) {
    // simple one-shot notification (browsers limit background scheduling)
    try {
      new Notification("MyDigital Space", {
        body: `${dueTasks.length} tâche(s) et ${todayEvents.length} événement(s) pour aujourd'hui`,
        icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%2356a8ff'/%3E%3Ctext x='50' y='68' font-size='58' text-anchor='middle' fill='white' font-family='system-ui' font-weight='900'%3EM%3C/text%3E%3C/svg%3E",
        tag: "mds-daily"
      });
    } catch {}
  }
}

// ——— INIT ———
$("#nameInput").value = state.settings.name || "";
$("#weekStart").value = String(state.settings.weekStart ?? 1);
applyTheme();
loadPomoStats();
updatePomoUI();

const initial = (location.hash || "#dashboard").slice(1);
go(pageInfo[initial] ? initial : "dashboard");

// PWA: register service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

// Check due items once a day-ish
setTimeout(scheduleNotifications, 2000);

})();
