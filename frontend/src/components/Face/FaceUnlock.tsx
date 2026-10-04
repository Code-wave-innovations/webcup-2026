import { useRef, useState } from 'react'
import { Link } from 'react-router'
import logo2 from '../../assets/logo/code-wave-high-resolution-logo-transparent.png'
import { useFaceDetection } from '../../hooks/useFaceDetection'
import { defineMessages, useMessages } from '../../i18n'
import Webcam from './Webcam'

const messages = defineMessages(
    {
        verified: 'Visage vérifié',
        initialising: 'Initialisation caméra…',
        detected: 'Visage détecté',
        placeFace: 'Placez votre visage face à la caméra',
        searching: 'Recherche…',
        noFace: 'Aucun visage',
        intro: 'Reconnaissance faciale — le scan confirme le visage dès qu’il est détecté.',
        cameraOn: 'Caméra active',
        cameraStarting: 'Caméra…',
    },
    {
        verified: 'Face verified',
        initialising: 'Starting the camera…',
        detected: 'Face detected',
        placeFace: 'Place your face in front of the camera',
        searching: 'Searching…',
        noFace: 'No face',
        intro: 'Face recognition — the scan confirms the face as soon as it is detected.',
        cameraOn: 'Camera on',
        cameraStarting: 'Camera…',
    },
)

function VerifiedSeal() {
    const m = useMessages(messages)
    return (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <svg
                viewBox="0 0 100 100"
                className="verified-seal h-28 w-28 drop-shadow-[0_6px_14px_rgba(0,0,0,0.28)] sm:h-32 sm:w-32"
                role="img"
                aria-label={m.verified}
            >
                <path
                    d="M74.5 42.7 A 30 30 0 1 1 60.1 25.5"
                    fill="none"
                    stroke="#00A800"
                    strokeWidth="8"
                    strokeLinecap="round"
                />
                <path
                    d="M26 51 L42 67 L80 22"
                    fill="none"
                    stroke="#00A800"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    )
}

export default function FaceUnlock() {
    const m = useMessages(messages)
    const videoRef = useRef<HTMLVideoElement>(null)
    const [ready, setReady] = useState(false)
    // the camera's error, if any (the other statuses follow the language)
    const [cameraError, setCameraError] = useState<string | null>(null)

    const { faceDetected, modelReady } = useFaceDetection(videoRef, {
        enabled: ready,
    })

    const liveStatus = !ready
        ? cameraError ?? m.initialising
        : faceDetected
            ? m.detected
            : m.placeFace

    const faceLabel = !modelReady
        ? m.searching
        : faceDetected
            ? m.detected
            : m.noFace

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
                <p className="text-[13px] font-medium uppercase tracking-[0.42em] text-[#4a90ff]">
                    Face Unlock
                </p>
            </header>

            <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 pb-16 pt-2">
                <h1 className="mb-2 font-[family-name:Georgia,Times_New_Roman,serif] text-4xl tracking-tight sm:text-5xl">
                    CodeWave
                </h1>
                <p className="mb-8 max-w-md text-center text-sm text-white/70">
                    {m.intro}
                </p>

                <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] bg-black/40 shadow-[0_0_0_1px_#4a90ff33]">
                    <Webcam
                        videoRef={videoRef}
                        onReady={() => {
                            setReady(true)
                            setCameraError(null)
                        }}
                        onError={(message) => {
                            setReady(false)
                            setCameraError(message)
                        }}
                    />
                    <div
                        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#4a90ff66] to-transparent"
                        aria-hidden
                    />
                    {ready && !faceDetected && (
                        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                            <div className="scanner-beam absolute inset-y-0 w-1/4" />
                        </div>
                    )}
                    {faceDetected && <VerifiedSeal />}
                    <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-[12px] uppercase tracking-[0.2em]">
                        <span
                            className={`h-1.5 w-1.5 rounded-full ${ready ? 'bg-emerald-400' : 'bg-red-400'}`}
                        />
                        {ready ? m.cameraOn : m.cameraStarting}
                    </div>
                    {ready && (
                        <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-[12px] uppercase tracking-[0.2em]">
                            <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                    faceDetected ? 'bg-[#4a90ff]' : 'bg-white/30'
                                }`}
                            />
                            {faceLabel}
                        </div>
                    )}
                </div>

                <p className="mt-6 min-h-[1.5rem] text-center text-sm text-white/80">{liveStatus}</p>
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
          animation: scanner-sweep 1.6s linear infinite alternate;
        }
        @keyframes verified-pop {
          0% { transform: scale(0.72); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .verified-seal {
          animation: verified-pop 0.28s ease-out;
        }
      `}</style>
        </main>
    )
}
