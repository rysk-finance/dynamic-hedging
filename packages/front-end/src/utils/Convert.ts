import { BigNumber } from "ethers";

import { utils } from "ethers";

/**
 * Class to facilitate conversions between numeric values.
 */
export class Convert {
  /**
   * Create a Convert instance.
   *
   * @param value - A numeric value to convert.
   * @param places - Optional number of decimal places for rounding.
   */
  constructor(value: string = "0", decimals: number = 0) {
    this.toE27 = () => {
      const adjusted = decimals > Convert.E27 ? Convert.E27 : decimals;
      const rounded = Convert.round(value, adjusted).toString();

      return utils.parseUnits(rounded, Convert.E27);
    };
    this.toInt = () => {
      const rounded = Convert.round(value, decimals);

      return rounded;
    };
    this.toOpyn = () => {
      const adjusted = decimals > Convert.OPYN ? Convert.OPYN : decimals;
      const rounded = Convert.round(value, adjusted).toString();

      return utils.parseUnits(rounded, Convert.OPYN);
    };
    this.toStr = () => {
      const rounded = Convert.round(value, decimals).toString();

      return rounded;
    };
    this.toUSDC = () => {
      const adjusted = decimals > Convert.USDC ? Convert.USDC : decimals;
      const rounded = Convert.round(value, adjusted).toString();

      return utils.parseUnits(rounded, Convert.USDC);
    };
    this.toWei = () => {
      const adjusted = decimals > Convert.WEI ? Convert.WEI : decimals;
      const rounded = Convert.round(value, adjusted).toString();

      return utils.parseUnits(rounded, Convert.WEI);
    };

    Object.freeze(this);
  }

  toE27: () => BigNumber;
  toInt: () => number;
  toOpyn: () => BigNumber;
  toStr: () => string;
  toUSDC: () => BigNumber;
  toWei: () => BigNumber;

  private static BIG_ZERO = BigNumber.from(0);

  public static USDC = 6;
  public static OPYN = 8;
  public static WEI = 18;
  public static E27 = 27;

  /**
   * Public static method to ingest a 1e27 big number.
   *
   * @param value - A BigNumber or string value to convert from 1e27.
   *
   * @returns - A new instance of the Convert class.
   */
  public static fromE27 = (value: BigNumber | string = this.BIG_ZERO) =>
    new Convert(utils.formatUnits(value, this.E27), this.E27);

  /**
   * Public static method to ingest an integer.
   *
   * @param value - An integer to convert.
   * @param decimals - Optional number of decimal places for rounding. Defaults to 2.
   *
   * @returns - A new instance of the Convert class.
   */
  public static fromInt = (value: number, decimals: number = 2) =>
    new Convert(value.toString(), decimals);

  /**
   * Public static method to ingest a 1e8 big number.
   *
   * @param value - A BigNumber or string value to convert from 1e8.
   * @param decimals - Optional number of decimal places for rounding. Defaults to 8.
   *
   * @returns - A new instance of the Convert class.
   */
  public static fromOpyn = (
    value: BigNumber | string = this.BIG_ZERO,
    decimals: number = this.OPYN
  ) => new Convert(utils.formatUnits(value, this.OPYN), decimals);

  /**
   * Public static method to ingest a string.
   *
   * @param value - A string integer to convert.
   * @param decimals - Optional number of decimal places for rounding. Defaults to 2.
   *
   * @returns - A new instance of the Convert class.
   */
  public static fromStr = (value: string, decimals: number = 2) =>
    new Convert(value, decimals);

  /**
   * Public static method to ingest a 1e6 big number.
   *
   * @param value - A BigNumber or string value to convert from 1e6.
   * @param decimals - Optional number of decimal places for rounding. Defaults to four.
   *
   * @returns - A new instance of the Convert class.
   */
  public static fromUSDC = (
    value: BigNumber | string = this.BIG_ZERO,
    decimals: number = 4
  ) => new Convert(utils.formatUnits(value, this.USDC), decimals);

  /**
   * Public static method to ingest a 1e18 big number.
   *
   * @param value - A BigNumber or string value to convert from 1e18.
   * @param places - Optional number of decimal places for rounding. Defaults to three.
   *
   * @returns - A new instance of the Convert class.
   */
  public static fromWei = (
    value: BigNumber | string = this.BIG_ZERO,
    decimals: number = 3
  ) => new Convert(utils.formatUnits(value, this.WEI), decimals);

  /**
   * Public static method for numeric rounding.
   *
   * @param value - A numeric or string value to convert.
   * @param places - Optional number of decimal places for rounding. Defaults to two.
   *
   * @returns - The rounded value as an integer.
   */
  public static round = (value: string | number, decimals: number = 2) => {
    const asFloat = typeof value === "string" ? parseFloat(value) : value;

    if (Number.isNaN(asFloat)) return 0;

    if (!decimals) return asFloat;

    const exponent = Math.pow(10, decimals);
    const rounded = Math.trunc(Math.round(asFloat * exponent)) / exponent;

    return rounded;
  };
}
