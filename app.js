const STORAGE_KEY = "taraRoleDashboardEntries";
const APP_CONFIG = window.APP_CONFIG || {};

let terms = [
  "1st Fall",
  "1st Spring",
  "1st Summer",
  "2nd Fall",
  "2nd Spring",
  "2nd Summer",
  "3rd Fall",
  "3rd Spring",
  "3rd Summer",
  "4th Fall",
  "4th Spring",
  "4th Summer",
  "5th Fall",
  "5th Spring",
];

let credentials = {
  "Yuxuan Liang": "liangy15",
  Derik: "azamm",
  Jason: "wangj68",
  Manik: "manikm",
  Zabirul: "islamm11",
  Wasif: "nafeem",
  Hao: "gongh2",
  Marshal: "shawkm",
};

let nicknames = Object.keys(credentials);

let seedStudents = [
  {
    name: "Yuxuan Liang",
    roles: {
      "1st Fall": "RA",
      "1st Spring": "RA",
      "1st Summer": "RA",
      "2nd Fall": "RA",
      "2nd Spring": "RA",
      "2nd Summer": "RA",
      "3rd Fall": "RA",
      "3rd Spring": "RA",
      "3rd Summer": "TA",
      "4th Fall": "TA",
      "4th Spring": "RA",
    },
  },
  {
    name: "Derik",
    roles: {
      "1st Fall": "RA",
      "1st Spring": "RA",
      "1st Summer": "RA",
      "2nd Fall": "RA",
      "2nd Spring": "RA",
      "2nd Summer": "RA",
      "3rd Fall": "RA",
      "3rd Spring": "RA",
      "3rd Summer": "RA",
      "4th Fall": "TA",
      "4th Spring": "TA",
    },
  },
  {
    name: "Jason",
    roles: {
      "1st Fall": "RA",
      "1st Spring": "TA",
      "1st Summer": "RA",
      "2nd Fall": "RA",
      "2nd Spring": "TA",
    },
  },
  {
    name: "Manik",
    roles: {
      "1st Fall": "TA",
      "1st Spring": "TA",
      "1st Summer": "TA",
      "2nd Fall": "TA",
      "2nd Spring": "TA",
      "2nd Summer": "RA",
    },
  },
  {
    name: "Zabirul",
    roles: {
      "1st Spring": "TA",
      "1st Summer": "TA",
      "2nd Fall": "TA",
      "2nd Spring": "TA",
      "2nd Summer": "RA",
      "3rd Fall": "RA",
      "3rd Spring": "RA",
    },
  },
  {
    name: "Wasif",
    roles: {
      "1st Fall": "RA",
      "1st Spring": "RA",
    },
  },
  {
    name: "Hao",
    roles: {
      "1st Fall": "RA",
    },
  },
  {
    name: "Marshal",
    roles: {
      "1st Fall": "TA",
    },
  },
];

let exclusionRules = buildExclusionRules();
let beforeJoiningRules = buildBeforeJoiningRules();

const state = {
  students: [],
  currentSection: "allotment",
  currentView: "excel",
};

const allotmentSection = document.getElementById("allotment-section");
const allotmentSidebar = document.getElementById("allotment-sidebar");
const conferenceSection = document.getElementById("conference-section");
const allotmentLegend = document.getElementById("allotment-legend");
const excelView = document.getElementById("excel-view");
const ratioView = document.getElementById("ratio-view");
const conferenceView = document.getElementById("conference-view");
const summaryMount = document.getElementById("lab-ratio-summary");
const sortControls = document.getElementById("sort-controls");
const ratioSummaryPanel = document.getElementById("ratio-summary-panel");
const roleFormPanel = document.getElementById("role-form-panel");
const ratioSort = document.getElementById("ratio-sort");
const nicknameSelect = document.getElementById("nickname");
const semesterSelect = document.getElementById("semester");
const roleForm = document.getElementById("role-form");
const formMessage = document.getElementById("form-message");
const conferenceForm = document.getElementById("conference-form");
const conferenceNicknameSelect = document.getElementById("conference-nickname");
const conferenceMessage = document.getElementById("conference-message");

let conferenceVisits = [];

bootstrap();

async function bootstrap() {
  await loadInitialData();
  state.students = loadStudents();
  populateSelects();
  bindViewSwitch();
  bindForm();
  render();
}

