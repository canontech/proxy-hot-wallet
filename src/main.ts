import { generateMultiSig } from './actions/generateMultiSig';

async function main() {
	const sidecarUrl = 'http://127.0.0.1:8080'
	await generateMultiSig();
	process.exit();
}

main().catch(console.log);
