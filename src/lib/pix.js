// Gerador de Payload PIX (padrão EMV – Banco Central)

// Normaliza a chave PIX conforme o tipo (padrão Banco Central)
export const normalizarChave = (chave, tipo) => {
  const raw = String(chave || '').trim();
  if (tipo === 'cpf' || tipo === 'cnpj') return raw.replace(/\D/g, '');
  if (tipo === 'telefone' || tipo === 'phone') {
    const nums = raw.replace(/\D/g, '');
    if (raw.startsWith('+')) return raw.replace(/[^+\d]/g, '');
    return '+55' + nums;
  }
  if (tipo === 'email') return raw.toLowerCase();
  return raw; // chave aleatória ou outros
};

/**
 * Gera o payload PIX EMV.
 * @param {string} chave - chave PIX do recebedor
 * @param {number|null} valor - valor a pagar, ou null/undefined para QR sem valor
 * @param {string} nome - nome do recebedor
 * @param {string} cidade - cidade do recebedor
 * @param {string} tipo - tipo da chave (cpf, cnpj, email, telefone, aleatoria)
 */
export const pixPayload = (chave, valor, nome = 'Don Baron', cidade = 'Teresina', tipo = 'email') => {
  const fmt = (id, val) => {
    const v = String(val);
    return `${id}${String(v.length).padStart(2, '0')}${v}`;
  };
  const chaveFmt = normalizarChave(chave, tipo);
  const merchantAccountInfo = fmt('00', 'BR.GOV.BCB.PIX') + fmt('01', chaveFmt);
  const nomeStr = nome.substring(0, 25).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase();
  const cidadeStr = cidade.substring(0, 15).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase();

  let raw =
    fmt('00', '01') +                         // Payload version
    fmt('26', merchantAccountInfo) +           // Merchant account info
    fmt('52', '0000') +                        // MCC
    fmt('53', '986') +                          // BRL
    (valor != null && !isNaN(valor) ? fmt('54', Number(valor).toFixed(2)) : '') + // Valor (opcional)
    fmt('58', 'BR') +                           // País
    fmt('59', nomeStr) +                        // Nome
    fmt('60', cidadeStr) +                      // Cidade
    fmt('62', fmt('05', '***')) +               // Additional data
    '6304';                                      // CRC placeholder

  // CRC16-CCITT
  let crc = 0xFFFF;
  for (const c of raw) {
    crc ^= c.charCodeAt(0) << 8;
    for (let i = 0; i < 8; i++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
    crc &= 0xFFFF;
  }
  return raw + crc.toString(16).toUpperCase().padStart(4, '0');
};