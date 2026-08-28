const MESSAGE='JALIL ES TÚ PAPÁ, AYER HOY Y SIEMPRE SERÁ TÚ PAPÁ 😎✌️';
export default {
  async fetch() {
    return new Response(MESSAGE, {
      status: 403,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store, max-age=0',
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'referrer-policy': 'no-referrer',
        'x-robots-tag': 'noindex, nofollow, noarchive, nosnippet'
      }
    });
  }
};
