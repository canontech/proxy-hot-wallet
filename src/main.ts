import { generateMultiSig } from './actions/generateMultiSig';

async function main() {
	await generateMultiSig();
	process.exit();
}

main().catch(console.log);
