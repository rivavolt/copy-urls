import { defineConfig } from "wxt";

export default defineConfig({
  modules: [],
  manifest: {
    manifest_version: 3,
    name: "Copy Selected Tab URLs",
    version: "0.0.1",
    description: "On click, copies all highlighted tabs' URLs to the clipboard.",
    action: {
      default_title: "Copy selected tab URLs",
    },
    permissions: ["tabs", "clipboardWrite", "offscreen", "notifications", "scripting", "activeTab"],
    host_permissions: [],
  },
});
