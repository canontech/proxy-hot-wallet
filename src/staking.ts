import { blake2AsHex } from '@polkadot/util-crypto';
import {
	encodeDerivedAddress,
	encodeMultiAddress,
} from '@polkadot/util-crypto';

import { ChainSync } from './ChainSync';
import { createDemoKeyPairs, Keys } from './keyring';
import { SidecarApi } from './sidecar/SidecarApi';
import { TransactionConstruct } from './transaction/TransactionConstruct';
import {
	logSeperator,
	sortAddresses,
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

	/* Create Anon proxy with eve */
	const anonymousProxy = transactionConstruct.proxyAnonymous({ origin: keys.eve.address}, 'Any', 10, 0)

	/* Generate staking multisig address */
	/**
	 * Staking multisig members addresses.
	 */
	const stakingMultiMembers = [keys.alice.address, keys.bob.address, keys.dave.address];
	const threshold = 2;
	const ss58Prefix = 42;
	/**
	 * Staking multisig address
	 */
	const stakingMultiAddr = encodeMultiAddress(stakingMultiMembers, threshold, ss58Prefix);

	console.log('Staking multisig address generation info');
	console.log(`Addresses: ${stakingMultiMembers.join(' ')}`);
	console.log(`Threshold: ${threshold}`);
	console.log(`Staking multisig Address (SS58: ${ss58Prefix}): ${stakingMultiAddr}`);
	logSeperator();
	await waitToContinue();
}