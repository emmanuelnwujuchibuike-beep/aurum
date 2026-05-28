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
    const { formType, ...fields } = body;

    // 1. Save to Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabase.from("contact_submissions").insert({
      form_type:    formType,
      name:         fields.name        || null,
      email:        fields.email       || null,
      message:      fields.message     || null,
      subject:      fields.subject     || null,
      budget:       fields.budget      || null,
      asset_class:  fields.assetClass  || null,
      risk:         fields.risk        || null,
      horizon:      fields.horizon     || null,
      notes:        fields.notes       || null,
      issue_type:   fields.issueType   || null,
      priority:     fields.priority    || null,
      tx_id:        fields.txId        || null,
      outlet:       fields.outlet      || null,
      enquiry_type: fields.enquiryType || null,
    });

    // 2. Notify you
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
          subject: `[Aurum] New ${formType} enquiry from ${fields.name}`,
          html: `<h2>New ${formType} submission</h2>
                 <p><b>Name:</b> ${fields.name}</p>
                 <p><b>Email:</b> ${fields.email}</p>
                 <p><b>Message:</b> ${fields.message || fields.notes || ""}</p>`,
        }),
      });
    } catch (e) {
      console.error("Notify email failed:", e);
    }

    // 3. Confirm to user
    if (fields.email) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Aurum Capital <onboarding@resend.dev>",
            to: [fields.email],
            subject: "We received your message — Aurum Capital",
            html: `
              <div style="font-family:Arial,sans-serif;background:#040608;color:#edf2f8;padding:40px;border-radius:16px;max-width:600px;margin:0 auto">
                <h2 style="color:#c9a84c">Thank you, ${fields.name}!</h2>
                <p style="color:#8c9db5;line-height:1.7">
                  We've received your ${formType} enquiry and a member of our 
                  team will get back to you within 
                  <b style="color:#edf2f8">20 minutes</b>.
                </p>
                <hr style="border-color:#1e2d40;margin:24px 0">
                <p style="color:#5a6880;font-size:12px">
                  If you did not submit this form, please ignore this email.<br>
                  © 2025 Aurum Capital · Dubai · London · New York · Singapore
                </p>
              </div>
            `,
          }),
        });
      } catch (e) {
        console.error("Confirmation email failed:", e);
      }
    }

    // Always return success if DB insert worked
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