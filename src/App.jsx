import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Factory, Warehouse, Users, Timer } from 'lucide-react';
import { useSimulation } from './hooks/useSimulation.js';
import { countLE } from './engine/frameSelectors.js';
import { exportSimulationXlsx } from './lib/exportXlsx.js';
import Navbar from './components/Navbar.jsx';
import HelpGuide from './components/HelpGuide.jsx';
import DayCompleteOverlay from './components/DayCompleteOverlay.jsx';
import FinalSummaryOverlay from './components/FinalSummaryOverlay.jsx';
import SimulationSummary from './components/SimulationSummary.jsx';
import ConfigPanel from './components/ConfigPanel.jsx';
import Workshop from './components/workshop/Workshop.jsx';
import WorkerPanel from './components/workers/WorkerPanel.jsx';
import KPIGrid from './components/kpi/KPIGrid.jsx';
import ChartsPanel from './components/charts/ChartsPanel.jsx';
import WorkforceOptimizer from './components/workforce/WorkforceOptimizer.jsx';
import EventTimeline from './components/timeline/EventTimeline.jsx';
import BootOverlay from './components/BootOverlay.jsx';
import BayUtilizationPage from './pages/BayUtilizationPage.jsx';
import WorkerUtilizationPage from './pages/WorkerUtilizationPage.jsx';
import FlowTimeAnalysisPage from './pages/FlowTimeAnalysisPage.jsx';
import ContributorsPage from './pages/ContributorsPage.jsx';

const PAGES = [
  { key: 'live', label: 'Live Simulation', icon: Factory },
  { key: 'bays', label: 'Bay Utilization', icon: Warehouse },
  { key: 'workers', label: 'Worker Utilization', icon: Users },
  { key: 'flow', label: 'Flow Time Analysis', icon: Timer },
];

function PageNav({ page, setPage }) {
  return (
    <nav className="mx-auto flex max-w-[1800px] gap-2 px-4 pt-4">
      {PAGES.map((p) => {
        const Icon = p.icon;
        const active = page === p.key;
        return (
          <button
            key={p.key}
            onClick={() => setPage(p.key)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-150 active:scale-[0.96] ${
              active ? 'border-brand-600 bg-brand-600 text-white shadow-card' : 'border-line bg-white text-ink-soft hover:bg-surface-soft hover:shadow-sm'
            }`}
          >
            <Icon size={14} /> {p.label}
          </button>
        );
      })}
    </nav>
  );
}

export default function App() {
  const {
    config, setConfig, result, frame, t,
    playing, speed, setSpeed, status,
    runSimulation, play, pause, reset, jumpToEnd, scrubTo, abort,
    dayComplete, continueAfterDayComplete, dismissDayCompletePaused,
    finalSummary, dismissFinalSummary,
  } = useSimulation();

  const [showConfig, setShowConfig] = useState(false);
  const [booting, setBooting] = useState(false);
  const [page, setPage] = useState('live');

  const eventTimes = useMemo(() => (result ? result.eventsLog.map(e => e.t) : []), [result]);
  const eventCount = frame ? countLE(eventTimes, frame.t) : 0;

  const handleRun = () => setBooting(true);
  const handleBootDone = () => { setBooting(false); runSimulation(config); };
  const handleReset = () => {
    if (!result) return;
    if (window.confirm('Reset playback to Day 1? Your configuration will be kept.')) reset();
  };
  const handleAbort = () => {
    if (status === 'idle') return;
    if (window.confirm('Abort the simulation? The current run will be discarded and playback stopped. Your configuration will be kept.')) abort();
  };
  const handlePlayPause = () => {
    if (!result) { handleRun(); return; }
    playing ? pause() : play();
  };

  const scrubPct = result && result.totalDuration > 0 ? (t / result.totalDuration) * 100 : 0;

  return (
    <div className="min-h-screen bg-surface-muted pb-8">
      <Navbar
        onOpenConfig={() => setShowConfig((v) => !v)}
        clock={frame?.clock}
        status={status}
        playing={playing}
        onPlayPause={handlePlayPause}
        onJumpEnd={jumpToEnd}
        onReset={handleReset}
        onRun={handleRun}
        onAbort={handleAbort}
        speed={speed}
        onSpeedChange={setSpeed}
        eventCount={eventCount}
        bottleneck={frame?.bottleneck}
        onDownload={() => exportSimulationXlsx(result)}
        canDownload={!!result}
        onOpenContributors={() => setPage((p) => (p === 'contributors' ? 'live' : 'contributors'))}
        contributorsActive={page === 'contributors'}
      />

      <BootOverlay open={booting} config={config} onDone={handleBootDone} />

      <DayCompleteOverlay dayComplete={dayComplete} onContinue={continueAfterDayComplete} onDismissPaused={dismissDayCompletePaused} dayMinutes={result?.dayMinutes} />

      <FinalSummaryOverlay finalSummary={finalSummary} onClose={dismissFinalSummary} horizonDays={config.horizonDays} dayMinutes={result?.dayMinutes} result={result} />

      <div className="mx-auto max-w-[1800px] px-4 pt-4">
        <HelpGuide />
      </div>

      <PageNav page={page} setPage={setPage} />

      <main className="mx-auto max-w-[1800px] px-4 pt-3">
        {page === 'live' && (
          <>
            <div className="flex w-full min-w-0 flex-col items-start gap-4 overflow-hidden lg:flex-row">
              <AnimatePresence initial={false}>
                {showConfig && (
                  <motion.div
                    key="config"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 320, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: 'easeInOut' }}
                    className="w-full shrink-0 overflow-hidden lg:w-[320px] lg:self-start"
                  >
                    <div className="w-full lg:w-[320px]">
                      <ConfigPanel config={config} setConfig={setConfig} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="min-w-0 w-full flex-1">
                <Workshop result={result} frame={frame} />

                {result && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-card">
                    <span className="whitespace-nowrap text-[11.5px] font-medium text-ink-faint">Scrub</span>
                    <input
                      type="range" min={0} max={1000}
                      value={Math.round(scrubPct * 10)}
                      onChange={(e) => scrubTo(Number(e.target.value) / 1000)}
                      className="flex-1 accent-brand-600"
                    />
                    <span className="w-12 text-right text-[11.5px] tabular-nums text-ink-faint">{scrubPct.toFixed(0)}%</span>
                  </div>
                )}

                <div className="mt-4">
                  <WorkerPanel result={result} frame={frame} />
                </div>
              </div>

              <div className="flex min-w-0 w-full flex-col gap-4 lg:w-[360px] lg:min-w-[300px] lg:shrink-0">
                <KPIGrid result={result} frame={frame} />
                <ChartsPanel result={result} frame={frame} />
                <WorkforceOptimizer config={config} setConfig={setConfig} result={result} />
                <SimulationSummary result={result} />
              </div>
            </div>

            <div className="mt-4">
              <EventTimeline result={result} frame={frame} />
            </div>
          </>
        )}

        {page === 'bays' && <BayUtilizationPage result={result} frame={frame} />}
        {page === 'workers' && <WorkerUtilizationPage result={result} frame={frame} />}
        {page === 'flow' && <FlowTimeAnalysisPage result={result} frame={frame} />}
        {page === 'contributors' && <ContributorsPage />}
      </main>
    </div>
  );
}
