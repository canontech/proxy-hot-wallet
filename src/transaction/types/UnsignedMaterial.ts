import { TypeRegistry } from '@polkadot/types';
import * as txwrapper from '@substrate/txwrapper';

export interface UnsignedMaterial {
	unsigned: txwrapper.UnsignedTransaction;
	metadataRpc: string;
	registry: TypeRegistry;
}
