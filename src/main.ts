import { blake2AsHex } from '@polkadot/util-crypto';
import {
	encodeDerivedAddress,
	encodeMultiAddress,
} from '@polkadot/util-crypto';

// import * as txwrapper from '@substrate/txwrapper';
import { sortAddresses } from './address/sortAddreses';
import { ChainSync } from './chain/ChainSync';
import { createDemoKeyPairs } from './keyring';
import { SidecarApi } from './sidecar/SidecarApi';
import { TransactionConstruct } from './transaction/TransactionConstruct';

async function main() {
	const sidecarUrl = 'http://127.0.0.1:8080';
	const keys = await createDemoKeyPairs();
	const transactionConstruct = new TransactionConstruct(
		sidecarUrl,
		keys.aliceStash.address
	);
	const api = new SidecarApi(sidecarUrl);
	const chainSync = new ChainSync(sidecarUrl);

	const addresses = [keys.alice.address, keys.bob.address, keys.dave.address];
	const threshold = 2;
	const ss58Prefix = 42;
	const multiSigAddress = encodeMultiAddress(
		addresses,
		threshold,
		ss58Prefix
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
	console.log(
		`Balances.transfer succesfully processed in ${inclusionBlock.height}`
	);
	console.log('-'.repeat(32));

	// // Set the eve as a proxy
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
	console.log('makeEveProxyHash ', makeEveProxyHash);
	const approveAsMulti = await transactionConstruct.multiSigApproveAsMulti(
		keys.bob.address,
		2,
		sortAddresses([keys.alice.address, keys.dave.address], ss58Prefix),
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
	// TODO timepoint needs to be block number and transaction index
	const timepoint1 = await chainSync.pollingEventListener(
		'multisig',
		'NewMultisig'
	);
	if (!timepoint1) throw 'timepoint1 null';
	console.log(
		'multisig to make eve a proxy createad at time point ',
		timepoint1
	);

	const asMulti = await transactionConstruct.multiSigAsMulti(
		keys.dave.address,
		2,
		sortAddresses([keys.alice.address, keys.bob.address], ss58Prefix),
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

	const d0 = encodeDerivedAddress(multiSigAddress, 1, ss58Prefix);
	const d1 = encodeDerivedAddress(multiSigAddress, 0, ss58Prefix);
	console.log('-'.repeat(32));
	console.log('Created two derived addresses for for the multisig address');
	console.log('Multisig derive 0: ', d0);
	console.log('Multisig derive 1: ', d1);
	console.log('-'.repeat(32));

	const transferToD0 = await transactionConstruct.balancesTransfer(
		keys.charlie.address,
		d0,
		'0123456789012345'
	);
	const signedTransferToD0Call = transactionConstruct.createAndSignTransaction(
		keys.charlie,
		transferToD0
	);
	console.log('-'.repeat(32));
	console.log('balances.transfer from Charlie (depositer) to d0');
	console.log('transaction to submit: ', signedTransferToD0Call);
	console.log('...submiting 🚀\n');
	const result4 = await api.submitTransaction(signedTransferToD0Call);
	console.log(`Node response:\n`, result4);
	const blockInclusionD0 = await chainSync.pollingEventListener(
		'balances',
		'Transfer'
	);
	if (!blockInclusionD0) throw 'blockInclusionD0 is null';
	console.log(
		'balances.transfer to d0 sucessfully in block number ',
		blockInclusionD0
	);
	console.log('-'.repeat(32));

	const transferToD1 = await transactionConstruct.balancesTransfer(
		keys.charlie.address,
		d0,
		'0123456789012345',
		blockInclusionD0.height + 1
	);
	const signedTransferToD1Call = transactionConstruct.createAndSignTransaction(
		keys.charlie,
		transferToD1
	);
	console.log('-'.repeat(32));
	console.log('balances.transfer from Charlie (depositer) to d1');
	console.log('transaction to submit: ', signedTransferToD1Call);
	console.log('...submiting 🚀\n');
	const result5 = await api.submitTransaction(signedTransferToD1Call);
	console.log(`Node response:\n`, result5);
	const blockInclusionD1 = await chainSync.pollingEventListener(
		'balances',
		'Transfer'
	);
	console.log(
		'balances.transfer to d1 sucessfully in block number ',
		blockInclusionD1?.height
	);
	console.log('-'.repeat(32));

	console.log('-'.repeat(32));
	console.log(
		'Now demonstrating the happy path of using the proxy to transfer funds from multisig derivative account to cold storage.'
	);
	console.log('-'.repeat(32));

	const {
		unsigned: transferToColdStorage,
		registry: transferToColdStorageRegistry,
		metadataRpc: transferToColdStorageMetadataRpc,
	} = await transactionConstruct.balancesTransfer(
		d0,
		keys.aliceStash.address,
		'0123456789012345'
	);
	const { unsigned: c0 } = await transactionConstruct.utilityAsDerivative(
		multiSigAddress,
		0,
		transferToColdStorage.method
	);
	const c0Call = c0.method;
	const c0Hash = blake2AsHex(c0Call, 256);
	const proxyAnnounceC0 = await transactionConstruct.proxyAnnounce(
		keys.eve.address,
		multiSigAddress,
		c0Hash
	);
	const signedProxyAnnounceC0 = transactionConstruct.createAndSignTransaction(
		keys.eve,
		proxyAnnounceC0
	);
	console.log('-'.repeat(32));
	console.log('announce proxied balances.transfer from d0 to cold storage');
	console.log('transaction to submit: ', signedProxyAnnounceC0);
	console.log('...submiting 🚀\n');
	const result6 = await api.submitTransaction(signedProxyAnnounceC0);
	console.log(`Node response:\n`, result6);
	const blockInclusionAnnounceC0 = await chainSync.pollingEventListener(
		'proxy',
		'Announced'
	);
	if (!blockInclusionAnnounceC0) throw 'blockInclusionAnnounceC0 is null';
	console.log(
		'proxy.announce of c1 sucessfully at ',
		blockInclusionAnnounceC0
	);
	console.log('-'.repeat(32));

	console.log('-'.repeat(32));
	console.log(
		'sending balances.transfer from d0 to cold storage to worker for decoding'
	);
	console.log('txVersion', transferToColdStorage.transactionVersion);
	transactionConstruct.safetyWorker({
		unsigned: transferToColdStorage,
		registry: transferToColdStorageRegistry,
		metadataRpc: transferToColdStorageMetadataRpc,
	});
	console.log(
		`now that transacstion is ok, wait 50 blocks after announcement (${
			blockInclusionAnnounceC0?.height + 50
		})` + 'for the delay to pass and execute with proxyAnnounced... \n⌛️\n'
	);
	console.log(
		'This process will continue in the background so the demo can keep moving forward'
	);
	void chainSync
		.waitUntilHeight(blockInclusionAnnounceC0?.height + 50)
		.then(() => {
			const proxyAnnouncedCall = await transactionConstruct.proxyProxyAnnounced(
				keys.eve.address,
				multiSigAddress,
				keys.eve.address,
				'Any',
				c0Call
			);
			const signedProxyAnnoucedTx = transactionConstruct.createAndSignTransaction(
				keys.eve,
				proxyAnnouncedCall
			);
			console.log(
				'proxyAnnounced(multiAsDeriv(balances.transfer(coldStorage)))'
			);
			console.log('transaction to submit: ', signedProxyAnnoucedTx);
			console.log('\n...submiting 🚀\n');
			const result7 = await api.submitTransaction(signedProxyAnnoucedTx);
			console.log(`Node response:\n`, result7);
			const blockInclusionProxyAnnounced = await chainSync.pollingEventListener(
				'balances',
				'Transfer'
			);
			console.log(
				'balances succesfully transfered to call storage through proxy at',
				blockInclusionProxyAnnounced
			);
		});

	console.log(
		'Now demonstrating how to stop an attacker from using the proxy to send funds to themselves.'
	);

	// const {
	// 	unsigned: transferToAttacker,
	// 	registry: transferToAttackerRegistry,
	// 	metadataRpc: transferToAttackerMetadataRpc,
	// } = await transactionConstruct.balancesTransfer(
	// 	d1,
	// 	keys.aliceStash.address,
	// 	'0123456789012345'
	// );
}

main().catch(console.log);
