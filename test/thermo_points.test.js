const { test, describe } = require('node:test');
const assert = require('node:assert');
const solver = require('../js/solver.js');
const pl = require('../js/psychrolib.js');

pl.SetUnitSystem(pl.SI);
const P_STD = pl.GetStandardAtmPressure(0); // 101325 Pa

describe('Thermodynamic State Points (solvePointFromProperties)', () => {

  const basePoint = solver.solvePointFromProperties({ t: 25.0, phi: 50.0 }, P_STD, pl);

  test('Base state point at 25°C and 50% RH has consistent properties', () => {
    assert.ok(basePoint, 'Base point should be calculated');
    assert.strictEqual(Math.round(basePoint.t * 10) / 10, 25.0);
    assert.strictEqual(Math.round(basePoint.phi * 10) / 10, 50.0);
    assert.ok(basePoint.w > 0.009 && basePoint.w < 0.011, `Expected w ~0.0099, got ${basePoint.w}`);
    assert.ok(basePoint.h > 49 && basePoint.h < 52, `Expected h ~50.3 kJ/kg, got ${basePoint.h}`);
    assert.ok(basePoint.v > 0.85 && basePoint.v < 0.87, `Expected v ~0.858 m³/kg, got ${basePoint.v}`);
    assert.ok(basePoint.tr > 13.5 && basePoint.tr < 14.5, `Expected tr ~13.9°C, got ${basePoint.tr}`);
    assert.ok(basePoint.th > 17.5 && basePoint.th < 18.5, `Expected th ~17.9°C, got ${basePoint.th}`);
  });

  // Verify all independent property pairs reconstruct the state point accurately
  const testPairs = [
    { p1: 't', p2: 'phi' },
    { p1: 't', p2: 'w' },
    { p1: 't', p2: 'h' },
    { p1: 't', p2: 'th' },
    { p1: 't', p2: 'v' },
    { p1: 't', p2: 'tr' },
    { p1: 'phi', p2: 'w' },
    { p1: 'phi', p2: 'h' },
    { p1: 'phi', p2: 'th' },
    { p1: 'phi', p2: 'v' },
    { p1: 'phi', p2: 'tr' },
    { p1: 'w', p2: 'h' },
    { p1: 'w', p2: 'th' },
    { p1: 'w', p2: 'v' },
    { p1: 'h', p2: 'th' },
    { p1: 'h', p2: 'v' },
    { p1: 'h', p2: 'tr' },
    { p1: 'th', p2: 'tr' },
    { p1: 'v', p2: 'tr' }
  ];

  for (const { p1, p2 } of testPairs) {
    test(`Reconstructs state point from pair (${p1}, ${p2})`, () => {
      const inputs = {};
      inputs[p1] = basePoint[p1];
      inputs[p2] = basePoint[p2];

      const solved = solver.solvePointFromProperties(inputs, P_STD, pl);
      assert.ok(solved, `Failed to solve from pair (${p1}, ${p2})`);

      const errT = Math.abs(solved.t - basePoint.t);
      const errW = Math.abs(solved.w - basePoint.w);

      assert.ok(errT < 0.05, `Pair (${p1}, ${p2}): Temperature discrepancy too high: ${errT}°C`);
      assert.ok(errW < 0.0001, `Pair (${p1}, ${p2}): Humidity ratio discrepancy too high: ${errW} kg/kg`);
    });
  }

  test('Physical invariants: Enthalpy matches ASHRAE formula h = 1.006*T + w*(2501 + 1.86*T)', () => {
    const calculatedH = 1.006 * basePoint.t + basePoint.w * (2501 + 1.86 * basePoint.t);
    const diff = Math.abs(basePoint.h - calculatedH);
    assert.ok(diff < 0.1, `Enthalpy discrepancy: ${diff} kJ/kg`);
  });

  test('Physical invariants: Dew point <= Wet bulb <= Dry bulb for unsaturated air', () => {
    assert.ok(basePoint.tr <= basePoint.th + 1e-4, 'Dew point must be <= Wet bulb');
    assert.ok(basePoint.th <= basePoint.t + 1e-4, 'Wet bulb must be <= Dry bulb');
  });

  test('Physical invariants: At 100% saturation, Tr = Th = T', () => {
    const satPoint = solver.solvePointFromProperties({ t: 20.0, phi: 100.0 }, P_STD, pl);
    assert.ok(Math.abs(satPoint.t - satPoint.tr) < 0.05, 'At sat, Tr must equal T');
    assert.ok(Math.abs(satPoint.t - satPoint.th) < 0.05, 'At sat, Th must equal T');
  });

  test('Error handling: Th > T throws error', () => {
    assert.throws(() => {
      solver.solvePointFromProperties({ t: 20.0, th: 25.0 }, P_STD, pl);
    }, /temperatura humida no pot superar/i);
  });

  test('Error handling: Negative relative humidity throws error', () => {
    assert.throws(() => {
      solver.solvePointFromProperties({ t: 25.0, phi: -5.0 }, P_STD, pl);
    }, /Humitat relativa fora de rang/i);
  });

  test('Error handling: Relative humidity > 100% throws error', () => {
    assert.throws(() => {
      solver.solvePointFromProperties({ t: 25.0, phi: 105.0 }, P_STD, pl);
    }, /Humitat relativa fora de rang/i);
  });

  test('Error handling: Negative humidity ratio throws error', () => {
    assert.throws(() => {
      solver.solvePointFromProperties({ t: 25.0, w: -0.005 }, P_STD, pl);
    }, /Humitat absoluta no pot ser negativa/i);
  });

  test('Error handling: w and tr alone are dependent and throw informative error', () => {
    assert.throws(() => {
      solver.solvePointFromProperties({ w: 0.01, tr: 14.0 }, P_STD, pl);
    }, /dependents/i);
  });

  test('Error handling: Incompatible humidity ratio exceeding saturation at wet bulb throws error', () => {
    assert.throws(() => {
      solver.solvePointFromProperties({ w: 0.025, th: 10.0 }, P_STD, pl);
    }, /incompatible/i);
  });

  test('Error handling: Unsupported pair (th, v) throws error', () => {
    assert.throws(() => {
      solver.solvePointFromProperties({ th: 18.0, v: 0.86 }, P_STD, pl);
    }, /no suportada/i);
  });

  test('Boundary: Providing fewer than 2 properties returns null', () => {
    const resEmpty = solver.solvePointFromProperties({}, P_STD, pl);
    assert.strictEqual(resEmpty, null);

    const resSingle = solver.solvePointFromProperties({ t: 25.0 }, P_STD, pl);
    assert.strictEqual(resSingle, null);
  });

  test('Unit helper: accepts w_g_kg instead of w (in kg/kg)', () => {
    const resG = solver.solvePointFromProperties({ t: 25.0, w_g_kg: 9.89 }, P_STD, pl);
    assert.ok(resG, 'Point should be solved from w_g_kg');
    assert.ok(Math.abs(resG.w - 0.00989) < 0.0001);
  });
});
