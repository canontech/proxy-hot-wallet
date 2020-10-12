import { blake2AsHex } from '@polkadot/util-crypto';
import {
	encodeDerivedAddress,
	encodeMultiAddress,
} from '@polkadot/util-crypto';

import { ChainSync } from './ChainSync';
import { createDemoKeyPairs, Keys } from './keyring';
import { SidecarApi } from './sidecar/SidecarApi';
import { TransactionConstruct } from './transaction/TransactionConstruct';
import { logSeperator, sortAddresses, submiting, waiting } from './util';

const sidecarUrl = 'http://127.0.0.1:8080';

async function main() {
	const keys = await createDemoKeyPairs();
	const transactionConstruct = new TransactionConstruct(
		sidecarUrl,
		keys.aliceStash.address
	);
	const sidecarApi = new SidecarApi(sidecarUrl);
	const chainSync = new ChainSync(sidecarUrl);

	const addresses = [keys.alice.address, keys.bob.address, keys.dave.address];
	const threshold = 2;
	const ss58Prefix = 42;
	const multisigAddr = encodeMultiAddress(addresses, threshold, ss58Prefix);

	console.log('Multisig address generation info');
	console.log(`Addresses: ${addresses.join(' ')}`);
	console.log(`Threshold: ${threshold}`);
	console.log(`Multisig Address (SS58: ${ss58Prefix}): ${multisigAddr}`);
	logSeperator();

	// Load up multisig account with currency so it can make transactions
	const trasnferValue = '0123456789012345';
	const transferToMultiSigCall = await transactionConstruct.balancesTransfer(
		keys.alice.address,
		multisigAddr,
		trasnferValue
	);
	const signedTransferToMultiSigCall = transactionConstruct.createAndSignTransaction(
		keys.alice,
		transferToMultiSigCall
	);
	console.log(`balances.transfer(origin: Alice, dest: multisig address)`);
	submiting();
	const nodeRes1 = await sidecarApi.submitTransaction(
		signedTransferToMultiSigCall
	);
	console.log(`Node response: `, nodeRes1.hash);
	waiting();
	const inclusionPoint1 = await chainSync.pollingEventListener(
		'balances',
		'Transfer'
	);
	console.log(
		'Balances.transfer(origin: Alice, dest: multisig address) succesfully included at ',
		inclusionPoint1
	);
	logSeperator();

	const delayPeriod = 10; // 10 blocks = 1 min
	const maxWeight = 1000000000;
	// Make Eve the proxy for the multisig address and set up the proxy with `delayPeriod`
	// delay between a proxied calls announcement and earliest possible point of execution
	await setupProxyForMultisig(
		multisigAddr,
		transactionConstruct,
		chainSync,
		sidecarApi,
		keys,
		ss58Prefix,
		delayPeriod,
		maxWeight
	);

	// Create derivative addresses from the multisig address.
	const deriveAddr0 = encodeDerivedAddress(multisigAddr, 0, ss58Prefix);
	const deriveAddr1 = encodeDerivedAddress(multisigAddr, 1, ss58Prefix);
	console.log('Created two derived addresses from the multisig address');
	console.log('Multisig derive 0: ', deriveAddr0);
	console.log('Multisig derive 1: ', deriveAddr1);
	logSeperator();

	// Depositer transfers money into multisig derive addresses 0 and 1.
	await depositerTransferToDeriv(
		transactionConstruct,
		chainSync,
		sidecarApi,
		keys,
		deriveAddr0,
		deriveAddr1
	);

	// the proxy transfers funds from multisig derive address 0 to cold storage
	await happyPath(
		transactionConstruct,
		chainSync,
		sidecarApi,
		keys,
		deriveAddr0,
		multisigAddr,
		delayPeriod
	);

	// An attacker compromises the proxy and uses the proxy to send funds from multisig
	// derive address 1 to the attackers address. The safety worker will see the announcement
	// for the proxy call and alert the system that there is a transfer from a derivative
	// address that does not go to cold storage. The system will the have two of the composite
	// addresses for the multisig create a transaction to remove all proxies from the multisig
	// address and thus prevent the attacker from making the call as a proxy.
	await adversarialPath(
		transactionConstruct,
		chainSync,
		sidecarApi,
		keys,
		deriveAddr1,
		multisigAddr,
		delayPeriod,
		maxWeight
	);
}

