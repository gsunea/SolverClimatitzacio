/**
 * chart.js
 * Generació i actualització interactiva del diagrama psicromètric amb Plotly.js.
 * Dibuixa la malla psicromètrica (corbes phi = 10%..100%) i els processos
 * del cicle de climatització d'estiu (V, R, M, I, S).
 */

const PsychroChart = (() => {
  let chartContainerId = 'psychro-plot';
  let isInitialized = false;

  // Cache de corbes de fons per no recalcular innecessàriament si la pressió no canvia
  let cachedCurves = null;
  let cachedP = null;

  /**
   * Genera les corbes psicromètriques de referència (humitats relatives 10% a 100%)
   */
  function generateBackgroundCurves(P, lib) {
    if (cachedCurves && cachedP === P) {
      return cachedCurves;
    }

    const tMin = 0;
    const tMax = 42;
    const numPoints = 85;
    const tStep = (tMax - tMin) / (numPoints - 1);
    const tValues = [];
    for (let i = 0; i < numPoints; i++) {
      tValues.push(tMin + i * tStep);
    }

    const phiValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const curves = [];

    phiValues.forEach(phi => {
      const xCurve = [];
      const yCurve = [];
      const hoverTexts = [];

      for (let i = 0; i < tValues.length; i++) {
        const T = tValues[i];
        const w = lib.GetHumRatioFromRelHum(T, phi / 100.0, P);
        const w_g_kg = w * 1000.0;
        if (w_g_kg <= 32.0) {
          xCurve.push(T);
          yCurve.push(w_g_kg);
          hoverTexts.push(`φ = ${phi}%<br>T = ${T.toFixed(1)} °C<br>w = ${w_g_kg.toFixed(2)} g/kg`);
        }
      }

      const isSaturation = (phi === 100);
      curves.push({
        x: xCurve,
        y: yCurve,
        text: hoverTexts,
        hoverinfo: 'text',
        mode: 'lines',
        name: isSaturation ? 'Saturació (φ=100%)' : `φ = ${phi}%`,
        showlegend: isSaturation,
        line: {
          color: isSaturation ? '#0284c7' : '#94a3b8',
          width: isSaturation ? 2.5 : 1.0,
          dash: isSaturation ? 'solid' : 'dot'
        }
      });
    });

    // Línies d'entalpia constant suaus (h = 20, 40, 60, 80, 100 kJ/kg)
    const enthalpyValues = [20, 30, 40, 50, 60, 70, 80, 90];
    enthalpyValues.forEach(h_kJ => {
      const xH = [];
      const yH = [];
      // w = (h - c_pas*T) / (2501 + 1.86*T)
      for (let T = 0; T <= 40; T += 1) {
        const h_J = h_kJ * 1000.0;
        const w = lib.GetHumRatioFromEnthalpyAndTDryBulb(h_J, T);
        const w_g_kg = w * 1000.0;
        const wSat = lib.GetSatHumRatio(T, P) * 1000.0;
        if (w_g_kg >= 0 && w_g_kg <= wSat && w_g_kg <= 32) {
          xH.push(T);
          yH.push(w_g_kg);
        }
      }
      if (xH.length > 1) {
        curves.push({
          x: xH,
          y: yH,
          mode: 'lines',
          hoverinfo: 'none',
          showlegend: false,
          line: {
            color: '#cbd5e1',
            width: 0.8,
            dash: 'dash'
          }
        });
      }
    });

    cachedCurves = curves;
    cachedP = P;
    return curves;
  }

  /**
   * Inicialitza o actualitza el gràfic amb el resultat del càlcul
   */
  function render(solutionData) {
    if (typeof Plotly === 'undefined') {
      console.warn('Plotly.js no està carregat al document.');
      return;
    }

    const lib = window.psychrolib;
    if (!lib) {
      console.warn('PsychroLib no està disponible.');
      return;
    }

    const container = document.getElementById(chartContainerId);
    if (!container) return;

    const P = solutionData.powers.P_atm_Pa;
    const bgCurves = generateBackgroundCurves(P, lib);

    const pts = solutionData.points;
    const V = pts.V;
    const R = pts.R;
    const M = pts.M;
    const I = pts.I;
    const S = pts.S;

    // Traces de processos:
    // 1. Segment V - R (línia de mescla)
    const traceVR = {
      x: [V.t, R.t],
      y: [V.w_g_kg, R.w_g_kg],
      mode: 'lines',
      name: 'Línia de Mescla (V-R)',
      line: {
        color: '#f59e0b', // taronja / ambre
        width: 2.5,
        dash: 'dash'
      },
      hoverinfo: 'name'
    };

    // 2. Segment M - I (refrigeració i deshumidificació a bateria)
    const traceMI = {
      x: [M.t, I.t],
      y: [M.w_g_kg, I.w_g_kg],
      mode: 'lines',
      name: 'Bateria de Fred (M-I)',
      line: {
        color: '#0284c7', // blau intens
        width: 3.5,
        dash: 'solid'
      },
      hoverinfo: 'name'
    };

    // 3. Prolongació I -> S (superfície de bateria a saturació)
    const traceIS = {
      x: [I.t, S.t],
      y: [I.w_g_kg, S.w_g_kg],
      mode: 'lines',
      name: 'Prolongació a Bateria (I-S)',
      line: {
        color: '#38bdf8', // blau cel puntejat
        width: 2,
        dash: 'dot'
      },
      hoverinfo: 'name'
    };

    // 4. Segment I - R (recta de maniobra de la sala, absorció de càrregues)
    const traceIR = {
      x: [I.t, R.t],
      y: [I.w_g_kg, R.w_g_kg],
      mode: 'lines',
      name: `Maniobra Sala (I-R, FCS=${solutionData.powers.FCS_i.toFixed(3)})`,
      line: {
        color: '#ef4444', // vermell
        width: 3,
        dash: 'solid'
      },
      hoverinfo: 'name'
    };

    // 5. Punts clau (V, R, M, I, S)
    const pointList = [
      { pt: V, color: '#f59e0b', symbol: 'circle', pos: 'top right' },
      { pt: R, color: '#10b981', symbol: 'diamond', pos: 'bottom right' },
      { pt: M, color: '#8b5cf6', symbol: 'square', pos: 'top left' },
      { pt: I, color: '#0ea5e9', symbol: 'cross', pos: 'bottom left' },
      { pt: S, color: '#06b6d4', symbol: 'triangle-up', pos: 'top left' }
    ];

    const tracePoints = {
      x: pointList.map(p => p.pt.t),
      y: pointList.map(p => p.pt.w_g_kg),
      text: pointList.map(p => `<b>${p.pt.symbol}</b> (${p.pt.label})`),
      textposition: pointList.map(p => p.pos),
      mode: 'markers+text',
      name: 'Punts Psicromètrics',
      marker: {
        size: 11,
        color: pointList.map(p => p.color),
        line: {
          color: '#ffffff',
          width: 2
        }
      },
      customdata: pointList.map(p => [
        p.pt.label,
        p.pt.symbol,
        p.pt.t.toFixed(2),
        p.pt.w_g_kg.toFixed(2),
        p.pt.phi.toFixed(1),
        p.pt.h.toFixed(2),
        p.pt.v.toFixed(3),
        p.pt.tr.toFixed(1),
        p.pt.th.toFixed(1)
      ]),
      hovertemplate:
        '<b>Punt %{customdata[1]} - %{customdata[0]}</b><br>' +
        'Temperatura seca (T): %{customdata[2]} °C<br>' +
        'Humitat absoluta (w): %{customdata[3]} g/kg a.s.<br>' +
        'Humitat relativa (φ): %{customdata[4]} %<br>' +
        'Entalpia específica (h): %{customdata[5]} kJ/kg a.s.<br>' +
        'Volum específic (v): %{customdata[6]} m³/kg a.s.<br>' +
        'Temp. de rosada (Tr): %{customdata[7]} °C<br>' +
        'Temp. humida (Th): %{customdata[8]} °C<extra></extra>'
    };

    const data = [...bgCurves, traceVR, traceMI, traceIS, traceIR, tracePoints];

    const layout = {
      title: {
        text: '<b>Diagrama Psicromètric del Climatitzador en Estiu</b>',
        font: { size: 16, color: '#1e293b' }
      },
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#f8fafc',
      font: { family: 'Inter, system-ui, sans-serif', color: '#334155' },
      margin: { l: 60, r: 30, t: 50, b: 55 },
      hovermode: 'closest',
      xaxis: {
        title: '<b>Temperatura Seca T (°C)</b>',
        range: [0, 36],
        dtick: 5,
        gridcolor: '#e2e8f0',
        zerolinecolor: '#cbd5e1'
      },
      yaxis: {
        title: '<b>Humitat Absoluta w (g/kg a.s.)</b>',
        range: [0, 24],
        dtick: 2,
        gridcolor: '#e2e8f0',
        zerolinecolor: '#cbd5e1'
      },
      legend: {
        orientation: 'h',
        x: 0.0,
        y: 1.12,
        xanchor: 'left',
        font: { size: 11 }
      },
      annotations: [
        {
          x: 28,
          y: 7,
          text: 'Zona Confort',
          showarrow: false,
          font: { color: '#94a3b8', size: 10 }
        }
      ]
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d']
    };

    Plotly.react(chartContainerId, data, layout, config);
  }

  function setContainerId(id) {
    chartContainerId = id;
  }

  return {
    render,
    setContainerId
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PsychroChart;
}
