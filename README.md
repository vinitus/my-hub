## Main Process
- 창 생성, 앱 생명주기를 조절
- 이 프로세스는 `HTML DOM`에 접근할 수 없음

## Renderer Process
- 실제 화면
- 이 프로세스는 `Node.js` API에 접근할 수 없음

## Preload
- Main과 Renderer 사이 Bridge

## ipcRenderer ping-pong 예제

```
renderer.js
   │
   │ window.versions.ping()
   ▼
preload.js
   │
   │ ipcRenderer.invoke('ping')
   ▼
main.js
   │
   │ ipcMain.handle('ping', ...)
   ▼
'pong' 반환
   │
   ▼
renderer.js에서 응답 받음
```