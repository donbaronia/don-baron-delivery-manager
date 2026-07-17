import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Ban } from 'lucide-react';
import { todayISO } from '@/lib/donbaron';

const MOTIVOS = [
  'Comportamento inadequado',
  'Suspeita de fraude',
  'Não comparecimento',
  'Solicitação do motoboy',
  'Violação de regras',
  'Outro',
];

export default function BloqueioDialog({ open, onClose, motoboy, onSaved }) {
  const [motivo, setMotivo] = useState('');
  const [customMotivo, setCustomMotivo] = useState('');
  const [dataBloqueio, setDataBloqueio] = useState(todayISO());
  const [observacao, setObservacao] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setMotivo(''); setCustomMotivo(''); setDataBloqueio(todayISO()); setObservacao(''); setError(''); };

  const handleSubmit = async () => {
    const motivoFinal = motivo === 'Outro' ? customMotivo : motivo;
    if (!motivoFinal?.trim()) { setError('Motivo é obrigatório'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('gerenciarMotoboy', {
        acao: 'bloquear',
        motoboy_id: motoboy.id,
        motivo: motivoFinal,
        data_bloqueio: dataBloqueio,
        observacao,
      });
      if (res.data?.success) { reset(); onSaved(); onClose(); }
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Ban className="w-5 h-5" />
            Bloquear Acesso
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-muted-foreground">Motoboy</Label>
            <p className="font-medium text-lg">{motoboy?.nome}</p>
            <p className="text-xs text-muted-foreground">{motoboy?.email}</p>
          </div>

          <div>
            <Label>Motivo do bloqueio</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {MOTIVOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {motivo === 'Outro' && (
            <div>
              <Label htmlFor="custom">Descreva</Label>
              <Input id="custom" value={customMotivo} onChange={(e) => setCustomMotivo(e.target.value)} />
            </div>
          )}

          <div>
            <Label htmlFor="data">Data do bloqueio</Label>
            <Input id="data" type="date" value={dataBloqueio} onChange={(e) => setDataBloqueio(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="obs">Observação (opcional)</Label>
            <Textarea id="obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} placeholder="Detalhes adicionais..." />
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
            O motoboy será imediatamente impedido de logar e fazer check-in.
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Bloqueando...' : 'Bloquear Acesso'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}