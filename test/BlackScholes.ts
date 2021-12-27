import { ethers } from "hardhat";
import { BigNumberish, Contract, ContractFactory, utils } from "ethers";
import {MockProvider} from '@ethereum-waffle/provider';
import {
    toWei,
    truncate,
    tFormatEth,
    CALL,
    PUT,
    genOptionTime,
    sample,
    percentDiff
} from '../utils';
import moment from "moment";
//@ts-ignore
import bs from "black-scholes";
//@ts-ignore
import greeks from "greeks";
import { expect } from "chai";
import { BlackScholes as IBlackScholes } from "../types/BlackScholes";
import { BlackScholesTest as IBlackScholesTest } from "../types/BlackScholesTest";

describe("Pricing options", function() {
    let BlackScholes: IBlackScholes;
    let BlackScholesTest: IBlackScholesTest;

    it("Should deploy Black Scholes library", async function() {
        const abdkMathFactory = await ethers.getContractFactory("ABDKMathQuad");
        const abdkMathDeploy = await abdkMathFactory.deploy();
        const normDistFactory = await ethers.getContractFactory("NormalDist", {
          libraries: {
            ABDKMathQuad: abdkMathDeploy.address
          }
        });
        const normDist = await normDistFactory.deploy();
        const bsFactory = await ethers.getContractFactory(
            "BlackScholes",
            {
                libraries: {
                    NormalDist: normDist.address,
                    ABDKMathQuad: abdkMathDeploy.address
                }
            }
        );
        const blackScholes = await bsFactory.deploy() as IBlackScholes;
        BlackScholes = blackScholes;
        const bsTestFactory = await ethers.getContractFactory("BlackScholesTest", {
            libraries: {
                BlackScholes: BlackScholes.address
            }
        });
        BlackScholesTest = await bsTestFactory.deploy() as IBlackScholesTest;
    });

    it("correctly prices in the money call with a one year time to expiration", async function() {
        const strike = toWei('250');
        const price = toWei('300');
        const now: moment.Moment = moment();
        const oneYear = moment(now).add(12, 'M');
        const time = genOptionTime(now, oneYear);
        const vol = 15;
        const rfr = 3;
        const localBS = bs.blackScholes(300, 250, time, .15, .03, "call");
        const contractBS = await BlackScholesTest.retBlackScholesCalc(price, strike, oneYear.unix(), vol, rfr, CALL);
        expect(truncate(localBS)).to.eq(tFormatEth(contractBS));
    });

    it("correctly  prices out of the money call with one year time", async () => {
        const strike = toWei('350');
        const price = toWei('300');
        const now: moment.Moment = moment();
        const oneYear = moment(now).add(12, 'M');
        const time = genOptionTime(now, oneYear);
        const vol = 15;
        const rfr = 3;
        const localBS = bs.blackScholes(300, 350, time, .15, .03, "call");
        const contractBS = await BlackScholesTest.retBlackScholesCalc(price, strike, oneYear.unix(), vol, rfr, CALL);
        expect(truncate(localBS)).to.eq(tFormatEth(contractBS));
    });

    it("correctly prices out of the money call with one year time high volatility", async () => {
        const strike = toWei('350');
        const price = toWei('300');
        const now: moment.Moment = moment();
        const oneYear = moment(now).add(12, 'M');
        const time = genOptionTime(now, oneYear);
        const vol = 150;
        const rfr = 3;
        const localBS = bs.blackScholes(300, 350, time, 1.5, .03, "call");
        const contractBS = await BlackScholesTest.retBlackScholesCalc(price, strike, oneYear.unix(), vol, rfr, CALL);
        expect(truncate(localBS)).to.eq(tFormatEth(contractBS));
    });

    it("correctly prices in the money call with one month expiration high volatility", async () => {
        const strike = toWei('250');
        const price = toWei('300');
        const now: moment.Moment = moment();
        const oneYear = moment(now).add(12, 'M');
        const time = genOptionTime(now, oneYear);
        const vol = 150;
        const rfr = 3;
        const localBS = bs.blackScholes(300, 250, time, 1.5, .03, "call");
        const contractBS = await BlackScholesTest.retBlackScholesCalc(price, strike, oneYear.unix(), vol, rfr, CALL);
        expect(truncate(localBS)).to.eq(tFormatEth(contractBS));
    });

    it("correctly prices in the money put with one year time", async () => {
        const strike = toWei('250');
        const price = toWei('200');
        const now: moment.Moment = moment();
        const oneYear = moment(now).add(12, 'M');
        const time = genOptionTime(now, oneYear);
        const vol = 15;
        const rfr = 3;
        const localBS = bs.blackScholes(200, 250, time, .15, .03, "put");
        const contractBS = await BlackScholesTest.retBlackScholesCalc(price, strike, oneYear.unix(), vol, rfr, PUT);
        expect(truncate(localBS)).to.eq(tFormatEth(contractBS));
    });

    it('correctly prices in the money put with one year time high volatility', async () => {
        const strike = toWei('250');
        const price = toWei('200');
        const now: moment.Moment = moment();
        const oneYear = moment(now).add(12, 'M');
        const time = genOptionTime(now, oneYear);
        const vol = 150;
        const rfr = 3;
        const localBS = bs.blackScholes(200, 250, time, 1.5, .03, "put");
        const contractBS = await BlackScholesTest.retBlackScholesCalc(price, strike, oneYear.unix(), vol, rfr, PUT);
        expect(truncate(localBS)).to.eq(tFormatEth(contractBS));
    });

    it('correctly prices in the money put with one month time high volatility', async () => {
        const strike = toWei('250');
        const price = toWei('200');
        const now: moment.Moment = moment();
        const future = moment(now).add(1, 'M');
        const time = genOptionTime(now, future);
        const vol = 150;
        const rfr = 3;
        const localBS = bs.blackScholes(200, 250, time, 1.5, .03, "put");
        const contractBS = await BlackScholesTest.retBlackScholesCalc(price, strike, future.unix(), vol, rfr, PUT);
        expect(truncate(localBS)).to.eq(tFormatEth(contractBS));
    });

    it('correctly prices in the money put with one month time high volatility', async () => {
        const strike = toWei('250');
        const price = toWei('200');
        const now: moment.Moment = moment();
        const future = moment(now).add(1, 'M');
        const time = genOptionTime(now, future);
        const vol = 150;
        const rfr = 3;
        const localBS = bs.blackScholes(200, 250, time, 1.5, .03, "put");
        const contractBS = await BlackScholesTest.retBlackScholesCalc(price, strike, future.unix(), vol, rfr, PUT);
        expect(truncate(localBS)).to.eq(tFormatEth(contractBS));
    });

    it('correctly prices at the money put with one month time high volatility', async () => {
        const strike = toWei('200');
        const price = toWei('200');
        const now: moment.Moment = moment();
        const future = moment(now).add(1, 'M');
        const time = genOptionTime(now, future);
        const vol = 150;
        const rfr = 3;
        const localBS = bs.blackScholes(200, 200, time, 1.5, .03, "put");
        const contractBS = await BlackScholesTest.retBlackScholesCalc(price, strike, future.unix(), vol, rfr, PUT);
        expect(truncate(localBS)).to.eq(tFormatEth(contractBS));
    });

    it('correctly prices near the money put with one month time high volatility', async () => {
        const strike = toWei('190');
        const price = toWei('200');
        const now: moment.Moment = moment();
        const future = moment(now).add(1, 'M');
        const time = genOptionTime(now, future);
        const vol = 150;
        const rfr = 3;
        const localBS = bs.blackScholes(200, 190, time, 1.5, .03, "put");
        const contractBS = await BlackScholesTest.retBlackScholesCalc(price, strike, future.unix(), vol, rfr, PUT);
        expect(truncate(localBS)).to.eq(tFormatEth(contractBS));
    });

    it('correctly prices out of the money put with one month time high volatility', async () => {
        const strike = toWei('150');
        const price = toWei('200');
        const now: moment.Moment = moment();
        const future = moment(now).add(1, 'M');
        const time = genOptionTime(now, future);
        const vol = 150;
        const rfr = 3;
        const localBS = bs.blackScholes(200, 150, time, 1.5, .03, "put");
        const contractBS = await BlackScholesTest.retBlackScholesCalc(price, strike, future.unix(), vol, rfr, PUT);
        expect(truncate(localBS)).to.eq(tFormatEth(contractBS));
    });

    it('correctly prices out of the money put with one month time', async () => {
        const strike = toWei('150');
        const price = toWei('200');
        const now: moment.Moment = moment();
        const future = moment(now).add(1, 'M');
        const time = genOptionTime(now, future);
        const vol = 15;
        const rfr = 3;
        const localBS = bs.blackScholes(200, 150, time, .15, .03, "put");
        const contractBS = await BlackScholesTest.retBlackScholesCalc(price, strike, future.unix(), vol, rfr, PUT);
        expect(truncate(localBS)).to.eq(tFormatEth(contractBS));
    });

    it('correctly computes delta of out of the money call with one month time', async () => {
        const strike = toWei('220');
        const price = toWei('200');
        const now: moment.Moment = moment();
        const future = moment(now).add(1, 'M');
        const time = genOptionTime(now, future);
        const vol = 15;
        const rfr = 3;
        const localDelta = greeks.getDelta(200, 220, time, .15, .03, "call");
        const contractDelta = await BlackScholesTest.getDeltaWei(price, strike, future.unix(), vol, rfr, CALL);
        expect(tFormatEth(contractDelta)).to.eq(truncate(localDelta));
    });

    it('correctly computes delta of out of the money put with one month time', async () => {
        const strike = toWei('190');
        const price = toWei('200');
        const now: moment.Moment = moment();
        const future = moment(now).add(1, 'M');
        const time = genOptionTime(now, future);
        const vol = 15;
        const rfr = 3;
        const localDelta = greeks.getDelta(200, 190, time, .15, .03, "put");
        const contractDelta = await BlackScholesTest.getDeltaWei(price, strike, future.unix(), vol, rfr, PUT);
        expect(tFormatEth(contractDelta)).to.eq(truncate(localDelta));
    });

    it('Estimated portfolio deltas should not deviate from actual by more than 10%', async () => {
        let iterations = 10000;
        const now: moment.Moment = moment();
        const priceRange = Array.from({length: 200}, (_, i) => i + 100);
        const amountRange = Array.from({length: 200}, (_, i) => i + 1);
        const timeRange = Array.from({length: 24}, (_, i) => i + 1);
        const volRange = Array.from({length: 150}, (_, i) => ((i + 1)/100));
        function randomOption() {
            const optType = sample(["call", "put"]);
            const opt = {
                price: sample(priceRange),
                strike: sample(priceRange),
                time: sample(timeRange),
                vol: sample(volRange),
                optType,
                amount: sample(amountRange)
            };
            return opt;
        }
        let totalAmountCall = 0;
        let totalAmountPut = 0;
        let weightedStrikeCall = 0;
        let weightedTimeCall = 0;
        let weightedVolCall = 0;
        let weightedStrikePut = 0;
        let weightedTimePut = 0;
        let weightedVolPut = 0;

        const options = [];
        for(let i=0; i<=iterations; i++){
            const opt = randomOption();
            options.push(opt);
            if (opt.optType == "call") {
                totalAmountCall += opt.amount;
                const weight = opt.amount / totalAmountCall;
                const exWeight = 1 - weight;
                weightedStrikeCall = (exWeight * weightedStrikeCall) + (weight * opt.strike);
                weightedTimeCall = (exWeight * weightedTimeCall) + (weight * opt.time);
                weightedVolCall = (exWeight * weightedVolCall) + (weight * opt.vol);
            } else {
                totalAmountPut += opt.amount;
                const weight = opt.amount / totalAmountPut;
                const exWeight = 1 - weight;
                weightedStrikePut = (exWeight * weightedStrikePut) + (weight * opt.strike);
                weightedTimePut = (exWeight * weightedTimePut) + (weight * opt.time);
                weightedVolPut = (exWeight * weightedVolPut) + (weight * opt.vol);
            }
        }
        const currentPrice = 150;
        const rfr = 0.01;
        const traditionalCallDelta = options.filter(o => o.optType == "call").map(option => {
            const future = moment(now).add(option.time, 'M');
            const time = genOptionTime(now, future);
            const delta =  greeks.getDelta(
                currentPrice, option.strike, time, option.vol, rfr, option.optType
            );
            return option.amount * delta
        }).reduce((a,b) => a + b);
        const traditionalPutDelta = options.filter(o => o.optType == "put").map(option => {
            const future = moment(now).add(option.time, 'M');
            const time = genOptionTime(now, future);
            const delta =  greeks.getDelta(
                currentPrice, option.strike, time, option.vol, rfr, option.optType
            );
            return option.amount * delta
        }).reduce((a,b) => a + b);
        const future = moment(now).add(weightedTimeCall, 'M');
        const time = genOptionTime(now, future);
        const futurePut = moment(now).add(weightedTimePut, 'M');
        const timePut = genOptionTime(now, futurePut);
        const callDelta = greeks.getDelta(currentPrice, weightedStrikeCall, time, weightedVolCall, rfr, "call");
        const netCallDelta = callDelta * totalAmountCall;
        const putDelta = greeks.getDelta(currentPrice, weightedStrikePut, timePut, weightedVolPut, rfr, "put");
        const netPutDelta = putDelta * totalAmountPut;
        const callDiff = percentDiff(netCallDelta, traditionalCallDelta);
        const putDiff = percentDiff(netPutDelta, traditionalPutDelta);
        expect(callDiff).to.be.lessThan(0.1);
        expect(putDiff).to.be.lessThan(0.1);
    })

});
