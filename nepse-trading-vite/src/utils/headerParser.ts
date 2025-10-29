/**
 * Header Parser Utility
 * Converts Chrome DevTools headers into JSON format for the TMS API
 */

export interface ParsedHeaders {
  'x-xsrf-token': string;
  'host-session-id': string;
  'membercode': string;
  'request-owner': string;
  'cookie': string;
}

/**
 * Parses raw header text from Chrome DevTools into structured JSON
 * Handles the format where headers are on separate lines with key on one line and value on the next
 */
export function parseHeaders(headerText: string): ParsedHeaders {
  const lines = headerText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line);

  const headers: Record<string, string> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = i + 1 < lines.length ? lines[i + 1] : '';

    // Skip HTTP/2 pseudo-headers that start with :
    if (line.startsWith(':')) continue;

    // If current line has no spaces/equals and next line does, it's a key-value pair
    if (!line.includes(' ') && !line.includes('=') && nextLine) {
      headers[line.toLowerCase()] = nextLine;
    }
  }

  // Extract the important headers we need
  const result: ParsedHeaders = {
    'x-xsrf-token': headers['x-xsrf-token'] || '',
    'host-session-id': headers['host-session-id'] || '',
    'membercode': headers['membercode'] || '',
    'request-owner': headers['request-owner'] || '',
    'cookie': headers['cookie'] || ''
  };

  return result;
}

/**
 * Checks if the input looks like raw headers (not JSON)
 */
export function isRawHeaders(input: string): boolean {
  const trimmed = input.trim();

  // If it starts with { or [, it's likely JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return false;
  }

  // If it contains typical header names, it's raw headers
  const headerPatterns = [
    'x-xsrf-token',
    'host-session-id',
    'membercode',
    'cookie',
    'content-type',
    'user-agent'
  ];

  const lowerInput = trimmed.toLowerCase();
  return headerPatterns.some(pattern => lowerInput.includes(pattern));
}

/**
 * Smart parse function that handles both JSON and raw header formats
 */
export function smartParseHeaders(input: string): ParsedHeaders {
  const trimmed = input.trim();

  // Try to detect if it's JSON
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      // Ensure all required fields exist
      return {
        'x-xsrf-token': parsed['x-xsrf-token'] || '',
        'host-session-id': parsed['host-session-id'] || '',
        'membercode': parsed['membercode'] || '',
        'request-owner': parsed['request-owner'] || '',
        'cookie': parsed['cookie'] || ''
      };
    } catch (e) {
      // If JSON parse fails, fall through to raw header parsing
    }
  }

  // Parse as raw headers
  return parseHeaders(trimmed);
}
