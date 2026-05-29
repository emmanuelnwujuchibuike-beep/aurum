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
    const payload = await req.json();
    const record = payload.record;

    // Only care about deposit/withdraw inserts
    if (!["deposit", "withdraw"].includes(record.type)) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const isDeposit = record.type === "deposit";
    const amt = Math.abs(Number(record.usd_amount || 0));
    const amtFormatted = amt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Aurum Capital <onboarding@resend.dev>",
        to: [Deno.env.get("NOTIFY_EMAIL")!],
        subject: `[Aurum] ${isDeposit ? "💰 New Deposit" : "📤 New Withdrawal"} Request — $${amtFormatted}`,
        html: `
          <div style="font-family:Arial,sans-serif;background:#040608;color:#edf2f8;padding:40px;border-radius:16px;max-width:600px;margin:0 auto">
            <h2 style="color:#c9a84c">${isDeposit ? "💰 Deposit Request" : "📤 Withdrawal Request"}</h2>
            <p style="color:#8c9db5;line-height:1.7">A user has submitted a <b style="color:#edf2f8">${record.type}</b> request that needs your approval.</p>
            
            <div style="background:#111820;border:1px solid #1e2d40;border-radius:12px;padding:20px;margin:24px 0">
              <table style="width:100%;border-collapse:collapse">
                <tr>
                  <td style="padding:10px 0;color:#5a6880;border-bottom:1px solid #1e2d40">Type</td>
                  <td style="padding:10px 0;color:#edf2f8;text-align:right;border-bottom:1px solid #1e2d40;text-transform:capitalize">${record.type}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#5a6880;border-bottom:1px solid #1e2d40">Amount</td>
                  <td style="padding:10px 0;color:#c9a84c;text-align:right;border-bottom:1px solid #1e2d40;font-weight:700;font-size:18px">$${amtFormatted}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#5a6880;border-bottom:1px solid #1e2d40">Coin</td>
                  <td style="padding:10px 0;color:#edf2f8;text-align:right;border-bottom:1px solid #1e2d40">${record.symbol || "—"}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#5a6880;border-bottom:1px solid #1e2d40">Status</td>
                  <td style="padding:10px 0;color:#f3ba2f;text-align:right;border-bottom:1px solid #1e2d40">⏳ Pending</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#5a6880">Note</td>
                  <td style="padding:10px 0;color:#8c9db5;text-align:right;font-size:12px">${record.note || "—"}</td>
                </tr>
              </table>
            </div>

            <a href="https://YOUR-SITE-URL/dashboard.html" 
               style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#c9a84c,#a87c28);color:#040608;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">
              Open Admin Panel →
            </a>

            <hr style="border-color:#1e2d40;margin:32px 0">
            <p style="color:#5a6880;font-size:12px">© 2025 Aurum Capital · Admin Notification</p>
          </div>
        `,
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});