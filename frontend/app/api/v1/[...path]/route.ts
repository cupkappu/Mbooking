import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path);
}

async function proxyRequest(request: NextRequest, path: string[]) {
  const pathString = path.join('/');
  const url = new URL(`/api/v1/${pathString}`, process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'connection') {
      headers[key] = value;
    }
  });

  try {
    // Do not automatically follow redirects from backend; return them to the client
    const response = await fetch(url.toString(), {
      method: request.method,
      headers,
      body: request.body,
      cache: 'no-store',
      redirect: 'manual',
    });

    const responseHeaders = new Headers();

    // Copy response headers from backend, excluding hop-by-hop headers
    const hopByHop = new Set([
      'connection',
      'keep-alive',
      'transfer-encoding',
      'upgrade',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailer',
      'proxy-connection',
      'sec-websocket-accept',
    ]);

    response.headers.forEach((value, key) => {
      if (!hopByHop.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    // Ensure Content-Type is present
    if (!responseHeaders.has('content-type')) {
      responseHeaders.set('content-type', response.headers.get('content-type') || 'application/json');
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new NextResponse(
      JSON.stringify({ error: 'Backend unavailable', message }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
