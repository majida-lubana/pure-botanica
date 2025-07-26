

exports.loadHomePage = async (req,res)=>{
    try{
        res.render("home")
    }catch(error){
        console.log("Home Page not Found")
        res.status(500).send('Server Error')
    }
}



exports.pageNotFound = async (req,res)=>{
    try{
        res.render("page-404")
    }catch(error){
        res.redirect("/pageNotFound")
    }
}