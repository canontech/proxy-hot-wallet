import { decodeAddress, encodeAddress } from '@polkadot/keyring';
import { u8aSorted } from '@polkadot/util';

export function sortAddresses(
	addresses: string[],
	ss58Prefix?: number
): string[] {
	return u8aSorted(
		addresses.map((addr) => decodeAddress(addr))
	).map((pubkey) => encodeAddress(pubkey, ss58Prefix));
}
