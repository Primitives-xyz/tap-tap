import { DatabaseService } from "../db/database";
import { GrafanaService } from "./grafana";
import { AlertThreshold, LatencyTest } from "../types";
import { config } from "../config/config";

export type MonitoringOptions = {
  interval?: number;
  timeout?: number;
  retryCount?: number;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "HEAD";
  headers?: Record<string, string>;
  body?: string;
  expectedStatusCode?: number;
  validateResponse?: (response: any) => boolean;
};

export class LatencyTester {
  private static instance: LatencyTester;
  private db: DatabaseService;
  private grafana: GrafanaService;
  private activeTests: Map<string, NodeJS.Timer> = new Map();
  private alertThresholds: Map<string, AlertThreshold> = new Map();

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.grafana = GrafanaService.getInstance();
    this.loadAlertThresholds();
  }

  public static getInstance(): LatencyTester {
    if (!LatencyTester.instance) {
      LatencyTester.instance = new LatencyTester();
    }
    return LatencyTester.instance;
  }

  private loadAlertThresholds(): void {
    const query = this.db.prepare(`
      SELECT * FROM alert_thresholds
    `);

    const thresholds = query.all() as Array<{
      endpoint: string;
      max_latency: number | null;
      min_success_rate: number | null;
      window_size: number;
      notification_url: string | null;
    }>;

    thresholds.forEach((threshold) => {
      this.alertThresholds.set(threshold.endpoint, {
        endpoint: threshold.endpoint,
        maxLatency: threshold.max_latency ?? undefined,
        minSuccessRate: threshold.min_success_rate ?? undefined,
        windowSize: threshold.window_size,
        notificationUrl: threshold.notification_url ?? undefined,
      });
    });
  }

  private async performTest(
    url: string,
    options: MonitoringOptions = {}
  ): Promise<LatencyTest> {
    const startTime = performance.now();
    let currentTry = 0;
    const maxTries = (options.retryCount ?? 0) + 1;

    while (currentTry < maxTries) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => {
          controller.abort();
        }, options.timeout ?? 30000);

        const response = await fetch(url, {
          method: options.method ?? "GET",
          headers: options.headers,
          body: options.body,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        const endTime = performance.now();

        const success =
          (options.expectedStatusCode
            ? response.status === options.expectedStatusCode
            : response.ok) &&
          (!options.validateResponse ||
            (await options.validateResponse(await response.clone().json())));

        return {
          endpoint: url,
          timestamp: new Date(),
          latency: Math.round(endTime - startTime),
          status: response.status,
          success,
        };
      } catch (error) {
        currentTry++;
        if (currentTry === maxTries) {
          const endTime = performance.now();
          return {
            endpoint: url,
            timestamp: new Date(),
            latency: Math.round(endTime - startTime),
            status: 0,
            success: false,
          };
        }
        // If we have more retries, continue to the next iteration
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second between retries
      }
    }

    // This should never be reached due to the while loop logic
    throw new Error("Unexpected end of performTest");
  }

  private async storeResult(result: LatencyTest): Promise<void> {
    const query = this.db.prepare(`
      INSERT OR REPLACE INTO latency_tests (timestamp, endpoint, latency, status, success)
      VALUES (?, ?, ?, ?, ?)
    `);

    query.run(
      result.timestamp.getTime(),
      result.endpoint,
      result.latency,
      result.status,
      result.success ? 1 : 0
    );
  }

  private async checkAlertThresholds(result: LatencyTest): Promise<void> {
    const threshold = this.alertThresholds.get(result.endpoint);
    if (!threshold) return;

    const windowStart = result.timestamp.getTime() - threshold.windowSize;

    const recentTests = this.db
      .prepare(
        `
        SELECT 
          AVG(latency) as avg_latency,
          AVG(CASE WHEN success = 1 THEN 1.0 ELSE 0.0 END) as success_rate
        FROM latency_tests
        WHERE endpoint = ? AND timestamp >= ?
      `
      )
      .get(result.endpoint, windowStart) as {
      avg_latency: number;
      success_rate: number;
    };

    const alerts: string[] = [];

    if (
      threshold.maxLatency &&
      recentTests.avg_latency > threshold.maxLatency
    ) {
      alerts.push(
        `High latency: ${recentTests.avg_latency.toFixed(2)}ms (threshold: ${
          threshold.maxLatency
        }ms)`
      );
    }

    if (
      threshold.minSuccessRate &&
      recentTests.success_rate < threshold.minSuccessRate
    ) {
      alerts.push(
        `Low success rate: ${(recentTests.success_rate * 100).toFixed(
          1
        )}% (threshold: ${threshold.minSuccessRate * 100}%)`
      );
    }

    if (alerts.length > 0 && threshold.notificationUrl) {
      await this.sendAlert(result.endpoint, alerts, threshold.notificationUrl);
    }
  }

  private async sendAlert(
    endpoint: string,
    alerts: string[],
    webhookUrl: string
  ): Promise<void> {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          timestamp: new Date().toISOString(),
          alerts,
        }),
      });
    } catch (error) {
      console.error(`Failed to send alert for ${endpoint}:`, error);
    }
  }

  public async testEndpoint(
    url: string,
    options: MonitoringOptions = {}
  ): Promise<LatencyTest> {
    const result = await this.performTest(url, options);
    await this.storeResult(result);
    await this.grafana.pushMetrics(result);
    await this.checkAlertThresholds(result);
    return result;
  }

  public setAlertThreshold(threshold: AlertThreshold): void {
    this.alertThresholds.set(threshold.endpoint, threshold);

    const query = this.db.prepare(`
      INSERT OR REPLACE INTO alert_thresholds 
      (endpoint, max_latency, min_success_rate, window_size, notification_url)
      VALUES (?, ?, ?, ?, ?)
    `);

    query.run(
      threshold.endpoint,
      threshold.maxLatency ?? null,
      threshold.minSuccessRate ?? null,
      threshold.windowSize,
      threshold.notificationUrl ?? null
    );
  }

  public removeAlertThreshold(endpoint: string): void {
    this.alertThresholds.delete(endpoint);
    this.db
      .prepare("DELETE FROM alert_thresholds WHERE endpoint = ?")
      .run(endpoint);
  }

  public getAlertThreshold(endpoint: string): AlertThreshold | undefined {
    return this.alertThresholds.get(endpoint);
  }

  public startMonitoring(
    url: string,
    options: number | MonitoringOptions = config.DEFAULT_INTERVAL
  ): Promise<LatencyTest> {
    if (this.activeTests.has(url)) {
      throw new Error(`Already monitoring ${url}`);
    }

    const normalizedOptions: MonitoringOptions =
      typeof options === "number" ? { interval: options } : options;

    const interval = normalizedOptions.interval ?? config.DEFAULT_INTERVAL;

    const timer = setInterval(() => {
      this.testEndpoint(url, normalizedOptions).catch(console.error);
    }, interval);

    this.activeTests.set(url, timer);
    return this.testEndpoint(url, normalizedOptions); // Initial test
  }

  public stopMonitoring(url: string): void {
    const timer = this.activeTests.get(url);
    if (timer) {
      clearInterval(timer);
      this.activeTests.delete(url);
    }
  }

  public getActiveEndpoints(): string[] {
    return Array.from(this.activeTests.keys());
  }

  public close(): void {
    for (const timer of this.activeTests.values()) {
      clearInterval(timer);
    }
    this.activeTests.clear();
  }
}
