import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the calling user is an admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Check admin role
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (!callerProfile || callerProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { username, full_name, role, password } = body;
      if (!username || !password) {
        return new Response(JSON.stringify({ error: "Username and password required" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const email = `${username.toLowerCase()}@esmac.local`;
      const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name || username,
          role: role || "staff",
          must_change_password: true,
        },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      return new Response(JSON.stringify({ success: true, user_id: authUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_password") {
      const { user_id, password } = body;
      if (!user_id || !password) {
        return new Response(JSON.stringify({ error: "User ID and password required" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        password,
      });
      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      // Set must_change_password
      await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
