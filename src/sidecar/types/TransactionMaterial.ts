import { At } from './At';

export interface TransactionMaterial {
	at: At;
	genesisHash: string;
	chainName: string;
	specName: string;
	specVersion: string;
	txversion: string;
	metadata: string;
}
