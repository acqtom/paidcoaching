const API_URL = "/api/task-backlog/state";
const POLL_INTERVAL_MS = 4000;

const CLIENT_PALETTE = [
  { bg: "#e9e6ff", fg: "#5b52e5" },
  { bg: "#e3edff", fg: "#4a7dfc" },
  { bg: "#dff5f2", fg: "#0f9b8e" },
  { bg: "#fbe6f1", fg: "#c2377f" },
  { bg: "#efe6fb", fg: "#8452d6" },
  { bg: "#e2f3fa", fg: "#0f7fa3" },
];

const ASSIGNEE_COLORS = {
  T: { bg: "#e3edff", fg: "#4a7dfc" },
  D: { bg: "#fbe6f1", fg: "#c2377f" },
  "-": { bg: "#eaedf2", fg: "#64748b" },
};

const BOTH_LABEL_COLOR = { bg: "#eaedf2", fg: "#64748b" };

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isRepeating(task) {
  return !!(task.repeat && Array.isArray(task.repeat.days) && task.repeat.days.length);
}

function isDoneToday(task) {
  return isRepeating(task) && task.lastCompletedDate === todayStr();
}

function isTaskDone(task) {
  return isRepeating(task) ? isDoneToday(task) : !!task.done;
}

function repeatLabel(task) {
  if (!isRepeating(task)) return "";
  const days = [...task.repeat.days].sort((a, b) => a - b);
  return days.map((d) => DAY_LABELS[d]).join("/");
}

let tasks = [];
let clients = ["Adriel", "Alex"];
let yearlyGoals = [];
let activeFilter = "all";
let editingClientName = null;
let isAddingClient = false;
let lastUpdatedAt = 0;
let pollTimer = null;

const syncStatus = document.getElementById("syncStatus");

function setSyncStatus(text) {
  if (syncStatus) syncStatus.textContent = text;
}

// ---------- Date ----------
document.getElementById("todayDate").textContent = new Date().toLocaleDateString(
  undefined,
  { weekday: "long", month: "short", day: "numeric", year: "numeric" }
);

// ---------- Shared backend ----------
// Real access control is the Student Portal's own login (Supabase Auth,
// cookie-based) -- no separate app password needed here.
async function apiGet() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error("request failed: " + res.status);
  return res.json();
}

async function apiSave(state) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error("request failed: " + res.status);
  return res.json();
}

function applyState(state) {
  tasks = Array.isArray(state.tasks) ? state.tasks : [];
  clients = Array.isArray(state.clients) && state.clients.length ? state.clients : ["Adriel", "Alex"];
  yearlyGoals = Array.isArray(state.yearlyGoals) ? state.yearlyGoals : [];
  lastUpdatedAt = state.updatedAt || 0;
  renderFilterTabs();
  renderLabelOptions();
  render();
  renderYearly();
}

async function mutateState(mutator) {
  setSyncStatus("Saving…");
  try {
    const latest = await apiGet();
    const draft = {
      tasks: Array.isArray(latest.tasks) ? latest.tasks : [],
      clients: Array.isArray(latest.clients) && latest.clients.length ? latest.clients : ["Adriel", "Alex"],
      yearlyGoals: Array.isArray(latest.yearlyGoals) ? latest.yearlyGoals : [],
    };
    mutator(draft);
    const saved = await apiSave(draft);
    applyState(saved);
    setSyncStatus("Synced");
  } catch (e) {
    setSyncStatus("Sync error");
  }
}

async function pollForUpdates() {
  if (editingClientName || isAddingClient) return;
  try {
    const state = await apiGet();
    if (state.updatedAt !== lastUpdatedAt) {
      applyState(state);
      setSyncStatus("Synced");
    }
  } catch (e) {
    // transient network hiccup; try again next interval
  }
}

async function initApp() {
  setSyncStatus("Loading…");
  try {
    const state = await apiGet();
    applyState(state);
    setSyncStatus("Synced");
  } catch (e) {
    setSyncStatus("Sync error");
  }
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(pollForUpdates, POLL_INTERVAL_MS);
}

