# Proxy hot wallet demo for Substrate (Polkadot & Kusama)

Demo for a safe and effective custodial hot wallet architecture using features innovated by [Substrate](https://substrate.dev/) FRAME pallets and featured in production chains such [Polkadot](https://polkadot.network/) and [Kusama](https://kusama.network/).

By [@joepetrowski](https://github.com/joepetrowski) & [@emostov](https://github.com/emostov)

## Disclaimer

This repo is only for demonstration purposes only.

## Table of contents

- [Background](#background)
- [Technologies](#technologies)
- [Architecture](#architecture)
- [Demo outline](#demo-outline)
- [Run](#run)

## Background

When managing significant sums of funds on behalf of other entities, a major challenge is moving around funds without comprising the private key of the deposit addresses. In traditional block chains the private key must be "hot" (on a device exposed to the internet) in order to efficiently and programmatically move funds from the account (i.e. accounts that a user might deposit funds to). The moment this "hot" key is comprised the attacker has total control of funds.

In this repo we demonstrate an architecture pattern enabled by the [Substrate FRAME](https://substrate.dev/docs/en/knowledgebase/runtime/frame) [`proxy`](https://github.com/paritytech/substrate/tree/master/frame/proxy), [`multisig`](https://github.com/paritytech/substrate/tree/master/frame/multisig) and [`utility`](https://github.com/paritytech/substrate/tree/master/frame/utility#for-pseudonymal-dispatch) (see pseudonymal dispatch) pallets, that minimizes attack vectors associated with operating a hot wallet as a custodian.

The "hot" account is a multisig composite address that adds a proxy which announces transactions that can be executed after some delay. Pseudonymal accounts are derived from the multisig address and can be generated for every new deposit by a user to keep accounting clear. The proxy account can regularly transfer funds from the derivative accounts to a cold storage location(s). If the system detects a announcement by the proxy for a transfer to a non-certified address, then the multisig accounts can broadcast transactions to revoke the proxies privileges within the announcement period and prevent any of the proxies announced transactions from being executed.

## Technologies

- [Parity Polkadot node implementation](https://github.com/paritytech/polkadot#polkadot)
- [@substrate/txwrapper: offline transaction construction lib for Substrate](https://github.com/paritytech/txwrapper)
- [@substrate/api-sidecar: RESTful api microservice for Substrate nodes](https://github.com/paritytech/substrate-api-sidecar)
- [@polkadot/util-crypto: Substrate cryptography utility lib](https://github.com/polkadot-js/common/tree/master/packages/util-crypto)

## Architecture

![architecture](/src/static/architecture.png)

### Setup

1) Create m-of-n multisig MS from K = {k} keys, held by trusted parties (e.g. founders).
2) Set a proxy H with time delay T for MS.
3) Create derivative addresses D = {d} for user deposits.
4) Create cold storage S (not discussed here).

#### Simple use

1) Proxy H announces call hash on-chain.
2) H sends actual call to backend system.
3) Backend ensures that call hash matches and parses call.
4) Applies internal rule (e.g. to whitelisted address).
5) If alerted, m-of-n K can reject the transaction.
6) If timeout, H broadcasts the actual call.

#### Normal transaction flow

1) User i sends a deposit of v tokens to their addresses, di
2) Listener observes balances.Transfer event to address di 
3) A machine** constructs the following call C***:

      ```c
      C = utility.as_derivative(
              index: i,
              call: balances.transfer(
                  dest: S_pub,
                  value: v,
              )
          )
      ```

4) Key H signs and broadcasts the transaction:

    ```c
    proxy.announce(real: MS_pub, call_hash: hash(C))
    ```

5) Listener observes announce transaction on-chain and asks for the call C. It verifies two things:

    1) Its hash matches the announcement, and
    2) Any internal rules, e.g. the transfer is to a whitelisted S.

