import { createDemoKeyPairs } from './keyring';

async function main() {
	const keys = await createDemoKeyPairs();
	console.log(keys);

	process.exit(1);
}

main().catch(console.log);
