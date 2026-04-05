# Pulsar Implementation Roadmap

## ✅ Completed Features

### Core Platform
- [x] MPP Session payment channels
- [x] Off-chain commitments with Ed25519 signatures
- [x] Real Soroban contract integration
- [x] Real AI tools (DuckDuckGo, VM2, public APIs)
- [x] Real-time SSE streaming
- [x] 106 comprehensive tests
- [x] Analytics endpoint (`/api/analytics`)
- [x] User-friendly error messages
- [x] Demo video script

### UI Components
- [x] Landing page with stats
- [x] Channel panel (open channel)
- [x] Task panel (run agent)
- [x] Settlement panel (close channel)
- [x] Analytics dashboard component
- [x] Dark mode toggle component

### Documentation
- [x] Comprehensive README with diagrams
- [x] Architecture documentation
- [x] Payment protocol comparison
- [x] Demo video script

## 🚧 In Progress / Quick Wins

### 1. Multi-User Support (HIGH PRIORITY)
**Status:** Ready to implement
**Time:** 4-6 hours
**Files to create:**
- `backend/src/auth/jwt.ts` - JWT authentication
- `backend/src/auth/middleware.ts` - Auth middleware
- `frontend/src/hooks/useWallet.ts` - Freighter wallet integration

**Implementation:**
```typescript
// backend/src/auth/jwt.ts
import jwt from 'jsonwebtoken'

export function generateToken(publicKey: string): string {
  return jwt.sign({ publicKey }, process.env.JWT_SECRET!, { expiresIn: '24h' })
}

export function verifyToken(token: string): { publicKey: string } {
  return jwt.verify(token, process.env.JWT_SECRET!) as { publicKey: string }
}

// backend/src/auth/middleware.ts
export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  
  try {
    const { publicKey } = verifyToken(token)
    req.user = { publicKey }
    next()
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// frontend/src/hooks/useWallet.ts
import { isConnected, getPublicKey, signTransaction } from '@stellar/freighter-api'

export function useWallet() {
  async function connect() {
    if (await isConnected()) {
      const publicKey = await getPublicKey()
      // Call backend /api/auth/login with challenge
      return publicKey
    }
    throw new Error('Freighter not installed')
  }
  
  return { connect }
}
```

**Steps:**
1. Install dependencies: `npm install jsonwebtoken @types/jsonwebtoken @stellar/freighter-api`
2. Add JWT_SECRET to .env
3. Create auth files
4. Add auth middleware to protected routes
5. Update frontend to use wallet connection
6. Update channel creation to use authenticated user

### 2. Export Receipt (PDF)
**Status:** Ready to implement
**Time:** 2-3 hours

```typescript
// backend: npm install pdfkit @types/pdfkit

// backend/src/api/routes.ts
import PDFDocument from 'pdfkit'

router.get('/channels/:id/receipt', async (req, res) => {
  const channel = getChannel(req.params.id)
  if (!channel || channel.status !== 'closed') {
    return res.status(404).json({ error: 'Channel not found or not settled' })
  }

  const doc = new PDFDocument()
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename=pulsar-receipt-${channel.id}.pdf`)
  
  doc.pipe(res)
  
  // Header
  doc.fontSize(20).text('Pulsar Receipt', { align: 'center' })
  doc.moveDown()
  
  // Channel details
  doc.fontSize(12)
  doc.text(`Channel ID: ${channel.id}`)
  doc.text(`Budget: ${baseUnitsToUsdc(channel.budgetBaseUnits)} USDC`)
  doc.text(`Amount Paid: ${baseUnitsToUsdc(channel.currentCommitmentAmount)} USDC`)
  doc.text(`Refund: ${baseUnitsToUsdc(channel.budgetBaseUnits - channel.currentCommitmentAmount)} USDC`)
  doc.text(`Steps: ${channel.lastStepIndex + 1}`)
  doc.text(`Settlement TX: ${channel.settlementTxHash}`)
  doc.text(`Date: ${new Date(channel.closedAt!).toLocaleString()}`)
  
  doc.moveDown()
  doc.fontSize(10).text('Powered by Pulsar - AI Agent Billing on Stellar', { align: 'center' })
  
  doc.end()
})
```

### 3. Partial Settlement (Soroban Contract)
**Status:** Design ready
**Time:** 3-4 hours

```rust
// contract/src/lib.rs

