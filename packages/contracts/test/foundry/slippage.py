import numpy as np
from eth_abi import encode_single
import argparse
import math

def main(args): 
    if (args.isNetDhvExposureNegative == 1):
        net_dhv_exposure = -args.netDhvExposure
    else:
        net_dhv_exposure = args.netDhvExposure
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
        args.slippageGradientMultiplier / 1e18
    ) * 1e18
    # encode
    enc = encode_single('uint256', int(slippage_multiplier))
    print("0x" + enc.hex())

def get_slippage_multiplier(amount: float, net_dhv_exposure: float, is_sell: bool, slippage_gradient: float, slippage_gradient_multiplier: float):
    """
    Get the slippage multiplier that is multiplied against the vanilla premium to give a value for slippage.
    https://www.notion.so/rysk/Slippage-0fc09ef21df747668d8c3d7ffb22226d#5c2a4b076ba244a9b7c625fc95fc21b9

    :param: amount - the number of option contracts being bought or sold
    :param: net_dhv_exposure - exposure of the dhv, negative if is short, positive if long
    :param: is_sell - is the user selling or buying this option from the dhv
    :param: slippage_gradient - the base slippage gradient
    :param: slippage_gradient_multiplier - the multiplier applied to the slippage gradient (handled externally for this function but would usually depend on delta)
    """
    if (is_sell):
        new_exposure_exponent = net_dhv_exposure + amount
    else:
        new_exposure_exponent = net_dhv_exposure - amount
    old_exposure_exponent = net_dhv_exposure
    modified_slippage_gradient = slippage_gradient * slippage_gradient_multiplier
    if slippage_gradient == 0:
        return 1
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
    parser.add_argument("--slippageGradientMultiplier", type=int)
    return parser.parse_args()

if __name__ == '__main__':
    args = parse_args() 
    main(args)