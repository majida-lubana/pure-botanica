
const Referral = require('../../models/referralSchema');
const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');
const Transaction = require('../../models/transactionSchema');


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
    res.redirect('/pageNotFound');
  }
};


exports.processReferralSignup = async (newUserId, referralCode) => {
  try {
    if (!referralCode) {
      console.log('No referral code provided');
      return;
    }

    console.log('🔍 Processing referral signup for code:', referralCode);


    const referrerDoc = await Referral.findOne({ 
      referralCode: referralCode.toUpperCase() 
    });

    if (!referrerDoc) {
      console.log('Invalid referral code:', referralCode);
      return;
    }

    console.log(' Found referrer:', referrerDoc.userId);

    const newUser = await User.findById(newUserId);
    if (!newUser) {
      console.log('New user not found');
      return;
    }

    if (newUser.hasUsedReferral) {
      console.log(' User already used a referral');
      return;
    }

    if (referrerDoc.userId.toString() === newUserId.toString()) {
      console.log('Cannot refer yourself');
      return;
    }

 
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
    console.log('Referral document updated');

    
    await User.findByIdAndUpdate(newUserId, {
      referredBy: referrerDoc.userId,
      hasUsedReferral: true
    });

    console.log(`Referral signup recorded: ${newUser.email} referred by ${referralCode}`);

  } catch (error) {
    console.error(' Process referral signup error:', error);
  }
};


exports.processReferralReward = async (newUserId) => {
  try {
 

    const newUser = await User.findById(newUserId);
    if (!newUser) {
      console.log('User not found');
      return;
    }

    console.log('User found:', newUser.email);
    console.log('Referred by:', newUser.referredBy);

    if (!newUser.referredBy) {
      console.log(' User not referred by anyone');
      return;
    }

   
    const referrerDoc = await Referral.findOne({ userId: newUser.referredBy });
    if (!referrerDoc) {
      console.log('Referrer document not found for:', newUser.referredBy);
      return;
    }


    const inviteIndex = referrerDoc.invitedUsers.findIndex(
      u => u.userId && u.userId.toString() === newUserId.toString()
    );

    if (inviteIndex === -1) {
     
      return;
    }

    

    const invite = referrerDoc.invitedUsers[inviteIndex];



    if (invite.status === 'completed' || invite.firstOrderCompleted) {
      console.log('Reward already processed for this user');
      return;
    }


    referrerDoc.invitedUsers[inviteIndex].status = 'completed';
    referrerDoc.invitedUsers[inviteIndex].firstOrderCompleted = true;
    referrerDoc.invitedUsers[inviteIndex].firstOrderAt = new Date();
    
    referrerDoc.markModified('invitedUsers');

    referrerDoc.totalEarned += invite.rewardAmount;
    referrerDoc.pendingRewards -= invite.rewardAmount;


    await referrerDoc.save();
    console.log('Referral document saved');
    
   
    const verifyDoc = await Referral.findOne({ userId: newUser.referredBy });
    const verifyInvite = verifyDoc.invitedUsers.find(
      u => u.userId && u.userId.toString() === newUserId.toString()
    );
    console.log('🔍 Verification - Status after save:', verifyInvite.status);
    console.log('💰 Total earned after save:', verifyDoc.totalEarned);

  
    await creditReferralReward(referrerDoc.userId, invite.rewardAmount, newUser.email);

    

  } catch (error) {
    
    throw error; 
  }
};


async function creditReferralReward(userId, amount, referredUserEmail) {
  try {
 

  
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

    console.log('💳 Transaction created:', txn._id);
    console.log('✅ Wallet credited successfully');

  } catch (error) {
    console.error('❌ Credit referral reward error:', error);
    throw error;
  }
}


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