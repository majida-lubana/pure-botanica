const User = require('../../models/userSchema')
const bcrypt = require('bcrypt')


exports.loadLogin = async (req,res)=>{

    if(req.session.admin){
        return res.redirect('/admin/dashboard')
    }
    res.render("admin/login",{message:null,
        pageTitle:'Login Page'
    })
}

exports.pageError = (req, res) => {
  res.render('admin/admin-error', {
    pageTitle: 'Admin Error',
    heading: 'Oops! Something Went Wrong',
    userName: 'Admin',
    imageURL: '/images/admin-avatar.jpg',
    message: req.query.message || 'A server-side error occurred. Please try again later.',
  });
};

exports.login = async(req,res)=>{
    try{
        const {email,password} = req.body
        const admin = await User.findOne({isAdmin:true,email}).select('+password')
        if(admin){

            const passwordMatch = await bcrypt.compare(password, admin.password);
            if(passwordMatch){
                req.session.admin = true;
                return res.redirect('/admin/dashboard')
            }else{
                return res.redirect('/admin/login')
            }
        }else{
            return res.redirect('/admin/login')
        }
    }catch(error){
        console.log('login error',error)
        return res.redirect('/admin/admin-error')
    }
}


exports.loadDashboard = async (req, res) => {
    if (req.session.admin) {
        try {
            res.render('admin/dashboard', {
                pageTitle: 'Dashboard',
                currentPage:'dashboard'
            });
        } catch (error) {
            console.log('Dashboard render error:', error);
            res.redirect('/pageError');
        }
    } else {
        return res.redirect('/admin/login');
    }
};


exports.logout = async(req,res)=>{
    try{
        req.session.destroy(err=>{
            if(err){
                console.log('Error destroying session',err);
                return res.redirect('admin/admin-error')
            }
            res.redirect('/admin/login')
        })
    }catch(error){
        console.log('unexpected error during logout')
        res.redirect('admin/admin-error')
    }
}
