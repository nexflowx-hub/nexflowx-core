import { IPaymentProvider } from './IPaymentProvider';

export class MisticProvider implements IPaymentProvider {
  name = 'mistic';
  private apiUrl = 'https://api.misticpay.com/v1'; // Ajustar conforme a Doc

  constructor(private apiKey: string, private apiSecret: string) {}

  private async getHeaders() {
    // Exemplo padrão de Basic Auth ou Bearer Token
    const token = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
    return {
      'Authorization': `Basic ${token}`,
      'Content-Type': 'application/json'
    };
  }

  // 📥 DEPÓSITOS: Gerar PIX Dinâmico
  async generatePix(amount: number, txId: string, customerData: any) {
    console.log(`[MisticPay] A gerar PIX de R$ ${amount} para TxID: ${txId}`);
    
    // Substituir pelo payload exato da documentação docs.misticpay.com
    const response = await fetch(`${this.apiUrl}/pix/qrcode`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({
        value: amount,
        external_reference: txId,
        payer: { name: customerData.name, document: customerData.cpf }
      })
    });

    if (!response.ok) throw new Error("Erro na API MisticPay ao gerar PIX");
    
    const data = await response.json();
    return {
      qr_code: data.qr_code_base64,
      pix_copia_cola: data.emv_payload,
      txid_provider: data.txid
    };
  }

  // 📤 LEVANTAMENTOS: Disparar PIX para o Cliente
  async processPayoutPix(amount: number, pixKey: string, pixKeyType: string) {
    console.log(`[MisticPay] A processar Payout PIX de R$ ${amount} para a chave ${pixKey}`);
    
    const response = await fetch(`${this.apiUrl}/payout/pix`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({
        amount: amount,
        receiver_key: pixKey,
        key_type: pixKeyType // CPF, EMAIL, PHONE, RANDOM
      })
    });

    if (!response.ok) throw new Error("Erro na API MisticPay ao processar Payout");
    
    const data = await response.json();
    return { status: 'processing', receipt: data.end_to_end_id || data.transfer_id };
  }

  // 🔄 WEBBHOOKS / STATUS: Verificar se já pagou
  async verifyTransaction(providerTxId: string) {
    const response = await fetch(`${this.apiUrl}/pix/status/${providerTxId}`, {
      headers: await this.getHeaders()
    });
    const data = await response.json();
    
    return {
      status: data.status === 'PAID' ? 'paid' as const : 'pending' as const,
      net_amount: data.net_value,
      fee: data.fee
    };
  }
}
