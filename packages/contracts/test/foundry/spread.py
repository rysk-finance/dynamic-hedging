import numpy as np
from eth_abi import encode_single
import argparse
import math

from decimal import Decimal

call_spread_multipliers = [
			Decimal(1.0),
			Decimal(1.1),
			Decimal(1.2),
			Decimal(1.3),
			Decimal(1.4),
			Decimal(1.5),
			Decimal(1.6),
			Decimal(1.7),
			Decimal(1.8),
			Decimal(1.9),
			Decimal(2.0),
			Decimal(2.1),
			Decimal(2.2),
			Decimal(2.3),
			Decimal(2.4),
			Decimal(2.5),
			Decimal(2.6),
			Decimal(2.7),
			Decimal(2.8),
			Decimal(2.9)
		]

put_spread_multipliers = [
			Decimal(1.0),
			Decimal(1.1),
			Decimal(1.2),
			Decimal(1.3),
			Decimal(1.4),
			Decimal(1.5),
			Decimal(1.6),
			Decimal(1.7),
			Decimal(1.8),
			Decimal(1.9),
			Decimal(2.0),
			Decimal(2.1),
			Decimal(2.2),
			Decimal(2.3),
			Decimal(2.4),
			Decimal(2.5),
			Decimal(2.6),
			Decimal(2.7),
			Decimal(2.8),
			Decimal(2.9)
		]
delta_band_width = Decimal(5)
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
        Decimal(args.underlyingPrice) / Decimal(1e18)
        ) * Decimal(1e18)
    # encode
    enc = encode_single('uint256', int(spread))
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
        underlying_price: float
        ):
    spread = 0
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
        spread = get_collat_spread(time, margin_requirement, collat_lending_rate)
    spread += get_delta_spread(time, is_sell, sell_long_rate, sell_short_rate, buy_long_rate, buy_short_rate, delta, amount, underlying_price)
    spread = get_spread_multiplier(spread, delta)
    return spread

def get_collat_spread(
    time: float,
    margin_requirement: float,
    collat_lending_rate: float
):
    """
    get the collateral lending rate for a given trade

    :param: time - duration of option remaining in years
    :param: margin_requirement - the collateral requirement for the option
    :param: collat_lending_rate - the lending rate used for collateral
    """
    return (margin_requirement * ((1 + collat_lending_rate) ** (time))) - margin_requirement


def get_delta_spread(
    time: float,
    is_sell: bool,
    sell_long_rate: float,
    sell_short_rate: float,
    buy_long_rate: float,
    buy_short_rate: float,
    option_delta: float,
    amount: float,
    underlying_price: float
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
    return delta_premium

def get_spread_multiplier(spread, delta):
    delta_band_index = int((abs(delta) * 100) // delta_band_width)
    if (delta > 0):
        modified_spread = spread * call_spread_multipliers[delta_band_index]
    else:
        modified_spread = spread * put_spread_multipliers[delta_band_index]
    return modified_spread


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
    return parser.parse_args()

if __name__ == '__main__':
    args = parse_args() 
    main(args)

# to run locally use: 
# --amount 10000000000000000000 --netDhvExposure 100000000000000000000 --isNetDhvExposureNegative 0 --isSell 1 --slippageGradient 10000000000000000 --delta 500000000000000000 --isDeltaNegative 0