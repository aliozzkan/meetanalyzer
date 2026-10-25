import type { Platform } from '@renderer/lib/platform'

export interface MicrophonePermissionCopy {
  instructions: string
  /** Sistem ayarlarını açan düğmenin metni; platformda açılacak bir sayfa yoksa null. */
  settingsButton: string | null
}

// "Mikrofon erişimi verilmedi" uyarısının platforma göre metni. Düğmenin açtığı sayfa main'de seçilir
// (src/main/recordings/microphone.ts → microphoneSettingsUrl).
export function microphonePermissionCopy(platform: Platform): MicrophonePermissionCopy {
  switch (platform) {
    case 'mac':
      return {
        instructions:
          "Kayıt alabilmek için Meetanalyzing'e mikrofon izni vermelisin. İzni Sistem Ayarları > Gizlilik ve Güvenlik > Mikrofon bölümünden açabilirsin.",
        settingsButton: "Sistem Ayarları'nı aç"
      }
    case 'windows':
      return {
        instructions:
          'Kayıt alabilmek için mikrofon erişimine izin vermelisin. Ayarlar > Gizlilik ve güvenlik > Mikrofon bölümünde "Mikrofon erişimi" ve "Masaüstü uygulamalarının mikrofonunuza erişmesine izin verin" açık olmalı.',
        settingsButton: "Ayarlar'ı aç"
      }
    case 'other':
      return {
        instructions:
          'Kayıt alabilmek için mikrofon erişimine izin vermelisin. İzni işletim sisteminin gizlilik ayarlarından açabilirsin.',
        settingsButton: null
      }
  }
}
