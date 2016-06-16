var fs = require('fs')
var grpc = require('grpc')
var AWS = require('./awsoperations')
var aws = new AWS.AWSWrapper()
var ansible = new AWS.AnsibleWrapper()

var PROTO_PATH = __dirname + '/ansible.proto'
var ansible_proto = grpc.load(PROTO_PATH).ansible;


function abortCall(call){
  return function(err){
    console.log(err)
    call.status.code = grpc.status.INTERNAL
    if(err.message) call.status.details = err.message
    call.end()
  }
}

function changeRegion(call, callback) {
  aws.updateRegion(call.request.region)
  callback(null, {})
}

function createInstance(call, callback) {
  aws.createInstance(call.request).then(value => {
    callback(null, {id: value})
  }).catch(err => {
    callback({code: grpc.status.INTERNAL, details: err.message})
  })
}

function terminateInstances(call, callback) {
  aws.terminateInstances(call.request).then(value => {
    callback(null, {text: 'Terminating ' + call.request.ids})
  }).catch(err => {
    callback({code: grpc.status.INTERNAL, details: err.message})
  })
}

function describeInstances(call) {
  aws.describeInstances().then(values => {
    values.forEach(value => call.write(value))
    call.end()
  }).catch(abortCall(call))
}

function tagResource(call, callback) {
  aws.tagResource(call.request).then(value => {
    callback(null, {})
  }).catch(err => {
    callback({code: grpc.status.INTERNAL, details: err.message})
  })
}

function deployWordpressSingle(call) {
  ansible.runExistingPlaybook('tasks/wordpress-single', {host: call.request.id}, string => {
    call.write({text: string})
  }).then(value => {
    call.end()
  }).catch(abortCall(call))
}

function deployWordpress(call) {
  ansible.runExistingPlaybook('tasks/wordpress', {host: call.request.id}, string => {
    call.write({text: string})
  }).then(value => {
    call.end()
  }).catch(abortCall(call))
}

function deployDb(call) {
  ansible.runExistingPlaybook('tasks/db', {host: call.request.id}, string => {
    call.write({text: string})
  }).then(value => {
    call.end()
  }).catch(abortCall(call))
}

function _connectToDb(appHost, dbHost, writable) {
  return new Promise((resolve, reject) => {
    aws.describeInstances().then(values => {
      writable("Pulled instance descriptions")
      instances = values.filter(instance => {return instance.id === dbHost})
      if(instances.length != 1){
        reject({message: "Instance not found"})
      } else {
        writable("Now connecting to the db on " + instances[0].privateIp)
        ansible.runExistingPlaybook('tasks/connectToDb', {appHost: appHost, dbHostPrivateIp: instances[0].privateIp}, writable)
        .then(resolve)
        .catch(reject)
      }
    }).catch(reject)
  })
}

function connectToDb(call) {
  _connectToDb(call.request.appHost.id, call.request.dbHost.id, string => {
    call.write({text: string})
  }).then(value => {
    call.end()
  }).catch(abortCall(call))
}

function backupDb(call) {
  ansible.runExistingPlaybook('tasks/backup_db', {host: call.request.host, revision: '/tmp/revisions/' + call.request.revision + '.sql'}, string => {
    call.write({text: string})
  }).then(value => {
    call.end()
  }).catch(abortCall(call))
}

function restoreDb(call) {
  ansible.runExistingPlaybook('tasks/restore_db', {host: call.request.host, revision: '/tmp/revisions/' + call.request.revision + '.sql'}, string => {
    call.write({text: string})
  }).then(value => {
    call.end()
  }).catch(abortCall(call))
}

function connectToDbAndRegisterLB(instanceId, lbName, writable){
  return new Promise((resolve, reject) => {
    aws.describeLoadBalancerTags(lbName).then(tags => {
      values = tags.filter(value => {
        return value.key === "dbInstance"
      })
      if(values.length != 1) reject({message: "Loadbalancer Tags do not match expectations"})
      else {
        var dbInstance = values[0].value
        writable("got instance id from loadbalancer tag (" + dbInstance + ")")
        _connectToDb(instanceId, dbInstance, writable).then(value => {
          writable("Connected database .. now assigning to loadbalancer")
          aws.assignInstance(instanceId, lbName).then(value => {
            resolve(value)
          }).catch(reject)
        }).catch(reject)
      }
    }).catch(reject)
  })
}

function describeLoadBalancedWordpress(call, callback){
  var lbName = call.request.name

  aws.describeLoadBalancer(lbName).then(lbInfo => {
    var response = {
      name: lbName,
      dns: lbInfo.DNSName
    }
    response.appServers = []
    lbInfo.Instances.forEach(instance => {
      response.appServers.push({id: instance.InstanceId})
    })
    aws.describeLoadBalancerTags(lbName).then(tags => {
      values = tags.filter(value => {
        return value.key === "dbInstance"
      })
      if(values.length != 1) callback({code: grpc.status.INTERNAL, details: "Loadbalancer Tags do not match expectations"})

      response.databaseServer = {id: values[0].value}

      callback(null, response)
    }).catch(err => {
      callback({code: grpc.status.INTERNAL, details: err.message})
    })
  }).catch(err => {
    callback({code: grpc.status.INTERNAL, details: err.message})
  })
}

