// ═══════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════

function gradeLabel(val) {
  if (val >= 4.00) return ['A — Excellent',      '#22c55e'];
  if (val >= 3.67) return ['A- — Excellent',     '#22c55e'];
  if (val >= 3.33) return ['B+ — Good',          '#84cc16'];
  if (val >= 3.00) return ['B — Good',           '#84cc16'];
  if (val >= 2.67) return ['B- — Good',          '#84cc16'];
  if (val >= 2.33) return ['C+ — Satisfactory',  '#eab308'];
  if (val >= 2.00) return ['C — Satisfactory',   '#eab308'];
  if (val >= 1.67) return ['C- — Satisfactory',  '#eab308'];
  if (val >= 1.33) return ['D+ — Pass',          '#f97316'];
  if (val >= 1.00) return ['D — Pass',           '#f97316'];
  return                  ['F — Unsatisfactory', '#ef4444'];
}

function pctToGrade(pct) {
  if (pct >= 95) return { letter:'A',   pts:4.00, level:'Excellent' };
  if (pct >= 90) return { letter:'A-',  pts:3.67, level:'Excellent' };
  if (pct >= 85) return { letter:'B+',  pts:3.33, level:'Good' };
  if (pct >= 80) return { letter:'B',   pts:3.00, level:'Good' };
  if (pct >= 75) return { letter:'B-',  pts:2.67, level:'Good' };
  if (pct >= 70) return { letter:'C+',  pts:2.33, level:'Satisfactory' };
  if (pct >= 65) return { letter:'C',   pts:2.00, level:'Satisfactory' };
  if (pct >= 60) return { letter:'C-',  pts:1.67, level:'Satisfactory' };
  if (pct >= 55) return { letter:'D+',  pts:1.33, level:'Pass' };
  if (pct >= 50) return { letter:'D',   pts:1.00, level:'Pass' };
  if (pct >= 25) return { letter:'FX',  pts:0.00, level:'Unsatisfactory' };
  return               { letter:'F',   pts:0.00, level:'Unsatisfactory' };
}

function setBadge(el, val) {
  const [label, color] = gradeLabel(val);
  el.textContent = label;
  el.style.background = color + '22';
  el.style.color = color;
  el.style.border = `1px solid ${color}55`;
}

function showError(type, msg) {
  const el = document.getElementById(type + '-error');
  el.textContent = msg; el.classList.add('show');
}
function hideError(type) {
  document.getElementById(type + '-error').classList.remove('show');
}

function animateValue(el, target) {
  const start = parseFloat(el.textContent) || 0;
  const dur = 600, step = 16;
  let t = 0;
  const iv = setInterval(() => {
    t += step;
    const pct = Math.min(t / dur, 1);
    const ease = 1 - Math.pow(1 - pct, 3);
    el.textContent = (start + (target - start) * ease).toFixed(2);
    if (pct >= 1) clearInterval(iv);
  }, step);
}

function copyResult(elId, label) {
  const val = document.getElementById(elId).textContent;
  navigator.clipboard.writeText(`${label}: ${val}`).then(() => {
    const btn = event.currentTarget;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 1500);
  });
}

function flashSaved(type) {
  const dot = document.getElementById(type + '-saved');
  if (!dot) return;
  dot.classList.add('show');
  setTimeout(() => dot.classList.remove('show'), 1800);
}

// ═══════════════════════════════════════════════════════════
//  CONFETTI
// ═══════════════════════════════════════════════════════════
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const pieces = Array.from({length:120}, () => ({
    x: Math.random() * canvas.width, y: -10,
    r: 4 + Math.random() * 6,
    d: 2 + Math.random() * 4,
    color: ['#6c63ff','#a78bfa','#22c55e','#eab308','#f97316','#38bdf8'][Math.floor(Math.random()*6)],
    tilt: Math.random() * 10 - 5,
    spin: (Math.random() - .5) * .3,
  }));
  let frame = 0;
  const iv = setInterval(() => {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pieces.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = p.color; ctx.fill();
      p.y += p.d; p.x += Math.sin(frame/20 + p.tilt) * 1.5;
      p.tilt += p.spin;
    });
    frame++;
    if (frame > 120) { clearInterval(iv); ctx.clearRect(0,0,canvas.width,canvas.height); }
  }, 16);
}

// ═══════════════════════════════════════════════════════════
//  TAB SWITCHING
// ═══════════════════════════════════════════════════════════
function switchTab(tab, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
  btn.classList.add('active');
  // if a secondary tab was picked, keep the drawer open & mark toggle
  const isSecondary = btn.closest('.tabs-secondary');
  const toggleBtn = document.getElementById('more-toggle-btn');
  if (isSecondary) {
    toggleBtn.classList.add('open');
    document.getElementById('tabs-secondary').classList.add('open');
    toggleBtn.textContent = 'Tools ▴';
  }
}

function toggleMore() {
  const drawer = document.getElementById('tabs-secondary');
  const btn    = document.getElementById('more-toggle-btn');
  const open   = drawer.classList.toggle('open');
  btn.classList.toggle('open', open);
  btn.textContent = open ? 'Tools ▴' : 'Tools ▾';
}

// ═══════════════════════════════════════════════════════════
//  ROW FACTORIES
// ═══════════════════════════════════════════════════════════
let spaCount=0, gpaCount=0, impCount=0, histCount=0;

