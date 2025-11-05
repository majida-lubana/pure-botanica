
const Wallet = require('../models/walletSchema');
const Transaction = require('../models/transactionSchema');

const creditWallet = async (userId, amount, orderId = null, description = '') => {
 
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = new Wallet({ userId, balance: 0 });
  }

  wallet.balance += amount;
  await wallet.save();


  await Transaction.create({
    userId,
    orderId,
    amount,
    type: 'credit',
    description: description || (orderId ? 'Refund Credited' : 'Wallet Top-up'),
    status: 'completed'
  });

  return wallet;
};

const debitWallet = async (userId, amount, orderId = null, description = '') => {
  const wallet = await Wallet.findOne({ userId });
  if (!wallet || wallet.balance < amount) {
    throw new Error('Insufficient balance');
  }

  wallet.balance -= amount;
  await wallet.save();

  await Transaction.create({
    userId,
    orderId,
    amount,
    type: 'debit',
    description: description || (orderId ? 'Order Payment' : 'Wallet Withdrawal'),
    status: 'completed'
  });

  return wallet;
};

module.exports = { creditWallet, debitWallet };