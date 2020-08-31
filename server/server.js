'use strict';

var loopback = require('loopback');
var boot = require('loopback-boot');
var path = require('path');
var bodyParser = require('body-parser');
var LoopBackContext = require('loopback-context');

var express = require("express");

var cookieParser = require('cookie-parser');
var session = require('express-session');
var sessionStore = new session.MemoryStore();

var app = module.exports = loopback();
app.set('trust proxy', 'loopback');
app.use(cookieParser());
app.use(session({store:sessionStore,secret: "Shh, its a secret!"}));

app.use(bodyParser.urlencoded({extended: true}));
app.use(LoopBackContext.perRequest());
app.use(loopback.token());
app.use(function setCurrentUser(req, res, next) {
  if (!req.accessToken) {
    return next();
  }
  //console.log("req.accessToken.userId"+req.accessToken.userId);
  var loopbackContext = LoopBackContext.getCurrentContext(); 
  loopbackContext.set('currentUserId', req.accessToken.userId);
  // app.models.UserModel.findById(req.accessToken.userId, function(err, user) {
    // if (err) {
      // return next(err);
    // }
    // if (!user) {
      // return next(new Error('No user with this access token was found.'));
    // }
    // var loopbackContext = LoopBackContext.getCurrentContext();
    // if (loopbackContext) {
      // loopbackContext.set('currentUser', user);
    // }
    // next();
  // });
  next();
});
app.start = function() {
  // start the web server
  return app.listen(function() {
    app.emit('started');
    var baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
};

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function(err) {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module)
    app.start();
}); 

app.models.Environment.sendEmail( function (err) {
   if (err) {
    console.log(err)
   }
});
