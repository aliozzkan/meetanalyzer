import { BrowserWindow, nativeTheme, type TitleBarOverlay } from 'electron'

// Header yüksekliği (renderer: `--header-height`, 44 px). Overlay header'ın alt çizgisini örtmesin diye
// bir piksel kısadır.
const HEADER_HEIGHT = 44

// Header'ın arka plan ve yazı rengi (index.css → --background / --foreground, açık ve koyu tema).
const COLORS = {
  light: { color: '#ffffff', symbolColor: '#0a0a0a' },
  dark: { color: '#0a0a0a', symbolColor: '#fafafa' }
}

// Windows'ta pencere düğmeleri (küçült, büyüt, kapat) header'ın sağına oturur; renkleri temaya uyar.
export function titleBarOverlay(dark: boolean): TitleBarOverlay {
  return { ...COLORS[dark ? 'dark' : 'light'], height: HEADER_HEIGHT - 1 }
}

// Pencere seçenekleri: macOS'ta trafik ışıkları header'ın solundaki boşluğa, Windows'ta pencere düğmeleri
// sağına oturur; Linux'ta native başlık çubuğu kalır.
export function titleBarOptions(
  platform: NodeJS.Platform,
  dark: boolean
): Electron.BrowserWindowConstructorOptions {
  if (platform === 'darwin') {
    return { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 14 } }
  }
  if (platform === 'win32') {
    return { titleBarStyle: 'hidden', titleBarOverlay: titleBarOverlay(dark) }
  }
  return {}
}

// Tema değişince (renderer `nativeTheme.themeSource`'u günceller ya da sistem teması değişir) açık
// pencerelerin düğme renkleri güncellenir.
export function followThemeInTitleBar(): void {
  if (process.platform !== 'win32') return
  nativeTheme.on('updated', () => {
    const overlay = titleBarOverlay(nativeTheme.shouldUseDarkColors)
    for (const window of BrowserWindow.getAllWindows()) window.setTitleBarOverlay(overlay)
  })
}
