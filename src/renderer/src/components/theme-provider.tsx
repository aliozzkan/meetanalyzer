import { useEffect } from 'react'

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => {
      document.documentElement.classList.toggle('dark', media.matches)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  return <>{children}</>
}
