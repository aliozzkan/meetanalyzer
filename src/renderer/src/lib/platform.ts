// macOS'ta pencere `hiddenInset` başlık çubuğuyla açılır; trafik ışıkları için yer ve sürükleme alanı gerekir.
export const IS_MAC = navigator.userAgent.includes('Macintosh')
export const IS_WINDOWS = navigator.userAgent.includes('Windows')

export type Platform = 'mac' | 'windows' | 'other'
export const PLATFORM: Platform = IS_MAC ? 'mac' : IS_WINDOWS ? 'windows' : 'other'
