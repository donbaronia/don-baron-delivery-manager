import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ===== Login próprio dos motoboys =====
// O admin define email + senha no cadastro. A senha fica guardada como
// hash SHA-256(salt + senha). Aqui validamos e emitimos um token assinado
// (HMAC) que o portal usa nas próximas chamadas.

const SECRET = Deno.env.get('PORTAL_SECRET') || 'donbaron-portal-fallback-2026';

const TZ = 'America/Fortaleza';
function agoraISO() { return new Date().toISOString(); }

async function sha256Hex(texto: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function assinar(payloadB64: string) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const senha = String(body.senha || '');
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    if (!email || !senha) {
      return Response.json({ error: 'Informe email e senha.' }, { status: 400 });
    }

    const lista = await base44.asServiceRole.entities.Motoboy.filter({ email });
    const motoboy = lista[0];

    const falha = async (motivo: string) => {
      await base44.asServiceRole.entities.Auditoria.create({
        acao: 'login_portal_falhou',
        usuario: email,
        detalhes: `Tentativa de login no portal falhou (${motivo}). IP: ${ip}`,
        data_hora: agoraISO(),
        ip,
        motoboy_id: motoboy?.id || '',
      });
      // Mensagem genérica para não revelar se o email existe
      return Response.json({ error: 'Email ou senha incorretos.' }, { status: 401 });
    };

    if (!motoboy) return await falha('email não cadastrado');
    if (!motoboy.senha_hash || !motoboy.senha_salt) return await falha('sem senha definida');

    const hash = await sha256Hex(motoboy.senha_salt + senha);
    if (hash !== motoboy.senha_hash) return await falha('senha incorreta');

    // Token válido por 30 dias
    const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const payloadB64 = btoa(JSON.stringify({ mid: motoboy.id, exp }));
    const sig = await assinar(payloadB64);
    const token = `${payloadB64}.${sig}`;

    await base44.asServiceRole.entities.Auditoria.create({
      acao: 'login_portal',
      usuario: email,
      detalhes: `Login no portal por ${motoboy.nome}. IP: ${ip}`,
      data_hora: agoraISO(),
      ip,
      motoboy_id: motoboy.id,
    });

    return Response.json({ success: true, token, nome: motoboy.nome });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
