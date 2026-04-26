const STORAGE_KEY = "taraRoleDashboardEntries";

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
    },
  },
  {
    name: "Zabirul",
    roles: {
      "1st Fall": "TA",
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

const state = {
  students: [],
  currentView: "excel",
};

const excelView = document.getElementById("excel-view");
const ratioView = document.getElementById("ratio-view");
const summaryMount = document.getElementById("lab-ratio-summary");
const sortControls = document.getElementById("sort-controls");
const ratioSort = document.getElementById("ratio-sort");
const nicknameSelect = document.getElementById("nickname");
const semesterSelect = document.getElementById("semester");
const roleForm = document.getElementById("role-form");
const formMessage = document.getElementById("form-message");

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
      if (payload.credentials && typeof payload.credentials === "object") {
        credentials = payload.credentials;
        nicknames = Object.keys(credentials);
      }
      exclusionRules = payload.labRatioExclusions
        ? buildExclusionRules(payload.labRatioExclusions)
        : buildExclusionRules();
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

  return {};
}

function cloneStudents(students) {
  return students.map((student) => ({
    name: student.name,
    roles: { ...student.roles },
  }));
}

function loadStudents() {
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
  nicknameSelect.innerHTML = nicknames
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("");

  semesterSelect.innerHTML = terms
    .map((term) => `<option value="${escapeHtml(term)}">${escapeHtml(term)}</option>`)
    .join("");
}

function bindViewSwitch() {
  document.querySelectorAll(".view-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentView = button.dataset.view;
      document.querySelectorAll(".view-button").forEach((node) => {
        node.classList.toggle("is-active", node === button);
      });
      render();
    });
  });

  ratioSort.addEventListener("change", renderRatioView);
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

    student.roles[semester] = role;
    saveStudents();
    render();
    document.getElementById("rcsId").value = "";
    setFormMessage(`${nickname}'s ${semester} entry was saved as ${role}.`, true);
  });
}

function setFormMessage(text, isSuccess) {
  formMessage.textContent = text;
  formMessage.className = `form-message ${isSuccess ? "success" : "error"}`;
}

function render() {
  const showingExcel = state.currentView === "excel";
  excelView.hidden = !showingExcel;
  ratioView.hidden = showingExcel;
  sortControls.hidden = showingExcel;

  renderExcelView();
  renderRatioView();
  renderLabSummary();
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
        const classes = ["role-cell"];

        if (excluded) {
          classes.push("is-excluded");
        } else if (role === "TA") {
          classes.push("role-ta");
        } else if (role === "RA") {
          classes.push("role-ra");
        } else {
          classes.push("role-empty");
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
