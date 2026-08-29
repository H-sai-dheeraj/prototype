/* =====================================================================
   SECURE AI WORKBENCH — SCRIPT (simple build)
   Sections:
     1. Theme toggle
     2. File upload (dropzone, list, delete)
     3. Ask a question (chat)
     4. BACKEND INTEGRATION — the only section you need to edit to wire
        this up to your FastAPI server (which talks to n8n behind it).
===================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* -------------------------------------------------------------
     1. THEME TOGGLE
  ------------------------------------------------------------- */
  const root = document.documentElement;
  const THEME_KEY = 'workbench-theme';

  function applyTheme(theme) {
    if (theme === 'light') root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');
    localStorage.setItem(THEME_KEY, theme);
  }
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

  document.getElementById('themeToggle').addEventListener('click', () => {
    const current = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    applyTheme(current === 'light' ? 'dark' : 'light');
  });


  /* -------------------------------------------------------------
     2. FILE UPLOAD
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
     3. ASK A QUESTION
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

  // Auto-grow the textarea a little as the person types.
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
     4. BACKEND INTEGRATION (FastAPI → n8n)
     -----------------------------------------------------------------
     This frontend never talks to n8n directly — it talks to your
     FastAPI server, and FastAPI is the one that calls n8n (or whatever
     else it needs) behind the scenes. That keeps this file dead simple:
     three endpoints, three functions.

     TO CONNECT:
       1. Set BACKEND_CONFIG.baseUrl to your FastAPI server's root,
          e.g. "http://localhost:8000/api" or your deployed URL.
       2. Implement the three endpoints below in FastAPI. Each one's
          expected request/response shape is documented above its
          matching function.
       3. Enable CORS in FastAPI for your frontend's origin
          (fastapi.middleware.cors.CORSMiddleware) or these calls will
          be blocked by the browser.
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
     Expects back:
       { "id": "abc123", "filename": "report.pdf", "status": "uploaded" }
     In FastAPI: @app.post("/api/upload") that accepts UploadFile,
     saves/forwards it (e.g. to n8n or straight to a vector store),
     and returns an id you can use later to delete it. */
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
     In FastAPI: @app.delete("/api/files/{file_id}") that removes it
     from storage (and tells n8n/vector store to drop it, if relevant). */
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
     In FastAPI: @app.post("/api/ask") that takes the question, calls
     your n8n workflow (e.g. via requests.post to an n8n webhook,
     passing the question + whatever files are currently uploaded),
     and returns n8n's answer as plain text in "answer". */
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
