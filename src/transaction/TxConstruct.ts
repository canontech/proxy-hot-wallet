import { TypeRegistry } from '@polkadot/types';
import { TRANSACTION_VERSION } from '@polkadot/types/extrinsic/v4/Extrinsic';
import * as txwrapper from '@substrate/txwrapper';
import { KeyringPair } from '@substrate/txwrapper';
import { createMetadata } from '@substrate/txwrapper/lib/util';

import SidecarApi from '../sidecar/SidecarApi';

interface BaseInfo {
	nonce: number;
	eraPeriod: number;
	blockHash: string;
	blockNumber: number;
	specVersion: number;
	genesisHash: string;
	metadataRpc: string;
	transactionVersion: number;
}

type ChainName = 'Kusama' | 'Polkadot' | 'Polkadot CC1' | 'Westend';

type SpecName = 'kusama' | 'polkadot' | 'westend';

export class TxConstruct {
	private api: SidecarApi;
	private readonly ERA_PERIOD = 64;
	private readonly EXTRINSIC_VERSION = TRANSACTION_VERSION;

	constructor(sidecarURL: string) {
		this.api = new SidecarApi(sidecarURL);
	}

	private async fetchTransactionMaterial(
		originAddress: string
	): Promise<{ baseInfo: BaseInfo; registry: TypeRegistry }> {
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
		} = await this.api.getAccountBalance(originAddress);

		const registry = txwrapper.getRegistry(
			chainName as ChainName,
			specName as SpecName,
			parseInt(specVersion),
			metadataRpc
		);

		const baseInfo = {
			nonce: parseInt(nonce),
			eraPeriod: this.ERA_PERIOD,
			blockHash,
			blockNumber: parseInt(height),
			specVersion: parseInt(specVersion),
			genesisHash,
			metadataRpc,
			transactionVersion: parseInt(txVersion),
		};

		return { baseInfo, registry };
	}

	// TODO proxyType can be of type string literal "Any" | "Democracy" etc..
	async proxyAddProxy(
		origin: KeyringPair,
		delegate: string,
		proxyType: string,
		delay: number,
		tip?: number
	): Promise<string> {
		const { baseInfo, registry } = await this.fetchTransactionMaterial(
			origin.address
		);
		const { metadataRpc } = baseInfo;

		const unsigned = txwrapper.proxy.addProxy(
			{ delegate, proxyType, delay },
			{
				address: origin.address,
				tip,
				...baseInfo,
			},
			{ metadataRpc, registry }
		);

		return this.createSignedTransaction(
			unsigned,
			origin,
			registry,
			metadataRpc
		);
	}

	/**
	 * Create a signed balances transfer.
	 *
	 * @param from Keyring pair of the signing account
	 * @param to address to `value` amount of native token to.
	 * @param value amoutn of token to send
	 */
	async balancesTransfer(
		origin: KeyringPair,
		dest: string,
		value: string,
		tip?: number
	): Promise<string> {
		const { baseInfo, registry } = await this.fetchTransactionMaterial(
			origin.address
		);
		const { metadataRpc } = baseInfo;

		const unsigned = txwrapper.balances.transfer(
			{ dest, value },
			{
				address: origin.address,
				tip,
				...baseInfo,
			},
			{ metadataRpc, registry }
		);

		return this.createSignedTransaction(
			unsigned,
			origin,
			registry,
			metadataRpc
		);
	}

	private createSignedTransaction(
		unsigned: txwrapper.UnsignedTransaction,
		origin: KeyringPair,
		registry: TypeRegistry,
		metadataRpc: string
	): string {
		registry.setMetadata(createMetadata(registry, metadataRpc));

		const signingPayload = txwrapper.createSigningPayload(unsigned, {
			registry,
		});

		const { signature } = registry
			.createType('ExtrinsicPayload', signingPayload, {
				version: this.EXTRINSIC_VERSION,
			})
			.sign(origin);

		return txwrapper.createSignedTx(unsigned, signature, {
			registry,
			metadataRpc,
		});
	}
}
