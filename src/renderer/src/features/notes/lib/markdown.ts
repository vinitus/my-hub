import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"

const parser = unified().use(remarkParse).use(remarkGfm)
const supported = new Set([
  "root",
  "paragraph",
  "heading",
  "text",
  "strong",
  "emphasis",
  "delete",
  "inlineCode",
  "code",
  "blockquote",
  "list",
  "listItem",
  "thematicBreak",
  "link",
  "linkReference",
  "definition",
  "break",
])

// 표·이미지·HTML 등이 변환 중 사라지지 않도록 열기/붙여넣기 전에 검사한다.
export function assertSupportedMarkdown(markdown: string) {
  const tree = parser.parse(markdown)
  function visit(node: { type: string; children?: { type: string }[] }) {
    if (!supported.has(node.type)) {
      throw new Error(
        "표·이미지·HTML·각주가 포함된 문서는 아직 편집할 수 없습니다. 원본 파일은 변경하지 않았습니다."
      )
    }
    node.children?.forEach(visit)
  }
  visit(tree)
}
