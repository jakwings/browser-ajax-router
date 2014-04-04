/******************************************************************************\
 * Date: 2014-04-05 00:03:04 +08:00
 * Author: Jak Wings
 * License: MIT Licensed
 * Website: https://github.com/jakwings/browser-ajax-router
 * Description: A simple AJAX router for modern browsers that support History
 *   API or hashchange events.
 * Platforms: Chrome5.0(+), Firefox3.6(+), IE8.0(+), Opera10.6(+), Safari5.0(+)
\******************************************************************************/
;
(function (window) {
'use strict';

var document = window.document;


/******************************************************************************\
 * Helpers
\******************************************************************************/

if (!Array.prototype.filter) {
  Array.prototype.filter = function (filter, that) {
    var other = [], v;
    for (var i = 0, l = this.length; i < l; i++) {
      if ((i in this) && filter.call(that, v = this[i], i, this)) {
        other.push(v);
      }
    }
    return other;
  };
}

if (!Array.prototype.forEach) {
  Array.prototype.forEach = function (callback, that) {
    for (var i = 0, l = this.length; i < l; i++) {
      if (i in this) {
        callback.call(that, this[i], i, this);
      }
    }
  };
}

if (!Array.isArray) {
  Array.isArray = function (obj) {
    return Object.prototype.toString.call(obj) === '[object Array]';
  };
}

var flatten = function (arr) {
  var res = [];
  for (var i = 0, l = arr.length; i < l; i++) {
    if (!Array.isArray(arr[i])) {
      res.push(arr[i]);
    } else {
      res = res.concat(flatten(arr[i]));
    }
  }
  return res;
};

var quotemeta = function (str) {
  return str.replace(/([.\\+*?\^\[\]$(){}])/g, '\\$1');
};

/**
 * merges multiple objects' properties and returns the object
 * @type {function(Object, ...[Object])}
 * @param {Object} obj which object to merge into
 * @return {Object}
 */
var merge = function (obj) {
  var target;
  for (var i = 1, l = arguments.length; i < l; i++) {
    target = arguments[i];
    for (var key in target) {
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        obj[key] = target[key];
      }
    }
  }
  return obj;
};

var queue = function (jobs) {
  var scope = this;
  var start = function (toContinue) {
    if ((toContinue !== false) && jobs.length && !this.called) {
      this.called = true;
      var next = function (toContinue) {
        start.call(next, toContinue);
      };
      jobs.shift().call(scope, next);
    }
  };
  start.call(start);
};


/******************************************************************************\
 * Router
\******************************************************************************/

/**
 * @constructor
 * @param {object} routes
 * @param {object=} opts
 */
var Router = function (routes, opts) {
  this.methods = ['on', 'after', 'before'];
  this.routes = {};
  this.params = {};
  this._methods = {};
  this.onHashChange = null;
  this.onLoad = null;
  this.onUnload = null;
  this._oldPath = '/';
  this._oldOnHashChange = null;
  this._oldOnLoad = null;
  this._oldOnUnload = null;
  this._initiated = false;
  this.configure(opts);
  this.mount(routes);
};

/**
 * @param {object} opts
 * @return {this}
 */
Router.prototype.configure = function (opts) {
  var self = this;
  self.options = merge({}, Router.defaults, opts || {});
  for (var i = 0, l = self.methods.length; i < l; i++) {
    self._methods[self.methods[i]] = true;
  }
  self.onHashChange = self.onHashChange || function (evt) {
    var newHash = window.location.hash;
    var newPath = null;
    var oldPath = self._oldPath;
    if (newHash.substr(0, self.options.marker.length) === self.options.marker) {
      evt.preventDefault();
      newPath = newHash.substr(self.options.marker.length);
    }
    if ((newPath !== null) && (newPath !== oldPath)) {
      self.dispatch('after', oldPath);
      self.dispatch('before', newPath);
      self.dispatch('on', newPath);
    }
  };
  self.onBeforeUnload = self.onBeforeUnload || function () {
    self.dispatch('after', self._oldPath);
  };
  self.onLoad = self.onLoad || function () {
    self.dispatch('before', self._oldPath);
    self.dispatch('on', self._oldPath);
  };
  return self;
};

/**
 * @param {string} path
 * @return {this}
 */
Router.prototype.init = function (path) {
  path = path || '';
  var hash = window.location.hash;
  if (!path && hash) {
    if (hash.substr(0, this.options.marker.length) === this.options.marker) {
      path = hash.substr(this.options.marker.length);
    }
  } else if (path) {
    if (path.substr(0, this.options.baseUrl.length) === this.options.baseUrl) {
      path = path.substr(this.options.baseUrl.length);
    }
  }
  path = '/' + path.split('/').filter(function (p) { return p; }).join('/');
  this._oldPath = path;
  if ('onhashchange' in window) {
    window.removeEventListener('hashchange', this._oldOnHashChange, false);
    window.addEventListener('hashchange', this.onHashChange, false);
    window.removeEventListener('beforeunload', this._oldOnBeforeUnload, false);
    window.addEventListener('beforeunload', this.onBeforeUnload, false);
    if (document.readyState !== 'complete') {
      window.removeEventListener('load', this._oldOnLoad, false);
      window.addEventListener('load', this.onLoad, false);
    } else {
      if (!this._oldOnLoad) { setTimeout(this.onLoad, 0); }
    }
    this._oldOnHashChange = this.onHashChange;
    this._oldOnBeforeUnload = this.onBeforeUnload;
    this._oldOnLoad = this.onLoad;
  } else {
    throw new Error('This browser is outdated.');
  }
  return this;
};

/**
 * @param {string} method
 * @param {string} path
 * @param {function=} callback
 * @return {this}
 */
Router.prototype.dispatch = function (method, path, callback) {
  if (!this._methods[method]) {
    return this;
  }
  this.auto(method);
  path = path.split('/').filter(function (p) { return p; });
  path.unshift('/');
  var self = this;
  var m = '/';
  var url = '/' + path.slice(1).join('/');
  if ((method === 'on') || (method === 'before')) {
    if ((self._oldPath === url) && self._initiated) {
      return self;
    }
    if (method === 'on') {
      self._initiated = true;
      self._oldPath = url;
      if (self.options.history) {
        if (url !== '/') {
          if (!self.options.nomarker) {
            window.history.pushState({}, '',
                self.options.baseUrl + self.options.marker + url);
          } else {
            window.history.pushState({}, '',
                self.options.baseUrl + url.substr(1));
          }
        } else {
          window.history.pushState({}, '', self.options.baseUrl);
        }
      } else {
        window.location.assign(self.options.marker + url);
      }
    }
  }
  var handlers = [];
  var parameters = [];
  var hasRoute = true;
  for (var i = 0, part, routes = self.routes; part = path[i]; i++) {
    var route = '/';
    var matches = null;
    if (i !== 0) {
      for (var k in routes) {
        if (k.charAt(0) === '/') {
          continue;
        }
        if (matches = (new RegExp(k)).exec(part)) {
          route = k;
          break;
        }
      }
    }
    if (!routes[route]) {
      hasRoute = false;
      break;
    } else if (routes[route][m+method]) {
      handlers.push(routes[route][m+method]);
    }
    if (matches && (matches.length > 1)) {
      parameters.push(matches.slice(1));
    }
    routes = routes[route];
  }
  if (!hasRoute) {
    if (this.options.notfound) {
      [].concat(this.options.notfound).forEach(function (f) {
        f.call(this);
      });
    }
    return self;
  }
  var alt = false;
  switch (self.options.recurse) {
    case 'backward':
      alt = true;
    case 'forward':
      var handler;
      if (!self.options.async) {
        var i = alt ? (handlers.length - 1) : 0;
        while (handler = handlers[i]) {
          var args = flatten(parameters.slice(0, i));
          if (!Array.isArray(handler)) {
            if (handler.apply(self, args) === false) {
              break;
            }
          } else {
            var toBreak = false;
            for (var j = 0, subHandler; subHandler = handler[j]; j++) {
              if (subHandler.apply(self, args) === false) {
                toBreak = true;
              }
            }
            if (toBreak) {
              break;
            }
          }
          i += alt ? -1 : 1;
        }
        if (callback) { callback() }
      } else {
        for (var i = 0; handler = handlers[i]; i++) {
          var args = flatten(parameters.slice(0, i));
          if (!Array.isArray(handler)) {
            (function (handler, args) {
              handlers[i] = function (next) {
                handler.apply(self, args.concat(next));
              };
            })(handler, args);
          } else {
            (function (handler, args) {
              handlers[i] = function (next) {
                args.push(next);
                for (var j = 0, subHandler; subHandler = handler[j]; j++) {
                  subHandler.apply(self, args);
                }
              };
            })(handler, args);
          }
        }
        if (alt) { handlers.reverse(); }
        if (callback) { handlers.push(callback); }
        queue(handlers);
      }
      break;
    default:
      var handler = handlers.pop();
      var args = flatten(parameters);
      if (!self.options.async) {
        if (!Array.isArray(handler)) {
          handler.apply(self, args);
        } else {
          for (var i = 0, subHandler; subHandler = handler[i]; i++) {
            subHandler.apply(self, args);
          }
        }
        if (callback) { callback(); }
      } else {
        var jobs = [];
        if (!Array.isArray(handler)) {
          jobs.push(function (next) {
            handler.apply(self, args.concat(next));
          });
        } else {
          jobs.push(function (next) {
            args.push(next);
            for (var j = 0, subHandler; subHandler = handler[j]; j++) {
              subHandler.apply(self, args);
            }
          });
        }
        if (callback) { jobs.push(callback); }
        queue(jobs);
      }
      break;
  }
  return self;
};

Router.prototype.auto = function (method) {
  if (this._methods[method] && this.options[method]) {
    [].concat(this.options[method]).forEach(function (f) {
      f.call(this);
    });
  }
  return this;
};

/**
 * @param {string} token
 * @param {(string|RegExp)} matcher
 * @return {this}
 */
Router.prototype.param = function (token, matcher) {
  if (/^[A-Za-z]+$/.test(token)) {
    token = '<' + token + '>';
    this.params[token] = matcher.source || matcher;
  }
  return this;
};

/**
 * @param {(string|Array.<string>)} method
 * @param {(string|RegExp|Array)} path
 * @param {(function|Array.<function>)} handler
 * @return {this}
 *
 * @param {(string|RegExp|Array)} method:path
 * @param {(function|Array.<function>)} path:handler
 * @return {this}
 */
Router.prototype.route = function (method, path, handler) {
  var self = this;
  if (!handler) {
    handler = path;
    path = method;
    method = 'on';
  }
  if (Array.isArray(path)) {
    for (var i = 0, l = path.length; i < l; i++) {
      self.route(method, path[i], handler);
    }
    return this;
  }
  if (Array.isArray(method)) {
    for (var i = 0, l = method.length; i < l; i++) {
      self.route(method[i], path, handler);
    }
    return this;
  }
  if (path.source) {
    path = path.source.replace(/\\\//g, '/');
  }
  path = path.split('/');
  return this._insert(method, path, handler);
};

Router.prototype._insert = function (method, path, handler, parent) {
  var self = this;
  var m = '/';
  parent = parent || self.routes;
  path = path.filter(function (p) { return p; });
  if (parent === self.routes) { path.unshift('/'); }
  var part = path.shift();
  part = part.replace(/<[A-Za-z]+>/g, function (token) {
    return self.params[token] || quotemeta(token);
  });
  if (path.length) {
    parent[part] = parent[part] || {};
    return self._insert(method, path, handler, parent[part]);
  }
  var parentType = typeof parent[part];
  if (parent[part] &&
      (parentType === 'object') &&
      !Array.isArray(parent[part])) {
    var methodType = typeof parent[part][m+method];
    switch (methodType) {
      case 'function':
        parent[part][m+method] = [parent[part][m+method], handler];
        return self;
      case 'object':  // Array
        parent[part][m+method] = parent[part][m+method].concat(handler);
        return self;
      default:
        parent[part][m+method] = handler;
        return self;
    }
  }
  var nested = {};
  nested[m+method] = handler;
  parent[part] = nested;
  return self;
};

/**
 * @param {object} routes
 * @param {(string|RegExp)=} path
 * @return {this}
 */
Router.prototype.mount = function (routes, path) {
  if (!routes || (typeof routes !== 'object') || Array.isArray(routes)) {
    return this;
  }
  path = path || [];
  if (!Array.isArray(path)) {
    path = (path.source ? path.source.replace(/\\\//g, '/') : path).split('/');
  }
  path = path.filter(function (p) { return p; });
  for (var route in routes) {
    if (Object.prototype.hasOwnProperty.call(routes, route)) {
      this._insertOrMount(route, path.slice(0), routes);
    }
  }
  return this;
};

Router.prototype._insertOrMount = function (route, path, routes) {
  var routeType = typeof routes[route];
  var parts = route.split('/').filter(function (p) { return p; });
  var isMethod = this._methods[route];
  if (!isMethod && (routeType === 'object') && !Array.isArray(routes[route])) {
    path = path.concat(parts);
    this.mount(routes[route], path);
    return;
  }
  if (isMethod) {
    this._insert(route, path, routes[route]);
  }
};

Router.defaults = {
  marker: '#!',
  baseUrl: window.location.origin +
      window.location.pathname.replace(/\/*$/, '/'),
  history: !!(window.history && window.history.replaceState),
  nomarker: false,
  recurse: false,  // false | forward | backward
  async: false,
  /** @type {(function|Array.<function>)} */
  notfound: null,
  after: null,
  before: null,
  on: null
};

/******************************************************************************\
 * exports to web browsers
\******************************************************************************/
if (typeof define === 'function' && define.amd) {
  define('router', function () {
    return Router;
  });
} else {
  window.Router = Router;
}

})(this);