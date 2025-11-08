const BASE = "http://ananew.load.com:4222/t_nest/v1/proxy";

async function postJson(path: string, body?: unknown): Promise<any> {
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

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

export async function getNumOfProxies(): Promise<any> {
  const result = await postJson("/get-num-of-proxies");
  return result?.data;
}

export async function generateProxies(proxies: string): Promise<any> {
  return postJson("/generate-proxies", { proxies });
}

export default {
  getNumOfProxies,
  generateProxies,
};