main().catch(console.log);

async function adversarialPath(
	transactionConstruct: TransactionConstruct,
	chainSync: ChainSync,
	sidecarApi: SidecarApi,
	keys: Keys,
	deriveAddr1: string,
	multisigAddr: string,
	delayPeriod: number,
	maxWeight: number
): Promise<void> {
	console.log('Now demonstrating the adversarial path.\n');

	const c1Display =
		'utility.asDerivative(origin: multisig address, index: 1, call: balances.transfer(origin: derivate address 1, dest: Attacker)';
	const {
		unsigned: transferToAttacker,
		registry: transferToAttackerRegistry,
		metadataRpc: transferToAttackerMetadataRpc,
	} = await transactionConstruct.balancesTransfer(
		deriveAddr1,
		keys.attacker.address,
		'01234666'
	);
	const { unsigned: c1 } = await transactionConstruct.utilityAsDerivative(
		multisigAddr,
		1,
		transferToAttacker.method
	);
	const c1Method = c1.method;
	const c1Hash = blake2AsHex(c1Method, 256);
	const proxyAnnounceC1 = await transactionConstruct.proxyAnnounce(
		keys.eve.address,
		multisigAddr,
		c1Hash
	);
	const signedProxyAnnounceC1 = transactionConstruct.createAndSignTransaction(
		keys.eve,
		proxyAnnounceC1
	);

	console.log(`proxy.announce(origin: Alice, callHash: h(${c1Display})`);
	submiting();
	const result8 = await sidecarApi.submitTransaction(signedProxyAnnounceC1);
	console.log(`Node response: `, result8.hash);
	const inclusionPoint5 = await chainSync.pollingEventListener(
		'proxy',
		'Announced'
	);
	if (!inclusionPoint5) throw 'blockInclusionAnnounceC1 is null';
	console.log('proxy.announce of c1 sucessful at ', inclusionPoint5);
	logSeperator();

	console.log(
		`Now that the transacstion was succesfuly submitted, wait ${delayPeriod} blocks after announcement (${
			inclusionPoint5?.height + delayPeriod
		}) ` +
			'for the delay periood to pass and execute with proxyAnnounced.\n' +
			'...but hopefully we can stop the Attacker before then!'
	);
	console.log(
		'there is a process in the background that will fire proxyAnnounced to execute the actual balance ' +
			'transfer to the attacker if we do not act fast enough; the demo will keep moving forward'
	);
	void chainSync
		.waitUntilHeight(inclusionPoint5?.height + delayPeriod)
		.then(async () => {
			const proxyAnnouncedCallC1 = await transactionConstruct.proxyProxyAnnounced(
				keys.eve.address,
				multisigAddr,
				keys.eve.address,
				'Any',
				c1Method
			);
			const signedProxyAnnoucedTxC1 = transactionConstruct.createAndSignTransaction(
				keys.eve,
				proxyAnnouncedCallC1
			);
			console.log(
				`\n(💤background task) proxy.proxyAnnounced(${c1Display})`
			);
			submiting();
			const result7 = await sidecarApi.submitTransaction(
				signedProxyAnnoucedTxC1
			);
			console.log(`Node response: `, result7.hash);
			let inclusionPoint6;
			try {
				inclusionPoint6 = await chainSync.pollingEventListener(
					'balances',
					'Transfer'
				);
			} catch {
				console.log(
					'Attacker tranasction failed! The system worked succesfully!'
				);
				process.exit();
			}
			console.log(
				`proxy.proxyAnnounced(${c1Display}) succesfully included at `,
				inclusionPoint6
			);
			console.log('Security system failed!');
			process.exit();
		});

	console.log(
		`\nSimultanously sending ${c1Display} to the safety worker for decoding` +
			' and verification of the transfer - the system will catch the attacker here and kickoff' +
			' the security procedure to stop the malicious transfer'
	);
	const isSafe = transactionConstruct.safetyWorker({
		unsigned: transferToAttacker,
		registry: transferToAttackerRegistry,
		metadataRpc: transferToAttackerMetadataRpc,
	});
	if (isSafe) throw 'error when processing unsafe transaction';
	console.log(
		'\n🚧 Malicious proxy transfer detected, kicking off proxy removal protocol! 🚧\n'
	);
	const removeProxiesDisplay =
		'proxy.removeProxies(origin: multisig address)';
	const {
		unsigned: { method: removeProxiesMethod },
	} = await transactionConstruct.proxyRemoveProxies(multisigAddr);
	const removeProxiesHash = blake2AsHex(removeProxiesMethod);
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

	console.log(
		`multisig.approveAsMulti(origin: Alice, callHash: h(${removeProxiesDisplay}))`
	);
	submiting();
	const nodeRes4 = await sidecarApi.submitTransaction(
		signedRemoveProxiesApproveAsMulti
	);
	console.log(`Node response: `, nodeRes4.hash);
	const inclusionPoint7 = await chainSync.pollingEventListener(
		'multisig',
		'NewMultisig'
	);
	if (!inclusionPoint7) throw 'timepoint1 null';
	console.log(
		`multisig.approveAsMulti(origin: Alice, callHash: h(${removeProxiesDisplay}))`,
		inclusionPoint7
	);
	logSeperator();

	const removeProxiesAsMulti = await transactionConstruct.multiSigAsMulti(
		keys.bob.address,
		2,
		sortAddresses([keys.alice.address, keys.dave.address]),
		inclusionPoint7,
		removeProxiesMethod,
		true,
		maxWeight
	);
	const signedremoveProxiesAsMulti = transactionConstruct.createAndSignTransaction(
		keys.bob,
		removeProxiesAsMulti
	);
	console.log(`multisig.asMulti(origin: Bob, call: ${removeProxiesDisplay})`);
	submiting();
	const nodeRes5 = await sidecarApi.submitTransaction(
		signedremoveProxiesAsMulti
	);
	console.log(`Node response: `, nodeRes5.hash);
	const inclusionPoint8 = await chainSync.pollingEventListener(
		'proxy',
		'ProxyExecuted'
	);
	if (!inclusionPoint8) throw 'proxyRemovedAt is null';
	console.log(
		`multisig.asMulti(origin: Bob, call: ${removeProxiesDisplay}) succsefully included at `,
		inclusionPoint8
	);
	console.log('Crisis averted 👩‍🚒 attacker transfer cancelled 👌!');
}