async function loadInitialData() {
  try {
    const response = await fetch("initial-data.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Initial data unavailable.");
    }

    const payload = await response.json();
    if (Array.isArray(payload.terms) && Array.isArray(payload.students)) {
      terms = payload.terms;
      seedStudents = payload.students;
      conferenceVisits = Array.isArray(payload.conferenceVisits) ? payload.conferenceVisits : [];
      if (payload.credentials && typeof payload.credentials === "object") {
        credentials = payload.credentials;
        nicknames = Object.keys(credentials);
      }
      exclusionRules = payload.labRatioExclusions
        ? buildExclusionRules(payload.labRatioExclusions)
        : buildExclusionRules();
      beforeJoiningRules = payload.beforeJoiningTerms
        ? buildBeforeJoiningRules(payload.beforeJoiningTerms)
        : buildBeforeJoiningRules();
    }
  } catch (error) {
    setFormMessage("Using built-in starter data because initial-data.json could not be loaded.", false);
  }
}

function buildExclusionRules(config) {
  if (config) {
    return Object.fromEntries(
      Object.entries(config).map(([name, excludedTerms]) => [name, new Set(excludedTerms)])
    );
  }

  return {
    Manik: new Set(terms.slice(0, 4)),
    Zabirul: new Set(terms.slice(0, 7)),
  };
}

function buildBeforeJoiningRules(config) {
  if (config) {
    return Object.fromEntries(
      Object.entries(config).map(([name, excludedTerms]) => [name, new Set(excludedTerms)])
    );
  }

  return {
    Manik: new Set(["1st Fall", "1st Spring"]),
    Zabirul: new Set(["1st Spring"]),
  };
}

function cloneStudents(students) {
  return students.map((student) => ({
    name: student.name,
    roles: { ...student.roles },
  }));
}

function loadStudents() {
  // Shared updates come from initial-data.json; old browser-only entries must
  // not override the latest GitHub Pages deployment.
  if (APP_CONFIG.updateUrl) {
    localStorage.removeItem(STORAGE_KEY);
    return cloneStudents(seedStudents);
  }

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(saved)) {
      return cloneStudents(seedStudents);
    }

    return seedStudents.map((student) => {
      const savedStudent = saved.find((entry) => entry.name === student.name);
      return {
        name: student.name,
        roles: {
          ...student.roles,
          ...(savedStudent?.roles || {}),
        },
      };
    });
  } catch (error) {
    return cloneStudents(seedStudents);
  }
}

function saveStudents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.students));
}

function populateSelects() {
  const options = nicknames
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("");
  nicknameSelect.innerHTML = options;
  conferenceNicknameSelect.innerHTML = options;

  semesterSelect.innerHTML = terms
    .map((term) => `<option value="${escapeHtml(term)}">${escapeHtml(term)}</option>`)
    .join("");
}

function bindViewSwitch() {
  document.querySelectorAll(".section-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentSection = button.dataset.section;
      document.querySelectorAll(".section-button").forEach((node) => {
        const selected = node === button;
        node.classList.toggle("is-active", selected);
        node.setAttribute("aria-selected", String(selected));
      });
      render();
    });
  });

  document.querySelectorAll(".view-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentView = button.dataset.view;
      document.querySelectorAll(".view-button").forEach((node) => {
        const selected = node === button;
        node.classList.toggle("is-active", selected);
        node.setAttribute("aria-selected", String(selected));
      });
      render();
    });
  });

  ratioSort.addEventListener("change", renderRatioView);
  conferenceForm.addEventListener("submit", handleConferenceSubmit);
}

function bindForm() {
  roleForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const nickname = nicknameSelect.value;
    const semester = semesterSelect.value;
    const role = document.getElementById("role").value;
    const rcsId = document.getElementById("rcsId").value.trim();

    if (rcsId !== credentials[nickname]) {
      setFormMessage("RCS ID did not match the selected nickname. Entry not saved.", false);
      return;
    }

    const student = state.students.find((entry) => entry.name === nickname);
    if (!student || !terms.includes(semester) || !["TA", "RA"].includes(role)) {
      setFormMessage("Please choose a valid nickname, semester, and role.", false);
      return;
    }

    submitRoleUpdate({ nickname, semester, role, rcsId });
  });
}

async function submitRoleUpdate(payload) {
  if (APP_CONFIG.updateUrl) {
    try {
      setFormMessage("Saving...", true);
      const response = await fetch(APP_CONFIG.updateUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Entry not saved.");
      }

      if (Array.isArray(result.students)) {
        seedStudents = result.students;
        state.students = cloneStudents(result.students);
        render();
      } else {
        const student = state.students.find((entry) => entry.name === payload.nickname);
        if (student) {
          student.roles[payload.semester] = payload.role;
          render();
        }
      }

      document.getElementById("rcsId").value = "";
      setFormMessage(result.message || "Entry saved.", true);
      return;
    } catch (error) {
      setFormMessage(error.message || "Entry not saved.", false);
      return;
    }
  }

  const student = state.students.find((entry) => entry.name === payload.nickname);
  student.roles[payload.semester] = payload.role;
  saveStudents();
  render();
  document.getElementById("rcsId").value = "";
  setFormMessage(`${payload.nickname}'s ${payload.semester} entry was saved as ${payload.role}.`, true);
}

