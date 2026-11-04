// Kaynak açılışı (izin, cihaz) bu süre içinde tamamlanmazsa vazgeçilir; arayüz sonsuza dek beklemez.
// docs/tuning.md → Ses kaynağı açma zaman aşımı
export const OPEN_TIMEOUT_MS = 15_000

export async function openWithTimeout(
  opening: Promise<MediaStream>,
  description: string
): Promise<MediaStream> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${description} zamanında açılamadı`)),
      OPEN_TIMEOUT_MS
    )
  })
  try {
    return await Promise.race([opening, timeout])
  } catch (error) {
    // Zaman aşımından sonra gelen akış açık kalmasın.
    void opening.then((late) => late.getTracks().forEach((track) => track.stop())).catch(() => {})
    throw error
  } finally {
    clearTimeout(timer)
  }
}
