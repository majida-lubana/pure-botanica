

import Wallet from '../models/walletSchema.js';
import Transaction from '../models/transactionSchema.js';

export const creditWallet = async (userId, amount, orderId = null, description = '') => {
  try {
    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0 });
    }

    wallet.balance += Number(amount); 
    await wallet.save();

    await Transaction.create({
      userId,
      orderId,
      amount: Number(amount),
      type: 'credit',
      description: description || (orderId ? 'Refund Credited' : 'Wallet Top-up'),
      status: 'completed'
    });

    return wallet;
  } catch (error) {
    console.error('creditWallet error:', error);
    throw new Error('Failed to credit wallet');
  }
};

export const debitWallet = async (userId, amount, orderId = null, description = '') => {
  try {
    const wallet = await Wallet.findOne({ userId });

    if (!wallet || wallet.balance < amount) {
      throw new Error('Insufficient wallet balance');
    }

    wallet.balance -= Number(amount);
    await wallet.save();

    await Transaction.create({
      userId,
      orderId,
      amount: Number(amount),
      type: 'debit',
      description: description || (orderId ? 'Order Payment via Wallet' : 'Wallet Withdrawal'),
      status: 'completed'
    });

    return wallet;
  } catch (error) {
    console.error('debitWallet error:', error);
    throw error; 
  }
};