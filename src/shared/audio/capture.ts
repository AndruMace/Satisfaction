import { createNoiseBuffer, type AudioKit } from './kit'

export type CaptureAudioPacket = {
  channels: Float32Array[]
  sampleRate: number
  /** Seconds on the AudioContext clock (currentFrame / sampleRate). */
  contextTime: number
}

/**
 * Shared AudioContext + master bus + capture tap for WebCodecs recording.
 * Game engines subclass or compose this and play SFX into `master`.
 */
export class CaptureAudioEngine {
  protected ctx: AudioContext | null = null
  protected master: GainNode | null = null
  protected noiseBuffer: AudioBuffer | null = null
  private workletReady: Promise<void> | null = null
  private captureNode: AudioWorkletNode | null = null
  private captureSink: GainNode | null = null
  private captureHandler: ((packet: CaptureAudioPacket) => void) | null = null

  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 1
      this.master.connect(this.ctx.destination)
      this.noiseBuffer = createNoiseBuffer(this.ctx, 1)
      this.workletReady = this.ctx.audioWorklet.addModule(
        new URL('./capture-processor.js', import.meta.url),
      )
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
  }

  /** AudioContext clock in seconds; used as the shared A/V recording timeline. */
  getContextTime(): number {
    return this.ctx?.currentTime ?? 0
  }

  getSampleRate(): number {
    return this.ctx?.sampleRate ?? 48000
  }

  protected getKit(): AudioKit | null {
    if (!this.ctx || !this.master || !this.noiseBuffer) return null
    return { ctx: this.ctx, master: this.master, noiseBuffer: this.noiseBuffer }
  }

  async startCapture(onPacket: (packet: CaptureAudioPacket) => void) {
    this.unlock()
    if (!this.ctx || !this.master) return
    await this.workletReady
    this.stopCapture()

    this.captureHandler = onPacket
    this.captureNode = new AudioWorkletNode(this.ctx, 'spectator-capture-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: 'explicit',
      outputChannelCount: [1],
    })
    this.captureNode.port.onmessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string
        channels?: Float32Array[]
        currentFrame?: number
        sampleRate?: number
      }
      if (data.type !== 'audio' || !data.channels?.length || !this.captureHandler) return
      const sampleRate = data.sampleRate ?? this.getSampleRate()
      const currentFrame = data.currentFrame ?? 0
      this.captureHandler({
        channels: data.channels,
        sampleRate,
        contextTime: currentFrame / sampleRate,
      })
    }

    this.captureSink = this.ctx.createGain()
    this.captureSink.gain.value = 0
    this.master.connect(this.captureNode)
    this.captureNode.connect(this.captureSink)
    this.captureSink.connect(this.ctx.destination)
  }

  stopCapture() {
    if (this.captureNode && this.master) {
      try {
        this.master.disconnect(this.captureNode)
      } catch {
        // already disconnected
      }
    }
    this.captureNode?.port.close()
    this.captureNode?.disconnect()
    this.captureSink?.disconnect()
    this.captureNode = null
    this.captureSink = null
    this.captureHandler = null
  }
}
