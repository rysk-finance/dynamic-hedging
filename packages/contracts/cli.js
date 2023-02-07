const { SolidityMetricsContainer } = require("solidity-code-metrics")
const fs = require("fs")

let options = {
	basePath: "",
	inputFileGlobExclusions: undefined,
	inputFileGlob: undefined,
	inputFileGlobLimit: undefined,
	debug: false,
	repoInfo: {
		branch: undefined,
		commit: undefined,
		remote: undefined
	}
}

let metrics = new SolidityMetricsContainer("metricsContainerName", options)

// analyze files
metrics.analyze("./contracts/hedging/GmxHedgingReactor.sol")
// ...
metrics.analyze("./contracts/hedging/GmxHedgingReactor.sol")

// output
console.log(metrics.totals())
metrics.generateReportMarkdown().then(text => fs.writeFileSync("./solidityMetrics.html", text))
// or let text = await metrics.generateReportMarkdown();
