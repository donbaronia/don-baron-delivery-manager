import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ===== Backend do portal do motoboy (sessão própria por token) =====
// Ações: 'dados' (carrega tudo do portal) e 'checkin' (check-in com PIN diário).

const SECRET = Deno.env.get('PORTAL_SECRET') || 'donbaron-portal-fallback-2026';

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

async function assinar(payloadB64: string) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function validarToken(token: string): Promise<string | null> {
  try {
    const [payloadB64, sig] = String(token || '').split('.');
    if (!payloadB64 || !sig) return null;
    const esperada = await assinar(payloadB64);
    if (esperada !== sig) return null;
    const payload = JSON.parse(atob(payloadB64));
    if (!payload.mid || !payload.exp || Date.now() > payload.exp) return null;
    return payload.mid;
  } catch { return null; }
}

// Remove campos sensíveis antes de devolver ao portal
function limpar(m: any) {
  if (!m) return m;
  const { senha_hash, senha_salt, ...resto } = m;
  return resto;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, token } = body;

    const mid = await validarToken(token);
    if (!mid) return Response.json({ error: 'sessao_expirada' }, { status: 401 });

    const motoboys = await base44.asServiceRole.entities.Motoboy.filter({ id: mid });
    const motoboy = motoboys[0];
    if (!motoboy) return Response.json({ error: 'Cadastro não encontrado.' }, { status: 404 });

    const t = agora();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const identidade = motoboy.email || motoboy.nome;

    // ================= DADOS DO PORTAL =================
    if (action === 'dados') {
      const [checkIns, pagamentos, consumos, configs] = await Promise.all([
        base44.asServiceRole.entities.CheckIn.filter({ motoboy_id: motoboy.id }, '-data', 50),
        base44.asServiceRole.entities.Pagamento.filter({ motoboy_id: motoboy.id }, '-data', 50),
        base44.asServiceRole.entities.ConsumoMotoboy.filter({ motoboy_id: motoboy.id }, '-data', 50),
        base44.asServiceRole.entities.ConfigDiaria.list(),
      ]);
      return Response.json({
        success: true,
        motoboy: limpar(motoboy),
        checkIns,
        pagamentos,
        consumos,
        config: configs[0] || null,
      });
    }

    // ================= CHECK-IN =================
    if (action === 'checkin') {
      const { pin, dispositivo } = body;
      const navegador = req.headers.get('user-agent') || 'unknown';

      if (motoboy.status === 'bloqueado') {
        await base44.asServiceRole.entities.Auditoria.create({
          acao: 'check_in_bloqueado',
          usuario: identidade,
          detalhes: `Tentativa de check-in por motoboy BLOQUEADO: ${motoboy.nome}. IP: ${ip}. Navegador: ${navegador}`,
          data_hora: t.iso, ip, motoboy_id: motoboy.id
        });
        return Response.json({ error: 'motoboy_bloqueado' }, { status: 403 });
      }
      if (motoboy.status !== 'ativo') return Response.json({ error: 'Motoboy inativo. Procure a administração.' }, { status: 403 });

      const today = t.data;
      const cycles = await base44.asServiceRole.entities.CicloOperacional.filter({ data: today, status: 'ativo' });
      const cycle = cycles[0];
      if (!cycle) {
        await base44.asServiceRole.entities.Auditoria.create({
          acao: 'check_in_sem_pin',
          usuario: identidade,
          detalhes: `Tentativa de check-in sem PIN diário ativo por ${motoboy.nome}. Dispositivo: ${dispositivo || 'web'}. Navegador: ${navegador}`,
          data_hora: t.iso, ip, motoboy_id: motoboy.id
        });
        return Response.json({ error: 'pin_nao_gerado' }, { status: 400 });
      }

      // Janela 17:00–18:30 (horário de Teresina)
      const timeMinutes = t.horas * 60 + t.minutos;
      if (timeMinutes < 17 * 60 || timeMinutes > 18 * 60 + 30) {
        await base44.asServiceRole.entities.Auditoria.create({
          acao: 'check_in_fora_horario',
          usuario: identidade,
          detalhes: `Tentativa de check-in fora do horário por ${motoboy.nome} às ${t.hora}. PIN informado: ${pin || 'vazio'}. Dispositivo: ${dispositivo || 'web'}. Navegador: ${navegador}`,
          data_hora: t.iso, ip, motoboy_id: motoboy.id
        });
        return Response.json({ error: 'check_in_fora_horario' }, { status: 400 });
      }

      if (cycle.pin !== pin) {
        await base44.asServiceRole.entities.Auditoria.create({
          acao: 'pin_incorreto',
          usuario: identidade,
          detalhes: `Tentativa de PIN diário incorreto por ${motoboy.nome}. PIN informado: ${pin || 'vazio'}. Dispositivo: ${dispositivo || 'web'}. Navegador: ${navegador}`,
          data_hora: t.iso, ip, motoboy_id: motoboy.id
        });
        return Response.json({ error: 'PIN incorreto. Tente novamente.' }, { status: 400 });
      }

      // Token individual do ciclo — cria automático se faltar
      const tokens = await base44.asServiceRole.entities.Token.filter({ ciclo_id: cycle.id, motoboy_id: motoboy.id });
      let tk = tokens[0];
      if (!tk) {
        const cycleTokens = await base44.asServiceRole.entities.Token.filter({ ciclo_id: cycle.id });
        const usados = new Set(cycleTokens.map((x: any) => x.token));
        let novo = '';
        let tent = 0;
        do {
          novo = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
          tent++;
        } while (usados.has(novo) && tent < 1000);
        tk = await base44.asServiceRole.entities.Token.create({
          ciclo_id: cycle.id, motoboy_id: motoboy.id, motoboy_nome: motoboy.nome,
          token: novo, consumido: false, data: today
        });
        await base44.asServiceRole.entities.Auditoria.create({
          acao: 'token_gerado_automatico',
          usuario: identidade,
          detalhes: `Token individual gerado automaticamente no check-in para ${motoboy.nome}.`,
          data_hora: t.iso, ip, motoboy_id: motoboy.id
        });
      }

      if (tk.consumido) {
        const hora = tk.consumido_em ? horaLocal(tk.consumido_em) : '';
        await base44.asServiceRole.entities.Auditoria.create({
          acao: 'check_in_duplicado',
          usuario: identidade,
          detalhes: `Tentativa de check-in duplicado por ${motoboy.nome}. Token já consumido às ${hora}. Dispositivo: ${dispositivo || 'web'}. Navegador: ${navegador}`,
          data_hora: t.iso, ip, motoboy_id: motoboy.id
        });
        return Response.json({ error: 'check_in_duplicado', hora }, { status: 400 });
      }

      const checkIn = await base44.asServiceRole.entities.CheckIn.create({
        motoboy_id: motoboy.id,
        motoboy_nome: motoboy.nome,
        data: today,
        hora: t.hora,
        usuario: identidade,
        dispositivo: dispositivo || 'web',
        ip,
        tipo: 'automatico',
        status: 'sucesso'
      });

      await base44.asServiceRole.entities.Token.update(tk.id, {
        consumido: true,
        consumido_em: t.iso,
        consumido_ip: ip,
        consumido_dispositivo: dispositivo || 'web',
        check_in_id: checkIn.id
      });

      await base44.asServiceRole.entities.Auditoria.create({
        acao: 'check_in',
        usuario: identidade,
        detalhes: `Check-in realizado por ${motoboy.nome}. PIN utilizado: ${pin}. Token consumido: **${tk.token.slice(-2)}. Admin responsável pelo PIN: ${cycle.criado_por}. IP: ${ip}. Dispositivo: ${dispositivo || 'web'}. Navegador: ${navegador}. Resultado: SUCESSO`,
        data_hora: t.iso, ip, motoboy_id: motoboy.id
      });

      return Response.json({ success: true, checkIn });
    }

    return Response.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
