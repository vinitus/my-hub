import { useEffect, useState } from "react"
import { FolderIcon, GlobeIcon, MonitorIcon, FileIcon } from "lucide-react"
import type { Shortcut } from "../../../../../shared/shortcuts"

const fallback = {
  program: MonitorIcon,
  folder: FolderIcon,
  website: GlobeIcon,
  file: FileIcon,
}

export function ShortcutIcon({
  item,
  revision,
}: {
  item: Shortcut
  revision: string
}) {
  const [image, setImage] = useState<{ source: string; key: string } | null>(
    null
  )
  const key = `${item.id}:${item.target}:${revision}`
  useEffect(() => {
    let cancelled = false
    const api = window.api?.shortcuts
    if (typeof api?.icon !== "function") return
    void api
      .icon({ id: item.id, expectedRevision: revision })
      .then((source) => {
        if (!cancelled) setImage(source ? { source, key } : null)
      })
      .catch(() => {
        if (!cancelled) setImage(null)
      })
    return () => {
      cancelled = true
    }
  }, [item.id, key, revision])
  const Icon = fallback[item.kind]
  return image?.key === key ? (
    <img
      src={image.source}
      alt=""
      aria-hidden="true"
      className="size-8 object-contain"
      draggable={false}
      onError={() => setImage(null)}
    />
  ) : (
    <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
  )
}
