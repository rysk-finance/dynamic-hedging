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
    slippage_multiplier = get_slippage_multiplier(
        Decimal(args.amount) / Decimal(1e18),
        Decimal(net_dhv_exposure) / Decimal(1e18),
        is_sell,
        Decimal(args.slippageGradient) / Decimal(1e18),
        Decimal(delta) / Decimal(1e18),
        args.timestamp,
        args.expiration
    ) * Decimal(1e18)
    # encode
    enc = encode(['uint256'], [int(slippage_multiplier)])
    print("0x" + enc.hex())

def get_slippage_multiplier(amount: float, net_dhv_exposure: float, is_sell: bool, slippage_gradient: float, delta: float, timestamp: float, expiration: float):
    """
    Get the slippage multiplier that is multiplied against the vanilla premium to give a value for slippage.
    https://www.notion.so/rysk/Slippage-0fc09ef21df747668d8c3d7ffb22226d#5c2a4b076ba244a9b7c625fc95fc21b9

    :param: amount - the number of option contracts being bought or sold
    :param: net_dhv_exposure - exposure of the dhv, negative if is short, positive if long
    :param: is_sell - is the user selling or buying this option from the dhv
    :param: slippage_gradient - the base slippage gradient
    :param: delta - delta of the option
    """
    if (is_sell):
        new_exposure_exponent = net_dhv_exposure + amount
    else:
        new_exposure_exponent = net_dhv_exposure - amount
    old_exposure_exponent = net_dhv_exposure
    if slippage_gradient == 0:
        return 1
    tenor_index, remainder = get_tenor_index(expiration, timestamp)
    delta_band_index = int((abs(delta) * 100) // delta_band_width)
    if (delta < 0):
        modified_slippage_gradient = slippage_gradient * interpolate(tenor_index, remainder, True, delta_band_index)
    else:
        modified_slippage_gradient = slippage_gradient * interpolate(tenor_index, remainder, False, delta_band_index)
    slippage_factor = 1 + modified_slippage_gradient
    if(is_sell):
        slippage_multiplier = (((slippage_factor ** -old_exposure_exponent) - (slippage_factor ** -new_exposure_exponent))/Decimal(math.log(slippage_factor))) / amount
    else:
        slippage_multiplier = (((slippage_factor ** -new_exposure_exponent) - (slippage_factor ** -old_exposure_exponent))/Decimal(math.log(slippage_factor))) / amount
    return slippage_multiplier

def interpolate(tenor_index: float, remainder: float, is_put: bool, delta_band_index: float):
    if (is_put):
        y_1 = tenor_multipliers[tenor_index][1][delta_band_index]
        y_2 = tenor_multipliers[tenor_index + 1][1][delta_band_index]
    else:
        y_1 = tenor_multipliers[tenor_index][0][delta_band_index]
        y_2 = tenor_multipliers[tenor_index + 1][0][delta_band_index]
    return y_1 + (Decimal(remainder) * (y_2 - y_1))

def get_tenor_index(expiration: float, timestamp: float):
    unrounded_index = (math.sqrt(expiration - timestamp)  * (number_of_tenors - 1)) / max_tenor_value
    tenor_index = round(unrounded_index)
    remainder = unrounded_index - tenor_index
    return tenor_index, remainder
    

def parse_args(): 
    parser = argparse.ArgumentParser()
    parser.add_argument("--amount", type=int)
    parser.add_argument("--netDhvExposure", type=int)
    parser.add_argument("--isNetDhvExposureNegative", type=int)
    parser.add_argument("--isSell", type=int)
    parser.add_argument("--slippageGradient", type=int)
    parser.add_argument("--delta", type=int)
    parser.add_argument("--isDeltaNegative", type=int)
    parser.add_argument("--timestamp", type=int)
    parser.add_argument("--expiration", type=int)
    return parser.parse_args()

if __name__ == '__main__':
    args = parse_args() 
    main(args)

# to run locally use: 
# --amount 10000000000000000000 --netDhvExposure 100000000000000000000 --isNetDhvExposureNegative 0 --isSell 1 --slippageGradient 10000000000000000 --delta 500000000000000000 --isDeltaNegative 0