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
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acesso negado' }, { status: 403 });

    const body = await req.json();
    const { motoboy_id, forma, banco, valor, dias, valor_bruto, desconto_consumo, consumo_ids } = body;

    const motoboys = await base44.asServiceRole.entities.Motoboy.filter({ id: motoboy_id });
    const motoboy = motoboys[0];
    if (!motoboy) return Response.json({ error: 'Motoboy não encontrado' }, { status: 404 });

    const t = agora();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const recibo = `REC-${t.data.replace(/-/g, '')}-${motoboy.id.substring(0, 6).toUpperCase()}`;

    const pagamento = await base44.asServiceRole.entities.Pagamento.create({
      motoboy_id: motoboy.id,
      motoboy_nome: motoboy.nome,
      data: t.data,
      hora: t.hora,
      usuario: user.email,
      forma,
      banco: banco || '',
      valor,
      valor_bruto: valor_bruto ?? valor,
      desconto_consumo: desconto_consumo || 0,
      recibo,
      dias: dias || 0
    });

    // ===== INTEGRAÇÃO CONSUMO → FINANCEIRO =====
    // Marca os consumos abatidos neste pagamento como "descontado",
    // vinculando ao pagamento para rastreabilidade.
    let consumosDescontados = 0;
    if (Array.isArray(consumo_ids) && consumo_ids.length > 0) {
      for (const cid of consumo_ids) {
        try {
          const cs = await base44.asServiceRole.entities.ConsumoMotoboy.filter({ id: cid });
          const c = cs[0];
          if (c && c.motoboy_id === motoboy.id && c.status === 'ativo') {
            await base44.asServiceRole.entities.ConsumoMotoboy.update(cid, {
              status: 'descontado',
              pagamento_id: pagamento.id
            });
            consumosDescontados++;
          }
        } catch (e) { /* segue para o próximo */ }
      }
    }

    await base44.asServiceRole.entities.Auditoria.create({
      acao: 'pagamento',
      usuario: user.email,
      detalhes: `Pagamento de R$ ${Number(valor).toFixed(2)} para ${motoboy.nome} via ${forma}${banco ? ' (' + banco + ')' : ''}. Bruto: R$ ${Number(valor_bruto ?? valor).toFixed(2)}. Desconto consumo: R$ ${Number(desconto_consumo || 0).toFixed(2)} (${consumosDescontados} itens abatidos). Recibo: ${recibo}`,
      data_hora: t.iso,
      ip,
      motoboy_id: motoboy.id
    });

    return Response.json({ success: true, pagamento, recibo, consumosDescontados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
