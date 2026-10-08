/**
 * app.js
 * Controlador per a la interfície tipus full de càlcul (spreadsheet),
 * resolució psicromètrica flexible amb 2 propietats lliures per punt,
 * pantalla completa i resolució pas a pas (debugger) amb LaTeX.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Constants de propietats psicromètriques
  const PROPS = ['t', 'phi', 'w', 'v', 'h', 'tr', 'th'];

  const PROP_NAMES = {
    t: 'T seca',
    phi: 'H rel',
    w: 'H abs',
    v: 'V esp',
    h: 'Entalpia',
    tr: 'T rocío',
    th: 'T humida'
  };

  // Símbols curts per als distintius (el nom complet va al tooltip)
  const PROP_SYMBOLS = { t: 'T', phi: 'φ', w: 'w', v: 'v', h: 'h', tr: 'Tr', th: 'Th' };

  // Estat del model
  const pointState = {
    v: {
      activeProps: ['t', 'phi'],
      userValues: { t: 31.0, phi: 70.0 },
      solved: null,
      error: null
    },
    r: {
      activeProps: ['t', 'phi'],
      userValues: { t: 24.0, phi: 50.0 },
      solved: null,
      error: null
    },
    i: {
      activeProp: 'phi', // 'phi', 't', 'w' o 'qi'
      userValue: 90.0,
      lastPhi: 90.0 // últim φ_I introduït (per tornar al mode φ_I)
    },
    s: {
      manualTs: null
    },
    powers: {
      q_si: 20.0,
      q_li: 3.0,
      fcs_i: null,
      lastEdited: 'qli' // 'qli' o 'fcsi'
    },
    flows: {
      q_v: 1000.0,
      manualQi: null
    },
    fr_infiltr: 0.0
  };

  let lastSolution = null;

  // Botons i barra d'estat
  const btnExample = document.getElementById('btn-example');
  const btnClear = document.getElementById('btn-clear');
  const statusPill = document.getElementById('status-pill');
  const statusText = document.getElementById('status-text');

  // Inputs de potències i cabals
  const inQsi = document.getElementById('in-qsi');
  const inQli = document.getElementById('in-qli');
  const inFcsi = document.getElementById('in-fcsi');
  const inQv = document.getElementById('in-qv');
  const inQi = document.getElementById('in-qi');
  const inInfil = document.getElementById('in-infil');

  // Inputs d'impulsió i superfície
  const cellIT = document.getElementById('cell-i-t');
  const cellIPhi = document.getElementById('cell-i-phi');
  const cellIW = document.getElementById('cell-i-w');
  const cellST = document.getElementById('cell-s-t');

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

  // Inicialitzar Step Debugger
  StepDebugger.init();

  // Utilitats de format i parseig
  function parseNum(val) {
    if (val === null || val === undefined) return null;
    const s = String(val).replace('%', '').replace(',', '.').trim();
    if (s === '') return null;
    const num = parseFloat(s);
    return isNaN(num) ? null : num;
  }

  function fmt(val, decimals = 1) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return Number(val).toFixed(decimals).replace('.', ',');
  }

  function setCell(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function formatProp(pt, prop) {
    if (!pt) return '';
    switch (prop) {
      case 't': return fmt(pt.t, 1);
      case 'phi': return `${fmt(pt.phi, 1)}%`;
      case 'w': return fmt(pt.w_g_kg, 1);
      case 'v': return fmt(pt.v, 3);
      case 'h': return fmt(pt.h, 2);
      case 'tr': return fmt(pt.tr, 1);
      case 'th': return fmt(pt.th, 1);
      default: return '';
    }
  }

  /**
   * Actualitza el distintiu (badge) de propietats d'un estat
   */
  function updatePointBadge(ptKey) {
    const state = pointState[ptKey];
    const badge = document.getElementById(`badge-${ptKey}-props`);
    if (!badge) return;

    if (state.error) {
      badge.className = 'prop-counter-pill incomplete';
      badge.textContent = '⚠ error';
      badge.title = state.error;
    } else if (state.activeProps.length === 2 && state.solved) {
      badge.className = 'prop-counter-pill ready';
      const labels = state.activeProps.map(p => PROP_NAMES[p]).join(' + ');
      badge.textContent = `✓ ${state.activeProps.map(p => PROP_SYMBOLS[p]).join('·')}`;
      badge.title = `Estat definit per: ${labels}`;
    } else if (state.activeProps.length === 1) {
      badge.className = 'prop-counter-pill incomplete';
      badge.textContent = '1/2';
      badge.title = `Falta 1 propietat per definir aquest estat`;
    } else {
      badge.className = 'prop-counter-pill empty';
      badge.textContent = '0/2';
      badge.title = `Introdueix 2 propietats qualssevol`;
    }
  }

  /**
   * Resol el punt psicromètric d'una fila si hi ha 2 propietats i actualitza la fila
   */
  function updatePointRowUI(ptKey, keepFocus = false) {
    const state = pointState[ptKey];
    state.error = null;

    if (state.activeProps.length >= 2) {
      try {
        const solveInputs = {};
        state.activeProps.forEach(p => {
          if (p === 'w') solveInputs.w_g_kg = state.userValues[p];
          else solveInputs[p] = state.userValues[p];
        });

        const solved = ClimaSolver.solvePointFromProperties(solveInputs);
        state.solved = solved;

        // Actualitzar totes les cel·les de la fila
        PROPS.forEach(p => {
          const input = document.getElementById(`cell-${ptKey}-${p}`);
          if (!input) return;

          if (state.activeProps.includes(p)) {
            input.classList.remove('is-calc');
            input.classList.add('is-source');
            // Mantenir el valor que l'usuari està editant si té focus
            if (document.activeElement !== input) {
              input.value = (p === 'phi') ? `${fmt(state.userValues[p], 1)}%` : fmt(state.userValues[p], p === 'v' ? 3 : 1);
            }
          } else {
            input.classList.remove('is-source');
            input.classList.add('is-calc');
            input.value = formatProp(solved, p);
          }
        });
      } catch (err) {
        state.solved = null;
        state.error = err.message;
        // No deixar valors calculats d'un estat anterior a la fila
        PROPS.forEach(p => {
          const input = document.getElementById(`cell-${ptKey}-${p}`);
          if (input && !state.activeProps.includes(p)) {
            input.classList.remove('is-source');
            input.classList.add('is-calc');
            input.value = '';
          }
        });
      }
    } else {
      state.solved = null;
      // Netejar les cel·les que no siguin la propietat activa
      PROPS.forEach(p => {
        const input = document.getElementById(`cell-${ptKey}-${p}`);
        if (!input) return;

        if (state.activeProps.includes(p)) {
          input.classList.remove('is-calc');
          input.classList.add('is-source');
        } else {
          input.classList.remove('is-source');
          input.classList.add('is-calc');
          input.value = '';
        }
      });
    }

    updatePointBadge(ptKey);
  }

  /**
   * Configura els listeners per a una fila de punt (Ventilació o Retorn)
   */
  const OUTPUT_IDS = [
    'out-m-t', 'out-m-phi', 'out-m-w', 'out-m-v', 'out-m-h', 'out-m-tr', 'out-m-th',
    'out-i-v', 'out-i-h', 'out-i-tr', 'out-i-th',
    'out-s-w', 'out-s-v', 'out-s-h', 'out-s-tr', 'out-s-th',
    'out-fbp', 'out-qsv', 'out-qlv', 'out-qtot', 'out-fcstot',
    'out-qr', 'out-qm', 'out-mcond',
    'kpi-quick-qbat', 'kpi-quick-fbp', 'kpi-quick-mcond', 'kpi-quick-qi'
  ];

  function clearOutputs() {
    lastSolution = null;
    OUTPUT_IDS.forEach(id => setCell(id, '—'));
    // Cel·les d'entrada que només mostren resultats calculats
    [cellIT, cellIPhi, cellIW, cellST, inQi].forEach(el => {
      if (el && el.classList.contains('is-calc') && document.activeElement !== el) el.value = '';
    });
    PsychroChart.render(null, 7, 'psychro-container');
    StepDebugger.clear();
  }

  /**
   * Recalcula si hi ha dades suficients; si no, esborra els resultats antics
   */
  function refresh() {
    if (checkDataStatus()) {
      solveSystem();
    } else {
      clearOutputs();
    }
  }

  function setStatus(kind, text) {
    statusPill.className = `status-badge ${kind}`;
    statusText.textContent = text;
  }

  function setupPointRow(ptKey, clearBtnId) {
    const state = pointState[ptKey];
    const clearBtn = document.getElementById(clearBtnId);

    PROPS.forEach(prop => {
      const input = document.getElementById(`cell-${ptKey}-${prop}`);
      if (!input) return;

      input.addEventListener('input', () => {
        const rawVal = parseNum(input.value);

        if (rawVal === null) {
          // L'usuari ha esborrat el camp
          delete state.userValues[prop];
          state.activeProps = state.activeProps.filter(p => p !== prop);
        } else {
          state.userValues[prop] = rawVal;
          if (!state.activeProps.includes(prop)) {
            if (state.activeProps.length >= 2) {
              // Substituir la propietat més antiga
              const oldest = state.activeProps.shift();
              delete state.userValues[oldest];
            }
            state.activeProps.push(prop);
          }
        }

        updatePointRowUI(ptKey, true);
        refresh();
      });
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        state.activeProps = [];
        state.userValues = {};
        state.solved = null;
        PROPS.forEach(prop => {
          const input = document.getElementById(`cell-${ptKey}-${prop}`);
          if (input) {
            input.value = '';
            input.classList.remove('is-source');
            input.classList.add('is-calc');
          }
        });
        state.error = null;
        updatePointBadge(ptKey);
        refresh();
      });
    }
  }

  setupPointRow('v', 'btn-clear-v');
  setupPointRow('r', 'btn-clear-r');

  // Gestió d'Impulsió (I)
  const IMPULSE_BADGES = { phi: 'φ_I', t: 'T_I', w: 'w_I', qi: 'Q_I' };

  /**
   * Fixa la condició d'impulsió activa i marca visualment la cel·la font
   */
  function setImpulseMode(mode, value) {
    pointState.i.activeProp = mode;
    if (mode !== 'qi') {
      pointState.i.userValue = value;
      pointState.flows.manualQi = null;
    }
    if (mode === 'phi') pointState.i.lastPhi = value;

    const cells = { phi: cellIPhi, t: cellIT, w: cellIW, qi: inQi };
    Object.keys(cells).forEach(key => {
      const el = cells[key];
      if (key === mode) {
        el.classList.add('is-source'); el.classList.remove('is-calc');
      } else {
        el.classList.remove('is-source'); el.classList.add('is-calc');
      }
    });
    const badgeI = document.getElementById('badge-i-cond');
    if (badgeI) badgeI.textContent = IMPULSE_BADGES[mode];
  }

  /**
   * Torna al mode per defecte φ_I amb l'últim valor de φ_I introduït
   */
  function revertToPhiMode() {
    setImpulseMode('phi', pointState.i.lastPhi);
    if (document.activeElement !== cellIPhi) cellIPhi.value = `${fmt(pointState.i.lastPhi, 1)}%`;
  }

  function setupImpulsioInputs() {
    [['phi', cellIPhi], ['t', cellIT], ['w', cellIW]].forEach(([mode, cell]) => {
      cell.addEventListener('input', () => {
        const val = parseNum(cell.value);
        if (val !== null) {
          setImpulseMode(mode, val);
        } else if (pointState.i.activeProp === mode && mode !== 'phi') {
          // S'ha esborrat la condició activa: tornar a φ_I
          revertToPhiMode();
        }
        refresh();
      });
    });
  }

  setupImpulsioInputs();

  // Gestió de Superfície (S)
  if (cellST) {
    cellST.addEventListener('input', () => {
      const val = parseNum(cellST.value);
      pointState.s.manualTs = val;
      if (val !== null) {
        cellST.classList.add('is-source');
        cellST.classList.remove('is-calc');
      } else {
        cellST.classList.remove('is-source');
        cellST.classList.add('is-calc');
      }
      refresh();
    });
  }

  // Gestió de Potències i FCS
  function isValidFcs(fcs) {
    return fcs !== null && fcs > 0 && fcs <= 1;
  }

  function setupPowersInputs() {
    inQsi.addEventListener('input', () => {
      pointState.powers.q_si = parseNum(inQsi.value);
      updatePowersUI();
      refresh();
    });

    inQli.addEventListener('input', () => {
      pointState.powers.lastEdited = 'qli';
      pointState.powers.q_li = parseNum(inQli.value);
      inQli.classList.add('is-source'); inQli.classList.remove('is-calc');
      inFcsi.classList.remove('is-source'); inFcsi.classList.add('is-calc');
      updatePowersUI();
      refresh();
    });

    inFcsi.addEventListener('input', () => {
      pointState.powers.lastEdited = 'fcsi';
      pointState.powers.fcs_i = parseNum(inFcsi.value);
      inFcsi.classList.add('is-source'); inFcsi.classList.remove('is-calc');
      inQli.classList.remove('is-source'); inQli.classList.add('is-calc');
      updatePowersUI();
      refresh();
    });
  }

  /**
   * Manté q_li i FCS_i coherents segons quin dels dos ha editat l'usuari
   */
  function updatePowersUI() {
    const p = pointState.powers;
    if (p.lastEdited === 'qli') {
      if (p.q_si !== null && p.q_li !== null && (p.q_si + p.q_li) > 0) {
        p.fcs_i = p.q_si / (p.q_si + p.q_li);
        if (document.activeElement !== inFcsi) inFcsi.value = fmt(p.fcs_i, 4);
      } else {
        p.fcs_i = null;
        if (document.activeElement !== inFcsi) inFcsi.value = '';
      }
    } else {
      if (isValidFcs(p.fcs_i) && p.q_si !== null && p.q_si > 0) {
        p.q_li = p.q_si / p.fcs_i - p.q_si;
        if (document.activeElement !== inQli) inQli.value = fmt(p.q_li, 2);
      } else {
        p.q_li = null;
        if (document.activeElement !== inQli) inQli.value = '';
      }
    }
  }

  setupPowersInputs();

  // Gestió de Cabals
  function setupFlowsInputs() {
    inQv.addEventListener('input', () => {
      pointState.flows.q_v = parseNum(inQv.value);
      refresh();
    });

    inQi.addEventListener('input', () => {
      const val = parseNum(inQi.value);
      if (val !== null && val > 0) {
        pointState.flows.manualQi = val;
        setImpulseMode('qi', val);
      } else {
        pointState.flows.manualQi = null;
        if (pointState.i.activeProp === 'qi') revertToPhiMode();
      }
      refresh();
    });

    // En sortir de la cel·la, si Q_I és un valor calculat, tornar a mostrar el resultat vigent
    inQi.addEventListener('blur', () => {
      if (lastSolution && inQi.classList.contains('is-calc')) inQi.value = fmt(lastSolution.points.I.Q, 1);
    });

    inInfil.addEventListener('input', () => {
      const pct = parseNum(inInfil.value) || 0;
      pointState.fr_infiltr = Math.max(0, Math.min(100, pct)) / 100.0;
      refresh();
    });
  }

  setupFlowsInputs();

  /**
   * Comprova si les dades d'entrada necessàries estan completes
   */
  function checkDataStatus(updateUI = true) {
    const p = pointState.powers;
    const hasV = pointState.v.solved !== null;
    const hasR = pointState.r.solved !== null;
    const hasQsi = p.q_si !== null && p.q_si > 0;
    const hasQli = p.lastEdited === 'fcsi'
      ? isValidFcs(p.fcs_i)
      : (p.q_li !== null && p.q_li >= 0);
    const hasQv = pointState.flows.q_v !== null && pointState.flows.q_v > 0;

    const isReady = hasV && hasR && hasQsi && hasQli && hasQv;

    if (updateUI) {
      if (isReady) {
        setStatus('ready', 'Dades suficients per calcular');
      } else {
        let msg = 'Falten dades de partida:';
        if (!hasV) msg += pointState.v.error ? ` Ventilació (${pointState.v.error});` : ' 2 propietats a Ventilació;';
        if (!hasR) msg += pointState.r.error ? ` Retorn (${pointState.r.error});` : ' 2 propietats a Retorn;';
        if (!hasQsi) msg += ' q_si > 0;';
        if (!hasQli) msg += p.lastEdited === 'fcsi' ? ' FCS_i entre 0 i 1;' : ' q_li ≥ 0;';
        if (!hasQv) msg += ' cabal de ventilació Q_v;';
        const anyError = pointState.v.error || pointState.r.error;
        setStatus(anyError ? 'error' : 'missing', msg.replace(/;$/, ''));
      }
    }

    return isReady;
  }

  /**
   * Resolució del sistema de climatització complet
   */
  function solveSystem() {
    if (!checkDataStatus(true)) {
      clearOutputs();
      return;
    }

    try {
      const inputs = {
        pointV: pointState.v.solved,
        pointR: pointState.r.solved,
        q_si: pointState.powers.q_si,
        q_li: pointState.powers.q_li,
        FCS_i: pointState.powers.lastEdited === 'fcsi' ? pointState.powers.fcs_i : null,
        Q_v: pointState.flows.q_v,
        fr_infiltr: pointState.fr_infiltr,
        altitude: 0
      };

      const mode = pointState.i.activeProp;
      if (mode === 'qi' && pointState.flows.manualQi !== null) {
        inputs.target_QI = pointState.flows.manualQi;
      } else if (mode === 't') {
        inputs.target_TI = pointState.i.userValue;
      } else if (mode === 'w') {
        inputs.target_wI = pointState.i.userValue / 1000.0;
      } else {
        inputs.phi_I = pointState.i.userValue;
      }

      if (pointState.s.manualTs !== null) {
        inputs.target_TS = pointState.s.manualTs;
      }

      const sol = ClimaSolver.solve(inputs);
      lastSolution = sol;

      const pts = sol.points;
      const pow = sol.powers;

      // 1. Taula Psicromètrica - Mescla (M)
      setCell('out-m-t', fmt(pts.M.t, 1));
      setCell('out-m-phi', `${fmt(pts.M.phi, 1)}%`);
      setCell('out-m-w', fmt(pts.M.w_g_kg, 1));
      setCell('out-m-v', fmt(pts.M.v, 3));
      setCell('out-m-h', fmt(pts.M.h, 2));
      setCell('out-m-tr', fmt(pts.M.tr, 1));
      setCell('out-m-th', fmt(pts.M.th, 1));

      // Impulsió (I)
      if (document.activeElement !== cellIT) cellIT.value = fmt(pts.I.t, 1);
      if (document.activeElement !== cellIPhi) cellIPhi.value = `${fmt(pts.I.phi, 1)}%`;
      if (document.activeElement !== cellIW) cellIW.value = fmt(pts.I.w_g_kg, 1);
      setCell('out-i-v', fmt(pts.I.v, 3));
      setCell('out-i-h', fmt(pts.I.h, 2));
      setCell('out-i-tr', fmt(pts.I.tr, 1));
      setCell('out-i-th', fmt(pts.I.th, 1));

      // Superfície (S) — pot no existir si la recta de bateria no talla la saturació
      const S = pts.S || {};
      if (document.activeElement !== cellST) cellST.value = pts.S ? fmt(S.t, 1) : '';
      setCell('out-s-w', fmt(S.w_g_kg, 1));
      setCell('out-s-v', fmt(S.v, 3));
      setCell('out-s-h', fmt(S.h, 2));
      setCell('out-s-tr', fmt(S.tr, 1));
      setCell('out-s-th', fmt(S.th, 1));

      // 2. Taula de Potències
      setCell('out-fbp', fmt(pow.FBP, 4));
      setCell('out-qsv', fmt(pow.q_sv, 2));
      setCell('out-qlv', fmt(pow.q_lv, 2));
      setCell('out-qtot', fmt(pow.q_total, 2));
      setCell('out-fcstot', fmt(pow.FCS_total, 4));
      if (document.activeElement !== inFcsi) inFcsi.value = fmt(pow.FCS_i, 4);
      if (pointState.powers.lastEdited === 'fcsi' && document.activeElement !== inQli) {
        inQli.value = fmt(pow.q_li, 2);
      }

      // 3. Taula de Cabals
      if (document.activeElement !== inQi) inQi.value = fmt(pts.I.Q, 1);
      setCell('out-qr', fmt(pts.R.Q, 1));
      setCell('out-qm', fmt(pts.M.Q, 1));
      setCell('out-mcond', fmt(pow.M_cond_h, 2));

      // Indicadors ràpids (KPIs)
      setCell('kpi-quick-qbat', `${fmt(pow.q_bateria, 2)} kW`);
      setCell('kpi-quick-fbp', fmt(pow.FBP, 3));
      setCell('kpi-quick-mcond', `${fmt(pow.M_cond_h, 1)} kg/h`);
      setCell('kpi-quick-qi', `${fmt(pts.I.Q, 0)} m³/h`);

      if (sol.warnings && sol.warnings.length) {
        setStatus('missing', `Calculat amb avisos: ${sol.warnings.join(' ')}`);
      } else {
        setStatus('ready', 'Càlcul completat');
      }

      // Dibuixar diagrama psicromètric
      PsychroChart.render(sol, 7, 'psychro-container');

      // Actualitzar el debugger (mantenint el pas on es trobava l'usuari)
      StepDebugger.setSolution(sol, { keepStep: true });
    } catch (err) {
      console.error('Error calculant:', err);
      clearOutputs();
      setStatus('error', `Error en els càlculs: ${err.message}`);
    }
  }

  /**
   * Carrega el cas d'exemple canònic de classe
   */
  function loadExample() {
    pointState.v.activeProps = ['t', 'phi'];
    pointState.v.userValues = { t: 31.0, phi: 70.0 };

    pointState.r.activeProps = ['t', 'phi'];
    pointState.r.userValues = { t: 24.0, phi: 50.0 };

    setImpulseMode('phi', 90.0);
    cellIPhi.value = '90%';

    pointState.s.manualTs = null;
    if (cellST) {
      cellST.classList.remove('is-source');
      cellST.classList.add('is-calc');
    }

    pointState.powers.q_si = 20.0;
    pointState.powers.q_li = 3.0;
    pointState.powers.lastEdited = 'qli';
    inQsi.value = '20,0';
    inQli.value = '3,0';
    inQli.classList.add('is-source'); inQli.classList.remove('is-calc');
    inFcsi.classList.remove('is-source'); inFcsi.classList.add('is-calc');

    updatePowersUI();

    pointState.flows.q_v = 1000.0;
    inQv.value = '1000,0';

    pointState.fr_infiltr = 0.0;
    inInfil.value = '0%';

    updatePointRowUI('v');
    updatePointRowUI('r');
    checkDataStatus();
    solveSystem();
  }

  btnExample.addEventListener('click', loadExample);

  /**
   * Neteja tota la taula i els resultats
   */
  function clearAll() {
    pointState.v.activeProps = [];
    pointState.v.userValues = {};
    pointState.v.solved = null;

    pointState.r.activeProps = [];
    pointState.r.userValues = {};
    pointState.r.solved = null;

    pointState.s.manualTs = null;
    pointState.flows.manualQi = null;
    pointState.powers.q_si = null;
    pointState.powers.q_li = null;
    pointState.powers.fcs_i = null;
    pointState.powers.lastEdited = 'qli';
    pointState.flows.q_v = null;
    pointState.fr_infiltr = 0.0;
    pointState.v.error = null;
    pointState.r.error = null;

    PROPS.forEach(p => {
      const inV = document.getElementById(`cell-v-${p}`);
      if (inV) { inV.value = ''; inV.classList.remove('is-source'); inV.classList.add('is-calc'); }
      const inR = document.getElementById(`cell-r-${p}`);
      if (inR) { inR.value = ''; inR.classList.remove('is-source'); inR.classList.add('is-calc'); }
    });

    setImpulseMode('phi', 90.0);
    cellIT.value = '';
    cellIPhi.value = '90%';
    cellIW.value = '';

    if (cellST) {
      cellST.value = '';
      cellST.classList.remove('is-source');
      cellST.classList.add('is-calc');
    }

    inQsi.value = '';
    inQli.value = '';
    inFcsi.value = '';
    inQv.value = '';
    inQi.value = '';
    inInfil.value = '0%';

    inQsi.classList.remove('is-calc'); inQsi.classList.add('is-source');
    inQli.classList.remove('is-calc'); inQli.classList.add('is-source');
    inFcsi.classList.remove('is-source'); inFcsi.classList.add('is-calc');
    inQv.classList.remove('is-calc'); inQv.classList.add('is-source');

    clearOutputs();
    updatePointBadge('v');
    updatePointBadge('r');
    checkDataStatus();
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
      if (!lastSolution && checkDataStatus(false)) {
        solveSystem();
      }
      if (lastSolution) {
        StepDebugger.setSolution(lastSolution, { keepStep: true });
      }
    }
  }

  tabTable.addEventListener('click', () => switchTab('table'));
  tabDebugger.addEventListener('click', () => switchTab('debugger'));

  // Gestió de Pantalla Completa
  function openFullscreenChart() {
    if (!modalFullscreen) return;
    modalFullscreen.style.display = 'flex';
    const isDebugActive = tabDebugger && tabDebugger.classList.contains('active');
    const step = isDebugActive ? StepDebugger.getCurrentStep() : 7;
    PsychroChart.render(lastSolution, step, 'fullscreen-chart-container');
  }

  function closeFullscreenChart() {
    if (!modalFullscreen) return;
    modalFullscreen.style.display = 'none';
  }

  if (btnFullscreenChart) btnFullscreenChart.addEventListener('click', openFullscreenChart);
  if (btnFullscreenDebugChart) btnFullscreenDebugChart.addEventListener('click', openFullscreenChart);
  if (btnCloseFullscreen) btnCloseFullscreen.addEventListener('click', closeFullscreenChart);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalFullscreen && modalFullscreen.style.display !== 'none') {
      closeFullscreenChart();
    }
  });

  // Controls de la Barra d'Eines del Gràfic (Zoom i Exportació)
  const btnZoomIn = document.getElementById('chart-btn-zoom-in');
  const btnZoomOut = document.getElementById('chart-btn-zoom-out');
  const btnZoomReset = document.getElementById('chart-btn-zoom-reset');
  if (btnZoomIn) btnZoomIn.addEventListener('click', () => PsychroChart.zoomIn('psychro-container'));
  if (btnZoomOut) btnZoomOut.addEventListener('click', () => PsychroChart.zoomOut('psychro-container'));
  if (btnZoomReset) btnZoomReset.addEventListener('click', () => PsychroChart.resetZoom('psychro-container'));

  const btnExportPng = document.getElementById('btn-export-png');
  if (btnExportPng) btnExportPng.addEventListener('click', () => PsychroChart.exportPng('psychro-container'));

  // Inicialització amb l'exemple per defecte
  loadExample();
});
