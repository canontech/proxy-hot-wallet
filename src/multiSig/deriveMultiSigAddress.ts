import { decodeAddress, encodeAddress } from '@polkadot/keyring';
import { u8aSorted } from '@polkadot/util';
import { blake2AsU8a } from '@polkadot/util-crypto';

const derivePubkey = (addresses: string[], threshold = 1): Uint8Array => {
	const prefix = 'modlpy/utilisuba';
	const payload = new Uint8Array(
		prefix.length + 1 + 32 * addresses.length + 2
	);
	payload.set(
		prefix.split('').map((c) => c.charCodeAt(0)),
		0
	);
	payload[prefix.length] = addresses.length << 2;
	const pubkeys = addresses.map((addr) => decodeAddress(addr));
	u8aSorted(pubkeys).forEach((pubkey, idx) => {
		payload.set(pubkey, prefix.length + 1 + idx * 32);
	});
	payload[prefix.length + 1 + 32 * addresses.length] = threshold;

	return blake2AsU8a(payload);
};

/**
 * Derive a multisig address from a set of addresses, a threshold (lte count of
 * address), and a network ss58 prefix.
 *
 * @param addresses Addresses that compromise multisig account
 * @param ss58Prefix Prefix for the network encoding to use.
 * @param threshold Number of addresses that are needed to approve an action.
 */
export const deriveMultiSigAddress = (
	addresses: string[],
	ss58Prefix: number,
	threshold: number
): string => {
	const pubkey = derivePubkey(addresses, threshold);
	return encodeAddress(pubkey, ss58Prefix);

	// console.log('-'.repeat(32));
	// console.log('Multisig address generation info');
	// console.log(`Addresses: ${addrs.join(' ')}`);
	// console.log(`Threshold: ${threshold}`);
	// console.log(`Multisig Address (SS58: ${ss58Prefix}): ${msig}`);
	// console.log('-'.repeat(32));
};
