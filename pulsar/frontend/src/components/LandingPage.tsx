/**
 * LandingPage.tsx
 *
 * Hero landing page shown before the app.
 * Dark navy/indigo gradient, animated sections, hackathon-winning aesthetic.
 */

interface LandingPageProps {
  onLaunch: () => void
}

export function LandingPage({ onLaunch }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stellar-900 via-stellar-800 to-pulsar-dark text-white overflow-hidden">
      {/* Subtle background grid pattern */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl animate-pulse-glow rounded-full">⚡</span>
          <span className="font-bold text-xl tracking-tight">Pulsar</span>
        </div>
        <a
          href="https://github.com/PugarHuda/pulsar-stellar"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/60 hover:text-white text-sm transition-colors"
        >
          GitHub ↗
        </a>
      </nav>

      {/* Hero */}
      <section className="relative z-10 text-center px-6 pt-16 pb-20 max-w-4xl mx-auto animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pulsar-accent/20 border border-pulsar-accent/30 text-pulsar-glow text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-pulsar-glow animate-pulse" />
          Stellar Hacks: Agents · April 2026
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
          AI Agent Billing
          <br />
          <span className="bg-gradient-to-r from-pulsar-glow to-stellar-300 bg-clip-text text-transparent">
            on Stellar
          </span>
        </h1>

        <p className="text-white/70 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          The first production-ready MPP Session payment channel for AI agents.{' '}
          <span className="text-white font-medium">
            100 steps = 100 off-chain signatures + 1 settlement tx.
          </span>
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onLaunch}
            className="px-8 py-3.5 bg-pulsar-accent hover:bg-pulsar-dark text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-pulsar-accent/30 hover:shadow-pulsar-accent/50 hover:scale-105 text-base"
          >
            Launch App →
          </button>
          <a
            href="https://github.com/PugarHuda/pulsar-stellar"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3.5 border border-white/20 hover:border-white/40 text-white/80 hover:text-white font-semibold rounded-xl transition-all duration-200 text-base"
          >
            View on GitHub ↗
          </a>
        </div>
      </section>

      {/* Stats bar */}
      <section className="relative z-10 border-y border-white/10 bg-white/5 backdrop-blur-sm py-5 animate-slide-up">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { value: '100 steps', label: '= 1 on-chain tx' },
            { value: '$0.00001', label: 'per tx fee' },
            { value: '5–7s', label: 'settlement' },
            { value: 'USDC', label: 'native' },
          ].map(({ value, label }) => (
            <div key={value} className="flex flex-col gap-0.5">
              <span className="text-xl font-bold text-white">{value}</span>
              <span className="text-xs text-white/50">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-20 animate-slide-up">
        <h2 className="text-2xl font-bold text-center mb-12 text-white">How it works</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              step: '01',
              title: 'Open Channel',
              desc: 'Lock USDC in a Soroban smart contract. Your budget is secured on-chain.',
              icon: '🔒',
              color: 'from-stellar-700 to-stellar-800',
            },
            {
              step: '02',
              title: 'Agent Runs',
              desc: 'Each AI step signs an off-chain commitment. Zero gas per step. Real-time streaming.',
              icon: '🤖',
              color: 'from-pulsar-dark to-pulsar-accent',
            },
            {
              step: '03',
              title: 'Settle',
              desc: 'One transaction closes the channel. Server gets payment, you get refund.',
              icon: '✅',
              color: 'from-stellar-700 to-stellar-600',
            },
          ].map(({ step, title, desc, icon, color }) => (
            <div
              key={step}
              className={`relative rounded-2xl bg-gradient-to-br ${color} border border-white/10 p-6 hover:border-white/20 transition-all duration-200 hover:-translate-y-1`}
            >
              <div className="text-3xl mb-4">{icon}</div>
              <div className="text-xs font-mono text-white/40 mb-1">{step}</div>
              <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-white/60 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech stack */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-sm font-medium text-white/40 text-center uppercase tracking-widest mb-6">
          Built with
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {[
            'Stellar Testnet',
            'Soroban Smart Contract',
            'MPP Session',
            'OpenRouter AI',
            'Ed25519 Signatures',
          ].map((tech) => (
            <span
              key={tech}
              className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 text-sm font-medium hover:bg-white/10 hover:text-white transition-colors"
            >
              {tech}
            </span>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 py-6 text-center text-white/40 text-sm">
        <p>
          Built for{' '}
          <span className="text-white/60 font-medium">Stellar Hacks: Agents · April 2026</span>
          {' · '}
          <a
            href="https://github.com/PugarHuda/pulsar-stellar"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/70 transition-colors"
          >
            GitHub ↗
          </a>
        </p>
      </footer>
    </div>
  )
}
