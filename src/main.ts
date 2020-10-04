// import { generateMultiSig } from './actions/generateMultiSig';
import { createDemoKeyPairs } from './keyring';
import { deriveMultiSigAddress } from './multiSig/deriveMultiSigAddress';
import SidecarApi from './sidecar/SidecarApi';
import { TxConstruct } from './transaction/TxConstruct';

async function main() {
	const sidecarUrl = 'http://127.0.0.1:8080';
	const txConstructionWorker = new TxConstruct(sidecarUrl);
	const api = new SidecarApi(sidecarUrl);

	// Create multiSigPair
	const keys = await createDemoKeyPairs();
	const addresses = [keys.alice.address, keys.bob.address, keys.dave.address];
	const threshold = 2;
	const ss58Prefix = 0;
	const multisigAddress = deriveMultiSigAddress(
		addresses,
		ss58Prefix,
		threshold
	);
	console.log('-'.repeat(32));
	console.log('Multisig address generation info');
	console.log(`Addresses: ${addresses.join(' ')}`);
	console.log(`Threshold: ${threshold}`);
	console.log(`Multisig Address (SS58: ${ss58Prefix}): ${multisigAddress}`);
	console.log('-'.repeat(32));

	// Load up multiSigAccount
	const trasnferValue = '012345678901234567890123456789';
	const transferToMultiSig = await txConstructionWorker.balancesTransfer(
		keys.alice,
		multisigAddress,
		trasnferValue
	);
	console.log('-'.repeat(32));
	console.log(`Balances.transfer info`);
	console.log(`    origin: Alice (${keys.alice.address})`);
	console.log(`    dest: Multisig Address (${multisigAddress})`);
	console.log(`    value: ${trasnferValue}`);
	console.log(`transaction to submit: ${transferToMultiSig}\n`);
	console.log('...submiting 🚀\n');
	const result = await api.submitTransaction(transferToMultiSig);
	console.log(`Node response:\n`, result);
	console.log('-'.repeat(32));


	// Set the 4th key as a proxy

	process.exit();
}

main().catch(console.log);
