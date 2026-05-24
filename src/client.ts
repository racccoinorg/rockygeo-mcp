export interface LookupResult {
  ip: string;
  found: boolean;
  country_code?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  postal?: string | null;
  lat?: number | null;
  lon?: number | null;
  tz?: string | null;
}

export interface BatchResult {
  results: Record<string, LookupResult>;
}

export interface HealthResult {
  status: string;
  dataVersion: number;
  lastSyncAt: number | null;
  uptime: number;
}

export interface RockyGeoClientOptions {
  apiKey: string;
  baseUrl: string;
  rapidApiHost?: string;
}

export class RockyGeoError extends Error {
  status?: number;
  body?: unknown;
  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.name = "RockyGeoError";
    this.status = status;
    this.body = body;
  }
}

export class RockyGeoClient {
  private readonly baseUrl: string;
  private readonly rootUrl: string;
  private readonly headers: Record<string, string>;

  constructor(opts: RockyGeoClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.rootUrl = this.baseUrl.replace(/\/v1$/, "");
    this.headers = {
      "x-rapidapi-key": opts.apiKey,
      Accept: "application/json",
    };
    const host = opts.rapidApiHost ?? extractHost(this.baseUrl);
    if (host && host.endsWith("rapidapi.com")) {
      this.headers["x-rapidapi-host"] = host;
    }
  }

  async lookupIp(ip: string): Promise<LookupResult> {
    const url = `${this.baseUrl}/lookup/${encodeURIComponent(ip)}`;
    const res = await fetch(url, { headers: this.headers });
    if (res.status === 404) {
      return { ip, found: false };
    }
    return this.parseJson<LookupResult>(res);
  }

  async lookupBatch(ips: string[]): Promise<BatchResult> {
    const url = `${this.baseUrl}/lookup/batch`;
    const res = await fetch(url, {
      method: "POST",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ips }),
    });
    return this.parseJson<BatchResult>(res);
  }

  async health(): Promise<HealthResult> {
    const url = `${this.rootUrl}/health`;
    const res = await fetch(url, { headers: this.headers });
    return this.parseJson<HealthResult>(res);
  }

  private async parseJson<T>(res: Response): Promise<T> {
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    if (!res.ok) {
      const msg = extractErrorMessage(body) ?? `RockyGeo request failed with status ${res.status}`;
      throw new RockyGeoError(msg, res.status, body);
    }
    return body as T;
  }
}

function extractHost(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

function extractErrorMessage(body: unknown): string | undefined {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error: unknown }).error;
    if (typeof err === "string") return err;
  }
  return undefined;
}
