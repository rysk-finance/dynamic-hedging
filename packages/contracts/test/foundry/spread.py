import numpy as np
from eth_abi import encode
import argparse
import math

from decimal import Decimal

call_multipliers_1 = [
			Decimal(1.0),
			Decimal(1.1),
			Decimal(1.2),
			Decimal(1.3),
			Decimal(1.4),
		]

put_multipliers_1 = [
			Decimal(1.1),
			Decimal(1.2),
			Decimal(1.3),
			Decimal(1.4),
			Decimal(1.5),
		]
call_multipliers_2 = [
			Decimal(2.0),
			Decimal(2.1),
			Decimal(2.2),
			Decimal(2.3),
			Decimal(2.4),
		]

put_multipliers_2 = [
			Decimal(2.1),
			Decimal(2.2),
			Decimal(2.3),
			Decimal(2.4),
			Decimal(2.5),
		]
tenor_multipliers = [
    [call_multipliers_1, put_multipliers_1, call_multipliers_1, put_multipliers_1, call_multipliers_1, put_multipliers_1],
    [call_multipliers_2, put_multipliers_2, call_multipliers_2, put_multipliers_2, call_multipliers_2, put_multipliers_2],
    [call_multipliers_1, put_multipliers_1, call_multipliers_1, put_multipliers_1, call_multipliers_1, put_multipliers_1]]
delta_band_width = Decimal(20)
max_tenor_value = 2800
number_of_tenors = 3

# TODO: allow rates to be negative
def main(args): 
    if (args.isNetDhvExposureNegative == 1):
        net_dhv_exposure = -args.netDhvExposure
    else:
        net_dhv_exposure = args.netDhvExposure
    if (args.isDeltaNegative == 1):
        delta = -args.delta
    else:
        delta = args.delta
    if args.isSell == 1:
        is_sell = True
    else:
        is_sell = False
    # convert values to numbers from decimals
    spread = get_spread(
        Decimal(args.amount) / Decimal(1e18),
        Decimal(net_dhv_exposure) / Decimal(1e18),
        is_sell,
        Decimal(delta) / Decimal(1e18),
        Decimal(args.time) / Decimal(1e18),
        Decimal(args.marginRequirementPerContract) / Decimal(1e18),
        Decimal(args.collatLendingRate) / Decimal(1e6),
        Decimal(args.sellLongRate) / Decimal(1e6),
        Decimal(args.sellShortRate) / Decimal(1e6),
        Decimal(args.buyLongRate) / Decimal(1e6),
        Decimal(args.buyShortRate) / Decimal(1e6),
        Decimal(args.underlyingPrice) / Decimal(1e18),
        args.expiration, 
        args.timestamp
        ) * Decimal(1e18)
    # encode
    enc = encode(['uint256'], [int(spread)])
    print("0x" + enc.hex())

def get_spread(
        amount: float, 
        net_dhv_exposure: float, 
        is_sell: bool, 
        delta: float,
        time: float,
        margin_requirement_per_contract: float,
        collat_lending_rate: float,
        sell_long_rate: float,
        sell_short_rate: float,
        buy_long_rate: float,
        buy_short_rate: float,
        underlying_price: float,
        expiration: float,
        timestamp: float
        ):
    spread = 0
    tenor_index, remainder = get_tenor_index(expiration, timestamp)
    if (not is_sell):
        net_short_contracts = 0
        if (net_dhv_exposure <= 0):
            net_short_contracts = amount
        else:
            if (amount - net_dhv_exposure < 0):
                net_short_contracts = 0
            else:
                net_short_contracts = amount - net_dhv_exposure
        margin_requirement = margin_requirement_per_contract * net_short_contracts
        spread = get_collat_spread(time, margin_requirement, collat_lending_rate, delta, tenor_index, remainder)
    spread += get_delta_spread(time, is_sell, sell_long_rate, sell_short_rate, buy_long_rate, buy_short_rate, delta, amount, underlying_price, tenor_index, remainder)
    return spread

