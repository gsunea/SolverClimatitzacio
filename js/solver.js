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
   * Soluciona de forma analítica o per bisecció un estat psicromètric
   * a partir de 2 propietats independents qualssevol.
   * Propietats suportades a `props`:
   *  - t: Temperatura seca (°C)
   *  - phi: Humitat relativa (%)
   *  - w: Humitat absoluta (kg/kg a.s.)
   *  - w_g_kg: Humitat absoluta (g/kg a.s.)
   *  - h: Entalpia de l'aire humit (kJ/kg a.s.)
   *  - tr: Temperatura de rocío (°C)
   *  - th: Temperatura humida (°C)
   *  - v: Volum específic (m³/kg a.s.)
   */
  function solvePointFromProperties(props, P, lib) {
    if (!props) return null;
    lib = lib || getPsychroLib();
    P = (P !== undefined && P !== null) ? P : lib.GetStandardAtmPressure(0);

    let t = (props.t !== undefined && props.t !== null && props.t !== '') ? Number(props.t) : null;
    let phi = (props.phi !== undefined && props.phi !== null && props.phi !== '') ? Number(props.phi) : null;
    let w = (props.w !== undefined && props.w !== null && props.w !== '') ? Number(props.w) : null;
    let h = (props.h !== undefined && props.h !== null && props.h !== '') ? Number(props.h) : null;
    let tr = (props.tr !== undefined && props.tr !== null && props.tr !== '') ? Number(props.tr) : null;
    let th = (props.th !== undefined && props.th !== null && props.th !== '') ? Number(props.th) : null;
    let v = (props.v !== undefined && props.v !== null && props.v !== '') ? Number(props.v) : null;

    if (props.w_g_kg !== undefined && props.w_g_kg !== null && props.w_g_kg !== '' && w === null) {
      w = Number(props.w_g_kg) / 1000.0;
    }

    if (phi !== null && (phi < 0 || phi > 100)) {
      throw new Error('Humitat relativa fora de rang (0 - 100%)');
    }
    if (w !== null && w < 0) {
      throw new Error('Humitat absoluta no pot ser negativa');
    }

    const hasW = (w !== null);
    const hasTr = (tr !== null);

    // tr i w són dependents de forma 1 a 1
    if (hasTr && !hasW) {
      w = lib.GetHumRatioFromTDewPoint(tr, P);
    }

    const propList = [];
    if (t !== null) propList.push('t');
    if (phi !== null) propList.push('phi');
    if (w !== null) propList.push(hasTr && !hasW ? 'tr' : 'w');
    if (h !== null) propList.push('h');
    if (th !== null) propList.push('th');
    if (v !== null) propList.push('v');

    if (hasW && hasTr && (t === null && phi === null && h === null && th === null && v === null)) {
      throw new Error('La humitat absoluta i la temperatura de rocío són dependents. Cal una altra propietat.');
    }

    if (propList.length < 2) {
      return null;
    }

    let t_solved = null;
    let w_solved = null;

    // Parell: (t, w)
    if (t !== null && w !== null) {
      t_solved = t;
      w_solved = w;
    }
    // Parell: (t, phi)
    else if (t !== null && phi !== null) {
      t_solved = t;
      w_solved = lib.GetHumRatioFromRelHum(t, phi / 100.0, P);
    }
    // Parell: (t, h)
    else if (t !== null && h !== null) {
      t_solved = t;
      w_solved = lib.GetHumRatioFromEnthalpyAndTDryBulb(h * 1000.0, t);
    }
    // Parell: (t, th)
    else if (t !== null && th !== null) {
      if (th > t + 1e-4) {
        throw new Error('La temperatura humida no pot superar la temperatura seca');
      }
      t_solved = t;
      w_solved = lib.GetHumRatioFromTWetBulb(t, Math.min(t, th), P);
    }
    // Parell: (t, v)
    else if (t !== null && v !== null) {
      const term = (v * P) / (287.042 * (t + 273.15));
      w_solved = (term - 1.0) / 1.607858;
      t_solved = t;
    }
    // Parell: (w, phi)
    else if (w !== null && phi !== null) {
      w_solved = w;
      const Pw = lib.GetVapPresFromHumRatio(w, P);
      const Pws = Pw / (phi / 100.0);
      t_solved = lib.GetTDewPointFromVapPres(100.0, Pws);
    }
    // Parell: (w, h)
    else if (w !== null && h !== null) {
      w_solved = w;
      t_solved = lib.GetTDryBulbFromEnthalpyAndHumRatio(h * 1000.0, w);
    }
    // Parell: (w, th)
    else if (w !== null && th !== null) {
      w_solved = w;
      const wSat = lib.GetSatHumRatio(th, P);
      if (w > wSat + 1e-5) {
        throw new Error('Humitat absoluta incompatible amb la temperatura humida');
      }
      let low = th, high = 80.0;
      for (let i = 0; i < 50; i++) {
        let mid = (low + high) / 2.0;
        let w_calc = lib.GetHumRatioFromTWetBulb(mid, th, P);
        if (w_calc > w) low = mid;
        else high = mid;
      }
      t_solved = (low + high) / 2.0;
    }
    // Parell: (w, v)
    else if (w !== null && v !== null) {
      w_solved = w;
      t_solved = lib.GetTDryBulbFromMoistAirVolumeAndHumRatio(v, w, P);
    }
    // Parell: (phi, h)
    else if (phi !== null && h !== null) {
      let low = -30.0, high = 80.0;
      for (let i = 0; i < 50; i++) {
        let mid = (low + high) / 2.0;
        let w_calc = lib.GetHumRatioFromEnthalpyAndTDryBulb(h * 1000.0, mid);
        if (w_calc < 0) {
          high = mid;
          continue;
        }
        let phi_calc = lib.GetRelHumFromHumRatio(mid, w_calc, P) * 100.0;
        if (phi_calc > phi) low = mid;
        else high = mid;
      }
      t_solved = (low + high) / 2.0;
      w_solved = lib.GetHumRatioFromEnthalpyAndTDryBulb(h * 1000.0, t_solved);
    }
    // Parell: (phi, th)
    else if (phi !== null && th !== null) {
      let low = th, high = 80.0;
      for (let i = 0; i < 50; i++) {
        let mid = (low + high) / 2.0;
        let phi_calc = lib.GetRelHumFromTWetBulb(mid, th, P) * 100.0;
        if (phi_calc > phi) low = mid;
        else high = mid;
      }
      t_solved = (low + high) / 2.0;
      w_solved = lib.GetHumRatioFromTWetBulb(t_solved, th, P);
    }
    // Parell: (phi, v)
    else if (phi !== null && v !== null) {
      let low = -30.0, high = 80.0;
      for (let i = 0; i < 50; i++) {
        let mid = (low + high) / 2.0;
        let w_calc = lib.GetHumRatioFromRelHum(mid, phi / 100.0, P);
        let v_calc = lib.GetMoistAirVolume(mid, w_calc, P);
        if (v_calc < v) low = mid;
        else high = mid;
      }
      t_solved = (low + high) / 2.0;
      w_solved = lib.GetHumRatioFromRelHum(t_solved, phi / 100.0, P);
    }
    // Parell: (h, th)
    else if (h !== null && th !== null) {
      let low = th, high = 80.0;
      for (let i = 0; i < 50; i++) {
        let mid = (low + high) / 2.0;
        let w_calc = lib.GetHumRatioFromEnthalpyAndTDryBulb(h * 1000.0, mid);
        if (w_calc < 0) {
          high = mid;
          continue;
        }
        let th_calc = lib.GetTWetBulbFromHumRatio(mid, w_calc, P);
        if (th_calc < th) low = mid;
        else high = mid;
      }
      t_solved = (low + high) / 2.0;
      w_solved = lib.GetHumRatioFromEnthalpyAndTDryBulb(h * 1000.0, t_solved);
    }
    // Parell: (h, v)
    else if (h !== null && v !== null) {
      let low = -30.0, high = 80.0;
      for (let i = 0; i < 50; i++) {
        let mid = (low + high) / 2.0;
        let w_calc = lib.GetHumRatioFromEnthalpyAndTDryBulb(h * 1000.0, mid);
        let v_calc = lib.GetMoistAirVolume(mid, w_calc, P);
        if (v_calc < v) low = mid;
        else high = mid;
      }
      t_solved = (low + high) / 2.0;
      w_solved = lib.GetHumRatioFromEnthalpyAndTDryBulb(h * 1000.0, t_solved);
    }
    else {
      throw new Error('Combinació de propietats no suportada');
    }

    if (w_solved < 0) {
      throw new Error('Càlcul resulta en humitat negativa (dades incoherents)');
    }

    const phi_pct = Math.max(0, Math.min(100, lib.GetRelHumFromHumRatio(t_solved, w_solved, P) * 100.0));
    const h_kJ = lib.GetMoistAirEnthalpy(t_solved, w_solved) / 1000.0;
    const v_m3 = lib.GetMoistAirVolume(t_solved, w_solved, P);
    const tr_c = lib.GetTDewPointFromHumRatio(t_solved, w_solved, P);
    const th_c = lib.GetTWetBulbFromHumRatio(t_solved, w_solved, P);
    const Pw = lib.GetVapPresFromHumRatio(w_solved, P);

    return {
      t: t_solved,
      phi: phi_pct,
      w: w_solved,
      w_g_kg: w_solved * 1000.0,
      h: h_kJ,
      v: v_m3,
      rho: v_m3 > 0 ? 1.0 / v_m3 : 0,
      tr: tr_c,
      th: th_c,
      pw: Pw,
      P: P,
      sourceProps: propList.slice(0, 2)
    };
  }

  /**
   * Construeix un punt psicromètric a partir de T seca (°C) i Humitat Relativa (%)
   */
  function pointFromTAndPhi(T, phiPercent, P, lib) {
    return solvePointFromProperties({ t: T, phi: phiPercent }, P, lib);
  }

  /**
   * Construeix un punt psicromètric a partir de T seca (°C) i Humitat Absoluta w (kg/kg)
   */
  function pointFromTAndW(T, w, P, lib) {
    return solvePointFromProperties({ t: T, w: w }, P, lib);
  }

  /**
   * Soluciona el sistema complet de climatitzador en estiu
   */
  function solve(inputs) {
    const lib = getPsychroLib();
    const altitude = parseFloat(inputs.altitude || 0);
    const P = lib.GetStandardAtmPressure(altitude); // en Pa

    // 1. Càrregues interiors
    let q_si = parseFloat(inputs.q_si);
    let q_li = parseFloat(inputs.q_li);
    let FCS_i = inputs.FCS_i !== undefined && inputs.FCS_i !== '' ? parseFloat(inputs.FCS_i) : null;

    if ((isNaN(q_li) || q_li === null) && !isNaN(q_si) && FCS_i !== null && FCS_i > 0 && FCS_i <= 1) {
      const q_i = q_si / FCS_i;
      q_li = q_i - q_si;
    }
    const q_i = q_si + q_li;
    if (FCS_i === null) {
      FCS_i = q_i !== 0 ? q_si / q_i : 1.0;
    }

    const Q_v = parseFloat(inputs.Q_v);
    const fr_infiltr = Math.max(0, Math.min(1, parseFloat(inputs.fr_infiltr || 0)));

    // 2. Estat de Ventilació (V)
    let pointV = null;
    if (inputs.pointV && inputs.pointV.t !== undefined && inputs.pointV.w !== undefined) {
      pointV = inputs.pointV;
    } else {
      const vProps = inputs.pointV_props || {
        t: inputs.Tv,
        phi: inputs.phi_v,
        w_g_kg: inputs.w_g_kg_v,
        h: inputs.h_v,
        tr: inputs.tr_v,
        th: inputs.th_v
      };
      pointV = solvePointFromProperties(vProps, P, lib);
    }
    if (!pointV) throw new Error('Dades insuficients per determinar el punt de Ventilació (V).');

    // 3. Cabal de ventilació
    const m_dot_v_total = Q_v / (3600.0 * pointV.v);
    const m_dot_v = m_dot_v_total * (1.0 - fr_infiltr);
    const m_dot_v_infil = m_dot_v_total * fr_infiltr;

    // 4. Estat de Retorn (R)
    let pointR = null;
    if (inputs.pointR && inputs.pointR.t !== undefined && inputs.pointR.w !== undefined) {
      pointR = inputs.pointR;
    } else {
      const rProps = inputs.pointR_props || {
        t: inputs.TR,
        phi: inputs.phi_R,
        w_g_kg: inputs.w_g_kg_R,
        h: inputs.h_R,
        tr: inputs.tr_R,
        th: inputs.th_R
      };
      pointR = solvePointFromProperties(rProps, P, lib);
    }
    if (!pointR) throw new Error('Dades insuficients per determinar el punt de Retorn (R).');

    // 5. Càrregues de ventilació (apunts)
    const c_pas = 1.006;
    const dh_lg = 2501.0;
    const q_sv = m_dot_v_total * c_pas * (pointV.t - pointR.t);
    const q_lv = m_dot_v_total * dh_lg * (pointV.w - pointR.w);
    const q_v = m_dot_v_total * (pointV.h - pointR.h);

    const q_s_total = q_si + q_sv;
    const q_l_total = q_li + q_lv;
    const q_total = q_s_total + q_l_total;
    const FCS_total = q_total !== 0 ? q_s_total / q_total : 1.0;

    // 6. Recta de maniobra de la sala
    // (w_R - w_I) / (T_R - T_I) = ((1 - FCS_i) / FCS_i) * (c_pas / dh_lg)
    const slopeRoom = FCS_i > 0
      ? ((1.0 - FCS_i) / FCS_i) * (c_pas / dh_lg)
      : 0;

    function getWOnRoomLine(T) {
      return pointR.w - slopeRoom * (pointR.t - T);
    }

    // 7. Determinació d'Impulsió (I)
    let pointI = null;
    const mode = inputs.mode || 'phi_I';

    const minT = slopeRoom > 0 ? Math.max(0.0, pointR.t - pointR.w / slopeRoom) : 0.0;

    if (inputs.target_TI !== undefined && inputs.target_TI !== null && inputs.target_TI !== '') {
      const TI = parseFloat(inputs.target_TI);
      const wI = getWOnRoomLine(TI);
      pointI = solvePointFromProperties({ t: TI, w: wI }, P, lib);
    } else if (inputs.target_QI !== undefined && inputs.target_QI !== null && inputs.target_QI !== '') {
      const targetQI = parseFloat(inputs.target_QI);
      let low = minT, high = pointR.t;
      for (let i = 0; i < 60; i++) {
        const mid = (low + high) / 2.0;
        const wLine = getWOnRoomLine(mid);
        const ptMid = solvePointFromProperties({ t: mid, w: wLine }, P, lib);
        const deltaH = pointR.h - ptMid.h;
        const mDot = deltaH > 0 ? q_i / deltaH : 0;
        const Q_calc = mDot * ptMid.v * 3600.0;
        if (Q_calc > targetQI) {
          high = mid;
        } else {
          low = mid;
        }
      }
      const TI = (low + high) / 2.0;
      const wI = getWOnRoomLine(TI);
      pointI = solvePointFromProperties({ t: TI, w: wI }, P, lib);
    } else {
      const targetPhi = Math.max(1, Math.min(100, parseFloat(inputs.phi_I || 90.0))) / 100.0;
      let low = minT;
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
      if (wI < 0) {
        throw new Error(`La recta de maniobra no arriba a la humitat d'impulsió sol·licitada (φ_I = ${Math.round(targetPhi * 100)}%).`);
      }
      pointI = solvePointFromProperties({ t: TI, w: wI }, P, lib);
    }

    // 8. Balanç de cabals d'impulsió i retorn
    // Balanç d'entalpia a la sala: q_i = m_dot_I * (h_R - h_I)
    const deltaH_IR = pointR.h - pointI.h;
    const m_dot_I = deltaH_IR > 0 ? q_i / deltaH_IR : 0;
    const Q_I = m_dot_I * pointI.v * 3600.0;

    // Retorn recirculat a climatitzador
    const m_dot_R = Math.max(0, m_dot_I - m_dot_v);
    const Q_R = m_dot_R * pointR.v * 3600.0;

    // 9. Punt de Mescla (M)
    const m_dot_M = m_dot_I;
    let pointM = null;
    if (m_dot_M > 0) {
      const m_dot_v_coil = Math.min(m_dot_v, m_dot_M);
      const w_M = (m_dot_v_coil * pointV.w + m_dot_R * pointR.w) / m_dot_M;
      const h_M = (m_dot_v_coil * pointV.h + m_dot_R * pointR.h) / m_dot_M;
      const T_M = lib.GetTDryBulbFromEnthalpyAndHumRatio(h_M * 1000.0, w_M);
      pointM = solvePointFromProperties({ t: T_M, w: w_M }, P, lib);
    } else {
      pointM = { ...pointR };
    }
    const Q_M = m_dot_M * pointM.v * 3600.0;

    // 10. Punt de Superfície de Bateria (S)
    const deltaT_MI = pointM.t - pointI.t;
    const deltaW_MI = pointM.w - pointI.w;
    const slopeMI = Math.abs(deltaT_MI) > 1e-6 ? deltaW_MI / deltaT_MI : 0;

    function getWOnCoilLine(T) {
      return pointI.w - slopeMI * (pointI.t - T);
    }

    let TS = null;
    if (inputs.target_TS !== undefined && inputs.target_TS !== null && inputs.target_TS !== '') {
      TS = parseFloat(inputs.target_TS);
    } else {
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
      TS = (s_low + s_high) / 2.0;
    }
    const pointS = solvePointFromProperties({ t: TS, phi: 100.0 }, P, lib);

    // 11. Factor de Bypass (FBP)
    const fbp_h = (pointM.h - pointS.h) !== 0 ? (pointI.h - pointS.h) / (pointM.h - pointS.h) : 0;
    const fbp_T = (pointM.t - pointS.t) !== 0 ? (pointI.t - pointS.t) / (pointM.t - pointS.t) : 0;
    const FBP = Math.max(0, Math.min(1, fbp_T));

    // 12. Condensats i Potència de Bateria
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
    solvePointFromProperties,
    pointFromTAndPhi,
    pointFromTAndW
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClimaSolver;
}
