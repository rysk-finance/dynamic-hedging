from locust import task, run_single_user
from locust import FastHttpUser


class comp_rysk_finance(FastHttpUser):
    host = "https://comp.rysk.finance"

    @task
    def t(self):
        with self.client.request(
            "GET",
            "/",
            headers={
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "accept-encoding": "gzip, deflate, br",
                "accept-language": "en-GB,en;q=0.9,en-US;q=0.8",
                "cache-control": "max-age=0",
                "sec-ch-ua": '"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "none",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
            },
            catch_response=True,
        ) as resp:
            pass
        with self.rest(
            "POST",
            "https://api.studio.thegraph.com/query/45686/rysk/0.1.2",
            headers={
                "accept": "*/*",
                "accept-encoding": "gzip, deflate, br",
                "accept-language": "en-GB,en;q=0.9,en-US;q=0.8",
                "origin": "https://comp.rysk.finance",
                "referer": "https://comp.rysk.finance/",
                "sec-ch-ua": '"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "cross-site",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
            },
            json={
                "operationName": "INITIAL_DATA",
                "variables": {"now": "1683557739"},
                "query": "query INITIAL_DATA($address: String, $now: String) {\n  expiries(where: {timestamp_gte: $now}) {\n    timestamp\n    __typename\n  }\n  longPositions(\n    where: {account: $address, active: true, oToken_: {expiryTimestamp_gte: $now}}\n  ) {\n    netAmount\n    oToken {\n      createdAt\n      expiryTimestamp\n      id\n      isPut\n      strikePrice\n      symbol\n      __typename\n    }\n    optionsBoughtTransactions {\n      fee\n      premium\n      __typename\n    }\n    optionsSoldTransactions {\n      fee\n      premium\n      __typename\n    }\n    __typename\n  }\n  shortPositions(\n    where: {account: $address, active: true, oToken_: {expiryTimestamp_gte: $now}}\n  ) {\n    netAmount\n    oToken {\n      createdAt\n      expiryTimestamp\n      id\n      isPut\n      strikePrice\n      symbol\n      __typename\n    }\n    optionsBoughtTransactions {\n      fee\n      premium\n      __typename\n    }\n    optionsSoldTransactions {\n      fee\n      premium\n      __typename\n    }\n    vault {\n      id\n      vaultId\n      collateralAmount\n      shortAmount\n      collateralAsset {\n        id\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  vaults(orderBy: vaultId, orderDirection: desc, where: {owner: $address}) {\n    vaultId\n    shortOToken {\n      id\n      __typename\n    }\n    __typename\n  }\n}",
            },
        ) as resp:
            pass
        with self.rest(
            "POST",
            "https://mainnet.infura.io/v3/c4bb906ed6904c42b19c95825fe55f39",
            headers={
                "accept": "*/*",
                "accept-encoding": "gzip, deflate, br",
                "accept-language": "en-GB,en;q=0.9,en-US;q=0.8",
                "origin": "https://comp.rysk.finance",
                "referer": "https://comp.rysk.finance/",
                "sec-ch-ua": '"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "cross-site",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
            },
            json={
                "jsonrpc": "2.0",
                "id": "1",
                "method": "eth_call",
                "params": [
                    {
                        "data": "0x7e37479e000000000000000000000000c921ff4f9254d592c1b87fd569774b8de0a809af",
                        "to": "0x1bdc0fd4fbabeed3e611fd6195fcd5d41dcef393",
                    },
                    "latest",
                ],
            },
        ) as resp:
            pass
        with self.rest(
            "POST",
            "https://polygon-mainnet.infura.io/v3/c4bb906ed6904c42b19c95825fe55f39",
            headers={
                "accept": "*/*",
                "accept-encoding": "gzip, deflate, br",
                "accept-language": "en-GB,en;q=0.9,en-US;q=0.8",
                "origin": "https://comp.rysk.finance",
                "referer": "https://comp.rysk.finance/",
                "sec-ch-ua": '"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "cross-site",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
            },
            json={
                "jsonrpc": "2.0",
                "id": "1",
                "method": "eth_call",
                "params": [
                    {
                        "data": "0x7e37479e000000000000000000000000c921ff4f9254d592c1b87fd569774b8de0a809af",
                        "to": "0x3e67b8c702a1292d1ceb025494c84367fcb12b45",
                    },
                    "latest",
                ],
            },
        ) as resp:
            pass


if __name__ == "__main__":
    run_single_user(comp_rysk_finance)
