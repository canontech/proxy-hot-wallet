import { Keyring } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { cryptoWaitReady } from '@polkadot/util-crypto';

export interface Keys {
	alice: KeyringPair;
	aliceStash: KeyringPair;
	bob: KeyringPair;
	dave: KeyringPair;
	eve: KeyringPair;
	charlie: KeyringPair;
	ferdie: KeyringPair;
	attacker: KeyringPair;
}

export async function createDemoKeyPairs(): Promise<Keys> {
	// References
	// https://github.com/paritytech/substrate/blob/833fe6259115625f61347c8413bab29fded31210/primitives/core/src/crypto.rs#L52
	// Alice is 'bottom drive obey lake curtain smoke basket hold race lonely fit walk//Alice'

	await cryptoWaitReady();

	const keyring: Keyring = new Keyring();

	const alice = keyring.addFromUri('//Alice', { name: 'Alice' }, 'sr25519');
	const aliceStash = keyring.addFromUri(
		'//Alice//stash',
		{ name: 'Alice Stash' },
		'sr25519'
	);
	const bob = keyring.addFromUri('//Bob', { name: 'Bob' }, 'sr25519');
	const dave = keyring.addFromUri('//Dave', { name: 'Dave' }, 'sr25519');
	const eve = keyring.addFromUri('//Eve', { name: 'Eve' }, 'sr25519');
	const charlie = keyring.addFromUri(
		'//Charlie',
		{ name: 'Charlie' },
		'sr25519'
	);
	const ferdie = keyring.addFromUri(
		'//Ferdie',
		{ name: 'Ferdie' },
		'sr25519'
	);
	const attacker = keyring.addFromUri(
		'//Attacker',
		{ name: 'Attacker' },
		'sr25519'
	);

	return {
		// Comments represent roles in proxy + multisig hot wallet demo
		// stash
		aliceStash,
		// multisig
		alice,
		// multisig
		bob,
		// multisig
		dave,
		// proxy
		eve,
		// depositer
		charlie,
		// extra pair for convience
		ferdie,
		attacker,
	};
}
