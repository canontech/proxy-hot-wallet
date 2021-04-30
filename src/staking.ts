import {
	blake2AsHex,
	// encodeDerivedAddress,
	encodeMultiAddress,
} from '@polkadot/util-crypto';

import { ChainSync } from './ChainSync';
import { createDemoKeyPairs } from './keyring';
import { SidecarApi } from './sidecar/SidecarApi';
import { TransactionConstruct } from './transaction/TransactionConstruct';
import {
	logSeperator,
	sortAddresses,
	submiting,
	waiting,
	waitToContinue,
} from './util';

/**
 * flow
 * - Eve creates Anon proxy
 * - Eve adds 1/n multisig as a staking proxy to anon proxy with announcement
 * - A multisig member makes proxy(staking.bond) on behalf of anon proxy
 * - chain watch dog monitors for any unexpected announcementes by querying announcement storage
 */

const sidecarUrl = 'http://127.0.0.1:8080';

async function main() {
	const keys = await createDemoKeyPairs();
	const sidecarApi = new SidecarApi(sidecarUrl);
	const chainSync = new ChainSync(sidecarUrl);
	const transactionConstruct = new TransactionConstruct(
		sidecarUrl,
		keys.aliceStash.address
	);

	/* Generate staking multisig address */
	/**
	 * Staking multisig members addresses.
	 */
	const stakingMultiMembers = [
		keys.alice.address,
		keys.bob.address,
		keys.dave.address,
	];
	const threshold = 2;
	const ss58Prefix = 0;
	/**
	 * Staking multisig address
	 */
	const stakingMultiAddr = encodeMultiAddress(
		stakingMultiMembers,
		threshold,
		ss58Prefix
	);

	console.log('Staking multisig address generation info');
	console.log(`Addresses: ${stakingMultiMembers.join(', ')}`);
	console.log(`Threshold: ${threshold}`);
	console.log(
		`Staking multisig Address (SS58: ${ss58Prefix}): ${stakingMultiAddr}`
	);
	logSeperator();
	await waitToContinue();

	// Load up multisig account with currency so it can make transactions
	const trasnferValue = '123456789012345';
	const transferToStakingMultiCall = await transactionConstruct.balancesTransfer(
		{ origin: keys.alice.address },
		stakingMultiAddr,
		trasnferValue
	);
	const signedTransferToStakingMultiCall = transactionConstruct.createAndSignTransaction(
		keys.alice,
		transferToStakingMultiCall
	);
	console.log(
		`balances.transfer(origin: Alice, dest: staking multisig address)`
	);
	submiting();
	const nodeRes1 = await sidecarApi.submitTransaction(
		signedTransferToStakingMultiCall
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
	await waitToContinue();

	/* Create an Anonynmous account with the staking teams multisig */

	const {
		unsigned: { method: createAnonMethod },
	} = await transactionConstruct.proxyAnonymous(
		{
			origin: stakingMultiAddr,
		},
		'Any', // Proxy type, the most permissive option
		10, // Time delay in blocks. 10 * 6sec = 1 minute
		0 // Disambiguation index
	);
	const createAnonDisplay =
		'proxy.anonymous(origin: staking multisig address, proxyType: Any)';
	const createAnonHash = blake2AsHex(createAnonMethod, 256);

	const maxWeight = 1000000000;

	// construct tx for Bob to approve creation of an Anon account
	const approveAsMulti = await transactionConstruct.multiSigApproveAsMulti(
		{ origin: keys.bob.address },
		2,
		sortAddresses([keys.alice.address, keys.dave.address], ss58Prefix),
		null,
		createAnonHash,
		maxWeight
	);
	const signedApproveAsMulti = transactionConstruct.createAndSignTransaction(
		keys.bob,
		approveAsMulti
	);
	console.log(
		`multisig.approveAsMulti(origin: Bob , callHash: h(${createAnonDisplay}))`
	);
	const nodeRes2 = await sidecarApi.submitTransaction(signedApproveAsMulti);
	console.log(`Node response: `, nodeRes2.hash);
	waiting();
	const inclusionPoint2 = await chainSync.pollingEventListener(
		'multisig',
		'NewMultisig'
	);
	console.log(
		`multisig.approveAsMulti(origin: Bob , callHash: h(${createAnonDisplay})) succesfully included at `,
		inclusionPoint2
	);
	logSeperator();
	await waitToContinue();

	// construct transaction for Dave to approve and execute adding Eve as a proxy to the multisig address
	const asMulti = await transactionConstruct.multiSigAsMulti(
		{ origin: keys.dave.address },
		2,
		sortAddresses([keys.alice.address, keys.bob.address], ss58Prefix),
		inclusionPoint2,
		createAnonMethod,
		false,
		maxWeight
	);
	const signedAsMulti = transactionConstruct.createAndSignTransaction(
		keys.dave,
		asMulti
	);
	console.log(`multisig.asMulti(origin: Dave, call: ${createAnonDisplay})`);
	submiting();
	const result3 = await sidecarApi.submitTransaction(signedAsMulti);
	console.log(`Node response: `, result3.hash);
	waiting();
	const inlusionPoint3 = await chainSync.pollingEventListener(
		'proxy',
		'AnonymousCreated' // TODO clean up inlcusion point displays
	);
	// get the Anon proxy address from the event data
	const anonAddress = (inlusionPoint3 as { data: string[] }).data[0];
	console.log(
		`multisig.asMulti(origin: Dave, call: ${createAnonDisplay}) succsefully included at `,
		inlusionPoint3
	);
	console.log(`Anonymous proxy address: ${anonAddress}`);
	// Now the staking multisig is an any proxy for the Anon account we just create
}

main().catch(console.log);
