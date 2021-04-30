import axios, { AxiosError, AxiosInstance } from 'axios';

import { sleep } from '../util';
import { AccountBalanceInfo } from './types/AccountBalanceInfo';
import { Block } from './types/Block';
import { TransactionMaterial } from './types/TransactionMaterial';

type ApiResponse = {
	data: TransactionMaterial | Block | AccountBalanceInfo;
};

export class SidecarApi {
	private api: AxiosInstance;
	readonly SECOND = 1_000;
	constructor(sidecarBaseUrl: string) {
		this.api = axios.create({ baseURL: sidecarBaseUrl });
	}

	/**
	 * Execute a get request to `uri` with exponential backoff for failed request
	 * retry attempts.
	 *
	 * @param uri URI
	 * @param attempts only for recursive cases
	 */
	private async retryGet(uri: string, attempts = 0): Promise<ApiResponse> {
		try {
			return await this.api.get(uri);
		} catch (e) {
			// Exponential back for up to 3 trys
			if (attempts < 3) {
				console.error(`Attempt ${attempts} for sidecar endpoint ${uri}`);
				attempts += 1;
				await sleep(2 * attempts * this.SECOND);
				return await this.retryGet(uri, attempts);
			}
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			if (e?.isAxiosError) {
				const {
					response,
					config: { url, method },
				} = e as AxiosError<Error>;

				throw {
					method,
					url,
					status: response?.status,
					statusText: response?.statusText,
				};
			}

			throw e;
		}
	}

	async getBlock(num?: number): Promise<Block> {
		const response = num
			? await this.retryGet(`/blocks/${num}`)
			: await this.retryGet(`/blocks/head`);

		return response.data as Block;
	}

	async getAccountBalance(
		account: string,
		height?: number
	): Promise<AccountBalanceInfo> {
		const response = height
			? await this.retryGet(`/accounts/${account}/balance-info?at=${height}`)
			: await this.retryGet(`/accounts/${account}/balance-info`);

		return response.data as AccountBalanceInfo;
	}

	async getTransactionMaterial({
		height,
		noMeta,
	}: {
		height?: number;
		noMeta?: boolean;
	}): Promise<TransactionMaterial> {
		let uri = `transaction/material`;
		if (typeof height === 'number' || noMeta) {
			uri += '?';
		}

		if (typeof height === 'number') {
			uri += `at=${height}&`;
		}

		if (noMeta) {
			uri += 'noMeta=true';
		}

		const response = await this.retryGet(uri);

		return response.data as TransactionMaterial;
	}

	async submitTransaction(tx: string): Promise<{ hash: string }> {
		try {
			return (await this.api.post('/transaction', { tx })).data as {
				hash: string;
			};
		} catch (e) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			if (e?.isAxiosError) {
				const {
					response,
					config: { url, method },
				} = e as AxiosError<Error>;

				throw {
					method,
					url,
					status: response?.status,
					statusText: response?.statusText,
				};
			}

			throw e;
		}
	}
}
