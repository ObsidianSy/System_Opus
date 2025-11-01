import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../src/server';

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:3000',
  'https://system-opus.vercel.app',
  'https://system-opus-lz56.vercel.app'
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Encaminha para o app Express preservando a URL
  // @ts-ignore
  return new Promise<void>((resolve, reject) => {
    // @ts-ignore
    app(req, res);
    res.on('finish', () => resolve());
    res.on('error', reject);
  });
}
