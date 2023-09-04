import type { BigNumber } from "ethers";

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
    const rounded = Convert.round(value, decimals).toString();

    this.toE27 = utils.parseUnits(rounded, 27);
    this.toInt = parseFloat(rounded);
    this.toOpyn = utils.parseUnits(rounded, 8);
    this.toStr = rounded;
    this.toUSDC = utils.parseUnits(rounded, 6);
    this.toWei = utils.parseEther(rounded);

    Object.freeze(this);
  }

  toE27: BigNumber;
  toInt: number;
  toOpyn: BigNumber;
  toStr: string;
  toUSDC: BigNumber;
  toWei: BigNumber;

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
  public static fromE27 = (value: BigNumber | string) =>
    new Convert(utils.formatUnits(value, this.E27), this.E27);

  /**
   * Public static method to ingest an integer.
   *
   * @param value - An integer to convert.
   *
   * @returns - A new instance of the Convert class.
   */
  public static fromInt = (value: number) => new Convert(value.toString());

  /**
   * Public static method to ingest a 1e8 big number.
   *
   * @param value - A BigNumber or string value to convert from 1e8.
   *
   * @returns - A new instance of the Convert class.
   */
  public static fromOpyn = (value: BigNumber | string) =>
    new Convert(utils.formatUnits(value, this.OPYN), this.OPYN);

  /**
   * Public static method to ingest a string.
   *
   * @param value - A string integer to convert.
   *
   * @returns - A new instance of the Convert class.
   */
  public static fromStr = (value: string) => new Convert(value);

  /**
   * Public static method to ingest a 1e6 big number.
   *
   * @param value - A BigNumber or string value to convert from 1e6.
   * @param decimals - Optional number of decimal places for rounding. Defaults to four.
   *
   * @returns - A new instance of the Convert class.
   */
  public static fromUSDC = (value: BigNumber | string, decimals: number = 4) =>
    new Convert(utils.formatUnits(value, this.USDC), decimals);

  /**
   * Public static method to ingest a 1e18 big number.
   *
   * @param value - A BigNumber or string value to convert from 1e18.
   * @param places - Optional number of decimal places for rounding. Defaults to three.
   *
   * @returns - A new instance of the Convert class.
   */
  public static fromWei = (value: BigNumber | string, decimals: number = 3) =>
    new Convert(utils.formatUnits(value, this.WEI), decimals);

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
    const exponent = Math.pow(10, decimals);
    const rounded = Math.trunc(Math.round(asFloat * exponent)) / exponent;

    return rounded;
  };
}