function clientColor(index) {
  return CLIENT_PALETTE[((index % CLIENT_PALETTE.length) + CLIENT_PALETTE.length) % CLIENT_PALETTE.length];
}

// ---------- Elements ----------
const addTaskForm = document.getElementById("addTaskForm");
const taskInput = document.getElementById("taskInput");
const labelSelect = document.getElementById("labelSelect");
const levelSelect = document.getElementById("levelSelect");
const assigneeSelect = document.getElementById("assigneeSelect");
const repeatDayCheckboxes = [...document.querySelectorAll(".repeat-day-checkbox")];
const priorityToggle = document.getElementById("priorityToggle");
const taskList = document.getElementById("taskList");
const completedList = document.getElementById("completedList");
const emptyState = document.getElementById("emptyState");
const emptyCompleted = document.getElementById("emptyCompleted");
const filterTabs = document.getElementById("filterTabs");
const clientStats = document.getElementById("clientStats");

const tomTaskList = document.getElementById("tomTaskList");
const tomEmptyState = document.getElementById("tomEmptyState");
const tomOpenCount = document.getElementById("tomOpenCount");
const derekTaskList = document.getElementById("derekTaskList");
const derekEmptyState = document.getElementById("derekEmptyState");
const derekOpenCount = document.getElementById("derekOpenCount");

let addingPriority = false;

priorityToggle.addEventListener("click", () => {
  addingPriority = !addingPriority;
  priorityToggle.classList.toggle("active", addingPriority);
  priorityToggle.innerHTML = addingPriority ? "&#9733;" : "&#9734;";
});

function computeRepeatDays() {
  const days = repeatDayCheckboxes.filter((cb) => cb.checked).map((cb) => Number(cb.value));
  return days.length ? days : null;
}

function resetRepeatControls() {
  repeatDayCheckboxes.forEach((cb) => (cb.checked = false));
}

// ---------- Add task ----------
addTaskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;

  const repeatDays = computeRepeatDays();

  const newTask = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    text,
    label: labelSelect.value,
    level: levelSelect.value,
    assignee: assigneeSelect.value,
    priority: addingPriority,
    repeat: repeatDays ? { days: repeatDays } : null,
    lastCompletedDate: null,
    done: false,
    createdAt: Date.now(),
  };

  taskInput.value = "";
  addingPriority = false;
  priorityToggle.classList.remove("active");
  priorityToggle.innerHTML = "&#9734;";
  resetRepeatControls();

  await mutateState((draft) => {
    draft.tasks.unshift(newTask);
  });
  taskInput.focus();
});

// ---------- Filter tabs ----------
filterTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  activeFilter = btn.dataset.filter;
  [...filterTabs.querySelectorAll(".tab")].forEach((t) =>
    t.classList.toggle("active", t === btn)
  );
  render();
});

// ---------- Client management ----------
function renderFilterTabs() {
  filterTabs.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "tab" + (activeFilter === "all" ? " active" : "");
  allBtn.dataset.filter = "all";
  allBtn.textContent = "All";
  filterTabs.appendChild(allBtn);

  clients.forEach((name) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab" + (activeFilter === name ? " active" : "");
    btn.dataset.filter = name;
    btn.textContent = name;
    filterTabs.appendChild(btn);
  });
}

function renderLabelOptions() {
  const prevValue = labelSelect.value;
  labelSelect.innerHTML = "";
  clients.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    labelSelect.appendChild(opt);
  });
  const bothOpt = document.createElement("option");
  bothOpt.value = "Both";
  bothOpt.textContent = "Both";
  labelSelect.appendChild(bothOpt);
  if (clients.includes(prevValue) || prevValue === "Both") labelSelect.value = prevValue;
}

function clientTaskCount(name) {
  return tasks.filter((t) => t.label === name && !isTaskDone(t)).length;
}

function countLabel(n) {
  return `${n} task${n === 1 ? "" : "s"}`;
}

