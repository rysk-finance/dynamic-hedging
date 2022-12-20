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
    vol *= 1e18
    # encode
    enc = encode_single('uint256', int(vol))
    print("0x" + enc.hex())

def _x(rho, z):
    """Return function x used in Hagan's 2002 SABR lognormal vol expansion."""
    a = (1 - 2 * rho * z + z ** 2) ** .5 + z - rho
    b = 1 - rho
    return np.log(a / b)

def lognormal_vol(k, f, t, alpha, beta, rho, nu):
    """
    Hagan's 2002 SABR lognormal vol expansion.
    :param k: strike. k>0
    :param f: forward. f>0
    :param t: time to expiry, in years. t>0
    :param alpha: Representative of the ATM vol. alpha>0
    :param beta: degree of lognormality. 0 => normal, 1 => lognormal. 0<=beta<=1
    :param rho: volatility-returns correlation. -1<rho<1
    :param nu: volatility of volatility aka vol'o'vol. 0 => pure BlackScholesMerton (flat skew). 0<=nu
    :return: BS vol
    """
    # Negative strikes or forwards
    eps = 1e-07
    logfk = np.log(f / k)
    fkbeta = (f * k) ** (1 - beta)
    a = (1 - beta) ** 2 * alpha ** 2 / (24 * fkbeta)
    b = 0.25 * rho * beta * nu * alpha / fkbeta ** 0.5
    c = (2 - 3 * rho ** 2) * nu ** 2 / 24
    d = fkbeta ** 0.5
    v = (1 - beta) ** 2 * logfk ** 2 / 24
    w = (1 - beta) ** 4 * logfk ** 4 / 1920
    z = nu * fkbeta ** 0.5 * logfk / alpha
    if abs(z) > eps:
        return alpha * z * (1 + (a + b + c) * t) / (d * (1 + v + w) * _x(rho, z))
    else:
        return alpha * (1 + (a + b + c) * t) / (d * (1 + v + w))

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