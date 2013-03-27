/**
 * @classdesc This class encapsulates all concrete operations that define access
 *            to the underlying resources. You can override single operations
 *            for all resources as well as specific resources.
 * 
 * @constructor
 * @module
 */
function Operator() {
  this.actions = {};
}

module.exports = Operator;

function isNotAcceptable(request) {
  var accept = request.request.headers.accept;
  console.log(accept);
  if (accept && accept.indexOf('application/json') === -1
      && accept.indexOf('*/*') === -1)
    return {
      status : 406,
      message : "Not Acceptable. The client does not accept the content type 'application/json'."
    };

  return false;
}

/**
 * Overrides the action. If resource is provided, it only overrides the behavior
 * for this resource.
 * 
 * @param {String}
 *                action name of the action
 * @param {String}
 *                [resource] name of the resource
 * @param {Function(resource,request,handler)}
 *                operation operation to apply for that action
 */
Operator.prototype.override = function(action, resource, operation) {
  if (arguments.length == 2) {
    operation = resource;

    this.actions[action] = operation;
  } else {
    if (typeof this.actions[action] == 'undefined') {
      this.actions[action] = function(a, b, handler) {
        handler(new Error('action ' + action + ' is undefined'));
      };
    }

    this.actions[action][resource] = operation;
  }
};

/**
 * Applies an action for a resource.
 * 
 * @param {String}
 *                action
 * @param {String}
 *                resourceName
 * @param {Resource}
 *                resource
 * @param {HttpRequest}
 *                request
 * @param {Function(err,respond)}
 */
Operator.prototype.apply = function(action, resourceName, resource, request,
    handler) {
  var err = isNotAcceptable(request);
  if (err)
    return handler(err);
  
  if (typeof this.actions[action][resourceName] != 'undefined')
    this.actions[action][resourceName](resource, request, handler);
  else
    this.actions[action](resource, request, handler);
};
