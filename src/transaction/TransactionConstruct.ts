import { TypeRegistry } from '@polkadot/types';
import { EXTRINSIC_VERSION } from '@polkadot/types/extrinsic/v4/Extrinsic';
import { AnyJson } from '@polkadot/types/types';
import * as txwrapper from '@substrate/txwrapper';
import { KeyringPair } from '@substrate/txwrapper';
import { createMetadata } from '@substrate/txwrapper/lib/util';
import { Args, createMethod } from '@substrate/txwrapper/lib/util/method';
import {
	BaseTxInfo,
	OptionsWithMeta,
} from '@substrate/txwrapper/lib/util/types';

import { SidecarApi } from '../sidecar/SidecarApi';
import { BaseInfo, MaybeTimepoint, UnsignedMaterial } from './types';

type ChainName = 'Kusama' | 'Polkadot' | 'Polkadot CC1' | 'Westend';

type SpecName = 'kusama' | 'polkadot' | 'westend';

// TODO - all transaction method could optionally take in metadata RPC to avoid
// expensive calls by using  `/transaction/material?noMeta=true`.
export class TransactionConstruct {
	private sidecarApi: SidecarApi;
	private readonly ERA_PERIOD = 64;

	constructor(sidecarURL: string, readonly coldStorage: string) {
		this.sidecarApi = new SidecarApi(sidecarURL);
	}

	private async fetchTransactionMaterial(
		originAddress: string,
		heightParam?: number
	): Promise<{ baseInfo: BaseInfo; registry: TypeRegistry }> {
		const {
			genesisHash,
			txVersion,
			specVersion,
			chainName,
			specName,
			metadata: metadataRpc,
		} = await this.sidecarApi.getTransactionMaterial(heightParam);

		const {
			at: { hash: blockHash, height },
			nonce,
		} = await this.sidecarApi.getAccountBalance(originAddress);

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

	async multiSigApproveAsMulti(
		origin: string,
		threshold: number,
		otherSignatories: string[],
		maybeTimepointArg: MaybeTimepoint | null,
		callHash: string,
		maxWeight: number,
		tip?: number
	): Promise<UnsignedMaterial> {
		interface ApproveAsMultiArgs extends Args {
			threshold: number;
			otherSignatories: string[];
			maybeTimepoint: AnyJson;
			callHash: string;
			maxWeight: number;
		}

		const approveAsMulti = function (
			args: ApproveAsMultiArgs,
			info: BaseTxInfo,
			options: OptionsWithMeta
		): txwrapper.UnsignedTransaction {
			return createMethod(
				{
					method: {
						args,
						name: 'approveAsMulti',
						pallet: 'multisig',
					},
					...info,
				},
				options
			);
		};

		const { baseInfo, registry } = await this.fetchTransactionMaterial(
			origin
		);
		const { metadataRpc } = baseInfo;

		const unsigned = approveAsMulti(
			{
				threshold,
				otherSignatories,
				maybeTimepoint:
					maybeTimepointArg === null
						? null
						: registry
								.createType(
									'Option<Timepoint>',
									maybeTimepointArg
								)
								.toJSON(),
				callHash,
				maxWeight,
			},
			{
				address: origin,
				tip,
				...baseInfo,
			},
			{ metadataRpc, registry }
		);

		return { unsigned, metadataRpc, registry };
	}

	async multiSigAsMulti(
		origin: string,
		threshold: number,
		otherSignatories: string[],
		maybeTimepointArg: MaybeTimepoint | null,
		call: string,
		storeCall: boolean,
		maxWeight: number,
		tip?: number
	): Promise<UnsignedMaterial> {
		interface AsMultiArgs extends Args {
			threshold: number;
			otherSignatories: string[];
			maybeTimepoint: AnyJson;
			call: string;
			storeCall: boolean;
			maxWeight: number;
		}

		const asMulti = function (
			args: AsMultiArgs,
			info: BaseTxInfo,
			options: OptionsWithMeta
		): txwrapper.UnsignedTransaction {
			return createMethod(
				{
					method: {
						args,
						name: 'asMulti',
						pallet: 'multisig',
					},
					...info,
				},
				options
			);
		};

		const { baseInfo, registry } = await this.fetchTransactionMaterial(
			origin
		);
		const { metadataRpc } = baseInfo;

		const unsigned = asMulti(
			{
				threshold,
				otherSignatories,
				maybeTimepoint: registry
					.createType('Option<Timepoint>', maybeTimepointArg)
					.toJSON(),
				call,
				storeCall,
				maxWeight,
			},
			{
				address: origin,
				tip,
				...baseInfo,
			},
			{ metadataRpc, registry }
		);

		return { unsigned, metadataRpc, registry };
	}

	// TODO proxyType can be of type string literal "Any" | "Democracy" etc..
	// NOTE: this does not sign transacstion
	async proxyAddProxy(
		origin: string,
		delegate: string,
		proxyType: string,
		delay: number,
		tip?: number
	): Promise<UnsignedMaterial> {
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
		real: string,
		delegate: string,
		forceProxyType: string,
		call: string,
		tip?: number
	): Promise<UnsignedMaterial> {
		const { baseInfo, registry } = await this.fetchTransactionMaterial(
			origin
		);
		const { metadataRpc } = baseInfo;

		const unsigned = txwrapper.proxy.proxyAnnounced(
			{
				real,
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
		callHash: string,
		tip?: number
	): Promise<UnsignedMaterial> {
		const { baseInfo, registry } = await this.fetchTransactionMaterial(
			origin
		);
		const { metadataRpc } = baseInfo;

		const unsigned = txwrapper.proxy.announce(
			{ real, callHash },
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
	): Promise<UnsignedMaterial> {
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
	): Promise<UnsignedMaterial> {
		const { baseInfo, registry } = await this.fetchTransactionMaterial(
			origin
		);
		const { metadataRpc } = baseInfo;
		const unsigned = txwrapper.proxy.rejectAnnouncement(
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
		height?: number,
		tip?: number
	): Promise<UnsignedMaterial> {
		const { baseInfo, registry } = await this.fetchTransactionMaterial(
			origin,
			height
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
	): Promise<UnsignedMaterial> {
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
		{ unsigned, registry, metadataRpc }: UnsignedMaterial
	): string {
		registry.setMetadata(createMetadata(registry, metadataRpc));

		const signingPayload = txwrapper.createSigningPayload(unsigned, {
			registry,
		});

		const { signature } = registry
			.createType('ExtrinsicPayload', signingPayload, {
				version: EXTRINSIC_VERSION,
			})
			.sign(origin);

		return txwrapper.createSignedTx(unsigned, signature, {
			registry,
			metadataRpc,
		});
	}

	safetyWorker({
		unsigned,
		registry,
		metadataRpc,
	}: UnsignedMaterial): boolean {
		const decodedC0 = txwrapper.decode(unsigned, {
			registry,
			metadataRpc,
		});
		console.log(
			'decoded attempt to transfer from derivative account:\n',
			decodedC0.method.args
		);
		const isColdStorageAddress =
			decodedC0.method.args.dest === this.coldStorage;
		console.log(
			'Destination is correct cold storage: ',
			isColdStorageAddress
		);

		return isColdStorageAddress;
	}
}
