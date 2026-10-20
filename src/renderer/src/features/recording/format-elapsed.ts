// Kayıt süresi "mm:ss"; detaydaki kontroller ve sidebar pill'i aynı değeri göstersin diye tek yerde.
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}
