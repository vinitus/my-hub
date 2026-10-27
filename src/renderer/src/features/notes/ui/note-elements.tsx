import { PlateElement, type PlateElementProps } from "platejs/react"

export function Paragraph(props: PlateElementProps) {
  const task = typeof props.element.checked === "boolean"
  return (
    <PlateElement
      {...props}
      as="div"
      data-task={task || undefined}
      className="note-paragraph"
    >
      {task && (
        <span contentEditable={false} className="mr-2 inline-flex select-none">
          <input
            type="checkbox"
            aria-label="할 일 완료"
            checked={Boolean(props.element.checked)}
            onMouseDown={(event) => event.preventDefault()}
            onChange={(event) =>
              props.editor.tf.setNodes(
                { checked: event.target.checked },
                { at: props.editor.api.findPath(props.element) }
              )
            }
          />
        </span>
      )}
      {props.children}
    </PlateElement>
  )
}

export function CodeBlock(props: PlateElementProps) {
  return (
    <PlateElement {...props} as="pre">
      <code>{props.children}</code>
    </PlateElement>
  )
}

export function HorizontalRule(props: PlateElementProps) {
  return (
    <PlateElement {...props} as="div">
      <div contentEditable={false}>
        <hr />
      </div>
      {props.children}
    </PlateElement>
  )
}

export function Link(props: PlateElementProps) {
  const url = typeof props.element.url === "string" ? props.element.url : ""
  // 편집 중에는 링크를 따라가지 않는다. 외부 링크는 명시적인 Ctrl/Cmd+클릭만 허용한다.
  const safe = /^(https?:|mailto:)/i.test(url)
  return (
    <PlateElement {...props} as="span">
      <a
        href={safe ? url : undefined}
        title={url}
        onClick={(event) => {
          event.preventDefault()
          if (safe && (event.ctrlKey || event.metaKey))
            window.open(url, "_blank", "noopener,noreferrer")
        }}
      >
        {props.children}
      </a>
    </PlateElement>
  )
}
