# 🎯 Tap-Tap

A high-performance API endpoint monitoring service built with Bun and Elysia. Monitor your API endpoints in real-time, track latency, success rates, and get instant alerts when things go wrong. Built by [Tapestry](https://usetapestry.dev).

## ✨ Features

- 🚀 **High Performance**: Built with Bun and Elysia for blazing-fast monitoring
- 📊 **Real-time Metrics**: Track latency, success rates, and status codes
- 🔄 **Automatic Retries**: Configurable retry attempts for failed requests
- 🎛️ **Flexible Configuration**: Support for various HTTP methods, headers, and authentication types
- 📈 **Grafana Integration**: Push metrics directly to Grafana Cloud
- 🔔 **Alert System**: Set up alerts for latency thresholds and success rates
- 🔒 **Secure**: Support for various authentication methods (API Key, Bearer Token, Basic Auth)
- 🎨 **Beautiful UI**: Swagger documentation and URL management interface

## 🚀 Quick Start

1. **Clone the repository**

   ```bash
   git clone https://github.com/primitives-xyz/tap-tap.git
   cd tap-tap
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the server**
   ```bash
   bun run start
   ```

## 📊 Configuration

### Environment Variables

- `PORT`: Server port (default: 5050)
- `NODE_ENV`: Environment (development/production)
- `DB_PATH`: SQLite database path
- `DEFAULT_INTERVAL`: Default monitoring interval in ms
- `GRAFANA_*`: Grafana Cloud configuration
- Add your API keys as needed

### Default Endpoints

Configure default endpoints to monitor in `src/config/default-endpoints.ts`:

```typescript
export const defaultEndpoints: DefaultEndpoint[] = [
  {
    name: "My API",
    url: "https://api.example.com/health",
    method: "GET",
    interval: 30000, // 30 seconds
    timeout: 5000, // 5 seconds
    retryCount: 3,
    auth: {
      type: "apiKey",
      envVar: "API_KEY",
      location: "header",
      paramName: "X-API-Key",
    },
    tags: ["production", "health"],
  },
];
```

## 📡 API Endpoints

- `GET /`: View active endpoints
- `GET /docs`: Swagger documentation
- `POST /endpoints`: Add new endpoint to monitor
- `DELETE /endpoints/:url`: Stop monitoring endpoint
- `POST /alerts`: Configure alerts
- `GET /alerts/:endpoint`: Get alert configuration
- `DELETE /alerts/:endpoint`: Remove alert configuration

## 🔧 Development

```bash
# Run in development mode
bun run dev

# Run tests
bun test

# Build for production
bun run build
```

## 🚀 Deployment

Includes configuration for Fly.io deployment:

```bash
fly launch
fly deploy
```

## 📈 Metrics

Metrics are pushed to Grafana Cloud in InfluxDB line protocol format:

- `endpoint_latency`: Response time in milliseconds
- `endpoint_success`: Binary success indicator (0/1)
- `endpoint_status`: HTTP status code

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

MIT License - see [LICENSE](LICENSE) for details

## 👥 Authors

- Nicholas Oxford ([@nicholasoxford](https://github.com/nicholasoxford)) - [nicholasoxford.com](https://nicholasoxford.com)

## 🏢 Organization

Built with ❤️ by [Tapestry](https://usetapestry.dev)
