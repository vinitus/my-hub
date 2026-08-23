const { contextBridge, ipcRenderer } = require('electron')

// "versions"라는 이름으로 contextBridge를 통해 renderer.js에서 versions로 접근할 수 있도록 설정
contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  ping: () => ipcRenderer.invoke('ping') // **모듈 자체를 노출하지 말고, 필요한 함수 형태로 제한해서 제공해야함**
  // we can also expose variables, not just functions
})