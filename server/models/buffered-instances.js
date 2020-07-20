'use strict';
var AWS = require('aws-sdk');
var pathv = 'server/aws-config.json';
AWS.config.update({region: 'us-east-1'});
var ec2 = new AWS.EC2();
var Promise = require("bluebird");
var moment = require('moment');

module.exports = function(BufferedInstances) {
	
	
	BufferedInstances.stopBootedIntances = function(newEnvId,cb) {
		console.log("CODE Stopping the launched instances after 8 minutes");

        BufferedInstances.find({where:{instanceState:"booting"}}, function (err, instance) {
			if(instance.length>0){
                var test = Object;
				var currentDateTime = new Date();
				for(var i in instance){            
					test=instance[i];
					console.log("######Found instance"+test.instanceId); 
					var yourvalue=parseFloat("5.5");  
					var launchedTime = instance[i].launchTime;
					//console.log("launchedTime"+moment.utc(launchedTime).add(yourvalue,'hours').format('YYYY-MM-DD hh:mm a')+"|currentDateTime="+moment.utc(currentDateTime).add(yourvalue,'hours').format('YYYY-MM-DD hh:mm a'));
					
					var currentDateTimeUTC = moment.utc(currentDateTime);
					var launchedTimeUTC = moment.utc(launchedTime);	
					var diffInMinutes = currentDateTimeUTC.diff(launchedTimeUTC, 'minutes');	
					console.log("machine is launched since "+diffInMinutes+" minutes");
					if(diffInMinutes>8){
						console.log("booting proecess done and Time to stop this instance"+test.instanceId);
						var params = {InstanceIds: [test.instanceId]};
						ec2.stopInstances(params, function(err, data) {
						console.log(JSON.stringify(data));
						if(err) 
							console.log("err in stopping the instance");
						else
						{console.log("stopped in buffer"+test.instanceId);
							// successful response
						 
						}	
						});
							test.instanceState = "stopped";
							BufferedInstances.upsert(test, function(err,dataInstance){
								if(err)
									console.log("update err"+err);
							console.log("buffere updated in db"+dataInstance);															
						});
						
					}
				}
				cb(null, "ok");
			}   
            else
              	cb(null, "0 instances");			
        
        }) 
	 
	}
	
	
	  BufferedInstances.remoteMethod (
        'stopBootedIntances',
        {
          http: {path: '/stopbootedintances', verb: 'get'},
          accepts: {arg: 'id', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        }
    );

    	
};
