pragma solidity >=0.6.8 <0.7.0;
import "./ABDKMathQuad.sol";

library NormalDist {
    using ABDKMathQuad for uint256;
    using ABDKMathQuad for bytes16;
    using ABDKMathQuad for int256;
    using ABDKMathQuad for int8;

    bytes16 private constant ONE = 0x3fff0000000000000000000000000000;
    bytes16 private constant ONE_HALF = 0x3ffe0000000000000000000000000000;
    bytes16 private constant SQRT_TWO = 0x3fff6a09e667f3bcc908b2fb1366ea95;
    // z-scores
    // A1 0.254829592
    bytes16 private constant A1 = 0x3ffd04f20c6ec5a7e1d33b9e3328c3ba;
    // A2 -0.284496736
    bytes16 private constant A2 = 0xbffd23531cc3c14697fb1a2352fc8d6a;
    // A3 1.421413741
    bytes16 private constant A3 = 0x3fff6be1c55bae156b65ee6034370310;
    // A4 -1.453152027
    bytes16 private constant A4 = 0xbfff7401c57014c38f140d30c8a85881;
    // A5 1.061405429
    bytes16 private constant A5 = 0x3fff0fb844255a12d72e60ccafacbc9d;
    // P 0.3275911
    bytes16 private constant P = 0x3ffd4f740a93d7b8b91991a17d93a995;

    // use this function to sanity check
    function stdNormCDF(uint256 x) public pure returns(uint256) {
        bytes16 result = cdf(x.fromUInt());
        return result.mul(uint256(10000000000000000).fromUInt()).toUInt();
    }

    function cdf(bytes16 x) public pure returns(bytes16) {
        bytes16 phiParam = x.div(SQRT_TWO);
        bytes16 onePlusPhi = ONE.add(phi(phiParam));
        return ONE_HALF.mul(onePlusPhi);
    }

    function phi(bytes16 x) internal pure returns(bytes16) {
        int8 sign = x.sign();
        bytes16 abs = x.abs();

        // A&S formula 7.1.26
        bytes16 t = ONE.div(ONE.add(P.mul(abs)));
        bytes16 scoresByT = getScoresFromT(t);
        bytes16 eToXs = abs.neg().mul(abs).exp();
        bytes16 y = ONE.sub(scoresByT.mul(eToXs));
        return sign.fromInt().mul(y);
    }

    function getScoresFromT(bytes16 t) internal pure returns(bytes16) {
        bytes16 byA5T = A5.mul(t);
        bytes16 byA4T = byA5T.add(A4).mul(t);
        bytes16 byA3T = byA4T.add(A3).mul(t);
        bytes16 byA2T = byA3T.add(A2).mul(t);
        bytes16 byA1T = byA2T.add(A1).mul(t);
        return byA1T;
    }
}
