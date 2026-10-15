const { test, describe } = require('node:test');
const assert = require('node:assert');
const StepDebugger = require('../js/step_debugger.js');
const solver = require('../js/solver.js');

describe('Step Debugger LaTeX and Navigation (StepDebugger)', () => {

  const canonicalInput = {
    q_si: 20.0,
    q_li: 3.0,
    Q_v: 1000.0,
    pointV_props: { t: 31.0, phi: 70.0 },
    pointR_props: { t: 24.0, phi: 50.0 },
    phi_I: 90.0,
    fr_infiltr: 0.0,
    altitude: 0
  };

  const sol = solver.solve(canonicalInput);

  test('StepDebugger defines TOTAL_STEPS = 8', () => {
    assert.strictEqual(StepDebugger.TOTAL_STEPS, 8);
  });

  for (let step = 1; step <= 8; step++) {
    test(`Step ${step} generates valid LaTeX content without NaN or undefined`, () => {
      const data = StepDebugger.getStepContent(step, sol);

      assert.ok(data.title && data.title.length > 0, `Step ${step} should have a title`);
      assert.ok(data.summary && data.summary.length > 0, `Step ${step} should have a summary`);
      assert.ok(data.latexFormula && data.latexFormula.length > 0, `Step ${step} should have latexFormula`);
      assert.ok(data.latexSubstituted && data.latexSubstituted.length > 0, `Step ${step} should have latexSubstituted`);

      // Crucial: check no undefined, NaN, or null is present in the KaTeX string
      assert.ok(!data.latexFormula.includes('NaN'), `Step ${step} formula contains NaN`);
      assert.ok(!data.latexFormula.includes('undefined'), `Step ${step} formula contains undefined`);
      assert.ok(!data.latexSubstituted.includes('NaN'), `Step ${step} substituted contains NaN`);
      assert.ok(!data.latexSubstituted.includes('undefined'), `Step ${step} substituted contains undefined`);
      assert.ok(!data.latexSubstituted.includes('null'), `Step ${step} substituted contains null`);
    });
  }

  test('Step 1 explains ventilation and return points', () => {
    const data = StepDebugger.getStepContent(1, sol);
    assert.ok(data.title.includes('V i R') || data.summary.includes('Ventilació'));
    assert.ok(data.latexSubstituted.includes('31.0') || data.latexSubstituted.includes('31'));
    assert.ok(data.latexSubstituted.includes('24.0') || data.latexSubstituted.includes('24'));
  });

  test('Step 2 explains FCS_i and room maneuver line', () => {
    const data = StepDebugger.getStepContent(2, sol);
    assert.ok(data.title.includes('Maniobra') || data.summary.includes('FCS'));
    assert.ok(data.latexSubstituted.includes('0.87') || data.latexSubstituted.includes('0.8696'));
  });

  test('Step 3 explains impulse condition', () => {
    const data = StepDebugger.getStepContent(3, sol);
    assert.ok(data.title.includes('Impulsió'));
    assert.ok(data.latexSubstituted.includes('13.5') || data.latexSubstituted.includes('13.49'));
  });

  test('Step 4 explains airflow balance', () => {
    const data = StepDebugger.getStepContent(4, sol);
    assert.ok(data.title.includes('Cabal'));
    assert.ok(data.latexSubstituted.includes('Q_I') || data.latexSubstituted.includes('Q_{I}'));
  });

  test('Step 5 explains mixing chamber', () => {
    const data = StepDebugger.getStepContent(5, sol);
    assert.ok(data.title.includes('Mescla'));
    assert.ok(data.latexSubstituted.includes('25.1') || data.latexSubstituted.includes('25.0'));
  });

  test('Step 6 explains cooling coil and bypass factor', () => {
    const data = StepDebugger.getStepContent(6, sol);
    assert.ok(data.title.includes('Bateria') || data.title.includes('Bypass'));
    assert.ok(data.latexSubstituted.includes('FBP') || data.latexSubstituted.includes('10.96'));
  });

  test('Step 7 explains condensates and coil refrigeration capacity', () => {
    const data = StepDebugger.getStepContent(7, sol);
    assert.ok(data.title.includes('Condens') || data.title.includes('Potència'));
    assert.ok(data.latexSubstituted.includes('16.2') || data.latexSubstituted.includes('33.7'));
  });

  test('Step 8 shows coil temperature and viability', () => {
    const data = StepDebugger.getStepContent(8, sol);
    assert.ok(data.title.includes('Bateria'));
    assert.ok(data.summary.includes('viable'));
    assert.ok(data.latexSubstituted.includes('10.96'));
  });

  test('Step 4 reports mass flows and the 100% outdoor air case (m_R = 0)', () => {
    const oa = solver.solve({
      q_si: 5, q_li: 1, Q_v: 5000,
      pointV_props: { t: 35, phi: 70 }, pointR_props: { t: 24, phi: 55 }, phi_I: 90
    });
    assert.ok(oa.allOutdoorAir);
    const data = StepDebugger.getStepContent(4, oa);
    assert.ok(data.summary.includes('ṁ_R = 0.0000'));
    assert.ok(data.latexSubstituted.includes('\\dot{m}_{I,\\text{bal}}'));
  });

  test('Step 8 describes the backward recalculation when T_bat is fixed to the minimum', () => {
    const fixed = solver.solve({
      q_si: 20, q_li: 5, Q_v: 1000,
      pointV_props: { t: 10, phi: 40 }, pointR_props: { t: 22, phi: 45 }, phi_I: 90
    });
    assert.ok(fixed.coil.corrected);
    const s6 = StepDebugger.getStepContent(6, fixed);
    assert.ok(s6.summary.includes('NO viable') || s6.summary.includes('no és viable'));
    assert.ok(s6.latexSubstituted.includes('NO viable') && s6.latexSubstituted.includes('Pas 7'));
    assert.ok(s6.latexSubstituted.includes(fixed.naturalSolution.points.S.t.toFixed(2)));
    const data = StepDebugger.getStepContent(7, fixed);
    assert.ok(data.title.includes('recàlcul cap enrere'));
    assert.ok(data.latexSubstituted.includes('Càlcul de la solució'));
    assert.ok(data.latexSubstituted.includes(fixed.points.I.t.toFixed(2)));
    assert.ok(StepDebugger.getStepContent(8, fixed).latexSubstituted.includes('7.00'));
    assert.ok(data.latexFormula.includes('Recàlcul cap enrere'));
    assert.ok(data.latexSubstituted.includes('Tempteig'));
    assert.ok(data.latexSubstituted.includes('bisecció 1'));
    assert.ok(data.latexSubstituted.includes('\\begin{array}'));
  assert.ok(!StepDebugger.getStepContent(3, fixed).summary.includes('recalculat cap enrere'), 'els passos 1-7 mostren el càlcul normal');
  assert.ok(Math.abs(fixed.naturalSolution.coil.T - fixed.coil.natural.T_S) < 1e-6);
  });

  test('Navigation bounds: step clamping', () => {
    StepDebugger.setSolution(sol);

    // Initial step is 1
    assert.strictEqual(StepDebugger.getCurrentStep(), 1);

    // Prev step cannot go below 1
    StepDebugger.prevStep();
    assert.strictEqual(StepDebugger.getCurrentStep(), 1);

    // Jump to last step
    StepDebugger.lastStep();
    assert.strictEqual(StepDebugger.getCurrentStep(), 8);

    // Next step cannot exceed 8
    StepDebugger.nextStep();
    assert.strictEqual(StepDebugger.getCurrentStep(), 8);

    // Jump to first step
    StepDebugger.firstStep();
    assert.strictEqual(StepDebugger.getCurrentStep(), 1);
  });

  test('Fallback when solution is null', () => {
    const emptyContent = StepDebugger.getStepContent(1, null);
    assert.strictEqual(emptyContent.title, 'Sense dades');
    assert.strictEqual(emptyContent.latexFormula, '');
    assert.strictEqual(emptyContent.latexSubstituted, '');
  });

  test('Step 8 for the 100% outdoor air + corrected case explains the recalculation procedure', () => {
    const fixed = solver.solve({
      q_si: 15, q_li: 5, Q_v: 4000,
      pointV_props: { t: 26, phi: 30 }, pointR_props: { t: 22, phi: 45 }, phi_I: 90
    });
    const data = StepDebugger.getStepContent(fixed.naturalSolution ? 7 : 8, fixed);
    assert.ok(data.latexSubstituted.includes('100'));
    assert.ok(data.latexSubstituted.includes('aire exterior'));
    assert.ok(!/undefined|NaN|null/.test(data.latexFormula + data.latexSubstituted));
  });
});

test('Pas 8: també mostra el procediment quan el recàlcul no té solució', () => {
  const S = require('../js/solver.js'), D = require('../js/step_debugger.js');
  let found = null, seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const U = (a, b) => a + (b - a) * rnd();
  for (let k = 0; k < 3000 && !found; k++) {
    const V = S.solvePointFromProperties({ t: U(10, 42), phi: U(20, 90) });
    const R = S.solvePointFromProperties({ t: U(20, 28), phi: U(35, 65) });
    let s; try { s = S.solve({ q_si: U(3, 50), q_li: U(0, 12), Q_v: U(300, 10000), pointV: V, pointR: R, phi_I: U(75, 99) }); } catch (e) { continue; }
    if (s.coil.recalc && s.coil.recalc.failed) found = s;
  }
  assert.ok(found, 'cal trobar un cas sense solució');
  const c = D.getStepContent(8, found);
  assert.match(c.latexFormula, /Recàlcul cap enrere/);
  assert.match(c.latexSubstituted, /no hi ha solució/);
});
