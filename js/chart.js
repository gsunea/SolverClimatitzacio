/**
 * chart.js
 * Motor Gràfic Vectorial (SVG) Avançat del Diagrama Psicromètric (Carta Carrier / ASHRAE).
 * 
 * Noves funcionalitats:
 * - Pan & Zoom interactiu amb roda del ratolí, arrossegament i botons de control.
 * - Inspector psicromètric en temps real (Crosshair) amb mesura dinàmica de propietats sota el cursor.
 * - Tooltips rics interactius per als punts (V, R, I, M, S) amb desglossament termodinàmic complet.
 * - Fletxes direccionals als processos de climatització (Bateria M->I, Maniobra I->R, Mescla V->M).
 * - Semicercle / Transportador del Factor de Calor Sensible (FCS_i) amb angle dinàmic de maniobra.
 * - Zona de Confort Tèrmic (RITE / ASHRAE 55) d'estiu i hivern amb filtre de capa.
 * - Escala graduada de temperatura humida (T_h) sobre la corba de saturació φ = 100%.
 * - Exportació directa a SVG vectorial i imatge PNG d'alta resolució per a informes.
 * - Sincronització completa amb el Depurador pas a pas (Passos 1 a 7) i mode pantalla completa.
 */

const PsychroChart = (() => {
  let defaultContainerId = 'psychro-container';

  // Constants bàsiques de coordenades
  const T_MIN = 0;
  const T_MAX = 42;
  const W_MIN = 0;
  const W_MAX = 28; // g/kg

  const WIDTH = 760;
  const HEIGHT = 580;
  const MARGIN = { top: 40, right: 65, bottom: 55, left: 55 };
  const PLOT_W = WIDTH - MARGIN.left - MARGIN.right; // 640
  const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom; // 485

  // Estat global de visualització de capes
  const layerState = {
    comfort: true,
    fcs: true,
    enthalpy: true,
    volume: true,
    arrows: true
  };

  // Estat del Pan & Zoom per a cada contenidor
  const viewState = {};

  function getViewState(containerId) {
    if (!viewState[containerId]) {
      viewState[containerId] = {
        scale: 1.0,
        tx: 0,
        ty: 0,
        isDragging: false,
        startX: 0,
        startY: 0
      };
    }
    return viewState[containerId];
  }

  function toX(T) {
    return MARGIN.left + ((T - T_MIN) / (T_MAX - T_MIN)) * PLOT_W;
  }

  function toY(w_g_kg) {
    return MARGIN.top + PLOT_H - ((w_g_kg - W_MIN) / (W_MAX - W_MIN)) * PLOT_H;
  }

  function fromX(x) {
    return T_MIN + ((x - MARGIN.left) / PLOT_W) * (T_MAX - T_MIN);
  }

  function fromY(y) {
    return W_MIN + ((MARGIN.top + PLOT_H - y) / PLOT_H) * (W_MAX - W_MIN);
  }

  function getPsychroLib() {
    if (typeof window !== 'undefined' && window.psychrolib) {
      return window.psychrolib;
    }
    if (typeof psychrolib !== 'undefined') {
      return psychrolib;
    }
    if (typeof require !== 'undefined') {
      try {
        const pl = require('./psychrolib.js');
        pl.SetUnitSystem(pl.SI);
        return pl;
      } catch (e) {}
    }
    return null;
  }

  /**
   * Identificadors SVG únics per contenidor: diversos diagrames conviuen al mateix document
   * i un id duplicat faria referència al primer (que pot estar ocult).
   */
  function makeIds(prefix) {
    const p = prefix ? `${prefix}-` : '';
    return {
      clip: `${p}chart-clip`,
      shadow: `${p}shadow`,
      arrow_blue: `${p}arrow-blue`,
      arrow_red: `${p}arrow-red`,
      arrow_amber: `${p}arrow-amber`
    };
  }

  function isPointInBounds(pt) {
    if (!pt) return false;
    const t = Number(pt.t);
    const w = Number(pt.w_g_kg !== undefined ? pt.w_g_kg : (pt.w !== undefined && pt.w !== null ? pt.w * 1000 : NaN));
    return (t >= T_MIN && t <= T_MAX && w >= W_MIN && w <= W_MAX);
  }

  /**
   * Genera el fons i les línies base de la carta psicromètrica
   */
  function buildBaseSvg(P, lib, options = {}) {
    const showComfort = options.showComfort !== undefined ? options.showComfort : layerState.comfort;
    const showEnthalpy = options.showEnthalpy !== undefined ? options.showEnthalpy : layerState.enthalpy;
    const showVolume = options.showVolume !== undefined ? options.showVolume : layerState.volume;
    const ids = makeIds(options.idPrefix);
    const clip = `clip-path="url(#${ids.clip})"`;

    let svg = `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" width="100%" height="100%" class="psychro-svg" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<defs>
      <clipPath id="${ids.clip}">
        <rect x="${MARGIN.left}" y="${MARGIN.top}" width="${PLOT_W}" height="${PLOT_H}" />
      </clipPath>
      <filter id="${ids.shadow}" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.2"/>
      </filter>
      <!-- Fletxes direccionals de procés termodinàmic -->
      <marker id="${ids.arrow_blue}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284c7" />
      </marker>
      <marker id="${ids.arrow_red}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
      </marker>
      <marker id="${ids.arrow_amber}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f59e0b" />
      </marker>
    </defs>`;

    // Fons blanc base
    svg += `<rect x="${MARGIN.left}" y="${MARGIN.top}" width="${PLOT_W}" height="${PLOT_H}" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2"/>`;

    // 0. Zona de Confort Tèrmic (RITE / ASHRAE 55)
    if (showComfort) {
      // Estiu: 23°C - 26°C, HR 40% - 60%
      let summerPath = '';
      for (let t = 23; t <= 26; t += 0.5) {
        const w = lib.GetHumRatioFromRelHum(t, 0.40, P) * 1000;
        const x = toX(t), y = toY(w);
        summerPath += (!summerPath ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`);
      }
      for (let t = 26; t >= 23; t -= 0.5) {
        const w = lib.GetHumRatioFromRelHum(t, 0.60, P) * 1000;
        const x = toX(t), y = toY(w);
        summerPath += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      summerPath += ' Z';
      svg += `<path d="${summerPath}" fill="#10b981" fill-opacity="0.12" stroke="#10b981" stroke-width="1.2" stroke-dasharray="3,2" ${clip}/>`;
      svg += `<text x="${toX(24.5)}" y="${toY(lib.GetHumRatioFromRelHum(24.5, 0.50, P) * 1000) + 3}" font-size="9" fill="#059669" font-weight="600" text-anchor="middle" font-family="var(--font-sans), sans-serif">Zona Confort RITE</text>`;
    }

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

    // 2. Línies d'entalpia constant (h)
    if (showEnthalpy) {
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
          svg += `<path d="${d}" fill="none" stroke="#e2e8f0" stroke-dasharray="3,3" stroke-width="0.9" ${clip}/>`;
          const firstPt = points[0];
          svg += `<text x="${firstPt.x - 4}" y="${firstPt.y - 4}" font-size="9" fill="#94a3b8" text-anchor="end" font-family="var(--font-mono), monospace">${h_kJ}</text>`;
        }
      });
    }

    // 3. Línies de volum específic (v)
    if (showVolume) {
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
          svg += `<path d="${d}" fill="none" stroke="#e0f2fe" stroke-width="1" ${clip}/>`;
          const lastPt = points[points.length - 1];
          if (lastPt.y < MARGIN.top + PLOT_H - 10) {
            svg += `<text x="${lastPt.x + 3}" y="${lastPt.y + 12}" font-size="9" fill="#38bdf8" text-anchor="start" font-family="var(--font-mono), monospace">${vTarget}</text>`;
          }
        }
      });
    }

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
      svg += `<path d="${pathD}" fill="none" stroke="#94a3b8" stroke-width="0.9" ${clip}/>`;
      if (labelPoint) {
        svg += `<text x="${labelPoint.x}" y="${labelPoint.y - 4}" font-size="9.5" fill="#64748b" font-weight="600" text-anchor="middle" font-family="var(--font-mono), monospace">${phi}%</text>`;
      }
    });

    // 5. Corba de Saturació (φ = 100%) i boira superior
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
        satPolyPoints.push({ x, y, T, w_g_kg });
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
      svg += `<path d="${fogD}" fill="#f8fafc" stroke="none" ${clip}/>`;
    }

    svg += `<path d="${satPath}" fill="none" stroke="#0284c7" stroke-width="2.5" ${clip}/>`;
    svg += `<text x="${toX(18)}" y="${toY(lib.GetSatHumRatio(18, P) * 1000) - 8}" font-size="10" fill="#0284c7" font-weight="700" font-family="var(--font-mono), monospace">φ = 100% (Saturació)</text>`;

    // 6. Marques graduades de temperatura humida (T_h) sobre la corba de saturació
    const wetBulbMarks = [5, 10, 15, 20, 25, 30];
    wetBulbMarks.forEach(tb => {
      const w_sat = lib.GetSatHumRatio(tb, P) * 1000.0;
      if (w_sat <= W_MAX) {
        const x = toX(tb);
        const y = toY(w_sat);
        svg += `<circle cx="${x}" cy="${y}" r="2" fill="#0284c7" ${clip}/>`;
        svg += `<text x="${x - 5}" y="${y - 4}" font-size="8.5" fill="#0284c7" font-weight="600" text-anchor="end" font-family="var(--font-mono), monospace" ${clip}>${tb}°</text>`;
      }
    });

    // Títols dels eixos
    svg += `<text x="${MARGIN.left + PLOT_W / 2}" y="${HEIGHT - 12}" font-size="11" font-weight="600" fill="#374151" text-anchor="middle" font-family="var(--font-sans), sans-serif">Temperatura Seca T (°C)</text>`;
    svg += `<text transform="rotate(-90)" x="${-(MARGIN.top + PLOT_H / 2)}" y="${WIDTH - 12}" font-size="11" font-weight="600" fill="#374151" text-anchor="middle" font-family="var(--font-sans), sans-serif">Humitat Absoluta w (g/kg a.s.)</text>`;

    return svg;
  }

  /**
   * Genera el codi SVG de la carta psicromètrica.
   * @param {Object} sol - Solució calculada
   * @param {Number} maxStep - Pas màxim a dibuixar (1..7)
   * @param {Object} options - Opcions addicionals
   */
  function generateSvg(sol, maxStep = 7, options = {}) {
    const lib = getPsychroLib();
    if (!lib) return '';

    const P = (sol && sol.powers && sol.powers.P_atm_Pa) ? sol.powers.P_atm_Pa : 101325;
    let svg = buildBaseSvg(P, lib, options);
    const ids = makeIds(options.idPrefix);
    const clip = `clip-path="url(#${ids.clip})"`;

    if (sol && sol.points) {
      const pts = sol.points;
      const V = pts.V;
      const R = pts.R;
      const M = pts.M;
      const I = pts.I;
      const S = pts.S;

      // Pas 4+: Recta de mescla V - R
      if (maxStep >= 4 && V && R) {
        const markerAttr = (layerState.arrows && M) ? `marker-end="url(#${ids.arrow_amber})"` : '';
        svg += `<line x1="${toX(V.t)}" y1="${toY(V.w_g_kg)}" x2="${toX(R.t)}" y2="${toY(R.w_g_kg)}" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="6,4" ${markerAttr} ${clip}/>`;
      }

      // Pas 6+: Procés de bateria M - I i prolongació a S
      if (maxStep >= 6 && M && I) {
        const markerCoil = layerState.arrows ? `marker-end="url(#${ids.arrow_blue})"` : '';
        svg += `<line x1="${toX(M.t)}" y1="${toY(M.w_g_kg)}" x2="${toX(I.t)}" y2="${toY(I.w_g_kg)}" stroke="#0284c7" stroke-width="3" ${markerCoil} ${clip}/>`;
        if (S) {
          svg += `<line x1="${toX(I.t)}" y1="${toY(I.w_g_kg)}" x2="${toX(S.t)}" y2="${toY(S.w_g_kg)}" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3,3" ${clip}/>`;
        }
      }

      // Pas 2+: Maniobra de sala I - R (o recta que passa per R)
      if (maxStep >= 2 && R) {
        const xStart = (maxStep >= 3 && I) ? toX(I.t) : toX(R.t - 15);
        const yStart = (maxStep >= 3 && I) ? toY(I.w_g_kg) : toY(R.w_g_kg - (sol.slopeRoom || 0) * 15 * 1000);
        const markerRoom = (layerState.arrows && maxStep >= 3 && I) ? `marker-end="url(#${ids.arrow_red})"` : '';
        svg += `<line x1="${xStart}" y1="${yStart}" x2="${toX(R.t)}" y2="${toY(R.w_g_kg)}" stroke="#ef4444" stroke-width="${maxStep >= 3 ? 3 : 2}" stroke-dasharray="${maxStep >= 3 ? 'none' : '4,3'}" ${markerRoom} ${clip}/>`;
      }

      // Llista de punts segons el pas
      const pointList = [];
      if (maxStep >= 1) {
        if (V) pointList.push({ id: 'V', pt: V, name: 'V (Ventilació)', color: '#f59e0b', dx: 10, dy: -6 });
        if (R) pointList.push({ id: 'R', pt: R, name: 'R (Retorn)', color: '#10b981', dx: 10, dy: 14 });
      }
      if (maxStep >= 3 && I) {
        pointList.push({ id: 'I', pt: I, name: 'I (Impulsió)', color: '#0ea5e9', dx: -10, dy: 14, anchor: 'end' });
      }
      if (maxStep >= 5 && M) {
        pointList.push({ id: 'M', pt: M, name: 'M (Mescla)', color: '#8b5cf6', dx: -12, dy: -12, anchor: 'end' });
      }
      if (maxStep >= 6 && S) {
        pointList.push({ id: 'S', pt: S, name: 'S (Superfície)', color: '#06b6d4', dx: -12, dy: -8, anchor: 'end' });
      }

      svg += `<g ${clip} class="chart-points-group">`;
      pointList.forEach(item => {
        const x = toX(item.pt.t);
        const y = toY(item.pt.w_g_kg);
        const anchor = item.anchor || 'start';

        // Cercle amb targeta interactiva
        svg += `<g class="chart-interactive-point" data-point-id="${item.id}" style="cursor: pointer;">`;
        svg += `<circle cx="${x}" cy="${y}" r="6.5" fill="${item.color}" stroke="#ffffff" stroke-width="2.5" filter="url(#${ids.shadow})" class="point-marker"/>`;
        svg += `<circle cx="${x}" cy="${y}" r="14" fill="transparent" class="point-hitbox"/>`;
        svg += `<text x="${x + item.dx}" y="${y + item.dy}" font-size="11" font-weight="700" fill="${item.color}" text-anchor="${anchor}" font-family="var(--font-mono), monospace">${item.name.split(' ')[0]}</text>`;
        svg += `</g>`;
      });
      svg += `</g>`;

      // Avís de punts fora d'escala si cal
      const outOfBounds = pointList.filter(item => !isPointInBounds(item.pt));
      if (outOfBounds.length > 0) {
        const names = outOfBounds.map(item => item.name.split(' ')[0]).join(', ');
        svg += `<g transform="translate(${MARGIN.left + PLOT_W - 200}, ${MARGIN.top + 15})">
          <rect x="0" y="0" width="195" height="26" fill="#fef2f2" stroke="#fca5a5" rx="4" />
          <text x="8" y="17" font-size="10.5" fill="#b91c1c" font-weight="600" font-family="var(--font-sans), sans-serif">⚠️ Punts fora d'escala: ${names}</text>
        </g>`;
      }

      // Llegenda compacta interactiva
      if (pointList.length > 0) {
        svg += `<g class="chart-legend" transform="translate(${MARGIN.left + 15}, ${MARGIN.top + 15})">
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
    return svg;
  }

  /**
   * Converteix el diagrama SVG en una imatge PNG d'alta resolució (escala 2x).
   * Assegura que tot el diagrama sencer queda capturat, centrat i amb fons blanc nítid.
   */
  function exportPng(targetId = null) {
    if (typeof document === 'undefined') return;
    const container = document.getElementById(targetId || defaultContainerId);
    if (!container) return;
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;

    // Clona l'element SVG per no modificar el DOM interactiu
    const clone = svgEl.cloneNode(true);

    // Elimina elements transitoris d'interacció (crosshairs, etc.)
    const crosshair = clone.querySelector('.chart-crosshair-group');
    if (crosshair) crosshair.remove();

    // Fixa dimensions exactes en píxels i el viewBox complet 0..WIDTH, 0..HEIGHT
    clone.setAttribute('width', `${WIDTH}`);
    clone.setAttribute('height', `${HEIGHT}`);
    clone.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // Assegura fons blanc complet a tot el llenç del diagrama
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', '0');
    bgRect.setAttribute('y', '0');
    bgRect.setAttribute('width', `${WIDTH}`);
    bgRect.setAttribute('height', `${HEIGHT}`);
    bgRect.setAttribute('fill', '#ffffff');
    clone.insertBefore(bgRect, clone.firstChild);

    const svgData = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      const scale = 2; // Resolució Retina 2x (1520x1160)
      const canvas = document.createElement('canvas');
      canvas.width = WIDTH * scale;
      canvas.height = HEIGHT * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Dibuixa l'SVG sencer ocupant el 100% de les dimensions del canvas
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const a = document.createElement('a');
      a.download = 'diagrama_psicrometric_carrier.png';
      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (!blob) return;
          const pngUrl = URL.createObjectURL(blob);
          a.href = pngUrl;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(pngUrl), 1500);
        }, 'image/png');
      } else {
        a.href = canvas.toDataURL('image/png');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
    };

    img.src = url;
  }

  /**
   * Converteix coordenades de pantalla (clientX/Y) a coordenades de l'SVG (viewBox),
   * tenint en compte el zoom i l'enquadrament (preserveAspectRatio) reals.
   */
  function clientToSvg(svgEl, clientX, clientY) {
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return null;
    const pt = svgEl.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(ctm.inverse());
  }

  /**
   * Converteix coordenades de l'SVG a coordenades de pantalla
   */
  function svgToClient(svgEl, x, y) {
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return null;
    const pt = svgEl.createSVGPoint();
    pt.x = x;
    pt.y = y;
    return pt.matrixTransform(ctm);
  }

  // Un únic listener global per acabar l'arrossegament (evita acumular-ne un per render)
  let mouseUpBound = false;
  function bindGlobalMouseUp() {
    if (mouseUpBound || typeof window === 'undefined') return;
    mouseUpBound = true;
    window.addEventListener('mouseup', () => {
      Object.keys(viewState).forEach(id => {
        if (viewState[id].isDragging) {
          viewState[id].isDragging = false;
          applyViewBox(id);
        }
      });
    });
  }

  /**
   * Configura la interactivitat de ratolí (Pan, Zoom, Inspector, Tooltips) per a un contenidor
   */
  function setupContainerInteractivity(container, sol) {
    if (typeof document === 'undefined' || !container) return;
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;

    const containerId = container.id;
    const state = getViewState(containerId);
    state.isDragging = false;
    const lib = getPsychroLib();
    const P = (sol && sol.powers && sol.powers.P_atm_Pa) ? sol.powers.P_atm_Pa : 101325;

    bindGlobalMouseUp();

    // Crea el contenidor flotant per al tooltip si no existeix
    let tooltip = container.querySelector('.psychro-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'psychro-tooltip';
      tooltip.style.display = 'none';
      container.style.position = 'relative';
      container.appendChild(tooltip);
    }

    // Retícula d'inspecció viva (Crosshair lines) dins de l'SVG
    let crosshairG = svgEl.querySelector('.chart-crosshair-group');
    if (!crosshairG) {
      crosshairG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      crosshairG.setAttribute('class', 'chart-crosshair-group');
      crosshairG.setAttribute('clip-path', `url(#${makeIds(containerId).clip})`);
      crosshairG.style.pointerEvents = 'none';
      crosshairG.innerHTML = `
        <line class="ch-line-x" x1="0" y1="0" x2="0" y2="0" stroke="#0284c7" stroke-width="0.9" stroke-dasharray="2,2" opacity="0"/>
        <line class="ch-line-y" x1="0" y1="0" x2="0" y2="0" stroke="#0284c7" stroke-width="0.9" stroke-dasharray="2,2" opacity="0"/>
        <circle class="ch-dot" cx="0" cy="0" r="3.5" fill="#0284c7" opacity="0"/>
      `;
      svgEl.appendChild(crosshairG);
    }

    const chLineX = crosshairG.querySelector('.ch-line-x');
    const chLineY = crosshairG.querySelector('.ch-line-y');
    const chDot = crosshairG.querySelector('.ch-dot');

    function hideCrosshair() {
      chLineX.setAttribute('opacity', '0');
      chLineY.setAttribute('opacity', '0');
      chDot.setAttribute('opacity', '0');
      const inspectBar = document.getElementById('chart-inspector-bar');
      if (inspectBar) inspectBar.innerHTML = '';
    }

    applyViewBox(containerId);

    // Gestió d'esdeveniments del ratolí
    svgEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      let newScale = state.scale * zoomFactor;
      if (newScale <= 1.001) {
        newScale = 1.0;
        state.tx = 0;
        state.ty = 0;
      } else {
        newScale = Math.min(newScale, 6.0);
      }
      state.scale = newScale;
      applyViewBox(containerId);
    }, { passive: false });

    svgEl.addEventListener('mousedown', (e) => {
      // Només es pot arrossegar si hi ha zoom actiu (scale > 1.0)
      if (e.button === 0 && state.scale > 1.001) {
        const ctm = svgEl.getScreenCTM();
        state.isDragging = true;
        state.startX = e.clientX;
        state.startY = e.clientY;
        state.startTx = state.tx;
        state.startTy = state.ty;
        // píxels de pantalla per unitat de viewBox (constant durant l'arrossegament)
        state.pxPerUnit = ctm ? ctm.a : 1;
        svgEl.style.cursor = 'grabbing';
      }
    });

    svgEl.addEventListener('dblclick', () => {
      resetZoom(containerId);
    });

    // Inspector psicromètric en temps real (mousemove)
    svgEl.addEventListener('mousemove', (e) => {
      if (state.isDragging && state.scale > 1.001) {
        // El contingut segueix el cursor 1:1 (tx/ty s'expressen en unitats de viewBox × escala)
        const k = state.scale / (state.pxPerUnit || 1);
        state.tx = state.startTx + (e.clientX - state.startX) * k;
        state.ty = state.startTy + (e.clientY - state.startY) * k;
        applyViewBox(containerId);
        return;
      }

      const p = clientToSvg(svgEl, e.clientX, e.clientY);
      if (!p) return;
      const svgX = p.x;
      const svgY = p.y;

      // Comprova si està dins del requadre del diagrama
      const inside = svgX >= MARGIN.left && svgX <= MARGIN.left + PLOT_W &&
        svgY >= MARGIN.top && svgY <= MARGIN.top + PLOT_H;
      const T = fromX(svgX);
      const w_g = fromY(svgY);
      const w_sat = (inside && lib) ? lib.GetSatHumRatio(T, P) * 1000.0 : -1;

      if (!inside || !lib || w_g < W_MIN || w_g > w_sat) {
        hideCrosshair();
        return;
      }

      // Actualitza les línies creuades (crosshair)
      chLineX.setAttribute('x1', svgX);
      chLineX.setAttribute('y1', MARGIN.top);
      chLineX.setAttribute('x2', svgX);
      chLineX.setAttribute('y2', MARGIN.top + PLOT_H);
      chLineX.setAttribute('opacity', '0.75');

      chLineY.setAttribute('x1', MARGIN.left);
      chLineY.setAttribute('y1', svgY);
      chLineY.setAttribute('x2', MARGIN.left + PLOT_W);
      chLineY.setAttribute('y2', svgY);
      chLineY.setAttribute('opacity', '0.75');

      chDot.setAttribute('cx', svgX);
      chDot.setAttribute('cy', svgY);
      chDot.setAttribute('opacity', '0.9');

      // Càlcul psicromètric del punt sota el cursor
      try {
        const w_kg = w_g / 1000.0;
        const phi = lib.GetRelHumFromHumRatio(T, w_kg, P) * 100.0;
        const h_kJ = lib.GetMoistAirEnthalpy(T, w_kg) / 1000.0;
        const th = lib.GetTWetBulbFromHumRatio(T, w_kg, P);
        const tr = lib.GetTDewPointFromHumRatio(T, w_kg, P);
        const v = lib.GetMoistAirVolume(T, w_kg, P);

        const inspectBar = document.getElementById('chart-inspector-bar');
        if (inspectBar) {
          inspectBar.innerHTML = `
            <span class="inspect-item"><b>T:</b> ${T.toFixed(1)} °C</span>
            <span class="inspect-item"><b>w:</b> ${w_g.toFixed(2)} g/kg</span>
            <span class="inspect-item"><b>φ:</b> ${phi.toFixed(1)}%</span>
            <span class="inspect-item"><b>h:</b> ${h_kJ.toFixed(1)} kJ/kg</span>
            <span class="inspect-item"><b>T_h:</b> ${th.toFixed(1)} °C</span>
            <span class="inspect-item"><b>T_r:</b> ${tr.toFixed(1)} °C</span>
            <span class="inspect-item"><b>v:</b> ${v.toFixed(3)} m³/kg</span>
          `;
        }
      } catch (err) {}
    });

    svgEl.addEventListener('mouseleave', () => {
      hideCrosshair();
      if (tooltip) tooltip.style.display = 'none';
    });

    // Tooltips per als punts interactius
    const pointElements = svgEl.querySelectorAll('.chart-interactive-point');
    pointElements.forEach(el => {
      const ptId = el.getAttribute('data-point-id');
      const pt = (sol && sol.points) ? sol.points[ptId] : null;

      el.addEventListener('mouseenter', () => {
        if (!pt || !tooltip) return;
        const rect = container.getBoundingClientRect();
        const client = svgToClient(svgEl, toX(pt.t), toY(pt.w_g_kg));
        if (!client) return;
        const normX = client.x - rect.left;
        const normY = client.y - rect.top;

        const colorMap = {
          V: '#f59e0b',
          R: '#10b981',
          I: '#0ea5e9',
          M: '#8b5cf6',
          S: '#06b6d4'
        };

        const titles = {
          V: 'Punt V (Aire de Ventilació Exterior)',
          R: 'Punt R (Aire de Retorn de Sala)',
          I: 'Punt I (Aire d\'Impulsió de Bateria)',
          M: 'Punt M (Mescla Exterior + Retorn)',
          S: 'Punt S (Superfície Freda de Bateria)'
        };

        tooltip.innerHTML = `
          <div class="tt-header" style="color: ${colorMap[ptId] || '#333'}">
            <b>${titles[ptId] || ptId}</b>
          </div>
          <div class="tt-grid">
            <div class="tt-row"><span>Temperatura seca (T):</span> <b>${Number(pt.t).toFixed(1)} °C</b></div>
            <div class="tt-row"><span>Humitat relativa (φ):</span> <b>${Number(pt.phi).toFixed(1)} %</b></div>
            <div class="tt-row"><span>Humitat absoluta (w):</span> <b>${Number(pt.w_g_kg).toFixed(2)} g/kg</b></div>
            <div class="tt-row"><span>Entalpia (h):</span> <b>${Number(pt.h).toFixed(1)} kJ/kg</b></div>
            <div class="tt-row"><span>Temp. humida (T_h):</span> <b>${Number(pt.th).toFixed(1)} °C</b></div>
            <div class="tt-row"><span>Temp. rosada (T_r):</span> <b>${Number(pt.tr).toFixed(1)} °C</b></div>
            <div class="tt-row"><span>Volum específic (v):</span> <b>${Number(pt.v).toFixed(3)} m³/kg</b></div>
          </div>
        `;

        tooltip.style.display = 'block';
        tooltip.style.left = `${Math.min(rect.width - 200, Math.max(10, normX + 15))}px`;
        tooltip.style.top = `${Math.min(rect.height - 180, Math.max(10, normY - 40))}px`;
      });

      el.addEventListener('mouseleave', () => {
        if (tooltip) tooltip.style.display = 'none';
      });
    });
  }

  /**
   * Renderitza el diagrama i activa la interactivitat.
   * @param {Object} sol - Solució calculada
   * @param {Number} maxStep - Pas màxim a dibuixar (1..7, per defecte 7 = cicle complet)
   * @param {String} targetId - ID del contenidor HTML (per defecte defaultContainerId)
   */
  function render(sol, maxStep = 7, targetId = null) {
    const id = targetId || defaultContainerId;
    const container = typeof document !== 'undefined' ? document.getElementById(id) : null;
    const svg = generateSvg(sol, maxStep, container ? { idPrefix: id } : {});
    if (container && svg) {
      container.innerHTML = svg;
      setupContainerInteractivity(container, sol);
    }
    return svg;
  }

  function setContainerId(id) {
    defaultContainerId = id;
  }

  /**
   * Aplica la transformació viewBox garantint que scale >= 1.0 i que la vista
   * no es desplaci mai fora dels límits de la carta psicromètrica.
   */
  function applyViewBox(containerId = null) {
    const id = containerId || defaultContainerId;
    const state = getViewState(id);
    const container = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (!container) return;
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;

    // Si el zoom és 1.0 (o inferior), bloqueja exactament a la posició original
    if (state.scale <= 1.001) {
      state.scale = 1.0;
      state.tx = 0;
      state.ty = 0;
      svgEl.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
      svgEl.style.cursor = 'default';
      return;
    }

    svgEl.style.cursor = state.isDragging ? 'grabbing' : 'grab';

    // Acota el desplaçament perquè mai surti del requadre
    const maxTx = ((state.scale - 1.0) * WIDTH) / 2;
    const maxTy = ((state.scale - 1.0) * HEIGHT) / 2;
    state.tx = Math.max(-maxTx, Math.min(maxTx, state.tx));
    state.ty = Math.max(-maxTy, Math.min(maxTy, state.ty));

    const w = WIDTH / state.scale;
    const h = HEIGHT / state.scale;
    const vx = (WIDTH - w) / 2 - (state.tx / state.scale);
    const vy = (HEIGHT - h) / 2 - (state.ty / state.scale);
    svgEl.setAttribute('viewBox', `${vx.toFixed(1)} ${vy.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
  }

  function zoomIn(containerId = null) {
    const id = containerId || defaultContainerId;
    const state = getViewState(id);
    state.scale = Math.min(state.scale * 1.25, 6.0);
    applyViewBox(id);
  }

  function zoomOut(containerId = null) {
    const id = containerId || defaultContainerId;
    const state = getViewState(id);
    let newScale = state.scale * 0.8;
    if (newScale <= 1.001) {
      newScale = 1.0;
      state.tx = 0;
      state.ty = 0;
    }
    state.scale = newScale;
    applyViewBox(id);
  }

  function resetZoom(containerId = null) {
    const id = containerId || defaultContainerId;
    const state = getViewState(id);
    state.scale = 1.0;
    state.tx = 0;
    state.ty = 0;
    applyViewBox(id);
  }

  function toggleLayer(layerName, sol = null, maxStep = 7, targetId = null) {
    if (layerState.hasOwnProperty(layerName)) {
      layerState[layerName] = !layerState[layerName];
      render(sol, maxStep, targetId);
      return layerState[layerName];
    }
    return false;
  }

  return {
    render,
    generateSvg,
    isPointInBounds,
    toX,
    toY,
    fromX,
    fromY,
    setContainerId,
    zoomIn,
    zoomOut,
    resetZoom,
    toggleLayer,
    exportPng,
    layerState,
    T_MIN,
    T_MAX,
    W_MIN,
    W_MAX,
    WIDTH,
    HEIGHT,
    MARGIN,
    PLOT_W,
    PLOT_H
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PsychroChart;
}
