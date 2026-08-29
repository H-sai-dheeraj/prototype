/* =====================================================================
   CIPHER CORE — SCRIPT
   Sections:
     1. Theme toggle
     2. Sidebar navigation (page switching + mobile drawer)
     3. Documents page — upload / remove
     4. Dashboard page — ask a question (chat)
     5. BACKEND INTEGRATION — the only section to edit to connect this
        to your FastAPI server (which talks to n8n behind it).
   The Models page is fully static — it has no JS of its own.
===================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* -------------------------------------------------------------
     1. THEME TOGGLE
  ------------------------------------------------------------- */
  const root = document.documentElement;
  const THEME_KEY = 'cipher-core-theme';

  function applyTheme(theme) {
    if (theme === 'light') root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');
    localStorage.setItem(THEME_KEY, theme);
  }
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

  function toggleTheme() {
    const current = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    applyTheme(current === 'light' ? 'dark' : 'light');
  }
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('themeToggleMobile').addEventListener('click', toggleTheme);


  /* -------------------------------------------------------------
     2. SIDEBAR NAVIGATION
  ------------------------------------------------------------- */
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');
  const shell = document.querySelector('.shell');
  const scrim = document.getElementById('scrim');
  const menuToggle = document.getElementById('menuToggle');

  function goToPage(pageId) {
    pages.forEach(p => p.classList.toggle('is-active', p.id === `page-${pageId}`));
    navItems.forEach(n => n.classList.toggle('is-active', n.dataset.page === pageId));
    closeDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  navItems.forEach(item => item.addEventListener('click', () => goToPage(item.dataset.page)));

  function openDrawer() {
    shell.classList.add('drawer-open');
    menuToggle.setAttribute('aria-expanded', 'true');
  }
  function closeDrawer() {
    shell.classList.remove('drawer-open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }
  menuToggle.addEventListener('click', () => {
    shell.classList.contains('drawer-open') ? closeDrawer() : openDrawer();
  });
  scrim.addEventListener('click', closeDrawer);


  /* -------------------------------------------------------------
     3. DOCUMENTS PAGE — upload / remove
  ------------------------------------------------------------- */
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const fileList = document.getElementById('fileList');
  const fileListEmpty = document.getElementById('fileListEmpty');

  function renderFileChip(file) {
    fileListEmpty.style.display = 'none';
    const li = document.createElement('li');
    li.className = 'file-chip is-uploading';
    li.innerHTML = `<span class="file-chip-name">${file.name}</span><button type="button" aria-label="Remove file">&times;</button>`;
    fileList.appendChild(li);

    uploadFile(file)
      .then(res => {
        li.classList.remove('is-uploading');
        li.dataset.fileId = res.id;
      })
      .catch(err => {
        console.error('upload failed:', err);
        li.querySelector('.file-chip-name').textContent = `${file.name} (failed)`;
        li.classList.remove('is-uploading');
      });

    li.querySelector('button').addEventListener('click', () => {
      const id = li.dataset.fileId;
      if (id) deleteFile(id).catch(err => console.error('delete failed:', err));
      li.remove();
      if (!fileList.querySelector('.file-chip')) fileListEmpty.style.display = '';
    });
  }

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    Array.from(fileInput.files).forEach(renderFileChip);
    fileInput.value = '';
  });
  ['dragover', 'dragenter'].forEach(evt =>
    dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('is-dragover'); })
  );
  ['dragleave', 'drop'].forEach(evt =>
    dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('is-dragover'); })
  );
  dropzone.addEventListener('drop', e => {
    Array.from(e.dataTransfer.files).forEach(renderFileChip);
  });


  /* -------------------------------------------------------------
     4. DASHBOARD PAGE — ask a question
  ------------------------------------------------------------- */
  const chat = document.getElementById('chat');
  const chatEmpty = document.getElementById('chatEmpty');
  const askForm = document.getElementById('askForm');
  const askInput = document.getElementById('askInput');
  const askBtn = document.getElementById('askBtn');

  function addBubble(text, kind) {
    chatEmpty.style.display = 'none';
    const div = document.createElement('div');
    div.className = `bubble bubble--${kind}`;
    div.textContent = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    return div;
  }

  askInput.addEventListener('input', () => {
    askInput.style.height = 'auto';
    askInput.style.height = Math.min(askInput.scrollHeight, 120) + 'px';
  });

  askForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const question = askInput.value.trim();
    if (!question) return;

    addBubble(question, 'user');
    askInput.value = '';
    askInput.style.height = 'auto';

    const answerBubble = addBubble('Thinking…', 'answer');
    answerBubble.classList.add('is-loading');
    askBtn.disabled = true;

    try {
      const res = await askQuestion(question);
      answerBubble.textContent = res.answer;
      answerBubble.classList.remove('is-loading');
    } catch (err) {
      console.error('askQuestion failed:', err);
      answerBubble.textContent = 'Could not reach the backend. Check BACKEND_CONFIG in script.js.';
      answerBubble.classList.remove('is-loading');
      answerBubble.classList.add('bubble--error');
    } finally {
      askBtn.disabled = false;
      askInput.focus();
    }
  });


  /* =================================================================
     5. BACKEND INTEGRATION (FastAPI → n8n)
     -----------------------------------------------------------------
     This frontend never talks to n8n directly — it talks to your
     FastAPI server, and FastAPI calls n8n (or whatever else it needs)
     behind the scenes. Three endpoints, three functions. The Models
     page has no function here on purpose — it's static.

     TO CONNECT:
       1. Set BACKEND_CONFIG.baseUrl to your FastAPI root,
          e.g. "http://localhost:8000/api".
       2. Implement the three endpoints below in FastAPI — shapes are
          documented above each function.
       3. Enable CORS in FastAPI for this frontend's origin.
  ================================================================= */

  const BACKEND_CONFIG = {
    baseUrl: '', // e.g. 'http://localhost:8000/api' — leave blank to stay in demo mode
    endpoints: {
      upload: '/upload', // POST → upload one file
      delete: '/files',  // DELETE /files/{id} → remove one file
      ask:    '/ask',    // POST → ask a question
    },
  };

  /* ---- Upload a file --------------------------------------------
     POST BACKEND_CONFIG.endpoints.upload
     Sends: FormData with field "file" (single file)
     Expects back: { "id": "abc123", "filename": "report.pdf", "status": "uploaded" }
     In FastAPI: @app.post("/api/upload") accepts UploadFile, saves or
     forwards it (e.g. to n8n / a vector store), returns an id you can
     use later to delete it. */
  async function uploadFile(file) {
    if (!BACKEND_CONFIG.baseUrl) {
      console.info('[demo mode] uploadFile()', file.name);
      return { id: `demo-${Date.now()}`, filename: file.name, status: 'uploaded' };
    }
    const form = new FormData();
    form.append('file', file, file.name);
    const res = await fetch(BACKEND_CONFIG.baseUrl + BACKEND_CONFIG.endpoints.upload, {
      method: 'POST',
      body: form, // no Content-Type header — the browser sets the multipart boundary
    });
    if (!res.ok) throw new Error(`upload failed (${res.status})`);
    return res.json();
  }

  /* ---- Delete a file ------------------------------------------
     DELETE BACKEND_CONFIG.endpoints.delete/{id}
     No body needed. Any 2xx response is treated as success.
     In FastAPI: @app.delete("/api/files/{file_id}") removes it from
     storage (and tells n8n / the vector store to drop it, if relevant). */
  async function deleteFile(id) {
    if (!BACKEND_CONFIG.baseUrl) {
      console.info('[demo mode] deleteFile()', id);
      return;
    }
    const res = await fetch(`${BACKEND_CONFIG.baseUrl}${BACKEND_CONFIG.endpoints.delete}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`delete failed (${res.status})`);
  }

  /* ---- Ask a question --------------------------------------------
     POST BACKEND_CONFIG.endpoints.ask
     Sends JSON: { "question": "..." }
     Expects back: { "answer": "..." }
     In FastAPI: @app.post("/api/ask") takes the question, calls your
     n8n workflow (e.g. requests.post to an n8n webhook, passing the
     question + whatever files are currently uploaded), and returns
     n8n's answer as plain text in "answer". */
  async function askQuestion(question) {
    if (!BACKEND_CONFIG.baseUrl) {
      console.info('[demo mode] askQuestion()', question);
      return { answer: `(demo mode — set BACKEND_CONFIG.baseUrl in script.js to get a real answer)` };
    }
    const res = await fetch(BACKEND_CONFIG.baseUrl + BACKEND_CONFIG.endpoints.ask, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) throw new Error(`ask failed (${res.status})`);
    return res.json();
  }

});
