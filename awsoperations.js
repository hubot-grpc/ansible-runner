var aws = require('aws-sdk')
var fs = require('fs')
var Ansible = require('node-ansible')

module.exports.AWSWrapper = class AWSWrapper {
  constructor(loggers) {
    this.updateRegion('us-east-1')
  }

  updateRegion(newRegion){
    aws.config.update({region: newRegion})
    this.ec2 = new aws.EC2()
    this.elb = new aws.ELB()
  }

  createInstance(request) {
    return new Promise((resolve, reject) => {
      var params = {
        ImageId: 	request.image || 'ami-fce3c696',
        MaxCount: 1,
        MinCount: 1,
        Monitoring: { Enabled: false },
        InstanceType: request.type || 't2.micro',
        SecurityGroups: [request.securityGroup || 'http+ssh'],
        KeyName: request.keyName || 'default'
      }
      if(request.availabilityZone) {
        params.Placement = { AvailabilityZone: request.availabilityZone }
      }

      this.ec2.runInstances(params, function(err, data) {
        if (err) {
          reject(err)
        }
        else {
          var id = data.Instances[0].InstanceId;
          resolve(id)
        }
      })
    })
  }

  terminateInstances(request) {
    return new Promise((resolve, reject) => {
      this.ec2.terminateInstances({InstanceIds: request.ids}, (err, data) => {
        if (err)  reject(err)
        else      resolve(request.ids)
      })
    })
  }

  describeTags(request){
    return new Promise((resolve, reject) => {
      var params = {
        Filters: [
          {
            Name: 'resource-id',
            Values: [request.id]
          }
        ]
      }
      this.ec2.describeTags(params, (err, data) => {
        if(err) reject(err)
        else {
          resolve(data.Tags.map(tag => {
            return { key: tag.Key, value: tag.Value }
          }))
        }
      })
    })
  }

  tagResource(request) {
    return new Promise((resolve, reject) => {
      var params = {
        Resources: [request.id],
        Tags: [{Key: request.key, Value: request.value}]
      }
      this.ec2.createTags(params, (err, data) => {
        if(err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  describeInstances() {
    return new Promise((resolve, reject) => {
      this.ec2.describeInstances({}, (err, data) => {
        if (err) {
          reject(err)
        }
        var instances = []
        data.Reservations.forEach(reservation => {
          reservation.Instances.forEach(instance => {
            instances.push({
              id: instance.InstanceId,
              state: instance.State.Name,
              keyName: instance.KeyName,
              publicIp: instance.PublicIpAddress,
              privateIp: instance.PrivateIpAddress,
              publicDns: instance.PublicDnsName,
              privateDns: instance.PrivateDnsName,
              type: instance.InstanceType,
              image: instance.ImageId,
              availabilityZone: instance.Placement.AvailabilityZone
            })
          })
        })

        /*var promises = []
        instances.forEach(instance => {
          promises.push(new Promise((resolve, reject) => {
            this.describeTags({id: instance.id}).then(tags => {
              instance.tags = tags
              resolve(instance)
            }).catch(reject)
          }))
        })
        Promise.all(promises).then(resolve).catch(reject)*/

        resolve(instances)
      })
    })
  }

  describeLoadBalancerTags(name) {
    return new Promise((resolve, reject) => {
      this.elb.describeTags({ LoadBalancerNames: [name] }, function(err, data) {
        if (err) reject(err)
        else {
          var tags = data.TagDescriptions[0].Tags.map(tag => {return {key: tag.Key, value: tag.Value}})
          resolve(tags)
        }
      })
    })
  }

  describeLoadBalancer(name) {
    return new Promise((resolve, reject) => {
      this.elb.describeLoadBalancers({LoadBalancerNames: [name]}, (err, data) => {
        if(err) reject(err)
        else {
          resolve(data.LoadBalancerDescriptions[0])
        }
      })
    })
  }

  assignInstance(instance, lbName) {
    return new Promise((resolve, reject) => {
      this.elb.registerInstancesWithLoadBalancer({
        Instances: [{InstanceId: instance}],
        LoadBalancerName: lbName
      }, (err, data) => {
        if(err) reject(err)
        else    resolve(data)
      })
    })
  }

  removeInstance(instance, lbName) {
    return new Promise((resolve, reject) => {
      this.elb.deregisterInstancesFromLoadBalancer({
        Instances: [{InstanceId: instance}],
        LoadBalancerName: lbName
      }, (err, data) => {
        if(err) reject(err)
        else    resolve(data)
      })
    })
  }

  createLoadBalancer(params) {
    return new Promise((resolve, reject) => {
      this.ec2.describeSecurityGroups({GroupNames: [params.securityGroup]}, (err, response) => {
        if(err) reject(err)

        var updatedParams = {
          LoadBalancerName: params.name,
          SecurityGroups: [ response.SecurityGroups[0].GroupId ],
          AvailabilityZones: params.availabilityZones,
          Listeners: [{
            InstancePort: 80,
            LoadBalancerPort: 80,
            Protocol: 'HTTP'
          }]
        }
        updatedParams.Tags = params.tags.map(tag => {
          return { Key: tag.key, Value: tag.value }
        })

        this.elb.createLoadBalancer(updatedParams, (err, response) => {
          if(err) reject(err)
          else resolve(null)
        })
      })
    })
  }
}

module.exports.AnsibleWrapper = class AnsibleWrapper {
  runExistingPlaybook(playbookName, variables, write) {
    return new Promise((resolve, reject) => {
      var playbook = new Ansible.Playbook().playbook(playbookName).variables(variables);
      playbook.on('stdout', function(data) { write(data.toString()) })
      playbook.on('stderr', function(data) { write(data.toString()) })
      playbook.on('close', function(data) {
        resolve()
      })
      playbook.exec()
    })
  }
}
