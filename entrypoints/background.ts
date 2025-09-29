// Background service worker: handle action click and copy highlighted tab URLs
import { defineBackground } from "wxt/sandbox";

export default defineBackground(() => {
  async function getHighlightedTabUrls(): Promise<string[]> {
    const tabs = await chrome.tabs.query({ currentWindow: true, highlighted: true });
    const urls: string[] = [];
    for (const tab of tabs) {
      if (tab.url) urls.push(tab.url);
    }

    // Fallback to active tab if none highlighted
    if (urls.length === 0) {
      const activeTabs = await chrome.tabs.query({ currentWindow: true, active: true });
      if (activeTabs[0]?.url) urls.push(activeTabs[0].url);
    }
    return urls;
  }

  async function ensureOffscreenDocument() {
    // If an offscreen document already exists, skip creating a new one
    // @ts-ignore: offscreen typings may not exist in chrome types
    const hasDoc = await chrome.offscreen.hasDocument?.();
    if (hasDoc) return;

    // @ts-ignore: offscreen typings may not exist in chrome types
    await chrome.offscreen.createDocument?.({
      url: "offscreen.html",
      reasons: ["CLIPBOARD"],
      justification: "Copy URLs to clipboard on action click",
    });
    // Wait until the offscreen page is ready by pinging it a few times
    await waitForOffscreenReady();
  }

  async function waitForOffscreenReady(retries = 10, delayMs = 100): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        const resp = await new Promise<{ ok: boolean }>((resolve, reject) => {
          chrome.runtime.sendMessage({ type: "ping" }, (response) => {
            const lastError = chrome.runtime.lastError;
            if (lastError) return reject(new Error(lastError.message));
            resolve(response as any);
          });
        });
        if (resp?.ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, delayMs));
    }
    throw new Error("Offscreen page not ready");
  }

  async function copyTextToClipboard(text: string): Promise<void> {
    // Use the page context to perform the copy to avoid offscreen focus issues
    await copyViaPage(text);
  }

  async function copyViaPage(text: string): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab for fallback copy");

    const results = await chrome.scripting.executeScript<{ ok: boolean; error?: string }>({
      target: { tabId: tab.id },
      func: async (t: string) => {
        try {
          await navigator.clipboard.writeText(t);
          return { ok: true };
        } catch (e) {
          try {
            const ta = document.createElement("textarea");
            ta.value = t;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            ta.style.left = "-9999px";
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            const ok = document.execCommand("copy");
            document.body.removeChild(ta);
            if (ok) return { ok: true };
            return { ok: false, error: "execCommand(copy) failed" };
          } catch (err) {
            return { ok: false, error: String((err as any)?.message ?? err) };
          }
        }
      },
      args: [text],
    });

    const result = results?.[0]?.result;
    if (!result?.ok) throw new Error(result?.error || "Fallback copy failed");
  }

  function showBadge(text: string, ms = 1200) {
    chrome.action.setBadgeBackgroundColor({ color: "#4caf50" });
    chrome.action.setBadgeText({ text });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), ms);
  }

  function notify(title: string, message: string) {
    // Use bundled icon from public/
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon-16.png",
      title,
      message,
      priority: 0,
    });
  }

  chrome.action.onClicked.addListener(async () => {
    try {
      const urls = await getHighlightedTabUrls();
      const text = urls.join("\n");
      await copyTextToClipboard(text);
      const count = urls.length;
      showBadge("OK");
      notify("Copied URLs", `Copied ${count} URL${count === 1 ? "" : "s"} to clipboard`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Copy failed:", err);
      chrome.action.setBadgeBackgroundColor({ color: "#f44336" });
      chrome.action.setBadgeText({ text: "ERR" });
      setTimeout(() => chrome.action.setBadgeText({ text: "" }), 1500);
      notify("Copy failed", message);
    }
  });
});
