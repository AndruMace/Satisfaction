/**
 * AudioWorklet processor that taps the game master bus for recording.
 * Posts PCM + AudioContext frame clock so video/audio share one timeline.
 */
class SpectatorCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true

    const first = input[0]
    if (!first || first.length === 0) return true

    const channels = []
    const transfers = []
    for (let i = 0; i < input.length; i++) {
      const channel = input[i]
      if (!channel) continue
      const copy = new Float32Array(channel)
      channels.push(copy)
      transfers.push(copy.buffer)
    }

    if (channels.length === 0) return true

    this.port.postMessage(
      {
        type: 'audio',
        channels,
        currentFrame,
        sampleRate,
      },
      transfers,
    )

    return true
  }
}

registerProcessor('spectator-capture-processor', SpectatorCaptureProcessor)
