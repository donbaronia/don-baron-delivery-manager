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
    const { acao, motoboy_id, motivo, observacao, data_bloqueio, senha_master, confirmacao } = body;

    const now = new Date();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const navegador = req.headers.get('user-agent') || 'unknown';

    const motoboys = await base44.asServiceRole.entities.Motoboy.filter({ id: motoboy_id });
    const motoboy = motoboys[0];
    if (!motoboy) return Response.json({ error: 'Motoboy não encontrado' }, { status: 404 });

    // ===== BLOQUEAR =====
    if (acao === 'bloquear') {
      if (!motivo || !motivo.trim()) return Response.json({ error: 'Motivo é obrigatório' }, { status: 400 });

      await base44.asServiceRole.entities.Motoboy.update(motoboy.id, {
        status: 'bloqueado',
        bloqueado_por: user.email,
        bloqueado_em: data_bloqueio || now.toISOString(),
        motivo_bloqueio: motivo.trim(),
        observacoes: observacao ? (motoboy.observacoes ? motoboy.observacoes + ' | Bloqueio: ' + observacao : 'Bloqueio: ' + observacao) : motoboy.observacoes
      });

      await base44.asServiceRole.entities.Auditoria.create({
        acao: 'motoboy_bloqueado',
        usuario: user.email,
        detalhes: `Motoboy ${motoboy.nome} BLOQUEADO. Motivo: ${motivo.trim()}. Observação: ${observacao || '—'}. IP: ${ip}. Navegador: ${navegador}`,
        data_hora: now.toISOString(),
        ip,
        motoboy_id: motoboy.id
      });

      return Response.json({ success: true, acao: 'bloqueado' });
    }

    // ===== DESBLOQUEAR =====
    if (acao === 'desbloquear') {
      await base44.asServiceRole.entities.Motoboy.update(motoboy.id, {
        status: 'ativo',
        bloqueado_por: null,
        bloqueado_em: null,
        motivo_bloqueio: null
      });

      await base44.asServiceRole.entities.Auditoria.create({
        acao: 'motoboy_desbloqueado',
        usuario: user.email,
        detalhes: `Motoboy ${motoboy.nome} DESBLOQUEADO. IP: ${ip}. Navegador: ${navegador}`,
        data_hora: now.toISOString(),
        ip,
        motoboy_id: motoboy.id
      });

      return Response.json({ success: true, acao: 'desbloqueado' });
    }

    // ===== EXCLUIR DEFINITIVAMENTE =====
    if (acao === 'excluir') {
      const MASTER = Deno.env.get("SENHA_MASTER") || "DONBARON_MASTER_2024";
      if (confirmacao !== 'EXCLUIR') return Response.json({ error: 'Confirmação incorreta. Digite a palavra EXCLUIR.' }, { status: 400 });
      if (senha_master !== MASTER) return Response.json({ error: 'Senha master incorreta' }, { status: 403 });
      if (!motivo || !motivo.trim()) return Response.json({ error: 'Motivo é obrigatório' }, { status: 400 });

      // Verificar histórico
      const [checkIns, pagamentos] = await Promise.all([
        base44.asServiceRole.entities.CheckIn.filter({ motoboy_id: motoboy.id }),
        base44.asServiceRole.entities.Pagamento.filter({ motoboy_id: motoboy.id })
      ]);

      const hasHistory = checkIns.length > 0 || pagamentos.length > 0;

      if (hasHistory) {
        // Converter para INATIVO — preservar histórico
        await base44.asServiceRole.entities.Motoboy.update(motoboy.id, { status: 'inativo' });

        await base44.asServiceRole.entities.Auditoria.create({
          acao: 'motoboy_inativado_sem_exclusao',
          usuario: user.email,
          detalhes: `Exclusão de ${motoboy.nome} NEGADA — possui histórico (${checkIns.length} check-ins, ${pagamentos.length} pagamentos). Convertido para INATIVO. Motivo da exclusão: ${motivo.trim()}. IP: ${ip}. Navegador: ${navegador}`,
          data_hora: now.toISOString(),
          ip,
          motoboy_id: motoboy.id
        });

        return Response.json({
          success: true,
          acao: 'inativado',
          motivo: 'Histórico encontrado — cadastro preservado como INATIVO',
          checkIns: checkIns.length,
          pagamentos: pagamentos.length
        });
      }

      // Sem histórico — excluir fisicamente
      await base44.asServiceRole.entities.Auditoria.create({
        acao: 'motoboy_excluido',
        usuario: user.email,
        detalhes: `Motoboy ${motoboy.nome} (ID: ${motoboy.id}) EXCLUÍDO DEFINITIVAMENTE. Motivo: ${motivo.trim()}. IP: ${ip}. Navegador: ${navegador}`,
        data_hora: now.toISOString(),
        ip,
        motoboy_id: motoboy.id
      });

      await base44.asServiceRole.entities.Motoboy.delete(motoboy.id);

      return Response.json({ success: true, acao: 'excluido' });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});