function setFormMessage(text, isSuccess) {
  formMessage.textContent = text;
  formMessage.className = `form-message ${isSuccess ? "success" : "error"}`;
}

function render() {
  const showingExcel = state.currentView === "excel";
  const showingRatio = state.currentView === "ratio";
  const showingAllotment = state.currentSection === "allotment";
  allotmentSection.hidden = !showingAllotment;
  allotmentSidebar.hidden = !showingAllotment;
  allotmentLegend.hidden = !showingAllotment;
  conferenceSection.hidden = showingAllotment;
  excelView.hidden = !showingExcel;
  ratioView.hidden = !showingRatio;
  sortControls.hidden = !showingAllotment || !showingRatio;
  ratioSummaryPanel.hidden = !showingAllotment;
  roleFormPanel.hidden = !showingAllotment;

  renderExcelView();
  renderRatioView();
  renderLabSummary();
  renderConferenceView();
}

function renderConferenceView() {
  const counts = Object.fromEntries(nicknames.map((name) => [name, 0]));
  conferenceVisits.forEach((visit) => {
    if (Object.hasOwn(counts, visit.nickname)) counts[visit.nickname] += 1;
  });

  const rows = nicknames.map((name) => {
    const visits = conferenceVisits
      .filter((visit) => visit.nickname === name)
      .sort((a, b) => String(b.dates).localeCompare(String(a.dates)));
    return `
      <section class="conference-student">
        <div class="conference-student-heading">
          <h2>${escapeHtml(name)}</h2>
          <strong>${counts[name]} ${counts[name] === 1 ? "visit" : "visits"}</strong>
        </div>
        ${visits.length ? `
          <ul class="conference-list">
            ${visits.map((visit) => `
              <li class="conference-item">
                <strong>${escapeHtml(visit.conferenceName)}</strong>
                <span>${escapeHtml(visit.dates)}</span>
                <span>${escapeHtml(visit.location)}</span>
              </li>
            `).join("")}
          </ul>
        ` : `<p class="conference-empty">No visits recorded</p>`}
      </section>
    `;
  }).join("");

  conferenceView.innerHTML = `<div class="conference-directory">${rows}</div>`;
}

