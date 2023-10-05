// Load the AWS SDK for Node.js
const AWS = require('aws-sdk');

async function getInstanceId(filters) {
    var describeParams = { 
        Filters: filters
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
    
    try {
      const data = await SSM.getAutomationExecution(params).promise();
      
      var status = data.AutomationExecution.AutomationExecutionStatus;

      return status;
    } catch (err) {
        console.error('Erreur lors de la récupération du statut d\'automatisation:', err);
        throw err; // Propagez l'erreur vers le code appelant si nécessaire
    }

}

async function sendKaiacCommand(instances, commandName){
  const params = {
    InstanceIds: instances,
    DocumentName: 'Kaiac_Command',
    Parameters: {
      Command: [commandName],
    },
  };

  try {
    const data = await SSM.sendCommand(params).promise();
    
    var commandId = data.Command.CommandId;

    return commandId;
  } catch (err) {
      console.error('Erreur lors de l\'envoi de la commande:', err);
      throw err; // Propagez l'erreur vers le code appelant si nécessaire
  }

}

async function getCommandInvocationStatus(commandId, instanceId){
  const params = {
    CommandId: commandId,
    InstanceId: instanceId
  };

  try {
    const data = await SSM.getCommandInvocation(params).promise();
    
    var status = data.Status;

    return status;
  } catch (err) {
      console.error('Erreur lors de la recupération du statut:', err);
      throw err; // Propagez l'erreur vers le code appelant si nécessaire
  }

}


exports.handler = async(event) => {
  
    var body = JSON.parse(event['body']);
    var command = body.command;
    var awsRegion = body.awsRegion;
    // Set the region 
    AWS.config.update({region: awsRegion});

    // Create EC2 service object
    const ec2 = new AWS.EC2({apiVersion: '2016-11-15'});

    // Create SSM service object
    const SSM = new AWS.SSM();

    if (command == "GET_INSTANCE_ID") {
      try {
          
          var tagName = body.tagName;
          var tagPrefixValue = body.tagPrefixValue;

          var filters = [
            {
                Name: tagName,
                Values: [
                  tagPrefixValue
                ]
            },
            {
                Name:"instance-state-name",
                Values: [
                    "running","pending","stopped"
                ]
            }
          ]
          const instances = await getInstanceId(filters);

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



    if (command == "START_SSM_AUTOMATION") {
      try {
        
          var instanceId = body.instanceId;
          var ssmDocument = body.ssmDocument;

          const executionId = await startAutomationExecution(instanceId, ssmDocument);

          return {
            statusCode: 200,
            body: JSON.stringify({command: command, executionId: executionId, message: "Automation exécutée avec succès."})
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

          const status = await getAutomationExecutionStatus(executionId);

          return {
            statusCode: 200,
            body: JSON.stringify({command: command, executionStatus: status, message: "Statut récupéré avec succès."})
          };

      } catch (error) {
          console.error(`Erreur lors de la récupération du statut de l\'automation : ${error}`);
          
          return {
              statusCode: 500,
              body: JSON.stringify({message: `Erreur lors de la récupération du statut de l\'automation : ${error}`})
          };
      }
    }
  


    if (command == "SEND_KAIAC_COMMAND") {
      try {
        
          var instanceId = body.instanceId;
          var instances = [instanceId];
          var kaiacCommand = body.kaiacCommand;

          const commandId = await sendKaiacCommand(instances, kaiacCommand);
          
          return {
            statusCode: 200,
            body: JSON.stringify({commandId: commandId, message: "Commande lancée avec succès."})
          };

      } catch (error) {
          console.error(`Erreur lors du lancement de la commande : ${error}`);

          return {
              statusCode: 500,
              body: JSON.stringify({message: `Erreur lors du lancement de la commande : ${error}`})
          };
          
      }
    }

    if (command == "STATUS_KAIAC_COMMAND") {
      try {

          var instanceId = body.instanceId;
          var commandId = body.commandId;

          const status = await getCommandInvocationStatus(commandId, instanceId);

          return {
            statusCode: 200,
            body: JSON.stringify({commandStatus: status, message: "Statut de la commande avec succès."})
          };

      } catch (error) {
          console.error(`Erreur lors de la récupération du statut de la commande : ${error}`);

          return {
              statusCode: 500,
              body: JSON.stringify({message: `Erreur lors de la récupération du statut de la commande : ${error}`})
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

    var response = {
        command: command,
        message: "Invalid command"
    };
    
    return {
        statusCode: 500,
        body: JSON.stringify(response),
    };

  };