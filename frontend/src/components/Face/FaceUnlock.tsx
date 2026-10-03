import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import logo2 from '../../assets/logo/code-wave-high-resolution-logo-transparent.png'
import {
    emotionFrame,
    enrollFrames,
    faceHealth,
    identifyFrame,
    verifyFrame,
    type FaceJson,
} from '../../hooks/useFaceApi'
import { useFaceDetection } from '../../hooks/useFaceDetection'

type Mode = 'enroll' | 'verify' | 'identify' | 'emotion'

const ENROLL_COUNT = 3

function captureJpeg(video: HTMLVideoElement): Promise<Blob> {
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return Promise.reject(new Error('No canvas'))
    ctx.drawImage(video, 0, 0)
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('capture failed'))),
            'image/jpeg',
            0.92,
        )
    })
}

export default function FaceUnlock() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [mode, setMode] = useState<Mode>('enroll')
    const [name, setName] = useState('')
    const [ready, setReady] = useState(false)
    const [busy, setBusy] = useState(false)
    const [status, setStatus] = useState<string>('Initialisation caméra…')
    const [engineOk, setEngineOk] = useState<boolean | null>(null)
    const [result, setResult] = useState<FaceJson | null>(null)
    const [enrollProgress, setEnrollProgress] = useState(0)

    const { faceDetected, bbox, modelReady } = useFaceDetection(videoRef, {
        enabled: ready,
    })

    useEffect(() => {
        let stream: MediaStream | null = null
        let cancelled = false

        async function boot() {
            try {
                const health = await faceHealth()
                if (!cancelled) {
                    setEngineOk(
                        Boolean(
                            health?.ok &&
                            (health?.engine === 'insightface' ||
                                health?.engine === 'insightface_lazy'),
                        ),
                    )
                }
            } catch {
                if (!cancelled) setEngineOk(false)
            }

            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false,
                })
                if (cancelled) {
                    stream.getTracks().forEach((t) => t.stop())
                    return
                }
                if (videoRef.current) {
                    videoRef.current.srcObject = stream
                    await videoRef.current.play()
                    setReady(true)
                    setStatus('Placez votre visage dans l’ovale')
                }
            } catch {
                setStatus('Accès caméra refusé ou indisponible')
            }
        }

        void boot()
        return () => {
            cancelled = true
            stream?.getTracks().forEach((t) => t.stop())
        }
    }, [])

    async function runAction() {
        const video = videoRef.current
        if (!video || !ready || busy) return
        setBusy(true)
        setResult(null)
        try {
            if (mode === 'enroll') {
                if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name.trim())) {
                    setStatus('Nom invalide (lettres, chiffres, ._-)')
                    return
                }
                const blobs: Blob[] = []
                for (let i = 0; i < ENROLL_COUNT; i++) {
                    setEnrollProgress(i + 1)
                    setStatus(`Capture ${i + 1}/${ENROLL_COUNT}…`)
                    blobs.push(await captureJpeg(video))
                    await new Promise((r) => setTimeout(r, 350))
                }
                const data = await enrollFrames(name.trim(), blobs)
                setResult(data)
                setStatus(
                    data.committed
                        ? `Enrôlé : ${data.name ?? name}`
                        : data.message ?? 'Échantillons enregistrés',
                )
            } else if (mode === 'verify') {
                if (!name.trim()) {
                    setStatus('Indiquez le nom à vérifier')
                    return
                }
                setStatus('Vérification…')
                const blob = await captureJpeg(video)
                const data = await verifyFrame(name.trim(), blob)
                setResult(data)
                setStatus(
                    data.verified
                        ? `Vérifié (${data.score?.toFixed(2)})`
                        : data.error === 'liveness_failed'
                            ? 'Liveness échouée — visage réel requis'
                            : 'Non reconnu',
                )
            } else if (mode === 'identify') {
                setStatus('Identification…')
                const blob = await captureJpeg(video)
                try {
                    const data = await identifyFrame(blob)
                    setResult(data)
                    setStatus(data.identity ? `Identifié : ${data.identity}` : 'Inconnu')
                } catch (err: unknown) {
                    const ax = err as { response?: { data?: FaceJson } }
                    const data = ax.response?.data
                    if (data) {
                        setResult(data)
                        setStatus(data.identity ? `Identifié : ${data.identity}` : 'Inconnu')
                    } else {
                        setStatus('Erreur identification')
                    }
                }
            } else {
                setStatus('Analyse émotion…')
                const blob = await captureJpeg(video)
                const data = await emotionFrame(blob)
                setResult(data)
                setStatus(data.label ? `Émotion : ${data.label}` : 'Aucune émotion')
            }
        } catch (err: unknown) {
            const ax = err as { response?: { data?: FaceJson }; message?: string }
            if (ax.response?.data) {
                setResult(ax.response.data)
                setStatus(ax.response.data.error ?? 'Échec')
            } else {
                setStatus(ax.message ?? 'Erreur réseau')
            }
        } finally {
            setBusy(false)
            setEnrollProgress(0)
        }
    }

    const cta =
        mode === 'enroll'
            ? 'Enrôler'
            : mode === 'verify'
                ? 'Déverrouiller'
                : mode === 'identify'
                    ? 'Identifier'
                    : 'Lire l’émotion'

    const liveStatus =
        busy || result
            ? status
            : ready
                ? faceDetected
                    ? 'Visage détecté — prêt'
                    : 'Aucun visage détecté'
                : status

    return (
        <main className="relative isolate min-h-svh overflow-hidden bg-[#0a2342] text-white">
            <div
                className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_20%_0%,#4a90ff55,transparent_50%),radial-gradient(ellipse_at_80%_100%,#4a90ff33,transparent_45%)]"
                aria-hidden
            />

            <header className="flex items-center justify-between px-6 py-4 sm:px-10">
                <Link to="/">
                    <img
                        src={logo2}
                        alt="CodeWave Innovations"
                        className="h-10 w-auto object-contain brightness-0 invert sm:h-12"
                    />
                </Link>
                <p className="text-[11px] font-medium uppercase tracking-[0.42em] text-[#4a90ff]">
                    Face Unlock
                </p>
            </header>

            <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 pb-16 pt-2">
                <h1 className="mb-2 font-[family-name:Georgia,Times_New_Roman,serif] text-4xl tracking-tight sm:text-5xl">
                    CodeWave
                </h1>
                <p className="mb-8 max-w-md text-center text-sm text-white/70">
                    Reconnaissance faciale guidée — placez votre visage dans l’ovale, puis lancez l’action.
                </p>

                <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] bg-black/40 shadow-[0_0_0_1px_#4a90ff33]">
                    <video
                        ref={videoRef}
                        className="aspect-[3/4] w-full scale-x-[-1] object-cover"
                        playsInline
                        muted
                    />
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#4a90ff66] to-transparent" aria-hidden />
                    {bbox ? (
                        <div
                            className="pointer-events-none absolute"
                            aria-hidden
                            style={{
                                left: `${bbox.left}%`,
                                top: `${bbox.top}%`,
                                width: `${bbox.width}%`,
                                height: `${bbox.height}%`,
                            }}
                        >
                            <div className="absolute inset-0 border border-[#4a90ff]/60 shadow-[0_0_18px_#4a90ff66]" />
                            {(['left-0 top-0 border-l-2 border-t-2', 'right-0 top-0 border-r-2 border-t-2', 'left-0 bottom-0 border-l-2 border-b-2', 'right-0 bottom-0 border-r-2 border-b-2'] as const).map(
                                (c) => (
                                    <span key={c} className={`absolute h-4 w-4 border-[#4a90ff] ${c}`} />
                                ),
                            )}
                        </div>
                    ) : (
                        <div
                            className="pointer-events-none absolute inset-0 flex items-center justify-center"
                            aria-hidden
                        >
                            <div
                                className="h-[58%] w-[72%] rounded-[50%] border-2 border-white/60"
                                style={{ boxShadow: '0 0 0 9999px rgba(10, 35, 66, 0.55)' }}
                            />
                        </div>
                    )}
                    {ready && (
                        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                            <div className="scanner-beam absolute inset-y-0 w-1/4" />
                        </div>
                    )}
                    {enrollProgress > 0 && (
                        <p className="absolute bottom-4 left-0 right-0 text-center text-xs tracking-[0.3em] text-[#4a90ff]">
                            {enrollProgress}/{ENROLL_COUNT}
                        </p>
                    )}
                    <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-[10px] uppercase tracking-[0.2em]">
                        <span
                            className={`h-1.5 w-1.5 rounded-full ${ready ? 'bg-emerald-400' : 'bg-red-400'
                                }`}
                        />
                        {ready ? 'Caméra active' : 'Caméra…'}
                    </div>
                    {ready && (
                        <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-[10px] uppercase tracking-[0.2em]">
                            <span
                                className={`h-1.5 w-1.5 rounded-full ${faceDetected ? 'bg-[#4a90ff]' : 'bg-white/30'
                                    }`}
                            />
                            {modelReady ? (faceDetected ? 'Visage détecté' : 'Recherche…') : 'Modèle…'}
                        </div>
                    )}
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs uppercase tracking-[0.2em]">
                    {(['enroll', 'verify', 'identify', 'emotion'] as Mode[]).map((m) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => {
                                setMode(m)
                                setResult(null)
                            }}
                            className={`px-3 py-2 transition-colors ${mode === m ? 'text-[#4a90ff]' : 'text-white/50 hover:text-white/80'
                                }`}
                        >
                            {m}
                        </button>
                    ))}
                </div>

                {(mode === 'enroll' || mode === 'verify') && (
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nom d’identité"
                        className="mt-4 w-full max-w-md border-b border-white/30 bg-transparent px-1 py-2 text-center text-sm outline-none placeholder:text-white/35 focus:border-[#4a90ff]"
                    />
                )}

                <button
                    type="button"
                    disabled={!ready || busy}
                    onClick={() => void runAction()}
                    className="mt-8 min-w-[12rem] bg-[#4a90ff] px-8 py-3 text-sm font-semibold uppercase tracking-[0.28em] text-[#0a2342] transition enabled:hover:brightness-110 disabled:opacity-40"
                >
                    {busy ? '…' : cta}
                </button>

                <p className="mt-6 min-h-[1.5rem] text-center text-sm text-white/80">{liveStatus}</p>

                {engineOk === false && (
                    <p className="mt-2 text-center text-xs text-red-300">
                        Moteur face API injoignable — démarrez face-recognitions sur le port 9000.
                    </p>
                )}

                {result?.liveness && (
                    <p className="mt-1 text-center text-xs text-white/50">
                        Liveness {result.liveness.ok ? 'ok' : 'fail'} · {result.liveness.score.toFixed(2)} ·{' '}
                        {result.liveness.backend}
                    </p>
                )}
            </section>
            <style>{`
        @keyframes scanner-sweep {
          0% { transform: translateX(-110%); }
          100% { transform: translateX(460%); }
        }
        .scanner-beam {
          background: linear-gradient(to right, transparent, #4a90ff55 30%, #4a90ffcc 50%, #4a90ff55 70%, transparent);
          box-shadow: 0 0 24px #4a90ff99;
          will-change: transform;
          animation: scanner-sweep 2.5s linear infinite;
        }
      `}</style>
        </main>
    )
}
