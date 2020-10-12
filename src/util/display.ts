export function logSeperator(): void {
	console.log(Array(80).fill('━').join(''), '\n');
}

export function submiting(): void {
	console.log('...submiting transaction to the node 🚀');
}

export function waiting(): void {
	console.log('...waiting for transaction inclusion ⌛️⌛⌛️');
}
