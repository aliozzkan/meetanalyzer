import { createHashRouter, Navigate } from 'react-router'
import { AppLayout } from './app-layout'
import { HomePage } from './pages/home-page'
import { MeetingPage } from './pages/meeting-page'
import { paths } from './paths'

// Hash router: dosyadan yüklenen Electron renderer'ında sunucu rotası olmadığı için `#/...` kullanılır.
// Ayarlar (issue 02) rota değil, state olacak.
export const router = createHashRouter([
  {
    path: paths.home,
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: paths.meetingPattern, element: <MeetingPage /> },
      { path: '*', element: <Navigate to={paths.home} replace /> }
    ]
  }
])
