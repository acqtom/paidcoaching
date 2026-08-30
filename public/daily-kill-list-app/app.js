const $ = (s) => document.querySelector(s);
function uid() { return Math.random().toString(36).slice(2, 10); }

// ---------- Date helpers (day-nav / calls / braindump) ----------
function dateKey(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function strToDate(s) { const p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
function shiftKey(key, days) { const d = strToDate(key); d.setDate(d.getDate() + days); return dateKey(d); }

const TZ_DUBAI = "Asia/Dubai";
const localTz = (function () {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
  catch (e) { return "UTC"; }
})();
let activeTz = TZ_DUBAI;
function todayKeyIn(tz) {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
  catch (e) { return dateKey(new Date()); }
}
function todayKey() { return todayKeyIn(activeTz); }
function tzOffsetMinutes(tz) {
  try {
    const raw = ((new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")) || {}).value || "GMT+00:00";
    const m = raw.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!m) return 0;
    return (m[1] === "-" ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
  } catch (e) { return 0; }
}
function tzOffsetLabel(tz) {
  try {
    return ((new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")) || {}).value || "";
  } catch (e) { return ""; }
}
function isToday(d) { return dateKey(d) === todayKey(); }
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function shortDate(key) {
  const d = strToDate(key);
  return MON[d.getMonth()] + " " + d.getDate();
}

// a repeating item (call or task) is a fixture: it shows on every matching weekday
// from its start date onward, forever, independent of earlier occurrences.
function isRepeating(t) { return !!(t.repeat && t.repeat.days && t.repeat.days.length); }
function weekdayOf(dateStr) { return strToDate(dateStr).getDay(); }
function occursOn(t, dateStr) {
  return dateStr >= t.date && t.repeat.days.indexOf(weekdayOf(dateStr)) !== -1;
}
const WD2 = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
function repeatSummary(t) {
  const days = t.repeat.days.slice().sort((a, b) => a - b);
  if (days.length === 7) return "Daily";
  return days.map((d) => WD2[d]).join("·");
}

document.getElementById("todayDate").textContent = new Date().toLocaleDateString(
  undefined,
  { weekday: "long", month: "short", day: "numeric", year: "numeric" }
);

/* =========================================================================
   DAY-SCOPED STATE: Daily Calls + Braindump + timezone.
   Cached in localStorage for instant offline access; source of truth for
   "which device has the newest data" is state.updatedAt, synced through
   /api/daily-kill-list/state. Ported from the original Daily Kill List app.
   ========================================================================= */
const STORAGE_KEY = "focusEngineData_v2";
const DAILY_API_URL = "/api/daily-kill-list/state";

function newCall(title, link) {
  return { id: uid(), title: title || "", link: link || "", date: dateKey(viewDate), repeat: null };
}

function seedDailyData() {
  return { calls: [], timezone: TZ_DUBAI, braindump: {} };
}

// Loads whatever was last saved. Legacy keys from the pre-merge app (hero,
// clients, revenue, revenueGoal) are intentionally left untouched if present
// -- they're never read by this script, but dropping them here would mean
// the next save silently erases any needle-mover/client-todo/revenue data a
// user already entered before this merge shipped.
function loadDaily() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) {
        if (!Array.isArray(parsed.calls)) parsed.calls = [];
        if (!parsed.braindump || typeof parsed.braindump !== "object") parsed.braindump = {};
        if (!parsed.timezone) parsed.timezone = TZ_DUBAI;
        return parsed;
      }
    }
  } catch (e) { /* fall through to seed */ }
  return seedDailyData();
}

let dailyPushTimer = null;
let lastLocalEditAt = 0;
let dailySyncEnabled = true;
function scheduleDailyPush() {
  if (!dailySyncEnabled) return;
  clearTimeout(dailyPushTimer);
  dailyPushTimer = setTimeout(() => {
    fetch(DAILY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dailyState),
    }).then((r) => { if (r.status === 501) dailySyncEnabled = false; }).catch(() => {});
  }, 700);
}
function isEditingNow() {
  const el = document.activeElement;
  if (!el) return false;
  return (el.classList && (el.classList.contains("call-title") || el.classList.contains("call-link"))) || el.id === "braindumpText";
}
function pullDailyFromServer() {
  if (!dailySyncEnabled) return;
  fetch(DAILY_API_URL).then((r) => {
    if (r.status === 501) { dailySyncEnabled = false; return null; }
    return r.json();
  }).then((res) => {
    const serverState = res && res.data;
    if (!serverState) return;
    if (isEditingNow()) return;
    if (Date.now() - lastLocalEditAt < 1500) return;
    if (dailyState.updatedAt && serverState.updatedAt && serverState.updatedAt <= dailyState.updatedAt) return;
    if (!Array.isArray(serverState.calls)) serverState.calls = [];
    if (!serverState.braindump) serverState.braindump = {};
    if (!serverState.timezone) serverState.timezone = TZ_DUBAI;
    dailyState = serverState;
    activeTz = dailyState.timezone;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dailyState));
    renderDaily();
  }).catch(() => {});
}
function saveDaily() {
  dailyState.updatedAt = Date.now();
  lastLocalEditAt = dailyState.updatedAt;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dailyState));
  scheduleDailyPush();
}

