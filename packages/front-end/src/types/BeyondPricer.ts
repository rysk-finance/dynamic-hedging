/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import {
  BaseContract,
  BigNumber,
  BigNumberish,
  BytesLike,
  CallOverrides,
  ContractTransaction,
  Overrides,
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import { FunctionFragment, Result, EventFragment } from "@ethersproject/abi";
import { Listener, Provider } from "@ethersproject/providers";
import type {
  TypedEventFilter,
  TypedEvent,
  TypedListener,
  OnEvent,
} from "./common";

export declare namespace Types {
  export type OptionSeriesStruct = {
    expiration: BigNumberish;
    strike: BigNumberish;
    isPut: boolean;
    underlying: string;
    strikeAsset: string;
    collateral: string;
  };

  export type OptionSeriesStructOutput = [
    BigNumber,
    BigNumber,
    boolean,
    string,
    string,
    string
  ] & {
    expiration: BigNumber;
    strike: BigNumber;
    isPut: boolean;
    underlying: string;
    strikeAsset: string;
    collateral: string;
  };
}

export interface BeyondPricerInterface extends utils.Interface {
  contractName: "BeyondPricer";
  functions: {
    "addressBook()": FunctionFragment;
    "authority()": FunctionFragment;
    "bidAskIVSpread()": FunctionFragment;
    "callSlippageGradientMultipliers(uint256)": FunctionFragment;
    "collateralAsset()": FunctionFragment;
    "collateralLendingRate()": FunctionFragment;
    "deltaBandWidth()": FunctionFragment;
    "feePerContract()": FunctionFragment;
    "getCallSlippageGradientMultipliers()": FunctionFragment;
    "getPutSlippageGradientMultipliers()": FunctionFragment;
    "liquidityPool()": FunctionFragment;
    "longDeltaBorrowRate()": FunctionFragment;
    "protocol()": FunctionFragment;
    "putSlippageGradientMultipliers(uint256)": FunctionFragment;
    "quoteOptionPrice((uint64,uint128,bool,address,address,address),uint256,bool,int256)": FunctionFragment;
    "riskFreeRate()": FunctionFragment;
    "setAuthority(address)": FunctionFragment;
    "setBidAskIVSpread(uint256)": FunctionFragment;
    "setCollateralLendingRate(uint256)": FunctionFragment;
    "setDeltaBandWidth(uint256,uint256[],uint256[])": FunctionFragment;
    "setFeePerContract(uint256)": FunctionFragment;
    "setLongDeltaBorrowRate(uint256)": FunctionFragment;
    "setRiskFreeRate(uint256)": FunctionFragment;
    "setShortDeltaBorrowRate(uint256)": FunctionFragment;
    "setSlippageGradient(uint256)": FunctionFragment;
    "setSlippageGradientMultipliers(uint256[],uint256[])": FunctionFragment;
    "shortDeltaBorrowRate()": FunctionFragment;
    "slippageGradient()": FunctionFragment;
    "strikeAsset()": FunctionFragment;
    "underlyingAsset()": FunctionFragment;
  };

  encodeFunctionData(
    functionFragment: "addressBook",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "authority", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "bidAskIVSpread",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "callSlippageGradientMultipliers",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "collateralAsset",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "collateralLendingRate",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "deltaBandWidth",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "feePerContract",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "getCallSlippageGradientMultipliers",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "getPutSlippageGradientMultipliers",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "liquidityPool",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "longDeltaBorrowRate",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "protocol", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "putSlippageGradientMultipliers",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "quoteOptionPrice",
    values: [Types.OptionSeriesStruct, BigNumberish, boolean, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "riskFreeRate",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "setAuthority",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "setBidAskIVSpread",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "setCollateralLendingRate",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "setDeltaBandWidth",
    values: [BigNumberish, BigNumberish[], BigNumberish[]]
  ): string;
  encodeFunctionData(
    functionFragment: "setFeePerContract",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "setLongDeltaBorrowRate",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "setRiskFreeRate",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "setShortDeltaBorrowRate",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "setSlippageGradient",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "setSlippageGradientMultipliers",
    values: [BigNumberish[], BigNumberish[]]
  ): string;
  encodeFunctionData(
    functionFragment: "shortDeltaBorrowRate",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "slippageGradient",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "strikeAsset",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "underlyingAsset",
    values?: undefined
  ): string;

  decodeFunctionResult(
    functionFragment: "addressBook",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "authority", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "bidAskIVSpread",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "callSlippageGradientMultipliers",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "collateralAsset",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "collateralLendingRate",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "deltaBandWidth",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "feePerContract",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getCallSlippageGradientMultipliers",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getPutSlippageGradientMultipliers",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "liquidityPool",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "longDeltaBorrowRate",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "protocol", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "putSlippageGradientMultipliers",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "quoteOptionPrice",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "riskFreeRate",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setAuthority",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setBidAskIVSpread",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setCollateralLendingRate",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setDeltaBandWidth",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setFeePerContract",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setLongDeltaBorrowRate",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setRiskFreeRate",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setShortDeltaBorrowRate",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setSlippageGradient",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setSlippageGradientMultipliers",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "shortDeltaBorrowRate",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "slippageGradient",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "strikeAsset",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "underlyingAsset",
    data: BytesLike
  ): Result;

  events: {
    "AuthorityUpdated(address)": EventFragment;
    "BidAskIVSpreadChanged(uint256,uint256)": EventFragment;
    "CollateralLendingRateChanged(uint256,uint256)": EventFragment;
    "DeltaBandWidthChanged(uint256,uint256)": EventFragment;
    "FeePerContractChanged(uint256,uint256)": EventFragment;
    "LongDeltaBorrowRateChanged(uint256,uint256)": EventFragment;
    "RiskFreeRateChanged(uint256,uint256)": EventFragment;
    "ShortDeltaBorrowRateChanged(uint256,uint256)": EventFragment;
    "SlippageGradientChanged(uint256,uint256)": EventFragment;
    "SlippageGradientMultipliersChanged()": EventFragment;
  };

  getEvent(nameOrSignatureOrTopic: "AuthorityUpdated"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "BidAskIVSpreadChanged"): EventFragment;
  getEvent(
    nameOrSignatureOrTopic: "CollateralLendingRateChanged"
  ): EventFragment;
  getEvent(nameOrSignatureOrTopic: "DeltaBandWidthChanged"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "FeePerContractChanged"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "LongDeltaBorrowRateChanged"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "RiskFreeRateChanged"): EventFragment;
  getEvent(
    nameOrSignatureOrTopic: "ShortDeltaBorrowRateChanged"
  ): EventFragment;
  getEvent(nameOrSignatureOrTopic: "SlippageGradientChanged"): EventFragment;
  getEvent(
    nameOrSignatureOrTopic: "SlippageGradientMultipliersChanged"
  ): EventFragment;
}

export type AuthorityUpdatedEvent = TypedEvent<[string], { authority: string }>;

export type AuthorityUpdatedEventFilter =
  TypedEventFilter<AuthorityUpdatedEvent>;

export type BidAskIVSpreadChangedEvent = TypedEvent<
  [BigNumber, BigNumber],
  { newBidAskIVSpread: BigNumber; oldBidAskIVSpread: BigNumber }
>;

export type BidAskIVSpreadChangedEventFilter =
  TypedEventFilter<BidAskIVSpreadChangedEvent>;

export type CollateralLendingRateChangedEvent = TypedEvent<
  [BigNumber, BigNumber],
  { newCollateralLendingRate: BigNumber; oldCollateralLendingRate: BigNumber }
>;

export type CollateralLendingRateChangedEventFilter =
  TypedEventFilter<CollateralLendingRateChangedEvent>;

export type DeltaBandWidthChangedEvent = TypedEvent<
  [BigNumber, BigNumber],
  { newDeltaBandWidth: BigNumber; oldDeltaBandWidth: BigNumber }
>;

export type DeltaBandWidthChangedEventFilter =
  TypedEventFilter<DeltaBandWidthChangedEvent>;

export type FeePerContractChangedEvent = TypedEvent<
  [BigNumber, BigNumber],
  { newFeePerContract: BigNumber; oldFeePerContract: BigNumber }
>;

export type FeePerContractChangedEventFilter =
  TypedEventFilter<FeePerContractChangedEvent>;

export type LongDeltaBorrowRateChangedEvent = TypedEvent<
  [BigNumber, BigNumber],
  { newLongDeltaBorrowRate: BigNumber; oldLongDeltaBorrowRate: BigNumber }
>;

export type LongDeltaBorrowRateChangedEventFilter =
  TypedEventFilter<LongDeltaBorrowRateChangedEvent>;

export type RiskFreeRateChangedEvent = TypedEvent<
  [BigNumber, BigNumber],
  { newRiskFreeRate: BigNumber; oldRiskFreeRate: BigNumber }
>;

export type RiskFreeRateChangedEventFilter =
  TypedEventFilter<RiskFreeRateChangedEvent>;

export type ShortDeltaBorrowRateChangedEvent = TypedEvent<
  [BigNumber, BigNumber],
  { newShortDeltaBorrowRate: BigNumber; oldShortDeltaBorrowRate: BigNumber }
>;

export type ShortDeltaBorrowRateChangedEventFilter =
  TypedEventFilter<ShortDeltaBorrowRateChangedEvent>;

export type SlippageGradientChangedEvent = TypedEvent<
  [BigNumber, BigNumber],
  { newSlippageGradient: BigNumber; oldSlippageGradient: BigNumber }
>;

export type SlippageGradientChangedEventFilter =
  TypedEventFilter<SlippageGradientChangedEvent>;

export type SlippageGradientMultipliersChangedEvent = TypedEvent<[], {}>;

export type SlippageGradientMultipliersChangedEventFilter =
  TypedEventFilter<SlippageGradientMultipliersChangedEvent>;

export interface BeyondPricer extends BaseContract {
  contractName: "BeyondPricer";
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: BeyondPricerInterface;

  queryFilter<TEvent extends TypedEvent>(
    event: TypedEventFilter<TEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TEvent>>;

  listeners<TEvent extends TypedEvent>(
    eventFilter?: TypedEventFilter<TEvent>
  ): Array<TypedListener<TEvent>>;
  listeners(eventName?: string): Array<Listener>;
  removeAllListeners<TEvent extends TypedEvent>(
    eventFilter: TypedEventFilter<TEvent>
  ): this;
  removeAllListeners(eventName?: string): this;
  off: OnEvent<this>;
  on: OnEvent<this>;
  once: OnEvent<this>;
  removeListener: OnEvent<this>;

  functions: {
    addressBook(overrides?: CallOverrides): Promise<[string]>;

    authority(overrides?: CallOverrides): Promise<[string]>;

    bidAskIVSpread(overrides?: CallOverrides): Promise<[BigNumber]>;

    callSlippageGradientMultipliers(
      arg0: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[BigNumber]>;

    collateralAsset(overrides?: CallOverrides): Promise<[string]>;

    collateralLendingRate(overrides?: CallOverrides): Promise<[BigNumber]>;

    deltaBandWidth(overrides?: CallOverrides): Promise<[BigNumber]>;

    feePerContract(overrides?: CallOverrides): Promise<[BigNumber]>;

    getCallSlippageGradientMultipliers(
      overrides?: CallOverrides
    ): Promise<[BigNumber[]]>;

    getPutSlippageGradientMultipliers(
      overrides?: CallOverrides
    ): Promise<[BigNumber[]]>;

    liquidityPool(overrides?: CallOverrides): Promise<[string]>;

    longDeltaBorrowRate(overrides?: CallOverrides): Promise<[BigNumber]>;

    protocol(overrides?: CallOverrides): Promise<[string]>;

    putSlippageGradientMultipliers(
      arg0: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[BigNumber]>;

    quoteOptionPrice(
      _optionSeries: Types.OptionSeriesStruct,
      _amount: BigNumberish,
      isSell: boolean,
      netDhvExposure: BigNumberish,
      overrides?: CallOverrides
    ): Promise<
      [BigNumber, BigNumber, BigNumber] & {
        totalPremium: BigNumber;
        totalDelta: BigNumber;
        totalFees: BigNumber;
      }
    >;

    riskFreeRate(overrides?: CallOverrides): Promise<[BigNumber]>;

    setAuthority(
      _newAuthority: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    setBidAskIVSpread(
      _bidAskIVSpread: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    setCollateralLendingRate(
      _collateralLendingRate: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    setDeltaBandWidth(
      _deltaBandWidth: BigNumberish,
      _callSlippageGradientMultipliers: BigNumberish[],
      _putSlippageGradientMultipliers: BigNumberish[],
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    setFeePerContract(
      _feePerContract: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    setLongDeltaBorrowRate(
      _longDeltaBorrowRate: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    setRiskFreeRate(
      _riskFreeRate: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    setShortDeltaBorrowRate(
      _shortDeltaBorrowRate: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    setSlippageGradient(
      _slippageGradient: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    setSlippageGradientMultipliers(
      _callSlippageGradientMultipliers: BigNumberish[],
      _putSlippageGradientMultipliers: BigNumberish[],
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    shortDeltaBorrowRate(overrides?: CallOverrides): Promise<[BigNumber]>;

    slippageGradient(overrides?: CallOverrides): Promise<[BigNumber]>;

    strikeAsset(overrides?: CallOverrides): Promise<[string]>;

    underlyingAsset(overrides?: CallOverrides): Promise<[string]>;
  };

  addressBook(overrides?: CallOverrides): Promise<string>;

  authority(overrides?: CallOverrides): Promise<string>;

  bidAskIVSpread(overrides?: CallOverrides): Promise<BigNumber>;

  callSlippageGradientMultipliers(
    arg0: BigNumberish,
    overrides?: CallOverrides
  ): Promise<BigNumber>;

  collateralAsset(overrides?: CallOverrides): Promise<string>;

  collateralLendingRate(overrides?: CallOverrides): Promise<BigNumber>;

  deltaBandWidth(overrides?: CallOverrides): Promise<BigNumber>;

  feePerContract(overrides?: CallOverrides): Promise<BigNumber>;

  getCallSlippageGradientMultipliers(
    overrides?: CallOverrides
  ): Promise<BigNumber[]>;

  getPutSlippageGradientMultipliers(
    overrides?: CallOverrides
  ): Promise<BigNumber[]>;

  liquidityPool(overrides?: CallOverrides): Promise<string>;

  longDeltaBorrowRate(overrides?: CallOverrides): Promise<BigNumber>;

  protocol(overrides?: CallOverrides): Promise<string>;

  putSlippageGradientMultipliers(
    arg0: BigNumberish,
    overrides?: CallOverrides
  ): Promise<BigNumber>;

  quoteOptionPrice(
    _optionSeries: Types.OptionSeriesStruct,
    _amount: BigNumberish,
    isSell: boolean,
    netDhvExposure: BigNumberish,
    overrides?: CallOverrides
  ): Promise<
    [BigNumber, BigNumber, BigNumber] & {
      totalPremium: BigNumber;
      totalDelta: BigNumber;
      totalFees: BigNumber;
    }
  >;

  riskFreeRate(overrides?: CallOverrides): Promise<BigNumber>;

  setAuthority(
    _newAuthority: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  setBidAskIVSpread(
    _bidAskIVSpread: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  setCollateralLendingRate(
    _collateralLendingRate: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  setDeltaBandWidth(
    _deltaBandWidth: BigNumberish,
    _callSlippageGradientMultipliers: BigNumberish[],
    _putSlippageGradientMultipliers: BigNumberish[],
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  setFeePerContract(
    _feePerContract: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  setLongDeltaBorrowRate(
    _longDeltaBorrowRate: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  setRiskFreeRate(
    _riskFreeRate: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  setShortDeltaBorrowRate(
    _shortDeltaBorrowRate: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  setSlippageGradient(
    _slippageGradient: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  setSlippageGradientMultipliers(
    _callSlippageGradientMultipliers: BigNumberish[],
    _putSlippageGradientMultipliers: BigNumberish[],
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  shortDeltaBorrowRate(overrides?: CallOverrides): Promise<BigNumber>;

  slippageGradient(overrides?: CallOverrides): Promise<BigNumber>;

  strikeAsset(overrides?: CallOverrides): Promise<string>;

  underlyingAsset(overrides?: CallOverrides): Promise<string>;

  callStatic: {
    addressBook(overrides?: CallOverrides): Promise<string>;

    authority(overrides?: CallOverrides): Promise<string>;

    bidAskIVSpread(overrides?: CallOverrides): Promise<BigNumber>;

    callSlippageGradientMultipliers(
      arg0: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    collateralAsset(overrides?: CallOverrides): Promise<string>;

    collateralLendingRate(overrides?: CallOverrides): Promise<BigNumber>;

    deltaBandWidth(overrides?: CallOverrides): Promise<BigNumber>;

    feePerContract(overrides?: CallOverrides): Promise<BigNumber>;

    getCallSlippageGradientMultipliers(
      overrides?: CallOverrides
    ): Promise<BigNumber[]>;

    getPutSlippageGradientMultipliers(
      overrides?: CallOverrides
    ): Promise<BigNumber[]>;

    liquidityPool(overrides?: CallOverrides): Promise<string>;

    longDeltaBorrowRate(overrides?: CallOverrides): Promise<BigNumber>;

    protocol(overrides?: CallOverrides): Promise<string>;

    putSlippageGradientMultipliers(
      arg0: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    quoteOptionPrice(
      _optionSeries: Types.OptionSeriesStruct,
      _amount: BigNumberish,
      isSell: boolean,
      netDhvExposure: BigNumberish,
      overrides?: CallOverrides
    ): Promise<
      [BigNumber, BigNumber, BigNumber] & {
        totalPremium: BigNumber;
        totalDelta: BigNumber;
        totalFees: BigNumber;
      }
    >;

    riskFreeRate(overrides?: CallOverrides): Promise<BigNumber>;

    setAuthority(
      _newAuthority: string,
      overrides?: CallOverrides
    ): Promise<void>;

    setBidAskIVSpread(
      _bidAskIVSpread: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    setCollateralLendingRate(
      _collateralLendingRate: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    setDeltaBandWidth(
      _deltaBandWidth: BigNumberish,
      _callSlippageGradientMultipliers: BigNumberish[],
      _putSlippageGradientMultipliers: BigNumberish[],
      overrides?: CallOverrides
    ): Promise<void>;

    setFeePerContract(
      _feePerContract: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    setLongDeltaBorrowRate(
      _longDeltaBorrowRate: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    setRiskFreeRate(
      _riskFreeRate: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    setShortDeltaBorrowRate(
      _shortDeltaBorrowRate: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    setSlippageGradient(
      _slippageGradient: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    setSlippageGradientMultipliers(
      _callSlippageGradientMultipliers: BigNumberish[],
      _putSlippageGradientMultipliers: BigNumberish[],
      overrides?: CallOverrides
    ): Promise<void>;

    shortDeltaBorrowRate(overrides?: CallOverrides): Promise<BigNumber>;

    slippageGradient(overrides?: CallOverrides): Promise<BigNumber>;

    strikeAsset(overrides?: CallOverrides): Promise<string>;

    underlyingAsset(overrides?: CallOverrides): Promise<string>;
  };

  filters: {
    "AuthorityUpdated(address)"(authority?: null): AuthorityUpdatedEventFilter;
    AuthorityUpdated(authority?: null): AuthorityUpdatedEventFilter;

    "BidAskIVSpreadChanged(uint256,uint256)"(
      newBidAskIVSpread?: null,
      oldBidAskIVSpread?: null
    ): BidAskIVSpreadChangedEventFilter;
    BidAskIVSpreadChanged(
      newBidAskIVSpread?: null,
      oldBidAskIVSpread?: null
    ): BidAskIVSpreadChangedEventFilter;

    "CollateralLendingRateChanged(uint256,uint256)"(
      newCollateralLendingRate?: null,
      oldCollateralLendingRate?: null
    ): CollateralLendingRateChangedEventFilter;
    CollateralLendingRateChanged(
      newCollateralLendingRate?: null,
      oldCollateralLendingRate?: null
    ): CollateralLendingRateChangedEventFilter;

    "DeltaBandWidthChanged(uint256,uint256)"(
      newDeltaBandWidth?: null,
      oldDeltaBandWidth?: null
    ): DeltaBandWidthChangedEventFilter;
    DeltaBandWidthChanged(
      newDeltaBandWidth?: null,
      oldDeltaBandWidth?: null
    ): DeltaBandWidthChangedEventFilter;

    "FeePerContractChanged(uint256,uint256)"(
      newFeePerContract?: null,
      oldFeePerContract?: null
    ): FeePerContractChangedEventFilter;
    FeePerContractChanged(
      newFeePerContract?: null,
      oldFeePerContract?: null
    ): FeePerContractChangedEventFilter;

    "LongDeltaBorrowRateChanged(uint256,uint256)"(
      newLongDeltaBorrowRate?: null,
      oldLongDeltaBorrowRate?: null
    ): LongDeltaBorrowRateChangedEventFilter;
    LongDeltaBorrowRateChanged(
      newLongDeltaBorrowRate?: null,
      oldLongDeltaBorrowRate?: null
    ): LongDeltaBorrowRateChangedEventFilter;

    "RiskFreeRateChanged(uint256,uint256)"(
      newRiskFreeRate?: null,
      oldRiskFreeRate?: null
    ): RiskFreeRateChangedEventFilter;
    RiskFreeRateChanged(
      newRiskFreeRate?: null,
      oldRiskFreeRate?: null
    ): RiskFreeRateChangedEventFilter;

    "ShortDeltaBorrowRateChanged(uint256,uint256)"(
      newShortDeltaBorrowRate?: null,
      oldShortDeltaBorrowRate?: null
    ): ShortDeltaBorrowRateChangedEventFilter;
    ShortDeltaBorrowRateChanged(
      newShortDeltaBorrowRate?: null,
      oldShortDeltaBorrowRate?: null
    ): ShortDeltaBorrowRateChangedEventFilter;

    "SlippageGradientChanged(uint256,uint256)"(
      newSlippageGradient?: null,
      oldSlippageGradient?: null
    ): SlippageGradientChangedEventFilter;
    SlippageGradientChanged(
      newSlippageGradient?: null,
      oldSlippageGradient?: null
    ): SlippageGradientChangedEventFilter;

    "SlippageGradientMultipliersChanged()"(): SlippageGradientMultipliersChangedEventFilter;
    SlippageGradientMultipliersChanged(): SlippageGradientMultipliersChangedEventFilter;
  };

  estimateGas: {
    addressBook(overrides?: CallOverrides): Promise<BigNumber>;

    authority(overrides?: CallOverrides): Promise<BigNumber>;

    bidAskIVSpread(overrides?: CallOverrides): Promise<BigNumber>;

    callSlippageGradientMultipliers(
      arg0: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    collateralAsset(overrides?: CallOverrides): Promise<BigNumber>;

    collateralLendingRate(overrides?: CallOverrides): Promise<BigNumber>;

    deltaBandWidth(overrides?: CallOverrides): Promise<BigNumber>;

    feePerContract(overrides?: CallOverrides): Promise<BigNumber>;

    getCallSlippageGradientMultipliers(
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getPutSlippageGradientMultipliers(
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    liquidityPool(overrides?: CallOverrides): Promise<BigNumber>;

    longDeltaBorrowRate(overrides?: CallOverrides): Promise<BigNumber>;

    protocol(overrides?: CallOverrides): Promise<BigNumber>;

    putSlippageGradientMultipliers(
      arg0: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    quoteOptionPrice(
      _optionSeries: Types.OptionSeriesStruct,
      _amount: BigNumberish,
      isSell: boolean,
      netDhvExposure: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    riskFreeRate(overrides?: CallOverrides): Promise<BigNumber>;

    setAuthority(
      _newAuthority: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    setBidAskIVSpread(
      _bidAskIVSpread: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    setCollateralLendingRate(
      _collateralLendingRate: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    setDeltaBandWidth(
      _deltaBandWidth: BigNumberish,
      _callSlippageGradientMultipliers: BigNumberish[],
      _putSlippageGradientMultipliers: BigNumberish[],
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    setFeePerContract(
      _feePerContract: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    setLongDeltaBorrowRate(
      _longDeltaBorrowRate: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    setRiskFreeRate(
      _riskFreeRate: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    setShortDeltaBorrowRate(
      _shortDeltaBorrowRate: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    setSlippageGradient(
      _slippageGradient: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    setSlippageGradientMultipliers(
      _callSlippageGradientMultipliers: BigNumberish[],
      _putSlippageGradientMultipliers: BigNumberish[],
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    shortDeltaBorrowRate(overrides?: CallOverrides): Promise<BigNumber>;

    slippageGradient(overrides?: CallOverrides): Promise<BigNumber>;

    strikeAsset(overrides?: CallOverrides): Promise<BigNumber>;

    underlyingAsset(overrides?: CallOverrides): Promise<BigNumber>;
  };

  populateTransaction: {
    addressBook(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    authority(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    bidAskIVSpread(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    callSlippageGradientMultipliers(
      arg0: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    collateralAsset(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    collateralLendingRate(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    deltaBandWidth(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    feePerContract(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    getCallSlippageGradientMultipliers(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getPutSlippageGradientMultipliers(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    liquidityPool(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    longDeltaBorrowRate(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    protocol(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    putSlippageGradientMultipliers(
      arg0: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    quoteOptionPrice(
      _optionSeries: Types.OptionSeriesStruct,
      _amount: BigNumberish,
      isSell: boolean,
      netDhvExposure: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    riskFreeRate(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    setAuthority(
      _newAuthority: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    setBidAskIVSpread(
      _bidAskIVSpread: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    setCollateralLendingRate(
      _collateralLendingRate: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    setDeltaBandWidth(
      _deltaBandWidth: BigNumberish,
      _callSlippageGradientMultipliers: BigNumberish[],
      _putSlippageGradientMultipliers: BigNumberish[],
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    setFeePerContract(
      _feePerContract: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    setLongDeltaBorrowRate(
      _longDeltaBorrowRate: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    setRiskFreeRate(
      _riskFreeRate: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    setShortDeltaBorrowRate(
      _shortDeltaBorrowRate: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    setSlippageGradient(
      _slippageGradient: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    setSlippageGradientMultipliers(
      _callSlippageGradientMultipliers: BigNumberish[],
      _putSlippageGradientMultipliers: BigNumberish[],
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    shortDeltaBorrowRate(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    slippageGradient(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    strikeAsset(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    underlyingAsset(overrides?: CallOverrides): Promise<PopulatedTransaction>;
  };
}
