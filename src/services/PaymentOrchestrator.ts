import { IPaymentProvider } from '../providers/IPaymentProvider';
import { MisticProvider } from '../providers/MisticProvider';
import { MercadoPagoProvider } from '../providers/MercadoPagoProvider';

export class PaymentOrchestrator {
  private static providers: Record<string, IPaymentProvider> = {
    mistic: new MisticProvider(process.env.MISTIC_API_KEY || '', process.env.MISTIC_SECRET || ''),
    mercadopago: new MercadoPagoProvider(process.env.MP_ACCESS_TOKEN || '')
  };

  static getProvider(name: string): IPaymentProvider {
    const provider = this.providers[name.toLowerCase()];
    if (!provider) throw new Error(`Provedor de pagamento ${name} não suportado.`);
    return provider;
  }

  // Lógica de Roteamento Dinâmico (Ex: Se for BRL < 1000, usa Mistic. Se for > 1000 usa MercadoPago)
  static routeInflow(amount: number, currency: string, method: string): IPaymentProvider {
    if (currency === 'BRL' && method === 'PIX') {
      return amount <= 1000 ? this.providers['mistic'] : this.providers['mercadopago'];
    }
    // Default fallback
    return this.providers['mercadopago'];
  }
}
