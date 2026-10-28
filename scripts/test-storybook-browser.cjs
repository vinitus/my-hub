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
    assert.ok(entries.length > 0, "Story index must not be empty")
    assert.equal(
      new Set(entries.map((entry) => entry.id)).size,
      entries.length,
      "Story IDs must be unique"
    )
    const scheduleSummaries = {
      "next-in-24-minutes": "24분 후",
      "next-in-5-minutes": "5분 후",
      "starting-soon": "곧 시작",
      "ongoing-and-next": "1시간 20분 후",
      "ongoing-no-more-today": "오늘 남은 일정 없음",
      "next-tomorrow": "내일 09:00",
      "no-scheduled-events": "예정된 일정 없음",
      dark: "24분 후",
      "narrow-with-long-title": "1시간 20분 후",
      "just-outside-urgent": "6분 후",
      "just-outside-starting-soon": "2분 후",
      "exactly-one-minute": "곧 시작",
      "all-day-tomorrow": "내일 09:00",
      "next-week-narrow": "11월 4일 14:00",
      "dark-urgent-narrow": "5분 후",
    }
    for (const key of Object.keys(scheduleSummaries)) {
      assert.ok(
        entries.some(
          (entry) =>
            entry.importPath.endsWith("schedule-status-card.stories.tsx") &&
            entry.id.endsWith(`--${key}`)
        ),
        `Missing schedule fixture: ${key}`
      )
    }
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
        assert.equal(
          await win.webContents.executeJavaScript(
            `document.documentElement.classList.contains('dark')`
          ),
          theme === "dark",
          `${story.id}: toolbar theme was not applied`
        )
        if (
          story.importPath.endsWith("/status-panel.stories.tsx") &&
          story.name === "Populated"
        ) {
          const panel = await win.webContents.executeJavaScript(`(() => {
            const today = document.querySelector('[aria-label="오늘의 일정"]').innerText;
            const executions = document.querySelector('[aria-label="예정된 실행"]').innerText;
            return { today, executions, width: document.querySelector('aside').getBoundingClientRect().width, overflow: document.documentElement.scrollWidth > innerWidth };
          })()`)
          assert.ok(panel.today.includes("기획 회의"))
          assert.ok(!panel.today.includes("진행 중이라 숨겨지는 일정"))
          assert.ok(!panel.today.includes("내일 일정"))
          assert.ok(panel.executions.includes("시작 시 자동 실행"))
          assert.ok(panel.executions.includes("알림 클릭 시 실행"))
          assert.ok(panel.executions.includes("회의자료.pdf"))
          assert.ok(!panel.executions.includes("자동 실행 안 함"))
          assert.equal(panel.width, 280)
          assert.equal(panel.overflow, false)
          await win.webContents.executeJavaScript(
            `Array.from(document.querySelectorAll('[aria-label="최근 사용한 바로가기"] button')).find(b => b.textContent.includes('프로젝트 문서')).click()`
          )
          await delay(30)
          assert.ok(
            await win.webContents.executeJavaScript(
              `document.body.innerText.includes('프로젝트 문서 실행 요청')`
            )
          )
          await win.webContents.executeJavaScript(
            `document.querySelector('[aria-label="현황 패널 접기"]').click()`
          )
          await delay(30)
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.querySelector('aside').getBoundingClientRect().width`
            ),
            40
          )
          await win.webContents.executeJavaScript(
            `document.querySelector('[aria-label="현황 패널 펼치기"]').click()`
          )
          await delay(30)
          assert.ok(
            await win.webContents.executeJavaScript(
              `document.querySelector('[aria-label="현황 패널 접기"]').getAttribute('aria-expanded') === 'true'`
            )
          )
        }
        if (story.importPath.endsWith("schedule-status-card.stories.tsx")) {
          const card = await win.webContents.executeJavaScript(
            `(() => { const node = document.querySelector('[aria-label="일정 현황"]'); return { text: node.innerText, height: node.getBoundingClientRect().height, overflow: node.scrollWidth > node.clientWidth } })()`
          )
          assert.ok(
            card.text.includes(scheduleSummaries[story.id.split("--")[1]]),
            `${story.id}: unexpected schedule summary ${card.text}`
          )
          assert.equal(card.height, 70, `${story.id}: card height changed`)
          assert.equal(card.overflow, false, `${story.id}: card overflows`)
        }
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
        if (story.importPath.endsWith("todo-workspace.stories.tsx")) {
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.documentElement.scrollWidth <= innerWidth`
            ),
            true,
            `${story.id}: TODO overflows viewport`
          )
          if (theme === "light" && story.name === "Empty") {
            await win.webContents.executeJavaScript(`(() => {
              const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
              for (const [selector, value] of [['input[type=text]', 'UI TODO'], ['input[type=date]', '2026-11-02']]) {
                const input = document.querySelector(selector);
                set.call(input, value);
                input.dispatchEvent(new Event('input', { bubbles: true }));
              }
            })()`)
            await delay(50)
            await win.webContents.executeJavaScript(
              `document.querySelector('button[type=submit]').click()`
            )
            await delay(50)
            assert.equal(
              await win.webContents.executeJavaScript(
                `document.querySelectorAll('#storybook-root li').length`
              ),
              1
            )
            await win.webContents.executeJavaScript(
              `document.querySelector('#storybook-root li input[type=checkbox]').click()`
            )
            await delay(50)
            assert.equal(
              await win.webContents.executeJavaScript(
                `document.querySelector('#storybook-root li input').checked`
              ),
              true
            )
            await win.webContents.executeJavaScript(
              `document.querySelector('#storybook-root li button[aria-label$="수정"]').click()`
            )
            await delay(50)
            assert.equal(
              await win.webContents.executeJavaScript(
                `document.querySelector('input[type=text]').value`
              ),
              "UI TODO"
            )
            await win.webContents.executeJavaScript(
              `document.querySelector('button[type=submit]').click()`
            )
            await delay(50)
            await win.webContents.executeJavaScript(
              `document.querySelector('#storybook-root li button[aria-label$="삭제"]').click()`
            )
            await delay(50)
            assert.equal(
              await win.webContents.executeJavaScript(
                `document.querySelectorAll('#storybook-root li').length`
              ),
              0
            )
            console.log("PASS TODO create, complete, edit and delete")
          }
        }
        if (
          theme === "light" &&
          story.importPath.endsWith("quick-command.stories.tsx")
        ) {
          await win.webContents.executeJavaScript(
            `document.querySelector('[aria-label="AI에게 요청할 내용"]').focus()`
          )
          win.webContents.insertText("내일 오후 3시에 팀 회의 추가해줘")
          await delay(50)
          await win.webContents.executeJavaScript(
            `document.querySelector('[aria-label="요청 전송"]').click()`
          )
          await delay(100)
          const expected = {
            Open: "완료",
            "Needs Connection": "AI 연결 필요",
            Clarification: "추가 설명 필요",
            Failure: "처리 실패",
            Partial: "일부 저장됨",
            Preview: "변경 확인",
            Discard: "변경 확인",
            Undo: "완료",
            "Apply Conflict": "변경 확인",
            "Partial Undo": "일부 저장됨",
          }
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.querySelector('[aria-label="AI 작업 상태"] [role=status]').innerText.includes(${JSON.stringify(expected[story.name])})`
            ),
            true,
            `${story.id}: command result status`
          )
          if (["Preview", "Discard", "Apply Conflict"].includes(story.name)) {
            assert.equal(
              await win.webContents.executeJavaScript(
                `document.querySelector('[aria-label="변경 미리보기"]').children.length`
              ),
              2
            )
            const button = story.name === "Discard" ? "변경 취소" : "변경 적용"
            await win.webContents.executeJavaScript(
              `Array.from(document.querySelectorAll('aside button')).find(b => b.textContent === ${JSON.stringify(button)}).click()`
            )
            await delay(100)
            const message =
              story.name === "Discard"
                ? "변경하지 않고 취소"
                : story.name === "Apply Conflict"
                  ? "목록이 변경"
                  : "2건 저장 완료"
            assert.ok(
              await win.webContents.executeJavaScript(
                `document.querySelector('aside').innerText.includes(${JSON.stringify(message)})`
              )
            )
            assert.equal(
              await win.webContents.executeJavaScript(
                `document.querySelector('[aria-label="변경 미리보기"]') === null`
              ),
              true
            )
          }
          if (["Preview", "Undo", "Partial Undo"].includes(story.name)) {
            await win.webContents.executeJavaScript(
              `Array.from(document.querySelectorAll('aside button')).find(b => b.textContent === '실행 취소').click()`
            )
            await delay(100)
            assert.ok(
              await win.webContents.executeJavaScript(
                `document.querySelector('aside').innerText.includes('실행 취소 완료')`
              )
            )
            assert.equal(
              await win.webContents.executeJavaScript(
                `Array.from(document.querySelectorAll('aside button')).some(b => b.textContent === '실행 취소')`
              ),
              false
            )
          }
          console.log(`PASS quick command ${story.name}`)
        }
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
