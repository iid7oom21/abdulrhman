import crypto from 'crypto';

export function createPaymentIntent({ userId, packageId, amount, currency, idempotencyKey }) {
  return {
    id: `pay_sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    packageId,
    amount,
    currency,
    status: 'pending',
    checkoutUrl: `https://simulation.local/checkout/${idempotencyKey}`,
    idempotencyKey,
    createdAt: new Date().toISOString()
  };
}

export function verifyWebhookSignature(payload, signature, secret) {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature) || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function simulatePaidWebhook({ paymentId, amount, currency, secret }) {
  const payload = { paymentId, amount, currency, status: 'paid', event: 'payment.succeeded' };
  const signature = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  return { payload, signature };
}
