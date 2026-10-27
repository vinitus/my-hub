const { app, BrowserWindow } = require("electron")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "my-hub-storybook-"))
app.setPath("userData", profile)
const base = process.env.STORYBOOK_TEST_URL
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1100,
    height: 800,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      offscreen: true,
    },
  })
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
  win.webContents.session.webRequest.onBeforeRequest((details, callback) =>
    callback({
      cancel:
        !details.url.startsWith(base) &&
        !details.url.startsWith("data:") &&
        !details.url.startsWith("devtools:"),
    })
  )
  const errors = []
  win.webContents.on("console-message", (event) => {
    if (event.level === "error") errors.push(event.message)
  })
  try {
    const index = await (await fetch(`${base}/index.json`)).json()
    const entries = Object.values(index.entries).filter(
      (entry) => entry.type === "story"
    )
    let count = 0
    for (const [theme, width] of [
      ["light", 1100],
      ["dark", 1100],
      ["dark", 360],
    ]) {
      win.setSize(width, 800)
      for (const story of entries) {
        errors.length = 0
        await win.loadURL(
          `${base}/iframe.html?id=${story.id}&viewMode=story&globals=theme:${theme}`
        )
        let result
        for (let attempt = 0; attempt < 100; attempt++) {
          result = await win.webContents.executeJavaScript(
            `({ ready: document.body.classList.contains('sb-show-main') && (!!document.getElementById('storybook-root')?.childElementCount || !!document.querySelector('[role=dialog]')), failed: document.body.classList.contains('sb-show-errordisplay'), text: document.body.innerText, native: typeof window.api !== 'undefined' })`
          )
          if (result.ready || result.failed) break
          await delay(50)
        }
        assert.equal(result.failed, false, `${story.id}: ${result.text}`)
        assert.equal(
          result.ready,
          true,
          `${story.id}: did not render ${JSON.stringify(result)} ${JSON.stringify(errors)}`
        )
        assert.equal(result.native, false, `${story.id}: native bridge exposed`)
        await delay(50)
        assert.deepEqual(errors, [], `${story.id}: browser errors`)
        if (
          theme === "light" &&
          story.importPath.endsWith("event-sheet.stories.tsx") &&
          story.name === "Existing"
        ) {
          await win.webContents.executeJavaScript(
            `window.__link = document.querySelector('[aria-label="참고 링크 2"]'); window.__link.focus()`
          )
          win.webContents.insertText("x")
          await delay(100)
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.activeElement === window.__link && document.querySelector('[aria-label="참고 링크 2"]') === window.__link`
            ),
            true,
            "link typing must preserve focus and node identity"
          )
          console.log("PASS editable link retains focus and identity")
        }
        if (
          theme === "light" &&
          story.importPath.endsWith("weather-location-sheet.stories.tsx") &&
          story.name === "No Results"
        ) {
          await win.webContents.executeJavaScript(
            `document.querySelector('input').focus()`
          )
          win.webContents.insertText("서울")
          await delay(50)
          await win.webContents.executeJavaScript(
            `document.querySelector('button[type=submit]').click()`
          )
          await delay(100)
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.body.innerText.includes('검색 결과가 없습니다')`
            ),
            true
          )
          console.log("PASS empty location search")
        }
        if (
          theme === "light" &&
          story.importPath.endsWith("note-title.stories.tsx") &&
          story.name === "Default"
        ) {
          await win.webContents.executeJavaScript(
            `document.querySelector('#storybook-root button').dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}))`
          )
          await delay(50)
          win.webContents.insertText("수정된 회의록")
          await delay(50)
          await win.webContents.executeJavaScript(
            `document.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}))`
          )
          await delay(100)
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.querySelector('#storybook-root button').textContent.includes('수정된 회의록')`
            ),
            true
          )
          console.log("PASS keyboard rename")
        }
        if (
          width === 360 &&
          story.importPath.endsWith("weather-widget.stories.tsx") &&
          story.name === "Clear"
        ) {
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.documentElement.scrollWidth <= innerWidth`
            ),
            true,
            "weather overflows narrow viewport"
          )
        }
        if (
          story.importPath.endsWith("weather-widget.stories.tsx") &&
          story.name === "Clear"
        ) {
          await delay(350)
          const output = path.resolve("out/tests/storybook")
          fs.mkdirSync(output, { recursive: true })
          fs.writeFileSync(
            path.join(output, `weather-${theme}-${width}.png`),
            (
              await win.capturePage(undefined, {
                stayHidden: true,
                stayAwake: true,
              })
            ).toPNG()
          )
        }
        assert.equal(
          await win.webContents.executeJavaScript(
            `Array.from(document.querySelectorAll('label[for]')).every(label => !!label.control)`
          ),
          true,
          `${story.id}: label is not connected to a control`
        )
        if (
          theme === "light" &&
          story.importPath.endsWith("settings-sheet.stories.tsx") &&
          story.name === "Ready"
        ) {
          await win.webContents.executeJavaScript(
            `window.__themeWrites = 0; window.__originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key.startsWith('storybook:theme:')) window.__themeWrites++; return window.__originalSetItem.call(this, key, value) }; window.dispatchEvent(new KeyboardEvent('keydown', {key:'d', bubbles:true}))`
          )
          await delay(100)
          assert.equal(
            await win.webContents.executeJavaScript(`window.__themeWrites`),
            1,
            "theme shortcut must persist once in StrictMode"
          )
          await win.webContents.executeJavaScript(
            `Storage.prototype.setItem = window.__originalSetItem; void 0`
          )
          console.log("PASS theme shortcut writes once in StrictMode")
        }
        count++
      }
      console.log(
        `PASS ${theme} ${width}px: ${entries.length} stories rendered without Electron bridge`
      )
    }
    console.log(`PASS ${count} story renders`)
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