let dailyState = loadDaily();
activeTz = dailyState.timezone || TZ_DUBAI;
let viewDate = strToDate(todayKey());
let focusId = null;

function normalizeUrl(u) {
  u = (u || "").trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}
function updateCallOpenLink(anchor, rawLink) {
  const url = normalizeUrl(rawLink);
  if (url) {
    anchor.href = url;
    anchor.classList.remove("disabled");
    anchor.removeAttribute("aria-disabled");
  } else {
    anchor.removeAttribute("href");
    anchor.classList.add("disabled");
    anchor.setAttribute("aria-disabled", "true");
  }
}
// calls are scheduled events, not outstanding work -- a one-off call only shows on the
// exact day it was set for (no rollover); a repeating call follows the weekday rule.
function visibleCallsFor(list) {
  const k = dateKey(viewDate);
  return list.filter((c) => (isRepeating(c) ? occursOn(c, k) : c.date === k));
}

function makeCallRow(call) {
  const row = document.createElement("div");
  row.className = "call-row";
  row.setAttribute("data-task-id", call.id);

  const title = document.createElement("input");
  title.type = "text";
  title.className = "call-title";
  title.value = call.title;
  title.placeholder = "Meeting title…";
  title.addEventListener("input", () => { call.title = title.value; saveDaily(); });
  title.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); title.blur(); } });

  const link = document.createElement("input");
  link.type = "text";
  link.className = "call-link";
  link.value = call.link;
  link.placeholder = "Paste Google Meet link…";
  link.addEventListener("input", () => {
    call.link = link.value;
    updateCallOpenLink(openBtn, call.link);
    saveDaily();
  });
  link.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); link.blur(); } });

  const openBtn = document.createElement("a");
  openBtn.className = "call-open";
  openBtn.textContent = "↗";
  openBtn.title = "Join call";
  openBtn.target = "_blank";
  openBtn.rel = "noopener noreferrer";
  updateCallOpenLink(openBtn, call.link);

  const repeatBtn = document.createElement("button");
  repeatBtn.type = "button";
  repeatBtn.className = "call-repeat-btn" + (isRepeating(call) ? " active" : "");
  repeatBtn.textContent = "↻";
  repeatBtn.title = isRepeating(call) ? ("Repeats " + repeatSummary(call)) : "Set repeat";
  repeatBtn.addEventListener("click", (e) => { e.stopPropagation(); openCallRepeatPop(call, repeatBtn); });

  const del = document.createElement("button");
  del.className = "call-del";
  del.textContent = "×";
  del.title = "Delete";
  del.addEventListener("click", () => {
    dailyState.calls = dailyState.calls.filter((c) => c.id !== call.id);
    saveDaily(); renderDaily();
  });

  row.appendChild(title); row.appendChild(link); row.appendChild(openBtn);
  if (isRepeating(call)) {
    const badge = document.createElement("span");
    badge.className = "call-repeat-badge";
    badge.textContent = "↻ " + repeatSummary(call);
    badge.title = "Repeats " + repeatSummary(call);
    row.appendChild(badge);
  }
  row.appendChild(repeatBtn);
  row.appendChild(del);
  return { row, title };
}

