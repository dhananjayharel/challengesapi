'use strict';
var AWS = require('aws-sdk');
var pathv = '/home/ubuntu/rdplabs_app/rdplabsapi/server/aws-config.json';
var moment = require('moment');
AWS.config.loadFromPath(pathv);
AWS.config.update({region: 'us-east-1'});
var ec2 = new AWS.EC2();
var ecs = new AWS.ECS({apiVersion: '2014-11-13'});
var elbv2 = new AWS.ELBv2({apiVersion: '2015-12-01'});

//var CLUSTERNAME = "skillstack4";
//var CLUSTERIP = "107.23.162.69";
const {CLUSTERIP,CLUSTERNAME} = require('/home/ubuntu/rdplabs_app/rdplabsapi/server/clusterconfig');

//var CLUSTERNAME = "smallmachine";
//var CLUSTERIP = "34.204.52.42";

//default parameters to launch machine
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
module.exports = function(server) {
  // Install a `/` route that returns server status
  var router = server.loopback.Router();
  router.get('/', server.loopback.status());
  router.get('/api/awsamis', function(req, res) {
	var params = {
		Filters: [
		{
			Name: 'tag-key',
			Values: [
				'category'
			]
		},
		{
			Name: 'tag-value',
			Values: [
				'rdpami'
			]
		}
		],
		Owners: [
			'self'
		]
	};

    ec2.describeImages(params, function(err, data) {
		if (err) res.json({error:err}); // an error occurred
		else   {
			var obj;
			var json=[];
			 for(var i in data.Images){
				json.push({ImageId:data.Images[i].ImageId,
						   CreationDate:data.Images[i].CreationDate,
						   Name:data.Images[i].Name,
						   Description:data.Images[i].Description,
						   PublicIp:data.Images[i].PublicDnsName
				});
			}
			res.send(json);
		
		}           // successful response
    });
  });
   router.get('/api/awsinstances/:testid', function(req, res) {
	var params = {
		Filters: [{Name: 'tag-key',Values: ['associated_test']},
		          {Name: 'tag-value',Values: [req.params.testid]},
				  {Name: 'instance-state-name',Values: ['stopped']}
		]
	};
       
    ec2.describeInstances(params, function(err, data) {
		if (err) res.json({error:err}); // an error occurred
		else   {
			var obj;
			var json=[];
			console.log("in stopped instance check LENGTH:"+data.Reservations.length);
			if(data.Reservations.length>0){
				for(var i in data.Reservations){
					json.push({InstanceId:data.Reservations[i].Instances[0].InstanceId
					});
				}
			}
			res.send(json);

			
		
		}           // successful response
    });
  })
  router.get('/api/machinestatus/:id', function (req, res) {
		res.header("Access-Control-Allow-Origin", "*");
		res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
		res.setHeader('Content-Type', 'application/json');
		var params = {
			InstanceIds: [
				req.params.id 
			]
		};
		ec2.describeInstanceStatus(params, function(err, data) {
			console.log("status="+JSON.stringify(data));
			if (err){  
				res.json({error:err});
			}
			else {
				if(data.InstanceStatuses.length > 0)
				     res.json({state:data.InstanceStatuses[0].InstanceStatus.Status});

				 else
					 res.json({state:"NA"});
			}
		}); 
   
  })
  router.get('/api/machinedetails/:id', function (req, res) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	res.setHeader('Content-Type', 'application/json');
	var params = {
			InstanceIds: [
				req.params.id 
			]
		};
	ec2.describeInstances(params, function(err, data) {
	if (err) res.json({error:err});
	else {
		  var machineObj=data.Reservations[0].Instances[0];
		res.json({InstanceId:machineObj.InstanceId,
		          PublicDnsName:machineObj.PublicDnsName,
				  State:machineObj.State.Name,
				  LaunchTime:machineObj.LaunchTime,
				  Tags:machineObj.Tags,
				  PublicIpAddress:machineObj.PublicIpAddress
		});
	}
	}); 
   
	})
	router.get('/api/createinstance/:amiId', function(req, res) {   
      res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.setHeader('Content-Type', 'application/json');
	  crateAMIInstanceParams.ImageId=req.params.amiId;
      ec2.runInstances(crateAMIInstanceParams, function(err, data) {
      if (err) { console.log("Could not create instance", err); return; }

      var instanceId = data.Instances[0].InstanceId;
      console.log("Created instance133", instanceId);
      res.json({instanceId:instanceId});
});
   
})
   	router.get('/api/startinstance/:instanceId', function(req, res) {   
      res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.setHeader('Content-Type', 'application/json');
	  	var params = {
			InstanceIds: [
				req.params.instanceId 
			]
		};
      ec2.startInstances(params, function(err, data) {
      if (err) { console.log("Could not start instance", err); return; }

     // var instanceId = data.Instances[0].InstanceId; xxxxxxxxxxxxxx
	 console.log(data);
      console.log("Started stopped instance");
      res.json({instanceId:req.params.instanceId});
});
   
})
   	//ECS APIS 
	router.get('/api/starttask/:taskId/:testId/:inviteId/:containerName/:gitUrl/:type/:projectName/:containerPath', function(req, res) {   
      res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.setHeader('Content-Type', 'application/json');
	  	var params = {
		  taskDefinition: req.params.taskId, /* required */
		  cluster: CLUSTERNAME,
		  count: 1,
		  group: 'test420',
		  launchType: 'EC2',
		 // platformVersion: '1.3.0',
		  /*
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
		  */
		  overrides: {
			containerOverrides: [
			  {
				cpu: 512,
				environment: [
				  {
					name: 'TESTID',
					value: req.params.testId
				  },
				    {
					name: 'invite',
					value: req.params.inviteId
				  },
				  {
					name: 'GITURL',
					value: req.params.gitUrl
				  },
				  {
					name: 'TYPE',
					value: req.params.type
				  },	
				  {
					name: 'PROJECTDIR',
					value: req.params.projectName
				  },
			  {
					name: 'CONTAINERPATH',
					value: req.params.containerPath
				  }				  
				  
				  
				],
				memory: 1024,
				memoryReservation: 1024,
				name: req.params.containerName,
			  },
			  /* more items */
			],
			executionRoleArn: 'arn:aws:iam::744034185067:role/ecsTaskExecutionRole',
			taskRoleArn: 'arn:aws:iam::744034185067:role/ecsTaskExecutionRole'
		  },
		  startedBy: 'starttest'
    };
	
ecs.runTask(params, function(err, data) {
  if (err) console.log(err, err.stack); // an error occurred
  else     {
     console.log("###########task started###########");
	 console.log(data);
    res.json(data); 
  
   }           // successful response
});


/*
var params = {
  tasks: [
     "d5861bd4-16ee-44d9-a726-576cfcd5bc89"
  ],
  cluster: 'fargate1',
 };
 ecs.describeTasks(params, function(err, data) {
   if (err) console.log(err, err.stack); // an error occurred
   else     {console.log(data); 
           res.json(data);
         }
		 });
		 
         */
})

