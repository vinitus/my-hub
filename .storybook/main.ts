import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import type { StorybookConfig } from "@storybook/react-vite"
import { mergeConfig } from "vite"

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url))

const config: StorybookConfig = {
  stories: ["../src/renderer/src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs"],
  framework: "@storybook/react-vite",
  core: {
    builder: {
      name: "@storybook/builder-vite",
      options: {
        // The app Vite config sets the Electron renderer root; Storybook uses its own root.
        viteConfigPath: fromRoot("./vite.config.ts"),
      },
    },
  },
  async viteFinal(config) {
    return mergeConfig(config, {
      plugins: [tailwindcss()],
      resolve: {
        alias: {
          "@": fromRoot("../src/renderer/src"),
          "@renderer": fromRoot("../src/renderer/src"),
        },
      },
    })
  },
}

export default config
