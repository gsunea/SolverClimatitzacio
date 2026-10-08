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

  function propSymbol(key, symbol) {
    switch (key) {
      case 't': return `T_{${symbol}}`;
      case 'phi': return `\\varphi_{${symbol}}`;
      case 'w': return `w_{${symbol}}`;
      case 'h': return `h_{${symbol}}`;
      case 'tr': return `T_{r,${symbol}}`;
      case 'th': return `T_{h,${symbol}}`;
      case 'v': return `v_{${symbol}}`;
      default: return key;
    }
  }

  function getPointLatexInfo(pt, nameLabel, symbol) {
    const src = pt.sourceProps || ['t', 'phi'];
    const hasW = src.includes('w') || src.includes('tr');
    const hasPhi = src.includes('phi');
    const hasT = src.includes('t');
    const hasTh = src.includes('th');
    const givenLabel = src.map(k => propSymbol(k, symbol)).join(', ');
    const header = `\\text{${nameLabel} (${symbol}) [donats } ${givenLabel}\\text{]:} &\\\\[2pt]`;

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
${header}
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
${header}
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
${header}
&\\quad T_{${symbol}} = ${fmt(pt.t, 1)}\\text{ °C},\\; T_{h,${symbol}} = ${fmt(pt.th, 1)}\\text{ °C} \\\\[2pt]
&\\quad w_{${symbol}} = \\mathbf{${fmt(pt.w_g_kg, 2)}\\text{ g/kg}},\\; \\varphi_{${symbol}} = \\mathbf{${fmt(pt.phi, 1)}\\%} \\\\[2pt]
&\\quad h_{${symbol}} = ${fmt(pt.h, 2)}\\text{ kJ/kg},\\; v_{${symbol}} = ${fmt(pt.v, 3)}\\text{ m}^3\\text{/kg}
\\end{aligned}`;
    } else if (hasT && hasPhi) {
      formula = `\\begin{aligned}
P_w &= \\varphi \\cdot P_{ws}(T) \\\\[4pt]
w &= 0.621945 \\cdot \\frac{P_w}{P - P_w} \\\\[4pt]
h &= 1.006 \\cdot T + w \\cdot (2501 + 1.86 \\cdot T) \\\\[4pt]
v &= (1 + 1.607858 \\cdot w) \\cdot \\frac{0.287042 \\cdot (T + 273.15)}{P}
\\end{aligned}`;
      substituted = `\\begin{aligned}
${header}
&\\quad T_{${symbol}} = ${fmt(pt.t, 1)}\\text{ °C},\\; \\varphi_{${symbol}} = ${fmt(pt.phi, 0)}\\% \\\\[2pt]
&\\quad w_{${symbol}} = ${fmt(pt.w_g_kg, 2)}\\text{ g/kg},\\; h_{${symbol}} = ${fmt(pt.h, 2)}\\text{ kJ/kg},\\; v_{${symbol}} = ${fmt(pt.v, 3)}\\text{ m}^3\\text{/kg}
\\end{aligned}`;
    } else {
      // Resta de parelles: es resol iterativament (bisecció en T) fins que es compleixen les dues propietats
      formula = `\\begin{aligned}
&\\text{Resolució iterativa: es cerca } T \\text{ que compleixi } ${givenLabel} \\\\[4pt]
h &= 1.006 \\cdot T + w \\cdot (2501 + 1.86 \\cdot T) \\\\[4pt]
v &= (1 + 1.607858 \\cdot w) \\cdot \\frac{0.287042 \\cdot (T + 273.15)}{P}
\\end{aligned}`;
      substituted = `\\begin{aligned}
${header}
&\\quad T_{${symbol}} = \\mathbf{${fmt(pt.t, 1)}\\text{ °C}},\\; \\varphi_{${symbol}} = ${fmt(pt.phi, 1)}\\%,\\; w_{${symbol}} = ${fmt(pt.w_g_kg, 2)}\\text{ g/kg} \\\\[2pt]
&\\quad h_{${symbol}} = ${fmt(pt.h, 2)}\\text{ kJ/kg},\\; v_{${symbol}} = ${fmt(pt.v, 3)}\\text{ m}^3\\text{/kg},\\; T_{h,${symbol}} = ${fmt(pt.th, 1)}\\text{ °C},\\; T_{r,${symbol}} = ${fmt(pt.tr, 1)}\\text{ °C}
\\end{aligned}`;
    }

    return { formula, substituted };
  }

  /**
   * Contingut del pas 3 segons la condició d'impulsió fixada per l'usuari
   */
  function getImpulseStep(sol) {
    const I = sol.points.I;
    const mode = sol.impulseMode || 'phi_I';
    const lineEq = 'w_I(T) &= w_R - K \\cdot (T_R - T) \\\\[6pt]';

    let summary;
    let condition;
    if (sol.allOutdoorAir) {
      summary = 'El cabal de ventilació supera el d\'impulsió necessari: el sistema treballa amb 100% d\'aire exterior (ṁ_I = ṁ_v) i el punt I surt del balanç d\'entalpia de la sala sobre la recta de maniobra.';
      condition = `h_I &= h_R - \\frac{q_{\\text{sala}}}{\\dot{m}_v} = ${fmt(I.h, 2)}\\text{ kJ/kg}`;
    } else if (mode === 'T_I') {
      summary = 'El punt d\'impulsió (I) és el punt de la recta de maniobra de la sala amb la temperatura d\'impulsió fixada T_I.';
      condition = '\\text{Condició:} &\\quad T = T_I \\text{ (fixada)}';
    } else if (mode === 'w_I') {
      summary = 'El punt d\'impulsió (I) és el punt de la recta de maniobra de la sala amb la humitat absoluta d\'impulsió fixada w_I.';
      condition = 'T_I &= T_R - \\frac{w_R - w_I}{K}';
    } else if (mode === 'Q_I') {
      summary = 'El punt d\'impulsió (I) és el punt de la recta de maniobra per al qual el cabal necessari per absorbir la càrrega de la sala coincideix amb el cabal d\'impulsió fixat Q_I.';
      condition = '\\text{Condició:} &\\quad \\frac{q_{\\text{sala}}}{h_R - h_I(T)} \\cdot v_I(T) \\cdot 3600 = Q_I';
    } else {
      summary = 'El punt d\'impulsió (I) es troba a la intersecció entre la recta de maniobra de la sala que passa per R i la corba d\'humitat relativa d\'impulsió fixada (típicament φ_I = 90%).';
      condition = `w_{\\varphi_I}(T) &= 0.621945 \\cdot \\frac{\\varphi_I \\cdot P_{ws}(T)}{P - \\varphi_I \\cdot P_{ws}(T)} \\\\[6pt]
\\text{Condició:} &\\quad w_I(T_I) = w_{\\varphi_I}(T_I)`;
    }

    return {
      title: 'Pas 3: Determinació del Punt d\'Impulsió (I)',
      summary,
      latexFormula: `\\begin{aligned}
${lineEq}
${condition}
\\end{aligned}`,
      latexSubstituted: `\\begin{aligned}
\\text{Punt d'Impulsió (I):} \\\\[4pt]
T_I &= \\mathbf{${fmt(I.t, 2)}\\text{ °C}} \\\\[2pt]
\\varphi_I &= ${fmt(I.phi, 1)}\\% \\\\[2pt]
w_I &= \\mathbf{${fmt(I.w_g_kg, 2)}\\text{ g/kg a.s.}} \\\\[2pt]
h_I &= \\mathbf{${fmt(I.h, 2)}\\text{ kJ/kg}},\\quad v_I = ${fmt(I.v, 3)}\\text{ m}^3\\text{/kg}
\\end{aligned}`
    };
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

    const hasInfil = (pow.m_dot_v_infil || 0) > 0;
    // Cabal de ventilació que realment passa per la bateria (sense infiltració)
    const mVcoil = pow.m_dot_v_coil !== undefined ? pow.m_dot_v_coil : V.m_dot;
    const qRoom = pow.q_room !== undefined ? pow.q_room : pow.q_i;

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

      case 2: {
        const fcsUsed = hasInfil ? 'FCS_{\\text{sala}}' : 'FCS_i';
        const fcsVal = hasInfil ? pow.FCS_room : pow.FCS_i;
        const infilFormula = hasInfil ? `\\\\[6pt]
q_{s,\\text{sala}} &= q_{si} + \\dot{m}_{inf} \\, c_{pas} (T_v - T_R),\\quad q_{l,\\text{sala}} = q_{li} + \\dot{m}_{inf} \\, \\Delta h_{lg} (w_v - w_R) \\\\[6pt]
FCS_{\\text{sala}} &= \\frac{q_{s,\\text{sala}}}{q_{s,\\text{sala}} + q_{l,\\text{sala}}}` : '';
        const infilSubst = hasInfil ? `\\\\[6pt]
q_{s,\\text{sala}} &= ${fmt(pow.q_si + pow.q_s_infil, 2)}\\text{ kW},\\quad q_{l,\\text{sala}} = ${fmt(pow.q_li + pow.q_l_infil, 2)}\\text{ kW} \\quad (\\dot{m}_{inf} = ${fmt(pow.m_dot_v_infil, 4)}\\text{ kg/s}) \\\\[6pt]
FCS_{\\text{sala}} &= \\mathbf{${fmt(pow.FCS_room, 4)}}` : '';
        return {
          title: 'Pas 2: Càrregues Interiors i Recta de Maniobra de la Sala',
          summary: hasInfil
            ? 'Es calcula el Factor de Calor Sensible Interior (FCS_i). Com que part de l\'aire exterior entra per infiltració, la càrrega de la sala inclou la de la infiltració i el FCS de la sala defineix el pendent de la recta I–R.'
            : 'Es calcula el Factor de Calor Sensible Interior (FCS_i), que defineix el pendent de la recta que uneix l\'aire d\'impulsió (I) amb el de la sala (R).',
          latexFormula: `\\begin{aligned}
q_i &= q_{si} + q_{li} \\\\[6pt]
FCS_i &= \\frac{q_{si}}{q_i}${infilFormula} \\\\[6pt]
K &= \\frac{w_R - w_I}{T_R - T_I} = \\frac{1 - ${fcsUsed}}{${fcsUsed}} \\cdot \\frac{c_{pas}}{\\Delta h_{lg}}
\\end{aligned}`,
          latexSubstituted: `\\begin{aligned}
q_i &= ${fmt(pow.q_si, 2)} + ${fmt(pow.q_li, 2)} = ${fmt(pow.q_i, 2)}\\text{ kW} \\\\[6pt]
FCS_i &= \\frac{${fmt(pow.q_si, 2)}}{${fmt(pow.q_i, 2)}} = \\mathbf{${fmt(pow.FCS_i, 4)}}${infilSubst} \\\\[6pt]
K &= \\frac{1 - ${fmt(fcsVal, 4)}}{${fmt(fcsVal, 4)}} \\cdot \\frac{1.006}{2501} = \\mathbf{${fmt(sol.slopeRoom * 1000, 4)}\\text{ (g/kg)/°C}}
\\end{aligned}`
        };
      }

      case 3:
        return getImpulseStep(sol);

      case 4: {
        const qLabel = hasInfil ? 'q_{\\text{sala}}' : 'q_i';
        const infilFormula = hasInfil ? `\\\\[6pt]
q_{\\text{sala}} &= q_i + \\dot{m}_{inf} (h_v - h_R),\\quad \\dot{m}_{v,\\text{bat}} = (1 - fr_{inf}) \\, \\dot{m}_v` : '';
        const infilSubst = hasInfil ? `\\\\[2pt]
q_{\\text{sala}} &= ${fmt(pow.q_i, 2)} + ${fmt(pow.q_infil, 2)} = ${fmt(qRoom, 2)}\\text{ kW},\\quad \\dot{m}_{v,\\text{bat}} = \\mathbf{${fmt(mVcoil, 4)}\\text{ kg/s}}` : '';
        const mvSym = hasInfil ? '\\dot{m}_{v,\\text{bat}}' : '\\dot{m}_v';
        return {
          title: 'Pas 4: Balanç de Cabals d\'Aire',
          summary: `A partir de la diferència d'entalpia entre el retorn i la impulsió per absorbir la càrrega de la sala (${hasInfil ? 'q_sala' : 'q_i'}), es determinen els cabals necessaris.`,
          latexFormula: `\\begin{aligned}
\\dot{m}_v &= \\frac{Q_v}{3600 \\cdot v_v}${infilFormula} \\\\[6pt]
\\dot{m}_I &= \\frac{${qLabel}}{h_R - h_I} \\implies Q_I = \\dot{m}_I \\cdot v_I \\cdot 3600 \\\\[6pt]
\\dot{m}_R &= \\dot{m}_I - ${mvSym} \\implies Q_R = \\dot{m}_R \\cdot v_R \\cdot 3600
\\end{aligned}`,
          latexSubstituted: `\\begin{aligned}
\\dot{m}_v &= \\frac{${fmt(V.Q, 1)}}{3600 \\cdot ${fmt(V.v, 3)}} = \\mathbf{${fmt(V.m_dot, 4)}\\text{ kg/s}}${infilSubst} \\\\[6pt]
\\dot{m}_I &= \\frac{${fmt(qRoom, 2)}}{${fmt(R.h, 2)} - ${fmt(I.h, 2)}} = \\frac{${fmt(qRoom, 2)}}{${fmt(R.h - I.h, 2)}} = \\mathbf{${fmt(I.m_dot, 4)}\\text{ kg/s}} \\\\[2pt]
Q_I &= ${fmt(I.m_dot, 4)} \\cdot ${fmt(I.v, 3)} \\cdot 3600 = \\mathbf{${fmt(I.Q, 1)}\\text{ m}^3\\text{/h}} \\\\[6pt]
\\dot{m}_R &= ${fmt(I.m_dot, 4)} - ${fmt(mVcoil, 4)} = \\mathbf{${fmt(R.m_dot, 4)}\\text{ kg/s}} \\\\[2pt]
Q_R &= ${fmt(R.m_dot, 4)} \\cdot ${fmt(R.v, 3)} \\cdot 3600 = \\mathbf{${fmt(R.Q, 1)}\\text{ m}^3\\text{/h}}
\\end{aligned}`
        };
      }

      case 5:
        return {
          title: 'Pas 5: Cambra de Mescla (M)',
          summary: 'La barreja adiabàtica entre el cabal d\'aire exterior de ventilació i el cabal recirculat de retorn determina el punt de mescla (M) que entra a la bateria de fred.',
          latexFormula: `\\begin{aligned}
\\dot{m}_M &= \\dot{m}_I = \\dot{m}_{v,\\text{bat}} + \\dot{m}_R \\\\[6pt]
w_M &= \\frac{\\dot{m}_{v,\\text{bat}} \\cdot w_v + \\dot{m}_R \\cdot w_R}{\\dot{m}_M} \\\\[6pt]
h_M &= \\frac{\\dot{m}_{v,\\text{bat}} \\cdot h_v + \\dot{m}_R \\cdot h_R}{\\dot{m}_M}
\\end{aligned}`,
          latexSubstituted: `\\begin{aligned}
w_M &= \\frac{${fmt(mVcoil, 4)} \\cdot ${fmt(V.w_g_kg, 2)} + ${fmt(R.m_dot, 4)} \\cdot ${fmt(R.w_g_kg, 2)}}{${fmt(M.m_dot, 4)}} = \\mathbf{${fmt(M.w_g_kg, 2)}\\text{ g/kg}} \\\\[6pt]
h_M &= \\frac{${fmt(mVcoil, 4)} \\cdot ${fmt(V.h, 2)} + ${fmt(R.m_dot, 4)} \\cdot ${fmt(R.h, 2)}}{${fmt(M.m_dot, 4)}} = \\mathbf{${fmt(M.h, 2)}\\text{ kJ/kg}} \\\\[6pt]
T_M &= \\mathbf{${fmt(M.t, 2)}\\text{ °C}},\\quad \\varphi_M = \\mathbf{${fmt(M.phi, 1)}\\%}
\\end{aligned}`
        };

      case 6: {
        const formula = `\\begin{aligned}
\\text{Recta } M-I: &\\quad \\frac{w_M - w_I}{T_M - T_I} = \\frac{w_I - w_S}{T_I - T_S} \\\\[6pt]
\\text{Saturació:} &\\quad w_S = w_s(T_S) \\\\[6pt]
FBP &= \\frac{h_I - h_S}{h_M - h_S} \\approx \\frac{T_I - T_S}{T_M - T_S}
\\end{aligned}`;
        if (!S) {
          return {
            title: 'Pas 6: Bateria de Fred, Superfície (S) i Bypass (FBP)',
            summary: 'La prolongació de la recta de bateria M–I no talla la corba de saturació: amb una sola bateria de fred no existeix punt de superfície (S) ni factor de bypass. Caldria refredar més i postescalfar.',
            latexFormula: formula,
            latexSubstituted: '\\text{No hi ha intersecció de la recta } M-I \\text{ amb } \\varphi = 100\\%'
          };
        }
        return {
          title: 'Pas 6: Bateria de Fred, Superfície (S) i Bypass (FBP)',
          summary: 'El procés a la bateria uneix la mescla (M) amb l\'estat d\'impulsió (I). La prolongació d\'aquesta recta fins a la corba de saturació (φ = 100%) defineix el punt de superfície de bateria (S) i el factor de bypass.',
          latexFormula: formula,
          latexSubstituted: `\\begin{aligned}
\\text{Superfície de Bateria (S):} \\\\[2pt]
T_S &= \\mathbf{${fmt(S.t, 2)}\\text{ °C}},\\quad \\varphi_S = 100\\%,\\quad w_S = \\mathbf{${fmt(S.w_g_kg, 2)}\\text{ g/kg}} \\\\[8pt]
\\text{Factor de Bypass (FBP):} \\\\[2pt]
FBP &= \\frac{${fmt(I.t, 2)} - ${fmt(S.t, 2)}}{${fmt(M.t, 2)} - ${fmt(S.t, 2)}} = \\frac{${fmt(I.t - S.t, 2)}}{${fmt(M.t - S.t, 2)}} = \\mathbf{${fmt(pow.FBP, 4)}}
\\end{aligned}`
        };
      }

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

  function renderLatex(container, latex) {
    if (!container) return;
    if (!latex) {
      container.textContent = '';
      return;
    }
    if (typeof katex === 'undefined') {
      // KaTeX no disponible (p. ex. sense connexió al CDN): mostrar el codi font
      container.textContent = latex;
      return;
    }
    try {
      katex.render(latex, container, { displayMode: true, throwOnError: false });
    } catch (err) {
      console.warn('KaTeX render fallback:', err);
      container.textContent = latex;
    }
  }

  function renderCurrentStep() {
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
    renderLatex(document.getElementById('debug-latex-formula'), data.latexFormula);
    renderLatex(document.getElementById('debug-latex-substituted'), data.latexSubstituted);

    // Actualitzar botons de navegació
    const btnPrev = document.getElementById('debug-btn-prev');
    const btnFirst = document.getElementById('debug-btn-first');
    const btnNext = document.getElementById('debug-btn-next');
    const btnLast = document.getElementById('debug-btn-last');

    const noData = !activeSolution;
    if (btnPrev) btnPrev.disabled = noData || (currentStep === 1);
    if (btnFirst) btnFirst.disabled = noData || (currentStep === 1);
    if (btnNext) btnNext.disabled = noData || (currentStep === TOTAL_STEPS);
    if (btnLast) btnLast.disabled = noData || (currentStep === TOTAL_STEPS);

    // Sincronitzar diagrama psicromètric amb el pas actual
    PsychroChart.render(activeSolution, currentStep, 'debug-psychro-container');
  }

  /**
   * Assigna una nova solució. Per defecte torna al pas 1; amb { keepStep: true }
   * es manté el pas actual (p. ex. quan es recalcula mentre l'usuari edita dades).
   */
  function setSolution(sol, options = {}) {
    activeSolution = sol;
    if (!options.keepStep) currentStep = 1;
    renderCurrentStep();
  }

  /**
   * Esborra la solució activa (dades incompletes o error de càlcul)
   */
  function clear() {
    activeSolution = null;
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
    clear,
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
