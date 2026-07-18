import {
  AudioSample,
  AudioSampleSource,
  BufferTarget,
  CanvasSource,
  Output,
  QUALITY_VERY_HIGH,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
} from 'mediabunny'
import {
  type CaptureAudioEngine,
  type CaptureAudioPacket,
} from './audio/capture'

const TARGET_FPS = 60
const FRAME_DURATION = 1 / TARGET_FPS

export function isRecordingSupported(): boolean {
  return (
    typeof VideoEncoder !== 'undefined' &&
    typeof AudioEncoder !== 'undefined' &&
    typeof AudioWorkletNode !== 'undefined' &&
    typeof VideoFrame !== 'undefined'
  )
}

export function buildRecordingFilename(
  gameSlug: string,
  courseName: string,
  reelIndex?: number,
): string {
  const safeGame = gameSlug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const safeCourse = courseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  if (reelIndex !== undefined) {
    return `${safeGame}-reel-${String(reelIndex).padStart(2, '0')}-${safeCourse}-${stamp}.webm`
  }
  return `${safeGame}-${safeCourse}-${stamp}.webm`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/**
 * WebCodecs + Mediabunny recorder.
 * Video frames and audio packets share the AudioContext clock — no DelayNode fudge.
 */
export class RaceRecorder {
  private output: Output<WebMOutputFormat, BufferTarget> | null = null
  private canvasSource: CanvasSource | null = null
  private audioSource: AudioSampleSource | null = null
  private target: BufferTarget | null = null
  private epoch = 0
  private startedAtMs = 0
  private active = false
  private pipe: Promise<void> = Promise.resolve()
  private lastVideoTime = -1
  private readonly audio: CaptureAudioEngine

  constructor(audio: CaptureAudioEngine) {
    this.audio = audio
  }

  isRecording() {
    return this.active
  }

  async start(canvas: HTMLCanvasElement) {
    if (!isRecordingSupported()) {
      throw new Error('Recording is not supported in this browser.')
    }
    if (this.active) return

    this.audio.unlock()

    const videoCodec = await getFirstEncodableVideoCodec(['vp9', 'av1', 'vp8'])
    const audioCodec = await getFirstEncodableAudioCodec(['opus'])
    if (!videoCodec || !(await canEncodeVideo(videoCodec))) {
      throw new Error('No supported video encoder (need VP9/AV1/VP8).')
    }
    if (!audioCodec || !(await canEncodeAudio(audioCodec))) {
      throw new Error('No supported audio encoder (need Opus).')
    }

    this.target = new BufferTarget()
    this.output = new Output({
      format: new WebMOutputFormat(),
      target: this.target,
    })

    this.canvasSource = new CanvasSource(canvas, {
      codec: videoCodec,
      bitrate: QUALITY_VERY_HIGH,
      keyFrameInterval: 2,
      // Full canvas backing-store resolution — no downscale.
    })
    this.output.addVideoTrack(this.canvasSource, { frameRate: TARGET_FPS })

    this.audioSource = new AudioSampleSource({
      codec: audioCodec,
      bitrate: QUALITY_VERY_HIGH,
    })
    this.output.addAudioTrack(this.audioSource)

    await this.output.start()

    this.epoch = this.audio.getContextTime()
    this.startedAtMs = performance.now()
    this.lastVideoTime = -1
    this.active = true
    this.pipe = Promise.resolve()

    try {
      await this.audio.startCapture((packet) => {
        this.enqueue(() => this.addAudioPacket(packet))
      })
    } catch (error) {
      this.active = false
      await this.output.cancel().catch(() => undefined)
      this.output = null
      this.canvasSource = null
      this.audioSource = null
      this.target = null
      throw error
    }
  }

  /** Call after each game canvas draw while recording. */
  captureFrame() {
    if (!this.active || !this.canvasSource) return

    const timestamp = Math.max(0, this.audio.getContextTime() - this.epoch)
    // Avoid duplicate timestamps if draw is called twice in one tick.
    if (timestamp <= this.lastVideoTime) return
    this.lastVideoTime = timestamp

    this.enqueue(async () => {
      if (!this.canvasSource || !this.active) return
      await this.canvasSource.add(timestamp, FRAME_DURATION)
    })
  }

  async stop(): Promise<Blob | null> {
    if (!this.active) return null

    this.active = false
    this.audio.stopCapture()

    // Let any in-flight worklet messages enqueue, then drain the encode pipe.
    await Promise.resolve()
    try {
      await this.pipe
    } catch {
      // drain errors; still try to finalize
    }

    this.canvasSource?.close()
    this.audioSource?.close()

    const output = this.output
    const target = this.target
    this.output = null
    this.canvasSource = null
    this.audioSource = null
    this.target = null

    if (!output || !target) return null

    try {
      await output.finalize()
    } catch {
      await output.cancel().catch(() => undefined)
      return null
    }

    if (!target.buffer) return null
    return new Blob([target.buffer], { type: 'video/webm' })
  }

  elapsedSeconds() {
    if (!this.startedAtMs) return 0
    return Math.max(0, (performance.now() - this.startedAtMs) / 1000)
  }

  private enqueue(op: () => Promise<void>) {
    this.pipe = this.pipe.then(op, op)
  }

  private async addAudioPacket(packet: CaptureAudioPacket) {
    if (!this.audioSource) return

    const timestamp = packet.contextTime - this.epoch
    if (timestamp < -0.05) return

    const frameCount = packet.channels[0]?.length ?? 0
    if (frameCount === 0) return

    const interleaved = new Float32Array(frameCount * packet.channels.length)
    for (let frame = 0; frame < frameCount; frame++) {
      for (let ch = 0; ch < packet.channels.length; ch++) {
        interleaved[frame * packet.channels.length + ch] = packet.channels[ch][frame] ?? 0
      }
    }

    const sample = new AudioSample({
      data: interleaved,
      format: 'f32',
      numberOfChannels: packet.channels.length,
      sampleRate: packet.sampleRate,
      timestamp: Math.max(0, timestamp),
    })

    try {
      await this.audioSource.add(sample)
    } finally {
      sample.close()
    }
  }
}
