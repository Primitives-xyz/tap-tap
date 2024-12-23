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
