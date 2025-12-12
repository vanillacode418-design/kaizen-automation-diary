// Kaizen Automation — client script
// Saves state to localStorage and can POST to server /api/state with x-api-key header.
// Autogenerates 60-day roadmap based on phases and templates.

(() => {
  // Utilities
  const uid = (p='id') => `${p}-${Math.random().toString(36).slice(2,9)}`;
  const $ = sel => document.querySelector(sel);
  const qs = sel => Array.from(document.querySelectorAll(sel));

  // Default state model
  const DEFAULT_STATE = {
    meta: { projectName: "Kaizen Automation", createdAt: new Date().toISOString(), lastSaved: null },
    tools: [
      { id: uid('twilio'), name: "Twilio", daily: 8, purchase: 0, enabled: true },
      { id: uid('vapi'), name: "Vapi", daily: 6, purchase: 0, enabled: true },
      { id: uid('wa'), name: "WhatsApp Cloud", daily: 2, purchase: 0, enabled: true }
    ],
    costs: { numWorkers: 3, perWorker: 80, miscDaily: 10, presets: {} },
    roadmap: [],
    templates: { messageTrees: {}, sops: {} },
    diary: [],
    settings: { autoSaveInterval: 10000 }
  };

  // Phases and task templates (compact)
  const PHASES = [
    { name:'Foundation', days:[1,2,3], templates:[
      {title: "Register Twilio account", desc:"Create Twilio account, record SID/auth token, buy numbers", est:30},
      {title: "Set up Vapi", desc:"Create Vapi account, voice model selection, assign number", est:30},
      {title: "WhatsApp Cloud setup", desc:"Create app, templates, phone number & webhook", est:30},
      {title: "Project skeleton", desc:"Create repo, server stub, deploy plan", est:20}
    ]},
    { name:'Data & GHL', days:[4,5,6,7,8,9,10], templates:[
      {title:"Define GHL custom fields", desc:"List fields required and data types", est:40},
      {title:"Create tags list", desc:"Create TAGS like TRADE-, CERT-, etc", est:30},
      {title:"Map field validation rules", desc:"Decide regexes and constraints", est:25},
      {title:"Build sample contact import CSV", desc:"Prepare sample CSV with mapping", est:20}
    ]},
    { name:'Integrations', days:[11,12,13,14,15,16,17,18,19,20], templates:[
      {title:"Setup Twilio webhooks", desc:"Configure webhook URLs and test payloads", est:30},
      {title:"Connect n8n/Make", desc:"Create webhook flow and test", est:40},
      {title:"Build webhook receivers", desc:"Implement server endpoints to accept webhooks", est:30},
      {title:"Test retry/backoff", desc:"Define behavior for failures", est:20}
    ]},
    { name:'Workflows', days:[21,22,23,24,25,26,27,28,29,30], templates:[
      {title:"Implement WhatsApp validation tree", desc:"Phone validation and opt-in flows", est:40},
      {title:"Implement Opt-in flow", desc:"Opt-in confirmation messages & logging", est:30},
      {title:"Availability checks", desc:"Agent availability, shift mapping", est:30},
      {title:"Tools capability checks", desc:"Service checks for Twilio/Vapi", est:25}
    ]},
    { name:'Pre-start', days:[31,32,33,34,35,36,37,38,39,40], templates:[
      {title:"Create pre-start pack templates", desc:"Messages, checklist for agents", est:30},
      {title:"24-hour flows", desc:"Define messages for 24h cycle", est:30},
      {title:"ETA capture", desc:"Implement ETA capture and reminders", est:25},
      {title:"Training scripts", desc:"Create agent training SOPs", est:30}
    ]},
    { name:'Test & Validate', days:[41,42,43,44,45,46,47,48,49,50], templates:[
      {title:"Persona tests", desc:"Run 5 persona tests end-to-end", est:45},
      {title:"Failover tests", desc:"Simulate Twilio/Vapi failure", est:40},
      {title:"Template approvals", desc:"Legal & compliance review", est:30},
      {title:"Logging & metrics", desc:"Wire basic metrics dashboards", est:30}
    ]},
    { name:'Launch & Monitor', days:[51,52,53,54,55,56,57,58,59,60], templates:[
      {title:"Phase roll-out plan", desc:"Plan staged go-live", est:40},
      {title:"Dashboard monitoring", desc:"Set up monitoring & alerts", est:30},
      {title:"Optimization loops", desc:"Collect feedback and iterate", est:30},
      {title:"Post-launch SOPs", desc:"Oncall, incident response", est:30}
    ]}
  ];

  // Application state (will be loaded)
  let STATE = null;
  const STORAGE_KEY = 'kaizen_state_v1';

  // DOM refs
  const refs = {
    toolsList: $('#toolsList'),
    numWorkers: $('#numWorkers'),
    perWorker: $('#perWorker'),
    miscDaily: $('#miscDaily'),
    toolsDailyTotal: $('#toolsDailyTotal'),
    laborDailyTotal: $('#laborDailyTotal'),
    miscDailyTotal: $('#miscDailyTotal'),
    grandDaily: $('#grandDaily'),
    presetSelect: $('#presetSelect'),
    savePresetBtn: $('#savePresetBtn'),
    addToolBtn: $('#addToolBtn'),
    projectName: $('#projectName'),
    roadmap: $('#roadmap'),
    progressBar: $('#progressBar'),
    progressPct: $('#progressPct'),
    quickSaveBtn: $('#quickSaveBtn'),
    exportJsonBtn: $('#exportJsonBtn'),
    importJsonBtn: $('#importJsonBtn'),
    exportPdfBtn: $('#exportPdfBtn'),
    exportPdfBtn2: $('#exportPdfBtn2'),
    saveToServerBtn: $('#saveToServerBtn'),
    serverUrl: $('#serverUrl'),
    apiKey: $('#apiKey'),
    modal: $('#modal'),
    modalBody: $('#modalBody'),
    closeModal: $('#closeModal'),
    quickDiary: $('#quickDiary'),
    addDiaryBtn: $('#addDiaryBtn'),
    viewDiaryBtn: $('#viewDiaryBtn'),
    toolsFooter: $('#footerTools'),
    laborFooter: $('#footerLabor'),
    grandFooter: $('#footerGrand'),
    openIntegrationsBtn: $('#openIntegrationsBtn'),
    integrationForms: $('#integrationForms'),
    openReadme: $('#openReadme'),
    phaseFilter: $('#phaseFilter'),
    collapseAllBtn: $('#collapseAllBtn'),
    expandAllBtn: $('#expandAllBtn'),
    compactToggle: $('#compactToggle'),
    importJsonInput: null
  };

  // Helpers: modal
  function showModal(html){
    refs.modalBody.innerHTML = html;
    refs.modal.classList.remove('hidden');
  }
  function closeModal(){ refs.modal.classList.add('hidden'); refs.modalBody.innerHTML = ''; }
  refs.closeModal.addEventListener('click', closeModal);
  refs.modal.addEventListener('click', (e) => { if(e.target === refs.modal) closeModal(); });

  // Initialize state (load or generate)
  function generateRoadmap(){
    const roadmap = [];
    for (let d = 1; d <= 60; d++){
      let phaseObj = PHASES.find(p => p.days.includes(d)) || PHASES[0];
      // pick 4-6 tasks from templates (rotate)
      const tset = phaseObj.templates;
      const tasks = [];
      // create between 4 and 6 tasks
      const n = 4 + (d % 3);
      for (let i=0;i<n;i++){
        const tpl = tset[(d + i) % tset.length];
        tasks.push({
          id: `d${d}t${i}-${Math.random().toString(36).slice(2,6)}`,
          title: tpl.title,
          desc: tpl.desc,
          estMinutes: tpl.est,
          done: false,
          doneAt: null,
          notes: ""
        });
      }
      roadmap.push({ day: d, phase: phaseObj.name, tasks });
    }
    return roadmap;
  }

  function loadState(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw){
      try{
        const s = JSON.parse(raw);
        // basic backward-compat fixes
        if(!s.roadmap || s.roadmap.length === 0) s.roadmap = generateRoadmap();
        if(!s.meta) s.meta = DEFAULT_STATE.meta;
        if(!s.tools) s.tools = DEFAULT_STATE.tools;
        if(!s.costs) s.costs = DEFAULT_STATE.costs;
        return s;
      } catch(e){ console.error("Corrupt local state, resetting", e); }
    }
    // default state
    const base = JSON.parse(JSON.stringify(DEFAULT_STATE));
    base.roadmap = generateRoadmap();
    return base;
  }

  function saveLocal(notify=false){
    STATE.meta.lastSaved = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
    if (notify) flash("Saved locally");
    renderAll();
  }

  // Autosave
  let autosaveTimer = null;
  function startAutosave(){
    if (autosaveTimer) clearInterval(autosaveTimer);
    const ms = STATE.settings.autoSaveInterval || 10000;
    autosaveTimer = setInterval(()=> saveLocal(false), ms);
  }

  // Render tools list and calculator
  function renderTools(){
    refs.toolsList.innerHTML = '';
    STATE.tools.forEach(tool => {
      const row = document.createElement('div'); row.className='tool-row';
      row.innerHTML = `
        <input data-id="${tool.id}" class="tool-enable" type="checkbox" ${tool.enabled ? 'checked' : ''} title="Use in calc"/>
        <input data-id="${tool.id}" class="tool-name" value="${escapeHtml(tool.name)}" />
        <input data-id="${tool.id}" class="tool-daily" type="number" min="0" value="${tool.daily}" />
        <input data-id="${tool.id}" class="tool-purchase" type="number" min="0" value="${tool.purchase}" />
        <button data-id="${tool.id}" class="tool-remove small-btn">✕</button>
      `;
      refs.toolsList.appendChild(row);
    });

    // Add handlers
    qs('.tool-name').forEach(el => el.addEventListener('change', e => {
      const id = e.target.dataset.id; const t = STATE.tools.find(x=>x.id===id);
      if(t){ t.name = el.value; saveLocal(); }
    }));
    qs('.tool-daily').forEach(el => el.addEventListener('change', e => {
      const id = e.target.dataset.id; const t = STATE.tools.find(x=>x.id===id);
      if(t){ t.daily = Number(el.value); computeCosts(); saveLocal(); }
    }));
    qs('.tool-purchase').forEach(el => el.addEventListener('change', e => {
      const id = e.target.dataset.id; const t = STATE.tools.find(x=>x.id===id);
      if(t){ t.purchase = Number(el.value); saveLocal(); }
    }));
    qs('.tool-enable').forEach(el => el.addEventListener('change', e => {
      const id = e.target.dataset.id; const t = STATE.tools.find(x=>x.id===id);
      if(t){ t.enabled = el.checked; computeCosts(); saveLocal(); }
    }));
    qs('.tool-remove').forEach(el => el.addEventListener('click', e => {
      const id = e.target.dataset.id;
      STATE.tools = STATE.tools.filter(t=>t.id!==id);
      saveLocal(true);
    }));

    computeCosts();
  }

  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

  // Calculator
  function computeCosts(){
    const toolsDaily = STATE.tools.filter(t=>t.enabled).reduce((sum,t)=>sum + (Number(t.daily)||0),0);
    const labor = (Number(STATE.costs.numWorkers)||0) * (Number(STATE.costs.perWorker)||0);
    const misc = Number(STATE.costs.miscDaily)||0;
    const grand = (toolsDaily + labor + misc);
    refs.toolsDailyTotal.textContent = `$${formatNumber(toolsDaily)}`;
    refs.laborDailyTotal.textContent = `$${formatNumber(labor)}`;
    refs.miscDailyTotal.textContent = `$${formatNumber(misc)}`;
    refs.grandDaily.textContent = `$${formatNumber(grand)}`;
    refs.toolsFooter.textContent = `$${formatNumber(toolsDaily)}`;
    refs.laborFooter.textContent = `$${formatNumber(labor)}`;
    refs.grandFooter.textContent = `$${formatNumber(grand)}`;
  }
  function formatNumber(n){ return Number(n).toLocaleString(undefined, {maximumFractionDigits:2}); }

  // Presets
  function renderPresets(){
    refs.presetSelect.innerHTML = `<option value="">—select—</option>`;
    const p = STATE.costs.presets || {};
    Object.keys(p).forEach(k => {
      const opt = document.createElement('option'); opt.value = k; opt.textContent = k;
      refs.presetSelect.appendChild(opt);
    });
  }

  // Roadmap render
  function renderRoadmap(filterPhase='all'){
    refs.roadmap.innerHTML = '';
    STATE.roadmap.forEach(dayObj => {
      if (filterPhase !== 'all' && dayObj.phase !== filterPhase) return;
      const dayWrap = document.createElement('div'); dayWrap.className='day';
      dayWrap.innerHTML = `
        <div class="day-header" data-day="${dayObj.day}">
          <div>
            <h3>Day ${dayObj.day} — ${escapeHtml(dayObj.phase)}</h3>
            <div class="small muted">Tasks: ${dayObj.tasks.length}</div>
          </div>
          <div class="day-controls">
            <div class="progress-track small" style="width:180px">
              <div class="progress-bar" style="width:${calcDayProgress(dayObj)}%"></div>
            </div>
            <button class="small-btn toggle-day">Toggle</button>
            <button class="small-btn export-day" data-day="${dayObj.day}">Export</button>
          </div>
        </div>
        <div class="day-body" style="display:block"></div>
      `;
      const body = dayWrap.querySelector('.day-body');
      dayObj.tasks.forEach(task => {
        const t = document.createElement('div'); t.className='task';
        t.innerHTML = `
          <div class="${task.done ? 'checkbox done' : 'checkbox'}" data-task="${task.id}" title="Mark done">${task.done ? '✓' : ''}</div>
          <div class="title">
            <strong>${escapeHtml(task.title)}</strong>
            <small>${escapeHtml(task.desc)} • est ${task.estMinutes}m</small>
            <div class="small muted">${task.done && task.doneAt ? `Completed: ${new Date(task.doneAt).toLocaleString()}` : ''}</div>
          </div>
          <div class="task-actions">
            <button class="small-btn note-btn" data-task="${task.id}">Notes</button>
            <button class="small-btn remove-task" data-task="${task.id}">Remove</button>
          </div>
        `;
        body.appendChild(t);

        // handlers
        t.querySelector('.checkbox').addEventListener('click', () => {
          task.done = !task.done;
          task.doneAt = task.done ? new Date().toISOString() : null;
          saveLocal();
        });
        t.querySelector('.note-btn').addEventListener('click', () => {
          openNoteEditor(task);
        });
        t.querySelector('.remove-task').addEventListener('click', () => {
          if(confirm('Remove task? (This deletes the task)')){
            dayObj.tasks = dayObj.tasks.filter(x=>x.id!==task.id);
            saveLocal(true);
          }
        });
      });

      refs.roadmap.appendChild(dayWrap);

      // toggle and export button handlers
      dayWrap.querySelector('.toggle-day').addEventListener('click', e => {
        const bd = dayWrap.querySelector('.day-body');
        bd.style.display = bd.style.display === 'none' ? 'block' : 'none';
      });
      dayWrap.querySelector('.export-day').addEventListener('click', e => {
        const dnum = Number(e.target.dataset.day);
        const d = STATE.roadmap.find(x=>x.day===dnum);
        downloadJSON(d, `day-${dnum}.json`);
      });
    });

    // update overall progress
    renderProgress();
  }

  function calcDayProgress(dayObj){
    const total = dayObj.tasks.length || 1;
    const done = dayObj.tasks.filter(t=>t.done).length;
    return Math.round((done/total)*100);
  }

  function renderProgress(){
    const allTasks = STATE.roadmap.flatMap(d=>d.tasks);
    const total = allTasks.length || 1;
    const done = allTasks.filter(t=>t.done).length;
    const pct = Math.round((done/total)*100);
    refs.progressBar.style.width = pct + '%';
    refs.progressPct.textContent = pct + '%';
  }

  // Note editor
  function openNoteEditor(task){
    showModal(`<h2>Notes — ${escapeHtml(task.title)}</h2>
      <textarea id="noteEditor" rows="8">${escapeHtml(task.notes||'')}</textarea>
      <div style="margin-top:8px">
        <button id="saveNoteBtn" class="btn neon">Save</button>
        <button id="archiveNoteBtn" class="btn">Archive</button>
      </div>`);
    $('#saveNoteBtn').addEventListener('click', () => {
      task.notes = $('#noteEditor').value;
      saveLocal(true);
      closeModal();
    });
    $('#archiveNoteBtn').addEventListener('click', () => {
      if(task.notes) {
        task.notes = `[ARCHIVED ${new Date().toISOString()}]\n` + task.notes;
        saveLocal(true);
        closeModal();
      } else {
        alert('No note to archive');
      }
    });
  }

  // Diary functions
  function addDiary(content){
    STATE.diary.unshift({
      id: uid('note'),
      title: content.slice(0,40) || 'Note',
      content,
      pinned: false,
      createdAt: new Date().toISOString(),
      archived:false
    });
    saveLocal(true);
  }
  function viewDiary(){
    const list = STATE.diary.map(n => `
      <div style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.03)">
        <div style="display:flex;justify-content:space-between">
          <strong>${escapeHtml(n.title)}</strong>
          <div><small>${new Date(n.createdAt).toLocaleString()}</small></div>
        </div>
        <pre style="white-space:pre-wrap">${escapeHtml(n.content)}</pre>
        <div style="margin-top:6px">
          <button class="btn small edit-note" data-id="${n.id}">Edit</button>
          <button class="btn small" data-id="${n.id}" id="archive-${n.id}">${n.archived ? 'Unarchive' : 'Archive'}</button>
          <button class="btn small" data-id="${n.id}" id="delete-${n.id}">Delete</button>
        </div>
      </div>
    `).join('');
    showModal(`<h2>Diary</h2><div style="max-height:60vh;overflow:auto">${list}</div>`);
    qs('.edit-note').forEach(btn => btn.addEventListener('click', e => {
      const id = e.target.dataset.id; const n = STATE.diary.find(x=>x.id===id);
      if(!n) return;
      showModal(`<h2>Edit Note</h2><textarea id="editNote" rows="8">${escapeHtml(n.content)}</textarea><div style="margin-top:8px"><button id="saveEdit" class="btn neon">Save</button></div>`);
      $('#saveEdit').addEventListener('click', () => {
        n.content = $('#editNote').value;
        saveLocal(true);
        closeModal();
      });
    }));
    STATE.diary.forEach(n => {
      const archiveBtn = $(`#archive-${n.id}`); const deleteBtn = $(`#delete-${n.id}`);
      if(archiveBtn) archiveBtn.addEventListener('click', () => { n.archived = !n.archived; saveLocal(true); viewDiary(); });
      if(deleteBtn) deleteBtn.addEventListener('click', () => { if(confirm('Delete note?')) { STATE.diary = STATE.diary.filter(x=>x.id!==n.id); saveLocal(true); viewDiary(); } });
    });
  }

  // Import/Export JSON
  function downloadJSON(obj, filename='kaizen.json'){
    const blob = new Blob([JSON.stringify(obj, null, 2)], {type: 'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    URL.revokeObjectURL(a.href);
  }
  function importJSON(file){
    const reader = new FileReader();
    reader.onload = e => {
      try{
        const data = JSON.parse(e.target.result);
        STATE = data;
        saveLocal(true);
        renderAll();
        closeModal();
        flash('Imported JSON');
      }catch(err){ alert('Invalid JSON'); }
    };
    reader.readAsText(file);
  }

  // PDF export (simple summary)
  async function exportPDF(){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Kaizen Automation — ${STATE.meta.projectName || ''}`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Created: ${new Date(STATE.meta.createdAt).toLocaleString()}`, 14, 24);
    const allTasks = STATE.roadmap.flatMap(d=>d.tasks);
    const total = allTasks.length, done = allTasks.filter(t=>t.done).length;
    doc.text(`Progress: ${done}/${total} (${Math.round(done/total*100)}%)`, 14, 30);
    doc.text(`Costs/day: ${refs.grandDaily.textContent}`, 14, 36);

    doc.text('Top tools:', 14, 44);
    STATE.tools.slice(0,8).forEach((t,i) => {
      doc.text(`${t.name} — $${t.daily}/day`, 14, 50 + i*6);
    });

    // completed tasks list (first 20)
    let y = 50 + Math.min(8, STATE.tools.length) * 6 + 6;
    doc.text('Recent completed tasks:', 14, y); y += 6;
    const completed = allTasks.filter(t=>t.done).slice(-20).reverse();
    completed.forEach((t,i) => {
      const label = `${t.title} (${t.doneAt ? new Date(t.doneAt).toLocaleString() : ''})`;
      doc.text(truncate(label, 80), 14, y + i*6);
    });

    doc.save(`${(STATE.meta.projectName || 'kaizen').replace(/\s+/g,'_')}_summary.pdf`);
  }
  function truncate(s,n){ return s.length>n ? s.slice(0,n-1)+'…' : s; }

  // Server save/load
  async function saveToServer(){
    const url = (refs.serverUrl.value || '').replace(/\/$/,'') + '/api/state';
    const key = refs.apiKey.value || '';
    if(!url || !key){ alert('Provide server URL and API key in right panel'); return; }
    try{
      const res = await fetch(url, {
        method:'POST',
        headers: {'Content-Type':'application/json','x-api-key': key},
        body: JSON.stringify(STATE)
      });
      if(!res.ok) { throw new Error(`${res.status} ${res.statusText}`); }
      flash('Saved to server');
    }catch(err){ alert('Save failed: '+err.message); }
  }

  async function loadFromServer(){
    const url = (refs.serverUrl.value || '').replace(/\/$/,'') + '/api/state';
    const key = refs.apiKey.value || '';
    if(!url || !key){ alert('Provide server URL and API key in right panel'); return; }
    try{
      const res = await fetch(url, { headers: {'x-api-key': key} });
      if(res.ok){
        const data = await res.json();
        STATE = data;
        saveLocal(true);
        renderAll();
        flash('Loaded from server');
      } else {
        throw new Error(await res.text());
      }
    }catch(err){ alert('Load failed: '+err.message); }
  }

  // Webhook test buttons send sample payloads
  function registerIntegrationTests(){
    refs.integrationForms.addEventListener('click', async (e) => {
      const target = e.target;
      if(!target.dataset.test) return;
      const test = target.dataset.test;
      const server = refs.serverUrl.value.replace(/\/$/,'') || '';
      const key = refs.apiKey.value || '';
      if(!server || !key){ alert('Provide server URL and API key'); return; }
      try{
        let url = server;
        let body, headers = {'x-api-key': key};
        if(test === 'twilio'){
          url += '/webhook/twilio-sms';
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
          body = new URLSearchParams({From:'+447700900000', Body:'YES', MessageSid:'SM123'});
        } else if(test === 'wa'){
          url += '/webhook/whatsapp';
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({
            object:"whatsapp_business_account",
            entry:[{changes:[{value:{messages:[{from:"+447700900000",id:"wamid.1",text:{body:"YES"}}],contacts:[{profile:{name:"Ali"}}]}}]}]
          });
        } else if(test === 'vapi'){
          url += '/webhook/vapi';
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({callId:"call-123", from:"+44...", transcript:"I will attend", intent:"confirm", confidence:0.92, tags:["WA-Valid","OPT-In"]});
        } else if(test === 'webhook'){
          url += '/webhook/sample';
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({event:'sample', detail:'test webhook'});
        } else if(test === 'ghl'){
          url += '/webhook/ghl';
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({event:'ghl_test', status:'ok'});
        }
        const res = await fetch(url, {method:'POST', headers, body});
        if(res.ok) flash('Webhook test sent');
        else alert('Webhook test failed: ' + res.statusText);
      } catch(err){ alert('Webhook error: '+err.message); }
    });
  }

  // Small helpers
  function flash(msg){
    console.log(msg);
    const el = document.createElement('div');
    el.textContent = msg; el.style.cssText = 'position:fixed;right:20px;top:80px;background:var(--neon-blue);color:#001;padding:8px 12px;border-radius:8px;z-index:9999';
    document.body.appendChild(el);
    setTimeout(()=> el.remove(),2000);
  }

  // Render all UI parts
  function renderAll(){
    // meta
    refs.projectName.value = STATE.meta.projectName || '';
    // tools
    renderTools();
    renderPresets();
    // costs inputs
    refs.numWorkers.value = STATE.costs.numWorkers;
    refs.perWorker.value = STATE.costs.perWorker;
    refs.miscDaily.value = STATE.costs.miscDaily;
    // roadmap
    renderRoadmap(refs.phaseFilter.value || 'all');
  }

  // Event wiring
  function wireEvents(){
    refs.addToolBtn.addEventListener('click', () => {
      STATE.tools.push({id: uid('tool'), name: "New Tool", daily: 0, purchase: 0, enabled:true});
      saveLocal(true);
    });
    refs.numWorkers.addEventListener('change', e => { STATE.costs.numWorkers = Number(e.target.value)||0; computeCosts(); saveLocal(); });
    refs.perWorker.addEventListener('change', e => { STATE.costs.perWorker = Number(e.target.value)||0; computeCosts(); saveLocal(); });
    refs.miscDaily.addEventListener('change', e => { STATE.costs.miscDaily = Number(e.target.value)||0; computeCosts(); saveLocal(); });
    refs.savePresetBtn.addEventListener('click', () => {
      const name = prompt('Preset name'); if(!name) return;
      STATE.costs.presets[name] = { numWorkers: STATE.costs.numWorkers, perWorker: STATE.costs.perWorker, miscDaily: STATE.costs.miscDaily };
      renderPresets(); saveLocal(true);
    });
    refs.presetSelect.addEventListener('change', e => {
      const v = e.target.value; if(!v) return;
      const p = STATE.costs.presets[v];
      if(p){ STATE.costs.numWorkers = p.numWorkers; STATE.costs.perWorker = p.perWorker; STATE.costs.miscDaily = p.miscDaily; renderAll(); saveLocal(); }
    });

    refs.quickSaveBtn.addEventListener('click', () => { saveLocal(true); });
    refs.exportJsonBtn.addEventListener('click', () => downloadJSON(STATE, `${(STATE.meta.projectName||'kaizen').replace(/\s+/g,'_')}.json`));
    refs.exportPdfBtn.addEventListener('click', exportPDF);
    refs.exportPdfBtn2.addEventListener('click', exportPDF);

    refs.addDiaryBtn.addEventListener('click', () => {
      const t = refs.quickDiary.value.trim(); if(!t){ alert('Write something first'); return; }
      addDiary(t); refs.quickDiary.value=''; flash('Note added');
    });
    refs.viewDiaryBtn.addEventListener('click', viewDiary);
    refs.saveToServerBtn.addEventListener('click', saveToServer);

    refs.openIntegrationsBtn.addEventListener('click', () => showModal(`<h2>Integrations & Webhook Examples</h2>
      <pre style="white-space:pre-wrap">
WhatsApp incoming payload (POST /webhook/whatsapp):
{ "object":"whatsapp_business_account", "entry":[ { "changes":[ { "value": { "messages":[ { "from":"447700900000","id":"wamid.HBg...","text":{"body":"YES"} } ], "contacts":[{"profile":{"name":"Ali"}}] } } ] } ]

Twilio SMS (form-encoded) (POST /webhook/twilio-sms)
From=+447700900000
Body=YES
MessageSid=SM...

Vapi call result (POST /webhook/vapi):
{ "callId":"call-123", "from":"+44...", "transcript":"I will attend", "intent":"confirm", "confidence":0.92, "tags":["WA-Valid","OPT-In"] }
      </pre>`); });

    refs.openReadme.addEventListener('click', () => {
      showModal(`<h2>README</h2><pre style="white-space:pre-wrap">${escapeHtml(README_TEXT || '')}</pre>`);
    });

    // import json dialog
    refs.importJsonBtn.addEventListener('click', () => {
      showModal(`<h2>Import JSON</h2><input type="file" id="impfile" accept="application/json" /><div style="margin-top:10px"><button id="doImport" class="btn neon">Import</button></div>`);
      $('#doImport').addEventListener('click', () => {
        const f = $('#impfile').files[0];
        if(!f) return alert('Select file');
        importJSON(f);
      });
    });

    refs.phaseFilter.addEventListener('change', ()=> renderRoadmap(refs.phaseFilter.value));
    refs.collapseAllBtn.addEventListener('click', ()=> { qs('.day .day-body').forEach(x=>x.style.display='none'); });
    refs.expandAllBtn.addEventListener('click', ()=> { qs('.day .day-body').forEach(x=>x.style.display='block'); });
    refs.compactToggle.addEventListener('change', e => {
      document.body.classList.toggle('compact', e.target.checked);
    });

    // enable webhook test registration
    registerIntegrationTests();
  }

  // Simple text storage for README to show in modal
  const README_TEXT = `
Kaizen Automation — Quick README
- Run locally:
  1. cp .env.example .env and set API_SECRET and PORT (optional)
  2. npm install
  3. npm start
  4. Open http://localhost:3000

- Server endpoints:
  GET /api/state (requires x-api-key)
  POST /api/state (save state JSON)
  POST /webhook/whatsapp
  POST /webhook/twilio-sms
  POST /webhook/vapi
  All POST endpoints require x-api-key header equal to API_SECRET

- Export JSON, Export PDF available in header/footer
- Autosave to localStorage every 10s
`;

  // Initialization
  function init(){
    STATE = loadState();
    // fill phase filter
    const phases = [...new Set(STATE.roadmap.map(d=>d.phase))];
    refs.phaseFilter.innerHTML = `<option value="all">All</option>` + phases.map(p=>`<option value="${p}">${p}</option>`).join('');
    wireEvents();
    renderAll();
    startAutosave();

    // Listen for project name change
    refs.projectName.addEventListener('change', e => { STATE.meta.projectName = e.target.value; saveLocal(); });

    // restore server url and apiKey from localStorage if present
    refs.serverUrl.value = localStorage.getItem('kaizen_server_url') || '';
    refs.apiKey.value = localStorage.getItem('kaizen_api_key') || '';
    refs.serverUrl.addEventListener('change', (e)=> localStorage.setItem('kaizen_server_url', e.target.value));
    refs.apiKey.addEventListener('change', (e)=> localStorage.setItem('kaizen_api_key', e.target.value));
  }

  // kick off
  init();

  // Expose small debug
  window.Kaizen = {
    getState: ()=> STATE,
    saveLocal
  };

})();
