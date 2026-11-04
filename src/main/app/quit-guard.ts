// Kapatmanın kaybettireceği işler: sürmekte olan Recording (renderer'daki mikrofon yakalama biter, kaydedilen
// kısım korunur) ve bekleyen Transcription (çalışan whisper öldürülür, Meeting açılışta Closed'a döner).
export interface QuitState {
  recording: boolean
  transcribing: boolean
}

// Kapatmak bir şey kaybettirmiyorsa null, kaybettiriyorsa onay penceresinde gösterilecek açıklama.
export function quitWarning({ recording, transcribing }: QuitState): string | null {
  if (recording && transcribing) return 'Kapatırsan kayıt durur ve transcription iptal olur.'
  if (recording) return 'Kapatırsan kayıt durur. Kaydedilen kısım korunur.'
  if (transcribing) {
    return "Kapatırsan transcription iptal olur. Meeting'i daha sonra yeniden transcribe edebilirsin."
  }
  return null
}

export interface QuitGuard {
  /**
   * Kapatmaya izin verilip verilmediği; gerekiyorsa kullanıcıya sorar. `forQuit`: bu kapatma uygulamadan
   * çıkışın parçası. Çıkış bir kez onaylanınca aynı çıkışta (ör. pencere kapanınca gelen before-quit) bir daha
   * sorulmaz; macOS'ta yalnızca pencere kapanırken verilen onay sonraki bir çıkışa sayılmaz.
   */
  allow: (state: QuitState, forQuit: boolean) => boolean
}

export function createQuitGuard(confirm: (warning: string) => boolean): QuitGuard {
  let quitConfirmed = false

  function allow(state: QuitState, forQuit: boolean): boolean {
    if (forQuit && quitConfirmed) return true
    const warning = quitWarning(state)
    if (warning !== null && !confirm(warning)) return false
    if (forQuit) quitConfirmed = true
    return true
  }

  return { allow }
}
