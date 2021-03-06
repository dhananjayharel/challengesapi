'use strict';
var AWS = require('aws-sdk');

var LoopBackContext = require('loopback-context');
var session = require('express-session');
var moment = require('moment');
var Promise = require("bluebird");
var pathv = '/home/ubuntu/rdplabs_app/rdplabsapi/server/aws-config.json';
var moment = require('moment');
AWS.config.loadFromPath(pathv);
AWS.config.update({region: 'us-east-1'});
var ec2 = new AWS.EC2();
var ecs = new AWS.ECS({apiVersion: '2014-11-13'});
var CLUSTERNAME = "fargate1";
var fs = require('fs');
const { exec } = require('child_process'); 
 var atob = require('atob')
//nginx config 
var editorport = "3000";
var outputport = "4200";

module.exports = function(RunningContainers) {

	  RunningContainers.getIframeUrl = function(req,cb){
		  
		console.log("requesst.query.msg"+req.query.msg);  
	  
		         if(req.session.page_views){
						req.session.page_views++;      
   } else { 
      req.session.page_views = 1;     
	  req.session.cookie.expires = new Date(Date.now() + 300000);
  
   }
			var ecs = new AWS.ECS();
     var params = {
  NetworkInterfaceIds: [
     "eni-076d70751ace57bd8"
  ]
 };

 console.log("req.session.page_views"+req.session.page_views);
  //loopbackContext.set('currentUserId', "1");
  console.log("----------------------");
   console.log("REFERER:"+req.headers.referer);
 // console.log(req.sessionStore);
  //console.log("size="+Object.keys(req.sessionStore.sessions).length);
    console.log("----------------------");
  	  cb(null,"req.session.page_views="+req.session.page_views);
   			
	 
	 }
	  
	 
	 
	 RunningContainers.getAvailableContainerHttp = function(req,cb){
		
			var totalActiveSessions = 0;
			var totalContainers = 0;
			var found = false ;
			var minSesssions = -99;
			var minSessionContainer = {};
			var activeContainer = [];
			var masterContainer = [];
			var promises = [];
			//
			const courseid = req.query.courseid;
			const testId=req.query.testid;
			const ipaddress = req.query.ipaddrs;
			var app = RunningContainers.app;
        var ChallengeSession = app.models.ChallengeSession; 
			var lastFiveMinutes = new Date(new Date().getTime()-60*5*1000).toISOString();	
				console.log("OURSEID"+courseid);
			//hardcode paths
			if(courseid=="angular"){
				return cb(null,{"nginxPath":"angular","courseId":"angular"});
			}
				

						
         RunningContainers.find(//{where:{courseId:courseid},	
		 {where:{or: [
     { and: [{ courseId: courseid }, { currentStatus: 'booting' }] },
     { and: [{ courseId: courseid }, { currentStatus: 'running' }]}
   ]},		 
		 include: {relation: 'activecontainersessions', scope: {fields: ['taskId','sessionid','startTime'], 
          where: {startTime: {gte: lastFiveMinutes}
		 }} // only select order with id 5
        }}
		 
		 ,function (err, containers) {
                if(err){
				  console.log("err"+err);
				  cb(null,"na");
				}
				if(containers.length<=0){
				cb(null,"na");
				} 
				
				console.log(containers);
				
				
				 var found = false;
		
			 for(var i in containers){
			   // (function(container){  
			    totalContainers++;
			   if(containers[i].currentStatus == "booting"){
				   console.log("booting "+containers[i].id+" just count it")				  
				   continue;
			   }
				console.log("container#####="+containers[i].taskId);
				console.log("container#####="+containers[i].activecontainersessions());
				var currentContainerSessions = parseInt(containers[i].activecontainersessions().length);
				totalActiveSessions+= currentContainerSessions;
				if(minSesssions==-99){
					minSesssions = currentContainerSessions;
					minSessionContainer = containers[i];
				}
				else
				if(minSesssions>currentContainerSessions){
					minSesssions = currentContainerSessions;
					minSessionContainer = containers[i] ;
				}	
				console.log("(container.activecontainersessions.length)()("+i+")()(())()#####="+containers[i].activecontainersessions().length);
				if(containers[i].activecontainersessions().length<15){
				    found = true;
					RunningContainers.addSessionEntry(containers[i].id);
					 console.log("min sessions="+minSesssions);
					 //send ssh command before sending the path
					 var timeStamp  = new Date().getTime().toString();
					 var commandToexec = "sh /home/theia/gitcopy.sh "+testId+" "+timeStamp+"";
					 RunningContainers.sendSSHCommand(containers[i].publicIp,testId,commandToexec).then(function(data){
					    console.log("after ssh"+data);
						console.log("timeStamp"+timeStamp);
						var session = {};
						 session.onlineTestId=testId;
						 session.containerIp=containers[i].publicIp;
						 session.nginxPath=containers[i].nginxPath;
						 session.tempdirid=timeStamp; 
						 containers[i].timestamp=timeStamp;
						 session.testStarted=true;
						 session.ipaddress = ipaddress;
					    console.log("in submit test"+ipaddress);

						 console.log("creating session "+session);
						 
						 ChallengeSession.create(session,function(err,dataInstance){
						 if(err){
						console.log(err);
						}
						console.log('inserted'+JSON.stringify(dataInstance));				
					     return cb(null,containers[i]); 
						});	
					    
					 });
					
				}
		 
			 }
			 	 if(!found){
			 console.log("didnt find any assign container having min sessions="+minSesssions);
			 totalActiveSessions++;
			 console.log("totalActiveSessions="+totalActiveSessions); 
			 console.log("total containers="+totalContainers);
			 RunningContainers.addSessionEntry(containers[0].id);
			 if(Math.ceil(totalActiveSessions/5)>totalContainers){
				 console.log("need to launch new container in pool");
				 RunningContainers.startTask(containers[0].courseId,totalActiveSessions);
			 }
			
			  cb(null,minSessionContainer);
			 }
			
			// Promise.all(promises.map(function(promise) {
    // return promise.reflect();
// })).then(function(){ console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@2");
// if(found==false){
			 // console.log("did not find any master has to server this req");
			 
			// cb(null,masterContainer);
			// }
			// else{
			// console.log("found"+activeContainer);
			// RunningContainers.addSessionEntry(activeContainer[0].id);
			// cb(null,activeContainer);
			// }

// });	
			
			//cb(null,containers[0]);
		 });
		 
		 console.log("ok");
		

		 
	 }
	 
	 // RunningContainers.getAvailableContainerHttp = function(courseid,cb){
	 // RunningContainers.getAvailableContainer(courseid).then(function(data){
		 // console.log("getAvailableContainerHttp data"+data);
		 // cb(null,data);
	 // })
	 
	   
	 // }
	 RunningContainers.addSessionEntry = function(taskId){
	    console.log("in addSessionEntry ");
		
		   var app = RunningContainers.app;
        var ActiveContainerSessions = app.models.ActiveContainerSessions; 
		var session = {};
		session.sessionid="532fet";
		session.taskId = taskId;
		session.RunningContainersId = taskId;
			 ActiveContainerSessions.create(session,function(err,dataInstance){
						 if(err){
						console.log(err);
					}
					console.log('inserted'+JSON.stringify(dataInstance));				
					
				});	
	 }
	 
	 RunningContainers.getAllSessions = async function(req,cb){
	 
  console.log("----------------------");
  console.log(Object.keys(req.sessionStore.sessions));
  console.log("size="+Object.keys(req.sessionStore.sessions).length);
    console.log("----------------------");
  	  cb(null,"<script type='text/javascript'>document.write('size="+Object.keys(req.sessionStore.sessions).length+"')</script>");
   			
	 
	 }

	 RunningContainers.startTask = function(courseId,totalActiveSessions){
		 
		console.log("in start task totalactivesessions="+totalActiveSessions);
			
		var params = {
			NetworkInterfaceIds: [
				"eni-076d70751ace57bd8"
			]
		};

		console.log("in start task function");
		 var app = RunningContainers.app;
        var CourseContainerParams = app.models.CourseContainerParams; 
		var ContainerPublicIP = app.models.ContainerPublicIP;
		CourseContainerParams.find({where:{courseId:courseId}},function (err, params) {
		if(err){
			console.log("error"+err);
		}
	    var launchParams = {
		  taskDefinition: params[0].taskDefinition, /* required */
		  cluster: CLUSTERNAME,
		  count: 1,
		  group: 'test420',
		  launchType: 'FARGATE',
		  platformVersion: '1.3.0',
		 
		  networkConfiguration: {
			awsvpcConfiguration: {
			  subnets: [ 
				'subnet-51239127',
				'subnet-942290e2'
			  ],
			  assignPublicIp: 'ENABLED',
			  securityGroups: [
				'sg-127d716b',
				'sg-865b57ff'
			  ]
			}
		  },
		 
		  overrides: {
			containerOverrides: [
			  {
				cpu: params[0].cpu,
				environment: params[0].environment,
				memory: params[0].memory,
				memoryReservation: params[0].memory,
				name: params[0].taskDefinition,
			  },
			  /* more items */
			],
			executionRoleArn: 'arn:aws:iam::744034185067:role/ecsTaskExecutionRole',
			taskRoleArn: 'arn:aws:iam::744034185067:role/ecsTaskExecutionRole'
		  },
		  startedBy: 'starttest'
    };
	
	
	ecs.runTask(launchParams, function(err, data) {
		if (err) console.log(err, err.stack); // an error occurred
			else     {
					console.log("###########task started###########");
					console.log(data);
					var instance = {};
					instance.courseId = courseId;
					instance.taskId = data.tasks[0].taskArn.substring(data.tasks[0].taskArn.indexOf('/') + 1);
						
					
				//add entry here
  	             RunningContainers.create(instance,function(err,dataInstance){ 
		                         if(err){
									 console.log(err);
								    
								 }
								 else{
                                console.log("added running container"+dataInstance);
								var data = {};
								data.taskId = dataInstance.taskId;
								data.courseId=dataInstance.courseId;
								ContainerPublicIP.upsert(data, function(err,dataInstance){                                   
                               console.log("ContainerPublicIP updatated");                                      
                                                    
                        			});		
                                
								 }
                        });
  
				}           // successful response
	});
 
		
		});
          
	 }	 
	 
	 RunningContainers.startTaskHttp = function(courseId,cb=null){
	  
		
		var params = {
			NetworkInterfaceIds: [
				"eni-076d70751ace57bd8"
			]
		};

		console.log("in start task");
		 var app = RunningContainers.app;
        var CourseContainerParams = app.models.CourseContainerParams; 
		var ContainerPublicIP = app.models.ContainerPublicIP;
		CourseContainerParams.find({where:{courseId:courseId}},function (err, params) {
		if(err){
		cb(null,err);
		}
			  	var launchParams = {
		  taskDefinition: params[0].taskDefinition, /* required */
		  cluster: CLUSTERNAME,
		  count: 1,
		  group: 'test420',
		  launchType: 'FARGATE',
		  platformVersion: '1.3.0',
		 
		  networkConfiguration: {
			awsvpcConfiguration: {
			  subnets: [ 
				'subnet-51239127',
				'subnet-942290e2'
			  ],
			  assignPublicIp: 'ENABLED',
			  securityGroups: [
				'sg-127d716b',
				'sg-865b57ff'
			  ]
			}
		  },
		 
		  overrides: {
			containerOverrides: [
			  {
				cpu: params[0].cpu,
				environment: params[0].environment,
				memory: params[0].memory,
				memoryReservation: params[0].memory,
				name: params[0].taskDefinition,
			  },
			  /* more items */
			],
			executionRoleArn: 'arn:aws:iam::744034185067:role/ecsTaskExecutionRole',
			taskRoleArn: 'arn:aws:iam::744034185067:role/ecsTaskExecutionRole'
		  },
		  startedBy: 'starttest'
    };
	
	
	ecs.runTask(launchParams, function(err, data) {
		if (err) console.log(err, err.stack); // an error occurred
			else     {
					console.log("###########task started###########");
					console.log(data);
					var instance = {};
					instance.courseId = courseId;
					instance.taskId = data.tasks[0].taskArn.substring(data.tasks[0].taskArn.indexOf('/') + 1);
						
					
				//add entry here
  	             RunningContainers.create(instance,function(err,dataInstance){ 
		                         if(err){
									 console.log(err);
								    
								 }
								 else{
                                console.log("added running container"+dataInstance);
								var data = {};
								data.taskId = dataInstance.taskId;
								data.courseId=dataInstance.courseId;
								ContainerPublicIP.upsert(data, function(err,dataInstance){                                   
                               console.log("db updatated");                                      
                               cb(null,dataInstance);                       
                        			});		
                                
								 }
                        });
  
				}           // successful response
	});
 
		
		});
          
	 }
	 
	 RunningContainers.getTaskInfo = function(taskId,cb){
	    	var params = {
				tasks: [
					taskId
				],
				cluster: CLUSTERNAME,
		};
		ecs.describeTasks(params, function(err, data) {
			if (err) console.log(err, err.stack); // an error occurred
			else{
				console.log(data); 
				cb(null,data);
			}
		 });	 
	 } 
	 
	//get public ip
    RunningContainers.getTaskIp = function(taskId,cb){
	   	var params = {
				tasks: [
					taskId
				],
				cluster: 'fargate1',
		};
		ecs.describeTasks(params, function(err, data) {
			if (err) console.log(err, err.stack); // an error occurred
			else{
				console.log("data.tasks="+data.tasks);
				console.log("data.tasks.length="+data.tasks.length);
				if(data.tasks.length==0){
					return cb(null,{"PublicDnsName":""});
				}				
				if(data.tasks[0].lastStatus!="RUNNING"){
				   console.log("task is not running yet"); 
				   return cb(null,{"PublicDnsName":""});
				}
				
				if(data.tasks[0].attachments[0].status=="ATTACHED"){
				   console.log("elastic network interface is attached");
				   var attachedDetails = data.tasks[0].attachments[0].details;
				   var networkInterfaceId = '';
				   for(var i=0;i<attachedDetails.length;i++){
						if( attachedDetails[i].name == 'networkInterfaceId'){
						   console.log('found network id = '+attachedDetails[i].value);
						   networkInterfaceId = attachedDetails[i].value;
						   break;
						}
				   }
				    var params = {
							NetworkInterfaceIds: [
								networkInterfaceId
								]
							};
					ec2.describeNetworkInterfaces(params, function(err, data) {
						if (err) console.log(err, err.stack); // an error occurred
						else{
							console.log(data); 
							
							//add nginx path here
							var c = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
							var containerPath = Array.from({length:10},function(){return c[Math.floor(Math.random()*c.length)]}).join('');
							var timeStamp = new Date().getTime()+"";
							timeStamp =timeStamp.substring(-7,7);
							containerPath+= timeStamp;
							console.log("containerPath"+containerPath);
							//add entry in nginx server
							RunningContainers.addTheiaEntry(containerPath,data.NetworkInterfaces[0].Association.PublicIp,taskId)
							return cb(null,data.NetworkInterfaces[0].Association.PublicIp);
						}
					});
				   //now get the public ip using this network interface.
				  
				}
				else{
					return cb(null,{"PublicDnsName":""});
				}
				
			}
		 });
	
	
	}
	
		//get public ip cron
    RunningContainers.getTaskIpCron = function(taskId,cb){

		
				var app = RunningContainers.app;    
				var ContainerPublicIP = app.models.ContainerPublicIP;
		ContainerPublicIP.find({where:{bootingCompleted:false}},function (err, tasks) {
			if(err){
				cb(null,"error");
			}
			if(tasks.length==0){
				console.log("seems all processed");
				return cb(null,"nothing");
			}
			
			console.log(tasks);
			//return cb(null,tasks);	
			for(var i in tasks){
				(function(taskItem){
				 //process each taskArn
				 var taskId = taskItem.taskId;
				 var params = {tasks: [taskItem.taskId],
				cluster: 'fargate1',
				};
				ecs.describeTasks(params, function(err, data) {
					if (err) console.log(err, err.stack); // an error occurred
					else{
						console.log(data);
						if(data.tasks.length==0){
							console.log("task not found"); 
							return;
						}
						if(data.tasks[0].lastStatus!="RUNNING"){
							console.log("task is not running yet"+taskItem.taskId); 
							return;
						}
							
						if(data.tasks[0].attachments[0].status=="ATTACHED"){
							console.log("elastic network interface is attached");
							var attachedDetails = data.tasks[0].attachments[0].details;
							var networkInterfaceId = '';
							for(var i=0;i<attachedDetails.length;i++){
								if( attachedDetails[i].name == 'networkInterfaceId'){
									console.log('found network id = '+attachedDetails[i].value);
									networkInterfaceId = attachedDetails[i].value;
									break;
								}
							} 
							var params = {
								NetworkInterfaceIds: [
									networkInterfaceId
								]
							};
							ec2.describeNetworkInterfaces(params, function(err, data) {
								if (err) console.log(err, err.stack); // an error occurred
								else{
										console.log(data); 
							
										//add nginx path here
										var c = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
										var containerPath = Array.from({length:10},function(){return c[Math.floor(Math.random()*c.length)]}).join('');
										var timeStamp = new Date().getTime()+"";
										timeStamp =timeStamp.substring(-7,7);
										containerPath+= timeStamp;
										console.log("containerPath"+containerPath);
										console.log("for task"+taskItem.taskId);
										//add entry in nginx server 
										RunningContainers.addTheiaEntry(containerPath,data.NetworkInterfaces[0].Association.PublicIp,taskItem.taskId)
										//cb(null,data.NetworkInterfaces[0].Association.PublicIp);
										
								}
							});
				   //now get the public ip using this network interface.
				  
				}
				else{
					//cb(null,{"PublicDnsName":""});
					console.log("public ip not attached yet for task"+taskId);
					return;
				}
				
			}
		 }); 
			 
			 
		})(tasks[i]);
			}
		//for tasks
			
			
		cb(null,"ok");	
		});
		/*
	
		 */
	
	
	}
	//end gettaskip cron
	
	

    	//add theia editor entry in nginx conf reverse proxy
		RunningContainers.addTheiaEntry = function(editorpath,publicip,taskId) {
			console.log("in add thia entry:editorpath "+editorpath+" for task#"+taskId);

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
						
               //var data =  fs.readFileSync('/etc/nginx/conf.d/skillstack.conf', 'utf8')//, function (err,data) {
			   var data =  fs.readFileSync('/etc/nginx/sites-available/default', 'utf8')//, function (err,data) {
			   
 			 
  				var result = data.replace(/###################THEIAEDITORMAPPINGEND########################/g, entry);
  				//fs.writeFileSync('/etc/nginx/conf.d/skillstack.conf', result, 'utf8');//, function (err) {
				fs.writeFileSync('/etc/nginx/sites-available/default', result, 'utf8');//, function (err) {
    			//if (err) return console.log(err);
				//else{
				       //var resp ={"link":"https://www.skillstack.com/"+inviteid}
						//return  cb(null, resp);
					exec('sudo systemctl reload nginx', (err, stdout, stderr) => {
					if (err) {
					// node couldn't execute the command
						
						console.log(`stderr: ${stderr}`);
					
						}
						else{
							console.log(`stdout: ${stdout}`);
							 //var resp ={"link":"https://www.skillstack.com/"+inviteid}
							 //done now update running containers table
							 var instance = {};
							  instance.isAvailable=true;
							  instance.currentStatus="running";
							  instance.nginxPath = editorpath;
							  instance.taskId = taskId;
							  instance.publicIp = publicip;
 					 
							 RunningContainers.upsertWithWhere({taskId:taskId},instance,function(err, res){
								if(err){console.log("err"+err)}
								console.log("running container updated");	
								//update monitoring tasks
								var app = RunningContainers.app;    
								var ContainerPublicIP = app.models.ContainerPublicIP;								
								var data = {};								
								data.bootingCompleted=true;
								data.publicIp = publicip;
								ContainerPublicIP.upsertWithWhere({taskId:taskId},data, function(err,dataInstance){                                   
                               console.log("ContainerPublicIP updatated");                                      
                               //cb(null,instance);                       
                        			});		
								 
							 }) 
						 
							
						}
				 
						});
				//}
 					// });
			//});


   
	}	
		 RunningContainers.deleteInactiveTasks = function(courseid,cb){
		 
		    console.log("deleteInactiveTasks");
				var activeSessions = 0;
			var found = false ;
			var activeContainer = [];
			var masterContainer = [];
			var promises = [];
			var lastFiveMinutes = new Date(new Date().getTime()-60*5*1000).toISOString();	
         RunningContainers.find({where:{launchTime:{lte:lastFiveMinutes}},
		 include: {relation: 'activecontainersessions', scope: {fields: ['taskId','sessionid','startTime'], 
          where: {startTime: {gte: lastFiveMinutes}
		 }} // only select order with id 5
        }}
		 
		 ,function (err, containers) {
                if(err){
				  console.log("err"+err);
				  return cb(null,"na");
				}
				if(containers.length<=0){
				return cb(null,"na");
				}
				
				console.log(containers);
				
				
				 var found = false;
		
			 for(var i in containers){
			    (function(runningContainer){  
				console.log("container#####="+runningContainer.taskId);
				console.log("container#####="+runningContainer.activecontainersessions());
				console.log("(container.activecontainersessions.length)()("+i+")()(())()#####="+runningContainer.activecontainersessions().length);
				if(runningContainer.activecontainersessions().length==0 && !runningContainer.isMaster){
				    console.log("delete# "+runningContainer.id);
					RunningContainers.deleteTask(runningContainer);										
				}
		      })(containers[i]);
			 }
		 cb(null,"ok"); 
		 
		 
		 
		 });
		}

        RunningContainers.deleteTask = function(runningContainer){
		  console.log("in delete task#");
		  console.log(runningContainer);	
			runningContainer.isAvailable = false;
            runningContainer.currentStatus = "terminating";			
		    RunningContainers.upsertWithWhere({id:runningContainer.id},runningContainer,function(err, res){                                  
				console.log("RunningContainers updatated now terminate task");   
				RunningContainers.stopTask(runningContainer.taskId).then(function(data){
					console.log("terminated"+data)
				}).error(function(err){
					console.log("error in terminate"+err);
					
					}).catch(function(ee){console.log("EE"+ee);
					});	
			                      
            }); 
		  
          
		}

        //terminate - delete task
    RunningContainers.stopTask = function(taskId){			
		return  new Promise(function(resolve, reject) {	
			var params = {
				task: taskId,
				cluster: CLUSTERNAME,
				reason: 'NOT REQ'
			};
			ecs.stopTask(params, function(err, data) {
				if (err) {console.log(err, err.stack); reject(err);} // an error occurred
				else{
					console.log("task is stopped");
					resolve(data);		
				}           // successful response
			});
   
		});
		
	}		
	 	 RunningContainers.getAllSessions = function(courseid){
	  
	    var app = RunningContainers.app;
        var ActiveContainerSessions = app.models.ActiveContainerSessions; 
			console.log("courseId"+courseid);
	return  new Promise(function(resolve, reject) {		
		
			var lastFiveMinutes = new Date(new Date().getTime()-60*5*1000).toISOString();
			console.log(lastFiveMinutes);
         ActiveContainerSessions.find({where:{and:[{RunningContainersId:courseid}, 
           {startTime: {gte: lastFiveMinutes}
		 }]}},function (err, sessions) {
			 
			if(err){
				    return reject("err in terminate"+err);
			} 

			 console.log("sessions.length-------for ------"+courseid+"-----------.>"+sessions.length);
		
         return resolve(sessions.length);
   		
	 
		 });
	});
	}
	 
	RunningContainers.getAllSessionsHttp = function(courseid,cb){
	 RunningContainers.getAllSessions(courseid).then(function(data){
		 console.log("data"+data);
		 cb(null,data);
	 })
	 
	   
	 }
	 
	 RunningContainers.getRunningCourseContainers = function(courseId,totalActiveSessions,cb){
	 
		return new Promise(function(resolve,reject){})
	
	RunningContainers.find({where:{or: [
     { and: [{ courseId: courseId }, { currentStatus: 'booting' }] },
     { and: [{ courseId: courseId }, { currentStatus: 'running' }]}
   ]}},function (err, containers) {
		if(err){
			console.log("error"+err);
		}
		console.log("containers.length"+containers.length);
		if(Math.ceil(totalActiveSessions/5) > containers.length){
			cb(null,"need to launch the more container for "+totalActiveSessions+" reqs");;
		}
		else 
			cb(null,"server should serve the "+totalActiveSessions+" reqs")
		}) 
		 
	 }
	 
	 
	 
	 RunningContainers.deleteTerminatedContainersEntries = function(courseId,cb){
	
	RunningContainers.destroyAll({ currentStatus: 'terminating'}
  ,function (err, info) {
		if(err){
			console.log("error"+err);
			return cb(null,"err");
		}
		console.log("containers removed "+info.count);

			cb(null,info)
		}) 
		 
	 }
	 
	  RunningContainers.deleteActiveContainerSessionsEntries = function(courseId,cb){
		      var app = RunningContainers.app;
		  var ActiveContainerSessions = app.models.ActiveContainerSessions;
	//
	// ActiveContainerSessions.find({where: {startTime: {lte: lastFiveMinutes}}}
	var lastFiveMinutes = new Date(new Date().getTime()-60*5*1000).toISOString();
			console.log(lastFiveMinutes);
         ActiveContainerSessions.destroyAll({startTime: {lte: lastFiveMinutes}}
       ,function (err, info) {
		if(err){
			console.log("error"+err);
			return cb(null,"err");
		}
		console.log("sessions found "+info.count);

			cb(null,info)
		}) 
		 
	 }
	 
	 RunningContainers.sendSSHCommand = function(publicIp,testId,commandToexec){
		 // ssh -i /home/ubuntu/rdplabs_app/dockerkeys/dockerkey -o StrictHostKeyChecking=no -i /home/ubuntu/rdplabs_app/dockerkeys/dockerkey -o StrictHostKeyChecking=no root@3.94.145.111 'sh /home/project/gitcopy.sh 963 temp654321230'
		 var ts = new Date().getTime().toString();
		 return new Promise(function(resolve,reject){
			var cmd = "ssh -i /home/ubuntu/rdplabs_app/dockerkeys/dockerkey -o StrictHostKeyChecking=no -i /home/ubuntu/rdplabs_app/dockerkeys/dockerkey -o StrictHostKeyChecking=no root@"+publicIp+" '"+commandToexec+"'"; 
			console.log("cmd"+cmd);
			exec(cmd, (err, stdout, stderr) => {
					if (err) {
						console.log(`stderr: ${stderr}`);
						//reject("err");
						}
						else{
							console.log(`stdout: ${stdout}`);
							resolve(ts);
						}
				
						}); 
			//resolve("ok");
			 
		 });
			 
		 }
		 
		 
	 	 RunningContainers.sendSSHCommand2 = function(publicIp,port,testId,commandToexec){
		 // ssh -i /home/ubuntu/rdplabs_app/dockerkeys/dockerkey -o StrictHostKeyChecking=no -i /home/ubuntu/rdplabs_app/dockerkeys/dockerkey -o StrictHostKeyChecking=no root@3.94.145.111 'sh /home/project/gitcopy.sh 963 temp654321230'
		 var ts = new Date().getTime().toString();
		 return new Promise(function(resolve,reject){
			var cmd = "ssh -i /home/ubuntu/rdplabs_app/dockerkeys/dockerkey -o StrictHostKeyChecking=no -p "+port+" -i /home/ubuntu/rdplabs_app/dockerkeys/dockerkey -o StrictHostKeyChecking=no root@"+publicIp+" '"+commandToexec+"'"; 
			console.log("cmd"+cmd);
			exec(cmd, (err, stdout, stderr) => {
					if (err) {
						console.log(`stderr: ${stderr}`);
						//reject("err");
						}
						else{
							console.log(`stdout: ${stdout}`);
							resolve(ts);
						}
				
						}); 
			//resolve("ok");
			 
		 });
			 
		 }

	  	 
	 RunningContainers.getAvailableContainerHttp2 = function(req,cb){
		 // ssh -i /home/ubuntu/rdplabs_app/dockerkeys/dockerkey -o StrictHostKeyChecking=no -i /home/ubuntu/rdplabs_app/dockerkeys/dockerkey -o StrictHostKeyChecking=no root@3.94.145.111 'sh /home/project/gitcopy.sh 963 temp654321230'
		 var ts = new Date().toISOString();
	
		
		 console.log("requesst.query.test"+req.query.testid); 
	
	
		 //calculate the session duration
		  var timeStamp  = new Date().getTime().toString();
					 var commandToexec = "sh /home/theia/gitcopy.sh "+req.query.testid+" "+timeStamp+"";
		RunningContainers.sendSSHCommand2("52.87.174.142","4444",req.query.testid,commandToexec).then(function(data){
		    console.log("copied react:"+timeStamp);
			//create session
			       var app = RunningContainers.app;
           var ChallengeSession = app.models.ChallengeSession; 	 
					var session = {};
						 session.onlineTestId=req.query.testid;
						 session.containerIp="52.87.174.142";
						 session.nginxPath="demo";
						 session.tempdirid=timeStamp; 
						 
						 session.testStarted=true;
						 session.ipaddress = req.query.ipaddrs;
					    console.log("in submit test"+req.query.ipaddrs);

						 console.log("creating session "+session);
						 
						 ChallengeSession.create(session,function(err,dataInstance){
						 if(err){
						console.log(err);
						}
						console.log('inserted'+JSON.stringify(dataInstance));	
                           var obj = {};
						obj.timestamp = timeStamp;
						obj.nginxPath = "demo";						
					     return cb(null,obj); 
						});	
			
			
			
			
         
						 
		}); 
		 

		 } 
	 	 
	 RunningContainers.submitTestHttp = function(req,cb){
		 // ssh -i /home/ubuntu/rdplabs_app/dockerkeys/dockerkey -o StrictHostKeyChecking=no -i /home/ubuntu/rdplabs_app/dockerkeys/dockerkey -o StrictHostKeyChecking=no root@3.94.145.111 'sh /home/project/gitcopy.sh 963 temp654321230'
		 var ts = new Date().toISOString();
		 const tmpdir = req.query.tmpdir;
		 var instance ={};
		 instance.testSubmiTime = ts;
		 instance.testAttempted =  true;
		 console.log("requesst.query.test"+req.query.testid); 
		 console.log("requesst.query.tmpdir"+req.query.tmpdir); 
		 console.log("requesst.query.ctid"+req.query.ctid); 
		 //calculate the session duration
		 var commandToexec = "sh  /home/theia/gitpush.sh "+req.query.tmpdir+"";
		RunningContainers.sendSSHCommand(req.query.ctid,req.query.testid,commandToexec).then(function(data){
		    console.log("code has been pushed now update db"+data);
            var app = RunningContainers.app;
           var ChallengeSession = app.models.ChallengeSession; 	 
			ChallengeSession.upsertWithWhere({tempdirid:tmpdir},instance,function(err, res){
					if(err){console.log("err"+err);
						cb(null,"err");
					}
					console.log("ChallengeSession updated");	
					RunningContainers.updateScore(req.query.testid,req.query.tmpdir);
					cb(null,"ok")
			}); 
				
						 
		}); 
		 

		 }
		 
		 RunningContainers.submitTestHttp2 = function(req,cb){
		 // ssh -i /home/ubuntu/rdplabs_app/dockerkeys/dockerkey -o StrictHostKeyChecking=no -i /home/ubuntu/rdplabs_app/dockerkeys/dockerkey -o StrictHostKeyChecking=no root@3.94.145.111 'sh /home/project/gitcopy.sh 963 temp654321230'
		 var ts = new Date().toISOString();
		 const tmpdir = req.query.tmpdir;
		 var instance ={};
		 instance.testSubmiTime = ts;
		 instance.testAttempted =  true;
	
		 console.log("requesst.query.tmpdir"+req.query.tmpdir); 
		

            var app = RunningContainers.app;
           var ChallengeSession = app.models.ChallengeSession; 	 
			ChallengeSession.upsertWithWhere({tempdirid:tmpdir},instance,function(err, res){
					if(err){console.log("err"+err);
						cb(null,"err");
					}
					console.log("ChallengeSession updated"+res.onlineTestId);
		 var commandToexec = "sh  /home/theia/gitpush.sh "+req.query.tmpdir+"";
		RunningContainers.sendSSHCommand(res.containerIp,res.onlineTestId,commandToexec).then(function(data){
		    console.log("code has been pushed now update db"+data);
            RunningContainers.updateScore(res.onlineTestId,req.query.tmpdir); 
				cb(null,"ok")
						 
		}); 
					
					
			}); 
				
						 
	
		 

		 }

		 RunningContainers.submitTestHttp3 = function(req,cb){
		 // ssh -i /home/ubuntu/rdplabs_app/dockerkeys/dockerkey -o StrictHostKeyChecking=no -i /home/ubuntu/rdplabs_app/dockerkeys/dockerkey -o StrictHostKeyChecking=no root@3.94.145.111 'sh /home/project/gitcopy.sh 963 temp654321230'
		 var ts = new Date().toISOString();
		 const tmpdir = req.query.tmpdir;
		 var instance ={};
		 instance.testSubmiTime = ts;
		 instance.testAttempted =  true;
	
		 console.log("requesst.query.tmpdir"+req.query.tmpdir); 
		

            var app = RunningContainers.app;
           var ChallengeSession = app.models.ChallengeSession; 	 
			ChallengeSession.upsertWithWhere({tempdirid:tmpdir},instance,function(err, res){
					if(err){console.log("err"+err);
						cb(null,"err");
					}
					console.log("ChallengeSession updated"+res.onlineTestId);
		 var commandToexec = "sh  /home/theia/gitpush.sh "+req.query.tmpdir+"";
		RunningContainers.sendSSHCommand2(res.containerIp,"4444",res.onlineTestId,commandToexec).then(function(data){	
		    console.log("code has been pushed now update db"+data);
     
				cb(null,"ok")
						 
		});  
					
					
			}); 
				
						 
	
		 

		 }	 		 
	 
	 RunningContainers.updateScore = function(testId,tmpDir){
		 
		 console.log("in updatescore");
		 console.log("in test"+testId);
		 console.log("in tmpdir"+tmpDir);
     var app = RunningContainers.app;
           var OnlineTest = app.models.OnlineTest; 			 
		OnlineTest.readGitRepo(testId,tmpDir).then(function(contents){
			//console.log("testcaseop contents:"+contents);
		var json = JSON.parse(contents);
         if(typeof(json.content)!=='undefined'){
			var contents = atob(json.content);
			if(/<score>(.*?)<\/score>/.test(contents)){
				var score = contents.match(/<score>(.*?)<\/score>/);
				console.log(score[1]);
				//cb(null,score[1]);
				var instance ={};
           //dj instance.score=score[1];
		   instance.score=score[1];
            var app = RunningContainers.app;
           var ChallengeSession = app.models.ChallengeSession; 	 
			ChallengeSession.upsertWithWhere({tempdirid:tmpDir},instance,function(err, res){
					if(err){console.log("ChallengeSession score:err"+err);
						
					}
				 	console.log("ChallengeSession score updated"+res);	
			}); 
			}
			else
				console.log("score is empty");	
		}
		else{
		console.log("dont update");
		}		
		
        			 
			
		}).catch((err)=>{
				console.log("er"+err);
	
			})
		 

	 }
	 
	 
	 
	 RunningContainers.beforeRemote('getIframeUrl', function (context, unused, next) {
		console.log("before remote");
		next();
	});
	 RunningContainers.afterRemote('getIframeUrl', function(context, remoteMethodOutput, next) {
		context.res.setHeader('Content-Type', 'text/html');
		context.res.end(context.result);
	});
	
	
	
	
	
	

	
	RunningContainers.remoteMethod (
        'getIframeUrl',
        {
          http: {path: '/getiframeurl', verb: 'get'},
          accepts: [{arg: 'req', type: 'object', http: { source: 'req' }},
	
    
					//{arg: 'port', type: 'string', http: { source: 'query' }},
					//{arg: 'path', type: 'string', http: { source: 'query' }},
					
		         ],
          returns:{"type": "text", root:true}
        });	
	RunningContainers.remoteMethod (
        'getAllSessions',
        {
          http: {path: '/getallsessions', verb: 'get'},
           accepts: [ {arg: 'courseid', type: 'string', http: { source: 'query' } },					
		         
					
		         ],
          returns:{"type": "text", root:true}
        });	
     RunningContainers.remoteMethod (
        'startTaskHttp',
        {
          http: {path: '/starttaskhttp', verb: 'get'},
          accepts: [ {arg: 'courseid', type: 'string', http: { source: 'query' } },					
		         ],
          returns:{"type": "text", root:true}
        });	 
    
	 RunningContainers.remoteMethod (
        'getAvailableContainerHttp',
        {
          http: {path: '/getavailablecontainerhttp', verb: 'get'},
          accepts: [{arg: 'req', type: 'object', http: { source: 'req' }}
		         ],
          returns:{"type": "text", root:true}
        });	
	 RunningContainers.remoteMethod (
        'getAvailableContainerHttp2',
        {
          http: {path: '/getavailablecontainerhttp2', verb: 'get'},
          accepts: [{arg: 'req', type: 'object', http: { source: 'req' }}
		         ],
          returns:{"type": "text", root:true}
        });			
	 RunningContainers.remoteMethod (
        'submitTestHttp',
        {
          http: {path: '/submittesthttp', verb: 'get'},
          accepts: [{arg: 'req', type: 'object', http: { source: 'req' }},		
		         ],
          returns:{"type": "text", root:true}
        });			
	 RunningContainers.remoteMethod (
        'submitTestHttp2',
        {
          http: {path: '/submittesthttp2', verb: 'get'},
          accepts: [{arg: 'req', type: 'object', http: { source: 'req' }},		
		         ],
          returns:{"type": "text", root:true}
        });	
	 RunningContainers.remoteMethod (
        'submitTestHttp3',
        {
          http: {path: '/submittesthttp3', verb: 'get'},
          accepts: [{arg: 'req', type: 'object', http: { source: 'req' }},		
		         ],
          returns:{"type": "text", root:true}
        });			
		 RunningContainers.remoteMethod (
        'getTaskInfo',
        {
          http: {path: '/gettaskinfo', verb: 'get'},
          accepts: [ {arg: 'taskid', type: 'string', http: { source: 'query' } },					
		         ],
          returns:{"type": "text", root:true}
        });	

		 RunningContainers.remoteMethod (
        'getTaskIp',
        {
          http: {path: '/gettaskip', verb: 'get'},
          accepts: [ {arg: 'taskid', type: 'string', http: { source: 'query' } },					
		         ],
          returns:{"type": "text", root:true}
        });			
		 RunningContainers.remoteMethod (
        'getTaskIpCron',
        {
          http: {path: '/gettaskipcron', verb: 'get'},
          accepts: [ {arg: 'taskid', type: 'string', http: { source: 'query' } },					
		         ],
          returns:{"type": "text", root:true}
        });	
	
		 RunningContainers.remoteMethod (
        'deleteInactiveTasks',
        {
          http: {path: '/deleteinactivetasks', verb: 'get'},
          accepts: [ {arg: 'courseid', type: 'string', http: { source: 'query' } },					
		         ],
          returns:{"type": "text", root:true}
        });	

		 RunningContainers.remoteMethod (
        'getRunningCourseContainers',
        {
          http: {path: '/getrunningcoursecontainers', verb: 'get'},
          accepts: [ {arg: 'courseid', type: 'string', http: { source: 'query' } },	
					{arg: 'totalActiveSessions', type: 'string', http: { source: 'query' } },			  
		         ],
          returns:{"type": "text", root:true}
        });

		 RunningContainers.remoteMethod (
        'deleteTerminatedContainersEntries',
        {
          http: {path: '/deleteterminatedcontainersentries', verb: 'get'},
          accepts: [ {arg: 'courseid', type: 'string', http: { source: 'query' } }		  
		         ],
          returns:{"type": "text", root:true}
        });	
	 RunningContainers.remoteMethod (
        'deleteActiveContainerSessionsEntries',
        {
          http: {path: '/deleteactivecontainersessionsentries', verb: 'get'},
          accepts: [ {arg: 'courseid', type: 'string', http: { source: 'query' } }		  
		         ],
          returns:{"type": "text", root:true}
        });		
				
		
};
