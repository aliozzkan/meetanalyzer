export interface SilenceMonitorOptions {
  /** Bu kadar süre kesintisiz sessizlikten sonra uyarılır. */
  silenceMs: number
  /** Tepe seviyesi bunun altındaki parça sessiz sayılır (0..1). */
  peakThreshold: number
}

export interface SilenceMonitor {
  /** Bir ses parçasının tepe seviyesini ve süresini bildirir; uyarının açık olup olmadığını döndürür. */
  feed: (peak: number, durationMs: number) => boolean
}

// Süre, gerçek saat yerine beslenen ses parçalarının süresinden hesaplanır; böylece deterministiktir.
export function createSilenceMonitor({
  silenceMs,
  peakThreshold
}: SilenceMonitorOptions): SilenceMonitor {
  let silentMs = 0
  return {
    feed(peak, durationMs) {
      silentMs = peak < peakThreshold ? silentMs + durationMs : 0
      return silentMs >= silenceMs
    }
  }
}
