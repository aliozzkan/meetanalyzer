import { toast } from 'sonner'
import { pcm16ToFloat } from '@shared/pcm'
import type { WordAudio } from '@shared/transcript'

let context: AudioContext | undefined
let current: AudioBufferSourceNode | undefined

// Her çalma isteği bir numara alır; durdurma numarayı ilerletir. Bekleyen (IPC ya da AudioContext) bir istek,
// beklemeden döndüğünde numarası eskimişse çalmaz: popover hızlı kapansa ya da "Tekrar çal"a üst üste
// basılsa da aynı anda en fazla bir ses çalar.
let playId = 0

// Çalan sesi ve bekleyen çalma isteklerini durdurur (popover kapanınca, Kaydet/Geri al'da, ekrandan çıkarken).
export function stopWordAudio(): void {
  playId += 1
  try {
    current?.stop()
  } catch {
    // zaten bitmiş olabilir
  }
  current = undefined
}

// Suspect Word'ün çevresindeki sesi çalar. Ham dosya yolu yoktur: main yalnızca kelime kimliğiyle
// ilgili PCM dilimini verir; WAV/Blob URL gerekmediği için CSP'ye dokunulmaz. Hatalar kullanıcıya bildirilir.
export async function playWordAudio(wordId: string): Promise<void> {
  stopWordAudio()
  const mine = playId
  try {
    const result = await window.api.transcript.wordAudio(wordId)
    if (mine !== playId) return
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    const audio: WordAudio = result.value
    const samples = pcm16ToFloat(audio.pcm)
    if (samples.length === 0) {
      toast.info('Bu kelimenin sesi kayıtta yok.')
      return
    }

    context ??= new AudioContext()
    if (context.state === 'suspended') await context.resume()
    if (mine !== playId) return
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
  } catch (error) {
    console.error('Ses çalınamadı:', error)
    if (mine === playId) toast.error('Ses çalınamadı.')
  }
}
