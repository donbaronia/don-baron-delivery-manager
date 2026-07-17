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

export const todayISO = () => new Date().toISOString().split('T')[0];

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