async function commitRename(oldName, newValue) {
  const trimmed = (newValue || "").trim();
  editingClientName = null;

  if (!trimmed || trimmed === oldName) {
    renderClientStats();
    return;
  }
  if (clients.some((c) => c.toLowerCase() === trimmed.toLowerCase() && c !== oldName) || trimmed.toLowerCase() === "both") {
    alert(`"${trimmed}" already exists.`);
    renderClientStats();
    return;
  }

  if (activeFilter === oldName) activeFilter = trimmed;
  if (labelSelect.value === oldName) labelSelect.value = trimmed;

  await mutateState((draft) => {
    const idx = draft.clients.indexOf(oldName);
    if (idx === -1) return;
    draft.clients[idx] = trimmed;
    draft.tasks.forEach((t) => {
      if (t.label === oldName) t.label = trimmed;
    });
  });
}

async function commitAddClient(value) {
  const trimmed = (value || "").trim();
  isAddingClient = false;

  if (!trimmed) {
    renderClientStats();
    return;
  }
  if (clients.some((c) => c.toLowerCase() === trimmed.toLowerCase()) || trimmed.toLowerCase() === "both") {
    alert(`"${trimmed}" already exists.`);
    renderClientStats();
    return;
  }

  await mutateState((draft) => {
    draft.clients.push(trimmed);
  });
}

function renderClientStats() {
  clientStats.innerHTML = "";

  clients.forEach((name, idx) => {
    const color = clientColor(idx);
    const card = document.createElement("div");
    card.className = "client-stat-card";

    const dot = document.createElement("span");
    dot.className = "client-stat-dot";
    dot.style.background = color.fg;
    card.appendChild(dot);

    const info = document.createElement("div");
    info.className = "client-stat-info";

    if (editingClientName === name) {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "client-rename-input";
      input.value = name;
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitRename(name, input.value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          editingClientName = null;
          renderClientStats();
        }
      });
      input.addEventListener("blur", () => commitRename(name, input.value));
      info.appendChild(input);
      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    } else {
      const nameRow = document.createElement("div");
      nameRow.className = "client-stat-name-row";

      const nameSpan = document.createElement("span");
      nameSpan.className = "client-stat-name";
      nameSpan.textContent = name;
      nameRow.appendChild(nameSpan);

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "client-edit-btn";
      editBtn.innerHTML = "&#9998;";
      editBtn.title = "Rename client";
      editBtn.addEventListener("click", () => {
        editingClientName = name;
        renderClientStats();
      });
      nameRow.appendChild(editBtn);

      info.appendChild(nameRow);
    }

    const count = document.createElement("div");
    count.className = "client-stat-count";
    count.textContent = countLabel(clientTaskCount(name));
    info.appendChild(count);

    card.appendChild(info);
    clientStats.appendChild(card);
  });

  if (isAddingClient) {
    const form = document.createElement("form");
    form.className = "client-stat-card client-add-form";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "client-add-input";
    input.placeholder = "Client name";
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        isAddingClient = false;
        renderClientStats();
      }
    });
    form.appendChild(input);

    const btn = document.createElement("button");
    btn.type = "submit";
    btn.className = "add-btn-small";
    btn.textContent = "Add";
    form.appendChild(btn);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      commitAddClient(input.value);
    });

    clientStats.appendChild(form);
    requestAnimationFrame(() => input.focus());
  } else {
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "client-stat-card add-client-card";
    addBtn.textContent = "+ Add client";
    addBtn.addEventListener("click", () => {
      isAddingClient = true;
      renderClientStats();
    });
    clientStats.appendChild(addBtn);
  }
}

// ---------- Task actions ----------
async function toggleDone(id) {
  await mutateState((draft) => {
    const task = draft.tasks.find((t) => t.id === id);
    if (!task) return;
    if (isRepeating(task)) {
      const today = todayStr();
      if (task.lastCompletedDate === today) {
        task.lastCompletedDate = null;
      } else {
        task.lastCompletedDate = today;
        task.doneAt = Date.now();
      }
      return;
    }
    task.done = !task.done;
    if (task.done) task.doneAt = Date.now();
  });
}

async function toggleStar(id) {
  await mutateState((draft) => {
    const task = draft.tasks.find((t) => t.id === id);
    if (!task) return;
    task.priority = !task.priority;
  });
}

