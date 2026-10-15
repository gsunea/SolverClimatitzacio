/**
 * solver.js
 * Motor de càlcul termodinàmic per al sistema de Climatitzador en Estiu.
 * Integrat amb PsychroLib (ASHRAE Fundamentals).
 * Assignatura "Climatització i Refrigeració" (ETSEIB - UPC).
 */

const ClimaSolver = (() => {

  const c_pas = 1.006;   // kJ/(kg·K)
  const dh_lg = 2501.0;  // kJ/kg

  // Toleràncies per verificar que l'estat resolt reprodueix les dades d'entrada
  const RESIDUAL_TOL = { t: 0.01, phi: 0.1, w: 1e-6, h: 0.05, tr: 0.02, th: 0.02, v: 1e-4 };

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
   * Error de dades propi del solver (missatge ja pensat per a l'usuari)
   */
  function inputError(msg) {
    const err = new Error(msg);
    err.isInputError = true;
    return err;
  }

  /**
   * Converteix un valor d'entrada a número. Retorna null si no s'ha informat
   * (undefined, null, '' o NaN).
   */
  function toNum(val) {
    if (val === undefined || val === null || val === '') return null;
    const n = typeof val === 'number' ? val : parseFloat(val);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Bisecció genèrica: cerca l'arrel de f a [lo, hi] suposant que f(lo) i f(hi)
   * tenen signes oposats (o un d'ells és zero).
   */
  function bisect(f, lo, hi, iterations = 60) {
    let fLo = f(lo);
    for (let i = 0; i < iterations; i++) {
      const mid = (lo + hi) / 2.0;
      const fMid = f(mid);
      if ((fMid >= 0) === (fLo >= 0)) {
        lo = mid;
        fLo = fMid;
      } else {
        hi = mid;
      }
    }
    return (lo + hi) / 2.0;
  }

  /**
   * Cerca totes les arrels de F a [a, b] escanejant canvis de signe (pas `step`)
   * i bisectant cada tram. Evita els problemes de la bisecció cega quan F no és
   * monòtona, val 0 en un extrem o té valors sentinella.
   */
  function findRoots(F, a, b, step = 0.05) {
    const roots = [];
    let prev = a;
    let fPrev = F(a);
    if (fPrev === 0) roots.push(a);
    for (let T = a + step; T <= b + 1e-9; T += step) {
      const f = F(T);
      if (Number.isFinite(f) && Number.isFinite(fPrev) && fPrev * f < 0) {
        roots.push(bisect(F, prev, T));
      }
      prev = T;
      fPrev = f;
    }
    return roots;
  }

  /**
   * Temperatura màxima física (w >= 0) sobre una isoterma humida th constant.
   */
  function maxTAlongWetBulb(th, P, lib) {
    let T = th;
    while (T < th + 200 && lib.GetHumRatioFromTWetBulb(T + 0.05, th, P) > 1e-6) T += 0.05;
    return T;
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

    const t = toNum(props.t);
    const phi = toNum(props.phi);
    let w = toNum(props.w);
    const h = toNum(props.h);
    const tr = toNum(props.tr);
    const th = toNum(props.th);
    const v = toNum(props.v);

    if (w === null && toNum(props.w_g_kg) !== null) {
      w = toNum(props.w_g_kg) / 1000.0;
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

    if (phi !== null && phi === 0) {
      throw new Error('Amb φ = 0% (aire sec) l\'estat només es pot definir amb T seca o w = 0. Introdueix φ > 0%.');
    }

    let t_solved = null;
    let w_solved = null;
    let warning = null;

    try {
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
        // Fórmula explícita (PsychroLib retalla w a un mínim positiu i amagaria dades incoherents)
        w_solved = (h - c_pas * t) / (dh_lg + 1.86 * t);
      }
      // Parell: (t, th)
      else if (t !== null && th !== null) {
        if (th > t + 1e-4) {
          throw inputError('La temperatura humida no pot superar la temperatura seca');
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
        t_solved = lib.GetTDewPointFromVapPres(200.0, Pws);
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
          throw inputError('Humitat absoluta incompatible amb la temperatura humida');
        }
        if (Math.abs(w - wSat) <= 1e-9 + 1e-6 * wSat) {
          // Estat saturat: T = th (l'arrel és just l'extrem de l'interval)
          t_solved = th;
        } else {
          // A th constant, w(T) decreix amb T
          t_solved = bisect(mid => lib.GetHumRatioFromTWetBulb(mid, th, P) - w, th, maxTAlongWetBulb(th, P, lib));
        }
      }
      // Parell: (w, v)
      else if (w !== null && v !== null) {
        w_solved = w;
        t_solved = lib.GetTDryBulbFromMoistAirVolumeAndHumRatio(v, w, P);
      }
      // Parell: (phi, h)
      else if (phi !== null && h !== null) {
        t_solved = bisect(mid => {
          const w_calc = (h - c_pas * mid) / (dh_lg + 1.86 * mid);
          if (w_calc <= 0) return -1;
          return lib.GetRelHumFromHumRatio(mid, w_calc, P) * 100.0 - phi;
        }, -50.0, 120.0);
        w_solved = (h - c_pas * t_solved) / (dh_lg + 1.86 * t_solved);
      }
      // Parell: (phi, th)
      else if (phi !== null && th !== null) {
        if (phi >= 100 - 1e-9) {
          t_solved = th; // φ = 100% implica T = th
        } else {
          t_solved = bisect(mid => lib.GetRelHumFromTWetBulb(mid, th, P) * 100.0 - phi, th, 120.0);
        }
        w_solved = lib.GetHumRatioFromTWetBulb(t_solved, th, P);
      }
      // Parell: (phi, v)
      else if (phi !== null && v !== null) {
        t_solved = bisect(mid => {
          const w_calc = lib.GetHumRatioFromRelHum(mid, phi / 100.0, P);
          return lib.GetMoistAirVolume(mid, w_calc, P) - v;
        }, -50.0, 90.0);
        w_solved = lib.GetHumRatioFromRelHum(t_solved, phi / 100.0, P);
      }
      // Parell: (h, th)
      else if (h !== null && th !== null) {
        // Sobre una isoterma humida h varia molt poc amb T: problema mal condicionat.
        // Es cerquen les arrels de h(T) - h al tram físic [th, T(w=0)] per escaneig.
        const Fh = T => lib.GetMoistAirEnthalpy(T, lib.GetHumRatioFromTWetBulb(T, th, P)) / 1000.0 - h;
        if (Math.abs(Fh(th)) < 1e-3) {
          t_solved = th;
        } else {
          const rts = findRoots(Fh, th, maxTAlongWetBulb(th, P, lib));
          if (rts.length === 0) {
            throw inputError('Entalpia i temperatura humida incompatibles (no defineixen cap estat sobre la carta).');
          }
          t_solved = rts[0];
          if (rts.length > 1) warning = 'h i T_h admeten més d\'una solució; es mostra la de menor T.';
        }
        w_solved = (h - c_pas * t_solved) / (dh_lg + 1.86 * t_solved);
        warning = (warning ? warning + ' ' : '') + 'Entalpia i temperatura humida són gairebé dependents: un petit error en T_h canvia molt l\'estat. Millor fer servir una altra parella.';
      }
      // Parell: (th, v)
      else if (th !== null && v !== null) {
        const Fv = T => lib.GetMoistAirVolume(T, lib.GetHumRatioFromTWetBulb(T, th, P), P) - v;
        const rts = findRoots(Fv, th, maxTAlongWetBulb(th, P, lib));
        if (rts.length === 0) {
          throw inputError('Temperatura humida i volum específic incompatibles (no defineixen cap estat sobre la carta).');
        }
        t_solved = rts[0];
        w_solved = lib.GetHumRatioFromTWetBulb(t_solved, th, P);
      }
      // Parell: (h, v)
      else if (h !== null && v !== null) {
        t_solved = bisect(mid => {
          const w_calc = (h - c_pas * mid) / (dh_lg + 1.86 * mid);
          return lib.GetMoistAirVolume(mid, Math.max(w_calc, 0), P) - v;
        }, -50.0, 120.0);
        w_solved = (h - c_pas * t_solved) / (dh_lg + 1.86 * t_solved);
      }
      else {
        throw inputError('Combinació de propietats no suportada');
      }
    } catch (err) {
      if (err.isInputError) throw err;
      throw new Error(`Dades fora del rang de validesa de les equacions psicromètriques (${err.message})`);
    }

    if (!Number.isFinite(t_solved) || !Number.isFinite(w_solved)) {
      throw new Error('No s\'ha pogut resoldre l\'estat (dades incoherents)');
    }
    if (w_solved < 0) {
      throw new Error('Càlcul resulta en humitat negativa (dades incoherents)');
    }

    // Comprovació de sobresaturació (estat físicament impossible a la carta)
    const wSatT = lib.GetSatHumRatio(t_solved, P);
    if (w_solved > wSatT * (1 + 1e-6) + 1e-9) {
      throw new Error(`Estat sobresaturat: w = ${(w_solved * 1000).toFixed(2)} g/kg supera la saturació a ${t_solved.toFixed(1)} °C (${(wSatT * 1000).toFixed(2)} g/kg).`);
    }

    const phi_pct = Math.max(0, Math.min(100, lib.GetRelHumFromHumRatio(t_solved, w_solved, P) * 100.0));
    const h_kJ = lib.GetMoistAirEnthalpy(t_solved, w_solved) / 1000.0;
    const v_m3 = lib.GetMoistAirVolume(t_solved, w_solved, P);
    const tr_c = lib.GetTDewPointFromHumRatio(t_solved, w_solved, P);
    const th_c = lib.GetTWetBulbFromHumRatio(t_solved, w_solved, P);
    const Pw = lib.GetVapPresFromHumRatio(w_solved, P);

    // Verificació: l'estat resolt ha de reproduir les propietats d'entrada
    // (detecta bisseccions que no han convergit perquè no hi ha solució)
    const computed = { t: t_solved, phi: phi_pct, w: w_solved, h: h_kJ, tr: tr_c, th: th_c, v: v_m3 };
    const given = { t, phi, w: hasW ? w : null, h, tr, th, v };
    for (const key of Object.keys(given)) {
      if (given[key] === null) continue;
      if (Math.abs(computed[key] - given[key]) > RESIDUAL_TOL[key]) {
        throw new Error('Les propietats introduïdes no defineixen cap estat psicromètric vàlid (dades incoherents o fora de rang).');
      }
    }

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
      sourceProps: propList.slice(0, 2),
      warning
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
  function solveCore(inputs) {
    const lib = getPsychroLib();
    const altitude = toNum(inputs.altitude) || 0;
    const P = lib.GetStandardAtmPressure(altitude); // en Pa
    const warnings = [];

    // 1. Càrregues interiors
    const q_si = toNum(inputs.q_si);
    let q_li = toNum(inputs.q_li);
    let FCS_i = toNum(inputs.FCS_i);

    if (q_si === null) throw new Error('Falta la càrrega sensible interior q_si.');
    if (FCS_i !== null) {
      if (!(FCS_i > 0 && FCS_i <= 1)) {
        throw new Error('El FCS_i ha d\'estar entre 0 (exclòs) i 1.');
      }
      if (!(q_si > 0)) {
        throw new Error('Per derivar q_li a partir de FCS_i cal q_si > 0.');
      }
      // El FCS_i introduït mana: q_li es deriva perquè les càrregues siguin coherents
      q_li = q_si / FCS_i - q_si;
    } else if (q_li === null) {
      throw new Error('Falta la càrrega latent interior q_li (o el FCS_i).');
    }
    const q_i = q_si + q_li;
    if (!(q_i > 0)) throw new Error('La càrrega interior total q_i ha de ser positiva.');
    if (FCS_i === null) FCS_i = q_si / q_i;
    if (!(FCS_i > 0 && FCS_i <= 1)) {
      throw new Error('Càrregues interiors incoherents: el FCS_i resultant ha d\'estar entre 0 (exclòs) i 1.');
    }

    const Q_v = toNum(inputs.Q_v);
    if (Q_v === null || Q_v < 0) throw new Error('Falta el cabal de ventilació Q_v (≥ 0).');
    const fr_infiltr = Math.max(0, Math.min(1, toNum(inputs.fr_infiltr) || 0));

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

    // 3. Cabal de ventilació (una fracció pot entrar per infiltració directament a la sala)
    const m_dot_v_total = Q_v / (3600.0 * pointV.v);
    const m_dot_v = m_dot_v_total * (1.0 - fr_infiltr);       // passa per la bateria
    const m_dot_v_infil = m_dot_v_total * fr_infiltr;          // entra directament a la sala

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
    const q_sv = m_dot_v_total * c_pas * (pointV.t - pointR.t);
    const q_lv = m_dot_v_total * dh_lg * (pointV.w - pointR.w);
    const q_v = m_dot_v_total * (pointV.h - pointR.h);

    const q_s_total = q_si + q_sv;
    const q_l_total = q_li + q_lv;
    const q_total = q_s_total + q_l_total;
    const FCS_total = q_total !== 0 ? q_s_total / q_total : 1.0;

    // 6. Càrrega de la sala (interior + infiltració) i recta de maniobra
    const q_s_infil = m_dot_v_infil * c_pas * (pointV.t - pointR.t);
    const q_l_infil = m_dot_v_infil * dh_lg * (pointV.w - pointR.w);
    const q_infil = m_dot_v_infil * (pointV.h - pointR.h);
    const q_s_room = q_si + q_s_infil;
    const q_l_room = q_li + q_l_infil;
    const q_room = q_i + q_infil;
    if (!(q_room > 0)) throw new Error('La càrrega de la sala (interior + infiltració) ha de ser positiva.');
    const FCS_room = (q_s_room + q_l_room) !== 0 ? q_s_room / (q_s_room + q_l_room) : 1.0;
    if (!(FCS_room > 0)) {
      throw new Error('La càrrega sensible de la sala ha de ser positiva per poder refredar amb impulsió.');
    }

    // (w_R - w_I) / (T_R - T_I) = ((1 - FCS) / FCS) * (c_pas / dh_lg)
    const slopeRoom = ((1.0 - FCS_room) / FCS_room) * (c_pas / dh_lg);

    function getWOnRoomLine(T) {
      return pointR.w - slopeRoom * (pointR.t - T);
    }

    // Tram vàlid de la recta de maniobra: des de R cap a temperatures inferiors
    // mentre w > 0 i no se supera la saturació.
    function isValidOnRoomLine(T) {
      const wl = getWOnRoomLine(T);
      return wl > 0 && wl <= lib.GetSatHumRatio(T, P) * (1 + 1e-9);
    }
    let T_lim = pointR.t;
    {
      let prev = pointR.t;
      let found = false;
      for (let T = pointR.t - 0.25; T >= pointR.t - 80; T -= 0.25) {
        if (!isValidOnRoomLine(T)) {
          T_lim = bisect(x => (isValidOnRoomLine(x) ? 1 : -1), T, prev);
          // ens quedem al costat vàlid
          if (!isValidOnRoomLine(T_lim)) T_lim += 1e-9;
          found = true;
          break;
        }
        prev = T;
      }
      if (!found) T_lim = pointR.t - 80;
    }

    function pointOnRoomLine(T) {
      return solvePointFromProperties({ t: T, w: Math.min(getWOnRoomLine(T), lib.GetSatHumRatio(T, P)) }, P, lib);
    }

    function checkTIRange(TI, label) {
      if (!(TI < pointR.t - 1e-6)) {
        throw new Error(`${label}: la temperatura d'impulsió (${TI.toFixed(2)} °C) ha de ser inferior a la de retorn (${pointR.t.toFixed(2)} °C).`);
      }
      if (TI < T_lim - 1e-6) {
        throw new Error(`${label}: T_I = ${TI.toFixed(2)} °C queda fora de la recta de maniobra vàlida (mínim ${T_lim.toFixed(2)} °C, on s'arriba a saturació).`);
      }
    }

    // 7. Determinació d'Impulsió (I)
    let pointI = null;
    let impulseMode = 'phi_I';
    const target_TI = toNum(inputs.target_TI);
    const target_QI = toNum(inputs.target_QI);
    const target_wI = toNum(inputs.target_wI);

    if (target_TI !== null) {
      impulseMode = 'T_I';
      checkTIRange(target_TI, 'T_I fixada');
      pointI = pointOnRoomLine(target_TI);
    } else if (target_QI !== null) {
      impulseMode = 'Q_I';
      if (!(target_QI > 0)) throw new Error('El cabal d\'impulsió Q_I ha de ser positiu.');
      const Q_of = (T) => {
        const pt = pointOnRoomLine(T);
        const dH = pointR.h - pt.h;
        return dH > 0 ? (q_room / dH) * pt.v * 3600.0 : Infinity;
      };
      const Q_min = Q_of(T_lim);
      if (target_QI < Q_min) {
        throw new Error(`Q_I = ${target_QI.toFixed(0)} m³/h és massa petit: el mínim possible (impulsió saturada a ${T_lim.toFixed(2)} °C) és ${Q_min.toFixed(0)} m³/h.`);
      }
      const TI = bisect(T => Q_of(T) - target_QI, T_lim, pointR.t - 1e-9);
      pointI = pointOnRoomLine(TI);
    } else if (target_wI !== null) {
      impulseMode = 'w_I';
      if (Math.abs(slopeRoom) < 1e-12) {
        throw new Error('Amb FCS = 1 la recta de maniobra és horitzontal (w_I = w_R) i w_I no determina el punt I. Fixa T_I o φ_I.');
      }
      const TI = pointR.t - (pointR.w - target_wI) / slopeRoom;
      checkTIRange(TI, 'w_I fixada');
      pointI = pointOnRoomLine(TI);
    } else {
      const phiRaw = toNum(inputs.phi_I);
      const phiPct = phiRaw === null ? 90.0 : phiRaw;
      if (!(phiPct > 0 && phiPct <= 100)) {
        throw new Error('La humitat relativa d\'impulsió φ_I ha d\'estar entre 0 (exclòs) i 100%.');
      }
      const targetPhi = phiPct / 100.0;
      const f = (T) => getWOnRoomLine(T) - lib.GetHumRatioFromRelHum(T, targetPhi, P);
      if (f(pointR.t) >= 0) {
        throw new Error(`φ_I = ${phiPct}% no és assolible: ha de ser superior a la humitat relativa de la sala (${pointR.phi.toFixed(1)}%).`);
      }
      if (f(T_lim) < 0) {
        throw new Error(`La recta de maniobra no arriba a la humitat d'impulsió sol·licitada (φ_I = ${phiPct}%).`);
      }
      const TI = bisect(f, T_lim, pointR.t);
      pointI = pointOnRoomLine(TI);
    }

    /**
     * Passos 8-10: a partir d'un punt d'impulsió I (sobre la recta de maniobra) calcula
     * cabals màssics, mescla M i superfície de bateria S.
     * opts.strict: cerca cap enrere (retorna null si l'estat no és vàlid, sense 100% aire exterior).
     */
    function evaluate(pointIin, opts = {}) {
      let pointI = pointIin;
      const localWarnings = [];
      // 8. Balanç de cabals d'impulsió i retorn
      // Balanç d'entalpia a la sala: q_sala = m_dot_I * (h_R - h_I)
      let deltaH_IR = pointR.h - pointI.h;
      if (!(deltaH_IR > 1e-9)) {
        if (opts.strict) return null;
        throw new Error('L\'entalpia d\'impulsió ha de ser inferior a la de retorn per absorbir la càrrega de la sala.');
      }
      let m_dot_I = q_room / deltaH_IR;
      const m_dot_I_balance = m_dot_I; // cabal que surt del balanç de la sala (abans de limitar per ventilació)

      // Si la ventilació necessària supera el cabal d'impulsió, el sistema treballa amb 100% aire exterior:
      // m_dot_I = m_dot_v i el punt I queda determinat pel balanç de la sala.
      let allOutdoorAir = false;
      if (m_dot_v > m_dot_I * (1 + 1e-9)) {
        if (opts.strict) return null; // en la cerca cap enrere no es permet 100% aire exterior
        allOutdoorAir = true;
        m_dot_I = m_dot_v;
        const hI_target = pointR.h - q_room / m_dot_I;
        const TI = bisect(T => pointOnRoomLine(T).h - hI_target, T_lim, pointR.t);
        pointI = pointOnRoomLine(TI);
        deltaH_IR = pointR.h - pointI.h;
        localWarnings.push('El cabal de ventilació supera el d\'impulsió necessari: ṁ_I = ṁ_v i ṁ_R = 0 (100% aire exterior, sense recirculació). La condició d\'impulsió fixada no es manté.');
      }
      const Q_I = m_dot_I * pointI.v * 3600.0;

      // Retorn recirculat a climatitzador
      const m_dot_R = (allOutdoorAir || m_dot_I - m_dot_v < 1e-12) ? 0 : m_dot_I - m_dot_v; // mai negatiu
      const Q_R = m_dot_R * pointR.v * 3600.0;

      // 9. Punt de Mescla (M)
      const m_dot_M = m_dot_I;
      let pointM;
      let w_M_total = null; // humitat total de la mescla (inclou l'aigua de boira)
      if (m_dot_R === 0) {
        pointM = { ...pointV };
      } else if (m_dot_v === 0) {
        pointM = { ...pointR };
      } else {
        const w_M = (m_dot_v * pointV.w + m_dot_R * pointR.w) / m_dot_M;
        const h_M = (m_dot_v * pointV.h + m_dot_R * pointR.h) / m_dot_M;
        const T_M = lib.GetTDryBulbFromEnthalpyAndHumRatio(h_M * 1000.0, w_M);
        if (w_M > lib.GetSatHumRatio(T_M, P) * (1 + 1e-6) + 1e-9) {
          // Mescla dins la zona de boira: l'aigua sobrant condensa i l'aire queda saturat
          // a la mateixa entalpia (es negligeix l'entalpia de l'aigua líquida).
          const Tf = bisect(T => lib.GetMoistAirEnthalpy(T, lib.GetSatHumRatio(T, P)) / 1000.0 - h_M, -50.0, T_M);
          pointM = solvePointFromProperties({ t: Tf, phi: 100.0 }, P, lib);
          pointM.warning = 'La mescla V–R cau a la zona de boira (sobresaturada): M es mostra saturat a la mateixa entalpia; l\'aigua de la boira es compta als condensats.';
          w_M_total = w_M;
        } else {
          pointM = solvePointFromProperties({ t: T_M, w: w_M }, P, lib);
        }
      }
      const Q_M = m_dot_M * pointM.v * 3600.0;
      if (w_M_total === null) w_M_total = pointM.w;

      if (w_M_total < pointI.w - 1e-7) {
        if (opts.strict) return null;
        throw new Error('La humitat de la mescla és inferior a la d\'impulsió: una bateria de fred no pot humidificar l\'aire.');
      }
      if (pointM.t < pointI.t - 1e-6) {
        if (opts.strict) return null;
        throw new Error('La mescla és més freda que la impulsió: no cal bateria de fred (dades incoherents per a estiu).');
      }

      // 10. Punt de Superfície de Bateria (S)
      const deltaT_MI = pointM.t - pointI.t;
      const deltaW_MI = pointM.w - pointI.w;
      const coilVertical = Math.abs(deltaT_MI) < 1e-6;
      const slopeMI = coilVertical ? 0 : deltaW_MI / deltaT_MI;

      function getWOnCoilLine(T) {
        return pointI.w - slopeMI * (pointI.t - T);
      }

      let TS = null;
      {
        const g = (T) => getWOnCoilLine(T) - lib.GetSatHumRatio(T, P);
        if (coilVertical || g(pointI.t) >= -1e-9) {
          // Impulsió saturada o procés de bateria sense variació de T: S coincideix en T amb I
          TS = pointI.t;
        } else {
          let prev = pointI.t;
          let found = false;
          for (let T = pointI.t - 0.25; T >= -60; T -= 0.25) {
            if (getWOnCoilLine(T) <= 0) break;
            if (g(T) >= 0) {
              TS = bisect(g, T, prev);
              found = true;
              break;
            }
            prev = T;
          }
          if (!found) {
            TS = null;
            localWarnings.push('La prolongació de la recta de bateria M–I no talla la corba de saturació: amb una sola bateria no hi ha punt de superfície (S) ni factor de bypass (caldria postescalfament).');
          }
        }
      }
      const pointS = TS !== null ? solvePointFromProperties({ t: TS, phi: 100.0 }, P, lib) : null;


      return {
        pointI, m_dot_I, m_dot_I_balance, allOutdoorAir, Q_I, m_dot_R, Q_R, m_dot_M,
        pointM, Q_M, w_M_total, pointS, TS, slopeMI, localWarnings
      };
    }

    // Càlcul directe (sense restricció de temperatura de bateria)
    let res = evaluate(pointI);

    // 10b. Temperatura de la bateria (T_bat = T_S, superfície de bateria) i viabilitat.
    //  T_bat > TS_WARN: viable · TS_MIN ≤ T_bat ≤ TS_WARN: compte · T_bat < TS_MIN: no viable.
    //  Si T_bat < TS_MIN (o l'usuari fixa T_S) es fixa T_S i es "torna enrere": es cerca la impulsió
    //  I sobre la recta de maniobra per a la qual la bateria treballa exactament a T_S (el cabal d'impulsió,
    //  la mescla M i la recta M–I s'han de recalcular de forma consistent).
    const TS_MIN = toNum(inputs.TS_min) !== null ? toNum(inputs.TS_min) : 7.0;
    const TS_WARN = toNum(inputs.TS_warn) !== null ? toNum(inputs.TS_warn) : 9.0;
    const TS_EPS = 0.05; // tolerància (°C): 6,96 °C es mostra com 7,0 °C i no es tracta com a inferior al límit
    const fixMinTS = inputs.fix_min_TS !== false;
    const manualTS = toNum(inputs.target_TS);
    const TS_natural = res.TS;
    const naturalState = {
      T_S: TS_natural,
      T_I: res.pointI.t,
      phi_I: res.pointI.phi,
      m_dot_I: res.m_dot_I,
      Q_I: res.Q_I
    };

    const naturalRec = {
      T_I: res.pointI.t, phi_I: res.pointI.phi, m_I: res.m_dot_I, m_R: res.m_dot_R,
      T_M: res.pointM.t, T_S: TS_natural === null ? Infinity : TS_natural
    };
    naturalState.allOutdoorAir = res.allOutdoorAir;
    naturalState.m_dot_I_balance = res.m_dot_I_balance;
    let recalcTrace = null;

    let TS_target = null;
    let TS_reason = null;
    if (manualTS !== null) {
      TS_target = manualTS;
      TS_reason = 'manual';
    } else if (fixMinTS && TS_natural !== null && TS_natural < TS_MIN - TS_EPS) {
      TS_target = TS_MIN;
      TS_reason = 'min';
    }

    let coilCorrected = false;
    let coilUnresolved = false;
    let forcedS = false;
    if (TS_target !== null && !(TS_natural !== null && Math.abs(TS_natural - TS_target) < 1e-6)) {
      // T_S com a funció de T_I (null = estat no vàlid; Infinity = la recta M–I no talla la saturació)
      // Registre d'un tempteig: estat complet associat a una T_I sobre la recta de maniobra
      const recOf = (T) => {
        try {
          const r = evaluate(pointOnRoomLine(T), { strict: true });
          if (!r) return null;
          return {
            T_I: r.pointI.t, phi_I: r.pointI.phi, m_I: r.m_dot_I, m_R: r.m_dot_R,
            T_M: r.pointM.t, T_S: r.TS === null ? Infinity : r.TS
          };
        } catch (e) {
          return null;
        }
      };
      const gT = (T) => {
        const r = recOf(T);
        return r === null ? NaN : r.T_S - TS_target;
      };
      // Escaneig de tota la recta de maniobra vàlida; s'escull l'arrel més propera a la impulsió original
      const roots = [];
      const rows = [];
      const step = 0.1;
      const T0 = Math.max(T_lim, naturalState.T_I - 40);
      let prevT = null;
      let prevG = NaN;
      for (let T = T0; T < pointR.t - 1e-6; T += step) {
        const g = gT(T);
        rows.push({ T, g });
        if (prevT !== null && !Number.isNaN(prevG) && !Number.isNaN(g)) {
          if ((prevG < 0) !== (g < 0)) {
            const fSafe = x => { const v = gT(x); return Number.isNaN(v) ? (prevG < 0 ? -1 : 1) : v; };
            const Tr = bisect(fSafe, prevT, T);
            if (Math.abs(gT(Tr)) < 1e-4) roots.push({ T: Tr, lo: prevT, hi: T, gLo: prevG });
          }
        }
        prevT = T;
        prevG = g;
      }
      if (roots.length) {
        roots.sort((x, y) => Math.abs(x.T - naturalState.T_I) - Math.abs(y.T - naturalState.T_I));
        const chosen = roots[0];

        // Traça del procediment (per mostrar-la al pas a pas): estat inicial, tempteigs de l'escaneig,
        // interval que conté l'arrel, primeres iteracions de la bisecció i solució final
        const trials = [];
        trials.push({ label: 'inicial', ...naturalRec });
        const bLo = Math.min(naturalState.T_I, chosen.lo);
        const bHi = Math.max(naturalState.T_I, chosen.lo);
        const between = rows.filter(r => !Number.isNaN(r.g) && r.T > bLo + 0.2 && r.T < bHi - 0.2)
          .sort((x, y) => Math.abs(x.T - naturalState.T_I) - Math.abs(y.T - naturalState.T_I));
        [0.25, 0.5, 0.75].forEach(f => {
          if (between.length >= 3) {
            const r = between[Math.min(between.length - 1, Math.floor(f * between.length))];
            const rec = recOf(r.T);
            if (rec && !trials.some(t => Math.abs(t.T_I - rec.T_I) < 1e-9)) trials.push({ label: 'tempteig', ...rec });
          }
        });
        const recLo = recOf(chosen.lo);
        const recHi = recOf(chosen.hi);
        if (recLo) trials.push({ label: recLo.T_S < TS_target ? 'interval baix' : 'interval alt', ...recLo });
        if (recHi) trials.push({ label: recHi.T_S < TS_target ? 'interval baix' : 'interval alt', ...recHi });
        let lo = chosen.lo;
        let hi = chosen.hi;
        let gLo = chosen.gLo;
        for (let it = 1; it <= 24; it++) {
          const mid = (lo + hi) / 2.0;
          const gm = gT(mid);
          const gmSafe = Number.isNaN(gm) ? (gLo < 0 ? -1 : 1) : gm;
          if (it <= 4) {
            const rec = recOf(mid);
            if (rec) trials.push({ label: `bisecció ${it}`, ...rec });
          }
          if ((gmSafe >= 0) === (gLo >= 0)) { lo = mid; gLo = gmSafe; } else { hi = mid; }
        }
        const finalRec = recOf(chosen.T);
        if (finalRec) trials.push({ label: 'solució', ...finalRec });
        recalcTrace = {
          target: TS_target,
          reason: TS_reason,
          trials,
          iterations: roots.length,
          bracket: [chosen.lo, chosen.hi]
        };

        res = evaluate(pointOnRoomLine(chosen.T));
        coilCorrected = true;
      } else {
        // El recàlcul s'ha intentat però cap T_I dóna T_S = objectiu: es guarda el marge de T_S explorat
        const finite = rows.filter(r => !Number.isNaN(r.g) && Number.isFinite(r.g)).map(r => r.g + TS_target);
        const withInf = rows.some(r => r.g === Infinity);
        recalcTrace = {
          failed: true,
          target: TS_target,
          reason: TS_reason,
          trials: [],
          T_S_min: finite.length ? Math.min(...finite) : null,
          T_S_max: finite.length ? Math.max(...finite) : null,
          T_I_min: rows.length ? rows[0].T : null,
          T_I_max: rows.length ? rows[rows.length - 1].T : null,
          samples: finite.length,
          noSaturation: withInf
        };
        if (TS_reason === 'manual') {
          // Cap impulsió coherent: es força S a la T_S indicada sense recalcular la resta del procés
          forcedS = true;
        }
        coilUnresolved = true;
      }
    }

    pointI = res.pointI;
    const { m_dot_I, m_dot_I_balance, allOutdoorAir, Q_I, m_dot_R, Q_R, m_dot_M, pointM, Q_M, w_M_total, slopeMI } = res;
    const pointS = forcedS ? solvePointFromProperties({ t: TS_target, phi: 100.0 }, P, lib) : res.pointS;
    res.localWarnings.forEach(w => warnings.push(w));
    // 11. Factor de Bypass (FBP)
    let fbp_h = null;
    let FBP = null;
    if (pointS) {
      fbp_h = (pointM.h - pointS.h) !== 0 ? (pointI.h - pointS.h) / (pointM.h - pointS.h) : 0;
      const fbp_T = (pointM.t - pointS.t) !== 0 ? (pointI.t - pointS.t) / (pointM.t - pointS.t) : 0;
      FBP = Math.max(0, Math.min(1, fbp_T));
    }

    // 12. Condensats i Potència de Bateria
    const m_dot_cond = Math.max(0, m_dot_I * (w_M_total - pointI.w)); // kg/s
    const M_cond_h = m_dot_cond * 3600.0; // kg/h
    const q_bateria = m_dot_I * (pointM.h - pointI.h); // kW

    // Viabilitat de la temperatura de bateria
    const T_bat = pointS ? pointS.t : null;
    const fT = (x) => x.toFixed(1);
    const f2 = (x) => x.toFixed(2);
    let coilStatus;
    let coilMessage;
    if (T_bat === null) {
      coilStatus = 'sense_S';
      coilMessage = 'No es pot determinar la temperatura de la bateria: la recta M–I no talla la corba de saturació.';
    } else if (T_bat < TS_MIN - TS_EPS) {
      coilStatus = 'no_viable';
      coilMessage = `T_bat = ${fT(T_bat)} °C < ${TS_MIN} °C: la instal·lació NO és viable (risc de gelada a la bateria). Cal solucionar-ho: fixar T_bat ≥ ${TS_MIN} °C i recalcular la impulsió.`;
    } else if (T_bat <= TS_WARN + TS_EPS) {
      coilStatus = 'ojo';
      coilMessage = `Compte: T_bat = ${fT(T_bat)} °C, entre ${TS_MIN} i ${TS_WARN} °C (zona límit de la bateria).`;
    } else {
      coilStatus = 'viable';
      coilMessage = `T_bat = ${fT(T_bat)} °C > ${TS_WARN} °C: la bateria és viable.`;
    }
    if (coilCorrected) {
      const why = TS_reason === 'min'
        ? `La T_bat resultant era ${f2(TS_natural)} °C (< ${TS_MIN} °C): s'ha fixat a ${TS_MIN} °C`
        : `T_bat fixada manualment a ${fT(TS_target)} °C`;
      coilMessage += ` ${why} i s'ha recalculat el procés cap enrere: T_I ${fT(naturalState.T_I)} → ${fT(pointI.t)} °C, φ_I ${fT(naturalState.phi_I)} → ${fT(pointI.phi)} %, Q_I ${naturalState.Q_I.toFixed(0)} → ${Q_I.toFixed(0)} m³/h.`;
      warnings.push(`Impulsió recalculada perquè la bateria no baixi de ${fT(TS_target)} °C (T_I = ${fT(pointI.t)} °C, φ_I = ${fT(pointI.phi)} %). La condició d'impulsió fixada no es manté.`);
    } else if (forcedS) {
      coilMessage += ` No existeix cap impulsió coherent amb T_bat = ${fT(TS_target)} °C: S s'ha forçat a aquesta temperatura sense recalcular la resta del procés.`;
      warnings.push(`T_S forçada a ${fT(TS_target)} °C sense impulsió coherent (només es mou el punt S).`);
    } else if (coilUnresolved) {
      coilMessage += ' No s\'ha trobat cap impulsió sobre la recta de maniobra que permeti T_bat ≥ ' + TS_MIN + ' °C amb aquests cabals i càrregues; cal revisar el cabal de ventilació, les condicions de V i R o les càrregues.';
      warnings.push(`No s'ha pogut fixar la temperatura de la bateria a ${TS_MIN} °C amb aquestes dades.`);
    }
    const coil = {
      T: T_bat,
      status: coilStatus,
      message: coilMessage,
      limits: { min: TS_MIN, warn: TS_WARN },
      corrected: coilCorrected,
      unresolved: coilUnresolved,
      reason: TS_reason,
      natural: coilCorrected ? naturalState : null,
      recalc: recalcTrace
    };

    [pointV, pointR, pointM].forEach(pt => { if (pt.warning) warnings.push(pt.warning); });

    return {
      points: {
        V: { label: 'Ventilació', symbol: 'V', ...pointV, Q: Q_v, m_dot: m_dot_v_total },
        R: { label: 'Retorn', symbol: 'R', ...pointR, Q: Q_R, m_dot: m_dot_R },
        M: { label: 'Mescla', symbol: 'M', ...pointM, Q: Q_M, m_dot: m_dot_M },
        I: { label: 'Impulsió', symbol: 'I', ...pointI, Q: Q_I, m_dot: m_dot_I },
        S: pointS ? { label: 'Superfície', symbol: 'S', ...pointS, Q: 0, m_dot: 0 } : null
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
        q_s_infil,
        q_l_infil,
        q_infil,
        q_room,
        FCS_room,
        fr_infiltr,
        m_dot_v_total,
        m_dot_v_coil: allOutdoorAir ? m_dot_I : m_dot_v,
        m_dot_v_infil,
        m_dot_I,
        m_dot_R,
        m_dot_I_balance,
        T_bat,
        q_bateria,
        FBP,
        FBP_h: fbp_h,
        m_dot_cond,
        M_cond_h,
        P_atm_Pa: P,
        P_atm_kPa: P / 1000.0
      },
      slopeRoom,
      slopeMI,
      impulseMode,
      allOutdoorAir,
      coil,
      warnings
    };
  }

  // Resol amb correcció de T_bat; si s'ha hagut de fixar T_S = 7 °C, adjunta també
  // la solució "natural" (sense fixar) perquè els passos 1-7 mostrin el càlcul normal.
  function solve(inputs) {
    const res = solveCore(inputs);
    if (res.coil && res.coil.corrected && res.coil.reason === 'min') {
      try {
        res.naturalSolution = solveCore({ ...inputs, fix_min_TS: false });
      } catch (e) { res.naturalSolution = null; }
    }
    return res;
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
