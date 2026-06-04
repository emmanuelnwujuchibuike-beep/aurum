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

    // Only fire for approved or rejected status
    if (!["approved", "rejected"].includes(record.status)) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ✅ FIX: Query the profiles table for email directly
    // This is more reliable than auth.admin.getUserById in webhook context
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, email")
      .eq("id", record.user_id)
      .single();

    // Fallback: try auth admin if profile has no email
    let userEmail = profile?.email;

    if (!userEmail) {
      try {
        const { data: authData } = await supabase.auth.admin.getUserById(record.user_id);
        userEmail = authData?.user?.email;
      } catch (_) {
        // silently continue
      }
    }

    // Last resort: query auth.users via raw SQL (service role only)
    if (!userEmail) {
      const { data: authUser } = await supabase
        .rpc("get_user_email_by_id", { uid: record.user_id });
      userEmail = authUser;
    }

    if (!userEmail) {
      console.error("No email found for user:", record.user_id);
      return new Response(JSON.stringify({ skipped: "no email found" }), { status: 200 });
    }

    const adminEmail = Deno.env.get("NOTIFY_EMAIL")!;
    const firstName = profile?.first_name || "Valued Investor";
    const isApproved = record.status === "approved";
    const isDeposit = record.type === "deposit";
    const amt = Math.abs(Number(record.usd_amount || 0));
    const amtFormatted = amt.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const txType = isDeposit ? "Deposit" : "Withdrawal";
    const now = new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });

    const subject = isApproved
      ? `✅ ${txType} of $${amtFormatted} Approved — Aurum Capital`
      : `Action Required: ${txType} of $${amtFormatted} Not Approved — Aurum Capital`;

    // ─── PREMIUM EMAIL TEMPLATE ───────────────────────────────────────────────
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#07080a;font-family:'Georgia',serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07080a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- ── HEADER ── -->
          <tr>
            <td style="background:linear-gradient(135deg,#0e1117 0%,#141a24 100%);border-radius:16px 16px 0 0;padding:36px 40px 28px;border-bottom:1px solid #1a2535;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <!-- Logo wordmark -->
                    <div style="display:inline-block;">
                      <span style="font-size:22px;font-weight:700;letter-spacing:3px;color:#c9a84c;text-transform:uppercase;font-family:'Georgia',serif;">AURUM</span>
                      <span style="font-size:22px;font-weight:300;letter-spacing:3px;color:#8ca0b8;text-transform:uppercase;font-family:'Georgia',serif;"> CAPITAL</span>
                    </div>
                    <div style="margin-top:4px;">
                      <span style="font-size:10px;letter-spacing:2px;color:#3d5068;text-transform:uppercase;">Private Investment Platform</span>
                    </div>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <div style="
                      display:inline-block;
                      padding:6px 14px;
                      border-radius:20px;
                      font-size:11px;
                      letter-spacing:1px;
                      font-family:Arial,sans-serif;
                      font-weight:700;
                      text-transform:uppercase;
                      background:${isApproved ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)"};
                      color:${isApproved ? "#22c55e" : "#ef4444"};
                      border:1px solid ${isApproved ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"};
                    ">${isApproved ? "✓ Approved" : "✗ Rejected"}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── HERO BAND ── -->
          <tr>
            <td style="
              background:${isApproved
                ? "linear-gradient(135deg,#0a1f0e 0%,#0d1a10 50%,#0e1117 100%)"
                : "linear-gradient(135deg,#1a0a0a 0%,#1a0d0d 50%,#0e1117 100%)"};
              padding:32px 40px;
              border-left:3px solid ${isApproved ? "#22c55e" : "#ef4444"};
            ">
              <p style="margin:0 0 6px;font-size:12px;letter-spacing:2px;color:${isApproved ? "#22c55e" : "#ef4444"};text-transform:uppercase;font-family:Arial,sans-serif;">${txType} ${isApproved ? "Confirmed" : "Not Approved"}</p>
              <h1 style="margin:0 0 10px;font-size:32px;color:#edf2f8;font-weight:400;letter-spacing:-0.5px;font-family:'Georgia',serif;">
                ${isApproved ? `Your funds are ${isDeposit ? "credited" : "on their way"}` : "We couldn't process this request"}
              </h1>
              <p style="margin:0;font-size:15px;color:#6b8099;line-height:1.7;font-family:Arial,sans-serif;">
                Hi <strong style="color:#c9a84c;">${firstName}</strong> — 
                ${isApproved
                  ? isDeposit
                    ? `your deposit has been verified and credited to your portfolio balance.`
                    : `your withdrawal has been approved and is being processed to your wallet.`
                  : `your ${record.type} request requires attention. Please review the details below or contact our support team.`
                }
              </p>
            </td>
          </tr>

          <!-- ── TRANSACTION CARD ── -->
          <tr>
            <td style="background:#0c1018;padding:32px 40px;">

              <p style="margin:0 0 16px;font-size:10px;letter-spacing:2px;color:#3d5068;text-transform:uppercase;font-family:Arial,sans-serif;">Transaction Summary</p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#111820;border:1px solid #1a2535;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #1a2535;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:12px;color:#3d5068;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:1px;">Reference</td>
                        <td align="right" style="font-size:12px;color:#8ca0b8;font-family:Arial,sans-serif;font-weight:700;letter-spacing:1px;">#${String(record.id || "—").substring(0, 8).toUpperCase()}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #1a2535;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#5a7080;font-family:Arial,sans-serif;">Transaction Type</td>
                        <td align="right" style="font-size:13px;color:#edf2f8;font-family:Arial,sans-serif;text-transform:capitalize;font-weight:600;">${record.type}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px;border-bottom:1px solid #1a2535;background:${isApproved ? "rgba(34,197,94,0.04)" : "rgba(239,68,68,0.04)"};">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#5a7080;font-family:Arial,sans-serif;">Amount</td>
                        <td align="right">
                          <span style="font-size:26px;font-weight:700;color:${isApproved ? "#22c55e" : "#ef4444"};font-family:'Georgia',serif;">$${amtFormatted}</span>
                          <span style="font-size:12px;color:#3d5068;font-family:Arial,sans-serif;"> USD</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #1a2535;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#5a7080;font-family:Arial,sans-serif;">Asset</td>
                        <td align="right" style="font-size:13px;color:#edf2f8;font-family:Arial,sans-serif;font-weight:600;">${record.symbol || "—"}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #1a2535;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#5a7080;font-family:Arial,sans-serif;">Date</td>
                        <td align="right" style="font-size:13px;color:#8ca0b8;font-family:Arial,sans-serif;">${now}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#5a7080;font-family:Arial,sans-serif;">Status</td>
                        <td align="right">
                          <span style="
                            display:inline-block;
                            padding:4px 12px;
                            border-radius:20px;
                            font-size:11px;
                            letter-spacing:1px;
                            font-family:Arial,sans-serif;
                            font-weight:700;
                            text-transform:uppercase;
                            background:${isApproved ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)"};
                            color:${isApproved ? "#22c55e" : "#ef4444"};
                            border:1px solid ${isApproved ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"};
                          ">${isApproved ? "✓ Approved" : "✗ Rejected"}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ── NEXT STEPS ── -->
          <tr>
            <td style="background:#0c1018;padding:0 40px 32px;">
              ${isApproved ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0d1a0f,#0c1410);border:1px solid rgba(34,197,94,0.15);border-radius:12px;padding:20px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;color:#22c55e;text-transform:uppercase;font-family:Arial,sans-serif;">What Happens Next</p>
                    <p style="margin:0;font-size:14px;color:#8ca0b8;line-height:1.8;font-family:Arial,sans-serif;">
                      ${isDeposit
                        ? "Your portfolio balance has been updated. Log in to view your positions, allocate funds, or explore new investment opportunities."
                        : "Your withdrawal is being processed. Funds will arrive in your designated wallet within 1–3 business days depending on network conditions."
                      }
                    </p>
                  </td>
                </tr>
              </table>
              ` : `
              <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1a0d0d,#150d0d);border:1px solid rgba(239,68,68,0.15);border-radius:12px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;color:#ef4444;text-transform:uppercase;font-family:Arial,sans-serif;">Next Steps</p>
                    <p style="margin:0;font-size:14px;color:#8ca0b8;line-height:1.8;font-family:Arial,sans-serif;">
                      If you believe this decision was made in error, or if you need clarification, our support team is available to assist you. Please reference your transaction ID when reaching out.
                    </p>
                  </td>
                </tr>
              </table>
              `}
            </td>
          </tr>

          <!-- ── CTA BUTTON ── -->
          <tr>
            <td style="background:#0c1018;padding:0 40px 40px;text-align:center;">
              <a href="${isApproved ? "https://auruminvest.netlify.app/dashboard.html" : "https://auruminvest.netlify.app/contact.html"}"
                 style="
                   display:inline-block;
                   padding:16px 40px;
                   background:linear-gradient(135deg,#c9a84c 0%,#a87c28 100%);
                   color:#040608;
                   border-radius:8px;
                   text-decoration:none;
                   font-weight:700;
                   font-size:13px;
                   letter-spacing:1.5px;
                   text-transform:uppercase;
                   font-family:Arial,sans-serif;
                   box-shadow:0 8px 24px rgba(201,168,76,0.2);
                 ">
                ${isApproved ? "View Dashboard →" : "Contact Support →"}
              </a>
            </td>
          </tr>

          <!-- ── DIVIDER ── -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,#1a2535,transparent);"></div>
            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="background:#0c1018;border-radius:0 0 16px 16px;padding:28px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;font-size:13px;color:#c9a84c;font-family:'Georgia',serif;letter-spacing:1px;">AURUM CAPITAL</p>
                    <p style="margin:0;font-size:11px;color:#2d3f55;font-family:Arial,sans-serif;letter-spacing:0.5px;">Dubai · London · New York · Singapore</p>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <p style="margin:0;font-size:11px;color:#2d3f55;font-family:Arial,sans-serif;">© 2025 Aurum Capital</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#2d3f55;font-family:Arial,sans-serif;">All rights reserved</p>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top:16px;">
                    <p style="margin:0;font-size:10px;color:#1e2d3d;font-family:Arial,sans-serif;line-height:1.6;">
                      This email was sent to you because you have an active account with Aurum Capital. 
                      If you did not initiate this transaction, please contact our security team immediately.
                      This message contains confidential financial information intended only for the named recipient.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
    // ─────────────────────────────────────────────────────────────────────────

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: 'noreply@aurumcapitalinvest.com',
        to: [userEmail],          // ✅ send to user
        bcc: [adminEmail],        // ✅ silently CC admin (user won't see it)
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("Resend error:", errText);
      return new Response(JSON.stringify({ success: false, error: errText }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, sentTo: userEmail }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});