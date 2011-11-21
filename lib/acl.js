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
  acl_resources_{roleName} = set(resourceNames)
  
  Permissions:
  
  acl_allows_{roleName}_{resourceName} = set(permissions)

  Note: user ids, role names and resource names are all case sensitive.
*/
var    _ = require('underscore'),
   async = require('async'),
    util = require('util'),
contract = require('./contract');

contract.debug = true;

/**
  Helpers
*/
function makeArray(object){
  if (Array.isArray(object)){
    return object;
  }else{
    return [object];
  }
}
function addToSet(multi, key, elements){
  if (Array.isArray(elements)){
    elements.forEach(function(element){
      multi.sadd(key, element);
    });
  }else{
    multi.sadd(key, elements);
  }
}
function removeFromSet(multi, key, elements){
  if (Array.isArray(elements)){
    elements.forEach(function(element){
      multi.srem(key, element);
    });
  }else{
    multi.srem(key, elements);
  }
}
// -----------------------------------------------------------------------------------
var Acl = function (redis, prefix, logger){
  contract.params(arguments, 
                  ['object'],
                  ['object','string|object'],
                  ['object','string','object'])
  
  this.prefix = 'acl';

  if(prefix){
    if(_.isString(prefix)){
      this.prefix = prefix;
    }else{
      this.logger = prefix;
    }
  }
  this.logger = logger?logger:null;
  
  this.redis = redis;
  this.debug = true;
};

/**
  addUserRoles( userId, roles, function(err) )
  
  Adds roles to a given user id.
  
  @param {String} User id.
  @param {String|Array} Role(s) to add to the user id.
  @param {Function} Callback called when finished.
*/
Acl.prototype.addUserRoles = function(userId, roles, callback){
  contract.params(arguments,['string','string|array','function']);

  var multi = this.redis.multi();
    multi.sadd(this.prefix+'_users', userId);
    addToSet(multi, this.userKey(userId), roles);
    multi.exec(function(err){
      callback(err);
    });
};

/**
  removeUserRoles( userId, roles, function(err) )
  
  Remove roles from a given user.

  @param {String} User id.
  @param {String|Array} Role(s) to remove to the user id.
  @param {Function} Callback called when finished.
*/
Acl.prototype.removeUserRoles = function(userId, roles, callback){
  contract.params(arguments,['string','string|array','function']);
  
  var multi = this.redis.multi();
  removeFromSet(multi, this.userKey(userId), roles);
  multi.exec(function(err){
    callback(err);
  });
};

/**
  userRoles( userId, function(err, roles) )

  Return all the roles from a given user.
  
  @param {String} User id.
  @param {Function} Callback called when finished.
*/
Acl.prototype.userRoles = function(userId, callback){
  contract.params(arguments, ['string', 'function']);

  this.redis.smembers(this.userKey(userId), callback);
};

/**
  addRoleParents( role, parents, function(err) )

  Adds a parent or parent list to role.
  
  @param {String} User id.
  @param {String|Array} Role(s) to remove to the user id.
  @param {Function} Callback called when finished.
*/
Acl.prototype.addRoleParents = function(role, parents, callback){
  contract.params(arguments,['string','string|array','function']);
  
  var multi = this.redis.multi();
  addToSet(multi, this.roleParentsKey(role), parents);
  multi.sadd(this.prefix+'_roles', role);
  multi.exec(function(err){
    callback(err);
  });
};

/**
  removeRole( role, function(err) )
  
  Removes a role from the system.
  
  @param {String} Role to be removed
  @param {Function} Callback called when finished.
*/
Acl.prototype.removeRole = function(role, callback){
  contract.params(arguments, ['string','function']);
  var acl = this;
  this.redis.smembers(acl.roleResourcesKey(role), function(err, resources){
    if(err){
      callback(err);
    }else{
      var keys = resources.map(function(obj){
        return acl.permissionsKey(role, obj);
      });
          
      keys.push(acl.roleResourcesKey(role));
      keys.push(acl.roleParentsKey(role));
      multi = acl.redis.multi();
      multi.del(keys);
      multi.srem(acl.prefix+'_roles', role);
      multi.exec(function(err){
        callback(err);
      });
    }
  });
};

