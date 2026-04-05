# stellar/ — Context

## Files
- `config.ts` — Stellar SDK clients, keypairs, USDC constants, helpers

## Exports
- `horizonServer` — Horizon.Server (classic Stellar ops)
- `sorobanRpc` — SorobanRpc.Server (smart contract ops)
- `USDC_ASSET` — Asset object untuk balance checks
- `USDC_SAC_ADDRESS` — SAC contract address (testnet)
- `getServerKeypair()` — server keypair dari env
- `getUserKeypair()` — user keypair dari env
- `fundTestnetAccount(pubkey)` — Friendbot funding
- `getUsdcBalance(pubkey)` — USDC balance via Horizon
- `usdcToBaseUnits(amount)` — 10.5 USDC → 105_000_000n
- `baseUnitsToUsdc(amount)` — 105_000_000n → 10.5

## Testnet constants
- USDC SAC: CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
- USDC Issuer: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
- Soroban RPC: https://soroban-testnet.stellar.org
