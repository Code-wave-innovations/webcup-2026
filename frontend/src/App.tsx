import logo from './assets/logo/code-wave-logo.png'
import logo2 from './assets/logo/code-wave-high-resolution-logo-transparent.png'
function App() {
  return (
    <main className="relative isolate flex min-h-svh flex-col overflow-hidden bg-white">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
      >
        <span className="absolute -left-24 top-16 h-[420px] w-[280px] rotate-[18deg] bg-[#4A90FF] opacity-[0.12]" />
        <span className="absolute -left-8 top-10 h-[520px] w-16 rotate-[18deg] bg-[#4A90FF] opacity-[0.18]" />
        <span className="absolute -right-20 bottom-0 h-[480px] w-[260px] -rotate-[18deg] bg-[#4A90FF] opacity-[0.10]" />
        <span className="absolute right-16 bottom-10 h-[360px] w-12 -rotate-[18deg] bg-[#4A90FF] opacity-[0.16]" />
      </div>

      <header className="flex items-center justify-between px-6 py-4 sm:px-10">
        <img
          src={logo2}
          alt="CodeWave Innovations"
          className="h-12 w-auto object-contain sm:h-14"
        />
        <p className="hidden text-[11px] font-medium uppercase tracking-[0.42em] text-[#0A2342] sm:block">
          Innovations
        </p>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center px-6 pb-12 text-center">
        <img
          src={logo}
          alt="CodeWave Innovations"
          className="mb-6 h-36 w-auto object-contain sm:mb-8 sm:h-44 md:h-52"
        />

        <p className="mb-3 text-sm font-medium uppercase tracking-[0.48em] text-[#4A90FF]">
          Hello
        </p>
        <h1 className="max-w-4xl text-4xl font-semibold leading-[1.08] tracking-tight text-[#0A2342] sm:text-5xl md:text-6xl">
          We are the team
          <span className="block text-[#4A90FF]">CodeWave</span>
        </h1>
      </section>
    </main>
  )
}

export default App
