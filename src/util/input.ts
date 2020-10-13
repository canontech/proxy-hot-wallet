import readline from 'readline';

export function waitToContinue(): Promise<void> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve, _reject) => {
		rl.question('Press enter to continue:\n', (_answer) => {
			console.log(_answer);
			rl.close();
			resolve(undefined);
		});
	});
}