def get_collat_spread(
    time: float,
    margin_requirement: float,
    collat_lending_rate: float,
    delta: float,
    tenor_index: float,
    remainder: float
):
    """
    get the collateral lending rate for a given trade

    :param: time - duration of option remaining in years
    :param: margin_requirement - the collateral requirement for the option
    :param: collat_lending_rate - the lending rate used for collateral
    :param: delta - delta of an option
    """
    spread = (margin_requirement * ((1 + collat_lending_rate) ** (time))) - margin_requirement
    delta_band_index = int((abs(delta) * 100) // delta_band_width)
    
    if (delta < 0):
        spread = spread * interpolate_collateral(tenor_index, remainder, True, delta_band_index)
    else:
        spread = spread * interpolate_collateral(tenor_index, remainder, False, delta_band_index)
    return spread


def get_delta_spread(
    time: float,
    is_sell: bool,
    sell_long_rate: float,
    sell_short_rate: float,
    buy_long_rate: float,
    buy_short_rate: float,
    option_delta: float,
    amount: float,
    underlying_price: float,
    tenor_index: float,
    remainder: float
):
    """
    get the delta spread for a given trade

    :param: time - duration of option remaining in years
    :param: is_sell - is the option being sold to the DHV?
    :param: sell_long_rate - the rate when someone sells puts to DHV (we need to long to hedge)
    :param: sell_short_rate - the rate when someone sells calls to DHV (we need to short to hedge)
    :param: buy_long_rate - the rate when someone buys calls from DHV (we need to long to hedge)
    :param: buy_short_rate - the rate when someone buys puts from DHV (we need to short to hedge)
    :param: option_delta - the delta of a single option (instrument delta, i.e. assume always long)
    :param: amount - amount to trade
    :param: underlying_price - the price of spot
    """
    dollar_delta = abs(option_delta) * amount * underlying_price
    if (option_delta < 0):
        if is_sell:
            delta_rate = sell_long_rate
        else:
            delta_rate = buy_short_rate
        delta_premium = (
            dollar_delta * ((1 + delta_rate) ** time)) - dollar_delta
    else:
        if is_sell:
            delta_rate = sell_short_rate
        else:
            delta_rate = buy_long_rate
        delta_premium = (
            dollar_delta * ((1 + delta_rate) ** time)) - dollar_delta
    delta_band_index = int((abs(option_delta) * 100) // delta_band_width)
    if (option_delta < 0):
        delta_premium = delta_premium * interpolate_delta(tenor_index, remainder, True, delta_band_index)
    else:
        delta_premium = delta_premium * interpolate_delta(tenor_index, remainder, False, delta_band_index)
    return delta_premium

def interpolate_collateral(tenor_index: float, remainder: float, is_put: bool, delta_band_index: float):
    if (is_put):
        y_1 = tenor_multipliers[tenor_index][3][delta_band_index]
        y_2 = tenor_multipliers[tenor_index + 1][3][delta_band_index]
    else:
        y_1 = tenor_multipliers[tenor_index][2][delta_band_index]
        y_2 = tenor_multipliers[tenor_index + 1][2][delta_band_index]
    return y_1 + (Decimal(remainder) * (y_2 - y_1))


def interpolate_delta(tenor_index: float, remainder: float, is_put: bool, delta_band_index: float):
    if (is_put):
        y_1 = tenor_multipliers[tenor_index][5][delta_band_index]
        y_2 = tenor_multipliers[tenor_index + 1][5][delta_band_index]
    else:
        y_1 = tenor_multipliers[tenor_index][4][delta_band_index]
        y_2 = tenor_multipliers[tenor_index + 1][4][delta_band_index]
    return y_1 + (Decimal(remainder) * (y_2 - y_1))

def get_tenor_index(expiration: float, timestamp: float):
    unrounded_index = (math.sqrt(expiration - timestamp)  * (number_of_tenors - 1)) / max_tenor_value
    tenor_index = math.floor(unrounded_index)
    remainder = unrounded_index - tenor_index
    return tenor_index, remainder

def parse_args(): 
    parser = argparse.ArgumentParser()
    parser.add_argument("--amount", type=int)
    parser.add_argument("--netDhvExposure", type=int)
    parser.add_argument("--isNetDhvExposureNegative", type=int)
    parser.add_argument("--isSell", type=int)
    parser.add_argument("--delta", type=int)
    parser.add_argument("--isDeltaNegative", type=int)
    parser.add_argument("--marginRequirementPerContract", type=int)
    parser.add_argument("--collatLendingRate", type=int)
    parser.add_argument("--sellLongRate", type=int)
    parser.add_argument("--sellShortRate", type=int)
    parser.add_argument("--buyLongRate", type=int)
    parser.add_argument("--buyShortRate", type=int)
    parser.add_argument("--underlyingPrice", type=int)
    parser.add_argument("--time", type=int)
    parser.add_argument("--expiration", type=int)
    parser.add_argument("--timestamp", type=int)
    return parser.parse_args()

if __name__ == '__main__':
    args = parse_args() 
    main(args)

# to run locally use: 
# --amount 10000000000000000000 --netDhvExposure 100000000000000000000 --isNetDhvExposureNegative 0 --isSell 1 --slippageGradient 10000000000000000 --delta 500000000000000000 --isDeltaNegative 0