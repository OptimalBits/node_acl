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
  
  acl_allows_{resourceName}_{roleName} = set(permissions)

  Note: user ids, role names and resource names are all case sensitive.
  
  Roadmap:
    - Add support for locking resources. If a user has roles that gives him permissions to lock
      a resource, then he can get exclusive write operation on the locked resource.
      This lock should expire if the resource has not been accessed in some time.
  
  
*/

var    _ = require('underscore'),
   async = require('async'),
    util = require('util'),
contract = require('./contract');

contract.debug = true;

var Acl = function (backend, logger){
  contract(arguments)
    .params('object')
    .params('object','object')
    .end();

  this.logger = logger;
  this.backend = backend;
};

/**
  addUserRoles( userId, roles, function(err) )
  
  Adds roles to a given user id.
  
  @param {String} User id.
  @param {String|Array} Role(s) to add to the user id.
  @param {Function} Callback called when finished.
*/
Acl.prototype.addUserRoles = function(userId, roles, cb){
  contract(arguments)
    .params('string','string|array','function')
    .end();

  var transaction = this.backend.begin();
  this.backend.add(transaction, 'meta', 'users', userId);
  this.backend.add(transaction, 'users', userId, roles);
  this.backend.end(transaction, cb);
};

/**
  removeUserRoles( userId, roles, function(err) )
  
  Remove roles from a given user.

  @param {String} User id.
  @param {String|Array} Role(s) to remove to the user id.
  @param {Function} Callback called when finished.
*/
Acl.prototype.removeUserRoles = function(userId, roles, cb){
  contract(arguments).params('string','string|array','function').end();
  
  var transaction = this.backend.begin();
  this.backend.remove(transaction, 'users', userId, roles);
  this.backend.end(transaction, cb);

};

/**
  userRoles( userId, function(err, roles) )

  Return all the roles from a given user.
  
  @param {String} User id.
  @param {Function} Callback called when finished.
*/
Acl.prototype.userRoles = function(userId, cb){
  contract(arguments).params('string', 'function').end();

  this.backend.get('users', userId, cb);
};

/**
  addRoleParents( role, parents, function(err) )

  Adds a parent or parent list to role.
  
  @param {String} User id.
  @param {String|Array} Role(s) to remove to the user id.
  @param {Function} Callback called when finished.
*/
Acl.prototype.addRoleParents = function(role, parents, cb){
  contract(arguments).params('string','string|array','function').end();
  
  var transaction = this.backend.begin();
  this.backend.add(transaction, 'meta', 'roles', role);
  this.backend.add(transaction, 'parents', role, parents);
  this.backend.end(transaction, cb);

};

/**
  removeRole( role, function(err) )
  
  Removes a role from the system.
  
  @param {String} Role to be removed
  @param {Function} Callback called when finished.
*/
Acl.prototype.removeRole = function(role, cb){
  contract(arguments).params('string','function').end();
  
  var self = this;
  self.backend.get('resources', role, function(err, resources){
    if(err){
      cb(err);
    }else{
      var transaction = self.backend.begin();
      resources.forEach(function(resource){
        var bucket = allowsBucket(resource);
        self.backend.del(transaction, bucket, role);
      });
      self.backend.del(transaction, 'resources', role);
      self.backend.del(transaction, 'parents', role);
      self.backend.remove(transaction, 'meta', 'roles', role);
      self.backend.end(transaction, cb);
    }
  });
};

