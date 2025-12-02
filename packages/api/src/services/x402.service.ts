import { ethers } from 'ethers';

interface X402PaymentData {
  version: number;
  scheme: string;
  network: string;
  amount: string;
  from: string;
  to: string;
  signature: string;
  nonce: string;
  validAfter: number;
  validBefore: number;
  txHash: string;
}

export class X402Service {
  /**
   * Decode Base64 x402 payment header
   */
  decodePaymentHeader(headerBase64: string): X402PaymentData {
    try {
      const decoded = Buffer.from(headerBase64, 'base64').toString('utf8');
      const paymentData = JSON.parse(decoded);

      return {
        version: paymentData.x402Version || 1,
        scheme: paymentData.scheme || 'exact',
        network: paymentData.network,
        amount: paymentData.payload.authorization.value,
        from: paymentData.payload.authorization.from,
        to: paymentData.payload.authorization.to,
        signature: paymentData.payload.signature,
        nonce: paymentData.payload.authorization.nonce,
        validAfter: paymentData.payload.authorization.validAfter,
        validBefore: paymentData.payload.authorization.validBefore,
        txHash: paymentData.txHash || '',
      };
    } catch (error) {
      throw new Error('Invalid x402 payment header');
    }
  }

  /**
   * Verify x402 payment signature
   */
  async verifyPayment(paymentData: X402PaymentData): Promise<boolean> {
    try {
      // Check timestamp validity
      const now = Math.floor(Date.now() / 1000);
      if (now < paymentData.validAfter || now > paymentData.validBefore) {
        console.error('Payment expired or not yet valid');
        return false;
      }

      // Verify EIP-712 signature
      const domain = {
        name: 'USD Coin',
        version: '2',
        chainId: 84532, // Base Sepolia
        verifyingContract: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      };

      const types = {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      };

      const value = {
        from: paymentData.from,
        to: paymentData.to,
        value: paymentData.amount,
        validAfter: paymentData.validAfter,
        validBefore: paymentData.validBefore,
        nonce: paymentData.nonce,
      };

      const recoveredAddress = ethers.verifyTypedData(
        domain,
        types,
        value,
        paymentData.signature
      );

      return recoveredAddress.toLowerCase() === paymentData.from.toLowerCase();
    } catch (error) {
      console.error('Payment verification failed:', error);
      return false;
    }
  }

  /**
   * Create x402 payment requirements response
   */
  createPaymentRequirements(
    amount: string,
    payTo: string,
    description: string,
    metadata?: Record<string, any>
  ) {
    return {
      x402Version: 1,
      accepts: [
        {
          scheme: 'exact',
          network: 'base-sepolia',
          maxAmountRequired: amount,
          asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC
          payTo,
          maxTimeoutSeconds: 300,
          description,
          metadata,
        },
      ],
    };
  }
}
