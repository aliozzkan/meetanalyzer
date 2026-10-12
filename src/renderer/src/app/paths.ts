// Rota yolları tek yerde; `router.tsx` desenleri, bileşenler bağlantıları buradan üretir.
export const paths = {
  home: '/',
  meetingPattern: '/meetings/:meetingId',
  meeting: (id: string): string => `/meetings/${id}`
} as const