/**
  removeResource( resource, function(err) )
  
  Removes a resource from the system
  
  @param {String} Resource to be removed
  @param {Function} Callback called when finished.
*/
Acl.prototype.removeResource = function(resource, cb){
  contract(arguments).params('string','function').end();
  
  var self = this;
  self.backend.get('meta', 'roles', function(err, roles){
    if(err){
      cb(err);
    }else{        
      var transaction = self.backend.begin();
      self.backend.del(transaction, allowsBucket(resource), roles);
      roles.forEach(function(role){
        self.backend.remove(transaction, 'resources', role, resource);
      })
      self.backend.end(transaction, cb);
    }
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
Acl.prototype.allow = function(roles, resources, permissions, cb){
  contract(arguments)
    .params('string|array','string|array','string|array','function')
    .params('array','function')
    .end();
    
  if((arguments.length===2)&&_.isObject(roles)&&_.isFunction(resources)){
    this._allowEx(roles, resources);
  }else{
    var self = this;
      
    roles = makeArray(roles);
    resources = makeArray(resources);
        
    var transaction = self.backend.begin();
    
    self.backend.add(transaction, 'meta', 'roles', roles);

    resources.forEach(function(resource){
      self.backend.add(transaction, allowsBucket(resource), roles, permissions);
    });
    
    roles.forEach(function(role){ 
      self.backend.add(transaction, 'resources', role, resources);
    });
    self.backend.end(transaction, cb);
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
Acl.prototype.removeAllow = function(role, resources, permissions, cb){
  contract(arguments)
    .params('string','string|array','string|array','function')
    .params('string','string|array','function')
    .end();
  
  var acl = this;
  resources = makeArray(resources);
  if(cb){
    permissions = makeArray(permissions);
  }else{
    cb = permissions;
    permissions = null;
  }
  
  var self = this;
  
  var transaction = self.backend.begin();
  resources.forEach(function(resource){
    var bucket = allowsBucket(resource);
    if(permissions){
      self.backend.remove(transaction, bucket, role, permissions);
    }else{
      self.backend.del(transaction, bucket, role);
      self.backend.remove(transaction, 'resources', role, resource);
    }
  });
  
  // Remove resource from role if no rights for that role exists.
  // Not fully atomic...
  self.backend.end(transaction, function(err){
    if(err){
      cb(err);
    }else{
      var transaction = self.backend.begin();
      async.forEach(resources, function(resource, done){
        var bucket = allowsBucket(resource);
        self.backend.get(bucket, role, function(err, permissions){
          if(!err && permissions.length==0){
            self.backend.remove(transaction, 'resources', role, resource);
          }
          done(err);
        })
      }, function(err){
        self.backend.end(transaction, cb);
      });
    }
  });
};
  
/**
  allowedPermissions( userId, resources, function(err, obj) )

  Returns all the allowable permissions a given user have to
  access the given resources.
  
  It returns an array of objects where every object maps a 
  resource name to a list of permissions for that resource.
  
  @param {String} User id.
  @param {String|Array} resource(s) to ask permissions for.
  @param {Function} Callback called when finished.
*/
Acl.prototype.allowedPermissions = function(userId, resources, cb){
  contract(arguments)
    .params('string', 'string|array', 'function')
    .end();
    
  var self = this;
  resources = makeArray(resources);

  self.userRoles(userId, function(err, roles){
    if(err){
      cb(err);
    } else {
      var result = {};
      async.forEach(resources, function(resource, cb){
        self._resourcePermissions(roles, resource, function(err, permissions){
          if(err){
            cb(err);
          }else{
            result[resource] = permissions;
            cb();
          }
        });
      },
      function(err){
        cb(err, result);
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
Acl.prototype.isAllowed = function(userId, resource, permissions, cb){
  contract(arguments)
    .params('string', 'string', 'string|array', 'function')
    .end();
  
  var self = this;
   
  self.backend.get('users', userId, function(err, roles){
    if(err) {
      cb(err);
    }else if(roles.length){
      self.areAnyRolesAllowed(roles, resource, permissions, cb);
    }else{
      cb(undefined, false);
    }
  });
};
  
/**
  areAnyRolesAllowed( roles, resource, permissions, function(err, allowed) )
  
  Returns true if any of the given roles have the right permissions.
  
  @param {String|Array} Role(s) to check the permissions for.
  @param {String} resource(s) to ask permissions for.
  @param {String|Array} asked permissions.
  @param {Function} Callback called with the result.
*/
Acl.prototype.areAnyRolesAllowed = function(roles, resource, permissions, cb){
  contract(arguments)
    .params('string|array', 'string', 'string|array', 'function')
    .end();
  
  roles = makeArray(roles);
  permissions = makeArray(permissions);
  
  if(roles.length===0){
    cb(undefined, false);
  }else{
    this._checkPermissions(roles, resource, permissions, cb);
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
  contract(arguments)
    .params('string|array','function') 
    .params('string|array','string|array','function')
    .end();

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
/*
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
*/

/**
  Express Middleware

*/
Acl.prototype.middleware = function(numPathComponents, userId, actions){
  contract(arguments)
    .params()
    .params('number')
    .params('number','string|function')
    .params('number','string|function', 'string|array')
    .end();

  var acl = this;
    
  var HttpError = function(errorCode, msg){
    this.errorCode = errorCode;
    this.msg = msg;
    
    Error.captureStackTrace(this, arguments);
    Error.call(this, msg);
  };

  return function(req, res, next){
    var _userId = userId, 
        resource,
        url;
        
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
       
    url = req.url.split('?')[0]; 
    if(!numPathComponents){
      resource = url;
    }else{
      resource = url.split('/').slice(0,numPathComponents+1).join('/');
    }
    
    if(!actions){
      actions = req.method.toLowerCase();
    }
    
    acl.logger?acl.logger.debug('Requesting '+actions+' on '+resource+' by user '+_userId):null;
    
    acl.isAllowed(_userId, resource, actions, function(err, allowed){
      if (err){
        next(new Error('Error checking permissions to access resource'));
      }else if(allowed === false){
        acl.logger?acl.logger.debug('Not allowed '+actions+' on '+resource+' by user '+_userId):null;
        acl.allowedPermissions(_userId, resource, function(err, obj){
          acl.logger?acl.logger.debug('Allowed permissions: '+util.inspect(obj)):null;
        });
        next(new HttpError(401,'Insufficient permissions to access resource'));
      }else{
        acl.logger?acl.logger.debug('Allowed '+actions+' on '+resource+' by user '+_userId):null;
        next();
      }
    });
  };
};


//-----------------------------------------------------------------------------
//
// Private methods
//
//-----------------------------------------------------------------------------

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
Acl.prototype._rolesParents = function(roles, cb){
  this.backend.union('parents', roles, cb);
};
  
//
// Return all roles in the hierarchy including the given roles.
//
Acl.prototype._allRoles = function(roleNames, cb){
  var self = this, roles;
  
  self._rolesParents(roleNames, function(err, parents){
    roles = _.union(roleNames, parents);
    async.whilst(
      function (){ 
        return parents.length >0;
      },
      function (cb) {
        self._rolesParents(parents, function(err, result){
          if(!err){
            roles = _.union(roles, parents);
            parents = result;
          }
          cb(err);
        });
      },
      function(err){
        cb(err, roles);
      }
    );
  });
};
  
  
//
// Returns an array with resources for the given roles.
//
Acl.prototype._rolesResources = function(roles, cb){
  var self = this;
  roles = makeArray(roles);

  self._allRoles(roles, function(err, allRoles){
    var result = [];
    async.forEach(allRoles, function(role, cb){
      self.backend.get('resources', role, function(err, resources){
        if(!err){
          result = result.concat(resources);
        }
        cb(err);
      })
    },
    function(err){
      cb(err, result);
    });
  });
};

//  
// Returns the permissions for the given resource and set of roles
//
Acl.prototype._resourcePermissions = function(roles, resource, cb){
  contract(arguments)
    .params('array','string','function')
    .end();
    
  var self = this;
  
  if(roles.length===0){
    cb(null, []);
  }else{
    self.backend.union(allowsBucket(resource), roles, function(err, resourcePermissions){
      if(err) {
        cb(err);
      } else{
        self._rolesParents(roles, function(err, parents){
          if(err) {
            cb(err);
          }else if(parents.length){
            self._resourcePermissions(parents, resource, function(err, morePermissions){
              cb(undefined, _.union(resourcePermissions, morePermissions));
            });
          }else{
            cb(err, resourcePermissions);
          }
        });
      }
    });
  }
};
  
//
// NOTE: This function will not handle circular dependencies and result in a crash.
//
Acl.prototype._checkPermissions = function(roles, resource, permissions, cb){
  var self = this;

  self.backend.union(allowsBucket(resource), roles, function(err, resourcePermissions){
    if(err){
      cb(err);
    } else if (resourcePermissions.indexOf('*') !== -1){
      cb(err, true);
    }else{
      permissions = permissions.filter(function(p){
        return resourcePermissions.indexOf(p) === -1;
      });

      if(permissions.length === 0){
        cb(err, true);
      }else{    
        self.backend.union('parents', roles, function(err, parents){
          if(err){
            cb(err);
          } else if(parents && parents.length){
            self._checkPermissions(parents, resource, permissions, cb);
          }else{
            cb(err, false);
          }
        });
      }
    }
  });
};



//-----------------------------------------------------------------------------
//
// Helpers
//
//-----------------------------------------------------------------------------

function makeArray(arr){
  return Array.isArray(arr) ? arr : [arr];
}

function allowsBucket(role){
  return 'allows_'+role;
}


// -----------------------------------------------------------------------------------


exports = module.exports = Acl;


