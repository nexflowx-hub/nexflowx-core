import { IPaymentProvider, ProviderResponse } from './ipovider.interface';

export class MisticProvider implements IPaymentProvider {
  providerName = 'mistic';
  private apiKey = process.env.MISTIC_API_KEY || '';
  private apiUrl = 'https://api.misticpay.com/v1'; // Base URL da Mistic

  async createPixPayment(amount: number, txId: string, customerData?: any): Promise<ProviderResponse> {
    try {
      // Chamada HTTP Real à API da Mistic Pay
      const response = await fetch(`${this.apiUrl}/pix/qrcode`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amount,
          external_reference: txId, // O nosso ID de transação para conciliação
          description: `NeXFlowX Deposit ${txId}`,
          payer: {
            name: customerData?.name || 'Customer',
            document: customerData?.document || '00000000000' // CPF
          }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Erro na Mistic API');

      // Traduzimos a resposta da Mistic para a nossa Língua Universal
      return {
        provider_tx_id: data.id_transacao,
        status: 'pending',
        qr_code: data.pix_copia_e_cola, 
        qr_code_base64: data.qr_code_base64
      };
    } catch (error: any) {
      console.error(`[MisticProvider] Erro: ${error.message}`);
      throw error;
    }
  }

  async verifyPayment(providerTxId: string): Promise<boolean> {
    const response = await fetch(`${this.apiUrl}/pix/${providerTxId}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });
    const data = await response.json();
    return data.status === 'PAID';
  }
}
