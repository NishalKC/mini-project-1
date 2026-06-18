const express = require("express")
const app = express()
const userModel = require("./models/user")
const postModel = require("./models/post")
const path = require("path")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")
const cookieParser = require("cookie-parser")
const crypto = require("crypto")
const upload = require("./config/multerconfig")



app.use(express.json())
app.use(express.urlencoded({extended : true}))
app.use(express.static(path.join(__dirname, "public")))
app.set("view engine", "ejs")
app.use(cookieParser())

app.get("/", (req, res ) => {
    res.render("index")
}
)
app.get("/profile/upload", (req, res ) => {
    res.render("profileupload")
}
)

app.get("/allpost",isLoggedIn,async (req, res ) => {
    let posts =await postModel.find().populate("user")
    let user = await userModel.findById(req.user.userid);
    console.log(posts);
    
    res.render("allpost", {posts :posts, user: user})
}
)
app.get("/profile/:username",isLoggedIn, async(req, res) => {
    let user = await userModel.findOne({_id  : req.params.username}).populate("post")
    let inspecteduser = req.user
    let friend = await userModel.findOne({_id: req.user.userid})
    if(req.params.username === req.user.userid){
        res.redirect("/profile")
    }else{

        console.log(friend);
        
        res.render("profileview" ,{user: user, posts : user.post, inspecteduser , friend})
    }
}
)
app.get("/friendreq/:id",isLoggedIn,async (req, res) => {
    let user = await userModel.findOne({_id: req.params.id}).populate("post")
    if(user.messages.indexOf(req.user.userid)=== -1){

        user.messages.push(req.user.userid)
    }else{
        user.messages.splice(user.messages.indexOf(req.user.userid), 1)
    }
    await user.save()
    console.log(user);
    
    res.redirect(`/profile/${req.params.id}`)
}
)

app.post("/upload", upload.single("image"), isLoggedIn, async(req, res ) => {
    let user = await userModel.findOne({email: req.user.email})
    user.profilepic = req.file.filename
    await user.save()
    res.redirect("/profile")
}
)
app.get("/delete/:id",isLoggedIn ,async (req, res ) => {
    let post = await  postModel.findOneAndDelete({_id : req.params.id})
    res.redirect("/profile")
    
}
)
app.post("/register",async (req, res ) => {
    let{name, username , email, age, password}= req.body
    let user = await userModel.findOne({email})
    if(user){
        res.redirect("/login")

    }else{
        bcrypt.genSalt(10, (err, salt ) => {
            bcrypt.hash(password, salt ,async  (err, hash) => {
                const createduser = await userModel.create({
                    name, 
                    username,
                    email,
                    age,
                    password: hash

                })
                let token = jwt.sign({email: email, userid: createduser._id,}, "shhh")
                res.cookie("token",token)
                // res.json(createduser)
                res.redirect("/profile")
            }
            )
        }
        )


    }

}
)
app.get("/login", (req, res) => {
    res.render("login")
}
)
app.post("/login",async (req, res) => {
    let{email, password}= req.body
    let user = await userModel.findOne({email})
    if(!user) res.redirect("/")

    

    bcrypt.compare(password, user.password, (err, result) => {
        if(result){

            let token = jwt.sign({email: email, userid: user._id,}, "shhh")
            res.cookie("token",token)
            res.redirect("/profile")
        }
        else  res.redirect("/login")
        
    }
    )
    
}
)
app.get("/logout", (req, res) => {
    res.cookie("token", "");
    res.redirect("/login");
});
app.get("/profile", isLoggedIn, async (req, res ) => {
    let user = await userModel.findOne({email: req.user.email}).populate("post")
    let requser = await userModel.findOne({_id: user.messages})
    let friends = await userModel.findOne({_id: user.friends})
    console.log(user);
    
    res.render("profile",{user,requser, friends} )
    
}
)
app.get("/friends", isLoggedIn,async(req, res) => {
    let user = await userModel.find({friends : req.user.userid})

    console.log(user);
    
    res.render("friends",{friends: user})
}
)
app.get("/request/:id", isLoggedIn, async (req, res) => {

    let requester = await userModel.findById(req.params.id);
    let accepter = await userModel.findById(req.user.userid);

    if (!requester || !accepter) {
        return res.send("User not found");
    }

    const requestExists = accepter.messages.some(
        id => id.toString() === requester._id.toString()
    );

    if (requestExists) {

        accepter.friends.push(requester._id);
        requester.friends.push(accepter._id);

        accepter.messages = accepter.messages.filter(
            id => id.toString() !== requester._id.toString()
        );

        await accepter.save();
        await requester.save();
    }

    res.redirect("/profile");
});
app.get("/likes/:id", isLoggedIn ,async (req, res ) => {
    let post = await postModel.findOne({_id : req.params.id}).populate("user")
    console.log(req.user.userid);
        if(post.likes.indexOf(req.user.userid)=== -1){

            post.likes.push(req.user.userid)
        }   else{
            post.likes.splice(post.likes.indexOf(req.user.userid),1)
        }

        await post.save()
        res.redirect("/allpost")
    }
)

app.post("/post" ,isLoggedIn ,async  (req , res ) => {

    
    let user =await  userModel.findOne({email :req.user.email})

    
    let post = await postModel.create({
        user: user._id,
        content: req.body.content
     })
    user.post.push(post._id)
    await user.save()
    res.redirect("/profile")
}
)
app.get("/edit/:id", async(req, res) => {
    let post=await postModel.findOne({_id : req.params.id}).populate("user")
    res.render("edit", {post})
}
)
app.post("/update/:id",isLoggedIn ,async (req, res) => {
    let post = await postModel.findOneAndUpdate({_id: req.params.id}, {content: req.body.content})
    if(req.id = post.user._id){
    res.redirect("/profile")

    }else{

        res.redirect("/allpost")
    }

}
)



function isLoggedIn(req , res , next) {

    if(req.cookies.token  === "")  res.redirect("/login")
    else{
        let data = jwt.verify(req.cookies.token, "shhh")
        req.user = data
    }
    next()
}

app.listen(3000)