const User = require('../models/userSchema')


exports.userAuth = async(req,res,next)=>{
    try{
        if(!req.session.user){
            return res.redirect('user/home')
        }

        const user = await User.findById(req.session.user)

        if(user && !user.isBlocked){
            req.user = user
            return next()
        }

        req.session.destroy(()=>{
            res.redirect('user/login')
        })
    }catch(error){
        console.error('Error in userAuth middleware',error)
        res.status(500).send('internal server error')
    }
}


exports.adminAuth = (req,res,next)=>{
    User.findOne({isAdmin:true})
    .then(data=>{
        if(data){
            next()
        }else{
            res.redirect('/admin/login')
        }
    })
    .catch(error=>{
        console.log('Error in admin auth middleware',error)
    })
}