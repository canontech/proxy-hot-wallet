# Proxy hot wallet demo for Polkadot & Kusama

Demo for a safe and effective custodial hot wallet using features unique to Substrate chains Polkadot and Kusama.

Architecture by [@joepetrowski](https://github.com/joepetrowski). Implementation by [@emostov](https://github.com/emostov).

## Disclaimer

This repo is only for demonstration purposes. None of the code should be used as is for production purposes.

### Table of contents

- [Background](#background)
- [Technologies](#technologies)
- [Proxy hot wallet architecture](#proxy-hot-wallet-architecture)
- [Demo outline](#demo-outline)

## Background

When managing significant sums of funds on behalf of other entities, a major challenge is moving around funds without comprising the private key of the deposit addresses. In traditional block chains the private key must be "hot" (on a device exposed to the internet) in order to efficiently and programmatically move funds from the account (i.e. accounts that a user might deposit funds to). The moment this "hot" key is comprised the attacker has total control of funds.

In this repo we demonstrate an architecture pattern enabled by the [Substrate FRAME](https://substrate.dev/docs/en/knowledgebase/runtime/frame) pallets [`proxy`](https://github.com/paritytech/substrate/tree/master/frame/proxy), [`multisig`](https://github.com/paritytech/substrate/tree/master/frame/multisig) and pseudonymal dispatch from the [`utility`](https://github.com/paritytech/substrate/tree/master/frame/utility#for-pseudonymal-dispatch) pallet, the greatly reduces the risk associated with operating a hot wallet as a custodian.

The "hot" account is a multisig composite address adds a proxy that announces transactions, which can be executed after some delay. Pseudonymal accounts are derived from the multisig address and can be generated for every new deposit by a user to keep accounting clear. The proxy account can regularly transfer funds from the derivative accounts to a cold storage location(s). If the system detects a announcement by the proxy for a transfer to a non-certified address, then the multisig accounts can broadcast transactions to revoke the proxies privileges within the announcement period and prevent any of the proxies announced transactions from being executed.

## Technologies

- [Parity Polkadot node implementation](https://github.com/paritytech/polkadot#polkadot)
- [@substrate/txwrapper: offline transaction construction lib for Substrate](https://github.com/paritytech/txwrapper)
- [@substrate/api-sidecar: RESTful api for Substrate nodes](https://github.com/paritytech/substrate-api-sidecar)
- [@polkadot/util-crypto: Substrate cryptography utility lib](https://github.com/polkadot-js/common/tree/master/packages/util-crypto)

## Proxy hot wallet architecture

![architecture](/src/static/architecture.png)

### Setup

1) Create m-of-n multisig MS from K = {k} keys, held by trusted parties (e.g. founders).
2) Set a proxy H with time delay T for MS.
3) Create derivative addresses D = {d} for user deposits.
4) Create cold storage S (not discussed here).

### Simple use

1) Proxy H announces call hash on-chain.
2) H sends actual call to backend system.
3) Backend ensures that call hash matches and parses call.
4) Applies internal rule (e.g. to whitelisted address).
5) If alerted, m-of-n K can reject the transaction.
6) If timeout, H broadcasts the actual call.

### Normal transaction flow
1) User i sends a deposit of v tokens to their addresses, di
2) Listener observes balances.Transfer event to address di 
3) A machine* constructs the following call C**:

```rust
C = utility.as_derivative(
        index: i,
        call: balances.transfer(
            dest: S_pub,
            value: v,
        )
    )
```

4) Key H signs and broadcasts the transaction:

```rust
proxy.announce(real: MS_pub, call_hash: hash(C))
```

5) Listener observes announce transaction on-chain and asks for the call C. It verifies two things:
    1) Its hash matches the announcement, and
    2) Any internal rules, e.g. the transfer is to a whitelisted S.

6) Verifications pass, no alarm.
After time delay T, any account can broadcast the transaction:
```
proxy.proxy_announced(
    delegate: H_pub,
    real: MS_pub,
    force_proxy_type: Any,
    call: C,
)
```
Listener verifies that the transfer was successful when it sees a balances.Transfer event to address MS.

* Can be any machine, even without access to key H.
** Note that it can transfer the full value v as the address H will pay the transaction fees.



## Demo Outline
```
Generate 6 keyrings and make sure accounts have funds (can just use dev chain keys)
	- 3 for multisig
	- 1 for proxy
	- 1 for stash
	- 1 for depositor

Generate a 2-of-3 multisig address and log it to console

Transfer funds from Alice to the multisig (TODO: Calculate deposits)
	- balances.transfer()

Set the 4th key as a proxy for the multisig
	- Call = proxy.addProxy(key4, Any, 50) // 50 blocks = 5 min
	- multisig.approve_as_multi(hash(Call))
	- multisig.as_multi(Call)

Create derivative accounts from multisig address for depositers to send tokens to

Transfer funds `v` from depositor to two derivative accounts
	- balances.transfer()

Create two calls: one good and one bad
	- C0 = utility.as_derivative(0, balances.transfer(stash, v))
	- C1 = utility.as_derivative(1, balances.transfer(attacker, v))

Demonstrate the "all good" path
	- key4 broadcasts proxy.announce(hash(C0)) and sends C0 to another worker
	- other worker decodes C0 and ensures that destination address is `stash`
	- after 50 blocks, key4 broadcasts proxy.proxy_announced(C0)

Demonstrate attack path
	- key4 broadcasts proxy.announce(hash(C1)) and sends C1 to another worker
	- other worker decodes C1 and sees that destination address is not `stash`
	# RUN
	- multisig.approve_as_multi(reject_announcement(proxy.remove_proxies()))
	- multisig.as_multi(reject_announcement(proxy.remove_proxies()))
	# OR
	- multisig.as_multi(proxy.reject_announcement(hash(C1)))
	- multisig.as_multi(proxy.reject_announcement(hash(C1)))
```

