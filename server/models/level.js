'use strict';
var AWS = require('aws-sdk');
var pathv = 'server/aws-config.json';



module.exports = function(Level) {
	  var app = Level.app;
	  console.log(app);
       // var OnlineTest = app.models.OnlineTest; 
	//Level.belongsTo(OnlineTest, {foreignKey: 'LevelId'});
};
