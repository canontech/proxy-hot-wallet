import { blake2AsHex } from '@polkadot/util-crypto';

import { ChainSync } from './chain/ChainSync';
import { createDemoKeyPairs } from './keyring';
import { deriveMultiSigAddress } from './multiSig/deriveMultiSigAddress';
import { sortAddresses } from './multiSig/sortAddreses';
import { SidecarApi } from './sidecar/SidecarApi';
import { TransactionConstruct } from './transaction/TransactionConstruct';

async function main() {
	const sidecarUrl = 'http://127.0.0.1:8080';
	const transactionConstruct = new TransactionConstruct(sidecarUrl);
	const api = new SidecarApi(sidecarUrl);
	const chainSync = new ChainSync(sidecarUrl);

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
	const trasnferValue = '0123456789012345';
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
	console.log('...waiting for transaction inclusion');
	const inclusionBlock = await chainSync.pollingEventListener(
		'balances',
		'Transfer'
	);
	if (!inclusionBlock) throw 'inclusionBlock null';
	console.log(`Balances.transfer succesfully processed in ${inclusionBlock}`);
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
	const maxWeight = 1000000000;
	const makeEveProxyHash = blake2AsHex(makeEveProxyCall, 256);
	const approveAsMulti = await transactionConstruct.multiSigApproveAsMulti(
		keys.bob.address,
		2,
		sortAddresses([keys.alice.address, keys.dave.address]),
		null,
		makeEveProxyHash,
		maxWeight
	);
	const signedApproveAsMultiCall = transactionConstruct.createAndSignTransaction(
		keys.bob,
		approveAsMulti
	);
	console.log('-'.repeat(32));
	console.log('approveAsMulti(h(addProxy(Eve)))');
	console.log(`transaction to submit: ${signedApproveAsMultiCall}`);
	console.log('...submiting 🚀\n');
	const result2 = await api.submitTransaction(signedApproveAsMultiCall);
	console.log(`Node response:\n`, result2);
	const timepoint1 = await chainSync.pollingEventListener(
		'multisig',
		'NewMultisig'
	);
	if (!timepoint1) throw 'timepoint1 null';
	console.log('-'.repeat(32));

	const asMulti = await transactionConstruct.multiSigAsMulti(
		keys.dave.address,
		2,
		sortAddresses([(keys.alice.address, keys.bob.address)]),
		timepoint1,
		makeEveProxyCall,
		false,
		maxWeight
	);
	const signedAsMultiCall = transactionConstruct.createAndSignTransaction(
		keys.dave,
		asMulti
	);
	console.log('-'.repeat(32));
	console.log('asMulti(addProxy(Eve))');
	console.log('transaction to submit: ', signedAsMultiCall);
	console.log('...submiting 🚀\n');
	const result3 = await api.submitTransaction(signedAsMultiCall);
	console.log(`Node response:\n`, result3);
	await chainSync.pollingEventListener('multisig', 'MultisigExecuted');
	console.log(
		'asMulti(addProxy(Eve)) succesfully executed, Eve is now a proxy!'
	);
	console.log('-'.repeat(32));
	process.exit();
}

main().catch(console.log);