#[contractimpl]
impl PulsarChannel {
    /// Settle a partial amount and keep the channel open.
    /// Allows incremental settlements without closing the channel.
    pub fn partial_settle(
        env: Env,
        commitment_amount: i128,
        signature: BytesN<64>,
    ) -> i128 {
        let mut state: ChannelState = env
            .storage()
            .persistent()
            .get(&CHANNEL_KEY)
            .expect("channel not found");

        if state.status != ChannelStatus::Open {
            panic!("channel not open");
        }

        // Verify signature (same as close_channel)
        let contract_addr_bytes = env.current_contract_address().to_xdr(&env);
        let addr_len = contract_addr_bytes.len();
        let channel_id: BytesN<32> = contract_addr_bytes
            .slice(addr_len - 32..addr_len)
            .try_into()
            .expect("channel_id slice failed");

        let amount_bytes = (commitment_amount as u64).to_be_bytes();
        let mut msg = soroban_sdk::Bytes::new(&env);
        msg.append(&channel_id.into());
        msg.append(&soroban_sdk::Bytes::from_slice(&env, &amount_bytes));

        let recipient_xdr = state.recipient.clone().to_xdr(&env);
        let xdr_len = recipient_xdr.len();
        let recipient_pubkey: BytesN<32> = recipient_xdr
            .slice(xdr_len - 32..xdr_len)
            .try_into()
            .expect("recipient pubkey slice failed");

        env.crypto().ed25519_verify(&recipient_pubkey, &msg, &signature);

        // Transfer partial amount
        let token_client = token::Client::new(&env, &state.token);
        token_client.transfer(
            &env.current_contract_address(),
            &state.recipient,
            &commitment_amount,
        );

        // Update state - reduce amount, keep channel open
        state.amount -= commitment_amount;
        env.storage().persistent().set(&CHANNEL_KEY, &state);

        state.amount // Return remaining balance
    }
}
```

### 4. Agent Marketplace
**Status:** Design ready
**Time:** 4-5 hours

```typescript
// backend/src/agent/marketplace.ts

export interface AgentType {
  id: string
  name: string
  description: string
  baseRate: number // USDC per step
  tools: string[]
  icon: string
}

export const AGENT_MARKETPLACE: Record<string, AgentType> = {
  researcher: {
    id: 'researcher',
    name: 'Research Agent',
    description: 'Web search and data analysis specialist',
    baseRate: 0.05,
    tools: ['web_search', 'data_fetch', 'reasoning'],
    icon: '🔍',
  },
  coder: {
    id: 'coder',
    name: 'Code Agent',
    description: 'Code execution and validation expert',
    baseRate: 0.08,
    tools: ['code_exec', 'llm_call', 'reasoning'],
    icon: '💻',
  },
  analyst: {
    id: 'analyst',
    name: 'Analysis Agent',
    description: 'Data analysis and insights generator',
    baseRate: 0.06,
    tools: ['reasoning', 'data_fetch', 'llm_call'],
    icon: '📊',
  },
  writer: {
    id: 'writer',
    name: 'Content Agent',
    description: 'Content creation and writing specialist',
    baseRate: 0.07,
    tools: ['llm_call', 'web_search', 'reasoning'],
    icon: '✍️',
  },
}

// Add to routes.ts
router.get('/agents', (req, res) => {
  res.json(Object.values(AGENT_MARKETPLACE))
})

router.post('/channels/:id/run', async (req, res) => {
  const { taskDescription, agentType = 'researcher' } = req.body
  const agent = AGENT_MARKETPLACE[agentType]
  
  if (!agent) {
    return res.status(400).json({ error: 'Invalid agent type' })
  }
  
  // Use agent-specific tools and pricing
  // ...
})
```

### 5. Soroban Events for Indexing
**Status:** Ready to implement
**Time:** 2 hours

```rust
// contract/src/lib.rs

