
exports.handler = async(event) => {
  
    // Load the AWS SDK for Node.js
    var AWS = require('aws-sdk');
    // Set the region 
    AWS.config.update({region: 'eu-west-3'});
    
    // Create EC2 service object
    var ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
    
    var describeParams = { 
        Filters: [
        {
            Name:"tag:Deployment",
            Values: [
                "backend-alfresco-staging"
            ]
        }]
    };
    
    var body = JSON.parse(event['body']);
    var command = body.command;
    //var command = "STOP";

    const response = {
        statusCode: 200,
        body: JSON.stringify({ "message": "Hello from Lambda!", "command": command })
    };

    var instances = [];
    var errors = [];
    const waitInstanceIds = await ec2.describeInstances(describeParams, function(err, data) {
      
        if (err) {
            console.log(err, err.stack);
            errors.push(err.stack);
        } else {
            console.log(data);
            for (var i = 0; i < data.Reservations.length; i++) {
                for (var j = 0; j < data.Reservations[i].Instances.length; j++) {
                    var instanceId = data.Reservations[i].Instances[j].InstanceId;
                    if (instanceId != undefined && instanceId != null && instanceId != "") {
                        instances.push(instanceId);
                        
                    }
                }
            }
       }
    }).promise();
    
    if(errors.length > 0){
      response.body = errors[0];
    }else{
      if(instances.length > 0){
        response.body = instances.join();
      }else{
        response.body = "no instance";
      }
    }
    
    var params = { InstanceIds: instances, DryRun: true };
    response.body = JSON.stringify(params);
    
    if (command.toUpperCase() === "START") {
      // Call EC2 to start the selected instances
      ec2.startInstances(params, function(err, data) {
        if (err && err.code === 'DryRunOperation') {
          params.DryRun = false;
          ec2.startInstances(params, function(err, data) {
              if (err) {
                console.log("Error", err);
              } else if (data) {
                console.log("Success", JSON.stringify(data));
              }
          });
        } else {
          console.log("You don't have permission to start instances.");
        }
      });
    } else if (command.toUpperCase() === "STOP") {
      // Call EC2 to stop the selected instances
      ec2.stopInstances(params, function(err, data) {
        if (err && err.code === 'DryRunOperation') {
          params.DryRun = false;
          ec2.stopInstances(params, function(err, data) {
              if (err) {
                console.log("Error", err);
              } else if (data) {
                console.log("Success", data.StoppingInstances);
              }
          });
        } else {
          console.log("You don't have permission to stop instances");
        }
      });
    }
    
    return response;
  };