const Wallet = require("../../models/walletSchema");
const Transaction = require("../../models/transactionSchema");
const { creditWallet } = require('../../utils/walletUtils');
const STATUS = require('../../constants/statusCode');
const MESSAGES = require('../../constants/messages'); // Centralized messages

const generateDescription = (txn) => {
  const map = {
    credit: txn.orderId ? 'Refund Credited' : 'Wallet Top-up',
    debit: txn.orderId ? 'Order Payment' : 'Wallet Withdrawal',
    refund: 'Refund Request (Return)'
  };
  return map[txn.type] || 'Wallet Transaction';
};

exports.getWallet = async (req, res) => {
  try {
    const userId = req.user._id;

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await new Wallet({ userId, balance: 0, useInCheckout: false }).save();
    }

    const transactions = await Transaction.find({ userId })
      .sort({ date: -1 })
      .limit(50)
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

    res.render('user/wallet', {
      wallet: wallet.toObject(),
      transactions: formattedTxns,
      user: req.user,
      path: '/wallet',
      title: 'My Wallet'
    });

  } catch (err) {
    console.error('Wallet Error:', err);
    req.flash('error', MESSAGES.WALLET.LOAD_FAILED || 'Failed to load wallet');
    res.redirect('/');
  }
};

exports.toggleDefault = async (req, res) => {
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