async function happyPath(
	transactionConstruct: TransactionConstruct,
	chainSync: ChainSync,
	sidecarApi: SidecarApi,
	keys: Keys,
	deriveAddr0: string,
	multisigAddr: string,
	delayPeriod: number
): Promise<void> {
	console.log(
		'Now demonstrating the happy path of using the proxy to transfer funds from multisig derivative account to cold storage.\n'
	);

	const c0Display =
		'utility.asDerivative(origin: multisig addres, index: 0, call: balances.transfer(origin: derive address 0, dest: cold storage))';
	const {
		unsigned: transferToColdStorage,
		registry: transferToColdStorageRegistry,
		metadataRpc: transferToColdStorageMetadataRpc,
	} = await transactionConstruct.balancesTransfer(
		deriveAddr0,
		keys.aliceStash.address,
		'1'
	);
	const { unsigned: c0 } = await transactionConstruct.utilityAsDerivative(
		multisigAddr,
		0,
		transferToColdStorage.method
	);
	const c0Method = c0.method;
	const c0Hash = blake2AsHex(c0Method, 256);
	const proxyAnnounceC0 = await transactionConstruct.proxyAnnounce(
		keys.eve.address,
		multisigAddr,
		c0Hash
	);
	const signedProxyAnnounceC0 = transactionConstruct.createAndSignTransaction(
		keys.eve,
		proxyAnnounceC0
	);
	console.log(`proxy.announce(origin: eve, callHash: h(${c0Display})`);
	submiting();
	const nodeRes3 = await sidecarApi.submitTransaction(signedProxyAnnounceC0);
	console.log(`Node response: `, nodeRes3.hash);
	const inclusionPoint3 = await chainSync.pollingEventListener(
		'proxy',
		'Announced'
	);
	if (!inclusionPoint3) throw 'inclusionPoint3 is null';
	console.log(
		`proxy.announce(origin: eve, callHash: h(${c0Display}) sucessfully included at `,
		inclusionPoint3
	);
	console.log(
		`\nNow that the transaction was succesfuly submitted, we will wait ${delayPeriod} blocks after announcement (until ${
			inclusionPoint3?.height + delayPeriod
		}) ` +
			'for the delay periood to pass and execute with proxyAnnounced.' +
			'\nThere is a process in the background that will fire proxyAnnounced to execute the actual balance ' +
			'transfer to cold storage once the delay period is over; the demo will keep moving forward'
	);
	logSeperator();

	// wait until the delay period has passed and then execute the announce call
	await chainSync
		.waitUntilHeight(inclusionPoint3?.height + delayPeriod)
		.then(async () => {
			const proxyAnnounced = await transactionConstruct.proxyProxyAnnounced(
				keys.eve.address,
				multisigAddr,
				keys.eve.address,
				'Any',
				c0Method
			);
			const signedProxyAnnouced = transactionConstruct.createAndSignTransaction(
				keys.eve,
				proxyAnnounced
			);
			console.log(
				`\n(💤 background task) proxy.proxyAnnounced(origin: Eve, call: ${c0Display}))`
			);
			submiting();
			const result7 = await sidecarApi.submitTransaction(
				signedProxyAnnouced
			);
			console.log(`Node response: `, result7.hash);
			const inclusionPoint4 = await chainSync.pollingEventListener(
				'balances',
				'Transfer'
			);
			console.log(
				'proxy.proxyAnnounced(origin: Eve, call: ${c0Display})) succesfully included at',
				inclusionPoint4
			);
			logSeperator();
		});

	console.log(
		`\nSimultanously sending ${c0Display} to the safety worker for decoding` +
			' and verification that the transfer is going to cold storage'
	);
	transactionConstruct.safetyWorker({
		unsigned: transferToColdStorage,
		registry: transferToColdStorageRegistry,
		metadataRpc: transferToColdStorageMetadataRpc,
	});
	logSeperator();
}

