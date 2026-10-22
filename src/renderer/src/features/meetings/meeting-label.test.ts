import { describe, expect, it } from 'vitest'
import { meetingLabel } from './meeting-label'

// Yerel saatle kurulur; test çalıştığı makinenin saat diliminden bağımsızdır.
const createdAt = new Date(2026, 9, 12, 14, 30).getTime()

describe('meetingLabel', () => {
  it("Title varsa Meeting'i Title'ıyla adlandırır", () => {
    expect(meetingLabel({ title: 'Haftalık plan', createdAt })).toBe('Haftalık plan')
  })

  it("Title yoksa Meeting'i başladığı saatle adlandırır", () => {
    expect(meetingLabel({ title: null, createdAt })).toBe("14:30 Meeting'i")
  })
})