//STOP TASK
 router.get('/api/stoptask/:taskId', function(req, res) {   
      res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.setHeader('Content-Type', 'application/json');
		var params = {
			task: req.params.taskId, /* required */
			cluster: CLUSTERNAME,
			reason: 'FINISH TEST'
		};
	ecs.stopTask(params, function(err, data) {
		if (err) console.log(err, err.stack); // an error occurred
		else{
		console.log("task is stopped");
		console.log(data);
		res.send({message:"success"});
		}           // successful response
	});
   
   })
   
  //START SERVICE
 router.get('/api/startservice/:name/:inviteid/:taskId/:containerName', function(req, res) {   
      res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.setHeader('Content-Type', 'application/json');
var params = {
  serviceName: req.params.name, /* required */
  cluster: 'fargate1',
  clientToken: req.params.inviteid,
  deploymentConfiguration: {
    maximumPercent: '200',
    minimumHealthyPercent: '20'
  },
  desiredCount: '1',
  healthCheckGracePeriodSeconds: 2147483647,
  launchType: 'FARGATE',
  loadBalancers: [
    {
      containerName: req.params.containerName,
      containerPort: '3000',
      targetGroupArn:'arn:aws:elasticloadbalancing:us-east-1:744034185067:targetgroup/test/0cc80cf5ba718517'
    },
    /* more items */
  ],
  networkConfiguration: {
    awsvpcConfiguration: {
      subnets: [ /* required */
        	'subnet-51239127',
			'subnet-942290e2'
      ],
      assignPublicIp: 'ENABLED',
      securityGroups: [
			'sg-127d716b',
			'sg-865b57ff'
        /* more items */
      ]
    }
  },

  platformVersion: '1.3.0',
 
  taskDefinition: 'arn:aws:ecs:us-east-1:744034185067:task-definition/'+req.params.taskId+':1'
};
ecs.createService(params, function(err, data) {
  if (err) console.log(err, err.stack); // an error occurred
  else     {console.log(data);  
   res.send({message:"success"});
  }         // successful response
});
   
   }) 
   //get the serviceinfo
  router.get('/api/getserviceinfo/:servicename', function(req, res) {   
      res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.setHeader('Content-Type', 'application/json');  
		var params = {
		 serviceName: req.params.servicename,
		cluster: 'fargate1'
	};
	ecs.listTasks(params, function(err, data) {
		if (err) {console.log(err, err.stack);
		 res.json({"taskArns":[]});
		} // an error occurred
		else{console.log(data);
			res.json(data);
		}  
	}); 
  })
 //GET THE RUNNING TASK INFO: 
 router.get('/api/gettaskinfo/:taksid', function(req, res) {   
      res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.setHeader('Content-Type', 'application/json');
	var params = {
				tasks: [
					req.params.taksid
				],
				cluster: CLUSTERNAME,
		};
		ecs.describeTasks(params, function(err, data) {
			if (err) console.log(err, err.stack); // an error occurred
			else{
				console.log(data); 
				res.json(data);
			}
		 });
    
   })
   
    router.get('/api/gettasks/:taksid', function(req, res) {   
      res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.setHeader('Content-Type', 'application/json');
	var params = {
	
				cluster: CLUSTERNAME,
		}; 
		ecs.listTasks(params, function(err, data) {
			if (err) console.log(err, err.stack); // an error occurred
			else{
				console.log(data); 
				   for(var i=0;i<data.taskArns.length;i++){
					    var params = {
				          tasks: [
							data.taskArns[i]
							],
							cluster: CLUSTERNAME,
							};
							ecs.describeTasks(params, function(err, data) {
								if (err) console.log(err, err.stack); // an error occurred
								else{
									console.log(data.tasks[0].startedAt); 
									var currentDateTime = new Date();
									var a = moment.utc(currentDateTime);
									var b = moment.utc(data.tasks[0].startedAt);
									var c = a.diff(b, 'seconds');
									console.log("diff of "+i+"="+c);
									//if(c>600){
									if(c>2400){
										console.log("delete task"+data.tasks[0].taskArn);
										var taskId = data.tasks[0].taskArn;
										taskId = taskId.substr(taskId.lastIndexOf("/")+1);
												var params = {
														task: taskId, /* required */
														cluster: CLUSTERNAME,
															reason: 'FINISH TEST'
													};
												ecs.stopTask(params, function(err, data) {
												if (err) console.log(err, err.stack); // an error occurred
														else{
															console.log("task is stopped");
															console.log(data);
												
													}           // successful response
												});
										
										
									}
									//res.json(data);
								}
							});  
                     					  
					   
				   }
				res.json("ok");
			}
		 });
   
   })
      //target group
   router.get('/api/gettargetgroups/:taksid', function(req, res) {   
      res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.setHeader('Content-Type', 'application/json');
	var params = {
		LoadBalancerArn: 'arn:aws:elasticloadbalancing:us-east-1:744034185067:loadbalancer/app/fortask2/e59b45a42da155bf',

};
elbv2.describeTargetGroups(params, function(err, data) {
  if (err) console.log(err, err.stack); // an error occurred
  else    {console.log(data);
         res.json(data);
  }           // successful response
});
   })
   
   
      router.get('/api/createtag/:resourcearn', function(req, res) {   
      res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.setHeader('Content-Type', 'application/json');
	var params = {
  ResourceArns: [ /* required */
    'arn:aws:elasticloadbalancing:us-east-1:744034185067:targetgroup/test/0cc80cf5ba718517',
    /* more items */
  ],
  Tags: [ /* required */
    {
      Key: 'IN_USE', /* required */
      Value: 'YES'
    },
    /* more items */ 
  ]
};
elbv2.addTags(params, function(err, data) {
  if (err) console.log(err, err.stack); // an error occurred
  else    { console.log(data); res.json("ok");}           // successful response
});
   })
   
   
   
   
   
   //GET PUBLIC IP OF RUNNING TASK
    router.get('/api/gettasksip/:taksid/:launchtype', function(req, res) {   
      res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.setHeader('Content-Type', 'application/json');
	  if(req.params.launchtype=='FARGATE'){
	var params = {
				tasks: [
					req.params.taksid
				],
				cluster: 'fargate1',
		};
		ecs.describeTasks(params, function(err, data) {
			if (err) console.log(err, err.stack); // an error occurred
			else{
				console.log(data);
				if(data.tasks.length==0){
				 res.json({"PublicDnsName":""});
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
							res.json(data.NetworkInterfaces[0].Association);
						}
					});
				   //now get the public ip using this network interface.
				  
				}
				else{
					res.json({"PublicDnsName":""});
				}
				
			}
		 });
	   }else
		if(req.params.launchtype=='EC2'){
			//.tasks[0].containers[0].networkBindings
			console.log("ec2 launch type");
			var params = {
				tasks: [
					req.params.taksid
				],
				cluster: CLUSTERNAME,
		};
		ecs.describeTasks(params, function(err, data) {
			if (err) console.log(err, err.stack); // an error occurred
			else{
				console.log(data);
				if(data.tasks.length==0){
				 res.json({"PublicDnsName":""});
				}	
				if(data.tasks[0].containers[0].networkBindings && data.tasks[0].containers[0].networkBindings.length>1){
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
				   res.json({"PublicIp":CLUSTERIP,"editorPort":editorPort,"outPutPort":outPutPort});				 
				  
				}
				else{
					res.json({"PublicDnsName":""});
				}
				
			}
		 });
			
			
		}   
   
   })
   

	router.get('/api/getpasswordold/:instanceId', function(req, res) {   
      res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.setHeader('Content-Type', 'application/json');
	  /*
	 var params = { InstanceIds: []};
   params.InstanceIds.push(req.params.instanceId);
  ec2.describeInstances(params, function(err, data) {
	if (err) res.json({error:err}); // an error occurred
	else{   console.log("in get password"); console.log(JSON.stringify(data));
	    if(data.Reservations && data.Reservations.length>0){
			console.log(data.Reservations[0].Instances[0].ImageId);
			var params = {ImageIds: []};
			params.ImageIds.push(data.Reservations[0].Instances[0].ImageId);	
			ec2.describeImages(params, function(err, data) {
				if (err) {res.json({error:err})} // an error occurred
				else    {
					for(var i in data.Images[0].Tags){
						if(data.Images[0].Tags[i].Key=='pwd'){
						console.log("pwd:"+data.Images[0].Tags[i].Value) ; 
						res.json({pwd:data.Images[0].Tags[i].Value});
						break;
						}
					}
				}
			});
	   }//if
	   else{
		   res.json({});
	   }
	   
	}
}); 
*/
	 
	res.json({pwd:"wEAgQDvzR7R%j2t%UnAgd=w)R-K&p$b6"}); 
   
})

	router.get('/api/getpassword/:baseImageId', function(req, res) {   
      res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.setHeader('Content-Type', 'application/json');
       console.log("in get password"); 
	   /* RIGHT NOW COMMENTED bcs multiple aws calls in cron job were causing aws requests blocking
			var params = {ImageIds: []};
			params.ImageIds.push(req.params.baseImageId);	
			ec2.describeImages(params, function(err, data) {
				if (err) {res.json({error:err})} // an error occurred
				else    {
					for(var i in data.Images[0].Tags){
						if(data.Images[0].Tags[i].Key=='pwd'){
						console.log("pwd:"+data.Images[0].Tags[i].Value) ; 
						res.json({pwd:data.Images[0].Tags[i].Value});
						break;
						}
					}
				}
			});
			*/
	 
    res.json({pwd:"wEAgQDvzR7R%j2t%UnAgd=w)R-K&p$b6"}); 
	 
   
})

	router.get('/api/createami/:instanceId/:amiName/:tagName', function(req, res) {   
      res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.setHeader('Content-Type', 'application/json');

	  crateAMIInstanceParams.ImageId=req.params.instanceId;
      var params = { 
		InstanceId: req.params.instanceId, /* required */
		Name: req.params.amiName, /* required */
		Description: req.params.description
		};
	ec2.createImage(params, function(err, data) {
		if (err) {console.log("create image error");res.json({error:err});} // an error occurred
		else{console.log(data.ImageId);  		// successful response
		  var imageId=data.ImageId;
		  var tagParams={
				Resources: [], 
				Tags: [{ Key: "category", Value: "rdpami"},
				       { Key: "Name", Value: req.params.tagName}
					   ]
				};
			tagParams.Resources.push(data.ImageId);
			ec2.createTags(tagParams, function(err, data) {
			if (err) {console.log(err, err.stack); console.log("create tags error");}// an error occurred
			else {console.log(data);
				console.log("done");
				res.json({imageId:imageId});
				}          // successful response
				});
				
			
			
			
			}           // successful response
			
			
			});		
	
   
})

