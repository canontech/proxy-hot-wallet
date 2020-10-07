import { blake2AsHex } from '@polkadot/util-crypto';
import {
	encodeDerivedAddress,
	encodeMultiAddress,
} from '@polkadot/util-crypto';

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

	const delayPeriod = 10; // 50 blocks = 5 min
	const {
		unsigned: { method: makeEveProxyCall },
	} = await transactionConstruct.proxyAddProxy(
		multiSigAddress,
		keys.eve.address,
		'Any',
		delayPeriod
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

	const d0 = encodeDerivedAddress(multiSigAddress, 0, ss58Prefix);
	const d1 = encodeDerivedAddress(multiSigAddress, 1, ss58Prefix);
	console.log('-'.repeat(32));
	console.log('Created two derived addresses for for the multisig address');
	console.log('Multisig derive 0: ', d0);
	console.log('Multisig derive 1: ', d1);
	console.log('-'.repeat(32));

	const transferToD0 = await transactionConstruct.balancesTransfer(
		keys.charlie.address,
		d0,
		'1234567890123450'
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
		'1234567890123450',
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
		'1'
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
	const result7 = await api.submitTransaction(signedProxyAnnounceC0);
	console.log(`Node response:\n`, result7);
	const blockInclusionAnnounceC0 = await chainSync.pollingEventListener(
		'proxy',
		'Announced'
	);
	if (!blockInclusionAnnounceC0) throw 'blockInclusionAnnounceC0 is null';
	console.log(
		'proxy.announce of c1 sucessfully at ',
		blockInclusionAnnounceC0
	);
	console.log(
		`now that the transacstion was succesfuly submitted, wait ${delayPeriod} blocks after announcement (${
			blockInclusionAnnounceC0?.height + delayPeriod
			// blockInclusionAnnounceC0?.height + 50
		}) ` +
			'for the delay periood to pass and execute with proxyAnnounced... \n⌛️\n'
	);
	console.log(
		'there is a process in the background that will fire proxyAnnounced to execute the actual balance ' +
			'transfer to cold storage once the delay period is over; the demo will keep moving forward'
	);
	await chainSync
		.waitUntilHeight(blockInclusionAnnounceC0?.height + delayPeriod)
		.then(async () => {
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
			console.log('-'.repeat(32));
			console.log(
				'(background task) proxyAnnounced(multiAsDeriv(balances.transfer(coldStorage)))'
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
				'balances succesfully transfered to cold storage through proxy at',
				blockInclusionProxyAnnounced
			);
			console.log('-'.repeat(32));
		});

	console.log(
		'simultanously sending balanceds.transfer(cold storage) tx the safety worker for decoding' +
			' and verification that the transfer is going to cold storage'
	);
	transactionConstruct.safetyWorker({
		unsigned: transferToColdStorage,
		registry: transferToColdStorageRegistry,
		metadataRpc: transferToColdStorageMetadataRpc,
	});

	console.log('-'.repeat(32));

	console.log(
		'\nNow demonstrating how to stop an attacker from using the proxy to send funds to themselves.'
	);

	const {
		unsigned: transferToAttacker,
		registry: transferToAttackerRegistry,
		metadataRpc: transferToAttackerMetadataRpc,
	} = await transactionConstruct.balancesTransfer(
		d1,
		keys.attacker.address,
		'01234666'
	);
	const { unsigned: c1 } = await transactionConstruct.utilityAsDerivative(
		multiSigAddress,
		1,
		transferToAttacker.method
	);
	const c1Call = c1.method;
	const c1Hash = blake2AsHex(c1Call, 256);
	const proxyAnnounceC1 = await transactionConstruct.proxyAnnounce(
		keys.eve.address,
		multiSigAddress,
		c1Hash
	);
	const signedProxyAnnounceC1 = transactionConstruct.createAndSignTransaction(
		keys.eve,
		proxyAnnounceC1
	);
	console.log('-'.repeat(32));
	console.log('announce proxied balances.transfer from d1 to Attacker');
	console.log('transaction to submit: ', signedProxyAnnounceC1);
	console.log('...submiting 🚀\n');
	const result8 = await api.submitTransaction(signedProxyAnnounceC1);
	console.log(`Node response:\n`, result8);
	const blockInclusionAnnounceC1 = await chainSync.pollingEventListener(
		'proxy',
		'Announced'
	);
	if (!blockInclusionAnnounceC1) throw 'blockInclusionAnnounceC1 is null';
	console.log('proxy.announce of c1 sucessful at ', blockInclusionAnnounceC1);
	console.log('-'.repeat(32));

	console.log(
		`now that the transacstion was succesfuly submitted, wait ${delayPeriod} blocks after announcement (${
			blockInclusionAnnounceC0?.height + delayPeriod
		}) ` +
			'for the delay periood to pass and execute with proxyAnnounced...\n⌛️\n' +
			'...but hopefully we can stop the Attacker before then!'
	);
	console.log(
		'there is a process in the background that will fire proxyAnnounced to execute the actual balance ' +
			'transfer to the attacker if we do not act fast enough; the demo will keep moving forward'
	);
	void chainSync
		.waitUntilHeight(blockInclusionAnnounceC1?.height + delayPeriod)
		.then(async () => {
			const proxyAnnouncedCallC1 = await transactionConstruct.proxyProxyAnnounced(
				keys.eve.address,
				multiSigAddress,
				keys.eve.address,
				'Any',
				c1Call
			);
			const signedProxyAnnoucedTxC1 = transactionConstruct.createAndSignTransaction(
				keys.eve,
				proxyAnnouncedCallC1
			);
			console.log('-'.repeat(32));
			console.log(
				'(background task) proxyAnnounced(multiAsDeriv(balances.transfer(Attacker)))'
			);
			console.log('transaction to submit: ', signedProxyAnnoucedTxC1);
			console.log('\n...submiting 🚀\n');
			const result7 = await api.submitTransaction(
				signedProxyAnnoucedTxC1
			);
			console.log(`Node response:\n`, result7);
			let blockInclusionProxyAnnouncedC1;
			try {
				blockInclusionProxyAnnouncedC1 = await chainSync.pollingEventListener(
					'balances',
					'Transfer'
				);
			} catch {
				console.log('Attacker tranasction failed!');
				process.exit(1);
			}
			console.log(
				'balances succesfully transfered to Attacker through proxy at',
				blockInclusionProxyAnnouncedC1
			);
			console.log('Security system failed!');
			process.exit(1);
		});

	console.log(
		'simultanously sending balanceds.transfer(attacker) tx the safety worker for decoding' +
			' and verification of the transfer - the system will catch the attacker here and kickoff' +
			' security procedure to stop the malicious transfer'
	);
	const isSafe = transactionConstruct.safetyWorker({
		unsigned: transferToAttacker,
		registry: transferToAttackerRegistry,
		metadataRpc: transferToAttackerMetadataRpc,
	});
	if (isSafe) throw 'error when processing unsafe transaction';
	const {
		unsigned: { method: removeProxiesCall },
	} = await transactionConstruct.proxyRemoveProxies(multiSigAddress);
	const removeProxiesHash = blake2AsHex(removeProxiesCall);
	const removeProxiesApproveAsMulti = await transactionConstruct.multiSigApproveAsMulti(
		keys.alice.address,
		2,
		sortAddresses([keys.bob.address, keys.dave.address]),
		null,
		removeProxiesHash,
		maxWeight
	);
	const signedRemoveProxiesApproveAsMulti = transactionConstruct.createAndSignTransaction(
		keys.alice,
		removeProxiesApproveAsMulti
	);
	console.log('-'.repeat(32));
	console.log('approveAsMulti(h(removeProxies(multisigAddress)))');
	console.log(`transaction to submit: ${signedRemoveProxiesApproveAsMulti}`);
	console.log('...submiting 🚀\n');
	const result9 = await api.submitTransaction(
		signedRemoveProxiesApproveAsMulti
	);
	console.log(`Node response:\n`, result9);
	// TODO timepoint needs to be block number and transaction index
	const timepoint2 = await chainSync.pollingEventListener(
		'multisig',
		'NewMultisig'
	);
	if (!timepoint2) throw 'timepoint1 null';
	console.log('removeProxies(multisigAddress) succeeded at ', timepoint2);
	console.log('-'.repeat(32));

	console.log('-'.repeat(32));
	const removeProxiesAsMulti = await transactionConstruct.multiSigAsMulti(
		keys.bob.address,
		2,
		sortAddresses([keys.alice.address, keys.dave.address]),
		timepoint2,
		removeProxiesCall,
		true,
		maxWeight
	);
	const signedremoveProxiesAsMulti = transactionConstruct.createAndSignTransaction(
		keys.bob,
		removeProxiesAsMulti
	);
	console.log('asMulti(removeProxies(multisigAddress))');
	console.log(`transaction to submit: ${signedremoveProxiesAsMulti}`);
	console.log('...submiting 🚀\n');
	const result10 = await api.submitTransaction(signedremoveProxiesAsMulti);
	console.log(`Node response:\n`, result10);
	const proxyRemovedAt = await chainSync.pollingEventListener(
		'proxy',
		'ProxyExecuted'
	);
	if (!proxyRemovedAt) throw 'proxyRemovedAt is null';
	console.log('Crisis averted 👩‍🚒 attacker transfer cancelled 👌!');
}

main().catch(console.log);
