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


module.exports = function(ChallengeSession) {

	ChallengeSession.observe('before save', function(ctx, next) {
	  console.log(ctx.instance);
	  
	  if(ctx.instance){
		  var ss= new Date().toISOString();
		  ctx.instance.testStartTime=ss;	
	  }
	   else if(ctx.data){
		   //console.log(JSON.stringify(ctx.data));
          console.log("update "+ctx.data.testStarted);
        
      }

	  next();
	});
	
	
	 ChallengeSession.getTestDetails = function(id, cb) {
			console.log("in get details");		 
	ChallengeSession.findById(id, function (err, instance) {				
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
	
	
	ChallengeSession.getInstancePublicIp = function(instanceId, cb) {
			console.log("in get public ip"+instanceId);	
               ChallengeSession.getMachinePublicIp(instanceId)
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

    

	
 
  
	
	//Docker container 
	

		ChallengeSession.updateScore = function(inviteId,score,cb){
		var app = ChallengeSession.app;
        var MachineDetails = app.models.MachineDetails; 
		console.log("infind"+inviteId);
		ChallengeSession.findOne({where:{testToken:inviteId}}, function (err, instance) {				
			var json=[];
			console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$"+instance);
			console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$"+score);
			if(instance){
                //update score	 
                   instance.score = score;		
				    ChallengeSession.upsert(instance,function(err,dataInstance){                                   
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
	
		ChallengeSession.updateScoreV2 = function(inviteId,score,cb){
		var app = ChallengeSession.app;
        var MachineDetails = app.models.MachineDetails; 
		console.log("updateScoreV2: inviteid="+inviteId);
		ChallengeSession.findOne({where:{testToken:inviteId}}, function (err, instance) {				
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
						
				    ChallengeSession.upsert(instance,function(err,dataInstance){                                   
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
	
	
	ChallengeSession.execShell = function(inviteId,score,cb){
		var app = ChallengeSession.app;
        var MachineDetails = app.models.MachineDetails; 
		console.log("infind"+inviteId);
		ChallengeSession.execCommand(inviteId,0).then(function(data){
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
  

	 

	 
	//APIS for ECS

	ChallengeSession.finishTest = function(candidateId, cb) {
	
  	    ChallengeSession.findOne({where:{id:candidateId}}, function (err, instance) {
		 
		   //console.log("in update"+JSON.stringify(instance));
		   console.log("in finish test api");
            instance.score = 0;
			instance.testAttempted = true;
			var ss= new Date().toISOString();
			instance.timeline.push({"event":"test completed","date":ss});	
			instance.AmiId = "NA";
			instance.status = 'completed';
	        //update database
			ChallengeSession.upsert(instance, function(err,dataInstance){
				console.log("score updated");
				cb(null,"ok");
				});		 
		 
		});
		
	 }
	 
	 
	 


      	 
	
	ChallengeSession.remoteMethod (
        'getTestDetails',
        {
          http: {path: '/gettestdetails', verb: 'get'},
          accepts: {arg: 'id', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        });
		


		

	 
	 	 	 ChallengeSession.remoteMethod (
        'updateScore',
        {
          http: {path: '/updatescore', verb: 'get'},
          accepts: [{arg: 'inviteId', type: 'string', http: { source: 'query' }},
		  {arg: 'score', type: 'string', http: { source: 'query' }}
		  ],
          returns:{"type": "json", root:true}
        }
	 );	
	 
	 	 	 	 ChallengeSession.remoteMethod (
        'updateScoreV2',
        {
          http: {path: '/updatescorev2', verb: 'get'},
          accepts: [{arg: 'inviteId', type: 'string', http: { source: 'query' }},
		  {arg: 'score', type: 'string', http: { source: 'query' }}
		  ],
          returns:{"type": "json", root:true}
        }
	 );	
		
		 	 	 ChallengeSession.remoteMethod (
        'execShell',
        {
          http: {path: '/execshell', verb: 'get'},
          accepts: [{arg: 'inviteId', type: 'string', http: { source: 'query' }},
		  {arg: 'score', type: 'string', http: { source: 'query' }}
		  ],
          returns:{"type": "json", root:true}
        }
	 );		
	 ChallengeSession.remoteMethod (
        'getInstancePublicIp',
        {
          http: {path: '/getmachinepublicip', verb: 'get'},
          accepts: {arg: 'instanceid', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        });
		



	ChallengeSession.remoteMethod (
        'shareVideoUrl',
        {
          http: {path: '/sharevideourl', verb: 'post'},
          accepts: [{arg: 'sharevideodata', type: 'object', http: { source: 'body' }}],
          returns:{"type": "json", root:true}
        }
	 );
		
	
	    ChallengeSession.remoteMethod (
        'leaderboard',
        {
          http: {path: '/leaderboard', verb: 'get'},
          accepts: {arg: 'date', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        });
	    ChallengeSession.remoteMethod (
        'updatestatus',
        {
          http: {path: '/updatestatus', verb: 'get'},
          accepts: [{arg: 'id', type: 'number', http: { source: 'query' }},
		            {arg: 'status', type: 'string', http: { source: 'query' }}
		         ],
          returns:{"type": "json", root:true}
        });
		ChallengeSession.remoteMethod (
        'evaluate',
        {
          http: {path: '/evaluate', verb: 'get'},
          accepts: [{arg: 'id', type: 'number', http: { source: 'query' }},
		            {arg: 'score', type: 'number', http: { source: 'query' }}
		         ],
          returns:{"type": "json", root:true}
        });

		
	
	
		ChallengeSession.remoteMethod (
        'listTasks',
        {
          http: {path: '/listtasks', verb: 'get'},
          accepts: [{arg: 'id', type: 'number', http: { source: 'query' }},
		         ],
          returns:{"type": "json", root:true}
        });	
		ChallengeSession.remoteMethod (
        'finishTest',
        {
          http: {path: '/finishtest', verb: 'get'},
          accepts: [{arg: 'id', type: 'number', http: { source: 'query' }}
		         ],
          returns:{"type": "json", root:true}
        });	
	

					ChallengeSession.remoteMethod (
        'getOutputUrl',
        {
          http: {path: '/getoutputurl', verb: 'get'},
          accepts: [{arg: 'containerpath', type: 'string', http: { source: 'query' }},
		         ],
          returns:{"type": "json", root:true}
        });
		
				ChallengeSession.remoteMethod (
        'copychallenge',
        {
          http: {path: '/copychallenge', verb: 'get'},
          accepts: [{arg: 'containerpath', type: 'string', http: { source: 'query' }},
		         ],
          returns:{"type": "json", root:true}
        });
		
						ChallengeSession.remoteMethod (
        'githubtest',
        {
          http: {path: '/githubtest', verb: 'get'},
          accepts: [{arg: 'containerpath', type: 'string', http: { source: 'query' }},
		         ],
          returns:{"type": "json", root:true}
        });
		
		
};
