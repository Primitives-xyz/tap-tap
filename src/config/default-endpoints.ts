import { z } from "zod";

// Define header schema
const headerSchema = z.record(z.string());

// Define authentication types
const authSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("apiKey"),
    envVar: z.string(),
    location: z.enum(["header", "query"]),
    paramName: z.string(),
  }),
  z.object({
    type: z.literal("bearer"),
    envVar: z.string(),
  }),
  z.object({
    type: z.literal("basic"),
    usernameEnvVar: z.string(),
    passwordEnvVar: z.string(),
  }),
  z.object({
    type: z.literal("none"),
  }),
]);

export const defaultEndpointSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  description: z.string().optional(),
  interval: z.number().optional(),
  timeout: z.number().optional(),
  retryCount: z.number().optional(),
  headers: headerSchema.optional(),
  auth: authSchema.default({ type: "none" }),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "HEAD"]).default("GET"),
  body: z.string().optional(),
  tags: z.array(z.string()).optional(),
  expectedStatusCode: z.number().optional(),
  validateResponse: z.function().args(z.any()).returns(z.boolean()).optional(),
});

export type DefaultEndpoint = z.infer<typeof defaultEndpointSchema>;

export const defaultEndpoints: DefaultEndpoint[] = [
  {
    name: "Tapestry API Profile",
    url: "https://api.usetapestry.dev/api/v1/profiles/testuser123",
    description: "Monitor Tapestry API profile endpoint",
    method: "GET",
    interval: 30000, // 30 seconds
    timeout: 5000, // 5 seconds
    retryCount: 3,
    auth: {
      type: "apiKey",
      envVar: "TAPESTRY_API_KEY",
      location: "query",
      paramName: "apiKey",
    },
    headers: {
      Accept: "application/json",
      "User-Agent": "tap-tap-monitor/1.0",
    },
    tags: ["api", "profile", "tapestry"],
    expectedStatusCode: 200,
  },
  {
    name: "Tapestry API Profile Followers",
    url: "https://api.usetapestry.dev/api/v1/profiles/testuser123/followers",
    description: "Monitor Tapestry API profile followers endpoint",
    method: "GET",
    interval: 30000, // 30 seconds
    timeout: 5000, // 5 seconds
    retryCount: 3,
    auth: {
      type: "apiKey",
      envVar: "TAPESTRY_API_KEY",
      location: "query",
      paramName: "apiKey",
    },
    headers: {
      Accept: "application/json",
      "User-Agent": "tap-tap-monitor/1.0",
    },
    tags: ["api", "profile", "followers", "tapestry"],
    expectedStatusCode: 200,
  },
];

export function getEndpointWithAuth(endpoint: DefaultEndpoint): {
  url: string;
  headers: Record<string, string>;
  body?: string;
} {
  const headers = { ...endpoint.headers } || {};
  const url = new URL(endpoint.url);

  switch (endpoint.auth.type) {
    case "apiKey": {
      const apiKey = process.env[endpoint.auth.envVar];
      if (!apiKey) {
        throw new Error(
          `API key not found in environment variable ${endpoint.auth.envVar}`
        );
      }
      if (endpoint.auth.location === "header") {
        headers[endpoint.auth.paramName] = apiKey;
      } else {
        url.searchParams.set(endpoint.auth.paramName, apiKey);
      }
      break;
    }
    case "bearer": {
      const token = process.env[endpoint.auth.envVar];
      if (!token) {
        throw new Error(
          `Bearer token not found in environment variable ${endpoint.auth.envVar}`
        );
      }
      headers["Authorization"] = `Bearer ${token}`;
      break;
    }
    case "basic": {
      const username = process.env[endpoint.auth.usernameEnvVar];
      const password = process.env[endpoint.auth.passwordEnvVar];
      if (!username || !password) {
        throw new Error(
          `Basic auth credentials not found in environment variables ${endpoint.auth.usernameEnvVar} and ${endpoint.auth.passwordEnvVar}`
        );
      }
      const auth = Buffer.from(`${username}:${password}`).toString("base64");
      headers["Authorization"] = `Basic ${auth}`;
      break;
    }
  }

  return {
    url: url.toString(),
    headers,
    body: endpoint.body,
  };
}
