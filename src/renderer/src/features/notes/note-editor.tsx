import { useRef, useState } from "react"
import { NodeApi } from "platejs"
import { MarkdownPlugin } from "@platejs/markdown"
import { toggleList } from "@platejs/list"
import { Plate, PlateContent, usePlateEditor } from "platejs/react"
import {
  BoldIcon,
  ItalicIcon,
  CodeIcon,
  Undo2Icon,
  Redo2Icon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { notePlugins } from "./editor-plugins"
import { assertSupportedMarkdown } from "./markdown"
import "./notes.css"

const blocks = [
  { type: "p", label: "텍스트", hint: "일반 문단" },
  { type: "h1", label: "제목 1", hint: "#" },
  { type: "h2", label: "제목 2", hint: "##" },
  { type: "h3", label: "제목 3", hint: "###" },
  { type: "disc", label: "글머리 목록", hint: "-" },
  { type: "decimal", label: "번호 목록", hint: "1." },
  { type: "todo", label: "체크리스트", hint: "- [ ]" },
  { type: "blockquote", label: "인용문", hint: ">" },
  { type: "code_block", label: "코드 블록", hint: "```" },
]

type Props = {
  markdown: string
  onChange: (markdown: string) => void
  onError: (error: unknown) => void
  disabled?: boolean
}

// 문서 교체는 부모의 key로 새 에디터를 만든다. 입력마다 역직렬화하면 커서/undo가 초기화된다.
export function NoteEditor({ markdown, onChange, onError, disabled }: Props) {
  const editor = usePlateEditor({
    plugins: notePlugins,
    value: (editor) =>
      editor.getApi(MarkdownPlugin).markdown.deserialize(markdown || "\n"),
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null)
  const [selected, setSelected] = useState(0)

  function changeBlock(type: string) {
    setMenu(null)
    if (!editor.selection) editor.tf.select(editor.api.end([]))
    if (["disc", "decimal", "todo"].includes(type)) {
      toggleList(editor, { listStyleType: type })
    } else if (type === "blockquote") editor.tf.blockquote.toggle()
    else if (type === "code_block") editor.tf.code_block.toggle()
    else {
      editor.tf.unsetNodes([
        "listStyleType",
        "indent",
        "checked",
        "listStart",
        "listRestart",
      ])
      editor.tf.setNodes(
        { type },
        { match: (node) => editor.api.isBlock(node) }
      )
    }
    editor.tf.focus()
  }

  return (
    <Plate
      editor={editor}
      onValueChange={() =>
        onChange(editor.getApi(MarkdownPlugin).markdown.serialize())
      }
    >
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b bg-background/95 px-4 py-2 backdrop-blur sm:px-8">
        <select
          aria-label="블록 형식"
          disabled={disabled}
          defaultValue=""
          className="h-8 max-w-32 rounded-md border bg-background px-2 text-sm"
          onChange={(event) => {
            changeBlock(event.target.value)
            event.target.value = ""
          }}
        >
          <option value="" disabled>
            블록 추가
          </option>
          {blocks.map((block) => (
            <option key={block.type} value={block.type}>
              {block.label}
            </option>
          ))}
        </select>
        {[
          {
            label: "굵게 (Ctrl/Cmd+B)",
            Icon: BoldIcon,
            action: () => editor.tf.bold.toggle(),
          },
          {
            label: "기울임 (Ctrl/Cmd+I)",
            Icon: ItalicIcon,
            action: () => editor.tf.italic.toggle(),
          },
          {
            label: "인라인 코드",
            Icon: CodeIcon,
            action: () => editor.tf.code.toggle(),
          },
          { label: "실행 취소", Icon: Undo2Icon, action: () => editor.undo() },
          { label: "다시 실행", Icon: Redo2Icon, action: () => editor.redo() },
        ].map(({ label, Icon, action }) => (
          <Button
            key={label}
            variant="ghost"
            size="icon-sm"
            title={label}
            aria-label={label}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              action()
              editor.tf.focus()
            }}
          >
            <Icon />
          </Button>
        ))}
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
          빈 문단에서 / 로 블록 추가
        </span>
      </div>
      <div
        ref={containerRef}
        className="relative mx-auto w-full max-w-3xl px-6 py-10 sm:px-12"
      >
        <PlateContent
          aria-label="메모 본문"
          className="note-editor min-h-[50vh] outline-none"
          placeholder="메모를 작성하세요. / 로 블록을 추가할 수 있어요."
          readOnly={disabled}
          onBlur={() => setMenu(null)}
          onPaste={(event) => {
            event.preventDefault()
            try {
              const text = event.clipboardData.getData("text/plain")
              if (editor.api.some({ match: { type: "code_block" } })) {
                editor.tf.insertText(text)
                return
              }
              assertSupportedMarkdown(text)
              editor.tf.insertFragment(
                editor.getApi(MarkdownPlugin).markdown.deserialize(text)
              )
            } catch (error) {
              onError(error)
            }
          }}
          onDrop={(event) => {
            event.preventDefault()
            onError(
              new Error(
                "파일 드롭은 지원하지 않습니다. Markdown 파일은 열기 버튼을 사용해 주세요."
              )
            )
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return
            if (menu) {
              if (event.key === "Escape") {
                event.preventDefault()
                setMenu(null)
              } else if (["ArrowDown", "ArrowUp"].includes(event.key)) {
                event.preventDefault()
                setSelected(
                  (index) =>
                    (index +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      blocks.length) %
                    blocks.length
                )
              } else if (event.key === "Enter") {
                event.preventDefault()
                changeBlock(blocks[selected].type)
              } else setMenu(null)
              return
            }
            const block = editor.api.block()
            if (
              event.key === "/" &&
              block &&
              block[0].type === "p" &&
              !NodeApi.string(block[0]) &&
              editor.api.isCollapsed()
            ) {
              event.preventDefault()
              const range = window.getSelection()?.getRangeAt(0)
              const rect = range?.getBoundingClientRect()
              const parent = containerRef.current?.getBoundingClientRect()
              setSelected(0)
              setMenu({
                top: rect && parent ? rect.bottom - parent.top + 8 : 60,
                left: 24,
              })
            }
          }}
        />
        {menu && (
          <div
            role="listbox"
            aria-label="삽입할 블록"
            className="absolute z-20 w-60 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
            style={menu}
          >
            {blocks.map((block, index) => (
              <button
                key={block.type}
                role="option"
                aria-selected={selected === index}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm ${selected === index ? "bg-accent" : "hover:bg-accent"}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => changeBlock(block.type)}
              >
                {block.label}
                <span className="font-mono text-xs text-muted-foreground">
                  {block.hint}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Plate>
  )
}
