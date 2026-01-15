

import Wallet from '../../models/walletSchema.js';
import Transaction from '../../models/transactionSchema.js';

import STATUS from '../../constants/statusCode.js';
import MESSAGES from '../../constants/messages.js';

const generateDescription = (txn) => {
  const map = {
    credit: txn.orderId ? 'Refund Credited' : 'Wallet Top-up',
    debit: txn.orderId ? 'Order Payment' : 'Wallet Withdrawal',
    refund: 'Refund Request (Return)'
  };
  return map[txn.type] || 'Wallet Transaction';
};

export const getWallet = async (req, res) => {
  try {
    const userId = req.user._id;


    const page = parseInt(req.query.page) || 1;
    const limit = 5;                    
    const skip = (page - 1) * limit;

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await new Wallet({ userId, balance: 0, useInCheckout: false }).save();
    }


    const totalTransactions = await Transaction.countDocuments({ userId });


    const transactions = await Transaction.find({ userId })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const formattedTxns = transactions.map(t => ({
      ...t,
      _id: t._id.toString(),
      orderId: t.orderId ? t.orderId.toString() : null,
      amount: Number(t.amount),
      type: t.type,
      status: t.status || 'completed',
      description: t.description || generateDescription(t),
      date: t.date
    }));

    const totalPages = Math.ceil(totalTransactions / limit);

    res.render('user/wallet', {
      wallet: wallet.toObject(),
      transactions: formattedTxns,
      user: req.user,
      path: '/wallet',
      title: 'My Wallet',
      currentPage: page,
      totalPages,
      totalTransactions,
      limit,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      limit,
    });

  } catch (err) {
    console.error('Wallet Error:', err);
    req.flash('error', MESSAGES.WALLET.LOAD_FAILED || 'Failed to load wallet');
    res.redirect('/');
  }
};

export const toggleDefault = async (req, res) => {
  try {
    const { useInCheckout } = req.body;

    await Wallet.updateOne(
      { userId: req.user._id },
      { $set: { useInCheckout: Boolean(useInCheckout) } },
      { upsert: true }
    );

    res.json({ 
      success: true,
      message: MESSAGES.WALLET.TOGGLE_SUCCESS || 'Wallet settings updated'
    });
  } catch (err) {
    console.error('Wallet toggle error:', err);
    res.status(STATUS.INTERNAL_ERROR).json({ 
      success: false,
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'Failed to update wallet settings'
    });
  }
};