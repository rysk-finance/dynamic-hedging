// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "prb-math/contracts/PRBMath.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";

import "hardhat/console.sol";

library SABR {
	using PRBMathSD59x18 for int256;

	int256 private constant eps = 1e11;

	struct IntermediateVariables {
		int256 a;
		int256 b;
		int256 c;
		int256 d;
		int256 v;
		int256 w;
		int256 z;
		int256 k;
		int256 f;
		int256 t;
	}

	function lognormalVol(
		int256 k,
		int256 f,
		int256 t,
		int256 alpha,
		int256 beta,
		int256 rho,
		int256 volvol
	) external view returns (int256 iv) {
		// Hagan's 2002 SABR lognormal vol expansion.

		// negative strikes or forwards
		if (k <= 0 || f <= 0) {
			return 0;
		}

		IntermediateVariables memory vars;

		vars.k = k;
		vars.f = f;
		vars.t = t;
		if (beta == 1e18) {
			vars.a = 0;
			vars.v = 0;
			vars.w = 0;
		} else {
			vars.a = ((1e18 - beta).pow(2e18)).mul(alpha.pow(2e18)).div(
				int256(24e18).mul(_fkbeta(vars.f, vars.k, beta))
			);
			vars.v = ((1e18 - beta).pow(2e18)).mul(_logfk(vars.f, vars.k).pow(2e18)).div(24e18);
			vars.w = ((1e18 - beta).pow(4e18)).mul(_logfk(vars.f, vars.k).pow(4e18)).div(1920e18);
		}
		vars.b = int256(25e16).mul(rho).mul(beta).mul(volvol).mul(alpha).div(
			_fkbeta(vars.f, vars.k, beta).sqrt()
		);
		vars.c = (2e18 - int256(3e18).mul(rho.powu(2))).mul(volvol.pow(2e18)).div(24e18);
		vars.d = _fkbeta(vars.f, vars.k, beta).sqrt();
		vars.z = volvol.mul(_fkbeta(vars.f, vars.k, beta).sqrt()).mul(_logfk(vars.f, vars.k)).div(alpha);

		// if |z| > eps
		if (vars.z.abs() > eps) {
			int256 vz = alpha.mul(vars.z).mul(1e18 + (vars.a + vars.b + vars.c).mul(vars.t)).div(
				vars.d.mul(1e18 + vars.v + vars.w).mul(_x(rho, vars.z))
			);
			return vz;
			// if |z| <= eps
		} else {
			int256 v0 = alpha.mul(1e18 + (vars.a + vars.b + vars.c).mul(vars.t)).div(
				vars.d.mul(1e18 + vars.v + vars.w)
			);
			return v0;
		}
	}

	function _logfk(int256 f, int256 k) internal pure returns (int256) {
		return (f.div(k)).ln();
	}

	function _fkbeta(
		int256 f,
		int256 k,
		int256 beta
	) internal pure returns (int256) {
		return (f.mul(k)).pow(1e18 - beta);
	}

	function _x(int256 rho, int256 z) internal view returns (int256) {
		int256 a = (1e18 - 2 * rho.mul(z) + z.powu(2)).sqrt() + z - rho;
		int256 b = 1e18 - rho;
		return (a.div(b)).ln();
	}
}
