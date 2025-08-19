const User = require('../../models/userSchema')

exports.customerInfo = async (req, res) => {
  try {
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 3;

    const filter = {
      isAdmin: false,
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    };

    const userData = await User.find(filter)
      .limit(limit)
      .skip((page - 1) * limit)
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
    res.redirect('/admin/pageError');
  }
};


exports.customerBlocked = async (req, res) => {
    try {
        let id = req.params.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.json({ success: true, message: 'User blocked successfully' });
    } catch (error) {
        res.json({ success: false, message: 'Error blocking user' });
    }
};

exports.customerUnblocked = async (req, res) => {
    try {
        let id = req.params.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.json({ success: true, message: 'User unblocked successfully' });
    } catch (error) {
        res.json({ success: false, message: 'Error unblocking user' });
    }
};
