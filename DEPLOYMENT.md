# Deployment Guide for Render

This guide explains how to deploy the DataForSEO MCP Server on Render.

## Prerequisites

1. A Render account (https://render.com)
2. DataForSEO API credentials (username and password)
3. This repository pushed to GitHub/GitLab

## Deployment Steps

### Option 1: Using render.yaml (Recommended)

1. **Fork or clone this repository** to your GitHub/GitLab account

2. **Connect to Render**:
   - Go to your Render dashboard
   - Click "New" → "Blueprint"
   - Connect your GitHub/GitLab repository
   - Select this repository

3. **Configure Environment Variables**:
   Render will automatically read the `render.yaml` file, but you need to set the required secret environment variables:
   
   - `DATAFORSEO_USERNAME`: Your DataForSEO API username
   - `DATAFORSEO_PASSWORD`: Your DataForSEO API password

4. **Deploy**: Click "Apply" to start the deployment

### Option 2: Manual Web Service Creation

1. **Create a new Web Service**:
   - Go to your Render dashboard
   - Click "New" → "Web Service"
   - Connect your repository

2. **Configure the service**:
   - **Name**: `dataforseo-mcp-server`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run http`

3. **Set Environment Variables**:
   ```
   NODE_ENV=production
   HOST=0.0.0.0
   DATAFORSEO_USERNAME=your_dataforseo_username
   DATAFORSEO_PASSWORD=your_dataforseo_password
   ENABLED_MODULES=SERP,KEYWORDS_DATA,ONPAGE,DATAFORSEO_LABS,BACKLINKS,BUSINESS_DATA,DOMAIN_ANALYTICS
   DATAFORSEO_FULL_RESPONSE=false
   ```

4. **Deploy**: Click "Create Web Service"

## Required Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATAFORSEO_USERNAME` | ✅ Yes | - | Your DataForSEO API username |
| `DATAFORSEO_PASSWORD` | ✅ Yes | - | Your DataForSEO API password |
| `PORT` | ❌ No | 3000 | Port to run the server (Render sets this automatically) |
| `HOST` | ❌ No | 0.0.0.0 | Host to bind to (must be 0.0.0.0 for Render) |
| `NODE_ENV` | ❌ No | development | Node.js environment |
| `ENABLED_MODULES` | ❌ No | All modules | Comma-separated list of modules to enable |
| `DATAFORSEO_FULL_RESPONSE` | ❌ No | false | Whether to return full API responses |

## Available Modules

You can control which modules are enabled using the `ENABLED_MODULES` environment variable:

- `SERP`: Real-time SERP data for Google, Bing, and Yahoo
- `KEYWORDS_DATA`: Keyword research and clickstream data
- `ONPAGE`: Website crawling and on-page SEO metrics
- `DATAFORSEO_LABS`: DataForSEO's proprietary data and algorithms
- `BACKLINKS`: Backlink analysis data
- `BUSINESS_DATA`: Business reviews and information
- `DOMAIN_ANALYTICS`: Domain technology and Whois data

Example: `ENABLED_MODULES=SERP,KEYWORDS_DATA,ONPAGE`

## Server Endpoints

Once deployed, your server will be available at your Render URL with these endpoints:

### HTTP Server (Stateless)
- **Endpoint**: `/mcp`
- **Methods**: POST
- **Authentication**: Basic Auth or environment variables

### SSE Server (Stateful)
- **Endpoints**: 
  - `/mcp` (Streamable HTTP - recommended)
  - `/sse` (GET) and `/messages` (POST) - legacy SSE support
- **Authentication**: Basic Auth or environment variables

## Authentication

The server supports two authentication methods:

1. **Basic Authentication** (recommended for API clients):
   ```
   Authorization: Basic <base64-encoded-username:password>
   ```

2. **Environment Variables** (fallback):
   If no Basic Auth is provided, the server uses `DATAFORSEO_USERNAME` and `DATAFORSEO_PASSWORD`

## Testing Your Deployment

Once deployed, you can test your server:

```bash
# Test with Basic Auth
curl -X POST https://your-app.onrender.com/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'username:password' | base64)" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

# Test with environment variables (no auth header)
curl -X POST https://your-app.onrender.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

## Troubleshooting

### Common Issues

1. **Server not accessible**: Ensure `HOST=0.0.0.0` is set
2. **Authentication errors**: Verify your DataForSEO credentials
3. **Module errors**: Check that `ENABLED_MODULES` contains valid module names
4. **Build failures**: Ensure Node.js version is 20+ (set in render.yaml)

### Logs

Check your Render service logs for detailed error information:
- Go to your service dashboard
- Click on "Logs" tab
- Look for startup errors or runtime issues

## Performance Considerations

- **Starter Plan**: Suitable for development and light usage
- **Professional Plan**: Recommended for production use with higher traffic
- **Memory**: The server is lightweight but consider upgrading if handling many concurrent requests

## Security Notes

- Always use HTTPS in production (Render provides this automatically)
- Store sensitive credentials as environment variables, never in code
- Consider implementing rate limiting for public deployments
- Use Basic Authentication for API access when possible