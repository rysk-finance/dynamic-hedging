module.exports = {
	configureYulOptimizer: true,
	solcOptimizerDetails: {
		peephole: false,
		// inliner: false,
		jumpdestRemover: false,
		orderLiterals: true, // <-- TRUE! Stack too deep when false
		deduplicate: false,
		cse: false,
		constantOptimizer: false,
		yul: false
	}
}
