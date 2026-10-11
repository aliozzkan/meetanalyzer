import Versions from './components/Versions'
import { Button } from './components/ui/button'

function App(): React.JSX.Element {
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Meetanalyzing</h1>
      <div className="flex gap-2">
        <Button onClick={ipcHandle}>Send IPC</Button>
        <Button
          variant="neutral"
          render={<a href="https://electron-vite.org/" target="_blank" rel="noreferrer" />}
        >
          Documentation
        </Button>
      </div>
      <Versions />
    </div>
  )
}

export default App
