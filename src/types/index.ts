export interface LatencyTest {
  endpoint: string;
  timestamp: Date;
  latency: number;
  status: number;
  success: boolean;
}

export interface AlertThreshold {
  endpoint: string;
  maxLatency?: number;
  minSuccessRate?: number;
  windowSize: number;
  notificationUrl?: string;
}

export interface GrafanaMetric {
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string | number>;
}

export type EndpointBody = {
  url: string;
  interval?: number;
  timeout?: number;
  retryCount?: number;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "HEAD";
  headers?: Record<string, string>;
  body?: string;
  expectedStatusCode?: number;
};

export type AlertBody = {
  endpoint: string;
  maxLatency?: number;
  minSuccessRate?: number;
  windowSize: number;
  notificationUrl?: string;
};
