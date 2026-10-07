/**
 * step_debugger.js
 * Mòdul de resolució pas a pas interactiva (estil debugger)
 * amb equacions en LaTeX (KaTeX) i valors numèrics reals de l'exercici.
 */

const StepDebugger = (() => {
  let currentStep = 1;
  const TOTAL_STEPS = 7;
  let activeSolution = null;

  function fmt(val, dec = 2) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return Number(val).toFixed(dec);
  }

  function getPropName(key) {
    switch (key) {
      case 't': return 'temperatura seca (T)';
      case 'phi': return 'humitat relativa (φ)';
      case 'w': return 'humitat absoluta (w)';
      case 'h': return 'entalpia (h)';
      case 'tr': return 'temperatura de rocío (Tr)';
      case 'th': return 'temperatura humida (Th)';
      case 'v': return 'volum específic (v)';
      default: return key;
    }
  }

  function getPointLatexInfo(pt, nameLabel, symbol) {
    const src = pt.sourceProps || ['t', 'phi'];
    const hasW = src.includes('w') || src.includes('tr');
    const hasPhi = src.includes('phi');
    const hasT = src.includes('t');
    const hasTh = src.includes('th');

    let formula = '';
    let substituted = '';

    if (hasW && hasPhi) {
      formula = `\\begin{aligned}
P_w &= \\frac{w \\cdot P}{0.621945 + w} \\\\[4pt]
P_{ws}(T) &= \\frac{P_w}{\\varphi} \\implies T = T_{\\text{sat}}(P_{ws}) \\\\[4pt]
h &= 1.006 \\cdot T + w \\cdot (2501 + 1.86 \\cdot T) \\\\[4pt]
v &= (1 + 1.607858 \\cdot w) \\cdot \\frac{0.287042 \\cdot (T + 273.15)}{P}
\\end{aligned}`;
      substituted = `\\begin{aligned}
\\text{${nameLabel} (${symbol}) [donats } w_{${symbol}}, \\varphi_{${symbol}}\\text{]:} &\\\\[2pt]
&\\quad w_{${symbol}} = ${fmt(pt.w_g_kg, 2)}\\text{ g/kg},\\; \\varphi_{${symbol}} = ${fmt(pt.phi, 0)}\\% \\\\[2pt]
&\\quad P_{w,${symbol}} = ${fmt(pt.pw, 1)}\\text{ Pa},\\; P_{ws}(T_{${symbol}}) = ${fmt(pt.pw / (pt.phi / 100), 1)}\\text{ Pa} \\\\[2pt]
&\\quad T_{${symbol}} = \\mathbf{${fmt(pt.t, 1)}\\text{ °C}},\\; h_{${symbol}} = ${fmt(pt.h, 2)}\\text{ kJ/kg},\\; v_{${symbol}} = ${fmt(pt.v, 3)}\\text{ m}^3\\text{/kg}
\\end{aligned}`;
    } else if (hasT && hasW) {
      formula = `\\begin{aligned}
P_w &= \\frac{w \\cdot P}{0.621945 + w} \\\\[4pt]
\\varphi &= \\frac{P_w}{P_{ws}(T)} \\\\[4pt]
h &= 1.006 \\cdot T + w \\cdot (2501 + 1.86 \\cdot T) \\\\[4pt]
v &= (1 + 1.607858 \\cdot w) \\cdot \\frac{0.287042 \\cdot (T + 273.15)}{P}
\\end{aligned}`;
      substituted = `\\begin{aligned}
\\text{${nameLabel} (${symbol}) [donats } T_{${symbol}}, w_{${symbol}}\\text{]:} &\\\\[2pt]
&\\quad T_{${symbol}} = ${fmt(pt.t, 1)}\\text{ °C},\\; w_{${symbol}} = ${fmt(pt.w_g_kg, 2)}\\text{ g/kg} \\\\[2pt]
&\\quad \\varphi_{${symbol}} = \\mathbf{${fmt(pt.phi, 1)}\\%},\\; h_{${symbol}} = ${fmt(pt.h, 2)}\\text{ kJ/kg},\\; v_{${symbol}} = ${fmt(pt.v, 3)}\\text{ m}^3\\text{/kg}
\\end{aligned}`;
    } else if (hasT && hasTh) {
      formula = `\\begin{aligned}
w &= w(T, T_h, P) \\quad (\\text{equació psicròmetre Carrier}) \\\\[4pt]
\\varphi &= \\frac{P_w(w)}{P_{ws}(T)} \\\\[4pt]
h &= 1.006 \\cdot T + w \\cdot (2501 + 1.86 \\cdot T)
\\end{aligned}`;
      substituted = `\\begin{aligned}
\\text{${nameLabel} (${symbol}) [donats } T_{${symbol}}, T_{h,${symbol}}\\text{]:} &\\\\[2pt]
&\\quad T_{${symbol}} = ${fmt(pt.t, 1)}\\text{ °C},\\; T_{h,${symbol}} = ${fmt(pt.th, 1)}\\text{ °C} \\\\[2pt]
&\\quad w_{${symbol}} = \\mathbf{${fmt(pt.w_g_kg, 2)}\\text{ g/kg}},\\; \\varphi_{${symbol}} = \\mathbf{${fmt(pt.phi, 1)}\\%} \\\\[2pt]
&\\quad h_{${symbol}} = ${fmt(pt.h, 2)}\\text{ kJ/kg},\\; v_{${symbol}} = ${fmt(pt.v, 3)}\\text{ m}^3\\text{/kg}
\\end{aligned}`;
    } else {
      formula = `\\begin{aligned}
P_w &= \\varphi \\cdot P_{ws}(T) \\\\[4pt]
w &= 0.621945 \\cdot \\frac{P_w}{P - P_w} \\\\[4pt]
h &= 1.006 \\cdot T + w \\cdot (2501 + 1.86 \\cdot T) \\\\[4pt]
v &= (1 + 1.607858 \\cdot w) \\cdot \\frac{0.287042 \\cdot (T + 273.15)}{P}
\\end{aligned}`;
      substituted = `\\begin{aligned}
\\text{${nameLabel} (${symbol}) [donats } T_{${symbol}}, \\varphi_{${symbol}}\\text{]:} &\\\\[2pt]
&\\quad T_{${symbol}} = ${fmt(pt.t, 1)}\\text{ °C},\\; \\varphi_{${symbol}} = ${fmt(pt.phi, 0)}\\% \\\\[2pt]
&\\quad w_{${symbol}} = ${fmt(pt.w_g_kg, 2)}\\text{ g/kg},\\; h_{${symbol}} = ${fmt(pt.h, 2)}\\text{ kJ/kg},\\; v_{${symbol}} = ${fmt(pt.v, 3)}\\text{ m}^3\\text{/kg}
\\end{aligned}`;
    }

    return { formula, substituted };
  }

  /**
   * Genera el contingut de cada pas amb LaTeX net i compatible amb KaTeX
   */
  function getStepContent(stepIndex, sol) {
    if (!sol) return { title: 'Sense dades', summary: 'Cal calcular el sistema prèviament.', latexFormula: '', latexSubstituted: '' };

    const pts = sol.points;
    const pow = sol.powers;
    const V = pts.V;
    const R = pts.R;
    const M = pts.M;
    const I = pts.I;
    const S = pts.S;

    switch (stepIndex) {
      case 1: {
        const vInfo = getPointLatexInfo(V, 'Ventilació', 'v');
        const rInfo = getPointLatexInfo(R, 'Retorn', 'R');
        const vSrcNames = (V.sourceProps || ['t', 'phi']).map(getPropName).join(' i ');
        const rSrcNames = (R.sourceProps || ['t', 'phi']).map(getPropName).join(' i ');
        return {
          title: 'Pas 1: Caracterització dels Punts d\'Entrada (V i R)',
          summary: `A partir de les propietats especificades (${vSrcNames} per a Ventilació, i ${rSrcNames} per a Retorn), se'n calculen les propietats termodinàmiques fonamentals.`,
          latexFormula: vInfo.formula,
          latexSubstituted: `${vInfo.substituted}\\\\[8pt]\n${rInfo.substituted}`
        };
      }

      case 2:
        return {
          title: 'Pas 2: Càrregues Interiors i Recta de Maniobra de la Sala',
          summary: 'Es calcula el Factor de Calor Sensible Interior (FCS_i), que defineix el pendent de la recta que uneix l\'aire d\'impulsió (I) amb el de la sala (R).',
          latexFormula: `\\begin{aligned}
q_i &= q_{si} + q_{li} \\\\[6pt]
FCS_i &= \\frac{q_{si}}{q_i} \\\\[6pt]
K &= \\frac{w_R - w_I}{T_R - T_I} = \\frac{1 - FCS_i}{FCS_i} \\cdot \\frac{c_{pas}}{\\Delta h_{lg}}
\\end{aligned}`,
          latexSubstituted: `\\begin{aligned}
q_i &= ${fmt(pow.q_si, 2)} + ${fmt(pow.q_li, 2)} = ${fmt(pow.q_i, 2)}\\text{ kW} \\\\[6pt]
FCS_i &= \\frac{${fmt(pow.q_si, 2)}}{${fmt(pow.q_i, 2)}} = \\mathbf{${fmt(pow.FCS_i, 4)}} \\\\[6pt]
K &= \\frac{1 - ${fmt(pow.FCS_i, 4)}}{${fmt(pow.FCS_i, 4)}} \\cdot \\frac{1.006}{2501} = \\mathbf{${fmt(sol.slopeRoom * 1000, 4)}\\text{ (g/kg)/°C}}
\\end{aligned}`
        };

      case 3:
        return {
          title: 'Pas 3: Determinació del Punt d\'Impulsió (I)',
          summary: 'El punt d\'impulsió (I) es troba a la intersecció entre la recta de maniobra de la sala que passa per R i la corba d\'humitat relativa d\'impulsió fixada (típicament φ_I = 90%).',
          latexFormula: `\\begin{aligned}
w_I(T) &= w_R - K \\cdot (T_R - T) \\\\[6pt]
w_{\\varphi_I}(T) &= 0.621945 \\cdot \\frac{\\varphi_I \\cdot P_{ws}(T)}{P - \\varphi_I \\cdot P_{ws}(T)} \\\\[6pt]
\\text{Condició:} &\\quad w_I(T_I) = w_{\\varphi_I}(T_I)
\\end{aligned}`,
          latexSubstituted: `\\begin{aligned}
\\text{Punt d'Impulsió (I):} \\\\[4pt]
T_I &= \\mathbf{${fmt(I.t, 2)}\\text{ °C}} \\\\[2pt]
\\varphi_I &= ${fmt(I.phi, 1)}\\% \\\\[2pt]
w_I &= \\mathbf{${fmt(I.w_g_kg, 2)}\\text{ g/kg a.s.}} \\\\[2pt]
h_I &= \\mathbf{${fmt(I.h, 2)}\\text{ kJ/kg}},\\quad v_I = ${fmt(I.v, 3)}\\text{ m}^3\\text{/kg}
\\end{aligned}`
        };

      case 4:
        return {
          title: 'Pas 4: Balanç de Cabals d\'Aire',
          summary: 'A partir de la diferència d\'entalpia entre el retorn i la impulsió per absorbir la càrrega interna de la sala (q_i), es determinen els cabals necessaris.',
          latexFormula: `\\begin{aligned}
\\dot{m}_v &= \\frac{Q_v}{3600 \\cdot v_v} \\\\[6pt]
\\dot{m}_I &= \\frac{q_i}{h_R - h_I} \\implies Q_I = \\dot{m}_I \\cdot v_I \\cdot 3600 \\\\[6pt]
\\dot{m}_R &= \\dot{m}_I - \\dot{m}_v \\implies Q_R = \\dot{m}_R \\cdot v_R \\cdot 3600
\\end{aligned}`,
          latexSubstituted: `\\begin{aligned}
\\dot{m}_v &= \\frac{${fmt(V.Q, 1)}}{3600 \\cdot ${fmt(V.v, 3)}} = \\mathbf{${fmt(V.m_dot, 4)}\\text{ kg/s}} \\\\[6pt]
\\dot{m}_I &= \\frac{${fmt(pow.q_i, 2)}}{${fmt(R.h, 2)} - ${fmt(I.h, 2)}} = \\frac{${fmt(pow.q_i, 2)}}{${fmt(R.h - I.h, 2)}} = \\mathbf{${fmt(I.m_dot, 4)}\\text{ kg/s}} \\\\[2pt]
Q_I &= ${fmt(I.m_dot, 4)} \\cdot ${fmt(I.v, 3)} \\cdot 3600 = \\mathbf{${fmt(I.Q, 1)}\\text{ m}^3\\text{/h}} \\\\[6pt]
\\dot{m}_R &= ${fmt(I.m_dot, 4)} - ${fmt(V.m_dot, 4)} = \\mathbf{${fmt(R.m_dot, 4)}\\text{ kg/s}} \\\\[2pt]
Q_R &= ${fmt(R.m_dot, 4)} \\cdot ${fmt(R.v, 3)} \\cdot 3600 = \\mathbf{${fmt(R.Q, 1)}\\text{ m}^3\\text{/h}}
\\end{aligned}`
        };

      case 5:
        return {
          title: 'Pas 5: Cambra de Mescla (M)',
          summary: 'La barreja adiabàtica entre el cabal d\'aire exterior de ventilació i el cabal recirculat de retorn determina el punt de mescla (M) que entra a la bateria de fred.',
          latexFormula: `\\begin{aligned}
\\dot{m}_M &= \\dot{m}_I = \\dot{m}_v + \\dot{m}_R \\\\[6pt]
w_M &= \\frac{\\dot{m}_v \\cdot w_v + \\dot{m}_R \\cdot w_R}{\\dot{m}_M} \\\\[6pt]
h_M &= \\frac{\\dot{m}_v \\cdot h_v + \\dot{m}_R \\cdot h_R}{\\dot{m}_M}
\\end{aligned}`,
          latexSubstituted: `\\begin{aligned}
w_M &= \\frac{${fmt(V.m_dot, 4)} \\cdot ${fmt(V.w_g_kg, 2)} + ${fmt(R.m_dot, 4)} \\cdot ${fmt(R.w_g_kg, 2)}}{${fmt(M.m_dot, 4)}} = \\mathbf{${fmt(M.w_g_kg, 2)}\\text{ g/kg}} \\\\[6pt]
h_M &= \\frac{${fmt(V.m_dot, 4)} \\cdot ${fmt(V.h, 2)} + ${fmt(R.m_dot, 4)} \\cdot ${fmt(R.h, 2)}}{${fmt(M.m_dot, 4)}} = \\mathbf{${fmt(M.h, 2)}\\text{ kJ/kg}} \\\\[6pt]
T_M &= \\mathbf{${fmt(M.t, 2)}\\text{ °C}},\\quad \\varphi_M = \\mathbf{${fmt(M.phi, 1)}\\%}
\\end{aligned}`
        };

      case 6:
        return {
          title: 'Pas 6: Bateria de Fred, Superfície (S) i Bypass (FBP)',
          summary: 'El procés a la bateria uneix la mescla (M) amb l\'estat d\'impulsió (I). La prolongació d\'aquesta recta fins a la corba de saturació (φ = 100%) defineix el punt de superfície de bateria (S) i el factor de bypass.',
          latexFormula: `\\begin{aligned}
\\text{Recta } M-I: &\\quad \\frac{w_M - w_I}{T_M - T_I} = \\frac{w_I - w_S}{T_I - T_S} \\\\[6pt]
\\text{Saturació:} &\\quad w_S = w_s(T_S) \\\\[6pt]
FBP &= \\frac{h_I - h_S}{h_M - h_S} \\approx \\frac{T_I - T_S}{T_M - T_S}
\\end{aligned}`,
          latexSubstituted: `\\begin{aligned}
\\text{Superfície de Bateria (S):} \\\\[2pt]
T_S &= \\mathbf{${fmt(S.t, 2)}\\text{ °C}},\\quad \\varphi_S = 100\\%,\\quad w_S = \\mathbf{${fmt(S.w_g_kg, 2)}\\text{ g/kg}} \\\\[8pt]
\\text{Factor de Bypass (FBP):} \\\\[2pt]
FBP &= \\frac{${fmt(I.t, 2)} - ${fmt(S.t, 2)}}{${fmt(M.t, 2)} - ${fmt(S.t, 2)}} = \\frac{${fmt(I.t - S.t, 2)}}{${fmt(M.t - S.t, 2)}} = \\mathbf{${fmt(pow.FBP, 4)}}
\\end{aligned}`
        };

      case 7:
        return {
          title: 'Pas 7: Condensats i Potència Frigorífica de la Bateria',
          summary: 'Es determina la quantitat d\'aigua condensada per deshumidificació i la potència total necessària a la bateria de fred.',
          latexFormula: `\\begin{aligned}
\\dot{m}_{cond} &= \\dot{m}_I \\cdot (w_M - w_I) \\\\[6pt]
\\dot{M}_{cond} &= \\dot{m}_{cond} \\cdot 3600\\text{ kg/h} \\\\[6pt]
q_{\\text{bateria}} &= \\dot{m}_I \\cdot (h_M - h_I) \\\\[6pt]
q_{\\text{total}} &= q_{si} + q_{li} + q_{sv} + q_{lv}
\\end{aligned}`,
          latexSubstituted: `\\begin{aligned}
\\dot{M}_{cond} &= ${fmt(I.m_dot, 4)} \\cdot \\frac{${fmt(M.w_g_kg, 2)} - ${fmt(I.w_g_kg, 2)}}{1000} \\cdot 3600 = \\mathbf{${fmt(pow.M_cond_h, 2)}\\text{ kg H}_2\\text{O/h}} \\\\[6pt]
q_{\\text{bateria}} &= ${fmt(I.m_dot, 4)} \\cdot (${fmt(M.h, 2)} - ${fmt(I.h, 2)}) = \\mathbf{${fmt(pow.q_bateria, 2)}\\text{ kW}} \\\\[6pt]
q_{sv} &= \\mathbf{${fmt(pow.q_sv, 2)}\\text{ kW}},\\quad q_{lv} = \\mathbf{${fmt(pow.q_lv, 2)}\\text{ kW}} \\\\[2pt]
q_{\\text{total}} &= ${fmt(pow.q_s_total, 2)} + ${fmt(pow.q_l_total, 2)} = \\mathbf{${fmt(pow.q_total, 2)}\\text{ kW}} \\\\[2pt]
FCS_{\\text{total}} &= \\mathbf{${fmt(pow.FCS_total, 4)}}
\\end{aligned}`
        };

      default:
        return { title: '', summary: '', latexFormula: '', latexSubstituted: '' };
    }
  }

  function renderCurrentStep() {
    if (!activeSolution) return;
    if (typeof document === 'undefined') return;

    const data = getStepContent(currentStep, activeSolution);

    // Actualitzar textos informatius
    const elIndicator = document.getElementById('debug-step-indicator');
    const elTitle = document.getElementById('debug-step-title');
    const elSummary = document.getElementById('debug-step-summary');

    if (elIndicator) elIndicator.textContent = `Pas ${currentStep} de ${TOTAL_STEPS}`;
    if (elTitle) elTitle.textContent = data.title;
    if (elSummary) elSummary.textContent = data.summary;

    // Renderitzar KaTeX
    const containerFormula = document.getElementById('debug-latex-formula');
    const containerSubst = document.getElementById('debug-latex-substituted');

    if (containerFormula && typeof katex !== 'undefined') {
      try {
        katex.render(data.latexFormula, containerFormula, { displayMode: true, throwOnError: false });
      } catch (err) {
        console.warn('KaTeX formula render fallback:', err);
        containerFormula.textContent = data.latexFormula;
      }
    }

    if (containerSubst && typeof katex !== 'undefined') {
      try {
        katex.render(data.latexSubstituted, containerSubst, { displayMode: true, throwOnError: false });
      } catch (err) {
        console.warn('KaTeX substituted render fallback:', err);
        containerSubst.textContent = data.latexSubstituted;
      }
    }

    // Actualitzar botons de navegació
    const btnPrev = document.getElementById('debug-btn-prev');
    const btnFirst = document.getElementById('debug-btn-first');
    const btnNext = document.getElementById('debug-btn-next');
    const btnLast = document.getElementById('debug-btn-last');

    if (btnPrev) btnPrev.disabled = (currentStep === 1);
    if (btnFirst) btnFirst.disabled = (currentStep === 1);
    if (btnNext) btnNext.disabled = (currentStep === TOTAL_STEPS);
    if (btnLast) btnLast.disabled = (currentStep === TOTAL_STEPS);

    // Sincronitzar diagrama psicromètric amb el pas actual
    PsychroChart.render(activeSolution, currentStep, 'debug-psychro-container');
  }

  function setSolution(sol) {
    activeSolution = sol;
    currentStep = 1;
    renderCurrentStep();
  }

  function nextStep() {
    if (currentStep < TOTAL_STEPS) {
      currentStep++;
      renderCurrentStep();
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      currentStep--;
      renderCurrentStep();
    }
  }

  function firstStep() {
    currentStep = 1;
    renderCurrentStep();
  }

  function lastStep() {
    currentStep = TOTAL_STEPS;
    renderCurrentStep();
  }

  function init() {
    const btnPrev = document.getElementById('debug-btn-prev');
    const btnNext = document.getElementById('debug-btn-next');
    const btnFirst = document.getElementById('debug-btn-first');
    const btnLast = document.getElementById('debug-btn-last');

    if (btnPrev) btnPrev.addEventListener('click', prevStep);
    if (btnNext) btnNext.addEventListener('click', nextStep);
    if (btnFirst) btnFirst.addEventListener('click', firstStep);
    if (btnLast) btnLast.addEventListener('click', lastStep);
  }

  return {
    init,
    setSolution,
    renderCurrentStep,
    getStepContent,
    getPointLatexInfo,
    getCurrentStep: () => currentStep,
    nextStep,
    prevStep,
    firstStep,
    lastStep,
    TOTAL_STEPS
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StepDebugger;
}
