// import { generateMultiSig } from './actions/generateMultiSig';
import { blake2AsHex } from '@polkadot/util-crypto';

import { createDemoKeyPairs } from './keyring';
import { deriveMultiSigAddress } from './multiSig/deriveMultiSigAddress';
import SidecarApi from './sidecar/SidecarApi';
import { TransactionConstruct } from './transaction/TransactionConstruct';

async function main() {
	const sidecarUrl = 'http://127.0.0.1:8080';
	const transactionConstruct = new TransactionConstruct(sidecarUrl);
	const api = new SidecarApi(sidecarUrl);

	// Create multiSigPair
	const keys = await createDemoKeyPairs();
	const addresses = [keys.alice.address, keys.bob.address, keys.dave.address];
	const threshold = 2;
	const ss58Prefix = 0;
	const multiSigAddress = deriveMultiSigAddress(
		addresses,
		ss58Prefix,
		threshold
	);
	console.log('-'.repeat(32));
	console.log('Multisig address generation info');
	console.log(`Addresses: ${addresses.join(' ')}`);
	console.log(`Threshold: ${threshold}`);
	console.log(`Multisig Address (SS58: ${ss58Prefix}): ${multiSigAddress}`);
	console.log('-'.repeat(32));

	// Load up multiSigAccount
	const trasnferValue = '012345678901234567890123456789';
	const transferToMultiSigCall = await transactionConstruct.balancesTransfer(
		keys.alice.address,
		multiSigAddress,
		trasnferValue
	);
	const signedTransferToMultiSigCall = transactionConstruct.createAndSignTransaction(
		keys.alice,
		transferToMultiSigCall
	);
	console.log('-'.repeat(32));
	console.log(`Balances.transfer to the multiSig address from Alice`);
	console.log(`transaction to submit: ${signedTransferToMultiSigCall}\n`);
	console.log('...submiting 🚀\n');
	const result1 = await api.submitTransaction(signedTransferToMultiSigCall);
	console.log(`Node response:\n`, result1);
	console.log('-'.repeat(32));

	// Set the eve as a proxy
	const {
		unsigned: { method: makeEveProxyCall },
	} = await transactionConstruct.proxyAddProxy(
		multiSigAddress,
		keys.eve.address,
		'Any',
		50 // 50 blocks = 5 min
	);

	const makeEveProxyHash = blake2AsHex(makeEveProxyCall, 256);
	const approveAsMulti = await transactionConstruct.multiSigApproveAsMulti(
		2,
		addresses,
		null,
		makeEveProxyHash,
		1000000000
	);
	const signedApproveAsMultiCall = transactionConstruct.createAndSignTransaction(
		keys.alice,
		approveAsMulti
	);
	console.log('-'.repeat(32));
	console.log('approveAsMulti(h(addProxy(Eve)))');
	console.log(`transaction to submit: ${signedApproveAsMultiCall}`);
	console.log('...submiting 🚀\n');
	const result2 = await api.submitTransaction(signedApproveAsMultiCall);
	console.log(`Node response:\n`, result2);
	console.log('-'.repeat(32));

	process.exit();
}

main().catch(console.log);
