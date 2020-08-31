var config = require('../../server/config.json');
var emailSES = require('../email');
var path = require('path');

module.exports = function(app) {
  const User = app.models.User;

  User.resetPasswordRequest = function(email, cb) {
    
    
    User.resetPassword({
      email: email
    }, function(err) {
      if (err) return cb(err,{});
      cb(null, 'Your reset password link is sent to your registered email.');
    });
  };


  //send password reset link when requested
  User.on('resetPasswordRequest', function(info) {
    console.log(info);

    if(info.options && info.options.password){

      
      info.accessToken.user(function (err, user) {
        console.log("in find user");
        if (err) return console.log(err);
        console.log(user); // the actual user
        user.updateAttribute('password', info.options.password, function(err, user) {
         if (err) return console.log(err);
           console.log('> password reset processed successfully');
           
         });
      });

    } else {
      var url = 'http://www.skillstack.com/challenge/reset-password';
      var html = 'Click <a href="' + url + '/' + info.user.id + '/' +
          info.accessToken.id + '">here</a> to reset your password';
      
      var mail = {
        "to": info.email,
        "subject": 'SkillStack: Password Reset',
        "body": html
      };

      emailSES.sendMail(mail);
    }
    

  });

    //render UI page after password change
  User.afterRemote('changePassword', function(context, user, next) {
    console.log(user);
  });


  User.remoteMethod(
    'resetPasswordRequest', {
      http: {path: '/request-password-reset', verb: 'post'},
      accepts: {arg: 'email',type: 'string'},
      returns: {"type": "json", root:true}
    }
  );



  User.afterRemote('create', function(context, userInstance, next) {
    console.log('> user.afterRemote triggered');

    //console.log(userInstance);
    var uid = userInstance.id
    console.log('---------------------------')
    var options = {
      type: 'email',
      to: userInstance.email,
      instance: userInstance,
      from: 'noreply@loopback.com',
      subject: 'Thanks for registering.',
      template: path.resolve(__dirname, '../../server/views/verify.ejs'),
      redirect: '/verified',
      user: User 
    };

   // console.log(options);
    console.log('*******************************************')
    userInstance.verify(options, function(err, response) {
      console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%5')
      //console.log(options)
      if (err) {
        console.log('$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$')
        console.log(err)
        console.log('@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@')
        var url = 'http://www.skillstack.com/challenge/confirm-account';
        var html = 'Thanks for registering an account in SkillStack.<br/>' +
        'Click <a href="' + url + '/' + uid + '/' + options.user.verificationToken +'">here</a> to confirm your account.';
        
        var mail = {
          "to": options.user.email,
          "subject": 'SkillStack: Confirm Account',
          "body": html
        };
       // console.log('HTML MAIL -->>-->>' + html)
        emailSES.sendMail(mail);
        // return '';
      }
      options.user.verificationToken = '###';
      context.result = {
        data: options.user
      };

      next();
      // context.res.render('response', {
      //   title: 'Signed up successfully',
      //   content: 'Please check your email and click on the verification link ' -
      //       'before logging in.',
      //   redirectTo: '/',
      //   redirectToLinkText: 'Log in'
      // });

    });
  });

};