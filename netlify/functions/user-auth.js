
/* ═══════════════════════════════════════════════════════════════════
   AURUM CAPITAL — Netlify Serverless Function
   File: netlify/functions/user-auth.js

   Deploy to Netlify — this function protects your CMA token.
   Set these environment variables in Netlify Dashboard:
     → CF_CMA_TOKEN    (Contentful Content Management API token)
     → CF_SPACE_ID     (Your Contentful Space ID)
     → CF_ENV          (usually "master")
     → CF_CONTENT_TYPE (your user content type ID, e.g. "aurumUser")
     → ALLOWED_ORIGIN  (your site URL or * for open)
═══════════════════════════════════════════════════════════════════ */

const CF_CMA_BASE = 'https://api.contentful.com';

exports.handler = async (event) => {

  /* ── CORS headers ──────────────────────────────────────────── */
  const origin   = process.env.ALLOWED_ORIGIN || '*';
  const corsHdrs = {
    'Access-Control-Allow-Origin' : origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type'                : 'application/json',
  };

  /* Handle preflight */
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHdrs, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: corsHdrs, body: JSON.stringify({ error: 'Method not allowed' }) };

  /* ── Read env vars ─────────────────────────────────────────── */

//   Refreshing variables)
  const CMA_TOKEN    = process.env.CF_CMA_TOKEN;
  const SPACE_ID     = process.env.CF_SPACE_ID;
  const ENV          = process.env.CF_ENV || 'master';
  const CONTENT_TYPE = process.env.CF_CONTENT_TYPE || 'aurum';

  if (!CMA_TOKEN || !SPACE_ID) {
    return {
      statusCode: 500,
      headers: corsHdrs,
      body: JSON.stringify({ error: 'Server misconfiguration' }),
    };
  }

  /* ── Parse body ────────────────────────────────────────────── */
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: corsHdrs, body: JSON.stringify({ error: 'Invalid JSON body.' }) }; }

  const { action } = body;

  /* ══════════════════════════════════════════════════════════
     ACTION: register
     Creates a new aurumUser entry in Contentful via CMA.
  ══════════════════════════════════════════════════════════ */
  if (action === 'register') {
    const { userId, firstName, lastName, email, phone, passwordHash, avatarInitials, cashBalance, plan, createdAt } = body;

    /* Basic server-side validation */
    if (!userId || !firstName || !lastName || !email || !passwordHash)
      return { statusCode: 400, headers: corsHdrs, body: JSON.stringify({ error: 'Missing required fields.' }) };
    if (!/^\S+@\S+\.\S{2,}$/.test(email))
      return { statusCode: 400, headers: corsHdrs, body: JSON.stringify({ error: 'Invalid email address.' }) };

    /* ── Step 1: Check if email already exists via CMA search ── */
    try {
      const checkUrl = `${CF_CMA_BASE}/spaces/${SPACE_ID}/environments/${ENV}/entries?content_type=${CONTENT_TYPE}&fields.email=${encodeURIComponent(email)}&limit=1`;
      const checkRes = await fetch(checkUrl, {
        headers: { Authorization: `Bearer ${CMA_TOKEN}`, 'Content-Type': 'application/json' },
      });
      const checkJson = await checkRes.json();
      if (checkJson.total > 0)
        return { statusCode: 409, headers: corsHdrs, body: JSON.stringify({ error: 'An account with that email already exists.' }) };
    } catch (e) {
      return { statusCode: 500, headers: corsHdrs, body: JSON.stringify({ error: 'Could not verify email uniqueness: ' + e.message }) };
    }

    /* ── Step 2: Create the Contentful entry ───────────────── */
    const entryBody = {
      fields: {
        userId         : { 'en-US': userId },
        firstName      : { 'en-US': firstName },
        lastName       : { 'en-US': lastName },
        email          : { 'en-US': email.toLowerCase() },
        phone          : { 'en-US': phone || '' },
        passwordHash   : { 'en-US': passwordHash },
        avatarInitials : { 'en-US': avatarInitials },
        cashBalance    : { 'en-US': parseFloat(cashBalance) || 0 },
        plan           : { 'en-US': plan || 'standard' },
        isActive       : { 'en-US': true },
        createdAt      : { 'en-US': createdAt || new Date().toISOString() },
      },
    };

    let entry;
    try {
      const createUrl = `${CF_CMA_BASE}/spaces/${SPACE_ID}/environments/${ENV}/entries`;
      const createRes = await fetch(createUrl, {
        method : 'POST',
        headers: {
          Authorization           : `Bearer ${CMA_TOKEN}`,
          'Content-Type'          : 'application/vnd.contentful.management.v1+json',
          'X-Contentful-Content-Type': CONTENT_TYPE,
        },
        body: JSON.stringify(entryBody),
      });
      entry = await createRes.json();
      if (!createRes.ok)
        return { statusCode: createRes.status, headers: corsHdrs, body: JSON.stringify({ error: entry.message || 'Failed to create account in Contentful.', details: entry }) };
    } catch (e) {
      return { statusCode: 500, headers: corsHdrs, body: JSON.stringify({ error: 'Contentful create error: ' + e.message }) };
    }

    /* ── Step 3: Publish the entry so CDA can read it ──────── */
    try {
      const pubUrl = `${CF_CMA_BASE}/spaces/${SPACE_ID}/environments/${ENV}/entries/${entry.sys.id}/published`;
      await fetch(pubUrl, {
        method : 'PUT',
        headers: {
          Authorization     : `Bearer ${CMA_TOKEN}`,
          'X-Contentful-Version': String(entry.sys.version),
        },
      });
    } catch (_) { /* Non-fatal — entry created but not published */ }

    /* ── Return safe user object (NO password hash) ─────────── */
    return {
      statusCode: 201,
      headers: corsHdrs,
      body: JSON.stringify({
        ok: true,
        user: { userId, firstName, lastName, email, phone, avatarInitials, cashBalance, plan, createdAt },
        entryId: entry.sys.id,
      }),
    };
  }

  /* ══════════════════════════════════════════════════════════
     ACTION: delete (admin use — remove a user entry)
  ══════════════════════════════════════════════════════════ */
  if (action === 'delete') {
    const { entryId, adminSecret } = body;
    if (adminSecret !== process.env.ADMIN_SECRET)
      return { statusCode: 403, headers: corsHdrs, body: JSON.stringify({ error: 'Forbidden.' }) };
    try {
      await fetch(`${CF_CMA_BASE}/spaces/${SPACE_ID}/environments/${ENV}/entries/${entryId}/published`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${CMA_TOKEN}` },
      });
      await fetch(`${CF_CMA_BASE}/spaces/${SPACE_ID}/environments/${ENV}/entries/${entryId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${CMA_TOKEN}` },
      });
      return { statusCode: 200, headers: corsHdrs, body: JSON.stringify({ ok: true }) };
    } catch (e) {
      return { statusCode: 500, headers: corsHdrs, body: JSON.stringify({ error: e.message }) };
    }
  }

  return { statusCode: 400, headers: corsHdrs, body: JSON.stringify({ error: 'Unknown action: ' + action }) };
};