function addCourse(type) {
  const listId = type === 'spa' ? 'spa-courses' : 'gpa-semesters';
  const id = type === 'spa' ? ++spaCount : ++gpaCount;
  const row = document.createElement('div');
  row.className = 'course-row'; row.id = `${type}-row-${id}`;
  const ph1 = type==='spa' ? 'e.g. 5'   : 'e.g. 120';
  const ph2 = type==='spa' ? 'e.g. 3.67': 'e.g. 3.50';
  row.innerHTML = `
    <input type="number" id="${type}-c-${id}" placeholder="${ph1}" min="0" step="0.5" />
    <input type="number" id="${type}-g-${id}" placeholder="${ph2}" min="0" step="0.01" />
    <button class="remove-btn" onclick="removeRow('${type}-row-${id}')">×</button>`;
  document.getElementById(listId).appendChild(row);
  row.querySelector('input').focus();
  hideError(type);
  saveData(type);
}

function addImpactCourse() {
  const id = ++impCount;
  const row = document.createElement('div');
  row.className = 'course-row wide impact-row'; row.id = `imp-row-${id}`;
  row.innerHTML = `
    <input type="text"   id="imp-name-${id}" placeholder="e.g. Math" />
    <input type="number" id="imp-cr-${id}"   placeholder="Credits" min="0" step="0.5" />
    <input type="number" id="imp-gr-${id}"   placeholder="0–4" min="0" max="4" step="0.01" />
    <button class="remove-btn" onclick="removeRow('imp-row-${id}')">×</button>`;
  document.getElementById('impact-courses').appendChild(row);
  row.querySelector('input').focus(); hideError('impact');
}

function addHistRow() {
  const id = ++histCount;
  const row = document.createElement('div');
  row.className = 'course-row wide'; row.id = `hist-row-${id}`;
  const sem = `Semester ${histCount}`;
  row.innerHTML = `
    <input type="text"   id="hist-name-${id}" placeholder="${sem}" />
    <input type="number" id="hist-cr-${id}"   placeholder="Credits" min="0" step="1" />
    <input type="number" id="hist-spa-${id}"  placeholder="0–4" min="0" max="4" step="0.01" />
    <button class="remove-btn" onclick="removeRow('hist-row-${id}')">×</button>`;
  document.getElementById('hist-rows').appendChild(row);
  row.querySelector('input').focus(); hideError('hist');
  saveData('hist');
}

