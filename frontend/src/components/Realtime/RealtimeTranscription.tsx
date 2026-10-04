import { useState } from 'react'
import {
    useRealtimeTranscription,
    type RealtimeLanguage,
} from '../../hooks/useRealtimeTranscription'
import { defineMessages, useLocale, useMessages } from '../../i18n'

const messages = defineMessages(
    {
        status: { idle: 'Prêt', connecting: 'Connexion…', listening: 'Écoute en cours', closed: 'Déconnecté', error: 'Erreur' },
        eyebrow: 'Transcription temps réel',
        title: 'Parlez, le texte apparaît',
        language: 'Langue parlée',
        start: 'Démarrer',
        stop: 'Arrêter',
        error: (code: string, message: string) => `${code} : ${message}`,
        empty: 'La transcription apparaîtra ici…',
    },
    {
        status: { idle: 'Ready', connecting: 'Connecting…', listening: 'Listening', closed: 'Disconnected', error: 'Error' },
        eyebrow: 'Real-time transcription',
        title: 'Speak, the text appears',
        language: 'Spoken language',
        start: 'Start',
        stop: 'Stop',
        error: (code, message) => `${code}: ${message}`,
        empty: 'The transcription will appear here…',
    },
)

/** Each language is named in itself. */
const languageLabels: Record<RealtimeLanguage, string> = {
    fr: 'Français',
    en: 'English',
    mg: 'Malagasy',
}

function RealtimeTranscription() {
    const m = useMessages(messages)
    // the spoken language starts as the interface's (Malagasy stays one click away)
    const interfaceLocale = useLocale()
    const [language, setLanguage] = useState<RealtimeLanguage>(interfaceLocale)
    const { start, stop, status, partialText, finalText, error } = useRealtimeTranscription({
        mode: 'BALANCED',
        language,
    })

    const listening = status === 'listening'

    return (
        <main className="relative isolate flex min-h-svh flex-col bg-white">
            <div
                className="pointer-events-none absolute inset-0 -z-10"
                aria-hidden="true"
            >
                <span className="absolute -left-24 top-16 h-[420px] w-[280px] rotate-[18deg] bg-[#4A90FF] opacity-[0.12]" />
                <span className="absolute -right-20 bottom-0 h-[480px] w-[260px] -rotate-[18deg] bg-[#4A90FF] opacity-[0.10]" />
            </div>

            <section className="flex flex-1 flex-col items-center justify-center px-6 py-12">
                <p className="mb-2 text-sm font-medium uppercase tracking-[0.48em] text-[#4A90FF]">
                    {m.eyebrow}
                </p>
                <h1 className="mb-8 text-3xl font-semibold tracking-tight text-[#0A2342] sm:text-4xl">
                    {m.title}
                </h1>

                <div className="mb-8 flex items-center gap-4">
                    <select
                        value={language}
                        aria-label={m.language}
                        onChange={(e) => setLanguage(e.target.value as RealtimeLanguage)}
                        disabled={listening || status === 'connecting'}
                        className="rounded-full border border-[#4A90FF]/40 px-4 py-3 text-sm font-semibold text-[#0A2342] transition hover:border-[#4A90FF] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {(Object.keys(languageLabels) as RealtimeLanguage[]).map((lang) => (
                            <option key={lang} value={lang}>
                                {languageLabels[lang]}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={start}
                        disabled={listening || status === 'connecting'}
                        className="rounded-full bg-[#4A90FF] px-8 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0A2342] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {m.start}
                    </button>
                    <button
                        type="button"
                        onClick={stop}
                        disabled={!listening}
                        className="rounded-full border border-[#4A90FF]/40 px-8 py-3 text-sm font-semibold text-[#0A2342] transition hover:border-[#4A90FF] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {m.stop}
                    </button>
                </div>

                <p className="mb-6 text-sm uppercase tracking-[0.3em] text-[#0A2342]/60">
                    {m.status[status]}
                    {listening && (
                        <span className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-red-500 align-middle" />
                    )}
                </p>

                {error && (
                    <p className="mb-6 max-w-2xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                        {m.error(error.code, error.message)}
                    </p>
                )}

                <div className="w-full max-w-3xl rounded-2xl border border-[#4A90FF]/20 bg-white/80 p-6 shadow-sm backdrop-blur">
                    {finalText || partialText ? (
                        <p className="whitespace-pre-wrap text-left text-lg leading-relaxed text-[#0A2342]">
                            {finalText}
                            {partialText && (
                                <span className="text-[#0A2342]/40"> {partialText}</span>
                            )}
                        </p>
                    ) : (
                        <p className="text-sm text-[#0A2342]/40">
                            {m.empty}
                        </p>
                    )}
                </div>
            </section>
        </main>
    )
}

export default RealtimeTranscription