use soroban_sdk::symbol_short;

#[contractimpl]
impl PulsarChannel {
    pub fn open_channel(...) {
        // ... existing code ...
        
        // Emit event for indexing
        env.events().publish(
            (symbol_short!("opened"), channel_id.clone()),
            (sender.clone(), amount),
        );
        
        env.storage().persistent().set(&CHANNEL_KEY, &state);
    }
    
    pub fn close_channel(...) {
        // ... existing code ...
        
        // Emit settlement event
        env.events().publish(
            (symbol_short!("settled"), channel_id.clone()),
            (commitment_amount, state.recipient.clone()),
        );
    }
}
```

### 6. SEP-10 Authentication
**Status:** Design ready
**Time:** 3-4 hours

```typescript
// backend/src/auth/sep10.ts
import { Utils, Keypair, Networks } from '@stellar/stellar-sdk'

export function buildChallenge(clientPublicKey: string): string {
  const serverKeypair = getServerKeypair()
  
  const challenge = Utils.buildChallengeTx(
    serverKeypair,
    clientPublicKey,
    'Pulsar',
    300, // 5 minutes
    Networks.TESTNET,
  )
  
  return challenge.toXDR()
}

export function verifyChallenge(signedChallenge: string, clientPublicKey: string): boolean {
  const serverKeypair = getServerKeypair()
  
  try {
    Utils.readChallengeTx(
      signedChallenge,
      serverKeypair.publicKey(),
      Networks.TESTNET,
      'Pulsar',
    )
    return true
  } catch {
    return false
  }
}

// Add to routes.ts
router.post('/auth/challenge', (req, res) => {
  const { publicKey } = req.body
  const challenge = buildChallenge(publicKey)
  res.json({ challenge })
})

router.post('/auth/verify', (req, res) => {
  const { signedChallenge, publicKey } = req.body
  
  if (verifyChallenge(signedChallenge, publicKey)) {
    const token = generateToken(publicKey)
    res.json({ token })
  } else {
    res.status(401).json({ error: 'Invalid signature' })
  }
})
```

## 📋 Lower Priority Features

### 7. Subscription Model
- Monthly fee for unlimited tasks
- New Soroban contract: `subscription_channel`
- Time-based expiry

### 8. Agent-to-Agent Payments
- Agents can open channels to other agents
- Service marketplace for AI agents
- Reputation system

### 9. Time-Weighted Pricing
- Charge based on channel duration
- Hourly rate in addition to per-step cost
- Incentivizes quick settlements

### 10. Stellar Anchors Integration
- Fiat on/off-ramp via Etherfuse/AlfredPay
- SEP-24 interactive flow
- USDC purchase with credit card

## 🎯 Recommended Implementation Order

**Week 1 (Before Hackathon Deadline):**
1. ✅ Fix failing test (DONE)
2. ✅ Analytics Dashboard UI (DONE)
3. ✅ Dark Mode (DONE)
4. Multi-User Support + Wallet Integration (4-6h)
5. Export Receipt PDF (2-3h)
6. Agent Marketplace (4-5h)
7. Record Demo Video (2-3h)

**Week 2 (Post-Hackathon Polish):**
8. Partial Settlement (3-4h)
9. Soroban Events (2h)
10. SEP-10 Authentication (3-4h)
11. Subscription Model (6-8h)
12. Deploy Live Demo

## 📦 Dependencies to Install

```bash
# Backend
cd backend
npm install jsonwebtoken @types/jsonwebtoken
npm install pdfkit @types/pdfkit
npm install @stellar/freighter-api

# Frontend
cd frontend
npm install @stellar/freighter-api
```

## 🚀 Quick Start for Each Feature

Each feature above includes:
- Implementation code
- File locations
- Time estimates
- Dependencies needed

Follow the recommended order for maximum impact before hackathon deadline.
