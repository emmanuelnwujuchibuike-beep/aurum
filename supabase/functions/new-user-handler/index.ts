import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { email, created_at, id } = body.record;

    // Notify you
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Aurum Capital <onboarding@resend.dev>",
        to: [Deno.env.get("NOTIFY_EMAIL")!],
        subject: `🎉 New User — ${body.record.first_name} ${body.record.last_name} (${email})`,
        html: `
          <div style="font-family:Arial,sans-serif;background:#040608;
                      color:#edf2f8;padding:40px;border-radius:16px;
                      max-width:600px;margin:0 auto">
            <h2 style="color:#c9a84c">New User Registration</h2>
            <p><b>Email:</b> ${email}</p>
            <p><b>User ID:</b> ${id}</p>
            <p><b>Signed up:</b> ${new Date(created_at).toLocaleString()}</p>
            <hr style="border-color:#1e2d40;margin:24px 0">
            <p style="color:#5a6880;font-size:12px">
              © 2025 Aurum Capital
            </p>
          </div>
        `,
      }),
    });

    // Welcome email to user
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Aurum Capital <onboarding@resend.dev>",
        to: [email],
        subject: "Welcome to Aurum Capital 🏆",
        html: `
          <div style="font-family:Arial,sans-serif;background:#040608;
                      color:#edf2f8;padding:40px;border-radius:16px;
                      max-width:600px;margin:0 auto">
            <h2 style="color:#c9a84c">Welcome to Aurum Capital</h2>
            <p style="color:#8c9db5;line-height:1.7">
              Your account has been created successfully. 
              Complete your KYC verification to start investing.
            </p>
            <a href="https://aurumcapital.com/dashboard" 
               style="display:inline-block;margin-top:20px;padding:12px 28px;
                      background:linear-gradient(135deg,#c9a84c,#a87c28);
                      color:#040608;font-weight:700;border-radius:12px;
                      text-decoration:none">
              Go to Dashboard
            </a>
            <hr style="border-color:#1e2d40;margin:24px 0">
            <p style="color:#5a6880;font-size:12px">
              © 2025 Aurum Capital · Dubai · London · New York · Singapore
            </p>
          </div>
        `,
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

