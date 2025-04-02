import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Get environment variables
  const clientId = process.env.ATLASSIAN_CLIENT_ID;

  // Validate required environment variables
  if (!clientId) {
    return res.status(500).json({
      error: 'Missing required environment variable: ATLASSIAN_CLIENT_ID'
    });
  }

  // Get the redirect_uri from the query parameters (this will be OpenAI's callback URL)
  const redirectUri = req.query.redirect_uri;
  if (!redirectUri || typeof redirectUri !== 'string') {
    return res.status(400).json({
      error: 'Missing or invalid redirect_uri parameter'
    });
  }

  // Build the authorization URL
  const authUrl = new URL('https://auth.atlassian.com/authorize');

  // Add required query parameters
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:jira-user read:jira-work write:jira-work',
    audience: 'api.atlassian.com',
    prompt: 'consent'
  });

  // Add optional state parameter if provided
  const state = req.query.state;
  if (state && typeof state === 'string') {
    params.append('state', state);
  }

  // Append parameters to URL
  authUrl.search = params.toString();

  // Redirect to Atlassian authorization URL
  res.redirect(authUrl.toString());
} 