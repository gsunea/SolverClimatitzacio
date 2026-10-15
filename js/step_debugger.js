/**
 * step_debugger.js
 * Mòdul de resolució pas a pas interactiva (estil debugger)
 * amb equacions en LaTeX (KaTeX) i valors numèrics reals de l'exercici.
 */

const StepDebugger = (() => {
  let currentStep = 1;
  const TOTAL_STEPS = 8;
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

    if (sol.coil && sol.coil.corrected) {
      summary += ` Atenció: la impulsió s'ha recalculat cap enrere perquè la temperatura de la bateria no baixi del límit (vegeu el pas 8); la condició inicial ja no es manté.`;
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

    // Passos 1-6: càlcul normal (sense fixar T_bat). Els passos 7-8 usen la solució corregida.
    const finalSol = sol;
    if (stepIndex < 7 && sol.naturalSolution) sol = sol.naturalSolution;
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

    const coilStep = (titleTxt, opts = {}) => {
        const coil = sol.coil || {};
        const lim = coil.limits || { min: 7, warn: 9 };
        const T = coil.T;
        const statusText = {
          viable: 'Viable',
          ojo: 'Compte (zona límit)',
          no_viable: 'NO viable',
          sense_S: 'No determinable'
        }[coil.status] || '—';
        // Equacions (alineades a l'esquerra, línies curtes perquè càpiguen a la targeta)
        const baseLines = `T_{bat} = T_S \\quad (\\text{superfície de la bateria, } \\varphi_S = 100\\%) \\\\[6pt]
\\begin{cases}
T_{bat} > ${lim.warn}\\,^\\circ\\text{C} & \\Rightarrow \\text{viable} \\\\
${lim.min}\\,^\\circ\\text{C} \\le T_{bat} \\le ${lim.warn}\\,^\\circ\\text{C} & \\Rightarrow \\text{compte} \\\\
T_{bat} < ${lim.min}\\,^\\circ\\text{C} & \\Rightarrow \\text{no viable}
\\end{cases} \\\\[2pt]
\\text{Si } T_{bat} < ${lim.min}\\,^\\circ\\text{C}: \\text{ fixar } T_S = ${lim.min}\\,^\\circ\\text{C} \\text{ i recalcular } I \\text{ cap enrere}`;

        const nat = coil.natural || {};
        const rc = coil.recalc;
        const hasProc = !opts.noProc && !!(rc && (rc.failed || (coil.corrected && Array.isArray(rc.trials))));

        if (!hasProc) {
          if (T === null || T === undefined) {
            return {
              title: titleTxt,
              summary: coil.message || 'Sense dades de bateria.',
              latexFormula: `\\begin{array}{l}
${baseLines}
\\end{array}`,
              latexSubstituted: `\\begin{array}{l}
\\text{No hi ha punt de superfície (S): la recta } M-I \\text{ no talla } \\varphi = 100\\%
\\end{array}`
            };
          }
          return {
            title: titleTxt,
            summary: coil.message || 'Sense dades de bateria.',
            latexFormula: `\\begin{array}{l}
${baseLines}
\\end{array}`,
            latexSubstituted: `\\begin{array}{l}
T_{bat} = T_S = \\mathbf{${fmt(T, 2)}\\,^\\circ\\text{C}} \\\\[6pt]
\\text{Estat: } \\mathbf{\\text{${statusText}}}
\\end{array}`
          };
        }

        // --- Procediment de recàlcul cap enrere (T_S fixada) ---
        const target = rc.target;
        const oaNat = !!nat.allOutdoorAir;
        const formula = `\\begin{array}{l}
${baseLines} \\\\[14pt]
\\textbf{Recàlcul cap enrere amb } T_S = ${fmt(target, 1)}\\,^\\circ\\text{C}\\textbf{:} \\\\[6pt]
\\text{1) Incògnita: } T_I \\text{ sobre la recta de maniobra} \\\\
\\qquad w_I(T_I) = w_R - K\\,(T_R - T_I) \\\\[6pt]
\\text{2) Cabals per a cada } T_I \\\\
\\qquad \\dot{m}_I = \\dfrac{q_{\\text{sala}}}{h_R - h_I(T_I)},\\quad \\dot{m}_R = \\dot{m}_I - \\dot{m}_{v,\\text{bat}} \\ge 0 \\\\[6pt]
\\text{3) Mescla } M(T_I) \\\\
\\qquad w_M = \\dfrac{\\dot{m}_{v,\\text{bat}}\\, w_v + \\dot{m}_R\\, w_R}{\\dot{m}_I},\\quad h_M = \\dfrac{\\dot{m}_{v,\\text{bat}}\\, h_v + \\dot{m}_R\\, h_R}{\\dot{m}_I} \\\\[6pt]
\\text{4) Recta } M-I \\text{ prolongada fins a } \\varphi = 100\\% \\Rightarrow T_S(T_I) \\\\[6pt]
\\text{5) Condició: } T_S(T_I) = ${fmt(target, 1)}\\,^\\circ\\text{C} \\Rightarrow \\text{escaneig de } T_I \\text{ i bisecció}
\\end{array}`;

        if (rc.failed) {
          const rngS = (Number.isFinite(rc.T_S_min) && Number.isFinite(rc.T_S_max))
            ? `T_S \\in [${fmt(rc.T_S_min, 2)},\\, ${fmt(rc.T_S_max, 2)}]\\,^\\circ\\text{C}`
            : `T_S \\text{ no definida (la recta } M-I \\text{ no talla } \\varphi=100\\%)`;
          const rngI = (Number.isFinite(rc.T_I_min) && Number.isFinite(rc.T_I_max))
            ? `T_I \\in [${fmt(rc.T_I_min, 1)},\\, ${fmt(rc.T_I_max, 1)}]\\,^\\circ\\text{C}`
            : '';
          const stT = (T === null || T === undefined) ? '\\text{no determinable}' : `${fmt(T, 2)}\\,^\\circ\\text{C}`;
          const failedSubst = `\\begin{array}{l}
\\text{Dades: } q_{\\text{sala}} = ${fmt(qRoom, 2)}\\text{ kW},\\; \\dot{m}_{v,\\text{bat}} = ${fmt(mVcoil, 4)}\\text{ kg/s} \\\\
\\qquad K = ${fmt(sol.slopeRoom * 1000, 4)}\\text{ (g/kg)/°C} \\\\[8pt]
\\text{Situació inicial: } T_S = ${nat.T_S !== undefined && nat.T_S !== null ? fmt(nat.T_S, 2) : '\\text{--}'}\\,^\\circ\\text{C} < ${fmt(lim.min, 0)}\\,^\\circ\\text{C} \\Rightarrow \\text{no viable} \\\\[10pt]
\\text{Escaneig de } T_I \\text{ (${rc.samples || 0} punts vàlids): } ${rngI} \\\\
\\qquad \\Rightarrow ${rngS} \\\\
\\text{Cap } T_I \\text{ dona } T_S = ${fmt(rc.target, 1)}\\,^\\circ\\text{C} \\Rightarrow \\text{no hi ha solució cap enrere} \\\\[10pt]
T_{bat} = T_S = \\mathbf{${stT}} \\Rightarrow \\mathbf{\\text{${statusText}}}
\\end{array}`;
          return {
            title: titleTxt,
            summary: coil.message || 'No s\'ha pogut fixar T_bat.',
            latexFormula: formula,
            latexSubstituted: failedSubst
          };
        }

        const rows = rc.trials.map(t => {
          const tsTxt = Number.isFinite(t.T_S) ? fmt(t.T_S, 3) : '\\infty';
          return `\\text{${t.label}} & ${fmt(t.T_I, 3)} & ${fmt(t.phi_I, 1)} & ${fmt(t.m_I, 4)} & ${fmt(t.m_R, 4)} & ${fmt(t.T_M, 2)} & ${tsTxt}`;
        }).join(' \\\\\n');
        const table = `\\begin{array}{lrrrrrr}
\\text{Iteració} & T_I & \\varphi_I & \\dot{m}_I & \\dot{m}_R & T_M & T_S \\\\
 & {}^\\circ\\text{C} & \\% & \\text{kg/s} & \\text{kg/s} & {}^\\circ\\text{C} & {}^\\circ\\text{C} \\\\
\\hline
${rows}
\\end{array}`;

        const oaLines = oaNat ? ` \\\\[6pt]
\\quad \\dot{m}_{v,\\text{bat}} = ${fmt(mVcoil, 4)} > \\dot{m}_{I,\\text{bal}} = ${fmt(nat.m_dot_I_balance, 4)}\\text{ kg/s} \\\\
\\quad \\Rightarrow \\dot{m}_I = \\dot{m}_v,\\; \\dot{m}_R = 0 \\;(\\text{100\\% aire exterior}) \\\\
\\quad \\text{Es cerquen impulsions amb } \\dot{m}_I \\ge \\dot{m}_v \\text{ (torna la recirculació)}` : '';

        const substituted = `\\begin{array}{l}
\\text{Dades: } q_{\\text{sala}} = ${fmt(qRoom, 2)}\\text{ kW},\\; \\dot{m}_{v,\\text{bat}} = ${fmt(mVcoil, 4)}\\text{ kg/s} \\\\
\\qquad K = ${fmt(sol.slopeRoom * 1000, 4)}\\text{ (g/kg)/°C} \\\\[8pt]
\\text{Situació inicial: } T_S = ${fmt(nat.T_S, 2)}\\,^\\circ\\text{C} < ${fmt(lim.min, 0)}\\,^\\circ\\text{C} \\Rightarrow \\text{no viable}${oaLines} \\\\[10pt]
\\text{Tempteig de } T_I \\text{ fins que } T_S = ${fmt(target, 1)}\\,^\\circ\\text{C}\\text{:} \\\\[4pt]
${table} \\\\[10pt]
\\textbf{Càlcul de la solució trobada (nous valors):} \\\\[4pt]
\\quad w_I = w_R - K\\,(T_R - T_I) \\\\
\\qquad = ${fmt(R.w_g_kg, 2)} - ${fmt(sol.slopeRoom * 1000, 4)}\\,(${fmt(R.t, 1)} - ${fmt(I.t, 2)}) \\\\
\\qquad = ${fmt(I.w_g_kg, 2)}\\text{ g/kg} \\\\
\\qquad h_I = ${fmt(I.h, 2)}\\text{ kJ/kg} \\\\
\\quad \\dot{m}_I = \\dfrac{${fmt(qRoom, 2)}}{${fmt(R.h, 2)} - ${fmt(I.h, 2)}} = ${fmt(I.m_dot, 4)}\\text{ kg/s} \\\\
\\quad \\dot{m}_R = ${fmt(I.m_dot, 4)} - ${fmt(mVcoil, 4)} = ${fmt(R.m_dot, 4)}\\text{ kg/s} \\\\
\\quad w_M = \\dfrac{${fmt(mVcoil, 4)}\\cdot ${fmt(V.w_g_kg, 2)} + ${fmt(R.m_dot, 4)}\\cdot ${fmt(R.w_g_kg, 2)}}{${fmt(I.m_dot, 4)}} = ${fmt(M.w_g_kg, 2)}\\text{ g/kg} \\\\
\\quad h_M = \\dfrac{${fmt(mVcoil, 4)}\\cdot ${fmt(V.h, 2)} + ${fmt(R.m_dot, 4)}\\cdot ${fmt(R.h, 2)}}{${fmt(I.m_dot, 4)}} = ${fmt(M.h, 2)}\\text{ kJ/kg}\\\\
\\qquad \\Rightarrow T_M = ${fmt(M.t, 2)}\\,^\\circ\\text{C} \\\\
\\quad \\text{Recta } M-I \\text{ fins a } \\varphi = 100\\% \\Rightarrow T_S = ${S ? fmt(S.t, 2) : '\\text{--}'}\\,^\\circ\\text{C} \\\\
\\qquad w_S = ${S ? fmt(S.w_g_kg, 2) : '\\text{--}'}\\text{ g/kg} \\\\[10pt]
\\textbf{Resultat:} \\\\
\\quad T_I = \\mathbf{${fmt(I.t, 2)}\\,^\\circ\\text{C}},\\; \\varphi_I = \\mathbf{${fmt(I.phi, 1)}\\%} \\\\
\\quad \\dot{m}_I = \\mathbf{${fmt(I.m_dot, 4)}\\text{ kg/s}},\\; \\dot{m}_R = \\mathbf{${fmt(R.m_dot, 4)}\\text{ kg/s}} \\\\
\\quad T_M = ${fmt(M.t, 2)}\\,^\\circ\\text{C},\\; T_S = \\mathbf{${fmt(T, 2)}\\,^\\circ\\text{C}} \\Rightarrow \\mathbf{\\text{${statusText}}}
\\end{array}`;

        return {
          title: titleTxt,
          summary: coil.message || 'Sense dades de bateria.',
          latexFormula: formula,
          latexSubstituted: substituted
        };
    };

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
        const mIbal = pow.m_dot_I_balance !== undefined ? pow.m_dot_I_balance : I.m_dot;
        const oa = !!sol.allOutdoorAir;
        const oaFormula = oa ? `\\\\[6pt]
\\dot{m}_{v,\\text{bat}} > \\dot{m}_{I,\\text{bal}} &\\implies \\dot{m}_I = \\dot{m}_{v,\\text{bat}},\\quad \\dot{m}_R = 0` : '';
        const oaSubst = oa ? `\\\\[6pt]
\\dot{m}_{I,\\text{bal}} &= ${fmt(mIbal, 4)}\\text{ kg/s} < \\dot{m}_{v,\\text{bat}} = ${fmt(mVcoil, 4)}\\text{ kg/s} \\implies \\dot{m}_I = \\mathbf{${fmt(I.m_dot, 4)}\\text{ kg/s}},\\; \\dot{m}_R = \\mathbf{0}` : '';
        return {
          title: 'Pas 4: Balanç de Cabals d\'Aire',
          summary: `A partir de la diferència d'entalpia entre el retorn i la impulsió per absorbir la càrrega de la sala (${hasInfil ? 'q_sala' : 'q_i'}), es determinen els cabals màssics de ventilació (ṁ_v = ${fmt(V.m_dot, 4)} kg/s), impulsió (ṁ_I = ${fmt(I.m_dot, 4)} kg/s) i retorn (ṁ_R = ${fmt(R.m_dot, 4)} kg/s).${oa ? ' Com que ṁ_v supera el cabal d\'impulsió necessari, es pren ṁ_I = ṁ_v i ṁ_R = 0 (100% aire exterior).' : ''}`,
          latexFormula: `\\begin{aligned}
\\dot{m}_v &= \\frac{Q_v}{3600 \\cdot v_v}${infilFormula} \\\\[6pt]
\\dot{m}_I &= \\frac{${qLabel}}{h_R - h_I} \\implies Q_I = \\dot{m}_I \\cdot v_I \\cdot 3600 \\\\[6pt]
\\dot{m}_R &= \\dot{m}_I - ${mvSym} \\implies Q_R = \\dot{m}_R \\cdot v_R \\cdot 3600${oaFormula}
\\end{aligned}`,
          latexSubstituted: `\\begin{aligned}
\\dot{m}_v &= \\frac{${fmt(V.Q, 1)}}{3600 \\cdot ${fmt(V.v, 3)}} = \\mathbf{${fmt(V.m_dot, 4)}\\text{ kg/s}}${infilSubst} \\\\[6pt]
\\dot{m}_I &= \\frac{${fmt(qRoom, 2)}}{${fmt(R.h, 2)} - ${fmt(I.h, 2)}} = \\frac{${fmt(qRoom, 2)}}{${fmt(R.h - I.h, 2)}} = \\mathbf{${fmt(I.m_dot, 4)}\\text{ kg/s}} \\\\[2pt]
Q_I &= ${fmt(I.m_dot, 4)} \\cdot ${fmt(I.v, 3)} \\cdot 3600 = \\mathbf{${fmt(I.Q, 1)}\\text{ m}^3\\text{/h}} \\\\[6pt]
\\dot{m}_R &= ${fmt(I.m_dot, 4)} - ${fmt(mVcoil, 4)} = \\mathbf{${fmt(R.m_dot, 4)}\\text{ kg/s}} \\\\[2pt]
Q_R &= ${fmt(R.m_dot, 4)} \\cdot ${fmt(R.v, 3)} \\cdot 3600 = \\mathbf{${fmt(R.Q, 1)}\\text{ m}^3\\text{/h}}${oaSubst}
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
        const lim6 = (sol.coil && sol.coil.limits) || { min: 7 };
        const low6 = sol.coil && Number.isFinite(sol.coil.T) && sol.coil.T < lim6.min - 0.05;
        const jump6 = finalSol.naturalSolution ? 'es fixa T_S = ' + lim6.min + ' °C i es recalcula cap enrere (Pas 7)' : 'no s\'ha trobat cap recàlcul possible (Pas 8)';
        const alert6 = low6 ? ` \\\\[12pt]
\\begin{array}{l}
\\textbf{T}_S = ${fmt(S.t, 2)}\\,^\\circ\\text{C} < ${fmt(lim6.min, 0)}\\,^\\circ\\text{C} \\Rightarrow \\textbf{NO viable} \\\\
${finalSol.naturalSolution ? "\\text{S'atura el càlcul cap endavant:} \\\\ \\text{es fixa } T_S = " + lim6.min + "\\,^\\circ\\text{C i es recalcula cap enrere (Pas 7)}" : "\\text{S'atura el càlcul: no hi ha recàlcul possible (Pas 8)}"}
\\end{array}` : '';
        return {
          title: 'Pas 6: Bateria de Fred, Superfície (S) i Bypass (FBP)',
          summary: (low6 ? 'ATENCIÓ: T_S < ' + lim6.min + ' °C, la bateria no és viable; ' + jump6 + '. ' : '') + 'El procés a la bateria uneix la mescla (M) amb l\'estat d\'impulsió (I). La prolongació d\'aquesta recta fins a la corba de saturació (φ = 100%) defineix el punt de superfície de bateria (S) i el factor de bypass.',
          latexFormula: formula,
          latexSubstituted: `\\begin{aligned}
\\text{Superfície de Bateria (S):} \\\\[2pt]
T_S &= \\mathbf{${fmt(S.t, 2)}\\text{ °C}},\\quad \\varphi_S = 100\\%,\\quad w_S = \\mathbf{${fmt(S.w_g_kg, 2)}\\text{ g/kg}} \\\\[8pt]
\\text{Factor de Bypass (FBP):} \\\\[2pt]
FBP &= \\frac{${fmt(I.t, 2)} - ${fmt(S.t, 2)}}{${fmt(M.t, 2)} - ${fmt(S.t, 2)}} = \\frac{${fmt(I.t - S.t, 2)}}{${fmt(M.t - S.t, 2)}} = \\mathbf{${fmt(pow.FBP, 4)}}
\\end{aligned}${alert6}`
        };
      }

      case 7:
        if (finalSol.naturalSolution) {
          const c7 = coilStep('Pas 7: T_bat < 7 °C → recàlcul cap enrere amb T_S = 7 °C', {});
          c7.latexSubstituted = c7.latexSubstituted.replace(/\\end\{array\}$/, `\\\\[10pt]
\\textbf{Condensats i potència amb els valors nous:} \\\\
\\quad \\dot{M}_{cond} = ${fmt(pow.M_cond_h, 2)}\\text{ kg H}_2\\text{O/h} \\\\
\\quad q_{\\text{bateria}} = ${fmt(pow.q_bateria, 2)}\\text{ kW},\\; q_{\\text{total}} = ${fmt(pow.q_total, 2)}\\text{ kW}
\\end{array}`);
          c7.summary = 'Diagrama: en gris, el procés inicial no viable (M₀, I₀, S₀); en color, el procés desplaçat (M, I, S) amb la recta de bateria M–I recalculada perquè talli la saturació a T_S = 7 °C. ' + c7.summary;
          return c7;
        }
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


      case 8: {
        if (finalSol.naturalSolution) {
          return coilStep('Pas 8: Temperatura de la Bateria i Viabilitat', { noProc: true });
        }
        return coilStep('Pas 8: Temperatura de la Bateria i Viabilitat');
      }

      default:
        return { title: '', summary: '', latexFormula: '', latexSubstituted: '' };
    }
  }

  function renderLatex(container, latex) {
    if (!container) return;
    if (latex === undefined || latex === null || latex === '' || latex === 'undefined') {
      container.textContent = '';
      return;
    }
    latex = String(latex);
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

    let data;
    try {
      data = getStepContent(currentStep, activeSolution);
    } catch (err) {
      // Si un pas falla, es mostra l'error en lloc de deixar valors buits o "undefined"
      console.error(`Error generant el pas ${currentStep}:`, err);
      data = {
        title: `Pas ${currentStep}: error en generar el contingut`,
        summary: `No s'ha pogut generar aquest pas (${err.message}).`,
        latexFormula: '',
        latexSubstituted: ''
      };
    }
    data.title = data.title || '';
    data.summary = data.summary || '';

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
    PsychroChart.render((currentStep < 7 && activeSolution && activeSolution.naturalSolution) ? activeSolution.naturalSolution : activeSolution, currentStep, 'debug-psychro-container');
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