router.get('/api/downloadrdp/:amiId', function(req, res) {   
      res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      var text_ready = "auto connect:i:1\r\nfull address:s:ec2-34-207-206-145.compute-1.amazonaws.com\r\nusername:s:Administrator\r\ndisable wallpaper:i:0\r\n";




res.writeHead(200, {'Content-Type': 'application/force-download','Content-disposition':'attachment; filename=login.rdp'});

res.end( text_ready );
	
   
})

  router.get('/api/rdpdetails/:id', function (req, res) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	res.setHeader('Content-Type', 'application/json');
	var params = {
			InstanceIds: [
				req.params.id 
			]
		};
	ec2.describeInstances(params, function(err, data) {
	if (err) res.json({error:err});
	else {
		  var machineObj=data.Reservations[0].Instances[0];
		 var text = "auto connect:i:1\r\nfull address:s:"+data.Reservations[0].Instances[0].PublicIpAddress+"\r\nusername:s:Administrator\r\n";  
		res.writeHead(200, {'Content-Type': 'application/force-download','Content-disposition':'attachment; filename=login.rdp'});
		res.end( text );
	}
	}); 
   
	})
	
	  router.get('/api/machinedetails/:id', function (req, res) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	res.setHeader('Content-Type', 'application/json');
	var params = {
			InstanceIds: [
				req.params.id 
			]
		};
	ec2.describeInstances(params, function(err, data) {
	if (err) res.json({error:err});
	else {
		res.json( data );
	}
	}); 
   
	})
	
	  router.get('/api/terminate/:instanceId', function (req, res) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	res.setHeader('Content-Type', 'application/json');
	res.send({message:"not allowed"});
	/*
	var params = {
			InstanceIds: [
				req.params.instanceId 
			]
		};
	ec2.terminateInstances(params, function(err, data) {
	if (err) res.json({error:err});
	else {
            res.header("Access-Control-Allow-Origin", "*");
			res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
			res.setHeader('Content-Type', 'application/json');
			res.send({message:"ok"});
	}
	}); 
    */
	})



	
	/********************user operations endpoints************************/


	//verified
  router.get('/verified', function(req, res) {
    res.render('verified');
  });


  server.use(router);
};
