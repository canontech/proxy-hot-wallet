import { resolve } from 'path';
import readline from 'readline';

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

export function waitToContinue(): Promise<void> {
	return new Promise((resolve, _reject) => {
		rl.question('Press enter to continue', (_answer) => {
			console.log(_answer);
			rl.close();
			resolve(undefined);
		});
	});
}
