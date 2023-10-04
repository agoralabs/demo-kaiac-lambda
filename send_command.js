// Load the AWS SDK for Node.js
const AWS = require('aws-sdk');

// Set the region 
AWS.config.update({region: 'eu-west-3'});

// Create EC2 service object
const ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
const SSM = new AWS.SSM();


async function getInstanceId() {
    var describeParams = { 
        Filters: [
            {
                Name:"tag:Deployment",
                Values: [
                    "backend-alfresco-staging"
                ]
            },
            {
                Name:"instance-state-name",
                Values: [
                    "running","pending","stopped"
                ]
            }
        ]
    };

    try {
        const data = await ec2.describeInstances(describeParams).promise();
        
        var instances = [];

        for (var i = 0; i < data.Reservations.length; i++) {
            for (var j = 0; j < data.Reservations[i].Instances.length; j++) {
                var instanceId = data.Reservations[i].Instances[j].InstanceId;
                if (instanceId != undefined && instanceId != null && instanceId != "") {
                    instances.push(instanceId);
                }
            }
        }

        return instances;
    } catch (err) {
        console.error('Erreur lors de la description des instances:', err);
        throw err; // Propagez l'erreur vers le code appelant si nécessaire
    }
}

async function stopInstance(instances) {

    var params = { InstanceIds: instances};
    await ec2.stopInstances(params).promise();
    console.log(`Instance EC2 ${instances} arrêtée avec succès.`);

}

async function startInstances(instances) {

  var params = { InstanceIds: instances};
  await ec2.startInstances(params).promise();
  console.log(`Instance EC2 ${instances} démarrée avec succès.`);

}


async function startAutomationExecution(instanceId, ssmDocument) {

  const params = {
    DocumentName: ssmDocument, // Le nom du document d'automatisation
    Parameters: {
      InstanceId: [instanceId]
    }
  };
  
    try {
      const data = await SSM.startAutomationExecution(params).promise();
      
      var executionId = data.AutomationExecutionId;

      return executionId;
  } catch (err) {
      console.error('Erreur lors du démarrage de l\'exécution d\'automatisation:', err);
      throw err; // Propagez l'erreur vers le code appelant si nécessaire
  }

}

async function getAutomationExecutionStatus(executionId){
    const params = {
      AutomationExecutionId: executionId, // L'ID de l'exécution d'automatisation à récupérer
    };
    
    var status = "";

    await SSM.getAutomationExecution(params, (err, data) => {
      if (err) {
        console.error('Erreur lors de la récupération de l\'exécution d\'automatisation:', err);
      } else {
        console.log('Statut de l\'exécution d\'automatisation:', data.AutomationExecution.AutomationExecutionStatus);
        status = data.AutomationExecution.AutomationExecutionStatus;
      }
    }).promise();

    return status;
}

async function sendKaiacCommand(instances, commandName){
  const params = {
    InstanceIds: instances,
    DocumentName: 'Kaiac_Command',
    Parameters: {
      Command: [commandName],
    },
  };

  var commandId = "";

  await SSM.sendCommand(params, (err, data) => {
    if (err) {
      console.error('Erreur lors de l\'envoi de la commande:', err);
    } else {
      console.log('Commande envoyée avec succès. Command ID:', data.Command.CommandId);
      commandId = data.Command.CommandId;
    }
  }).promise();

  return commandId;
}

async function getCommandInvocationStatus(commandId, instanceId){
  const params = {
    CommandId: commandId,
    InstanceId: instanceId
  };

  var status = "";

  await SSM.getCommandInvocation(params, (err, data) => {
    if (err) {
      console.error('Erreur lors de la recupération du statut:', err);
    } else {
      console.log('Statut récupéré avec succès:', data.Status);
      status = data.Status;
    }
  }).promise();

  return status;
}


