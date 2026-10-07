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

  test('StepDebugger defines TOTAL_STEPS = 7', () => {
    assert.strictEqual(StepDebugger.TOTAL_STEPS, 7);
  });

  for (let step = 1; step <= 7; step++) {
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

  test('Navigation bounds: step clamping', () => {
    StepDebugger.setSolution(sol);

    // Initial step is 1
    assert.strictEqual(StepDebugger.getCurrentStep(), 1);

    // Prev step cannot go below 1
    StepDebugger.prevStep();
    assert.strictEqual(StepDebugger.getCurrentStep(), 1);

    // Jump to last step
    StepDebugger.lastStep();
    assert.strictEqual(StepDebugger.getCurrentStep(), 7);

    // Next step cannot exceed 7
    StepDebugger.nextStep();
    assert.strictEqual(StepDebugger.getCurrentStep(), 7);

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
});
