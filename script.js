/* =====================================================================
   SECURE AI WORKBENCH — SCRIPT
   Sections:
     1. Theme toggle (light/dark, persisted in localStorage)
     2. Sidebar navigation (switch pages, mobile drawer open/close)
     3. Dashboard: security audit log (rendered from data + live demo tick)
     4. New Task page: task-type picker, drag/drop file upload
     5. Model Registry: copy-code button
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
     3. SECURITY AUDIT LOG (dashboard)
     Rendered from a small data array so new events can be pushed
     in later (e.g. from a backend) without touching the HTML.
  ------------------------------------------------------------- */
  const auditEvents = [
    { time: '2023-10-27 14:32:05', service: 'Model Event',              status: 'Model loaded locally',        ok: true },
    { time: '2023-10-27 14:31:15', service: 'Firewall Event',           status: 'External connection blocked', ok: false },
    { time: '2023-10-27 14:28:44', service: 'System Event',             status: 'Isolated runtime initialized',ok: true },
    { time: '2023-10-27 14:15:02', service: 'Local Model Inference',    status: 'Daily security scan completed cleanly', ok: true },
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
  document.querySelectorAll('.task-type').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.task-type').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
    });
  });

  // Drag-and-drop / click-to-upload file list (front-end only —
  // wire this up to your backend's upload endpoint later)
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const uploadedFiles = document.getElementById('uploadedFiles');

  function addFileChip(name) {
    const li = document.createElement('li');
    li.innerHTML = `${name} <button type="button" aria-label="Remove file">&times;</button>`;
    li.querySelector('button').addEventListener('click', () => li.remove());
    uploadedFiles.appendChild(li);
  }

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    Array.from(fileInput.files).forEach(f => addFileChip(f.name));
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
    Array.from(e.dataTransfer.files).forEach(f => addFileChip(f.name));
  });

  // "Run Agent" — front-end placeholder; hook this up to your API call
  const runAgentBtn = document.getElementById('runAgentBtn');
  if (runAgentBtn) {
    runAgentBtn.addEventListener('click', () => {
      // TODO: replace with a real request to your backend, e.g.:
      // fetch('/api/agent/run', { method: 'POST', body: JSON.stringify({...}) })
      goToPage('agent-runs');
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

});