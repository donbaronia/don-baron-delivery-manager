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

// Soma o consumo pendente/descontado do mês (ignora cancelados)
export function consumoDoMes(consumos, motoboyId, month, year) {
  return (consumos || []).filter((c) => {
    if (c.motoboy_id !== motoboyId || c.status === 'cancelado') return false;
    const d = new Date(c.data + 'T00:00:00');
    return d.getMonth() === month && d.getFullYear() === year;
  });
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