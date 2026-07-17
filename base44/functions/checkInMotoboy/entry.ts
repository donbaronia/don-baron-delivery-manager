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
    horas: parseInt(g('hour'), 10),
    minutos: parseInt(g('minute'), 10),
    iso: d.toISOString(),
  };
}
function horaLocal(isoStr: string) {
  try {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(isoStr));
  } catch { return ''; }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { pin, dispositivo } = body;

    const motoboys = await base44.asServiceRole.entities.Motoboy.filter({ email: user.email });
    const motoboy = motoboys[0];
    if (!motoboy) return Response.json({ error: 'Motoboy não encontrado' }, { status: 404 });
    const t = agora();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const navegador = req.headers.get('user-agent') || 'unknown';

    if (motoboy.status === 'bloqueado') {
      await base44.asServiceRole.entities.Auditoria.create({
        acao: 'check_in_bloqueado',
        usuario: user.email,
        detalhes: `Tentativa de check-in por motoboy BLOQUEADO: ${motoboy.nome}. IP: ${ip}. Navegador: ${navegador}`,
        data_hora: t.iso,
        ip,
        motoboy_id: motoboy.id
      });
      return Response.json({ error: 'motoboy_bloqueado' }, { status: 403 });
    }
    if (motoboy.status !== 'ativo') return Response.json({ error: 'Motoboy inativo. Procure a administração.' }, { status: 403 });
    const today = t.data;

    // 1. Localizar ciclo ativo do dia
    const cycles = await base44.asServiceRole.entities.CicloOperacional.filter({ data: today, status: 'ativo' });
    const cycle = cycles[0];
    if (!cycle) {
      await base44.asServiceRole.entities.Auditoria.create({
        acao: 'check_in_sem_pin',
        usuario: user.email,
        detalhes: `Tentativa de check-in sem PIN diário ativo por ${motoboy.nome}. Dispositivo: ${dispositivo || 'web'}. Navegador: ${navegador}`,
        data_hora: t.iso,
        ip,
        motoboy_id: motoboy.id
      });
      return Response.json({ error: 'pin_nao_gerado' }, { status: 400 });
    }

    // 2. Validar janela de horário (17:00 às 18:30 — horário de Teresina)
    const timeMinutes = t.horas * 60 + t.minutos;
    const windowStart = 17 * 60;
    const windowEnd = 18 * 60 + 30;

    if (timeMinutes < windowStart || timeMinutes > windowEnd) {
      await base44.asServiceRole.entities.Auditoria.create({
        acao: 'check_in_fora_horario',
        usuario: user.email,
        detalhes: `Tentativa de check-in fora do horário por ${motoboy.nome} às ${t.hora}. PIN informado: ${pin || 'vazio'}. Dispositivo: ${dispositivo || 'web'}. Navegador: ${navegador}`,
        data_hora: t.iso,
        ip,
        motoboy_id: motoboy.id
      });
      return Response.json({ error: 'check_in_fora_horario' }, { status: 400 });
    }

    // 3. Validar PIN diário
    if (cycle.pin !== pin) {
      await base44.asServiceRole.entities.Auditoria.create({
        acao: 'pin_incorreto',
        usuario: user.email,
        detalhes: `Tentativa de PIN diário incorreto por ${motoboy.nome}. PIN informado: ${pin || 'vazio'}. Dispositivo: ${dispositivo || 'web'}. Navegador: ${navegador}`,
        data_hora: t.iso,
        ip,
        motoboy_id: motoboy.id
      });
      return Response.json({ error: 'PIN incorreto. Tente novamente.' }, { status: 400 });
    }

    // 4. Localizar TOKEN individual do motoboy neste ciclo
    //    Se não existir (motoboy cadastrado depois da geração do ciclo), cria na hora.
    const tokens = await base44.asServiceRole.entities.Token.filter({ ciclo_id: cycle.id, motoboy_id: motoboy.id });
    let token = tokens[0];
    if (!token) {
      const cycleTokens = await base44.asServiceRole.entities.Token.filter({ ciclo_id: cycle.id });
      const used = new Set(cycleTokens.map((x: any) => x.token));
      let novoToken = '';
      let attempts = 0;
      do {
        novoToken = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        attempts++;
      } while (used.has(novoToken) && attempts < 1000);

      token = await base44.asServiceRole.entities.Token.create({
        ciclo_id: cycle.id,
        motoboy_id: motoboy.id,
        motoboy_nome: motoboy.nome,
        token: novoToken,
        consumido: false,
        data: today
      });

      await base44.asServiceRole.entities.Auditoria.create({
        acao: 'token_gerado_automatico',
        usuario: user.email,
        detalhes: `Token individual gerado automaticamente no check-in para ${motoboy.nome} (motoboy sem token no ciclo do dia).`,
        data_hora: t.iso,
        ip,
        motoboy_id: motoboy.id
      });
    }

    // 5. Verificar se TOKEN já foi consumido
    if (token.consumido) {
      const hora = token.consumido_em ? horaLocal(token.consumido_em) : '';
      await base44.asServiceRole.entities.Auditoria.create({
        acao: 'check_in_duplicado',
        usuario: user.email,
        detalhes: `Tentativa de check-in duplicado por ${motoboy.nome}. Token já consumido às ${hora}. Dispositivo: ${dispositivo || 'web'}. Navegador: ${navegador}`,
        data_hora: t.iso,
        ip,
        motoboy_id: motoboy.id
      });
      return Response.json({ error: 'check_in_duplicado', hora }, { status: 400 });
    }

    // 6. Criar registro de check-in
    const maskedToken = '**' + token.token.slice(-2);
    const checkIn = await base44.asServiceRole.entities.CheckIn.create({
      motoboy_id: motoboy.id,
      motoboy_nome: motoboy.nome,
      data: today,
      hora: t.hora,
      usuario: user.email,
      dispositivo: dispositivo || 'web',
      ip,
      tipo: 'automatico',
      status: 'sucesso'
    });

    // 7. Consumir TOKEN (vincular ao check-in)
    await base44.asServiceRole.entities.Token.update(token.id, {
      consumido: true,
      consumido_em: t.iso,
      consumido_ip: ip,
      consumido_dispositivo: dispositivo || 'web',
      check_in_id: checkIn.id
    });

    // 8. Auditoria completa
    await base44.asServiceRole.entities.Auditoria.create({
      acao: 'check_in',
      usuario: user.email,
      detalhes: `Check-in realizado por ${motoboy.nome}. PIN utilizado: ${pin}. Token consumido: ${maskedToken}. Admin responsável pelo PIN: ${cycle.criado_por}. IP: ${ip}. Dispositivo: ${dispositivo || 'web'}. Navegador: ${navegador}. Resultado: SUCESSO`,
      data_hora: t.iso,
      ip,
      motoboy_id: motoboy.id
    });

    return Response.json({ success: true, checkIn });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