async function deleteTask(id) {
  await mutateState((draft) => {
    draft.tasks = draft.tasks.filter((t) => t.id !== id);
  });
}

// ---------- Rendering ----------
const LEVEL_RANK = { high: 3, medium: 2, low: 1 };
const LEVEL_TEXT = { high: "High", medium: "Medium", low: "Low" };

function taskLevel(task) {
  return task.level || "medium";
}

function makeTaskRow(task) {
  const doneVisual = isTaskDone(task);
  const row = document.createElement("div");
  row.className = "task-row" + (doneVisual ? " done" : "") + (task.priority && !doneVisual ? " priority" : "");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-checkbox";
  checkbox.checked = doneVisual;
  checkbox.addEventListener("change", () => toggleDone(task.id));

  const text = document.createElement("span");
  text.className = "task-text";
  text.textContent = task.text;

  const level = document.createElement("span");
  level.className = "task-level level-" + taskLevel(task);
  level.textContent = LEVEL_TEXT[taskLevel(task)];

  const label = document.createElement("span");
  label.className = "task-label";
  const color = task.label === "Both" ? BOTH_LABEL_COLOR : clientColor(clients.indexOf(task.label));
  label.style.background = color.bg;
  label.style.color = color.fg;
  label.textContent = task.label;

  const assignee = document.createElement("span");
  assignee.className = "task-label task-assignee";
  const assigneeColor = ASSIGNEE_COLORS[task.assignee] || ASSIGNEE_COLORS.T;
  assignee.style.background = assigneeColor.bg;
  assignee.style.color = assigneeColor.fg;
  assignee.textContent = task.assignee || "T";

  let repeatBadge = null;
  if (isRepeating(task)) {
    repeatBadge = document.createElement("span");
    repeatBadge.className = "task-repeat-badge";
    repeatBadge.title = "Repeats: " + repeatLabel(task);
    repeatBadge.textContent = "\u{1F501} " + repeatLabel(task);
  }

  const star = document.createElement("button");
  star.type = "button";
  star.className = "star-btn" + (task.priority ? " active" : "");
  star.innerHTML = task.priority ? "&#9733;" : "&#9734;";
  star.title = "Toggle top priority";
  star.addEventListener("click", () => toggleStar(task.id));

  const del = document.createElement("button");
  del.type = "button";
  del.className = "delete-btn";
  del.innerHTML = "&#10005;";
  del.title = "Delete task";
  del.addEventListener("click", () => deleteTask(task.id));

  row.appendChild(checkbox);
  row.appendChild(text);
  row.appendChild(level);
  row.appendChild(label);
  row.appendChild(assignee);
  if (repeatBadge) row.appendChild(repeatBadge);
  row.appendChild(star);
  row.appendChild(del);
  return row;
}

function sortOpenTasks(list) {
  return [...list].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority ? -1 : 1;
    const rankDiff = LEVEL_RANK[taskLevel(b)] - LEVEL_RANK[taskLevel(a)];
    if (rankDiff !== 0) return rankDiff;
    return b.createdAt - a.createdAt;
  });
}

function openTasksFor(list) {
  const pending = sortOpenTasks(list.filter((t) => !isTaskDone(t)));
  const doneTodayRepeating = sortOpenTasks(list.filter((t) => isRepeating(t) && isDoneToday(t)));
  return [...pending, ...doneTodayRepeating];
}

function renderAssigneeBacklogs() {
  const tomOpen = openTasksFor(tasks.filter((t) => t.assignee === "T"));
  tomTaskList.innerHTML = "";
  tomOpen.forEach((t) => tomTaskList.appendChild(makeTaskRow(t)));
  tomEmptyState.style.display = tomOpen.length ? "none" : "block";
  tomOpenCount.textContent = `${tomOpen.length} open`;

  const derekOpen = openTasksFor(tasks.filter((t) => t.assignee === "D"));
  derekTaskList.innerHTML = "";
  derekOpen.forEach((t) => derekTaskList.appendChild(makeTaskRow(t)));
  derekEmptyState.style.display = derekOpen.length ? "none" : "block";
  derekOpenCount.textContent = `${derekOpen.length} open`;
}

