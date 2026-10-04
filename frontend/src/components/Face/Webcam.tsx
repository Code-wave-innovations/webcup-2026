import { useEffect, useRef, type RefObject } from 'react'
import { defineMessages, messagesFor } from '../../i18n'

const messages = defineMessages(
    { unavailable: 'Caméra indisponible', refused: 'Accès caméra refusé ou indisponible' },
    { unavailable: 'Camera unavailable', refused: 'Camera access refused or unavailable' },
)

type WebcamProps = {
    videoRef: RefObject<HTMLVideoElement | null>
    onReady: () => void
    onError: (message: string) => void
    className?: string
}

export default function Webcam({ videoRef, onReady, onError, className = 'aspect-[3/4] w-full scale-x-[-1] object-cover' }: WebcamProps) {
    const onReadyRef = useRef(onReady)
    const onErrorRef = useRef(onError)

    useEffect(() => {
        onReadyRef.current = onReady
        onErrorRef.current = onError
    })

    useEffect(() => {
        let stream: MediaStream | null = null
        let cancelled = false

        async function boot() {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'user',
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false,
                })
                if (cancelled) {
                    stream.getTracks().forEach((track) => track.stop())
                    return
                }
                const video = videoRef.current
                if (!video) {
                    stream.getTracks().forEach((track) => track.stop())
                    onErrorRef.current(messagesFor(messages).unavailable)
                    return
                }
                video.srcObject = stream
                await video.play()
                if (!cancelled) onReadyRef.current()
            } catch {
                if (!cancelled) onErrorRef.current(messagesFor(messages).refused)
            }
        }

        void boot()
        return () => {
            cancelled = true
            stream?.getTracks().forEach((track) => track.stop())
        }
    }, [videoRef])

    return (
        <video
            ref={videoRef}
            className={className}
            playsInline
            muted
            autoPlay
        />
    )
}
