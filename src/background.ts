import { generateProxies, getNumOfProxies } from "./utils/api";

const proxyWebUri = "https://www.711proxy.com/dashboard/Socks5-proxies";
let running = false;
const delayBetween = 60000;
const availableNumberOfProxies = [
  1, 10, 50, 100, 200, 300, 400, 500, 1000, 5000, 10000,
];

setInterval(() => {
  processGetting();
}, delayBetween);

processGetting();

async function processGetting() {
  if (running) {
    console.log("Previous run still in progress, skipping this tick.");
    return;
  }
  running = true;

  try {
    console.log("Processing...");

    const numResp = await getNumOfProxies();

    let desiredNumber = 0;
    if (typeof numResp === "number") desiredNumber = numResp;
    else if (numResp && typeof numResp.count === "number")
      desiredNumber = numResp.count;
    else if (numResp && typeof numResp.num === "number")
      desiredNumber = numResp.num;
    else {
      const maybeNum = Number(numResp);
      if (!Number.isNaN(maybeNum)) desiredNumber = maybeNum;
    }

    if (desiredNumber === 0 || isNaN(desiredNumber)) {
      console.warn(
        "Could not parse desired number of proxies from response:",
        numResp
      );
      running = false;
      return;
    }

    const target = nearestAvailable(desiredNumber, availableNumberOfProxies);

    console.log("Desired:", desiredNumber, "-> target nearest:", target);

    const tab = await openTab(proxyWebUri);
    if (!tab?.id) {
      throw new Error("Could not open tab for proxy website");
    }
    await delay(5000);

    const result = await executeInTab(tab.id, target);

    const proxiesText = Array.isArray(result) ? result[0] : result;
    console.log("proxiesText:", proxiesText);
    if (!proxiesText || typeof proxiesText !== "string") {
      console.warn("No proxies text returned from page script:", proxiesText);
    } else {
      console.log("Got proxies (length):", proxiesText.length);

      await generateProxies(proxiesText);
      console.log("Proxies sent to backend.");
    }

    try {
      chrome.tabs.remove(tab.id);
    } catch (e) {}
  } catch (err) {
    console.error("Error in processGetting:", err);
  } finally {
    running = false;
  }
}

function nearestAvailable(n: number, arr: number[]) {
  let best = arr[0];
  let bestDiff = Math.abs(n - best);
  for (const v of arr) {
    const d = Math.abs(n - v);
    if (d < bestDiff) {
      best = v;
      bestDiff = d;
    }
  }
  return best;
}
function openTab(url: string): Promise<chrome.tabs.Tab> {
  return new Promise((resolve) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      if (!tab || !tab.id) return resolve(tab as any);

      const tabId = tab.id;

      let resolved = false;
      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(tab);
      };

      const listener = (updatedTabId: number, changeInfo: any) => {
        if (updatedTabId === tabId && changeInfo.status === "complete") {
          cleanup();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);

      setTimeout(() => {
        console.warn("⚠️ Tab did not report 'complete' in time, continuing...");
        cleanup();
      }, 15000);
    });
  });
}

function executeInTab(tabId: number, desiredCount: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const func = (count: number) => {
      function findSelectAfterLabel(labelText: string): HTMLElement | null {
        const wrappers = Array.from(document.querySelectorAll(".prxoyListRef"));

        for (const wrapper of wrappers) {
          console.log("prxoyListRef:", wrapper);
          const span = wrapper.querySelector("span");
          if (span && (span.textContent || "").trim() === labelText) {
            const select = wrapper.querySelector<HTMLElement>(
              ".arco-select-view-single.arco-select.arco-select-view.arco-select-view-size-medium.arco-select-view-search"
            );
            if (select) return select;
          }
        }

        return null;
      }
      function clickSelectOptionByNumber(number: string | number) {
        const strNumber = String(number).trim();
        const options = document.querySelectorAll<HTMLLIElement>(
          "li.arco-select-option"
        );

        for (const option of options) {
          const span = option.querySelector<HTMLSpanElement>(
            "span.arco-select-option-content"
          );
          if (span && span.textContent?.trim() === strNumber) {
            option.click();
            return true;
          }
        }

        return false;
      }
      function findButtonByText(
        text: string
      ): HTMLButtonElement | HTMLInputElement | null {
        const btns = Array.from(
          document.querySelectorAll(
            "button, input[type=button], input[type=submit]"
          )
        );
        for (const b of btns) {
          if (!b.textContent && (b as HTMLInputElement).value) {
            if (
              ((b as HTMLInputElement).value || "").trim().toLowerCase() ===
              text.toLowerCase()
            )
              return b as any;
          } else if (
            b.textContent &&
            b.textContent.trim().toLowerCase() === text.toLowerCase()
          )
            return b as any;
        }

        for (const b of btns) {
          if (
            (b.textContent || (b as HTMLInputElement).value || "")
              .toLowerCase()
              .includes(text.toLowerCase())
          )
            return b as any;
        }
        return null;
      }
      function getTextareaBeforeExportProxy(): HTMLTextAreaElement | null {
        const wrapper = document.querySelector<HTMLElement>(".exportPrxoyRef");
        if (!wrapper) return null;

        let prev = wrapper.previousElementSibling;
        while (prev) {
          const textarea = prev.querySelector<HTMLTextAreaElement>("textarea");
          if (textarea) return textarea;

          prev = prev.previousElementSibling;
        }

        return null;
      }
      try {
        const select =
          findSelectAfterLabel("Number of proxies") ||
          findSelectAfterLabel("Number of proxy");
        if (!select) {
          return { error: "Could not find select for 'Number of proxies'." };
        }
        select?.click();
        console.log(select);
        clickSelectOptionByNumber(count);

        const btn =
          findButtonByText("Generate") ||
          findButtonByText("Generate Proxies") ||
          findButtonByText("Generate");
        if (!btn) {
          return { error: "Could not find 'Generate' button.", proxies: null };
        }
        (btn as HTMLElement).click();

        function sleep(ms: number) {
          return new Promise((r) => setTimeout(r, ms));
        }

        return (async () => {
          const maxWait = 10000;
          const interval = 500;
          const start = Date.now();

          while (Date.now() - start < maxWait) {
            const ta = getTextareaBeforeExportProxy();
            if (ta && ta.value && ta.value.trim().length > 0) {
              return { proxies: ta.value, error: null };
            }

            await sleep(interval);
          }

          const finalTa = getTextareaBeforeExportProxy();
          return {
            proxies: finalTa ? finalTa.value : null,
            error: null,
            warning: "Timeout waiting for proxies",
          };
        })();
      } catch (e) {
        return { error: String(e) };
      }
    };

    chrome.scripting.executeScript(
      {
        target: { tabId },
        func,
        args: [desiredCount],
      },
      (injectionResults) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        if (!injectionResults || !injectionResults.length) return resolve(null);
        const r = injectionResults[0].result;
        if (!r) return resolve(null);
        if (r.error) return resolve(r);
        if (r.proxies) return resolve(r.proxies);
        return resolve(r.proxies ?? r);
      }
    );
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
