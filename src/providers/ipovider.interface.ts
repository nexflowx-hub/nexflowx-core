export interface ProviderResponse {
  provider_tx_id: string;
  status: 'pending' | 'completed' | 'failed';
  qr_code?: string;           // Para PIX Copia e Cola (BRCode)
  qr_code_base64?: string;    // Para imagem do QR Code
  redirect_url?: string;      // Para Cartões/Checkout
  crypto_address?: string;    // Para Crypto
}

export interface IPaymentProvider {
  providerName: string;
  
  // O contrato obriga todos os providers a terem a função de In (Pay-In)
  createPixPayment(amount: number, txId: string, customerData?: any): Promise<ProviderResponse>;
  
  // Função para validar manualmente o status no Provider
  verifyPayment(providerTxId: string): Promise<boolean>;
}