function render() {
  const filtered = activeFilter === "all" ? tasks : tasks.filter((t) => t.label === activeFilter);
  const open = openTasksFor(filtered);
  const done = filtered.filter((t) => isTaskDone(t)).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

  taskList.innerHTML = "";
  open.forEach((t) => taskList.appendChild(makeTaskRow(t)));
  emptyState.style.display = open.length ? "none" : "block";

  completedList.innerHTML = "";
  done.forEach((t) => completedList.appendChild(makeTaskRow(t)));
  emptyCompleted.style.display = done.length ? "none" : "block";

  document.getElementById("openCount").textContent = `${open.length} open`;
  document.getElementById("completedCount").textContent = `${done.length} done`;

  renderClientStats();
  renderAssigneeBacklogs();

  const totalAll = activeFilter === "all" ? tasks.length : tasks.filter((t) => t.label === activeFilter).length;
  const doneAll = activeFilter === "all" ? tasks.filter((t) => isTaskDone(t)).length : tasks.filter((t) => t.label === activeFilter && isTaskDone(t)).length;
  const pct = totalAll ? Math.round((doneAll / totalAll) * 100) : 0;

  document.getElementById("progressPercent").textContent = `${pct}%`;
  document.getElementById("progressFill").style.width = `${pct}%`;
  document.getElementById("progressCount").textContent = `${doneAll} of ${totalAll} done`;

  const headline = document.getElementById("progressHeadline");
  if (totalAll === 0) {
    headline.textContent = "No tasks yet.";
  } else if (doneAll === 0) {
    headline.textContent = "Nothing done yet. The needle's waiting.";
  } else if (doneAll === totalAll) {
    headline.textContent = "All done. Backlog clear.";
  } else {
    headline.textContent = "Chipping away at it.";
  }
}

// ---------- Yearly goals (separate from client backlog) ----------
const yearlyForm = document.getElementById("yearlyForm");
const yearlyInput = document.getElementById("yearlyInput");
const yearlyList = document.getElementById("yearlyList");
const yearlyEmpty = document.getElementById("yearlyEmpty");

function makeYearlyRow(goal) {
  const row = document.createElement("div");
  row.className = "task-row" + (goal.done ? " done" : "");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-checkbox";
  checkbox.checked = goal.done;
  checkbox.addEventListener("change", async () => {
    await mutateState((draft) => {
      const g = draft.yearlyGoals.find((y) => y.id === goal.id);
      if (!g) return;
      g.done = !g.done;
      if (g.done) g.doneAt = Date.now();
    });
  });

  const text = document.createElement("span");
  text.className = "task-text";
  text.textContent = goal.text;

  const del = document.createElement("button");
  del.type = "button";
  del.className = "delete-btn";
  del.innerHTML = "&#10005;";
  del.title = "Delete goal";
  del.addEventListener("click", async () => {
    await mutateState((draft) => {
      draft.yearlyGoals = draft.yearlyGoals.filter((g) => g.id !== goal.id);
    });
  });

  row.appendChild(checkbox);
  row.appendChild(text);
  row.appendChild(del);
  return row;
}

function renderYearly() {
  const sorted = [...yearlyGoals].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return b.createdAt - a.createdAt;
  });

  yearlyList.innerHTML = "";
  sorted.forEach((g) => yearlyList.appendChild(makeYearlyRow(g)));
  yearlyEmpty.style.display = sorted.length ? "none" : "block";

  const total = yearlyGoals.length;
  const done = yearlyGoals.filter((g) => g.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  document.getElementById("yearlyProgressCount").textContent = `${done} of ${total} done`;
  document.getElementById("yearlyProgressFill").style.width = `${pct}%`;
}

yearlyForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = yearlyInput.value.trim();
  if (!text) return;

  const newGoal = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    text,
    done: false,
    createdAt: Date.now(),
  };

  yearlyInput.value = "";
  await mutateState((draft) => {
    draft.yearlyGoals.unshift(newGoal);
  });
  yearlyInput.focus();
});

initApp();
