import { useState, useMemo, useEffect } from 'react'
import { Abacus, type AbacusColumn, type BeadStep } from './lib/abacus'
import { AbacusCanvas } from './components/AbacusCanvas'
import { CalculatorUI } from './components/CalculatorUI'
import { ValueDisplay } from './components/ValueDisplay'
import { motion, AnimatePresence } from 'motion/react'
import { Info, HelpCircle, X } from 'lucide-react'

type Op = '+' | '-' | '×' | '÷' | null

const NUM_COLS = 5
const MAX_VALUE = Math.pow(10, NUM_COLS) - 1

export default function App() {
  const abacus = new Abacus(NUM_COLS)
  const [columns, setColumns] = useState<AbacusColumn[]>(abacus.getColumns())
  const [steps, setSteps] = useState<BeadStep[]>([])
  const [error, setError] = useState<string | null>(null)
  const [remainder, setRemainder] = useState<number | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  useEffect(() => {
    // Auto-minimize on mobile after a short delay
    let minimizeTimer
    if (window.innerWidth < 768) {
      minimizeTimer = setTimeout(() => setIsMinimized(true), 1200)
    }

    return () => {
      if (minimizeTimer) clearTimeout(minimizeTimer)
    }
  }, [])

  const syncState = (animated: boolean) => {
    setColumns(abacus.getColumns())
    const newSteps = animated ? abacus.getSteps() : []
    setSteps(newSteps)

    if (animated && newSteps.length > 0) {
      setIsCalculating(true)
      // Calculate total duration based on steps: gap * count + anim_duration + buffer
      const duration = newSteps.length * 180 + 220 + 200
      setTimeout(() => setIsCalculating(false), duration)
    }
  }
  // ... (rest of functions)
  const handleCompute = (a: number, op: Op, b: number) => {
    setError(null)
    setRemainder(null)

    try {
      if (op === null) {
        if (a < 0 || a > MAX_VALUE) {
          setError(`Value must be 0–${MAX_VALUE}`)
          return
        }
        abacus.setValue(a)
        syncState(false)
        return
      }

      if (a < 0 || a > MAX_VALUE) {
        setError(`Value out of range (0–${MAX_VALUE})`)
        return
      }
      abacus.setValue(a)

      if (op === '+') {
        if (a + b > MAX_VALUE) {
          setError('Result overflow')
          return
        }
        abacus.add(b)
      } else if (op === '-') {
        if (b > a) {
          setError('Result < 0')
          return
        }
        abacus.subtract(b)
      } else if (op === '×') {
        if (a * b > MAX_VALUE) {
          setError('Result overflow')
          return
        }
        abacus.multiply(b)
      } else if (op === '÷') {
        if (b === 0) {
          setError('Divide by zero')
          return
        }
        const { remainder: rem } = abacus.divide(b)
        setRemainder(rem)
      }

      syncState(true)
    } catch (e) {
      console.log(e)
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  const handleReset = () => {
    abacus.reset()
    setError(null)
    setRemainder(null)
    syncState(false)
  }

  const handleManualChange = (
    colIndex: number,
    heaven: boolean,
    earth: number,
  ) => {
    abacus.setColumnState(colIndex, heaven, earth)
    syncState(false)
  }

  const currentValue = columns.reduce(
    (t, c, i) =>
      t +
      ((c.heavenBead ? 5 : 0) + c.earthBeads) * 10 ** (columns.length - 1 - i),
    0,
  )

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden selection:bg-orange-500/30">
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-12 pb-4 border-b border-white/5 bg-zinc-900/20 backdrop-blur-md z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <span className="font-black text-zinc-950 text-sm">AB</span>
          </div>
          <div>
            <h1 className="font-black tracking-tighter text-xl leading-none">
              Abacus
            </h1>
          </div>
        </div>
        <button
          onClick={() => setShowHelp(true)}
          className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 text-zinc-400 hover:text-orange-400 transition-all active:scale-90"
        >
          <HelpCircle size={24} />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Visualization Section - Guaranteed space */}
        <section className="flex-1 relative flex flex-col overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_40%,rgba(249,115,22,0.08),transparent_70%)]" />

          <div className="relative z-10 flex flex-col h-full">
            {/* Value Display - Reduced padding to save space */}
            <div className="shrink-0">
              <ValueDisplay
                value={currentValue}
                columns={columns}
                remainder={remainder}
              />
            </div>

            {/* Abacus Canvas - Takes all remaining space */}
            <div className="flex-1 relative min-h-[250px]">
              <AbacusCanvas
                columns={columns}
                steps={steps}
                onManualChange={handleManualChange}
              />
            </div>
          </div>
        </section>

        {/* Controls Section - Swipeable on mobile, hidden during calculation */}
        <motion.section
          initial={false}
          animate={{
            y: isCalculating
              ? '100%'
              : isMinimized
                ? 'calc(100% - 60px)'
                : '0%',
            opacity: isCalculating ? 0 : 1,
          }}
          transition={{ type: 'spring', damping: 30, stiffness: 250 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.1}
          onDragEnd={(_, info) => {
            if (info.offset.y > 50) setIsMinimized(true)
            if (info.offset.y < -50) setIsMinimized(false)
          }}
          className="shrink-0 relative z-20 px-4 pt-2 pb-6 bg-zinc-900/90 backdrop-blur-3xl border-t border-white/10 rounded-t-[2.5rem] shadow-[0_-15px_40px_rgba(0,0,0,0.6)] md:translate-y-0!"
        >
          <div
            onClick={() => setIsMinimized(!isMinimized)}
            className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-3 cursor-grab active:cursor-grabbing hover:bg-white/20 transition-colors"
          />

          <div
            className={`transition-all duration-500 ${isMinimized ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : 'opacity-100'}`}
          >
            <CalculatorUI
              onCompute={handleCompute}
              onReset={handleReset}
              displayValue={currentValue}
              error={error}
              remainder={remainder}
            />
          </div>

          {/* Mobile Hint */}
          <div className="md:hidden text-center mt-2">
            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em]">
              {isCalculating
                ? 'Calculating...'
                : isMinimized
                  ? 'Swipe up to open'
                  : 'Swipe down to hide'}
            </p>
          </div>
        </motion.section>
      </main>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 40, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-[2.5rem] p-8 max-w-md w-full relative shadow-2xl"
            >
              <button
                onClick={() => setShowHelp(false)}
                className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-zinc-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-400">
                  <Info size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight">
                    How to Use
                  </h2>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
                    Master the beads
                  </p>
                </div>
              </div>

              <div className="space-y-6 text-zinc-400 leading-relaxed text-sm">
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                  <h3 className="text-zinc-100 font-bold mb-2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                    Traditional Logic
                  </h3>
                  <p>
                    This abacus uses the 1-4 system (one heaven bead, four earth
                    beads).
                  </p>
                  <ul className="mt-3 space-y-2">
                    <li className="flex justify-between">
                      <span className="text-zinc-500">Heaven Bead</span>{' '}
                      <span className="text-orange-400 font-bold">5</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-zinc-500">Earth Beads</span>{' '}
                      <span className="text-orange-400 font-bold">1 each</span>
                    </li>
                  </ul>
                </div>

                <p>
                  Use the calculator to perform operations. The abacus will
                  animate the{' '}
                  <strong className="text-orange-400">
                    traditional bead movements
                  </strong>{' '}
                  used by masters, including five-complements and
                  ten-complements.
                </p>

                <div className="pt-6 border-t border-white/5">
                  <p className="text-xs italic text-zinc-500 text-center">
                    "The abacus is not just a tool for calculation, but a way to
                    visualize the harmony of numbers."
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
