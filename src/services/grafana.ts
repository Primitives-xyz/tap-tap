import { config } from "../config/config";
import { LatencyTest, GrafanaMetric } from "../types";

export class GrafanaService {
  private static instance: GrafanaService;

  private constructor() {
    console.log(`
📊 Initializing Grafana service:
   - Push URL: ${config.GRAFANA.PUSH_URL}
   - User ID: ${config.GRAFANA.USER_ID}
   - API Key: ${config.GRAFANA.API_KEY ? "****" + config.GRAFANA.API_KEY.slice(-4) : "Not set"}
`);
  }

  public static getInstance(): GrafanaService {
    if (!GrafanaService.instance) {
      GrafanaService.instance = new GrafanaService();
    }
    return GrafanaService.instance;
  }

  private convertToLineProtocol(metric: GrafanaMetric): string {
    const tags = Object.entries(metric.tags)
      .map(([key, value]) => `${key}=${this.escapeValue(value.toString())}`)
      .join(",");

    return `${metric.name},${tags} value=${metric.value} ${metric.timestamp}`;
  }

  private escapeValue(value: string): string {
    return value.replace(/,/g, "\\,").replace(/ /g, "\\ ").replace(/=/g, "\\=");
  }

  private createMetrics(test: LatencyTest): GrafanaMetric[] {
    const timestamp = test.timestamp.getTime() * 1000000; // Convert to nanoseconds
    const commonTags = {
      endpoint: test.endpoint,
      status: test.status,
      environment: config.NODE_ENV,
    };

    return [
      {
        name: "endpoint_latency",
        value: test.latency,
        timestamp,
        tags: commonTags,
      },
      {
        name: "endpoint_success",
        value: test.success ? 1 : 0,
        timestamp,
        tags: commonTags,
      },
      {
        name: "endpoint_status",
        value: test.status,
        timestamp,
        tags: commonTags,
      },
    ];
  }

  public async pushMetrics(test: LatencyTest): Promise<void> {
    const metrics = this.createMetrics(test);
    const lines = metrics.map(this.convertToLineProtocol.bind(this));

    console.log(`\n📈 Preparing Grafana metrics for ${test.endpoint}:`);
    console.log("   - Latency:", test.latency, "ms");
    console.log("   - Success:", test.success);
    console.log("   - Status:", test.status);
    console.log("\n🔄 Line Protocol Format:");
    lines.forEach((line) => console.log("   ", line));

    try {
      console.log("\n📤 Sending metrics to Grafana...");
      const response = await fetch(config.GRAFANA.PUSH_URL, {
        method: "POST",
        body: lines.join("\n"),
        headers: {
          Authorization: `Bearer ${config.GRAFANA.USER_ID}:${config.GRAFANA.API_KEY}`,
          "Content-Type": "text/plain",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to push metrics: ${errorText}`);
      }

      console.log("✅ Successfully pushed metrics to Grafana");
    } catch (error) {
      console.error("❌ Error pushing metrics to Grafana:", error);
      if (error instanceof Error) {
        console.error("   Details:", error.message);
      }
      throw error;
    }
  }
}
