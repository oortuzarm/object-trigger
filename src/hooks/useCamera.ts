import { useRef, useState, useCallback } from 'react'

export interface CameraState {
  stream: MediaStream | null
  isActive: boolean
  /** True once the video element has enough data to display a frame (readyState >= 2).
   *  This is the correct gate for enabling inference — isActive alone is not enough. */
  isReady: boolean
  error: string | null
  facingMode: 'environment' | 'user'
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const facingModeRef = useRef<'environment' | 'user'>('environment')

  const [state, setState] = useState<CameraState>({
    stream: null,
    isActive: false,
    isReady: false,
    error: null,
    facingMode: 'environment',
  })

  // Stable reference — uses refs instead of state values in closure.
  const start = useCallback(async (facingMode: 'environment' | 'user' = 'environment') => {
    // Stop the previous stream before requesting a new one
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    facingModeRef.current = facingMode
    setState((s) => ({ ...s, isActive: false, isReady: false, error: null, facingMode }))

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream

      const video = videoRef.current
      if (video) {
        // Listen BEFORE assigning srcObject to guarantee we never miss the event
        const onLoadedData = () => {
          setState((s) => ({ ...s, isReady: true }))
          video.removeEventListener('loadeddata', onLoadedData)
        }
        video.addEventListener('loadeddata', onLoadedData)
        video.srcObject = stream
        // Autoplay may be blocked on some browsers — that's fine, the stream is still live
        await video.play().catch(() => {})
      }

      setState((s) => ({ ...s, stream, isActive: true, error: null }))
    } catch (err) {
      streamRef.current = null
      setState((s) => ({
        ...s,
        stream: null,
        isActive: false,
        isReady: false,
        error: err instanceof Error ? err.message : 'No se pudo acceder a la cámara',
      }))
    }
  }, []) // stable: relies on refs, not state values

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    const video = videoRef.current
    if (video) {
      video.srcObject = null
    }
    setState((s) => ({ ...s, stream: null, isActive: false, isReady: false }))
  }, [])

  // stable: facingModeRef avoids needing state.facingMode in closure
  const flip = useCallback(() => {
    start(facingModeRef.current === 'environment' ? 'user' : 'environment')
  }, [start])

  const captureFrame = useCallback(
    (targetSize = 224): ImageData | null => {
      const video = videoRef.current
      if (!video || !state.isActive) return null
      const canvas = document.createElement('canvas')
      canvas.width = targetSize
      canvas.height = targetSize
      const ctx = canvas.getContext('2d')!
      const vw = video.videoWidth
      const vh = video.videoHeight
      const size = Math.min(vw, vh)
      ctx.drawImage(video, (vw - size) / 2, (vh - size) / 2, size, size, 0, 0, targetSize, targetSize)
      return ctx.getImageData(0, 0, targetSize, targetSize)
    },
    [state.isActive]
  )

  const captureBlob = useCallback(
    async (targetSize = 224): Promise<Blob | null> => {
      const video = videoRef.current
      if (!video || !state.isActive) return null
      const canvas = document.createElement('canvas')
      canvas.width = targetSize
      canvas.height = targetSize
      const ctx = canvas.getContext('2d')!
      const vw = video.videoWidth
      const vh = video.videoHeight
      const size = Math.min(vw, vh)
      ctx.drawImage(video, (vw - size) / 2, (vh - size) / 2, size, size, 0, 0, targetSize, targetSize)
      return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9))
    },
    [state.isActive]
  )

  return { videoRef, state, start, stop, flip, captureFrame, captureBlob }
}
