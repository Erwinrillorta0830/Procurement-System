import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE_URL =
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    "http://100.110.197.61:8091";

const DIRECTUS_STATIC_TOKEN =
    process.env.DIRECTUS_STATIC_TOKEN ||
    process.env.DIRECTUS_SERVICE_TOKEN ||
    "";

function buildTargetUrl(pathParts: string[], search: string): string {
    const cleanBase = DIRECTUS_BASE_URL.replace(/\/+$/, "");
    const cleanPath = pathParts.map((part) => encodeURIComponent(part)).join("/");
    return `${cleanBase}/items/${cleanPath}${search}`;
}

function buildUpstreamHeaders(req: NextRequest): Headers {
    const headers = new Headers();

    const contentType = req.headers.get("content-type");
    if (contentType) {
        headers.set("content-type", contentType);
    }

    if (DIRECTUS_STATIC_TOKEN) {
        headers.set("authorization", `Bearer ${DIRECTUS_STATIC_TOKEN}`);
    } else {
        const authHeader = req.headers.get("authorization");
        if (authHeader) {
            headers.set("authorization", authHeader);
        }
    }

    return headers;
}

async function proxy(req: NextRequest, pathParts: string[]): Promise<NextResponse> {
    if (!DIRECTUS_BASE_URL) {
        return NextResponse.json(
            { error: "DIRECTUS_URL or NEXT_PUBLIC_API_BASE_URL is not configured." },
            { status: 500 }
        );
    }

    try {
        const url = new URL(req.url);
        const targetUrl = buildTargetUrl(pathParts, url.search);
        const headers = buildUpstreamHeaders(req);

        const method = req.method.toUpperCase();
        const hasBody = !["GET", "HEAD"].includes(method);

        const body = hasBody ? await req.text() : undefined;

        const upstream = await fetch(targetUrl, {
            method,
            headers,
            body,
            cache: "no-store",
        });

        const responseText = await upstream.text();

        const responseHeaders = new Headers();
        const upstreamContentType = upstream.headers.get("content-type");
        if (upstreamContentType) {
            responseHeaders.set("content-type", upstreamContentType);
        }

        return new NextResponse(responseText, {
            status: upstream.status,
            headers: responseHeaders,
        });
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : "Unexpected proxy error.";

        return NextResponse.json(
            {
                error: "Failed to proxy request to Directus.",
                details: message,
            },
            { status: 500 }
        );
    }
}

type RouteContext = {
    params: Promise<{
        path: string[];
    }>;
};

export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
    const { path } = await context.params;
    return proxy(req, path);
}

export async function POST(req: NextRequest, context: RouteContext): Promise<NextResponse> {
    const { path } = await context.params;
    return proxy(req, path);
}

export async function PATCH(req: NextRequest, context: RouteContext): Promise<NextResponse> {
    const { path } = await context.params;
    return proxy(req, path);
}

export async function PUT(req: NextRequest, context: RouteContext): Promise<NextResponse> {
    const { path } = await context.params;
    return proxy(req, path);
}

export async function DELETE(req: NextRequest, context: RouteContext): Promise<NextResponse> {
    const { path } = await context.params;
    return proxy(req, path);
}