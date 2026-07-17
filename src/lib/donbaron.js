import { base44 } from '@/api/base44Client';

export async function logAuditoria(acao, detalhes, motoboyId = null) {
  try {
    const user = await base44.auth.me();
    await base44.entities.Auditoria.create({
      acao,
      usuario: user?.email || 'system',
      detalhes,
      data_hora: new Date().toISOString(),
      motoboy_id: motoboyId
    });
  } catch (e) {
    console.error('Audit log failed:', e);
  }
}

export const formatBRL = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export const formatDate = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

export const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const localISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ===== CICLO SEMANAL DON BARON =====
// A semana começa na QUARTA e fecha na TERÇA. Pagamento na quarta seguinte.
// offset 0 = semana em andamento; -1 = semana fechada (a pagar); -2 = anterior...
export function cicloSemanal(offset = 0, ref = new Date()) {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const diff = (d.getDay() - 3 + 7) % 7; // dias desde a última quarta (3 = quarta)
  const start = new Date(d);
  start.setDate(d.getDate() - diff + offset * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end, startISO: localISO(start), endISO: localISO(end) };
}

export const dentroDoCiclo = (dataStr, ciclo) =>
  !!dataStr && dataStr >= ciclo.startISO && dataStr <= ciclo.endISO;

export const labelCiclo = (ciclo) =>
  `${ciclo.start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} (qua) — ${ciclo.end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} (ter)`;

// Consumos de um motoboy dentro de um ciclo (ignora cancelados)
export function consumoDoCiclo(consumos, motoboyId, ciclo) {
  return (consumos || []).filter((c) =>
    c.motoboy_id === motoboyId && c.status !== 'cancelado' && dentroDoCiclo(c.data, ciclo)
  );
}

export function getDiaria(motoboy, config) {
  if (motoboy?.diaria != null && motoboy.diaria !== 0) return motoboy.diaria;
  if (!config) return 90;
  if (config.tipo === 'fixo') return config.valor_fixo || 90;
  const days = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  const today = days[new Date().getDay()];
  return config['valor_' + today] || config.valor_fixo || 90;
}

export const BANCOS = ['Nubank', 'Mercado Pago', 'Caixa', 'Banco do Brasil', 'Bradesco', 'Itaú', 'Santander', 'Inter', 'Sicredi', 'Outro'];
export const TIPOS_PIX = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'E-mail' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'aleatoria', label: 'Chave Aleatória' },
];