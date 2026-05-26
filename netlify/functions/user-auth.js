/* ═══════════════════════════════════════════════════════════════════
   AURUM CAPITAL — Netlify Serverless Function  v2 (FIXED)
   File path: netlify/functions/user-auth.js

   Set these in Netlify Dashboard → Site Settings → Environment Variables:
     CF_CMA_TOKEN     →  Contentful Content Management API token
     CF_SPACE_ID      →  Your Contentful Space ID
     CF_ENV           →  master  (or your env name)
     CF_CONTENT_TYPE  →  aurumUser  (content type ID you created)
     ALLOWED_ORIGIN   →  https://yoursite.netlify.app  (or *)
     ADMIN_SECRET     →  any secret string
═══════════════════════════════════════════════════════════════════ */

/* NOTE: No require() — pure Node built-ins + native fetch (Node 18+) */

  const CF_CMA_BASE = 'https://api.contentful.com';

  exports.handler = async (event) => {

   exports.handler = async (event, context) => {
    // 1. Parse the incoming data
    const data = JSON.parse(event.body);

    try {
        // 2. THIS IS THE LINE TO REPLACE: 
        // We are going to ask Contentful what its fields really are
        const contentType = await client.getContentType('aurum');
        console.log("ACTUAL FIELDS ALLOWED BY CONTENTFUL:", JSON.stringify(contentType.fields.map(f => f.id), null, 2));

        // 3. Keep the code paused here for a second
        // We will fill this part in once you give me the log output
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Check the logs to see the required field names" })
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

  /* ── CORS ─────────────────────────────────────────────────── */
  const origin = process.env.ALLOWED_ORIGIN || '*';
  const cors = {
    'Access-Control-Allow-Origin' : origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type'                : 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, headers: cors, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };

  /* ── Env vars ─────────────────────────────────────────────── */
  const CMA_TOKEN    = process.env.CF_CMA_TOKEN;
  const SPACE_ID     = process.env.CF_SPACE_ID;
  const ENV          = process.env.CF_ENV || 'master';
  const CONTENT_TYPE = process.env.CF_CONTENT_TYPE || 'aurum';

  if (!CMA_TOKEN || !SPACE_ID) {
    console.error('Missing CF_CMA_TOKEN or CF_SPACE_ID env vars');
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ ok: false, error: 'Server misconfiguration: missing environment variables. Check Netlify dashboard.' }),
    };
  }

  /* ── Parse body ───────────────────────────────────────────── */
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ ok: false, error: 'Invalid request body.' }) };
  }

  const { action } = body;
  console.log(`[user-auth] action=${action}`);

  /* ══════════════════════════════════════════════════════════
     ACTION: register
  ══════════════════════════════════════════════════════════ */
  if (action === 'register') {
    const {
      userId, firstName, lastName, email,
      phone, passwordHash, avatarInitials,
      cashBalance, plan, createdAt
    } = body;

    /* ── Server-side validation ───────────────────────────── */
    if (!userId || !firstName || !lastName || !email || !passwordHash)
      return { statusCode: 400, headers: cors, body: JSON.stringify({ ok: false, error: 'Missing required fields.' }) };

    if (!/^\S+@\S+\.\S{2,}$/.test(email))
      return { statusCode: 400, headers: cors, body: JSON.stringify({ ok: false, error: 'Invalid email address.' }) };

    /* ── 1. Check email uniqueness via CMA ────────────────── */
    try {
      const checkUrl = `${CF_CMA_BASE}/spaces/${SPACE_ID}/environments/${ENV}/entries`
        + `?content_type=${CONTENT_TYPE}&fields.email=${encodeURIComponent(email.toLowerCase())}&limit=1`;

      const checkRes = await fetch(checkUrl, {
        headers: {
          'Authorization': `Bearer ${CMA_TOKEN}`,
          'Content-Type' : 'application/json',
        },
      });

      if (!checkRes.ok) {
        const errBody = await checkRes.text();
        console.error('Email check failed:', checkRes.status, errBody);
        return { statusCode: 500, headers: cors, body: JSON.stringify({ ok: false, error: 'Could not verify email. Is your CMA token correct and does the content type exist?' }) };
      }

      const checkJson = await checkRes.json();
      if (checkJson.total > 0)
        return { statusCode: 409, headers: cors, body: JSON.stringify({ ok: false, error: 'An account with that email already exists.' }) };

    } catch (e) {
      console.error('Email check exception:', e);
      return { statusCode: 500, headers: cors, body: JSON.stringify({ ok: false, error: 'Email check failed: ' + e.message }) };
    }

    /* ── 2. Create Contentful entry ───────────────────────── */
    const entryPayload = {
      fields: {
        userId        : { 'en-US': userId },
        firstName     : { 'en-US': firstName.trim() },
        lastName      : { 'en-US': lastName.trim() },
        email         : { 'en-US': email.toLowerCase().trim() },
        phone         : { 'en-US': phone || '' },
        passwordHash  : { 'en-US': passwordHash },
        avatarInitials: { 'en-US': avatarInitials || (firstName[0] + lastName[0]).toUpperCase() },
        cashBalance   : { 'en-US': parseFloat(cashBalance) || 0 },
        plan          : { 'en-US': plan || 'standard' },
        isActive      : { 'en-US': true },
        createdAt     : { 'en-US': createdAt || new Date().toISOString() },
      },
    };

    let entry;
    try {
      const createUrl = `${CF_CMA_BASE}/spaces/${SPACE_ID}/environments/${ENV}/entries`;
      const createRes = await fetch(createUrl, {
        method : 'POST',
        headers: {
          'Authorization'              : `Bearer ${CMA_TOKEN}`,
          'Content-Type'               : 'application/vnd.contentful.management.v1+json',
          'X-Contentful-Content-Type'  : CONTENT_TYPE,
        },
        body: JSON.stringify(entryPayload),
      });

      const contentType = await client.getContentType('aurum');
      console.log("THE CORRECT FIELD IDS ARE:", JSON.stringify(contentType.fields.map(f => f.id), null, 2));

      entry = await createRes.json();
      const entry = await client.createEntry('aurum', {
      fields: {
        // --- CHANGE THIS ---
        firstName: { 'en-US': data.firstName }, 
        // -------------------
        phone: { 'en-US': data.phone }
    }
});

      if (!createRes.ok) {
        console.error('Create entry failed:', createRes.status, JSON.stringify(entry));
        const detail = entry?.details?.errors?.map(e => e.details).join(', ') || entry.message || 'Unknown Contentful error';
        return { statusCode: createRes.status, headers: cors, body: JSON.stringify({ ok: false, error: 'Could not create account: ' + detail }) };
      }

    } catch (e) {
      console.error('Create entry exception:', e);
      return { statusCode: 500, headers: cors, body: JSON.stringify({ ok: false, error: 'Account creation failed: ' + e.message }) };
    }

    /* ── 3. Publish entry so CDA can read it ──────────────── */
    try {
      const pubUrl = `${CF_CMA_BASE}/spaces/${SPACE_ID}/environments/${ENV}/entries/${entry.sys.id}/published`;
      const pubRes = await fetch(pubUrl, {
        method : 'PUT',
        headers: {
          'Authorization'       : `Bearer ${CMA_TOKEN}`,
          'X-Contentful-Version': String(entry.sys.version),
        },
      });
      if (!pubRes.ok) {
        const pubErr = await pubRes.text();
        console.warn('Publish failed (entry created but unpublished):', pubErr);
      }
    } catch (e) {
      console.warn('Publish exception (non-fatal):', e.message);
    }

    /* ── 4. Return safe user (no passwordHash) ────────────── */
    console.log(`[user-auth] register success: ${email}`);
    return {
      statusCode: 201,
      headers: cors,
      body: JSON.stringify({
        ok: true,
        user: {
          userId, firstName, lastName,
          email: email.toLowerCase(),
          phone: phone || '',
          avatarInitials: avatarInitials || (firstName[0] + lastName[0]).toUpperCase(),
          cashBalance: parseFloat(cashBalance) || 0,
          plan: plan || 'standard',
          createdAt: createdAt || new Date().toISOString(),
        },
        entryId: entry.sys.id,
      }),
    };
  }

  /* ══════════════════════════════════════════════════════════
     ACTION: delete  (admin only)
  ══════════════════════════════════════════════════════════ */
  if (action === 'delete') {
    const { entryId, adminSecret } = body;
    if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET)
      return { statusCode: 403, headers: cors, body: JSON.stringify({ ok: false, error: 'Forbidden.' }) };
    try {
      /* Unpublish first */
      await fetch(`${CF_CMA_BASE}/spaces/${SPACE_ID}/environments/${ENV}/entries/${entryId}/published`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${CMA_TOKEN}` },
      });
      /* Then delete */
      const delRes = await fetch(`${CF_CMA_BASE}/spaces/${SPACE_ID}/environments/${ENV}/entries/${entryId}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${CMA_TOKEN}` },
      });
      if (!delRes.ok) throw new Error('Delete failed: ' + delRes.status);
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
    } catch (e) {
      return { statusCode: 500, headers: cors, body: JSON.stringify({ ok: false, error: e.message }) };
    }
  }

  return { statusCode: 400, headers: cors, body: JSON.stringify({ ok: false, error: 'Unknown action: ' + action }) };
};

// // In user-auth.js
// console.log("Attempting to create entry in model: aurum");
// console.log("Fields being sent:", JSON.stringify({
//     firstName: { 'en-US': data.firstName },
//     phone: { 'en-US': data.phone }
// }, null, 2));


console.log("Entry created:", JSON.stringify(entry, null, 2));