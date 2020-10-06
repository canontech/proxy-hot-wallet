import { SidecarApi } from '../sidecar/SidecarApi';
import { sleep } from '../util/sleep';

export class ChainSync {
	private sidecarApi: SidecarApi;
	private readonly SECOND = 1_000;

	constructor(sidecarURL: string) {
		this.sidecarApi = new SidecarApi(sidecarURL);
	}

	async pollingEventListener(
		pallet: string,
		method: string,
		// In real life you would need to check the events data, however for this demo we don't
		_data?: string[]
	): Promise<number | null> {
		const searching = true;
		while (searching) {
			const block = await this.sidecarApi.getBlock();

			for (const ext of block.extrinsics) {
				for (const {
					method: { method: evMethod, pallet: evPallet },
				} of ext.events) {
					if (evMethod === 'ExtrinsicFailed') {
						// throw `unexepcted extrinsic failure at block number ${block.number}`;
						console.log(
							`unexepcted extrinsic failure at block number ${block.number}`
						);
						return parseInt(block.number);
					}

					if (evMethod === method && evPallet === pallet) {
						return parseInt(block.number);
					}

					if (pallet === evPallet && method === evMethod) throw 'hi';
				}
			}

			await sleep(this.SECOND / 2);
		}

		return null;
	}

	private eventDataEq(d1: string[], d2: string[]) {
		return (
			d1.length === d2.length && d1.every((ele, idx) => ele === d2[idx])
		);
	}
}
