'use strict';
var AWS = require('aws-sdk');
var pathv = 'server/aws-config.json';
var app = require('../../server/server');
//var settle = require('promise-settle');
var Promise = require("bluebird");
var fs = require('fs');
var OnlineTest = app.models.OnlineTest;

//AWS.config.loadFromPath(pathv);
AWS.config.update({region: 'us-east-1'});
var ec2 = new AWS.EC2();
var evalcodesDir = "/home/ubuntu/rdplabs_app/selenium_tests/";
module.exports = function(Environment) {

         Environment.observe('before save', function(ctx, next) {
      console.log("add ami id = baseimage id");
      if(ctx.instance){
          ctx.instance.amiid = ctx.instance.base_imageid;
      }

      next();
    });     
	
	    Environment.observe('after save', function(ctx, next) {
			
			console.log('supports isNewInstance?', ctx.isNewInstance !== undefined);
			console.log("is new???"+ctx.isNewInstance);
      //Move stopped instance from base image buffer to this environment buffer
	  //basically change the tag value
	  console.log(ctx.instance);
	  console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@");
	  //moveToTestBuffer(amiId,testId)
	  //create new stopped intance for base_image to fill the base image buffer
	  //CreateStoppedMachine(amiid)
	  //done.
	  
	  console.log("after save"+ctx.instance.id);
	  var dir = evalcodesDir + ctx.instance.id;
	  !fs.existsSync(dir) && fs.mkdirSync(dir);
	 
	  
	  fs.writeFile(evalcodesDir + ctx.instance.id +'/WebTest.java', ctx.instance.evalcode, 'utf8', function (err) {
    			if (err) { console.log(err);} 
				 console.log("file done");      
				 next();
 					 });
      
	     

      
    });   
     Environment.getAllEnvironemntsv2123 = function(userId, cb) {   
     Environment.find({where:{uid:userId}}, function (err, instance) {                
     var json=[];
    if(instance.length>0){            
        for(var i in instance){
            json.push({amiid:instance[i].amiid,
                        creationdate:'',
                        name:instance[i].name,
                        description:instance[i].description
                    });
        }
    }            
                
    var params = {Filters: [{Name: 'tag-key',Values: ['category']},{Name: 'tag-value',Values: ['rdpami']}],Owners: ['self']};
    ec2.describeImages(params, function(err, data) {
        if (err) cb(null,{error:err}); // an error occurred
        else  {
            for(var i in data.Images){
                json.push({amiid:data.Images[i].ImageId,
                           creationdate:data.Images[i].CreationDate,
                           name:data.Images[i].Name,
                           description:data.Images[i].Description
                });
            }
            cb(null, json);
        }           // successful response
    });
     
  });
   
 }
 
      Environment.getAllEnvironemnts = function(userId, cb) {            
    var json = [];        
    console.log("here")    
    var params = {Filters: [{Name: 'tag-key',Values: ['category']},{Name: 'tag-value',Values: ['rdpami']}],Owners: ['self']};
    ec2.describeImages(params, function(err, data) {
        if (err) cb(null,{error:err}); // an error occurred
        else  {
            for(var i in data.Images){
                json.push({amiid:data.Images[i].ImageId,
                           creationdate:data.Images[i].CreationDate,
                           name:data.Images[i].Name,
                           description:data.Images[i].Description
                });
            }
            cb(null, json);
        }           // successful response
    });
     
 
   
 }
 
  Environment.terminateAMIinstances = function(baseImageId, cb) {   
  
    Environment.find({where:{commited:true}}, function (err, instance) {                
    var json=[];
    var promises = [];
    //console.log(instance);
    for(var i in instance){
         (function (instance) {
    var p = Environment.getAmiStatus(instance)
        .bind(instance)
        .then(function(data){
            //console.log("After:", data, this.toString(), instance);
			if(instance.instanceid.length>0){
				//console.log("terminate"+instance.instanceid+" of ami="+instance.amiid);
				var s = Environment.terminateInstance(instance).then(function(data){
					console.log("terminated"+data);
					instance.instanceid="";
					//update db
					instance.state = data;
					json.push(instance);
					Environment.upsert(instance, function(err,dataInstance){                                   
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
  
 Environment.getAmiStatus = function(envObj){
              var params = {ImageIds: [envObj.amiid]};
    		return  new Promise(function(resolve, reject) {
    ec2.describeImages(params, function(err, data) {

           // console.log(data);
		    if(err) reject("err");
			else
			resolve("##"+data.Images[0].State);
              // successful response
    });
   
   
 });

 } 
 Environment.terminateInstance = function(envObj){
                 console.log("in terminate"+envObj.instanceid);
              var params = {InstanceIds: [envObj.instanceid]};
    		return  new Promise(function(resolve, reject) {
    ec2.terminateInstances(params, function(err, data) {
             
            console.log(JSON.stringify(data));
		    if(err) return reject("err in terminate");
			else
			return resolve(">terminated="+envObj.instanceid);
              // successful response
    });
   
   
 });

 }  
 
 Environment.getBaseAmiDetails = function(baseImageId, cb) {   
    Environment.findOne({where:{amiid:baseImageId}}, function (err, instance) {                
    var json=[];
    console.log(instance);
    if(false){            
        cb(null, {amiid:instance.amiid,creationdate:'',name:instance.name,description:instance.description});            
    }            
    else{        
        var params = {ImageIds: [baseImageId]};
        ec2.describeImages(params, function(err, data) {
            if (err) cb(null,{error:err}); // an error occurred
            else {
                cb(null, {amiid:data.Images[0].ImageId,creationdate:data.Images[0].CreationDate,name:data.Images[0].Name,description:data.Images[0].Description});
            }           // successful response
        });
    }
     
  });
   
 }
 
  Environment.cloneEnvironments = function(newUserId, cb) {
	
           var app = Environment.app;
        var OnlineTest = app.models.OnlineTest; 
        //OnlineTest.cloneTest(286,newUserId,true,cb); 		
			    OnlineTest.cloneTest2(979,newUserId,true); 
		OnlineTest.cloneTest2(973,newUserId,true);
        OnlineTest.cloneTest2(974,newUserId,true); 	
        OnlineTest.cloneTest2(976,newUserId,true); 
	
        setTimeout(function(){
			console.log("after timeout");
			cb(null,"ok");
		},5000);		
	  
    /*
    Environment.find({where:{uid:1}}, function (err, instance) {                
	console.log("in clone environment");
    console.log(instance);
    
    if(instance.length>0){
                var env = Object;
				var clonedEnvId = 0;
				var oldEnvId = 0;		
        for(var i in instance){            
                env=instance[i];
                delete env.id;
                env.uid=newUserId;
				oldEnvId = env.id;
                env.id = undefined;
                console.log("after removing env id"+env.id);
           Environment.create(env,function(err,dataInstance){
                console.log('inserted'+JSON.stringify(dataInstance));
				clonedEnvId = dataInstance.id;
				console.log("colend env id = "+clonedEnvId+" now clonetest");
				Environment.cloneTest(clonedEnvId,oldEnvId,newUserId);
                if(err){
                    console.log(err);
                }
            });
                
        }
        //now clone test:
        console.log("done");
		
		cb(null,"ok");

    }     
     
  });
  
  comment old flow */
   
 }
 
 Environment.cloneTest = function(newEnvId,oldEnvId,newUserId) {
	 console.log("now clone the test");
        var app = Environment.app;
        var OnlineTest = app.models.OnlineTest; 
        OnlineTest.find({where:{uid:1,envId:oldEnvId}}, function (err, instance) {
        if(instance.length>0){
                var test = Object;    
        for(var i in instance){            
                test=instance[i];
                delete test.id;
                test.uid=newUserId;
                test.id = undefined;
				test.envId = newEnvId;
                console.log("######after removing test id"+test.id+"&cloned env"+newEnvId);
            OnlineTest.create(test,function(err,dataInstance){
                console.log('####inserted'+JSON.stringify(dataInstance));
                if(err){
                    console.log(err);
                }
            });
                
        }
        }
       
        
        
        }) 
	 
 }  
  
  Environment.createAmi = function(id, cb) {   
    Environment.findOne({where:{id:id}}, function (err, instance) {                
    var json=[];
    console.log(instance);
    if(instance){        
        console.log("intial instance");
        console.log(JSON.stringify(instance));
        var oldAmiId = instance.amiid;
        var params = { 
            InstanceId: instance.instanceid, /* required */
            Name: 'amiOf_'+instance.instanceid, /* required */
            Description: instance.description
        };
        ec2.createImage(params, function(err, data) {
            if (err) {console.log("create image error");cb(null,{error:err});} // an error occurred
            else{console.log(data.ImageId);          // successful response
                var imageId=data.ImageId;
                var tagParams={
                Resources: [], 
                Tags: [{ Key: "category", Value: "envami"},{ Key: "Name", Value: instance.name},{ Key: "pwd", Value: instance.pwd}]};
                tagParams.Resources.push(data.ImageId);
                ec2.createTags(tagParams, function(err, data) {
                    if (err) {console.log(err, err.stack); console.log("create tags error");}// an error occurred
                    else {console.log(data);
                        console.log("create ami done");
                        //instance.instanceid = "";
                        instance.amiid = imageId;
                        instance.commited = true;
                
                        //update database
                        Environment.upsert(instance, function(err,dataInstance){
                            console.log("instance updated in db");console.log("oldAmiId="+oldAmiId+"|baseamiid="+instance.base_imageid+"|amiid="+instance.amiid);                                
                            if(oldAmiId.trim().length>0 && (oldAmiId != instance.base_imageid)){
                                console.log("deregister previous ami");
                                ec2.deregisterImage({ImageId: oldAmiId}, function(err, data) {
                                    if (err) {console.log("deregister image err");cb(null,{error:err});} // an error occurred
                                    else {
                                        console.log("deregistered ami also");
                                        cb(null,dataInstance);
                                    }
                                });            
                            }
                            else{
                                console.log("initial ami or base and current ami are same so no need to deregister");
                                cb(null,dataInstance);
                            }

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
   
 }

  Environment.remoteMethod (
        'getAllEnvironemnts',
        {
          http: {path: '/getallenvs', verb: 'get'},
          accepts: {arg: 'id', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        }
    );
    
     Environment.remoteMethod (
        'getBaseAmiDetails',
        {
          http: {path: '/getbaseamidetails', verb: 'get'},
          accepts: {arg: 'id', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        }
    );
    
         Environment.remoteMethod (
        'cloneEnvironments',
        {
          http: {path: '/cloneenvs', verb: 'get'},
          accepts: {arg: 'id', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        }
    );
    
             Environment.remoteMethod (
        'createAmi',
        {
          http: {path: '/createami', verb: 'get'},
          accepts: {arg: 'id', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        }
    );
    
                 Environment.remoteMethod (
        'terminateAMIinstances',
        {
          http: {path: '/terminateamiinstances', verb: 'get'},
          accepts: {arg: 'id', type: 'string', http: { source: 'query' } },
          returns:{"type": "json", root:true}
        }
    );

    Environment.sendEmail = function(cb) {
      Environment.app.models.Email.send({
        to: 'vilash@programmr.com',
        from: 'vilashinparadise@gmail.com',
        subject: 'my subject',
        text: 'my text',
        html: 'my <em>html</em>'
      }, function(err, mail) {
        console.log('email sent!');
        cb(err);
      });
    }
    

};