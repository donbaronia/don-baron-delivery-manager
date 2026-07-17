import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ===== Helper de fuso horário (Teresina/PI = America/Fortaleza) =====
const TZ = 'America/Fortaleza';
function agora() {
  const d = new Date();
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value || '00';
  return {
    data: `${g('year')}-${g('month')}-${g('day')}`,
    hora: `${g('hour')}:${g('minute')}:${g('second')}`,
    iso: d.toISOString(),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (e) { /* workflow context — sem usuário */ }

    let body: any = {};
    try { body = await req.json(); } catch (e) { /* sem body */ }

    // ===== SEGURANÇA =====
    // Usuário autenticado: precisa ser admin.
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
    }
    // Sem usuário (workflow/chamada externa): exige segredo se configurado.
    const isAdmin = !!user && user.role === 'admin';
    if (!user) {
      const secret = Deno.env.get('RESET_DIARIO_SECRET');
      if (secret && body.secret !== secret) {
        return Response.json({ error: 'Não autorizado' }, { status: 401 });
      }
    }

    const t = agora();
    const today = t.data;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    // 1. Expirar ciclos ativos existentes
    const activeCycles = await base44.asServiceRole.entities.CicloOperacional.filter({ status: 'ativo' });
    for (const cycle of activeCycles) {
      await base44.asServiceRole.entities.CicloOperacional.update(cycle.id, {
        status: 'expirado',
        expirado_em: t.iso
      });
    }

    // 2. Gerar novo PIN diário de 5 dígitos
    const pin = String(Math.floor(10000 + Math.random() * 90000));

    // 3. Criar novo ciclo operacional
    const cycle = await base44.asServiceRole.entities.CicloOperacional.create({
      pin,
      data: today,
      status: 'ativo',
      criado_por: user?.email || 'sistema',
      criado_em: t.iso
    });

    // 4. Gerar TOKENS individuais de 4 dígitos para motoboys ativos
    const activeMotoboys = await base44.asServiceRole.entities.Motoboy.filter({ status: 'ativo' });
    const usedTokens = new Set();
    let tokensCreated = 0;

    for (const m of activeMotoboys) {
      let token;
      let attempts = 0;
      do {
        token = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        attempts++;
      } while (usedTokens.has(token) && attempts < 1000);
      usedTokens.add(token);

      await base44.asServiceRole.entities.Token.create({
        ciclo_id: cycle.id,
        motoboy_id: m.id,
        motoboy_nome: m.nome,
        token,
        consumido: false,
        data: today
      });
      tokensCreated++;
    }

    // 5. Auditoria
    await base44.asServiceRole.entities.Auditoria.create({
      acao: 'gerar_pin_diario',
      usuario: user?.email || 'sistema',
      detalhes: `PIN diário gerado para ${today}. ${tokensCreated} tokens individuais criados. Origem: ${isAdmin ? 'admin' : 'workflow/sistema'}.`,
      data_hora: t.iso,
      ip
    });

    // O PIN só é devolvido na resposta para admins autenticados.
    if (isAdmin) {
      return Response.json({ success: true, cycle: { id: cycle.id, pin }, tokensCount: tokensCreated });
    }
    return Response.json({ success: true, cycle: { id: cycle.id }, tokensCount: tokensCreated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
