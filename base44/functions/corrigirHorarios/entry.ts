import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ===== Correção pontual: check-ins gravados com hora UTC (bug antigo) =====
// Subtrai 3 horas dos check-ins de uma data cujo horário seja >= 19:00
// (a janela legítima fecha às 18:30, então hora >= 19:00 só existe pelo bug).

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });

    const body = await req.json();
    const data = String(body.data || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return Response.json({ error: 'Informe a data no formato AAAA-MM-DD.' }, { status: 400 });
    }

    const checkIns = await base44.asServiceRole.entities.CheckIn.filter({ data });
    let corrigidos = 0;
    const detalhes: string[] = [];

    for (const c of checkIns) {
      if (!c.hora || c.hora < '19:00') continue; // hora legítima — não mexe
      const [h, m, s] = c.hora.split(':').map((x: string) => parseInt(x, 10));
      const novaHora = `${String(h - 3).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s || 0).padStart(2, '0')}`;
      await base44.asServiceRole.entities.CheckIn.update(c.id, { hora: novaHora });
      detalhes.push(`${c.motoboy_nome}: ${c.hora} → ${novaHora}`);
      corrigidos++;
    }

    await base44.asServiceRole.entities.Auditoria.create({
      acao: 'correcao_horarios',
      usuario: user.email,
      detalhes: `Correção de horários UTC nos check-ins de ${data}: ${corrigidos} registro(s). ${detalhes.join(' | ')}`,
      data_hora: new Date().toISOString(),
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
    });

    return Response.json({ success: true, corrigidos, detalhes });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
