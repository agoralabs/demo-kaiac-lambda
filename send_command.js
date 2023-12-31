// Load the AWS SDK for Node.js
const AWS = require('aws-sdk');

async function getInstancesTagNsValue(EC2, filters) {
  var describeParams = { 
      Filters: filters
  };

  try {
      const data = await EC2.describeInstances(describeParams).promise();
    
      const namespaces = data.Reservations.flatMap(reservation =>
        reservation.Instances.map(instance =>
          (instance.Tags.find(tag => tag.Key === 'Application') || {}).Value
        )
      ).filter(Boolean);

      return namespaces;
  } catch (err) {
      console.error('Erreur lors de la description des instances:', err);
      throw err; // Propagez l'erreur vers le code appelant si nécessaire
  }
}

async function getInstanceId(EC2, filters) {
  var describeParams = { 
      Filters: filters
  };

  try {
      const data = await EC2.describeInstances(describeParams).promise();
      
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

async function getInstancePublicIP(EC2, filters) {
    var describeParams = { 
        Filters: filters
    };

    try {
        const data = await EC2.describeInstances(describeParams).promise();
        
      // Extrayez l'IP publique'
      const publicIP = data.Reservations[0].Instances[0].PublicIpAddress;

        return publicIP;
    } catch (err) {
        console.error('Erreur lors de la description des instances:', err);
        throw err; // Propagez l'erreur vers le code appelant si nécessaire
    }
}

async function changeResourceRecordSets(ROUTE53, hostedZoneId, dnsName, dnsValue){
  const changeParams = {
    HostedZoneId: hostedZoneId,
    ChangeBatch: {
      Changes: [
        {
          Action: 'UPSERT',
          ResourceRecordSet: {
            Name: dnsName,
            Type: 'A',
            TTL: 300,
            ResourceRecords: [{ Value: dnsValue }]
          }
        }
      ]
    }
  };

  try {
    await ROUTE53.changeResourceRecordSets(changeParams).promise();
    console.log('Le record DNS de type A a été mis à jour avec l\'adresse IP :', dnsValue);
    return 'Succès';
  } catch (err) {
    console.error('Erreur lors de la mise à jour du record DNS :', err);
    return err;
  }

}

async function getInstanceStatus(EC2, filters) {
  var describeParams = { 
      Filters: filters
  };

  try {
      const data = await EC2.describeInstances(describeParams).promise();
      
      // Extrayez le statut de l'instance
      const instanceStatus = data.Reservations[0].Instances[0].State.Name;

      return instanceStatus;
  } catch (err) {
      console.error('Erreur lors de la description des instances:', err);
      throw err; // Propagez l'erreur vers le code appelant si nécessaire
  }
}

async function stopInstance(EC2, instances) {

    var params = { InstanceIds: instances};
    await EC2.stopInstances(params).promise();
    console.log(`Instance EC2 ${instances} arrêtée avec succès.`);

}

async function startInstances(EC2, instances) {

  var params = { InstanceIds: instances};
  await EC2.startInstances(params).promise();
  console.log(`Instance EC2 ${instances} démarrée avec succès.`);

}


async function startAutomationExecution(SSM, instanceId, ssmDocument) {

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

async function getAutomationExecutionStatus(SSM, executionId){
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

async function sendKaiacCommand(SSM, instances, commands, documentName){
  const params = {
    InstanceIds: instances,
    DocumentName: documentName,
    Parameters: {
      commands: [commands],
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

async function getCommandInvocationStatus(SSM, commandId, instanceId){
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
    const EC2 = new AWS.EC2({apiVersion: '2016-11-15'});

    // Create SSM service object
    const SSM = new AWS.SSM();

    // Create ROUTE53 service object
    const ROUTE53 = new AWS.Route53();

    
    if (command == "UPDATE_DNS_RECORD") {
      try {
        
          var dnsName = body.dnsName;
          var dnsValue = body.dnsValue;
          var hostedZoneId = body.hostedZoneId;

          const commandStatus = await changeResourceRecordSets(ROUTE53, hostedZoneId, dnsName, dnsValue);
          
          return {
            statusCode: 200,
            body: JSON.stringify({command: command, commandStatus: commandStatus, message: "Commande lancée avec succès."})
          };

      } catch (error) {
          console.error(`Erreur lors du lancement de la commande : ${error}`);

          return {
              statusCode: 500,
              body: JSON.stringify({message: `Erreur lors du lancement de la commande : ${error}`})
          };
          
      }
    }

    if (command == "GET_INSTANCE_PUBLIC_IP") {
      try {
          
          var tagName = body.tagName;
          var tagPrefixValue = body.tagPrefixValue;

          var filters = [
            {
                Name: `tag:${tagName}`,
                Values: [
                  tagPrefixValue
                ]
            },
            {
                Name:"instance-state-name",
                Values: [
                    "running"
                ]
            }
          ]

          const publicIP = await getInstancePublicIP(EC2, filters);

          return {
            statusCode: 200,
            body: JSON.stringify({command: command, instancePublicIP: publicIP, message: "IP publique trouvée"})
          };

      } catch (error) {
          console.error(`Erreur lors de la récupération de l\'IP publique trouvée : ${error}`);
          
          return {
              statusCode: 500,
              body: JSON.stringify({message: `Erreur lors de la récupération de l\'IP publique trouvée : ${error}`})
          };
          
      }
    }

    if (command == "GET_INSTANCES_NAMES") {
      try {
          
          var applicationNamespace = body.applicationNamespace;

          var filters = [
            {
                Name: `tag:Namespace`,
                Values: [
                  applicationNamespace
                ]
            },
            {
                Name:"instance-state-name",
                Values: [
                    "running","pending","stopped"
                ]
            }
          ]
          const applicationNames = await getInstancesTagNsValue(EC2, filters);

          if(applicationNames.length == 0){

            return {
                statusCode: 404,
                body: JSON.stringify({message: "No ec2 instance found"})
            };
          }

          return {
            statusCode: 200,
            body: JSON.stringify({applicationNames: applicationNames, message: "Instances EC2 trouvées"})
          };

      } catch (error) {
          console.error(`Erreur lors de la récupération du tag l\'instance EC2 : ${error}`);
          
          return {
              statusCode: 500,
              body: JSON.stringify({message: `Erreur lors de la récupération du tag l\'instance EC2 : ${error}`})
          };
          
      }
    }

    if (command == "GET_INSTANCE_ID") {
      try {
          
          var tagName = body.tagName;
          var tagPrefixValue = body.tagPrefixValue;

          var filters = [
            {
                Name: `tag:${tagName}`,
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
          const instances = await getInstanceId(EC2, filters);

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
          console.error(`Erreur lors de la récupération de l\'id l\'instance EC2 : ${error}`);
          
          return {
              statusCode: 500,
              body: JSON.stringify({message: `Erreur lors de la récupération de l\'id l\'instance EC2 : ${error}`})
          };
          
      }
    }

    if (command == "GET_INSTANCE_STATUS") {
      try {
          
          var tagName = body.tagName;
          var tagPrefixValue = body.tagPrefixValue;

          var filters = [
            {
                Name: `tag:${tagName}`,
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
          const instanceStatus = await getInstanceStatus(EC2, filters);

          return {
            statusCode: 200,
            body: JSON.stringify({command: command, instanceStatus: instanceStatus, message: "Statut de l'instance récupéré avec succès"})
          };

      } catch (error) {
          console.error(`Erreur lors de la récupération du statut de l\'instance : ${error}`);
          
          return {
              statusCode: 500,
              body: JSON.stringify({message: `Erreur lors de la récupération du statut de l\'instance : ${error}`})
          };
          
      }
    }

    if (command == "START_SSM_AUTOMATION") {
      try {
        
          var instanceId = body.instanceId;
          var ssmDocument = body.ssmDocument;

          const executionId = await startAutomationExecution(SSM, instanceId, ssmDocument);

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

          const status = await getAutomationExecutionStatus(SSM, executionId);

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
          var commands = body.commands;
          var documentName = body.documentName;

          const commandId = await sendKaiacCommand(SSM, instances, commands, documentName);
          
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

          const status = await getCommandInvocationStatus(SSM, commandId, instanceId);

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
          stopInstance(EC2, instances);

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
          startInstances(EC2, instances);
          
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