var express = require("express");
var app = express();
var router = express.Router();
var listen = require('./reader/tools/serve.js');

var path = __dirname + "/";

router.use(express.static('public'));
router.use('/books', express.static('reader/reader'));

router.use(function (req,res,next) {
  console.log(req.url)
  console.log("/" + req.method);
  next();
});

router.get("/",function(req,res){
  console.log(path + "index.html");
  res.sendFile(path + "index.html");
});

router.get("/about",function(req,res){
  res.sendFile(path + "about.html");
});

router.get("/contact",function(req,res){
  res.sendFile(path + "contact.html");
});

router.get("/books",function(req,res){
  res.sendFile(path + "reader/reader/reader.html");
});

app.use("/",router);

app.use("*",function(req,res){
  res.sendFile(path + "404.html");
});

listen(app, process.env.PORT || 3000);

app.listen(process.env.PORT || 3000, function(){
  console.log("Live at Port 3000");
});