async function handleConferenceSubmit(event) {
  event.preventDefault();
  const payload = {
    type: "conference",
    nickname: conferenceNicknameSelect.value,
    conferenceName: document.getElementById("conference-name").value.trim(),
    dates: document.getElementById("conference-dates").value.trim(),
    location: document.getElementById("conference-location").value.trim(),
    rcsId: document.getElementById("conference-rcs-id").value.trim(),
  };

  if (payload.rcsId !== credentials[payload.nickname]) {
    setConferenceMessage("RCS ID did not match the selected student. Visit not saved.", false);
    return;
  }
  if (!payload.conferenceName || !payload.dates || !payload.location) {
    setConferenceMessage("Enter the conference name, dates, and location.", false);
    return;
  }

  if (APP_CONFIG.updateUrl) {
    try {
      setConferenceMessage("Saving visit...", true);
      const response = await fetch(APP_CONFIG.updateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Visit not saved.");
      if (result.visit) conferenceVisits.push(result.visit);
      conferenceForm.reset();
      renderConferenceView();
      setConferenceMessage(result.message || "Conference visit saved to GitHub.", true);
    } catch (error) {
      setConferenceMessage(error.message || "Visit not saved.", false);
    }
    return;
  }

  setConferenceMessage("Shared conference updates are not configured.", false);
}

function setConferenceMessage(text, isSuccess) {
  conferenceMessage.textContent = text;
  conferenceMessage.className = `form-message ${isSuccess ? "success" : "error"}`;
}

function renderExcelView() {
  const head = [
    "<tr>",
    "<th>Nickname</th>",
    ...terms.map((term) => `<th>${escapeHtml(term)}</th>`),
    "</tr>",
  ].join("");

  const rows = state.students
    .map((student) => {
      const cells = terms.map((term) => {
        const role = student.roles[term] || "";
        const excluded = isExcluded(student.name, term);
        const beforeJoining = isBeforeJoining(student.name, term);
        const isSummer = term.includes("Summer");
        const classes = ["role-cell"];

        if (beforeJoining) {
          classes.push("role-before-joining");
        } else if (excluded) {
          classes.push("is-excluded");
        } else if (role === "TA") {
          classes.push("role-ta");
        } else if (role === "RA") {
          classes.push("role-ra");
        } else {
          classes.push("role-empty");
        }

        if (isSummer) {
          classes.push("is-summer");
        }

        return `<td class="${classes.join(" ")}">${role || "-"}</td>`;
      });

      return `<tr><td class="student-name">${escapeHtml(student.name)}</td>${cells.join("")}</tr>`;
    })
    .join("");

  excelView.innerHTML = `
    <div class="table-wrap">
      <table aria-label="TA RA semester table">
        <thead>${head}</thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderRatioView() {
  const sorted = [...state.students].sort(sortStudents);

  ratioView.innerHTML = `
    <div class="ratio-grid">
      ${sorted.map(renderRatioRow).join("")}
    </div>
  `;
}

function sortStudents(a, b) {
  const mode = ratioSort.value;
  const aRatio = getStudentMetrics(a).taRatio;
  const bRatio = getStudentMetrics(b).taRatio;

  if (mode === "ta-asc") {
    return aRatio - bRatio || a.name.localeCompare(b.name);
  }

  if (mode === "name-asc") {
    return a.name.localeCompare(b.name);
  }

  return bRatio - aRatio || a.name.localeCompare(b.name);
}

function renderRatioRow(student) {
  const metrics = getStudentMetrics(student);
  const taPercent = Math.round(metrics.taRatio * 100);
  const raPercent = Math.round(metrics.raRatio * 100);

  return `
    <article class="ratio-row">
      <div class="ratio-main">
        <span class="ratio-name">${escapeHtml(student.name)}</span>
        <strong>${formatRatio(metrics.taCount, metrics.raCount)}</strong>
      </div>
      <div class="ratio-bar" aria-label="${taPercent}% TA and ${raPercent}% RA">
        <span class="ratio-ta" style="width: ${taPercent}%"></span>
        <span class="ratio-ra" style="width: ${raPercent}%"></span>
      </div>
      <div class="ratio-metrics">
        <span>${taPercent}% TA</span>
        <span>${raPercent}% RA</span>
        <span>${metrics.total} entries</span>
      </div>
    </article>
  `;
}

function renderLabSummary() {
  const metrics = getLabMetrics();
  const taPercent = Math.round(metrics.taRatio * 100);
  const raPercent = Math.round(metrics.raRatio * 100);

  summaryMount.innerHTML = `
    <div class="summary-stack">
      <div class="summary-ratio">${formatRatio(metrics.taCount, metrics.raCount)}</div>
      <div class="summary-bar" aria-label="${taPercent}% TA and ${raPercent}% RA">
        <span class="ratio-ta" style="width: ${taPercent}%"></span>
        <span class="ratio-ra" style="width: ${raPercent}%"></span>
      </div>
      <div class="summary-stat-grid">
        <div class="summary-stat">
          <span>TA</span>
          <strong>${metrics.taCount}</strong>
          <small>${taPercent}%</small>
        </div>
        <div class="summary-stat">
          <span>RA</span>
          <strong>${metrics.raCount}</strong>
          <small>${raPercent}%</small>
        </div>
      </div>
    </div>
  `;
}

function getStudentMetrics(student) {
  const values = Object.values(student.roles);
  const taCount = values.filter((role) => role === "TA").length;
  const raCount = values.filter((role) => role === "RA").length;
  const total = taCount + raCount;

  return {
    taCount,
    raCount,
    total,
    taRatio: total ? taCount / total : 0,
    raRatio: total ? raCount / total : 0,
  };
}

function getLabMetrics() {
  let taCount = 0;
  let raCount = 0;

  state.students.forEach((student) => {
    terms.forEach((term) => {
      if (isExcluded(student.name, term)) {
        return;
      }

      const role = student.roles[term];
      if (role === "TA") {
        taCount += 1;
      }
      if (role === "RA") {
        raCount += 1;
      }
    });
  });

  const total = taCount + raCount;
  return {
    taCount,
    raCount,
    total,
    taRatio: total ? taCount / total : 0,
    raRatio: total ? raCount / total : 0,
  };
}

function formatRatio(taCount, raCount) {
  if (taCount === 0 && raCount === 0) {
    return "0:0";
  }

  return `${taCount}:${raCount}`;
}

function isExcluded(name, term) {
  return exclusionRules[name]?.has(term) || false;
}

function isBeforeJoining(name, term) {
  return beforeJoiningRules[name]?.has(term) || false;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
