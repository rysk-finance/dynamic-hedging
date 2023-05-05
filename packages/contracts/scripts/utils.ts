export const delay = (callback: () => void, time: number): Promise<null> => {
	return new Promise(resolve => {
		setTimeout(() => {
			callback()
			resolve(null)
		}, time)
	})
}
export enum CHAINID {
	ARBITRUM = 42161, // eslint-disable-line no-unused-vars
	ARBITRUM_GOERLI = 421613, // eslint-disable-line no-unused-vars
}