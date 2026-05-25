const STORAGE_KEY = "careerai-dashboard-state";

const defaultState = {
  user: {
    fullName: "John Carter",
    targetRole: "Software Engineer",
    emailAlerts: "daily",
    planPaused: false
  },
  resumes: [
    {
      id: "resume-1",
      title: "Software Engineer Resume",
      role: "Software Engineer",
      skills: ["React", "TypeScript", "Node.js", "Testing"],
      score: 92,
      updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000
    },
    {
      id: "resume-2",
      title: "Product Manager Resume",
      role: "Product Manager",
      skills: ["Roadmaps", "Analytics", "Stakeholders", "Launches"],
      score: 88,
      updatedAt: Date.now() - 5 * 24 * 60 * 60 * 1000
    },
    {
      id: "resume-3",
      title: "Data Analyst Resume",
      role: "Data Analyst",
      skills: ["SQL", "Python", "Dashboards", "Forecasting"],
      score: 75,
      updatedAt: Date.now() - 30 * 24 * 60 * 60 * 1000
    }
  ],
  coverLetters: [
    {
      id: "cover-1",
      company: "Nimbus Labs",
      role: "Frontend Engineer",
      highlight: "Built accessible product dashboards for high-volume teams.",
      createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000
    },
    {
      id: "cover-2",
      company: "AtlasWorks",
      role: "Product Manager",
      highlight: "Led cross-functional launches from discovery through adoption.",
      createdAt: Date.now() - 4 * 24 * 60 * 60 * 1000
    }
  ],
  jobs: [
    {
      id: "job-1",
      title: "Senior Software Engineer",
      company: "Cloudlane",
      location: "Remote",
      match: 91,
      saved: true,
      skills: ["React", "APIs", "Testing"]
    },
    {
      id: "job-2",
      title: "Product Manager",
      company: "Brightpath",
      location: "New York, NY",
      match: 86,
      saved: false,
      skills: ["Roadmaps", "Analytics", "Stakeholders"]
    },
    {
      id: "job-3",
      title: "Data Analyst",
      company: "Signal Ridge",
      location: "Remote",
      match: 78,
      saved: true,
      skills: ["SQL", "Python", "Dashboards"]
    }
  ],
  ats: {
    score: 85,
    insights: [
      "Add more role-specific keywords from the job description.",
      "Keep bullets measurable with outcomes and numbers.",
      "Use simple section headings so parsing tools can read the resume."
    ]
  }
};

let state = loadState();
let activeView = "signup";
let database = null;
let remoteSaveTimer = null;
let authReady = false;

const qs = (selector, scope = document) => scope.querySelector(selector);
const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(defaultState);
    return { ...structuredClone(defaultState), ...JSON.parse(saved) };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!database?.isConnected) return;

  window.clearTimeout(remoteSaveTimer);
  remoteSaveTimer = window.setTimeout(() => {
    database.saveState(state).catch((error) => {
      console.error(error);
      showToast("Saved locally. Supabase sync failed.");
    });
  }, 250);
}

function formatRelativeTime(time) {
  const days = Math.max(0, Math.round((Date.now() - time) / 86400000));
  if (days === 0) return "Updated today";
  if (days === 1) return "Updated 1 day ago";
  if (days < 30) return `Updated ${days} days ago`;
  const months = Math.round(days / 30);
  return `Updated ${months} month${months > 1 ? "s" : ""} ago`;
}

function getAverageAts() {
  const resumeAverage = state.resumes.length
    ? Math.round(state.resumes.reduce((total, resume) => total + resume.score, 0) / state.resumes.length)
    : 0;
  return Math.round((resumeAverage + state.ats.score) / 2);
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  qs("#toastRegion").append(toast);
  window.setTimeout(() => toast.remove(), 2800);
}

function openModal(id) {
  const modal = qs(`#${id}`);
  if (modal?.showModal) modal.showModal();
}

function closeModal(id) {
  qs(`#${id}`)?.close();
}

