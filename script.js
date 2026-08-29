/* =====================================================================
   SECURE AI WORKBENCH — SCRIPT
   Sections:
     1. Theme toggle (light/dark, persisted in localStorage)
     2. Sidebar navigation (switch pages, mobile drawer open/close)
     3. Dashboard: security audit log + stats (rendered from n8n data,
        with local demo data as a fallback until n8n is connected)
     4. New Task page: task-type picker, file staging, Run Agent → n8n
     5. Model Registry: copy-code button
     6. N8N BACKEND INTEGRATION — every place this frontend talks (or will
        talk) to n8n lives here. Everything else in the file just calls
        into these functions, so this is the ONLY section you should need
        to touch when wiring up real webhooks.
   Everything here is plain JS with no build step — edit freely.
===================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* -------------------------------------------------------------
     1. THEME TOGGLE
     Reads/writes localStorage so the choice survives a page reload.
     Toggle the [data-theme] attribute on <html>; style.css does the rest.
  ------------------------------------------------------------- */
  const root = document.documentElement;
  const THEME_KEY = 'workbench-theme';

  function applyTheme(theme) {
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme'); // dark is the default (no attribute needed)
    }
    localStorage.setItem(THEME_KEY, theme);
  }

  function toggleTheme() {
    const current = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    applyTheme(current === 'light' ? 'dark' : 'light');
  }

  // Restore saved theme on load (falls back to dark)
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('themeToggleMobile').addEventListener('click', toggleTheme);


  /* -------------------------------------------------------------
     2. SIDEBAR NAVIGATION
  ------------------------------------------------------------- */
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');
  const sidebar = document.getElementById('sidebar');
  const scrim = document.getElementById('scrim');
  const menuToggle = document.getElementById('menuToggle');

  function goToPage(pageId) {
    pages.forEach(p => p.classList.toggle('is-active', p.id === `page-${pageId}`));
    navItems.forEach(n => n.classList.toggle('is-active', n.dataset.page === pageId));
    closeDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Lazy-load each page's data from n8n the first time it's opened.
    if (pageId === 'documents') fetchDocuments();
    if (pageId === 'knowledge-base') fetchKnowledgeBase();
    if (pageId === 'security') fetchExecutionLog();
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => goToPage(item.dataset.page));
  });

  // Buttons elsewhere in the page (e.g. "+ New Task", "View all") that jump pages
  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => goToPage(btn.dataset.goto));
  });

  // Mobile drawer open/close
  function openDrawer() {
    sidebar.classList.add('is-open');
    scrim.classList.add('is-visible');
    menuToggle.setAttribute('aria-expanded', 'true');
  }
  function closeDrawer() {
    sidebar.classList.remove('is-open');
    scrim.classList.remove('is-visible');
    menuToggle.setAttribute('aria-expanded', 'false');
  }
  menuToggle.addEventListener('click', () => {
    sidebar.classList.contains('is-open') ? closeDrawer() : openDrawer();
  });
  scrim.addEventListener('click', closeDrawer);


  /* -------------------------------------------------------------
     3. DASHBOARD — security audit log + stat cards
     Demo data below is just a placeholder shown until fetchAuditLog()
     successfully reaches your n8n webhook (see Section 6).
  ------------------------------------------------------------- */
  let auditEvents = [
    { time: '2023-10-27 14:32:05', service: 'Model Event',           status: 'Model loaded locally',                  ok: true },
    { time: '2023-10-27 14:31:15', service: 'Firewall Event',        status: 'External connection blocked',           ok: false },
    { time: '2023-10-27 14:28:44', service: 'System Event',          status: 'Isolated runtime initialized',          ok: true },
    { time: '2023-10-27 14:15:02', service: 'Local Model Inference', status: 'Daily security scan completed cleanly', ok: true },
  ];

  const auditLogBody = document.getElementById('auditLogBody');

  function renderAuditLog() {
    auditLogBody.innerHTML = auditEvents.map(ev => `
      <tr>
        <td>${ev.time}</td>
        <td>${ev.service}</td>
        <td>${ev.status}</td>
        <td><span class="pill ${ev.ok ? 'pill--success' : 'pill--danger'} pill--sm">${ev.ok ? 'Allowed' : 'Blocked'}</span></td>
      </tr>
    `).join('');
  }
  renderAuditLog();


  /* -------------------------------------------------------------
     4. NEW TASK PAGE
  ------------------------------------------------------------- */

  // Task type picker — single-select highlight
  let selectedTaskType = 'document';
  document.querySelectorAll('.task-type').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.task-type').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      selectedTaskType = btn.dataset.tasktype;
    });
  });

  // Drag-and-drop / click-to-upload file staging.
  // Files are kept in memory (pendingFiles) and only sent to n8n when
  // "Run Agent" is clicked — see submitTask() in Section 6.
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const uploadedFiles = document.getElementById('uploadedFiles');
  let pendingFiles = [];

  function addFileChip(file) {
    pendingFiles.push(file);
    const li = document.createElement('li');
    li.innerHTML = `${file.name} <button type="button" aria-label="Remove file">&times;</button>`;
    li.querySelector('button').addEventListener('click', () => {
      pendingFiles = pendingFiles.filter(f => f !== file);
      li.remove();
    });
    uploadedFiles.appendChild(li);
  }

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    Array.from(fileInput.files).forEach(addFileChip);
  });

  ['dragover', 'dragenter'].forEach(evt =>
    dropzone.addEventListener(evt, e => {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    })
  );
  ['dragleave', 'drop'].forEach(evt =>
    dropzone.addEventListener(evt, e => {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
    })
  );
  dropzone.addEventListener('drop', e => {
    Array.from(e.dataTransfer.files).forEach(addFileChip);
  });

  // "Run Agent" — sends the task + files to n8n (see submitTask in Section 6)
  const runAgentBtn = document.getElementById('runAgentBtn');
  const taskGoalInput = document.getElementById('taskGoal');
  if (runAgentBtn) {
    runAgentBtn.addEventListener('click', async () => {
      const goal = taskGoalInput.value.trim();
      if (!goal) {
        taskGoalInput.focus();
        return;
      }
      runAgentBtn.disabled = true;
      runAgentBtn.textContent = 'Starting…';
      try {
        const run = await submitTask({
          taskType: selectedTaskType,
          goal,
          files: pendingFiles,
        });
        goToPage('agent-runs');
        if (run && run.runId) pollAgentRun(run.runId);
      } catch (err) {
        console.error('submitTask failed:', err);
        alert('Could not reach the n8n workflow. Check N8N_CONFIG in script.js.');
      } finally {
        runAgentBtn.disabled = false;
        runAgentBtn.textContent = 'Run Agent';
      }
    });
  }


  /* -------------------------------------------------------------
     5. MODEL REGISTRY — copy code snippet button
  ------------------------------------------------------------- */
  const copyCodeBtn = document.getElementById('copyCodeBtn');
  const codeSnippet = document.getElementById('codeSnippet');
  if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(codeSnippet.textContent).then(() => {
        const original = copyCodeBtn.textContent;
        copyCodeBtn.textContent = 'Copied!';
        setTimeout(() => (copyCodeBtn.textContent = original), 1500);
      });
    });
  }


  /* =================================================================
     6. N8N BACKEND INTEGRATION
     -----------------------------------------------------------------
     Everything the frontend needs FROM n8n, and everything it SENDS TO
     n8n, is defined here as one function per job. Each function:
       - calls a webhook path under N8N_CONFIG.baseUrl
       - has a documented expected request/response shape
       - falls back to the existing demo data (no crash) if the request
         fails, so the UI stays usable while you're still building the
         workflows in n8n

     TO CONNECT YOUR BACKEND:
       1. Set N8N_CONFIG.baseUrl to your n8n instance's webhook root,
          e.g. "https://your-n8n.host/webhook" (or "/webhook-test/..."
          while testing in n8n's UI).
       2. Build a matching Webhook-trigger workflow in n8n for each path
          below. Each one just needs to return JSON in the shape noted
          in the comment above the function.
       3. That's it — no other file needs to change.
  ================================================================= */

  const N8N_CONFIG = {
    // Root URL of your n8n webhooks. Leave blank ('') to keep the UI
    // running fully on demo data until you're ready to connect it.
    baseUrl: '', // e.g. 'https://n8n.yourdomain.com/webhook'
    endpoints: {
      runTask:        '/run-task',        // POST  → start a new agent task
      taskStatus:     '/task-status',     // GET   → poll a running task
      auditLog:       '/audit-log',       // GET   → dashboard security audit log
      executionLog:   '/execution-log',   // GET   → n8n workflow execution history
      dashboardStats: '/dashboard-stats', // GET   → top stat cards + workflow health
      documents:      '/documents',       // GET   → Documents page table
      knowledgeBase:  '/knowledge-base',  // GET   → Knowledge Base page
    },
  };

  // Generic fetch wrapper: JSON in, JSON out, one place to add auth headers.
  async function n8nFetch(path, options = {}) {
    if (!N8N_CONFIG.baseUrl) {
      throw new Error(`N8N not configured yet (tried to call ${path})`);
    }
    const res = await fetch(N8N_CONFIG.baseUrl + path, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    if (!res.ok) throw new Error(`n8n request failed (${res.status}) for ${path}`);
    return res.json();
  }

  /* ---- Run a new agent task -------------------------------------
     POST N8N_CONFIG.endpoints.runTask
     Sends: FormData with fields
       taskType : string  ("document" | "coding" | "vision" | "search")
       goal     : string  (free-text instruction)
       files    : File[]  (0 or more, appended as "files")
     n8n should reply:
       { "runId": "DEL-2023-884A", "status": "running" }
     In n8n: Webhook (POST, "Multipart Form Data") → your agent workflow
     → Respond to Webhook with the JSON above. Kick off the actual
     long-running agent work asynchronously (e.g. Execute Workflow node)
     so this call returns fast; poll status with pollAgentRun() below. */
  async function submitTask({ taskType, goal, files }) {
    if (!N8N_CONFIG.baseUrl) {
      console.info('[demo mode] submitTask()', { taskType, goal, files: files.map(f => f.name) });
      return { runId: 'DEMO-RUN', status: 'running' };
    }
    const form = new FormData();
    form.append('taskType', taskType);
    form.append('goal', goal);
    files.forEach(f => form.append('files', f, f.name));

    const res = await fetch(N8N_CONFIG.baseUrl + N8N_CONFIG.endpoints.runTask, {
      method: 'POST',
      body: form, // no Content-Type header — browser sets the multipart boundary
    });
    if (!res.ok) throw new Error(`run-task failed (${res.status})`);
    return res.json();
  }

  /* ---- Poll a running agent task ---------------------------------
     GET N8N_CONFIG.endpoints.taskStatus?runId=...
     n8n should reply:
       {
         "status": "running" | "done" | "error",
         "steps": [ { "title": "...", "detail": "...", "done": true, "time": "1.2s" } ],
         "findingsHtml": "<!-- optional, rendered as-is into the findings panel -->"
       }
     In n8n: read task state from wherever you're storing it (Postgres,
     a simple JSON file, Redis, etc.) and return the current snapshot. */
  function pollAgentRun(runId, intervalMs = 4000) {
    const badge = document.getElementById('agentRunStatusBadge');
    const idLabel = document.getElementById('agentRunId');
    if (idLabel) idLabel.textContent = `ID: ${runId}`;

    const tick = async () => {
      try {
        const data = await n8nFetch(`${N8N_CONFIG.endpoints.taskStatus}?runId=${encodeURIComponent(runId)}`);
        if (badge) badge.textContent = data.status === 'done' ? 'Complete' : data.status === 'error' ? 'Error' : 'Running';
        if (data.status === 'done' || data.status === 'error') return; // stop polling
      } catch (err) {
        console.warn('pollAgentRun:', err.message);
        return; // stop polling on failure rather than spamming a dead endpoint
      }
      setTimeout(tick, intervalMs);
    };
    tick();
  }

  /* ---- Dashboard security audit log -------------------------------
     GET N8N_CONFIG.endpoints.auditLog
     n8n should reply an array:
       [ { "time": "2024-06-01 09:12:03", "service": "...", "status": "...", "ok": true }, ... ]
     In n8n: pull from wherever these events are logged (a workflow that
     appends to a sheet/DB row on each run is enough). */
  async function fetchAuditLog() {
    try {
      const events = await n8nFetch(N8N_CONFIG.endpoints.auditLog);
      if (Array.isArray(events) && events.length) {
        auditEvents = events;
        renderAuditLog();
      }
    } catch (err) {
      console.info('fetchAuditLog: using demo data —', err.message);
    }
  }

  /* ---- Workflow execution log (Security Center) -------------------
     GET N8N_CONFIG.endpoints.executionLog
     n8n should reply an array:
       [ { "time": "...", "workflow": "Document Analysis", "status": "success" | "error" | "running" }, ... ]
     In n8n: the n8n REST API (/executions) already has this data —
     a small workflow can call it and forward the fields you want. */
  async function fetchExecutionLog() {
    const body = document.getElementById('executionLogBody');
    if (!body) return;
    try {
      const rows = await n8nFetch(N8N_CONFIG.endpoints.executionLog);
      if (Array.isArray(rows) && rows.length) {
        body.innerHTML = rows.map(r => `
          <tr>
            <td>${r.time}</td>
            <td>${r.workflow}</td>
            <td><span class="pill pill--${r.status === 'success' ? 'success' : r.status === 'running' ? 'processing' : 'danger'} pill--sm">${r.status}</span></td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.info('fetchExecutionLog: not connected yet —', err.message);
    }
  }

  /* ---- Dashboard stat cards + Workflow Health panel ---------------
     GET N8N_CONFIG.endpoints.dashboardStats
     n8n should reply:
       {
         "activeAgents": 3, "completedTasks": 24, "localModels": 3,
         "docsProcessed": 24, "indexedChunks": 1842, "lastRun": "2m ago",
         "n8nStatus": "Online", "activeWorkflows": 5,
         "runsToday": 18, "successRate": "94%"
       }
     Every field is optional — only matching elements get updated. */
  async function fetchDashboardStats() {
    try {
      const s = await n8nFetch(N8N_CONFIG.endpoints.dashboardStats);
      const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.textContent = val; };
      set('statDocsProcessed', s.docsProcessed);
      set('statIndexedChunks', s.indexedChunks);
      set('statLastRun', s.lastRun);
      set('n8nStatus', s.n8nStatus);
      set('statActiveWorkflows', s.activeWorkflows);
      set('statRunsToday', s.runsToday);
      set('statSuccessRate', s.successRate);
    } catch (err) {
      console.info('fetchDashboardStats: using demo data —', err.message);
      const el = document.getElementById('n8nStatus');
      if (el) el.textContent = 'Not connected';
    }
  }

  /* ---- Documents page ----------------------------------------------
     GET N8N_CONFIG.endpoints.documents
     n8n should reply an array:
       [ { "name": "file.pdf", "type": "PDF", "size": "2.4 MB", "source": "Local API", "status": "Processed" | "Processing" }, ... ]
     In n8n: list files from wherever they land after ingestion
     (a watched folder, S3 bucket, DB table — whatever you use). */
  async function fetchDocuments() {
    const body = document.getElementById('documentsBody');
    if (!body) return;
    try {
      const docs = await n8nFetch(N8N_CONFIG.endpoints.documents);
      if (Array.isArray(docs) && docs.length) {
        body.innerHTML = docs.map(d => `
          <tr>
            <td>${d.name}</td><td>${d.type}</td><td>${d.size}</td><td>${d.source}</td>
            <td><span class="pill pill--${d.status === 'Processed' ? 'success' : 'processing'}">${d.status}</span></td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.info('fetchDocuments: using demo data —', err.message);
    }
  }

  /* ---- Knowledge Base page ------------------------------------------
     GET N8N_CONFIG.endpoints.knowledgeBase
     n8n should reply:
       {
         "indexedDocs": 4, "indexedChunks": 1842,
         "vectorStore": "Local", "embeddingModel": "text-embedding-3-small",
         "sources": [ { "name": "Maintenance SOP", "meta": "2.4 MB · Updated 2h ago", "status": "Indexed" }, ... ]
       }
     In n8n: this maps directly onto whatever vector store node you use
     (Pinecone, Qdrant, Postgres/pgvector, Supabase, etc.) — most have a
     "list documents" style call you can forward here. */
  async function fetchKnowledgeBase() {
    try {
      const kb = await n8nFetch(N8N_CONFIG.endpoints.knowledgeBase);
      const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.textContent = val; };
      set('kbIndexedDocs', kb.indexedDocs);
      set('kbIndexedChunks', kb.indexedChunks);
      set('kbVectorStore', kb.vectorStore);
      set('kbEmbeddingModel', kb.embeddingModel);

      const grid = document.getElementById('kbSourceGrid');
      if (grid && Array.isArray(kb.sources) && kb.sources.length) {
        grid.innerHTML = kb.sources.map(s => `
          <div class="kb-card">
            <strong>${s.name}</strong>
            <span class="muted">${s.meta}</span>
            <span class="pill pill--success pill--sm">${s.status}</span>
          </div>
        `).join('');
      }
    } catch (err) {
      console.info('fetchKnowledgeBase: using demo data —', err.message);
    }
  }

  // Kick off the dashboard fetches on load (no-ops until baseUrl is set).
  fetchAuditLog();
  fetchDashboardStats();

});
