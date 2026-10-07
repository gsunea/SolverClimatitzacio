const { test, describe } = require('node:test');
const assert = require('node:assert');
const chart = require('../js/chart.js');
const solver = require('../js/solver.js');

describe('Psychrometric Chart Plotting (PsychroChart)', () => {

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

  test('Base chart dimensions and clipPath definition', () => {
    const svg = chart.generateSvg(sol);

    assert.ok(svg.includes(`viewBox="0 0 ${chart.WIDTH} ${chart.HEIGHT}"`));
    assert.ok(svg.includes('<clipPath id="chart-clip">'), 'Chart must define a clipPath to restrict plotting area');
    assert.ok(svg.includes(`width="${chart.PLOT_W}" height="${chart.PLOT_H}"`));
    assert.strictEqual(chart.PLOT_W, 640);
    assert.strictEqual(chart.PLOT_H, 485);
  });

  test('Standard grid and psychrometric curves are rendered', () => {
    const svg = chart.generateSvg(sol);

    // Saturation curve (phi = 100%)
    assert.ok(svg.includes('φ = 100% (Saturació)'));
    // Relative humidity labels
    assert.ok(svg.includes('50%'));
    assert.ok(svg.includes('70%'));
    // Axis labels
    assert.ok(svg.includes('Temperatura Seca T (°C)'));
    assert.ok(svg.includes('Humitat Absoluta w (g/kg a.s.)'));
  });

  test('Process lines carry clip-path attribute to prevent bleeding out of bounds', () => {
    const svg = chart.generateSvg(sol, 7);

    // Mixing line, cooling line, room line, surface extension line
    const clipMatches = svg.match(/clip-path="url\(#chart-clip\)"/g);
    assert.ok(clipMatches && clipMatches.length >= 8, 'Process lines and background curves must have clip-path');
  });

  test('Step-by-step debugger chart synchronization (Steps 1 to 7)', () => {
    // Step 1: Only V and R
    const svg1 = chart.generateSvg(sol, 1);
    assert.ok(svg1.includes('>V<'), 'Step 1 must have V');
    assert.ok(svg1.includes('>R<'), 'Step 1 must have R');
    assert.ok(!svg1.includes('>I<'), 'Step 1 must NOT have I');
    assert.ok(!svg1.includes('>M<'), 'Step 1 must NOT have M');
    assert.ok(!svg1.includes('>S<'), 'Step 1 must NOT have S');

    // Step 3: Adds I
    const svg3 = chart.generateSvg(sol, 3);
    assert.ok(svg3.includes('>I<'), 'Step 3 must have I');
    assert.ok(!svg3.includes('>M<'), 'Step 3 must NOT have M');

    // Step 5: Adds M
    const svg5 = chart.generateSvg(sol, 5);
    assert.ok(svg5.includes('>M<'), 'Step 5 must have M');
    assert.ok(!svg5.includes('>S<'), 'Step 5 must NOT have S');

    // Step 6: Adds S
    const svg6 = chart.generateSvg(sol, 6);
    assert.ok(svg6.includes('>S<'), 'Step 6 must have S');

    // Step 7: Full cycle with all points
    const svg7 = chart.generateSvg(sol, 7);
    assert.ok(svg7.includes('>V<') && svg7.includes('>R<') && svg7.includes('>I<') && svg7.includes('>M<') && svg7.includes('>S<'));
  });

  describe('Out of Bounds Graph Plotting Verification & Analysis', () => {

    test('In-bounds coordinate mapping (T in [0, 42], w in [0, 28])', () => {
      // Boundaries
      assert.strictEqual(chart.toX(0), chart.MARGIN.left); // 55
      assert.strictEqual(chart.toX(42), chart.MARGIN.left + chart.PLOT_W); // 695
      assert.strictEqual(chart.toY(0), chart.MARGIN.top + chart.PLOT_H); // 525
      assert.strictEqual(chart.toY(28), chart.MARGIN.top); // 40

      assert.strictEqual(chart.isPointInBounds({ t: 25, w_g_kg: 10 }), true);
      assert.strictEqual(chart.isPointInBounds({ t: 0, w_g_kg: 0 }), true);
      assert.strictEqual(chart.isPointInBounds({ t: 42, w_g_kg: 28 }), true);
    });

    test('Out of bounds Case 1: High outdoor temperature (T > 42°C)', () => {
      // Hot summer / desert climate: T = 45°C
      const x45 = chart.toX(45);
      assert.ok(x45 > 695, `x coordinate ${x45} should exceed chart plot area max (695)`);
      assert.ok(x45 < 760, `x coordinate ${x45} is within SVG width but encroaches on margin/axis`);

      // Extreme temperature: T = 50°C
      const x50 = chart.toX(50);
      assert.ok(x50 > chart.WIDTH, `x coordinate ${x50} exceeds SVG width (760), rendering completely outside viewport!`);

      assert.strictEqual(chart.isPointInBounds({ t: 45, w_g_kg: 15 }), false);
      assert.strictEqual(chart.isPointInBounds({ t: 50, w_g_kg: 15 }), false);
    });

    test('Out of bounds Case 2: Subzero temperatures (T < 0°C)', () => {
      // Subzero outdoor air or freezing coil: T = -5°C
      const xSub = chart.toX(-5);
      assert.ok(xSub < chart.MARGIN.left, `x coordinate ${xSub} is in left margin (< 55)`);
      assert.ok(xSub < 0, `x coordinate ${xSub} is negative (-21.19), plotted outside SVG viewport!`);

      assert.strictEqual(chart.isPointInBounds({ t: -5, w_g_kg: 2 }), false);
    });

    test('Out of bounds Case 3: High humidity ratio (w > 28 g/kg)', () => {
      // Tropical summer: T = 35°C, phi = 80% => w ~ 29.8 g/kg
      const y30 = chart.toY(30.5);
      assert.ok(y30 < chart.MARGIN.top, `y coordinate ${y30} exceeds top plot margin (< 40)`);

      // Extreme tropical: w = 35 g/kg
      const y35 = chart.toY(35.0);
      assert.ok(y35 < 0, `y coordinate ${y35} is negative (-74.1), plotted above SVG canvas!`);

      assert.strictEqual(chart.isPointInBounds({ t: 35, w_g_kg: 30.5 }), false);
    });

    test('Out of bounds Case 4: Process lines are clipped by clip-path, but circle/text markers overflow', () => {
      // Desert case: Outdoor ventilation air at T = 45°C, phi = 30%
      const desertSol = solver.solve({
        ...canonicalInput,
        pointV_props: { t: 45.0, phi: 30.0 }
      });

      assert.ok(desertSol.points.V.t > chart.T_MAX, 'Point V is beyond chart T_MAX');
      assert.strictEqual(chart.isPointInBounds(desertSol.points.V), false);

      const svg = chart.generateSvg(desertSol);

      // Verify connecting line has clip-path (so the line doesn't extend beyond the box)
      assert.ok(svg.includes('clip-path="url(#chart-clip)"'));

      // BUT check circle markers:
      // In the SVG, <circle cx="740.71..." does NOT have clip-path="url(#chart-clip)"
      const circleRegex = /<circle cx="([^"]+)" cy="([^"]+)"[^>]*>/g;
      let circleMatch;
      let foundUnclippedOutOfBoundCircle = false;

      while ((circleMatch = circleRegex.exec(svg)) !== null) {
        const cx = parseFloat(circleMatch[1]);
        if (cx > 695 || cx < 55) {
          foundUnclippedOutOfBoundCircle = true;
          // Verify circle itself does NOT have clip-path
          assert.ok(!circleMatch[0].includes('clip-path'), 'Circle marker lacks clip-path attribute');
        }
      }

      assert.ok(foundUnclippedOutOfBoundCircle, 'Expected to find circle marker plotted beyond plot bounds (x > 695)');
    });

    test('Out of bounds Case 5: Deep cooling coil surface temperature (TS < 0°C)', () => {
      // When TS is forced or reaches subzero (e.g. low temp refrigeration or dehumidification)
      const forcedTSSol = solver.solve({
        ...canonicalInput,
        target_TS: -2.0
      });

      assert.strictEqual(forcedTSSol.points.S.t, -2.0);
      assert.strictEqual(chart.isPointInBounds(forcedTSSol.points.S), false);

      const xS = chart.toX(forcedTSSol.points.S.t);
      assert.ok(xS < chart.MARGIN.left, `Point S x=${xS} is plotted to the left of the plot area`);
    });
  });
});
