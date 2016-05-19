/**
  ACL System inspired on Zend_ACL.

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
"use strict";

var    _ = require('lodash'),
    util = require('util'),
bluebird = require('bluebird'),
contract = require('./contract');

contract.debug = true;

var Acl = function (backend, logger, options){
  contract(arguments)
    .params('object')
    .params('object','object')
    .params('object','object', 'object')
    .end();

  options = _.extend({
    buckets: {
      meta: 'meta',
      parents: 'parents',
      permissions: 'permissions',
      resources: 'resources',
      roles: 'roles',
      users: 'users'
    }
  }, options);

  this.logger = logger;
  this.backend = backend;
  this.options = options;

  // Promisify async methods
  backend.endAsync = bluebird.promisify(backend.end);
  backend.getAsync = bluebird.promisify(backend.get);
  backend.cleanAsync = bluebird.promisify(backend.clean);
  backend.unionAsync = bluebird.promisify(backend.union);
  if (backend.unions) {
    backend.unionsAsync = bluebird.promisify(backend.unions);
  }
};

/**
  addUserRoles( userId, roles, function(err) )

  Adds roles to a given user id.

  @param {String|Number} User id.
  @param {String|Array} Role(s) to add to the user id.
  @param {Function} Callback called when finished.
  @return {Promise} Promise resolved when finished
*/
Acl.prototype.addUserRoles = function(userId, roles, cb){
  contract(arguments)
    .params('string|number','string|array','function')
    .params('string|number','string|array')
    .end();

  var transaction = this.backend.begin();
  this.backend.add(transaction, this.options.buckets.meta, 'users', userId);
  this.backend.add(transaction, this.options.buckets.users, userId, roles);

  if (Array.isArray(roles)) {
    var _this = this;

      roles.forEach(function(role) {
        _this.backend.add(transaction, _this.options.buckets.roles, role, userId);
      });
  }
  else {
      this.backend.add(transaction, this.options.buckets.roles, roles, userId);
  }

  return this.backend.endAsync(transaction).nodeify(cb);
};

/**
  removeUserRoles( userId, roles, function(err) )

  Remove roles from a given user.

  @param {String|Number} User id.
  @param {String|Array} Role(s) to remove to the user id.
  @param {Function} Callback called when finished.
  @return {Promise} Promise resolved when finished
*/
Acl.prototype.removeUserRoles = function(userId, roles, cb){
  contract(arguments)
    .params('string|number','string|array','function')
    .params('string|number','string|array')
    .end();

  var transaction = this.backend.begin();
  this.backend.remove(transaction, this.options.buckets.users, userId, roles);

  if (Array.isArray(roles)) {
    var _this = this;

    roles.forEach(function(role) {
      _this.backend.remove(transaction, _this.options.buckets.roles, role, userId);
    });
  }
  else {
    this.backend.remove(transaction, this.options.buckets.roles, roles, userId);
  }

  return this.backend.endAsync(transaction).nodeify(cb);
};

/**
  userRoles( userId, function(err, roles) )

  Return all the roles from a given user.

  @param {String|Number} User id.
  @param {Function} Callback called when finished.
  @return {Promise} Promise resolved with an array of user roles
*/
Acl.prototype.userRoles = function(userId, cb){
  return this.backend.getAsync(this.options.buckets.users, userId).nodeify(cb);
};

/**
    roleUsers( roleName, function(err, users) )

    Return all users who has a given role.
    @param {String|Number} rolename.
    @param {Function} Callback called when finished.
    @return {Promise} Promise resolved with an array of users
 */
Acl.prototype.roleUsers = function(roleName, cb){
  return this.backend.getAsync(this.options.buckets.roles, roleName).nodeify(cb);
};

/**
  hasRole( userId, rolename, function(err, is_in_role) )

  Return boolean whether user is in the role

  @param {String|Number} User id.
  @param {String|Number} rolename.
  @param {Function} Callback called when finished.
  @return {Promise} Promise resolved with boolean of whether user is in role
*/
Acl.prototype.hasRole = function(userId, rolename, cb){
  return this.userRoles(userId).then(function(roles){
    return roles.indexOf(rolename) != -1;
  }).nodeify(cb);
};

