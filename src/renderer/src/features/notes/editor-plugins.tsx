import {
  BlockquotePlugin,
  BoldPlugin,
  CodePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  H4Plugin,
  H5Plugin,
  H6Plugin,
  HorizontalRulePlugin,
  ItalicPlugin,
  StrikethroughPlugin,
} from "@platejs/basic-nodes/react"
import {
  BlockquoteRules,
  BoldRules,
  CodeRules,
  HeadingRules,
  HorizontalRuleRules,
  ItalicRules,
  StrikethroughRules,
} from "@platejs/basic-nodes"
import { CodeBlockPlugin, CodeLinePlugin } from "@platejs/code-block/react"
import { CodeBlockRules } from "@platejs/code-block"
import { IndentPlugin } from "@platejs/indent/react"
import { LinkPlugin } from "@platejs/link/react"
import { LinkRules } from "@platejs/link"
import { ListPlugin } from "@platejs/list/react"
import {
  BulletedListRules,
  OrderedListRules,
  TaskListRules,
} from "@platejs/list"
import { MarkdownPlugin } from "@platejs/markdown"
import { PlateElement, PlateLeaf, ParagraphPlugin } from "platejs/react"
import remarkGfm from "remark-gfm"
import { Paragraph, CodeBlock, HorizontalRule, Link } from "./note-elements"

// Markdown으로 표현할 수 있는 노드만 등록한다. 색상·임베드·밑줄·임의 HTML은 지원하지 않는다.
export const notePlugins = [
  ParagraphPlugin.withComponent(Paragraph),
  H1Plugin.configure({ inputRules: [HeadingRules.markdown()] }).withComponent(
    (props) => <PlateElement {...props} as="h1" />
  ),
  H2Plugin.configure({ inputRules: [HeadingRules.markdown()] }).withComponent(
    (props) => <PlateElement {...props} as="h2" />
  ),
  H3Plugin.configure({ inputRules: [HeadingRules.markdown()] }).withComponent(
    (props) => <PlateElement {...props} as="h3" />
  ),
  H4Plugin.configure({ inputRules: [HeadingRules.markdown()] }).withComponent(
    (props) => <PlateElement {...props} as="h4" />
  ),
  H5Plugin.configure({ inputRules: [HeadingRules.markdown()] }).withComponent(
    (props) => <PlateElement {...props} as="h5" />
  ),
  H6Plugin.configure({ inputRules: [HeadingRules.markdown()] }).withComponent(
    (props) => <PlateElement {...props} as="h6" />
  ),
  BoldPlugin.configure({ inputRules: [BoldRules.markdown()] }).withComponent(
    (props) => <PlateLeaf {...props} as="strong" />
  ),
  ItalicPlugin.configure({
    inputRules: [ItalicRules.markdown()],
  }).withComponent((props) => <PlateLeaf {...props} as="em" />),
  CodePlugin.configure({ inputRules: [CodeRules.markdown()] }).withComponent(
    (props) => <PlateLeaf {...props} as="code" />
  ),
  StrikethroughPlugin.configure({
    inputRules: [StrikethroughRules.markdown()],
  }).withComponent((props) => <PlateLeaf {...props} as="s" />),
  BlockquotePlugin.configure({
    inputRules: [BlockquoteRules.markdown()],
  }).withComponent((props) => <PlateElement {...props} as="blockquote" />),
  HorizontalRulePlugin.configure({
    inputRules: [HorizontalRuleRules.markdown()],
  }).withComponent(HorizontalRule),
  CodeBlockPlugin.configure({
    inputRules: [CodeBlockRules.markdown({ on: "break" })],
  }).withComponent(CodeBlock),
  CodeLinePlugin.withComponent((props) => <PlateElement {...props} as="div" />),
  IndentPlugin.configure({
    inject: { targetPlugins: ["p", "h1", "h2", "h3", "h4", "h5", "h6"] },
  }),
  ListPlugin.configure({
    inputRules: [
      BulletedListRules.markdown({ variant: "-" }),
      BulletedListRules.markdown({ variant: "*" }),
      OrderedListRules.markdown({ variant: "." }),
      TaskListRules.markdown({ checked: false }),
      TaskListRules.markdown({ checked: true }),
    ],
  }),
  LinkPlugin.configure({
    inputRules: [
      LinkRules.markdown(),
      LinkRules.autolink({ variant: "paste" }),
      LinkRules.autolink({ variant: "space" }),
    ],
  }).withComponent(Link),
  MarkdownPlugin.configure({
    options: {
      remarkPlugins: [remarkGfm],
      remarkStringifyOptions: { bullet: "-", fences: true },
    },
  }),
]
