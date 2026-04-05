# Pulsar Demo Video Script (2-3 minutes)

## 🎬 Scene 1: Problem Statement (0:00-0:30)

**Visual:** Show traditional payment flow diagram with many transactions

**Narration:**
"AI agents are transforming how we work, but they hit a hard stop when they need to pay for services. Traditional approaches require one blockchain transaction per API call. For a task with 100 steps, that's 100 on-chain transactions, high latency, and expensive gas fees."

**On-screen text:**
- Traditional: 100 steps = 100 transactions
- Cost: ~$1.00 in gas fees
- Latency: High (network round-trips)

---

## 🎬 Scene 2: Pulsar Solution (0:30-1:00)

**Visual:** Show Pulsar architecture diagram with payment channel

**Narration:**
"Pulsar solves this with MPP Session payment channels on Stellar. Instead of 100 on-chain transactions, we create 100 off-chain commitments and settle with just 1 transaction at the end. This is the first production-meaningful implementation of MPP Session mode."

**On-screen text:**
- Pulsar: 100 steps = 1 transaction
- Cost: ~$0.01 in gas fees
- Latency: Low (off-chain)
- **99% cost reduction**

---

## 🎬 Scene 3: Live Demo - Open Channel (1:00-1:30)

**Visual:** Screen recording of Pulsar UI

**Actions:**
1. Navigate to http://localhost:5173
2. Show landing page with stats
3. Click "Open Channel"
4. Enter budget: 10 USDC
5. Enter user public key (from .env)
6. Click "Open Channel" button
7. Show success message with channel ID

**Narration:**
"Let me show you how it works. First, we open a payment channel by depositing USDC into a Soroban smart contract. This locks the funds in escrow and creates our payment channel."

**On-screen text:**
- Budget: 10 USDC
- Contract: Soroban (Stellar Testnet)
- Status: Channel Open ✅

---

## 🎬 Scene 4: Live Demo - Run Agent (1:30-2:15)

**Visual:** Continue screen recording

**Actions:**
1. Enter task: "Research the latest developments in AI agents and blockchain payments"
2. Click "Run Agent Task"
3. Show real-time step streaming:
   - LLM Call: Analyzing task...
   - Web Search: Searching DuckDuckGo...
   - Reasoning: Evaluating results...
   - Data Fetch: Fetching market data...
   - Code Exec: Validating findings...
4. Show progress bar and cost accumulation
5. Show "Task Complete" message

**Narration:**
"Now we run an AI agent task. Watch as each step executes in real-time: LLM calls, web searches, code execution, and data fetching. Notice how each step creates an off-chain commitment with zero on-chain transactions. The UI updates instantly via Server-Sent Events."

**On-screen text:**
- Steps: 8/8 completed
- Cost: 0.42 USDC
- Remaining: 9.58 USDC
- On-chain txs: 0 ⚡

---

## 🎬 Scene 5: Live Demo - Settlement (2:15-2:45)

**Visual:** Continue screen recording

**Actions:**
1. Click "Settle Channel"
2. Show settlement processing
3. Show receipt with:
   - Amount paid: 0.42 USDC
   - Refund: 9.58 USDC
   - Transaction hash
4. Click Stellar Explorer link
5. Show transaction on stellar.expert

**Narration:**
"Finally, we settle the channel with a single on-chain transaction. The smart contract verifies our Ed25519 signature, transfers the earned amount to the service provider, and refunds the remaining balance to the user. All verified on Stellar Testnet."

**On-screen text:**
- Settlement: 1 transaction ✅
- Tx Hash: [show hash]
- Verified on Stellar Explorer

---

## 🎬 Scene 6: Technical Highlights (2:45-3:00)

**Visual:** Show code snippets and architecture diagram

**Narration:**
"Pulsar uses advanced Soroban features: persistent storage, Stellar Asset Contract integration, Ed25519 cryptographic verification, and time-locked safety mechanisms. It's built with TypeScript, React, and includes 106 tests with property-based testing."

**On-screen text:**
- ✅ Soroban Smart Contracts
- ✅ Ed25519 Signatures
- ✅ Real AI Tools (DuckDuckGo, VM2)
- ✅ 106 Tests Passing
- ✅ Time-Locked Safety

---

## 🎬 Scene 7: Impact & Call to Action (3:00-3:15)

**Visual:** Show GitHub repo and stats

**Narration:**
"Pulsar demonstrates how payment channels unlock economic autonomy for AI agents. 99% fewer transactions, instant responses, and automatic refunds. This is the future of agentic payments on Stellar."

**On-screen text:**
- GitHub: github.com/PugarHuda/pulsar-stellar
- Built for: Stellar Hacks: Agents
- Open Source: MIT License
- Try it: [demo link]

**Final frame:**
⚡ Pulsar — AI Agent Billing on Stellar
First Production MPP Session Implementation
#StellarHacks #AgenticPayments

---

## 📝 Recording Tips

1. **Screen Resolution:** 1920x1080 (Full HD)
2. **Recording Tool:** OBS Studio or Loom
3. **Audio:** Clear microphone, no background noise
4. **Pace:** Speak clearly, not too fast
5. **Editing:** Add smooth transitions between scenes
6. **Music:** Optional light background music (royalty-free)
7. **Captions:** Add subtitles for accessibility

## 🎨 Visual Assets Needed

- [ ] Pulsar logo/banner
- [ ] Architecture diagram (payment channel flow)
- [ ] Comparison chart (traditional vs Pulsar)
- [ ] Code snippets (Soroban contract, TypeScript)
- [ ] GitHub repo screenshot
- [ ] Stellar Explorer screenshot

## 📤 Export Settings

- Format: MP4
- Resolution: 1920x1080
- Frame Rate: 30fps
- Bitrate: 5-10 Mbps
- Audio: AAC, 192 kbps
- Duration: 2:30 - 3:00 minutes
- File Size: < 100 MB

## 🔗 Upload Locations

- YouTube (unlisted or public)
- Loom
- Google Drive (shareable link)
- DoraHacks submission form
