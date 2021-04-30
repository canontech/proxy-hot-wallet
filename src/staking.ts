// import { blake2AsHex } from '@polkadot/util-crypto';
import {
	// encodeDerivedAddress,
	encodeMultiAddress,
} from '@polkadot/util-crypto';

import { ChainSync } from './ChainSync';
import { createDemoKeyPairs } from './keyring';
import { SidecarApi } from './sidecar/SidecarApi';
import { TransactionConstruct } from './transaction/TransactionConstruct';
import {
	logSeperator,
	// sortAddresses,
	submiting,
	waiting,
	waitToContinue,
} from './util';

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
	// const anonymousCall = transactionConstruct.proxyAnonymous(
	// 	{ origin: }
	// )
}

main().catch(console.log);
