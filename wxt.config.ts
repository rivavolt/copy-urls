import { defineConfig } from "wxt";

export default defineConfig({
  modules: [],
  manifest: ({ browser }) => ({
    name: "Copy Selected Tab URLs",
    version: "0.0.1",
    description: "On click, copies all highlighted tabs' URLs to the clipboard.",
    action: {
      default_title: "Copy selected tab URLs",
      default_icon: "icon.png",
    },
    permissions: ["tabs", "clipboardWrite", "scripting", "activeTab"],
    icons: {
      128: "icon.png",
    },
    host_permissions: [],
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              id: "copy-urls@andreivolt",
              strict_min_version: "128.0",
            },
          },
        }
      : {}),
  }),
});
