# Beyond Pricer

## General Overview

The Beyond Pricer contains logic for Rysk's option pricing. It prices the options using the
Black-Scholes model and applies slippage, a spread, and fees to the Black-Scholes quote based on the
state of the protocol.

## Function by function

### `quoteOptionPrice(Types.OptionSeries memory _optionSeries, uint256 _amount, bool isSell, int256 netDhvExposure)` **_Access Controlled_**

This is the entry point of thhe contract for obtaining a quote (denominated in the strike asset) of
an order, as well as the total delta exposure of the options in the order and fees applied to the
order. The function first obtains an IV value to price the option at from our Volatility Feed
contract, then returns a "vanilla" Black-Scholes quote for the option series using that IV.

A slippage multiplier value is obtained from the internal function `_getslippageMultiplier()` which
the vanilla price is multiplied by. This function is explained below. A spread premium is then added
to the final order amount if the order is a buy order (meaning the DHV is selling those options).
This is obtained from the internal function `_getSpreadValue()`.

### `getSlippageMultiplier(int256 _amount, int256 _optionDelta, int256 _netDhvExposure, bool _isSell)` **_Access Controlled_**

This function returns a value that can be above or below 1, which is applied as a factor to the
vanilla BS price. Slippage serves a couple of purposes; firstly, it disincentivises traders to buy
or sell options that the DHV is already heavily exposed to, mitigating and spreading out our risk.
It also allows governance to set discreet coefficients for the base of the exponential function for
different option delta values. As an example, far OTM options earn the DHV a much smaller premium
but require similar collateral requirements to the ATM equivalent option. It is undesirable for the
DHV to sell many of these options and so we can set the slippage function to be much more severe on
the wings.

The slippage function takes the form `(1 + g)^ -x`, where g is the slippageGradient after it has
been modified by the delta band multipliers and x is the net exposure to the particular option
series. X is positive if the DHV is net long on that series and negative if it is net short.

`slippageGradient` is a gov controlled variable that determines how steep the exponential function
is. It will be set to a small number, for example 0.01e18, and then modified before being plugged
into the equation. The modification is obtained by taking the delta value of the option and dividing
it by `deltaBandWidth` and looking up a factor to multiply `slippageGradient` in the
`callSlippageGradientMultipliers` or `putSlippageGradientMultipliers` array in the resulting index.

To ensure the slippage function is applied fairly as `x` changes within the transaction, the
function is integrated between the bounds of the `x` value at the start of the tx and the `x` value
as a result of the tx to fund the area under the curve, which is then divided by the amount of
options being sold.

### `getSpreadValue(Types.OptionSeries memory _optionSeries, uint256 _amount, int256 _optionDelta, int256 _netDhvExposure, uint256 _underlyingPrice)` **_Access Controlled_**

The spread function is only applied to options the DHV sells and reflects the cost of the collateral
required to back the short option, as well as delta hedging costs incurred by the DHV as a result of
the delta exposure of the tx.

The cost of collateral postion of the spread is calculated as `c * (1 + r)^t -c` where c is the
collateral requirements of the short options, t is the duration of the option in years, and r the
collateral lending rate (governance settable variable). It is only applied to contracts that result
in a net short position for the DHV. For example, if the DHV is long 10 contracts of this particular
series and someone is requesting to purchase 30 of the same series from the DHV, the
`collateralLendingPremium` is only calculated from the 20 options that the DHV would be net short.

The `deltaHedgingPremium` part of the spread is calculated as `d * (1 * r)^t -d` where d is the
dollar delta of the position, t is option duration in years, and r is the long or short delta borrow
rate (gov settable variables used to reflect the cost of borrowing delta exposure in other markets).
The spread is calculated based on the whole position and so is added to the final total quote for
the position, not applied to each contract individually.
