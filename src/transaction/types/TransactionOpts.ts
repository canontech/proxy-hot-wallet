export interface TransactionOpts {
	/**
	 * Address of the signer
	 */
	origin: string;
	/**
	 * Value of tip in native currency
	 */
	tip?: number;
	/**
	 * Block height to fetch tranaction material at
	 */
	height?: number;
	/**
	 * Scale encoded hex metadata blob. Optional performance enhancement that reduces payload size
	 * from `transaction/material` endpoint. Should only be used if it is known that there will be no
	 * runtime upgrade between transaction contruction and submission.
	 */
	metadataRpc?: string;
}
