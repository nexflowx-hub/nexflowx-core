import { IPaymentProvider, ProviderResponse } from './ipovider.interface';

export class MercadoPagoProvider implements IPaymentProvider {
  providerName = 'mercadopago';
  private accessToken = process.env.MP_ACCESS_TOKEN || '';

  async createPixPayment(amount: number, txId: string, customerData?: any): Promise<ProviderResponse> {
    try {
      const response = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'X-Idempotency-Key': txId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transaction_amount: amount,
          description: `NeXFlowX Deposit ${txId}`,
          payment_method_id: 'pix',
          payer: { email: customerData?.email || 'customer@nexflowx.tech' }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      return {
        provider_tx_id: data.id.toString(),
        status: 'pending',
        qr_code: data.point_of_interaction.transaction_data.qr_code,
        qr_code_base64: data.point_of_interaction.transaction_data.qr_code_base64
      };
    } catch (error: any) {
      console.error(`[MercadoPagoProvider] Erro: ${error.message}`);
      throw error;
    }
  }

  async verifyPayment(providerTxId: string): Promise<boolean> {
    // Implementação de verificação MP
    return false; // Simplificado para este exemplo
  }
}