function removeRow(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ═══════════════════════════════════════════════════════════
//  LOCALSTORAGE
// ═══════════════════════════════════════════════════════════
function saveData(type) {
  clearTimeout(saveData._t);
  saveData._t = setTimeout(() => {
    if (type === 'spa') {
      const rows = [...document.querySelectorAll('#spa-courses .course-row')].map(r => {
        const id = r.id.replace('spa-row-','');
        return { c: document.getElementById(`spa-c-${id}`)?.value, g: document.getElementById(`spa-g-${id}`)?.value };
      });
      localStorage.setItem('spa_rows', JSON.stringify(rows));
      flashSaved('spa');
    }
    if (type === 'gpa') {
      const rows = [...document.querySelectorAll('#gpa-semesters .course-row')].map(r => {
        const id = r.id.replace('gpa-row-','');
        return { c: document.getElementById(`gpa-c-${id}`)?.value, g: document.getElementById(`gpa-g-${id}`)?.value };
      });
      localStorage.setItem('gpa_rows', JSON.stringify(rows));
      flashSaved('gpa');
    }
  }, 600);
}

function loadSaved() {
  const spa = JSON.parse(localStorage.getItem('spa_rows') || '[]');
  spa.forEach(d => { addCourse('spa'); const id = spaCount; document.getElementById(`spa-c-${id}`).value=d.c; document.getElementById(`spa-g-${id}`).value=d.g; });
  if (!spa.length) addCourse('spa');

  const gpa = JSON.parse(localStorage.getItem('gpa_rows') || '[]');
  gpa.forEach(d => { addCourse('gpa'); const id = gpaCount; document.getElementById(`gpa-c-${id}`).value=d.c; document.getElementById(`gpa-g-${id}`).value=d.g; });
  if (!gpa.length) addCourse('gpa');

  addImpactCourse();
  addHistRow(); addHistRow();
}

// auto-save on input
document.addEventListener('input', e => {
  if (e.target.closest('#spa-courses'))   saveData('spa');
  if (e.target.closest('#gpa-semesters')) saveData('gpa');
});

// ═══════════════════════════════════════════════════════════
//  SPA
// ═══════════════════════════════════════════════════════════
function calculateSPA() {
  hideError('spa');
  document.getElementById('spa-result').classList.remove('show');
  const rows = document.querySelectorAll('#spa-courses .course-row');
  if (!rows.length) { showError('spa','Add at least one course.'); return; }
  let totalCr=0, weighted=0, tableRows='';
  for (let i=0; i<rows.length; i++) {
    const id = rows[i].id.replace('spa-row-','');
    const cr = parseFloat(document.getElementById(`spa-c-${id}`).value);
    const gr = parseFloat(document.getElementById(`spa-g-${id}`).value);
    if (isNaN(cr)||isNaN(gr)||cr<=0||gr<0||gr>4) { showError('spa',`Row ${i+1}: credits >0, grade 0–4.`); return; }
    totalCr += cr; weighted += cr*gr;
    const [gl,gc] = gradeLabel(gr);
    tableRows += `<tr><td>${i+1}</td><td style="text-align:right">${cr}</td><td style="text-align:right;color:${gc}">${gr.toFixed(2)}</td></tr>`;
  }
  const spa = weighted/totalCr;
  document.getElementById('spa-result').classList.add('show');
  animateValue(document.getElementById('spa-value'), spa);
  setBadge(document.getElementById('spa-badge'), spa);
  document.getElementById('spa-breakdown').innerHTML = `
    <div class="breakdown-title">Breakdown</div>
    <table><thead><tr><th>#</th><th style="text-align:right">Credits</th><th style="text-align:right">Points</th></tr></thead>
    <tbody>${tableRows}</tbody></table>`;
  document.getElementById('spa-result').scrollIntoView({behavior:'smooth',block:'nearest'});
  if (spa >= 3.67) launchConfetti();
}

function resetSPA() {
  document.getElementById('spa-courses').innerHTML='';
  document.getElementById('spa-result').classList.remove('show');
  hideError('spa'); spaCount=0;
  localStorage.removeItem('spa_rows');
  addCourse('spa');
}

// ═══════════════════════════════════════════════════════════
//  GPA
// ═══════════════════════════════════════════════════════════
function calculateGPA() {
  hideError('gpa');
  document.getElementById('gpa-result').classList.remove('show');
  const rows = document.querySelectorAll('#gpa-semesters .course-row');
  if (!rows.length) { showError('gpa','Add at least one semester.'); return; }
  let totalCr=0, weighted=0, tableRows='';
  for (let i=0; i<rows.length; i++) {
    const id = rows[i].id.replace('gpa-row-','');
    const cr  = parseFloat(document.getElementById(`gpa-c-${id}`).value);
    const spa = parseFloat(document.getElementById(`gpa-g-${id}`).value);
    if (isNaN(cr)||isNaN(spa)||cr<=0||spa<0||spa>4) { showError('gpa',`Semester ${i+1}: credits >0, SPA 0–4.`); return; }
    totalCr += cr; weighted += cr*spa;
    const [gl,gc] = gradeLabel(spa);
    tableRows += `<tr><td>Sem ${i+1}</td><td style="text-align:right">${cr}</td><td style="text-align:right;color:${gc}">${spa.toFixed(2)}</td></tr>`;
  }
  const gpa = weighted/totalCr;
  document.getElementById('gpa-result').classList.add('show');
  animateValue(document.getElementById('gpa-value'), gpa);
  setBadge(document.getElementById('gpa-badge'), gpa);
  document.getElementById('gpa-breakdown').innerHTML = `
    <div class="breakdown-title">Breakdown</div>
    <table><thead><tr><th>Semester</th><th style="text-align:right">Credits</th><th style="text-align:right">SPA</th></tr></thead>
    <tbody>${tableRows}</tbody></table>`;
  document.getElementById('gpa-result').scrollIntoView({behavior:'smooth',block:'nearest'});
  if (gpa >= 3.67) launchConfetti();
}

function resetGPA() {
  document.getElementById('gpa-semesters').innerHTML='';
  document.getElementById('gpa-result').classList.remove('show');
  hideError('gpa'); gpaCount=0;
  localStorage.removeItem('gpa_rows');
  addCourse('gpa');
}

// ═══════════════════════════════════════════════════════════
//  IMPACT
// ═══════════════════════════════════════════════════════════
function calculateImpact() {
  hideError('impact');
  document.getElementById('impact-result').classList.remove('show');
  const curGPA = parseFloat(document.getElementById('imp-cur-gpa').value);
  const curCr  = parseFloat(document.getElementById('imp-cur-cr').value);
  if (isNaN(curGPA)||curGPA<0||curGPA>4) { showError('impact','Enter current GPA (0–4).'); return; }
  if (isNaN(curCr)||curCr<0)             { showError('impact','Enter total credits earned.'); return; }
  const rows = document.querySelectorAll('#impact-courses .impact-row');
  if (!rows.length) { showError('impact','Add at least one course.'); return; }
  const courses=[]; const basePoints = curGPA*curCr;
  for (let i=0; i<rows.length; i++) {
    const id   = rows[i].id.replace('imp-row-','');
    const name = document.getElementById(`imp-name-${id}`).value.trim()||`Course ${i+1}`;
    const cr   = parseFloat(document.getElementById(`imp-cr-${id}`).value);
    const gr   = parseFloat(document.getElementById(`imp-gr-${id}`).value);
    if (isNaN(cr)||cr<=0||isNaN(gr)||gr<0||gr>4) { showError('impact',`"${name}": valid credits & grade 0–4.`); return; }
    courses.push({name,cr,gr});
  }
  const newCr = curCr + courses.reduce((s,c)=>s+c.cr,0);
  const proj  = (basePoints + courses.reduce((s,c)=>s+c.cr*c.gr,0)) / newCr;
  const delta = proj - curGPA;
  const sign  = delta>=0?'+':'';
  const dc    = delta>0.005?'#22c55e':delta<-0.005?'#ef4444':'#8892b0';
  const [,pc] = gradeLabel(proj);

  let tRows='';
  courses.forEach(c => {
    const sg = (basePoints+c.cr*c.gr)/(curCr+c.cr);
    const d  = sg-curGPA; const s=d>=0?'+':'';
    const dc2=d>0.005?'#22c55e':d<-0.005?'#ef4444':'#8892b0';
    const [gl] = gradeLabel(c.gr);
    tRows+=`<tr>
      <td>${c.name}</td>
      <td style="text-align:right">${c.cr}</td>
      <td style="text-align:right">${c.gr.toFixed(2)}<br><small style="color:var(--muted);font-weight:400">${gl}</small></td>
      <td style="text-align:right;color:${dc2};font-weight:700">${s}${d.toFixed(3)}</td>
    </tr>`;
  });

  document.getElementById('impact-cur-display').textContent  = curGPA.toFixed(2);
  const projEl = document.getElementById('impact-proj-display');
  projEl.style.color = pc;
  animateValue(projEl, proj);
  document.getElementById('impact-delta-display').textContent = `${sign}${delta.toFixed(3)}`;
  document.getElementById('impact-delta-display').style.color = dc;
  setBadge(document.getElementById('impact-badge'), proj);
  document.getElementById('impact-breakdown').innerHTML = `
    <div class="breakdown-title">Per-course influence</div>
    <table><thead><tr><th>Course</th><th style="text-align:right">Cr</th><th style="text-align:right">Grade</th><th style="text-align:right">GPA shift</th></tr></thead>
    <tbody>${tRows}</tbody></table>
    <p style="font-size:.78rem;color:var(--muted);margin-top:10px">"GPA shift" = effect if only that course were added.</p>`;
  document.getElementById('impact-result').classList.add('show');
  document.getElementById('impact-result').scrollIntoView({behavior:'smooth',block:'nearest'});
  if (proj >= 3.67) launchConfetti();
}

function resetImpact() {
  document.getElementById('imp-cur-gpa').value='';
  document.getElementById('imp-cur-cr').value='';
  document.getElementById('impact-courses').innerHTML='';
  document.getElementById('impact-result').classList.remove('show');
  hideError('impact'); impCount=0; addImpactCourse();
}

// ═══════════════════════════════════════════════════════════
//  TARGET
// ═══════════════════════════════════════════════════════════
function calculateTarget() {
  hideError('target');
  const curGPA   = parseFloat(document.getElementById('tgt-cur-gpa').value);
  const curCr    = parseFloat(document.getElementById('tgt-cur-cr').value);
  const goal     = parseFloat(document.getElementById('tgt-goal').value);
  const nextCr   = parseFloat(document.getElementById('tgt-next-cr').value);

  if ([curGPA,curCr,goal,nextCr].some(isNaN)) {
    document.getElementById('target-result').style.display='none'; return;
  }
  if (curGPA<0||curGPA>4||goal<0||goal>4||curCr<0||nextCr<=0) {
    showError('target','Check your values. GPA must be 0–4, credits must be positive.'); return;
  }

  const neededSPA = (goal*(curCr+nextCr) - curGPA*curCr) / nextCr;
  const totalCr   = curCr+nextCr;
  const projGPA   = (curGPA*curCr + Math.min(Math.max(neededSPA,0),4)*nextCr) / totalCr;

  const spaEl    = document.getElementById('tgt-needed-spa');
  const gpaEl    = document.getElementById('tgt-new-gpa');
  const msgEl    = document.getElementById('tgt-message');
  const resultEl = document.getElementById('target-result');

  resultEl.style.display='block';
  resultEl.classList.add('show');

  if (neededSPA > 4) {
    spaEl.textContent = '> 4.00';
    spaEl.style.color = '#ef4444';
    gpaEl.textContent = '—';
    msgEl.textContent = `Unfortunately, it's mathematically impossible to reach GPA ${goal.toFixed(2)} in one semester with only ${nextCr} credits. You need more credits or a longer timeline.`;
    msgEl.style.color = '#ef4444';
  } else if (neededSPA < 0) {
    spaEl.textContent = '0.00';
    spaEl.style.color = '#22c55e';
    gpaEl.textContent = projGPA.toFixed(2);
    msgEl.textContent = `Great news — you've already exceeded your target! Even with the minimum SPA of 0, your GPA will be above ${goal.toFixed(2)}.`;
    msgEl.style.color = '#22c55e';
  } else {
    const [gl, gc] = gradeLabel(neededSPA);
    spaEl.textContent = neededSPA.toFixed(2);
    spaEl.style.color = gc;
    gpaEl.textContent = goal.toFixed(2);
    gpaEl.style.color = gc;
    msgEl.textContent = `To reach GPA ${goal.toFixed(2)}, you need a semester SPA of ${neededSPA.toFixed(2)} (${gl}) across ${nextCr} credits.`;
    msgEl.style.color = 'var(--muted)';
  }
}

// ═══════════════════════════════════════════════════════════
//  CONVERT
// ═══════════════════════════════════════════════════════════
function updateConvert(val) {
  val = Math.min(100, Math.max(0, +val));
  document.getElementById('conv-slider').value = val;
  document.getElementById('conv-input').value  = val;
  const g = pctToGrade(val);
  const [,color] = gradeLabel(g.pts);
  document.getElementById('conv-pct').textContent    = val + '%';
  document.getElementById('conv-letter').textContent = g.letter;
  document.getElementById('conv-letter').style.color = color;
  document.getElementById('conv-pts').textContent    = g.pts.toFixed(2) + ' points';
  setBadge(document.getElementById('conv-badge'), g.pts);
  document.querySelectorAll('#scale-table tbody tr').forEach(tr => {
    const min=+tr.dataset.min, max=+tr.dataset.max;
    tr.classList.toggle('scale-active', val>=min && val<=max);
  });
}

function syncConvert(val) {
  val = Math.min(100, Math.max(0, +val || 0));
  updateConvert(val);
}

// ═══════════════════════════════════════════════════════════
//  HISTORY / CHART
// ═══════════════════════════════════════════════════════════
function renderHistory() {
  hideError('hist');
  document.getElementById('hist-result').classList.remove('show');
  const rows = document.querySelectorAll('#hist-rows .course-row');
  if (!rows.length) { showError('hist','Add at least one semester.'); return; }

  const sems=[]; let runCr=0, runPts=0;
  for (let i=0; i<rows.length; i++) {
    const id  = rows[i].id.replace('hist-row-','');
    const name = document.getElementById(`hist-name-${id}`).value.trim() || `Sem ${i+1}`;
    const cr   = parseFloat(document.getElementById(`hist-cr-${id}`).value);
    const spa  = parseFloat(document.getElementById(`hist-spa-${id}`).value);
    if (isNaN(cr)||cr<=0||isNaN(spa)||spa<0||spa>4) { showError('hist',`Row ${i+1}: valid credits & SPA 0–4.`); return; }
    runCr += cr; runPts += cr*spa;
    sems.push({name, cr, spa, cumGPA: runPts/runCr});
  }

  const finalGPA = sems[sems.length-1].cumGPA;

  document.getElementById('hist-result').classList.add('show');
  animateValue(document.getElementById('hist-gpa-val'), finalGPA);
  setBadge(document.getElementById('hist-badge'), finalGPA);
  document.getElementById('hist-axis-end').textContent = `Semester ${sems.length}`;

  const chart = document.getElementById('hist-chart');
  chart.innerHTML = '';
  const max = 4;
  sems.forEach(s => {
    const pct = s.cumGPA / max;
    const [,color] = gradeLabel(s.cumGPA);
    const col = document.createElement('div');
    col.className = 'bar-col';
    col.innerHTML = `
      <div class="bar-val">${s.cumGPA.toFixed(2)}</div>
      <div class="bar" style="height:${Math.round(pct*160)}px;background:linear-gradient(to top,${color},${color}88)"></div>
      <div class="bar-lbl">${s.name}</div>`;
    chart.appendChild(col);
  });

  let tRows='';
  sems.forEach(s => {
    const [gl,gc]=gradeLabel(s.spa);
    tRows+=`<tr><td>${s.name}</td><td style="text-align:right">${s.cr}</td><td style="text-align:right;color:${gc}">${s.spa.toFixed(2)}</td><td style="text-align:right;color:${gc}">${s.cumGPA.toFixed(2)}</td></tr>`;
  });
  document.getElementById('hist-breakdown').innerHTML=`
    <div class="breakdown-title" style="margin-top:14px">Semester details</div>
    <table><thead><tr><th>Semester</th><th style="text-align:right">Credits</th><th style="text-align:right">SPA</th><th style="text-align:right">Cumul. GPA</th></tr></thead>
    <tbody>${tRows}</tbody></table>`;

  document.getElementById('hist-result').scrollIntoView({behavior:'smooth',block:'nearest'});
  if (finalGPA >= 3.67) launchConfetti();
}

function resetHistory() {
  document.getElementById('hist-rows').innerHTML='';
  document.getElementById('hist-result').classList.remove('show');
  hideError('hist'); histCount=0;
  addHistRow(); addHistRow();
}

// ═══════════════════════════════════════════════════════════
//  ATTENDANCE
// ═══════════════════════════════════════════════════════════
let attCount = 0;
const ATT_LIMIT = 30;

function addAttRow() {
  const id = ++attCount;
  const row = document.createElement('div');
  row.className = 'att-input-row'; row.id = `att-row-${id}`;
  row.innerHTML = `
    <input type="text"   id="att-name-${id}" placeholder="e.g. UX/UI Design" />
    <input type="number" id="att-hrs-${id}"  placeholder="e.g. 45" min="1" step="1" />
    <input type="number" id="att-pct-${id}"  placeholder="e.g. 18" min="0" max="100" step="0.1" />
    <button class="remove-btn" onclick="removeRow('att-row-${id}')">×</button>`;
  document.getElementById('att-rows').appendChild(row);
  row.querySelector('input').focus();
  hideError('attendance');
}

function calcAttendance() {
  hideError('attendance');
  document.getElementById('att-result').classList.remove('show');
  const rows = document.querySelectorAll('#att-rows .att-input-row');
  if (!rows.length) { showError('attendance', 'Add at least one course.'); return; }

  const cards = document.getElementById('att-cards');
  cards.innerHTML = '';

  for (let i = 0; i < rows.length; i++) {
    const id         = rows[i].id.replace('att-row-', '');
    const name       = document.getElementById(`att-name-${id}`).value.trim() || `Course ${i+1}`;
    const totalHours = parseFloat(document.getElementById(`att-hrs-${id}`).value);
    const absPct     = parseFloat(document.getElementById(`att-pct-${id}`).value);

    if (isNaN(totalHours) || totalHours <= 0) { showError('attendance', `"${name}": enter total hours (e.g. 45).`); return; }
    if (isNaN(absPct) || absPct < 0 || absPct > 100) { showError('attendance', `"${name}": absence % must be 0–100.`); return; }

    const exceeded = absPct > ATT_LIMIT;
    const warning  = !exceeded && absPct >= ATT_LIMIT - 7;
    const color    = exceeded ? '#ef4444' : warning ? '#f97316' : absPct >= 10 ? '#eab308' : '#22c55e';

    const missedHours = Math.round(absPct / 100 * totalHours);
    const limitHours  = totalHours * ATT_LIMIT / 100;
    const hoursLeft   = Math.max(0, Math.floor(limitHours - missedHours));
    const pctPerHour  = (1 / totalHours * 100).toFixed(2);
    const pctLeft     = Math.max(0, ATT_LIMIT - absPct).toFixed(1);
    const barPct = Math.min(100, (absPct / ATT_LIMIT) * 100);

    const card = document.createElement('div');
    card.className = 'att-course-card';
    card.innerHTML = `
      <div class="att-course-header">
        <span class="att-course-name">${name}</span>
        <span class="att-pct-badge" style="background:${color}22;color:${color};border:1px solid ${color}55">
          ${absPct.toFixed(1)}%
        </span>
      </div>
      <div style="position:relative;margin:10px 0 4px">
        <div class="att-bar-track">
          <div class="att-bar-fill" style="width:${barPct}%;background:${color}"></div>
        </div>
        <div style="position:absolute;right:0;top:-14px;font-size:.68rem;color:#ef4444">30% limit</div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--muted);margin-bottom:10px">
        <span>0%</span><span style="color:${color};font-weight:600">${absPct.toFixed(1)}% now</span><span>30%</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
        <div style="background:var(--surface);border-radius:8px;padding:9px;text-align:center">
          <div style="font-size:1.15rem;font-weight:800;color:${color}">${absPct.toFixed(1)}%</div>
          <div style="font-size:.68rem;color:var(--muted)">Current absence</div>
        </div>
        <div style="background:var(--surface);border-radius:8px;padding:9px;text-align:center">
          <div style="font-size:1.15rem;font-weight:800;color:var(--accent2)">${pctLeft}%</div>
          <div style="font-size:.68rem;color:var(--muted)">Room left</div>
        </div>
        <div style="background:var(--surface);border-radius:8px;padding:9px;text-align:center">
          <div style="font-size:1.15rem;font-weight:800;color:var(--text)">${totalHours}h</div>
          <div style="font-size:.68rem;color:var(--muted)">Total hours</div>
        </div>
      </div>
      <div style="padding:10px 14px;border-radius:8px;background:${color}11;border:1px solid ${color}33;font-size:.85rem;color:${color};font-weight:700;line-height:1.5">
        ${exceeded
          ? `⛔ Exceeded! You are ${(absPct - ATT_LIMIT).toFixed(1)}% over the limit.`
          : hoursLeft === 0
            ? `⚠️ Zero hours left — any absence will exceed 30%.`
            : `You can miss <span style="font-size:1.1rem">${hoursLeft}</span> more hour${hoursLeft === 1 ? '' : 's'} before hitting 30%`
        }
      </div>
      <div style="font-size:.72rem;color:var(--muted);margin-top:6px;text-align:right">
        1 missed hour = ${pctPerHour}% · missed ≈ ${missedHours}h of ${totalHours}h
      </div>`;
    cards.appendChild(card);
  }

  document.getElementById('att-result').classList.add('show');
  document.getElementById('att-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function resetAttendance() {
  document.getElementById('att-rows').innerHTML = '';
  document.getElementById('att-result').classList.remove('show');
  hideError('attendance'); attCount = 0; addAttRow();
}

// ═══════════════════════════════════════════════════════════
//  POMODORO
// ═══════════════════════════════════════════════════════════
const POMO_MODES = { work:25*60, short:5*60, long:15*60 };
const POMO_LABELS = { work:'Focus time', short:'Short break', long:'Long break' };
const RING_CIRC = 2 * Math.PI * 96;
let pomoMode = 'work', pomoTotal = POMO_MODES.work;
let pomoLeft = pomoTotal, pomoRunning = false, pomoTimer = null;
let pomoSessions = 0, pomoTotalMin = 0;
const pomoLog = JSON.parse(localStorage.getItem('pomo_log') || '[]');

function setPomoMode(mode, btn) {
  if (pomoRunning) return;
  pomoMode  = mode;
  pomoTotal = POMO_MODES[mode];
  pomoLeft  = pomoTotal;
  document.querySelectorAll('.pomo-mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const colors = { work:'#6c63ff', short:'#22c55e', long:'#38bdf8' };
  document.getElementById('pomo-ring').style.stroke = colors[mode];
  updatePomoDisplay();
}

function togglePomo() {
  if (pomoRunning) {
    clearInterval(pomoTimer); pomoRunning = false;
    document.getElementById('pomo-start-btn').textContent = 'Resume';
  } else {
    pomoRunning = true;
    document.getElementById('pomo-start-btn').textContent = 'Pause';
    pomoTimer = setInterval(() => {
      pomoLeft--;
      updatePomoDisplay();
      if (pomoLeft <= 0) {
        clearInterval(pomoTimer); pomoRunning = false;
        document.getElementById('pomo-start-btn').textContent = 'Start';
        onPomoComplete();
      }
    }, 1000);
  }
}

function onPomoComplete() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 200, 400].forEach(delay => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(.3, ctx.currentTime + delay/1000);
      gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + delay/1000 + .3);
      osc.start(ctx.currentTime + delay/1000);
      osc.stop(ctx.currentTime + delay/1000 + .3);
    });
  } catch(e) {}

  if (pomoMode === 'work') {
    pomoSessions++;
    pomoTotalMin += 25;
    document.getElementById('pomo-sessions').textContent  = pomoSessions;
    document.getElementById('pomo-total-min').textContent = pomoTotalMin;
    const note = document.getElementById('pomo-note').value.trim();
    const now  = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    const entry = { time: now, note: note || 'Focused session', min: 25 };
    pomoLog.unshift(entry);
    localStorage.setItem('pomo_log', JSON.stringify(pomoLog.slice(0,30)));
    renderPomoLog();
    launchConfetti();
  }

  pomoLeft = pomoTotal;
  updatePomoDisplay();
}

