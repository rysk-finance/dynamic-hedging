import numpy as np
from eth_abi import encode_single
import argparse
import math

def main(args): 
    # convert expiration to dte
    dte = (args.expiration - args.now) / 31557600
    if args.isRhoNegative == 1:
        rho = -args.rho
    else:
        rho = args.rho
    if args.isInterestRateNegative == 1:
        interestRate = -args.interestRate
    else:
        interestRate = args.interestRate
    # convert spot to forward
    f = (args.f / 1e18) *  math.exp((interestRate / 1e18) * dte)
    # calculate vol
    vol = lognormal_vol(
        args.k / 1e18, 
        f, 
        dte,
        args.alpha / 1e6,
        args.beta / 1e6,
        rho / 1e6,
        args.nu / 1e6
        )
    # convert values to numbers from decimals
    premium *= 1e6
    # encode
    enc = encode_single('uint256', int(vol))
    print("0x" + enc.hex())

def parse_args(): 
    parser = argparse.ArgumentParser()
    parser.add_argument("--k", type=int)
    parser.add_argument("--f", type=int)
    parser.add_argument("--expiration", type=int)
    parser.add_argument("--now", type=int)
    parser.add_argument("--alpha", type=int)
    parser.add_argument("--beta", type=int)
    parser.add_argument("--rho", type=int)
    parser.add_argument("--nu", type=int)
    parser.add_argument("--isRhoNegative", type=int)
    parser.add_argument("--interestRate", type=int)
    parser.add_argument("--isInterestRateNegative", type=int)

    return parser.parse_args()

if __name__ == '__main__':
    args = parse_args() 
    main(args)