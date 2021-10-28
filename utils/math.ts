//@ts-nocheck
// credit: https://toolkit.abdk.consulting/math#convert-number

import BN from 'bn.js';

const floatingPointFormats = {
    single: {
        totalWidth: 32,
        mantissaWidth: 23,
        exponentWidth: 8,
        exponentBias: 127
    },
    double: {
        totalWidth: 64,
        mantissaWidth: 52,
        exponentWidth: 11,
        exponentBias: 1023
    },
    quadruple: {
        totalWidth: 128,
        mantissaWidth: 112,
        exponentWidth: 15,
        exponentBias: 16383
    },
    octuple: {
        totalWidth: 256,
        mantissaWidth: 236,
        exponentWidth: 19,
        exponentBias: 262143
    }
};

function toFloatingPoint (sign, numerator, denominator, format) {
    let mantissa, exponent;

    if (numerator.isZero ()) {
        mantissa = new BN (0);
        exponent = 0;
    } else {
        let shift = format.mantissaWidth + 2 - numerator.bitLength () + denominator.bitLength ();

        if (shift > 0) numerator = numerator.shln (shift);
        else if (shift < 0) numerator = numerator.shrn (-shift);

        mantissa = divRound (numerator, denominator);
        const delta = format.mantissaWidth + 1 - mantissa.bitLength ();

        if (delta > 0)
            mantissa = mantissa.shln (delta);
        else if (delta < 0)
            mantissa = mantissa.shrn (-delta);

        shift += delta;

        exponent = format.exponentBias + format.mantissaWidth - shift;
    }

    if (exponent > format.exponentBias * 2) {
        exponent = format.exponentBias * 2 + 1;
        mantissa = new BN (0);
    } else if (exponent < 1) {
        mantissa = mantissa.shrn (1 - exponent);
        exponent = 0;
    } else mantissa = mantissa.maskn (format.mantissaWidth);

    return '0x' + new BN (1).shln (format.totalWidth)
        .add (new BN (sign.isNeg () ? 1 : 0).shln (format.totalWidth - 1))
        .add (new BN (exponent).shln (format.mantissaWidth))
        .add (mantissa).toString (16).substring (1);
}

function divRound (a, b) {
    return a.add (b.shrn (1)).div (b);
}

export function convertDoubleToDec(num, inputVariant = 'quadruple') {
    const plainFormat = 'dec';
    let sign, numerator, denominator, precision;
    const inputLowerCase = num.toLowerCase();
    const match = inputLowerCase.match (/^0x(?<hex>(?:[0-9a-f]{2})*)$/);

    if (!match)
        throw new Error ('Invalid input format');

    const {
        hex
    } = match.groups;

    const format = floatingPointFormats[inputVariant];

    if (hex.length * 4 !== format.totalWidth)
        throw new Error ('Invalid input length');

    const bn = new BN (hex, 16);

    sign = bn.testn (format.totalWidth - 1) ? new BN (-1) : new BN (1);
    const exponent = bn.shrn (format.mantissaWidth).maskn (format.exponentWidth);
    const mantissa = bn.maskn (format.mantissaWidth);

    if (exponent.isZero ()) {
        // Subnormal
        numerator = mantissa;
        precision = numerator.toString ().length + 1;
        denominator = new BN (1).shln (format.exponentBias - 1 + format.mantissaWidth);
    } else if (exponent.eq (new BN (format.exponentBias * 2 + 1))) {
        if (mantissa.isZero ()) {
            // Infinity
            numerator = new BN (1);
        } else {
            // NaN
            numerator = new BN (0);
        }
        denominator = new BN (0);
        precision = 0;
    } else {
        numerator = mantissa.add (new BN (1).shln (format.mantissaWidth));
        precision = numerator.toString ().length + 1;
        denominator = new BN (1).shln (format.mantissaWidth);

        if (exponent.gt (new BN (format.exponentBias)))
            numerator = numerator.shln (exponent.sub (new BN (format.exponentBias)).toNumber ());
        else
            denominator = denominator.shln (new BN (format.exponentBias).sub (exponent).toNumber ());
    }

    if (!denominator.isZero ()) {
        const gcd = numerator.gcd (denominator);
        numerator = numerator.div (gcd);
        denominator = denominator.div (gcd);
    }

    if (denominator.isZero ()) {
        if (numerator.isZero ()) {
            return 'NaN';
        } else if (sign.isNeg ()) {
            return ('-Infinity');
        } else {
            return ('Infinity');
        }
    } else {
        const signSymbol = sign.isNeg () ? '-' : '';

        if (plainFormat === 'dec') {
            const shift = precision - numerator.toString ().length + denominator.toString ().length;
            let value = divRound (numerator.mul (new BN (10).pow (new BN (Math.max (0, shift)))), denominator).toString ();
            if (shift > 0) {
                while (value.length < shift + 1)
                    value = '0' + value;

                value = value.substring (0, value.length - shift) + '.' + value.substring (value.length - shift);

                value = value.replace (/(?:\.0*|(\.[0-9]*[1-9])0+)$/, '$1');
            }
            return (signSymbol + value);
        } else if (plainFormat === 'hex') {
            if (denominator.eq (new BN (1)))
                return (signSymbol + '0x' + numerator.toString (16));
            else return ('');
        } else if (plainFormat === 'bin') {
            if (denominator.eq (new BN (1)))
                return (signSymbol + '0b' + numerator.toString (2));
            else return ('');
        } else if (plainFormat === 'sci') {
            let shift = Math.max (precision, 2) - numerator.toString ().length + denominator.toString ().length;
            shift = Math.max (0, shift);
            let value = divRound (numerator.mul (new BN (10).pow (new BN (shift))), denominator).toString ();
            shift = value === '0' ? 0 : shift - value.length + 1;
            value = value.substring (0, 1) + '.' + value.substring (1);
            if (value.endsWith ('.')) value = value + '0';
            value = value.replace (/(\.[0-9]*[1-9])0+$/, '$1');
            value = value + 'e' + (-shift);
            return (signSymbol + value);
        } else
            throw new Error ('Impossible');
    }
}
