import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { logAuditoria } from '@/lib/donbaron';
import { Save, CheckCircle2 } from 'lucide-react';

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
    </div>
  );
}