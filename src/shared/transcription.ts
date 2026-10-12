// Main, preload ve renderer'ın ortak kullandığı Transcription Queue durumu.

export interface TranscriptionStatus {
  /** İşlenen Meeting; kuyruk boşsa null. `percent` ilk ilerleme olayı gelene kadar null'dır
   * (ör. Metal'in ilk çalıştırma derlemesi sırasında hiç ilerleme gelmez). */
  active: { meetingId: string; percent: number | null } | null
  /** "Sırada" bekleyen Meeting'ler, işlenme sırasıyla. */
  queued: string[]
}

/** Meeting şu an işleniyor mu? Sırada bekleyen ya da durum olayı henüz gelmemiş Meeting işleniyor sayılmaz. */
export function isProcessing(status: TranscriptionStatus, meetingId: string): boolean {
  return status.active?.meetingId === meetingId && !status.queued.includes(meetingId)
}

/** Kuyruğun kimlik anahtarı: yalnızca yüzde değişince aynı kalır. Gönderici (seyreltme) ve alıcı (liste yenileme) kullanır. */
export function statusShape(status: TranscriptionStatus): string {
  return JSON.stringify([status.active?.meetingId ?? null, status.queued])
}
