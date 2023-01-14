import numpy as np
from eth_abi import encode_single
import argparse
import math

call_slippage_gradient_multipliers = [
			1,
			1.1,
			1.2,
			1.3,
			1.4,
			1.5,
			1.6,
			1.7,
			1.8,
			1.9,
			2.0,
			2.1,
			2.2,
			2.3,
			2.4,
			2.5,
			2.6,
			2.7,
			2.8,
			2.9
		]

put_slippage_gradient_multipliers = [
			1,
			1.1,
			1.2,
			1.3,
			1.4,
			1.5,
			1.6,
			1.7,
			1.8,
			1.9,
			2.0,
			2.1,
			2.2,
			2.3,
			2.4,
			2.5,
			2.6,
			2.7,
			2.8,
			2.9
		]
delta_band_width = 5

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
        args.amount / 1e18,
        net_dhv_exposure / 1e18,
        is_sell,
        args.slippageGradient / 1e18,
        delta / 1e18
    ) * 1e18
    # encode
    enc = encode_single('uint256', int(slippage_multiplier))
    print("0x" + enc.hex())

def get_slippage_multiplier(amount: float, net_dhv_exposure: float, is_sell: bool, slippage_gradient: float, delta: float):
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
    delta_band_index = int((abs(delta) * 100) // delta_band_width)
    if (delta > 0):
        modified_slippage_gradient = slippage_gradient * call_slippage_gradient_multipliers[delta_band_index]
    else:
        modified_slippage_gradient = slippage_gradient * put_slippage_gradient_multipliers[delta_band_index]
    slippage_factor = 1 + modified_slippage_gradient
    if(is_sell):
        slippage_multiplier = (((slippage_factor ** -old_exposure_exponent) - (slippage_factor ** -new_exposure_exponent))/math.log(slippage_factor)) / amount
    else:
        slippage_multiplier = (((slippage_factor ** -new_exposure_exponent) - (slippage_factor ** -old_exposure_exponent))/math.log(slippage_factor)) / amount
    return slippage_multiplier

def parse_args(): 
    parser = argparse.ArgumentParser()
    parser.add_argument("--amount", type=int)
    parser.add_argument("--netDhvExposure", type=int)
    parser.add_argument("--isNetDhvExposureNegative", type=int)
    parser.add_argument("--isSell", type=int)
    parser.add_argument("--slippageGradient", type=int)
    parser.add_argument("--delta", type=int)
    parser.add_argument("--isDeltaNegative", type=int)
    return parser.parse_args()

if __name__ == '__main__':
    args = parse_args() 
    main(args)

# to run locally use: 
# --amount 10000000000000000000 --netDhvExposure 100000000000000000000 --isNetDhvExposureNegative 0 --isSell 1 --slippageGradient 10000000000000000 --delta 500000000000000000 --isDeltaNegative 0