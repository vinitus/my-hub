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
    const filter = process.env.STORYBOOK_TEST_FILTER
    const stories = filter
      ? entries.filter((entry) => entry.importPath.includes(filter))
      : entries
    assert.ok(stories.length > 0, "No stories matched STORYBOOK_TEST_FILTER")
    let count = 0
    for (const [theme, width] of [
      ["light", 1100],
      ["dark", 1100],
      ["dark", 360],
    ]) {
      win.setSize(width, 800)
      for (const story of stories) {
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
          theme === "light" &&
          story.importPath.endsWith("/theme-provider.stories.tsx")
        ) {
          await win.webContents
            .executeJavaScript(`window.__controlledWrites = 0; window.__setItem = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) { if (key === 'storybook:controlled-theme') window.__controlledWrites++; return window.__setItem.call(this, key, value) };
            window.dispatchEvent(new KeyboardEvent('keydown', {key:'d', bubbles:true}));`)
          await delay(50)
          assert.equal(
            await win.webContents.executeJavaScript(
              `Number(document.querySelector('[data-testid="theme-requests"]').textContent)`
            ),
            1
          )
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.documentElement.classList.contains('dark')`
            ),
            false,
            "theme must wait for persisted state"
          )
          assert.equal(
            await win.webContents.executeJavaScript(
              `window.__controlledWrites`
            ),
            0,
            "controlled theme must not write a second persistence source"
          )
          await win.webContents.executeJavaScript(
            `Array.from(document.querySelectorAll('button')).find(b => b.textContent === '설정 저장 실패').click()`
          )
          await delay(30)
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.documentElement.classList.contains('dark')`
            ),
            false
          )
          await win.webContents.executeJavaScript(
            `window.dispatchEvent(new KeyboardEvent('keydown', {key:'d', bubbles:true}))`
          )
          await delay(30)
          await win.webContents.executeJavaScript(
            `Array.from(document.querySelectorAll('button')).find(b => b.textContent === '설정 저장 성공').click()`
          )
          await delay(50)
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.documentElement.classList.contains('dark')`
            ),
            true
          )
          await win.webContents.executeJavaScript(
            `Storage.prototype.setItem = window.__setItem; void 0`
          )
          console.log(
            "PASS controlled theme waits for storage without duplicate writes"
          )
        }
        if (
          theme === "light" &&
          story.importPath.endsWith("/workspace-layout.stories.tsx")
        ) {
          const sizes = () =>
            win.webContents.executeJavaScript(`(() => {
            const box = id => document.getElementById(id).getBoundingClientRect();
            return { left: box('left-sidebar').width, right: box('right-status-panel').width,
              height: box('main-view').height, writes: Number(document.querySelector('[data-testid="layout-writes"]').textContent) };
          })()`)
          let initial = await sizes()
          assert.equal(initial.writes, 0, "mount must not persist a layout")
          assert.ok(
            initial.height > 400,
            `workspace must use the remaining screen height: ${JSON.stringify(initial)}`
          )
          if (story.name === "Hydration") {
            await win.webContents.executeJavaScript(
              `Array.from(document.querySelectorAll('button')).find(b => b.textContent === '저장된 레이아웃 불러오기').click()`
            )
            await delay(100)
            initial = await sizes()
            assert.equal(Math.round(initial.left), 360)
            assert.equal(Math.round(initial.right), 320)
            assert.equal(
              initial.writes,
              0,
              "settings hydration must not persist a layout"
            )
          }
          if (story.name === "Default" || story.name === "Restored") {
            assert.equal(
              Math.round(initial.left),
              story.name === "Default" ? 288 : 360
            )
            assert.equal(
              Math.round(initial.right),
              story.name === "Default" ? 280 : 320
            )
            win.setSize(1200, 800)
            await delay(100)
            const resized = await sizes()
            assert.ok(Math.abs(resized.left - initial.left) < 2)
            assert.ok(Math.abs(resized.right - initial.right) < 2)
            assert.equal(
              resized.writes,
              0,
              "window resize must not overwrite preferred widths"
            )
            win.setSize(1100, 800)
            await delay(100)
            await win.webContents.executeJavaScript(
              `document.querySelector('[aria-label="본문 입력"]').focus()`
            )
            win.webContents.insertText("preserved draft")
            const drag = async (label, dx) => {
              const point = await win.webContents.executeJavaScript(`(() => {
                const r = document.querySelector('[aria-label="${label}"]').getBoundingClientRect();
                const x = Math.round(r.x + r.width / 2), y = Math.round(r.y + r.height / 2);
                return { x, y };
              })()`)
              win.webContents.focus()
              win.webContents.sendInputEvent({ type: "mouseMove", ...point })
              win.webContents.sendInputEvent({
                type: "mouseDown",
                button: "left",
                clickCount: 1,
                ...point,
              })
              await delay(30)
              for (let step = 1; step <= 5; step++) {
                win.webContents.sendInputEvent({
                  type: "mouseMove",
                  modifiers: ["leftButtonDown"],
                  x: point.x + Math.round((dx * step) / 5),
                  y: point.y,
                })
                await delay(20)
              }
              win.webContents.sendInputEvent({
                type: "mouseUp",
                button: "left",
                clickCount: 1,
                x: point.x + dx,
                y: point.y,
              })
              await delay(100)
            }
            await drag("왼쪽 사이드바 크기 조절", 60)
            assert.ok(
              Math.abs((await sizes()).left - initial.left - 60) < 2,
              `left drag: ${JSON.stringify({ initial, after: await sizes() })}`
            )
            await drag("오른쪽 현황 패널 크기 조절", -50)
            let changed = await sizes()
            assert.ok(Math.abs(changed.right - initial.right - 50) < 2)
            assert.equal(
              changed.writes,
              2,
              "each completed drag must persist once"
            )
            await win.webContents.executeJavaScript(
              `document.querySelector('[data-sidebar="trigger"]').click()`
            )
            await delay(100)
            assert.equal(Math.round((await sizes()).left), 0)
            await win.webContents.executeJavaScript(
              `document.querySelector('[data-sidebar="trigger"]').click()`
            )
            await delay(100)
            assert.ok(Math.abs((await sizes()).left - changed.left) < 2)
            await win.webContents.executeJavaScript(
              `document.querySelector('[aria-label="현황 접기 전환"]').click()`
            )
            await delay(100)
            assert.equal(Math.round((await sizes()).right), 40)
            await win.webContents.executeJavaScript(
              `document.querySelector('[aria-label="현황 접기 전환"]').click()`
            )
            await delay(100)
            assert.ok(Math.abs((await sizes()).right - changed.right) < 2)
            assert.equal(
              await win.webContents.executeJavaScript(
                `document.querySelector('[aria-label="본문 입력"]').value`
              ),
              "preserved draft"
            )
            await drag("왼쪽 사이드바 크기 조절", -700)
            changed = await sizes()
            assert.ok(
              changed.left < 1 || changed.left >= 199,
              "expanded sidebar must keep its 200px minimum"
            )
            console.log(
              `PASS ${story.name} panel drag, restore and preserved content`
            )
          }
        }
        if (
          width === 360 &&
          story.importPath.endsWith("/workspace-layout.stories.tsx")
        ) {
          const mobile = await win.webContents.executeJavaScript(`({
            sidebarWidth: document.getElementById('left-sidebar').getBoundingClientRect().width,
            overflow: document.documentElement.scrollWidth > innerWidth,
          })`)
          assert.equal(
            Math.round(mobile.sidebarWidth),
            0,
            "mobile sheet must reclaim the desktop sidebar track"
          )
          assert.equal(
            mobile.overflow,
            false,
            "mobile layout must not overflow the viewport"
          )
        }
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
            `document.querySelector('[aria-label="이번 주 일정 정리 완료"]').click()`
          )
          await delay(30)
          assert.ok(
            await win.webContents.executeJavaScript(
              `document.body.innerText.includes('이번 주 일정 정리 완료 요청')`
            )
          )
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
              for (const [selector, value] of [['input[type=text]', 'UI TODO']]) {
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
            await win.webContents.executeJavaScript(`(() => {
              const input = document.querySelector('input[type=date]');
              const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
              set.call(input, '2026-11-02');
              input.dispatchEvent(new Event('input', { bubbles: true }));
              Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('기한 지우기')).click();
            })()`)
            await delay(50)
            assert.equal(
              await win.webContents.executeJavaScript(
                `document.querySelector('input[type=date]').value`
              ),
              ""
            )
            await win.webContents.executeJavaScript(
              `document.querySelector('button[type=submit]').click()`
            )
            await delay(50)
            assert.equal(
              await win.webContents.executeJavaScript(
                `document.querySelector('#storybook-root li').innerText.includes('기한 없음')`
              ),
              true
            )
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
          story.importPath.endsWith("/shortcut-tile.stories.tsx") &&
          story.name === "Reorderable"
        ) {
          const before = await win.webContents.executeJavaScript(
            `document.querySelector('[data-testid="reorderable-shortcuts"]').dataset.order`
          )
          await win.webContents.executeJavaScript(
            `document.querySelector('[aria-label$="순서 이동"]').focus()`
          )
          for (const [key, code] of [
            [" ", "Space"],
            ["ArrowDown", "ArrowDown"],
            [" ", "Space"],
          ]) {
            await win.webContents.executeJavaScript(
              `document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, code: ${JSON.stringify(code)}, bubbles: true }))`
            )
            await delay(50)
          }
          await delay(100)
          const after = await win.webContents.executeJavaScript(
            `document.querySelector('[data-testid="reorderable-shortcuts"]').dataset.order`
          )
          assert.notEqual(
            after,
            before,
            "keyboard drag must reorder the shortcuts"
          )
          console.log("PASS keyboard shortcut reorder")
        }
        if (
          theme === "light" &&
          story.importPath.endsWith("/shortcut-tile.stories.tsx") &&
          story.name === "Website"
        ) {
          await win.webContents.executeJavaScript(`(() => {
            const trigger = document.querySelector('[data-slot="context-menu-trigger"]');
            trigger.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, button: 2, clientX: 40, clientY: 40 }));
          })()`)
          await delay(100)
          const menu = await win.webContents.executeJavaScript(
            `document.querySelector('[data-slot="context-menu-content"]')?.innerText ?? ""`
          )
          assert.ok(
            menu.includes("열기"),
            "shortcut context menu must offer launch"
          )
          assert.ok(
            menu.includes("수정"),
            "shortcut context menu must offer edit"
          )
          assert.ok(
            menu.includes("삭제"),
            "shortcut context menu must offer delete"
          )
          console.log("PASS shortcut context menu actions")
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
        `PASS ${theme} ${width}px: ${stories.length} stories rendered without Electron bridge`
      )
    }
    console.log(`PASS ${count} story renders`)
    app.exit(0)
  } catch (error) {
    console.error(error)
    if (errors.length) console.error("Renderer console errors:", errors)
    app.exit(1)
  }
})
