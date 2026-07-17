import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, AlertTriangle } from 'lucide-react';
import { todayISO } from '@/lib/donbaron';

const MOTIVOS = [
  'Falha de internet',
  'Falha do aplicativo',
  'Esqueceu a senha',
  'Dispositivo com problema',
  'Exceção autorizada',
  'Outro',
];

export default function CheckInManualDialog({ open, onClose, motoboy, onSaved }) {
  const [data, setData] = useState(todayISO());
  const [hora, setHora] = useState(new Date().toTimeString().substring(0, 5));
  const [motivo, setMotivo] = useState('');
  const [customMotivo, setCustomMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setData(todayISO());
    setHora(new Date().toTimeString().substring(0, 5));
    setMotivo('');
    setCustomMotivo('');
    setError('');
  };

  const handleSubmit = async () => {
    const motivoFinal = motivo === 'Outro' ? customMotivo : motivo;
    if (!motivoFinal?.trim()) { setError('Selecione ou descreva o motivo'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('checkInManual', {
        motoboy_id: motoboy.id,
        motivo: motivoFinal,
        data,
        hora: hora + ':00',
      });
      if (res.data?.success) {
        reset();
        onSaved();
        onClose();
      }
    } catch (e) {
      const err = e.response?.data?.error || e.message;
      if (err === 'check_in_duplicado') {
        const horaExistente = e.response?.data?.hora || '';
        setError(`Este motoboy já realizou check-in hoje${horaExistente ? ' às ' + horaExistente : ''}.`);
      } else {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent" />
            Check-in Manual
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-muted-foreground">Motoboy</Label>
            <p className="font-medium text-lg">{motoboy?.nome}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="data">Data</Label>
              <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="hora">Hora</Label>
              <Input id="hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Motivo</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger><SelectValue placeholder="Selecione o motivo..." /></SelectTrigger>
              <SelectContent>
                {MOTIVOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {motivo === 'Outro' && (
            <div>
              <Label htmlFor="custom">Descreva o motivo</Label>
              <Input id="custom" value={customMotivo} onChange={(e) => setCustomMotivo(e.target.value)} placeholder="Descreva..." />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading} className="gap-2">
            {loading ? 'Registrando...' : 'Confirmar Check-in'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}