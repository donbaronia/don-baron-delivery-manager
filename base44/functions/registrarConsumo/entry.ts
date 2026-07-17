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
    if (user.role !== 'admin') return Response.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });

    const body = await req.json();
    const { motoboy_id, produto, categoria, quantidade, valor_unitario, observacao, estoque_id } = body;

    if (!motoboy_id || !produto || !quantidade || valor_unitario == null) {
      return Response.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    const now = new Date();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const navegador = req.headers.get('user-agent') || 'unknown';
    const today = agora().data;
    const hora = agora().hora;

    const motoboys = await base44.asServiceRole.entities.Motoboy.filter({ id: motoboy_id });
    const motoboy = motoboys[0];
    if (!motoboy) return Response.json({ error: 'Motoboy não encontrado' }, { status: 404 });

    // Decrementar estoque se produto cadastrado
    let estoque_baixado = false;
    let produtoNome = produto;
    let produtoCategoria = categoria || '';
    let valorUnit = valor_unitario;

    if (estoque_id) {
      const estoqueItems = await base44.asServiceRole.entities.Estoque.filter({ id: estoque_id });
      const estoqueItem = estoqueItems[0];
      if (estoqueItem) {
        produtoNome = estoqueItem.nome;
        produtoCategoria = estoqueItem.categoria || '';
        valorUnit = estoqueItem.valor;
        const novaQtd = Math.max(0, (estoqueItem.quantidade || 0) - quantidade);
        await base44.asServiceRole.entities.Estoque.update(estoque_id, { quantidade: novaQtd });
        estoque_baixado = true;
      }
    }

    const valorTotalCalc = quantidade * valorUnit;

    // Criar registro de consumo
    const consumo = await base44.asServiceRole.entities.ConsumoMotoboy.create({
      motoboy_id: motoboy.id,
      motoboy_nome: motoboy.nome,
      produto: produtoNome,
      categoria: produtoCategoria,
      quantidade,
      valor_unitario: valorUnit,
      valor_total: valorTotalCalc,
      observacao: observacao || '',
      data: today,
      hora,
      usuario: user.email,
      status: 'ativo',
      impresso: true,
      estoque_baixado
    });

    // Auditoria completa
    await base44.asServiceRole.entities.Auditoria.create({
      acao: 'consumo_motoboy_registrado',
      usuario: user.email,
      detalhes: `Consumo registrado: ${motoboy.nome} - ${quantidade}x ${produtoNome} (R$ ${valorTotalCalc.toFixed(2)}). Estoque baixado: ${estoque_baixado}. Impressão enviada: SIM. IP: ${ip}. Navegador: ${navegador}`,
      data_hora: now.toISOString(),
      ip,
      motoboy_id: motoboy.id
    });

    return Response.json({ success: true, consumo });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});