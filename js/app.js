/**
 * app.js
 * Controlador per a la nova interfície estil full de càlcul (spreadsheet).
 * Gestiona inputs directes a taula, comprovació d'estat i renderitzat del diagrama.
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

  // Llista d'inputs editables
  const editableInputs = [inTv, inPhiV, inTR, inPhiR, inPhiI, inQsi, inQli, inQv, inInfil];

  // Format de números amb coma decimal
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

  // Escoltar canvis als inputs per actualitzar l'estat
  editableInputs.forEach(input => {
    if (input) {
      input.addEventListener('input', checkDataStatus);
    }
  });

  /**
   * Obté el paquet d'entrades per al Solver
   */
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

  /**
   * Executa la resolució i omple totes les cel·les i el gràfic
   */
  function solveSystem() {
    if (!checkDataStatus()) {
      alert('Si us plau, omple totes les dades de partida necessàries abans de solucionar.');
      return;
    }

    try {
      const inputs = getInputs();
      const sol = ClimaSolver.solve(inputs);
      const pts = sol.points;
      const pow = sol.powers;

      // 1. Taula Psicromètrica
      // Ventilació
      setCell('out-v-w', fmt(pts.V.w_g_kg, 1));
      setCell('out-v-v', fmt(pts.V.v, 3));
      setCell('out-v-h', fmt(pts.V.h, 2));
      setCell('out-v-tr', fmt(pts.V.tr, 1));
      setCell('out-v-th', fmt(pts.V.th, 1));

      // Retorn
      setCell('out-r-w', fmt(pts.R.w_g_kg, 1));
      setCell('out-r-v', fmt(pts.R.v, 3));
      setCell('out-r-h', fmt(pts.R.h, 2));
      setCell('out-r-tr', fmt(pts.R.tr, 1));
      setCell('out-r-th', fmt(pts.R.th, 1));

      // Mescla
      setCell('out-m-t', fmt(pts.M.t, 1));
      setCell('out-m-phi', `${fmt(pts.M.phi, 1)}%`);
      setCell('out-m-w', fmt(pts.M.w_g_kg, 1));
      setCell('out-m-v', fmt(pts.M.v, 3));
      setCell('out-m-h', fmt(pts.M.h, 2));
      setCell('out-m-tr', fmt(pts.M.tr, 1));
      setCell('out-m-th', fmt(pts.M.th, 1));

      // Impulsió
      setCell('out-i-t', fmt(pts.I.t, 1));
      setCell('out-i-w', fmt(pts.I.w_g_kg, 1));
      setCell('out-i-v', fmt(pts.I.v, 3));
      setCell('out-i-h', fmt(pts.I.h, 2));
      setCell('out-i-tr', fmt(pts.I.tr, 1));
      setCell('out-i-th', fmt(pts.I.th, 1));

      // Superfície
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

      // Indicadors ràpids sota el diagrama
      setCell('kpi-quick-qbat', `${fmt(pow.q_bateria, 2)} kW`);
      setCell('kpi-quick-fbp', fmt(pow.FBP, 3));
      setCell('kpi-quick-mcond', `${fmt(pow.M_cond_h, 1)} kg/h`);
      setCell('kpi-quick-qi', `${fmt(pts.I.Q, 0)} m³/h`);

      // Dibuixar diagrama psicromètric amb la solució
      PsychroChart.render(sol);
    } catch (err) {
      console.error('Error calculant:', err);
      alert('Error en els càlculs termodinàmics. Comprova que els valors introduïts siguin viables.');
    }
  }

  btnSolve.addEventListener('click', solveSystem);

  /**
   * Carrega l'exemple de classe oficial
   */
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

  /**
   * Neteja totes les cel·les i deixa la taula buida
   */
  function clearAll() {
    editableInputs.forEach(input => {
      if (input) input.value = '';
    });
    inPhiI.value = '90'; // valor habitual per defecte

    // Buidar cel·les de sortida
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

    checkDataStatus();
    // Renderitza la carta base buida
    PsychroChart.render(null);
  }

  btnClear.addEventListener('click', clearAll);

  // Inicialització: Carregar l'exemple per defecte
  loadExample();
});
