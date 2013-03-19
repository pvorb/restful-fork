
exports['show all'] = function(resource, request, handler) {
  resource.all(handler);
};

exports['create'] = function(resource, request, handler) {
  resource.create(request.body, handler);
};

exports['show'] = function(resource, request, handler) {
  if (typeof request.id == 'string' && /\d+/.test(request.id))
    request.id = parseInt(request.id);
  
  resource.get({ _id: request.id }, handler);
};
