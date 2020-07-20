'use strict';
var AWS = require('aws-sdk');
var pathv = 'server/aws-config.json';
AWS.config.update({region: 'us-east-1'});
var ec2 = new AWS.EC2();
var Promise = require("bluebird");
var moment = require('moment');

module.exports = function(MachineDetails) {

	MachineDetails.observe('before save', function(ctx, next) {
	  console.log(ctx.instance);
      
	  next();
	}); 
	
	
	
	 MachineDetails.removepreviewmachines = function(id, cb) {
console.log("in get details");		 
	MachineDetails.find( function (err, instances) {				
	var json=[];
	console.log(instances);
	for(var i in instances){
	          if(instances[i].type == "solution"){
				  console.log("solution machine"+instances[i].instanceId+" will be handled by tempinstances");
				  continue;
				}
			(function(instance){
			    
				var currentDateTime = new Date();
				var launchTime = instance.launchTime;
				console.log("currentDateTime"+currentDateTime+"|testStarted123="+launchTime);
				var a = moment.utc(currentDateTime);
				var b = moment.utc(launchTime);
					var c = a.diff(b, 'minutes');
					console.log("diff="+c);
									if(c>45){
						console.log("its time to terminate the candidate="+instance.instanceId);
						var s = MachineDetails.terminateInstance(instance).then(function(data){
					console.log("terminated123="+data);
					
					MachineDetails.destroyById(instance.id, function(err,dataInstance){                                   
                               if(err) console.log("error in delete"+err);
								else console.log("deleted"+instance.id);	
                                                      
                        });
				}).error(function(){
					console.log("error in terminate"+err);
					}).catch(function(){console.log("EE")})
					}
					else{
						console.log("its not timedout candidate="+instances[i].instanceId);
						
					}
		//console.log(instances[i].launchTime);
			})(instances[i])
	}
	
   	cb(null,"ok");

     
  });
   
 }
 
 
 
     MachineDetails.terminateInstance_OLD = function(instanceid){
                 console.log("in terminate"+instanceid);
              var params = {InstanceIds:[instanceid]};
    		return  new Promise(function(resolve, reject) {
    ec2.terminateInstances(params, function(err, data) {
             
            console.log(JSON.stringify(data));
		    if(err) return reject("err in terminate");
			else
			return resolve(">terminated="+instanceid);
              // successful response
    });
   
   
 });

 }  
 
  MachineDetails.terminateInstance = function(envObj){
   
		console.log("in terminate function instance="+envObj.instanceId);
		if(envObj.instanceId=="" || envObj.instanceId=="deleted"){
			return  new Promise(function(resolve, reject) {
				return resolve("Already terminated or stopped");
			}); 
		}
        var params = {InstanceIds: [envObj.instanceId]};
		if(envObj.LaunchedFromStoppedInstance == true){
		  	return  new Promise(function(resolve, reject) {
					ec2.stopInstances(params, function(err, data) {
						console.log(JSON.stringify(data));
						if(err) 
							return reject("err in stopping the instance");
						else
							return resolve(">>>>>stopped"+envObj.instanceId+" of "+envObj.id);
							// successful response
						});   
   
				});
		
		}
		else{  
			return new Promise(function(resolve, reject) {
					ec2.terminateInstances(params, function(err, data) {
						console.log(JSON.stringify(data));
						if(err) 
							return reject("err in terminate");
						else
							return resolve(">>>>>terminated"+envObj.instanceId+" of "+envObj.id);
							// successful response
						});   
   
				});
		}	
	
	
     } 


	 MachineDetails.remoteMethod (
        'removepreviewmachines',
        {
          http: {path: '/removepreviewmachines', verb: 'get'},
          accepts: {arg: 'id', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        });
		
			MachineDetails.remoteMethod (
        'evaluate',
        {
          http: {path: '/evaluate', verb: 'get'},
          accepts: {arg: 'id', type: 'number', http: { source: 'query' }},
          returns:{"type": "json", root:true}
        });
};