6) Verifications pass, no alarm.
7) After time delay T, any account can broadcast the transaction:

      ```c
      proxy.proxy_announced(
          delegate: H_pub,
          real: MS_pub,
          force_proxy_type: Any,
          call: C,
      )
      ```

8) Listener verifies that the transfer was successful when it sees a `balances.Transfer` event to address MS.

** Can be any machine, even without access to key H.
*** Note that it can transfer the full value v as the address H will pay the transaction fees.

#### Call rejection

1) Verification does not pass.
2) Owners of K are alerted and have time T to react.
3) Construct the following call R**:

    ```c
    R = proxy.reject_announcement(
            delegate: H_pub,
            call_hash: hash(C),
        )
    ```

4) Owners of K broadcast the call R.
5) Fallback: owners cannot either override the flag or broadcast their multisig transactions in time.
6) System hold immortal transaction ready to remove H as a proxy for MS (`proxy.remove_proxies()`). The system can submit this at any point. Note: only the first multisig transaction can be immortal and stored; the remaining need the `TimePoint` of the first multisig transaction so they need to be constructed in real time.

** In the event of a malicious announcement it is always recommended to call `proxy.remove_proxies()` ASAP.

#### Misc. optimizations

1) Use batch transactions, e.g.:

    ```c
    utility.batch(
      utility.as_derivative(index: 0, call: C0),
      utility.as_derivative(index: 1, call: C1),
      utility.as_derivative(index: 2, call: C2),
      …
    )
    ```

2) Reduce T and only use the fallback for faster settlement.
3) Use anonymous proxies for MS to allow member change, in case some K<sub>i</sub> is compromised.

## Demo Outline

1) Generate 6 keyrings and make sure accounts have funds
    - 3 for multisig
    - 1 for proxy
    - 1 for stash
    - 1 for depositor
2) Generate a 2-of-3 multisig address and log it to console
3) Transfer funds from Alice to the multisig
    - `balances.transfer()`
4) Set the 4th key as a proxy for the multisig
    - `Call = proxy.addProxy(key4, Any, 10)` // 10 blocks = 1 min
    - `multisig.approve_as_multi(hash(Call))`
    - `multisig.as_multi(Call)`
5) Create derivative accounts from multisig address for depositor(s) to send tokens to
6) Transfer funds `v` from depositor to two derivative accounts
    - `balances.transfer()`
7) Create two calls: one good and one bad
    - `C0 = utility.as_derivative(0, balances.transfer(stash, v))`
    - `C1 = utility.as_derivative(1, balances.transfer(attacker, v))`
8) Demonstrate the happy path
    - `key4` broadcasts `proxy.announce(hash(C0))` and sends `C0` to another worker
    - safety worker decodes `C0` and ensures that destination address is `stash`
    - after 10 blocks, `key4` broadcasts `proxy.proxy_announced(C0)`
9) Demonstrate adversarial path
    - `key4` broadcasts `proxy.announce(hash(C1))` and sends `C1` to safety worker
    - safety worker decodes `C1` and sees that destination address is not `stash`
    - `multisig.approve_as_multi(proxy.remove_proxies(hash(C1)))`
    - `multisig.as_multi(proxy.reject_announcement(hash(C1)))`

## Run

1) This demo relies on using a parity polkadot development node; you can download the [source here](https://github.com/paritytech/polkadot). Follow the instructions to download and compile the code.
2) Make sure the node's database is empty by running: `./target/release/polkadot purge-chain --dev` (**N.B.** the nodes DB must be purged before every run of the demo script)
3) Start the node by running `./target/release/polkadot --dev`
4) In another terminal session change directories to this project and install dependencies by running `yarn`
5) Start up Sidecar by running `yarn sidecar`
6) In another terminal session, make sure you are in this project directory and start the demo by running `yarn start`

Note: this script assumes the polkadot node and Sidecar are using the defualt development ports.

[Sample demo output](/out.log)