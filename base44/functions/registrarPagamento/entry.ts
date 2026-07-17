import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acesso negado' }, { status: 403 });

    const body = await req.json();
    const { motoboy_id, forma, banco, valor, dias } = body;

    const motoboys = await base44.asServiceRole.entities.Motoboy.filter({ id: motoboy_id });
    const motoboy = motoboys[0];
    if (!motoboy) return Response.json({ error: 'Motoboy não encontrado' }, { status: 404 });

    const now = new Date();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const recibo = `REC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${motoboy.id.substring(0, 6).toUpperCase()}`;

    const pagamento = await base44.asServiceRole.entities.Pagamento.create({
      motoboy_id: motoboy.id,
      motoboy_nome: motoboy.nome,
      data: now.toISOString().split('T')[0],
      hora: now.toTimeString().substring(0, 8),
      usuario: user.email,
      forma,
      banco: banco || '',
      valor,
      recibo,
      dias: dias || 0
    });

    await base44.asServiceRole.entities.Auditoria.create({
      acao: 'pagamento',
      usuario: user.email,
      detalhes: `Pagamento de R$ ${valor.toFixed(2)} para ${motoboy.nome} via ${forma}${banco ? ' (' + banco + ')' : ''}`,
      data_hora: now.toISOString(),
      ip,
      motoboy_id: motoboy.id
    });

    return Response.json({ success: true, pagamento, recibo });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});