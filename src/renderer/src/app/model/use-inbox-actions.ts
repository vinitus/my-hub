import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { InboxStore } from "@/features/inbox"
import { newCalendarEvent } from "@/entities/calendar-event"
import { hasOpenDialog } from "@/shared/lib/has-open-dialog"
import {
  inboxTitle,
  type InboxItem,
  type InboxDestination,
} from "../../../../shared/inbox"
import type { HomeCreateSeed, HomeCreateSession } from "./use-home-create"
import type { ShortcutsAPI } from "../../../../shared/shortcuts"

export function useInboxActions({
  store,
  inspectShortcut,
  openCreation,
  saveNote,
  noteBusy,
  prepareDestination,
  createEvent = newCalendarEvent,
}: {
  store: InboxStore
  inspectShortcut?: ShortcutsAPI["inspectDrop"]
  openCreation: (kind: HomeCreateSession["kind"], seed?: HomeCreateSeed) => void
  saveNote: (
    markdown: string,
    sourceKey?: string
  ) => Promise<{ saved: boolean; name: string } | undefined>
  noteBusy: boolean
  prepareDestination?: (sourceKey: string, targetKey: string) => Promise<void>
  createEvent?: typeof newCalendarEvent
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [converting, setConverting] = useState(false)
  const conversionLock = useRef(false)
  async function openDestination(
    item: InboxItem,
    kind: HomeCreateSession["kind"],
    seed: HomeCreateSeed
  ) {
    const id = seed.todo?.id ?? seed.event?.id ?? seed.item?.id
    if (!id) return
    setConverting(true)
    try {
      await prepareDestination?.(`inbox:${item.id}`, `${kind}:${id}`)
      openCreation(kind, seed)
    } catch (error) {
      store.report(
        error instanceof Error
          ? error.message
          : "개인 항목 설정을 유지하지 못했습니다. 다시 시도해 주세요."
      )
    } finally {
      setConverting(false)
    }
  }
  useEffect(() => {
    void store.initialize()
  }, [store])
  async function finish(
    item: InboxItem,
    kind: InboxDestination["kind"],
    title: string
  ) {
    const saved = await store.process(item.id, true, { kind, title })
    if (!saved)
      store.report(
        "대상 항목은 저장했습니다. 인박스 상태를 갱신하지 못했으니 새로고침 후 처리 완료로 표시해 주세요."
      )
  }
  async function convertItem(item: InboxItem, kind: InboxDestination["kind"]) {
    if (
      converting ||
      state.busy ||
      state.loading ||
      item.processedAt ||
      hasOpenDialog()
    )
      return
    const current = store
      .getSnapshot()
      .snapshot?.items.find((entry) => entry.id === item.id)
    if (!current || current.processedAt) return
    const title = inboxTitle(item)
    if (kind === "note") {
      if (noteBusy) {
        store.report("메모 저장이 끝난 후 다시 시도해 주세요.")
        return
      }
      setConverting(true)
      try {
        const result = await saveNote(
          `${item.content}\n\n---\n출처: ${item.source}\n수집 시각: ${item.createdAt}\n`,
          `inbox:${item.id}`
        )
        if (result?.saved) await finish(item, kind, result.name)
        else
          store.report(
            "메모를 저장하지 못했습니다. 메모 화면에서 저장 상태를 확인해 주세요. 인박스 원문은 유지됩니다."
          )
      } catch (error) {
        store.report(
          error instanceof Error ? error.message : "메모로 옮기지 못했습니다."
        )
      } finally {
        setConverting(false)
      }
      return
    }
    const onCreated = (name: string) => finish(item, kind, name)
    if (kind === "todo")
      await openDestination(item, "todo", {
        todo: {
          id: crypto.randomUUID(),
          title: title.slice(0, 200),
          completed: false,
        },
        onCreated,
      })
    if (kind === "event")
      await openDestination(item, "event", {
        event: {
          ...createEvent(),
          title: title.slice(0, 200),
          description:
            `${item.content}\n\n출처: ${item.source}\n수집 시각: ${item.createdAt}`.slice(
              0,
              10000
            ),
          referenceUrls:
            item.kind !== "text" && item.content.length <= 2048
              ? [item.content]
              : [],
        },
        onCreated,
      })
    if (kind === "shortcut") {
      const shortcut = {
        id: crypto.randomUUID(),
        name: title.slice(0, 80),
        kind: "website" as const,
        target: item.kind === "link" ? item.content : "",
      }
      if (item.kind === "file") {
        setConverting(true)
        try {
          if (!inspectShortcut)
            throw new Error("바로가기 연결을 위해 앱을 다시 시작해 주세요.")
          const inspected = await inspectShortcut({
            kind: "path",
            target: item.content,
          })
          await openDestination(item, "shortcut", {
            item: inspected,
            onCreated,
          })
        } catch (error) {
          store.report(
            error instanceof Error
              ? error.message
              : "파일을 확인하지 못했습니다."
          )
        } finally {
          setConverting(false)
        }
      } else {
        await openDestination(item, "shortcut", { item: shortcut, onCreated })
      }
    }
  }
  const busy = state.busy || state.loading || converting
  async function convert(item: InboxItem, kind: InboxDestination["kind"]) {
    if (conversionLock.current) return
    conversionLock.current = true
    try {
      await convertItem(item, kind)
    } finally {
      conversionLock.current = false
    }
  }
  return {
    viewProps: {
      items: state.snapshot?.items ?? [],
      loading: state.loading,
      busy,
      error: state.error,
      notice: state.notice,
      onCapture: store.captureText,
      onFiles: store.captureFiles,
      onChooseFiles: store.chooseFiles,
      onRefresh: () => void store.refresh(),
      onOpen: (id: string) => void store.open(id),
      onProcess: (id: string, processed: boolean) =>
        void store.process(id, processed),
      onRemove: store.remove,
      onConvert: (item: InboxItem, kind: InboxDestination["kind"]) => {
        void convert(item, kind)
      },
    },
  }
}
