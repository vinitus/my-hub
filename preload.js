const { contextBridge } = require('electron')

// "versions"라는 이름으로 contextBridge를 통해 renderer.js에서 versions로 접근할 수 있도록 설정
contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
  // we can also expose variables, not just functions
})