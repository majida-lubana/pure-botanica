import Referral from '../../models/referralSchema.js';
import User from '../../models/userSchema.js';
import Wallet from '../../models/walletSchema.js';
import Transaction from '../../models/transactionSchema.js';
import { creditWallet } from '../../utils/walletUtils.js';

import MESSAGES from '../../constants/messages.js';

export const getReferralPage = async (req, res) => {
  try {
    const userId = req.session.user;
    
    if (!userId) {
      return res.redirect('/login');
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.redirect('/login');
    }

    let referral = await Referral.findOne({ userId }).populate('invitedUsers.userId', 'name email');
    
    if (!referral) {
      const referralCode = await Referral.generateUniqueCode(user.name);
      
      referral = await Referral.create({
        userId: user._id,
        referralCode: referralCode,
        invitedUsers: [],
        totalEarned: 0,
        totalInvites: 0,
        pendingRewards: 0
      });
    }

    const invitedCount = referral.invitedUsers.length;
    const pendingCount = referral.invitedUsers.filter(u => u.status === 'pending').length;

    const history = referral.invitedUsers.map(invite => ({
      friendName: invite.userId?.name || invite.name,
      friendEmail: invite.userId?.email || invite.email,
      invitedAt: invite.invitedAt,
      status: invite.status,
      earned: invite.status === 'completed' ? invite.rewardAmount : 0
    })).reverse();

    res.render('user/referral', {
      user,
      referral: {
        code: referral.referralCode,
        invitedCount,
        earned: referral.totalEarned,
        pendingCount,
        history
      },
      title: 'Referral Program',
      path: '/referral'
    });

  } catch (error) {
    console.error('Referral page error:', error);
    res.render('user/page-404', {
      message: MESSAGES.REFERRAL.LOAD_FAILED || 'An error occurred while loading the referral page.',
      pageTitle: 'Error'
    });
  }
};

export const processReferralSignup = async (newUserId, referralCode) => {
  try {
    if (!referralCode) return;

    const referrerDoc = await Referral.findOne({ referralCode: referralCode.toUpperCase() });
    if (!referrerDoc) return;

    const newUser = await User.findById(newUserId);
    if (!newUser || newUser.hasUsedReferral) return;
    if (referrerDoc.userId.toString() === newUserId.toString()) return;

    referrerDoc.invitedUsers.push({
      userId: newUserId,
      email: newUser.email,
      name: newUser.name,
      invitedAt: new Date(),
      status: 'pending',
      rewardAmount: 100,
      firstOrderCompleted: false
    });

    referrerDoc.totalInvites += 1;
    referrerDoc.pendingRewards += 100;
    await referrerDoc.save();

    await User.findByIdAndUpdate(newUserId, {
      referredBy: referrerDoc.userId,
      hasUsedReferral: true
    });


    await creditWallet(referrerDoc.userId, 100, null, `Referral Bonus – ${newUser.email} signed up`);
    await creditWallet(newUserId, 50, null, `Welcome Bonus – ${referrerDoc.referralCode}`);

    referrerDoc.totalEarned += 100;
    await referrerDoc.save();

    console.log(`Referral signup OK – ${newUser.email} +50, referrer +100 (totalEarned=${referrerDoc.totalEarned})`);

  } catch (err) {
    console.error('processReferralSignup error:', err);
  }
};

const creditReferralReward = async (userId, amount, referredUserEmail) => {
  try {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      console.log('Creating new wallet');
      wallet = await Wallet.create({ 
        userId, 
        balance: 0, 
        useInCheckout: false 
      });
    }

    wallet.balance += amount;
    await wallet.save();

    const txn = await Transaction.create({
      userId: userId,
      amount: amount,
      type: 'credit',
      status: 'completed',
      description: `Referral Bonus - ${referredUserEmail}'s first order`,
      date: new Date()
    });

    console.log('Transaction created:', txn._id);
    console.log('Wallet credited successfully');

  } catch (error) {
    console.error('Credit referral reward error:', error);
    throw error;
  }
};

export const validateReferralCode = async (referralCode) => {
  try {
    if (!referralCode) {
      return { 
        valid: false,
        message: MESSAGES.REFERRAL.NO_CODE || 'No referral code provided'
      };
    }

    const referrerDoc = await Referral.findOne({ 
      referralCode: referralCode.toUpperCase() 
    });

    return { 
      valid: !!referrerDoc,
      referrerId: referrerDoc ? referrerDoc.userId : null,
      message: referrerDoc 
        ? MESSAGES.REFERRAL.VALID || 'Valid referral code'
        : MESSAGES.REFERRAL.INVALID || 'Invalid referral code'
    };

  } catch (error) {
    console.error('Validate referral code error:', error);
    return { 
      valid: false,
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'Error validating referral code'
    };
  }
};


export default {
  getReferralPage,
  processReferralSignup,
  validateReferralCode
};