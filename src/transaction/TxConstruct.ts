import { TypeRegistry } from '@polkadot/types';
import { TRANSACTION_VERSION } from '@polkadot/types/extrinsic/v4/Extrinsic';
import * as txwrapper from '@substrate/txwrapper';
import { KeyringPair } from '@substrate/txwrapper';
import { createMetadata } from '@substrate/txwrapper/lib/util';

import SidecarApi from '../sidecar/SidecarApi';

type ChainName = 'Kusama' | 'Polkadot' | 'Polkadot CC1' | 'Westend';

type SpecName = 'kusama' | 'polkadot' | 'westend';

export class TxConstruct {
	private api: SidecarApi;
	private readonly ERA_PERIOD = 64;
	private readonly EXTRINSIC_VERSION = TRANSACTION_VERSION;

	constructor(sidecarURL: string) {
		this.api = new SidecarApi(sidecarURL);
	}

	/**
	 * Create a signed balances transfer.
	 *
	 * @param from Keyring pair of the signing account
	 * @param to address to `value` amount of native token to.
	 * @param value amoutn of token to send
	 */
	async balancesTransfer(
		signer: KeyringPair,
		dest: string,
		value: string,
		tip?: number
	): Promise<string> {
		const {
			genesisHash,
			txVersion,
			specVersion,
			chainName,
			specName,
			metadata: metadataRpc,
		} = await this.api.getTransactionMaterial();

		const {
			at: { hash: blockHash, height },
			nonce,
		} = await this.api.getAccountBalance(signer.address);

		const registry = txwrapper.getRegistry(
			chainName as ChainName,
			specName as SpecName,
			parseInt(specVersion),
			metadataRpc
		);

		const unsigned = txwrapper.balances.transfer(
			{ dest, value },
			{
				address: signer.address,
				tip,
				nonce: parseInt(nonce),
				eraPeriod: this.ERA_PERIOD,
				blockHash,
				blockNumber: parseInt(height),
				specVersion: parseInt(specVersion),
				genesisHash,
				metadataRpc,
				transactionVersion: parseInt(txVersion),
			},
			{ metadataRpc, registry }
		);

		const signingPayload = txwrapper.createSigningPayload(unsigned, {
			registry,
		});

		const;
	}

	private signWith(
		pair: KeyringPair,
		signingPayload: string,
		registry: TypeRegistry,
		metadataRpc: string
	): string {
		// Important! The registry needs to be updated with latest metadata, so make
		// sure to run `registry.setMetadata(metadata)` before signing.
		registry.setMetadata(createMetadata(registry, metadataRpc));

		// const { signature } = registry
		// 	.createType('ExtrinsicPayload', signingPayload, {
		// 		version: TRANSACTION_VERSION,
		// 	})
		// 	.sign(pair);

		// return signature;
	}

	private createSignedTransaction(
		unsigned: string,
		signer: KeyringPair,
		registry: TypeRegistry,
		metadataRpc: string
	): string {
		registry.setMetadata(createMetadata(registry, metadataRpc));

		const signing

		const { signature } = registry
			.createType('ExtrinsicPayload', unsigned., {
				version: this.EXTRINSIC_VERSION,
			})
			.sign(signer);

			txwrapper.createSignedTx()
	}
}
