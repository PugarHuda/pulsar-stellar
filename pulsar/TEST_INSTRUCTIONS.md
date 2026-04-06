# Test Instructions - Channel Opening

## Problem
Wallet signing is not yet implemented. The backend can only sign transactions for the demo user account.

## Solution
Use the demo user key instead of your connected wallet.

## Steps to Test

### 1. Disconnect Your Wallet (if connected)
- Click the wallet disconnect button in the UI
- Or just ignore the wallet and use demo key

### 2. Use Demo Key
- In the "Open Payment Channel" form
- Look for the "Your Stellar Public Key" field
- Click the **"Demo key"** button
- This will auto-fill: `GBUHNO53JCBELILRLNUGUR27G3TSL33M2TQIPEWS64HNEVBKR7RSRXFI`

### 3. Enter Budget
- Enter amount (e.g., `1` for 1 USDC)
- Demo account has 18.54 USDC available

### 4. Open Channel
- Click "Open Channel" button
- Wait for confirmation
- Should succeed! ✅

### 5. Run Agent Task
- Enter task description
- Click "Run Agent"
- Watch the steps execute

### 6. Settle Channel
- Click "Settle Channel"
- Real on-chain transaction will execute
- USDC will actually transfer
- Check balances to verify

## Why This Happens

The Soroban contract requires the transaction to be signed by the user who is depositing USDC. Currently:

- **Backend has**: Demo user secret key (can sign for demo user)
- **Your wallet**: Different address (backend can't sign for you)
- **Solution needed**: Implement wallet signing (SEP-0007 or Freighter API)

## For Hackathon Demo

For the hackathon demo video, we'll use the demo key approach. This is sufficient to demonstrate:
- ✅ Real on-chain channel opening
- ✅ Off-chain agent execution
- ✅ Real on-chain settlement
- ✅ USDC actually transfers

## Future Implementation

For production, we need to implement:
1. **Freighter wallet integration** for transaction signing
2. **SEP-0007** for transaction signing requests
3. **WalletConnect** for mobile wallet support

But for now, demo key works perfectly for testing and demo! 🚀

---

## Current Status

- ✅ Backend running: http://localhost:3001
- ✅ Fresh contract: `CDRSBULBIYP2W72MUDOKSHIBR6LATWLVK2Z7SFTJL25BKADBSREISACZ`
- ✅ Demo user funded: 18.54 USDC
- ✅ Ready to test!

## Demo User Details

- **Public Key**: `GBUHNO53JCBELILRLNUGUR27G3TSL33M2TQIPEWS64HNEVBKR7RSRXFI`
- **XLM Balance**: 9999.74 XLM
- **USDC Balance**: 18.54 USDC
- **Network**: Stellar Testnet

Click "Demo key" button and you're good to go! 🎯
