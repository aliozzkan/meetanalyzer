import { isAbsolute, relative, resolve, sep } from 'node:path'

// Kayıt dosyası düzeni: <meetingId>/<recordingId>/mic.wav (recording-service.ts)
const FILE_PATH_SEGMENTS = 3

// DB'deki göreli yolu, yalnızca beklenen düzene uyuyorsa ve kayıt klasörünün içinde kalıyorsa kabul eder.
// Silme `dirname(file)` üzerinde çalıştığından düzen sıkı doğrulanır: tek segmentli bir yol aksi halde
// kayıt klasörünün kendisini, iki segmentli bir yol bir Meeting'in tüm kayıtlarını silerdi.
export function resolveRecordingFile(recordingsDir: string, filePath: string): string {
  const file = resolve(recordingsDir, filePath)
  const fromRoot = relative(recordingsDir, file)
  const segments = fromRoot.split(sep)
  if (isAbsolute(fromRoot) || segments.includes('..') || segments.length !== FILE_PATH_SEGMENTS) {
    throw new Error(`Beklenmeyen kayıt yolu: ${filePath}`)
  }
  return file
}
