const { test, describe } = require('node:test');
const assert = require('node:assert');
const solver = require('../js/solver.js');

describe('HVAC System Solver (ClimaSolver.solve)', () => {

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

  test('Canonical Example (Ej. 1): Matches reference textbook & classroom values', () => {
    const sol = solver.solve(canonicalInput);

    assert.ok(sol, 'Solution should be calculated');

    // 1. Sensible Heat Ratio
    assert.strictEqual(Math.round(sol.powers.FCS_i * 10000) / 10000, 0.8696);
    assert.strictEqual(sol.powers.q_i, 23.0);

    // 2. State Point V (Ventilació)
    const V = sol.points.V;
    assert.strictEqual(Math.round(V.t * 10) / 10, 31.0);
    assert.strictEqual(Math.round(V.phi * 10) / 10, 70.0);
    assert.strictEqual(Math.round(V.w_g_kg * 10) / 10, 19.9);
    assert.strictEqual(Math.round(V.v * 1000) / 1000, 0.889);
    assert.strictEqual(Math.round(V.h * 10) / 10, 82.2);
    assert.strictEqual(Math.round(V.tr * 10) / 10, 24.9);
    assert.strictEqual(Math.round(V.th * 10) / 10, 26.4);

    // 3. State Point R (Retorn)
    const R = sol.points.R;
    assert.strictEqual(Math.round(R.t * 10) / 10, 24.0);
    assert.strictEqual(Math.round(R.phi * 10) / 10, 50.0);
    assert.strictEqual(Math.round(R.w_g_kg * 10) / 10, 9.3);
    assert.strictEqual(Math.round(R.v * 1000) / 1000, 0.854);
    assert.strictEqual(Math.round(R.h * 10) / 10, 47.8);
    assert.strictEqual(Math.round(R.tr * 10) / 10, 12.9);
    assert.strictEqual(Math.round(R.th * 10) / 10, 17.1);

    // 4. State Point I (Impulsió)
    const I = sol.points.I;
    assert.strictEqual(Math.round(I.t * 10) / 10, 13.5);
    assert.strictEqual(Math.round(I.phi * 10) / 10, 90.0);
    assert.strictEqual(Math.round(I.w_g_kg * 100) / 100, 8.66);

    // 5. State Point S (Superfície de bateria a saturació)
    const S = sol.points.S;
    assert.strictEqual(Math.round(S.t * 100) / 100, 10.96);
    assert.strictEqual(Math.round(S.phi * 10) / 10, 100.0);

    // 6. State Point M (Mescla)
    const M = sol.points.M;
    assert.ok(M.t > 24.8 && M.t < 25.4, `Expected T_M ~25.1°C, got ${M.t}`);
    assert.ok(M.w_g_kg > 10.8 && M.w_g_kg < 11.3, `Expected w_M ~11.0 g/kg, got ${M.w_g_kg}`);

    // 7. Mass & Volumetric Flow Balances
    // m_dot_M = m_dot_I = m_dot_v + m_dot_R
    const m_diff = Math.abs(sol.points.M.m_dot - (sol.points.V.m_dot + sol.points.R.m_dot));
    assert.ok(m_diff < 1e-6, `Mass balance violated: diff = ${m_diff}`);
    assert.strictEqual(sol.points.I.m_dot, sol.points.M.m_dot);

    // 8. Room Enthalpy Balance: q_i = m_dot_I * (h_R - h_I)
    const q_room_calc = sol.points.I.m_dot * (R.h - I.h);
    const q_room_err = Math.abs(q_room_calc - sol.powers.q_i);
    assert.ok(q_room_err < 0.05, `Room balance discrepancy: ${q_room_err} kW`);

    // 9. Condensate and Coil Capacity
    assert.ok(Math.abs(sol.powers.M_cond_h - 16.21) < 0.2, `Expected M_cond ~16.2 kg/h, got ${sol.powers.M_cond_h}`);
    assert.ok(Math.abs(sol.powers.q_bateria - 33.74) < 0.2, `Expected q_bat ~33.7 kW, got ${sol.powers.q_bateria}`);
    assert.ok(Math.abs(sol.powers.FBP - 0.178) < 0.01, `Expected FBP ~0.178, got ${sol.powers.FBP}`);

    // 10. Ventilation & Total Loads
    const p = sol.powers;
    assert.ok(Math.abs(p.q_sv - 2.19) < 0.1, `Expected q_sv ~2.19, got ${p.q_sv}`);
    assert.ok(Math.abs(p.q_lv - 8.30) < 0.1, `Expected q_lv ~8.30, got ${p.q_lv}`);
    assert.ok(Math.abs(p.q_s_total - 22.19) < 0.1, `Expected q_s_total ~22.19, got ${p.q_s_total}`);
    assert.ok(Math.abs(p.q_l_total - 11.30) < 0.1, `Expected q_l_total ~11.30, got ${p.q_l_total}`);
    assert.ok(Math.abs(p.q_total - 33.49) < 0.1, `Expected q_total ~33.49, got ${p.q_total}`);
    assert.ok(Math.abs(p.FCS_total - 0.662) < 0.01, `Expected FCS_total ~0.662, got ${p.FCS_total}`);
  });

  test('Mode A: Explicit target_TI overrides phi_I', () => {
    const input = { ...canonicalInput, target_TI: 14.0 };
    const sol = solver.solve(input);

    assert.strictEqual(Math.round(sol.points.I.t * 10) / 10, 14.0);
    // On the room line: w_I = w_R - slopeRoom*(T_R - T_I)
    const expectedWI = sol.points.R.w - sol.slopeRoom * (sol.points.R.t - 14.0);
    assert.ok(Math.abs(sol.points.I.w - expectedWI) < 1e-6);
  });

  test('Mode B: Explicit target_QI determines impulse state and flow', () => {
    const targetQ = 6500.0;
    const input = { ...canonicalInput, target_QI: targetQ };
    const sol = solver.solve(input);

    assert.ok(Math.abs(sol.points.I.Q - targetQ) < 1.0, `Expected Q_I ~${targetQ}, got ${sol.points.I.Q}`);
    assert.ok(sol.points.I.t < sol.points.R.t, 'T_I must be cooler than T_R');
  });

  test('Mode C: Explicit target_TS overrides coil surface iteration', () => {
    const targetTS = 10.0;
    const input = { ...canonicalInput, target_TS: targetTS };
    const sol = solver.solve(input);

    assert.strictEqual(Math.round(sol.points.S.t * 10) / 10, targetTS);
    assert.strictEqual(Math.round(sol.points.S.phi), 100);
  });

  test('Infiltration: Non-zero infiltration fraction reduces coil ventilation airflow', () => {
    const inputNoInfil = { ...canonicalInput, fr_infiltr: 0.0 };
    const inputWithInfil = { ...canonicalInput, fr_infiltr: 0.25 }; // 25% infiltration

    const solNo = solver.solve(inputNoInfil);
    const solInfil = solver.solve(inputWithInfil);

    // Infiltration air leaks directly into the room, so coil sees less outdoor air
    assert.ok(solInfil.points.M.t < solNo.points.M.t, 'Mix point T_M should be cooler with outdoor infiltration bypassing coil');

    // ...but the infiltration load moves to the room: the coil still removes q_i + q_v in both cases
    for (const sol of [solNo, solInfil]) {
      const closure = Math.abs(sol.powers.q_bateria - (sol.powers.q_i + sol.powers.q_v));
      assert.ok(closure < 1e-6, `Coil energy balance must close: |q_bat - (q_i + q_v)| = ${closure} kW`);
    }
    assert.ok(solInfil.powers.q_room > solInfil.powers.q_i, 'Infiltration adds load to the room balance');
  });

  test('Regression: FCS_i passed as null (UI default) is derived from q_si and q_li', () => {
    const sol = solver.solve({ ...canonicalInput, FCS_i: null });
    assert.strictEqual(Math.round(sol.powers.FCS_i * 10000) / 10000, 0.8696);
    assert.ok(sol.slopeRoom > 0, 'Room process line must not be horizontal');
    assert.strictEqual(Math.round(sol.points.I.t * 10) / 10, 13.5);
  });

  test('FCS_i input drives q_li so loads stay consistent', () => {
    const sol = solver.solve({ ...canonicalInput, FCS_i: 0.8 });
    assert.ok(Math.abs(sol.powers.q_li - 5.0) < 1e-9);
    assert.ok(Math.abs(sol.powers.q_si / sol.powers.q_i - 0.8) < 1e-9);
    assert.throws(() => solver.solve({ ...canonicalInput, FCS_i: 1.2 }), /FCS_i/);
  });

  test('Unreachable impulse targets throw instead of returning silent wrong states', () => {
    assert.throws(() => solver.solve({ ...canonicalInput, phi_I: 14 }), /φ_I/);
    assert.throws(() => solver.solve({ ...canonicalInput, target_TI: 26 }), /inferior a la de retorn/);
    assert.throws(() => solver.solve({ ...canonicalInput, target_TI: 5 }), /saturació/);
    assert.throws(() => solver.solve({ ...canonicalInput, target_QI: 1 }), /massa petit/);
  });

  test('Mode w_I: target humidity on the room line', () => {
    const ref = solver.solve(canonicalInput);
    const sol = solver.solve({ ...canonicalInput, target_wI: ref.points.I.w });
    assert.ok(Math.abs(sol.points.I.t - ref.points.I.t) < 1e-6);
    assert.strictEqual(sol.impulseMode, 'w_I');
  });

  test('Pure Sensible Load: q_li = 0 => FCS_i = 1.0, room process line is horizontal (w_I = w_R)', () => {
    const input = { ...canonicalInput, q_li: 0.0 };
    const sol = solver.solve(input);

    assert.strictEqual(sol.powers.FCS_i, 1.0);
    assert.strictEqual(sol.slopeRoom, 0.0);
    assert.ok(Math.abs(sol.points.I.w - sol.points.R.w) < 1e-6, 'With FCS_i=1, w_I must equal w_R');
  });

  test('Altitude correction: Z = 1000m has lower atmospheric pressure', () => {
    const solSeaLevel = solver.solve({ ...canonicalInput, altitude: 0 });
    const solHigh = solver.solve({ ...canonicalInput, altitude: 1000 });

    assert.strictEqual(Math.round(solSeaLevel.powers.P_atm_Pa), 101325);
    assert.ok(solHigh.powers.P_atm_Pa < 101325, 'Pressure at 1000m must be lower than sea level');
    assert.ok(solHigh.points.V.v > solSeaLevel.points.V.v, 'Specific volume is higher at lower atmospheric pressure');
  });

  test('All-Outdoor Air System (Q_v >= Q_I): Return recirculated air m_dot_R is 0', () => {
    // Huge ventilation flow
    const input = { ...canonicalInput, Q_v: 20000.0 };
    const sol = solver.solve(input);

    assert.strictEqual(sol.points.R.m_dot, 0);
    assert.strictEqual(sol.points.R.Q, 0);
    // Mix point becomes identical to outdoor ventilation point
    assert.strictEqual(sol.points.M.t, sol.points.V.t);
    // Supply flow equals ventilation flow and the energy balance still closes
    assert.ok(sol.allOutdoorAir);
    assert.ok(Math.abs(sol.points.I.m_dot - sol.points.V.m_dot) < 1e-9);
    const closure = Math.abs(sol.powers.q_bateria - (sol.powers.q_i + sol.powers.q_v));
    assert.ok(closure < 1e-6, `Coil energy balance must close: ${closure} kW`);
  });

  test('Error handling: Missing pointV throws descriptive error', () => {
    assert.throws(() => {
      solver.solve({ ...canonicalInput, pointV_props: null, pointV: null });
    }, /insuficients.*Ventilaci/i);
  });

  test('Error handling: Missing pointR throws descriptive error', () => {
    assert.throws(() => {
      solver.solve({ ...canonicalInput, pointR_props: null, pointR: null });
    }, /insuficients.*Retorn/i);
  });

  test('Hot humid ventilation: supersaturated mix V–R is handled as fog, not an error', () => {
    const sol = solver.solve({
      q_si: 5, q_li: 0, Q_v: 1000,
      pointV_props: { t: 45, phi: 90 }, pointR_props: { t: 20, phi: 50 },
      phi_I: 90, fr_infiltr: 0, altitude: 0
    });
    assert.ok(Math.abs(sol.points.M.phi - 100) < 1e-6, 'M should be saturated');
    assert.ok(sol.warnings.some(w => /boira/i.test(w)));
    assert.ok(sol.powers.m_dot_cond > 0);
  });

  describe('Mass flows: ventilation larger than supply (m_v > m_I)', () => {
    const base = {
      q_si: 5, q_li: 1, Q_v: 5000,
      pointV_props: { t: 35, phi: 70 }, pointR_props: { t: 24, phi: 55 }, altitude: 0
    };

    for (const [label, extra] of [
      ['phi_I', { phi_I: 90 }],
      ['T_I', { target_TI: 16 }],
      ['w_I', { target_wI: solver.solve({
        q_si: 5, q_li: 1, Q_v: 5000,
        pointV_props: { t: 35, phi: 70 }, pointR_props: { t: 24, phi: 55 }, phi_I: 90
      }).points.I.w * 0.98 }],
      ['Q_I', { target_QI: 2000 }]
    ]) {
      test(`m_I = m_v and m_R = 0 (never negative) with fixed ${label}`, () => {
        const sol = solver.solve({ ...base, ...extra });
        assert.ok(sol.allOutdoorAir);
        assert.strictEqual(sol.points.R.m_dot, 0);
        assert.ok(Math.abs(sol.points.I.m_dot - sol.powers.m_dot_v_coil) < 1e-12);
        assert.ok(sol.points.R.m_dot >= 0);
        assert.ok(Math.abs(sol.points.I.m_dot * (sol.points.R.h - sol.points.I.h) - sol.powers.q_room) < 1e-6);
      });
    }

    test('Mass flows are exposed in powers (m_dot_I, m_dot_R, m_dot_v_total)', () => {
      const sol = solver.solve(canonicalInput);
      assert.ok(sol.powers.m_dot_I > 0 && sol.powers.m_dot_v_total > 0);
      assert.ok(Math.abs(sol.powers.m_dot_I - (sol.powers.m_dot_v_coil + sol.powers.m_dot_R)) < 1e-12);
    });
  });

  describe('Coil temperature (T_bat = T_S) and viability', () => {
    test('Canonical example: T_bat > 9 °C is viable', () => {
      const sol = solver.solve(canonicalInput);
      assert.strictEqual(sol.coil.status, 'viable');
      assert.ok(sol.coil.T > 9);
      assert.ok(/viable/.test(sol.coil.message));
      assert.ok(!sol.coil.corrected);
    });

    test('T_bat between 7 and 9 °C gives the "compte" warning', () => {
      const sol = solver.solve({ ...canonicalInput, target_TS: 8.0 });
      assert.strictEqual(sol.coil.status, 'ojo');
      assert.ok(/Compte/.test(sol.coil.message));
      assert.ok(Math.abs(sol.coil.T - 8.0) < 1e-3);
    });

    const coldCase = {
      q_si: 20, q_li: 5, Q_v: 1000,
      pointV_props: { t: 10, phi: 40 }, pointR_props: { t: 22, phi: 45 }, phi_I: 90
    };

    test('T_bat < 7 °C is fixed to 7 °C and the supply state is recalculated backwards', () => {
      const withoutFix = solver.solve({ ...coldCase, fix_min_TS: false });
      assert.strictEqual(withoutFix.coil.status, 'no_viable');
      assert.ok(withoutFix.coil.T < 7);

      const fixed = solver.solve(coldCase);
      assert.ok(fixed.coil.corrected);
      assert.ok(Math.abs(fixed.points.S.t - 7.0) < 1e-3, `T_S = ${fixed.points.S.t}`);
      assert.strictEqual(fixed.coil.status, 'ojo');
      assert.ok(fixed.points.I.t > withoutFix.points.I.t, 'supply must be warmer than the non-viable solution');
      // El balanç de la sala i de masses segueix tancant
      const { I, R } = fixed.points;
      assert.ok(Math.abs(I.m_dot * (R.h - I.h) - fixed.powers.q_room) < 1e-6);
      assert.ok(Math.abs(I.m_dot - (fixed.powers.m_dot_v_coil + R.m_dot)) < 1e-9);
      // M, I i S estan alineats (recta de bateria)
      const { M, S } = fixed.points;
      const s1 = (I.w - M.w) / (I.t - M.t);
      const s2 = (S.w - I.w) / (S.t - I.t);
      assert.ok(Math.abs(s1 - s2) < 1e-6);
    });

    test('Sweep: every corrected case ends with T_bat = 7 °C and a closed energy balance', () => {
      let corrected = 0;
      for (const Tv of [10, 28, 35]) for (const phiI of [75, 90, 98]) for (const qsi of [5, 20]) for (const Qv of [1000, 5000]) {
        let sol;
        try {
          sol = solver.solve({
            q_si: qsi, q_li: 5, Q_v: Qv,
            pointV_props: { t: Tv, phi: 40 }, pointR_props: { t: 22, phi: 45 }, phi_I: phiI
          });
        } catch (e) { continue; }
        if (!sol.coil.corrected) continue;
        corrected++;
        assert.ok(Math.abs(sol.points.S.t - 7.0) < 1e-3);
        assert.ok(sol.points.R.m_dot >= 0);
      }
      assert.ok(corrected > 0, 'the sweep should exercise the backward recalculation');
    });

    test('If no supply state can reach 7 °C the case is reported as not viable (no crash)', () => {
      const sol = solver.solve({
        q_si: 5, q_li: 1, Q_v: 0,
        pointV_props: { t: 10, phi: 40 }, pointR_props: { t: 22, phi: 45 }, phi_I: 75
      });
      assert.strictEqual(sol.coil.status, 'no_viable');
      assert.ok(sol.coil.unresolved);
    });
  });

  describe('Reference case: ventilation mass flow > supply AND coil temperature below 7 °C', () => {
    // V 26 °C / 30 %, R 22 °C / 45 %, q_si 15 kW, q_li 5 kW, Q_v 4000 m3/h, phi_I 90 %
    const oaCase = {
      q_si: 15, q_li: 5, Q_v: 4000,
      pointV_props: { t: 26, phi: 30 }, pointR_props: { t: 22, phi: 45 },
      phi_I: 90, fr_infiltr: 0, altitude: 0
    };

    test('Without the coil limit: m_v > m_I -> 100% outdoor air (m_I = m_v, m_R = 0) and T_bat < 7 °C', () => {
      const sol = solver.solve({ ...oaCase, fix_min_TS: false });
      assert.ok(sol.allOutdoorAir);
      assert.strictEqual(sol.points.R.m_dot, 0);
      assert.ok(Math.abs(sol.points.I.m_dot - sol.powers.m_dot_v_coil) < 1e-12);
      assert.ok(sol.powers.m_dot_I_balance < sol.powers.m_dot_v_coil, 'balance flow is smaller than ventilation flow');
      assert.strictEqual(sol.coil.status, 'no_viable');
      assert.ok(sol.coil.T < 7);
    });

    test('With the coil limit: T_bat is fixed to 7 °C, recirculation comes back (m_R > 0) and m_I >= m_v', () => {
      const sol = solver.solve(oaCase);
      assert.ok(sol.coil.corrected);
      assert.ok(sol.coil.natural.allOutdoorAir, 'the starting point was the 100% outdoor air case');
      assert.ok(Math.abs(sol.points.S.t - 7.0) < 1e-3);
      assert.ok(!sol.allOutdoorAir);
      assert.ok(sol.points.R.m_dot > 0);
      assert.ok(sol.points.I.m_dot >= sol.powers.m_dot_v_coil);
      assert.ok(Math.abs(sol.points.I.m_dot * (sol.points.R.h - sol.points.I.h) - sol.powers.q_room) < 1e-6);
      // Traça del procediment: inicial ... solució, amb T_S final = 7
      const tr = sol.coil.recalc.trials;
      assert.strictEqual(tr[0].label, 'inicial');
      assert.strictEqual(tr[tr.length - 1].label, 'solució');
      assert.ok(Math.abs(tr[tr.length - 1].T_S - 7.0) < 1e-3);
      assert.ok(tr.some(t => /bisecció/.test(t.label)));
    });
  });
});
