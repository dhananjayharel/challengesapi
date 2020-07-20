'use strict';

var email = require('../email');
var randomstring = require("randomstring");
var AWS = require('aws-sdk');
var pathv = 'server/aws-config.json';
AWS.config.update({region: 'us-east-1'});
var ec2 = new AWS.EC2();
var Promise = require("bluebird");
var moment = require('moment');
var fs = require('fs');
var GithubAPI = require('../githubApiPush'); 
var http = require('http');
var ecs = new AWS.ECS({apiVersion: '2014-11-13'});
const {CLUSTERIP,CLUSTERNAME} = require('/home/ubuntu/rdplabs_app/rdplabsapi/server/clusterconfig');
const { exec } = require('child_process');
const stoppedMachinesBufferSize = 50;
var evalcodesDir = "/home/ubuntu/rdplabs_app/selenium_tests/";
module.exports = function(Candidate) {

	Candidate.observe('before save', function(ctx, next) {
	  console.log(ctx.instance);
	  
	  if(ctx.instance && ctx.instance.isCloned == false){
		  var testToken = randomstring.generate(24);
		  ctx.instance.testToken = testToken;
		  ctx.instance.timeline = [];
		  var ss= new Date().toISOString();
		  ctx.instance.timeline.push({"event":"candidate created","date":ss});
		  ctx.instance.timeline.push({"event":"candidate invited","date":ss});
		  if (ctx.instance.email && ctx.instance.message) {
		  //dj: var protocol = "https";
		  var protocol = "http";
		var app = Candidate.app;
        var OnlineTest = app.models.OnlineTest; 	
		 OnlineTest.findOne({where:{id:ctx.instance.onlineTestId}}, function (err, onlineTests) {	
		    if(err){console.log("err")}
			if(onlineTests){
				if(onlineTests.testType=="web"){
					console.log("USE HTTP PROTOCOL FOR WEBBASED TEST");
					protocol = "http";
				}
				var  emailBody = ctx.instance.message;
				emailBody = emailBody.replace(/<p.*?>/g,"<p style=\"font-size:13px;color: #435464; font-family: Arial, sans-serif, 'Open Sans'; margin: 0; padding: 0;\">");
				console.log('after replace'+emailBody);
				let candidate = ctx.instance;
				let subject = ctx.instance.fullname.split(' ')[0] + ' - you have been invited';
				try {
					subject = candidate.meta['subject']
				} catch (err) {}

				let mail = {
					"to": ctx.instance.email,
					"subject": subject,
					"body":  emailBody.replace(/%invite_url%/g, ''+protocol+'://www.skillstack.com/app/candidate/invite/'+testToken), 	};
				email.sendMail(mail);
			}	  
		
		  });
		  }
		//check and update stopped instance buffer
		 Candidate.getCurrentStoppedInstancesInBuff(ctx.instance.onlineTestId,false)
		    .then(function(totalStoppedMachines){
				console.log("getCurrentStoppedInstancesInBuff="+totalStoppedMachines);
				if(totalStoppedMachines==0){
					console.log("By default allocate 1 stopped instance for 1st invite of every tests");				
					//DJ support for stopped machines has been removed from system for now:: to save cost
					//Candidate.createStoppedMachinesFunction(ctx.instance.onlineTestId,1);
				}
				else{
					Candidate.numOfMachinesNeeded(ctx.instance.onlineTestId,totalStoppedMachines,stoppedMachinesBufferSize)
						.then(function(num){
							console.log("numOfMachinesNeeded="+num); 
							for(var i=0;i< num;i++){
								//DJ support for stopped machines has been removed from system for now:: to save cost
								//Candidate.createStoppedMachinesFunction(ctx.instance.onlineTestId,num);
								console.log("stopped machine feature has been removed");
							}
							console.log("now call the function to launch machines");
			   
						});			 
				}
				 			 		    		 	 
			});	
	  }
	   else if(ctx.data){
		   //console.log(JSON.stringify(ctx.data));
          console.log("update "+ctx.data.testStarted+"||"+ctx.data.testStartTime);
          if(ctx.data.testStarted==true && (ctx.data.testStartTime==""||ctx.data.testStartTime==null)){
		    var ss= new Date().toISOString();
              console.log("test started update the time"+ss);
			  ctx.data.testStartTime = ss;
			  ctx.data.timeline.push({"event":"test started","date":ss});

          }
          else
              console.log("test not started yet");
      }

	  next();
	});
	
	
	 Candidate.getTestDetails = function(id, cb) {
			console.log("in get details");		 
	Candidate.findById(id, function (err, instance) {				
	var json=[];
	console.log(instance);
	if(instance){			
		cb(null, instance);			
	}
    else
    {
		console.log(err);
	}		

     
  });
   
 }
	
	
	Candidate.getInstancePublicIp = function(instanceId, cb) {
			console.log("in get public ip"+instanceId);	
               Candidate.getMachinePublicIp(instanceId)
			.then(function(publicIp){
                  console.log("got the result"+publicIp);
				  return cb(null,{ip:publicIp});
			}).error(function(){
					console.log("error in terminate"+err);
					return cb(null,"err");
					}).catch(function(){console.log("EE");
					return cb(null,"err");
					})			
	       
   
 }
	  Candidate.createAmi = function(solutiondetails, cb) {   
		  console.log("###"+JSON.stringify(solutiondetails));
		console.log("nothing to do");
		cb(null,"ok");
		/*
		  
		var marks = 0;  
		  
	Candidate.getMachinePublicIp(solutiondetails.instanceId)
			.then(function(publicIp){
                 console.log("In create AMI "+publicIp);	
                Candidate.execCommand(publicIp,solutiondetails.envId).then(function(data){
					console.log("DATA"+data);
					data = data.replace("\n","");
					data = data.replace("\r","");
					marks = parseInt(data);
					console.log("marks converted to int="+marks);
					Candidate.findOne({where:{id:solutiondetails.id}}, function (err, instance) {				
	var json=[];
	console.log(instance);
	if(instance){		
	    console.log("intial instance");
		console.log(JSON.stringify(instance));
		var oldAmiId = instance.amiid;
		var params = { 
			InstanceId: solutiondetails.instanceId, 
			Name: 'amiOf_'+solutiondetails.id,  
			Description: "candidate solution ami"
		};
		 
		ec2.createImage(params, function(err, data) {
			if (err) {console.log("create image error");cb(null,{error:err});} 
			else{console.log(data.ImageId);  		
				var imageId=data.ImageId;
				var tagParams={
				Resources: [], 
				Tags: [{ Key: "category", Value: "candidateami"},{ Key: "Name", Value: "solution"},{ Key: "pwd", Value: solutiondetails.pwd}]};
				tagParams.Resources.push(data.ImageId);
				ec2.createTags(tagParams, function(err, data) {
					if (err) {console.log(err, err.stack); console.log("create tags error");}// an error occurred
					else {console.log(data);
						console.log("create ami done");
						console.log("XXin upsert marks="+marks);
						instance.AmiId = imageId;
						instance.status = 'completed';
				        instance.testAttempted = true;
						instance.score = marks;
						var ss= new Date().toISOString();
						instance.timeline.push({"event":"test completed","date":ss});
						//update database
						Candidate.upsert(instance, function(err,dataInstance){
							console.log("candidate updated in db");
								console.log("solution ami success");
								cb(null,dataInstance);
							

						});
				
					}          
				});
													
			}           
						
		});	
			
    
				
		
		
		
	}
	else{
		cb(null,{error:"env not found in database"});
	}
     
  });	
					
					
				}).error(function(err){
					
					console.log("E");
				})					
		  

			});
			*/
			
   
 }
    
	//terminate completed amis
	  Candidate.terminateCompletedAMIs = function(baseImageId, cb) {   
  
    Candidate.find({where:{and:[{status:'completed'},{instanceId:{neq:""}}]}}, function (err, instance) {                
    var json=[];
    var promises = [];

    //console.log(instance);
    for(var i in instance){
         (function (instance) {
			console.log("in loop instance="+instance); 

    var p = Candidate.getAmiStatus(instance)
        .bind(instance)
        .then(function(data){
            console.log("After:", data);
			if(instance.instanceId.length>0 && data == 'available'){
				console.log("terminate"+instance.instanceId+" of ami="+instance.AmiId);
				var s = Candidate.terminateInstance(instance).then(function(data){
					console.log("terminated123="+data);
					instance.instanceId="";
					instance.amiDone = true;
					//update db
					json.push(instance);
					Candidate.upsert(instance, function(err,dataInstance){                                   
                                console.log("db updatated");                                      
                                                      
                        });
				});
				
				promises.push(s);
				return s;
			}
			
        });
    promises.push(p);
	return p;
  })(instance[i]);
  
        
    }

      Promise.all(promises.map(function(promise) {
    return promise.reflect();
})).then(function(){ console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@2");cb(null,json);});


  });
   
 }
 
    
  
 //terminate instances of timedout candidate test:
  Candidate.terminateTimedOutInstances = function(baseImageId, cb) {   
    	        var app = Candidate.app;
        var OnlineTest = app.models.OnlineTest; 
    Candidate.find({where:{and:[{status:'completed'},{instanceId:{neq:""}}]}}, function (err, candidates) {                
    var json=[];
    var promises = [];
    //console.log(instance);
	var remaining = candidates.length;
    for(var i in candidates){
         (function (candidates) {
		 OnlineTest.findOne({where:{id:candidates.onlineTestId}}, function (err, onlineTests) {
			 remaining = remaining-1;
			if(err){console.log("err")}
			if(onlineTests){
				console.log("found the test"+onlineTests.duration);
				var currentDateTime = new Date();
				var testStarted = candidates.testStartTime;
				console.log("currentDateTime"+currentDateTime+"|testStarted123="+testStarted);
				var a = moment.utc(currentDateTime);
				var b = moment.utc(testStarted);
					var c = a.diff(b, 'seconds');
					console.log("diff="+c);
					if(c>onlineTests.duration*60){
						console.log("its time to terminate the candidate="+candidates.id);
						var s = Candidate.terminateInstance(candidates).then(function(data){
					console.log("terminated timedout="+data);
					candidates.instanceId="";
					//update db
					//json.push(instance);
					console.log("update db");
					Candidate.upsert(candidates, function(err,dataInstance){ 
                                if(err){
								   console.log("error in candidate update timeout instance");
								}
								//else	
                                //console.log("db updatated for timedout");                                      
                                                      
                        });
				}).error(function(){
					console.log("error in terminate"+err);
					}).catch(function(e){console.log("EE in timedout"+e);
					//Some error occured
					
					
					})
					}
					else{
						console.log("its not timedout candidate="+candidates.id);
						
					}
			}
            if(remaining ==0){console.log("finaly");}
			
					
		 })
  })(candidates[i]);
  
        
    }
    console.log("done");
    cb(null,"ok");


  });
   
 }
 
 //
  //terminate tasks of timedout candidates
  Candidate.terminateTimedOutTasks = function(baseImageId, cb) {   
    	        var app = Candidate.app;
        var OnlineTest = app.models.OnlineTest;  
    Candidate.find({where:{and:[{status:'ongoing'},{taskId:{neq:null}}]}}, function (err, candidates) {                
    var json=[];
    var promises = [];
    //console.log(instance);
	var remaining = candidates.length;
    for(var i in candidates){
         (function (candidates) {
		 OnlineTest.findOne({where:{id:candidates.onlineTestId}}, function (err, onlineTests) {
			 remaining = remaining-1;
			if(err){console.log("err")}
			if(onlineTests){
				console.log("found the test"+onlineTests.duration);
				var currentDateTime = new Date();
				var testStarted = candidates.testStartTime;
				console.log("currentDateTime"+currentDateTime+"|testStarted123="+testStarted);
				var a = moment.utc(currentDateTime);
				var b = moment.utc(testStarted);
					var c = a.diff(b, 'seconds');
					console.log("diff="+c);
					if(c>onlineTests.duration*60){
						console.log("(TASK)its time to terminate the candidate="+candidates.id);
					
						var s = Candidate.terminateTask(candidates).then(function(data){
					console.log("terminated timedout="+data);
					candidates.taskId=null;
					//update db
					//json.push(instance);
					console.log("update db");
					Candidate.upsert(candidates, function(err,dataInstance){ 
                                if(err){
								   console.log("error in candidate update timeout task");
								}
								//else	
                                //console.log("db updatated for timedout");                                      
                                                      
                        });
				}).error(function(){
					console.log("error in terminate"+err);
					}).catch(function(e){console.log("EE in timedout"+e);
					//Some error occured
					
					
					})
					
					}
					else{
						console.log("(TASK)its not timedout candidate="+candidates.id);
						
					}
			}
            if(remaining ==0){console.log("finaly");}
			
					
		 })
  })(candidates[i]);
  
        
    }
    console.log("done");
    cb(null,"ok");


  });
   
 }
 
 
 
  Candidate.getAmiStatus = function(envObj){
              console.log("in getamistatus AMI id="+envObj.AmiId)
              var params = {ImageIds: [envObj.AmiId]};
				return  new Promise(function(resolve, reject) {
				            	if(envObj.AmiId=="NA"){
									    console.log("bypass create ami");
										resolve("available");
										}
							ec2.describeImages(params, function(err, data) {
									//console.log(data);
									if(err) 
										reject("err");
									else
									if (!('Images' in data))
									    resolve("empty");
									else
									if (typeof(data.Images[0])=="undefined")
									    resolve("empty2");
									
									else                             									
										resolve(data.Images[0].State);
										// successful response
								});  
							});

	}

    Candidate.getMachineDetails = function(publicIp){
	 console.log("in machinedetails publicip="+publicIp)
	 var app = Candidate.app;
					var MachineDetails = app.models.MachineDetails; 
				return  new Promise(function(resolve, reject) {
					MachineDetails.findOne({where:{publicIp:publicIp},
					include: {relation: 'candidatetest',scope: {fields: ['name']}}}
					, function (err, instance) {				
						
						//console.log("RESOLVE"+JSON.stringify(instance));
						if(instance){
							resolve(instance);
									
						}
						else{
						console.log(err);
						resolve("err");
						}
							
					});
				
				
				
				});
	
	
	} 	

  Candidate.getMachinePublicIp = function(instanceId){
             var params = {InstanceIds: [instanceId]};
    		return  new Promise(function(resolve, reject) {
						ec2.describeInstances(params, function(err, data) {
							//console.log(data);
							if(err) 
								reject("err");
							else
								resolve(data.Reservations[0].Instances[0].PublicIpAddress);
								// successful response
							});
   
						});

	} 

	  Candidate.getMachineStatus = function(instanceId){
             var params = {InstanceIds: [instanceId]};
    		return  new Promise(function(resolve, reject) {
						ec2.describeInstances(params, function(err, data) {
							console.log("state="+data);
							if(err) 
								reject("err");
							else 
							if(data.Reservations.length==0)	  
								reject("no machine");
							else	  
								resolve(data.Reservations[0].Instances[0].State.Name);
								// successful response
							});
   
						});

	} 
	Candidate.terminateInstance = function(envObj){
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
    Candidate.terminateTask = function(envObj){
	 	return  new Promise(function(resolve, reject) {
		                    if(envObj.taskId.length<=0){
							   resolve("zero");
							}
							var params = {
							task: envObj.taskId, /* required */
							cluster: 'fargate1',
							reason: 'timedout TEST'
						};
	ecs.stopTask(params, function(err, data) {
		if (err) {
		     reject("err"+err)
		 } // an error occurred
		else{
		resolve("taststopped>"+envObj.taskId);
		} 
	});  
   
				});
	
	}	
	
		Candidate.execCommand = function(publicIp,envId){
		console.log("in execCommand"+publicIp);
        var javaDir = evalcodesDir + envId
    	return  new Promise(function(resolve, reject) {
		             console.log('EXEC==cd '+javaDir+';javac -cp "/home/ubuntu/selenium:/home/ubuntu/selenium/client-combined-3.7.1.jar:/home/ubuntu/selenium/libs/*:/home/ubuntu/selenium/phantomjsdriver-1.0.1.jar:" WebTest.java;java -cp "/home/ubuntu/selenium:/home/ubuntu/selenium/client-combined-3.7.1.jar:/home/ubuntu/selenium/libs/*:/home/ubuntu/selenium/phantomjsdriver-1.0.1.jar:" WebTest '+publicIp+'')
		             /*
					 exec('cd '+javaDir+';javac -cp "/home/ubuntu/selenium:/home/ubuntu/selenium/client-combined-3.7.1.jar:/home/ubuntu/selenium/libs/*:/home/ubuntu/selenium/phantomjsdriver-1.0.1.jar:" WebTest.java;java -cp "'+javaDir+':/home/ubuntu/selenium/client-combined-3.7.1.jar:/home/ubuntu/selenium/libs/*:/home/ubuntu/selenium/phantomjsdriver-1.0.1.jar:" WebTest '+publicIp+'', (err, stdout, stderr,cb) => {
						if (err) {
							console.error(err);
							return resolve("-99");
						}
						console.log(stdout);
						return resolve("-99");
			 
					});	
						*/
                    return resolve("-99");					
   
				});
	}  
 
  Candidate.resendInvite = function(id,cb){
	Candidate.findById(id, function (err, instance) {				
			var json=[];
			console.log(instance);
			if(instance){
				let mail = {
					"to": instance.email,
					"subject": 'You are invited for an online coding test',
					"body": instance.message.replace(/%invite_url%/g, 'http://www.skillstack.com/app/candidate/invite/'+instance.testToken), 	};
				email.sendMail(mail);			
				cb(null, "done");			
			}
			else{
				console.log(err);
				cb(null,"err");
			}		
		});
	}
  
	Candidate.getHostMachineUser = function(publicip,cb){
		var app = Candidate.app;
        var MachineDetails = app.models.MachineDetails; 
		var OnlineTest = app.models.OnlineTest;
		console.log("infind"+publicip);
		MachineDetails.findOne({where:{publicIp:publicip}}, function (err, instance) {				
			var data=[];
			console.log(instance);
			if(instance){
                //dj change to add testdetails
                 OnlineTest.findOne({where:{id:instance.testId}}, function (err, onlineTests) {
				    if(onlineTests){
					instance.enableScreenRecording = onlineTests.enableScreenRecording;
				    cb(null, instance); 
					} 
					else
					cb(null, instance); 
				 });				
							
			}
			else{
				console.log(err);
				cb(null,"err");
			}		     
		});
	}
	
	//Docker container 
	
	
	Candidate.getContainerDetails = function(publicip,cb){
		var app = Candidate.app;
        var MachineDetails = app.models.MachineDetails; 
		var OnlineTest = app.models.OnlineTest;
		console.log("infind"+publicip);
		MachineDetails.findOne({where:{publicIp:publicip}}, function (err, instance) {				
			var data=[];
			console.log(instance);
			if(instance){
                //dj change to add testdetails
                 OnlineTest.findOne({where:{id:instance.testId}}, function (err, onlineTests) {
				    if(onlineTests){
					instance.enableScreenRecording = onlineTests.enableScreenRecording;
					var txt="#!/usr/bin/env bash\r\n";
					txt+="export TESTID="+instance.testId+"\r\n";
					txt+="export invite="+instance.inviteId+"\r\n"; 
				    cb(null, txt); 
					} 
					else
					cb(null, ""); 
				 });				
							
			}
			else{
				console.log(err);
				var txt="#!/usr/bin/env bashDEMOEr\r\n";
					txt+="export TESTID=203\r\n";
					txt+="export invite=bXqhmcOBvZPEJvHknHeBwHbx\r\n"; 
				cb(null,txt);
			}		     
		});
	}
	//OctaS9xUn096QloazGgvUWow
		Candidate.updateScore = function(inviteId,score,cb){
		var app = Candidate.app;
        var MachineDetails = app.models.MachineDetails; 
		console.log("infind"+inviteId);
		Candidate.findOne({where:{testToken:inviteId}}, function (err, instance) {				
			var json=[];
			console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$"+instance);
			console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$"+score);
			if(instance){
                //update score	 
                   instance.score = score;		
				    Candidate.upsert(instance,function(err,dataInstance){                                   
                                console.log("done");                                      
                                cb(null,"ok")                      
                        });
					
			}
			else{
				console.log(err);
				cb(null,"err");
			}		     
		});
	}
	
		Candidate.updateScoreV2 = function(inviteId,score,cb){
		var app = Candidate.app;
        var MachineDetails = app.models.MachineDetails; 
		console.log("updateScoreV2: inviteid="+inviteId);
		Candidate.findOne({where:{testToken:inviteId}}, function (err, instance) {				
			var json=[];
			console.log("updateScoreV2:"+instance);
			console.log("updateScoreV2 testAttempted:"+instance.testAttempted);
			console.log("Updatescore version 2 "+score);
			//process testcases
			var marks = 0;
			var testcaseSummary = [];
			var arr = score.split(",")
			for(var i=0;i<arr.length;i++){ 
				var row = arr[i].split("|"); 
				if(/PASSED/.test(row[0])){
					marks = marks + parseInt(row[3]);
					console.log("testcase passesd");  
					testcaseSummary.push({"test":row[2],"status":"passed"});
				}
				else{
				testcaseSummary.push({"test":row[2],"status":"failed"});
				}
			}
			
			if(instance){
                //update score	 
                   instance.score = marks * 10;
				    instance.testAttempted = true;
                    //check if youtubeupload done then mark test as completed
						var ss= new Date().toISOString();
						instance.timeline.push({"event":"test completed","date":ss});	
						instance.testcase_summary = testcaseSummary;	
					if(typeof(instance.ScreenRecordingUrl)!="undefined" && instance.ScreenRecordingUrl.length >1 ){
						console.log("screen recording dome now mark as finished");
						instance.AmiId = "NA";
						instance.status = 'completed';
				        //instance.testAttempted = true;
						//instance.testcase_summary = testcaseSummary;

					}
					else{
						console.log("screen recording not done yet");
					}
						
				    Candidate.upsert(instance,function(err,dataInstance){                                   
                                console.log("scre updated v2");                                      
                                cb(null,"ok")                      
                        });
					
			}
			else{
				console.log(err);
				cb(null,"err");
			}		     
		});
	}
	
	
	Candidate.execShell = function(inviteId,score,cb){
		var app = Candidate.app;
        var MachineDetails = app.models.MachineDetails; 
		console.log("infind"+inviteId);
		Candidate.execCommand(inviteId,0).then(function(data){
		data = data.replace("\r\n", "");
		data = data.replace("\n", "");
		data = data.replace("\r", "");
		 console.log("GOT"+data);
		 cb(null,"ok");
		}).error(function(err){
		  conasole.log("error in ");
		  cb(null,"err");
		});
		
        //cb(null,"ok");
		
	}
  
  
  Candidate.getHostMachineKey = function(id,cb){
       Candidate.findById(1, function (err, instance) {				
		var json=[];
		console.log(instance);
		if(instance){
					let mail = "-----BEGIN RSA PRIVATE KEY-----\r\n"
					+"MIIEpAIBAAKCAQEAr4zgMHsK6UgKFyRxgas5hliP2RP65Spohclto7aqOKLlKo9F\r\n"
					+"Ezz61Jz7XUI/ykBkhTDeydTSqYziij2IV2on+liY4n7Eiv6NOH/A/NpsrwZGI2EG\r\n"
					+"cSLeosWJns7PPUI50XCYSlbZyhdF075MTParDZzFl04ZtbnU/aQJVwmQiTz9RyXZ\r\n"
					+"vBveXIGY23h5shPhGJTqA9P6fNwXHuZghkoEERy3553AtFdF9fVPCnyvaw1L5tN5\r\n"
					+"3nkpiCC7HH3XldpUxW6tjIlHIG3HFZ2q2aoapfab/I/NktFsuPT/Qyr8zxFtiiWB\r\n"
					+"JwRiFQ8jGgSsgOl3R2o5LpxVmmbPihWT1OVeoQIDAQABAoIBAHzYo1fXKZteME7l\r\n"
					+"DBQ7wV1Z/nNTUktILa134xFbBxPgRTpPScC0zW4HdnyMcPFVeid+6fJ/+JG8MCBA\r\n"
					+"QoZoaKYR/CiYHw76mVRlBsrMTB7tR1RB3GL5eXwpIAZg7eGTB6t7d9LmkVy30GEW\r\n"
					+"JQ1XH68+nwdL89zZnDAGSN4tXy05lMhDOHIi4JERsPbVLRzqjdxz2Ybl+Vj38SB5\r\n"
					+"tVRyVmg5HEIgnNhKwSZxKT5KyayMiNK+EkYdoPXabHx9tclbwLDGl52yBcZO50W2\r\n"
					+"hN2bR2r3rbnxsXRZJuIujMzp76xJmp//q/wtJrF/cHt3HJusDWCgjIHixWCQoXkO\r\n"
					+"E1hbgEECgYEA3kjAfP7lEKuKojmj0UPi+fHaNYwc1eSpAyTefqKUN4I5wYeZcgNh\r\n"
					+"mPnKoMJrT/Fh21GtcgIUkmtWkY2381AAVzDqWn0rGV9O31ArarqQuY/+7k9czRLY\r\n"
					+"1tTM/IYLSEqEgkLmgBxVxu8tRdzKk39iAAbqJKvzOOWD6jMrrk6GLrcCgYEAyi10\r\n"
					+"6dkZLCSEWq7NsY8ESaDgMptl8E+DnDw79udFbSX1Tht8cpYGrEaAiws7P7Wor5kQ\r\n"
					+"vFjsELjOMSpbGkgKRTkUZ5nRG/Tbg2KA3l/HiJkuHhGQRRo7wOQgXt0p6w7p3DKg\r\n"
					+"DDm8kEIPBk7ZeJsv4r/wwq3Qh/34l2xFfUL5BWcCgYBFyq/tTxba6hFoKBLgZKFC\r\n"
					+"ewZZY7m2CspqO0xElIVW/GNn+UxbeOZO4rcVTJXnDtH7y6RatH6DDoKqxsVn9sl0\r\n"
					+"lt4uNTiwCbW49fH728IPEUAo0PBBT1aX9U67RtcKBqOeRqUaukrQYE5lrhJIx2kc\r\n"
					+"uw8PHpIKXj3R7ekcHHmS9wKBgQCNGIY0QR+RL/bydnX0ybObUtvEVbEhscxOt7a9\r\n"
					+"jA9mqgv1M7d5HHyRtC43W2JBBx0vVypX19L/pIm5xC6KO+Z3AuvblXxa/1pG6fK3\r\n"
					+"vq45BXYq4+UEZNd4uXxh2AVOFz1cQDRz88NGBeQIafTZd6xGmd+DbdxPXA4mVxhz\r\n"
					+"3858VwKBgQC4U5pp8LYaY0mtiA1OwyMF72KQE7lG0k0lcREd5BoVPE/Q2htgNfKm\r\n"
					+"klhtcvxjg/iUJECqVuomHc62oGImBzgiPXqe6xfnIBYYsW/r9QbKUB8YFUqvc0n+\r\n"
					+"Weqk1E+R4zU9yb7CvcupnqRMgSR1cvmMO/LT/TP3HAkb7w06NN2w2w==\r\n"
					+"-----END RSA PRIVATE KEY-----";
	  		
			cb(null, mail);			
			}
  		  else
			{
			console.log(err);
			cb(null,"err");
			}		     
		});
	}

	Candidate.addGuacEntry = function(solutiondetails, cb) {
			console.log("in add guacentry");
			if(Object.keys(solutiondetails).length === 0)
			    return cb(null,{"error":"emptydata"});
			else	
			if(!("instanceId" in solutiondetails) || !("pwd" in solutiondetails))
				 return cb(null,{"error":"missing instanceId OR pwd"});


            Candidate.getMachinePublicIp(solutiondetails.instanceId)
			.then(function(publicIp){
                  console.log("got the result"+publicIp);

				 			var entry = "<authorize\r\n"+
						"username=\""+solutiondetails.testToken+"\"\r\n"+
						"password=\"6b3951b16af87c635e24542eaf411f5c\"\r\n"+
						"encoding=\"md5\">\r\n"+
						"<connection name=\"Windows 10\">\r\n"+
						"<protocol>rdp</protocol>\r\n"+
						"<param name=\"hostname\">"+publicIp+"</param>\r\n"+
						"<param name=\"username\">Administrator</param>\r\n"+
						"<param name=\"password\">"+solutiondetails.pwd.replace(/&/g,'&amp;')+"</param>\r\n"+
						"<param name=\"security\">tls</param>\r\n"+
						"<param name=\"ignore-cert\">true</param>\r\n"+
						"<param name=\"port\">3389</param>\r\n"+
						"</connection>\r\n"+
						"</authorize>\r\n"+
						"</user-mapping>"; 
                fs.readFile('/var/nfs/general/user-mapping.xml', 'utf8', function (err,data) {
 			    if (err) {
  				  return console.log(err);
  				}
  				var result = data.replace(/<\/user-mapping>/g, entry);
  				fs.writeFile('/var/nfs/general/user-mapping.xml', result, 'utf8', function (err) {
    			if (err) return console.log(err);
				       var resp ={"link":"https://rdpweb.skillstack.com/rdp/#/client/V2luZG93cyAxMABjAGRlZmF1bHQ=?username="+solutiondetails.testToken+"&password=KJYSGkbFVM8ynXymE6kOEp5x"}
				  return  cb(null, resp);
 					 });
			});

			}).error(function(){
					console.log("error in terminate"+err);
					return cb(null,"err");
					}).catch(function(){console.log("EE")})
			

				
	    	
   
	}
	
	//add theia editor entry in nginx conf reverse proxy
		Candidate.addTheiaEntry = function(editorpath,publicip,editorport,outputport, cb) {
			console.log("in add thia entry:editorpath "+editorpath);

	
				var entry =   "location /"+editorpath+"/ {\r\n"+
				"rewrite /"+editorpath+"/(.*) /$1 break;\r\n"+
				"proxy_pass http://"+publicip+":"+editorport+";\r\n"+
				"proxy_http_version 1.1;\r\n"+
				"proxy_set_header Upgrade $http_upgrade;\r\n"+
				"proxy_set_header Connection \"Upgrade\";\r\n"+
				"}\r\n"+
				"location /"+editorpath+"_op/ {\r\n"+
				"rewrite /"+editorpath+"_op/(.*) /$1 break;\r\n"+
				"proxy_pass http://"+publicip+":"+outputport+";\r\n"+
				"proxy_http_version 1.1;\r\n"+
				"proxy_set_header Upgrade $http_upgrade;\r\n"+
				"proxy_set_header Connection \"Upgrade\";\r\n"+
				"}\r\n\r\n"+
				"###################THEIAEDITORMAPPINGEND########################\r\n"
						
                //fs.readFile('/etc/nginx/conf.d/skillstack.conf', 'utf8', function (err,data) {
				fs.readFile('/etc/nginx/sites-available/default', 'utf8', function (err,data) {	
 			    if (err) { 
  				  return console.log(err);
  				}
  				var result = data.replace(/###################THEIAEDITORMAPPINGEND########################/g, entry);
  				//fs.writeFile('/etc/nginx/conf.d/skillstack.conf', result, 'utf8', function (err) {
				fs.writeFile('/etc/nginx/sites-available/default', result, 'utf8', function (err) {	
    			if (err) return console.log(err);
				else{
				       //var resp ={"link":"https://www.skillstack.com/"+inviteid}
						//return  cb(null, resp);
					exec('sudo systemctl reload nginx', (err, stdout, stderr) => {
					if (err) {
					// node couldn't execute the command
						
						console.log(`stderr: ${stderr}`);
					return  cb(null, "err");
						}
						else{
							console.log(`stdout: ${stdout}`);
							 var resp ={"link":"https://www.skillstack.com/"+inviteid}
						return  cb(null, resp);
							
						}
				
						});
				}
 					 });
			});

		
			

				
	    	
   
	}
	//
 
    Candidate.addMachineEntry = function(candidatedetails, cb) {
	    var app = Candidate.app;
        var MachineDetails = app.models.MachineDetails; 
			if(Object.keys(candidatedetails).length === 0)
			    return cb(null,{"error":"emptydata"});
			else	
			if(!("instanceId" in candidatedetails))
				 return cb(null,{"error":"missing instanceId"});
				 
            Candidate.getMachinePublicIp(candidatedetails.instanceId)
			.then(function(publicIp){
				  candidatedetails.publicIp = publicIp;
				  MachineDetails.upsert(candidatedetails,function(err,dataInstance){                                   
                                console.log("done"); 
                                //update stopped machines buffer if needed
									//check and update stopped instance buffer
		 Candidate.getCurrentStoppedInstancesInBuff(candidatedetails.testId,true).then(function(totalStoppedMachines){
			 console.log("getCurrentStoppedInstancesInBuff="+totalStoppedMachines);
			 Candidate.numOfMachinesNeeded(candidatedetails.testId,totalStoppedMachines,stoppedMachinesBufferSize).then(function(num){
				console.log("numOfMachinesNeeded after start test="+num); 
				for(var i=0;i< num;i++){
					Candidate.createStoppedMachinesFunction(candidatedetails.testId,num);
				}
                console.log("send ok");
			   cb(null,"ok")
			 })				 			 		    			
		 });
                                                      
                        });
               
			}).error(function(){
					console.log("error in getpublicip"+err);
					return cb(null,"err");
					}).catch(function(){console.log("EE")})
			
	    	
   
	}
	//another version For ecs service
	    Candidate.addMachineEntry_V2 = function(candidatedetails, cb) {
	    var app = Candidate.app;
        var MachineDetails = app.models.MachineDetails; 
			if(Object.keys(candidatedetails).length === 0)
			    return cb(null,{"error":"emptydata"});

			MachineDetails.upsert(candidatedetails,function(err,dataInstance){                                   
                console.log("done"); 
                //update stopped machines buffer if needed
			    //check and update stopped instance buffer 
                console.log("send ok");
			   cb(null,"ok");				
                 });
	    	
   
	}
	//
	
	
	     Candidate.checkIfSolutionMachine = function(testId, cb) {
	    var app = Candidate.app;
        var MachineDetails = app.models.MachineDetails; 
						 
           	MachineDetails.findOne({where:{testId:testId,type:"solution"}}, function (err, instance) {				
			var json=[];
			console.log(instance);
			if(instance){	  		
					Candidate.getMachineStatus(instance.instanceId)
					.then(function(status){
						console.log("status="+status);
						if(status=="running"){
							console.log("machine is available");
							var obj = {}
							obj.status = "available";
							obj.instanceId = instance.instanceId;
							obj.rdpLink = instance.rdpLink;
							cb(null,obj);
						}
						else{
						 MachineDetails.destroyById(instance.id,function(err,data){
						    console.log("deleted entry");
							var obj = {};
							obj.status = "terminated";
							return cb(null,obj);
						 }); 
						}
               
					}).error(function(){
							console.log("error in getpublicip"+err);
							var obj = {};
							obj.status = "terminated";
							MachineDetails.destroyById(instance.id,function(err,data){
								console.log("deleted entry");
								return cb(null,obj);
							});
							
					}).catch(function(e){
							console.log(e);
							console.log("ErrE");
							var obj = {};
							obj.status = "terminated";
							MachineDetails.destroyById(instance.id,function(err,data){
								console.log("deleted entry");
								return cb(null,obj);
							});
				   })
			}
			else{
				console.log(err);
				var obj = {};
						obj.status = "notfound";
				cb(null,obj);
			}		     
		});
			
			
	    	
   
	}
	
	
    Candidate.updateScreenRecordingUrl = function(inviteId,url,cb) {						            	
		Candidate.findOne({where:{testToken:inviteId}}, function (err, instance) {
			var json=[];
			console.log(instance);
			console.log("instance.testAttempted"+instance.testAttempted);
			if(instance){
				instance.ScreenRecordingUrl = url;
				if(instance.testAttempted==true){
					console.log("mark test finished as updatescorev2 done");
						instance.AmiId = "NA";
						instance.status = 'completed';
					
				}
				
				Candidate.upsert(instance,function(err,dataInstance){                                   
                console.log("done url");                                      
                cb(null,"ok")                      
				});					
			}
			else{
				console.log(err);
				var obj = {};
				obj.status = "notfound";
				cb(null,obj);
			}		     
		});
							    	   
	}


	Candidate.shareVideoUrl = function(sharevideodata, cb) {
	    if (sharevideodata.type === 'email') {
	    	let mail = {
				"to": sharevideodata.email,
				"subject": ''+sharevideodata.fullname+' - Here\'s your Video Interview link for your ongoing test:'+sharevideodata.testName,
				"body": '<p style=\"font-size:13px;color: #435464; font-family: Arial, sans-serif, \'Open Sans\'; margin: 0; padding: 0;\">Dear '+ sharevideodata.fullname +',</p><p style=\"font-size:13px;color: #435464; font-family: Arial, sans-serif, \'Open Sans\'; margin: 0; padding: 0;\">As requested by you, here\'s the Video Interview link to your ongoing test: <i>'+sharevideodata.testName+'</i></p><br/><p style=\"font-size:13px;color: #435464; font-family: Arial, sans-serif, \'Open Sans\'; margin: 0; padding: 0;\">'+ sharevideodata.shareUrl+'</p><br/><p style=\"font-size:13px;color: #435464; font-family: Arial, sans-serif, \'Open Sans\'; margin: 0; padding: 0;\">Kindly note that you need to visit this link from a camera-enabled device like your phone.'+

'</p><br><p style=\"font-size:13px;color: #435464; font-family: Arial, sans-serif, \'Open Sans\'; margin: 0; padding: 0;\">Since this is part of an ongoing test, you also need to complete it in the next 1 hour for your interview to be submitted successfully.'+

'</p><br/><p style=\"font-size:13px;color: #435464; font-family: Arial, sans-serif, \'Open Sans\'; margin: 0; padding: 0;\">Test platform provided by SkillStack.com. Please directly contact the company that sent you the invite for questions on scheduling or evaluating your test</p>'
			};
			email.sendMail(mail);			
			cb(null, "done");


	    } else if (sharevideodata.type === 'mobile') {
	    	// Twilio Credentials
			const accountSid = 'ACb17ccc017f8a225340c6dd16a736e1f8';
			const authToken = 'f56bdeca8c7bc724f5d2f1d3d2a22f50';

			// require the Twilio module and create a REST client
			const client = require('twilio')(accountSid, authToken);

			client.messages
			  .create({
			    to: '+' + sharevideodata.selCountry + sharevideodata.mobile,
			    from: '+14848542240',
			    body: 'Skillstack video share url: ' + sharevideodata.shareUrl,
			  })
			  .then((message) => {
			  	console.log(message.sid);
			  	cb(null, message);
			  })
			  .catch( (error) => {console.log(error)
			  	cb(null, error);
			  });
	    }
			
    }
	
	//Stopped machine xxxxxxxxxxxx
	Candidate.createStoppedMachines = function(testid,number, cb) {
	var obj = {};
	obj.testid = testid;
	obj.number = number;
	      var app = Candidate.app;
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
	 
	Candidate.getTestDetailsFunction(testid).then(function(amiid){
	  console.log("After getTestDetailsFunction"+amiid);
	  crateAMIInstanceParams.ImageId=amiid;
      ec2.runInstances(crateAMIInstanceParams, function(err, data) {
		  if (err) { console.log("Could not create instance", err); return; }
		  var instanceId = data.Instances[0].InstanceId;
		  console.log("Created instance133", instanceId);
			var tagParams={
					Resources: [], 
					Tags: [{ Key: "associated_test", Value: testid},{Key: "createdOn", Value: "1212"}]};
					tagParams.Resources.push(instanceId);
					setTimeout(function(){
					ec2.createTags(tagParams, function(err, data) {
						if (err) {console.log(err, err.stack); console.log("create tags error");}// an error occurred
						else {console.log(data);
							console.log("tag added");
							var inv = {};
							inv.instanceId = instanceId;
						 bufferedInstances.create(inv,function(err,dataInstance){
						 if(err){
						console.log(err);
					}
					console.log('inserted'+JSON.stringify(dataInstance));				
					
				});	
							cb(null,{instanceId:instanceId});
						}          
					});
					},200);
					
      
		});
		});
	//cb(null, obj);
	
	}
	
	//create stopped machines function
	Candidate.createStoppedMachinesFunction = function(testid,number) {
	
	     //DJ DONT CREATE STOPPED MACHINES FOR NOW
		 console.log("DJ DONT CREATE STOPPED MACHINES FOR NOW");
		 return;
	      var app = Candidate.app;
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
	 
	Candidate.getTestDetailsFunction(testid).then(function(amiid){
	  console.log("After getTestDetailsFunction"+amiid);
	  crateAMIInstanceParams.ImageId=amiid;
      ec2.runInstances(crateAMIInstanceParams, function(err, data) {
		  if (err) { console.log("Could not create instance", err); return; }
		  var instanceId = data.Instances[0].InstanceId;
		  console.log("Created instance133", instanceId);
			var tagParams={
					Resources: [], 
					Tags: [{ Key: "associated_test", Value: ""+testid+""},{Key: "createdOn", Value: "1212"}]};
					tagParams.Resources.push(instanceId);
					setTimeout(function(){
					ec2.createTags(tagParams, function(err, data) {
						if (err) {console.log(err, err.stack); console.log("create tags error");}// an error occurred
						else {console.log(data);
							console.log("tag added");
							var inv = {};
							inv.instanceId = instanceId;
						 bufferedInstances.create(inv,function(err,dataInstance){
						 if(err){
						console.log(err);
					}
					console.log('inserted'+JSON.stringify(dataInstance));				
					
				});	
							console.log("create stopped machines done");
						}          
					});
					},200);
					
      
		});
		});
	
	}
	
	Candidate.numOfMachinesNeeded = function(testId,currentStoppedMachines,bufferSize){
		 var machinesToBeLaunched = 0;
		 //find total invites first
		 return new Promise(function(resolve, reject) {
		 Candidate.count({onlineTestId:testId,status:"invited"}, function (err, instance) {
            console.log("total invites="+instance);		   
		  	
		   var totalInvites = instance;
            	 var currentBufferSize = currentStoppedMachines / totalInvites *100;
		 var requiredMorePercent = bufferSize - currentBufferSize;
		 machinesToBeLaunched = requiredMorePercent*totalInvites/100;
		 return resolve(Math.floor(machinesToBeLaunched));		   
		 });
		 });
	
	}
	
		Candidate.getCurrentStoppedInstancesInBuff = function(testId,stoppedOnly){
		 var machinesToBeLaunched = 0;
		 //find total invites
		 return new Promise(function(resolve, reject) {
			var params = {
		Filters: [{Name: 'tag-key',Values: ['associated_test']},
		          {Name: 'tag-value',Values: [""+testId+""]}
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
			/*
			var obj;
			var json=[];
			var count = 0;
			console.log("in stopped instance check LENGTH:"+data.Reservations.length);
			if(data.Reservations.length>0){
				for(var i in data.Reservations){
					count++;
					}
			}
			*/
			console.log("stopped instance check LENGTH:"+data.Reservations.length);
		   return resolve(data.Reservations.length);	
		}
			

			
		
		});           // successful response
 
	});
	}
	
	//Geeting the currently running machines in the system 
			Candidate.getCurrentlyRunningMachines = function(id,cb){
		 var runningMachines = 0;
		 //find the ongoing tests
		var arr = [];	
        var promises = [];		
		 Candidate.find({where:{and:[{status:'ongoing'},{instanceId:{neq:""}}]},
		    fields: ["id","fullname","onlineTestId","status","instanceId","testStartTime"],
			include: {relation: 'candidatetest',scope: {fields: ['name']}}
		 }, function (err, instance) { 
		 for(var i in instance){
         (function (instance) {
		
		 var ss = instance.toJSON(); 
		 console.log(JSON.stringify(instance));
		 if(ss['candidatetest']){
		 //check if the instanceid is present and running in aws
		var p =  Candidate.isInstanceRunning(ss.instanceId).bind(ss).then(function(data,err){
		    console.log("isInstanceRunning"+data);
		    if(data){
			console.log("PUSH THE DATA");
		    arr.push({"name":instance.fullname,"test":ss['candidatetest']['name'],"instanceid":ss.instanceId,"teststarted":ss.testStartTime});
			}
			else{
			console.log("Instance not available in the system");
			}
		 });
		  promises.push(p);	
		 //arr.push({"name":instance.fullname,"test":ss['candidatetest']['name'],"instanceid":ss.instanceId,"teststarted":ss.testStartTime});
			}
			else
			console.log("UNDEFINED");
		
		 })(instance[i]); 
    
       
        }
//xxxxx		
		
		//include: {relation: 'candidatetest',scope: {fields: ['name']}},function(){});
		//console.log(arr);
		Promise.all(promises.map(function(promise) {
    return promise.reflect();
})).then(function(){ console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@2");cb(null,arr);});
		
		});
		}
		
	Candidate.isInstanceRunning = function(instanceId){
	 //xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
	  var machinesToBeLaunched = 0;
		 //find total invites
		 return new Promise(function(resolve, reject) {
			var params = {
			InstanceIds: [
				instanceId 
			]
		};
  
    ec2.describeInstanceStatus(params, function(err, data) {
		if (err) {//console.log(err);// an error occurred
		   resolve(false);
		}
		else {
		console.log(data);
			if(data.InstanceStatuses && data.InstanceStatuses.length > 0){
			  console.log("STATUS123"+JSON.stringify(data.InstanceStatuses[0].InstanceState.Name));
			   if(data.InstanceStatuses[0].InstanceState.Name=="running"){
			    return resolve(true);
			   }
			}
		   return resolve(false);	
		}
			

			
		
		});           // successful response
 
	});
	
	}
	
	Candidate.getAllRunningMachines = function(id,cb){
	var params = {
		Filters: [{Name: 'tag-key',Values: ['associated_test']},
				  {Name: 'instance-state-name',Values: ['running']}
		]
	};
       
    ec2.describeInstances(params, function(err, data) {
		if (err) {console.log("error:"+err); cb(null,"error");} // an error occurred
		else   {
			var obj;
			var json=[];
			var promises = [];
			var app = Candidate.app;
					var MachineDetails = app.models.MachineDetails; 
			var currentDateTime = new Date();
			var a = moment.utc(currentDateTime);
					
			console.log("in running instance check LENGTH:"+data.Reservations.length);
			if(data.Reservations.length>0){
				for(var i in data.Reservations){
				  (function (Reservations) {
				    //console.log(JSON.stringify(Reservations));				
					
					var p = Candidate.getMachineDetails(Reservations.Instances[0].PublicIpAddress)
					                 .bind(Reservations.Instances[0])
									 .then(function(data){
                                    console.log("GOT machinedetails="+data);
									var type=data.type;
									if(type=="candidate")
									   type=(data.inviteId.length>10)? "candidate":"preview test";
									var b = moment.utc(Reservations.Instances[0].LaunchTime);
					                var c = a.diff(b, 'minutes');
                                    var ss= data.toJSON(); 	
										console.log(ss.candidatetest.name);
									json.push({InstanceId:Reservations.Instances[0].InstanceId,
												publicIp:Reservations.Instances[0].PublicIpAddress,
												launchTime:Reservations.Instances[0].LaunchTime,
												type:type,
												testId: data.testId,
												fullname:data.fullname,
												launchedSince:c,
												name:ss.candidatetest.name,
												inviteId:data.inviteId
											});
                                     									
									});
												
					promises.push(p);
					})(data.Reservations[i]);
				}
				
						Promise.all(promises.map(function(promise) {
    return promise.reflect();
})).then(function(){ console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@2");cb(null,json);});
			}
			else
			cb(null,[]);
			

			//DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDdd
		
		}           // successful response
    });
	
	}
	Candidate.numOfMachinesNeededHttp = function(testId,cb){
		 var machinesToBeLaunched = 0;
		 //find total invites
		 var num = Candidate.getCurrentStoppedInstancesInBuff(testId,true).then(function(totalStoppedMachines){
			 console.log("getCurrentStoppedInstancesInBuff="+totalStoppedMachines);
			 Candidate.numOfMachinesNeeded(testId,totalStoppedMachines,stoppedMachinesBufferSize).then(function(num){
				console.log("numOfMachinesNeeded="+num); 

			  cb(null,num);
			 })
				 
			 
		    			
		 })
		 console.log("got the num");
		
	}
	
	 Candidate.getTestDetailsFunction = function(id, cb) {
		console.log("in get details");
		var app = Candidate.app;
        var OnlineTest = app.models.OnlineTest;	
		var Environment = app.models.Environment;
		return new Promise(function(resolve, reject) {	
			OnlineTest.findById(id, function (err, instance) {				
				console.log(instance);
				console.log("ami id="+instance.envId);
				if(instance){
					Environment.findOne({where:{id:instance.envId}}, function (err, env) {
					if(err)
					   console.log(err);
					console.log(env.amiid);   
					return resolve(env.amiid);			
					});
				}
				else if(err){
					console.log(err);
					resolve(err);
				}				 
			});
		});
	  //
   
 }
 
     Candidate.leaderboard = function(date, cb) {
	    var date;
		if(typeof(date)=='indefined')
	      date = new Date(date);
		else
          date = new Date();		
		var yesterday = moment(date).add(-1,"day").format("YYYY-MM-DD HH:mm:ss");;
		var tomorrow  = moment(date).add(1,"day").format("YYYY-MM-DD HH:mm:ss");
        console.log(yesterday +"|"+tomorrow);		
  	   // Candidate.find({where:{and:[{"timeline.date":{gt:yesterday}},{"timeline.date":{lt:tomorrow}}]},
	    Candidate.find({
		fields: ["id","fullname","onlineTestId","timeline"],
		order: 'id DESC' ,
		include: {relation: 'candidatetest',scope: {fields: ['name']}
  }
		}, function (err, instance) {
		  for(var i in instance){
		   console.log("in loop"+JSON.stringify(instance[i]));
		   if(typeof(instance[i].timeline)=='undefined')
			   continue;
	      // var lastUpdate = Candidate.getLatestTimelineUpdate(instance[i].timeline); 
		   instance[i].event = instance[i].timeline[instance[i].timeline.length-1];
		   instance[i].timeline = null;
		   
		  }
		 
		 cb(null,instance);
		});
		
	 }
	 
	 
	 
	      Candidate.updatestatus = function(candidateId,status, cb) {
	
  	    Candidate.findOne({where:{id:candidateId}}, function (err, instance) {		 
		   //console.log("in update"+JSON.stringify(instance));
		   console.log("set ststus = "+status);
		    if(status=="accept"|| status=="Accept")
			   status = "Accepted";
			else
			if(status=="reject"|| status == "Reject")
			    status = "Rejected";
            instance.status = status;    			
	            //update database
				Candidate.upsert(instance, function(err,dataInstance){
					console.log("candidate updated in db");
					console.log("status updated");
					cb(null,"ok");
				});		 
		 
		});
		
	 }

	Candidate.evaluate = function(candidateId,score, cb) {
	
  	    Candidate.findOne({where:{id:candidateId}}, function (err, instance) {
		 
		   //console.log("in update"+JSON.stringify(instance));
		   console.log("set score = "+score);
            instance.score = score;    			
	            //update database
				Candidate.upsert(instance, function(err,dataInstance){
					console.log("score updated");
					cb(null,"ok");
				});		 
		 
		});
		
	 }	 

	 Candidate.getLatestTimelineUpdate = function(timeLineObj){
	     console.log("githubpush demo");
					cb(null,"ok");
	 
	 }
	 
	 Candidate.githubPushDemo = function(id,cb){
		      console.log("githubpush demo");
					var github = new GithubAPI({token: '8347b2b7377aafda5816be32f4f11d8f484c314f'});
					var ss = github.setRepo('vilashProgrammr', 'githubapitest');
					github.setBranch('AWESOME_BRANCH')
    .then( () => github.pushFiles(
        'Making a commit with my adorable files',
        [
            {content: 'You are a Wizard, Harry', path: 'file1.txt'},
            {content: 'May the Force be with you', path: 'jedi.txt'}
        ])
    )
    .then(function() {
        console.log('Files committed!');
    });
					
					cb(null,"ok");
					
	 
	 }
	 
	 
	  Candidate.listTasks = function(id,cb){
		      console.log("list tasks demo");
			var ecs = new AWS.ECS();
     var params = {
  NetworkInterfaceIds: [
     "eni-076d70751ace57bd8"
  ]
 };
 ec2.describeNetworkInterfaces(params, function(err, data) {
   if (err) console.log(err, err.stack); // an error occurred
   else     {console.log(data); 
     cb(null,data);
    }
             // successful response
   /*
   data = {
    taskArns: [
       "arn:aws:ecs:us-east-1:012345678910:task/0cc43cdb-3bee-4407-9c26-c0e6ea5bee84"
    ]
   }
   */
 });
					
					
					
	 
	 }
	 
	//APIS for ECS

	Candidate.finishTest = function(candidateId, cb) {
	
  	    Candidate.findOne({where:{id:candidateId}}, function (err, instance) {
		 
		   //console.log("in update"+JSON.stringify(instance));
		   console.log("in finish test api");
            instance.score = 0;
			instance.testAttempted = true;
			var ss= new Date().toISOString();
			instance.timeline.push({"event":"test completed","date":ss});	
			instance.AmiId = "NA";
			instance.status = 'completed';
	        //update database
			Candidate.upsert(instance, function(err,dataInstance){
				console.log("score updated");
				cb(null,"ok");
				});		 
		 
		});
		
	 }
	 
	 
	 
	 
	 
	Candidate.addContainerMapping = function(containerPath,taskId, cb) {
	   var app = Candidate.app;
	   var data = {"containerPath":containerPath,"taskId":taskId};
	 
	   
        var containerMapping = app.models.containerMapping;	
  	     containerMapping.create(data,function(err,dataInstance){ 
		                         if(err){
									 console.log(err);
								    cb(null,err);
								 }
								 else{
                                console.log("done12"+dataInstance);                                      
                                cb(null,"ok");
								 }
                        });
		
	 }
	 
	 
	 Candidate.getOutputUrl = function(containerPath, cb) {
	   var app = Candidate.app;
	   var data = {"containerPath":containerPath};
	   if(containerPath == "angular"){
		    console.log("bypass for angular");
			return cb(null,{publicIp:"52.87.174.142",port:"4205",containerPath:"angular"});
		   
	   }
	   else if(containerPath == "reactmarvel"){
			console.log("bypass for reactmarvel");
			return cb(null,{publicIp:"52.87.174.142",port:"4206",containerPath:"reactmarvel"});	   
	   }	   
	   else if(containerPath == "lamppcrud"){
			console.log("bypass for react");
			return cb(null,{publicIp:"3.88.100.153",port:"4203",containerPath:"lamppcrud"});	   
	   }
	   	   else if(containerPath == "lPiW4sGZga1583417"){
			console.log("bypass for react");
			return cb(null,{publicIp:"54.83.114.205",port:"4200",containerPath:"lPiW4sGZga1583417"});	   
	   }
	   
	   
	   else if(containerPath == "3000"){
			console.log("bypass for react");
			return cb(null,{publicIp:"54.165.130.177",port:"4200",containerPath:"null"});	   
	   }	   
	   
        var containerMapping = app.models.containerMapping;	
  	     containerMapping.findOne({where:{containerPath:containerPath}}, function (err, dataInstance) {
		                         console.log("done111"+dataInstance);   
		                         if(err){
									 console.log(err);
								    cb(null,err);
								 }
								 else{
                                     
									if(dataInstance!=null){
									//.tasks[0].containers[0].networkBindings
									console.log("ec2 launch type");
									var params = {tasks: [dataInstance.taskId],cluster: "smallmachine"};
									ecs.describeTasks(params, function(err, data) { 
							if (err) console.log(err, err.stack); // an error occurred
							else{
								console.log(data);
								if(data.tasks.length==0){
								 cb(null,{url:""});
								}	
								if(data.tasks[0].containers[0].networkBindings.length>1){
								   console.log("networkBindings");
								   var networkBindings = data.tasks[0].containers[0].networkBindings;
								   var editorPort = 0;
								   var outPutPort = 0;
								   for(var i=0; i<networkBindings.length;i++){
										if(networkBindings[i].containerPort == "3000"){
											editorPort = networkBindings[i].hostPort;
											}
											else
											if(networkBindings[i].containerPort == "4200"){
												outPutPort = networkBindings[i].hostPort;
											}
									   
										}
										//dj: enable it to use same o/p port with reverse proxy
										/*cb(null,{publicIp:"34.226.213.112",port:"",containerPath:containerPath+"_op/"});*/				 
										//dj: enable it to use different ports
										cb(null,{publicIp:CLUSTERIP,port:""+outPutPort+"",containerPath:""});
									}
									else{
										cb(null,{url:""});
										}
								
									}
								});
			
			
								} 
								else if(dataInstance==null){
								   console.log("null");
								   cb(null,{publicIp:CLUSTERIP,port:"4200",containerPath:"null"});
								}
								
                               //cb(null,{url:""});
								 }
                        });
		
	 }
     
	 //getHttpRequestStatus
	 	Candidate.getHttpRequestStatus = function(url,port, cb) {
			var hastUrl = 'http://'+url+':3000';

const options = {
  hostname: url,
  port: port,
  path: '/',
  method: 'GET',
  timeout: 3000,
}

const req = http.request(options, (res) => {
	console.log("in req status code = "+res.statusCode);
  console.log(`statusCode: ${res.statusCode}`);
  //cb(null,{status:res.statusCode});
  if(res.statusCode=="200"){
	  cb(null,{status:"200"});
	 console.log("got 200");
  }
  
 
});
req.on('error', (error) => {
  console.error("EEEEEE"+error);
  cb(null,{status:'-999'});
});
req.on('timeout', () => {
	console.log("aborting the req");
    req.abort(); 
	//cb(null,{status:'-999'})
});
req.end();

// TIMEOUT PART
req.setTimeout(2000, function() {                                                                                                                              
    console.log("Server connection timeout (after 1 second)");                                                                                                                  
    req.abort();  
	//cb(null,{status:'-99'})
});
	
  	  
		}
		
	 //getHttpRequestStatus
	 	Candidate.getHttpRequestStatusV2 = function(url,port,path, cb) {
			var hastUrl = 'http://'+url+':3000';

const options = {
  hostname: url,
  port: port,
  /*path: '/'+path+'/',*/
  method: 'GET',
  timeout: 3000,
}

const req = http.request(options, (res) => {
	console.log("in req status code = "+res.statusCode);
  console.log(`statusCode: ${res.statusCode}`);
  //cb(null,{status:res.statusCode});
  if(res.statusCode=="200"){
	  cb(null,{status:"200"});
	 console.log("got 200");
  }
  else{
     cb(null,{status:"-999"});
  }
  
 
});
req.on('error', (error) => {
  console.error("EEEEEE"+error);
  cb(null,{status:'-999'}); 
});
req.on('timeout', () => {
	console.log("aborting the req");
    req.abort(); 
	//cb(null,{status:'-999'})
});
req.end();

// TIMEOUT PART
req.setTimeout(2000, function() {                                                                                                                              
    console.log("Server connection timeout (after 1 second)");                                                                                                                  
    req.abort();  
	//cb(null,{status:'-99'})
});
	
  	  
		}

    //COPY SCP
	Candidate.copychallenge = function(containerPath, cb) {
	   var app = Candidate.app;

	   var containerip="52.91.176.148";
	   var srcpath="/home/ubuntu/rdplabs_app/challenges";
	   var temppath="/home/ubuntu/rdplabs_app/temp";
	   const fs = require('fs'); 
	   const path = require('path'); 
	   var ncp = require('ncp').ncp;
		ncp.limit = 16;
       var currentDateTime = new Date().getTime().toString();
	   
		fs.mkdir(path.join(temppath, currentDateTime), (err) => { 
			if (err) { 
				return console.error(err); 
			} 
			console.log('Directory created successfully!'); 
			//Now copy challenge template
			ncp(srcpath+"/java",temppath+"/"+currentDateTime, function (err) {
				if (err) {
					return console.error(err);
				}
				console.log('done!');
			   //now copy challenge
			          console.log("in copy challenge");
	   	exec('scp -r -i /home/ubuntu/rdplabs_app/dockerkeys/dockerkey -o StrictHostKeyChecking=no '+temppath+'/'+currentDateTime+' root@'+containerip+':/home/project && rm -rf '+temppath+'/'+currentDateTime, (err, stdout, stderr) => {
					if (err) {
					// node couldn't execute the command
						
						console.log(`stderr: ${stderr}`);
					return  cb(null, "err");
						}
						else{

							console.log(`stdout: ${stdout}`);
							 var resp ={"path":currentDateTime}
						   return  cb(null, resp);
							
						}
				
						}); 
	   
			});
			
			
			
			
		}); 
	   
	   
	   
	  


		
	 }
	 		

      	 
	
	Candidate.remoteMethod (
        'getTestDetails',
        {
          http: {path: '/gettestdetails', verb: 'get'},
          accepts: {arg: 'id', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        });
		
	 Candidate.remoteMethod (
        'terminateCompletedAMIs',
        {
          http: {path: '/terminatecompletedamis', verb: 'get'},
          accepts: {arg: 'id', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        });
		
	 Candidate.remoteMethod (
        'terminateTimedOutInstances',
        {
          http: {path: '/terminatetimedoutinstances', verb: 'get'},
          accepts: {arg: 'id', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        });	
        
	 Candidate.remoteMethod (
        'terminateTimedOutTasks',
        {
          http: {path: '/terminatetimedouttasks', verb: 'get'},
          accepts: {arg: 'id', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        });		
		
	 Candidate.remoteMethod (
        'createAmi',
        {
          http: {path: '/createami', verb: 'post'},
          accepts: [{arg: 'solutiondetails', type: 'object', http: { source: 'body' }}
					],
          returns:{"type": "json", root:true}
        }
    );
	
     Candidate.remoteMethod (
		'addGuacEntry',
        {
          http: {path: '/addguacentry', verb: 'post'},
          accepts: [{arg: 'solutiondetails', type: 'object', http: { source: 'body' }}],
          returns:{"type": "json", root:true}
        }
        );
		
        	 	 	 Candidate.remoteMethod (
        'addTheiaEntry',
        { //editorpath,publicip,editorport,outputport
          http: {path: '/addtheiaentry', verb: 'get'},
          accepts: [{arg: 'editorpath', type: 'string', http: { source: 'query' }},
		  {arg: 'publicip', type: 'string', http: { source: 'query' }},
		   {arg: 'editorport', type: 'string', http: { source: 'query' }},
		  {arg: 'outputport', type: 'string', http: { source: 'query' }}, 
		  
		  ],
          returns:{"type": "json", root:true}
        }
	 );	
	 Candidate.remoteMethod (
        'resendInvite',
        {
          http: {path: '/resendinvite', verb: 'get'},
          accepts: {arg: 'id', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        });
		 
	 Candidate.remoteMethod (
        'getHostMachineUser',
        {
          http: {path: '/gethostmachineuser', verb: 'get'},
          accepts: {arg: 'id', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        });
	 Candidate.remoteMethod (
        'getContainerDetails',
        {
          http: {path: '/getcontainerdetails', verb: 'get'},
          accepts: {arg: 'id', type: 'string', http: { source: 'query' } },
          returns:{"type": "text", root:true}
        });			
	 Candidate.remoteMethod (
        'getHostMachineKey',
        {
          http: {path: '/gethostmachinekey', verb: 'get'},
          accepts: {arg: 'id', type: 'string', http: { source: 'query' } },
          returns:{"type": "string", root:true}
        });
		
	 Candidate.remoteMethod (
        'addMachineEntry',
        {
          http: {path: '/addmachineentry', verb: 'post'},
          accepts: [{arg: 'candidatedata', type: 'object', http: { source: 'body' }}],
          returns:{"type": "json", root:true}
        }
	 );
	 Candidate.remoteMethod (
        'addMachineEntry_V2',
        {
          http: {path: '/addmachineentry_v2', verb: 'post'},
          accepts: [{arg: 'candidatedata', type: 'object', http: { source: 'body' }}],
          returns:{"type": "json", root:true}
        }
	 );	 
	 
	 	 	 Candidate.remoteMethod (
        'checkIfSolutionMachine',
        {
          http: {path: '/checkIfSolutionMachine', verb: 'get'},
          accepts: [{arg: 'id', type: 'string', http: { source: 'query' }}],
          returns:{"type": "json", root:true}
        }
	 );
	 
	 	 	 Candidate.remoteMethod (
        'updateScore',
        {
          http: {path: '/updatescore', verb: 'get'},
          accepts: [{arg: 'inviteId', type: 'string', http: { source: 'query' }},
		  {arg: 'score', type: 'string', http: { source: 'query' }}
		  ],
          returns:{"type": "json", root:true}
        }
	 );	
	 
	 	 	 	 Candidate.remoteMethod (
        'updateScoreV2',
        {
          http: {path: '/updatescorev2', verb: 'get'},
          accepts: [{arg: 'inviteId', type: 'string', http: { source: 'query' }},
		  {arg: 'score', type: 'string', http: { source: 'query' }}
		  ],
          returns:{"type": "json", root:true}
        }
	 );	
		
		 	 	 Candidate.remoteMethod (
        'execShell',
        {
          http: {path: '/execshell', verb: 'get'},
          accepts: [{arg: 'inviteId', type: 'string', http: { source: 'query' }},
		  {arg: 'score', type: 'string', http: { source: 'query' }}
		  ],
          returns:{"type": "json", root:true}
        }
	 );		
	 Candidate.remoteMethod (
        'getInstancePublicIp',
        {
          http: {path: '/getmachinepublicip', verb: 'get'},
          accepts: {arg: 'instanceid', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        });
		
		 	 	 Candidate.remoteMethod (
        'updateScreenRecordingUrl',
        {
          http: {path: '/updatescreenrecordingurl', verb: 'get'},
          accepts: [{arg: 'inviteId', type: 'string', http: { source: 'query' }},
		  {arg: 'url', type: 'string', http: { source: 'query' }}
		  ],
          returns:{"type": "json", root:true}
        }
	 );		
		
	Candidate.afterRemote('getHostMachineKey', function(context, remoteMethodOutput, next) {
		context.res.setHeader('Content-Type', 'text/plain');
		context.res.end(context.result);
	});
	
	Candidate.afterRemote('getContainerDetails', function(context, remoteMethodOutput, next) {
		context.res.setHeader('Content-Type', 'text/plain');
		context.res.end(context.result);
	});

	Candidate.remoteMethod (
        'shareVideoUrl',
        {
          http: {path: '/sharevideourl', verb: 'post'},
          accepts: [{arg: 'sharevideodata', type: 'object', http: { source: 'body' }}],
          returns:{"type": "json", root:true}
        }
	 );
		 Candidate.remoteMethod (
        'createStoppedMachines',
        {
          http: {path: '/createstoppedmachines', verb: 'get'},
          accepts: [{arg: 'testId', type: 'string', http: { source: 'query' }},
		  {arg: 'number', type: 'string', http: { source: 'query' }}
		  ],
          returns:{"type": "json", root:true}
        }
	 );	 
	 	Candidate.remoteMethod (
        'numOfMachinesNeededHttp',
        {
          http: {path: '/numOfMachinesNeededHttp', verb: 'get'},
          accepts: {arg: 'testId', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        });
	    Candidate.remoteMethod (
        'leaderboard',
        {
          http: {path: '/leaderboard', verb: 'get'},
          accepts: {arg: 'date', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        });
	    Candidate.remoteMethod (
        'updatestatus',
        {
          http: {path: '/updatestatus', verb: 'get'},
          accepts: [{arg: 'id', type: 'number', http: { source: 'query' }},
		            {arg: 'status', type: 'string', http: { source: 'query' }}
		         ],
          returns:{"type": "json", root:true}
        });
		Candidate.remoteMethod (
        'evaluate',
        {
          http: {path: '/evaluate', verb: 'get'},
          accepts: [{arg: 'id', type: 'number', http: { source: 'query' }},
		            {arg: 'score', type: 'number', http: { source: 'query' }}
		         ],
          returns:{"type": "json", root:true}
        });
			Candidate.remoteMethod (
        'getCurrentlyRunningMachines',
        {
          http: {path: '/currentmachines', verb: 'get'},
          accepts: [{arg: 'id', type: 'number', http: { source: 'query' }},
		         ],
          returns:{"type": "json", root:true}
        });
			Candidate.remoteMethod (
        'getHttpRequestStatus',
        {
          http: {path: '/gethttprequeststatus', verb: 'get'},
          accepts: [{arg: 'url', type: 'string', http: { source: 'query' }},
		            {arg: 'port', type: 'string', http: { source: 'query' }},
		         ],
          returns:{"type": "json", root:true}
        });		
			Candidate.remoteMethod (
        'getHttpRequestStatusV2',
        {
          http: {path: '/gethttprequeststatusv2', verb: 'get'},
          accepts: [{arg: 'url', type: 'string', http: { source: 'query' }},
					{arg: 'port', type: 'string', http: { source: 'query' }},
					{arg: 'path', type: 'string', http: { source: 'query' }},
					
		         ],
          returns:{"type": "json", root:true}
        });			
				Candidate.remoteMethod (
        'getAllRunningMachines',
        {
          http: {path: '/allmachines', verb: 'get'},
          accepts: [{arg: 'id', type: 'number', http: { source: 'query' }},
		         ],
          returns:{"type": "json", root:true}
        });
		
	Candidate.remoteMethod (
        'githubPushDemo',
        {
          http: {path: '/githubpushdemo', verb: 'get'},
          accepts: [{arg: 'id', type: 'number', http: { source: 'query' }},
		         ],
          returns:{"type": "json", root:true}
        });
		Candidate.remoteMethod (
        'listTasks',
        {
          http: {path: '/listtasks', verb: 'get'},
          accepts: [{arg: 'id', type: 'number', http: { source: 'query' }},
		         ],
          returns:{"type": "json", root:true}
        });	
		Candidate.remoteMethod (
        'finishTest',
        {
          http: {path: '/finishtest', verb: 'get'},
          accepts: [{arg: 'id', type: 'number', http: { source: 'query' }}
		         ],
          returns:{"type": "json", root:true}
        });	
	
			Candidate.remoteMethod (
        'addContainerMapping',
        {
          http: {path: '/addcontainermapping', verb: 'get'},
          accepts: [{arg: 'containerpath', type: 'string', http: { source: 'query' }},
					{arg: 'taskid', type: 'string', http: { source: 'query' }},
		         ],
          returns:{"type": "json", root:true}
        });	
					Candidate.remoteMethod (
        'getOutputUrl',
        {
          http: {path: '/getoutputurl', verb: 'get'},
          accepts: [{arg: 'containerpath', type: 'string', http: { source: 'query' }},
		         ],
          returns:{"type": "json", root:true}
        });
		
				Candidate.remoteMethod (
        'copychallenge',
        {
          http: {path: '/copychallenge', verb: 'get'},
          accepts: [{arg: 'containerpath', type: 'string', http: { source: 'query' }},
		         ],
          returns:{"type": "json", root:true}
        });
		
		
};