exports.handler = async(event) => {
  

    var body = JSON.parse(event['body']);
    var command = body.command;

    if (command == "GET_INSTANCE_ID") {
      try {
          
          const instances = await getInstanceId();

          if(instances.length == 0){

            return {
                statusCode: 404,
                body: JSON.stringify({message: "No ec2 instance found"})
            };
          }

          var instanceId = instances[0];
          return {
            statusCode: 200,
            body: JSON.stringify({command: command, instanceId: instanceId, message: "Instance EC2 trouvée"})
          };

      } catch (error) {
          console.error(`Erreur lors de l'arrêt de l'instance EC2 : ${error}`);
          
          return {
              statusCode: 500,
              body: JSON.stringify({message: "Erreur lors de l\'arrêt de l\'instance EC2."})
          };
          
      }
    }

    if (command == "STOP_EC2") {
      try {
          
          var instanceId = body.instanceId;
          var instances = [instanceId];
          stopInstance(instances);

          return {
            statusCode: 200,
            body: JSON.stringify({message: "Instance EC2 arrêtée avec succès."})
          };

      } catch (error) {
          console.error(`Erreur lors de l'arrêt de l'instance EC2 : ${error}`);
          
          return {
              statusCode: 500,
              body: JSON.stringify({message: "Erreur lors de l\'arrêt de l\'instance EC2."})
          };
          
      }
    }

    if (command == "START_SSM_AUTOMATION") {
      try {
        
          var instanceId = body.instanceId;
          var ssmDocument = body.ssmDocument;

          const executionId = await startAutomationExecution(instanceId, ssmDocument);

          return {
            statusCode: 200,
            body: JSON.stringify({executionId: executionId, message: "Automation exécutée avec succès."})
          };

      } catch (error) {
          console.error(`Erreur lors de l\'execution de l\'automation : ${error}`);
          
          return {
              statusCode: 500,
              body: JSON.stringify({message: `Erreur lors de l\'execution de l\'automation : ${error}`})
          };
          
      }
    }


    if (command == "STATUS_SSM_AUTOMATION") {
      try {
        
          var executionId = body.executionId;

          var status = getAutomationExecutionStatus(executionId);

          return {
            statusCode: 200,
            body: JSON.stringify({executionId: executionId, message: "Automation exécutée avec succès."})
          };

      } catch (error) {
          console.error(`Erreur lors de l\'execution de l\'automation : ${error}`);
          
          return {
              statusCode: 500,
              body: JSON.stringify({message: "Erreur lors de l\'execution de l\'automation."})
          };
          
      }
    }
  
    if (command == "START_EC2") {
      try {
        
          var instanceId = body.instanceId;
          var instances = [instanceId];
          startInstances(instances);
          
          return {
            statusCode: 200,
            body: JSON.stringify({message: "Instance EC2 démarrée avec succès."})
          };

      } catch (error) {
          console.error(`Erreur lors du démarrage de l'instance EC2 : ${error}`);

          return {
              statusCode: 500,
              body: JSON.stringify({message: "Erreur lors du démarrage de l\'instance EC2."})
          };
          
      }
    }

    if (command == "KAIAC_COMMAND") {
      try {
        
          var instanceId = body.instanceId;
          var instances = [instanceId];
          var kaiacCommand = body.kaiacCommand;

          var commandId = sendKaiacCommand(instances, kaiacCommand);
          
          return {
            statusCode: 200,
            body: JSON.stringify({commandId: commandId, message: "Commande lancée avec succès."})
          };

      } catch (error) {
          console.error(`Erreur lors du lancement de la commande : ${error}`);

          return {
              statusCode: 500,
              body: JSON.stringify({message: "Erreur lors du lancement de la commande."})
          };
          
      }
    }

    if (command == "STATUS_KAIAC_COMMAND") {
      try {

          var instanceId = body.instanceId;
          var commandId = body.commandId;
          var status = getCommandInvocationStatus(commandId, instanceId);
          return {
            statusCode: 200,
            body: JSON.stringify({status: status, message: "Statut de la commande avec succès."})
          };

      } catch (error) {
          console.error(`Erreur lors de la récupération du statut de la commande : ${error}`);

          return {
              statusCode: 500,
              body: JSON.stringify({message: "Erreur lors de la récupération du statut de la commande."})
          };
          
      }
    }

    var response = {
        message: "Invalid command",
        context: command
    };
    
    return {
        statusCode: 500,
        body: JSON.stringify(response),
    };

  };