#!/usr/bin/env node

/**
 * Simple test script to verify the MCP server deployment
 * Usage: node test-deployment.js [server-url]
 */

const https = require('https');
const http = require('http');

const serverUrl = process.argv[2] || 'http://localhost:3000';
const isHttps = serverUrl.startsWith('https://');
const client = isHttps ? https : http;

console.log(`Testing MCP server at: ${serverUrl}`);

// Test 1: Health check
function testHealthCheck() {
  return new Promise((resolve, reject) => {
    const url = `${serverUrl}/health`;
    console.log('\n1. Testing health check endpoint...');
    
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const health = JSON.parse(data);
          console.log('✅ Health check passed:', health);
          resolve();
        } else {
          console.log('❌ Health check failed:', res.statusCode, data);
          reject(new Error(`Health check failed: ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

// Test 2: MCP Initialize request
function testMCPInitialize() {
  return new Promise((resolve, reject) => {
    console.log('\n2. Testing MCP initialize request...');
    
    const postData = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "test-client",
          version: "1.0"
        }
      }
    });

    const url = new URL(`${serverUrl}/mcp`);
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 401) {
          console.log('✅ MCP endpoint requires authentication (expected)');
          console.log('   Response:', data);
          resolve();
        } else if (res.statusCode === 200) {
          console.log('✅ MCP initialize successful:', JSON.parse(data));
          resolve();
        } else {
          console.log('❌ MCP initialize failed:', res.statusCode, data);
          reject(new Error(`MCP initialize failed: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Test 3: CORS headers
function testCORS() {
  return new Promise((resolve, reject) => {
    console.log('\n3. Testing CORS headers...');
    
    const url = new URL(`${serverUrl}/health`);
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'OPTIONS'
    };

    const req = client.request(options, (res) => {
      const corsHeaders = {
        'access-control-allow-origin': res.headers['access-control-allow-origin'],
        'access-control-allow-methods': res.headers['access-control-allow-methods'],
        'access-control-allow-headers': res.headers['access-control-allow-headers']
      };
      
      if (corsHeaders['access-control-allow-origin']) {
        console.log('✅ CORS headers present:', corsHeaders);
        resolve();
      } else {
        console.log('❌ CORS headers missing');
        reject(new Error('CORS headers missing'));
      }
    });

    req.on('error', reject);
    req.end();
  });
}

// Run all tests
async function runTests() {
  try {
    await testHealthCheck();
    await testMCPInitialize();
    await testCORS();
    
    console.log('\n🎉 All tests passed! Server is ready for deployment.');
    console.log('\nNext steps:');
    console.log('1. Set up your DataForSEO credentials as environment variables');
    console.log('2. Test with actual MCP client using Basic Authentication');
    console.log('3. Monitor server logs for any issues');
    
  } catch (error) {
    console.error('\n❌ Tests failed:', error.message);
    process.exit(1);
  }
}

runTests();