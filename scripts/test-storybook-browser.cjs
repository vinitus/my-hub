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
          story.importPath.endsWith("/configured-quick-menu.stories.tsx")
        ) {
          const run = (code) => win.webContents.executeJavaScript(code)
          const hold = async () => {
            await run(
              `document.body.dispatchEvent(new MouseEvent('mousemove',{clientX:400,clientY:260,bubbles:true}));document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Control',ctrlKey:true,bubbles:true}))`
            )
            await delay(250)
          }
          await hold()
          assert.equal(
            await run(
              `document.querySelectorAll('.floating-quick-action').length`
            ),
            8
          )
          assert.equal(
            await run(
              `document.querySelector('.floating-quick-menu').dataset.open`
            ),
            "true"
          )
          await run(
            `document.querySelector('[data-action="shortcut:11111111-1111-4111-8111-111111111111"]').click()`
          )
          await delay(50)
          assert.equal(
            await run(
              `document.querySelector('[data-testid="configured-menu-result"]').textContent`
            ),
            "shortcut-launched"
          )
          await run(
            `document.body.dispatchEvent(new KeyboardEvent('keyup',{key:'Control',bubbles:true}))`
          )
          await hold()
          await run(
            `document.querySelector('[data-action="action:home"]').click()`
          )
          await delay(30)
          assert.equal(
            await run(
              `document.querySelector('[data-testid="configured-menu-result"]').textContent`
            ),
            "home"
          )
          await run(
            `document.body.dispatchEvent(new KeyboardEvent('keyup',{key:'Control',bubbles:true}))`
          )
        }
        if (
          story.importPath.endsWith("/floating-quick-menu.stories.tsx") ||
          story.importPath.endsWith("/shortcut-menu.stories.tsx")
        ) {
          const run = (code) => win.webContents.executeJavaScript(code)
          const expanded = () =>
            run(
              `document.querySelector('.floating-quick-menu').dataset.open === 'true'`
            )
          const key = (type, value, ctrlKey = false) =>
            run(
              `document.querySelector('textarea').dispatchEvent(new KeyboardEvent(${JSON.stringify(type)}, {key:${JSON.stringify(value)}, ctrlKey:${ctrlKey}, bubbles:true, cancelable:true}))`
            )
          const point = () =>
            run(
              `(() => { const b=document.querySelector('[data-slot="floating-quick-menu"]').getBoundingClientRect(); return {x:b.left+b.width/2,y:b.top+b.height/2} })()`
            )
          let held = null
          const release = async () => {
            if (held === "control") await key("keyup", "Control")
            if (held === "middle")
              await run(
                `document.body.dispatchEvent(new MouseEvent('mouseup',{button:1,bubbles:true}))`
              )
            held = null
            await delay(30)
          }
          const hold = async (button = "control", at) => {
            await release()
            at ??= await point()
            await run(
              `document.body.dispatchEvent(new MouseEvent('mousemove',{clientX:${at.x},clientY:${at.y},bubbles:true}))`
            )
            held = button
            if (button === "control") await key("keydown", "Control", true)
            else
              assert.equal(
                await run(
                  `!document.body.dispatchEvent(new MouseEvent('mousedown',{button:1,clientX:${at.x},clientY:${at.y},bubbles:true,cancelable:true}))`
                ),
                true
              )
            await delay(250)
          }
          const fit = async () => {
            await delay(450)
            const boxes = await run(`(() => {
              const root = document.querySelector('[data-slot="floating-quick-menu"]').getBoundingClientRect();
              return [...document.querySelectorAll('.floating-quick-action')].map(item => {
                const b = item.getBoundingClientRect();
                return { left:b.left-root.left, top:b.top-root.top, right:root.right-b.right, bottom:root.bottom-b.bottom };
              });
            })()`)
            assert.equal(boxes.length, story.name === "Eight Actions" ? 8 : 5)
            if (story.name !== "Small Workspace")
              assert.ok(
                boxes.every((b) => Object.values(b).every((v) => v >= -1)),
                `cursor menu must fit: ${JSON.stringify(boxes)}`
              )
          }
          assert.equal(
            await run(
              `document.querySelector('.floating-quick-menu-trigger') === null`
            ),
            true,
            "no permanent floating button"
          )
          if (
            [
              "Open",
              "Near Edge",
              "Small Workspace",
              "Disabled Action",
              ...(story.importPath.endsWith("/floating-quick-menu.stories.tsx")
                ? ["Eight Actions"]
                : []),
            ].includes(story.name)
          )
            await fit()
          if (story.name === "Closed") {
            assert.equal(
              await run(
                `document.querySelector('.floating-quick-actions').inert && [...document.querySelectorAll('.floating-quick-action')].every(b=>b.tabIndex===-1)`
              ),
              true
            )
          }
          if (story.name === "Disabled Action") {
            assert.equal(
              await run(
                `document.querySelector('[data-action="note"]').disabled`
              ),
              true
            )
          }
          if (story.name === "Disabled") {
            await hold()
            assert.equal(await expanded(), false)
          }
          if (theme === "light" && story.name === "Offset Workspace") {
            await hold("control", { x: 8, y: 8 })
            assert.equal(
              await expanded(),
              false,
              "sidebar input must not open the workspace menu"
            )
            await hold()
            const expected = await point()
            const actual = await run(
              `(() => {const b=document.querySelector('.floating-quick-menu').getBoundingClientRect();return {x:b.left,y:b.top}})()`
            )
            assert.deepEqual(
              actual,
              expected,
              "viewport coordinates must be converted relative to the workspace"
            )
          }
          if (["Motion Enabled", "Motion Disabled"].includes(story.name)) {
            win.webContents.debugger.attach("1.3")
            // Exercise the opposite OS preference to prove the app override.
            await win.webContents.debugger.sendCommand(
              "Emulation.setEmulatedMedia",
              {
                features: [
                  {
                    name: "prefers-reduced-motion",
                    value:
                      story.name === "Motion Enabled"
                        ? "reduce"
                        : "no-preference",
                  },
                ],
              }
            )
            await hold()
            assert.equal(await expanded(), true)
            assert.equal(
              await run(
                `[...document.querySelectorAll('.floating-quick-action')].every(b=>getComputedStyle(b).transitionDuration==='0s')`
              ),
              story.name === "Motion Disabled"
            )
            await win.webContents.debugger.sendCommand(
              "Emulation.setEmulatedMedia",
              { features: [] }
            )
            win.webContents.debugger.detach()
          }
          if (
            story.name === "Eight Actions" &&
            story.importPath.endsWith("/shortcut-menu.stories.tsx")
          ) {
            await hold()
            assert.equal(await expanded(), true)
            assert.equal(
              await run(
                `document.querySelector('.floating-quick-menu').dataset.layout`
              ),
              "circle"
            )
            await fit()
            await release()
            assert.equal(await expanded(), false)
          }
          if (theme === "light" && story.name === "Interactive") {
            win.webContents.debugger.attach("1.3")
            await win.webContents.debugger.sendCommand(
              "Emulation.setEmulatedMedia",
              {
                features: [
                  { name: "prefers-reduced-motion", value: "no-preference" },
                ],
              }
            )
            assert.equal(await expanded(), false)
            assert.equal(
              await run(
                `document.querySelector('.floating-quick-actions').inert`
              ),
              true
            )
            await run(`document.querySelector('textarea').focus()`)
            win.webContents.insertText("Keep this scratchpad")
            const cursor = await point()
            await run(
              `document.body.dispatchEvent(new MouseEvent('mousemove',{clientX:${cursor.x},clientY:${cursor.y},bubbles:true}))`
            )
            await key("keydown", "Control", true)
            await delay(80)
            await key("keyup", "Control")
            await delay(450)
            assert.equal(
              await expanded(),
              false,
              "short Ctrl press must not open"
            )
            await run(
              `document.body.dispatchEvent(new WheelEvent('wheel',{deltaY:100,bubbles:true}))`
            )
            await delay(450)
            assert.equal(await expanded(), false, "scroll must not open")
            await key("keydown", "Control", true)
            await key("keydown", "k", true)
            await delay(450)
            await key("keyup", "Control")
            assert.equal(
              await expanded(),
              false,
              "Ctrl combinations must not open"
            )
            await hold()
            assert.equal(
              await expanded(),
              true,
              "Ctrl hold must open in 200ms while the key is held"
            )
            await release()
            assert.equal(
              await expanded(),
              false,
              "releasing Ctrl must close immediately"
            )
            await hold()
            const center = await run(
              `(() => {const b=document.querySelector('.floating-quick-menu').getBoundingClientRect();return {x:b.left,y:b.top}})()`
            )
            assert.deepEqual(
              center,
              cursor,
              "menu must originate at the cursor"
            )
            const checkTravel = async (origin) => {
              const motion = await run(`(() => {
                const root = document.querySelector('.floating-quick-menu');
                const items = [...root.querySelectorAll('.floating-quick-action')];
                items.forEach(item => getComputedStyle(item).transform);
                const animations = root.getAnimations({subtree:true});
                animations.forEach(a => a.pause());
                const box = root.getBoundingClientRect();
                const sample = time => {
                  animations.forEach(a => a.currentTime = time);
                  return items.map(item => {
                    const style = getComputedStyle(item);
                    const matrix = new DOMMatrixReadOnly(style.transform);
                    return {x:box.left+matrix.m41,y:box.top+matrix.m42,opacity:Number(style.opacity)};
                  });
                };
                const start=sample(0), middle=sample(120), end=sample(1000);
                animations.forEach(a => a.finish());
                return {start,middle,end};
              })()`)
              const distance = (point) =>
                Math.hypot(point.x - origin.x, point.y - origin.y)
              assert.ok(
                motion.start.every((p) => distance(p) < 1),
                `all buttons must start at the cursor: ${JSON.stringify(motion.start)}`
              )
              assert.ok(
                distance(motion.middle[0]) > 10,
                "the first button must visibly travel outward"
              )
              assert.ok(
                distance(motion.middle[4]) < 1 &&
                  motion.middle[4].opacity === 0,
                "later buttons must wait at the cursor"
              )
              assert.ok(
                motion.end.every((p) => p.opacity === 1),
                "all buttons must finish their entrance"
              )
            }
            await checkTravel(cursor)
            assert.equal(
              await run(
                `document.activeElement === document.querySelector('.floating-quick-actions')`
              ),
              true
            )
            win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Tab" })
            win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Tab" })
            await delay(50)
            assert.equal(
              await run(`document.activeElement?.dataset.action`),
              "note"
            )
            win.webContents.sendInputEvent({
              type: "keyDown",
              keyCode: "Enter",
            })
            win.webContents.sendInputEvent({ type: "char", keyCode: "\r" })
            win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Enter" })
            await delay(50)
            assert.equal(await expanded(), false)
            assert.equal(
              await run(
                `document.querySelector('[role="status"]').textContent.includes(document.querySelector('[data-action="note"] .floating-quick-action-label').textContent)`
              ),
              true
            )
            for (const action of ["todo", "event", "shortcut", "calculator"]) {
              await hold(action === "todo" ? "middle" : "control")
              assert.equal(await expanded(), true)
              await run(
                `document.querySelector('[data-action="${action}"]').click()`
              )
              await delay(30)
              assert.equal(await expanded(), false)
            }
            await hold()
            await run(
              `document.querySelector('.floating-quick-actions').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))`
            )
            await delay(30)
            assert.equal(await expanded(), false)
            assert.equal(
              await run(
                `document.activeElement === document.querySelector('textarea')`
              ),
              true
            )
            await hold()
            await run(
              `document.querySelector('textarea').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`
            )
            await delay(30)
            assert.equal(await expanded(), false)
            assert.equal(
              await run(`document.querySelector('textarea').value`),
              "Keep this scratchpad"
            )
            await hold("middle")
            assert.equal(await expanded(), true)
            await release()
            assert.equal(
              await expanded(),
              false,
              "releasing the wheel must close immediately"
            )
            await hold("middle", { x: 8, y: 8 })
            await checkTravel({ x: 8, y: 8 })
            await fit()
            await run(
              `const d=document.createElement('div');d.id='quick-menu-modal';d.setAttribute('role','dialog');d.setAttribute('data-open','');document.body.append(d)`
            )
            await delay(30)
            assert.equal(await expanded(), false)
            await hold()
            assert.equal(await expanded(), false, "modal blocks hold gesture")
            await run(`document.querySelector('#quick-menu-modal').remove()`)
            await hold()
            win.setSize(360, 800)
            await delay(400)
            await fit()
            assert.equal(await expanded(), true)
            win.setSize(width, 800)
            await delay(400)
            await win.webContents.debugger.sendCommand(
              "Emulation.setEmulatedMedia",
              {
                features: [{ name: "prefers-reduced-motion", value: "reduce" }],
              }
            )
            assert.equal(
              await run(
                `[...document.querySelectorAll('.floating-quick-action')].every(b=>getComputedStyle(b).transitionDuration==='0s')`
              ),
              true
            )
            await win.webContents.debugger.sendCommand(
              "Emulation.setEmulatedMedia",
              { features: [] }
            )
            win.webContents.debugger.detach()
            console.log(
              "PASS cursor-anchored Ctrl/middle hold, short presses, shortcuts, keyboard actions, bounds, modals and reduced motion"
            )
          }
          if (
            story.name === "Open" ||
            (story.name === "Eight Actions" &&
              story.importPath.endsWith("/floating-quick-menu.stories.tsx"))
          ) {
            const output = path.resolve("out/tests/storybook")
            fs.mkdirSync(output, { recursive: true })
            fs.writeFileSync(
              path.join(
                output,
                `quick-menu-${story.name === "Eight Actions" ? "eight-" : ""}${theme}-${width}.png`
              ),
              (
                await win.capturePage(undefined, {
                  stayHidden: true,
                  stayAwake: true,
                })
              ).toPNG()
            )
          }
        }
        if (
          theme === "light" &&
          story.importPath.endsWith("/calculator.stories.tsx")
        ) {
          if (story.name === "Collapsible")
            await win.webContents.executeJavaScript(
              `document.querySelector('summary').click()`
            )
          await win.webContents.executeJavaScript(
            `document.querySelector('input').focus()`
          )
          win.webContents.insertText("(1200 + 350) * 2")
          await delay(30)
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.querySelector('output').textContent`
            ),
            "3,100"
          )
        }
        if (story.importPath.endsWith("/shortcut-wheel.stories.tsx")) {
          if (["Open", "Near Edge"].includes(story.name)) {
            assert.equal(
              await win.webContents.executeJavaScript(
                `document.querySelector('[data-slot="shortcut-wheel-ring"]') !== null`
              ),
              false,
              "only the eight small circles should be visible"
            )
            assert.equal(
              await win.webContents.executeJavaScript(
                `document.querySelectorAll('[data-slot="shortcut-wheel-item"]').length`
              ),
              8
            )
            assert.equal(
              await win.webContents.executeJavaScript(
                `document.documentElement.scrollWidth > innerWidth`
              ),
              false,
              "wheel at the viewport edge must not add scrollbars"
            )
          }
          if (theme === "light" && story.name === "Hold To Open") {
            win.webContents.debugger.attach("1.3")
            await win.webContents.debugger.sendCommand(
              "Emulation.setEmulatedMedia",
              {
                features: [
                  { name: "prefers-reduced-motion", value: "no-preference" },
                ],
              }
            )
            const shown = () =>
              win.webContents.executeJavaScript(
                `!!document.querySelector('[data-slot="shortcut-wheel"]')`
              )
            const key = (type, value, ctrlKey = false) =>
              win.webContents.executeJavaScript(
                `document.querySelector('input').dispatchEvent(new KeyboardEvent(${JSON.stringify(type)}, {key:${JSON.stringify(value)}, ctrlKey:${ctrlKey}, cancelable:true, bubbles:true}))`
              )
            await key("keydown", "Control", true)
            await delay(80)
            await key("keyup", "Control")
            await delay(450)
            assert.equal(
              await shown(),
              false,
              "short Ctrl press must not open the wheel"
            )
            await win.webContents.executeJavaScript(
              `document.body.dispatchEvent(new WheelEvent('wheel', {deltaY:100, bubbles:true}))`
            )
            await delay(450)
            assert.equal(
              await shown(),
              false,
              "normal wheel scrolling must not open the wheel"
            )
            await win.webContents.executeJavaScript(
              `document.body.dispatchEvent(new MouseEvent('mousemove', {clientX:450, clientY:320, bubbles:true}))`
            )
            await key("keydown", "Control", true)
            await delay(450)
            assert.equal(await shown(), true)
            await win.webContents.executeJavaScript(
              `[...document.querySelectorAll('[data-slot="shortcut-wheel-item"]')].map(item => getComputedStyle(item).opacity)`
            )
            await delay(180)
            const animation = await win.webContents.executeJavaScript(`(() => {
              const root = document.querySelector('[data-slot="shortcut-wheel"]'); const box = root.getBoundingClientRect();
              const items = [...root.querySelectorAll('[data-slot="shortcut-wheel-item"]')];
              return { x: box.left + box.width/2, y: box.top + box.height/2, count:items.length, first:Number(getComputedStyle(items[0]).opacity), last:Number(getComputedStyle(items[7]).opacity), delays:items.map(item => parseFloat(getComputedStyle(item).animationDelay)), pointerEvents:getComputedStyle(root).pointerEvents };
            })()`)
            assert.equal(animation.x, 450)
            assert.equal(animation.y, 320)
            assert.equal(animation.count, 8)
            const angles = await win.webContents.executeJavaScript(`(() => {
              const root = document.querySelector('[data-slot="shortcut-wheel"]');
              return [...root.querySelectorAll('.shortcut-wheel-item-position')].map(item =>
                Math.round((Math.atan2(parseFloat(item.style.top) - 107, parseFloat(item.style.left) - 107) * 180 / Math.PI + 450) % 360)
              );
            })()`)
            assert.deepEqual(angles, [0, 45, 90, 135, 180, 225, 270, 315])
            assert.equal(animation.pointerEvents, "none")
            assert.ok(
              animation.first > 0 && animation.last === 0,
              `outer circles must appear sequentially: ${JSON.stringify(animation)}`
            )
            assert.ok(
              animation.delays.every(
                (value, index) =>
                  index === 0 || value > animation.delays[index - 1]
              )
            )
            await delay(500)
            assert.equal(
              await win.webContents.executeJavaScript(
                `[...document.querySelectorAll('[data-slot="shortcut-wheel-item"]')].every(item => Number(getComputedStyle(item).opacity) === 1)`
              ),
              true
            )
            await win.webContents.executeJavaScript(
              `document.body.dispatchEvent(new MouseEvent('mousemove', {clientX:550, clientY:350, bubbles:true}))`
            )
            assert.equal(
              await win.webContents.executeJavaScript(
                `document.querySelector('[data-slot="shortcut-wheel"]').style.left`
              ),
              "450px",
              "wheel center must stay anchored after opening"
            )
            await key("keyup", "Control")
            await delay(30)
            assert.equal(await shown(), false)
            await key("keydown", "Control", true)
            await key("keydown", "k", true)
            await delay(450)
            assert.equal(
              await shown(),
              false,
              "Ctrl combinations must cancel the hold gesture"
            )
            await key("keyup", "Control")
            assert.equal(
              await win.webContents.executeJavaScript(
                `const event = new MouseEvent('mousedown', {button:1, clientX:400, clientY:300, cancelable:true, bubbles:true}); document.body.dispatchEvent(event); event.defaultPrevented`
              ),
              true
            )
            await delay(450)
            assert.equal(
              await shown(),
              true,
              "held middle button must open the wheel"
            )
            await win.webContents.executeJavaScript(
              `document.body.dispatchEvent(new MouseEvent('mouseup', {button:1, bubbles:true}))`
            )
            await delay(30)
            assert.equal(
              await shown(),
              false,
              "middle button release must close the wheel"
            )
            await key("keydown", "Control", true)
            await delay(450)
            await key("keydown", "Escape", true)
            await delay(30)
            assert.equal(await shown(), false)
            await key("keyup", "Control")
            await key("keydown", "Control", true)
            await delay(450)
            await win.webContents.executeJavaScript(
              `window.dispatchEvent(new Event('blur'))`
            )
            await delay(30)
            assert.equal(await shown(), false)
            await win.webContents.executeJavaScript(
              `const dialog = document.createElement('div'); dialog.id='wheel-test-dialog'; dialog.setAttribute('role','dialog'); dialog.setAttribute('data-open',''); document.body.append(dialog)`
            )
            await key("keydown", "Control", true)
            await delay(450)
            assert.equal(
              await shown(),
              false,
              "open dialogs must suppress the wheel"
            )
            await key("keyup", "Control")
            await win.webContents.executeJavaScript(
              `document.querySelector('#wheel-test-dialog').remove()`
            )
            await win.webContents.debugger.sendCommand(
              "Emulation.setEmulatedMedia",
              {
                features: [{ name: "prefers-reduced-motion", value: "reduce" }],
              }
            )
            await key("keydown", "Control", true)
            await delay(450)
            assert.equal(
              await win.webContents.executeJavaScript(
                `[...document.querySelectorAll('[data-slot="shortcut-wheel-item"]')].every(item => getComputedStyle(item).animationDelay === '0s')`
              ),
              true,
              "reduced motion must remove animation staggering"
            )
            await key("keyup", "Control")
            await win.webContents.debugger.sendCommand(
              "Emulation.setEmulatedMedia",
              { features: [] }
            )
            win.webContents.debugger.detach()
            console.log(
              "PASS shortcut wheel hold, cursor anchor, staggered animation, release, shortcuts and modal guard"
            )
          }
        }
        if (
          theme === "light" &&
          story.importPath.endsWith("/navigation-shortcuts.stories.tsx")
        ) {
          const activeView = () =>
            win.webContents.executeJavaScript(
              `document.querySelector('[data-testid="active-workspace"]').textContent`
            )
          const hintVisible = () =>
            win.webContents.executeJavaScript(
              `getComputedStyle(document.querySelector('[aria-keyshortcuts="Control+H"] kbd')).visibility === 'visible'`
            )
          assert.equal(await hintVisible(), false)
          await win.webContents.executeJavaScript(
            `window.dispatchEvent(new KeyboardEvent('keydown', {key:'Control', ctrlKey:true}))`
          )
          await delay(30)
          assert.equal(
            await hintVisible(),
            true,
            "home hint must be shown while Ctrl is held"
          )
          await win.webContents.executeJavaScript(
            `document.querySelector('input[aria-label="단축키 테스트 입력"]').focus(); window.dispatchEvent(new KeyboardEvent('keydown', {key:'h', code:'KeyH', ctrlKey:true, cancelable:true}))`
          )
          await delay(30)
          assert.equal(await activeView(), "home")
          await win.webContents.executeJavaScript(
            `window.dispatchEvent(new KeyboardEvent('keyup', {key:'Control', ctrlKey:false}))`
          )
          await delay(30)
          assert.equal(await hintVisible(), false)
          for (const [key, view] of [
            ["1", "shortcuts"],
            ["2", "notes"],
            ["3", "calendar"],
            ["4", "todos"],
          ]) {
            await win.webContents.executeJavaScript(
              `window.dispatchEvent(new KeyboardEvent('keydown', {key:${JSON.stringify(key)}, ctrlKey:true, cancelable:true}))`
            )
            await delay(30)
            assert.equal(await activeView(), view)
          }
          await win.webContents.executeJavaScript(
            `const dialog = document.createElement('div'); dialog.id='navigation-test-dialog'; dialog.setAttribute('role','dialog'); dialog.setAttribute('data-open',''); document.body.append(dialog); window.dispatchEvent(new KeyboardEvent('keydown', {key:'h', code:'KeyH', ctrlKey:true, cancelable:true}))`
          )
          await delay(30)
          assert.equal(
            await activeView(),
            "todos",
            "Ctrl+H must not navigate while a modal is open"
          )
          await win.webContents.executeJavaScript(
            `document.querySelector('#navigation-test-dialog').remove(); window.dispatchEvent(new KeyboardEvent('keydown', {key:'H', code:'KeyH', ctrlKey:true, shiftKey:true, cancelable:true}))`
          )
          await delay(30)
          assert.equal(
            await activeView(),
            "todos",
            "Ctrl+Shift+H must not trigger home"
          )
          await win.webContents.executeJavaScript(
            `window.dispatchEvent(new KeyboardEvent('keydown', {key:'ㅗ', code:'KeyH', ctrlKey:true, cancelable:true}))`
          )
          await delay(30)
          assert.equal(
            await activeView(),
            "home",
            "physical Ctrl+H must work with Korean input layout"
          )
          assert.deepEqual(
            await win.webContents.executeJavaScript(
              `JSON.parse(document.querySelector('[data-testid="visited-workspaces"]').textContent).sort()`
            ),
            ["calendar", "home", "notes", "shortcuts", "todos"],
            "navigation must retain every visited workspace"
          )
          await win.webContents.executeJavaScript(
            `window.dispatchEvent(new Event('blur'))`
          )
          await delay(30)
          assert.equal(await hintVisible(), false)
          console.log(
            "PASS Ctrl+H home, workspace hints, existing number shortcuts and modal guard"
          )
        }
        if (story.importPath.endsWith("/home-create-dialog.stories.tsx")) {
          const bounds = await win.webContents.executeJavaScript(`(() => {
            const dialog = document.querySelector('[data-slot="dialog-content"]');
            if (!dialog) return null;
            const box = dialog.getBoundingClientRect();
            return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: innerWidth, height: innerHeight };
          })()`)
          if (bounds) {
            assert.ok(
              bounds.left >= 0 &&
                bounds.right <= bounds.width + 1 &&
                bounds.top >= 0 &&
                bounds.bottom <= bounds.height + 1,
              `home dialog must fit the viewport: ${JSON.stringify(bounds)}`
            )
            assert.ok(
              Math.abs((bounds.left + bounds.right) / 2 - bounds.width / 2) < 2,
              "home dialog must be centered"
            )
          }
        }
        if (
          theme === "light" &&
          story.importPath.endsWith("/home-create-dialog.stories.tsx") &&
          ["Home Actions", "Home Save Failure"].includes(story.name)
        ) {
          await win.webContents.executeJavaScript(
            `document.querySelector('textarea').focus()`
          )
          win.webContents.insertText("모달을 열어도 유지할 낙서")
          await delay(50)
          const failed = story.name === "Home Save Failure"
          for (const [label, selector, count] of [
            ["할일 추가", 'input[placeholder="할일을 입력하세요"]', "todos"],
            ["일정 추가", 'input[placeholder="일정 제목"]', "events"],
            [
              "바로가기 등록",
              'input[placeholder="예: 작업 폴더"]',
              "shortcuts",
            ],
          ]) {
            await win.webContents.executeJavaScript(
              `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`
            )
            await delay(150)
            assert.equal(
              await win.webContents.executeJavaScript(
                `!!document.querySelector('[data-slot="dialog-content"]') && !document.querySelector('[data-slot="sheet-content"]')`
              ),
              true,
              `${label} must use shadcn Dialog`
            )
            await win.webContents.executeJavaScript(
              `document.querySelector('[data-slot="dialog-content"]').querySelector(${JSON.stringify(selector)}).focus()`
            )
            win.webContents.insertText("홈에서 등록")
            await delay(50)
            if (count === "shortcuts") {
              await win.webContents.executeJavaScript(
                `Array.from(document.querySelectorAll('[data-slot="dialog-content"] button')).find(b => b.textContent.trim() === '찾아보기').click()`
              )
              await delay(50)
            }
            await win.webContents.executeJavaScript(
              `window.dispatchEvent(new KeyboardEvent('keydown', {key:'s', ctrlKey:true, bubbles:true, cancelable:true}))`
            )
            assert.equal(
              await win.webContents.executeJavaScript(
                `document.querySelector('[aria-label="낙서장"] [role="status"]').textContent`
              ),
              "Ctrl+S로 메모 저장",
              "dialog must block scratchpad save"
            )
            await win.webContents.executeJavaScript(
              `document.querySelector('[data-slot="dialog-content"] button[type="submit"]').click()`
            )
            await delay(150)
            if (failed) {
              assert.match(
                await win.webContents.executeJavaScript(
                  `document.querySelector('[data-slot="dialog-content"]').textContent`
                ),
                /저장 실패 테스트/
              )
              assert.equal(
                await win.webContents.executeJavaScript(
                  `document.querySelector('[data-slot="dialog-content"]').querySelector(${JSON.stringify(selector)}).value`
                ),
                "홈에서 등록",
                "failure must preserve form input"
              )
              await win.webContents.executeJavaScript(
                `Array.from(document.querySelectorAll('[data-slot="dialog-content"] button')).find(b => b.textContent.trim() === '취소').click()`
              )
              await delay(100)
            }
            assert.equal(
              await win.webContents.executeJavaScript(
                `!!document.querySelector('[data-slot="dialog-content"][data-open]')`
              ),
              false
            )
            const counts = await win.webContents.executeJavaScript(
              `JSON.parse(document.querySelector('[data-testid="saved-counts"]').textContent)`
            )
            assert.equal(
              counts[count],
              failed ? 0 : 1,
              "registration must update the shared store only on success"
            )
            assert.equal(
              await win.webContents.executeJavaScript(
                `document.querySelector('textarea').value`
              ),
              "모달을 열어도 유지할 낙서"
            )
          }
          await win.webContents.executeJavaScript(
            `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '할일 추가').click()`
          )
          await delay(100)
          win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape" })
          win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Escape" })
          await delay(100)
          assert.equal(
            await win.webContents.executeJavaScript(
              `!!document.querySelector('[data-slot="dialog-content"][data-open]')`
            ),
            false,
            "Escape must close the registration dialog"
          )
          console.log(
            `PASS home registration dialogs ${failed ? "failure recovery" : "save and shared stores"}, scratchpad preserved`
          )
        }
        if (
          story.importPath.endsWith("/settings-sheet.stories.tsx") &&
          story.name === "Registered Shortcuts"
        ) {
          assert.deepEqual(
            await win.webContents.executeJavaScript(`(() => {
            const image=document.querySelector('[data-slot=sheet-content] ol img');
            const frame=getComputedStyle(image.parentElement);
            const style=getComputedStyle(image);
            return [frame.width,parseFloat(frame.borderRadius)>=parseFloat(frame.width)/2,frame.overflow,style.objectFit];
          })()`),
            ["20px", true, "hidden", "cover"]
          )
        }
        if (
          theme === "light" &&
          story.importPath.endsWith("/settings-sheet.stories.tsx") &&
          story.name === "Motion Preference"
        ) {
          for (const action of ["home", "notes", "calendar"]) {
            await win.webContents.executeJavaScript(
              `document.querySelector('button[aria-label="메뉴 항목 추가"]').click()`
            )
            await delay(120)
            await win.webContents.executeJavaScript(
              `document.querySelector('[data-menu-item-key="action:${action}"]').click()`
            )
            await delay(120)
          }
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.querySelectorAll('[data-slot=sheet-content] ol li').length`
            ),
            8
          )
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.querySelector('button[aria-label="메뉴 항목 추가"]').disabled`
            ),
            true
          )
          await win.webContents.executeJavaScript(
            `document.querySelectorAll('[data-slot=sheet-content] ol button')[5].click()`
          )
          await delay(30)
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.querySelectorAll('[data-slot=sheet-content] ol li').length`
            ),
            7
          )
          await win.webContents.executeJavaScript(
            `document.querySelector('button[aria-label="메뉴 항목 추가"]').click()`
          )
          await delay(120)
          assert.equal(
            await win.webContents.executeJavaScript(
              `!!document.querySelector('[data-menu-item-key="shortcut:11111111-1111-4111-8111-111111111111"] svg')`
            ),
            true
          )
          await win.webContents.executeJavaScript(
            `document.querySelector('[data-menu-item-key="shortcut:11111111-1111-4111-8111-111111111111"]').click()`
          )
          await delay(120)
          assert.equal(
            await win.webContents.executeJavaScript(
              `!!document.querySelector('[data-slot=sheet-content] ol li:last-child svg.lucide-folder')`
            ),
            true
          )
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.querySelectorAll('[data-slot=sheet-content] ol li').length`
            ),
            8
          )
          for (const value of ["ctrl+alt+k", "ctrl+shift+space", "ctrl+k"]) {
            await win.webContents.executeJavaScript(`(() => {
              const select=document.querySelector('select[id$="-launcher-shortcut"]');
              select.value=${JSON.stringify(value)};
              select.dispatchEvent(new Event('change',{bubbles:true}));
            })()`)
            await delay(30)
            assert.equal(
              await win.webContents.executeJavaScript(
                `document.querySelector('select[id$="-launcher-shortcut"]').value`
              ),
              value
            )
          }
          assert.equal(
            await win.webContents.executeJavaScript(
              `!!document.querySelector('select[id$="-launcher-shortcut"] option[value="ctrl+shift+k"]')`
            ),
            false,
            "AI shortcut stays reserved"
          )
          for (const value of ["system", "off", "on"]) {
            await win.webContents.executeJavaScript(`(() => {
              const select=document.querySelector('select[id$="-menu-motion"]');
              select.value=${JSON.stringify(value)};
              select.dispatchEvent(new Event('change',{bubbles:true}));
            })()`)
            await delay(30)
            assert.equal(
              await win.webContents.executeJavaScript(
                `document.querySelector('select[id$="-menu-motion"]').value`
              ),
              value
            )
          }
        }
        if (story.importPath.endsWith("/home-page-view.stories.tsx")) {
          const run = (code) => win.webContents.executeJavaScript(code)
          assert.equal(
            await run(
              `document.querySelectorAll('[aria-label="빠른 작업"] button').length`
            ),
            4
          )
          assert.equal(
            await run(`document.querySelector('details').open`),
            false,
            "calculator starts collapsed"
          )
          if (story.name === "Recent Notes") {
            const names = await run(
              `[...document.querySelectorAll('[aria-label="이어서 작업하기"] li p')].map(p=>p.textContent)`
            )
            assert.equal(names.length, 3)
            assert.ok(names[0].startsWith("아주 긴 이름"))
            assert.equal(names[1], "다음 주 계획")
            assert.equal(
              names.includes("오래된 즐겨찾기"),
              false,
              "mtime determines recent work independently of favorites"
            )
            await run(
              `document.querySelector('[aria-label="이어서 작업하기"] button').click()`
            )
            await delay(30)
            assert.ok(
              await run(
                `document.querySelector('[data-testid="recent-note-opened"]').textContent.startsWith('아주 긴 이름')`
              )
            )
            const output = path.resolve("out/tests/storybook")
            fs.mkdirSync(output, { recursive: true })
            fs.writeFileSync(
              path.join(output, `home-recent-${theme}-${width}.png`),
              (await win.capturePage()).toPNG()
            )
            const bounds = await run(
              `(() => { const a=document.querySelector('[aria-label="이어서 작업하기"]').getBoundingClientRect(); const b=document.querySelector('[aria-label="빠른 작업"]').getBoundingClientRect(); return { sameRow: Math.abs(a.top-b.top)<2, width: document.querySelector('[aria-label="홈"]').clientWidth } })()`
            )
            assert.equal(
              bounds.sameRow,
              bounds.width >= 640,
              "home cards adapt to the workspace width"
            )
            assert.equal(
              await run(
                `getComputedStyle(document.querySelector('textarea')).resize`
              ),
              "vertical"
            )
            const before = await run(`document.querySelector('textarea').value`)
            await run(
              `document.querySelector('[aria-label="낙서장 확대"]').click()`
            )
            await delay(50)
            assert.equal(
              await run(
                `document.querySelector('[aria-label="이어서 작업하기"]').checkVisibility()`
              ),
              false
            )
            assert.equal(
              await run(`document.querySelector('textarea').value`),
              before
            )
            await run(
              `document.querySelector('[aria-label="낙서장 축소"]').click()`
            )
            await delay(50)
            assert.equal(
              await run(
                `document.querySelector('[aria-label="이어서 작업하기"]').checkVisibility()`
              ),
              true
            )
            console.log(
              "PASS recent notes order, reopen action, responsive cards and scratchpad expand/collapse"
            )
          } else
            assert.ok(
              await run(
                `document.querySelector('[aria-label="이어서 작업하기"]').innerText.includes('최근 수정한 메모가 없습니다')`
              )
            )
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.querySelector('textarea').disabled`
            ),
            story.name === "Saving"
          )
          assert.equal(
            await win.webContents.executeJavaScript(
              `!!document.querySelector('[role="alert"]')`
            ),
            story.name === "Save Error"
          )
        }
        if (
          theme === "light" &&
          story.importPath.endsWith("/home-quick-add.stories.tsx")
        ) {
          const run = (code) => win.webContents.executeJavaScript(code)
          const items = () =>
            run(
              `JSON.parse(document.querySelector('[data-testid="home-inbox-items"]').textContent)`
            )
          await run(`document.querySelector('textarea').focus()`)
          win.webContents.insertText("낙서장에 남겨 둔 생각")
          await delay(30)
          await run(
            `[...document.querySelectorAll('button')].find(b=>b.innerText==='인박스에 추가').click()`
          )
          await delay(80)
          assert.equal(
            await run(
              `document.activeElement===document.querySelector('[aria-label="인박스에 추가할 내용"]')`
            ),
            true
          )
          assert.equal(
            await run(
              `document.querySelector('[role="dialog"] button[type="submit"]').disabled`
            ),
            true
          )
          assert.equal(
            await run(
              `document.querySelectorAll('[role="dialog"] input').length`
            ),
            1
          )
          assert.equal(
            await run(
              `document.querySelector('[aria-label="인박스에 추가할 내용"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true}))`
            ),
            false
          )
          assert.equal((await items()).length, 0)
          win.webContents.insertText("https://example.com/saved-for-later")
          await delay(30)
          win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Enter" })
          win.webContents.sendInputEvent({ type: "char", keyCode: "\r" })
          win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Enter" })
          await delay(40)
          assert.equal(
            await run(
              `document.querySelector('[role="dialog"] button[type="submit"]').textContent`
            ),
            "저장 중…"
          )
          await run(
            `window.dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}))`
          )
          await delay(180)
          if (story.name === "Save Failure") {
            assert.equal(
              await run(
                `document.querySelector('[aria-label="인박스에 추가할 내용"]').value`
              ),
              "https://example.com/saved-for-later"
            )
            assert.ok(
              await run(
                `document.querySelector('[role="alert"]').textContent.includes('인박스 저장 실패')`
              )
            )
            assert.equal((await items()).length, 0)
            win.webContents.sendInputEvent({
              type: "keyDown",
              keyCode: "Escape",
            })
            win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Escape" })
            await delay(120)
            assert.equal(
              await run(
                `!!document.querySelector('[role="dialog"][data-open]')`
              ),
              false
            )
          } else {
            assert.equal(
              await run(
                `!!document.querySelector('[role="dialog"][data-open]')`
              ),
              false
            )
            assert.ok(
              await run(
                `document.querySelector('[aria-label="인박스 추가 결과"]').textContent.includes('인박스에 추가했습니다')`
              )
            )
            const saved = (await items())[0]
            assert.equal(saved.kind, "link")
            assert.equal(saved.processedAt, null)
            assert.equal(saved.source, "홈 빠른 추가")
          }
          assert.equal(
            await run(`document.querySelector('textarea').value`),
            "낙서장에 남겨 둔 생각",
            "quick capture preserves the scratchpad"
          )
          assert.equal(
            await run(
              `document.querySelector('[aria-label="낙서장"] [role="status"]').textContent`
            ),
            "Ctrl+S로 메모 저장",
            "Ctrl+S is ignored while quick capture is open"
          )
          if (story.name !== "Save Failure") {
            await run(
              `[...document.querySelectorAll('button')].find(b=>b.innerText==='인박스 화면 확인').click()`
            )
            await delay(50)
            assert.ok(
              await run(
                `document.querySelector('ul[aria-label="수집한 항목"]').innerText.includes('https://example.com/saved-for-later')`
              )
            )
          }
          console.log(`PASS home inbox quick add: ${story.name}`)
        }
        if (
          theme === "light" &&
          story.importPath.endsWith("/scratchpad-save.stories.tsx")
        ) {
          const run = (code) => win.webContents.executeJavaScript(code)
          const writes = () =>
            run(
              `JSON.parse(document.querySelector('[data-testid="scratchpad-writes"]').textContent)`
            )
          const save = async () => {
            await run(
              `document.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}))`
            )
            await delay(50)
          }
          await run(`document.querySelector('textarea').focus()`)
          win.webContents.insertText("First scratchpad draft")
          await delay(30)
          await save()
          if (["Ai Failure", "Missing Ai"].includes(story.name)) {
            assert.deepEqual(
              await writes(),
              [],
              "AI failures must not write a note"
            )
            assert.equal(
              await run(`!!document.querySelector('[role="alert"]')`),
              true
            )
          } else {
            const first = (await writes())[0]
            assert.equal(first.previous, null)
            assert.equal(first.markdown, "First scratchpad draft")
            assert.equal(
              await run(`!!document.querySelector('[role="alert"]')`),
              story.name === "Retry After Write Failure"
            )
            // Rerender the entire hook caller with new input before repeating save.
            await run(`document.querySelector('textarea').focus()`)
            win.webContents.insertText(" updated")
            await delay(30)
            await save()
            const second = (await writes())[1]
            assert.deepEqual(second.previous, {
              key: "fixture-note",
              markdown: first.markdown,
            })
            assert.equal(second.title, first.title)
            assert.equal(
              await run(`!!document.querySelector('[role="alert"]')`),
              false
            )
            assert.equal((await writes()).length, 2)
          }
          assert.equal(
            await run(
              `document.querySelector('textarea').value.startsWith('First scratchpad draft')`
            ),
            true
          )
          console.log(
            "PASS scratchpad title/save composition, identity retention, retry and AI failure isolation"
          )
        }
        if (
          theme === "light" &&
          story.importPath.endsWith("/home-page.stories.tsx")
        ) {
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.activeElement === document.querySelector('textarea')`
            ),
            story.name !== "Inactive",
            "scratchpad must focus on entry only while active"
          )
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.querySelector('textarea').hasAttribute('placeholder')`
            ),
            false
          )
          await win.webContents.executeJavaScript(
            `document.querySelector('input').focus(); window.dispatchEvent(new Event('focus'))`
          )
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.activeElement === document.querySelector('textarea')`
            ),
            story.name !== "Inactive",
            "returning to the app must refocus only the active scratchpad"
          )
          await win.webContents.executeJavaScript(`
            const dialog = document.createElement('div');
            dialog.id = 'focus-test-dialog'; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('data-open', '');
            const input = document.createElement('input'); dialog.append(input); document.body.append(dialog); input.focus();
            window.dispatchEvent(new Event('focus'));
          `)
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.activeElement === document.querySelector('#focus-test-dialog input')`
            ),
            true,
            "window focus must not steal focus from an open dialog"
          )
          await win.webContents.executeJavaScript(
            `document.querySelector('#focus-test-dialog').remove()`
          )
          await win.webContents.executeJavaScript(
            `document.querySelector('textarea').focus()`
          )
          win.webContents.insertText("첫 줄\n두 번째 줄")
          await delay(50)
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.querySelector('textarea').value`
            ),
            "첫 줄\n두 번째 줄",
            "free writing must preserve newlines"
          )
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.querySelector('[role="status"]').textContent`
            ),
            "Ctrl+S로 메모 저장",
            "typing must not save the scratchpad"
          )
          await win.webContents.executeJavaScript(
            `window.dispatchEvent(new KeyboardEvent('keydown', {key:'s', ctrlKey:true, bubbles:true, cancelable:true}))`
          )
          await delay(50)
          if (story.name === "Ai Title") {
            assert.equal(
              await win.webContents.executeJavaScript(
                `document.querySelector('[role="status"]').textContent`
              ),
              "AI 제목 생성·저장 중…"
            )
            assert.equal(
              await win.webContents.executeJavaScript(
                `document.querySelector('textarea').disabled`
              ),
              true
            )
            await delay(300)
          }
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.querySelector('textarea').value`
            ),
            "첫 줄\n두 번째 줄",
            "saving or AI failure must preserve the scratchpad text"
          )
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.querySelector('[role="alert"]')?.textContent.trim() || document.querySelector('[role="status"]').textContent`
            ),
            story.name === "Save Error"
              ? "파일에 접근할 수 없습니다."
              : story.name === "Ai Unavailable"
                ? "설정에서 ChatGPT 계정을 연결해 주세요."
                : story.name === "Ai Title"
                  ? "분기별 회의 준비.md 저장 완료"
                  : story.name === "Inactive"
                    ? "Ctrl+S로 메모 저장"
                    : "메모로 저장했습니다.",
            "Ctrl+S must respect the active page and surface save errors"
          )
          await win.webContents.executeJavaScript(
            `document.querySelector('summary').click(); document.querySelector('input').focus()`
          )
          win.webContents.insertText("(1200 + 350) * 2")
          await delay(50)
          assert.equal(
            await win.webContents.executeJavaScript(
              `document.querySelector('output').textContent`
            ),
            "3,100"
          )
          console.log(
            "PASS scratchpad explicit save, retained text and optional calculator"
          )
        }
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
            assert.equal(Math.round(initial.left), 300)
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
              story.name === "Default" ? 288 : 300
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
            assert.equal(
              Math.round((await sizes()).left),
              320,
              "left drag must stop at its 320px maximum"
            )
            assert.ok(
              Math.abs(
                (await sizes()).left - Math.min(initial.left + 60, 320)
              ) < 2,
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
            assert.ok(
              Math.abs((await sizes()).left - changed.left) < 2,
              `left reopen: ${JSON.stringify({ changed, after: await sizes() })}`
            )
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
            assert.equal(
              Math.round(changed.left),
              200,
              "left drag must stop at 200px without collapsing"
            )
            await drag("오른쪽 현황 패널 크기 조절", 700)
            changed = await sizes()
            assert.equal(
              Math.round(changed.right),
              200,
              "right drag must stop at 200px without collapsing"
            )
            const minimumSettings = await win.webContents.executeJavaScript(
              `JSON.parse(document.querySelector('[data-testid="layout-settings"]').textContent)`
            )
            assert.equal(minimumSettings.sidebarOpen, true)
            assert.equal(minimumSettings.rightPanelOpen, true)
            assert.equal(minimumSettings.leftSidebarWidth, 200)
            assert.equal(minimumSettings.rightPanelWidth, 200)
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
          story.importPath.endsWith("/inbox-view.stories.tsx") &&
          story.name === "Default"
        ) {
          const output = path.resolve("out/tests/storybook")
          fs.mkdirSync(output, { recursive: true })
          fs.writeFileSync(
            path.join(output, `inbox-${theme}-${width}.png`),
            (await win.capturePage()).toPNG()
          )
        }
        if (
          theme === "light" &&
          story.importPath.endsWith("/inbox-view.stories.tsx") &&
          story.name === "Interactive"
        ) {
          const run = (code) => win.webContents.executeJavaScript(code)
          const clickText = async (text) => {
            await run(
              `[...document.querySelectorAll('button')].find(b=>b.innerText===${JSON.stringify(text)}).click()`
            )
            await delay(70)
          }
          const fill = async (selector, value, textarea = false) => {
            await run(
              `(() => { const input=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(${textarea ? "HTMLTextAreaElement" : "HTMLInputElement"}.prototype,'value').set.call(input,${JSON.stringify(value)}); input.dispatchEvent(new Event('input',{bubbles:true})); })()`
            )
            await delay(40)
          }
          await fill('[aria-label="수집할 내용"]', "회고 아이디어", true)
          await clickText("수집")
          assert.equal(
            await run(
              `document.querySelector('[aria-label="수집할 내용"]').value`
            ),
            ""
          )
          assert.equal(
            await run(
              `document.querySelectorAll('ul[aria-label="수집한 항목"] > li').length`
            ),
            4
          )
          await run(
            `document.querySelector('[aria-label="회고 아이디어 처리 완료"]').click()`
          )
          await delay(50)
          await clickText("처리 완료")
          assert.equal(
            await run(
              `document.querySelectorAll('ul[aria-label="수집한 항목"] > li').length`
            ),
            2
          )
          await run(
            `document.querySelector('[aria-label="회고 아이디어 미처리로 되돌리기"]').click()`
          )
          await delay(50)
          await clickText("미처리")
          await fill('[aria-label="인박스 검색"]', "파일 드롭")
          assert.equal(
            await run(
              `document.querySelectorAll('ul[aria-label="수집한 항목"] > li').length`
            ),
            1
          )
          await fill('[aria-label="인박스 검색"]', "")
          await run(
            `(() => { const data=new DataTransfer(); data.setData('text/uri-list','# source\\nhttps://example.com/dropped'); document.querySelector('section[aria-label="인박스"]').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data})); })()`
          )
          await delay(60)
          assert.equal(
            await run(
              `document.querySelectorAll('ul[aria-label="수집한 항목"] > li').length`
            ),
            5
          )
          await run(
            `document.querySelector('[aria-label="회고 아이디어 삭제"]').click()`
          )
          await delay(60)
          await clickText("취소")
          assert.equal(
            await run(
              `document.querySelectorAll('ul[aria-label="수집한 항목"] > li').length`
            ),
            5
          )
          await run(
            `document.querySelector('[aria-label="회고 아이디어 삭제"]').click()`
          )
          await delay(60)
          await clickText("삭제")
          assert.equal(
            await run(
              `document.querySelectorAll('ul[aria-label="수집한 항목"] > li').length`
            ),
            4
          )
          console.log(
            "PASS inbox capture, filtering, source search, drop, process/reopen and confirmed deletion"
          )
        }
        if (
          theme === "light" &&
          story.importPath.endsWith("/inbox-flow.stories.tsx")
        ) {
          const run = (code) => win.webContents.executeJavaScript(code)
          const clickText = async (text) => {
            await run(
              `[...document.querySelectorAll('button')].find(b=>b.innerText===${JSON.stringify(text)}).click()`
            )
            await delay(100)
          }
          const counts = () =>
            run(
              `JSON.parse(document.querySelector('[data-testid="inbox-saved-counts"]').textContent)`
            )
          if (story.name === "Move") {
            for (const [label, kind] of [
              ["할일", "todo"],
              ["일정", "event"],
              ["바로가기", "shortcut"],
              ["메모", "note"],
            ]) {
              await clickText(`${label}로`)
              if (kind !== "note") {
                assert.ok(
                  await run(
                    `document.querySelector('[role="dialog"] form').innerText.length > 0`
                  )
                )
                await run(
                  `document.querySelector('[role="dialog"] form').requestSubmit()`
                )
                await delay(120)
              }
              assert.equal((await counts())[kind], 1, `${label} saved once`)
              assert.equal(
                await run(
                  `document.querySelectorAll('ul[aria-label="수집한 항목"] > li').length`
                ),
                0
              )
              await clickText("처리 완료")
              assert.ok(
                await run(
                  `document.querySelector('ul[aria-label="수집한 항목"]').innerText.includes(${JSON.stringify(`${label}로 옮김`)})`
                )
              )
              await run(
                `document.querySelector('button[aria-label$="미처리로 되돌리기"]').click()`
              )
              await delay(70)
              await clickText("미처리")
            }
          } else {
            await clickText("할일로")
            await run(
              `document.querySelector('[role="dialog"] form').requestSubmit()`
            )
            await delay(120)
            if (story.name === "Save Failure") {
              assert.equal((await counts()).todo, 0)
              assert.ok(
                await run(
                  `document.querySelector('[role="dialog"]').innerText.includes('대상 저장 실패')`
                )
              )
              await clickText("취소")
            } else {
              assert.equal((await counts()).todo, 1)
              assert.ok(
                await run(
                  `document.querySelector('[role="alert"]').innerText.includes('대상 항목은 저장했습니다')`
                )
              )
            }
            assert.equal(
              await run(
                `document.querySelectorAll('ul[aria-label="수집한 항목"] > li').length`
              ),
              1,
              "source remains pending on failure"
            )
          }
          console.log(`PASS inbox conversion: ${story.name}`)
        }
        if (
          story.importPath.endsWith("/quick-command.stories.tsx") &&
          story.name === "Open"
        ) {
          const output = path.resolve("out/tests/storybook")
          fs.mkdirSync(output, { recursive: true })
          fs.writeFileSync(
            path.join(output, `action-launcher-${theme}-${width}.png`),
            (await win.capturePage()).toPNG()
          )
        }
        if (
          theme === "light" &&
          story.importPath.endsWith("/calendar-page.stories.tsx")
        ) {
          const run = (code) => win.webContents.executeJavaScript(code)
          await delay(100)
          assert.ok(
            await run(
              `document.querySelector('#storybook-root h1').innerText.includes('11월 13일')`
            ),
            `event search opens the requested date: ${await run("document.body.innerText.slice(0, 2000)")}`
          )
          assert.equal(
            await run(
              `[...document.querySelectorAll('[aria-label="캘린더 보기"] button')].find(b=>b.innerText==='일간 목록').getAttribute('aria-pressed')`
            ),
            "true"
          )
          await run(`document.querySelector('#storybook-root button').click()`)
          await delay(100)
          assert.ok(
            await run(
              `document.querySelector('#storybook-root h1').innerText.includes('10월 30일')`
            ),
            "today command changes an already visited calendar"
          )
          console.log(
            "PASS launcher calendar date navigation and repeat requests"
          )
        }
        if (
          theme === "light" &&
          story.importPath.endsWith("/quick-command.stories.tsx") &&
          ["Shortcut Separation", "Alternate Shortcut"].includes(story.name)
        ) {
          const run = (code) => win.webContents.executeJavaScript(code)
          const key = async (shiftKey = false, altKey = false) => {
            await run(
              `window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',code:'KeyK',ctrlKey:true,shiftKey:${shiftKey},altKey:${altKey},bubbles:true,cancelable:true}))`
            )
            await delay(70)
          }
          const searchOpen = () =>
            run(`!!document.querySelector('[role=combobox]')`)
          const aiOpen = () =>
            run(`!!document.querySelector('[aria-label="AI에게 요청할 내용"]')`)
          if (story.name === "Alternate Shortcut") {
            await key()
            assert.equal(
              await searchOpen(),
              false,
              "default shortcut is disabled after customization"
            )
            await key(true)
            assert.equal(
              await searchOpen(),
              false,
              "AI key must never open search"
            )
            await key(false, true)
            assert.equal(
              await searchOpen(),
              true,
              "custom shortcut opens search"
            )
          } else {
            await key()
            assert.equal(await searchOpen(), true)
            assert.equal(await aiOpen(), false)
            await key(true)
            assert.equal(
              await aiOpen(),
              false,
              "another open modal has priority"
            )
            await key()
            assert.equal(await searchOpen(), false)
            await key(true)
            assert.equal(await aiOpen(), true)
            assert.equal(await searchOpen(), false)
            await key()
            assert.equal(
              await searchOpen(),
              false,
              "search cannot cover AI input"
            )
            await key(true)
            assert.equal(await aiOpen(), false)
          }
          console.log(`PASS ${story.name}: search and AI shortcut separation`)
        }
        if (
          theme === "light" &&
          story.importPath.endsWith("/quick-command.stories.tsx") &&
          story.name === "Local Actions"
        ) {
          const run = (code) => win.webContents.executeJavaScript(code)
          const fill = async (value) => {
            await run(`(() => {
              const input=document.querySelector('[role=combobox]');
              Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});
              input.dispatchEvent(new Event('input',{bubbles:true})); input.focus();
            })()`)
            await delay(50)
          }
          await fill("없는 프로그램")
          await run(`document.querySelector('form').requestSubmit()`)
          await delay(50)
          assert.equal(
            await run(`!!document.querySelector('[role=dialog][data-open]')`),
            true,
            "simple missing search must not call AI"
          )
          await fill("VS Code 실행")
          assert.equal(
            await run(
              `document.querySelector('[role=combobox]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true}))`
            ),
            false,
            "IME Enter is prevented"
          )
          for (const [query, message] of [
            ["VS Code 실행", "VS Code 열기 요청"],
            ["VS Code 실행해줘", "VS Code 열기 요청"],
            ["할일 보고서 완료", "보고서 작성 완료"],
            ["보고서 완료해줘", "보고서 작성 완료"],
            ["메모 팀 회의 검색", "메모를 열었습니다"],
            ["일정 팀 회의", "일정을 열었습니다"],
            ["설정", "설정을 열었습니다"],
          ]) {
            if (
              !(await run(
                `!!document.querySelector('[role=dialog][data-open]')`
              ))
            ) {
              await run(
                `document.querySelector('#storybook-root button').click()`
              )
              await delay(70)
            }
            await fill(query)
            win.webContents.sendInputEvent({
              type: "keyDown",
              keyCode: "Down",
            })
            win.webContents.sendInputEvent({
              type: "keyUp",
              keyCode: "Down",
            })
            await delay(30)
            assert.ok(
              await run(
                `!!document.getElementById(document.querySelector('[role=combobox]').getAttribute('aria-activedescendant')) && !document.querySelector('[role=listbox]').innerText.includes('AI에게 요청')`
              ),
              `${query}: keyboard selection references a local result`
            )
            win.webContents.sendInputEvent({
              type: "keyDown",
              keyCode: "Up",
            })
            win.webContents.sendInputEvent({
              type: "keyUp",
              keyCode: "Up",
            })
            await delay(30)
            win.webContents.sendInputEvent({
              type: "keyDown",
              keyCode: "Enter",
            })
            win.webContents.sendInputEvent({ type: "char", keyCode: "\r" })
            win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Enter" })
            await delay(100)
            assert.ok(
              await run(
                `document.body.innerText.includes(${JSON.stringify(message)})`
              ),
              query
            )
            assert.equal(
              await run(
                `!!document.querySelector('[aria-label="AI 작업 상태"]')`
              ),
              false,
              "local actions never call AI"
            )
          }
          console.log("PASS launcher search, keyboard, IME and local routing")
        }
        if (
          theme === "light" &&
          story.importPath.endsWith("/ai-quick-command.stories.tsx")
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
            Empty: "완료",
            Loading: "완료",
            "Unavailable Source": "완료",
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
