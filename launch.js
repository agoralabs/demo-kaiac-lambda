
exports.handler = function(event, context) {
  
    // Load the AWS SDK for Node.js
    var AWS = require('aws-sdk');
    // Set the region 
    AWS.config.update({region: 'eu-west-3'});
    
    // Create EC2 service object
    var ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
    
    //var params = {
      //InstanceIds: ["i-06b6843ab6c4ac9bf"],
      //DryRun: true
    //};
    
    var describeParams = { 
        Filters: [
        {
            Name:"tag:Deployment",
            Values: [
                "backend-alfresco-staging"
            ]
        }]
    };
    
    var result = {
        Status: "undefined",
        Message: null
    };

    var body = JSON.parse(event['body']);
    var command = body.command;

    var instances = [];
    ec2.describeInstances(describeParams, function(err, data) {
        if (err) {
            console.log(err, err.stack);
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
            if (instances.length > 0){
                var params = { InstanceIds: instances, DryRun: true };

                if (command === "START") {
                    // Call EC2 to start the selected instances
                    ec2.startInstances(params, function(err, data) {
                      console.log("Starting", data);
                      if (err && err.code === 'DryRunOperation') {
                        params.DryRun = false;
                        ec2.startInstances(params, function(err, data) {
                            if (err) {
                              context.fail(err);
                              console.log("Error", err);
                              result.Status = "Error";
                              result.Message = err;
                            } else if (data) {
                              context.succeed("Success");
                              console.log("Success", data.StartingInstances);
                              result.Status = "Success";
                              result.Message = data.StartingInstances;
                            }
                        });
                      } else {
                        console.log("You don't have permission to start instances.");
                        result.Status = "Error";
                        result.Message = "You don't have permission to start instances.";
                      }
                    });
                  } else if (command === "STOP") {
                    // Call EC2 to stop the selected instances
                    ec2.stopInstances(params, function(err, data) {
                      if (err && err.code === 'DryRunOperation') {
                        params.DryRun = false;
                        ec2.stopInstances(params, function(err, data) {
                            if (err) {
                              context.fail(err);
                              console.log("Error", err);
                              result.Status = "Error";
                              result.Message = err;
                            } else if (data) {
                              context.succeed("Success");
                              console.log("Success", data.StoppingInstances);
                              result.Status = "Success";
                              result.Message = data.StoppingInstances;
                            }
                        });
                      } else {
                        context.fail(err);
                        console.log("You don't have permission to stop instances");
                        result.Status = "Error";
                        result.Message = "You don't have permission to stop instances.";
                      }
                    });
                  }

            }
       }
    });

    return result;
  };