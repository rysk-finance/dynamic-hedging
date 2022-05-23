![Rysk Architecture](../../../images/RyskArchitecture.png) 

# The Dynamic Hedging Vault (DHV)

[Docs explaining the DHV](https://docs.rysk.finance/architecture/dynamic-hedging-vault-amm) 

[Medium article explaining the DHV](https://medium.com/@rysk-finance/looking-under-the-hood-of-rysks-dynamic-hedging-vault-e059e1b87e41)

The dynamic hedging vault is a product that issues options and trades other derivatives with the aim of generating yield and targeting delta 0 in order to achieve a market uncorrelated return stream. 

The DHV is aware of its own delta and prices options that it sells in such a way to incentivise options buyers to purchase options that move the delta of the portfolio back to 0. Pricing is done via black scholes with a volatility skew based off of the deribit order book, a capital utilisation skew and a delta skew. 

Users deposit a single collateral (USDC to begin with) into the vault (LiquidityPool) in exchange for shares, the flow follows a ["Mutual fund system" - like Ribbon's vault flow as opposed to Yearn's vault flow](https://bejewled-egret-22c.notion.site/Mutual-Fund-Mechamism-Explainer-768912673cf946f4a99c3b833d830389) whereby deposits and withdraws are queued and then completed after a certain epoch it has various inputs from oracles which are described in OracleFeeds.md . This collateral is then used to collateralise or "short" options which are sold to any option buyer, the buyer pays a "premium" to buy an option, this premium represents the yield on collateral (but this yield comes at the risk of the options exposure, where if an option expires ITM it can result in a loss for the short position holder). A user might deposit into this vault to access high yields that are uncorrelated to the market. Users can withdraw at any time, this can be processed after an "epoch" completion so long as there is sufficient capital available.

Options buyers interact with the OptionHandler. This is a contract that is authorised to interact with options buying/selling functionality of the LiquidityPool. [Options buyers can "Issue", "Write", "Buyback" or "Execute custom orders".](https://bejewled-egret-22c.notion.site/Liquidity-Pool-Options-Interactions-9558238986234e01bbeb066a1031eb6f) The handler transfers the premia directly from the user to the liquidityPool, the premia is priced according to various parameters which are defined in [quotePriceWithUtilisationGreeks](https://bejewled-egret-22c.notion.site/QuotePriceWithUtilizationGreeks-e7fdfdc890cc4b55852a5901c099ef9a) it has various inputs from oracles which are described in OracleFeeds.md . Then the liquidityPool will take the instruction from the handler, process it and pass it to the optionsRegistry for processing on the [opyn-rysk gamma protocol](https://github.com/rysk-finance/GammaProtocol) alongside any funds needed to collateralise the option positon if it is a write operation.

The pool can hedge its delta off using other derivatives such as perps or spot by using contracts known as hedging reactors.