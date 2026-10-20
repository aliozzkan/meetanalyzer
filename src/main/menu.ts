import { app, Menu, type MenuItemConstructorOptions } from 'electron'
import type { AppCommand } from '../shared/app'

// Uygulama menüsü: Electron'un varsayılan menüsü, Yeni Meeting (⌘N) ve "Ayarlar…" (⌘,) eklenmiş hâliyle.
// macOS'ta "Ayarlar…" uygulama menüsünde, diğer platformlarda File menüsündedir.
// Menü öğeleri yalnızca komutu renderer'a iletir (bkz. src/main/app/ipc.ts).
export function installAppMenu(sendCommand: (command: AppCommand) => void): void {
  const settingsItem: MenuItemConstructorOptions = {
    label: 'Ayarlar…',
    accelerator: 'CmdOrCtrl+,',
    click: () => sendCommand('open-settings')
  }
  const newMeetingItem: MenuItemConstructorOptions = {
    label: 'Yeni Meeting',
    accelerator: 'CmdOrCtrl+N',
    click: () => sendCommand('new-meeting')
  }

  const template: MenuItemConstructorOptions[] =
    process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              settingsItem,
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          },
          { label: 'File', submenu: [newMeetingItem, { type: 'separator' }, { role: 'close' }] },
          { role: 'editMenu' },
          { role: 'viewMenu' },
          { role: 'windowMenu' }
        ]
      : [
          {
            label: 'File',
            submenu: [newMeetingItem, settingsItem, { type: 'separator' }, { role: 'quit' }]
          },
          { role: 'editMenu' },
          { role: 'viewMenu' },
          { role: 'windowMenu' }
        ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
