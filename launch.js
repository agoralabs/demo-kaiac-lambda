// Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

var aws = require("aws-sdk");
var ses = new aws.SES({ region: "us-west-2" });
exports.handler = async function (event) {
  console.log("EVENT: \n" + JSON.stringify(event, null, 2))
  var params = {
    Destination: {
      ToAddresses: ["joseph.ekobokidou@gmail.com"],
    },
    Message: {
      Body: {
        Text: { Data: "Nom: "+event.username + "\n" + "Email: "+event.useremail + "\n" + "Tel: "+event.userphone + "\n" + "Message: "+event.usermsg + "\n"},
      },

      Subject: { Data: "[AGORALABS_WEB_SITE] "+event.usersubject },
    },
    Source: "agora.labs.contact@gmail.com",
  };
 
  return ses.sendEmail(params).promise()
};