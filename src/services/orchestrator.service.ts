import { MisticProvider } from '../providers/mistic.provider';
import { MercadoPagoProvider } from '../providers/mercadopago.provider';
import { IPaymentProvider } from '../providers/ipovider.interface';

export class PaymentOrchestrator {
  
  // Decide dinamicamente qual provider usar
  static getProviderForBRL(method: 'mistic' | 'mercadopago' = 'mistic'): IPaymentProvider {
    if (method === 'mercadopago') {
      return new MercadoPagoProvider();
    }
    // Default para PIX é Mistic
    return new MisticProvider();
  }

}