/**
  addRoleParents( role, parents, function(err) )

  Adds a parent or parent list to role.

  @param {String} Child role.
  @param {String|Array} Parent role(s) to be added.
  @param {Function} Callback called when finished.
  @return {Promise} Promise resolved when finished
*/
Acl.prototype.addRoleParents = function(role, parents, cb){
  contract(arguments)
    .params('string|number','string|array','function')
    .params('string|number','string|array')
    .end();

  var transaction = this.backend.begin();
  this.backend.add(transaction, this.options.buckets.meta, 'roles', role);
  this.backend.add(transaction, this.options.buckets.parents, role, parents);
  return this.backend.endAsync(transaction).nodeify(cb);
};

/**
  removeRoleParents( role, parents, function(err) )

  Removes a parent or parent list from role.

  If `parents` is not specified, removes all parents.

  @param {String} Child role.
  @param {String|Array} Parent role(s) to be removed [optional].
  @param {Function} Callback called when finished [optional].
  @return {Promise} Promise resolved when finished.
*/
Acl.prototype.removeRoleParents = function(role, parents, cb){
  contract(arguments)
    .params('string', 'string|array', 'function')
    .params('string', 'string|array')
    .params('string', 'function')
    .params('string')
    .end();

  if (!cb && _.isFunction(parents)) {
    cb = parents;
    parents = null;
  }

  var transaction = this.backend.begin();
  if (parents) {
    this.backend.remove(transaction, this.options.buckets.parents, role, parents);
  } else {
    this.backend.del(transaction, this.options.buckets.parents, role);
  }
  return this.backend.endAsync(transaction).nodeify(cb);
};

/**
  removeRole( role, function(err) )

  Removes a role from the system.

  @param {String} Role to be removed
  @param {Function} Callback called when finished.
*/
Acl.prototype.removeRole = function(role, cb){
  contract(arguments)
    .params('string','function')
    .params('string').end();

  var _this = this;
  // Note that this is not fully transactional.
  return this.backend.getAsync(this.options.buckets.resources, role).then(function(resources){
    var transaction = _this.backend.begin();

    resources.forEach(function(resource){
      var bucket = allowsBucket(resource);
      _this.backend.del(transaction, bucket, role);
    });

    _this.backend.del(transaction, _this.options.buckets.resources, role);
    _this.backend.del(transaction, _this.options.buckets.parents, role);
    _this.backend.del(transaction, _this.options.buckets.roles, role)
    _this.backend.remove(transaction, _this.options.buckets.meta, 'roles', role);

    // `users` collection keeps the removed role
    // because we don't know what users have `role` assigned.
    return _this.backend.endAsync(transaction);
  }).nodeify(cb);
};

