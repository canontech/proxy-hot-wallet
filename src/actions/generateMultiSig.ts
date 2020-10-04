import { createDemoKeyPairs } from '../keyring';
import { deriveMultiSigAddress } from '../multiSig/deriveMultiSigAddress';

export async function generateMultiSig(): Promise<string> {
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

	return multisigAddress;
}
