/**
 * Header Parser Utility
 * Converts Chrome DevTools headers into JSON format for the TMS API
 */

const fs = require('fs');
const path = require('path');

// Read input from file if provided, otherwise from stdin
const inputFile = process.argv[2];

function parseHeaders(headerText) {
  const lines = headerText.split('\n').map(line => line.trim()).filter(line => line);
  const headers = {};

  let currentKey = null;

  for (let line of lines) {
    // Skip HTTP/2 pseudo-headers that start with :
    if (line.startsWith(':')) {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        // Skip these, they're not needed for our API client
        continue;
      }
    }

    // Check if this line looks like a header key (no spaces, followed by value on next line)
    if (!line.includes(' ') && !line.includes('=') && lines.indexOf(line) < lines.length - 1) {
      currentKey = line.toLowerCase();
    } else if (currentKey) {
      // This is the value for the previous key
      headers[currentKey] = line;
      currentKey = null;
    }
  }

  // Extract the important headers we need
  const result = {
    'x-xsrf-token': headers['x-xsrf-token'] || '',
    'host-session-id': headers['host-session-id'] || '',
    'membercode': headers['membercode'] || '',
    'request-owner': headers['request-owner'] || '',
    'cookie': headers['cookie'] || ''
  };

  return result;
}

function parseHeadersAlternative(headerText) {
  const lines = headerText.split('\n').map(line => line.trim()).filter(line => line);
  const headers = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = i + 1 < lines.length ? lines[i + 1] : '';

    // Skip pseudo-headers
    if (line.startsWith(':')) continue;

    // If current line has no spaces/equals and next line does, it's a key-value pair
    if (!line.includes(' ') && !line.includes('=') && nextLine) {
      headers[line.toLowerCase()] = nextLine;
    }
  }

  const result = {
    'x-xsrf-token': headers['x-xsrf-token'] || '',
    'host-session-id': headers['host-session-id'] || '',
    'membercode': headers['membercode'] || '',
    'request-owner': headers['request-owner'] || '',
    'cookie': headers['cookie'] || ''
  };

  return result;
}

// Main execution
if (inputFile) {
  // Read from file
  const headerText = fs.readFileSync(inputFile, 'utf-8');
  const parsed = parseHeadersAlternative(headerText);
  console.log(JSON.stringify(parsed, null, 2));
} else {
  // Read from stdin
  let input = '';
  process.stdin.setEncoding('utf-8');

  process.stdin.on('data', chunk => {
    input += chunk;
  });

  process.stdin.on('end', () => {
    const parsed = parseHeadersAlternative(input);
    console.log(JSON.stringify(parsed, null, 2));
  });
}
