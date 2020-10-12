# proxy-hot-wallet
Demo for a safe and effective custodial hot wallet using features unique to Substrate chains Polkadot and Kusama.

Architecture by @joepetrowski. Implementation by @emostov.

## Disclaimer
This repo is only for demonstration purposes. None of the code should be used as is for production purposes.

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

## TODO
- [ ] Clean up main variable names and console log statements
- [ ] Make transaction methods take in an options object for tip, origin, material fetch height, etc
- [ ] Reorg file structure
