# 🎬 Pre-Recording Checklist

Before recording your demo video, make sure everything is ready!

---

## ✅ Environment Setup

### 1. Backend Setup
- [ ] Navigate to `pulsar/backend`
- [ ] Run `npm install` (if not done)
- [ ] Check `.env` file exists
- [ ] Verify `DEMO_MODE=true` in `.env`
- [ ] Start backend: `npm run dev`
- [ ] Verify backend running on http://localhost:3001
- [ ] Check terminal for any errors

### 2. Frontend Setup
- [ ] Navigate to `pulsar/frontend`
- [ ] Run `npm install` (if not done)
- [ ] Start frontend: `npm run dev`
- [ ] Verify frontend running on http://localhost:5173
- [ ] Check terminal for any errors

### 3. Browser Setup
- [ ] Open http://localhost:5173 in browser
- [ ] Close unnecessary tabs
- [ ] Clear browser console (F12 → Console → Clear)
- [ ] Test the flow once (open channel → run agent → settle)
- [ ] Verify all features work

---

## 🎥 Recording Software Setup

### Option 1: OBS Studio (Recommended)
- [ ] Download: https://obsproject.com/
- [ ] Install and open OBS
- [ ] Add "Display Capture" or "Window Capture" source
- [ ] Set resolution to 1920x1080 (Full HD)
- [ ] Set frame rate to 30 FPS
- [ ] Add audio input (microphone)
- [ ] Test recording (5 seconds)
- [ ] Check audio levels (not too loud/quiet)
- [ ] Verify video quality

### Option 2: Loom
- [ ] Go to: https://www.loom.com/
- [ ] Install browser extension or desktop app
- [ ] Sign up/login
- [ ] Test recording (5 seconds)
- [ ] Check audio and video quality

### Option 3: Built-in Screen Recording
- [ ] **Windows**: Xbox Game Bar (Win + G)
- [ ] **macOS**: QuickTime Player → File → New Screen Recording
- [ ] Test recording (5 seconds)
- [ ] Check audio and video quality

---

## 🎤 Audio Setup

- [ ] Test microphone (speak and listen back)
- [ ] Adjust microphone volume (not too loud/quiet)
- [ ] Close windows/doors (reduce background noise)
- [ ] Turn off fans/AC (if too loud)
- [ ] Silence phone notifications
- [ ] Close other applications (reduce CPU noise)
- [ ] Test audio recording (5 seconds)

---

## 📝 Script Preparation

- [ ] Read DEMO_VIDEO_SCRIPT.md
- [ ] Practice the script once
- [ ] Prepare example task: "Research AI agents on blockchain"
- [ ] Have GitHub repo open in another tab
- [ ] Have test results ready to show
- [ ] Know the key messages:
  - "Only MPP Session implementation"
  - "99% cost reduction"
  - "113 tests passing"
  - "Production-ready"

---

## 🖥️ Screen Layout

### Main Browser Window (Pulsar App)
- [ ] Full screen or maximized
- [ ] Zoom level at 100%
- [ ] No browser extensions visible (hide toolbar if possible)
- [ ] Clean URL bar (no clutter)

### Secondary Browser Tab (GitHub)
- [ ] GitHub repo: https://github.com/PugarHuda/pulsar-stellar
- [ ] Ready to switch to for code walkthrough

