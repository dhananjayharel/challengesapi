'use strict';
'use strict';
var AWS = require('aws-sdk');
var pathv = '/home/ubuntu/rdplabs_app/rdplabsapi/server/aws-config.json'; 
AWS.config.loadFromPath(pathv);
AWS.config.update({region: 'us-east-1'});
var ec2 = new AWS.EC2();
var Promise = require("bluebird");
var moment = require('moment');
var loopback = require('loopback');
var LoopBackContext = require('loopback-context');
var https = require('https');
module.exports = function(OnlineTest) {

	OnlineTest.observe('after save', function(ctx, next) {
	  console.log("ctx.instance="+JSON.stringify(ctx.instance));
	  //find if env buffer has stopped instance
	  //if yes move it to stopped istances buffer 
	  //if needed add new stopped instances to env buffer
	  console.log("ctx.isNewInstance="+ctx.isNewInstance);
	  console.log('supports isNewInstance?', ctx.isNewInstance !== undefined);
	  if(ctx.isNewInstance){
			OnlineTest.moveInstanceToTestBuffer(ctx.instance.envId,ctx.instance.id).
				then(function(data){
						console.log("CREATE NEW TEST::: moved stopped machine from env buff"+data);
						console.log("create git repo");
							OnlineTest.createGitRepo(ctx.instance.id); 
						}).error(function(){
							console.log("error in copytest"+err);
							//cb(null,"err");
						}).catch(function(e){console.log("E1"+e);cb(null,"err");});
						
						//create again
						// OnlineTest.moveInstanceToTestBuffer(ctx.instance.envId,ctx.instance.id).
				// then(function(data){
						// console.log("CREATE NEW TEST22::: moved stopped machine from env buff222"+data);						
						// }).error(function(){
							// console.log("error in copytest22"+err);
							// //cb(null,"err");
						// }).catch(function(e){console.log("E1"+e);cb(null,"err");});
		}
        else if(!ctx.isNewInstance){
			console.log("update date");
			ctx.instance.updated = new Date();
		}
          			
	  next();
	});
	
	OnlineTest.observe('before save', function updateTimestamp(ctx, next) {
  if (ctx.instance) {
	  console.log("ctx.instance=true");
    ctx.instance.updated = new Date();
  } else {
	  console.log("ctx.data");
    ctx.data.updated = new Date();
  }
  next();
});


    OnlineTest.observe('after delete', function(ctx, next) {
  console.log('Deleted '+ctx.where.id);
  OnlineTest.flushTestBuffer(ctx.where.id);
  console.log("called flushtest");
  next();
});


OnlineTest.flushTestBuffer = function(testId){
	console.log("in flush "+testId);
	OnlineTest.getTestBufferMachines(testId).then(function(stoppedMachines){
		console.log("length="+JSON.stringify(stoppedMachines));
	 	for(var i=0;i<stoppedMachines.length;i++){
		console.log("terminate"+stoppedMachines[i].InstanceId);	
		//XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX	
		OnlineTest.terminateInstance(stoppedMachines[i].InstanceId).then(function(data){
						
					console.log("terminated..."+data);
					}).error(function(err){
					console.log("error in terminate"+err);
					}).catch(function(e){console.log("e"+e)})
		}
	})
	.error(function(err){
		console.log("ERR"+err);
	})
	.catch(function(e){	
	console.log("E"+e);
	});
	
}




	OnlineTest.getTestBufferMachines = function(testId){
	 var json=[];	
	 console.log("in getTestBufferMachines");
    return new Promise(function(resolve,reject){
    var params = {
		Filters: [{Name: 'tag-key',Values: ['associated_test']},
		          {Name: 'tag-value',Values: [""+testId+""]},
				  {Name: 'instance-state-name',Values: ['stopped']}
		]
	};
       console.log(JSON.stringify(params));
    ec2.describeInstances(params, function(err, data) {
		if(err) resolve(json); // an error occurred
		else   {
			var obj;
			console.log("in stopped instance check LENGTH:"+data.Reservations.length);
			if(data.Reservations.length>0){
				for(var i in data.Reservations){
					json.push({InstanceId:data.Reservations[i].Instances[0].InstanceId
					});
				}
			}
			resolve(json);

			
		
		}           // successful response
    });


	})///promise  	
	
	}
    	
    OnlineTest.getCurrentStoppedInstancesInBuff = function(ami_id,stoppedOnly){
		 var machinesToBeLaunched = 0;
		 //find total invites
		 var json=[];
		 return new Promise(function(resolve, reject) {
			var params = {
		Filters: [{Name: 'tag-key',Values: ['ami_id']},
		          {Name: 'tag-value',Values: [""+ami_id+""]}
				  //{Name: 'instance-state-name',Values: ['stopped']}
		]
	};
       if(stoppedOnly)
		   params.Filters.push({Name: 'instance-state-name',Values: ['stopped']});
    ec2.describeInstances(params, function(err, data) {
		if (err) {console.log(err);// an error occurred
		   resolve(json);
		}
		else   {
			
			if(data.Reservations.length>0){
				for(var i in data.Reservations){
					json.push({InstanceId:data.Reservations[i].Instances[0].InstanceId
					});
				}
				return resolve(json);
			}
			
		   	
		}
								
		});           // successful response
 
	});
	}
	
	  // Returns null if the access token is not valid
   function getCurrentUserId() {
    var ctx = loopback.getCurrentContext();
    var accessToken = ctx && ctx.get('accessToken');
	console.log("token="+accessToken);
    var userId = accessToken && accessToken.userId;
    return userId;
  }
   
	//CONE TEST
	  OnlineTest.cloneTest = function(testId,userId=null,copyCandidate,cb) {  

	     var app = OnlineTest.app;
        var Environment = app.models.Environment; 
		var currentUserId = userId;
		console.log("userId="+userId);
		if(userId == null){
			var ctx = LoopBackContext.getCurrentContext();  
			currentUserId = ctx && ctx.get('currentUserId');
		}
		
    console.log("currentUserId="+currentUserId);
	cb(null,"ok");
	var clonedEnvId = 999;
	OnlineTest.copyTest(clonedEnvId,testId,currentUserId,copyCandidate)
	.then(function(testJson){
			console.log("test copied now move stopped instance");
			//create repo now
			console.log("create git repo for new test");
			OnlineTest.createGitRepo(testJson[0].id); 
			//copy the candidate
			
			// if(copyCandidate)
			//    OnlineTest.copyCandidateReport(testId,testJson[0].id,currentUserId);


			//console.log(testJson);
			/* COMMENTED BELOW BECAUSE NEWINSTANCE HOOK WILL HANDLE THIS
			OnlineTest.moveInstanceToTestBuffer(testJson[0].envId,testJson[0].id).
						then(function(data){
							console.log("done copy test now need to add new stopped machine"+data);
							//OnlineTest.addMachineToEnvBuff(testJson[0].amiid,testJson[0].envId);
							cb(null,"ok");
						}).error(function(){
							console.log("error in copytest"+err);
							cb(null,"err");
						}).catch(function(e){console.log("E1"+e);cb(null,"err");})
						*/ 
						//cb(null,"ok");
	}).error(function(){
					console.log("error in copytest"+err);
					cb(null,"err");
					}).catch(function(e){console.log("E1"+e);cb(null,"err");})
   
   
 }
 
 OnlineTest.MoveStoppedMachineToTestBuffer = function(envId,testId){
    console.log("inside MoveStoppedMachineToTestBuffer function");
    console.log("Findout the stopped machine having tag amiid="+envId);	
	console.log("Add the tag associated_test="+testId+" to that machine");	
	OnlineTest.moveInstanceToTestBuffer(envId,testId).then(function(){
	 console.log("done");
	});
 }
 
 OnlineTest.addMachineToEnvBuff = function(amiId,envId){
	console.log("in addMachineToEnvBuff amiid="+amiId+", envId"+envId);
			  var app = OnlineTest.app;
	        var bufferedInstances = app.models.BufferedInstances; 
	var crateAMIInstanceParams = {
			  ImageId: '', // Amazon Linux AMI x86_64 EBS
			  InstanceType: 't2.medium',
			  KeyName: 'rdplabs',
			  NetworkInterfaces: [{ DeviceIndex: 0,
									SubnetId: 'subnet-51239127',                                          
									DeleteOnTermination: true,
									AssociatePublicIpAddress: true
								 }],
			   TagSpecifications: [{ ResourceType: 'instance',
									 Tags: [{Key: 'category',Value: 'rdpami'}]
								  }],	
			  MinCount: 1, MaxCount: 1
};
	  crateAMIInstanceParams.ImageId=amiId;
      ec2.runInstances(crateAMIInstanceParams, function(err, data) {
		  if (err) { console.log("Could not create instance", err); return; }
		  var instanceId = data.Instances[0].InstanceId;
		  console.log("Created new instance by Global Env Buff", instanceId);
			var tagParams={
					Resources: [], 
					Tags: [{ Key: "envId", Value: ""+envId+""},{Key: "info", Value: "BufferAdded"}]};
					tagParams.Resources.push(instanceId);
					setTimeout(function(){
					ec2.createTags(tagParams, function(err, data) {
						if (err) {console.log(err, err.stack); console.log("create tags error");}// an error occurred
						else {console.log(data);
							console.log("tags added");
							var inv = {};
							inv.instanceId = instanceId;
						 bufferedInstances.create(inv,function(err,dataInstance){
						 if(err){
						console.log(err);
					}
					console.log('inserted'+JSON.stringify(dataInstance));				
					
				});								
							console.log("machine created"+instanceId);
						}          
					});
					},200);
					
      
		});
	
	 
 }
 OnlineTest.copyTest = function(newEnvId,testId,newUserId,copyCandidate) {
	 console.log("now copy the test");
        var app = OnlineTest.app;
        var Environment = app.models.Environment; 
		var json = [];
	return  new Promise(function(resolve, reject) {		
        OnlineTest.find({where:{id:testId}}, function (err, instance) {
        if(instance.length>0){
                var test = Object;    
        for(var i in instance){            
                test=instance[i];
                delete test.id;
                test.uid=newUserId;
				if(copyCandidate){
					test.name = "Demo Test: "+test.name;
				}
                test.id = undefined;
				var currentTime = new Date();
				test.created = currentTime;
				test.updated = currentTime;
				//test.envId = newEnvId;//xxxxx
				test.isLibraryTest = false;
				//test.name = onlineTestName;
                console.log("######after removing test id"+test.id+"&cloned env"+newEnvId);
			
					OnlineTest.create(test,function(err,dataInstance){
							console.log('####inserted'+JSON.stringify(dataInstance));
							json.push(dataInstance);
							resolve (json); 
							if(err){
								console.log(err);
								resolve("error cloning test");
							}
					});
			         
			 
        }
        }
       
        
        
        }); //find
		}); //promise
	 
 }  
 
    OnlineTest.copyCandidateReport = function(libraryTestId,clonedTestId,userId){
    console.log("copy candidate from library test function");
    var app = OnlineTest.app;
    var Candidate = app.models.Candidate;
    Candidate.find({where:{onlineTestId:libraryTestId}}, function (err, instance) {
    if(instance.length>0){
	console.log('ORIGINAL candidate'+JSON.stringify(instance[0]));
	console.log("ORIGINAL TEST TOKEN="+instance[0].testToken);
	
	  var candidateData = instance[0];
	  delete candidateData.id;
	  candidateData.id = undefined;
	  candidateData.fullname="Demo Candidate";
	  candidateData.onlineTestId = clonedTestId;
	  candidateData.isCloned = true;
	  //candidateData.originalTestId = libraryTestId;
		candidateData.originalTestId = 203;
	  candidateData.originalTestToken = instance[0].testToken;
	  candidateData.testToken = "";
      candidateData.uid = userId;
	  Candidate.create(candidateData,function(err,dataInstance){
							console.log('####inserted candidate'+JSON.stringify(dataInstance));
							if(err){
								console.log(err);
							}
					});
	  
	}	
 
    });
	}
	
	    //Move stopped machine from env buffer to test buffer
		//change the tag of the stopped instance 
		//add 'associated_test' = testId and remove 'envId' tag
		OnlineTest.moveInstanceToTestBuffer = function(envId,testId){
			console.log("move test ="+testId+" to buffer of env="+envId);
		 var machinesToBeLaunched = 0;
		 var stoppedOnly = true;
		 //find total invites
		 return new Promise(function(resolve, reject) {
			var params = {
		Filters: [{Name: 'tag-key',Values: ['envId']},
		          {Name: 'tag-value',Values: [""+envId+""]}
				  //{Name: 'instance-state-name',Values: ['stopped']}
		]
	};
       if(stoppedOnly)
		   params.Filters.push({Name: 'instance-state-name',Values: ['stopped']});
    ec2.describeInstances(params, function(err, data) {
		if (err) {console.log(err);// an error occurred
		   resolve(0);
		}
		else   {
			console.log("stopped instance check LENGTH:"+data.Reservations.length);
			if(data.Reservations.length>0){
			   console.log(data.Reservations[0]);
			    var instanceId = data.Reservations[0].Instances[0].InstanceId;
				var imageId = data.Reservations[0].Instances[0].ImageId;
				//Delete the envId tag first
				
				 var params = {
				  Resources: [], 
				  Tags: [{Key: "envId", Value: ""+envId+""}]
				 };
				 params.Resources.push(instanceId);
				 ec2.deleteTags(params, function(err, data) {
				   if (err) console.log(err, err.stack); // an error occurred
				   else     console.log(data);           // successful response
				   console.log("deleted tag of this machine"+instanceId);
				   //Time to add new tag(testBuffer)
				   	var tagParams={
					Resources: [], 
					Tags: [{ Key: "associated_test", Value: ""+testId+""}]};
					tagParams.Resources.push(instanceId);
					setTimeout(function(){
					ec2.createTags(tagParams, function(err, data) {
						if (err) {console.log(err, err.stack); console.log("create tags error");}// an error occurred
						else {console.log(data);
							console.log("tag added now create new machine in env buff");			
							//Done moving stopped machine to TestBuffer
							//Add new machine to global env buffer
						    OnlineTest.addMachineToEnvBuff(imageId,envId);
							return resolve("ok");
						}          
					});
					},200);
				   			   				   
				 });
			   //create 2nd
			      var instanceId2 = data.Reservations[1].Instances[0].InstanceId;
				 var imageId2 = data.Reservations[1].Instances[0].ImageId;
				// //Delete the envId tag first
				
				  var params = {
				   Resources: [], 
				   Tags: [{Key: "envId", Value: ""+envId+""}]
				  };
				  params.Resources.push(instanceId2);
				  ec2.deleteTags(params, function(err, data) {
				    if (err) console.log(err, err.stack); // an error occurred
				    else     console.log(data);           // successful response
				    console.log("deleted tag of this machine"+instanceId2);
				   // //Time to add new tag(testBuffer)
				   	 var tagParams={
					 Resources: [], 
					 Tags: [{ Key: "associated_test", Value: ""+testId+""}]};
					 tagParams.Resources.push(instanceId2);
					 setTimeout(function(){
					 ec2.createTags(tagParams, function(err, data) {
						 if (err) {console.log(err, err.stack); console.log("create tags error");}// an error occurred
						 else {console.log(data);
							 console.log("tag added now create new machine in env buff");			
							// //Done moving stopped machine to TestBuffer
							// //Add new machine to global env buffer
						     OnlineTest.addMachineToEnvBuff(imageId2,envId);
							 return resolve("ok");
						 }          
					 });
					 },200);
				   			   				   
				  });
			   
			
			
			
			
			} 
			
		   return resolve("found 0");	
		}
								
		});           // successful response
 
	});
	}
	
	

		OnlineTest.removeTrytestMachines = function(id, cb) {	 
		 console.log("in try test");
	OnlineTest.find( function (err, instances) {				
	var json=[];
	for(var i in instances){
			(function(instance){
				
				if(instance.instanceId.length>0){
				var currentDateTime = new Date();
				var launchTime = instance.launchTime;
				console.log("currentDateTime"+currentDateTime+"|testStarted123="+launchTime);
				var a = moment.utc(currentDateTime);
				var b = moment.utc(launchTime);
					var c = a.diff(b, 'minutes');
					console.log("diff="+c);
									if(true){
						console.log("its time to terminate the try test="+instance.instanceId);
						var s = OnlineTest.describeInstance(instance.instanceId).then(function(data){
					console.log("instance launch time="+data);
						var a = moment.utc(currentDateTime);
				var b = moment.utc(data);
					var c = a.diff(b, 'minutes');
					console.log("diff="+c);
					
				if(c>30){
					OnlineTest.terminateInstance(instance.instanceId).then(function(data){
						instance.instanceId = "";
					OnlineTest.upsert(instance, function(err,dataInstance){                                   
                               if(err) console.log("error in delete"+err);
								else console.log("updated");	
                                                      
                        });
					}).error(function(){
					console.log("error in terminate"+err);
					}).catch(function(){console.log("E1")})
						}
						else
							console.log("not timedout"+instance.instanceId);
				}).error(function(){
					console.log("error in terminate"+err);
					}).catch(function(){console.log("E2")})
					}
					else{
						console.log("its not timedout trytest="+instances[i].instanceId);
						
					}
		//console.log(instances[i].launchTime);
			}
			
				
			})(instances[i])
	}
	
   	cb(null,"ok");

     
  });
   
 }
 
 
 
  OnlineTest.removeEnvMachines = function(id, cb) {	 
		 console.log("in Remove env");
		         var app = OnlineTest.app;
        var Environment = app.models.Environment; 
	Environment.find( function (err, instances) {				
	var json=[];
	for(var i in instances){
			(function(instance){
				
				if(instance.instanceid.length>0){
				var currentDateTime = new Date();
				var launchTime = instance.launchTime;
				console.log("currentDateTime"+currentDateTime+"|testStarted123="+launchTime);
				var a = moment.utc(currentDateTime);
				var b = moment.utc(launchTime);
					var c = a.diff(b, 'minutes');
					console.log("diff="+c);
									if(true){
						console.log("its time to terminate the try test="+instance.instanceid);
						var s = OnlineTest.describeInstance(instance.instanceid).then(function(data){
					console.log("instance launch time="+data);
						var a = moment.utc(currentDateTime);
				var b = moment.utc(data);
					var c = a.diff(b, 'minutes');
					console.log("diff="+c);
					
				if(c>50){
					OnlineTest.terminateInstance(instance.instanceid).then(function(data){
						instance.instanceid = "";
					Environment.upsert(instance, function(err,dataInstance){                                   
                               if(err) console.log("error in delete"+err);
								else console.log("updated");	
                                                      
                        });
					}).error(function(){
					console.log("error in terminate"+err);
					}).catch(function(){console.log("E1")})
						}
						else
							console.log("not timedout"+instance.instanceid);
				}).error(function(){
					console.log("error in terminate"+err);
					}).catch(function(){console.log("E2")})
					}
					else{
						console.log("its not timedout trytest="+instances[i].instanceid);
						
					}
		//console.log(instances[i].launchTime);
			}
			
				
			})(instances[i])
	}
	
   	cb(null,"ok");

     
  });
   
 }
     
	 
	 OnlineTest.getCurrentStoppedInstancesInBuffHTTP = function(amiid,cb){
		 OnlineTest.getCurrentStoppedInstancesInBuff(amiid,true).then(function(data){
			 console.log("stopped instances"+data);
			 if(data.length>0){
				 console.log("available instance"+data[0].InstanceId);
			 }
			 cb(null,data)
		 })
		 
	 }
	 
	 OnlineTest.moveToTestBufferHttp = function(amiid,testid,cb){
	    OnlineTest.moveInstanceToTestBuffer(amiid,testid)
		.then(function(data){
		  console.log("request done......................................."+data);
		  cb(null,"ok");
		}).error(function(err){
					console.log("error in move"+err);
					cb(null,err);
					}).catch(function(err){console.log("E2"+err)});
	 
	 }

	 OnlineTest.getPresignedUploadUrl = function (path, type, cb) {
	 	var AWS = require('aws-sdk');
		var credentials = {
		    accessKeyId: 'AKIAIHWOB6C62DXVWK4Q',
		    secretAccessKey : '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'
		};
		AWS.config.update({credentials: credentials, region: 'us-east-1'});
  	const s3 = new AWS.S3()
		//expires in default 15 mins.
		s3.getSignedUrl('putObject', {
		    Bucket: 'skillstackcdn',
		    Key: 'testimages/'+path,
		    ContentType: type
		}, function(err, url) {
        if (err) { cb(null,{"error": err}); }
        else { cb(null,{"path": url}); }
    }); 
	}
	 
	 
	 OnlineTest.callCloneTest = function(testId,userid,cb){
		 
		OnlineTest.cloneTest(testId,userid,false,cb); 	 
		 
	 }
	 
	 OnlineTest.createGitRepoHttp = function(testId,cb){
	  console.log("calling createGitRepoHttp");
	  OnlineTest.createGitRepo(testId); 
      cb(null,{"message":"ok"});
	 }
	 
	 OnlineTest.getConfig = function(testId,cb){
	    console.log("in get config");
		OnlineTest.find({where:{id:testId}}, function (err, instance) {
			//console.log("instance="+JSON.stringify(instance))
			if(err){
				console.log("get config err"+err);
				 cb(null,{"mainfile":"src/index.html","terminalcommand":"npm start"});
			}
			else
			if(instance.length>0){
		           if(instance[0].category == "angular"){
				      cb(null,{"mainfile":"src/index.html","terminalcommand":"npm start"});
					  //cb(null,{"mainfile":"src/index.html"});
				   }
				   else
		           if(instance[0].category == "reactjs"){
				      cb(null,{"mainfile":"src/index.js","terminalcommand":"npm start"});
					  //cb(null,{"mainfile":"src/index.js"});
				   }					   
			}
			else
			 cb(null,{"mainfile":"src/index.html","terminalcommand":"npm start"});
			 //cb(null,{"mainfile":"src/index.html"});
        });		
	 }
	 
	 OnlineTest.getMachineDetails = function(instanceid,cb){
		 OnlineTest.describeInstance(instanceid).then(function(data){
					console.log("details="+data)
					
			
							console.log("not timedout"+instanceid);
							cb(null,data);
				}).error(function(){
					console.log("error in terminate"+err);
					cb(null,err);
					}).catch(function(err){console.log("E2"+err)})
		 
	 }
 
 
     OnlineTest.describeInstance = function(instanceid){
                 console.log("in describe"+instanceid);
              var params = {InstanceIds:[instanceid]};
    		return  new Promise(function(resolve, reject) {
    ec2.describeInstances(params, function(err, data) {
             
            console.log("##################################333"+(data));
		    if(err) return reject("err in terminate@@@@@@@@@@@@@@@@@"+err);
			else
				if(data.Reservations.length>0)
			return resolve(data.Reservations[0].Instances[0].LaunchTime);
		    else
				return reject("error");
              // successful response
    });
   
   
 });

 }  
     OnlineTest.terminateInstance = function(instanceid){
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
//Create repository for new tests
 OnlineTest.createGitRepo = function(testId){
    console.log("inside createGitRepo function"+testId);
	const options = {
  hostname: 'api.github.com',
  path: '/user/repos',
  method: 'POST',
  headers: {
		"user-agent": "node.js",
        "Content-Type" : "application/json",
        "Authorization" : "token 8347b2b7377aafda5816be32f4f11d8f484c314f"
    },
  timeout: 3000,
}

var postData = { "name":""+testId+"","private":false};


const req = https.request(options, (res) => {
	console.log("in req status code = "+res.statusCode);
  console.log(`statusCode: ${res.statusCode}`);
  //cb(null,{status:res.statusCode});
  if(res.statusCode=="200"){
	 console.log("got 200");
  }
  
    res.on("data", function (data) {
        // save all the data from response
		console.log("got the github response");
		
    });
  
 
});
req.on('error', (error) => {
  console.error("EEEEEE"+error);

});
req.on('timeout', () => {
	console.log("aborting the req");
    req.abort(); 
	//cb(null,{status:'-999'})
});

req.write(JSON.stringify(postData));
req.end();

// TIMEOUT PART
req.setTimeout(5000, function() {                                                                                                                              
    console.log("Server connection timeout (after 1 second)");                                                                                                                  
    req.abort();  
	//cb(null,{status:'-99'})
});
	
	
	
	
 } 
	



 		OnlineTest.remoteMethod (
        'getPresignedUploadUrl',
        {
          http: {path: '/getPresignedUploadUrl', verb: 'get'},
          accepts: [
          	{arg: 'path', type: 'string', http: { source: 'query' } },
          	{arg: 'type', type: 'string', http: { source: 'query' } },
          ],
          returns:{"type": "json", root:true}
        });


     	 OnlineTest.remoteMethod (
        'removeEnvMachines',
        {
          http: {path: '/removeenvmachines', verb: 'get'},
          accepts: {arg: 'id', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        });

	 OnlineTest.remoteMethod (
        'removeTrytestMachines',
        {
          http: {path: '/removetrytestmachines', verb: 'get'},
          accepts: {arg: 'id', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        });
		
			 OnlineTest.remoteMethod (
        'getMachineDetails',
        {
          http: {path: '/getmachinedetails', verb: 'get'},
          accepts: {arg: 'id', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        });
		
		
			 OnlineTest.remoteMethod (
        'getCurrentStoppedInstancesInBuffHTTP',
        {
          http: {path: '/getCurrentStoppedInstancesInBuffhttp', verb: 'get'},
          accepts: {arg: 'amiid', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        });
				 OnlineTest.remoteMethod (
        'callCloneTest',
        {
          http: {path: '/clonetest', verb: 'post'},
          accepts: [{arg: 'testid', type: 'string', http: { source: 'query' } },
					{arg: 'userid', type: 'number', http: { source: 'query' } }
		  ],
          returns:{"type": "json", root:true}
        });	
		
		OnlineTest.remoteMethod (
        'moveToTestBufferHttp',
        {
          http: {path: '/moveToTestBuffer', verb: 'post'},
          accepts: [{arg: 'envid', type: 'string', http: { source: 'query' } },
					{arg: 'testid', type: 'string', http: { source: 'query' } }
		  ],
          returns:{"type": "json", root:true}
        });	
   //createGitRepo
		OnlineTest.remoteMethod (
        'createGitRepoHttp',
        {
          http: {path: '/creategitrepohttp', verb: 'post'},
          accepts: {arg: 'testid', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        });
		OnlineTest.remoteMethod (
        'getConfig',
        {
          http: {path: '/getconfig', verb: 'get'},
          accepts: {arg: 'testid', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        });			
   		
};
		