function handleCallAdd() {
  const c = newCall("", "");
  dailyState.calls.push(c);
  focusId = c.id;
  saveDaily(); renderDaily();
}
$("#callAdd").addEventListener("click", handleCallAdd);

function renderCalls() {
  const host = $("#callsList");
  host.innerHTML = "";
  const visible = visibleCallsFor(dailyState.calls);
  if (!visible.length) {
    host.innerHTML = '<div class="empty-state">No calls today. Paste a Meet link below.</div>';
  }
  visible.forEach((c) => host.appendChild(makeCallRow(c).row));
  $("#callsCount").textContent = visible.length + " today";
}

// ---- date nav ----
function renderDateLabel() {
  const d = viewDate;
  const dk = dateKey(d);
  const tk = todayKey();
  if (dk === tk) $("#dateD1").textContent = "Today";
  else if (dk === shiftKey(tk, -1)) $("#dateD1").textContent = "Yesterday";
  else if (dk === shiftKey(tk, 1)) $("#dateD1").textContent = "Tomorrow";
  else $("#dateD1").textContent = WEEK[d.getDay()];
  $("#dateD2").textContent = WEEK[d.getDay()] + ", " + MON[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
}
function handlePrevDay() { viewDate = new Date(viewDate.getTime() - 864e5); renderDaily(); }
function handleNextDay() { viewDate = new Date(viewDate.getTime() + 864e5); renderDaily(); }
$("#prevDay").addEventListener("click", handlePrevDay);
$("#nextDay").addEventListener("click", handleNextDay);

// ---- daily braindump ----
const braindumpText = $("#braindumpText");
braindumpText.addEventListener("input", () => {
  dailyState.braindump[dateKey(viewDate)] = braindumpText.value;
  saveDaily();
});
function renderBraindump() {
  const k = dateKey(viewDate);
  braindumpText.value = dailyState.braindump[k] || "";
  $("#braindumpDate").textContent = WEEK[viewDate.getDay()] + ", " + MON[viewDate.getMonth()] + " " + viewDate.getDate() + ", " + viewDate.getFullYear();
}

// ---- timezone clock + picker ----
const FALLBACK_ZONES = ["Pacific/Midway", "Pacific/Honolulu", "America/Anchorage", "America/Los_Angeles",
  "America/Denver", "America/Chicago", "America/New_York", "America/Sao_Paulo", "Atlantic/Azores", "UTC",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Athens", "Europe/Moscow", "Africa/Cairo",
  "Africa/Johannesburg", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Dhaka", "Asia/Bangkok",
  "Asia/Jakarta", "Asia/Shanghai", "Asia/Singapore", "Asia/Tokyo", "Asia/Seoul", "Australia/Perth",
  "Australia/Sydney", "Pacific/Auckland", "Pacific/Fiji"];

function buildTimezoneList() {
  let list = null;
  try { if (typeof Intl.supportedValuesOf === "function") list = Intl.supportedValuesOf("timeZone").slice(); } catch (e) { /* fall back */ }
  if (!list || !list.length) list = FALLBACK_ZONES.slice();
  if (list.indexOf(localTz) === -1) list.push(localTz);
  if (list.indexOf(TZ_DUBAI) === -1) list.push(TZ_DUBAI);
  list.sort((a, b) => {
    const oa = tzOffsetMinutes(a), ob = tzOffsetMinutes(b);
    return oa !== ob ? oa - ob : a.localeCompare(b);
  });
  return list;
}
function populateTzSelect() {
  const sel = $("#tzSelect");
  sel.innerHTML = "";
  buildTimezoneList().forEach((tz) => {
    const opt = document.createElement("option");
    opt.value = tz;
    const city = tz.split("/").pop().replace(/_/g, " ");
    opt.textContent = tzOffsetLabel(tz) + "  " + city + (tz === localTz ? " ★" : "");
    opt.title = tz + (tz === localTz ? " (this device)" : "");
    sel.appendChild(opt);
  });
  sel.value = activeTz;
}
function tzZoneLabel() {
  const city = activeTz.split("/").pop().replace(/_/g, " ");
  const off = tzOffsetLabel(activeTz);
  return city + (off ? " · " + off : "");
}
function renderClock() {
  let timeStr;
  try { timeStr = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true, timeZone: activeTz }); }
  catch (e) { timeStr = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }); }
  $("#tzTime").textContent = timeStr;
  $("#tzZone").textContent = tzZoneLabel();
}
function applyTimezoneChange(newTz) {
  activeTz = newTz;
  dailyState.timezone = activeTz;
  saveDaily();
  viewDate = strToDate(todayKey());
  renderClock();
  renderDaily();
}
$("#tzSelect").addEventListener("change", () => applyTimezoneChange($("#tzSelect").value));
$("#tzClock").addEventListener("click", () => {
  const sel = $("#tzSelect");
  if (sel.showPicker) { try { sel.showPicker(); return; } catch (e) { /* fall back to focus */ } }
  sel.focus();
});
populateTzSelect();
renderClock();
setInterval(renderClock, 15000);