function resetPomo() {
  clearInterval(pomoTimer); pomoRunning = false;
  pomoLeft = pomoTotal;
  document.getElementById('pomo-start-btn').textContent = 'Start';
  updatePomoDisplay();
}

function updatePomoDisplay() {
  const m = Math.floor(pomoLeft / 60).toString().padStart(2,'0');
  const s = (pomoLeft % 60).toString().padStart(2,'0');
  document.getElementById('pomo-time').textContent  = `${m}:${s}`;
  document.getElementById('pomo-label').textContent = POMO_LABELS[pomoMode];
  const pct    = pomoLeft / pomoTotal;
  const offset = RING_CIRC * pct;
  document.getElementById('pomo-ring').style.strokeDashoffset = RING_CIRC - offset;
  document.title = pomoRunning ? `${m}:${s} — UniKit` : 'UniKit';
}

function renderPomoLog() {
  const el = document.getElementById('pomo-log');
  if (!pomoLog.length) { el.innerHTML='<p style="color:var(--muted);font-size:.85rem">No sessions yet.</p>'; return; }
  el.innerHTML = pomoLog.map(e => `
    <div class="pomo-log-item">
      <span>🍅 ${e.note}</span>
      <span class="pomo-log-time">${e.time} · ${e.min}m</span>
    </div>`).join('');
}

