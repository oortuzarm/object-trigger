import { useRef, useState, useCallback } from 'react'

export interface CameraState {
  stream: MediaStream | null
  isActive: boolean
  error: string | null
  facingMode: 'environment' | 'user'
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<CameraState>({
    stream: null,
    isActive: false,
    error: null,
    facingMode: 'environment',
  })

  const start = useCallback(async (facingMode: 'environment' | 'user' = 'environment') => {
    try {
      if (state.stream) {
        state.stream.getTracks().forEach((t) => t.stop())
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setState({ stream, isActive: true, error: null, facingMode })
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'No se pudo acceder a la cámara',
        isActive: false,
      }))
    }
  }, [state.stream])

  const stop = useCallback(() => {
    state.stream?.getTracks().forEach((t) => t.stop())
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setState((s) => ({ ...s, stream: null, isActive: false }))
  }, [state.stream])

  const flip = useCallback(() => {
    const next = state.facingMode === 'environment' ? 'user' : 'environment'
    start(next)
  }, [state.facingMode, start])

  const captureFrame = useCallback(
    (targetSize = 224): ImageData | null => {
      const video = videoRef.current
      if (!video || !state.isActive) return null

      const canvas = document.createElement('canvas')
      canvas.width = targetSize
      canvas.height = targetSize
      const ctx = canvas.getContext('2d')!

      // Center crop
      const vw = video.videoWidth
      const vh = video.videoHeight
      const size = Math.min(vw, vh)
      const ox = (vw - size) / 2
      const oy = (vh - size) / 2

      ctx.drawImage(video, ox, oy, size, size, 0, 0, targetSize, targetSize)
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
      const ox = (vw - size) / 2
      const oy = (vh - size) / 2

      ctx.drawImage(video, ox, oy, size, size, 0, 0, targetSize, targetSize)

      return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9))
    },
    [state.isActive]
  )

  return { videoRef, state, start, stop, flip, captureFrame, captureBlob }
}
