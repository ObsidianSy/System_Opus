import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGIN = 'https://system-opus.vercel.app';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  const origin = req.headers.origin as string | undefined;
  if (origin === ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  res.status(200).json({ ok: true, ts: new Date().toISOString() });
}
