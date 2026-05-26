// Local test runner for user-auth Netlify function
// Mocks fetch responses for Contentful CMA calls and invokes handler

process.env.CF_CMA_TOKEN = 'DUMMY_TOKEN';
process.env.CF_SPACE_ID = 'DUMMY_SPACE';
process.env.CF_ENV = 'master';
process.env.CF_CONTENT_TYPE = 'aurumUser';
process.env.ALLOWED_ORIGIN = '*';

// Minimal fetch mock
global.fetch = async (url, opts = {}) => {
  // console.log('mock fetch', url, opts && opts.method);
  if (url.includes('/entries?')) {
    return { ok: true, json: async () => ({ total: 0 }) };
  }
  if (url.endsWith('/entries')) {
    // create entry
    const entry = { sys: { id: 'entry_test_123', version: 1 } };
    return { ok: true, status: 201, json: async () => entry };
  }
  if (url.endsWith('/published')) {
    return { ok: true, status: 200, json: async () => ({}) };
  }
  return { ok: true, json: async () => ({}) };
};

(async () => {
  const { handler } = require('./user-auth');
  const event = {
    httpMethod: 'POST',
    body: JSON.stringify({
      action: 'register',
      userId: 'test_user_1',
      firstName: 'Test',
      lastName: 'User',
      email: 'test.user@example.com',
      phone: '+10000000000',
      passwordHash: 'pw_hash',
      avatarInitials: 'TU',
      cashBalance: 100,
      plan: 'standard',
      createdAt: new Date().toISOString()
    })
  };

  try {
    const res = await handler(event);
    console.log('Handler response:', res);
    if (res && res.body) console.log('Body:', JSON.parse(res.body));
  } catch (e) {
    console.error('Handler error:', e);
  }
})();