// ---- repeat popover (Daily Calls only -- backlog tasks set repeat once at add-time) ----
let repeatTarget = null;
function buildRepeatDayChips() {
  const host = $("#repeatDays");
  host.innerHTML = "";
  WD2.forEach((label, idx) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "rp-day"; b.textContent = label; b.dataset.day = idx;
    b.addEventListener("click", () => toggleCallRepeatDay(idx));
    host.appendChild(b);
  });
}
function refreshCallRepeatPopUI() {
  if (!repeatTarget) return;
  const days = (repeatTarget.repeat && repeatTarget.repeat.days) || [];
  Array.prototype.forEach.call($("#repeatDays").children, (chip) => {
    chip.classList.toggle("active", days.indexOf(+chip.dataset.day) !== -1);
  });
}
function updateCallRowRepeatUI(call) {
  const row = document.querySelector('[data-task-id="' + call.id + '"]');
  if (!row) return;
  const btn = row.querySelector(".call-repeat-btn");
  const active = isRepeating(call);
  if (btn) {
    btn.classList.toggle("active", active);
    btn.title = active ? ("Repeats " + repeatSummary(call)) : "Set repeat";
  }
  let badge = row.querySelector(".call-repeat-badge");
  if (active) {
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "call-repeat-badge";
      row.insertBefore(badge, btn);
    }
    badge.textContent = "↻ " + repeatSummary(call);
    badge.title = "Repeats " + repeatSummary(call);
  } else if (badge) {
    badge.remove();
  }
}
function setCallRepeatDays(days) {
  if (!repeatTarget) return;
  days = Array.from(new Set(days)).sort((a, b) => a - b);
  repeatTarget.repeat = days.length ? { days } : null;
  saveDaily();
  refreshCallRepeatPopUI();
  updateCallRowRepeatUI(repeatTarget);
}
function toggleCallRepeatDay(d) {
  const days = (repeatTarget.repeat && repeatTarget.repeat.days.slice()) || [];
  const i = days.indexOf(d);
  if (i >= 0) days.splice(i, 1); else days.push(d);
  setCallRepeatDays(days);
}
function openCallRepeatPop(call, btnEl) {
  repeatTarget = call;
  refreshCallRepeatPopUI();
  const pop = $("#repeatPop");
  const r = btnEl.getBoundingClientRect();
  pop.hidden = false;
  const top = r.bottom + 6;
  const left = Math.min(r.left, window.innerWidth - 240);
  pop.style.top = Math.max(8, top) + "px";
  pop.style.left = Math.max(8, left) + "px";
}
function closeCallRepeatPop() {
  if ($("#repeatPop").hidden) return;
  $("#repeatPop").hidden = true;
  repeatTarget = null;
  renderDaily();
}
buildRepeatDayChips();
document.querySelector('[data-preset="daily"]').addEventListener("click", () => setCallRepeatDays([0, 1, 2, 3, 4, 5, 6]));
document.querySelector('[data-preset="weekly"]').addEventListener("click", () => setCallRepeatDays([weekdayOf(repeatTarget.date)]));
document.querySelector('[data-preset="mwf"]').addEventListener("click", () => setCallRepeatDays([1, 3, 5]));
document.querySelector('[data-preset="none"]').addEventListener("click", () => setCallRepeatDays([]));
document.addEventListener("mousedown", (e) => {
  const pop = $("#repeatPop");
  if (pop.hidden || pop.contains(e.target) || (e.target.closest && e.target.closest(".call-repeat-btn"))) return;
  closeCallRepeatPop();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#repeatPop").hidden) closeCallRepeatPop(); });

function renderDaily() {
  renderDateLabel();
  renderBraindump();
  renderCalls();
  if (focusId) {
    const el = document.querySelector('[data-task-id="' + focusId + '"] .call-title');
    if (el) {
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }
  focusId = null;
  saveDaily();
}

/* =========================================================================
   PERSISTENT BACKLOG: Marketing / Sales / Operations / Fulfilment to-dos +
   Yearly Goals. Not scoped to the selected day -- one shared, ongoing
   backlog, synced through /api/daily-kill-list/backlog (full round-trip
   per mutation, no local cache). Ported from the Prioritization Task
   Backlog app; client/assignee routing replaced with department routing.
   ========================================================================= */
const BACKLOG_API_URL = "/api/daily-kill-list/backlog";
const BACKLOG_POLL_INTERVAL_MS = 4000;

const DEPARTMENTS = [
  { id: "marketing", label: "Marketing" },
  { id: "sales", label: "Sales" },
  { id: "operations", label: "Operations" },
  { id: "fulfilment", label: "Fulfilment" },
];
const DEFAULT_DEPARTMENT = "marketing";

function taskDepartment(t) {
  return DEPARTMENTS.some((d) => d.id === t.department) ? t.department : DEFAULT_DEPARTMENT;
}
function departmentLabel(id) {
  const d = DEPARTMENTS.find((d) => d.id === id);
  return d ? d.label : DEPARTMENTS.find((d) => d.id === DEFAULT_DEPARTMENT).label;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isDoneToday(task) { return isRepeating(task) && task.lastCompletedDate === todayStr(); }
function isTaskDone(task) { return isRepeating(task) ? isDoneToday(task) : !!task.done; }
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function repeatLabel(task) {
  if (!isRepeating(task)) return "";
  const days = [...task.repeat.days].sort((a, b) => a - b);
  return days.map((d) => DAY_LABELS[d]).join("/");
}

let tasks = [];
let yearlyGoals = [];
let activeFilter = "all";
let lastBacklogUpdatedAt = 0;
let backlogPollTimer = null;

const syncStatus = $("#syncStatus");
function setSyncStatus(text) { if (syncStatus) syncStatus.textContent = text; }

async function readErrorDetail(res) {
  try {
    const body = await res.clone().json();
    if (body && body.error) return body.error;
  } catch (e) { /* body wasn't JSON */ }
  return res.statusText || "";
}
async function apiGetBacklog() {
  const res = await fetch(BACKLOG_API_URL);
  if (!res.ok) throw new Error("GET " + BACKLOG_API_URL + " failed: " + res.status + " " + (await readErrorDetail(res)));
  return res.json();
}
async function apiSaveBacklog(state) {
  const res = await fetch(BACKLOG_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error("POST " + BACKLOG_API_URL + " failed: " + res.status + " " + (await readErrorDetail(res)));
  return res.json();
}
function applyBacklogState(state) {
  tasks = Array.isArray(state.tasks) ? state.tasks : [];
  yearlyGoals = Array.isArray(state.yearlyGoals) ? state.yearlyGoals : [];
  lastBacklogUpdatedAt = state.updatedAt || 0;
  renderBacklog();
  renderYearly();
}
async function mutateBacklogState(mutator) {
  setSyncStatus("Saving…");
  try {
    const latest = await apiGetBacklog();
    const draft = {
      tasks: Array.isArray(latest.tasks) ? latest.tasks : [],
      yearlyGoals: Array.isArray(latest.yearlyGoals) ? latest.yearlyGoals : [],
    };
    mutator(draft);
    const saved = await apiSaveBacklog(draft);
    applyBacklogState(saved);
    setSyncStatus("Synced");
  } catch (e) {
    console.error("Daily Kill List backlog save failed:", e);
    setSyncStatus("Sync error: " + e.message);
  }
}
async function pollBacklogForUpdates() {
  try {
    const state = await apiGetBacklog();
    if (state.updatedAt !== lastBacklogUpdatedAt) {
      applyBacklogState(state);
      setSyncStatus("Synced");
    }
  } catch (e) {
    console.error("Daily Kill List backlog poll failed:", e);
  }
}
async function initBacklog() {
  setSyncStatus("Loading…");
  try {
    const state = await apiGetBacklog();
    applyBacklogState(state);
    setSyncStatus("Synced");
  } catch (e) {
    console.error("Daily Kill List backlog load failed:", e);
    setSyncStatus("Sync error: " + e.message);
  }
  if (backlogPollTimer) clearInterval(backlogPollTimer);
  backlogPollTimer = setInterval(pollBacklogForUpdates, BACKLOG_POLL_INTERVAL_MS);
}

// ---------- Elements ----------
const addTaskForm = $("#addTaskForm");
const taskInput = $("#taskInput");
const departmentSelect = $("#departmentSelect");
const levelSelect = $("#levelSelect");
const repeatDayCheckboxes = [...document.querySelectorAll(".repeat-day-checkbox")];
const priorityToggle = $("#priorityToggle");
const taskList = $("#taskList");
const completedList = $("#completedList");
const emptyState = $("#emptyState");
const emptyCompleted = $("#emptyCompleted");
const filterTabs = $("#filterTabs");

const DEPT_LISTS = {
  marketing: { list: $("#marketingTaskList"), empty: $("#marketingEmptyState"), count: $("#marketingOpenCount") },
  sales: { list: $("#salesTaskList"), empty: $("#salesEmptyState"), count: $("#salesOpenCount") },
  operations: { list: $("#operationsTaskList"), empty: $("#operationsEmptyState"), count: $("#operationsOpenCount") },
  fulfilment: { list: $("#fulfilmentTaskList"), empty: $("#fulfilmentEmptyState"), count: $("#fulfilmentOpenCount") },
};

departmentSelect.innerHTML = "";
DEPARTMENTS.forEach((d) => {
  const opt = document.createElement("option");
  opt.value = d.id;
  opt.textContent = d.label;
  departmentSelect.appendChild(opt);
});

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
    department: departmentSelect.value,
    level: levelSelect.value,
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

  await mutateBacklogState((draft) => { draft.tasks.unshift(newTask); });
  taskInput.focus();
});

// ---------- Filter tabs ----------
function renderFilterTabs() {
  filterTabs.innerHTML = "";
  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "tab" + (activeFilter === "all" ? " active" : "");
  allBtn.dataset.filter = "all";
  allBtn.textContent = "All";
  filterTabs.appendChild(allBtn);

  DEPARTMENTS.forEach((d) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab" + (activeFilter === d.id ? " active" : "");
    btn.dataset.filter = d.id;
    btn.textContent = d.label;
    filterTabs.appendChild(btn);
  });
}
filterTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  activeFilter = btn.dataset.filter;
  [...filterTabs.querySelectorAll(".tab")].forEach((t) => t.classList.toggle("active", t === btn));
  renderBacklog();
});
renderFilterTabs();

