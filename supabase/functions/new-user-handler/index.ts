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
    const body = await req.json();
    const { email, id, created_at, first_name, last_name } = body.record;
    const fullName = `${first_name || ""} ${last_name || ""}`.trim() || "Valued Client";

    // ── 1. Notify you ────────────────────────────
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Aurum Capital <onboarding@resend.dev>",
          to: [Deno.env.get("NOTIFY_EMAIL")!],
          subject: `🎉 New Client — ${fullName} (${email})`,
          html: `
            <div style="font-family:Arial,sans-serif;background:#040608;color:#edf2f8;
                        padding:40px;border-radius:16px;max-width:600px;margin:0 auto">
              <h2 style="color:#c9a84c">New Client Registration</h2>
              <p><b>Name:</b> ${fullName}</p>
              <p><b>Email:</b> ${email}</p>
              <p><b>User ID:</b> ${id}</p>
              <p><b>Signed up:</b> ${new Date(created_at).toLocaleString()}</p>
              <hr style="border-color:#1e2d40;margin:24px 0">
              <p style="color:#5a6880;font-size:12px">© 2025 Aurum Capital</p>
            </div>
          `,
        }),
      });
    } catch (e) {
      console.error("Admin notify failed:", e);
    }

    // ── 2. Welcome email to user ─────────────────
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Aurum Capital <onboarding@resend.dev>",
          to: [email],
          subject: `Welcome to Aurum Capital, ${first_name || ""}`,
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#040608;font-family:'Helvetica Neue',Arial,sans-serif">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#040608;padding:40px 20px">
    <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0"
           style="max-width:600px;background:#111820;border-radius:24px;
                  border:1px solid rgba(255,255,255,.08);overflow:hidden">

      <!-- ── GOLD HEADER ── -->
      <tr>
        <td style="background:linear-gradient(135deg,#0c1830 0%,#0a1428 100%);
                   padding:48px 48px 40px;text-align:center;
                   border-bottom:1px solid rgba(201,168,76,.2)">
          <div style="display:inline-block;width:56px;height:56px;border-radius:16px;
                      background:linear-gradient(135deg,#c9a84c,#a87c28);
                      text-align:center;line-height:56px;
                      font-size:24px;font-weight:900;color:#040608;
                      margin-bottom:20px">A</div>
          <div style="font-size:11px;letter-spacing:.3em;color:#c9a84c;
                      text-transform:uppercase;margin-bottom:6px">Aurum Capital</div>
          <h1 style="margin:0;font-size:32px;font-weight:300;color:#edf2f8;
                     letter-spacing:.02em;line-height:1.2">
            Welcome, <span style="color:#c9a84c;font-style:italic">${first_name || fullName}</span>
          </h1>
          <p style="margin:14px 0 0;font-size:14px;color:#8c9db5;line-height:1.6">
            Your account has been created successfully.<br>
            You now have access to the Aurum Capital investment platform.
          </p>
        </td>
      </tr>

      <!-- ── ACCOUNT DETAILS ── -->
      <tr>
        <td style="padding:36px 48px 0">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#172030;border:1px solid rgba(201,168,76,.12);
                        border-radius:16px;overflow:hidden">
            <tr>
              <td style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,.06)">
                <div style="font-size:10px;letter-spacing:.15em;color:#5a6880;
                            text-transform:uppercase;margin-bottom:4px">Account Name</div>
                <div style="font-size:15px;color:#edf2f8;font-weight:500">${fullName}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,.06)">
                <div style="font-size:10px;letter-spacing:.15em;color:#5a6880;
                            text-transform:uppercase;margin-bottom:4px">Email Address</div>
                <div style="font-size:15px;color:#edf2f8;font-weight:500">${email}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px">
                <div style="font-size:10px;letter-spacing:.15em;color:#5a6880;
                            text-transform:uppercase;margin-bottom:4px">Account Status</div>
                <div style="display:inline-flex;align-items:center;gap:8px">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;
                               background:#22c55e"></span>
                  <span style="font-size:15px;color:#22c55e;font-weight:500">Active</span>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- ── NEXT STEPS ── -->
      <tr>
        <td style="padding:36px 48px 0">
          <div style="font-size:10px;letter-spacing:.2em;color:#c9a84c;
                      text-transform:uppercase;margin-bottom:20px">// Next Steps</div>
          <table width="100%" cellpadding="0" cellspacing="0">

            <tr>
              <td style="padding:0 0 16px">
                <table width="100%" cellpadding="0" cellspacing="0"
                       style="background:#0d1520;border:1px solid rgba(255,255,255,.06);
                              border-radius:14px">
                  <tr>
                    <td style="padding:18px 20px;width:48px;vertical-align:top">
                      <div style="width:36px;height:36px;border-radius:10px;
                                  background:rgba(201,168,76,.12);
                                  border:1px solid rgba(201,168,76,.2);
                                  text-align:center;line-height:36px;
                                  font-size:16px">🪪</div>
                    </td>
                    <td style="padding:18px 20px 18px 0;vertical-align:top">
                      <div style="font-size:13px;font-weight:600;color:#edf2f8;
                                  margin-bottom:4px">Complete KYC Verification</div>
                      <div style="font-size:12px;color:#5a6880;line-height:1.5">
                        Verify your identity to unlock full trading access and higher limits.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:0 0 16px">
                <table width="100%" cellpadding="0" cellspacing="0"
                       style="background:#0d1520;border:1px solid rgba(255,255,255,.06);
                              border-radius:14px">
                  <tr>
                    <td style="padding:18px 20px;width:48px;vertical-align:top">
                      <div style="width:36px;height:36px;border-radius:10px;
                                  background:rgba(34,197,94,.1);
                                  border:1px solid rgba(34,197,94,.2);
                                  text-align:center;line-height:36px;
                                  font-size:16px">💰</div>
                    </td>
                    <td style="padding:18px 20px 18px 0;vertical-align:top">
                      <div style="font-size:13px;font-weight:600;color:#edf2f8;
                                  margin-bottom:4px">Fund Your Account</div>
                      <div style="font-size:12px;color:#5a6880;line-height:1.5">
                        Deposit via bank transfer, card, or crypto. Minimum deposit from $10.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:0 0 0">
                <table width="100%" cellpadding="0" cellspacing="0"
                       style="background:#0d1520;border:1px solid rgba(255,255,255,.06);
                              border-radius:14px">
                  <tr>
                    <td style="padding:18px 20px;width:48px;vertical-align:top">
                      <div style="width:36px;height:36px;border-radius:10px;
                                  background:rgba(98,126,234,.1);
                                  border:1px solid rgba(98,126,234,.2);
                                  text-align:center;line-height:36px;
                                  font-size:16px">📈</div>
                    </td>
                    <td style="padding:18px 20px 18px 0;vertical-align:top">
                      <div style="font-size:13px;font-weight:600;color:#edf2f8;
                                  margin-bottom:4px">Start Investing</div>
                      <div style="font-size:12px;color:#5a6880;line-height:1.5">
                        Explore Real Estate, Crypto, Equities and Gold opportunities.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

          </table>
        </td>
      </tr>

      <!-- ── CTA BUTTON ── -->
      <tr>
        <td style="padding:36px 48px">
          <a href="https://aurumcapital.com/dashboard.html"
             style="display:block;text-align:center;padding:16px 32px;
                    background:linear-gradient(135deg,#c9a84c,#a87c28);
                    color:#040608;font-weight:700;font-size:15px;
                    border-radius:14px;text-decoration:none;
                    letter-spacing:.02em">
            Go to My Dashboard →
          </a>
        </td>
      </tr>

      <!-- ── SUPPORT ── -->
      <tr>
        <td style="padding:0 48px 36px;text-align:center">
          <p style="font-size:13px;color:#5a6880;line-height:1.7;margin:0">
            Need help? Our advisors are available 24/7.<br>
            Reply to this email or visit
            <a href="https://aurumcapital.com/contact.html"
               style="color:#c9a84c;text-decoration:none">aurumcapital.com/contact</a>
          </p>
        </td>
      </tr>

      <!-- ── FOOTER ── -->
      <tr>
        <td style="padding:24px 48px;border-top:1px solid rgba(255,255,255,.06);
                   background:#080c12;text-align:center">
          <p style="margin:0 0 8px;font-size:11px;color:#5a6880;letter-spacing:.1em;
                    text-transform:uppercase">
            Aurum Capital · Dubai · London · New York · Singapore
          </p>
          <p style="margin:0;font-size:10px;color:#2a3a50">
            Regulated · Secure · Trusted · © 2025 Aurum Capital. All rights reserved.
          </p>
        </td>
      </tr>

    </table>
    </td></tr>
  </table>

</body>
</html>
          `,
        }),
      });
    } catch (e) {
      console.error("Welcome email failed:", e);
    }

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
