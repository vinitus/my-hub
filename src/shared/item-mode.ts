import { z } from "zod"

export const ITEM_KIND_LABELS = {
  note: "메모",
  inbox: "인박스",
  todo: "할일",
  event: "일정",
  shortcut: "바로가기",
} as const
export type ItemKind = keyof typeof ITEM_KIND_LABELS
export type ModeItem = { key: string; kind: ItemKind; title: string }

export function modeItemKey(kind: ItemKind, id: string) {
  return `${kind}:${kind === "note" ? id.replace(/\\/g, "/").toLowerCase() : id}`
}

export const ModeItemKeySchema = z
  .string()
  .min(1)
  .max(4096)
  .regex(/^(note|inbox|todo|event|shortcut):.+$/)
export const PersonalItemKeysSchema = z
  .array(ModeItemKeySchema)
  .max(5000)
  .refine(
    (keys) => new Set(keys).size === keys.length,
    "개인 항목은 중복 지정할 수 없습니다."
  )

export function itemVisibility(
  settings: { modeEnabled: boolean; personalItemKeys: readonly string[] },
  personal: boolean
) {
  const hidden = new Set(
    settings.modeEnabled && !personal ? settings.personalItemKeys : []
  )
  return (key: string) => !hidden.has(key)
}

// 숨긴 항목의 위치를 유지하면서 보이는 바로가기만 재정렬한다.
export function mergeVisibleOrder(
  allIds: readonly string[],
  orderedVisibleIds: readonly string[]
) {
  const visible = new Set(orderedVisibleIds)
  let index = 0
  return allIds.map((id) =>
    visible.has(id) ? orderedVisibleIds[index++]! : id
  )
}
