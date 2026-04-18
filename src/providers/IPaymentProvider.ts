export interface IPaymentProvider {
  name: string;
  
  // Depósitos (Pay-ins)
  generatePix?(amount: number, txId: string, customerData: any): Promise<{ qr_code: string, pix_copia_cola: string, txid_provider: string }>;
  generateCheckoutLink?(amount: number, currency: string, txId: string): Promise<string>;
  
  // Levantamentos (Payouts)
  processPayoutPix?(amount: number, pixKey: string, pixKeyType: string): Promise<{ status: string, receipt: string }>;
  
  // Verificação de Estado
  verifyTransaction(providerTxId: string): Promise<{ status: 'paid' | 'pending' | 'failed', net_amount: number, fee: number }>;
}
