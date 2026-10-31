/* global window, document */
const assert = require("node:assert/strict")

// Executed inside the existing bridge-free Storybook browser. The fake clock is
// installed before mounting and restored even if an assertion fails.
async function clockScenario(mode, expectReplay) {
  const original = {
    now: Date.now,
    interval: window.setInterval,
    clear: window.clearInterval,
    add: window.addEventListener,
    remove: window.removeEventListener,
  }
  const timers = new Map()
  const listeners = new Set()
  let created = 0
  let time = 1793145600000
  const check = (ok, message) => {
    if (!ok) throw new Error(message)
  }
  const settle = () => new Promise((resolve) => window.setTimeout(resolve, 20))
  const click = async (label) => {
    const button = [...document.querySelectorAll("button")].find(
      (item) => item.textContent === label
    )
    check(button, `Missing ${label}`)
    button.click()
    await settle()
  }
  const calls = async () => {
    await click("Read calls")
    return JSON.parse(
      document.querySelector('[data-testid="clock-calls"]').textContent
    )
  }
  const clocks = () =>
    [...document.querySelectorAll('[data-testid="clock-now"]')].map((item) =>
      Number(item.textContent)
    )
  const equal = (a, b, message) =>
    check(
      JSON.stringify(a) === JSON.stringify(b),
      `${message}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`
    )
  const refresh = (prefix) =>
    mode === "single"
      ? [`${prefix}:calendar:refresh`]
      : [
          `${prefix}:calendar:refresh`,
          `${prefix}:shortcut:refresh`,
          `${prefix}:todo:refresh`,
          ...(mode === "both" ? [`${prefix}:calendar:refresh`] : []),
        ]
  const instances = mode === "both" ? 2 : 1
  Date.now = () => time
  window.setInterval = (callback, ms, ...args) => {
    if (ms !== 1000)
      return original.interval.call(window, callback, ms, ...args)
    const id = -++created
    timers.set(id, () => callback(...args))
    return id
  }
  window.clearInterval = (id) => {
    if (!timers.delete(id)) original.clear.call(window, id)
  }
  window.addEventListener = function (type, listener, options) {
    if (type === "focus") listeners.add(listener)
    return original.add.call(this, type, listener, options)
  }
  window.removeEventListener = function (type, listener, options) {
    if (type === "focus") listeners.delete(listener)
    return original.remove.call(this, type, listener, options)
  }
  try {
    await click("Mount clocks")
    equal(clocks(), Array(instances).fill(time), "Initial clock")
    check(
      timers.size === instances && listeners.size === instances,
      "One timer/listener per instance"
    )
    const initial = await calls()
    const expectedInit = refresh("a").map((call) =>
      call.replace(":refresh", ":initialize")
    )
    // React dev StrictMode replays setup; production builds do not. Neither may
    // leave duplicate resources. Both must preserve per-round store ordering.
    check(
      initial.length === expectedInit.length * (expectReplay ? 2 : 1),
      "Initialization count"
    )
    equal(
      initial,
      Array.from(
        { length: initial.length / expectedInit.length },
        () => expectedInit
      ).flat(),
      "Initialization ordering"
    )
    time += 1000
    timers.forEach((tick) => tick())
    await settle()
    equal(clocks(), Array(instances).fill(time), "One-second clock tick")
    equal(await calls(), initial, "Tick must not refresh stores")
    time += 500
    window.dispatchEvent(new window.Event("focus"))
    await settle()
    equal(clocks(), Array(instances).fill(time), "Focus updates clock")
    equal(
      await calls(),
      [...initial, ...refresh("a")],
      "Focus refresh ordering/count"
    )
    const beforeRerender = created
    const beforeCalls = await calls()
    await click("Rerender clocks")
    equal(await calls(), beforeCalls, "Rerender must not initialize")
    check(created === beforeRerender, "Rerender must not restart timer")
    await click("Replace stores")
    check(
      timers.size === instances && listeners.size === instances,
      "Replacement cleans old resources"
    )
    const afterReplacement = await calls()
    equal(
      afterReplacement.slice(beforeCalls.length),
      expectedInit.map((call) => call.replace("a:", "b:")),
      "Replacement initializes in order"
    )
    window.dispatchEvent(new window.Event("focus"))
    await settle()
    equal(
      await calls(),
      [...afterReplacement, ...refresh("b")],
      "Only replacement stores refresh"
    )
    if (mode !== "single") {
      await click("Toggle extra stores")
      const withoutExtras = await calls()
      window.dispatchEvent(new window.Event("focus"))
      await settle()
      equal(
        (await calls()).slice(withoutExtras.length),
        Array(instances).fill("b:calendar:refresh"),
        "Removed optional stores stay detached"
      )
      await click("Toggle extra stores")
      const restored = await calls()
      window.dispatchEvent(new window.Event("focus"))
      await settle()
      equal(
        (await calls()).slice(restored.length),
        // Only the panel effect restarts; the sibling listener stays first.
        mode === "both"
          ? ["b:calendar:refresh", ...refresh("b").slice(0, 3)]
          : refresh("b"),
        "Restored optional stores refresh"
      )
    }
    const beforeUnmount = await calls()
    await click("Unmount clocks")
    check(
      timers.size === 0 && listeners.size === 0,
      "Unmount releases timers and focus listeners"
    )
    window.dispatchEvent(new window.Event("focus"))
    equal(await calls(), beforeUnmount, "Unmounted stores stay detached")
    await click("Mount clocks")
    check(
      timers.size === instances && listeners.size === instances,
      "Remount does not accumulate resources"
    )
    const remounted = await calls()
    window.dispatchEvent(new window.Event("focus"))
    await settle()
    equal(
      (await calls()).slice(remounted.length),
      refresh("b"),
      "Remount refresh count"
    )
    await click("Unmount clocks")
    check(timers.size === 0 && listeners.size === 0, "Final cleanup")
    return true
  } finally {
    Date.now = original.now
    window.setInterval = original.interval
    window.clearInterval = original.clear
    window.addEventListener = original.add
    window.removeEventListener = original.remove
  }
}

module.exports = async (win, story) => {
  const mode = {
    "Single Clock": "single",
    "Panel Clock": "panel",
    "Simultaneous Clocks": "both",
  }[story.name]
  if (mode) {
    assert.equal(
      await win.webContents.executeJavaScript(
        `(${clockScenario.toString()})(${JSON.stringify(mode)}, ${process.env.STORYBOOK_TEST_EXPECT_EFFECT_REPLAY === "1"})`
      ),
      true
    )
    console.log(`PASS live-status lifecycle: ${mode}`)
  } else {
    const text = await win.webContents.executeJavaScript(
      "document.body.innerText"
    )
    const expected = {
      Ready: ["예정된 일정 없음", "남은 할일이 없습니다."],
      Loading: ["일정 불러오는 중", "할일 불러오는 중", "바로가기 불러오는 중"],
      Error: ["일정을 불러오지 못했습니다.", "고정된 조회 오류"],
    }[story.name]
    assert.ok(expected, `Unexpected live-status story: ${story.name}`)
    for (const message of expected)
      assert.ok(text.includes(message), `${story.name}: missing ${message}`)
  }
}