// ---------- Task actions ----------
async function toggleDone(id) {
  await mutateBacklogState((draft) => {
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
  await mutateBacklogState((draft) => {
    const task = draft.tasks.find((t) => t.id === id);
    if (!task) return;
    task.priority = !task.priority;
  });
}
async function deleteTask(id) {
  await mutateBacklogState((draft) => {
    draft.tasks = draft.tasks.filter((t) => t.id !== id);
  });
}

// ---------- Rendering ----------
const LEVEL_RANK = { high: 3, medium: 2, low: 1 };
const LEVEL_TEXT = { high: "High", medium: "Medium", low: "Low" };
function taskLevel(task) { return task.level || "medium"; }

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

  const dept = taskDepartment(task);
  const department = document.createElement("span");
  department.className = "task-department dept-" + dept;
  department.textContent = departmentLabel(dept);

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
  row.appendChild(department);
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

function renderDepartmentBacklogs() {
  DEPARTMENTS.forEach((d) => {
    const refs = DEPT_LISTS[d.id];
    const open = openTasksFor(tasks.filter((t) => taskDepartment(t) === d.id));
    refs.list.innerHTML = "";
    open.forEach((t) => refs.list.appendChild(makeTaskRow(t)));
    refs.empty.style.display = open.length ? "none" : "block";
    refs.count.textContent = `${open.length} open`;
  });
}

function renderBacklog() {
  const filtered = activeFilter === "all" ? tasks : tasks.filter((t) => taskDepartment(t) === activeFilter);
  const open = openTasksFor(filtered);
  const done = filtered.filter((t) => isTaskDone(t)).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

  taskList.innerHTML = "";
  open.forEach((t) => taskList.appendChild(makeTaskRow(t)));
  emptyState.style.display = open.length ? "none" : "block";

  completedList.innerHTML = "";
  done.forEach((t) => completedList.appendChild(makeTaskRow(t)));
  emptyCompleted.style.display = done.length ? "none" : "block";

  $("#openCount").textContent = `${open.length} open`;
  $("#completedCount").textContent = `${done.length} done`;

  renderDepartmentBacklogs();

  const totalAll = filtered.length;
  const doneAll = filtered.filter((t) => isTaskDone(t)).length;
  const pct = totalAll ? Math.round((doneAll / totalAll) * 100) : 0;

  $("#progressPercent").textContent = `${pct}%`;
  $("#progressFill").style.width = `${pct}%`;
  $("#progressCount").textContent = `${doneAll} of ${totalAll} done`;

  const headline = $("#progressHeadline");
  if (totalAll === 0) headline.textContent = "No tasks yet.";
  else if (doneAll === 0) headline.textContent = "Nothing done yet. The needle's waiting.";
  else if (doneAll === totalAll) headline.textContent = "All done. Backlog clear.";
  else headline.textContent = "Chipping away at it.";
}

// ---------- Yearly goals ----------
const yearlyForm = $("#yearlyForm");
const yearlyInput = $("#yearlyInput");
const yearlyList = $("#yearlyList");
const yearlyEmpty = $("#yearlyEmpty");

function makeYearlyRow(goal) {
  const row = document.createElement("div");
  row.className = "task-row" + (goal.done ? " done" : "");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-checkbox";
  checkbox.checked = goal.done;
  checkbox.addEventListener("change", async () => {
    await mutateBacklogState((draft) => {
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
    await mutateBacklogState((draft) => {
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

  $("#yearlyProgressCount").textContent = `${done} of ${total} done`;
  $("#yearlyProgressFill").style.width = `${pct}%`;
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
  await mutateBacklogState((draft) => { draft.yearlyGoals.unshift(newGoal); });
  yearlyInput.focus();
});

// ---------- Boot ----------
renderDaily();
pullDailyFromServer();
setInterval(pullDailyFromServer, 5000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) pullDailyFromServer(); });
window.addEventListener("focus", pullDailyFromServer);

initBacklog();
