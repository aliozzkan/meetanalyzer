// Main, preload ve renderer'ın ortak kullandığı uygulama geneli tipler.

export interface AppInfo {
  appVersion: string
  whisperVersion: string
}

/** Uygulama menüsünden renderer'a gönderilen komutlar ("Ayarlar…" ⌘,, File > "Yeni Meeting" ⌘N). */
export type AppCommand = 'open-settings' | 'new-meeting'