function setActiveView(viewName) {
  activeView = viewName;
  qsa(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${viewName}`));
  qsa("[data-view-link]").forEach((item) => {
    item.classList.toggle("active", item.dataset.viewLink === viewName);
  });
  document.body.classList.toggle("auth-active", viewName === "signup" || viewName === "login");
  document.body.classList.remove("nav-open");
  render();
}

function render() {
  renderHeader();
  renderStats();
  renderRecentDocuments();
  renderResumes();
  renderCoverLetters();
  renderJobs();
  renderSavedJobs();
  renderAts();
  renderSettings();
  renderBilling();
}

function renderHeader() {
  const firstName = state.user.fullName.trim().split(/\s+/)[0] || "there";
  qs("#userFirstName").textContent = firstName;
}

function renderStats() {
  qs("#resumeCount").textContent = state.resumes.length;
  qs("#coverLetterCount").textContent = state.coverLetters.length;
  qs("#averageAts").textContent = `${getAverageAts()}%`;
  qs("#matchedJobsCount").textContent = state.jobs.length;
}

function renderRecentDocuments() {
  const recent = [...state.resumes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);
  const container = qs("#recentDocuments");
  container.innerHTML = recent.length
    ? recent
        .map(
          (resume) => `
            <article class="doc-item">
              <span class="doc-file" aria-hidden="true">CV</span>
              <div>
                <p class="doc-title">${escapeHtml(resume.title)}</p>
                <p class="document-meta">${formatRelativeTime(resume.updatedAt)}</p>
              </div>
              <span class="score-pill ${resume.score < 80 ? "warning" : ""}">${resume.score}%</span>
            </article>
          `
        )
        .join("")
    : `<div class="empty-state">No resumes yet. Create one to start your document list.</div>`;
}

function renderResumes() {
  const search = qs("#resumeSearch")?.value?.toLowerCase() || "";
  const sort = qs("#resumeSort")?.value || "recent";
  let resumes = state.resumes.filter((resume) => {
    const text = `${resume.title} ${resume.role} ${resume.skills.join(" ")}`.toLowerCase();
    return text.includes(search);
  });

  resumes = resumes.sort((a, b) => {
    if (sort === "score") return b.score - a.score;
    if (sort === "title") return a.title.localeCompare(b.title);
    return b.updatedAt - a.updatedAt;
  });

  qs("#resumeCards").innerHTML = resumes.length
    ? resumes
        .map(
          (resume) => `
            <article class="content-card">
              <p class="card-title">${escapeHtml(resume.title)}</p>
              <p class="card-meta">${escapeHtml(resume.role)} - ${formatRelativeTime(resume.updatedAt)}</p>
              <p class="card-meta">${escapeHtml(resume.skills.join(", "))}</p>
              <div class="card-actions">
                <span class="score-pill ${resume.score < 80 ? "warning" : ""}">${resume.score}%</span>
                <button class="mini-button" type="button" data-resume-action="duplicate" data-id="${resume.id}">Duplicate</button>
                <button class="mini-button" type="button" data-resume-action="improve" data-id="${resume.id}">Improve</button>
                <button class="mini-button danger" type="button" data-resume-action="delete" data-id="${resume.id}">Delete</button>
              </div>
            </article>
          `
        )
        .join("")
    : `<div class="empty-state">No resumes match your search.</div>`;
}

function renderCoverLetters() {
  qs("#coverLetterCards").innerHTML = state.coverLetters.length
    ? [...state.coverLetters]
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(
          (letter) => `
            <article class="content-card">
              <p class="card-title">${escapeHtml(letter.role)} at ${escapeHtml(letter.company)}</p>
              <p class="card-meta">${formatRelativeTime(letter.createdAt).replace("Updated", "Created")}</p>
              <p>${escapeHtml(makeCoverLetter(letter))}</p>
              <div class="card-actions">
                <button class="mini-button" type="button" data-cover-action="copy" data-id="${letter.id}">Copy</button>
                <button class="mini-button danger" type="button" data-cover-action="delete" data-id="${letter.id}">Delete</button>
              </div>
            </article>
          `
        )
        .join("")
    : `<div class="empty-state">No cover letters yet. Generate one from the quick actions.</div>`;
}

function renderJobs() {
  const search = qs("#jobSearch")?.value?.toLowerCase() || "";
  const filter = qs("#matchFilter")?.value || "all";
  const jobs = state.jobs.filter((job) => {
    const text = `${job.title} ${job.company} ${job.location} ${job.skills.join(" ")}`.toLowerCase();
    const filterMatch = filter === "high" ? job.match >= 80 : filter === "saved" ? job.saved : true;
    return filterMatch && text.includes(search);
  });

  qs("#jobList").innerHTML = jobs.length
    ? jobs.map(renderJobItem).join("")
    : `<div class="empty-state">No jobs match this filter.</div>`;
}

function renderSavedJobs() {
  const saved = state.jobs.filter((job) => job.saved);
  qs("#savedJobList").innerHTML = saved.length
    ? saved.map(renderJobItem).join("")
    : `<div class="empty-state">No saved jobs yet. Save one from Job Matcher.</div>`;
}

function renderJobItem(job) {
  return `
    <article class="job-item">
      <div>
        <p class="job-title">${escapeHtml(job.title)}</p>
        <p class="job-meta">${escapeHtml(job.company)} - ${escapeHtml(job.location)}</p>
        <p class="job-meta">Key skills: ${escapeHtml(job.skills.join(", "))}</p>
      </div>
      <div class="job-actions">
        <span class="score-pill ${job.match < 80 ? "warning" : ""}">${job.match}%</span>
        <button class="mini-button" type="button" data-job-action="toggle-save" data-id="${job.id}">
          ${job.saved ? "Unsave" : "Save"}
        </button>
        <button class="mini-button" type="button" data-job-action="apply" data-id="${job.id}">Apply</button>
      </div>
    </article>
  `;
}

function renderAts() {
  const ring = qs("#scoreRing");
  const score = state.ats.score;
  ring.style.setProperty("--score", `${score * 3.6}deg`);
  qs("#scoreRingValue").textContent = `${score}%`;
  qs("#atsInsights").innerHTML = state.ats.insights.map((insight) => `<li>${escapeHtml(insight)}</li>`).join("");
}

function renderSettings() {
  qs("#fullNameInput").value = state.user.fullName;
  qs("#targetRoleInput").value = state.user.targetRole;
  qs("#emailAlertsInput").value = state.user.emailAlerts;
}

function renderBilling() {
  qs("#togglePlanButton").textContent = state.user.planPaused ? "Resume Plan" : "Pause Plan";
}

function makeCoverLetter(letter) {
  return `Dear ${letter.company} team, I am excited to apply for the ${letter.role} role. ${letter.highlight} I would bring focused execution, clear communication, and strong ownership to your team.`;
}

function calculateScore(resumeText, keywordsText) {
  const resume = resumeText.toLowerCase();
  const keywords = keywordsText
    .split(",")
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);
  const matched = keywords.filter((keyword) => resume.includes(keyword));
  const keywordScore = keywords.length ? Math.round((matched.length / keywords.length) * 55) : 0;
  const lengthScore = resumeText.length > 350 ? 20 : resumeText.length > 160 ? 14 : 8;
  const actionWordScore = /(led|built|managed|improved|created|launched|designed|analyzed)/i.test(resumeText) ? 15 : 6;
  const numberScore = /\d/.test(resumeText) ? 10 : 4;
  return Math.min(99, keywordScore + lengthScore + actionWordScore + numberScore);
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function bindEvents() {
  qsa("[data-view-link]").forEach((link) => {
    link.addEventListener("click", () => setActiveView(link.dataset.viewLink));
  });

  qs("#mobileMenu").addEventListener("click", () => document.body.classList.toggle("nav-open"));

  qs("#syncButton").addEventListener("click", () => {
    saveState();
    showToast("Dashboard synced");
  });

  qs("#logoutButton").addEventListener("click", () => {
    database?.signOut?.().catch((error) => console.error(error));
    authReady = false;
    showToast(database?.isConnected ? "Signed out of Supabase session" : "Logged out of demo session");
    setActiveView("login");
  });

  qsa("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "create-resume") openModal("resumeModal");
      if (action === "generate-cover") openModal("coverModal");
      if (action === "check-ats") openModal("atsModal");
      if (action === "find-jobs") openModal("jobModal");
    });
  });

  qsa("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.closeModal));
  });

  qs("#resumeForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const skills = qs("#resumeSkillsInput").value.split(",").map((skill) => skill.trim()).filter(Boolean);
    state.resumes.unshift({
      id: crypto.randomUUID(),
      title: qs("#resumeTitleInput").value.trim(),
      role: qs("#resumeRoleInput").value.trim(),
      skills,
      score: Math.min(98, 72 + skills.length * 4),
      updatedAt: Date.now()
    });
    saveState();
    event.target.reset();
    closeModal("resumeModal");
    showToast("Resume created");
    setActiveView("resumes");
  });

  qs("#coverForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.coverLetters.unshift({
      id: crypto.randomUUID(),
      company: qs("#coverCompanyInput").value.trim(),
      role: qs("#coverRoleInput").value.trim(),
      highlight: qs("#coverHighlightInput").value.trim(),
      createdAt: Date.now()
    });
    saveState();
    event.target.reset();
    closeModal("coverModal");
    showToast("Cover letter generated");
    setActiveView("coverLetters");
  });

  qs("#atsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const score = calculateScore(qs("#atsResumeInput").value, qs("#atsKeywordsInput").value);
    state.ats = {
      score,
      insights: [
        score >= 85 ? "Strong keyword alignment for this job." : "Add more exact keywords from the job description.",
        /\d/.test(qs("#atsResumeInput").value) ? "Your resume includes measurable impact." : "Add numbers to show measurable impact.",
        "Keep formatting simple: clear headings, bullet points, and standard section names."
      ]
    };
    saveState();
    event.target.reset();
    closeModal("atsModal");
    showToast(`ATS score updated to ${score}%`);
    setActiveView("ats");
  });

  qs("#jobForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const role = qs("#jobRoleInput").value.trim();
    const location = qs("#jobLocationInput").value.trim();
    const skills = qs("#jobSkillsInput").value.split(",").map((skill) => skill.trim()).filter(Boolean);
    const companies = ["Northstar", "ElevateIQ", "CoreBridge"];
    const newJobs = companies.map((company, index) => ({
      id: crypto.randomUUID(),
      title: role,
      company,
      location,
      match: Math.max(68, 94 - index * 7 - Math.max(0, 4 - skills.length) * 3),
      saved: false,
      skills: skills.slice(0, 4)
    }));
    state.jobs = [...newJobs, ...state.jobs];
    saveState();
    event.target.reset();
    closeModal("jobModal");
    showToast("New job matches added");
    setActiveView("matcher");
  });

  qs("#resumeSearch").addEventListener("input", renderResumes);
  qs("#resumeSort").addEventListener("change", renderResumes);
  qs("#jobSearch").addEventListener("input", renderJobs);
  qs("#matchFilter").addEventListener("change", renderJobs);

  qs("#resumeCards").addEventListener("click", handleResumeActions);
  qs("#coverLetterCards").addEventListener("click", handleCoverActions);
  qs("#jobList").addEventListener("click", handleJobActions);
  qs("#savedJobList").addEventListener("click", handleJobActions);

  qs("#togglePlanButton").addEventListener("click", () => {
    state.user.planPaused = !state.user.planPaused;
    saveState();
    renderBilling();
    showToast(state.user.planPaused ? "Plan paused" : "Plan resumed");
  });

  qs("#settingsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.user.fullName = qs("#fullNameInput").value.trim() || "John Carter";
    state.user.targetRole = qs("#targetRoleInput").value.trim() || "Software Engineer";
    state.user.emailAlerts = qs("#emailAlertsInput").value;
    saveState();
    renderHeader();
    showToast("Settings saved");
  });

  qs("#showEmailSignupButton").addEventListener("click", () => {
    qs("#signupForm").classList.toggle("hidden");
  });

  qs("#googleSignupButton").addEventListener("click", async () => {
    if (!database?.isConnected) {
      startDemoSession("Supabase is not configured. Demo dashboard opened.");
      return;
    }

    try {
      await database.signInWithGoogle();
      showToast("Redirecting to Google");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Google sign up failed");
    }
  });

  qs("#signupForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const fullName = qs("#signupNameInput").value.trim() || "John Carter";
    const email = qs("#signupEmailInput").value.trim();
    const password = qs("#signupPasswordInput").value;

    if (!database?.isConnected) {
      state.user.fullName = fullName;
      saveState();
      startDemoSession("Demo account created locally");
      return;
    }

    try {
      const signupData = await database.signUpWithEmail({ fullName, email, password });
      if (!signupData.session) {
        showToast("Account created. Check your email, then log in.");
        setActiveView("login");
        return;
      }
      state = await database.fetchState({ ...state, user: { ...state.user, fullName } });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      authReady = true;
      event.target.reset();
      showToast("Account created");
      setActiveView("dashboard");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Sign up failed");
    }
  });

  qs("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = qs("#loginEmailInput").value.trim();
    const password = qs("#loginPasswordInput").value;

    if (!database?.isConnected) {
      startDemoSession("Demo login opened locally");
      return;
    }

    try {
      await database.signInWithEmail({ email, password });
      state = await database.fetchState(state);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      authReady = true;
      showToast("Logged in");
      setActiveView("dashboard");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Login failed");
    }
  });

  qs("#forgotPasswordButton").addEventListener("click", async () => {
    const email = qs("#loginEmailInput").value.trim();
    if (!email) {
      showToast("Enter your email first");
      return;
    }

    if (!database?.isConnected) {
      showToast("Supabase is needed for password reset");
      return;
    }

    try {
      await database.resetPassword(email);
      showToast("Password reset email sent");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Password reset failed");
    }
  });
}

function startDemoSession(message) {
  authReady = true;
  showToast(message);
  setActiveView("dashboard");
}

function handleResumeActions(event) {
  const button = event.target.closest("[data-resume-action]");
  if (!button) return;
  const resume = state.resumes.find((item) => item.id === button.dataset.id);
  if (!resume) return;

  if (button.dataset.resumeAction === "duplicate") {
    state.resumes.unshift({
      ...resume,
      id: crypto.randomUUID(),
      title: `${resume.title} Copy`,
      updatedAt: Date.now()
    });
    showToast("Resume duplicated");
  }

  if (button.dataset.resumeAction === "improve") {
    resume.score = Math.min(99, resume.score + 5);
    resume.updatedAt = Date.now();
    showToast("Resume score improved");
  }

  if (button.dataset.resumeAction === "delete") {
    state.resumes = state.resumes.filter((item) => item.id !== resume.id);
    database?.deleteRow("resumes", resume.id).catch((error) => console.error(error));
    showToast("Resume deleted");
  }

  saveState();
  render();
}

function handleCoverActions(event) {
  const button = event.target.closest("[data-cover-action]");
  if (!button) return;
  const letter = state.coverLetters.find((item) => item.id === button.dataset.id);
  if (!letter) return;

  if (button.dataset.coverAction === "copy") {
    navigator.clipboard?.writeText(makeCoverLetter(letter));
    showToast("Cover letter copied");
  }

  if (button.dataset.coverAction === "delete") {
    state.coverLetters = state.coverLetters.filter((item) => item.id !== letter.id);
    database?.deleteRow("cover_letters", letter.id).catch((error) => console.error(error));
    saveState();
    render();
    showToast("Cover letter deleted");
  }
}

function handleJobActions(event) {
  const button = event.target.closest("[data-job-action]");
  if (!button) return;
  const job = state.jobs.find((item) => item.id === button.dataset.id);
  if (!job) return;

  if (button.dataset.jobAction === "toggle-save") {
    job.saved = !job.saved;
    saveState();
    renderJobs();
    renderSavedJobs();
    showToast(job.saved ? "Job saved" : "Job removed from saved jobs");
  }

  if (button.dataset.jobAction === "apply") {
    showToast(`Application started for ${job.company}`);
    openModal("coverModal");
    qs("#coverCompanyInput").value = job.company;
    qs("#coverRoleInput").value = job.title;
    qs("#coverHighlightInput").value = `My experience with ${job.skills.join(", ")} aligns well with this role.`;
  }
}

bindEvents();
setActiveView("signup");
initializeSupabase();

async function initializeSupabase() {
  try {
    database = await window.CareerAISupabase?.create?.();
    if (!database) {
      showToast("Supabase not configured. Auth screens use demo mode.");
      return;
    }

    if (await database.hasSession()) {
      state = await database.fetchState(state);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      authReady = true;
      render();
      setActiveView("dashboard");
      showToast("Supabase connected");
      return;
    }

    showToast("Supabase ready. Please sign up or log in.");
  } catch (error) {
    console.error(error);
    database = null;
    showToast("Using local storage. Check Supabase setup.");
  }
}
