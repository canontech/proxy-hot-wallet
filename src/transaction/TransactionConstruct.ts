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
import {
	BaseInfo,
	MaybeTimepoint,
	TransactionOpts,
	UnsignedMaterial,
} from './types';

type ChainName = 'Kusama' | 'Polkadot' | 'Polkadot CC1' | 'Westend';

type SpecName = 'kusama' | 'polkadot' | 'westend';

export class TransactionConstruct {
	private sidecarApi: SidecarApi;
	private readonly ERA_PERIOD = 64;

	constructor(sidecarURL: string, readonly coldStorage: string) {
		this.sidecarApi = new SidecarApi(sidecarURL);
	}

	private async fetchTransactionMaterial({
		origin,
		height: heightParam,
		metadataRpc: metadataRpcParam,
	}: TransactionOpts): Promise<{
		baseInfo: BaseInfo;
		registry: TypeRegistry;
	}> {
		const {
			genesisHash,
			txVersion,
			specVersion,
			chainName,
			specName,
			metadata: metadataRpc,
		} = await this.sidecarApi.getTransactionMaterial({
			height: heightParam,
			noMeta: !!metadataRpcParam,
		});

		const {
			at: { hash: blockHash, height },
			nonce,
		} = await this.sidecarApi.getAccountBalance(origin);

		const registry = txwrapper.getRegistry(
			chainName as ChainName,
			specName as SpecName,
			parseInt(specVersion),
			metadataRpc || metadataRpcParam
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
		{ origin, tip, height, metadataRpc }: TransactionOpts,
		threshold: number,
		otherSignatories: string[],
		maybeTimepointArg: MaybeTimepoint | null,
		callHash: string,
		maxWeight: number
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

		const { baseInfo, registry } = await this.fetchTransactionMaterial({
			origin,
			height,
			metadataRpc,
		});

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
			{ metadataRpc: baseInfo.metadataRpc, registry }
		);

		return { unsigned, metadataRpc: baseInfo.metadataRpc, registry };
	}

	async multiSigAsMulti(
		{ origin, tip, height, metadataRpc }: TransactionOpts,
		threshold: number,
		otherSignatories: string[],
		maybeTimepointArg: MaybeTimepoint | null,
		call: string,
		storeCall: boolean,
		maxWeight: number
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

		const { baseInfo, registry } = await this.fetchTransactionMaterial({
			origin,
			height,
			metadataRpc,
		});

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
			{ metadataRpc: baseInfo.metadataRpc, registry }
		);

		return { unsigned, metadataRpc: baseInfo.metadataRpc, registry };
	}

	async proxyAddProxy(
		{ origin, tip, height, metadataRpc }: TransactionOpts,
		delegate: string,
		proxyType: string,
		delay: number
	): Promise<UnsignedMaterial> {
		const { baseInfo, registry } = await this.fetchTransactionMaterial({
			origin,
			height,
			metadataRpc,
		});

		const unsigned = txwrapper.proxy.addProxy(
			{ delegate, proxyType, delay },
			{
				address: origin,
				tip,
				...baseInfo,
			},
			{ metadataRpc: baseInfo.metadataRpc, registry }
		);

		return {
			unsigned,
			metadataRpc: baseInfo.metadataRpc,
			registry,
		};
	}

	async proxyProxyAnnounced(
		{ origin, tip, height, metadataRpc }: TransactionOpts,
		real: string,
		delegate: string,
		forceProxyType: string,
		call: string
	): Promise<UnsignedMaterial> {
		const { baseInfo, registry } = await this.fetchTransactionMaterial({
			origin,
			height,
			metadataRpc,
		});

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
			{ metadataRpc: baseInfo.metadataRpc, registry }
		);

		return { unsigned, registry, metadataRpc: baseInfo.metadataRpc };
	}

	async proxyAnnounce(
		{ origin, tip, height, metadataRpc }: TransactionOpts,
		real: string,
		callHash: string
	): Promise<UnsignedMaterial> {
		const { baseInfo, registry } = await this.fetchTransactionMaterial({
			origin,
			height,
			metadataRpc,
		});

		const unsigned = txwrapper.proxy.announce(
			{ real, callHash },
			{
				address: origin,
				tip,
				...baseInfo,
			},
			{ metadataRpc: baseInfo.metadataRpc, registry }
		);

		return { unsigned, registry, metadataRpc: baseInfo.metadataRpc };
	}

	async proxyRemoveProxies({
		origin,
		tip,
		height,
		metadataRpc,
	}: TransactionOpts): Promise<UnsignedMaterial> {
		const { baseInfo, registry } = await this.fetchTransactionMaterial({
			origin,
			height,
			metadataRpc,
		});

		const unsigned = txwrapper.proxy.removeProxies(
			{},
			{
				address: origin,
				tip,
				...baseInfo,
			},
			{ metadataRpc: baseInfo.metadataRpc, registry }
		);

		return { unsigned, registry, metadataRpc: baseInfo.metadataRpc };
	}

	async proxyRejectAnnouncement(
		{ origin, tip, height, metadataRpc }: TransactionOpts,
		delegate: string,
		callHash: string
	): Promise<UnsignedMaterial> {
		const { baseInfo, registry } = await this.fetchTransactionMaterial({
			origin,
			height,
			metadataRpc,
		});

		const unsigned = txwrapper.proxy.rejectAnnouncement(
			{ delegate, callHash },
			{
				address: origin,
				tip,
				...baseInfo,
			},
			{ metadataRpc: baseInfo.metadataRpc, registry }
		);
		return { unsigned, registry, metadataRpc: baseInfo.metadataRpc };
	}

	async balancesTransfer(
		{ origin, tip, height, metadataRpc }: TransactionOpts,
		dest: string,
		value: string
	): Promise<UnsignedMaterial> {
		const { baseInfo, registry } = await this.fetchTransactionMaterial({
			origin,
			height,
			metadataRpc,
		});

		const unsigned = txwrapper.balances.transfer(
			{ dest, value },
			{
				address: origin,
				tip,
				...baseInfo,
			},
			{ metadataRpc: baseInfo.metadataRpc, registry }
		);

		return { unsigned, registry, metadataRpc: baseInfo.metadataRpc };
	}

	async utilityAsDerivative(
		{ origin, tip, height, metadataRpc }: TransactionOpts,
		index: number,
		call: string
	): Promise<UnsignedMaterial> {
		const { baseInfo, registry } = await this.fetchTransactionMaterial({
			origin,
			height,
			metadataRpc,
		});

		const unsigned = txwrapper.utility.asDerivative(
			{ index, call },
			{
				address: origin,
				tip,
				...baseInfo,
			},
			{ metadataRpc: baseInfo.metadataRpc, registry }
		);

		return { unsigned, registry, metadataRpc: baseInfo.metadataRpc };
	}

	/**
	 * Create the signing payload, create a signature from the payload, and then
	 * returned the payload with the signature attached
	 *
	 * @param origin
	 * @param unsignedMaterial
	 */
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

	/**
	 * Simple function to check if a call is balance transfer to the cold storage
	 * address given on instance initizilation.
	 */
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
			'Decoded attempt to transfer from derivative account:\n',
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
