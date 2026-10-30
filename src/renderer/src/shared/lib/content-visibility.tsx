/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from "react"

// The app supplies opaque content keys. Shared UI does not know domains or IPC.
const VisibilityContext = createContext<{
  allows: (key: string) => boolean
  scope: string
}>({
  allows: () => true,
  scope: "default",
})
export function ContentVisibilityProvider({
  allows,
  scope,
  children,
}: {
  allows: (key: string) => boolean
  scope: string
  children: ReactNode
}) {
  return (
    <VisibilityContext.Provider value={{ allows, scope }}>
      {children}
    </VisibilityContext.Provider>
  )
}
export const useContentVisibility = () => useContext(VisibilityContext)

// Keep the mounted editor and its unsaved draft while removing it from interaction.
export function ContentVisibility({
  contentKey,
  children,
  fallback,
  visible: providedVisible,
}: {
  contentKey: string
  children: ReactNode
  fallback?: ReactNode
  visible?: boolean
}) {
  const { allows } = useContentVisibility()
  const visible = providedVisible ?? allows(contentKey)
  return (
    <>
      {!visible && fallback}
      <div
        hidden={!visible}
        inert={!visible}
        className={visible ? "contents" : "hidden"}
      >
        {children}
      </div>
    </>
  )
}