function clearPomoLog() {
  pomoLog.length = 0;
  localStorage.removeItem('pomo_log');
  renderPomoLog();
}

// ═══════════════════════════════════════════════════════════
//  PROFILE CARD
// ═══════════════════════════════════════════════════════════
function renderCard() {
  const name     = document.getElementById('prof-name').value.trim()     || 'Your Name';
  const uni      = document.getElementById('prof-uni').value.trim()      || 'University';
  const major    = document.getElementById('prof-major').value.trim()    || 'Major';
  const gpa      = parseFloat(document.getElementById('prof-gpa').value);
  const sem      = document.getElementById('prof-sem').value.trim()      || '—';
  const cr       = parseFloat(document.getElementById('prof-cr').value)      || 0;
  const totalCr  = parseFloat(document.getElementById('prof-total-cr').value)|| 240;

  const initials = name.split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase() || '?';
  document.getElementById('pc-avatar').textContent = initials;
  document.getElementById('pc-name').textContent   = name;
  document.getElementById('pc-uni').textContent    = uni;
  document.getElementById('pc-major').textContent  = major;
  document.getElementById('pc-sem').textContent    = sem;

  if (!isNaN(gpa)) {
    const [gl, gc] = gradeLabel(gpa);
    document.getElementById('pc-gpa').textContent   = gpa.toFixed(2);
    document.getElementById('pc-gpa').style.color   = gc;
    const badges = [];
    if (gpa >= 3.67) badges.push(['Dean\'s List',     '#22c55e']);
    if (gpa >= 3.00) badges.push(['Good Standing',    '#84cc16']);
    if (gpa >= 3.50) badges.push(['Honor Roll',       '#a78bfa']);
    if (gpa <  2.00) badges.push(['Academic Warning', '#ef4444']);
    document.getElementById('pc-badge-row').innerHTML = badges.map(([l,c]) =>
      `<span class="pc-badge" style="background:${c}22;color:${c};border:1px solid ${c}55">${l}</span>`
    ).join('');
  } else {
    document.getElementById('pc-gpa').textContent = '—';
    document.getElementById('pc-badge-row').innerHTML = '';
  }

  const pct = Math.min(100, Math.round((cr / totalCr) * 100)) || 0;
  document.getElementById('pc-cr-pct').textContent          = `${cr}/${totalCr}`;
  document.getElementById('pc-bar-fill').style.width        = pct + '%';
  document.getElementById('pc-bar-label').textContent       = `${pct}% progress to graduation`;
}

