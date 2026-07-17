import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function ExcluirDialog({ open, onClose, motoboy, onSaved }) {
  const [confirmacao, setConfirmacao] = useState('');
  const [senhaMaster, setSenhaMaster] = useState('');
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const reset = () => { setConfirmacao(''); setSenhaMaster(''); setMotivo(''); setError(''); setResult(null); };

  const handleSubmit = async () => {
    if (confirmacao !== 'EXCLUIR') { setError('Digite a palavra EXCLUIR para confirmar'); return; }
    if (!senhaMaster) { setError('Senha master é obrigatória'); return; }
    if (!motivo.trim()) { setError('Motivo é obrigatório'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('gerenciarMotoboy', {
        acao: 'excluir',
        motoboy_id: motoboy.id,
        motivo,
        senha_master: senhaMaster,
        confirmacao,
      });
      if (res.data?.success) {
        setResult(res.data);
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (result) { reset(); onSaved(); onClose(); }
    else { reset(); onClose(); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <ShieldAlert className="w-5 h-5" />
            Excluir Definitivamente
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="py-4 space-y-4">
            {result.acao === 'excluido' ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                <p className="font-semibold">Cadastro excluído definitivamente.</p>
                <p className="text-sm text-muted-foreground">O motoboy não possuía histórico operacional.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Exclusão negada — cadastro preservado</p>
                    <p className="mt-1">{result.motivo}</p>
                    <p className="mt-1 text-xs">Check-ins: {result.checkIns} • Pagamentos: {result.pagamentos}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">O cadastro foi convertido para <strong>INATIVO</strong>. O histórico é preservado.</p>
              </div>
            )}
            <DialogFooter>
              <Button onClick={handleClose} className="w-full">Concluir</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs text-muted-foreground">Motoboy</Label>
                <p className="font-medium text-lg">{motoboy?.nome}</p>
                <p className="text-xs text-muted-foreground">{motoboy?.email}</p>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                <p className="font-semibold mb-1">⚠️ Atenção</p>
                <p>O sistema verifica histórico automaticamente. Se houver check-ins ou pagamentos, o cadastro será preservado como INATIVO.</p>
              </div>

              <div>
                <Label htmlFor="conf">Digite <strong>EXCLUIR</strong> para confirmar</Label>
                <Input id="conf" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder="EXCLUIR" />
              </div>

              <div>
                <Label htmlFor="pass">Senha Master</Label>
                <Input id="pass" type="password" value={senhaMaster} onChange={(e) => setSenhaMaster(e.target.value)} placeholder="••••••••" />
              </div>

              <div>
                <Label htmlFor="mot">Motivo da exclusão</Label>
                <Input id="mot" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: cadastro duplicado, teste..." />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
              <Button variant="destructive" onClick={handleSubmit} disabled={loading}>
                {loading ? 'Processando...' : 'Excluir Definitivamente'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}