/**
  removeResource( resource, function(err) )

  Removes a resource from the system

  @param {String} Resource to be removed
  @param {Function} Callback called when finished.
  @return {Promise} Promise resolved when finished
*/
Acl.prototype.removeResource = function(resource, cb){
  contract(arguments)
    .params('string', 'function')
    .params('string')
    .end();

  var _this = this;
  return this.backend.getAsync(this.options.buckets.meta, 'roles').then(function(roles){
    var transaction = _this.backend.begin();
    _this.backend.del(transaction, allowsBucket(resource), roles);
    roles.forEach(function(role){
      _this.backend.remove(transaction, _this.options.buckets.resources, role, resource);
    })
    return _this.backend.endAsync(transaction);
  }).nodeify(cb)
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
  @return {Promise} Promise resolved when finished
*/
Acl.prototype.allow = function(roles, resources, permissions, cb){
  contract(arguments)
    .params('string|array','string|array','string|array','function')
    .params('string|array','string|array','string|array')
    .params('array','function')
    .params('array')
    .end();

  if((arguments.length == 1) || ((arguments.length===2)&&_.isObject(roles)&&_.isFunction(resources))){
    return this._allowEx(roles).nodeify(resources);
  }else{
    var _this = this;

    roles = makeArray(roles);
    resources = makeArray(resources);

    var transaction = _this.backend.begin();

    _this.backend.add(transaction, _this.options.buckets.meta, 'roles', roles);

    resources.forEach(function(resource){
      roles.forEach(function(role){
        _this.backend.add(transaction, allowsBucket(resource), role, permissions);
      });
    });

    roles.forEach(function(role){
      _this.backend.add(transaction, _this.options.buckets.resources, role, resources);
    });

    return _this.backend.endAsync(transaction).nodeify(cb);
  }
};


Acl.prototype.removeAllow = function(role, resources, permissions, cb){
  contract(arguments)
    .params('string','string|array','string|array','function')
    .params('string','string|array','string|array')
    .params('string','string|array','function')
    .params('string','string|array')
    .end();

    resources = makeArray(resources);
    if(cb || (permissions && !_.isFunction(permissions))){
      permissions = makeArray(permissions);
    }else {
      cb = permissions;
      permissions = null;
    }

  return this.removePermissions(role, resources, permissions, cb);
}

/**
  removePermissions( role, resources, permissions)

  Remove permissions from the given roles owned by the given role.

  Note: we loose atomicity when removing empty role_resources.

  @param {String}
  @param {String|Array}
  @param {String|Array}
*/
Acl.prototype.removePermissions = function(role, resources, permissions, cb){

  var _this = this;

  var transaction = _this.backend.begin();
  resources.forEach(function(resource){
    var bucket = allowsBucket(resource);
    if(permissions){
      _this.backend.remove(transaction, bucket, role, permissions);
    }else{
      _this.backend.del(transaction, bucket, role);
      _this.backend.remove(transaction, _this.options.buckets.resources, role, resource);
    }
  });

  // Remove resource from role if no rights for that role exists.
  // Not fully atomic...
  return _this.backend.endAsync(transaction).then(function(){
    var transaction = _this.backend.begin();
    return bluebird.all(resources.map(function(resource){
      var bucket = allowsBucket(resource);
      return _this.backend.getAsync(bucket, role).then(function(permissions){
        if(permissions.length==0){
          _this.backend.remove(transaction, _this.options.buckets.resources, role, resource);
        }
      });
    })).then(function(){
      return _this.backend.endAsync(transaction);
    });
  }).nodeify(cb);
};

/**
  allowedPermissions( userId, resources, function(err, obj) )

  Returns all the allowable permissions a given user have to
  access the given resources.

  It returns an array of objects where every object maps a
  resource name to a list of permissions for that resource.

  @param {String|Number} User id.
  @param {String|Array} resource(s) to ask permissions for.
  @param {Function} Callback called when finished.
*/
Acl.prototype.allowedPermissions = function(userId, resources, cb){
  if (!userId)
    return cb(null, {});

  contract(arguments)
    .params('string|number', 'string|array', 'function')
    .params('string|number', 'string|array')
    .end();

  if (this.backend.unionsAsync) {
    return this.optimizedAllowedPermissions(userId, resources, cb);
  }

  var _this = this;
  resources = makeArray(resources);

  return _this.userRoles(userId).then(function(roles){
    var result = {};
    return bluebird.all(resources.map(function(resource){
      return _this._resourcePermissions(roles, resource).then(function(permissions){
        result[resource] = permissions;
      });
    })).then(function(){
      return result;
    });
  }).nodeify(cb);
};

/**
  optimizedAllowedPermissions( userId, resources, function(err, obj) )

  Returns all the allowable permissions a given user have to
  access the given resources.

  It returns a map of resource name to a list of permissions for that resource.

  This is the same as allowedPermissions, it just takes advantage of the unions
  function if available to reduce the number of backend queries.

  @param {String|Number} User id.
  @param {String|Array} resource(s) to ask permissions for.
  @param {Function} Callback called when finished.
*/
Acl.prototype.optimizedAllowedPermissions = function(userId, resources, cb){
  if (!userId) {
    return cb(null, {});
  }

  contract(arguments)
    .params('string|number', 'string|array', 'function|undefined')
    .params('string|number', 'string|array')
    .end();

  resources = makeArray(resources);
  var self = this;

  return this._allUserRoles(userId).then(function(roles) {
    var buckets = resources.map(allowsBucket);
    if (roles.length === 0) {
      var emptyResult = {};
      buckets.forEach(function(bucket) {
        emptyResult[bucket] = [];
      });
      return bluebird.resolve(emptyResult);
    }

    return self.backend.unionsAsync(buckets, roles);
  }).then(function(response) {
    var result = {};
    Object.keys(response).forEach(function(bucket) {
      result[keyFromAllowsBucket(bucket)] = response[bucket];
    });

    return result;
  }).nodeify(cb);
};

/**
  isAllowed( userId, resource, permissions, function(err, allowed) )

  Checks if the given user is allowed to access the resource for the given
  permissions (note: it must fulfill all the permissions).

  @param {String|Number} User id.
  @param {String|Array} resource(s) to ask permissions for.
  @param {String|Array} asked permissions.
  @param {Function} Callback called wish the result.
*/
Acl.prototype.isAllowed = function(userId, resource, permissions, cb){
  contract(arguments)
    .params('string|number', 'string', 'string|array', 'function')
    .params('string|number', 'string', 'string|array')
    .end();

  var _this = this;

  return this.backend.getAsync(this.options.buckets.users, userId).then(function(roles){
    if(roles.length){
      return _this.areAnyRolesAllowed(roles, resource, permissions);
    }else{
      return false;
    }
  }).nodeify(cb);
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
    .params('string|array', 'string', 'string|array')
    .end();

  roles = makeArray(roles);
  permissions = makeArray(permissions);

  if(roles.length===0){
    return bluebird.resolve(false).nodeify(cb);
  }else{
    return this._checkPermissions(roles, resource, permissions).nodeify(cb);
  }
};

/**
  whatResources(role, function(err, {resourceName: [permissions]})

  Returns what resources a given role or roles have permissions over.

  whatResources(role, permissions, function(err, resources) )

  Returns what resources a role has the given permissions over.

  @param {String|Array} Roles
  @param {String[Array} Permissions
  @param {Function} Callback called wish the result.
*/
Acl.prototype.whatResources = function(roles, permissions, cb){
  contract(arguments)
    .params('string|array')
    .params('string|array','string|array')
    .params('string|array','function')
    .params('string|array','string|array','function')
    .end();

  roles = makeArray(roles);
  if (_.isFunction(permissions)){
    cb = permissions;
    permissions = undefined;
  }else if(permissions){
    permissions = makeArray(permissions);
  }

  return this.permittedResources(roles, permissions, cb);
};

Acl.prototype.permittedResources = function(roles, permissions, cb){
  var _this = this;
  var result = _.isUndefined(permissions) ? {} : [];
  return this._rolesResources(roles).then(function(resources){
    return bluebird.all(resources.map(function(resource){
      return _this._resourcePermissions(roles, resource).then(function(p){
        if(permissions){
          var commonPermissions = _.intersection(permissions, p);
          if(commonPermissions.length>0){
            result.push(resource);
          }
        }else{
          result[resource] = p;
        }
      });
    })).then(function(){
      return result;
    });
  }).nodeify(cb);
}

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
    .params('number','string|number|function')
    .params('number','string|number|function', 'string|array')
    .end();

  var acl = this;

  function HttpError(errorCode, msg){
    this.errorCode = errorCode;
    this.message = msg;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
    this.constructor.prototype.__proto__ = Error.prototype;
  }

  return function(req, res, next){
    var _userId = userId,
        _actions = actions,
        resource,
        url;

    // call function to fetch userId
    if(typeof userId === 'function'){
      _userId = userId(req, res);
    }
    if (!userId) {
      if((req.session) && (req.session.userId)){
        _userId = req.session.userId;
      }else if((req.user) && (req.user.id)){
        _userId = req.user.id;
      }else{
        next(new HttpError(401, 'User not authenticated'));
        return;
      }
    }

    // Issue #80 - Additional check
    if (!_userId) {
      next(new HttpError(401, 'User not authenticated'));
      return;
    }

    url = req.originalUrl.split('?')[0];
    if(!numPathComponents){
      resource = url;
    }else{
      resource = url.split('/').slice(0,numPathComponents+1).join('/');
    }

    if(!_actions){
      _actions = req.method.toLowerCase();
    }

    acl.logger?acl.logger.debug('Requesting '+_actions+' on '+resource+' by user '+_userId):null;

    acl.isAllowed(_userId, resource, _actions, function(err, allowed){
      if (err){
        next(new Error('Error checking permissions to access resource'));
      }else if(allowed === false){
        if (acl.logger) {
          acl.logger.debug('Not allowed '+_actions+' on '+resource+' by user '+_userId);
          acl.allowedPermissions(_userId, resource, function(err, obj){
            acl.logger.debug('Allowed permissions: '+util.inspect(obj));
          });
        }
        next(new HttpError(403,'Insufficient permissions to access resource'));
      }else{
        acl.logger?acl.logger.debug('Allowed '+_actions+' on '+resource+' by user '+_userId):null;
        next();
      }
    });
  };
};

