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
      const haystack = normalize(
        `${action.title} ${action.description} ${action.keywords ?? ""}`
      )
      const score =
        fullQuery && title === fullQuery
          ? 5
          : !needle
            ? 1
            : title === needle
              ? 4
              : title.startsWith(needle)
                ? 3
                : haystack.includes(needle)
                  ? 2
                  : query
                        .split(/\s+/)
                        .every((word) => haystack.includes(normalize(word)))
                    ? 1
                    : 0
      return { action, score, index }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ action }) => action)
}
