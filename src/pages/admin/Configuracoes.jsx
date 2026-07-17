import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { logAuditoria } from '@/lib/donbaron';
import { Save, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';

const DAYS = [
  { key: 'seg', label: 'Segunda' },
  { key: 'ter', label: 'Terça' },
  { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' },
  { key: 'sex', label: 'Sexta' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
];

export default function Configuracoes() {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const list = await base44.entities.ConfigDiaria.list();
      if (list.length > 0) {
        setConfig(list[0]);
      } else {
        setConfig({
          tipo: 'semanal',
          valor_fixo: 90,
          valor_seg: 89, valor_ter: 89, valor_qua: 89, valor_qui: 89,
          valor_sex: 99, valor_sab: 99, valor_dom: 120,
        });
      }
    };
    load();
  }, []);

  const set = (k, v) => setConfig((c) => ({ ...c, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      if (config.id) {
        await base44.entities.ConfigDiaria.update(config.id, config);
      } else {
        await base44.entities.ConfigDiaria.create(config);
      }
      await logAuditoria('alteracao_diaria', `Configuração de diária alterada: tipo ${config.tipo}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('Erro: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Configuração de diária dos motoboys</p>
      </div>

      <Card className="p-6 border-border/60 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-semibold">Tipo de diária</Label>
            <p className="text-sm text-muted-foreground mt-0.5">
              {config.tipo === 'fixo' ? 'Valor fixo para todos os dias' : 'Valor variável por dia da semana'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${config.tipo === 'fixo' ? 'text-foreground' : 'text-muted-foreground'}`}>Fixo</span>
            <Switch
              checked={config.tipo === 'semanal'}
              onCheckedChange={(v) => set('tipo', v ? 'semanal' : 'fixo')}
            />
            <span className={`text-sm font-medium ${config.tipo === 'semanal' ? 'text-foreground' : 'text-muted-foreground'}`}>Semanal</span>
          </div>
        </div>

        {config.tipo === 'fixo' ? (
          <div>
            <Label>Valor fixo da diária (R$)</Label>
            <Input
              type="number"
              value={config.valor_fixo || 0}
              onChange={(e) => set('valor_fixo', Number(e.target.value))}
              className="max-w-xs"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <Label>Valores por dia da semana</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DAYS.map((d) => (
                <div key={d.key} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-20">{d.label}</span>
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      value={config['valor_' + d.key] || 0}
                      onChange={(e) => set('valor_' + d.key, Number(e.target.value))}
                      className="pl-9"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Configuração'}
          </Button>
        </div>
      </Card>

      <ZonaPerigo />
    </div>
  );
}

// ===== ZONA DE PERIGO: RESET DE DADOS =====
const ALVOS_RESET = [
  { key: 'checkins', label: 'Check-ins (presenças)' },
  { key: 'consumos', label: 'Consumos' },
  { key: 'pagamentos', label: 'Pagamentos' },
  { key: 'ciclos', label: 'PINs e tokens diários' },
  { key: 'motoboys', label: 'Motoboys (funcionários)' },
  { key: 'auditoria', label: 'Auditoria (histórico de ações)' },
];

function ZonaPerigo() {
  const [alvos, setAlvos] = useState(['checkins', 'consumos', 'pagamentos', 'ciclos']);
  const [confirmacao, setConfirmacao] = useState('');
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  const toggle = (key) =>
    setAlvos((a) => (a.includes(key) ? a.filter((x) => x !== key) : [...a, key]));

  const executar = async () => {
    setErro('');
    setResultado(null);
    if (confirmacao !== 'RESETAR') {
      setErro('Digite RESETAR no campo de confirmação.');
      return;
    }
    if (alvos.length === 0) {
      setErro('Selecione pelo menos um tipo de dado.');
      return;
    }
    if (!window.confirm('ATENÇÃO: isso apaga os dados selecionados de forma PERMANENTE. Não tem como desfazer. Continuar?')) return;
    setExecutando(true);
    try {
      const res = await base44.functions.invoke('resetDados', { alvos, confirmacao });
      const data = res?.data || res;
      if (data?.success) {
        setResultado(data.resultado);
        setConfirmacao('');
      } else {
        setErro(data?.error || 'Falha ao executar o reset.');
      }
    } catch (e) {
      setErro(e?.message || 'Falha ao executar o reset.');
    } finally {
      setExecutando(false);
    }
  };

  return (
    <Card className="p-6 border-red-300/60 bg-red-50/30 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-red-600" />
        <h2 className="text-lg font-heading font-bold text-red-700">Zona de Perigo — Reset de Dados</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Apaga permanentemente os dados selecionados. Use para limpar dados de teste antes de começar a operação real.
        A configuração de diárias <strong>não</strong> é apagada.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ALVOS_RESET.map((a) => (
          <label key={a.key} className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={alvos.includes(a.key)}
              onChange={() => toggle(a.key)}
              className="w-4 h-4 accent-red-600"
            />
            {a.label}
          </label>
        ))}
      </div>
      <div className="space-y-2 max-w-xs">
        <Label className="text-red-700">Digite RESETAR para confirmar</Label>
        <Input
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value.toUpperCase())}
          placeholder="RESETAR"
          className="border-red-300"
        />
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {resultado && (
        <div className="text-sm bg-white rounded-lg border border-emerald-200 p-3">
          <p className="font-semibold text-emerald-700 mb-1">Reset concluído:</p>
          {Object.entries(resultado).map(([k, v]) => (
            <p key={k} className="text-muted-foreground">{k}: {v} registro(s) apagado(s)</p>
          ))}
        </div>
      )}
      <Button
        variant="destructive"
        onClick={executar}
        disabled={executando || confirmacao !== 'RESETAR'}
        className="gap-2"
      >
        <Trash2 className="w-4 h-4" />
        {executando ? 'Apagando...' : 'Apagar dados selecionados'}
      </Button>
    </Card>
  );
}