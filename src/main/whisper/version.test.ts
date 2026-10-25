import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { WHISPER_CPP_VERSION } from '../config'

// Hakkında ekranındaki sürüm, binary'yi derleyen script'teki tag'den kopyadır; biri değişip diğeri unutulmasın.
describe('whisper.cpp sürümü', () => {
  it('build-whisper.mjs içindeki WHISPER_CPP_TAG ile aynıdır', () => {
    const script = readFileSync(
      fileURLToPath(new URL('../../../scripts/build-whisper.mjs', import.meta.url)),
      'utf8'
    )

    const tag = /^const WHISPER_CPP_TAG = '([^']+)'$/m.exec(script)?.[1]

    expect(tag).toBeDefined()
    expect(WHISPER_CPP_VERSION).toBe(tag)
  })
})
