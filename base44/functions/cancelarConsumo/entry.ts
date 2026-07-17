import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });

    const body = await req.json();
    const { consumo_id, motivo } = body;

    if (!motivo || !motivo.trim()) return Response.json({ error: 'Motivo é obrigatório' }, { status: 400 });

    const now = new Date();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const navegador = req.headers.get('user-agent') || 'unknown';

    const consumos = await base44.asServiceRole.entities.ConsumoMotoboy.filter({ id: consumo_id });
    const consumo = consumos[0];
    if (!consumo) return Response.json({ error: 'Consumo não encontrado' }, { status: 404 });
    if (consumo.status === 'cancelado') return Response.json({ error: 'Consumo já está cancelado' }, { status: 400 });

    // Restituir estoque se foi baixado
    if (consumo.estoque_baixado) {
      const estoqueItems = await base44.asServiceRole.entities.Estoque.filter({ nome: consumo.produto });
      if (estoqueItems.length > 0) {
        await base44.asServiceRole.entities.Estoque.update(estoqueItems[0].id, {
          quantidade: (estoqueItems[0].quantidade || 0) + consumo.quantidade
        });
      }
    }

    await base44.asServiceRole.entities.ConsumoMotoboy.update(consumo_id, {
      status: 'cancelado',
      motivo_cancelamento: motivo.trim(),
      cancelado_por: user.email,
      cancelado_em: now.toISOString()
    });

    await base44.asServiceRole.entities.Auditoria.create({
      acao: 'consumo_motoboy_cancelado',
      usuario: user.email,
      detalhes: `Consumo CANCELADO: ${consumo.motoboy_nome} - ${consumo.quantidade}x ${consumo.produto} (R$ ${consumo.valor_total.toFixed(2)}). Motivo: ${motivo.trim()}. Estoque restituído: ${consumo.estoque_baixado}. IP: ${ip}. Navegador: ${navegador}`,
      data_hora: now.toISOString(),
      ip,
      motoboy_id: consumo.motoboy_id
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});