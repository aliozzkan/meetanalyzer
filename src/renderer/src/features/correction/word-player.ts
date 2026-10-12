import { toast } from 'sonner'
import { pcm16ToFloat } from '@shared/pcm'
import type { WordAudio } from '@shared/transcript'

let context: AudioContext | undefined
let current: AudioBufferSourceNode | undefined

// Çalan ses varsa durdurur (aynı anda tek kelime çalınır; popover kapanınca da çağrılır).
export function stopWordAudio(): void {
  try {
    current?.stop()
  } catch {
    // zaten bitmiş olabilir
  }
  current = undefined
}

// Suspect Word'ün çevresindeki sesi çalar. Ham dosya yolu yoktur: main yalnızca kelime kimliğiyle
// ilgili PCM dilimini verir; WAV/Blob URL gerekmediği için CSP'ye dokunulmaz.
export async function playWordAudio(wordId: string): Promise<void> {
  stopWordAudio()
  const result = await window.api.transcript.wordAudio(wordId)
  if (!result.ok) {
    toast.error(result.message)
    return
  }
  const audio: WordAudio = result.value
  const samples = pcm16ToFloat(audio.pcm)
  if (samples.length === 0) return

  context ??= new AudioContext()
  if (context.state === 'suspended') await context.resume()
  const buffer = context.createBuffer(1, samples.length, audio.sampleRate)
  buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0)
  const source = context.createBufferSource()
  source.buffer = buffer
  source.connect(context.destination)
  source.onended = () => {
    if (current === source) current = undefined
  }
  current = source
  source.start()
}
