import hre, {ethers} from "hardhat";

const chainlinkOracle = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612"
const gammaOracle = "0xBA1880CFFE38DD13771CB03De896460baf7dA1E7"
const bot = "0x2ce708d31669d3a53f07786d6e06659891100d3f"
const weth = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
const usdc = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
const sequencerUptimeFeed = "0xfdb631f5ee196f0ed6faa767959853a9f217697d"

async function main() {
    
    const [deployer] = await ethers.getSigners();
    console.log("deployer: " + await deployer.getAddress())
    // deploy pricer
    const pricer = await(await ethers.getContractFactory("L2ChainLinkPricer")).deploy(bot, weth, chainlinkOracle, gammaOracle, sequencerUptimeFeed)
    try {
		await hre.run("verify:verify", {
			address: pricer.address,
			constructorArguments: [
                bot,
                weth,
                chainlinkOracle,
                gammaOracle,
                sequencerUptimeFeed
			]
		})
		console.log("pricer verified")
	} catch (err: any) {
		console.log(err)
		console.log("pricer contract already verified")
	}
    console.log("pricer bot: " + pricer.address)
	console.log("execution complete")
}
main()
    .then(() => process.exit())
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

