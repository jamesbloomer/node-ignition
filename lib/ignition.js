var accessKey = process.env.AWS_ACCESS_KEY;
var secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

var _ = require('underscore'),
	moment = require('moment'),
	aws = require('aws2js'),
	http = require('http');

var ec2 = aws.load('ec2', accessKey, secretAccessKey);

var ignition = {};

ignition.ec2 = ec2;

ignition.getInstanceDetails = function(instanceId, elasticIp, callback) {	
	ignition.describeInstances(instanceId, function(e, instance) {
		if(e) {			
			return callback(null, { currentState: "unknown", action: "unknown", name: "unknown", launchtime: 'unknown', health: 'unknown' });
		}
		var url = null;
		ignition.describeHealth(elasticIp, function(e, health) {
			var state = instance.reservationSet.item.instancesSet.item.instanceState.name;
			var stateText = ignition.getDisplayTextForState(state);

			var tags = instance.reservationSet.item.instancesSet.item.tagSet.item;
			var name = _.find(tags, function(tag){ return tag.key == 'Name'; }).value;

			var launchtime = instance.reservationSet.item.instancesSet.item.launchTime;
			var launchtime_string = launchtime ? moment(new Date(launchtime)).format("ddd Do, h:mm:ss a") : 'unknown';

			return callback(null, { currentState: state, action: stateText, name: name, launchtime: launchtime_string, health: health });
		});
	});
};

ignition.describeInstances = function(instanceId, callback) {
	ignition.ec2.request('DescribeInstances', { "InstanceId.0" : instanceId }, callback);
};

ignition.describeHealth = function(elasticIp, callback) {
	var req = http.get("http://" + elasticIp + "/", function(res) {
		return callback(null, 'running');
    }).on('error', function(e) {
		return callback(null, 'stopped');
    });

    req.on('socket', function (socket) {
        socket.setTimeout(1000);  
        socket.on('timeout', function() {
            req.abort();
        });
    });
};

ignition.getDisplayTextForState = function(state) {
  switch(state) {
		case "stopped":
		case "stopping":
			return "start";
		case "pending":
		case "running":
			return "stop";
		default:
			return "?";
	}
};

ignition.start = function(instanceId, callback) {
    ignition.ec2.request('StartInstances', { "InstanceId.0" : instanceId }, function(error, response) {
        console.log('start for instance %s', instanceId);
        return callback(error, response);
    });
};

ignition.stop = function(instanceId, callback) {
	ignition.ec2.request('StopInstances', { "InstanceId.0" : instanceId }, function(error, response) {
        console.log('stop for instance %s', instanceId);
        return callback(error, response);
    });
};

ignition.associateElasticIp = function(instanceId, elasticIp, callback) {
    ignition.ec2.request('AssociateAddress', { "InstanceId" : instanceId, "PublicIp" : elasticIp }, function(error, response) {
        console.log('AssociateAddress for instance %s, elasticIp %s', instanceId, elasticIp);

        if (error) {
            console.error(error);
        } else {
            console.log(response);
        }

        return callback(error, response);
    });
};

module.exports = ignition;