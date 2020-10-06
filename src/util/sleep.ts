import { promisify } from 'util';

export async function sleep(ms: number): Promise<void> {
	const s = promisify(setTimeout);
	await s(ms);
	return;
}