/**
  removeResource( resource, function(err) )
  
  Removes a resource from the system
  
  @param {String} Resource to be removed
  @param {Function} Callback called when finished.
*/
Acl.prototype.removeResource = function(resource, callback){
  contract.params(arguments, ['string','function']);
  var acl = this;
  acl.redis.smembers(acl.prefix+'_roles', function(err, roles){
    var roleResources = roles.map(function(role){
      return acl.permissionsKey(role, resource);
    });
    var multi = acl.redis.multi()
    multi.del(roleResources)
    
    roles.forEach(function(role, cb){ 
      multi.srem(acl.roleResourcesKey(role), resource)
    })
    
    multi.exec(function(err){
      callback(err);
    });
  });
};

/**
  allow( roles, resources, permissions, function(err) )

  Adds the given permissions to the given roles over the given resources.
  
  @param {String|Array} role(s) to add permissions to.
  @param {String|Array} resource(s) to add permisisons to.
  @param {String|Array} permission(s) to add to the roles over the resources.
  @param {Function} Callback called when finished.
  
  allow( permissionsArray, function(err) )
  
  @param {Array} Array with objects expressing what permissions to give.
  
  [{roles:{String|Array}, allows:[{resources:{String|Array}, permissions:{String|Array}]]
  
  @param {Function} Callback called when finished.
*/
Acl.prototype.allow = function(roleNames, resourceNames, permissions, callback){
  contract.params(arguments,
              ['string|array','string|array','string|array','function'], 
              ['array','function']);
  if((arguments.length===2)&&_.isObject(roleNames)&&_.isFunction(resourceNames)){
    this._allowEx(roleNames, resourceNames);
  }else{
    var acl = this,
        multi = this.redis.multi();
    
    roleNames = makeArray(roleNames);
    resourceNames = makeArray(resourceNames);
    
    roleNames.forEach(function(roleName){
      multi.sadd(acl.prefix+'_roles', roleName);
    
      resourceNames.forEach(function(resourceName){
        addToSet(multi, acl.permissionsKey(roleName,resourceName), permissions);
      });
    
      addToSet(multi, acl.roleResourcesKey(roleName), resourceNames);
    });
    
    multi.exec(function(err){
      callback(err);
    });
  }
};

/**
  removeAllow( role, resources, permissions, function(err) )

  Remove permissions from the given roles owned by the given role.

  Note: we loose atomicity when removing empty role_resources.
  
  @param {String}
  @param {String|Array}
  @param {String|Array}
  @param {Function}
*/
Acl.prototype.removeAllow = function(role, resources, permissions, callback){
  contract.params(arguments, ['string','string|array','string|array','function'])
  var acl = this;
  resources = makeArray(resources);
  permissions = makeArray(permissions);
  
  var multi = this.redis.multi();
  
  resources.forEach(function(resource){
    var key = acl.permissionsKey(role,resource);
    removeFromSet(multi, key, permissions);
    multi.scard(key, function(err, card){
      if(card===0){
        acl.redis.srem(acl.roleResourcesKey(role), resource);
      }
    });
  });
  
  multi.exec(function(err){
    callback(err);
  });
};
  
/**
  allowdPermissions( userId, resources, function(err, obj) )

  Returns all the allowable permissions a given user have to
  access the given resources.
  
  It returns an array of objects where every object maps a 
  resource name to a list of permissions for that resource.
  
  @param {String} User id.
  @param {String|Array} resource(s) to ask permissions for.
  @param {Function} Callback called when finished.
*/
Acl.prototype.allowedPermissions = function(userId, resources, callback){
  contract.params(arguments, ['string', 'string|array', 'function']);
  var acl = this;
  resources = makeArray(resources);

  acl.userRoles(userId, function(err, roles){
    if (err){
      callback(err);
    } else {
      var result = {};
      async.forEach(resources, function(resource, callback){
        acl._resourcePermissions(roles, resource, function(err, permissions){
          if(err){
            callback(err);
          }else{
            result[resource] = permissions;
            callback();
          }
        });
      },
      function(err){
        callback(err, result);
      });
    }
  });
};

/**
  isAllowed( userId, resource, permissions, function(err, allowed) )
  
  Checks if the given user is allowed to access the resource for the given 
  permissions (note: it must fulfill all the permissions).
  
  @param {String} User id.
  @param {String|Array} resource(s) to ask permissions for.
  @param {String|Array} asked permissions.
  @param {Function} Callback called wish the result.
*/
Acl.prototype.isAllowed = function(userId, resource, permissions, callback){
  contract.params(arguments, ['string', 'string', 'string|array', 'function'])
  var acl = this;
  this.redis.smembers(acl.userKey(userId), function(err, roles){
    if(err) {
      callback(err);
    }else if(roles.length){
      acl.areAnyRolesAllowed(roles, resource, permissions, callback);
    }else{
      callback(undefined, false);
    }
  });
};
  
