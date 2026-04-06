# Quick Fix Guide

## Issue: "Balance check failed" when opening channel

### Root Cause
The Soroban contract only allows ONE channel to be open at a time. If you try to open a second channel before settling the first one, you'll get an error.

### Solution ✅
**Backend has been restarted with a fresh contract!**

New contract deployed: `CBUMDUV5ERU4666TDOK6QVY6HBD3MVPVMXQIZSAF77WZ4JW5E6P5FKI6`

### Try Again Now
1. Refresh your browser (F5)
2. Connect your wallet
3. Open a new payment channel
4. It should work now! ✅

### If You Still See Errors

#### Error: "Balance check failed"
This usually means the contract already has an open channel. Solutions:
- **Option 1**: Restart the backend (deploys fresh contract)
  ```bash
  # Stop backend (Ctrl+C)
  # Start again
  cd pulsar/backend
  npm run dev
  ```
- **Option 2**: Wait for auto-retry (frontend will try to reset contract automatically)

#### Error: "Insufficient USDC balance"
- Check your wallet has USDC on Stellar Testnet
- Get testnet USDC from: https://laboratory.stellar.org/#account-creator?network=test

#### Error: "Invalid Stellar address"
- Make sure your public key starts with 'G'
- Should be 56 characters long

### How the System Works

1. **One Contract, One Channel**: Each contract instance can only have one open channel at a time
2. **Fresh Contract Per Session**: When backend starts, it deploys a fresh contract
3. **Settlement Required**: Before opening a new channel, you must settle the previous one
4. **Auto-Retry**: Frontend automatically tries to reset contract if it detects "channel already open"

### Testing Flow

1. **Open Channel** → Locks USDC in contract
2. **Run Agent** → Off-chain commitments (no on-chain tx)
3. **Settle Channel** → Real on-chain transaction, USDC transfers
4. **Open New Channel** → Now you can open another channel

### Current Status

- ✅ Backend running on http://localhost:3001
- ✅ Fresh contract deployed
- ✅ Ready to accept new channels
- ✅ All 106 tests passing

### Need Help?

Check backend logs for detailed error messages:
```bash
# Backend logs show exactly what's happening
# Look for lines starting with [Pulsar]
```

---

**Status**: READY ✅  
**Fresh contract deployed**: `CBUMDUV5ERU4666TDOK6QVY6HBD3MVPVMXQIZSAF77WZ4JW5E6P5FKI6`  
**Try opening a channel now!** 🚀
