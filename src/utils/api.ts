const BASE = "http://ananew.load.com:4222/t_nest/v1/proxy";
const RETRY_COUNT = 3;
const RETRY_DELAY = 5000; // 5 seconds in milliseconds

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryWithDelay<T>(
  fn: () => Promise<T>,
  retries: number = RETRY_COUNT,
  delayMs: number = RETRY_DELAY
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[Retry] Attempt ${attempt}/${retries} failed:`, lastError.message);
      
      if (attempt < retries) {
        console.log(`[Retry] Waiting ${delayMs}ms before next attempt...`);
        await delay(delayMs);
      }
    }
  }
  
  throw lastError || new Error("All retry attempts failed");
}

async function postJson(path: string, body?: unknown): Promise<any> {
  return retryWithDelay(async () => {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Request failed ${res.status}: ${text}`);
    }

    console.log(`[postJson] Success:`, res.status);

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return res.json();
    }
    return res.text();
  });
}

export async function getNumOfProxies(): Promise<any> {
  const result = await postJson("/get-num-of-proxies");
  console.log(`[getNumOfProxies] Success:`, result.data);
  return result?.data;
}

export async function generateProxies(proxies: string): Promise<any> {
  return postJson("/generate-proxies", { proxies });
}

export async function cronjobRequest(url: string): Promise<void> {
  return retryWithDelay(async () => {
    const response = await fetch(url, {
      method: 'GET', 
    });

    if (!response.ok) {
      throw new Error(`Cronjob request failed with status: ${response.status}`);
    }
    
    console.log(`[Cronjob] Success:`, response.status);
  }).catch((error) => {
    // Log error but don't throw - cronjob failures shouldn't break the app
    console.error(`[Cronjob] All retry attempts failed:`, error);
  });
}

export default {
  getNumOfProxies,
  generateProxies,
  cronjobRequest,
};
