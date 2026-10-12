// Main, preload ve renderer'ın ortak kullandığı Transcription Queue durumu.

export interface TranscriptionStatus {
  /** İşlenen Meeting; kuyruk boşsa null. `percent` ilk ilerleme olayı gelene kadar null'dır
   * (ör. Metal'in ilk çalıştırma derlemesi sırasında hiç ilerleme gelmez). */
  active: { meetingId: string; percent: number | null } | null
  /** "Sırada" bekleyen Meeting'ler, işlenme sırasıyla. */
  queued: string[]
}
