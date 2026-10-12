import { useEffect, useState } from 'react'

// Gün sınırı geçince tarih grupları (Bugün/Dün…) kendiliğinden güncellensin diye dakikada bir tazelenen "şimdi".
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}
