/**
  ACL System inspired on Zend_ACL.
  
  Backed by Redis.

  All functions accept strings, objects or arrays unless specified otherwise.
  
  '*' is used to express 'all'
  
  Database structure in Redis (using default prefix 'acl')
  
  Users:

  acl_roles_{userid} = set(roles)
  
  Roles:
  
  acl_roles = {roleNames} // Used to remove all the permissions associated to ONE resource.
  
  acl_parents_{roleName} = set(parents)
  acl_resources_{roleName} = set(resourceNames) // Used to remove ONE role
  
  Permissions:
  
  acl_allows_{roleName}_{resourceName} = set(permissions)

  Note: user ids, role names and resource names are all case sensitive.
*/


var Step = require('./step')

exports = module.exports = function acl(redis, prefix){
  if(prefix){
    this.prefix = prefix;
  }else{
    this.prefix = 'acl'
  }
  /**
    Adds roles to a given user.
  */
  this.addUserRoles = function(userId, roles, callback){
    var multi = redis.multi()
    multi.sadd(this.prefix+'_users', userId)
    addToSet(multi, this.userKey(userId), roles)
    multi.exec(function(err){
      callback(err)
    })
  }
  
  /**
    Remove roles from a given user.
  */
  this.removeUserRoles = function(userId, roles, callback){
    var multi = redis.multi()
    removeFromSet(multi, this.userKey(userId), roles)
    multi.exec(function(err){
      callback(err)
    })
  }

  /**
    Return all the roles from a given user.
  */
  this.userRoles = function(userId, callback){
    redis.smembers(this.userKey(userId), callback)
  }

  /**
      Adds a parent or parent list to role.
  */
  this.addRoleParents = function(roleName, parents, callback){
    var multi = redis.multi()
    addToSet(multi, this.roleParentsKey(roleName), parents)
    multi.sadd(this.prefix+'_roles', roleName)
    multi.exec(function(err){
      callback(err)
    })
  }
  
  this.removeAllRoles = function(){
    // FIXME: Implement
  }
  
  /**
    Removes a role from the system. 
    
    Note: when adding roles to users or adding permissions for resources to
    roles, structures are created in the database. The way of deleting them
    is calling to this function.
  */
  this.removeRole = function(roleName, callback){
    var acl = this 
    redis.smembers(acl.roleResourcesKey(roleName), function(err, resourceNames){
      if(err) callback(err)
      else{
        var keys = resourceNames.map(function(obj){
          return acl.permissionsKey(roleName,obj)
        })
          
        keys.push(acl.roleResourcesKey(roleName))
        keys.push(acl.roleParentsKey(roleName))
        multi = redis.multi()
        multi.del(keys)
        multi.srem(acl.prefix+'_roles', roleName)
        multi.exec(function(err){
          callback(err)
        })
      }
    })
  }
  
  this.removeResource = function(resourceName, callback){
    var acl = this
    redis.smembers(acl.prefix+'_roles', function(err, roles){
      var roleResources = roles.map(function(role){
        return acl.permissionsKey(role, resourceName)
      })
      redis.del(roleResources, callback) 
    })
  }

  this.allow = function(roleNames, resourceNames, permissions, callback){   
    var acl = this
    var multi = redis.multi()
    
    roleNames = makeArray(roleNames)
    resourceNames = makeArray(resourceNames)
    
    roleNames.forEach(function(roleName){
      multi.sadd(acl.prefix+'_roles', roleName)
    
      resourceNames.forEach(function(resourceName){
        addToSet(multi, acl.permissionsKey(roleName,resourceName), permissions)
      })
    
      addToSet(multi, acl.roleResourcesKey(roleName), resourceNames)
    })
    
    multi.exec(function(err){
      callback(err)
    })
  }
  
  this.allowEx = function(objs, callback){
    var acl = this
    objs = makeArray(objs)
    
    var demuxed = []
    objs.forEach(function(obj){
      var roles = obj.roles
      obj.allows.forEach(function(allow){
        demuxed.push({roles:roles, resources:allow.resources, permissions:allow.permissions})
      })
    })
    
    Step(
      function(){
        var group = this.group()
        demuxed.forEach(function(obj){
          acl.allow(obj.roles, obj.resources, obj.permissions, group()) 
         })
      },
      function(err){
        callback(err)
      }
    )
  }
  
  this.removeAllow = function(roleName, resourceNames, permissions, callback){
    var acl = this
    resourceNames = makeArray(resourceNames)
  
    var multi = redis.multi()
  
    resourceNames.forEach(function(resourceName){
      var key = acl.permissionsKey(roleName,resourceName)
      removeFromSet(multi, key, permissions)
    })
    
    multi.exec(function(err){
      callback(err)
    })
    
    // FIXME:
    // If a resource has no permissions left for a role, we can delete the resource
    // from the resources list...
  }
  
  this.deny = function(roleName, resourceNames, permissions){
    // FIXME: IMPLEMENT
    /**
      Have a denials set for every role,resource combination.
    */
  }
  
  /**
    Returns all the allowable permissions a given user have to
    access the given resources.
    
    It returns an array of objects where every object maps a 
    resource name to a list of permissions for that resource.
  */
  this.allowedPermissions = function(userId, resources, callback){
    var acl = this
    var permissionsObject = {}
    resources = makeArray(resources)

    acl.userRoles(userId, function(err, roleNames){
      if (err) callback(err)
      else {
        Step(
             function getResourcesPermissions(){
               var group = this.group()
               resources.forEach(function(resourceName){
                 acl._resourcePermissions(roleNames, resourceName, group())
               })
             },
             function finish(err, results){
               for (var i = 0; i < resources.length; i++){
                 permissionsObject[resources[i]] = results[i]
               }
               callback(err, permissionsObject)
             }
           )
      }
    })
  }
  
  this.isAllowed = function(userId, resourceName, permissions, callback){
    var acl = this
    redis.smembers(acl.userKey(userId), function(err, roles){
      if(err) callback(err)
      else if(roles.length){
        acl.areAnyRolesAllowed(roles, resourceName, permissions, callback)
      }else{
        callback(undefined, false)
      }
    })
  }
  
  /**
    Returns true if any of the given roles have the right permissions.
  */
  this.areAnyRolesAllowed = function(roleNames, resourceName, permissions, callback){
    roleNames = makeArray(roleNames)
    permissions = makeArray(permissions)
  
    if(roleNames.length==0){
      callback(undefined, false)
    }else{
      this._checkPermissions(roleNames, resourceName, permissions, callback)
    }
  }
  
  this.removeDeny = function(roleNames, resourceNames, permissions){
    // FIXME: IMPLEMENT
  }
  
  this.clean = function(callback){
    redis.keys(this.prefix+'*', function(err, keys){
      if(keys.length){
        redis.del(keys, function(err){callback(err)})
      }else{
        callback(undefined)
      }
    })
  }
  
  // Returns the parents of the given roles
  this._rolesParents = function(roleNames, callback){
    var acl = this
    var parentsKeys = roleNames.map(function(roleName){
      return acl.roleParentsKey(roleName)
    })
    
    redis.sunion(parentsKeys, callback)
  }
  
  // Returns the permissions for the given resource and set of roles
  // TODO: Re-implement iteratively
  this._resourcePermissions = function(roleNames, resourceName, callback){
    var acl = this
    var permissionKeys = roleNames.map(function(roleName){
      return acl.permissionsKey(roleName,resourceName)
    })
  
    redis.sunion(permissionKeys, function(err, resourcePermissions){
      if(err) callback(err)
      else{
        acl._rolesParents(roleNames, function(err, parents){
          if(err) callback(err)
          else if(parents.length){
            acl._resourcePermissions(parents, resourceName, function(err, morePermissions){
              callback(undefined, set_add(resourcePermissions, morePermissions))
            })
          }else{
            callback(err, resourcePermissions)
          }
        })
      }
    })
  }
  
  // TODO: Add denials support.
  // NOTE: This function will not handle circular dependencies and result in a crash.
  // FIXME: Re-implement iteratively.
  this._checkPermissions = function(roleNames, resourceName, permissions, callback){
    var acl = this

    var keys = roleNames.map(function(roleName){
      return acl.permissionsKey(roleName,resourceName)
    })
  
    redis.sunion(keys, function(err, resourcePermissions){
      if(err) callback(err)
      else if (resourcePermissions.indexOf('*') != -1){
        callback(undefined, true)
      }else{
        permissions = permissions.filter(function(p){
          return resourcePermissions.indexOf(p) == -1
        })

        if(permissions.length == 0){
          callback(undefined, true)
        }else{
          var parentsKeys = roleNames.map(function(roleName){return acl.roleParentsKey(roleName)})
          
          redis.sunion(parentsKeys, function(err, parents){
            if(err) callback(err)
            else if(parents.length){
              acl._checkPermissions( parents, resourceName, permissions, callback)
            }else{
              callback(undefined, false)
            }
          })
        }
      }
    })
  }
  
  this.userKey = function(userId){
    return this.prefix+'_roles_'+userId
  }

  this.roleParentsKey = function(roleName){
    return this.prefix+'_parents_'+roleName
  }

  this.roleResourcesKey = function(roleName){
    return this.prefix+'_resources_'+roleName
  }

  this.permissionsKey = function(roleName, resourceName){
    return this.prefix+'_allows_'+roleName+'_'+resourceName
  }
  
  this.middleware = function(numPathComponents, userId, actions){
    var acl = this
    
    var HttpError = function(errorCode, msg){
      this.errorCode = errorCode;
      this.msg = msg

      Error.call(this, msg);
      Error.captureStackTrace(this, arguments.callee);
    }

    return function(req, res, next){
      var _userId = userId;
      // call function to fetch userId
      if(typeof userId === 'function'){
        _userId = userId(req, res);
      }
      if (!userId) {
        if((req.session) && (req.session.userId)){
          _userId = req.session.userId
        }else{
          next(new HttpError(401, 'User not authenticated'))
          return
        }
      }
        
      var resource
      if(!numPathComponents){
        resource = req.url
      }else{
        resource = req.url.split('/').slice(0,numPathComponents+1).join('/')
      }
    
      if(!actions){
        actions = req.method.toLowerCase()
      }
    
      console.log('Requesting '+actions+' on '+resource+' by user '+_userId)
      acl.isAllowed(_userId, resource, actions, function(err, allowed){
        if (err) next(new Error('Error checking permissions to access resource'))
        else if(allowed == false){
          console.log("Not Allowed")
          console.log("Allowed permissions: ")
          acl.allowedPermissions(userId, resource, function(err, obj){console.log(obj)})
          next(new HttpError(401,'Insufficient permissions to access resource'))
        }else{
          console.log("Allowed")
          next()
        }
      })
    }
  }
}


/**
  Helpers
*/

function isString(a){
  if (typeof(a) === 'string'){
    return true
  }else{
    return false
  }
}

function makeArray(object){
  if (Array.isArray(object)){
    return object
  }else{
    return [object]
  }
}

function addToSet(multi, key, elements){
  if (Array.isArray(elements)){
    elements.forEach(function(element){
      multi.sadd(key, element)
    })
  }else{
    multi.sadd(key, elements)
  }
}

function removeFromSet(multi, key, elements){
  if (Array.isArray(elements)){
    elements.forEach(function(element){
      multi.srem(key, element)
    })
  }else{
    multi.srem(key, elements)
  }
}

function set_add( a, b){
  var tmp = a.filter(function(e){
    return b.indexOf(e) == -1
  })
  return tmp.concat(b)
}


