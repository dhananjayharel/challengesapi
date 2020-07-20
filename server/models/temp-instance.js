'use strict';
var AWS = require('aws-sdk');
var pathv = 'server/aws-config.json';
AWS.config.update({region: 'us-east-1'});
var ec2 = new AWS.EC2();
var Promise = require("bluebird");
var moment = require('moment');

module.exports = function(TempInstance) {

	TempInstance.observe('before save', function(ctx, next) {
	  console.log(ctx.instance);

	  next();
	});
	
	
	
	 TempInstance.getTestDetails = function(id, cb) {
console.log("in get details");		 
	TempInstance.find( function (err, instances) {				
	var json=[];
	console.log(instances);
	for(var i in instances){
			(function(instance){var currentDateTime = new Date();
				var launchTime = instance.launchTime;
				console.log("currentDateTime"+currentDateTime+"|testStarted123="+launchTime);
				var a = moment.utc(currentDateTime);
				var b = moment.utc(launchTime);
					var c = a.diff(b, 'minutes');
					console.log("diff="+c);
									if(c>45){
						console.log("its time to terminate the candidate="+instance.instanceId);
                        if(instance.instanceLaunchedFromBuffer==true){
                            console.log("buffer machine dont terminate , stop it");						
							var s = TempInstance.stopInstance(instance.instanceId).then(function(data){
										console.log("stopped temp="+data);	
										TempInstance.deleteRowEntry(instance.id);
					
									}).error(function(){
										console.log("error in stop"+err);
									}).catch(function(e){console.log("EE"+e)});
					     } else{						 
						 	var s = TempInstance.terminateInstance(instance.instanceId).then(function(data){
										console.log("terminated temp="+data);	
										TempInstance.deleteRowEntry(instance.id);
					
									}).error(function(){
										console.log("error in terminate"+err);
									}).catch(function(){console.log("EE")});
						 
						 
						}//terminate
						 
					
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
 
 
 
     TempInstance.terminateInstance = function(instanceid){
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
  
   TempInstance.stopInstance = function(instanceid){
                 console.log("in terminate"+instanceid);
              var params = {InstanceIds:[instanceid]};
    		return  new Promise(function(resolve, reject) {
    ec2.stopInstances(params, function(err, data) {
             
            console.log(JSON.stringify(data));
		    if(err) return reject("err in terminate");
			else
			return resolve(">stopped="+instanceid);
              // successful response
    });
   
   
 });

 }

 TempInstance.deleteRowEntry = function(instanceId){
	 console.log("in delete row ");
    TempInstance.destroyById(instanceId, function(err,dataInstance){                                   
                               if(err) console.log("error in delete"+err);
								else console.log("deleted");	
                                                      
                        });
 } 
	
	
    TempInstance.removepreviewmachines = function(id,cb){
    console.log("call remove preview");	
		var app = TempInstance.app;
		var MachineDetails = app.models.MachineDetails;
	MachineDetails.removepreviewmachines(id, cb);
	
	}


	 TempInstance.remoteMethod (
        'getTestDetails',
        {
          http: {path: '/gettestdetails', verb: 'get'},
          accepts: {arg: 'id', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        });
		
		 TempInstance.remoteMethod (
        'removepreviewmachines',
        {
          http: {path: '/removepreviewmachines', verb: 'get'},
          accepts: {arg: 'id', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        });
};
