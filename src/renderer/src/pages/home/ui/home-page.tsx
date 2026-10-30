import { useScratchpad, type SaveScratchpad } from "../model/use-scratchpad"
import { HomePageView, type HomePageViewProps } from "./home-page-view"

type Props = Pick<
  HomePageViewProps,
  | "onCreateTodo"
  | "onCreateEvent"
  | "onCreateShortcut"
  | "onCreateInbox"
  | "inboxAction"
  | "recentInboxItems"
  | "inboxBusy"
  | "onOpenInbox"
> & {
  active: boolean
  onSave: SaveScratchpad
  hideSavedName?: boolean
}

export function HomePage({
  active,
  onSave,
  hideSavedName = false,
  ...actions
}: Props) {
  const scratchpad = useScratchpad(active, onSave)
  return (
    <HomePageView
      {...scratchpad}
      {...actions}
      saveState={
        hideSavedName && scratchpad.saveState.status === "saved"
          ? { status: "saved", name: "" }
          : scratchpad.saveState
      }
    />
  )
}
