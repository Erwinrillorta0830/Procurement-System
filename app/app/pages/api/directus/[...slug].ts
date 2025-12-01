// pages/api/directus/[...slug].ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { slug } = req.query;
    if (!slug || !Array.isArray(slug)) {
        return res.status(400).json({ error: 'Invalid path' });
    }

    // Rebuild Directus URL
    let directusUrl = `${process.env.NEXT_PUBLIC_DIRECTUS_URL}/${slug.join('/')}`;

    // Append query string if exists
    const queryString = req.url?.split('?')[1];
    if (queryString) directusUrl += `?${queryString}`;

    try {
        const directusRes = await fetch(directusUrl, {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
                ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
            },
            body: ['GET', 'HEAD'].includes(req.method || '') ? undefined : JSON.stringify(req.body),
        });

        const data = await directusRes.json();
        res.status(directusRes.status).json(data);
    } catch (err) {
        console.error('Directus proxy error:', err);
        res.status(500).json({ error: 'Failed to fetch from Directus' });
    }
}