/**
  Error handler for the Express middleware

  @param {String} [contentType] (html|json) defaults to plain text
*/
Acl.prototype.middleware.errorHandler = function(contentType){
  var method = 'end';

  if(contentType){
    switch (contentType) {
      case 'json': method = 'json'; break;
      case 'html': method = 'send'; break;
    }
  }

  return function(err, req, res, next){
    if(err.name !== 'HttpError' || !err.errorCode) return next(err);
    res.status(err.errorCode)[method](err.message);
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
Acl.prototype._allowEx = function(objs){
  var _this = this;
  objs = makeArray(objs);

  var demuxed = [];
  objs.forEach(function(obj){
    var roles = obj.roles;
    obj.allows.forEach(function(allow){
      demuxed.push({
        roles:roles,
        resources:allow.resources,
        permissions:allow.permissions});
    });
  });

  return bluebird.reduce(demuxed, function(values, obj){
    return _this.allow(obj.roles, obj.resources, obj.permissions);
  }, null);
};

//
// Returns the parents of the given roles
//
Acl.prototype._rolesParents = function(roles){
  return this.backend.unionAsync(this.options.buckets.parents, roles);
};

//
// Return all roles in the hierarchy including the given roles.
//
/*
Acl.prototype._allRoles = function(roleNames, cb){
  var _this = this, roles;

  _this._rolesParents(roleNames, function(err, parents){
    roles = _.union(roleNames, parents);
    async.whilst(
      function (){
        return parents.length >0;
      },
      function (cb) {
        _this._rolesParents(parents, function(err, result){
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
*/
//
// Return all roles in the hierarchy including the given roles.
//
Acl.prototype._allRoles = function(roleNames){
  var _this = this;

  return this._rolesParents(roleNames).then(function(parents){
    if(parents.length > 0){
      return _this._allRoles(parents).then(function(parentRoles){
        return _.union(roleNames, parentRoles);
      });
    }else{
      return roleNames;
    }
  });
};

//
// Return all roles in the hierarchy of the given user.
//
Acl.prototype._allUserRoles = function(userId) {
  var _this = this;

  return this.userRoles(userId).then(function(roles) {
    if (roles && roles.length > 0) {
      return _this._allRoles(roles);
    } else {
      return [];
    }
  });
};

//
// Returns an array with resources for the given roles.
//
Acl.prototype._rolesResources = function(roles){
  var _this = this;
  roles = makeArray(roles);

  return this._allRoles(roles).then(function(allRoles){
    var result = [];

    // check if bluebird.map simplifies this code
    return bluebird.all(allRoles.map(function(role){
      return _this.backend.getAsync(_this.options.buckets.resources, role).then(function(resources){
        result = result.concat(resources);
      });
    })).then(function(){
      return result;
    });
  });
};

//
// Returns the permissions for the given resource and set of roles
//
Acl.prototype._resourcePermissions = function(roles, resource){
  var _this = this;

  if(roles.length===0){
    return bluebird.resolve([]);
  }else{
    return this.backend.unionAsync(allowsBucket(resource), roles).then(function(resourcePermissions){
      return _this._rolesParents(roles).then(function(parents){
        if(parents && parents.length){
          return _this._resourcePermissions(parents, resource).then(function(morePermissions){
            return _.union(resourcePermissions, morePermissions);
          });
        }else{
          return resourcePermissions;
        }
      });
    });
  }
};

//
// NOTE: This function will not handle circular dependencies and result in a crash.
//
Acl.prototype._checkPermissions = function(roles, resource, permissions){
  var _this = this;

  return this.backend.unionAsync(allowsBucket(resource), roles).then(function(resourcePermissions){
    if (resourcePermissions.indexOf('*') !== -1){
      return true;
    }else{
      permissions = permissions.filter(function(p){
        return resourcePermissions.indexOf(p) === -1;
      });

      if(permissions.length === 0){
        return true;
      }else{
        return _this.backend.unionAsync(_this.options.buckets.parents, roles).then(function(parents){
          if(parents && parents.length){
            return _this._checkPermissions(parents, resource, permissions);
          }else{
            return false;
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

function keyFromAllowsBucket(str) {
  return str.replace(/^allows_/, '');
}


// -----------------------------------------------------------------------------------


exports = module.exports = Acl;
