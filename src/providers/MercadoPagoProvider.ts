import { IPaymentProvider } from './IPaymentProvider';

export class MercadoPagoProvider implements IPaymentProvider {
  name = 'mercadopago';
  private apiUrl = 'https://api.mercadopago.com/v1';

  constructor(private accessToken: string) {}

  // 📥 DEPÓSITOS: Gerar PIX via Mercado Pago
  async generatePix(amount: number, txId: string, customerData: any) {
    console.log(`[MercadoPago] A gerar PIX de R$ ${amount}`);
    
    const response = await fetch(`${this.apiUrl}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'X-Idempotency-Key': txId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transaction_amount: amount,
        payment_method_id: 'pix',
        external_reference: txId,
        payer: { email: customerData.email || 'customer@nexflowx.tech' }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.message);

    return {
      qr_code: data.point_of_interaction.transaction_data.qr_code_base64,
      pix_copia_cola: data.point_of_interaction.transaction_data.qr_code,
      txid_provider: data.id.toString()
    };
  }

  // 🔗 DEPÓSITOS: Checkout Genérico (Cartões/Boleto)
  async generateCheckoutLink(amount: number, currency: string, txId: string) {
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ title: 'Depósito NeXFlowX', quantity: 1, unit_price: amount, currency_id: currency }],
        external_reference: txId
      })
    });
    
    const data = await response.json();
    return data.init_point;
  }

  async verifyTransaction(providerTxId: string) {
    const response = await fetch(`${this.apiUrl}/payments/${providerTxId}`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });
    const data = await response.json();
    
    return {
      status: data.status === 'approved' ? 'paid' as const : 'pending' as const,
      net_amount: data.transaction_details.net_received_amount,
      fee: data.fee_details.reduce((acc: number, f: any) => acc + f.amount, 0)
    };
  }
}