/**
  areAnyRolesAllowed( roles, resource, permissions, function(err, allowed) )
  
  Returns true if any of the given roles have the right permissions.
  
  @param {String|Array} Role(s) to check the permissions for.
  @param {String} resource(s) to ask permissions for.
  @param {String|Array} asked permissions.
  @param {Function} Callback called wish the result.
*/
Acl.prototype.areAnyRolesAllowed = function(roles, resource, permissions, callback){
  contract.params(arguments, ['string|array', 'string', 'string|array', 'function'])
  
  roles = makeArray(roles);
  permissions = makeArray(permissions);
  
  if(roles.length===0){
    callback(undefined, false);
  }else{
    this._checkPermissions(roles, resource, permissions, callback);
  }
};
  
/**
  whatResources(role, function(err, {resourceName: [permissions]})
    
  Returns what resources a given role has permissions over.
    
  whatResources(role, permissions, function(err, resources) )
    
  Returns what resources a role has the given permissions over.
  
  @param {String|Array} Roles
  @param {String[Array} Permissions
  @param {Function} Callback called wish the result.
*/
Acl.prototype.whatResources = function(roles, permissions, callback){
  contract.params(arguments,
              ['string|array','function'], 
              ['string|array','string|array','function']);

  var acl = this;
  roles = makeArray(roles);
  if (_.isFunction(permissions)){
    callback = permissions;
    permissions = undefined;
  }else{
    permissions = makeArray(permissions);
  }
    
  this._rolesResources(roles, function(err, resources){
    if(err){
      callback(err);
    } else {
      var result = permissions!==undefined?[]:{};
        
      async.forEach(resources, function(resource, callback){
          acl._resourcePermissions(roles, resource, function(err, p){
            if(err){
              callback(err);
            }else{
              if(permissions){
                var commonPermissions = _.intersection(permissions, p);
                if(commonPermissions.length>0){
                  result.push(resource);
                }
              }else{
                result[resource] = p;
              }
              callback();
            }
          });
      },
      function(err){
        callback(err, result);
      });
    }
  });
};
  
/**
  clean ()

  Cleans all the keys with the given prefix from redis.
    
  Note: this operation is not reversible!.
*/
Acl.prototype.clean = function(callback){
  var acl = this;
  this.redis.keys(this.prefix+'*', function(err, keys){
    if(keys.length){
      acl.redis.del(keys, function(err){
        callback(err);
      });
    }else{
      callback();
    }
  });
};

/**
  Methods for generating keys for the different data structures.
  
*/

Acl.prototype.userKey = function(userId){
  return this.prefix+'_roles_'+userId;
};

Acl.prototype.roleParentsKey = function(roleName){
  return this.prefix+'_parents_'+roleName;
};

Acl.prototype.roleResourcesKey = function(roleName){
  return this.prefix+'_resources_'+roleName;
};

Acl.prototype.permissionsKey = function(roleName, resourceName){
  return this.prefix+'_allows_'+roleName+'_'+resourceName;
};

/**
  Express Middleware

*/
Acl.prototype.middleware = function(numPathComponents, userId, actions){
  contract.params(arguments, 
                  [], 
                  ['number'],
                  ['number','string|function'],
                  ['number','string|function', 'string|array'])

  var acl = this;
    
  var HttpError = function(errorCode, msg){
    this.errorCode = errorCode;
    this.msg = msg;
    
    Error.captureStackTrace(this, arguments);
    Error.call(this, msg);
  };

  return function(req, res, next){
    var _userId = userId, 
        resource;
    // call function to fetch userId
    if(typeof userId === 'function'){
      _userId = userId(req, res);
    }
    if (!userId) {
      if((req.session) && (req.session.userId)){
        _userId = req.session.userId;
      }else{
        next(new HttpError(401, 'User not authenticated'));
        return;
      }
    }
        
    if(!numPathComponents){
      resource = req.url;
    }else{
      resource = req.url.split('/').slice(0,numPathComponents+1).join('/');
    }
    
    if(!actions){
      actions = req.method.toLowerCase();
    }
    
    var logMessage = 'Requesting '+actions+' on '+resource+' by user '+_userId;
    logger.debug(logMessage)
    acl.isAllowed(_userId, resource, actions, function(err, allowed){
      if (err){
        next(new Error('Error checking permissions to access resource'));
      }else if(allowed === false){
        logger.debug('Not allowed '+actions+' on '+resource+' by user '+_userId);
        acl.allowedPermissions(_userId, resource, function(err, obj){
          logger.debug('Allowed permissions: '+obj)
        });
        next(new HttpError(401,'Insufficient permissions to access resource'));
      }else{
        logger.debug('Allowed '+actions+' on '+resource+' by user '+_userId);
        next();
      }
    });
  };
};


