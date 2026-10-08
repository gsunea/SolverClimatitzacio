const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

describe('App Reactivity and Solve Button Review', () => {

  // Re-implemented exact logic from app.js for isolated unit testing
  function parseNum(val) {
    if (val === null || val === undefined) return null;
    const s = String(val).replace('%', '').replace(',', '.').trim();
    if (s === '') return null;
    const num = parseFloat(s);
    return isNaN(num) ? null : num;
  }

  function fmt(val, decimals = 1) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return Number(val).toFixed(decimals).replace('.', ',');
  }

  function checkDataStatusLogic(state) {
    const hasV = state.v && state.v.activeProps && state.v.activeProps.length >= 2;
    const hasR = state.r && state.r.activeProps && state.r.activeProps.length >= 2;
    const hasQsi = state.powers && state.powers.q_si !== null && !isNaN(state.powers.q_si);
    const hasQli = state.powers && (
      (state.powers.q_li !== null && !isNaN(state.powers.q_li)) ||
      (state.powers.fcs_i !== null && !isNaN(state.powers.fcs_i))
    );
    const hasQv = state.flows && state.flows.q_v !== null && !isNaN(state.flows.q_v) && state.flows.q_v > 0;

    return hasV && hasR && hasQsi && hasQli && hasQv;
  }

  test('parseNum handles numbers, European comma decimals, percentages and empty values', () => {
    assert.strictEqual(parseNum(25), 25);
    assert.strictEqual(parseNum('31.5'), 31.5);
    assert.strictEqual(parseNum('31,5'), 31.5);
    assert.strictEqual(parseNum('70%'), 70.0);
    assert.strictEqual(parseNum(' 85,4 % '), 85.4);
    assert.strictEqual(parseNum(''), null);
    assert.strictEqual(parseNum('   '), null);
    assert.strictEqual(parseNum(null), null);
    assert.strictEqual(parseNum(undefined), null);
    assert.strictEqual(parseNum('invalid'), null);
  });

  test('fmt outputs Catalan comma decimals and handles null/undefined/NaN', () => {
    assert.strictEqual(fmt(24.5, 1), '24,5');
    assert.strictEqual(fmt(0.8893, 3), '0,889');
    assert.strictEqual(fmt(12.3456, 2), '12,35');
    assert.strictEqual(fmt(null), '—');
    assert.strictEqual(fmt(undefined), '—');
    assert.strictEqual(fmt(NaN), '—');
  });

  test('checkDataStatus correctly assesses readiness for automatic calculation', () => {
    const readyState = {
      v: { activeProps: ['t', 'phi'] },
      r: { activeProps: ['t', 'phi'] },
      powers: { q_si: 20.0, q_li: 3.0, fcs_i: null },
      flows: { q_v: 1000.0 }
    };
    assert.strictEqual(checkDataStatusLogic(readyState), true);

    const missingV = { ...readyState, v: { activeProps: ['t'] } };
    assert.strictEqual(checkDataStatusLogic(missingV), false);

    const missingR = { ...readyState, r: { activeProps: [] } };
    assert.strictEqual(checkDataStatusLogic(missingR), false);

    const missingPower = { ...readyState, powers: { q_si: null, q_li: null, fcs_i: null } };
    assert.strictEqual(checkDataStatusLogic(missingPower), false);

    const missingFlow = { ...readyState, flows: { q_v: null } };
    assert.strictEqual(checkDataStatusLogic(missingFlow), false);
  });

  test('Review finding: The solve button (#btn-solve) was redundant and has been removed from index.html', () => {
    const htmlPath = path.join(__dirname, '..', 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    assert.ok(!htmlContent.includes('id="btn-solve"'), 'btn-solve button must not be present in index.html');
    assert.ok(!htmlContent.includes('Solucionar</button>'), 'Solucionar button text must not be present in index.html');
    assert.ok(htmlContent.includes('id="status-pill"'), 'Status indicator pill should remain present');
  });

  test('Review finding: All references to btnSolve in js/app.js have been cleanly removed', () => {
    const jsPath = path.join(__dirname, '..', 'js', 'app.js');
    const jsContent = fs.readFileSync(jsPath, 'utf-8');

    assert.ok(!jsContent.includes('btn-solve'), 'btn-solve ID must not be referenced in app.js');
    assert.ok(!jsContent.includes('btnSolve'), 'btnSolve variable must not be referenced in app.js');
  });

  test('Review finding: Calculation is fully reactive and triggered on input events', () => {
    const jsPath = path.join(__dirname, '..', 'js', 'app.js');
    const jsContent = fs.readFileSync(jsPath, 'utf-8');

    // Verify solveSystem is called reactively on input changes
    // Input handlers call refresh(), which solves when data is ready and clears stale results otherwise
    assert.ok(/function refresh\(\) \{\s*if \(checkDataStatus\(\)\) \{\s*solveSystem\(\);\s*\} else \{\s*clearOutputs\(\);/.test(jsContent),
      'refresh() must solve when data is valid and clear outputs otherwise');
    const handlerCalls = jsContent.match(/addEventListener\('input'[\s\S]*?refresh\(\);/g) || [];
    assert.ok(handlerCalls.length >= 8, `Input handlers must trigger refresh() (found ${handlerCalls.length})`);
    assert.ok(!jsContent.includes('alert('), 'Calculation errors must be shown in the status bar, not with blocking alerts');
  });
});
