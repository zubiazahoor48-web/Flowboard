"use strict";

const STORAGE_KEY = "flowboard.tasks.v1";
const STATUSES = ["todo", "doing", "done"];
const LABELS = { todo: "To do", doing: "In progress", done: "Done" };
const PRIORITY_LABEL = { high: "High", medium: "Medium", low: "Low" };

const $ = (sel) => document.querySelector(sel);
const escapeHTML = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const todayStr = () => new Date().toISOString().slice(0, 10);

let tasks = load();
const modal = new bootstrap.Modal("#taskModal");
const toast = new bootstrap.Toast("#toast", { delay: 2000 });

/* ---------- Storage ---------- */
function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}
function notify(msg) {
  $("#toastMsg").textContent = msg;
  toast.show();
}

/* ---------- Rendering ---------- */
function visible(task) {
  const q = $("#search").value.trim().toLowerCase();
  const p = $("#priorityFilter").value;
  const text = (task.title + " " + task.notes).toLowerCase();
  return text.includes(q) && (p === "all" || task.priority === p);
}

function cardHTML(t) {
  const idx = STATUSES.indexOf(t.status);
  const overdue = t.due && t.status !== "done" && t.due < todayStr();
  const dueLabel = t.due
    ? new Date(t.due).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    : "No due date";
  return `
    <article class="task p-${t.priority} ${t.status === "done" ? "is-done" : ""}" draggable="true" data-id="${t.id}" tabindex="0">
      <div class="task-title">${escapeHTML(t.title)}</div>
      ${t.notes ? `<div class="task-notes">${escapeHTML(t.notes)}</div>` : ""}
      <div class="task-meta">
        <span>${PRIORITY_LABEL[t.priority]} priority</span>
        <span class="${overdue ? "overdue" : ""}">${overdue ? "Overdue · " : ""}${dueLabel}</span>
      </div>
      <div class="task-actions">
        <button class="btn btn-outline-secondary" data-move="-1" ${idx === 0 ? "disabled" : ""} aria-label="Move to ${LABELS[STATUSES[idx - 1]] || ""}">‹</button>
        <button class="btn btn-outline-secondary" data-move="1" ${idx === 2 ? "disabled" : ""} aria-label="Move to ${LABELS[STATUSES[idx + 1]] || ""}">›</button>
        <button class="btn btn-outline-secondary ms-auto" data-edit>Edit</button>
        <button class="btn btn-outline-danger" data-delete>Delete</button>
      </div>
    </article>`;
}

function render() {
  STATUSES.forEach((s) => {
    const inColumn = tasks.filter((t) => t.status === s);
    $(`#list-${s}`).innerHTML = inColumn.filter(visible).map(cardHTML).join("");
    $(`#count-${s}`).textContent = inColumn.length;
  });
  const done = tasks.filter((t) => t.status === "done").length;
  $("#summary").textContent = tasks.length ? `${done} of ${tasks.length} tasks done` : "No tasks yet";
  $("#emptyBoard").classList.toggle("d-none", tasks.length > 0);
}

/* ---------- Modal / form ---------- */
function openModal(task) {
  const form = $("#taskForm");
  form.classList.remove("was-validated");
  form.reset();
  $("#taskId").value = task ? task.id : "";
  $("#modalTitle").textContent = task ? "Edit task" : "New task";
  $("#title").value = task ? task.title : "";
  $("#notes").value = task ? task.notes : "";
  $("#priority").value = task ? task.priority : "medium";
  $("#due").value = task ? task.due : "";
  modal.show();
}

$("#taskForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }
  const id = $("#taskId").value;
  const data = {
    title: $("#title").value.trim(),
    notes: $("#notes").value.trim(),
    priority: $("#priority").value,
    due: $("#due").value,
  };
  if (id) {
    tasks = tasks.map((t) => (t.id === id ? { ...t, ...data } : t));
    notify("Task updated");
  } else {
    tasks.push({ id: crypto.randomUUID(), status: "todo", ...data });
    notify("Task added");
  }
  save();
  modal.hide();
  render();
});

/* ---------- Card actions (move / edit / delete) ---------- */
document.addEventListener("click", (e) => {
  const card = e.target.closest(".task");
  if (!card) return;
  const task = tasks.find((t) => t.id === card.dataset.id);
  if (!task) return;

  if (e.target.dataset.move) {
    const next = STATUSES[STATUSES.indexOf(task.status) + Number(e.target.dataset.move)];
    if (next) {
      task.status = next;
      save();
      render();
    }
  } else if (e.target.hasAttribute("data-edit")) {
    openModal(task);
  } else if (e.target.hasAttribute("data-delete") && confirm("Delete this task?")) {
    tasks = tasks.filter((t) => t.id !== task.id);
    save();
    render();
    notify("Task deleted");
  }
});

/* ---------- Drag and drop ---------- */
let dragId = null;

document.addEventListener("dragstart", (e) => {
  const card = e.target.closest(".task");
  if (!card) return;
  dragId = card.dataset.id;
  card.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", dragId);
});

document.addEventListener("dragend", (e) => {
  e.target.classList?.remove("dragging");
  document.querySelectorAll(".dropzone").forEach((z) => z.classList.remove("over"));
});

document.querySelectorAll(".column").forEach((col) => {
  const zone = col.querySelector(".dropzone");
  col.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("over");
  });
  col.addEventListener("dragleave", (e) => {
    if (!col.contains(e.relatedTarget)) zone.classList.remove("over");
  });
  col.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("over");
    const task = tasks.find((t) => t.id === dragId);
    if (task && task.status !== col.dataset.status) {
      task.status = col.dataset.status;
      save();
      render();
    }
  });
});

/* ---------- Toolbar ---------- */
$("#addBtn").addEventListener("click", () => openModal());
$("#search").addEventListener("input", render);
$("#priorityFilter").addEventListener("input", render);

$("#clearDone").addEventListener("click", () => {
  const n = tasks.filter((t) => t.status === "done").length;
  if (!n) return notify("No finished tasks to clear");
  if (confirm(`Remove ${n} finished task${n > 1 ? "s" : ""}?`)) {
    tasks = tasks.filter((t) => t.status !== "done");
    save();
    render();
  }
});

$("#sampleBtn").addEventListener("click", () => {
  const due = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const sample = [
    ["Design landing page wireframe", "Sketch hero, features and contact sections", "high", due(2), "todo"],
    ["Set up GitHub repository", "Add README, .gitignore and license", "medium", due(4), "todo"],
    ["Build login form validation", "Show clear error messages", "high", due(-1), "doing"],
    ["Write unit tests for utils", "", "low", due(6), "doing"],
    ["Deploy portfolio to GitHub Pages", "Add live link to LinkedIn", "medium", due(-3), "done"],
  ];
  sample.forEach(([title, notes, priority, dueDate, status]) =>
    tasks.push({ id: crypto.randomUUID(), title, notes, priority, due: dueDate, status })
  );
  save();
  render();
});

render();