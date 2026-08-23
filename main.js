const { app, BrowserWindow } = require('electron')

// 브라우저 창을 생성하는 함수
const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600
  })

  // index.html 로드
  win.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow()
})