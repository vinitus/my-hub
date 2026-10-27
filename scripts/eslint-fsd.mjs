import path from "node:path"
import { isBuiltin } from "node:module"
import { fileURLToPath } from "node:url"

const rendererRoot = fileURLToPath(
  new URL("../src/renderer/src", import.meta.url)
)
const sourceRoot = path.resolve(rendererRoot, "../..")
const layers = ["app", "pages", "widgets", "features", "entities", "shared"]
const segments = new Set(["ui", "model", "api", "lib", "config", "assets"])

function location(filename) {
  const relative = path.relative(rendererRoot, filename)
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null
  const parts = relative.split(path.sep)
  const layer = parts[0]
  return {
    layer,
    slice: layer === "app" || layer === "shared" ? null : parts[1],
    parts,
    rank: layers.indexOf(layer),
  }
}

function localTarget(filename, specifier) {
  if (specifier.startsWith("@/"))
    return path.resolve(rendererRoot, specifier.slice(2))
  if (specifier.startsWith("@renderer/"))
    return path.resolve(rendererRoot, specifier.slice(10))
  if (specifier.startsWith("."))
    return path.resolve(path.dirname(filename), specifier)
  return null
}

const boundaries = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      structure:
        "Use an FSD layer and a purpose segment (ui/model/api/lib/config/assets).",
      direction:
        "FSD imports must point downwards: {{from}} cannot import {{to}}.",
      sibling:
        "Independent {{layer}} slices cannot import each other ({{from}} → {{to}}). Compose them in a higher layer.",
      publicApi: "Import {{slice}} through its index.ts public API.",
      wildcard: "Use explicit named exports for slice public APIs.",
      native:
        "Renderer code must use the preload API, not Electron/Node/main/preload implementations.",
      shared:
        "Renderer shared code must not depend on IPC contracts or window.api.",
      bootstrap:
        "The renderer entry point must import application code through app/index.ts (styles may be imported directly).",
    },
  },
  create(context) {
    const filename = path.resolve(context.filename)
    const from = location(filename)
    const report = (node, messageId, data) =>
      context.report({ node, messageId, data })
    function check(node, value) {
      if (typeof value !== "string") return
      if (
        isBuiltin(value) ||
        /^(electron(?:\/|$)|@electron-toolkit\/|@main\/|@preload\/)/.test(value)
      ) {
        report(node, "native")
        return
      }
      const target = localTarget(filename, value)
      if (!target) return
      const relativeSource = path.relative(sourceRoot, target).split(path.sep)
      if (["main", "preload"].includes(relativeSource[0])) {
        report(node, "native")
        return
      }
      const to = location(target)
      if (!to) {
        if (from?.layer === "shared") report(node, "shared")
        return
      }
      if (to.rank < 0) {
        report(node, "structure")
        return
      }
      if (from?.rank === -1) {
        const publicApp =
          to.parts.length === 1 || /^index(?:\.tsx?)?$/.test(to.parts[1])
        if (to.layer !== "app" || (!publicApp && to.parts[1] !== "styles"))
          report(node, "bootstrap")
        return
      }
      if (!from) return
      if (from.rank > to.rank) {
        report(node, "direction", { from: from.layer, to: to.layer })
        return
      }
      if (from.layer === to.layer) {
        if (from.slice && from.slice !== to.slice)
          report(node, "sibling", {
            layer: from.layer,
            from: from.slice,
            to: to.slice,
          })
        return
      }
      if (
        to.slice &&
        !(
          to.parts.length === 2 ||
          (to.parts.length === 3 && /^index(?:\.tsx?)?$/.test(to.parts[2]))
        )
      )
        report(node, "publicApi", { slice: `${to.layer}/${to.slice}` })
    }
    return {
      Program(node) {
        if (!from) return
        const entry =
          ["main.tsx", "env.d.ts"].includes(path.basename(filename)) &&
          from.parts.length === 1
        if (from.rank < 0) {
          if (!entry) report(node, "structure")
        } else if (from.layer === "shared") {
          if (!segments.has(from.parts[1])) report(node, "structure")
        } else if (from.slice) {
          const publicIndex =
            from.parts.length === 3 && /^index\.tsx?$/.test(from.parts[2])
          if (!publicIndex && !segments.has(from.parts[2]))
            report(node, "structure")
        }
      },
      ImportDeclaration: (node) => check(node, node.source.value),
      ImportExpression: (node) => check(node, node.source.value),
      TSImportType: (node) =>
        check(node, node.source?.value ?? node.argument?.value),
      ExportNamedDeclaration: (node) => {
        if (node.source) check(node, node.source.value)
      },
      ExportAllDeclaration(node) {
        if (from?.slice) report(node, "wildcard")
        check(node, node.source.value)
      },
      MemberExpression(node) {
        if (
          from?.layer === "shared" &&
          node.object.type === "Identifier" &&
          ["window", "globalThis"].includes(node.object.name) &&
          (node.computed ? node.property.value : node.property.name) === "api"
        )
          report(node, "shared")
      },
    }
  },
}

export default { rules: { boundaries } }
