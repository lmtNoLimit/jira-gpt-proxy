import type { NextApiRequest, NextApiResponse } from 'next';

const JIRA_API_BASE_URL = 'https://bravebits.jira.com/rest/api/3/';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Extract authorization header and check for token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Get the path from the dynamic route parameter
    const { path } = req.query;
    
    // Ensure path is an array
    const pathArray = Array.isArray(path) ? path : [path];
    
    // Reconstruct the path for the Jira API
    const jiraPath = pathArray.join('/');
    
    // Build the full URL including query parameters
    const url = new URL(`${JIRA_API_BASE_URL}${jiraPath}`);
    
    // Add query parameters (excluding the path parameter)
    Object.entries(req.query).forEach(([key, value]) => {
      if (key !== 'path') {
        // Handle array values
        if (Array.isArray(value)) {
          value.forEach(v => url.searchParams.append(key, v));
        } else if (value !== undefined) {
          url.searchParams.append(key, value as string);
        }
      }
    });

    // Prepare headers for the Jira API request
    const headers: HeadersInit = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
    
    // Copy relevant headers from the original request
    // (excluding headers that would conflict with our request)
    Object.entries(req.headers).forEach(([key, value]) => {
      if (
        !['host', 'content-length', 'connection', 'authorization'].includes(key.toLowerCase()) && 
        value !== undefined
      ) {
        headers[key] = value as string;
      }
    });

    // Prepare request options
    const requestOptions: RequestInit = {
      method: req.method,
      headers,
    };

    // Add body for non-GET requests
    if (req.method !== 'GET' && req.body) {
      requestOptions.body = typeof req.body === 'string' 
        ? req.body 
        : JSON.stringify(req.body);
    }

    // Forward the request to Jira API
    const jiraResponse = await fetch(url.toString(), requestOptions);
    
    // Get response data`
    const responseData = await jiraResponse.text();
    
    // Set response status code
    res.status(jiraResponse.status);
    
    // Set response headers
    jiraResponse.headers.forEach((value, key) => {
      // Skip headers that Next.js manages
      if (!['content-length', 'connection', 'transfer-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // Parse and send the response JSON if possible, otherwise send as text
    if (responseData) {
      try {
        const parsedData = JSON.parse(responseData);
        return res.json(parsedData);
      } catch {
        // If not valid JSON, return as text
        return res.send(responseData);
      }
    } else {
      // Handle empty response
      return res.end();
    }
  } catch (error) {
    console.error('Jira API proxy error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    });
  }
} 