async function setupProxyForMultisig(
	multisigAddr: string,
	transactionConstruct: TransactionConstruct,
	chainSync: ChainSync,
	sidecarApi: SidecarApi,
	keys: Keys,
	ss58Prefix: number,
	delayPeriod: number,
	maxWeight: number
): Promise<void> {
	// construct tx to add Eve as a proxy to multisig address

	const {
		unsigned: { method: addProxyEveMethod },
	} = await transactionConstruct.proxyAddProxy(
		multisigAddr,
		keys.eve.address,
		'Any',
		delayPeriod
	);
	const addProxyEveDisplay =
		'proxy.addProxy(origin: multisig address, proxy: eve)';
	const addProxyEveHash = blake2AsHex(addProxyEveMethod, 256);

	// construct tx for Bob to approve adding Eve as a proxy to the multi sig address
	const approveAsMulti = await transactionConstruct.multiSigApproveAsMulti(
		keys.bob.address,
		2,
		sortAddresses([keys.alice.address, keys.dave.address], ss58Prefix),
		null,
		addProxyEveHash,
		maxWeight
	);
	const signedApproveAsMulti = transactionConstruct.createAndSignTransaction(
		keys.bob,
		approveAsMulti
	);
	console.log(
		`multisig.approveAsMulti(origin: Bob , callHash: h(${addProxyEveDisplay}))`
	);
	submiting();
	const nodeRes2 = await sidecarApi.submitTransaction(signedApproveAsMulti);
	console.log(`Node response: `, nodeRes2.hash);
	const inclusionPoint2 = await chainSync.pollingEventListener(
		'multisig',
		'NewMultisig'
	);
	console.log(
		`multisig.approveAsMulti(origin: Bob , callHash: h(${addProxyEveDisplay})) succesfully included at `,
		inclusionPoint2
	);
	logSeperator();

	// construct transaction for Dave to approve and execute adding Eve as a proxy to the multisig address
	const asMulti = await transactionConstruct.multiSigAsMulti(
		keys.dave.address,
		2,
		sortAddresses([keys.alice.address, keys.bob.address], ss58Prefix),
		inclusionPoint2,
		addProxyEveMethod,
		false,
		maxWeight
	);
	const signedAsMulti = transactionConstruct.createAndSignTransaction(
		keys.dave,
		asMulti
	);
	console.log(`multisig.asMulti(origin: Dave, call: ${addProxyEveDisplay})`);
	console.log('...submiting 🚀\n');
	const result3 = await sidecarApi.submitTransaction(signedAsMulti);
	console.log(`Node response: `, result3.hash);
	const inlusionPoint3 = await chainSync.pollingEventListener(
		'multisig',
		'MultisigExecuted'
	);
	console.log(
		'multisig.asMulti(origin: Dave, call: ${addProxyEveDisplay}) succsefully included at ',
		inlusionPoint3
	);
	logSeperator();
}

