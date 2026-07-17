import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function EmergencyCheckin({ open, onClose, motoboys, onDone }) {
  const [senha, setSenha] = useState('');
  const [motoboyId, setMotoboyId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async () => {
    if (!senha || !motoboyId || !motivo.trim()) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke('loginEmergencial', {
        motoboy_id: motoboyId,
        senha_master: senha,
        motivo: motivo.trim(),
      });
      setResult(res.data);
      onDone?.();
    } catch (e) {
      alert('Erro: ' + (e.response?.data?.error || e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSenha(''); setMotoboyId(''); setMotivo(''); setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        {result ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="font-bold text-lg">Check-in Manual Realizado</h3>
            <p className="text-sm text-muted-foreground">{result.checkIn.motoboy_nome} • {result.checkIn.hora}</p>
            <Button onClick={handleClose} className="w-full">Fechar</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                Check-in Manual
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700">
                  Uso exclusivo do administrador. Todas as ações são registradas em auditoria.
                </p>
              </div>
              <div>
                <Label>Senha Master</Label>
                <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <Label>Motoboy</Label>
                <Select value={motoboyId} onValueChange={setMotoboyId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {motoboys.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Motivo (obrigatório)</Label>
                <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Descreva o motivo do check-in manual..." rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={saving || !senha || !motoboyId || !motivo.trim()}>
                {saving ? 'Registrando...' : 'Confirmar'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}