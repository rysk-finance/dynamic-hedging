export const delay = (callback: () => void, time: number): Promise<null> => {
	return new Promise(resolve => {
		setTimeout(() => {
			callback()
			resolve(null)
		}, time)
	})
}
