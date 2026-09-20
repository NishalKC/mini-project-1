require("dotenv").config();

const express = require("express");
const app = express();

const userModel = require("./models/user");
const postModel = require("./models/post");

const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const upload = require("./config/multerconfig");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.use(cookieParser());

/* ================= HOME ================= */

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

/* ================= REGISTER ================= */

app.post("/register", async (req, res) => {
  try {
    const { name, username, email, age, password } = req.body;

    const user = await userModel.findOne({ email });

    if (user) {
      return res.redirect("/login");
    }

    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(password, salt, async (err, hash) => {
        const createdUser = await userModel.create({
          name,
          username,
          email,
          age,
          password: hash,
        });

        const token = jwt.sign(
          {
            email: createdUser.email,
            userid: createdUser._id,
          },
          process.env.JWT_SECRET
        );

        res.cookie("token", token);
        res.redirect("/profile");
      });
    });
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

/* ================= LOGIN ================= */

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email });

    if (!user) return res.redirect("/login");

    bcrypt.compare(password, user.password, (err, result) => {
      if (!result) return res.redirect("/login");

      const token = jwt.sign(
        {
          email: user.email,
          userid: user._id,
        },
        process.env.JWT_SECRET
      );

      res.cookie("token", token);
      res.redirect("/profile");
    });
  } catch (err) {
    console.log(err);
    res.redirect("/login");
  }
});

/* ================= PROFILE ================= */

app.get("/profile", isLoggedIn, async (req, res) => {
  const user = await userModel.findOne({ email: req.user.email }).populate("post");

  const requser = await userModel.find({ _id: user.messages });
  const friends = await userModel.find({ _id: user.friends });

  res.render("profile", {
    user,
    requser,
    friends,
  });
});

app.get("/profile/upload", (req, res) => {
  res.render("profileupload");
});

app.post("/upload", upload.single("image"), isLoggedIn, async (req, res) => {
  const user = await userModel.findOne({ email: req.user.email });

  user.profilepic = req.file.filename;

  await user.save();

  res.redirect("/profile");
});

/* ================= PROFILE VIEW ================= */

app.get("/profile/:username", isLoggedIn, async (req, res) => {
  const user = await userModel.findOne({ _id: req.params.username }).populate("post");

  const inspecteduser = req.user;
  const friend = await userModel.findOne({ _id: req.user.userid });

  if (req.params.username === req.user.userid) {
    return res.redirect("/profile");
  }

  res.render("profileview", {
    user,
    posts: user.post,
    inspecteduser,
    friend,
  });
});

/* ================= POSTS ================= */

app.post("/post", isLoggedIn, async (req, res) => {
  const user = await userModel.findOne({ email: req.user.email });

  const post = await postModel.create({
    user: user._id,
    content: req.body.content,
  });

  user.post.push(post._id);
  await user.save();

  res.redirect("/profile");
});

app.get("/allpost", isLoggedIn, async (req, res) => {
  const posts = await postModel.find().populate("user");
  const user = await userModel.findById(req.user.userid);

  res.render("allpost", { posts, user });
});

app.get("/edit/:id", isLoggedIn, async (req, res) => {
  const post = await postModel.findOne({ _id: req.params.id }).populate("user");

  res.render("edit", { post });
});

app.post("/update/:id", isLoggedIn, async (req, res) => {
  const post = await postModel.findOneAndUpdate(
    { _id: req.params.id },
    { content: req.body.content },
    { new: true }
  );

  if (req.user.userid.toString() === post.user.toString()) {
    return res.redirect("/profile");
  }

  res.redirect("/allpost");
});

app.get("/delete/:id", isLoggedIn, async (req, res) => {
  await postModel.findOneAndDelete({ _id: req.params.id });

  res.redirect("/profile");
});

/* ================= LIKES ================= */

app.get("/likes/:id", isLoggedIn, async (req, res) => {
  const post = await postModel.findOne({ _id: req.params.id }).populate("user");

  if (post.likes.indexOf(req.user.userid) === -1) {
    post.likes.push(req.user.userid);
  } else {
    post.likes.splice(post.likes.indexOf(req.user.userid), 1);
  }

  await post.save();

  if (req.user.userid.toString() === post.user._id.toString()) {
    return res.redirect("/profile");
  }

  res.redirect("/allpost");
});

/* ================= FRIEND REQUEST ================= */

app.get("/friendreq/:id", isLoggedIn, async (req, res) => {
  const user = await userModel.findOne({ _id: req.params.id });

  if (user.messages.indexOf(req.user.userid) === -1) {
    user.messages.push(req.user.userid);
  } else {
    user.messages.splice(user.messages.indexOf(req.user.userid), 1);
  }

  await user.save();

  res.redirect(`/profile/${req.params.id}`);
});

app.get("/request/:id", isLoggedIn, async (req, res) => {
  const requester = await userModel.findById(req.params.id);
  const accepter = await userModel.findById(req.user.userid);

  if (!requester || !accepter) {
    return res.send("User not found");
  }

  const requestExists = accepter.messages.some(
    (id) => id.toString() === requester._id.toString()
  );

  if (requestExists) {
    accepter.friends.push(requester._id);
    requester.friends.push(accepter._id);

    accepter.messages = accepter.messages.filter(
      (id) => id.toString() !== requester._id.toString()
    );

    await accepter.save();
    await requester.save();
  }

  res.redirect("/profile");
});

/* ================= FRIENDS ================= */

app.get("/friends", isLoggedIn, async (req, res) => {
  const user = await userModel.find({ friends: req.user.userid });

  res.render("friends", { friends: user });
});

/* ================= AUTH MIDDLEWARE ================= */

function isLoggedIn(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.redirect("/login");
  }

  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    req.user = data;
    next();
  } catch (err) {
    res.clearCookie("token");
    return res.redirect("/login");
  }
}
const connectDB = require("./config/db")
connectDB()
/* ================= SERVER ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});