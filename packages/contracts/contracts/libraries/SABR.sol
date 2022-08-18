pragma solidity >=0.8.0;

import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "prb-math/contracts/PRBMath.sol";

library SABR {
	using PRBMathSD59x18 for int256;

	int256 private constant eps = 1e11;

	function lognormalVol(
		int256 k,
		int256 f,
		int256 t,
		int256 alpha,
		int256 beta,
		int256 rho,
		int256 volvol
	) external pure returns (int256 iv) {
		// Hagan's 2002 SABR lognormal vol expansion.

		// negative strikes or forwards
		if (k <= 0 || f <= 0) {
			return 0;
		}
		int256 logfk = (f.div(k)).ln();
		int256 fkbeta = (f.mul(k)).pow(1e18 - beta);
		int256 a = ((1e18 - beta).pow(2e18)).mul(alpha.pow(2e18)).div(int256(24e18).mul(fkbeta));
		int256 b = int256(25e16).mul(rho).mul(beta).mul(volvol).mul(alpha).div(fkbeta.sqrt());
		int256 c = (2e18 - int256(3e18).mul(rho.pow(2e18))).mul(volvol.pow(2e18)).div(24e18);
		int256 d = fkbeta.sqrt();
		int256 v = ((1e18 - beta).pow(2e18)).mul(logfk.pow(2e18)).div(24e18);
		int256 w = ((1e18 - beta).pow(4e18)).mul(logfk.pow(4e18)).div(1920e18);
		int256 z = volvol.mul(fkbeta.sqrt()).mul(logfk).div(alpha);

		// if |z| > eps
		if (z.abs() > eps) {
			int256 vz = alpha.mul(z).mul(1e18 + (a + b + c).mul(t)).div(d.mul(1e18 + v + w).mul(_x(rho, z)));
			return vz;
			// if |z| <= eps
		} else {
			int256 v0 = alpha.mul(1e18 + (a + b + c).mul(t)).div(d.mul(1e18 + v + w));
			return v0;
		}
	}

	function _x(int256 rho, int256 z) internal pure returns (int256) {
		int256 a = (1e18 - 2 * rho.mul(z) + z.pow(2e18)).sqrt() + z - rho;
		int256 b = 1e18 - rho;
		return (a.div(b)).ln();
	}
}
