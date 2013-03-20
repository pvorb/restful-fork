function Operator() {
  this.actions = {};
}

module.exports = Operator;

/**
 * Overrides the action. If resource is provided, it only overrides the behavior
 * for this resource.
 * 
 * @param {String}
 *                action name of the action
 * @param {String}
 *                [resource] name of the resource
 * @param {Function(resource,
 *                request, handler)} operation operation to apply for that
 *                action
 */
Operator.prototype.override = function(action, resource, operation) {
  if (arguments.length == 2) {
    operation = resource;

    this.actions[action] = operation;
  } else {
    if (typeof this.actions[action] == 'undefined') {
      this.actions[action] = function(a, b, handler) {
        handler(new Error('action '+action+' is undefined'));
      };
    }
    
    this.actions[action][resource] = operation;
  }
};

/**
 * Applies an action for a resource. 
 */
Operator.prototype.apply = function(action, resourceName, resource, request,
    handler) {
  if (typeof this.actions[action][resourceName] != 'undefined')
    this.actions[action][resourceName](resource, request, handler);
  else
    this.actions[action](resource, request, handler);
};
