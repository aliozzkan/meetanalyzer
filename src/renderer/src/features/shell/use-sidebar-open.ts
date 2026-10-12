import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'sidebar-open'
// Pencere bu genişliğin altına inince sidebar kendiliğinden ikon moduna daralır.
const NARROW_QUERY = '(max-width: 899px)'

// Açık/kapalı tercihi yalnızca arayüz tercihidir; saklanamazsa açık başlar, zararı yok.
function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

function store(open: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, open ? '1' : '0')
  } catch {
    // saklanamazsa yalnızca bu oturum için geçerli
  }
}

// Kullanıcının tercihi (⌘B ya da düğme) kalıcıdır. Dar pencerede sidebar kendiliğinden daralır (bu kalıcı
// değildir); kullanıcı dar pencerede açarsa pencere değişene kadar açık kalır, genişleyince son tercih döner.
export function useSidebarOpen(): [boolean, (open: boolean) => void] {
  const [preferred, setPreferred] = useState(readStored)
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches)
  const [manualWhileNarrow, setManualWhileNarrow] = useState<boolean | null>(null)

  useEffect(() => {
    const media = window.matchMedia(NARROW_QUERY)
    const onChange = (): void => {
      setNarrow(media.matches)
      setManualWhileNarrow(null)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const setOpen = useCallback(
    (open: boolean): void => {
      // Elle yapılan seçim her genişlikte kalıcıdır; dar pencerede ek olarak o oturum için etkilidir.
      setPreferred(open)
      store(open)
      if (narrow) setManualWhileNarrow(open)
    },
    [narrow]
  )

  const open = narrow ? (manualWhileNarrow ?? false) : preferred
  return [open, setOpen]
}