function downloadCard() {
  const card = document.getElementById('profile-card');
  html2canvas(card, { backgroundColor: null, scale: 2 }).then(canvas => {
    const link = document.createElement('a');
    link.download = 'academic-profile.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}

// ═══════════════════════════════════════════════════════════
//  MYSDU IMPORT
// ═══════════════════════════════════════════════════════════

let _mysduData = null;   // cached last fetch result

async function importMySdu() {
  const user = document.getElementById('mysdu-user').value.trim();
  const pass = document.getElementById('mysdu-pass').value.trim();
  const errEl = document.getElementById('mysdu-error');
  const btn   = document.getElementById('mysdu-btn');

  errEl.classList.remove('show');
  if (!user || !pass) {
    errEl.textContent = 'Please enter username and password.';
    errEl.classList.add('show');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Fetching…';

  try {
    const resp = await fetch('http://127.0.0.1:5001/api/mysdu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass }),
    });

    const data = await resp.json();

    if (!resp.ok || !data.ok) {
      errEl.textContent = data.error || 'Request failed — is the backend running?';
      errEl.classList.add('show');
      return;
    }

    _mysduData = data;
    renderMySduSummary(data);
    document.getElementById('mysdu-result').style.display = 'block';

  } catch (e) {
    errEl.textContent = 'Cannot reach backend. Make sure server.py is running on port 5001.';
    errEl.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Fetch from MySdu';
  }
}

function renderMySduSummary(data) {
  const el = document.getElementById('mysdu-summary');
  const { transcript = [], attendance = [] } = data;

  let html = '';

  if (transcript.length) {
    html += `<div style="font-weight:700;font-size:.9rem;color:var(--accent2);margin-bottom:4px">📚 Transcript — ${transcript.length} semester(s)</div>`;
    transcript.forEach((sem, i) => {
      const spa = sem.spa != null ? sem.spa.toFixed(2) : '?';
      const gpa = sem.gpa != null ? sem.gpa.toFixed(2) : '?';
      const courses = sem.courses ? sem.courses.length : 0;
      html += `<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-sm);padding:10px 14px;font-size:.83rem">
        <span style="font-weight:600">${sem.semester || 'Semester ' + (i+1)}</span>
        <span style="float:right;color:var(--muted)">${courses} courses</span>
        <div style="margin-top:4px;color:var(--muted)">SPA: <strong style="color:var(--accent2)">${spa}</strong> &nbsp; GPA: <strong style="color:var(--accent2)">${gpa}</strong> &nbsp; Credits: <strong>${sem.sa ?? '?'}</strong></div>
      </div>`;
    });
  } else {
    html += `<div style="color:var(--muted);font-size:.85rem">No transcript data found.</div>`;
  }

  if (attendance.length) {
    html += `<div style="font-weight:700;font-size:.9rem;color:var(--accent2);margin:10px 0 4px">📋 Attendance — ${attendance.length} course(s)</div>`;
    attendance.forEach(c => {
      const danger = c.absence_pct >= 25;
      const color  = c.absence_pct >= 30 ? '#ef4444' : c.absence_pct >= 25 ? '#f97316' : '#22c55e';
      html += `<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-sm);padding:10px 14px;font-size:.83rem">
        <span style="font-weight:600">${c.course}</span>
        <span style="float:right;color:${color};font-weight:700">${c.absence_pct.toFixed(1)}% absent</span>
      </div>`;
    });
  }

  el.innerHTML = html;
}

function applyMySduToGPA() {
  if (!_mysduData || !_mysduData.transcript) return;
  const sems = _mysduData.transcript.filter(s => s.sa && s.spa != null);
  if (!sems.length) return;

  // Clear history rows and add imported ones
  const histContainer = document.getElementById('hist-rows');
  histContainer.innerHTML = '';
  sems.forEach(s => {
    addHistRow();
    const rows = histContainer.querySelectorAll('.course-row');
    const last = rows[rows.length - 1];
    if (!last) return;
    const inputs = last.querySelectorAll('input');
    if (inputs[0]) inputs[0].value = s.semester || '';
    if (inputs[1]) inputs[1].value = s.sa ?? '';
    if (inputs[2]) inputs[2].value = s.spa != null ? s.spa.toFixed(2) : '';
  });

  saveData('hist');
  const histBtn = [...document.querySelectorAll('.tab-btn')].find(b => b.textContent.includes('History'));
  if (histBtn) switchTab('history', histBtn);
  setTimeout(() => renderHistory(), 100);
}

function applyMySduToAttendance() {
  if (!_mysduData || !_mysduData.attendance) return;
  const courses = _mysduData.attendance;
  if (!courses.length) return;

  const attContainer = document.getElementById('att-rows');
  attContainer.innerHTML = '';
  courses.forEach(c => {
    addAttRow();
    const rows = attContainer.querySelectorAll('.course-row');
    const last = rows[rows.length - 1];
    if (!last) return;
    const inputs = last.querySelectorAll('input');
    if (inputs[0]) inputs[0].value = c.course;
    if (inputs[1]) inputs[1].value = c.total_hours ?? '';
    if (inputs[2]) inputs[2].value = c.absence_pct != null ? c.absence_pct.toFixed(1) : '';
  });

  const attBtn = [...document.querySelectorAll('.tab-btn')].find(b => b.textContent.includes('Attendance'));
  if (attBtn) switchTab('attendance', attBtn);
  setTimeout(() => calcAttendance(), 100);
}

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════
loadSaved();
updateConvert(85);
addAttRow();
renderPomoLog();
updatePomoDisplay();
renderCard();
