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
    
    var params = { 
        Filters: [
        {
            Name:"tag:Deployment",
            Values: [
                "backend-alfresco-staging"
            ]
        }],
        DryRun: true
    };
    
    if (event.command === "START") {
      // Call EC2 to start the selected instances
      ec2.startInstances(params, function(err, data) {
        console.log("Starting", data);
        if (err && err.code === 'DryRunOperation') {
          params.DryRun = false;
          ec2.startInstances(params, function(err, data) {
              if (err) {
                context.fail(err);
                console.log("Error", err);
              } else if (data) {
                context.succeed("Success");
                console.log("Success", data.StartingInstances);
              }
          });
        } else {
          console.log("You don't have permission to start instances.");
        }
      });
    } else if (event.command === "STOP") {
      // Call EC2 to stop the selected instances
      ec2.stopInstances(params, function(err, data) {
        if (err && err.code === 'DryRunOperation') {
          params.DryRun = false;
          ec2.stopInstances(params, function(err, data) {
              if (err) {
                context.fail(err);
                console.log("Error", err);
              } else if (data) {
                context.succeed("Success");
                console.log("Success", data.StoppingInstances);
              }
          });
        } else {
          context.fail(err);
          console.log("You don't have permission to stop instances");
        }
      });
    }
  };