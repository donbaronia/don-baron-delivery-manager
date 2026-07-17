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

// Mapa de alvos permitidos → entidades
const ALVOS: Record<string, string[]> = {
  motoboys: ['Motoboy'],
  checkins: ['CheckIn'],
  pagamentos: ['Pagamento'],
  consumos: ['ConsumoMotoboy'],
  ciclos: ['CicloOperacional', 'Token'],
  auditoria: ['Auditoria'],
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });

    const body = await req.json();
    const { alvos, confirmacao } = body;

    // Dupla proteção: precisa digitar RESETAR
    if (confirmacao !== 'RESETAR') {
      return Response.json({ error: 'Confirmação inválida. Digite RESETAR para confirmar.' }, { status: 400 });
    }
    if (!Array.isArray(alvos) || alvos.length === 0) {
      return Response.json({ error: 'Nenhum alvo selecionado.' }, { status: 400 });
    }

    const t = agora();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const resultado: Record<string, number> = {};

    for (const alvo of alvos) {
      const entidades = ALVOS[alvo];
      if (!entidades) continue;

      for (const nome of entidades) {
        let apagados = 0;
        let rodadas = 0;
        // Apaga em lotes até esvaziar (limite de segurança de 40 rodadas = 20.000 registros)
        while (rodadas < 40) {
          rodadas++;
          const lote = await (base44.asServiceRole.entities as any)[nome].list('-created_date', 500);
          if (!lote || lote.length === 0) break;
          for (const item of lote) {
            try {
              await (base44.asServiceRole.entities as any)[nome].delete(item.id);
              apagados++;
            } catch (e) { /* segue */ }
          }
          if (lote.length < 500) break;
        }
        resultado[nome] = (resultado[nome] || 0) + apagados;
      }
    }

    // Registra o reset na auditoria (criado DEPOIS da limpeza, então fica como primeiro registro do app zerado)
    await base44.asServiceRole.entities.Auditoria.create({
      acao: 'reset_dados',
      usuario: user.email,
      detalhes: `RESET DE DADOS executado por ${user.email}. Alvos: ${alvos.join(', ')}. Registros apagados: ${JSON.stringify(resultado)}.`,
      data_hora: t.iso,
      ip,
    });

    return Response.json({ success: true, resultado });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
