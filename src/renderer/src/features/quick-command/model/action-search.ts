export type LauncherAction = {
  id: string
  kind: "note" | "event" | "todo" | "shortcut" | "command"
  title: string
  description: string
  keywords?: string
  label: string
  disabled?: boolean
  execute: () => void | string | Promise<void | string>
}

export const ACTION_LABELS = {
  note: "메모",
  event: "일정",
  todo: "할일",
  shortcut: "바로가기",
  command: "명령",
}

const scopes: Record<string, LauncherAction["kind"]> = {
  메모: "note",
  일정: "event",
  캘린더: "event",
  할일: "todo",
  프로그램: "shortcut",
  바로가기: "shortcut",
  명령: "command",
}
const normalize = (text: string) =>
  text.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, "")

const initials = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
const initialPattern = /^[ㄱ-ㅎ]{2,}$/

function toInitials(text: string) {
  return Array.from(text, (character) => {
    const syllable = character.charCodeAt(0) - 0xac00
    return syllable >= 0 && syllable < 11172
      ? initials[Math.floor(syllable / 588)]
      : character
  }).join("")
}

function isSubsequence(needle: string, candidate: string) {
  let position = 0
  for (const character of candidate) {
    if (character === needle[position]) position += 1
    if (position === needle.length) return true
  }
  return false
}

function isNearTypo(needle: string, candidate: string) {
  if (needle.length < 3 || needle.length > 32 || candidate.length > 64)
    return false
  const limit = needle.length >= 5 ? 2 : 1
  if (Math.abs(needle.length - candidate.length) > limit) return false
  let previous = Array.from({ length: candidate.length + 1 }, (_, i) => i)
  for (let row = 1; row <= needle.length; row += 1) {
    const current = [row]
    for (let column = 1; column <= candidate.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] +
          (needle[row - 1] === candidate[column - 1] ? 0 : 1)
      )
    }
    previous = current
  }
  return previous[candidate.length] <= limit
}

function fuzzyTokenScore(needle: string, text: string) {
  if (!needle || needle.length > 32) return 0
  const candidates = text
    .toLocaleLowerCase()
    .split(/[\s\p{P}\p{S}]+/u)
    .map(normalize)
    .filter(Boolean)
  const compact = normalize(text)
  if (compact) candidates.push(compact)

  if (initialPattern.test(needle))
    for (const candidate of candidates) {
      if (toInitials(candidate).includes(needle)) return 4
    }
  for (const candidate of candidates) {
    if (isNearTypo(needle, candidate)) return 3
  }
  if (needle.length >= 3)
    for (const candidate of candidates) {
      if (
        candidate.startsWith(needle[0]) &&
        candidate.length <= needle.length * 2 &&
        isSubsequence(needle, candidate)
      )
        return 2
    }
  return 0
}

function fuzzyActionScore(
  tokens: string[],
  action: LauncherAction,
  title: string,
  haystack: string
) {
  if (!tokens.length || tokens.length > 8) return 0
  const scores = tokens.map((token) => {
    if (haystack.includes(token)) return 50
    const titleScore = fuzzyTokenScore(token, action.title)
    const detailScore = fuzzyTokenScore(
      token,
      `${action.description} ${action.keywords ?? ""}`
    )
    return Math.max(
      titleScore * 10 + (titleScore && title.length === token.length ? 1 : 0),
      detailScore * 10
    )
  })
  return Math.min(...scores)
}

// 짧고 명시적인 검색/실행 구문만 해석한다. AI 요청은 별도 입력창에서 처리한다.
export function searchActions(actions: LauncherAction[], input: string) {
  const words = input.trim().split(/\s+/).filter(Boolean)
  const explicitScope = Object.hasOwn(scopes, words[0])
    ? scopes[words[0]]
    : undefined
  const scope =
    explicitScope ??
    (/^완료(?:하기|해줘|해주세요)?$/.test(words.at(-1) ?? "")
      ? "todo"
      : undefined)
  const query = (explicitScope ? words.slice(1) : words)
    .filter(
      (word) =>
        !/^(?:(?:검색|실행|완료)(?:하기|해줘|해주세요)?|찾기|열기|찾아줘|열어줘|찾아주세요|열어주세요)$/.test(
          word
        )
    )
    .join(" ")
  const needle = normalize(query)
  const fullQuery = normalize(input)
  const tokens = query.split(/\s+/).map(normalize).filter(Boolean)
  return actions
    .filter(
      (action) =>
        !scope ||
        action.kind === scope ||
        (action.kind === "command" &&
          normalize(action.title).includes(fullQuery))
    )
    .map((action, index) => {
      const title = normalize(action.title)
      const searchable = `${action.title} ${action.description} ${action.keywords ?? ""}`
      const haystack = normalize(searchable)
      const score =
        fullQuery && title === fullQuery
          ? 500
          : !needle
            ? 100
            : title === needle
              ? 400
              : title.startsWith(needle)
                ? 300
                : haystack.includes(needle)
                  ? 200
                  : tokens.every((word) => haystack.includes(word))
                    ? 100
                    : fuzzyActionScore(tokens, action, title, haystack)
      return { action, score, index }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ action }) => action)
}
