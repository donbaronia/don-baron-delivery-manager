import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Copy, Check } from 'lucide-react';
import { pixPayload } from '@/lib/pix';
import { formatBRL } from '@/lib/donbaron';

/**
 * Sheet que exibe o QR Code PIX de um motoboy.
 * @param {object} target - { m: motoboy, valor?: number|null, subtitle?: string } ou null
 * @param {function} onClose
 */
export default function QrCodeSheet({ target, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!target) { setQrDataUrl(''); return; }
    const m = target.m;
    const chave = m.pix || '';
    const tipo = m.tipo_chave_pix || 'pix';
    if (!chave) { setQrDataUrl(''); return; }
    const payload = pixPayload(chave, target.valor ?? null, m.nome, 'Teresina', tipo);
    QRCode.toDataURL(payload, { width: 240, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [target]);

  if (!target) return null;

  const m = target.m;
  const chave = m.pix || '';
  const tipo = m.tipo_chave_pix || 'pix';
  const semValor = target.valor == null;

  const copiarChave = () => {
    navigator.clipboard.writeText(chave).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <Sheet open={!!target} onOpenChange={(o) => { if (!o) { onClose(); } }}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <SheetTitle className="text-xl">{m.nome}</SheetTitle>
          <p className="text-sm text-muted-foreground">{target.subtitle || (semValor ? 'QR Code PIX sem valor' : `Valor: ${formatBRL(target.valor)}`)}</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">PIX</span>
              <span className="text-xs text-emerald-600 bg-emerald-100 rounded-full px-2 py-0.5">{tipo}</span>
            </div>
            {chave ? (
              <>
                <div className="flex flex-col items-center gap-2">
                  <div className="bg-white rounded-xl p-3 shadow-sm border border-emerald-100">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="QR Code PIX" width={208} height={208} className="block" />
                    ) : (
                      <div className="w-[208px] h-[208px] bg-muted animate-pulse rounded" />
                    )}
                  </div>
                  <p className="text-xs text-emerald-700 font-medium">
                    {semValor ? 'QR sem valor — o pagador digita o quanto quiser' : <>Valor já incluído: <strong>{formatBRL(target.valor)}</strong></>}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-emerald-100 px-3 py-2 flex items-center gap-2">
                  <p className="flex-1 text-sm font-mono text-emerald-900 break-all">{chave}</p>
                  <button
                    onClick={copiarChave}
                    className="shrink-0 flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg px-2 py-1.5 transition-colors"
                  >
                    {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiado ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">⚠️ PIX não cadastrado — atualize o cadastro deste motoboy.</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}