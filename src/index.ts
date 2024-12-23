import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { config } from "./config/config";
import { LatencyTester } from "./services/latency-tester";
import {
  defaultEndpoints,
  getEndpointWithAuth,
} from "./config/default-endpoints";

console.log(`
🚀 Starting Tap-Tap service...
📊 Environment Configuration:
   - NODE_ENV: ${config.NODE_ENV}
   - PORT: ${config.PORT}
   - DB_PATH: ${config.DB_PATH}
   - DEFAULT_INTERVAL: ${config.DEFAULT_INTERVAL}ms
`);

// Create API server
const tester = LatencyTester.getInstance();

// Load default endpoints on startup
console.log("🔄 Loading default endpoints...");
Promise.all(
  defaultEndpoints.map(async (endpoint) => {
    try {
      const { url, headers, body } = getEndpointWithAuth(endpoint);
      await tester.startMonitoring(url, {
        interval: endpoint.interval,
        timeout: endpoint.timeout,
        retryCount: endpoint.retryCount,
        method: endpoint.method,
        headers,
        body,
        expectedStatusCode: endpoint.expectedStatusCode,
        validateResponse: endpoint.validateResponse,
      });
      console.log(`✅ Loaded default endpoint: ${endpoint.name}`);
    } catch (error) {
      console.error(
        `❌ Failed to load default endpoint ${endpoint.name}:`,
        error
      );
    }
  })
).then(() => {
  console.log("✨ Finished loading default endpoints");
});

type EndpointBody = {
  url: string;
  interval?: number;
  timeout?: number;
  retryCount?: number;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "HEAD";
  headers?: Record<string, string>;
  body?: string;
  expectedStatusCode?: number;
};

type AlertBody = {
  endpoint: string;
  maxLatency?: number;
  minSuccessRate?: number;
  windowSize: number;
  notificationUrl?: string;
};

const app = new Elysia()
  .use(
    swagger({
      path: "/docs",
      documentation: {
        info: {
          title: "Tap-Tap API",
          version: "1.0.0",
          description:
            "A high-performance latency monitoring and alerting service",
        },
      },
    })
  )
  .onError(({ code, error, set }) => {
    console.error(`❌ Error [${code}]:`, error);
    set.status = code === "NOT_FOUND" ? 404 : 500;
    return {
      success: false,
      error: error.message,
      code,
    };
  })
  .get("/", () => ({
    status: "ok",
    activeEndpoints: tester.getActiveEndpoints(),
  }))
  .get("/endpoints/defaults", () => ({
    success: true,
    defaults: defaultEndpoints.map(({ auth: _auth, ...endpoint }) => endpoint),
  }))
  .post(
    "/endpoints",
    async ({ body }: { body: EndpointBody }) => {
      const { url, interval, ...options } = body;
      console.log(
        `➕ Adding new endpoint: ${url} (interval: ${interval ?? config.DEFAULT_INTERVAL}ms)`
      );
      const result = await tester.startMonitoring(url, {
        interval,
        ...options,
      });
      return {
        success: true,
        message: `Started monitoring ${url}`,
        initialTest: result,
      };
    },
    {
      body: t.Object({
        url: t.String({ format: "uri" }),
        interval: t.Optional(t.Number({ minimum: 1000 })),
        timeout: t.Optional(t.Number({ minimum: 100 })),
        retryCount: t.Optional(t.Number({ minimum: 0 })),
        method: t.Optional(
          t.Enum({
            GET: "GET",
            POST: "POST",
            PUT: "PUT",
            DELETE: "DELETE",
            HEAD: "HEAD",
          })
        ),
        headers: t.Optional(t.Record(t.String(), t.String())),
        body: t.Optional(t.String()),
        expectedStatusCode: t.Optional(t.Number()),
      }),
    }
  )
  .delete(
    "/endpoints/:url",
    ({ params: { url } }: { params: { url: string } }) => {
      const decodedUrl = decodeURIComponent(url);
      console.log(`➖ Removing endpoint: ${decodedUrl}`);
      tester.stopMonitoring(decodedUrl);
      return { success: true };
    }
  )
  .post(
    "/alerts",
    async ({ body }: { body: AlertBody }) => {
      console.log(`🔔 Setting alert threshold for ${body.endpoint}`);
      tester.setAlertThreshold(body);
      return {
        success: true,
        message: `Set alert threshold for ${body.endpoint}`,
      };
    },
    {
      body: t.Object({
        endpoint: t.String({ format: "uri" }),
        maxLatency: t.Optional(t.Number({ minimum: 0 })),
        minSuccessRate: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
        windowSize: t.Number({ minimum: 1000 }), // minimum 1 second window
        notificationUrl: t.Optional(t.String({ format: "uri" })),
      }),
    }
  )
  .get(
    "/alerts/:endpoint",
    ({ params: { endpoint } }: { params: { endpoint: string } }) => {
      const decodedEndpoint = decodeURIComponent(endpoint);
      const threshold = tester.getAlertThreshold(decodedEndpoint);
      if (!threshold) {
        throw new Error(`No alert threshold found for ${decodedEndpoint}`);
      }
      return threshold;
    }
  )
  .delete(
    "/alerts/:endpoint",
    ({ params: { endpoint } }: { params: { endpoint: string } }) => {
      const decodedEndpoint = decodeURIComponent(endpoint);
      console.log(`🔕 Removing alert threshold for ${decodedEndpoint}`);
      tester.removeAlertThreshold(decodedEndpoint);
      return { success: true };
    }
  )
  .listen(config.PORT);

console.log(`
✨ Server is ready!
🌍 Listening at ${app.server?.hostname}:${config.PORT}
📊 Pushing metrics to Grafana Cloud
📝 API documentation available at /docs
🎛️ URL Manager available at /manage
🔍 Environment: ${config.NODE_ENV}
`);

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down gracefully...");
  tester.close();
  process.exit(0);
});
