/**
 * app.js
 * Controlador principal de la interfície d'usuari i integració
 * entre DOM, Solver i Plotly.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements del formulari
  const form = document.getElementById('clima-form');
  const inputQsi = document.getElementById('input-qsi');
  const inputQli = document.getElementById('input-qli');
  const inputTv = document.getElementById('input-tv');
  const inputPhiV = document.getElementById('input-phiv');
  const inputQv = document.getElementById('input-qv');
  const inputTR = document.getElementById('input-tr');
  const inputPhiR = document.getElementById('input-phir');
  const selectMode = document.getElementById('select-mode');
  const inputPhiI = document.getElementById('input-phi-i');
  const inputTI = document.getElementById('input-t-i');
  const groupPhiI = document.getElementById('group-phi-i');
  const groupTI = document.getElementById('group-t-i');
  const inputInfil = document.getElementById('input-infil');
  const inputAltitude = document.getElementById('input-altitude');

  // Presets
  const presets = {
    ej1: {
      q_si: 20.0,
      q_li: 3.0,
      Tv: 31.0,
      phi_v: 70.0,
      Q_v: 1000.0,
      TR: 24.0,
      phi_R: 50.0,
      mode: 'phi_I',
      phi_I: 90.0,
      target_TI: 13.5,
      fr_infiltr: 0.0,
      altitude: 0
    },
    alta_humitat: {
      q_si: 25.0,
      q_li: 8.0,
      Tv: 35.0,
      phi_v: 75.0,
      Q_v: 1500.0,
      TR: 25.0,
      phi_R: 50.0,
      mode: 'phi_I',
      phi_I: 95.0,
      target_TI: 14.0,
      fr_infiltr: 0.0,
      altitude: 0
    },
    moderat: {
      q_si: 15.0,
      q_li: 2.5,
      Tv: 29.0,
      phi_v: 60.0,
      Q_v: 800.0,
      TR: 23.0,
      phi_R: 50.0,
      mode: 'phi_I',
      phi_I: 90.0,
      target_TI: 13.0,
      fr_infiltr: 0.05,
      altitude: 100
    }
  };

  // Botons de preset
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const presetKey = e.target.getAttribute('data-preset');
      if (presets[presetKey]) {
        loadPreset(presets[presetKey]);
      }
    });
  });

  function loadPreset(p) {
    inputQsi.value = p.q_si;
    inputQli.value = p.q_li;
    inputTv.value = p.Tv;
    inputPhiV.value = p.phi_v;
    inputQv.value = p.Q_v;
    inputTR.value = p.TR;
    inputPhiR.value = p.phi_R;
    selectMode.value = p.mode;
    inputPhiI.value = p.phi_I;
    if (p.target_TI !== undefined) inputTI.value = p.target_TI;
    inputInfil.value = p.fr_infiltr * 100.0;
    inputAltitude.value = p.altitude;

    updateModeUI();
    recalculate();
  }

  function updateModeUI() {
    const mode = selectMode.value;
    if (mode === 'phi_I') {
      groupPhiI.style.display = 'flex';
      groupTI.style.display = 'none';
    } else {
      groupPhiI.style.display = 'none';
      groupTI.style.display = 'flex';
    }
  }

  selectMode.addEventListener('change', () => {
    updateModeUI();
    recalculate();
  });

  // Recàlcul reactiu
  const allInputs = [
    inputQsi, inputQli, inputTv, inputPhiV, inputQv,
    inputTR, inputPhiR, inputPhiI, inputTI, inputInfil, inputAltitude
  ];

  allInputs.forEach(input => {
    if (input) {
      input.addEventListener('input', () => recalculate());
    }
  });

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      recalculate();
    });
  }

  function getFormData() {
    return {
      q_si: parseFloat(inputQsi.value) || 0,
      q_li: parseFloat(inputQli.value) || 0,
      Tv: parseFloat(inputTv.value) || 0,
      phi_v: parseFloat(inputPhiV.value) || 0,
      Q_v: parseFloat(inputQv.value) || 0,
      TR: parseFloat(inputTR.value) || 0,
      phi_R: parseFloat(inputPhiR.value) || 0,
      mode: selectMode.value,
      phi_I: parseFloat(inputPhiI.value) || 90,
      target_TI: parseFloat(inputTI.value) || 13,
      fr_infiltr: (parseFloat(inputInfil.value) || 0) / 100.0,
      altitude: parseFloat(inputAltitude.value) || 0
    };
  }

  // Toggle foto de la pissarra
  const btnTogglePhoto = document.getElementById('btn-toggle-photo');
  const photoContainer = document.getElementById('photo-container');
  if (btnTogglePhoto && photoContainer) {
    btnTogglePhoto.addEventListener('click', () => {
      const isHidden = photoContainer.style.display === 'none';
      photoContainer.style.display = isHidden ? 'block' : 'none';
      btnTogglePhoto.textContent = isHidden ? '✕ Amagar Foto' : '📷 Veure Foto de Pissarra';
    });
  }

  function recalculate() {
    try {
      const data = getFormData();
      const solution = ClimaSolver.solve(data);
      updateTable(solution, data);
      updateKPIs(solution);
      PsychroChart.render(solution);
    } catch (err) {
      console.error('Error calculant el cicle:', err);
    }
  }

  function updateTable(sol, data) {
    const pts = sol.points;
    const pow = sol.powers;
    const rows = ['V', 'R', 'M', 'I', 'S'];

    const setCell = (cellId, val) => {
      const el = document.getElementById(cellId);
      if (el) el.textContent = val;
    };

    // 1. Taula de Condicions Psicromètriques
    rows.forEach(key => {
      const pt = pts[key];
      if (!pt) return;

      const prefix = `td-${key.toLowerCase()}`;
      setCell(`${prefix}-t`, pt.t.toFixed(1).replace('.', ','));
      setCell(`${prefix}-phi`, `${pt.phi.toFixed(1).replace('.', ',')}%`);
      setCell(`${prefix}-w`, pt.w_g_kg.toFixed(1).replace('.', ','));
      setCell(`${prefix}-v`, pt.v.toFixed(3).replace('.', ','));
      setCell(`${prefix}-h`, pt.h.toFixed(2).replace('.', ','));
      setCell(`${prefix}-tr`, pt.tr.toFixed(1).replace('.', ','));
      setCell(`${prefix}-th`, pt.th.toFixed(1).replace('.', ','));
    });

    // 2. Taula de Potències (Lila)
    setCell('td-fbp', pow.FBP.toFixed(4).replace('.', ','));
    setCell('td-qsi', pow.q_si.toFixed(2).replace('.', ','));
    setCell('td-qli', pow.q_li.toFixed(2).replace('.', ','));
    setCell('td-qsv', pow.q_sv.toFixed(2).replace('.', ','));
    setCell('td-qlv', pow.q_lv.toFixed(2).replace('.', ','));
    setCell('td-qtot', pow.q_total.toFixed(2).replace('.', ','));
    setCell('td-fcstot', pow.FCS_total.toFixed(4).replace('.', ','));
    setCell('td-fcsi', pow.FCS_i.toFixed(4).replace('.', ','));

    // 3. Taula de Cabals i Condensats
    setCell('td-qv', pts.V.Q.toFixed(1).replace('.', ','));
    setCell('td-qi', pts.I.Q.toFixed(1).replace('.', ','));
    setCell('td-qr', pts.R.Q.toFixed(1).replace('.', ','));
    setCell('td-qm', pts.M.Q.toFixed(1).replace('.', ','));

    setCell('td-mcond', pow.M_cond_h.toFixed(2).replace('.', ','));
    const qInfil = (data.fr_infiltr * data.q_v_total_vol || data.fr_infiltr * data.Q_v);
    setCell('td-infil-display', `${qInfil.toFixed(1).replace('.', ',')} (${(data.fr_infiltr * 100).toFixed(0)}%)`);
  }

  function updateKPIs(sol) {
    const pow = sol.powers;
    const setText = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };

    // Internes
    setText('kpi-qsi', `${pow.q_si.toFixed(2)} kW`);
    setText('kpi-qli', `${pow.q_li.toFixed(2)} kW`);
    setText('kpi-qi', `${pow.q_i.toFixed(2)} kW`);
    setText('kpi-fcsi', `${pow.FCS_i.toFixed(4)}`);

    // Ventilació
    setText('kpi-qsv', `${pow.q_sv.toFixed(2)} kW`);
    setText('kpi-qlv', `${pow.q_lv.toFixed(2)} kW`);
    setText('kpi-qv', `${pow.q_v.toFixed(2)} kW`);

    // Totals
    setText('kpi-qstot', `${pow.q_s_total.toFixed(2)} kW`);
    setText('kpi-qltot', `${pow.q_l_total.toFixed(2)} kW`);
    setText('kpi-qtot', `${pow.q_total.toFixed(2)} kW`);
    setText('kpi-fcstot', `${pow.FCS_total.toFixed(4)}`);

    // Bateria i operació
    setText('kpi-qbat', `${pow.q_bateria.toFixed(2)} kW`);
    setText('kpi-fbp', `${pow.FBP.toFixed(4)} (${(pow.FBP * 100).toFixed(1)}%)`);
    setText('kpi-mcond-h', `${pow.M_cond_h.toFixed(2)} kg/h`);
    setText('kpi-mcond-s', `${(pow.m_dot_cond * 1000.0).toFixed(2)} g/s`);
    setText('kpi-patm', `${pow.P_atm_kPa.toFixed(3)} kPa`);
  }

  // Carrega inicial
  loadPreset(presets.ej1);
});
