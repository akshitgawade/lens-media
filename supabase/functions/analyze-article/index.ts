const BACKEND_URL = Deno.env.get("BACKEND_URL");

type AnalyzeRequest = {
  article_id: string;
  text: string;
  outlet_id: string;
  is_headline?: boolean;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  if (!BACKEND_URL) {
    return new Response(JSON.stringify({ error: "BACKEND_URL is not configured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  let body: AnalyzeRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const controller = new AbortController();
  const timeoutMs = 12_000;
  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    const backendResponse = await fetch(`${BACKEND_URL.replace(/\/$/, "")}/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        article_id: body.article_id,
        text: body.text,
        outlet_id: body.outlet_id,
        is_headline: body.is_headline ?? false,
      }),
      signal: controller.signal,
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      return new Response(
        JSON.stringify({
          success: false,
          error: errorText || `Backend returned ${backendResponse.status}`,
        }),
        {
          status: 502,
          headers: { "content-type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        job_id: body.article_id,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return new Response(
        JSON.stringify({
          success: true,
          job_id: body.article_id,
          queued: true,
        }),
        {
          status: 202,
          headers: { "content-type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  } finally {
    clearTimeout(timeout);
  }
});
