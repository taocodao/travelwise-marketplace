import { Request, Response, NextFunction } from 'express';
import { ethers } from 'ethers';

export async function verifyWalletSignature(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { signature, message, address } = req.body;

    if (!signature || !message || !address) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify signature
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Attach verified address to request
    (req as any).walletAddress = recoveredAddress;

    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
}