//----------------------------------------------------------------------------------
//
// Private methods
//
//----------------------------------------------------------------------------------

//
// Same as allow but accepts a more compact input.
//
Acl.prototype._allowEx = function(objs, callback){
  var acl = this;
  objs = makeArray(objs);
    
  var demuxed = [];
  objs.forEach(function(obj){
    var roles = obj.roles;
    obj.allows.forEach(function(allow){
      demuxed.push({roles:roles, resources:allow.resources, permissions:allow.permissions});
    });
  });
    
  async.forEach(demuxed, function(obj, callback){
    acl.allow(obj.roles, obj.resources, obj.permissions, callback);
  }, callback);
};

//
// Returns the parents of the given roles
//
Acl.prototype._rolesParents = function(roleNames, callback){
  var acl = this;
  var parentsKeys = roleNames.map(function(roleName){
    return acl.roleParentsKey(roleName);
  });
    
  this.redis.sunion(parentsKeys, callback);
};
  
//
// Return all roles in the hierarchy including the given roles.
//
Acl.prototype._allRoles = function(roleNames, callback){
  var acl = this,
      roles;
  
  this._rolesParents(roleNames, function(err, parents){
    roles = _.union(roleNames, parents);
    async.whilst(
      function (){ 
        return parents.length >0;
      },
      function (callback) {
        acl._rolesParents(parents, function(err, result){
          if(err){
            callback(err);
          }else{
            roles = _.union(roles, parents);
            parents = result;
            callback(null);
          }
        });
      },
      function(err){
        if(err){
          callback(err);
        }else{
          callback(null, roles);
        }
      }
    );
  });
};
  
  
//
// Returns an array with resources for the given roles.
//
Acl.prototype._rolesResources = function(roleNames, callback){
  var acl = this;
  roleNames = makeArray(roleNames);
  this._allRoles(roleNames, function(err, allRoles){
    var result = [];
    async.forEach(allRoles, 
      function(roleName, callback){
        acl.redis.smembers(acl.roleResourcesKey(roleName), function(err, resourceNames){
          if(err){
            callback(err);
          }else{
            result = result.concat(resourceNames);
            callback();
          }
        });
      },
      function(err){
        callback(err, result);
    });
  });
};

//  
// Returns the permissions for the given resource and set of roles
//
Acl.prototype._resourcePermissions = function(roles, resource, callback){
  contract.params(arguments, ['array','string','function'])
  if(roles.length===0){
    callback(null, [])
  }else{
    var acl = this;
    var permissionKeys = roles.map(function(role){
      return acl.permissionsKey(role, resource);
    });

    acl.redis.sunion(permissionKeys, function(err, resourcePermissions){
      if(err) {
        callback(err);
      } else{
        acl._rolesParents(roles, function(err, parents){
          if(err) {
            callback(err);
          }else if(parents.length){
            acl._resourcePermissions(parents, resource, function(err, morePermissions){
              callback(undefined, _.union(resourcePermissions, morePermissions));
            });
          }else{
            callback(err, resourcePermissions);
          }
        });
      }
    });
  }
};
  
// NOTE: This function will not handle circular dependencies and result in a crash.
Acl.prototype._checkPermissions = function(roleNames, resourceName, permissions, callback){
  var acl = this;

  var keys = roleNames.map(function(roleName){
    return acl.permissionsKey(roleName,resourceName);
  });
  
  this.redis.sunion(keys, function(err, resourcePermissions){
    if(err){
      callback(err);
    } else if (resourcePermissions.indexOf('*') !== -1){
      callback(undefined, true);
    }else{
      permissions = permissions.filter(function(p){
        return resourcePermissions.indexOf(p) === -1;
      });

      if(permissions.length === 0){
        callback(undefined, true);
      }else{
        var parentsKeys = roleNames.map(function(roleName){
          return acl.roleParentsKey(roleName);
        });
          
        acl.redis.sunion(parentsKeys, function(err, parents){
          if(err){
            callback(err);
          } else if(parents.length){
            acl._checkPermissions( parents, resourceName, permissions, callback);
          }else{
            callback(undefined, false);
          }
        });
      }
    }
  });
};

exports = module.exports = Acl;


