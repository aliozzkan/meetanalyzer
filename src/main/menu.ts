import { app, Menu, type MenuItemConstructorOptions } from 'electron'

interface MenuActions {
  openSettings: () => void
}

// Uygulama menüsü: Electron'un varsayılan menüsü, macOS'ta uygulama menüsüne "Ayarlar…" eklenmiş hâliyle.
// Diğer platformlarda "Ayarlar…" File menüsündedir. Kısayollar (⌘,) buradan gelir.
export function installAppMenu({ openSettings }: MenuActions): void {
  const settingsItem: MenuItemConstructorOptions = {
    label: 'Ayarlar…',
    accelerator: 'CmdOrCtrl+,',
    click: openSettings
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
          { role: 'fileMenu' },
          { role: 'editMenu' },
          { role: 'viewMenu' },
          { role: 'windowMenu' }
        ]
      : [
          { label: 'File', submenu: [settingsItem, { type: 'separator' }, { role: 'quit' }] },
          { role: 'editMenu' },
          { role: 'viewMenu' },
          { role: 'windowMenu' }
        ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
