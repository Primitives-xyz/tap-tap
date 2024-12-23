import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { config } from "./config/config";
import { LatencyTester } from "./services/latency-tester";
import {
  defaultEndpoints,
  getEndpointWithAuth,
} from "./config/default-endpoints";
import { EndpointBody, AlertBody } from "./types";

// Initialize services
const tester = LatencyTester.getInstance();

// Load default endpoints
defaultEndpoints.forEach(async (endpoint) => {
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
  } catch (error) {
    console.error(`Failed to load endpoint ${endpoint.name}:`, error);
  }
});

new Elysia()
  .use(
    swagger({
      path: "/docs",
      documentation: {
        info: {
          title: "Tap-Tap API",
          version: "0.1.0",
          description: "High-performance API monitoring with Bun & Grafana",
        },
      },
    })
  )
  .onError(({ code, error, set }) => {
    console.error(`Error [${code}]:`, error);
    set.status = code === "NOT_FOUND" ? 404 : 500;
    return { success: false, error: error.message, code };
  })
  // Health check
  .get("/", () => ({
    status: "ok",
    activeEndpoints: tester.getActiveEndpoints(),
  }))
  // Default endpoints
  .get("/endpoints/defaults", () => ({
    success: true,
    defaults: defaultEndpoints.map(({ auth: _auth, ...endpoint }) => endpoint),
  }))
  // Endpoint management
  .post(
    "/endpoints",
    async ({ body }: { body: EndpointBody }) => {
      const { url, interval, ...options } = body;
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
  .delete("/endpoints/:url", ({ params: { url } }) => {
    const decodedUrl = decodeURIComponent(url);
    tester.stopMonitoring(decodedUrl);
    return { success: true };
  })
  // Alert management
  .post(
    "/alerts",
    async ({ body }: { body: AlertBody }) => {
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
        windowSize: t.Number({ minimum: 1000 }),
        notificationUrl: t.Optional(t.String({ format: "uri" })),
      }),
    }
  )
  .get("/alerts/:endpoint", ({ params: { endpoint } }) => {
    const decodedEndpoint = decodeURIComponent(endpoint);
    const threshold = tester.getAlertThreshold(decodedEndpoint);
    if (!threshold) {
      throw new Error(`No alert threshold found for ${decodedEndpoint}`);
    }
    return threshold;
  })
  .delete("/alerts/:endpoint", ({ params: { endpoint } }) => {
    const decodedEndpoint = decodeURIComponent(endpoint);
    tester.removeAlertThreshold(decodedEndpoint);
    return { success: true };
  })
  .listen(config.PORT);

console.log(`
✨ Server ready at http://localhost:${config.PORT}
📝 API docs at http://localhost:${config.PORT}/docs
`);

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  tester.close();
  process.exit(0);
});
