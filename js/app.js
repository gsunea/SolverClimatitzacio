/**
 * app.js
 * Controlador per a la interfície tipus full de càlcul (spreadsheet),
 * pantalla completa i resolució pas a pas (debugger) amb LaTeX.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Inputs de la taula
  const inTv = document.getElementById('in-tv');
  const inPhiV = document.getElementById('in-phiv');
  const inTR = document.getElementById('in-tr');
  const inPhiR = document.getElementById('in-phir');
  const inPhiI = document.getElementById('in-phi-i');
  const inQsi = document.getElementById('in-qsi');
  const inQli = document.getElementById('in-qli');
  const inQv = document.getElementById('in-qv');
  const inInfil = document.getElementById('in-infil');

  // Botons i barra d'estat
  const btnSolve = document.getElementById('btn-solve');
  const btnExample = document.getElementById('btn-example');
  const btnClear = document.getElementById('btn-clear');
  const statusPill = document.getElementById('status-pill');
  const statusText = document.getElementById('status-text');

  // Tabs de navegació
  const tabTable = document.getElementById('tab-table');
  const tabDebugger = document.getElementById('tab-debugger');
  const viewMain = document.getElementById('view-main');
  const viewDebugger = document.getElementById('view-debugger');

  // Pantalla completa
  const btnFullscreenChart = document.getElementById('btn-fullscreen-chart');
  const btnFullscreenDebugChart = document.getElementById('btn-fullscreen-debug-chart');
  const modalFullscreen = document.getElementById('modal-fullscreen');
  const btnCloseFullscreen = document.getElementById('btn-close-fullscreen');

  const editableInputs = [inTv, inPhiV, inTR, inPhiR, inPhiI, inQsi, inQli, inQv, inInfil];
  let lastSolution = null;

  // Inicialitzar mòdul Debugger
  StepDebugger.init();

  function fmt(val, decimals = 1) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return Number(val).toFixed(decimals).replace('.', ',');
  }

  function setCell(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  /**
   * Comprova si les dades d'entrada mínimes necessàries estan presents
   */
  function checkDataStatus() {
    const hasTv = inTv.value.trim() !== '';
    const hasPhiV = inPhiV.value.trim() !== '';
    const hasTR = inTR.value.trim() !== '';
    const hasPhiR = inPhiR.value.trim() !== '';
    const hasQsi = inQsi.value.trim() !== '';
    const hasQli = inQli.value.trim() !== '';
    const hasQv = inQv.value.trim() !== '';

    const isReady = hasTv && hasPhiV && hasTR && hasPhiR && hasQsi && hasQli && hasQv;

    if (isReady) {
      statusPill.className = 'status-badge ready';
      statusText.textContent = 'Dades suficients per calcular';
      btnSolve.style.opacity = '1';
    } else {
      statusPill.className = 'status-badge missing';
      statusText.textContent = 'Falten dades de partida';
      btnSolve.style.opacity = '0.85';
    }

    return isReady;
  }

  editableInputs.forEach(input => {
    if (input) {
      input.addEventListener('input', checkDataStatus);
    }
  });

  function getInputs() {
    return {
      Tv: parseFloat(inTv.value),
      phi_v: parseFloat(inPhiV.value),
      TR: parseFloat(inTR.value),
      phi_R: parseFloat(inPhiR.value),
      phi_I: inPhiI.value.trim() !== '' ? parseFloat(inPhiI.value) : 90.0,
      q_si: parseFloat(inQsi.value),
      q_li: parseFloat(inQli.value),
      Q_v: parseFloat(inQv.value),
      fr_infiltr: (parseFloat(inInfil.value) || 0) / 100.0,
      altitude: 0
    };
  }

  function solveSystem() {
    if (!checkDataStatus()) {
      alert('Si us plau, omple totes les dades de partida necessàries abans de solucionar.');
      return;
    }

    try {
      const inputs = getInputs();
      const sol = ClimaSolver.solve(inputs);
      lastSolution = sol;

      const pts = sol.points;
      const pow = sol.powers;

      // 1. Taula Psicromètrica
      setCell('out-v-w', fmt(pts.V.w_g_kg, 1));
      setCell('out-v-v', fmt(pts.V.v, 3));
      setCell('out-v-h', fmt(pts.V.h, 2));
      setCell('out-v-tr', fmt(pts.V.tr, 1));
      setCell('out-v-th', fmt(pts.V.th, 1));

      setCell('out-r-w', fmt(pts.R.w_g_kg, 1));
      setCell('out-r-v', fmt(pts.R.v, 3));
      setCell('out-r-h', fmt(pts.R.h, 2));
      setCell('out-r-tr', fmt(pts.R.tr, 1));
      setCell('out-r-th', fmt(pts.R.th, 1));

      setCell('out-m-t', fmt(pts.M.t, 1));
      setCell('out-m-phi', `${fmt(pts.M.phi, 1)}%`);
      setCell('out-m-w', fmt(pts.M.w_g_kg, 1));
      setCell('out-m-v', fmt(pts.M.v, 3));
      setCell('out-m-h', fmt(pts.M.h, 2));
      setCell('out-m-tr', fmt(pts.M.tr, 1));
      setCell('out-m-th', fmt(pts.M.th, 1));

      setCell('out-i-t', fmt(pts.I.t, 1));
      setCell('out-i-w', fmt(pts.I.w_g_kg, 1));
      setCell('out-i-v', fmt(pts.I.v, 3));
      setCell('out-i-h', fmt(pts.I.h, 2));
      setCell('out-i-tr', fmt(pts.I.tr, 1));
      setCell('out-i-th', fmt(pts.I.th, 1));

      setCell('out-s-t', fmt(pts.S.t, 1));
      setCell('out-s-w', fmt(pts.S.w_g_kg, 1));
      setCell('out-s-v', fmt(pts.S.v, 3));
      setCell('out-s-h', fmt(pts.S.h, 2));
      setCell('out-s-tr', fmt(pts.S.tr, 1));
      setCell('out-s-th', fmt(pts.S.th, 1));

      // 2. Taula de Potències
      setCell('out-fbp', fmt(pow.FBP, 4));
      setCell('out-qsv', fmt(pow.q_sv, 2));
      setCell('out-qlv', fmt(pow.q_lv, 2));
      setCell('out-qtot', fmt(pow.q_total, 2));
      setCell('out-fcstot', fmt(pow.FCS_total, 4));
      setCell('out-fcsi', fmt(pow.FCS_i, 4));

      // 3. Taula de Cabals i Condensats
      setCell('out-qi', fmt(pts.I.Q, 1));
      setCell('out-qr', fmt(pts.R.Q, 1));
      setCell('out-qm', fmt(pts.M.Q, 1));
      setCell('out-mcond', fmt(pow.M_cond_h, 2));

      // Indicadors ràpids
      setCell('kpi-quick-qbat', `${fmt(pow.q_bateria, 2)} kW`);
      setCell('kpi-quick-fbp', fmt(pow.FBP, 3));
      setCell('kpi-quick-mcond', `${fmt(pow.M_cond_h, 1)} kg/h`);
      setCell('kpi-quick-qi', `${fmt(pts.I.Q, 0)} m³/h`);

      // Dibuixar diagrama psicromètric complet
      PsychroChart.render(sol, 7, 'psychro-container');

      // Actualitzar el debugger amb la nova solució
      StepDebugger.setSolution(sol);
    } catch (err) {
      console.error('Error calculant:', err);
      alert('Error en els càlculs termodinàmics. Comprova que els valors introduïts siguin coherents.');
    }
  }

  btnSolve.addEventListener('click', solveSystem);

  function loadExample() {
    inTv.value = 31.0;
    inPhiV.value = 70.0;
    inTR.value = 24.0;
    inPhiR.value = 50.0;
    inPhiI.value = 90.0;
    inQsi.value = 20.0;
    inQli.value = 3.0;
    inQv.value = 1000.0;
    inInfil.value = 0;

    checkDataStatus();
    solveSystem();
  }

  btnExample.addEventListener('click', loadExample);

  function clearAll() {
    editableInputs.forEach(input => {
      if (input) input.value = '';
    });
    inPhiI.value = '90';

    const outputIds = [
      'out-v-w', 'out-v-v', 'out-v-h', 'out-v-tr', 'out-v-th',
      'out-r-w', 'out-r-v', 'out-r-h', 'out-r-tr', 'out-r-th',
      'out-m-t', 'out-m-phi', 'out-m-w', 'out-m-v', 'out-m-h', 'out-m-tr', 'out-m-th',
      'out-i-t', 'out-i-w', 'out-i-v', 'out-i-h', 'out-i-tr', 'out-i-th',
      'out-s-t', 'out-s-w', 'out-s-v', 'out-s-h', 'out-s-tr', 'out-s-th',
      'out-fbp', 'out-qsv', 'out-qlv', 'out-qtot', 'out-fcstot', 'out-fcsi',
      'out-qi', 'out-qr', 'out-qm', 'out-mcond',
      'kpi-quick-qbat', 'kpi-quick-fbp', 'kpi-quick-mcond', 'kpi-quick-qi'
    ];

    outputIds.forEach(id => setCell(id, '—'));
    lastSolution = null;

    checkDataStatus();
    PsychroChart.render(null, 7, 'psychro-container');
    PsychroChart.render(null, 1, 'debug-psychro-container');
  }

  btnClear.addEventListener('click', clearAll);

  // Gestió de Pestanyes (Taula vs Debugger)
  function switchTab(target) {
    if (target === 'table') {
      tabTable.classList.add('active');
      tabDebugger.classList.remove('active');
      viewMain.style.display = 'grid';
      viewDebugger.style.display = 'none';
      if (lastSolution) {
        PsychroChart.render(lastSolution, 7, 'psychro-container');
      }
    } else {
      tabDebugger.classList.add('active');
      tabTable.classList.remove('active');
      viewMain.style.display = 'none';
      viewDebugger.style.display = 'flex';
      if (!lastSolution && checkDataStatus()) {
        solveSystem();
      }
      if (lastSolution) {
        StepDebugger.setSolution(lastSolution);
      }
    }
  }

  tabTable.addEventListener('click', () => switchTab('table'));
  tabDebugger.addEventListener('click', () => switchTab('debugger'));

  // Gestió de Pantalla Completa
  function openFullscreenChart() {
    if (!modalFullscreen) return;
    modalFullscreen.style.display = 'flex';
    PsychroChart.render(lastSolution, 7, 'fullscreen-chart-container');
  }

  function closeFullscreenChart() {
    if (!modalFullscreen) return;
    modalFullscreen.style.display = 'none';
  }

  if (btnFullscreenChart) btnFullscreenChart.addEventListener('click', openFullscreenChart);
  if (btnFullscreenDebugChart) btnFullscreenDebugChart.addEventListener('click', openFullscreenChart);
  if (btnCloseFullscreen) btnCloseFullscreen.addEventListener('click', closeFullscreenChart);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalFullscreen.style.display !== 'none') {
      closeFullscreenChart();
    }
  });

  // Inicialització amb l'exemple per defecte
  loadExample();
});
