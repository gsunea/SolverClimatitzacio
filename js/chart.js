/**
 * chart.js
 * Renderitzador vectorial (SVG) del Diagrama Psicromètric autèntic (Carta Carrier / ASHRAE).
 * Sistema Internacional d'Unitats (SI).
 * Inclou:
 *  - Eix de temperatura seca T (0 °C a 42 °C)
 *  - Eix d'humitat absoluta w (0 a 30 g/kg a.s.)
 *  - Corba de saturació (φ = 100%) amb fons exterior tallat (silueta de carta psicromètrica)
 *  - Corbes d'humitat relativa (φ = 10% .. 90%) amb etiquetes directes
 *  - Línies de temperatura humida / entalpia constant inclinades
 *  - Línies de volum específic constant
 *  - Traçat dels processos del climatitzador:
 *      * Recta de mescla (V - R) i punt M
 *      * Procés a bateria (M - I)
 *      * Prolongació fins a la superfície de bateria (I - S)
 *      * Maniobra de la sala (I - R)
 *      * Punts V, R, M, I, S amb cercles i tooltips interactius
 */

const PsychroChart = (() => {
  let containerId = 'psychro-container';

  // Paràmetres del diagrama psicromètric
  const T_MIN = 0;
  const T_MAX = 42;
  const W_MIN = 0;
  const W_MAX = 28; // g/kg

  // Dimensions del viewBox SVG
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

  function fromX(xPx) {
    return T_MIN + ((xPx - MARGIN.left) / PLOT_W) * (T_MAX - T_MIN);
  }

  function fromY(yPx) {
    return W_MIN + ((MARGIN.top + PLOT_H - yPx) / PLOT_H) * (W_MAX - W_MIN);
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

    // Fons blanc del gràfic
    svg += `<rect x="${MARGIN.left}" y="${MARGIN.top}" width="${PLOT_W}" height="${PLOT_H}" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2"/>`;

    // 1. Malla ortogonal suau (temperatura seca i humitat)
    // Línies verticals de temperatura cada 5 °C
    for (let T = T_MIN; T <= T_MAX; T += 5) {
      const x = toX(T);
      const isMajor = (T % 10 === 0);
      svg += `<line x1="${x}" y1="${MARGIN.top}" x2="${x}" y2="${MARGIN.top + PLOT_H}" stroke="${isMajor ? '#e2e8f0' : '#f1f5f9'}" stroke-width="${isMajor ? 1 : 0.8}"/>`;
      svg += `<text x="${x}" y="${MARGIN.top + PLOT_H + 20}" font-size="11" fill="#475569" text-anchor="middle" font-family="system-ui, sans-serif">${T}</text>`;
    }

    // Línies horitzontals d'humitat cada 2 g/kg
    for (let w = W_MIN; w <= W_MAX; w += 2) {
      const y = toY(w);
      const isMajor = (w % 5 === 0 || w % 10 === 0);
      svg += `<line x1="${MARGIN.left}" y1="${y}" x2="${MARGIN.left + PLOT_W}" y2="${y}" stroke="${isMajor ? '#e2e8f0' : '#f1f5f9'}" stroke-width="${isMajor ? 1 : 0.8}"/>`;
      svg += `<text x="${MARGIN.left + PLOT_W + 10}" y="${y + 4}" font-size="11" fill="#475569" text-anchor="start" font-family="system-ui, sans-serif">${w}</text>`;
    }

    // 2. Línies d'entalpia constant / temperatura humida (diagonals clàssiques de la carta psicromètrica)
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
        // Etiqueta al principi de la línia (prop de la saturació)
        const firstPt = points[0];
        svg += `<text x="${firstPt.x - 4}" y="${firstPt.y - 4}" font-size="9" fill="#94a3b8" text-anchor="end" font-family="system-ui, sans-serif">${h_kJ}</text>`;
      }
    });

    // 3. Línies de volum específic (diagonals amb fort pendent)
    const vValues = [0.80, 0.82, 0.84, 0.86, 0.88, 0.90];
    vValues.forEach(vTarget => {
      let points = [];
      for (let T = T_MIN; T <= T_MAX; T += 1) {
        // v = R*(T+273.15)*(1+1.607858*w)/(28.966*P) -> w = (v*P*28.966/(R*T) - 1)/1.607858
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
          svg += `<text x="${lastPt.x + 3}" y="${lastPt.y + 12}" font-size="9" fill="#38bdf8" text-anchor="start" font-family="system-ui, sans-serif">${vTarget}</text>`;
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
          if (!pathD) {
            pathD = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
          } else {
            pathD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
          }
          if (T >= 36 && !labelPoint) {
            labelPoint = { x, y };
          }
        }
      }
      svg += `<path d="${pathD}" fill="none" stroke="#94a3b8" stroke-width="0.9" clip-path="url(#chart-clip)"/>`;
      if (labelPoint) {
        svg += `<text x="${labelPoint.x}" y="${labelPoint.y - 4}" font-size="9.5" fill="#64748b" font-weight="600" text-anchor="middle" font-family="system-ui, sans-serif">${phi}%</text>`;
      }
    });

    // 5. Corba de Saturació (φ = 100%) i ombra superior esquerra
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

    // Ombra de zona fora de saturació (dóna la forma de carta psicromètrica)
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

    // Traç marcat de la corba de saturació (blau marí)
    svg += `<path d="${satPath}" fill="none" stroke="#0284c7" stroke-width="2.5" clip-path="url(#chart-clip)"/>`;
    svg += `<text x="${toX(18)}" y="${toY(lib.GetSatHumRatio(18, P) * 1000) - 8}" font-size="10" fill="#0284c7" font-weight="700" font-family="system-ui, sans-serif">φ = 100% (Saturació)</text>`;

    // Títols dels eixos
    svg += `<text x="${MARGIN.left + PLOT_W / 2}" y="${HEIGHT - 12}" font-size="12" fill="#1e293b" font-weight="700" text-anchor="middle" font-family="system-ui, sans-serif">Temperatura Seca T (°C)</text>`;
    svg += `<text transform="rotate(-90)" x="${-(MARGIN.top + PLOT_H / 2)}" y="${WIDTH - 12}" font-size="12" fill="#1e293b" font-weight="700" text-anchor="middle" font-family="system-ui, sans-serif">Humitat Absoluta w (g/kg a.s.)</text>`;

    return svg;
  }

  /**
   * Renderitza el diagrama complet amb els punts i processos de la solució
   */
  function render(sol) {
    const container = document.getElementById(containerId);
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

      // 1. Segment de mescla V - R
      svg += `<line x1="${toX(V.t)}" y1="${toY(V.w_g_kg)}" x2="${toX(R.t)}" y2="${toY(R.w_g_kg)}" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="6,4" clip-path="url(#chart-clip)"/>`;

      // 2. Segment de bateria M - I
      svg += `<line x1="${toX(M.t)}" y1="${toY(M.w_g_kg)}" x2="${toX(I.t)}" y2="${toY(I.w_g_kg)}" stroke="#0284c7" stroke-width="3" clip-path="url(#chart-clip)"/>`;

      // 3. Prolongació a superfície I - S
      svg += `<line x1="${toX(I.t)}" y1="${toY(I.w_g_kg)}" x2="${toX(S.t)}" y2="${toY(S.w_g_kg)}" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3,3" clip-path="url(#chart-clip)"/>`;

      // 4. Maniobra de sala I - R
      svg += `<line x1="${toX(I.t)}" y1="${toY(I.w_g_kg)}" x2="${toX(R.t)}" y2="${toY(R.w_g_kg)}" stroke="#ef4444" stroke-width="3" clip-path="url(#chart-clip)"/>`;

      // 5. Punts clau amb cercles i etiquetes
      const pointList = [
        { pt: V, name: 'V (Ventilació)', color: '#f59e0b', dx: 10, dy: -6 },
        { pt: R, name: 'R (Retorn)', color: '#10b981', dx: 10, dy: 14 },
        { pt: M, name: 'M (Mescla)', color: '#8b5cf6', dx: -12, dy: -12, anchor: 'end' },
        { pt: I, name: 'I (Impulsió)', color: '#0ea5e9', dx: -10, dy: 14, anchor: 'end' },
        { pt: S, name: 'S (Superfície)', color: '#06b6d4', dx: -12, dy: -8, anchor: 'end' }
      ];

      pointList.forEach(item => {
        const x = toX(item.pt.t);
        const y = toY(item.pt.w_g_kg);
        const anchor = item.anchor || 'start';

        // Cercle exterior blanc
        svg += `<circle cx="${x}" cy="${y}" r="6.5" fill="${item.color}" stroke="#ffffff" stroke-width="2.5" filter="url(#shadow)"/>`;
        // Etiqueta del punt
        svg += `<text x="${x + item.dx}" y="${y + item.dy}" font-size="11" font-weight="700" fill="${item.color}" text-anchor="${anchor}" font-family="system-ui, sans-serif">${item.name.split(' ')[0]}</text>`;
      });

      // Llegenda compacta superior dreta
      svg += `<g transform="translate(${MARGIN.left + 15}, ${MARGIN.top + 15})">
        <rect x="0" y="0" width="180" height="85" fill="#ffffff" opacity="0.92" rx="4" stroke="#e2e8f0"/>
        <line x1="10" y1="16" x2="30" y2="16" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="4,2"/>
        <text x="36" y="20" font-size="10" fill="#334155" font-family="system-ui, sans-serif">Mescla (V - R)</text>
        
        <line x1="10" y1="36" x2="30" y2="36" stroke="#0284c7" stroke-width="2.5"/>
        <text x="36" y="40" font-size="10" fill="#334155" font-family="system-ui, sans-serif">Bateria de fred (M - I)</text>
        
        <line x1="10" y1="56" x2="30" y2="56" stroke="#ef4444" stroke-width="2.5"/>
        <text x="36" y="60" font-size="10" fill="#334155" font-family="system-ui, sans-serif">Maniobra sala (I - R)</text>
        
        <line x1="10" y1="74" x2="30" y2="74" stroke="#38bdf8" stroke-width="1.8" stroke-dasharray="2,2"/>
        <text x="36" y="78" font-size="10" fill="#334155" font-family="system-ui, sans-serif">Prolongació a S</text>
      </g>`;
    }

    svg += `</svg>`;
    container.innerHTML = svg;
  }

  function setContainerId(id) {
    containerId = id;
  }

  return {
    render,
    setContainerId
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PsychroChart;
}
