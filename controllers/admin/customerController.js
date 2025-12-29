const User = require('../../models/userSchema');
const MESSAGES = require('../../constants/messages'); // Adjust path if needed

exports.customerInfo = async (req, res) => {
  try {
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 4;

    const filter = search
      ? {
          isAdmin: false,
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ]
        }
      : { isAdmin: false };

    const userData = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    const count = await User.countDocuments(filter);

    res.render('admin/users', {
      users: userData,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      search
    });

  } catch (error) {
    console.error('Customer Info Error:', error);
    res.render('admin/admin-error', {
      pageTitle: 'Admin Error',
      heading: 'Oops! Something Went Wrong',
      userName: 'Admin',
      imageURL: '/images/admin-avatar.jpg',
      errorMessage: MESSAGES.COMMON.SOMETHING_WENT_WRONG
    });
  }
};

exports.customerBlocked = async (req, res) => {
  try {
    const id = req.params.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: true } });

    res.json({ 
      success: true, 
      message: MESSAGES.USER.BLOCKED_SUCCESS || 'User blocked successfully' 
    });
  } catch (error) {
    console.error('Error blocking user:', error);
    res.json({ 
      success: false, 
      message: MESSAGES.USER.BLOCK_FAILED || 'Error blocking user' 
    });
  }
};

exports.customerUnblocked = async (req, res) => {
  try {
    const id = req.params.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: false } });

    res.json({ 
      success: true, 
      message: MESSAGES.USER.UNBLOCKED_SUCCESS || 'User unblocked successfully' 
    });
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.json({ 
      success: false, 
      message: MESSAGES.USER.UNBLOCK_FAILED || 'Error unblocking user' 
    });
  }
};