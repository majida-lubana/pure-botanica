// utils/referralUtils.js
const Referral = require('../models/referralSchema');   
const User = require('../models/userSchema');          
const { creditWallet } = require('./walletUtils');      


const processReferralReward = async (newUserId) => {
  try {
    console.log('[processReferralReward] Starting for userId:', newUserId);
    
    const newUser = await User.findById(newUserId);
    console.log('[processReferralReward] User found:', newUser ? 'Yes' : 'No');
    console.log('[processReferralReward] User referredBy:', newUser?.referredBy);
    
    if (!newUser || !newUser.referredBy) {
      console.log('[processReferralReward] No referrer found, exiting');
      return;
    }

    const referrerDoc = await Referral.findOne({ userId: newUser.referredBy });
    console.log('[processReferralReward] Referrer doc found:', referrerDoc ? 'Yes' : 'No');
    
    if (!referrerDoc) {
      console.log('[processReferralReward] No referrer document found');
      return;
    }

    const inviteIndex = referrerDoc.invitedUsers.findIndex(
      (u) => u.userId && u.userId.toString() === newUserId.toString()
    );

    if (inviteIndex === -1) return;

    const invite = referrerDoc.invitedUsers[inviteIndex];
    if (invite.status === 'completed') return;


    referrerDoc.invitedUsers[inviteIndex].status = 'completed';
    referrerDoc.invitedUsers[inviteIndex].firstOrderCompleted = true;
    referrerDoc.invitedUsers[inviteIndex].firstOrderAt = new Date();

  
    referrerDoc.totalEarned += invite.rewardAmount;
    referrerDoc.pendingRewards -= invite.rewardAmount;


    await referrerDoc.save();

   
    await creditWallet(
      referrerDoc.userId,
      invite.rewardAmount,
      null,
      `Referral Bonus – ${newUser.email} completed first order`
    );

    console.log(
      `Referral reward processed: +₹${invite.rewardAmount} to referrer (${referrerDoc.userId})`
    );
  } catch (error) {
    console.error('processReferralReward error:', error);
  }
};

module.exports = { processReferralReward };