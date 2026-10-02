/**
 * chart.js
 * Renderitzador vectorial (SVG) del Diagrama Psicromètric autèntic (Carta Carrier / ASHRAE).
 * Suporta renderització pas a pas per al mode debugger (maxStep 1..7) i pantalla completa.
 */

const PsychroChart = (() => {
  let defaultContainerId = 'psychro-container';

  const T_MIN = 0;
  const T_MAX = 42;
  const W_MIN = 0;
  const W_MAX = 28; // g/kg

  const WIDTH = 760;
  const HEIGHT = 580;
  const MARGIN = { top: 40, right: 65, bottom: 55, left: 55 };
  const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
  const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;

  function toX(T) {
    return MARGIN.left + ((T - T_MIN) / (T_MAX - T_MIN)) * PLOT_W;
  }

  function toY(w_g_kg) {
    return MARGIN.top + PLOT_H - ((w_g_kg - W_MIN) / (W_MAX - W_MIN)) * PLOT_H;
  }

  /**
   * Genera el fons i les línies base de la carta psicromètrica
   */
  function buildBaseSvg(P, lib) {
    let svg = `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" width="100%" height="100%" class="psychro-svg" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<defs>
      <clipPath id="chart-clip">
        <rect x="${MARGIN.left}" y="${MARGIN.top}" width="${PLOT_W}" height="${PLOT_H}" />
      </clipPath>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.2"/>
      </filter>
    </defs>`;

    // Fons blanc
    svg += `<rect x="${MARGIN.left}" y="${MARGIN.top}" width="${PLOT_W}" height="${PLOT_H}" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2"/>`;

    // 1. Malla de temperatura seca cada 5 °C
    for (let T = T_MIN; T <= T_MAX; T += 5) {
      const x = toX(T);
      const isMajor = (T % 10 === 0);
      svg += `<line x1="${x}" y1="${MARGIN.top}" x2="${x}" y2="${MARGIN.top + PLOT_H}" stroke="${isMajor ? '#e2e8f0' : '#f8fafc'}" stroke-width="${isMajor ? 1 : 0.8}"/>`;
      svg += `<text x="${x}" y="${MARGIN.top + PLOT_H + 20}" font-size="11" fill="#475569" text-anchor="middle" font-family="system-ui, sans-serif">${T}</text>`;
    }

    // Línies d'humitat cada 2 g/kg
    for (let w = W_MIN; w <= W_MAX; w += 2) {
      const y = toY(w);
      const isMajor = (w % 5 === 0 || w % 10 === 0);
      svg += `<line x1="${MARGIN.left}" y1="${y}" x2="${MARGIN.left + PLOT_W}" y2="${y}" stroke="${isMajor ? '#e2e8f0' : '#f8fafc'}" stroke-width="${isMajor ? 1 : 0.8}"/>`;
      svg += `<text x="${MARGIN.left + PLOT_W + 10}" y="${y + 4}" font-size="11" fill="#475569" text-anchor="start" font-family="system-ui, sans-serif">${w}</text>`;
    }

    // 2. Línies d'entalpia constant / temperatura humida
    const enthalpyValues = [20, 30, 40, 50, 60, 70, 80, 90];
    enthalpyValues.forEach(h_kJ => {
      let points = [];
      for (let T = T_MIN; T <= T_MAX; T += 1) {
        const h_J = h_kJ * 1000.0;
        const w = lib.GetHumRatioFromEnthalpyAndTDryBulb(h_J, T);
        const w_g_kg = w * 1000.0;
        const wSat = lib.GetSatHumRatio(T, P) * 1000.0;
        if (w_g_kg >= W_MIN && w_g_kg <= wSat && w_g_kg <= W_MAX) {
          points.push({ x: toX(T), y: toY(w_g_kg) });
        }
      }
      if (points.length >= 2) {
        let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
        for (let i = 1; i < points.length; i++) {
          d += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
        }
        svg += `<path d="${d}" fill="none" stroke="#e2e8f0" stroke-dasharray="3,3" stroke-width="0.9" clip-path="url(#chart-clip)"/>`;
        const firstPt = points[0];
        svg += `<text x="${firstPt.x - 4}" y="${firstPt.y - 4}" font-size="9" fill="#94a3b8" text-anchor="end" font-family="var(--font-mono), monospace">${h_kJ}</text>`;
      }
    });

    // 3. Línies de volum específic
    const vValues = [0.80, 0.82, 0.84, 0.86, 0.88, 0.90];
    vValues.forEach(vTarget => {
      let points = [];
      for (let T = T_MIN; T <= T_MAX; T += 1) {
        const TK = T + 273.15;
        const term = (vTarget * P * 28.966) / (8.314472 * 1000.0 * TK);
        const w = (term - 1.0) / 1.607858;
        const w_g_kg = w * 1000.0;
        if (w_g_kg >= W_MIN && w_g_kg <= W_MAX) {
          points.push({ x: toX(T), y: toY(w_g_kg) });
        }
      }
      if (points.length >= 2) {
        let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
        for (let i = 1; i < points.length; i++) {
          d += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
        }
        svg += `<path d="${d}" fill="none" stroke="#e0f2fe" stroke-width="1" clip-path="url(#chart-clip)"/>`;
        const lastPt = points[points.length - 1];
        if (lastPt.y < MARGIN.top + PLOT_H - 10) {
          svg += `<text x="${lastPt.x + 3}" y="${lastPt.y + 12}" font-size="9" fill="#38bdf8" text-anchor="start" font-family="var(--font-mono), monospace">${vTarget}</text>`;
        }
      }
    });

    // 4. Corbes d'Humitat Relativa (φ = 10% a 90%)
    const phiValues = [10, 20, 30, 40, 50, 60, 70, 80, 90];
    phiValues.forEach(phi => {
      let pathD = '';
      let labelPoint = null;
      for (let T = T_MIN; T <= T_MAX; T += 0.5) {
        const w = lib.GetHumRatioFromRelHum(T, phi / 100.0, P);
        const w_g_kg = w * 1000.0;
        if (w_g_kg <= W_MAX) {
          const x = toX(T);
          const y = toY(w_g_kg);
          if (!pathD) pathD = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
          else pathD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
          if (T >= 36 && !labelPoint) labelPoint = { x, y };
        }
      }
      svg += `<path d="${pathD}" fill="none" stroke="#94a3b8" stroke-width="0.9" clip-path="url(#chart-clip)"/>`;
      if (labelPoint) {
        svg += `<text x="${labelPoint.x}" y="${labelPoint.y - 4}" font-size="9.5" fill="#64748b" font-weight="600" text-anchor="middle" font-family="var(--font-mono), monospace">${phi}%</text>`;
      }
    });

    // 5. Corba de Saturació (φ = 100%)
    let satPath = '';
    let satPolyPoints = [];
    for (let T = T_MIN; T <= T_MAX; T += 0.5) {
      const w = lib.GetSatHumRatio(T, P);
      const w_g_kg = w * 1000.0;
      if (w_g_kg <= W_MAX) {
        const x = toX(T);
        const y = toY(w_g_kg);
        if (!satPath) satPath = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
        else satPath += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        satPolyPoints.push({ x, y });
      }
    }

    if (satPolyPoints.length > 0) {
      const first = satPolyPoints[0];
      const last = satPolyPoints[satPolyPoints.length - 1];
      let fogD = `M ${MARGIN.left} ${MARGIN.top} L ${last.x.toFixed(1)} ${MARGIN.top}`;
      for (let i = satPolyPoints.length - 1; i >= 0; i--) {
        fogD += ` L ${satPolyPoints[i].x.toFixed(1)} ${satPolyPoints[i].y.toFixed(1)}`;
      }
      fogD += ` L ${MARGIN.left} ${first.y.toFixed(1)} Z`;
      svg += `<path d="${fogD}" fill="#f8fafc" stroke="none" clip-path="url(#chart-clip)"/>`;
    }

    svg += `<path d="${satPath}" fill="none" stroke="#0284c7" stroke-width="2.5" clip-path="url(#chart-clip)"/>`;
    svg += `<text x="${toX(18)}" y="${toY(lib.GetSatHumRatio(18, P) * 1000) - 8}" font-size="10" fill="#0284c7" font-weight="700" font-family="var(--font-mono), monospace">φ = 100% (Saturació)</text>`;

    // Títols dels eixos
    svg += `<text x="${MARGIN.left + PLOT_W / 2}" y="${HEIGHT - 12}" font-size="11" font-weight="600" fill="#374151" text-anchor="middle" font-family="var(--font-sans), sans-serif">Temperatura Seca T (°C)</text>`;
    svg += `<text transform="rotate(-90)" x="${-(MARGIN.top + PLOT_H / 2)}" y="${WIDTH - 12}" font-size="11" font-weight="600" fill="#374151" text-anchor="middle" font-family="var(--font-sans), sans-serif">Humitat Absoluta w (g/kg a.s.)</text>`;

    return svg;
  }

  /**
   * Renderitza el diagrama.
   * @param {Object} sol - Solució calculada
   * @param {Number} maxStep - Pas màxim a dibuixar (1..7, per defecte 7 = cicle complet)
   * @param {String} targetId - ID del contenidor HTML (per defecte defaultContainerId)
   */
  function render(sol, maxStep = 7, targetId = null) {
    const id = targetId || defaultContainerId;
    const container = document.getElementById(id);
    if (!container) return;

    const lib = window.psychrolib;
    if (!lib) return;

    const P = sol ? sol.powers.P_atm_Pa : 101325;
    let svg = buildBaseSvg(P, lib);

    if (sol && sol.points) {
      const pts = sol.points;
      const V = pts.V;
      const R = pts.R;
      const M = pts.M;
      const I = pts.I;
      const S = pts.S;

      // Pas 4+: Recta de mescla V - R
      if (maxStep >= 4) {
        svg += `<line x1="${toX(V.t)}" y1="${toY(V.w_g_kg)}" x2="${toX(R.t)}" y2="${toY(R.w_g_kg)}" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="6,4" clip-path="url(#chart-clip)"/>`;
      }

      // Pas 6+: Procés de bateria M - I i prolongació a S
      if (maxStep >= 6) {
        svg += `<line x1="${toX(M.t)}" y1="${toY(M.w_g_kg)}" x2="${toX(I.t)}" y2="${toY(I.w_g_kg)}" stroke="#0284c7" stroke-width="3" clip-path="url(#chart-clip)"/>`;
        svg += `<line x1="${toX(I.t)}" y1="${toY(I.w_g_kg)}" x2="${toX(S.t)}" y2="${toY(S.w_g_kg)}" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3,3" clip-path="url(#chart-clip)"/>`;
      }

      // Pas 2+: Maniobra de sala I - R (o recta que passa per R)
      if (maxStep >= 2) {
        const xStart = (maxStep >= 3) ? toX(I.t) : toX(R.t - 15);
        const yStart = (maxStep >= 3) ? toY(I.w_g_kg) : toY(R.w_g_kg - sol.slopeRoom * 15 * 1000);
        svg += `<line x1="${xStart}" y1="${yStart}" x2="${toX(R.t)}" y2="${toY(R.w_g_kg)}" stroke="#ef4444" stroke-width="${maxStep >= 3 ? 3 : 2}" stroke-dasharray="${maxStep >= 3 ? 'none' : '4,3'}" clip-path="url(#chart-clip)"/>`;
      }

      // Llista de punts segons el pas
      const pointList = [];
      if (maxStep >= 1) {
        pointList.push({ pt: V, name: 'V (Ventilació)', color: '#f59e0b', dx: 10, dy: -6 });
        pointList.push({ pt: R, name: 'R (Retorn)', color: '#10b981', dx: 10, dy: 14 });
      }
      if (maxStep >= 3) {
        pointList.push({ pt: I, name: 'I (Impulsió)', color: '#0ea5e9', dx: -10, dy: 14, anchor: 'end' });
      }
      if (maxStep >= 5) {
        pointList.push({ pt: M, name: 'M (Mescla)', color: '#8b5cf6', dx: -12, dy: -12, anchor: 'end' });
      }
      if (maxStep >= 6) {
        pointList.push({ pt: S, name: 'S (Superfície)', color: '#06b6d4', dx: -12, dy: -8, anchor: 'end' });
      }

      pointList.forEach(item => {
        const x = toX(item.pt.t);
        const y = toY(item.pt.w_g_kg);
        const anchor = item.anchor || 'start';

        svg += `<circle cx="${x}" cy="${y}" r="6.5" fill="${item.color}" stroke="#ffffff" stroke-width="2.5" filter="url(#shadow)"/>`;
        svg += `<text x="${x + item.dx}" y="${y + item.dy}" font-size="11" font-weight="700" fill="${item.color}" text-anchor="${anchor}" font-family="var(--font-mono), monospace">${item.name.split(' ')[0]}</text>`;
      });

      // Llegenda compacta
      if (pointList.length > 0) {
        svg += `<g transform="translate(${MARGIN.left + 15}, ${MARGIN.top + 15})">
          <rect x="0" y="0" width="180" height="85" fill="#ffffff" opacity="0.94" rx="4" stroke="#e2e8f0"/>
          <line x1="10" y1="16" x2="30" y2="16" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="4,2"/>
          <text x="36" y="20" font-size="10" fill="#374151" font-family="var(--font-sans), sans-serif">Mescla (V - R)</text>
          
          <line x1="10" y1="36" x2="30" y2="36" stroke="#0284c7" stroke-width="2.5"/>
          <text x="36" y="40" font-size="10" fill="#374151" font-family="var(--font-sans), sans-serif">Bateria de fred (M - I)</text>
          
          <line x1="10" y1="56" x2="30" y2="56" stroke="#ef4444" stroke-width="2.5"/>
          <text x="36" y="60" font-size="10" fill="#374151" font-family="var(--font-sans), sans-serif">Maniobra sala (I - R)</text>
          
          <line x1="10" y1="74" x2="30" y2="74" stroke="#38bdf8" stroke-width="1.8" stroke-dasharray="2,2"/>
          <text x="36" y="78" font-size="10" fill="#374151" font-family="var(--font-sans), sans-serif">Prolongació a S</text>
        </g>`;
      }
    }

    svg += `</svg>`;
    container.innerHTML = svg;
  }

  function setContainerId(id) {
    defaultContainerId = id;
  }

  return {
    render,
    setContainerId
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PsychroChart;
}