function scaleOut(call) {
  var name = call.request.name
  var writable = text => call.write({text: text})
  var instanceParams = {
      image: "ami-fce3c696",
      type: "t2.micro",
      securityGroup: "http+ssh",
      keyName: "default",
      availabilityZone: "us-east-1a"
    }
  // Create two Instances
  var promises = []
  promises.push(aws.createInstance(instanceParams))
  promises.push(new Promise(resolve => setTimeout(resolve, 90000) ))
  writable("Create Instance and wait for 90s")
  Promise.all(promises).then(values => {
    // This only works because the setTimeout Promise happens to be the last that resolves..
    var appId = values[0]
    writable("Created instance " + appId)
    writable("Now deploying wordpress")

    ansible.runExistingPlaybook('tasks/wordpress', {host: appId}, writable).then(value => {
      writable("Deployed wordpress. Now connecting to db and lb")
      connectToDbAndRegisterLB(appId, name, writable).then(value => {
        writable("There is now one additional wordpress instance running!")
        call.end()
      }).catch(abortCall(call))
    }).catch(abortCall(call))
  }).catch(abortCall(call))
}

function scaleIn(call) {
  var writable = text => call.write({text: text})
  aws.describeLoadBalancer(call.request.name).then(value => {
    if(value.Instances.length == 0) abortCall(call)({message: "There are no instances assigned to the loadbalancer"})
    else {
      var instanceToKill = value.Instances[0].InstanceId
      writable("Taking " + instanceToKill + " out of the loadbalancer..")
      aws.removeInstance(instanceToKill, call.request.name).then(value => {
        writable("Done. Now terminating the instance")
        aws.terminateInstances({ids: [instanceToKill]}).then(value => {
          writable("Instance is terminated.")
          call.end()
        }).catch(abortCall(call))
      }).catch(abortCall(call))
    }
  }).catch(abortCall(call))
}

function createLoadBalancedWordpress(call) {
  var name = call.request.name
  var writable = text => call.write({text: text})
  var instanceParams = {
      image: "ami-fce3c696",
      type: "t2.micro",
      securityGroup: "http+ssh",
      keyName: "default",
      availabilityZone: "us-east-1a"
    }
  // Create two Instances
  var promises = []
  promises.push(aws.createInstance(instanceParams))
  promises.push(aws.createInstance(instanceParams))
  promises.push(new Promise(resolve => setTimeout(resolve, 90000) ))
  call.write({text: "Create Instances and wait for 90s"})
  Promise.all(promises).then(values => {
    // This only works because the setTimeout Promise happens to be the last that resolves..
    var dbId = values[0]
    var appId = values[1]
    call.write({text: "Created instances " + dbId + " and " + appId})

    var lbParams = {
      name: name,
      securityGroup: 'http+ssh',
      availabilityZones: ['us-east-1a'],
      tags: [{key: "dbInstance", value: dbId}]
    }

    var promises = []
    promises.push(aws.createLoadBalancer(lbParams))
    promises.push(ansible.runExistingPlaybook('tasks/db', {host: dbId}, writable))
    promises.push(ansible.runExistingPlaybook('tasks/wordpress', {host: appId}, writable))

    Promise.all(promises).then(values => {
      writable("deployed db, wordpress and created loadbalancer")

      connectToDbAndRegisterLB(appId, name, writable).then(value => {
        writable("Finished")
        call.end()
      }).catch(abortCall(call))
    }).catch(abortCall(call))

    //promises.push(_connectToDb(appId, dbId, text => call.write({text: text}) ))


  }).catch(abortCall(call))
}


var server = new grpc.Server()
server.addProtoService(ansible_proto.WordpressOps.service, {
  deployWordpressSingle: deployWordpressSingle,
  deployWordpress: deployWordpress,
  deployDb: deployDb,
  connectToDb: connectToDb,
  backupDb: backupDb,
  restoreDb: restoreDb,
  createLoadBalancedWordpress: createLoadBalancedWordpress,
  describeLoadBalancedWordpress: describeLoadBalancedWordpress,
  scaleOut: scaleOut,
  scaleIn: scaleIn
})
server.addProtoService(ansible_proto.AWSOps.service, {
  changeRegion: changeRegion,
  createInstance: createInstance,
  terminateInstances: terminateInstances,
  describeInstances: describeInstances,
  tagResource: tagResource
})
server.bind('0.0.0.0:50051', grpc.ServerCredentials.createInsecure())
server.start()
