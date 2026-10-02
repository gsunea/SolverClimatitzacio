/*
 * PsychroLib (version 2.5.0) (https://github.com/psychrometrics/psychrolib).
 * Copyright (c) 2018-2020 The PsychroLib Contributors for the current library implementation.
 * Copyright (c) 2017 ASHRAE Handbook — Fundamentals for ASHRAE equations and coefficients.
 * Licensed under the MIT License.
 */

function Psychrometrics() {
  /**
   * Module overview
   *  Contains functions for calculating thermodynamic properties of gas-vapor mixtures
   *  and standard atmosphere suitable for most engineering, physical and meteorological
   *  applications.
   *
   *  Most of the functions are an implementation of the formulae found in the
   *  2017 ASHRAE Handbook - Fundamentals, in both International System (SI),
   *  and Imperial (IP) units. Please refer to the information included in
   *  each function for their respective reference.
   */

  // Standard functions
  var log = Math.log;
  var exp = Math.exp;
  var pow = Math.pow;
  var min = Math.min;
  var max = Math.max;
  var abs = Math.abs;

  /******************************************************************************************************
   * Global constants
   *****************************************************************************************************/

  var ZERO_FAHRENHEIT_AS_RANKINE = 459.67;
  var ZERO_CELSIUS_AS_KELVIN = 273.15;
  var R_DA_IP = 53.350;
  var R_DA_SI = 287.042;
  var INVALID = -99999;
  var MAX_ITER_COUNT = 100;
  var MIN_HUM_RATIO = 1e-7;
  var FREEZING_POINT_WATER_IP = 32.0;
  var FREEZING_POINT_WATER_SI = 0.0;
  var TRIPLE_POINT_WATER_IP = 32.018;
  var TRIPLE_POINT_WATER_SI = 0.01;

  /******************************************************************************************************
   * Helper functions
   *****************************************************************************************************/

  var PSYCHROLIB_UNITS = undefined;
  var PSYCHROLIB_TOLERANCE = undefined;

  this.IP = 1;
  this.SI = 2;

  this.SetUnitSystem = function(UnitSystem) {
    if (UnitSystem != this.IP && UnitSystem != this.SI) {
      throw new Error('UnitSystem must be IP or SI');
    }
    PSYCHROLIB_UNITS = UnitSystem;
    if (PSYCHROLIB_UNITS == this.IP)
      PSYCHROLIB_TOLERANCE = 0.001 * 9. / 5.;
    else
      PSYCHROLIB_TOLERANCE = 0.001;
  }

  this.GetUnitSystem = function() {
    return PSYCHROLIB_UNITS;
  }

  this.isIP = function() {
    if (PSYCHROLIB_UNITS == this.IP)
      return true;
    else if (PSYCHROLIB_UNITS == this.SI)
      return false;
    else
      throw new Error("Unit system is not defined");
  }

  this.GetTRankineFromTFahrenheit = function (T_F) { return T_F + ZERO_FAHRENHEIT_AS_RANKINE; }
  this.GetTFahrenheitFromTRankine = function (T_R) { return T_R - ZERO_FAHRENHEIT_AS_RANKINE; }
  this.GetTKelvinFromTCelsius = function (T_C) { return T_C + ZERO_CELSIUS_AS_KELVIN; }
  this.GetTCelsiusFromTKelvin = function (T_K) { return T_K - ZERO_CELSIUS_AS_KELVIN; }

  /******************************************************************************************************
   * Conversions between dew point, wet bulb, and relative humidity
   *****************************************************************************************************/

  this.GetTWetBulbFromTDewPoint = function (TDryBulb, TDewPoint, Pressure) {
    var HumRatio;
    if (!(TDewPoint <= TDryBulb))
      throw new Error("Dew point temperature is above dry bulb temperature");
    HumRatio = this.GetHumRatioFromTDewPoint(TDewPoint, Pressure);
    return this.GetTWetBulbFromHumRatio(TDryBulb, HumRatio, Pressure);
  }

  this.GetTWetBulbFromRelHum = function (TDryBulb, RelHum, Pressure) {
    var HumRatio;
    if (!(RelHum >= 0. && RelHum <= 1.))
      throw new Error("Relative humidity is outside range [0,1]");
    HumRatio = this.GetHumRatioFromRelHum(TDryBulb, RelHum, Pressure);
    return this.GetTWetBulbFromHumRatio(TDryBulb, HumRatio, Pressure);
  }

  this.GetRelHumFromTDewPoint = function (TDryBulb, TDewPoint) {
    var VapPres, SatVapPres;
    if (!(TDewPoint <= TDryBulb))
      throw new Error("Dew point temperature is above dry bulb temperature");
    VapPres = this.GetSatVapPres(TDewPoint);
    SatVapPres = this.GetSatVapPres(TDryBulb);
    return VapPres / SatVapPres;
  }

  this.GetRelHumFromTWetBulb = function (TDryBulb, TWetBulb, Pressure) {
    var HumRatio;
    if (!(TWetBulb <= TDryBulb))
      throw new Error("Wet bulb temperature is above dry bulb temperature");
    HumRatio = this.GetHumRatioFromTWetBulb(TDryBulb, TWetBulb, Pressure);
    return this.GetRelHumFromHumRatio(TDryBulb, HumRatio, Pressure);
  }

  this.GetTDewPointFromRelHum = function (TDryBulb, RelHum) {
    var VapPres;
    if (!(RelHum >= 0. && RelHum <= 1.))
      throw new Error("Relative humidity is outside range [0,1]");
    VapPres = this.GetVapPresFromRelHum(TDryBulb, RelHum);
    return this.GetTDewPointFromVapPres(TDryBulb, VapPres);
  }

  this.GetTDewPointFromTWetBulb = function (TDryBulb, TWetBulb, Pressure) {
    var HumRatio;
    if (!(TWetBulb <= TDryBulb))
      throw new Error("Wet bulb temperature is above dry bulb temperature");
    HumRatio = this.GetHumRatioFromTWetBulb(TDryBulb, TWetBulb, Pressure);
    return this.GetTDewPointFromHumRatio(TDryBulb, HumRatio, Pressure);
  }

  /******************************************************************************************************
   * Conversions between dew point, or relative humidity and vapor pressure
   *****************************************************************************************************/

  this.GetVapPresFromRelHum = function (TDryBulb, RelHum) {
    if (!(RelHum >= 0. && RelHum <= 1.))
      throw new Error("Relative humidity is outside range [0,1]");
    return RelHum * this.GetSatVapPres(TDryBulb);
  }

  this.GetRelHumFromVapPres = function (TDryBulb, VapPres) {
    if (!(VapPres >= 0.))
      throw new Error("Partial pressure of water vapor in moist air is negative");
    return VapPres / this.GetSatVapPres(TDryBulb);
  }

  this.dLnPws_ = function (TDryBulb) {
    var dLnPws, T;
    if (this.isIP()) {
      T = this.GetTRankineFromTFahrenheit(TDryBulb);
      if (TDryBulb <= TRIPLE_POINT_WATER_IP)
        dLnPws = 1.0214165E+04 / pow(T, 2) - 5.3765794E-03 + 2 * 1.9202377E-07 * T
                 + 3 * 3.5575832E-10 * pow(T, 2) - 4 * 9.0344688E-14 * pow(T, 3) + 4.1635019 / T;
      else
        dLnPws = 1.0440397E+04 / pow(T, 2) - 2.7022355E-02 + 2 * 1.2890360E-05 * T
                 - 3 * 2.4780681E-09 * pow(T, 2) + 6.5459673 / T;
    } else {
      T = this.GetTKelvinFromTCelsius(TDryBulb);
      if (TDryBulb <= TRIPLE_POINT_WATER_SI)
        dLnPws = 5.6745359E+03 / pow(T, 2) - 9.677843E-03 + 2 * 6.2215701E-07 * T
                 + 3 * 2.0747825E-09 * pow(T, 2) - 4 * 9.484024E-13 * pow(T, 3) + 4.1635019 / T;
      else
        dLnPws = 5.8002206E+03 / pow(T, 2) - 4.8640239E-02 + 2 * 4.1764768E-05 * T
                 - 3 * 1.4452093E-08 * pow(T, 2) + 6.5459673 / T;
    }
    return dLnPws;
  }

  this.GetTDewPointFromVapPres = function (TDryBulb, VapPres) {
    var BOUNDS = this.isIP() ? [-148., 392.] : [-100., 200.];
    if (VapPres < this.GetSatVapPres(BOUNDS[0]) || VapPres > this.GetSatVapPres(BOUNDS[1]))
      throw new Error("Partial pressure of water vapor is outside range of validity of equations");

    var TDewPoint = TDryBulb;
    var lnVP = log(VapPres);
    var TDewPoint_iter;
    var lnVP_iter;
    var index = 1;
    do {
      TDewPoint_iter = TDewPoint;
      lnVP_iter = log(this.GetSatVapPres(TDewPoint_iter));
      var d_lnVP = this.dLnPws_(TDewPoint_iter);
      TDewPoint = TDewPoint_iter - (lnVP_iter - lnVP) / d_lnVP;
      TDewPoint = max(TDewPoint, BOUNDS[0]);
      TDewPoint = min(TDewPoint, BOUNDS[1]);
      if (index > MAX_ITER_COUNT)
        throw new Error("Convergence not reached in GetTDewPointFromVapPres. Stopping.");
      index++;
    } while (abs(TDewPoint - TDewPoint_iter) > PSYCHROLIB_TOLERANCE);
    return min(TDewPoint, TDryBulb);
  }

  this.GetVapPresFromTDewPoint = function (TDewPoint) {
    return this.GetSatVapPres(TDewPoint);
  }

  /******************************************************************************************************
   * Conversions from wet-bulb temperature, dew-point temperature, or relative humidity to humidity ratio
   *****************************************************************************************************/

  this.GetTWetBulbFromHumRatio = function (TDryBulb, HumRatio, Pressure) {
    var Wstar;
    var TDewPoint, TWetBulb, TWetBulbSup, TWetBulbInf, BoundedHumRatio;
    var index = 1;

    if (!(HumRatio >= 0.))
      throw new Error("Humidity ratio is negative");
    BoundedHumRatio = max(HumRatio, MIN_HUM_RATIO);

    TDewPoint = this.GetTDewPointFromHumRatio(TDryBulb, BoundedHumRatio, Pressure);
    TWetBulbSup = TDryBulb;
    TWetBulbInf = TDewPoint;
    TWetBulb = (TWetBulbInf + TWetBulbSup) / 2.;

    while ((TWetBulbSup - TWetBulbInf) > PSYCHROLIB_TOLERANCE) {
      Wstar = this.GetHumRatioFromTWetBulb(TDryBulb, TWetBulb, Pressure);
      if (Wstar > BoundedHumRatio)
        TWetBulbSup = TWetBulb;
      else
        TWetBulbInf = TWetBulb;
      TWetBulb = (TWetBulbSup + TWetBulbInf) / 2.;
      if (index > MAX_ITER_COUNT)
        throw new Error("Convergence not reached in GetTWetBulbFromHumRatio. Stopping.");
      index++;
    }
    return TWetBulb;
  }

  this.GetHumRatioFromTWetBulb = function (TDryBulb, TWetBulb, Pressure) {
    var Wsstar;
    var HumRatio = INVALID;

    if (!(TWetBulb <= TDryBulb))
      throw new Error("Wet bulb temperature is above dry bulb temperature");

    Wsstar = this.GetSatHumRatio(TWetBulb, Pressure);

    if (this.isIP()) {
      if (TWetBulb >= FREEZING_POINT_WATER_IP)
        HumRatio = ((1093. - 0.556 * TWetBulb) * Wsstar - 0.240 * (TDryBulb - TWetBulb))
        / (1093. + 0.444 * TDryBulb - TWetBulb);
      else
        HumRatio = ((1220. - 0.04 * TWetBulb) * Wsstar - 0.240 * (TDryBulb - TWetBulb))
        / (1220. + 0.444 * TDryBulb - 0.48 * TWetBulb);
    } else {
      if (TWetBulb >= FREEZING_POINT_WATER_SI)
        HumRatio = ((2501. - 2.326 * TWetBulb) * Wsstar - 1.006 * (TDryBulb - TWetBulb))
           / (2501. + 1.86 * TDryBulb - 4.186 * TWetBulb);
      else
        HumRatio = ((2830. - 0.24 * TWetBulb) * Wsstar - 1.006 * (TDryBulb - TWetBulb))
           / (2830. + 1.86 * TDryBulb - 2.1 * TWetBulb);
    }
    return max(HumRatio, MIN_HUM_RATIO);
  }

  this.GetHumRatioFromRelHum = function (TDryBulb, RelHum, Pressure) {
    if (!(RelHum >= 0. && RelHum <= 1.))
      throw new Error("Relative humidity is outside range [0,1]");
    var VapPres = this.GetVapPresFromRelHum(TDryBulb, RelHum);
    return this.GetHumRatioFromVapPres(VapPres, Pressure);
  }

  this.GetRelHumFromHumRatio = function (TDryBulb, HumRatio, Pressure) {
    if (!(HumRatio >= 0.))
      throw new Error("Humidity ratio is negative");
    var VapPres = this.GetVapPresFromHumRatio(HumRatio, Pressure);
    return this.GetRelHumFromVapPres(TDryBulb, VapPres);
  }

  this.GetHumRatioFromTDewPoint = function (TDewPoint, Pressure) {
    var VapPres = this.GetSatVapPres(TDewPoint);
    return this.GetHumRatioFromVapPres(VapPres, Pressure);
  }

  this.GetTDewPointFromHumRatio = function (TDryBulb, HumRatio, Pressure) {
    if (!(HumRatio >= 0.))
      throw new Error("Humidity ratio is negative");
    var VapPres = this.GetVapPresFromHumRatio(HumRatio, Pressure);
    return this.GetTDewPointFromVapPres(TDryBulb, VapPres);
  }

  this.GetHumRatioFromVapPres = function (VapPres, Pressure) {
    if (!(VapPres >= 0.))
      throw new Error("Partial pressure of water vapor in moist air is negative");
    var HumRatio = 0.621945 * VapPres / (Pressure - VapPres);
    return max(HumRatio, MIN_HUM_RATIO);
  }

  this.GetVapPresFromHumRatio = function (HumRatio, Pressure) {
    if (!(HumRatio >= 0.))
      throw new Error("Humidity ratio is negative");
    var BoundedHumRatio = max(HumRatio, MIN_HUM_RATIO);
    return Pressure * BoundedHumRatio / (0.621945 + BoundedHumRatio);
  }

  this.GetSpecificHumFromHumRatio = function (HumRatio) {
    if (!(HumRatio >= 0.))
      throw new Error("Humidity ratio is negative");
    var BoundedHumRatio = max(HumRatio, MIN_HUM_RATIO);
    return BoundedHumRatio / (1.0 + BoundedHumRatio);
  }

  this.GetHumRatioFromSpecificHum = function (SpecificHum) {
    if (!(SpecificHum >= 0.0 && SpecificHum < 1.0))
      throw new Error("Specific humidity is outside range [0, 1)");
    var HumRatio = SpecificHum / (1.0 - SpecificHum);
    return max(HumRatio, MIN_HUM_RATIO);
  }

  /******************************************************************************************************
   * Dry Air Calculations
   *****************************************************************************************************/

  this.GetDryAirEnthalpy = function (TDryBulb) {
    if (this.isIP())
      return 0.240 * TDryBulb;
    else
      return 1006. * TDryBulb;
  }

  this.GetDryAirDensity = function (TDryBulb, Pressure) {
    if (this.isIP())
      return (144. * Pressure) / R_DA_IP / this.GetTRankineFromTFahrenheit(TDryBulb);
    else
      return Pressure / R_DA_SI / this.GetTKelvinFromTCelsius(TDryBulb);
  }

  this.GetDryAirVolume = function (TDryBulb, Pressure) {
    if (this.isIP())
      return R_DA_IP * this.GetTRankineFromTFahrenheit(TDryBulb) / (144. * Pressure);
    else
      return R_DA_SI * this.GetTKelvinFromTCelsius(TDryBulb) / Pressure;
  }

  this.GetTDryBulbFromEnthalpyAndHumRatio = function (MoistAirEnthalpy, HumRatio) {
    var BoundedHumRatio;
    if (!(HumRatio >= 0.))
      throw new Error("Humidity ratio is negative");
    BoundedHumRatio = max(HumRatio, MIN_HUM_RATIO);
    if (this.isIP())
      return (MoistAirEnthalpy - 1061.0 * BoundedHumRatio) / (0.240 + 0.444 * BoundedHumRatio);
    else
      return (MoistAirEnthalpy / 1000.0 - 2501.0 * BoundedHumRatio) / (1.006 + 1.86 * BoundedHumRatio);
  }

  this.GetHumRatioFromEnthalpyAndTDryBulb = function (MoistAirEnthalpy, TDryBulb) {
    var HumRatio;
    if (this.isIP())
      HumRatio = (MoistAirEnthalpy - 0.240 * TDryBulb) / (1061.0 + 0.444 * TDryBulb);
    else
      HumRatio = (MoistAirEnthalpy / 1000.0 - 1.006 * TDryBulb) / (2501.0 + 1.86 * TDryBulb);
    return max(HumRatio, MIN_HUM_RATIO);
  }

  /******************************************************************************************************
   * Saturated Air Calculations
   *****************************************************************************************************/

  this.GetSatVapPres = function (TDryBulb) {
    var LnPws, T;
    if (this.isIP()) {
      if (!(TDryBulb >= -148. && TDryBulb <= 392.))
        throw new Error("Dry bulb temperature is outside range [-148, 392]");
      T = this.GetTRankineFromTFahrenheit(TDryBulb);
      if (TDryBulb <= TRIPLE_POINT_WATER_IP)
        LnPws = (-1.0214165E+04 / T - 4.8932428 - 5.3765794E-03 * T + 1.9202377E-07 * T * T
                + 3.5575832E-10 * pow(T, 3) - 9.0344688E-14 * pow(T, 4) + 4.1635019 * log(T));
      else
        LnPws = -1.0440397E+04 / T - 1.1294650E+01 - 2.7022355E-02 * T + 1.2890360E-05 * T * T
                - 2.4780681E-09 * pow(T, 3) + 6.5459673 * log(T);
    } else {
      if (!(TDryBulb >= -100. && TDryBulb <= 200.))
        throw new Error("Dry bulb temperature is outside range [-100, 200]");
      T = this.GetTKelvinFromTCelsius(TDryBulb);
      if (TDryBulb <= TRIPLE_POINT_WATER_SI)
        LnPws = -5.6745359E+03 / T + 6.3925247 - 9.677843E-03 * T + 6.2215701E-07 * T * T
                + 2.0747825E-09 * pow(T, 3) - 9.484024E-13 * pow(T, 4) + 4.1635019 * log(T);
      else
        LnPws = -5.8002206E+03 / T + 1.3914993 - 4.8640239E-02 * T + 4.1764768E-05 * T * T
                - 1.4452093E-08 * pow(T, 3) + 6.5459673 * log(T);
    }
    return exp(LnPws);
  }

  this.GetSatHumRatio = function (TDryBulb, Pressure) {
    var SatVaporPres = this.GetSatVapPres(TDryBulb);
    var SatHumRatio = 0.621945 * SatVaporPres / (Pressure - SatVaporPres);
    return max(SatHumRatio, MIN_HUM_RATIO);
  }

  this.GetSatAirEnthalpy = function (TDryBulb, Pressure) {
    return this.GetMoistAirEnthalpy(TDryBulb, this.GetSatHumRatio(TDryBulb, Pressure));
  }

  /******************************************************************************************************
   * Moist Air Calculations
   *****************************************************************************************************/

  this.GetVaporPressureDeficit = function (TDryBulb, HumRatio, Pressure) {
    if (!(HumRatio >= 0.))
      throw new Error("Humidity ratio is negative");
    var RelHum = this.GetRelHumFromHumRatio(TDryBulb, HumRatio, Pressure);
    return this.GetSatVapPres(TDryBulb) * (1. - RelHum);
  }

  this.GetDegreeOfSaturation = function (TDryBulb, HumRatio, Pressure) {
    if (!(HumRatio >= 0.))
      throw new Error("Humidity ratio is negative");
    var BoundedHumRatio = max(HumRatio, MIN_HUM_RATIO);
    return BoundedHumRatio / this.GetSatHumRatio(TDryBulb, Pressure);
  }

  this.GetMoistAirEnthalpy = function (TDryBulb, HumRatio) {
    var BoundedHumRatio;
    if (!(HumRatio >= 0.))
      throw new Error("Humidity ratio is negative");
    BoundedHumRatio = max(HumRatio, MIN_HUM_RATIO);
    if (this.isIP())
      return 0.240 * TDryBulb + BoundedHumRatio * (1061. + 0.444 * TDryBulb);
    else
      return (1.006 * TDryBulb + BoundedHumRatio * (2501. + 1.86 * TDryBulb)) * 1000.;
  }

  this.GetMoistAirVolume = function (TDryBulb, HumRatio, Pressure) {
    var BoundedHumRatio;
    if (!(HumRatio >= 0.))
      throw new Error("Humidity ratio is negative");
    BoundedHumRatio = max(HumRatio, MIN_HUM_RATIO);
    if (this.isIP())
      return R_DA_IP * this.GetTRankineFromTFahrenheit(TDryBulb) * (1. + 1.607858 * BoundedHumRatio) / (144. * Pressure);
    else
      return R_DA_SI * this.GetTKelvinFromTCelsius(TDryBulb) * (1. + 1.607858 * BoundedHumRatio) / Pressure;
  }

  this.GetTDryBulbFromMoistAirVolumeAndHumRatio = function (MoistAirVolume, HumRatio, Pressure) {
    var BoundedHumRatio;
    if (!(HumRatio >= 0.))
      throw new Error("Humidity ratio is negative");
    BoundedHumRatio = max(HumRatio, MIN_HUM_RATIO);
    if (this.isIP())
      return this.GetTFahrenheitFromTRankine(MoistAirVolume * (144 * Pressure) / (R_DA_IP * (1 + 1.607858 * BoundedHumRatio)));
    else
      return this.GetTCelsiusFromTKelvin(MoistAirVolume * Pressure / (R_DA_SI * (1 + 1.607858 * BoundedHumRatio)));
  }

  this.GetMoistAirDensity = function (TDryBulb, HumRatio, Pressure) {
    var BoundedHumRatio;
    if (!(HumRatio >= 0.))
      throw new Error("Humidity ratio is negative");
    BoundedHumRatio = max(HumRatio, MIN_HUM_RATIO);
    return (1. + BoundedHumRatio) / this.GetMoistAirVolume(TDryBulb, BoundedHumRatio, Pressure);
  }

  /******************************************************************************************************
   * Standard atmosphere
   *****************************************************************************************************/

  this.GetStandardAtmPressure = function (Altitude) {
    var Pressure;
    if (this.isIP())
      Pressure = 14.696 * pow(1. - 6.8754e-06 * Altitude, 5.2559);
    else
      Pressure = 101325.* pow(1. - 2.25577e-05 * Altitude, 5.2559);
    return Pressure;
  }

  this.GetStandardAtmTemperature = function (Altitude) {
    var Temperature;
    if (this.isIP())
      Temperature = 59. - 0.00356620 * Altitude;
    else
      Temperature = 15. - 0.0065 * Altitude;
    return Temperature;
  }

  this.GetSeaLevelPressure = function (StnPressure, Altitude, TDryBulb) {
    var TColumn, H;
    if (this.isIP()) {
      TColumn = TDryBulb + 0.0036 * Altitude / 2.;
      H = 53.351 * this.GetTRankineFromTFahrenheit(TColumn);
    } else {
      TColumn = TDryBulb + 0.0065 * Altitude / 2.;
      H = 287.055 * this.GetTKelvinFromTCelsius(TColumn) / 9.807;
    }
    return StnPressure * exp(Altitude / H);
  }

  this.GetStationPressure = function (SeaLevelPressure, Altitude, TDryBulb) {
    return SeaLevelPressure / this.GetSeaLevelPressure(1., Altitude, TDryBulb);
  }

  /******************************************************************************************************
   * Functions to set all psychrometric values
   *****************************************************************************************************/

  this.CalcPsychrometricsFromTWetBulb = function (TDryBulb, TWetBulb, Pressure) {
    var HumRatio = this.GetHumRatioFromTWetBulb(TDryBulb, TWetBulb, Pressure);
    var TDewPoint = this.GetTDewPointFromHumRatio(TDryBulb, HumRatio, Pressure);
    var RelHum = this.GetRelHumFromHumRatio(TDryBulb, HumRatio, Pressure);
    var VapPres = this.GetVapPresFromHumRatio(HumRatio, Pressure);
    var MoistAirEnthalpy = this.GetMoistAirEnthalpy(TDryBulb, HumRatio);
    var MoistAirVolume = this.GetMoistAirVolume(TDryBulb, HumRatio, Pressure);
    var DegreeOfSaturation = this.GetDegreeOfSaturation(TDryBulb, HumRatio, Pressure);
    return [HumRatio, TDewPoint, RelHum, VapPres, MoistAirEnthalpy, MoistAirVolume, DegreeOfSaturation];
  }

  this.CalcPsychrometricsFromTDewPoint = function (TDryBulb, TDewPoint, Pressure) {
    var HumRatio = this.GetHumRatioFromTDewPoint(TDewPoint, Pressure);
    var TWetBulb = this.GetTWetBulbFromHumRatio(TDryBulb, HumRatio, Pressure);
    var RelHum = this.GetRelHumFromHumRatio(TDryBulb, HumRatio, Pressure);
    var VapPres = this.GetVapPresFromHumRatio(HumRatio, Pressure);
    var MoistAirEnthalpy = this.GetMoistAirEnthalpy(TDryBulb, HumRatio);
    var MoistAirVolume = this.GetMoistAirVolume(TDryBulb, HumRatio, Pressure);
    var DegreeOfSaturation = this.GetDegreeOfSaturation(TDryBulb, HumRatio, Pressure);
    return [HumRatio, TWetBulb, RelHum, VapPres, MoistAirEnthalpy, MoistAirVolume, DegreeOfSaturation];
  }

  this.CalcPsychrometricsFromRelHum = function (TDryBulb, RelHum, Pressure) {
    var HumRatio = this.GetHumRatioFromRelHum(TDryBulb, RelHum, Pressure);
    var TWetBulb = this.GetTWetBulbFromHumRatio(TDryBulb, HumRatio, Pressure);
    var TDewPoint = this.GetTDewPointFromHumRatio(TDryBulb, HumRatio, Pressure);
    var VapPres = this.GetVapPresFromHumRatio(HumRatio, Pressure);
    var MoistAirEnthalpy = this.GetMoistAirEnthalpy(TDryBulb, HumRatio);
    var MoistAirVolume = this.GetMoistAirVolume(TDryBulb, HumRatio, Pressure);
    var DegreeOfSaturation = this.GetDegreeOfSaturation(TDryBulb, HumRatio, Pressure);
    return [HumRatio, TWetBulb, TDewPoint, VapPres, MoistAirEnthalpy, MoistAirVolume, DegreeOfSaturation];
  }
}

// UMD pattern
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
      define([], factory);
  } else if (typeof module === 'object' && module.exports) {
      module.exports = factory();
  } else {
      root.psychrolib = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  var pl = new Psychrometrics();
  pl.SetUnitSystem(pl.SI);
  return pl;
}));
