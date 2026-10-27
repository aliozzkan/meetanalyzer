const $ = (id) => document.getElementById(id)
const logEl = $('log')
const t0 = performance.now()
function log(...args) {
  const ts = ((performance.now() - t0) / 1000).toFixed(1).padStart(7)
  const line = `[${ts}s] ${args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`
  logEl.textContent += line + '\n'
  logEl.scrollTop = logEl.scrollHeight
  console.log(line)
}

let stream, ctx, node, tone
let chunks = []
let peak = 0
let sumSq = 0
let count = 0
let secSumSq = 0
let secCount = 0
let secTimer

window.proto.info().then((i) => {
  $('info').textContent = JSON.stringify(i)
  log('bilgi', i)
})

navigator.mediaDevices.addEventListener('devicechange', async () => {
  const devs = await navigator.mediaDevices.enumerateDevices()
  log(
    'devicechange',
    devs.filter((d) => d.kind === 'audiooutput' || d.kind === 'audioinput').map((d) => `${d.kind}:${d.label}`)
  )
})

$('start').onclick = async () => {
  if (stream) return log('zaten çalışıyor')
  await window.proto.setMode($('mute').checked ? 'loopbackWithMute' : 'loopback')
  const audio = $('restrict').checked ? { restrictOwnAudio: true } : true
  log('supportedConstraints.restrictOwnAudio =', navigator.mediaDevices.getSupportedConstraints().restrictOwnAudio)
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ audio, video: $('video').checked })
  } catch (error) {
    stream = undefined
    return log('getDisplayMedia HATA', error.name, error.message)
  }
  const audioTracks = stream.getAudioTracks()
  const videoTracks = stream.getVideoTracks()
  log('akış açıldı: audioTracks =', audioTracks.length, 'videoTracks =', videoTracks.length)
  videoTracks.forEach((v) => {
    log('video track hemen durduruluyor', v.getSettings())
    v.stop()
    stream.removeTrack(v)
  })
  if (!audioTracks.length) {
    log('SES TRACK YOK')
    stream = undefined
    return
  }
  const track = audioTracks[0]
  log('ses track', { label: track.label, readyState: track.readyState, muted: track.muted, settings: track.getSettings() })
  for (const ev of ['ended', 'mute', 'unmute']) {
    track.addEventListener(ev, () => log(`>>> track.${ev}`, { readyState: track.readyState, muted: track.muted }))
  }
  // İzin yoksa spec'e göre akış hata vermez ama track 'ended' gelir: kısa süre sonra durumu yaz.
  setTimeout(() => log('1 sn sonra track.readyState =', track.readyState), 1000)

  ctx = new AudioContext({ sampleRate: 16000 })
  log('AudioContext sampleRate =', ctx.sampleRate)
  const src = ctx.createMediaStreamSource(new MediaStream([track]))
  node = ctx.createScriptProcessor(4096, 2, 1)
  node.onaudioprocess = (e) => {
    const l = e.inputBuffer.getChannelData(0)
    const r = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : l
    const out = new Float32Array(l.length)
    for (let i = 0; i < l.length; i++) {
      const s = (l[i] + r[i]) / 2
      out[i] = s
      const a = Math.abs(s)
      if (a > peak) peak = a
      sumSq += s * s
      secSumSq += s * s
      count++
      secCount++
    }
    chunks.push(out)
    $('bar').style.width = Math.min(100, Math.sqrt(sumSq / Math.max(count, 1)) * 400) + '%'
  }
  src.connect(node)
  node.connect(ctx.destination) // ScriptProcessor çalışsın diye; çıkış sessiz (output buffer 0)
  secTimer = setInterval(() => {
    const rms = Math.sqrt(secSumSq / Math.max(secCount, 1))
    $('stats').textContent = ` peak=${peak.toFixed(4)} saniye-rms=${rms.toFixed(5)} örnek=${count}`
    log(`rms/sn = ${rms.toFixed(5)}`)
    secSumSq = 0
    secCount = 0
  }, 1000)
}

$('stop').onclick = async () => {
  if (!stream) return log('çalışmıyor')
  clearInterval(secTimer)
  node.disconnect()
  stream.getTracks().forEach((t) => t.stop())
  await ctx.close()
  stream = undefined
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const pcm = new Int16Array(total)
  let o = 0
  for (const c of chunks) {
    for (let i = 0; i < c.length; i++) pcm[o++] = Math.max(-1, Math.min(1, c[i])) * 0x7fff
  }
  chunks = []
  const header = new ArrayBuffer(44)
  const v = new DataView(header)
  const w = (off, s) => [...s].forEach((ch, i) => v.setUint8(off + i, ch.charCodeAt(0)))
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.byteLength, true); w(8, 'WAVE'); w(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  w(36, 'data'); v.setUint32(40, pcm.byteLength, true)
  const bytes = new Uint8Array(44 + pcm.byteLength)
  bytes.set(new Uint8Array(header), 0)
  bytes.set(new Uint8Array(pcm.buffer), 44)
  const file = await window.proto.saveWav('system.wav', bytes)
  log(`YAZILDI ${file}: ${(total / 16000).toFixed(1)} sn, peak=${peak.toFixed(4)}`)
  peak = 0; sumSq = 0; count = 0
}

$('tone').onclick = () => {
  if (tone) return
  const c = new AudioContext()
  const osc = c.createOscillator()
  const g = c.createGain()
  g.gain.value = 0.1
  osc.frequency.value = 440
  osc.connect(g).connect(c.destination)
  osc.start()
  tone = { c, osc }
  log('test tonu çalıyor (uygulamanın kendi sesi)')
}
$('toneStop').onclick = () => {
  if (!tone) return
  tone.osc.stop()
  tone.c.close()
  tone = undefined
  log('test tonu durdu')
}
