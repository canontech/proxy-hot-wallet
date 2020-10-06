export interface Block {
	number: string;
	hash: string;
	parentHash: string;
	stateRoot: string;
	extrinsicsRoot: string;
	authorId: string;
	logs: Log[];
	onInitialize: IOnInitializeOrFinalize;
	extrinsics: Extrinsic[];
	onFinalize: IOnInitializeOrFinalize;
}

interface Log {
	type: string;
	index: string;
	value: string;
}

interface IOnInitializeOrFinalize {
	events: SanitizedEvent[];
}

interface SanitizedEvent {
	method: FrameMethod;
	data: string[];
}

interface FrameMethod {
	pallet: string;
	method: string;
}

interface Extrinsic {
	method: FrameMethod;
	signature: Signature | null;
	nonce: string | null;
	args: SanitizedArgs;
	tip: string | null;
	hash: string;
	info: RuntimeDispatchInfo | { error: string } | {};
	events: SanitizedEvent[];
	success: boolean;
	paysfee: boolean | null;
}

interface Signature {
	signature: string;
	signer: string;
}

interface SanitizedArgs {
	call?: ISanitizedCall;
	calls?: ISanitizedCall[];
	[key: string]: unknown;
}

export interface ISanitizedCall {
	[key: string]: unknown;
	method: FrameMethod;
	args: SanitizedArgs;
}

interface RuntimeDispatchInfo {
	weight: string;
	class: string;
	partialFee: string;
}
