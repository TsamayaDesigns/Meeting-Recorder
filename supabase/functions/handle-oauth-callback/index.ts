import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const url = new URL(req.url);
  const pathname = url.pathname;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (pathname.includes("/google/callback")) {
      return handleGoogleCallback(req, supabase);
    } else if (pathname.includes("/zoom/callback")) {
      return handleZoomCallback(req, supabase);
    }

    return new Response(
      JSON.stringify({ error: "Unknown OAuth provider" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("OAuth callback error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function handleGoogleCallback(
  req: Request,
  supabase: any
): Promise<Response> {
  const { code, state }: { code: string; state: string } = await req.json();

  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI")!;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to exchange Google auth code");
  }

  const tokenData = await response.json();

  const userResponse = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
      },
    }
  );

  const userData = await userResponse.json();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("User not authenticated");
  }

  await supabase.from("oauth_integrations").upsert(
    {
      user_id: user.id,
      provider: "google",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: new Date(
        Date.now() + tokenData.expires_in * 1000
      ).toISOString(),
      provider_user_id: userData.id,
      email: userData.email,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,provider",
    }
  );

  return new Response(
    JSON.stringify({
      success: true,
      message: "Google Calendar connected successfully",
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleZoomCallback(
  req: Request,
  supabase: any
): Promise<Response> {
  const { code, state }: { code: string; state: string } = await req.json();

  const ZOOM_CLIENT_ID = Deno.env.get("ZOOM_CLIENT_ID")!;
  const ZOOM_CLIENT_SECRET = Deno.env.get("ZOOM_CLIENT_SECRET")!;
  const REDIRECT_URI = Deno.env.get("ZOOM_REDIRECT_URI")!;

  const authHeader = `Basic ${btoa(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`)}`;

  const response = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error("Failed to exchange Zoom auth code");
  }

  const tokenData = await response.json();

  const userResponse = await fetch("https://api.zoom.us/v2/users/me", {
    headers: {
      "Authorization": `Bearer ${tokenData.access_token}`,
    },
  });

  const userData = await userResponse.json();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("User not authenticated");
  }

  await supabase.from("oauth_integrations").upsert(
    {
      user_id: user.id,
      provider: "zoom",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: new Date(
        Date.now() + tokenData.expires_in * 1000
      ).toISOString(),
      provider_user_id: userData.id,
      email: userData.email,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,provider",
    }
  );

  return new Response(
    JSON.stringify({
      success: true,
      message: "Zoom connected successfully",
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}