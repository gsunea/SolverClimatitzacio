/**
 * solver.js
 * Motor de càlcul termodinàmic per al sistema de Climatitzador en Estiu.
 * Integrat amb PsychroLib (ASHRAE Fundamentals).
 * Assignatura "Climatització i Refrigeració" (ETSEIB - UPC).
 */

const ClimaSolver = (() => {

  /**
   * Helper per obtenir instància de psychrolib (window.psychrolib o mòdul)
   */
  function getPsychroLib() {
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
    throw new Error('PsychroLib no està carregada.');
  }

  /**
   * Construeix un punt psicromètric a partir de T seca (°C) i Humitat Relativa (%)
   */
  function pointFromTAndPhi(T, phiPercent, P, lib) {
    const phi = Math.max(0, Math.min(100, phiPercent)) / 100.0;
    const res = lib.CalcPsychrometricsFromRelHum(T, phi, P);
    // [HumRatio, TWetBulb, TDewPoint, VapPres, MoistAirEnthalpy, MoistAirVolume, DegreeOfSaturation]
    const w = res[0];
    const th = res[1];
    const tr = res[2];
    const pw = res[3];
    const h = res[4] / 1000.0; // J/kg -> kJ/kg
    const v = res[5]; // m3/kg
    const rho = v > 0 ? 1.0 / v : 0;

    return {
      t: T,
      phi: phiPercent,
      w: w,
      w_g_kg: w * 1000.0,
      h: h,
      v: v,
      rho: rho,
      tr: tr,
      th: th,
      pw: pw,
      P: P
    };
  }

  /**
   * Construeix un punt psicromètric a partir de T seca (°C) i Humitat Absoluta w (kg/kg)
   */
  function pointFromTAndW(T, w, P, lib) {
    const phi = lib.GetRelHumFromHumRatio(T, w, P);
    const phiPercent = Math.max(0, Math.min(100, phi * 100.0));
    const h = lib.GetMoistAirEnthalpy(T, w) / 1000.0;
    const v = lib.GetMoistAirVolume(T, w, P);
    const rho = v > 0 ? 1.0 / v : 0;
    const tr = lib.GetTDewPointFromHumRatio(T, w, P);
    const th = lib.GetTWetBulbFromHumRatio(T, w, P);
    const pw = lib.GetVapPresFromHumRatio(w, P);

    return {
      t: T,
      phi: phiPercent,
      w: w,
      w_g_kg: w * 1000.0,
      h: h,
      v: v,
      rho: rho,
      tr: tr,
      th: th,
      pw: pw,
      P: P
    };
  }

  /**
   * Soluciona el sistema complet de climatitzador en estiu
   */
  function solve(inputs) {
    const lib = getPsychroLib();
    const altitude = parseFloat(inputs.altitude || 0);
    const P = lib.GetStandardAtmPressure(altitude); // en Pa

    const q_si = parseFloat(inputs.q_si);
    const q_li = parseFloat(inputs.q_li);
    const q_i = q_si + q_li;
    const FCS_i = q_i !== 0 ? q_si / q_i : 1.0;

    const Tv = parseFloat(inputs.Tv);
    const phi_v = parseFloat(inputs.phi_v);
    const TR = parseFloat(inputs.TR);
    const phi_R = parseFloat(inputs.phi_R);
    const Q_v = parseFloat(inputs.Q_v);
    const fr_infiltr = Math.max(0, Math.min(1, parseFloat(inputs.fr_infiltr || 0)));

    // 1. Estat de Ventilació (V)
    const pointV = pointFromTAndPhi(Tv, phi_v, P, lib);

    // 2. Cabal de ventilació
    const m_dot_v_total = Q_v / (3600.0 * pointV.v);
    const m_dot_v = m_dot_v_total * (1.0 - fr_infiltr);
    const m_dot_v_infil = m_dot_v_total * fr_infiltr;

    // 3. Estat de Retorn (R)
    const pointR = pointFromTAndPhi(TR, phi_R, P, lib);

    // 4. Càrregues de ventilació (apunts)
    const c_pas = 1.006;
    const dh_lg = 2501.0;
    const q_sv = m_dot_v_total * c_pas * (Tv - TR);
    const q_lv = m_dot_v_total * dh_lg * (pointV.w - pointR.w);
    const q_v = m_dot_v_total * (pointV.h - pointR.h);

    const q_s_total = q_si + q_sv;
    const q_l_total = q_li + q_lv;
    const q_total = q_s_total + q_l_total;
    const FCS_total = q_total !== 0 ? q_s_total / q_total : 1.0;

    // 5. Recta de maniobra de la sala
    // (w_R - w_I) / (T_R - T_I) = ((1 - FCS_i) / FCS_i) * (c_pas / dh_lg)
    const slopeRoom = FCS_i > 0
      ? ((1.0 - FCS_i) / FCS_i) * (c_pas / dh_lg)
      : 0;

    function getWOnRoomLine(T) {
      return pointR.w - slopeRoom * (pointR.t - T);
    }

    // 6. Determinació d'Impulsió (I)
    let pointI = null;
    const mode = inputs.mode || 'phi_I';

    if (mode === 'TI' && inputs.target_TI !== undefined && inputs.target_TI !== '') {
      const TI = parseFloat(inputs.target_TI);
      const wI = getWOnRoomLine(TI);
      pointI = pointFromTAndW(TI, wI, P, lib);
    } else {
      // Per defecte intersecció amb phi_I
      const targetPhi = Math.max(1, Math.min(100, parseFloat(inputs.phi_I || 90.0))) / 100.0;
      let low = 0.0;
      let high = pointR.t;
      for (let iter = 0; iter < 60; iter++) {
        const mid = (low + high) / 2.0;
        const wLine = getWOnRoomLine(mid);
        const wPhi = lib.GetHumRatioFromRelHum(mid, targetPhi, P);
        if (wLine > wPhi) {
          low = mid;
        } else {
          high = mid;
        }
      }
      const TI = (low + high) / 2.0;
      const wI = getWOnRoomLine(TI);
      pointI = pointFromTAndW(TI, wI, P, lib);
    }

    // 7. Balanç de cabals d'impulsió i retorn
    // Balanç d'entalpia a la sala: q_i = m_dot_I * (h_R - h_I)
    const deltaH_IR = pointR.h - pointI.h;
    const m_dot_I = deltaH_IR > 0 ? q_i / deltaH_IR : 0;
    const Q_I = m_dot_I * pointI.v * 3600.0;

    // Retorn recirculat a climatitzador
    const m_dot_R = Math.max(0, m_dot_I - m_dot_v);
    const Q_R = m_dot_R * pointR.v * 3600.0;

    // 8. Punt de Mescla (M)
    const m_dot_M = m_dot_I;
    let pointM = null;
    if (m_dot_M > 0) {
      const w_M = (m_dot_v * pointV.w + m_dot_R * pointR.w) / m_dot_M;
      const h_M = (m_dot_v * pointV.h + m_dot_R * pointR.h) / m_dot_M;
      // Temperatura corresponent a h_M i w_M
      const T_M = lib.GetTDryBulbFromEnthalpyAndHumRatio(h_M * 1000.0, w_M);
      pointM = pointFromTAndW(T_M, w_M, P, lib);
    } else {
      pointM = { ...pointR };
    }
    const Q_M = m_dot_M * pointM.v * 3600.0;

    // 9. Punt de Superfície de Bateria (S)
    // Prolongació del segment M-I fins a phi = 100%
    const deltaT_MI = pointM.t - pointI.t;
    const deltaW_MI = pointM.w - pointI.w;
    const slopeMI = Math.abs(deltaT_MI) > 1e-6 ? deltaW_MI / deltaT_MI : 0;

    function getWOnCoilLine(T) {
      return pointI.w - slopeMI * (pointI.t - T);
    }

    let s_low = -15.0;
    let s_high = Math.min(pointI.t, pointM.t);
    for (let iter = 0; iter < 60; iter++) {
      const mid = (s_low + s_high) / 2.0;
      const wLine = getWOnCoilLine(mid);
      const wsSat = lib.GetSatHumRatio(mid, P);
      if (wLine > wsSat) {
        s_low = mid;
      } else {
        s_high = mid;
      }
    }
    const TS = (s_low + s_high) / 2.0;
    const pointS = pointFromTAndPhi(TS, 100.0, P, lib);

    // 10. Factor de Bypass (FBP)
    // FBP = (h_I - h_S) / (h_M - h_S) ~= (T_I - T_S) / (T_M - T_S)
    const fbp_h = (pointM.h - pointS.h) !== 0 ? (pointI.h - pointS.h) / (pointM.h - pointS.h) : 0;
    const fbp_T = (pointM.t - pointS.t) !== 0 ? (pointI.t - pointS.t) / (pointM.t - pointS.t) : 0;
    const FBP = Math.max(0, Math.min(1, fbp_T));

    // 11. Condensats i Potència de Bateria
    const m_dot_cond = Math.max(0, m_dot_I * (pointM.w - pointI.w)); // kg/s
    const M_cond_h = m_dot_cond * 3600.0; // kg/h
    const q_bateria = m_dot_I * (pointM.h - pointI.h); // kW

    return {
      points: {
        V: { label: 'Ventilació', symbol: 'V', ...pointV, Q: Q_v, m_dot: m_dot_v_total },
        R: { label: 'Retorn', symbol: 'R', ...pointR, Q: Q_R, m_dot: m_dot_R },
        M: { label: 'Mescla', symbol: 'M', ...pointM, Q: Q_M, m_dot: m_dot_M },
        I: { label: 'Impulsió', symbol: 'I', ...pointI, Q: Q_I, m_dot: m_dot_I },
        S: { label: 'Superfície', symbol: 'S', ...pointS, Q: 0, m_dot: 0 }
      },
      powers: {
        q_si,
        q_li,
        q_i,
        FCS_i,
        q_sv,
        q_lv,
        q_v,
        q_s_total,
        q_l_total,
        q_total,
        FCS_total,
        q_bateria,
        FBP,
        FBP_h: fbp_h,
        m_dot_cond,
        M_cond_h,
        P_atm_Pa: P,
        P_atm_kPa: P / 1000.0
      },
      slopeRoom,
      slopeMI
    };
  }

  return {
    solve,
    pointFromTAndPhi,
    pointFromTAndW
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClimaSolver;
}
