// controllers/user/referralController.js
const Referral = require('../../models/referralSchema');
const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');
const Transaction = require('../../models/transactionSchema');

// ==========================================
// 1. SHOW REFERRAL PAGE
// ==========================================
exports.getReferralPage = async (req, res) => {
  try {
    const userId = req.session.user;
    
    if (!userId) {
      return res.redirect('/login');
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.redirect('/login');
    }

    // Get or create referral document
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

    // Calculate stats
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
    res.redirect('/pageNotFound');
  }
};

// ==========================================
// 2. PROCESS REFERRAL DURING SIGNUP
// ==========================================
exports.processReferralSignup = async (newUserId, referralCode) => {
  try {
    if (!referralCode) {
      console.log('❌ No referral code provided');
      return;
    }

    console.log('🔍 Processing referral signup for code:', referralCode);

    // Find referrer by code
    const referrerDoc = await Referral.findOne({ 
      referralCode: referralCode.toUpperCase() 
    });

    if (!referrerDoc) {
      console.log('❌ Invalid referral code:', referralCode);
      return;
    }

    console.log('✅ Found referrer:', referrerDoc.userId);

    // Get new user details
    const newUser = await User.findById(newUserId);
    if (!newUser) {
      console.log('❌ New user not found');
      return;
    }

    // Check if user already used a referral
    if (newUser.hasUsedReferral) {
      console.log('❌ User already used a referral');
      return;
    }

    // Prevent self-referral
    if (referrerDoc.userId.toString() === newUserId.toString()) {
      console.log('❌ Cannot refer yourself');
      return;
    }

    // Add to invited users list with PENDING status
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
    console.log('✅ Referral document updated');

    // Update new user - mark as referred
    await User.findByIdAndUpdate(newUserId, {
      referredBy: referrerDoc.userId,
      hasUsedReferral: true
    });

    console.log(`✅ Referral signup recorded: ${newUser.email} referred by ${referralCode}`);

  } catch (error) {
    console.error('❌ Process referral signup error:', error);
  }
};

// ==========================================
// 3. CREDIT REWARD WHEN FIRST ORDER COMPLETES
// ==========================================
exports.processReferralReward = async (newUserId) => {
  try {
    console.log('🎁 ============================================');
    console.log('🎁 PROCESSING REFERRAL REWARD');
    console.log('🎁 User ID:', newUserId);
    console.log('🎁 ============================================');

    // Find the new user
    const newUser = await User.findById(newUserId);
    if (!newUser) {
      console.log('❌ User not found');
      return;
    }

    console.log('👤 User found:', newUser.email);
    console.log('👤 Referred by:', newUser.referredBy);

    if (!newUser.referredBy) {
      console.log('❌ User not referred by anyone');
      return;
    }

    // Find referrer's referral document
    const referrerDoc = await Referral.findOne({ userId: newUser.referredBy });
    if (!referrerDoc) {
      console.log('❌ Referrer document not found for:', newUser.referredBy);
      return;
    }

    console.log('✅ Referrer document found');
    console.log('📝 Referrer code:', referrerDoc.referralCode);
    console.log('📝 Total invites:', referrerDoc.invitedUsers.length);

    // Find the invited user entry
    const inviteIndex = referrerDoc.invitedUsers.findIndex(
      u => u.userId && u.userId.toString() === newUserId.toString()
    );

    if (inviteIndex === -1) {
      console.log('❌ Invite entry not found in referrer document');
      console.log('🔍 Looking for userId:', newUserId.toString());
      console.log('🔍 Available userIds:', referrerDoc.invitedUsers.map(u => u.userId?.toString()));
      return;
    }

    console.log('✅ Invite entry found at index:', inviteIndex);

    const invite = referrerDoc.invitedUsers[inviteIndex];
    console.log('📊 Current invite status:', invite.status);
    console.log('📊 First order completed:', invite.firstOrderCompleted);

    // Check if already rewarded
    if (invite.status === 'completed' || invite.firstOrderCompleted) {
      console.log('⚠️ Reward already processed for this user');
      return;
    }

    console.log('💰 Processing reward...');

    // ✅ FIX: Use Mongoose's markModified to ensure array changes are detected
    referrerDoc.invitedUsers[inviteIndex].status = 'completed';
    referrerDoc.invitedUsers[inviteIndex].firstOrderCompleted = true;
    referrerDoc.invitedUsers[inviteIndex].firstOrderAt = new Date();
    
    // Mark the array as modified (CRITICAL FOR MONGOOSE SUBDOCUMENTS)
    referrerDoc.markModified('invitedUsers');

    // Update totals
    referrerDoc.totalEarned += invite.rewardAmount;
    referrerDoc.pendingRewards -= invite.rewardAmount;

    // Save with validation
    await referrerDoc.save();
    console.log('✅ Referral document saved');
    
    // ✅ VERIFY THE SAVE WORKED
    const verifyDoc = await Referral.findOne({ userId: newUser.referredBy });
    const verifyInvite = verifyDoc.invitedUsers.find(
      u => u.userId && u.userId.toString() === newUserId.toString()
    );
    console.log('🔍 Verification - Status after save:', verifyInvite.status);
    console.log('💰 Total earned after save:', verifyDoc.totalEarned);

    // Credit wallet
    await creditReferralReward(referrerDoc.userId, invite.rewardAmount, newUser.email);

    console.log('🎉 ============================================');
    console.log(`🎉 SUCCESS: ₹${invite.rewardAmount} credited to referrer!`);
    console.log('🎉 ============================================');

  } catch (error) {
    console.error('❌ ============================================');
    console.error('❌ PROCESS REFERRAL REWARD ERROR');
    console.error('❌', error);
    console.error('❌ ============================================');
    throw error; // Re-throw to let caller handle
  }
};

// ==========================================
// 4. HELPER: CREDIT WALLET
// ==========================================
async function creditReferralReward(userId, amount, referredUserEmail) {
  try {
    console.log('💳 Crediting wallet...');
    console.log('💳 User ID:', userId);
    console.log('💳 Amount:', amount);

    // Find or create wallet
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      console.log('💳 Creating new wallet');
      wallet = await Wallet.create({ 
        userId, 
        balance: 0, 
        useInCheckout: false 
      });
    }

    console.log('💳 Current balance:', wallet.balance);

    // Update wallet balance
    wallet.balance += amount;
    await wallet.save();

    console.log('💳 New balance:', wallet.balance);

    // Create transaction record
    const txn = await Transaction.create({
      userId: userId,
      amount: amount,
      type: 'credit',
      status: 'completed',
      description: `Referral Bonus - ${referredUserEmail}'s first order`,
      date: new Date()
    });

    console.log('💳 Transaction created:', txn._id);
    console.log('✅ Wallet credited successfully');

  } catch (error) {
    console.error('❌ Credit referral reward error:', error);
    throw error;
  }
}

// ==========================================
// 5. VALIDATE REFERRAL CODE
// ==========================================
exports.validateReferralCode = async (referralCode) => {
  try {
    if (!referralCode) return { valid: false };

    const referrerDoc = await Referral.findOne({ 
      referralCode: referralCode.toUpperCase() 
    });

    return { 
      valid: !!referrerDoc,
      referrerId: referrerDoc ? referrerDoc.userId : null
    };

  } catch (error) {
    console.error('Validate referral code error:', error);
    return { valid: false };
  }
};

module.exports = exports;