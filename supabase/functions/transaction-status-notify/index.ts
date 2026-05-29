import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const oldRecord = payload.old_record;

    // Only fire when status actually changed to approved or rejected
    if (!oldRecord || record.status === oldRecord.status) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }
    if (!["approved", "rejected"].includes(record.status)) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    // Get user's email from profiles table
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, first_name")
      .eq("id", record.user_id)
      .single();

    if (!profile?.email) {
      return new Response(JSON.stringify({ skipped: "no email" }), { status: 200 });
    }

    const isApproved = record.status === "approved";
    const isDeposit = record.type === "deposit";
    const amt = Math.abs(Number(record.usd_amount || 0));
    const amtFormatted = amt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const firstName = profile.first_name || "Investor";

    const subject = isApproved
      ? `✅ Your ${isDeposit ? "deposit" : "withdrawal"} of $${amtFormatted} has been approved`
      : `❌ Your ${isDeposit ? "deposit" : "withdrawal"} of $${amtFormatted} was not approved`;

    const html = isApproved ? `
      <div style="font-family:Arial,sans-serif;background:#040608;color:#edf2f8;padding:40px;border-radius:16px;max-width:600px;margin:0 auto">
        <h2 style="color:#22c55e">✅ ${isDeposit ? "Deposit" : "Withdrawal"} Approved</h2>
        <p style="color:#8c9db5;line-height:1.7">Hi <b style="color:#edf2f8">${firstName}</b>, great news! Your ${record.type} request has been approved.</p>

        <div style="background:#111820;border:1px solid #1e2d40;border-radius:12px;padding:20px;margin:24px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:10px 0;color:#5a6880;border-bottom:1px solid #1e2d40">Type</td>
              <td style="padding:10px 0;color:#edf2f8;text-align:right;border-bottom:1px solid #1e2d40;text-transform:capitalize">${record.type}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#5a6880;border-bottom:1px solid #1e2d40">Amount</td>
              <td style="padding:10px 0;color:#22c55e;text-align:right;border-bottom:1px solid #1e2d40;font-weight:700;font-size:18px">$${amtFormatted}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#5a6880;border-bottom:1px solid #1e2d40">Coin</td>
              <td style="padding:10px 0;color:#edf2f8;text-align:right;border-bottom:1px solid #1e2d40">${record.symbol || "—"}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#5a6880">Status</td>
              <td style="padding:10px 0;color:#22c55e;text-align:right;font-weight:700">✅ Approved</td>
            </tr>
          </table>
        </div>

        ${isDeposit
          ? `<p style="color:#8c9db5;line-height:1.7">Your cash balance has been credited. Log in to view your updated balance.</p>`
          : `<p style="color:#8c9db5;line-height:1.7">Your withdrawal is being processed and will be sent to your wallet shortly.</p>`
        }

        <a href="https://auruminvest.netlify.app/dashboard.html"
           style="display:inline-block;margin-top:24px;padding:14px 28px;background:linear-gradient(135deg,#c9a84c,#a87c28);color:#040608;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">
          View Dashboard →
        </a>

        <hr style="border-color:#1e2d40;margin:32px 0">
        <p style="color:#5a6880;font-size:12px">© 2025 Aurum Capital · Dubai · London · New York · Singapore</p>
      </div>
    ` : `
      <div style="font-family:Arial,sans-serif;background:#040608;color:#edf2f8;padding:40px;border-radius:16px;max-width:600px;margin:0 auto">
        <h2 style="color:#ef4444">❌ ${isDeposit ? "Deposit" : "Withdrawal"} Not Approved</h2>
        <p style="color:#8c9db5;line-height:1.7">Hi <b style="color:#edf2f8">${firstName}</b>, unfortunately your ${record.type} request was not approved at this time.</p>

        <div style="background:#111820;border:1px solid #1e2d40;border-radius:12px;padding:20px;margin:24px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:10px 0;color:#5a6880;border-bottom:1px solid #1e2d40">Type</td>
              <td style="padding:10px 0;color:#edf2f8;text-align:right;border-bottom:1px solid #1e2d40;text-transform:capitalize">${record.type}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#5a6880;border-bottom:1px solid #1e2d40">Amount</td>
              <td style="padding:10px 0;color:#ef4444;text-align:right;border-bottom:1px solid #1e2d40;font-weight:700;font-size:18px">$${amtFormatted}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#5a6880;border-bottom:1px solid #1e2d40">Coin</td>
              <td style="padding:10px 0;color:#edf2f8;text-align:right;border-bottom:1px solid #1e2d40">${record.symbol || "—"}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#5a6880">Status</td>
              <td style="padding:10px 0;color:#ef4444;text-align:right;font-weight:700">❌ Rejected</td>
            </tr>
          </table>
        </div>

        <p style="color:#8c9db5;line-height:1.7">If you believe this is an error or need assistance, please contact our support team.</p>

        <a href="https://auruminvest.netlify.app/dashboard.html"
           style="display:inline-block;margin-top:24px;padding:14px 28px;background:linear-gradient(135deg,#c9a84c,#a87c28);color:#040608;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">
          Contact Support →
        </a>

        <hr style="border-color:#1e2d40;margin:32px 0">
        <p style="color:#5a6880;font-size:12px">© 2025 Aurum Capital · Dubai · London · New York · Singapore</p>
      </div>
    `;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Aurum Capital <onboarding@resend.dev>",
        to: [profile.email],
        subject,
        html,
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