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

interface UnsignedCall {
	unsigned: txwrapper.UnsignedTransaction;
	metadataRpc: string;
	registry: TypeRegistry;
}

type ChainName = 'Kusama' | 'Polkadot' | 'Polkadot CC1' | 'Westend';

type SpecName = 'kusama' | 'polkadot' | 'westend';

// TODO - all transaction method could optionally take in metadata RPC to avoid
// expensive calls by using  `/transaction/material?noMeta=true`.
export class TransactionConstruct {
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
	// NOTE: this does not sign transacstion
	async proxyAddProxy(
		origin: string,
		delegate: string,
		proxyType: string,
		delay: number,
		tip?: number
	): Promise<UnsignedCall> {
		const { baseInfo, registry } = await this.fetchTransactionMaterial(
			origin
		);
		const { metadataRpc } = baseInfo;

		const unsigned = txwrapper.proxy.addProxy(
			{ delegate, proxyType, delay },
			{
				address: origin,
				tip,
				...baseInfo,
			},
			{ metadataRpc, registry }
		);

		return {
			unsigned,
			metadataRpc,
			registry,
		};
	}

	async proxyProxyAnnounced(
		origin: string,
		delegate: string,
		forceProxyType: string,
		call: string,
		tip?: number
	): Promise<UnsignedCall> {
		const { baseInfo, registry } = await this.fetchTransactionMaterial(
			origin
		);
		const { metadataRpc } = baseInfo;

		const unsigned = txwrapper.proxy.proxyAnnounced(
			{
				delegate,
				forceProxyType,
				call,
			},
			{
				address: origin,
				tip,
				...baseInfo,
			},
			{ metadataRpc, registry }
		);

		return { unsigned, registry, metadataRpc };
	}

	async proxyAnnounce(
		origin: string,
		real: string,
		callhash: string,
		tip?: number
	): Promise<UnsignedCall> {
		const { baseInfo, registry } = await this.fetchTransactionMaterial(
			origin
		);
		const { metadataRpc } = baseInfo;

		const unsigned = txwrapper.proxy.announce(
			{ real, callhash },
			{
				address: origin,
				tip,
				...baseInfo,
			},
			{ metadataRpc, registry }
		);

		return { unsigned, registry, metadataRpc };
	}

	async proxyRemoveProxies(
		origin: string,
		tip?: number
	): Promise<UnsignedCall> {
		const { baseInfo, registry } = await this.fetchTransactionMaterial(
			origin
		);
		const { metadataRpc } = baseInfo;

		const unsigned = txwrapper.proxy.removeProxies(
			{},
			{
				address: origin,
				tip,
				...baseInfo,
			},
			{ metadataRpc, registry }
		);

		return { unsigned, registry, metadataRpc };
	}

	async proxyRejectAnnouncement(
		origin: string,
		delegate: string,
		callHash: string,
		tip?: number
	): Promise<UnsignedCall> {
		const { baseInfo, registry } = await this.fetchTransactionMaterial(
			origin
		);
		const { metadataRpc } = baseInfo;
		const unsigned = txwrapper.balances.transfer(
			{ delegate, callHash },
			{
				address: origin,
				tip,
				...baseInfo,
			},
			{ metadataRpc, registry }
		);
		return { unsigned, registry, metadataRpc };
	}

	async balancesTransfer(
		origin: string,
		dest: string,
		value: string,
		tip?: number
	): Promise<UnsignedCall> {
		const { baseInfo, registry } = await this.fetchTransactionMaterial(
			origin
		);
		const { metadataRpc } = baseInfo;

		const unsigned = txwrapper.balances.transfer(
			{ dest, value },
			{
				address: origin,
				tip,
				...baseInfo,
			},
			{ metadataRpc, registry }
		);

		return { unsigned, registry, metadataRpc };
	}

	async utilityAsDerivative(
		origin: string,
		index: number,
		call: string,
		tip?: number
	): Promise<UnsignedCall> {
		const { baseInfo, registry } = await this.fetchTransactionMaterial(
			origin
		);
		const { metadataRpc } = baseInfo;

		const unsigned = txwrapper.utility.asDerivative(
			{ index, call },
			{
				address: origin,
				tip,
				...baseInfo,
			},
			{ metadataRpc, registry }
		);

		return { unsigned, registry, metadataRpc };
	}

	createAndSignTransaction(
		origin: KeyringPair,
		{ unsigned, registry, metadataRpc }: UnsignedCall
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
