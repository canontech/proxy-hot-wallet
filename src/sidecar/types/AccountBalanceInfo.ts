import { At } from './At';

export interface AccountBalanceInfo {
	at: At;
	nonce: string;
	free: string;
	reserved: string;
	miscFrozen: string;
	feeFrozen: string;
	locks: Array<string>;
}