async function depositerTransferToDeriv(
	transactionConstruct: TransactionConstruct,
	chainSync: ChainSync,
	sidecarApi: SidecarApi,
	keys: Keys,
	deriveAddr0: string,
	deriveAddr1: string
): Promise<void> {
	const transferToD0 = await transactionConstruct.balancesTransfer(
		keys.charlie.address,
		deriveAddr0,
		'1234567890123450'
	);
	const signedTransferToD0 = transactionConstruct.createAndSignTransaction(
		keys.charlie,
		transferToD0
	);
	console.log('balances.transfer(origin: Charlie, dest: derive address 0)');
	submiting();
	const nodeRes1 = await sidecarApi.submitTransaction(signedTransferToD0);
	console.log(`Node response: `, nodeRes1.hash);
	const inclusionPoint1 = await chainSync.pollingEventListener(
		'balances',
		'Transfer'
	);
	if (!inclusionPoint1) throw 'inclusionPoint1 is null';
	console.log(
		'balances.transfer(origin: Charlie, dest: derive address 0) sucessfully included at ',
		inclusionPoint1
	);
	logSeperator();

	const transferToD1 = await transactionConstruct.balancesTransfer(
		keys.charlie.address,
		deriveAddr1,
		'1234567890123450',
		inclusionPoint1.height + 1
	);
	const signedTransferToD1 = transactionConstruct.createAndSignTransaction(
		keys.charlie,
		transferToD1
	);

	console.log('balances.transfer(origin: Charlie, dest: derive address 1)');
	submiting();
	const nodeRes2 = await sidecarApi.submitTransaction(signedTransferToD1);
	console.log(`Node response: `, nodeRes2.hash);
	const inclusionPoint2 = await chainSync.pollingEventListener(
		'balances',
		'Transfer'
	);
	console.log(
		'balances.transfer(origin: Charlie, dest: derive address 1) succesfully included at ',
		inclusionPoint2
	);
	logSeperator();
}
