import assert from "node:assert/strict"
import path from "node:path"
import test from "node:test"
import { Linter } from "eslint"
import tseslint from "typescript-eslint"
import fsd from "./eslint-fsd.mjs"

const cases = [
  [
    "app composes pages",
    "app/App.tsx",
    'import Notes from "@/pages/notes"',
    null,
  ],
  [
    "pages use feature public API",
    "pages/notes/ui/page.tsx",
    'import { NoteEditor } from "@renderer/features/notes"',
    null,
  ],
  [
    "same slice internal import",
    "features/notes/ui/editor.tsx",
    'import { store } from "../model/store"',
    null,
  ],
  [
    "shared segments can collaborate",
    "shared/ui/button.tsx",
    'import { cn } from "@/shared/lib/utils"',
    null,
  ],
  [
    "IPC contract stays outside renderer FSD",
    "features/notes/ui/editor.tsx",
    'import type { Note } from "../../../../../shared/notes"',
    null,
  ],
  ["bootstrap app public API", "main.tsx", 'import { App } from "./app"', null],
  ["bootstrap styles", "main.tsx", 'import "./app/styles/index.css"', null],
  [
    "explicit public re-export",
    "features/notes/index.ts",
    'export { NoteEditor } from "./ui/note-editor"',
    null,
  ],
  [
    "upward dependency",
    "features/notes/ui/editor.tsx",
    'import Notes from "@/pages/notes"',
    "direction",
  ],
  [
    "sibling slices",
    "features/notes/ui/editor.tsx",
    'import { EventSheet } from "@/features/calendar"',
    "sibling",
  ],
  [
    "widget sibling slices",
    "widgets/app-sidebar/ui/sidebar.tsx",
    'import { SiteHeader } from "@/widgets/site-header"',
    "sibling",
  ],
  [
    "deep alias import",
    "pages/notes/ui/page.tsx",
    'import { NoteEditor } from "@/features/notes/ui/note-editor"',
    "publicApi",
  ],
  [
    "deep relative import",
    "pages/notes/ui/page.tsx",
    'import { NoteEditor } from "../../../features/notes/ui/note-editor"',
    "publicApi",
  ],
  [
    "dynamic import boundary",
    "features/notes/ui/editor.tsx",
    'const page = import("@/pages/notes")',
    "direction",
  ],
  [
    "type import boundary",
    "features/notes/ui/editor.tsx",
    'type Page = import("@/pages/notes").Page',
    "direction",
  ],
  [
    "re-export boundary",
    "features/notes/index.ts",
    'export { Page } from "@/pages/notes"',
    "direction",
  ],
  [
    "wildcard public API",
    "features/notes/index.ts",
    'export * from "./ui/note-editor"',
    "wildcard",
  ],
  [
    "Node dependency",
    "features/notes/model/store.ts",
    'import fs from "node:fs"',
    "native",
  ],
  [
    "Electron dependency",
    "features/notes/model/store.ts",
    'import { ipcRenderer } from "electron"',
    "native",
  ],
  [
    "main implementation",
    "features/notes/model/store.ts",
    'import { save } from "../../../../../main/notes"',
    "native",
  ],
  [
    "preload implementation",
    "features/notes/model/store.ts",
    'import "../../../../../preload/index"',
    "native",
  ],
  [
    "shared IPC contract",
    "shared/lib/notes.ts",
    'import type { Note } from "../../../../shared/notes"',
    "shared",
  ],
  [
    "shared native bridge",
    "shared/ui/button.tsx",
    "window.api.notes.open()",
    "shared",
  ],
  [
    "shared computed native bridge",
    "shared/ui/button.tsx",
    'globalThis["api"].notes.open()',
    "shared",
  ],
  [
    "legacy folder",
    "components/button.tsx",
    "export const Button = 1",
    "structure",
  ],
  [
    "technical slice segment",
    "features/notes/hooks/use-note.ts",
    "export const useNote = 1",
    "structure",
  ],
  [
    "bootstrap bypass",
    "main.tsx",
    'import Notes from "./pages/notes"',
    "bootstrap",
  ],
]

for (const [name, filename, code, expected] of cases) {
  test(name, () => {
    const linter = new Linter()
    const messages = linter.verify(
      code,
      [
        {
          files: ["**/*.{ts,tsx}"],
          languageOptions: { parser: tseslint.parser },
          plugins: { fsd },
          rules: { "fsd/boundaries": "error" },
        },
      ],
      { filename: path.resolve("src/renderer/src", filename) }
    )
    assert.deepEqual(
      messages.map((message) => message.messageId),
      expected ? [expected] : [],
      JSON.stringify(messages)
    )
  })
}
