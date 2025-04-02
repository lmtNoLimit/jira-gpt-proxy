import type { NextApiRequest, NextApiResponse } from 'next';

type TokenResponse = {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
};

type ErrorResponse = {
  error: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TokenResponse | ErrorResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, client_id, redirect_uri } = req.body;

    // Validate required body parameters
    if (!code || !client_id || !redirect_uri) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({
        error: 'Missing required parameters: code, client_id, or redirect_uri'
      });
    }

    // Get client secret from environment
    const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET;
    if (!clientSecret) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({
        error: 'Missing ATLASSIAN_CLIENT_SECRET environment variable'
      });
    }

    // Exchange code for token
    const response = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id,
        client_secret: clientSecret,
        redirect_uri
      })
    });

    const data = await response.json();

    // Validate Atlassian response
    if (!response.ok || !data.access_token || !data.refresh_token || !data.expires_in) {
      console.error('Atlassian token exchange error:', data);
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({
        error: data.error_description || data.error || 'Invalid response from Atlassian'
      });
    }

    // Return exactly the required fields in the specified format
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      access_token: data.access_token,
      token_type: 'Bearer',
      expires_in: data.expires_in,
      refresh_token: data.refresh_token
    });

  } catch (error) {
    console.error('Token exchange error:', error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
} 