import * as txwrapper from '@substrate/txwrapper';
import { KeyringPair } from '@substrate/txwrapper';

/**
 * Execute a balances transfer.
 *
 * @param from Keyring pair of the signing account
 * @param to address to `value` amount of native token to.
 * @param value amoutn of token to send
 */
export function balancesTransfer(
	signer: KeyringPair,
	dest: string,
	value: string,
	tip?: string
): string {
	const material = 
	txwrapper.balances.transfer(
		{
			dest,
			value,
		},
		{
			address: signer.address,
			tip,
			eraPeriod: 64,
			transactionVersion
		},
		{}
	);
}