### Terminal Windows
- [ ] Backend terminal visible (for showing it's running)
- [ ] Frontend terminal visible (optional)
- [ ] Clean terminal output (no errors)

---

## 🎯 Demo Flow Checklist

### Part 1: Introduction (1 minute)
- [ ] Show landing page
- [ ] Explain problem: "AI agents need 100s of API calls"
- [ ] Explain solution: "Payment channels reduce costs by 99%"
- [ ] Highlight: "Only MPP Session implementation"

### Part 2: Core Demo (3 minutes)
- [ ] Click "Launch App"
- [ ] Show 3 tabs: Channels, Marketplace, Analytics
- [ ] Go to Channels tab
- [ ] Open channel with 10 USDC budget
- [ ] Enter public key or use demo mode
- [ ] Show channel opened successfully
- [ ] Run AI agent task: "Research AI agents on blockchain"
- [ ] Show real-time SSE updates
- [ ] Show budget tracking
- [ ] Wait for task completion
- [ ] Settle channel with 1 transaction
- [ ] Show settlement success

### Part 3: Visual Features (2 minutes)
- [ ] Go to Analytics tab
- [ ] Show cost comparison chart (animated)
- [ ] Show agent network visualizer (live)
- [ ] Show live transaction feed
- [ ] Explain 99% cost reduction
- [ ] Go to Marketplace tab
- [ ] Show 4 agent types

### Part 4: Technical Depth (1 minute)
- [ ] Switch to GitHub repo
- [ ] Show README.md
- [ ] Show test results (screenshot or terminal)
- [ ] Show Soroban contract code (contract/src/lib.rs)
- [ ] Show SEP-10 authentication code (backend/src/auth/sep10.ts)
- [ ] Show agent-to-agent backend (backend/src/agent/agent-to-agent.ts)

### Part 5: Closing (30 seconds)
- [ ] Summarize: "Only MPP Session, real AI, 113 tests"
- [ ] Emphasize: "Production-ready, not toy demo"
- [ ] Show GitHub URL: https://github.com/PugarHuda/pulsar-stellar
- [ ] Call to action: "Check out the code on GitHub"

---

## 🎬 Recording Tips

### Before Recording
- [ ] Take a deep breath
- [ ] Speak clearly and not too fast
- [ ] Smile (it affects your voice tone)
- [ ] Have water nearby
- [ ] Go to bathroom (avoid interruptions)

### During Recording
- [ ] Speak with confidence
- [ ] Pause between sections (easier to edit)
- [ ] If you make a mistake, pause and restart that section
- [ ] Don't worry about perfection (authenticity is better)
- [ ] Show enthusiasm (you're proud of your work!)

### After Recording
- [ ] Watch the recording
- [ ] Check audio quality
- [ ] Check video quality
- [ ] Verify all key points covered
- [ ] Edit if needed (trim mistakes, add transitions)
- [ ] Export as MP4 (1920x1080, 30fps)

---

## 📤 Post-Recording Checklist

### Video Export
- [ ] Format: MP4
- [ ] Resolution: 1920x1080 (Full HD)
- [ ] Frame Rate: 30 FPS
- [ ] Bitrate: 5-10 Mbps
- [ ] Audio: AAC, 192 kbps
- [ ] Duration: 5-7 minutes
- [ ] File Size: < 100 MB (if possible)

### Upload to YouTube
- [ ] Go to: https://www.youtube.com/upload
- [ ] Upload video file
- [ ] Title: "Pulsar - AI Agent Billing via MPP Session on Stellar"
- [ ] Description: Copy from FINAL_SUBMISSION_HIGHLIGHTS.md
- [ ] Tags: stellar, blockchain, ai, agents, payment-channels, mpp, soroban
- [ ] Visibility: Unlisted or Public
- [ ] Wait for processing
- [ ] Copy video URL

### Verify Upload
- [ ] Watch uploaded video
- [ ] Check audio quality
- [ ] Check video quality
- [ ] Verify video is accessible
- [ ] Copy shareable link

---

## 🚀 Submission Checklist

### Before Submitting
- [ ] GitHub repo is public
- [ ] All code is pushed
- [ ] README.md is complete
- [ ] Demo video is uploaded
- [ ] Video URL is ready

### Submission Form
- [ ] Go to DoraHacks submission form
- [ ] Project Name: "Pulsar - AI Agent Billing via MPP Session"
- [ ] Tagline: "First production-ready MPP Session implementation on Stellar, reducing AI agent billing costs by 99%"
- [ ] Description: Copy from READY_FOR_SUBMISSION.md
- [ ] Category: Blockchain, AI, Agents, Payments
- [ ] GitHub URL: https://github.com/PugarHuda/pulsar-stellar
- [ ] Demo Video URL: [Your YouTube URL]
- [ ] Review all fields
- [ ] Submit!

### After Submission
- [ ] Take screenshot of confirmation
- [ ] Save submission confirmation email
- [ ] Share on social media (optional)
- [ ] Celebrate! 🎉

---

## 💡 Quick Tips

### If Something Goes Wrong During Recording:
1. **Don't panic** - pause the recording
2. **Take a breath** - compose yourself
3. **Restart from last section** - no need to redo everything
4. **Edit later** - you can cut out mistakes

### If Demo Doesn't Work:
1. **Check backend is running** - http://localhost:3001
2. **Check frontend is running** - http://localhost:5173
3. **Check .env file** - DEMO_MODE=true
4. **Restart both services** - Ctrl+C and npm run dev again
5. **Clear browser cache** - Hard refresh (Ctrl+Shift+R)

### If You're Nervous:
1. **Practice once** - do a dry run without recording
2. **Remember** - you built something amazing
3. **Be authentic** - judges appreciate genuine enthusiasm
4. **Focus on strengths** - only MPP Session, 113 tests, real AI
5. **Have fun** - this is your moment to shine!

---

## 🎯 Key Messages to Remember

### Three Main Points:
1. **Only MPP Session implementation** (unique technology)
2. **99% cost reduction** (clear value)
3. **Production-ready with 113 tests** (quality)

### One Sentence Summary:
> "Pulsar is the first and only production-ready MPP Session implementation with agent-to-agent payment channels, reducing AI agent billing costs by 99% through true payment channels on Stellar."

---

## 📞 Need Help?

- **Script**: See DEMO_VIDEO_SCRIPT.md
- **Features**: See FEATURES_IMPLEMENTED.md
- **Highlights**: See FINAL_SUBMISSION_HIGHLIGHTS.md
- **Quick Start**: See QUICK_START.md

---

**You've got this! 🚀**

**Pulsar is amazing, and the judges will see that! 🏆**

**Good luck! 🎬**
