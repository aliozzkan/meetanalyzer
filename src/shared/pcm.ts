// [-1, 1] aralığındaki float örnekleri 16-bit işaretli PCM'e çevirir; aralık dışı değerler kırpılır.
export function floatToPcm16(samples: Float32Array): Int16Array {
  const pcm = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    pcm[i] = Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff)
  }
  return pcm
}

// Örneklerin mutlak değerce en büyüğü (0..1); ses seviyesi göstergesi ve sessizlik tespiti için.
export function peakLevel(samples: Float32Array): number {
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    peak = Math.max(peak, Math.abs(samples[i]))
  }
  return peak
}

// 16-bit little-endian PCM baytlarını [-1, 1] aralığında float örneklere çevirir (floatToPcm16'nın tersi).
// Bayt görünümü hizasız olabilir (ArrayBuffer ortasında); bu yüzden DataView kullanılır.
export function pcm16ToFloat(pcm: Uint8Array): Float32Array {
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  const samples = new Float32Array(Math.floor(pcm.byteLength / 2))
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 0x8000
  return samples
}
