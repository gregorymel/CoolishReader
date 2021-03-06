/*!
 * @overview RSVP - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2016 Yehuda Katz, Tom Dale, Stefan Penner and contributors
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/tildeio/rsvp.js/master/LICENSE
 * @version   4.7.0+2254ba40
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.RSVP = {})));
}(this, (function (exports) { 'use strict';

function callbacksFor(object) {
  var callbacks = object._promiseCallbacks;

  if (!callbacks) {
    callbacks = object._promiseCallbacks = {};
  }

  return callbacks;
}

/**
  @class RSVP.EventTarget
*/
var EventTarget = {

  /**
    `RSVP.EventTarget.mixin` extends an object with EventTarget methods. For
    Example:
     ```javascript
    let object = {};
     RSVP.EventTarget.mixin(object);
     object.on('finished', function(event) {
      // handle event
    });
     object.trigger('finished', { detail: value });
    ```
     `EventTarget.mixin` also works with prototypes:
     ```javascript
    let Person = function() {};
    RSVP.EventTarget.mixin(Person.prototype);
     let yehuda = new Person();
    let tom = new Person();
     yehuda.on('poke', function(event) {
      console.log('Yehuda says OW');
    });
     tom.on('poke', function(event) {
      console.log('Tom says OW');
    });
     yehuda.trigger('poke');
    tom.trigger('poke');
    ```
     @method mixin
    @for RSVP.EventTarget
    @private
    @param {Object} object object to extend with EventTarget methods
  */
  mixin: function (object) {
    object['on'] = this['on'];
    object['off'] = this['off'];
    object['trigger'] = this['trigger'];
    object._promiseCallbacks = undefined;
    return object;
  },


  /**
    Registers a callback to be executed when `eventName` is triggered
     ```javascript
    object.on('event', function(eventInfo){
      // handle the event
    });
     object.trigger('event');
    ```
     @method on
    @for RSVP.EventTarget
    @private
    @param {String} eventName name of the event to listen for
    @param {Function} callback function to be called when the event is triggered.
  */
  on: function (eventName, callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }

    var allCallbacks = callbacksFor(this),
        callbacks = void 0;

    callbacks = allCallbacks[eventName];

    if (!callbacks) {
      callbacks = allCallbacks[eventName] = [];
    }

    if (callbacks.indexOf(callback)) {
      callbacks.push(callback);
    }
  },


  /**
    You can use `off` to stop firing a particular callback for an event:
     ```javascript
    function doStuff() { // do stuff! }
    object.on('stuff', doStuff);
     object.trigger('stuff'); // doStuff will be called
     // Unregister ONLY the doStuff callback
    object.off('stuff', doStuff);
    object.trigger('stuff'); // doStuff will NOT be called
    ```
     If you don't pass a `callback` argument to `off`, ALL callbacks for the
    event will not be executed when the event fires. For example:
     ```javascript
    let callback1 = function(){};
    let callback2 = function(){};
     object.on('stuff', callback1);
    object.on('stuff', callback2);
     object.trigger('stuff'); // callback1 and callback2 will be executed.
     object.off('stuff');
    object.trigger('stuff'); // callback1 and callback2 will not be executed!
    ```
     @method off
    @for RSVP.EventTarget
    @private
    @param {String} eventName event to stop listening to
    @param {Function} callback optional argument. If given, only the function
    given will be removed from the event's callback queue. If no `callback`
    argument is given, all callbacks will be removed from the event's callback
    queue.
  */
  off: function (eventName, callback) {
    var allCallbacks = callbacksFor(this),
        callbacks = void 0,
        index = void 0;

    if (!callback) {
      allCallbacks[eventName] = [];
      return;
    }

    callbacks = allCallbacks[eventName];

    index = callbacks.indexOf(callback);

    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  },


  /**
    Use `trigger` to fire custom events. For example:
     ```javascript
    object.on('foo', function(){
      console.log('foo event happened!');
    });
    object.trigger('foo');
    // 'foo event happened!' logged to the console
    ```
     You can also pass a value as a second argument to `trigger` that will be
    passed as an argument to all event listeners for the event:
     ```javascript
    object.on('foo', function(value){
      console.log(value.name);
    });
     object.trigger('foo', { name: 'bar' });
    // 'bar' logged to the console
    ```
     @method trigger
    @for RSVP.EventTarget
    @private
    @param {String} eventName name of the event to be triggered
    @param {*} options optional value to be passed to any event handlers for
    the given `eventName`
  */
  trigger: function (eventName, options, label) {
    var allCallbacks = callbacksFor(this),
        callbacks = void 0,
        callback = void 0;

    if (callbacks = allCallbacks[eventName]) {
      // Don't cache the callbacks.length since it may grow
      for (var i = 0; i < callbacks.length; i++) {
        callback = callbacks[i];

        callback(options, label);
      }
    }
  }
};

var config = {
  instrument: false
};

EventTarget['mixin'](config);

function configure(name, value) {
  if (arguments.length === 2) {
    config[name] = value;
  } else {
    return config[name];
  }
}

var queue = [];

function scheduleFlush() {
  setTimeout(function () {
    for (var i = 0; i < queue.length; i++) {
      var entry = queue[i];

      var payload = entry.payload;

      payload.guid = payload.key + payload.id;
      payload.childGuid = payload.key + payload.childId;
      if (payload.error) {
        payload.stack = payload.error.stack;
      }

      config['trigger'](entry.name, entry.payload);
    }
    queue.length = 0;
  }, 50);
}

function instrument(eventName, promise, child) {
  if (1 === queue.push({
    name: eventName,
    payload: {
      key: promise._guidKey,
      id: promise._id,
      eventName: eventName,
      detail: promise._result,
      childId: child && child._id,
      label: promise._label,
      timeStamp: Date.now(),
      error: config["instrument-with-stack"] ? new Error(promise._label) : null
    } })) {
    scheduleFlush();
  }
}

/**
  `RSVP.Promise.resolve` returns a promise that will become resolved with the
  passed `value`. It is shorthand for the following:

  ```javascript
  let promise = new RSVP.Promise(function(resolve, reject){
    resolve(1);
  });

  promise.then(function(value){
    // value === 1
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = RSVP.Promise.resolve(1);

  promise.then(function(value){
    // value === 1
  });
  ```

  @method resolve
  @static
  @param {*} object value that the returned promise will be resolved with
  @param {String} label optional string for identifying the returned promise.
  Useful for tooling.
  @return {Promise} a promise that will become fulfilled with the given
  `value`
*/
function resolve$1(object, label) {
  /*jshint validthis:true */
  var Constructor = this;

  if (object && typeof object === 'object' && object.constructor === Constructor) {
    return object;
  }

  var promise = new Constructor(noop, label);
  resolve(promise, object);
  return promise;
}

function withOwnPromise() {
  return new TypeError('A promises callback cannot return that same promise.');
}

function objectOrFunction(x) {
  var type = typeof x;
  return x !== null && (type === 'object' || type === 'function');
}

function noop() {}

var PENDING = void 0;
var FULFILLED = 1;
var REJECTED = 2;

var TRY_CATCH_ERROR = { error: null };

function getThen(promise) {
  try {
    return promise.then;
  } catch (error) {
    TRY_CATCH_ERROR.error = error;
    return TRY_CATCH_ERROR;
  }
}

var tryCatchCallback = void 0;
function tryCatcher() {
  try {
    var target = tryCatchCallback;
    tryCatchCallback = null;
    return target.apply(this, arguments);
  } catch (e) {
    TRY_CATCH_ERROR.error = e;
    return TRY_CATCH_ERROR;
  }
}

function tryCatch(fn) {
  tryCatchCallback = fn;
  return tryCatcher;
}

function handleForeignThenable(promise, thenable, then$$1) {
  config.async(function (promise) {
    var sealed = false;
    var result = tryCatch(then$$1).call(thenable, function (value) {
      if (sealed) {
        return;
      }
      sealed = true;
      if (thenable === value) {
        fulfill(promise, value);
      } else {
        resolve(promise, value);
      }
    }, function (reason) {
      if (sealed) {
        return;
      }
      sealed = true;

      reject(promise, reason);
    }, 'Settle: ' + (promise._label || ' unknown promise'));

    if (!sealed && result === TRY_CATCH_ERROR) {
      sealed = true;
      var error = TRY_CATCH_ERROR.error;
      TRY_CATCH_ERROR.error = null;
      reject(promise, error);
    }
  }, promise);
}

function handleOwnThenable(promise, thenable) {
  if (thenable._state === FULFILLED) {
    fulfill(promise, thenable._result);
  } else if (thenable._state === REJECTED) {
    thenable._onError = null;
    reject(promise, thenable._result);
  } else {
    subscribe(thenable, undefined, function (value) {
      if (thenable === value) {
        fulfill(promise, value);
      } else {
        resolve(promise, value);
      }
    }, function (reason) {
      return reject(promise, reason);
    });
  }
}

function handleMaybeThenable(promise, maybeThenable, then$$1) {
  var isOwnThenable = maybeThenable.constructor === promise.constructor && then$$1 === then && promise.constructor.resolve === resolve$1;

  if (isOwnThenable) {
    handleOwnThenable(promise, maybeThenable);
  } else if (then$$1 === TRY_CATCH_ERROR) {
    var error = TRY_CATCH_ERROR.error;
    TRY_CATCH_ERROR.error = null;
    reject(promise, error);
  } else if (typeof then$$1 === 'function') {
    handleForeignThenable(promise, maybeThenable, then$$1);
  } else {
    fulfill(promise, maybeThenable);
  }
}

function resolve(promise, value) {
  if (promise === value) {
    fulfill(promise, value);
  } else if (objectOrFunction(value)) {
    handleMaybeThenable(promise, value, getThen(value));
  } else {
    fulfill(promise, value);
  }
}

function publishRejection(promise) {
  if (promise._onError) {
    promise._onError(promise._result);
  }

  publish(promise);
}

function fulfill(promise, value) {
  if (promise._state !== PENDING) {
    return;
  }

  promise._result = value;
  promise._state = FULFILLED;

  if (promise._subscribers.length === 0) {
    if (config.instrument) {
      instrument('fulfilled', promise);
    }
  } else {
    config.async(publish, promise);
  }
}

function reject(promise, reason) {
  if (promise._state !== PENDING) {
    return;
  }
  promise._state = REJECTED;
  promise._result = reason;
  config.async(publishRejection, promise);
}

function subscribe(parent, child, onFulfillment, onRejection) {
  var subscribers = parent._subscribers;
  var length = subscribers.length;

  parent._onError = null;

  subscribers[length] = child;
  subscribers[length + FULFILLED] = onFulfillment;
  subscribers[length + REJECTED] = onRejection;

  if (length === 0 && parent._state) {
    config.async(publish, parent);
  }
}

function publish(promise) {
  var subscribers = promise._subscribers;
  var settled = promise._state;

  if (config.instrument) {
    instrument(settled === FULFILLED ? 'fulfilled' : 'rejected', promise);
  }

  if (subscribers.length === 0) {
    return;
  }

  var child = void 0,
      callback = void 0,
      result = promise._result;

  for (var i = 0; i < subscribers.length; i += 3) {
    child = subscribers[i];
    callback = subscribers[i + settled];

    if (child) {
      invokeCallback(settled, child, callback, result);
    } else {
      callback(result);
    }
  }

  promise._subscribers.length = 0;
}

function invokeCallback(state, promise, callback, result) {
  var hasCallback = typeof callback === 'function';
  var value = void 0;

  if (hasCallback) {
    value = tryCatch(callback)(result);
  } else {
    value = result;
  }

  if (promise._state !== PENDING) {
    // noop
  } else if (value === promise) {
    reject(promise, withOwnPromise());
  } else if (value === TRY_CATCH_ERROR) {
    var error = TRY_CATCH_ERROR.error;
    TRY_CATCH_ERROR.error = null; // release
    reject(promise, error);
  } else if (hasCallback) {
    resolve(promise, value);
  } else if (state === FULFILLED) {
    fulfill(promise, value);
  } else if (state === REJECTED) {
    reject(promise, value);
  }
}

function initializePromise(promise, resolver) {
  var resolved = false;
  try {
    resolver(function (value) {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve(promise, value);
    }, function (reason) {
      if (resolved) {
        return;
      }
      resolved = true;
      reject(promise, reason);
    });
  } catch (e) {
    reject(promise, e);
  }
}

function then(onFulfillment, onRejection, label) {
  var parent = this;
  var state = parent._state;

  if (state === FULFILLED && !onFulfillment || state === REJECTED && !onRejection) {
    config.instrument && instrument('chained', parent, parent);
    return parent;
  }

  parent._onError = null;

  var child = new parent.constructor(noop, label);
  var result = parent._result;

  config.instrument && instrument('chained', parent, child);

  if (state === PENDING) {
    subscribe(parent, child, onFulfillment, onRejection);
  } else {
    var callback = state === FULFILLED ? onFulfillment : onRejection;
    config.async(function () {
      return invokeCallback(state, child, callback, result);
    });
  }

  return child;
}

var Enumerator = function () {
  function Enumerator(Constructor, input, abortOnReject, label) {
    this._instanceConstructor = Constructor;
    this.promise = new Constructor(noop, label);
    this._abortOnReject = abortOnReject;
    this._isUsingOwnPromise = Constructor === Promise;
    this._isUsingOwnResolve = Constructor.resolve === resolve$1;

    this._init.apply(this, arguments);
  }

  Enumerator.prototype._init = function _init(Constructor, input) {
    var len = input.length || 0;
    this.length = len;
    this._remaining = len;
    this._result = new Array(len);

    this._enumerate(input);
  };

  Enumerator.prototype._enumerate = function _enumerate(input) {
    var length = this.length;
    var promise = this.promise;

    for (var i = 0; promise._state === PENDING && i < length; i++) {
      this._eachEntry(input[i], i, true);
    }

    this._checkFullfillment();
  };

  Enumerator.prototype._checkFullfillment = function _checkFullfillment() {
    if (this._remaining === 0) {
      fulfill(this.promise, this._result);
    }
  };

  Enumerator.prototype._settleMaybeThenable = function _settleMaybeThenable(entry, i, firstPass) {
    var c = this._instanceConstructor;

    if (this._isUsingOwnResolve) {
      var then$$1 = getThen(entry);

      if (then$$1 === then && entry._state !== PENDING) {
        entry._onError = null;
        this._settledAt(entry._state, i, entry._result, firstPass);
      } else if (typeof then$$1 !== 'function') {
        this._settledAt(FULFILLED, i, entry, firstPass);
      } else if (this._isUsingOwnPromise) {
        var promise = new c(noop);
        handleMaybeThenable(promise, entry, then$$1);
        this._willSettleAt(promise, i, firstPass);
      } else {
        this._willSettleAt(new c(function (resolve$$1) {
          return resolve$$1(entry);
        }), i, firstPass);
      }
    } else {
      this._willSettleAt(c.resolve(entry), i, firstPass);
    }
  };

  Enumerator.prototype._eachEntry = function _eachEntry(entry, i, firstPass) {
    if (entry !== null && typeof entry === 'object') {
      this._settleMaybeThenable(entry, i, firstPass);
    } else {
      this._setResultAt(FULFILLED, i, entry, firstPass);
    }
  };

  Enumerator.prototype._settledAt = function _settledAt(state, i, value, firstPass) {
    var promise = this.promise;

    if (promise._state === PENDING) {
      if (this._abortOnReject && state === REJECTED) {
        reject(promise, value);
      } else {
        this._setResultAt(state, i, value, firstPass);
        this._checkFullfillment();
      }
    }
  };

  Enumerator.prototype._setResultAt = function _setResultAt(state, i, value, firstPass) {
    this._remaining--;
    this._result[i] = value;
  };

  Enumerator.prototype._willSettleAt = function _willSettleAt(promise, i, firstPass) {
    var _this = this;

    subscribe(promise, undefined, function (value) {
      return _this._settledAt(FULFILLED, i, value, firstPass);
    }, function (reason) {
      return _this._settledAt(REJECTED, i, reason, firstPass);
    });
  };

  return Enumerator;
}();

function setSettledResult(state, i, value) {
  this._remaining--;
  if (state === FULFILLED) {
    this._result[i] = {
      state: 'fulfilled',
      value: value
    };
  } else {
    this._result[i] = {
      state: 'rejected',
      reason: value
    };
  }
}

/**
  `RSVP.Promise.all` accepts an array of promises, and returns a new promise which
  is fulfilled with an array of fulfillment values for the passed promises, or
  rejected with the reason of the first passed promise to be rejected. It casts all
  elements of the passed iterable to promises as it runs this algorithm.

  Example:

  ```javascript
  let promise1 = RSVP.resolve(1);
  let promise2 = RSVP.resolve(2);
  let promise3 = RSVP.resolve(3);
  let promises = [ promise1, promise2, promise3 ];

  RSVP.Promise.all(promises).then(function(array){
    // The array here would be [ 1, 2, 3 ];
  });
  ```

  If any of the `promises` given to `RSVP.all` are rejected, the first promise
  that is rejected will be given as an argument to the returned promises's
  rejection handler. For example:

  Example:

  ```javascript
  let promise1 = RSVP.resolve(1);
  let promise2 = RSVP.reject(new Error("2"));
  let promise3 = RSVP.reject(new Error("3"));
  let promises = [ promise1, promise2, promise3 ];

  RSVP.Promise.all(promises).then(function(array){
    // Code here never runs because there are rejected promises!
  }, function(error) {
    // error.message === "2"
  });
  ```

  @method all
  @static
  @param {Array} entries array of promises
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise} promise that is fulfilled when all `promises` have been
  fulfilled, or rejected if any of them become rejected.
  @static
*/
function all(entries, label) {
  if (!Array.isArray(entries)) {
    return this.reject(new TypeError("Promise.all must be called with an array"), label);
  }
  return new Enumerator(this, entries, true /* abort on reject */, label).promise;
}

/**
  `RSVP.Promise.race` returns a new promise which is settled in the same way as the
  first passed promise to settle.

  Example:

  ```javascript
  let promise1 = new RSVP.Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new RSVP.Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 2');
    }, 100);
  });

  RSVP.Promise.race([promise1, promise2]).then(function(result){
    // result === 'promise 2' because it was resolved before promise1
    // was resolved.
  });
  ```

  `RSVP.Promise.race` is deterministic in that only the state of the first
  settled promise matters. For example, even if other promises given to the
  `promises` array argument are resolved, but the first settled promise has
  become rejected before the other promises became fulfilled, the returned
  promise will become rejected:

  ```javascript
  let promise1 = new RSVP.Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new RSVP.Promise(function(resolve, reject){
    setTimeout(function(){
      reject(new Error('promise 2'));
    }, 100);
  });

  RSVP.Promise.race([promise1, promise2]).then(function(result){
    // Code here never runs
  }, function(reason){
    // reason.message === 'promise 2' because promise 2 became rejected before
    // promise 1 became fulfilled
  });
  ```

  An example real-world use case is implementing timeouts:

  ```javascript
  RSVP.Promise.race([ajax('foo.json'), timeout(5000)])
  ```

  @method race
  @static
  @param {Array} entries array of promises to observe
  @param {String} label optional string for describing the promise returned.
  Useful for tooling.
  @return {Promise} a promise which settles in the same way as the first passed
  promise to settle.
*/
function race(entries, label) {
  /*jshint validthis:true */
  var Constructor = this;

  var promise = new Constructor(noop, label);

  if (!Array.isArray(entries)) {
    reject(promise, new TypeError('Promise.race must be called with an array'));
    return promise;
  }

  for (var i = 0; promise._state === PENDING && i < entries.length; i++) {
    subscribe(Constructor.resolve(entries[i]), undefined, function (value) {
      return resolve(promise, value);
    }, function (reason) {
      return reject(promise, reason);
    });
  }

  return promise;
}

/**
  `RSVP.Promise.reject` returns a promise rejected with the passed `reason`.
  It is shorthand for the following:

  ```javascript
  let promise = new RSVP.Promise(function(resolve, reject){
    reject(new Error('WHOOPS'));
  });

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = RSVP.Promise.reject(new Error('WHOOPS'));

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  @method reject
  @static
  @param {*} reason value that the returned promise will be rejected with.
  @param {String} label optional string for identifying the returned promise.
  Useful for tooling.
  @return {Promise} a promise rejected with the given `reason`.
*/
function reject$1(reason, label) {
  /*jshint validthis:true */
  var Constructor = this;
  var promise = new Constructor(noop, label);
  reject(promise, reason);
  return promise;
}

var guidKey = 'rsvp_' + Date.now() + '-';
var counter = 0;

function needsResolver() {
  throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
}

function needsNew() {
  throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
}

/**
  Promise objects represent the eventual result of an asynchronous operation. The
  primary way of interacting with a promise is through its `then` method, which
  registers callbacks to receive either a promise’s eventual value or the reason
  why the promise cannot be fulfilled.

  Terminology
  -----------

  - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
  - `thenable` is an object or function that defines a `then` method.
  - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
  - `exception` is a value that is thrown using the throw statement.
  - `reason` is a value that indicates why a promise was rejected.
  - `settled` the final resting state of a promise, fulfilled or rejected.

  A promise can be in one of three states: pending, fulfilled, or rejected.

  Promises that are fulfilled have a fulfillment value and are in the fulfilled
  state.  Promises that are rejected have a rejection reason and are in the
  rejected state.  A fulfillment value is never a thenable.

  Promises can also be said to *resolve* a value.  If this value is also a
  promise, then the original promise's settled state will match the value's
  settled state.  So a promise that *resolves* a promise that rejects will
  itself reject, and a promise that *resolves* a promise that fulfills will
  itself fulfill.


  Basic Usage:
  ------------

  ```js
  let promise = new Promise(function(resolve, reject) {
    // on success
    resolve(value);

    // on failure
    reject(reason);
  });

  promise.then(function(value) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Advanced Usage:
  ---------------

  Promises shine when abstracting away asynchronous interactions such as
  `XMLHttpRequest`s.

  ```js
  function getJSON(url) {
    return new Promise(function(resolve, reject){
      let xhr = new XMLHttpRequest();

      xhr.open('GET', url);
      xhr.onreadystatechange = handler;
      xhr.responseType = 'json';
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) {
            resolve(this.response);
          } else {
            reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
          }
        }
      };
    });
  }

  getJSON('/posts.json').then(function(json) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Unlike callbacks, promises are great composable primitives.

  ```js
  Promise.all([
    getJSON('/posts'),
    getJSON('/comments')
  ]).then(function(values){
    values[0] // => postsJSON
    values[1] // => commentsJSON

    return values;
  });
  ```

  @class RSVP.Promise
  @param {function} resolver
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @constructor
*/

var Promise = function () {
  function Promise(resolver, label) {
    this._id = counter++;
    this._label = label;
    this._state = undefined;
    this._result = undefined;
    this._subscribers = [];

    config.instrument && instrument('created', this);

    if (noop !== resolver) {
      typeof resolver !== 'function' && needsResolver();
      this instanceof Promise ? initializePromise(this, resolver) : needsNew();
    }
  }

  Promise.prototype._onError = function _onError(reason) {
    var _this = this;

    config.after(function () {
      if (_this._onError) {
        config.trigger('error', reason, _this._label);
      }
    });
  };

  /**
    `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
    as the catch block of a try/catch statement.
  
    ```js
    function findAuthor(){
      throw new Error('couldn\'t find that author');
    }
  
    // synchronous
    try {
      findAuthor();
    } catch(reason) {
      // something went wrong
    }
  
    // async with promises
    findAuthor().catch(function(reason){
      // something went wrong
    });
    ```
  
    @method catch
    @param {Function} onRejection
    @param {String} label optional string for labeling the promise.
    Useful for tooling.
    @return {Promise}
  */


  Promise.prototype.catch = function _catch(onRejection, label) {
    return this.then(undefined, onRejection, label);
  };

  /**
    `finally` will be invoked regardless of the promise's fate just as native
    try/catch/finally behaves
  
    Synchronous example:
  
    ```js
    findAuthor() {
      if (Math.random() > 0.5) {
        throw new Error();
      }
      return new Author();
    }
  
    try {
      return findAuthor(); // succeed or fail
    } catch(error) {
      return findOtherAuthor();
    } finally {
      // always runs
      // doesn't affect the return value
    }
    ```
  
    Asynchronous example:
  
    ```js
    findAuthor().catch(function(reason){
      return findOtherAuthor();
    }).finally(function(){
      // author was either found, or not
    });
    ```
  
    @method finally
    @param {Function} callback
    @param {String} label optional string for labeling the promise.
    Useful for tooling.
    @return {Promise}
  */


  Promise.prototype.finally = function _finally(callback, label) {
    var promise = this;
    var constructor = promise.constructor;

    return promise.then(function (value) {
      return constructor.resolve(callback()).then(function () {
        return value;
      });
    }, function (reason) {
      return constructor.resolve(callback()).then(function () {
        throw reason;
      });
    }, label);
  };

  return Promise;
}();

Promise.all = all;
Promise.race = race;
Promise.resolve = resolve$1;
Promise.reject = reject$1;

Promise.prototype._guidKey = guidKey;

/**
  The primary way of interacting with a promise is through its `then` method,
  which registers callbacks to receive either a promise's eventual value or the
  reason why the promise cannot be fulfilled.

  ```js
  findUser().then(function(user){
    // user is available
  }, function(reason){
    // user is unavailable, and you are given the reason why
  });
  ```

  Chaining
  --------

  The return value of `then` is itself a promise.  This second, 'downstream'
  promise is resolved with the return value of the first promise's fulfillment
  or rejection handler, or rejected if the handler throws an exception.

  ```js
  findUser().then(function (user) {
    return user.name;
  }, function (reason) {
    return 'default name';
  }).then(function (userName) {
    // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
    // will be `'default name'`
  });

  findUser().then(function (user) {
    throw new Error('Found user, but still unhappy');
  }, function (reason) {
    throw new Error('`findUser` rejected and we\'re unhappy');
  }).then(function (value) {
    // never reached
  }, function (reason) {
    // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
    // If `findUser` rejected, `reason` will be '`findUser` rejected and we\'re unhappy'.
  });
  ```
  If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.

  ```js
  findUser().then(function (user) {
    throw new PedagogicalException('Upstream error');
  }).then(function (value) {
    // never reached
  }).then(function (value) {
    // never reached
  }, function (reason) {
    // The `PedgagocialException` is propagated all the way down to here
  });
  ```

  Assimilation
  ------------

  Sometimes the value you want to propagate to a downstream promise can only be
  retrieved asynchronously. This can be achieved by returning a promise in the
  fulfillment or rejection handler. The downstream promise will then be pending
  until the returned promise is settled. This is called *assimilation*.

  ```js
  findUser().then(function (user) {
    return findCommentsByAuthor(user);
  }).then(function (comments) {
    // The user's comments are now available
  });
  ```

  If the assimliated promise rejects, then the downstream promise will also reject.

  ```js
  findUser().then(function (user) {
    return findCommentsByAuthor(user);
  }).then(function (comments) {
    // If `findCommentsByAuthor` fulfills, we'll have the value here
  }, function (reason) {
    // If `findCommentsByAuthor` rejects, we'll have the reason here
  });
  ```

  Simple Example
  --------------

  Synchronous Example

  ```javascript
  let result;

  try {
    result = findResult();
    // success
  } catch(reason) {
    // failure
  }
  ```

  Errback Example

  ```js
  findResult(function(result, err){
    if (err) {
      // failure
    } else {
      // success
    }
  });
  ```

  Promise Example;

  ```javascript
  findResult().then(function(result){
    // success
  }, function(reason){
    // failure
  });
  ```

  Advanced Example
  --------------

  Synchronous Example

  ```javascript
  let author, books;

  try {
    author = findAuthor();
    books  = findBooksByAuthor(author);
    // success
  } catch(reason) {
    // failure
  }
  ```

  Errback Example

  ```js

  function foundBooks(books) {

  }

  function failure(reason) {

  }

  findAuthor(function(author, err){
    if (err) {
      failure(err);
      // failure
    } else {
      try {
        findBoooksByAuthor(author, function(books, err) {
          if (err) {
            failure(err);
          } else {
            try {
              foundBooks(books);
            } catch(reason) {
              failure(reason);
            }
          }
        });
      } catch(error) {
        failure(err);
      }
      // success
    }
  });
  ```

  Promise Example;

  ```javascript
  findAuthor().
    then(findBooksByAuthor).
    then(function(books){
      // found books
  }).catch(function(reason){
    // something went wrong
  });
  ```

  @method then
  @param {Function} onFulfillment
  @param {Function} onRejection
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise}
*/
Promise.prototype.then = then;

function makeObject(_, argumentNames) {
  var obj = {};
  var length = _.length;
  var args = new Array(length);

  for (var x = 0; x < length; x++) {
    args[x] = _[x];
  }

  for (var i = 0; i < argumentNames.length; i++) {
    var name = argumentNames[i];
    obj[name] = args[i + 1];
  }

  return obj;
}

function arrayResult(_) {
  var length = _.length;
  var args = new Array(length - 1);

  for (var i = 1; i < length; i++) {
    args[i - 1] = _[i];
  }

  return args;
}

function wrapThenable(then, promise) {
  return {
    then: function (onFulFillment, onRejection) {
      return then.call(promise, onFulFillment, onRejection);
    }
  };
}

/**
  `RSVP.denodeify` takes a 'node-style' function and returns a function that
  will return an `RSVP.Promise`. You can use `denodeify` in Node.js or the
  browser when you'd prefer to use promises over using callbacks. For example,
  `denodeify` transforms the following:

  ```javascript
  let fs = require('fs');

  fs.readFile('myfile.txt', function(err, data){
    if (err) return handleError(err);
    handleData(data);
  });
  ```

  into:

  ```javascript
  let fs = require('fs');
  let readFile = RSVP.denodeify(fs.readFile);

  readFile('myfile.txt').then(handleData, handleError);
  ```

  If the node function has multiple success parameters, then `denodeify`
  just returns the first one:

  ```javascript
  let request = RSVP.denodeify(require('request'));

  request('http://example.com').then(function(res) {
    // ...
  });
  ```

  However, if you need all success parameters, setting `denodeify`'s
  second parameter to `true` causes it to return all success parameters
  as an array:

  ```javascript
  let request = RSVP.denodeify(require('request'), true);

  request('http://example.com').then(function(result) {
    // result[0] -> res
    // result[1] -> body
  });
  ```

  Or if you pass it an array with names it returns the parameters as a hash:

  ```javascript
  let request = RSVP.denodeify(require('request'), ['res', 'body']);

  request('http://example.com').then(function(result) {
    // result.res
    // result.body
  });
  ```

  Sometimes you need to retain the `this`:

  ```javascript
  let app = require('express')();
  let render = RSVP.denodeify(app.render.bind(app));
  ```

  The denodified function inherits from the original function. It works in all
  environments, except IE 10 and below. Consequently all properties of the original
  function are available to you. However, any properties you change on the
  denodeified function won't be changed on the original function. Example:

  ```javascript
  let request = RSVP.denodeify(require('request')),
      cookieJar = request.jar(); // <- Inheritance is used here

  request('http://example.com', {jar: cookieJar}).then(function(res) {
    // cookieJar.cookies holds now the cookies returned by example.com
  });
  ```

  Using `denodeify` makes it easier to compose asynchronous operations instead
  of using callbacks. For example, instead of:

  ```javascript
  let fs = require('fs');

  fs.readFile('myfile.txt', function(err, data){
    if (err) { ... } // Handle error
    fs.writeFile('myfile2.txt', data, function(err){
      if (err) { ... } // Handle error
      console.log('done')
    });
  });
  ```

  you can chain the operations together using `then` from the returned promise:

  ```javascript
  let fs = require('fs');
  let readFile = RSVP.denodeify(fs.readFile);
  let writeFile = RSVP.denodeify(fs.writeFile);

  readFile('myfile.txt').then(function(data){
    return writeFile('myfile2.txt', data);
  }).then(function(){
    console.log('done')
  }).catch(function(error){
    // Handle error
  });
  ```

  @method denodeify
  @static
  @for RSVP
  @param {Function} nodeFunc a 'node-style' function that takes a callback as
  its last argument. The callback expects an error to be passed as its first
  argument (if an error occurred, otherwise null), and the value from the
  operation as its second argument ('function(err, value){ }').
  @param {Boolean|Array} [options] An optional paramter that if set
  to `true` causes the promise to fulfill with the callback's success arguments
  as an array. This is useful if the node function has multiple success
  paramters. If you set this paramter to an array with names, the promise will
  fulfill with a hash with these names as keys and the success parameters as
  values.
  @return {Function} a function that wraps `nodeFunc` to return an
  `RSVP.Promise`
  @static
*/
function denodeify(nodeFunc, options) {
  var fn = function () {
    var l = arguments.length;
    var args = new Array(l + 1);
    var promiseInput = false;

    for (var i = 0; i < l; ++i) {
      var arg = arguments[i];

      if (!promiseInput) {
        // TODO: clean this up
        promiseInput = needsPromiseInput(arg);
        if (promiseInput === TRY_CATCH_ERROR) {
          var error = TRY_CATCH_ERROR.error;
          TRY_CATCH_ERROR.error = null;
          var p = new Promise(noop);
          reject(p, error);
          return p;
        } else if (promiseInput && promiseInput !== true) {
          arg = wrapThenable(promiseInput, arg);
        }
      }
      args[i] = arg;
    }

    var promise = new Promise(noop);

    args[l] = function (err, val) {
      if (err) {
        reject(promise, err);
      } else if (options === undefined) {
        resolve(promise, val);
      } else if (options === true) {
        resolve(promise, arrayResult(arguments));
      } else if (Array.isArray(options)) {
        resolve(promise, makeObject(arguments, options));
      } else {
        resolve(promise, val);
      }
    };

    if (promiseInput) {
      return handlePromiseInput(promise, args, nodeFunc, this);
    } else {
      return handleValueInput(promise, args, nodeFunc, this);
    }
  };

  fn.__proto__ = nodeFunc;

  return fn;
}

function handleValueInput(promise, args, nodeFunc, self) {
  var result = tryCatch(nodeFunc).apply(self, args);
  if (result === TRY_CATCH_ERROR) {
    var error = TRY_CATCH_ERROR.error;
    TRY_CATCH_ERROR.error = null;
    reject(promise, error);
  }
  return promise;
}

function handlePromiseInput(promise, args, nodeFunc, self) {
  return Promise.all(args).then(function (args) {
    return handleValueInput(promise, args, nodeFunc, self);
  });
}

function needsPromiseInput(arg) {
  if (arg !== null && typeof arg === 'object') {
    if (arg.constructor === Promise) {
      return true;
    } else {
      return getThen(arg);
    }
  } else {
    return false;
  }
}

/**
  This is a convenient alias for `RSVP.Promise.all`.

  @method all
  @static
  @for RSVP
  @param {Array} array Array of promises.
  @param {String} label An optional label. This is useful
  for tooling.
*/
function all$1(array, label) {
  return Promise.all(array, label);
}

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var AllSettled = function (_Enumerator) {
  _inherits(AllSettled, _Enumerator);

  function AllSettled(Constructor, entries, label) {
    return _possibleConstructorReturn(this, _Enumerator.call(this, Constructor, entries, false /* don't abort on reject */, label));
  }

  return AllSettled;
}(Enumerator);

AllSettled.prototype._setResultAt = setSettledResult;

/**
`RSVP.allSettled` is similar to `RSVP.all`, but instead of implementing
a fail-fast method, it waits until all the promises have returned and
shows you all the results. This is useful if you want to handle multiple
promises' failure states together as a set.
 Returns a promise that is fulfilled when all the given promises have been
settled. The return promise is fulfilled with an array of the states of
the promises passed into the `promises` array argument.
 Each state object will either indicate fulfillment or rejection, and
provide the corresponding value or reason. The states will take one of
the following formats:
 ```javascript
{ state: 'fulfilled', value: value }
  or
{ state: 'rejected', reason: reason }
```
 Example:
 ```javascript
let promise1 = RSVP.Promise.resolve(1);
let promise2 = RSVP.Promise.reject(new Error('2'));
let promise3 = RSVP.Promise.reject(new Error('3'));
let promises = [ promise1, promise2, promise3 ];
 RSVP.allSettled(promises).then(function(array){
  // array == [
  //   { state: 'fulfilled', value: 1 },
  //   { state: 'rejected', reason: Error },
  //   { state: 'rejected', reason: Error }
  // ]
  // Note that for the second item, reason.message will be '2', and for the
  // third item, reason.message will be '3'.
}, function(error) {
  // Not run. (This block would only be called if allSettled had failed,
  // for instance if passed an incorrect argument type.)
});
```
 @method allSettled
@static
@for RSVP
@param {Array} entries
@param {String} label - optional string that describes the promise.
Useful for tooling.
@return {Promise} promise that is fulfilled with an array of the settled
states of the constituent promises.
*/

function allSettled(entries, label) {
  if (!Array.isArray(entries)) {
    return Promise.reject(new TypeError("Promise.allSettled must be called with an array"), label);
  }

  return new AllSettled(Promise, entries, label).promise;
}

/**
  This is a convenient alias for `RSVP.Promise.race`.

  @method race
  @static
  @for RSVP
  @param {Array} array Array of promises.
  @param {String} label An optional label. This is useful
  for tooling.
 */
function race$1(array, label) {
  return Promise.race(array, label);
}

function _possibleConstructorReturn$1(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits$1(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var hasOwnProperty = Object.prototype.hasOwnProperty;

var PromiseHash = function (_Enumerator) {
  _inherits$1(PromiseHash, _Enumerator);

  function PromiseHash(Constructor, object) {
    var abortOnReject = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
    var label = arguments[3];
    return _possibleConstructorReturn$1(this, _Enumerator.call(this, Constructor, object, abortOnReject, label));
  }

  PromiseHash.prototype._init = function _init(Constructor, object) {
    this._result = {};

    this._enumerate(object);
    if (this._remaining === 0) {
      fulfill(this.promise, this._result);
    }
  };

  PromiseHash.prototype._enumerate = function _enumerate(input) {
    var promise = this.promise;
    var results = [];

    for (var key in input) {
      if (hasOwnProperty.call(input, key)) {
        results.push({
          position: key,
          entry: input[key]
        });
      }
    }

    var length = results.length;
    this._remaining = length;
    var result = void 0;

    for (var i = 0; promise._state === PENDING && i < length; i++) {
      result = results[i];
      this._eachEntry(result.entry, result.position);
    }
  };

  return PromiseHash;
}(Enumerator);

/**
  `RSVP.hash` is similar to `RSVP.all`, but takes an object instead of an array
  for its `promises` argument.

  Returns a promise that is fulfilled when all the given promises have been
  fulfilled, or rejected if any of them become rejected. The returned promise
  is fulfilled with a hash that has the same key names as the `promises` object
  argument. If any of the values in the object are not promises, they will
  simply be copied over to the fulfilled object.

  Example:

  ```javascript
  let promises = {
    myPromise: RSVP.resolve(1),
    yourPromise: RSVP.resolve(2),
    theirPromise: RSVP.resolve(3),
    notAPromise: 4
  };

  RSVP.hash(promises).then(function(hash){
    // hash here is an object that looks like:
    // {
    //   myPromise: 1,
    //   yourPromise: 2,
    //   theirPromise: 3,
    //   notAPromise: 4
    // }
  });
  ````

  If any of the `promises` given to `RSVP.hash` are rejected, the first promise
  that is rejected will be given as the reason to the rejection handler.

  Example:

  ```javascript
  let promises = {
    myPromise: RSVP.resolve(1),
    rejectedPromise: RSVP.reject(new Error('rejectedPromise')),
    anotherRejectedPromise: RSVP.reject(new Error('anotherRejectedPromise')),
  };

  RSVP.hash(promises).then(function(hash){
    // Code here never runs because there are rejected promises!
  }, function(reason) {
    // reason.message === 'rejectedPromise'
  });
  ```

  An important note: `RSVP.hash` is intended for plain JavaScript objects that
  are just a set of keys and values. `RSVP.hash` will NOT preserve prototype
  chains.

  Example:

  ```javascript
  function MyConstructor(){
    this.example = RSVP.resolve('Example');
  }

  MyConstructor.prototype = {
    protoProperty: RSVP.resolve('Proto Property')
  };

  let myObject = new MyConstructor();

  RSVP.hash(myObject).then(function(hash){
    // protoProperty will not be present, instead you will just have an
    // object that looks like:
    // {
    //   example: 'Example'
    // }
    //
    // hash.hasOwnProperty('protoProperty'); // false
    // 'undefined' === typeof hash.protoProperty
  });
  ```

  @method hash
  @static
  @for RSVP
  @param {Object} object
  @param {String} label optional string that describes the promise.
  Useful for tooling.
  @return {Promise} promise that is fulfilled when all properties of `promises`
  have been fulfilled, or rejected if any of them become rejected.
*/
function hash(object, label) {
  if (object === null || typeof object !== 'object') {
    return Promise.reject(new TypeError("Promise.hash must be called with an object"), label);
  }

  return new PromiseHash(Promise, object, label).promise;
}

function _possibleConstructorReturn$2(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits$2(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var HashSettled = function (_PromiseHash) {
  _inherits$2(HashSettled, _PromiseHash);

  function HashSettled(Constructor, object, label) {
    return _possibleConstructorReturn$2(this, _PromiseHash.call(this, Constructor, object, false, label));
  }

  return HashSettled;
}(PromiseHash);

HashSettled.prototype._setResultAt = setSettledResult;

/**
  `RSVP.hashSettled` is similar to `RSVP.allSettled`, but takes an object
  instead of an array for its `promises` argument.

  Unlike `RSVP.all` or `RSVP.hash`, which implement a fail-fast method,
  but like `RSVP.allSettled`, `hashSettled` waits until all the
  constituent promises have returned and then shows you all the results
  with their states and values/reasons. This is useful if you want to
  handle multiple promises' failure states together as a set.

  Returns a promise that is fulfilled when all the given promises have been
  settled, or rejected if the passed parameters are invalid.

  The returned promise is fulfilled with a hash that has the same key names as
  the `promises` object argument. If any of the values in the object are not
  promises, they will be copied over to the fulfilled object and marked with state
  'fulfilled'.

  Example:

  ```javascript
  let promises = {
    myPromise: RSVP.Promise.resolve(1),
    yourPromise: RSVP.Promise.resolve(2),
    theirPromise: RSVP.Promise.resolve(3),
    notAPromise: 4
  };

  RSVP.hashSettled(promises).then(function(hash){
    // hash here is an object that looks like:
    // {
    //   myPromise: { state: 'fulfilled', value: 1 },
    //   yourPromise: { state: 'fulfilled', value: 2 },
    //   theirPromise: { state: 'fulfilled', value: 3 },
    //   notAPromise: { state: 'fulfilled', value: 4 }
    // }
  });
  ```

  If any of the `promises` given to `RSVP.hash` are rejected, the state will
  be set to 'rejected' and the reason for rejection provided.

  Example:

  ```javascript
  let promises = {
    myPromise: RSVP.Promise.resolve(1),
    rejectedPromise: RSVP.Promise.reject(new Error('rejection')),
    anotherRejectedPromise: RSVP.Promise.reject(new Error('more rejection')),
  };

  RSVP.hashSettled(promises).then(function(hash){
    // hash here is an object that looks like:
    // {
    //   myPromise:              { state: 'fulfilled', value: 1 },
    //   rejectedPromise:        { state: 'rejected', reason: Error },
    //   anotherRejectedPromise: { state: 'rejected', reason: Error },
    // }
    // Note that for rejectedPromise, reason.message == 'rejection',
    // and for anotherRejectedPromise, reason.message == 'more rejection'.
  });
  ```

  An important note: `RSVP.hashSettled` is intended for plain JavaScript objects that
  are just a set of keys and values. `RSVP.hashSettled` will NOT preserve prototype
  chains.

  Example:

  ```javascript
  function MyConstructor(){
    this.example = RSVP.Promise.resolve('Example');
  }

  MyConstructor.prototype = {
    protoProperty: RSVP.Promise.resolve('Proto Property')
  };

  let myObject = new MyConstructor();

  RSVP.hashSettled(myObject).then(function(hash){
    // protoProperty will not be present, instead you will just have an
    // object that looks like:
    // {
    //   example: { state: 'fulfilled', value: 'Example' }
    // }
    //
    // hash.hasOwnProperty('protoProperty'); // false
    // 'undefined' === typeof hash.protoProperty
  });
  ```

  @method hashSettled
  @for RSVP
  @param {Object} object
  @param {String} label optional string that describes the promise.
  Useful for tooling.
  @return {Promise} promise that is fulfilled when when all properties of `promises`
  have been settled.
  @static
*/

function hashSettled(object, label) {
  if (object === null || typeof object !== 'object') {
    return Promise.reject(new TypeError("RSVP.hashSettled must be called with an object"), label);
  }

  return new HashSettled(Promise, object, false, label).promise;
}

/**
  `RSVP.rethrow` will rethrow an error on the next turn of the JavaScript event
  loop in order to aid debugging.

  Promises A+ specifies that any exceptions that occur with a promise must be
  caught by the promises implementation and bubbled to the last handler. For
  this reason, it is recommended that you always specify a second rejection
  handler function to `then`. However, `RSVP.rethrow` will throw the exception
  outside of the promise, so it bubbles up to your console if in the browser,
  or domain/cause uncaught exception in Node. `rethrow` will also throw the
  error again so the error can be handled by the promise per the spec.

  ```javascript
  function throws(){
    throw new Error('Whoops!');
  }

  let promise = new RSVP.Promise(function(resolve, reject){
    throws();
  });

  promise.catch(RSVP.rethrow).then(function(){
    // Code here doesn't run because the promise became rejected due to an
    // error!
  }, function (err){
    // handle the error here
  });
  ```

  The 'Whoops' error will be thrown on the next turn of the event loop
  and you can watch for it in your console. You can also handle it using a
  rejection handler given to `.then` or `.catch` on the returned promise.

  @method rethrow
  @static
  @for RSVP
  @param {Error} reason reason the promise became rejected.
  @throws Error
  @static
*/
function rethrow(reason) {
  setTimeout(function () {
    throw reason;
  });
  throw reason;
}

/**
  `RSVP.defer` returns an object similar to jQuery's `$.Deferred`.
  `RSVP.defer` should be used when porting over code reliant on `$.Deferred`'s
  interface. New code should use the `RSVP.Promise` constructor instead.

  The object returned from `RSVP.defer` is a plain object with three properties:

  * promise - an `RSVP.Promise`.
  * reject - a function that causes the `promise` property on this object to
    become rejected
  * resolve - a function that causes the `promise` property on this object to
    become fulfilled.

  Example:

   ```javascript
   let deferred = RSVP.defer();

   deferred.resolve("Success!");

   deferred.promise.then(function(value){
     // value here is "Success!"
   });
   ```

  @method defer
  @static
  @for RSVP
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Object}
 */

function defer(label) {
  var deferred = { resolve: undefined, reject: undefined };

  deferred.promise = new Promise(function (resolve, reject) {
    deferred.resolve = resolve;
    deferred.reject = reject;
  }, label);

  return deferred;
}

function _possibleConstructorReturn$3(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits$3(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var MapEnumerator = function (_Enumerator) {
  _inherits$3(MapEnumerator, _Enumerator);

  function MapEnumerator(Constructor, entries, mapFn, label) {
    return _possibleConstructorReturn$3(this, _Enumerator.call(this, Constructor, entries, true, label, mapFn));
  }

  MapEnumerator.prototype._init = function _init(Constructor, input, bool, label, mapFn) {
    var len = input.length || 0;
    this.length = len;
    this._remaining = len;
    this._result = new Array(len);
    this._mapFn = mapFn;

    this._enumerate(input);
  };

  MapEnumerator.prototype._setResultAt = function _setResultAt(state, i, value, firstPass) {
    if (firstPass) {
      var val = tryCatch(this._mapFn)(value, i);
      if (val === TRY_CATCH_ERROR) {
        this._settledAt(REJECTED, i, val.error, false);
      } else {
        this._eachEntry(val, i, false);
      }
    } else {
      this._remaining--;
      this._result[i] = value;
    }
  };

  return MapEnumerator;
}(Enumerator);

/**
 `RSVP.map` is similar to JavaScript's native `map` method. `mapFn` is eagerly called
  meaning that as soon as any promise resolves its value will be passed to `mapFn`.
  `RSVP.map` returns a promise that will become fulfilled with the result of running
  `mapFn` on the values the promises become fulfilled with.

  For example:

  ```javascript

  let promise1 = RSVP.resolve(1);
  let promise2 = RSVP.resolve(2);
  let promise3 = RSVP.resolve(3);
  let promises = [ promise1, promise2, promise3 ];

  let mapFn = function(item){
    return item + 1;
  };

  RSVP.map(promises, mapFn).then(function(result){
    // result is [ 2, 3, 4 ]
  });
  ```

  If any of the `promises` given to `RSVP.map` are rejected, the first promise
  that is rejected will be given as an argument to the returned promise's
  rejection handler. For example:

  ```javascript
  let promise1 = RSVP.resolve(1);
  let promise2 = RSVP.reject(new Error('2'));
  let promise3 = RSVP.reject(new Error('3'));
  let promises = [ promise1, promise2, promise3 ];

  let mapFn = function(item){
    return item + 1;
  };

  RSVP.map(promises, mapFn).then(function(array){
    // Code here never runs because there are rejected promises!
  }, function(reason) {
    // reason.message === '2'
  });
  ```

  `RSVP.map` will also wait if a promise is returned from `mapFn`. For example,
  say you want to get all comments from a set of blog posts, but you need
  the blog posts first because they contain a url to those comments.

  ```javscript

  let mapFn = function(blogPost){
    // getComments does some ajax and returns an RSVP.Promise that is fulfilled
    // with some comments data
    return getComments(blogPost.comments_url);
  };

  // getBlogPosts does some ajax and returns an RSVP.Promise that is fulfilled
  // with some blog post data
  RSVP.map(getBlogPosts(), mapFn).then(function(comments){
    // comments is the result of asking the server for the comments
    // of all blog posts returned from getBlogPosts()
  });
  ```

  @method map
  @static
  @for RSVP
  @param {Array} promises
  @param {Function} mapFn function to be called on each fulfilled promise.
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise} promise that is fulfilled with the result of calling
  `mapFn` on each fulfilled promise or value when they become fulfilled.
   The promise will be rejected if any of the given `promises` become rejected.
  @static
*/


function map(promises, mapFn, label) {
  if (!Array.isArray(promises)) {
    return Promise.reject(new TypeError("RSVP.map must be called with an array"), label);
  }

  if (typeof mapFn !== 'function') {
    return Promise.reject(new TypeError("RSVP.map expects a function as a second argument"), label);
  }

  return new MapEnumerator(Promise, promises, mapFn, label).promise;
}

/**
  This is a convenient alias for `RSVP.Promise.resolve`.

  @method resolve
  @static
  @for RSVP
  @param {*} value value that the returned promise will be resolved with
  @param {String} label optional string for identifying the returned promise.
  Useful for tooling.
  @return {Promise} a promise that will become fulfilled with the given
  `value`
*/
function resolve$2(value, label) {
  return Promise.resolve(value, label);
}

/**
  This is a convenient alias for `RSVP.Promise.reject`.

  @method reject
  @static
  @for RSVP
  @param {*} reason value that the returned promise will be rejected with.
  @param {String} label optional string for identifying the returned promise.
  Useful for tooling.
  @return {Promise} a promise rejected with the given `reason`.
*/
function reject$2(reason, label) {
  return Promise.reject(reason, label);
}

function _possibleConstructorReturn$4(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits$4(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EMPTY_OBJECT = {};

var FilterEnumerator = function (_Enumerator) {
  _inherits$4(FilterEnumerator, _Enumerator);

  function FilterEnumerator(Constructor, entries, filterFn, label) {
    return _possibleConstructorReturn$4(this, _Enumerator.call(this, Constructor, entries, true, label, filterFn));
  }

  FilterEnumerator.prototype._init = function _init(Constructor, input, bool, label, filterFn) {
    var len = input.length || 0;
    this.length = len;
    this._remaining = len;

    this._result = new Array(len);
    this._filterFn = filterFn;

    this._enumerate(input);
  };

  FilterEnumerator.prototype._checkFullfillment = function _checkFullfillment() {
    if (this._remaining === 0) {
      this._result = this._result.filter(function (val) {
        return val !== EMPTY_OBJECT;
      });
      fulfill(this.promise, this._result);
    }
  };

  FilterEnumerator.prototype._setResultAt = function _setResultAt(state, i, value, firstPass) {
    if (firstPass) {
      this._result[i] = value;
      var val = tryCatch(this._filterFn)(value, i);
      if (val === TRY_CATCH_ERROR) {
        this._settledAt(REJECTED, i, val.error, false);
      } else {
        this._eachEntry(val, i, false);
      }
    } else {
      this._remaining--;
      if (!value) {
        this._result[i] = EMPTY_OBJECT;
      }
    }
  };

  return FilterEnumerator;
}(Enumerator);

/**
 `RSVP.filter` is similar to JavaScript's native `filter` method.
 `filterFn` is eagerly called meaning that as soon as any promise
  resolves its value will be passed to `filterFn`. `RSVP.filter` returns
  a promise that will become fulfilled with the result of running
  `filterFn` on the values the promises become fulfilled with.

  For example:

  ```javascript

  let promise1 = RSVP.resolve(1);
  let promise2 = RSVP.resolve(2);
  let promise3 = RSVP.resolve(3);

  let promises = [promise1, promise2, promise3];

  let filterFn = function(item){
    return item > 1;
  };

  RSVP.filter(promises, filterFn).then(function(result){
    // result is [ 2, 3 ]
  });
  ```

  If any of the `promises` given to `RSVP.filter` are rejected, the first promise
  that is rejected will be given as an argument to the returned promise's
  rejection handler. For example:

  ```javascript
  let promise1 = RSVP.resolve(1);
  let promise2 = RSVP.reject(new Error('2'));
  let promise3 = RSVP.reject(new Error('3'));
  let promises = [ promise1, promise2, promise3 ];

  let filterFn = function(item){
    return item > 1;
  };

  RSVP.filter(promises, filterFn).then(function(array){
    // Code here never runs because there are rejected promises!
  }, function(reason) {
    // reason.message === '2'
  });
  ```

  `RSVP.filter` will also wait for any promises returned from `filterFn`.
  For instance, you may want to fetch a list of users then return a subset
  of those users based on some asynchronous operation:

  ```javascript

  let alice = { name: 'alice' };
  let bob   = { name: 'bob' };
  let users = [ alice, bob ];

  let promises = users.map(function(user){
    return RSVP.resolve(user);
  });

  let filterFn = function(user){
    // Here, Alice has permissions to create a blog post, but Bob does not.
    return getPrivilegesForUser(user).then(function(privs){
      return privs.can_create_blog_post === true;
    });
  };
  RSVP.filter(promises, filterFn).then(function(users){
    // true, because the server told us only Alice can create a blog post.
    users.length === 1;
    // false, because Alice is the only user present in `users`
    users[0] === bob;
  });
  ```

  @method filter
  @static
  @for RSVP
  @param {Array} promises
  @param {Function} filterFn - function to be called on each resolved value to
  filter the final results.
  @param {String} label optional string describing the promise. Useful for
  tooling.
  @return {Promise}
*/

function filter(promises, filterFn, label) {
  if (typeof filterFn !== 'function') {
    return Promise.reject(new TypeError("RSVP.filter expects function as a second argument"), label);
  }

  return Promise.resolve(promises, label).then(function (promises) {
    if (!Array.isArray(promises)) {
      throw new TypeError("RSVP.filter must be called with an array");
    }
    return new FilterEnumerator(Promise, promises, filterFn, label).promise;
  });
}

var len = 0;
var vertxNext = void 0;
function asap(callback, arg) {
  queue$1[len] = callback;
  queue$1[len + 1] = arg;
  len += 2;
  if (len === 2) {
    // If len is 1, that means that we need to schedule an async flush.
    // If additional callbacks are queued before the queue is flushed, they
    // will be processed by this flush that we are scheduling.
    scheduleFlush$1();
  }
}

var browserWindow = typeof window !== 'undefined' ? window : undefined;
var browserGlobal = browserWindow || {};
var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
var isNode = typeof self === 'undefined' && typeof process !== 'undefined' && {}.toString.call(process) === '[object process]';

// test for web worker but not in IE10
var isWorker = typeof Uint8ClampedArray !== 'undefined' && typeof importScripts !== 'undefined' && typeof MessageChannel !== 'undefined';

// node
function useNextTick() {
  var nextTick = process.nextTick;
  // node version 0.10.x displays a deprecation warning when nextTick is used recursively
  // setImmediate should be used instead instead
  var version = process.versions.node.match(/^(?:(\d+)\.)?(?:(\d+)\.)?(\*|\d+)$/);
  if (Array.isArray(version) && version[1] === '0' && version[2] === '10') {
    nextTick = setImmediate;
  }
  return function () {
    return nextTick(flush);
  };
}

// vertx
function useVertxTimer() {
  if (typeof vertxNext !== 'undefined') {
    return function () {
      vertxNext(flush);
    };
  }
  return useSetTimeout();
}

function useMutationObserver() {
  var iterations = 0;
  var observer = new BrowserMutationObserver(flush);
  var node = document.createTextNode('');
  observer.observe(node, { characterData: true });

  return function () {
    return node.data = iterations = ++iterations % 2;
  };
}

// web worker
function useMessageChannel() {
  var channel = new MessageChannel();
  channel.port1.onmessage = flush;
  return function () {
    return channel.port2.postMessage(0);
  };
}

function useSetTimeout() {
  return function () {
    return setTimeout(flush, 1);
  };
}

var queue$1 = new Array(1000);

function flush() {
  for (var i = 0; i < len; i += 2) {
    var callback = queue$1[i];
    var arg = queue$1[i + 1];

    callback(arg);

    queue$1[i] = undefined;
    queue$1[i + 1] = undefined;
  }

  len = 0;
}

function attemptVertex() {
  try {
    var r = require;
    var vertx = r('vertx');
    vertxNext = vertx.runOnLoop || vertx.runOnContext;
    return useVertxTimer();
  } catch (e) {
    return useSetTimeout();
  }
}

var scheduleFlush$1 = void 0;
// Decide what async method to use to triggering processing of queued callbacks:
if (isNode) {
  scheduleFlush$1 = useNextTick();
} else if (BrowserMutationObserver) {
  scheduleFlush$1 = useMutationObserver();
} else if (isWorker) {
  scheduleFlush$1 = useMessageChannel();
} else if (browserWindow === undefined && typeof require === 'function') {
  scheduleFlush$1 = attemptVertex();
} else {
  scheduleFlush$1 = useSetTimeout();
}

var _asap$Promise$EventTa;

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// defaults
config.async = asap;
config.after = function (cb) {
  return setTimeout(cb, 0);
};

var async = function (callback, arg) {
  return config.async(callback, arg);
};

function on() {
  config['on'].apply(config, arguments);
}

function off() {
  config['off'].apply(config, arguments);
}

// Set up instrumentation through `window.__PROMISE_INTRUMENTATION__`
if (typeof window !== 'undefined' && typeof window['__PROMISE_INSTRUMENTATION__'] === 'object') {
  var callbacks = window['__PROMISE_INSTRUMENTATION__'];
  configure('instrument', true);
  for (var eventName in callbacks) {
    if (callbacks.hasOwnProperty(eventName)) {
      on(eventName, callbacks[eventName]);
    }
  }
}

// the default export here is for backwards compat:
//   https://github.com/tildeio/rsvp.js/issues/434
var rsvp = (_asap$Promise$EventTa = {
  asap: asap,
  Promise: Promise,
  EventTarget: EventTarget,
  all: all$1,
  allSettled: allSettled,
  race: race$1,
  hash: hash,
  hashSettled: hashSettled,
  rethrow: rethrow,
  defer: defer,
  denodeify: denodeify,
  configure: configure,
  on: on,
  off: off,
  resolve: resolve$2,
  reject: reject$2,
  map: map
}, _defineProperty(_asap$Promise$EventTa, 'async', async), _defineProperty(_asap$Promise$EventTa, 'filter', filter), _asap$Promise$EventTa);

exports['default'] = rsvp;
exports.asap = asap;
exports.Promise = Promise;
exports.EventTarget = EventTarget;
exports.all = all$1;
exports.allSettled = allSettled;
exports.race = race$1;
exports.hash = hash;
exports.hashSettled = hashSettled;
exports.rethrow = rethrow;
exports.defer = defer;
exports.denodeify = denodeify;
exports.configure = configure;
exports.on = on;
exports.off = off;
exports.resolve = resolve$2;
exports.reject = reject$2;
exports.map = map;
exports.async = async;
exports.filter = filter;

Object.defineProperty(exports, '__esModule', { value: true });

})));





//

!function o(a,s,c){function u(t,e){if(!s[t]){if(!a[t]){var r="function"==typeof require&&require;if(!e&&r)return r(t,!0);if(f)return f(t,!0);var n=new Error("Cannot find module '"+t+"'");throw n.code="MODULE_NOT_FOUND",n}var i=s[t]={exports:{}};a[t][0].call(i.exports,function(e){return u(a[t][1][e]||e)},i,i.exports,o,a,s,c)}return s[t].exports}for(var f="function"==typeof require&&require,e=0;e<c.length;e++)u(c[e]);return u}({1:[function(e,t,r){window.IOTA=e("./lib/iota.js")},{"./lib/iota.js":15}],2:[function(e,t,r){var c=e("./apiCommands"),y=e("../errors/inputErrors"),g=e("../utils/inputValidator"),x=e("../crypto/hmac/hmac"),B=e("../crypto/converter/converter"),E=e("../crypto/signing/signing"),m=e("../crypto/bundle/bundle"),H=e("../utils/utils"),l=e("async"),j=new Array(244).join("9");function n(e,t){this._makeRequest=e,this.sandbox=t}n.prototype.setApiTimeout=function(e){this._makeRequest.setApiTimeout(e)},n.prototype.sendCommand=function(t,e){var r=["addresses","bundles","hashes","tags","transactions","approvees"];if(-1<["findTransactions","getBalances","getInclusionStates","getTrytes"].indexOf(t.command)){var n=Object.keys(t).filter(function(e){return-1<r.indexOf(e)&&1e3<t[e].length});if(n.length)return this._makeRequest.batchedSend(t,n,1e3,e)}return this._makeRequest.send(t,e)},n.prototype.attachToTangle=function(e,t,r,n,i){if(!g.isHash(e))return i(y.invalidTrunkOrBranch(e));if(!g.isHash(t))return i(y.invalidTrunkOrBranch(t));if(!g.isValue(r))return i(y.notInt());if(!g.isArrayOfTrytes(n))return i(y.invalidTrytes());var o=c.attachToTangle(e,t,r,n);return this.sendCommand(o,i)},n.prototype.findTransactions=function(r,e){if(!g.isObject(r))return e(y.invalidKey());var t=Object.keys(r),n=["bundles","addresses","tags","approvees"],i=!1;if(t.forEach(function(e){if(-1!==n.indexOf(e)){"addresses"===e&&(r.addresses=r.addresses.map(function(e){return H.noChecksum(e)}));var t=r[e];if("tags"===e)r.tags=t.map(function(e){for(;e.length<27;)e+="9";if(g.isTrytes(e,27))return e;i=y.invalidTrytes()});else if(!g.isArrayOfHashes(t))return void(i=y.invalidTrytes())}else i=y.invalidKey()}),!i){var o=c.findTransactions(r);return this.sendCommand(o,e)}e(i)},n.prototype.getBalances=function(e,t,r){if(!g.isArrayOfHashes(e))return r(y.invalidTrytes());var n=c.getBalances(e.map(function(e){return H.noChecksum(e)}),t);return this.sendCommand(n,r)},n.prototype.getInclusionStates=function(e,t,r){if(!g.isArrayOfHashes(e))return r(y.invalidTrytes());if(!g.isArrayOfHashes(t))return r(y.invalidTrytes());var n=c.getInclusionStates(e,t);return this.sendCommand(n,r)},n.prototype.getNodeInfo=function(e){var t=c.getNodeInfo();return this.sendCommand(t,e)},n.prototype.getNeighbors=function(e){var t=c.getNeighbors();return this.sendCommand(t,e)},n.prototype.addNeighbors=function(e,t){for(var r=0;r<e.length;r++)if(!g.isUri(e[r]))return t(y.invalidUri(e[r]));var n=c.addNeighbors(e);return this.sendCommand(n,t)},n.prototype.removeNeighbors=function(e,t){for(var r=0;r<e.length;r++)if(!g.isUri(e[r]))return t(y.invalidUri(e[r]));var n=c.removeNeighbors(e);return this.sendCommand(n,t)},n.prototype.getTips=function(e){var t=c.getTips();return this.sendCommand(t,e)};n.prototype.getTransactionsToApprove=function(r,e,n){var i=this;"function"==typeof e&&(n=e,e={});var o="string"==typeof e?e:e.reference,a=e.maxDepth||15,s=e.adjustDepth||!1;if(!g.isValue(r))return n(y.invalidInputs());var t=c.getTransactionsToApprove(r,o);return this.sendCommand(t,function(e,t){if(s&&e&&-1<e.message.indexOf("reference transaction is too old")&&++r<=a)return i.getTransactionsToApprove(r,{reference:o,adjustDepth:s,maxDepth:a},n);n(e,t)})},n.prototype.getTrytes=function(e,t){if(!g.isArrayOfHashes(e))return t(y.invalidTrytes());var r=c.getTrytes(e);return this.sendCommand(r,t)},n.prototype.interruptAttachingToTangle=function(e){var t=c.interruptAttachingToTangle();return this.sendCommand(t,e)},n.prototype.broadcastTransactions=function(e,t){if(!g.isArrayOfAttachedTrytes(e))return t(y.invalidAttachedTrytes());var r=c.broadcastTransactions(e);return this.sendCommand(r,t)},n.prototype.storeTransactions=function(e,t){if(!g.isArrayOfAttachedTrytes(e))return t(y.invalidAttachedTrytes());var r=c.storeTransactions(e);return this.sendCommand(r,t)},n.prototype.getTransactionsObjects=function(n,i){if(!g.isArrayOfHashes(n))return i(y.invalidInputs());this.getTrytes(n,function(e,t){if(e)return i(e);var r=[];return t.forEach(function(e,t){e?r.push(H.transactionObject(e,n[t])):r.push(null)}),i(null,r)})},n.prototype.findTransactionObjects=function(e,r){var n=this;n.findTransactions(e,function(e,t){if(e)return r(e);n.getTransactionsObjects(t,r)})},n.prototype.getLatestInclusion=function(n,i){var o=this;o.getNodeInfo(function(e,t){if(e)return i(e);var r=t.latestSolidSubtangleMilestone;return o.getInclusionStates(n,Array(r),i)})},n.prototype.storeAndBroadcast=function(r,n){var i=this;i.storeTransactions(r,function(e,t){return e?n(e):i.broadcastTransactions(r,n)})},n.prototype.sendTrytes=function(r,e,n,t,i){var o=this;if(4===arguments.length&&"[object Function]"===Object.prototype.toString.call(t)&&(i=t,t={}),!g.isValue(e)||!g.isValue(n))return i(y.invalidInputs());o.getTransactionsToApprove(e,t,function(e,t){if(e)return i(e);o.attachToTangle(t.trunkTransaction,t.branchTransaction,n,r,function(e,n){if(e)return i(e);if(o.sandbox){var t=o.sandbox+"/jobs/"+n.id;o._makeRequest.sandboxSend(t,function(e,n){if(e)return i(e);o.storeAndBroadcast(n,function(e,t){if(e)return i(e);var r=[];return n.forEach(function(e){r.push(H.transactionObject(e))}),i(null,r)})})}else o.storeAndBroadcast(n,function(e,t){if(e)return i(e);var r=[];return n.forEach(function(e){r.push(H.transactionObject(e))}),i(null,r)})})})},n.prototype.sendTransfer=function(e,r,n,t,i,o){var a=this;return arguments.length<5?o(new Error("Invalid number of arguments")):(5===arguments.length&&"[object Function]"===Object.prototype.toString.call(i)&&(o=i,i={}),g.isValue(r)&&g.isValue(n)?void a.prepareTransfers(e,t,i,function(e,t){if(e)return o(e);a.sendTrytes(t,r,n,i,o)}):o(y.invalidInputs()))},n.prototype.promoteTransaction=function(r,n,i,o,a,s){var c=this;if(a||(a={}),!g.isHash(r))return s(y.invalidTrytes());c.isPromotable(r,{rejectWithReason:!0}).then(function(e){if(!0===a.interrupt||"function"==typeof a.interrupt&&a.interrupt())return s(null,r);c.sendTransfer(o[0].address,n,i,o,{reference:r,adjustDepth:!0,maxDepth:a.maxDepth},function(e,t){if(!(null==e&&0<a.delay))return s(e,t);setTimeout(function(){c.promoteTransaction(r,n,i,o,a,s)},a.delay)})}).catch(function(e){s(e)})},n.prototype.replayBundle=function(e,n,i,o){var a=this;return g.isHash(e)?g.isValue(n)&&g.isValue(i)?void a.getBundle(e,function(e,t){if(e)return o(e);var r=[];return t.forEach(function(e){r.push(H.transactionTrytes(e))}),a.sendTrytes(r.reverse(),n,i,o)}):o(y.invalidInputs()):o(y.invalidTrytes())},n.prototype.broadcastBundle=function(e,n){var i=this;if(!g.isHash(e))return n(y.invalidTrytes());i.getBundle(e,function(e,t){if(e)return n(e);var r=[];return t.forEach(function(e){r.push(H.transactionTrytes(e))}),i.broadcastTransactions(r.reverse(),n)})},n.prototype._newAddress=function(e,t,r,n){var i=E.key("string"==typeof e?B.trits(e):e,t,r),o=E.digests(i),a=E.address(o),s=B.trytes(a);return n&&(s=H.addChecksum(s)),s},n.prototype.getNewAddress=function(e,i,n){var o=this;if(2===arguments.length&&"[object Function]"===Object.prototype.toString.call(i)&&(n=i,i={}),!g.isTrytes(e)&&!g.isTritArray(e))return n(y.invalidSeed());var t=0;if("index"in i&&(t=i.index,!g.isValue(t)||t<0))return n(y.invalidIndex());var a=i.checksum||!1,r=i.total||null,s=2;if("security"in i&&(s=i.security,!g.isValue(s)||s<1||3<s))return n(y.invalidSecurity());var c=[];if(r){for(var u=0;u<r;u++,t++){var f=o._newAddress(e,t,s,a);c.push(f)}return n(null,c)}l.doWhilst(function(r){var n=o._newAddress(e,t,s,a);i.returnAll&&c.push(n),t+=1,o.wereAddressesSpentFrom(n,function(e,t){if(e)return r(e);t[0]?r(null,n,!0):o.findTransactions({addresses:[n]},function(e,t){if(e)return r(e);r(e,n,0<t.length)})})},function(e,t){return t},function(e,t){if(e)return n(e);var r=i.returnAll?c:t;return n(null,r)})},n.prototype.getInputs=function(e,t,c){var r=this;if(2===arguments.length&&"[object Function]"===Object.prototype.toString.call(t)&&(c=t,t={}),!g.isTrytes(e)&&!g.isTritArray(e))return c(y.invalidSeed());var u=t.start||0,n=t.end||null,f=t.threshold||null,l=t.security||2;if(t.end&&(n<u||u+500<n))return c(new Error("Invalid inputs provided"));if(n){for(var i=[],o=u;o<n;o++){var a=r._newAddress(e,o,l,!1);i.push(a)}s(i)}else r.getNewAddress(e,{index:u,returnAll:!0,security:l},function(e,t){if(e)return c(e);s(t)});function s(s){r.getBalances(s,100,function(e,t){if(e)return c(e);for(var r={inputs:[],totalBalance:0},n=!f,i=0;i<s.length;i++){var o=parseInt(t.balances[i]);if(0<o){var a={address:s[i],balance:o,keyIndex:u+i,security:l};if(r.inputs.push(a),r.totalBalance+=o,f&&r.totalBalance>=f){n=!0;break}}}return n?c(null,r):c(new Error("Not enough balance"))})}},n.prototype.prepareTransfers=function(b,e,w,_){var f=this,t=!1,k=!1;if(3===arguments.length&&"[object Function]"===Object.prototype.toString.call(w)&&(_=w,w={}),!g.isTrytes(b)&&!g.isTritArray(b))return _(y.invalidSeed());if(w.hasOwnProperty("hmacKey")&&w.hmacKey){if(!g.isTrytes(w.hmacKey))return _(y.invalidTrytes());t=!0}if(e.forEach(function(e){if(e.message=e.message?e.message:"",e.obsoleteTag=e.tag?e.tag:e.obsoleteTag?e.obsoleteTag:"",t&&0<e.value&&(e.message=j+e.message,k=!0),90===e.address.length&&!H.isValidChecksum(e.address))return _(y.invalidChecksum(e.address));e.address=H.noChecksum(e.address)}),!g.isTransfersArray(e))return _(y.invalidTransfers());if(w.inputs&&!g.isInputs(w.inputs))return _(y.invalidInputs());for(var l,d=w.address||null,T=(w.inputs,w.security||2),S=new m,h=0,A=[],r=0;r<e.length;r++){var n=1;if(2187<e[r].message.length){n+=Math.floor(e[r].message.length/2187);for(var i=e[r].message;i;){var o=i.slice(0,2187);i=i.slice(2187,i.length);for(var a=0;o.length<2187;a++)o+="9";A.push(o)}}else{o="";e[r].message&&(o=e[r].message.slice(0,2187));for(a=0;o.length<2187;a++)o+="9";A.push(o)}var s=Math.floor(Date.now()/1e3);l=e[r].obsoleteTag?e[r].obsoleteTag:"999999999999999999999999999";for(a=0;l.length<27;a++)l+="9";S.addEntry(n,e[r].address,e[r].value,l,s),h+=parseInt(e[r].value)}if(!h){S.finalize(),S.addTrytes(A);var c=[];return S.bundle.forEach(function(e){c.push(H.transactionTrytes(e))}),_(null,c.reverse())}if(w.inputs){var u=[];w.inputs.forEach(function(e){u.push(e.address)}),f.getBalances(u,100,function(e,t){if(e)return _(e);for(var r=[],n=0,i=0;i<t.balances.length;i++){var o=parseInt(t.balances[i]);if(0<o){n+=o;var a=w.inputs[i];if(a.balance=o,r.push(a),h<=n)break}}if(n<h)return _(new Error("Not enough balance"));p(r)})}else f.getInputs(b,{threshold:h,security:T},function(e,t){if(e)return _(e);p(t.inputs)});function p(n){for(var e=h,t=0;t<n.length;t++){var r=n[t].balance,i=0-r,o=Math.floor(Date.now()/1e3),a=H.noChecksum(n[t].address);if(S.addEntry(n[t].security,a,i,l,o),e<=r){var s=r-e;if(0<s&&d)S.addEntry(1,d,s,l,o),v(n);else if(0<s){for(var c=0,u=0;u<n.length;u++)c=Math.max(n[u].keyIndex,c);c++,f.getNewAddress(b,{index:c,security:T},function(e,t){if(e)return _(e);var r=Math.floor(Date.now()/1e3);S.addEntry(1,t,s,l,r),v(n)})}else v(n)}else e-=r}}function v(e){S.finalize(),S.addTrytes(A);for(var t=0;t<S.bundle.length;t++)if(S.bundle[t].value<0){for(var r,n,i=S.bundle[t].address,o=0;o<e.length;o++)if(e[o].address===i){r=e[o].keyIndex,n=e[o].security?e[o].security:T;break}for(var a=S.bundle[t].bundle,s=E.key("string"==typeof b?B.trits(b):b,r,n),c=S.normalizedBundle(a),u=[],f=0;f<3;f++)u[f]=c.slice(27*f,27*(f+1));var l=s.slice(0,6561),d=u[0],h=E.signatureFragment(d,l);S.bundle[t].signatureMessageFragment=B.trytes(h);for(var p=1;p<n;p++)if(S.bundle[t+p].address===i&&0===S.bundle[t+p].value){var v=s.slice(6561*p,6561*(p+1)),y=u[p],g=E.signatureFragment(y,v);S.bundle[t+p].signatureMessageFragment=B.trytes(g)}}k&&new x(w.hmacKey).addHMAC(S);var m=[];return S.bundle.forEach(function(e){m.push(H.transactionTrytes(e))}),_(null,m.reverse())}},n.prototype.traverseBundle=function(e,o,a,s){var c=this;c.getTrytes(Array(e),function(e,t){if(e)return s(e);var r=t[0];if(!r)return s(new Error("Bundle transactions not visible"));var n=H.transactionObject(r);if(!n)return s(new Error("Invalid trytes, could not create object"));if(!o&&0!==n.currentIndex)return s(new Error("Invalid tail transaction supplied."));if(o||(o=n.bundle),o!==n.bundle)return s(null,a);if(0===n.lastIndex&&0===n.currentIndex)return s(null,Array(n));var i=n.trunkTransaction;return a.push(n),c.traverseBundle(i,o,a,s)})},n.prototype.getBundle=function(e,r){if(!g.isHash(e))return r(y.invalidInputs(e));this.traverseBundle(e,null,Array(),function(e,t){return e?r(e):H.isBundle(t)?r(null,t):r(new Error("Invalid Bundle provided"))})},n.prototype._bundlesFromAddresses=function(e,c,i){var u=this;u.findTransactionObjects({addresses:e},function(e,t){if(e)return i(e);var r=new Set,n=new Set;t.forEach(function(e){0===e.currentIndex?r.add(e.hash):n.add(e.bundle)}),u.findTransactionObjects({bundles:Array.from(n)},function(e,t){if(e)return i(e);t.forEach(function(e){0===e.currentIndex&&r.add(e.hash)});var a=[],s=Array.from(r);l.waterfall([function(r){c?u.getLatestInclusion(s,function(e,t){if(e)return i(e);r(null,t)}):r(null,[])},function(o,e){l.mapSeries(s,function(n,i){u.getBundle(n,function(e,t){if(!e){if(c){var r=o[s.indexOf(n)];t.forEach(function(e){e.persistence=r})}a.push(t)}i(null,!0)})},function(e,t){return a.sort(function(e,t){var r=parseInt(e[0].attachmentTimestamp),n=parseInt(t[0].attachmentTimestamp);return r<n?-1:n<r?1:0}),i(e,a)})}])})})},n.prototype.getTransfers=function(e,t,r){var n=this;if(2===arguments.length&&"[object Function]"===Object.prototype.toString.call(t)&&(r=t,t={}),!g.isTrytes(e)&&!g.isTritArray(e))return r(y.invalidSeed(e));var i=t.start||0,o=t.end||null,a=t.inclusionStates||null,s=t.security||2;if(o<i||i+500<o)return r(new Error("Invalid inputs provided"));var c={index:i,total:o?o-i:null,returnAll:!0,security:s};n.getNewAddress(e,c,function(e,t){return e?r(e):n._bundlesFromAddresses(t,a,r)})},n.prototype.getAccountData=function(e,t,r){var n=this;if(2===arguments.length&&"[object Function]"===Object.prototype.toString.call(t)&&(r=t,t={}),!g.isTrytes(e)&&!g.isTritArray(e))return r(y.invalidSeed(e));var i=t.start||0,o=t.end||null,a=t.security||2;if(o&&(o<i||i+1e3<o))return r(new Error("Invalid inputs provided"));var s={latestAddress:"",addresses:[],transfers:[],inputs:[],balance:0},c={index:i,total:o?o-i:null,returnAll:!0,security:a};n.getNewAddress(e,c,function(e,t){if(e)return r(e);s.latestAddress=t[t.length-1],s.addresses=t.slice(0,-1),n._bundlesFromAddresses(t,!0,function(e,t){if(e)return r(e);s.transfers=t,n.getBalances(s.addresses,100,function(e,t){return e?r(e):(t.balances.forEach(function(e,t){e=parseInt(e);if(s.balance+=e,0<e){var r={address:s.addresses[t],keyIndex:i+t,security:a,balance:e};s.inputs.push(r)}}),r(null,s))})})})},n.prototype.isReattachable=function(e,o){var a=this;g.isString(e)&&(e=new Array(e));for(var f={},s=[],t=0;t<e.length;t++){var r=e[t];if(!g.isAddress(r))return o(y.invalidInputs());r=H.noChecksum(r);f[r]=new Array,s.push(r)}a.findTransactionObjects({addresses:s},function(e,t){if(e)return o(e);var u=[];if(t.forEach(function(e){if(e.value<0){var t=e.address,r=e.hash;f[t].push(r),u.push(r)}}),!(0<u.length)){var r=[],n=s.length;if(1<n)for(var i=0;i<n;i++)r.push(!0);else r=!0;return o(null,r)}a.getLatestInclusion(u,function(e,c){var t=s.map(function(e){var t=f[e],r=t.length;if(0===r)return!0;for(var n=!0,i=0;i<r;i++){var o=t[i],a=u.indexOf(o),s=c[a];if(n=!s,s)break}return n});return 1===t.length&&(t=t[0]),o(null,t)})})},n.prototype.isPromotable=function(e,i){var t=this;if(i||(i={}),!g.isHash(e))return!1;var o=c.checkConsistency([e]);return new Promise(function(r,n){t.sendCommand(o,function(e,t){e&&n(e),!t.state&&i.rejectWithReason&&n(new Error("Transaction is inconsistent. Reason: "+t.info)),r(t.state)})})},n.prototype.wereAddressesSpentFrom=function(e,t){return Array.isArray(e)||(e=[e]),e.some(function(e){return!g.isAddress(e)})?t(y.invalidAddress()):this.sendCommand(c.wereAddressesSpentFrom(e.map(function(e){return H.noChecksum(e)})),t)},t.exports=n},{"../crypto/bundle/bundle":4,"../crypto/converter/converter":5,"../crypto/hmac/hmac":9,"../crypto/signing/signing":12,"../errors/inputErrors":13,"../utils/inputValidator":20,"../utils/utils":22,"./apiCommands":3,async:23}],3:[function(e,t,r){t.exports={attachToTangle:function(e,t,r,n){return{command:"attachToTangle",trunkTransaction:e,branchTransaction:t,minWeightMagnitude:r,trytes:n}},findTransactions:function(t){var r={command:"findTransactions"},n=["bundles","addresses","tags","approvees"];return Object.keys(t).forEach(function(e){-1<n.indexOf(e)&&(r[e]=t[e])}),r},getBalances:function(e,t){return{command:"getBalances",addresses:e,threshold:t}},getInclusionStates:function(e,t){return{command:"getInclusionStates",transactions:e,tips:t}},getNodeInfo:function(){return{command:"getNodeInfo"}},getNeighbors:function(){return{command:"getNeighbors"}},addNeighbors:function(e){return{command:"addNeighbors",uris:e}},removeNeighbors:function(e){return{command:"removeNeighbors",uris:e}},getTips:function(){return{command:"getTips"}},getTransactionsToApprove:function(e,t){var r={command:"getTransactionsToApprove",depth:e};return null!=t&&(r.reference=t),r},getTrytes:function(e){return{command:"getTrytes",hashes:e}},interruptAttachingToTangle:function(){return{command:"interruptAttachingToTangle"}},checkConsistency:function(e){return{command:"checkConsistency",tails:e}},broadcastTransactions:function(e){return{command:"broadcastTransactions",trytes:e}},storeTransactions:function(e){return{command:"storeTransactions",trytes:e}},wereAddressesSpentFrom:function(e){return{command:"wereAddressesSpentFrom",addresses:e}}}},{}],4:[function(e,t,r){var f=e("../curl/curl"),l=e("../kerl/kerl"),d=e("../converter/converter"),h=e("../helpers/adder");function n(){this.bundle=[]}n.prototype.addEntry=function(e,t,r,n,i,o){for(var a=0;a<e;a++){var s=new Object;s.address=t,s.value=0==a?r:0,s.obsoleteTag=n,s.tag=n,s.timestamp=i,this.bundle[this.bundle.length]=s}},n.prototype.addTrytes=function(e){for(var t="",r="999999999999999999999999999999999999999999999999999999999999999999999999999999999",n="9".repeat(27),i="9".repeat(9),o=0;t.length<2187;o++)t+="9";for(var a=0;a<this.bundle.length;a++)this.bundle[a].signatureMessageFragment=e[a]?e[a]:t,this.bundle[a].trunkTransaction=r,this.bundle[a].branchTransaction=r,this.bundle[a].attachmentTimestamp=i,this.bundle[a].attachmentTimestampLowerBound=i,this.bundle[a].attachmentTimestampUpperBound=i,this.bundle[a].nonce=n},n.prototype.finalize=function(){for(var e=!1;!e;){var t=new l;t.initialize();for(var r=0;r<this.bundle.length;r++){for(var n=d.trits(this.bundle[r].value);n.length<81;)n[n.length]=0;for(var i=d.trits(this.bundle[r].timestamp);i.length<27;)i[i.length]=0;for(var o=d.trits(this.bundle[r].currentIndex=r);o.length<27;)o[o.length]=0;for(var a=d.trits(this.bundle[r].lastIndex=this.bundle.length-1);a.length<27;)a[a.length]=0;var s=d.trits(this.bundle[r].address+d.trytes(n)+this.bundle[r].obsoleteTag+d.trytes(i)+d.trytes(o)+d.trytes(a));t.absorb(s,0,s.length)}var c=[];t.squeeze(c,0,f.HASH_LENGTH),c=d.trytes(c);for(r=0;r<this.bundle.length;r++)this.bundle[r].bundle=c;if(-1!=this.normalizedBundle(c).indexOf(13)){var u=h(d.trits(this.bundle[0].obsoleteTag),[1]);this.bundle[0].obsoleteTag=d.trytes(u)}else e=!0}},n.prototype.normalizedBundle=function(e){for(var t=[],r=0;r<3;r++){for(var n=0,i=0;i<27;i++)n+=t[27*r+i]=d.value(d.trits(e.charAt(27*r+i)));if(0<=n){for(;0<n--;)for(i=0;i<27;i++)if(-13<t[27*r+i]){t[27*r+i]--;break}}else for(;n++<0;)for(i=0;i<27;i++)if(t[27*r+i]<13){t[27*r+i]++;break}}return t},t.exports=n},{"../converter/converter":5,"../curl/curl":7,"../helpers/adder":8,"../kerl/kerl":10}],5:[function(e,t,r){var s="9ABCDEFGHIJKLMNOPQRSTUVWXYZ",c=[[0,0,0],[1,0,0],[-1,1,0],[0,1,0],[1,1,0],[-1,-1,1],[0,-1,1],[1,-1,1],[-1,0,1],[0,0,1],[1,0,1],[-1,1,1],[0,1,1],[1,1,1],[-1,-1,-1],[0,-1,-1],[1,-1,-1],[-1,0,-1],[0,0,-1],[1,0,-1],[-1,1,-1],[0,1,-1],[1,1,-1],[-1,-1,0],[0,-1,0],[1,-1,0],[-1,0,0]];t.exports={trits:function(e,t){var r=t||[];if(Number.isInteger(e)){for(var n=e<0?-e:e;0<n;){var i=n%3;n=Math.floor(n/3),1<i&&(i=-1,n++),r[r.length]=i}if(e<0)for(var o=0;o<r.length;o++)r[o]=-r[o]}else for(o=0;o<e.length;o++){var a=s.indexOf(e.charAt(o));r[3*o]=c[a][0],r[3*o+1]=c[a][1],r[3*o+2]=c[a][2]}return r},trytes:function(e){for(var t="",r=0;r<e.length;r+=3)for(var n=0;n<s.length;n++)if(c[n][0]===e[r]&&c[n][1]===e[r+1]&&c[n][2]===e[r+2]){t+=s.charAt(n);break}return t},value:function(e){for(var t=0,r=e.length;0<r--;)t=3*t+e[r];return t},fromValue:function(e){for(var t=[],r=e<0?-e:e,n=0;0<r;){var i=r%3;r=Math.floor(r/3),1<i&&(i=-1,r++),t[n]=i,n++}if(e<0)for(var o=0;o<t.length;o++)t[o]=0===t[o]?0:-t[o];return t}}},{}],6:[function(e,t,r){var l=new Uint32Array([2781776228,2667607657,344215631,987627737,203704430,1352113495,2040841986,1220259382,2851504267,2852562949,2826939359,1583999983]),d=function(e){return void 0!==e.slice?e.slice():(t=new Uint32Array(e),new Uint32Array(t));var t},h=function(e){if(void 0===e.reverse)for(var t=0,r=e.length,n=Math.floor(r/2),i=null;t<n;t+=1)i=e[t],e[t]=e[r-1-t],e[r-1-t]=i;else e.reverse()},p=function(e){for(var t=0;t<e.length;t++)e[t]=~e[t]>>>0},v=function(e,t){return e/Math.pow(2,t)>>>0},y=function(e,t,r){var n=e+t,i=4294967295&v(n,32),o=(4294967295&n)>>>0,a=0!=i;return r&&(n=o+1),i=4294967295&v(n,32),[o=(4294967295&n)>>>0,a||0!=i]},g=function(e,t){for(var r=!0,n=0;n<e.length;n++){var i=y(e[n],~t[n]>>>0,r);e[n]=i[0],r=i[1]}if(!r)throw"noborrow"},m=function(e,t){for(var r=e.length;0<r--;){var n=e[r]>>>0,i=t[r]>>>0;if(n<i)return-1;if(i<n)return 1}return 0},b=function(e,t){var r=y(e[0],t,!1);e[0]=r[0];for(var n=r[1],i=1;n&&i<e.length;){r=y(e[i],0,n);e[i]=r[0],n=r[1],i+=1}return i};t.exports={trits_to_words:function(e){if(243!=e.length)throw"Invalid trits length";var t,r=new Uint32Array(12);if(e.slice(0,242).every(function(e){}))r=d(l),p(r),b(r,1);else{for(var n=1,i=e.length-1;0<i--;){for(var o=e[i]+1,a=n,s=0,c=0;c<a;c++){var u=3*r[c]+s;s=v(u,32),r[c]=(4294967295&u)>>>0}0<s&&(r[a]=s,n+=1),n<(a=b(r,o))&&(n=a)}if(!function(e){for(var t=0;t<e.length;t++)if(0!=e[t])return!1;return!0}(r))if(m(l,r)<=0)g(r,l);else{var f=d(l);g(f,r),p(f),b(f,1),r=f}}h(r);for(i=0;i<r.length;i++)r[i]=(255&(t=r[i]))<<24|(65280&t)<<8|t>>8&65280|t>>24&255;return r},words_to_trits:function(e){if(12!=e.length)throw"Invalid words length";var t=new Int8Array(243),r=new Uint32Array(e);h(r);var n=!1;if(r[11]>>31==0)!function(e,t){for(var r=!1,n=0;n<e.length;n++){var i=y(e[n],t[n],r);e[n]=i[0],r=i[1]}}(r,l);else if(p(r),0<m(r,l))g(r,l),n=!0;else{b(r,1);var i=d(l);g(i,r),r=i}for(var o=0,a=0;a<242;a++){o=0;for(var s=11;0<=s;s--){var c=(0!=o?4294967295*o+o:0)+r[s],u=c/3>>>0,f=c%3>>>0;r[s]=u,o=f}t[a]=o-1}if(n)for(a=0;a<t.length;a++)t[a]=-t[a];return t}}},{}],7:[function(e,t,r){e("../converter/converter");var o=243;function n(e){this.rounds=e||81,this.truthTable=[1,0,-1,2,1,-1,0,2,-1,1,0]}n.HASH_LENGTH=o,n.prototype.initialize=function(e,t){if(e)this.state=e;else{this.state=[];for(var r=0;r<729;r++)this.state[r]=0}},n.prototype.reset=function(){this.initialize()},n.prototype.absorb=function(e,t,r){do{for(var n=0,i=r<o?r:o;n<i;)this.state[n++]=e[t++];this.transform()}while(0<(r-=o))},n.prototype.squeeze=function(e,t,r){do{for(var n=0,i=r<o?r:o;n<i;)e[t++]=this.state[n++];this.transform()}while(0<(r-=o))},n.prototype.transform=function(){for(var e=[],t=0,r=0;r<this.rounds;r++){e=this.state.slice();for(var n=0;n<729;n++)this.state[n]=this.truthTable[e[t]+(e[t+=t<365?364:-365]<<2)+5]}},t.exports=n},{"../converter/converter":5}],8:[function(e,t,r){function y(e,t){var r=e+t;switch(r){case 2:return-1;case-2:return 1;default:return r}}function g(e,t){return e===t?e:0}t.exports=function(e,t){for(var r,n,i,o,a,s,c,u,f,l,d=new Array(Math.max(e.length,t.length)),h=0,p=0;p<d.length;p++){r=p<e.length?e[p]:0,n=p<t.length?t[p]:0;var v=(a=h,s=void 0,c=y(i=r,o=n),u=g(i,o),f=g(c,a),l=0<(s=u+f)?1:s<0?-1:0,[y(c,a),l]);d[p]=v[0],h=v[1]}return d}},{}],9:[function(e,t,r){var s=e("../curl/curl"),c=e("../converter/converter");function n(e){this._key=c.trits(e)}n.prototype.addHMAC=function(e){for(var t=new s(27),r=this._key,n=0;n<e.bundle.length;n++)if(0<e.bundle[n].value){var i=c.trits(e.bundle[n].bundle),o=new Int8Array(243);t.initialize(),t.absorb(r,0,r.length),t.absorb(i,0,i.length),t.squeeze(o,0,o.length);var a=c.trytes(o);e.bundle[n].signatureMessageFragment=a+e.bundle[n].signatureMessageFragment.substring(81,2187)}},t.exports=n},{"../converter/converter":5,"../curl/curl":7}],10:[function(e,t,r){var a=e("crypto-js"),s=(e("../converter/converter"),e("../curl/curl")),c=e("../converter/words");function n(){this.k=a.algo.SHA3.create(),this.k.init({outputLength:384})}n.BIT_HASH_LENGTH=384,n.HASH_LENGTH=s.HASH_LENGTH,n.prototype.initialize=function(e){},n.prototype.reset=function(){this.k.reset()},n.prototype.absorb=function(e,t,r){if(r&&r%243!=0)throw new Error("Illegal length provided");do{var n=r<s.HASH_LENGTH?r:s.HASH_LENGTH,i=e.slice(t,t+n);t+=n;var o=c.trits_to_words(i);this.k.update(a.lib.WordArray.create(o))}while(0<(r-=s.HASH_LENGTH))},n.prototype.squeeze=function(e,t,r){if(r&&r%243!=0)throw new Error("Illegal length provided");do{for(var n=this.k.clone().finalize(),i=c.words_to_trits(n.words),o=0,a=r<s.HASH_LENGTH?r:s.HASH_LENGTH;o<a;)e[t++]=i[o++];for(this.reset(),o=0;o<n.words.length;o++)n.words[o]=4294967295^n.words[o];this.k.update(n)}while(0<(r-=s.HASH_LENGTH))},t.exports=n},{"../converter/converter":5,"../converter/words":6,"../curl/curl":7,"crypto-js":33}],11:[function(e,t,r){var l=e("../curl/curl"),d=e("../converter/converter"),u=e("../bundle/bundle"),h=e("../helpers/adder"),f=function(e,t){var r=[],n=new l;n.initialize();for(var i=0;i<27;i++){r=t.slice(243*i,243*(i+1));for(var o=e[i]+13;0<o--;){var a=new l;a.initialize(),a.absorb(r,0,r.length),a.squeeze(r,0,l.HASH_LENGTH)}n.absorb(r,0,r.length)}return n.squeeze(r,0,l.HASH_LENGTH),r};t.exports={key:function(e,t,r){for(;e.length%243!=0;)e.push(0);var n=d.fromValue(t),i=h(e.slice(),n),o=new l;o.initialize(),o.absorb(i,0,i.length),o.squeeze(i,0,i.length),o.initialize(),o.absorb(i,0,i.length);for(var a=[],s=0,c=[];0<r--;)for(var u=0;u<27;u++){o.squeeze(c,0,i.length);for(var f=0;f<243;f++)a[s++]=c[f]}return a},digests:function(e){for(var t=[],r=[],n=0;n<Math.floor(e.length/6561);n++){for(var i=e.slice(6561*n,6561*(n+1)),o=0;o<27;o++){r=i.slice(243*o,243*(o+1));for(var a=0;a<26;a++){var s=new l;s.initialize(),s.absorb(r,0,r.length),s.squeeze(r,0,l.HASH_LENGTH)}for(a=0;a<243;a++)i[243*o+a]=r[a]}var c=new l;for(c.initialize(),c.absorb(i,0,i.length),c.squeeze(r,0,l.HASH_LENGTH),o=0;o<243;o++)t[243*n+o]=r[o]}return t},address:function(e){var t=[],r=new l;return r.initialize(),r.absorb(e,0,e.length),r.squeeze(t,0,l.HASH_LENGTH),t},digest:f,signatureFragment:function(e,t){for(var r=t.slice(),n=[],i=new l,o=0;o<27;o++){n=r.slice(243*o,243*(o+1));for(var a=0;a<13-e[o];a++)i.initialize(),i.absorb(n,0,n.length),i.squeeze(n,0,l.HASH_LENGTH);for(a=0;a<243;a++)r[243*o+a]=n[a]}return r},validateSignatures:function(e,t,r){for(var n=[],i=(new u).normalizedBundle(r),o=0;o<3;o++)n[o]=i.slice(27*o,27*(o+1));var a=[];for(o=0;o<t.length;o++)for(var s=f(n[o%3],d.trits(t[o])),c=0;c<243;c++)a[243*o+c]=s[c];return e===d.trytes(this.address(a))}}},{"../bundle/bundle":4,"../converter/converter":5,"../curl/curl":7,"../helpers/adder":8}],12:[function(e,t,r){var u=e("../curl/curl"),l=e("../kerl/kerl"),d=e("../converter/converter"),f=e("../bundle/bundle"),h=e("../helpers/adder"),p=(e("./oldSigning"),e("../../errors/inputErrors")),v=function(e,t){var r=[],n=new l;n.initialize();for(var i=0;i<27;i++){r=t.slice(243*i,243*(i+1));for(var o=e[i]+13;0<o--;){var a=new l;a.initialize(),a.absorb(r,0,r.length),a.squeeze(r,0,u.HASH_LENGTH)}n.absorb(r,0,r.length)}return n.squeeze(r,0,u.HASH_LENGTH),r};t.exports={key:function(e,t,r){for(;e.length%243!=0;)e.push(0);var n=d.fromValue(t),i=h(e.slice(),n),o=new l;o.initialize(),o.absorb(i,0,i.length),o.squeeze(i,0,i.length),o.reset(),o.absorb(i,0,i.length);for(var a=[],s=0,c=[];0<r--;)for(var u=0;u<27;u++){o.squeeze(c,0,i.length);for(var f=0;f<243;f++)a[s++]=c[f]}return a},digests:function(e){for(var t=[],r=[],n=0;n<Math.floor(e.length/6561);n++){for(var i=e.slice(6561*n,6561*(n+1)),o=0;o<27;o++){r=i.slice(243*o,243*(o+1));for(var a=0;a<26;a++){var s=new l;s.initialize(),s.absorb(r,0,r.length),s.squeeze(r,0,u.HASH_LENGTH)}for(a=0;a<243;a++)i[243*o+a]=r[a]}var c=new l;for(c.initialize(),c.absorb(i,0,i.length),c.squeeze(r,0,u.HASH_LENGTH),o=0;o<243;o++)t[243*n+o]=r[o]}return t},address:function(e){var t=[],r=new l;return r.initialize(),r.absorb(e,0,e.length),r.squeeze(t,0,u.HASH_LENGTH),t},digest:v,signatureFragment:function(e,t){for(var r=t.slice(),n=[],i=new l,o=0;o<27;o++){n=r.slice(243*o,243*(o+1));for(var a=0;a<13-e[o];a++)i.initialize(),i.reset(),i.absorb(n,0,n.length),i.squeeze(n,0,u.HASH_LENGTH);for(a=0;a<243;a++)r[243*o+a]=n[a]}return r},validateSignatures:function(e,t,r){if(!r)throw p.invalidBundleHash();for(var n=[],i=(new f).normalizedBundle(r),o=0;o<3;o++)n[o]=i.slice(27*o,27*(o+1));var a=[];for(o=0;o<t.length;o++)for(var s=v(n[o%3],d.trits(t[o])),c=0;c<243;c++)a[243*o+c]=s[c];return e===d.trytes(this.address(a))}}},{"../../errors/inputErrors":13,"../bundle/bundle":4,"../converter/converter":5,"../curl/curl":7,"../helpers/adder":8,"../kerl/kerl":10,"./oldSigning":11}],13:[function(e,t,r){t.exports={invalidAddress:function(){return new Error("Invalid address provided")},invalidTrytes:function(){return new Error("Invalid Trytes provided")},invalidSeed:function(){return new Error("Invalid Seed provided")},invalidIndex:function(){return new Error("Invalid Index option provided")},invalidSecurity:function(){return new Error("Invalid Security option provided")},invalidChecksum:function(e){return new Error("Invalid Checksum supplied for address: "+e)},invalidAttachedTrytes:function(){return new Error("Invalid attached Trytes provided")},invalidTransfers:function(){return new Error("Invalid transfers object")},invalidKey:function(){return new Error("You have provided an invalid key value")},invalidTrunkOrBranch:function(e){return new Error("You have provided an invalid hash as a trunk/branch: "+e)},invalidUri:function(e){return new Error("You have provided an invalid URI for your Neighbor: "+e)},notInt:function(){return new Error("One of your inputs is not an integer")},invalidInputs:function(){return new Error("Invalid inputs provided")},inconsistentSubtangle:function(e){return new Error("Inconsistent subtangle: "+e)}}},{}],14:[function(e,t,r){t.exports={invalidResponse:function(e){return new Error("Invalid Response: "+e)},noConnection:function(e){return new Error("No connection to host: "+e)},requestError:function(e){return new Error("Request Error: "+e)}}},{}],15:[function(t,e,r){var n=t("./utils/utils"),i=t("./utils/makeRequest"),o=t("./api/api"),a=t("./multisig/multisig");function s(e){this.setSettings(e)}s.prototype.setSettings=function(e){e=e||{},this.version=t("../package.json").version,this.host=e.host||"http://localhost",this.port=e.port||14265,this.provider=e.provider||this.host.replace(/\/$/,"")+":"+this.port,this.sandbox=e.sandbox||!1,this.token=e.token||!1,this.username=e.username||!1,this.password=e.password||!1,this.sandbox&&(this.sandbox=this.provider.replace(/\/$/,""),this.provider=this.sandbox+"/commands"),this._makeRequest=new i(this.provider,this.token||this.username,this.password),this.api=new o(this._makeRequest,this.sandbox),this.utils=n,this.valid=t("./utils/inputValidator"),this.multisig=new a(this._makeRequest)},s.prototype.changeNode=function(e){this.setSettings(e)},e.exports=s},{"../package.json":61,"./api/api":2,"./multisig/multisig":17,"./utils/inputValidator":20,"./utils/makeRequest":21,"./utils/utils":22}],16:[function(e,t,r){var i=e("../crypto/converter/converter"),n=e("../crypto/curl/curl"),o=e("../crypto/kerl/kerl");e("../crypto/signing/signing"),e("../utils/utils"),e("../utils/inputValidator");function a(e){if(!(this instanceof a))return new a(e);this._kerl=new o,this._kerl.initialize(),e&&this.absorb(e)}a.prototype.absorb=function(e){for(var t=Array.isArray(e)?e:[e],r=0;r<t.length;r++){var n=i.trits(t[r]);this._kerl.absorb(n,0,n.length)}return this},a.prototype.finalize=function(e){e&&this.absorb(e);var t=[];return this._kerl.squeeze(t,0,n.HASH_LENGTH),i.trytes(t)},t.exports=a},{"../crypto/converter/converter":5,"../crypto/curl/curl":7,"../crypto/kerl/kerl":10,"../crypto/signing/signing":12,"../utils/inputValidator":20,"../utils/utils":22}],17:[function(e,t,r){var b=e("../crypto/signing/signing"),w=e("../crypto/converter/converter"),i=e("../crypto/kerl/kerl"),o=e("../crypto/curl/curl"),_=e("../crypto/bundle/bundle"),y=e("../utils/utils"),k=e("../utils/inputValidator"),g=e("../errors/inputErrors"),n=e("./address");function a(e){this._makeRequest=e}a.prototype.getKey=function(e,t,r){return w.trytes(b.key("string"==typeof e?w.trits(e):e,t,r))},a.prototype.getDigest=function(e,t,r){var n=b.key("string"==typeof e?w.trits(e):e,t,r);return w.trytes(b.digests(n))},a.prototype.address=n,a.prototype.validateAddress=function(e,t){var r=new i;r.initialize(),t.forEach(function(e){var t=w.trits(e);r.absorb(w.trits(e),0,t.length)});var n=[];return r.squeeze(n,0,o.HASH_LENGTH),w.trytes(n)===e},a.prototype.initiateTransfer=function(o,a,e,r){if(e.forEach(function(e){e.message=e.message?e.message:"",e.tag=e.tag?e.tag:"",e.address=y.noChecksum(e.address)}),!k.isTransfersArray(e))return r(g.invalidTransfers());if(!k.isValue(o.securitySum))return r(g.invalidInputs());if(!k.isAddress(o.address))return r(g.invalidTrytes());if(a&&!k.isAddress(a))return r(g.invalidTrytes());for(var s,c=new _,u=0,f=[],t=0;t<e.length;t++){var n=1;if(2187<e[t].message.length){n+=Math.floor(e[t].message.length/2187);for(var i=e[t].message;i;){var l=i.slice(0,2187);i=i.slice(2187,i.length);for(var d=0;l.length<2187;d++)l+="9";f.push(l)}}else{l="";e[t].message&&(l=e[t].message.slice(0,2187));for(d=0;l.length<2187;d++)l+="9";f.push(l)}var h=Math.floor(Date.now()/1e3);s=e[t].tag?e[t].tag:"999999999999999999999999999";for(d=0;s.length<27;d++)s+="9";c.addEntry(n,e[t].address.slice(0,81),e[t].value,s,h),u+=parseInt(e[t].value)}if(!u)return r(new Error("Invalid value transfer: the transfer does not require a signature."));function p(e,t){if(0<e){var r=0-e,n=Math.floor(Date.now()/1e3);c.addEntry(o.securitySum,o.address,r,s,n)}if(e<u)return t(new Error("Not enough balance."));if(u<e){var i=e-u;if(!a)return t(new Error("No remainder address defined"));c.addEntry(1,a,i,s,n)}return c.finalize(),c.addTrytes(f),t(null,c.bundle)}if(o.balance)p(o.balance,r);else{var v={command:"getBalances",addresses:new Array(o.address),threshold:100};this._makeRequest.send(v,function(e,t){if(e)return r(e);p(parseInt(t.balances[0]),r)})}},a.prototype.addSignature=function(e,t,r,n){var i=new _;i.bundle=e;for(var o=r.length/2187,a=(r=w.trits(r),0),s=0;s<i.bundle.length;s++)if(i.bundle[s].address===t){if(k.isNinesTrytes(i.bundle[s].signatureMessageFragment)){for(var c=i.bundle[s].bundle,u=r.slice(0,6561),f=i.normalizedBundle(c),l=[],d=0;d<3;d++)l[d]=f.slice(27*d,27*(d+1));var h=l[a%3],p=b.signatureFragment(h,u);i.bundle[s].signatureMessageFragment=w.trytes(p);for(var v=1;v<o;v++){var y=r.slice(6561*v,6561*(v+1)),g=l[(a+v)%3],m=b.signatureFragment(g,y);i.bundle[s+v].signatureMessageFragment=w.trytes(m)}break}a++}return n(null,i.bundle)},t.exports=a},{"../crypto/bundle/bundle":4,"../crypto/converter/converter":5,"../crypto/curl/curl":7,"../crypto/kerl/kerl":10,"../crypto/signing/signing":12,"../errors/inputErrors":13,"../utils/inputValidator":20,"../utils/utils":22,"./address":16}],18:[function(e,t,r){t.exports={toTrytes:function(e){if("string"!=typeof e)return null;for(var t="9ABCDEFGHIJKLMNOPQRSTUVWXYZ",r="",n=0;n<e.length;n++){var i=e[n].charCodeAt(0);if(255<i)return null;var o=i%27;r+=t[o]+t[(i-o)/27]}return r},fromTrytes:function(e){if("string"!=typeof e)return null;if(e.length%2)return null;for(var t="9ABCDEFGHIJKLMNOPQRSTUVWXYZ",r="",n=0;n<e.length;n+=2){var i=e[n]+e[n+1],o=t.indexOf(i[0])+27*t.indexOf(i[1]);r+=String.fromCharCode(o)}return r}}},{}],19:[function(e,t,r){var h=e("./asciiToTrytes"),p=e("./inputValidator");t.exports=function(e){if(!p.isArray(e)||void 0===e[0])return null;if("OD"!==e[0].signatureMessageFragment[0]+e[0].signatureMessageFragment[1])return null;for(var t=0,r=!0,n="",i=0,o=!1,a="";t<e.length&&r;){for(var s=e[t].signatureMessageFragment,c=0;c<s.length;c+=9){for(var u=(n+=s.slice(c,c+9)).length-n.length%2,f=n.slice(i,u),l=0;l<f.length;l+=2){var d=f[l]+f[l+1];if(o&&"99"===d){r=!1;break}a+=h.fromTrytes(d),"QD"===d&&(o=!0)}if(!r)break;i+=f.length}t+=1}return r?null:a}},{"./asciiToTrytes":18,"./inputValidator":20}],20:[function(e,t,r){var n=e("./asciiToTrytes"),s=function(e){if(!i(e))return!1;if(90===e.length){if(!c(e,90))return!1}else if(!c(e,81))return!1;return!0},c=function(e,t){t||(t="0,");var r=new RegExp("^[9A-Z]{"+t+"}$");return i(e)&&r.test(e)},u=function(e){return Number.isInteger(e)},f=function(e){return!!c(e,81)},i=function(e){return"string"==typeof e},l=function(e){return e instanceof Array};t.exports={isAddress:s,isTrytes:c,isNinesTrytes:function(e){return i(e)&&/^[9]+$/.test(e)},isSafeString:function(e){return/^[\x00-\x7F]*$/.test(e)&&n.fromTrytes(n.toTrytes(e))===e},isValue:u,isHash:f,isTransfersArray:function(e){if(!l(e))return!1;for(var t=0;t<e.length;t++){var r=e[t],n=r.address;if(!s(n))return!1;var i=r.value;if(!u(i))return!1;var o=r.message;if(!c(o,"0,"))return!1;var a=r.tag||r.obsoleteTag;if(!c(a,"0,27"))return!1}return!0},isArrayOfHashes:function(e){if(!l(e))return!1;for(var t=0;t<e.length;t++){var r=e[t];if(90===r.length){if(!c(r,90))return!1}else if(!c(r,81))return!1}return!0},isArrayOfTrytes:function(e){if(!l(e))return!1;for(var t=0;t<e.length;t++){var r=e[t];if(!c(r,2673))return!1}return!0},isArrayOfAttachedTrytes:function(e){if(!l(e))return!1;for(var t=0;t<e.length;t++){var r=e[t];if(!c(r,2673))return!1;var n=r.slice(2430);if(/^[9]+$/.test(n))return!1}return!0},isArrayOfTxObjects:function(e){if(!l(e)||0===e.length)return!1;var a=!0;return e.forEach(function(e){for(var t=[{key:"hash",validator:f,args:null},{key:"signatureMessageFragment",validator:c,args:2187},{key:"address",validator:f,args:null},{key:"value",validator:u,args:null},{key:"obsoleteTag",validator:c,args:27},{key:"timestamp",validator:u,args:null},{key:"currentIndex",validator:u,args:null},{key:"lastIndex",validator:u,args:null},{key:"bundle",validator:f,args:null},{key:"trunkTransaction",validator:f,args:null},{key:"branchTransaction",validator:f,args:null},{key:"tag",validator:c,args:27},{key:"attachmentTimestamp",validator:u,args:null},{key:"attachmentTimestampLowerBound",validator:u,args:null},{key:"attachmentTimestampUpperBound",validator:u,args:null},{key:"nonce",validator:c,args:27}],r=0;r<t.length;r++){var n=t[r].key,i=t[r].validator,o=t[r].args;if(!e.hasOwnProperty(n)){a=!1;break}if(!i(e[n],o)){a=!1;break}}}),a},isInputs:function(e){if(!l(e))return!1;for(var t=0;t<e.length;t++){var r=e[t];if(!r.hasOwnProperty("security")||!r.hasOwnProperty("keyIndex")||!r.hasOwnProperty("address"))return!1;if(!s(r.address))return!1;if(!u(r.security))return!1;if(!u(r.keyIndex))return!1}return!0},isString:i,isNum:function(e){return/^(\d+\.?\d{0,15}|\.\d{0,15})$/.test(e)},isArray:l,isObject:function(e){return!(Array.isArray(e)||null===e||"object"!=typeof e)},isUri:function(e){var t=/^(udp|tcp):\/\/([\[][^\]\.]*[\]]|[^\[\]:]*)[:]{0,1}([0-9]{1,}$|$)/i;return!!t.test(e)&&/((^\s*((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]))\s*$)|(^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$))|(^\s*((?=.{1,255}$)(?=.*[A-Za-z].*)[0-9A-Za-z](?:(?:[0-9A-Za-z]|\b-){0,61}[0-9A-Za-z])?(?:\.[0-9A-Za-z](?:(?:[0-9A-Za-z]|\b-){0,61}[0-9A-Za-z])?)*)\s*$)/.test(/[\[]{0,1}([^\[\]]*)[\]]{0,1}/.exec(t.exec(e)[1])[1])},isTritArray:function(e,t){return(e instanceof Array||e instanceof Int8Array)&&e.every(function(e){return-1<[-1,0,1].indexOf(e)})&&("number"!=typeof t||e.length===t)}}},{"./asciiToTrytes":18}],21:[function(e,t,r){var n=e("async"),u=e("../errors/requestErrors");function o(){if("undefined"!=typeof XMLHttpRequest)return new XMLHttpRequest;pretendingNotToRequire=e;return new(pretendingNotToRequire("xmlhttprequest").XMLHttpRequest)}function i(e,t,r){this.provider=e||"http://localhost:14265",this.tokenOrUsername=t,this.password=r||!1,this.timeout=-1}i.prototype.setApiTimeout=function(e){this.timeout=e},i.prototype.setProvider=function(e){this.provider=e||"http://localhost:14265"},i.prototype.open=function(){var e=o();return this.password?e.open("POST",this.provider,!0,this.tokenOrUsername,this.password):e.open("POST",this.provider,!0),e.setRequestHeader("Content-Type","application/json"),e.setRequestHeader("X-IOTA-API-Version","1"),!this.password&&this.tokenOrUsername&&e.setRequestHeader("Authorization","token "+this.tokenOrUsername),e},i.prototype.send=function(e,t){var r,n=this,i=this.open(),o=this.timeout,a=!1,s=!1,c=JSON.stringify({error:"Request timed out."});0<o&&(void 0===i.timeout?r=setTimeout(function(){4!==i.readyState&&(s=!0,i.abort())},o):i.timeout=o),i.onreadystatechange=function(){if(4===i.readyState){if(a)return;if(!s)return r&&clearTimeout(r),n.prepareResult(i.responseText.length?i.responseText:c,e.command,t);a=!0,n.prepareResult(c,e.command,t)}};try{i.send(JSON.stringify(e))}catch(e){return t(u.invalidResponse(e))}},i.prototype.batchedSend=function(o,a,i,s){var t=this,c=[];a.forEach(function(t){for(var e=o[t].slice();e.length;){var r=e.splice(0,i),n={};Object.keys(o).forEach(function(e){e!==t&&-1!==a.indexOf(e)||(n[e]=e===t?r:o[e])}),c.push(n)}}),n.mapSeries(c,function(e,r){t.send(e,function(e,t){if(e)return r(e);r(null,t)})},function(e,t){if(e)return s(e);switch(o.command){case"getBalances":var r=t.reduce(function(e,t){return e.concat(t.balances)},[]);(t=t.sort(function(e,t){return e.milestoneIndex-t.milestoneIndex}).shift()).balances=r,s(null,t);break;case"findTransactions":var n=new Set;if(1===a.length)return s(null,t.reduce(function(e,t){return e.concat(t)},[]).filter(function(e){return!n.has(e)&&(n.add(e),!0)}));var i={bundles:"bundle",addresses:"address",hashes:"hash",tags:"tag"};s(null,t.map(function(e){return e.filter(function(r){return a.every(function(t){return c.some(function(e){return e.hasOwnProperty(t)&&-1!==e[t].findIndex(function(e){return e===r[i[t]]})})})})}).reduce(function(e,t){return e.concat(t)},[]).filter(function(e){return!n.has(e.hash)&&(n.add(e.hash),!0)}));break;default:s(null,t.reduce(function(e,t){return e.concat(t)},[]))}})},i.prototype.sandboxSend=function(t,n){var i=setInterval(function(){var r=o();r.onreadystatechange=function(){if(4===r.readyState){var e;try{e=JSON.parse(r.responseText)}catch(e){return n(u.invalidResponse(e))}if("FINISHED"===e.status){var t=e.attachToTangleResponse.trytes;return clearInterval(i),n(null,t)}if("FAILED"===e.status)return clearInterval(i),n(new Error("Sandbox transaction processing failed. Please retry."))}};try{r.open("GET",t,!0),r.send(JSON.stringify())}catch(e){return n(new Error("No connection to Sandbox, failed with job: ",t))}},5e3)},i.prototype.prepareResult=function(t,e,r){var n,i={getNeighbors:"neighbors",addNeighbors:"addedNeighbors",removeNeighbors:"removedNeighbors",getTips:"hashes",findTransactions:"hashes",getTrytes:"trytes",getInclusionStates:"states",attachToTangle:"trytes",wereAddressesSpentFrom:"states"};try{t=JSON.parse(t)}catch(e){n=u.invalidResponse(t),t=null}return!n&&t.error&&(n=u.requestError(t.error),t=null),!n&&t.exception&&(n=u.requestError(t.exception),t=null),t&&i.hasOwnProperty(e)&&(t="attachToTangle"===e&&t.hasOwnProperty("id")?t:t[i[e]]),r(n,t)},t.exports=i},{"../errors/requestErrors":14,async:23}],22:[function(e,t,r){var d=e("./inputValidator"),h=(e("./makeRequest"),e("../crypto/curl/curl")),p=e("../crypto/kerl/kerl"),v=e("../crypto/converter/converter"),o=e("../crypto/signing/signing"),n=(e("crypto-js"),e("./asciiToTrytes")),i=e("./extractJson"),a=e("bignumber.js"),s={i:{val:new a(10).pow(0),dp:0},Ki:{val:new a(10).pow(3),dp:3},Mi:{val:new a(10).pow(6),dp:6},Gi:{val:new a(10).pow(9),dp:9},Ti:{val:new a(10).pow(12),dp:12},Pi:{val:new a(10).pow(15),dp:15}},c=function(e,o,t){o=o||9;var a=(t=!1!==t)?81:null,r=d.isString(e);r&&(e=new Array(e));var s=[];return e.forEach(function(e){if(!d.isTrytes(e,a))throw new Error("Invalid input");var t=new p;t.initialize();var r=v.trits(e),n=[];t.absorb(r,0,r.length),t.squeeze(n,0,h.HASH_LENGTH);var i=v.trytes(n).substring(81-o,81);s.push(e+i)}),r?s[0]:s},u=function(e){var t=d.isString(e);if(t&&81===e.length)return e;t&&(e=new Array(e));var r=[];return e.forEach(function(e){r.push(e.slice(0,81))}),t?r[0]:r},f=function(e){if(!d.isTritArray(e,8019))throw new Error("Invalid transaction trits");var t=[],r=new h;return r.initialize(),r.absorb(e,0,e.length),r.squeeze(t,0,243),t},y=function(e){for(var t=v.trits(e.value);t.length<81;)t[t.length]=0;for(var r=v.trits(e.timestamp);r.length<27;)r[r.length]=0;for(var n=v.trits(e.currentIndex);n.length<27;)n[n.length]=0;for(var i=v.trits(e.lastIndex);i.length<27;)i[i.length]=0;for(var o=v.trits(e.attachmentTimestamp||0);o.length<27;)o[o.length]=0;for(var a=v.trits(e.attachmentTimestampLowerBound||0);a.length<27;)a[a.length]=0;for(var s=v.trits(e.attachmentTimestampUpperBound||0);s.length<27;)s[s.length]=0;return e.tag=e.tag||e.obsoleteTag,e.signatureMessageFragment+e.address+v.trytes(t)+e.obsoleteTag+v.trytes(r)+v.trytes(n)+v.trytes(i)+e.bundle+e.trunkTransaction+e.branchTransaction+e.tag+v.trytes(o)+v.trytes(a)+v.trytes(s)+e.nonce};t.exports={convertUnits:function(e,t,r){if(void 0===s[t]||void 0===s[r])throw new Error("Invalid unit provided");var n=new a(e);if(n.dp()>s[t].dp)throw new Error("Input value exceeded max fromUnit precision.");return n.times(s[t].val).dividedBy(s[r].val).toNumber()},addChecksum:c,noChecksum:u,isValidChecksum:function(e){var t=u(e);return c(t)===e},transactionHash:f,transactionObject:function(e,t){if(e){for(var r=2279;r<2295;r++)if("9"!==e.charAt(r))return null;var n={},i=v.trits(e);return d.isHash(t)?n.hash=t:n.hash=v.trytes(f(i)),n.signatureMessageFragment=e.slice(0,2187),n.address=e.slice(2187,2268),n.value=v.value(i.slice(6804,6837)),n.obsoleteTag=e.slice(2295,2322),n.timestamp=v.value(i.slice(6966,6993)),n.currentIndex=v.value(i.slice(6993,7020)),n.lastIndex=v.value(i.slice(7020,7047)),n.bundle=e.slice(2349,2430),n.trunkTransaction=e.slice(2430,2511),n.branchTransaction=e.slice(2511,2592),n.tag=e.slice(2592,2619),n.attachmentTimestamp=v.value(i.slice(7857,7884)),n.attachmentTimestampLowerBound=v.value(i.slice(7884,7911)),n.attachmentTimestampUpperBound=v.value(i.slice(7911,7938)),n.nonce=e.slice(2646,2673),n}},transactionTrytes:y,isTransactionHash:function(e,t){var r=d.isArrayOfTxObjects([e]);return(!t||v.trits(r?e.hash:e).slice(-t).every(function(e){return 0===e}))&&(r?e.hash===v.trytes(f(v.trits(y(e)))):d.isHash(e))},categorizeTransfers:function(e,o){var a={sent:[],received:[]};return e.forEach(function(n){var i=!1;n.forEach(function(e,t){if(-1<o.indexOf(e.address)){var r=e.currentIndex===e.lastIndex&&0!==e.lastIndex;e.value<0&&!i&&!r?(a.sent.push(n),i=!0):0<=e.value&&!i&&!r&&a.received.push(n)}})}),a},toTrytes:n.toTrytes,fromTrytes:n.fromTrytes,extractJson:i,validateSignatures:function(e,t){for(var r,n=[],i=0;i<e.length;i++)if(e[i].address===t){if(r=e[i].bundle,d.isNinesTrytes(e[i].signatureMessageFragment))break;n.push(e[i].signatureMessageFragment)}return!!r&&o.validateSignatures(t,n,r)},isBundle:function(c){if(!d.isArrayOfTxObjects(c))return!1;var u=0,e=c[0].bundle,t=[],f=new p;f.initialize();var l=[];if(c.forEach(function(e,t){if(u+=e.value,e.currentIndex!==t)return!1;var r=y(e),n=v.trits(r.slice(2187,2349));if(f.absorb(n,0,n.length),e.value<0){for(var i=e.address,o={address:i,signatureFragments:Array(e.signatureMessageFragment)},a=t;a<c.length-1;a++){var s=c[a+1];s.address===i&&0===s.value&&o.signatureFragments.push(s.signatureMessageFragment)}l.push(o)}}),0!==u)return!1;if(f.squeeze(t,0,h.HASH_LENGTH),(t=v.trytes(t))!==e)return!1;if(c[c.length-1].currentIndex!==c[c.length-1].lastIndex)return!1;for(var r=0;r<l.length;r++)if(!o.validateSignatures(l[r].address,l[r].signatureFragments,e))return!1;return!0}}},{"../crypto/converter/converter":5,"../crypto/curl/curl":7,"../crypto/kerl/kerl":10,"../crypto/signing/signing":12,"./asciiToTrytes":18,"./extractJson":19,"./inputValidator":20,"./makeRequest":21,"bignumber.js":24,"crypto-js":33}],23:[function(e,Xr,r){(function(Wr,Kr,$r){var e,t;e=this,t=function(e){"use strict";function v(e,t){t|=0;for(var r=Math.max(e.length-t,0),n=Array(r),i=0;i<r;i++)n[i]=e[t+i];return n}var t=function(t){var r=v(arguments,1);return function(){var e=v(arguments);return t.apply(null,r.concat(e))}},c=function(r){return function(){var e=v(arguments),t=e.pop();r.call(this,e,t)}};function i(e){var t=typeof e;return null!=e&&("object"==t||"function"==t)}var r="function"==typeof $r&&$r,n="object"==typeof Wr&&"function"==typeof Wr.nextTick;function o(e){setTimeout(e,0)}function a(r){return function(e){var t=v(arguments,1);r(function(){e.apply(null,t)})}}var h=a(r?$r:n?Wr.nextTick:o);function s(n){return c(function(e,t){var r;try{r=n.apply(this,e)}catch(e){return t(e)}i(r)&&"function"==typeof r.then?r.then(function(e){u(t,null,e)},function(e){u(t,e.message?e:new Error(e))}):t(null,r)})}function u(e,t,r){try{e(t,r)}catch(e){h(f,e)}}function f(e){throw e}var l="function"==typeof Symbol;function d(e){return l&&"AsyncFunction"===e[Symbol.toStringTag]}function y(e){return d(e)?s(e):e}function p(i){return function(t){var e=v(arguments,1),r=c(function(r,e){var n=this;return i(t,function(e,t){y(e).apply(n,r.concat(t))},e)});return e.length?r.apply(this,e):r}}var g="object"==typeof Kr&&Kr&&Kr.Object===Object&&Kr,m="object"==typeof self&&self&&self.Object===Object&&self,b=g||m||Function("return this")(),w=b.Symbol,_=Object.prototype,k=_.hasOwnProperty,T=_.toString,S=w?w.toStringTag:void 0;var A=Object.prototype.toString;var x="[object Null]",B="[object Undefined]",E=w?w.toStringTag:void 0;function H(e){return null==e?void 0===e?B:x:E&&E in Object(e)?function(e){var t=k.call(e,S),r=e[S];try{var n=!(e[S]=void 0)}catch(e){}var i=T.call(e);return n&&(t?e[S]=r:delete e[S]),i}(e):(t=e,A.call(t));var t}var j="[object AsyncFunction]",O="[object Function]",I="[object GeneratorFunction]",C="[object Proxy]";var z=9007199254740991;function F(e){return"number"==typeof e&&-1<e&&e%1==0&&e<=z}function N(e){return null!=e&&F(e.length)&&!function(e){if(!i(e))return!1;var t=H(e);return t==O||t==I||t==j||t==C}(e)}var R={};function L(){}function M(t){return function(){if(null!==t){var e=t;t=null,e.apply(this,arguments)}}}var D="function"==typeof Symbol&&Symbol.iterator,q=function(e){return D&&e[D]&&e[D]()};function P(e){return null!=e&&"object"==typeof e}function U(e){return P(e)&&"[object Arguments]"==H(e)}var J=Object.prototype,V=J.hasOwnProperty,G=J.propertyIsEnumerable,W=U(function(){return arguments}())?U:function(e){return P(e)&&V.call(e,"callee")&&!G.call(e,"callee")},K=Array.isArray;var $="object"==typeof e&&e&&!e.nodeType&&e,X=$&&"object"==typeof Xr&&Xr&&!Xr.nodeType&&Xr,Z=X&&X.exports===$?b.Buffer:void 0,Y=(Z?Z.isBuffer:void 0)||function(){return!1},Q=9007199254740991,ee=/^(?:0|[1-9]\d*)$/;var te={};te["[object Float32Array]"]=te["[object Float64Array]"]=te["[object Int8Array]"]=te["[object Int16Array]"]=te["[object Int32Array]"]=te["[object Uint8Array]"]=te["[object Uint8ClampedArray]"]=te["[object Uint16Array]"]=te["[object Uint32Array]"]=!0,te["[object Arguments]"]=te["[object Array]"]=te["[object ArrayBuffer]"]=te["[object Boolean]"]=te["[object DataView]"]=te["[object Date]"]=te["[object Error]"]=te["[object Function]"]=te["[object Map]"]=te["[object Number]"]=te["[object Object]"]=te["[object RegExp]"]=te["[object Set]"]=te["[object String]"]=te["[object WeakMap]"]=!1;var re,ne="object"==typeof e&&e&&!e.nodeType&&e,ie=ne&&"object"==typeof Xr&&Xr&&!Xr.nodeType&&Xr,oe=ie&&ie.exports===ne&&g.process,ae=function(){try{var e=ie&&ie.require&&ie.require("util").types;return e||oe&&oe.binding&&oe.binding("util")}catch(e){}}(),se=ae&&ae.isTypedArray,ce=se?(re=se,function(e){return re(e)}):function(e){return P(e)&&F(e.length)&&!!te[H(e)]},ue=Object.prototype.hasOwnProperty;function fe(e,t){var r,n,i,o=K(e),a=!o&&W(e),s=!o&&!a&&Y(e),c=!o&&!a&&!s&&ce(e),u=o||a||s||c,f=u?function(e,t){for(var r=-1,n=Array(e);++r<e;)n[r]=t(r);return n}(e.length,String):[],l=f.length;for(var d in e)!t&&!ue.call(e,d)||u&&("length"==d||s&&("offset"==d||"parent"==d)||c&&("buffer"==d||"byteLength"==d||"byteOffset"==d)||(void 0,i=typeof(r=d),(n=null==(n=l)?Q:n)&&("number"==i||"symbol"!=i&&ee.test(r))&&-1<r&&r%1==0&&r<n))||f.push(d);return f}var le=Object.prototype;var de,he,pe=(de=Object.keys,he=Object,function(e){return de(he(e))}),ve=Object.prototype.hasOwnProperty;function ye(e){if(r=(t=e)&&t.constructor,t!==("function"==typeof r&&r.prototype||le))return pe(e);var t,r,n=[];for(var i in Object(e))ve.call(e,i)&&"constructor"!=i&&n.push(i);return n}function ge(e){return N(e)?fe(e):ye(e)}function me(e){if(N(e))return r=-1,n=(t=e).length,function(){return++r<n?{value:t[r],key:r}:null};var t,r,n,i,o,a,s,c,u,f=q(e);return f?(c=f,u=-1,function(){var e=c.next();return e.done?null:(u++,{value:e.value,key:u})}):(o=ge(i=e),a=-1,s=o.length,function(){var e=o[++a];return a<s?{value:i[e],key:e}:null})}function be(t){return function(){if(null===t)throw new Error("Callback was already called.");var e=t;t=null,e.apply(this,arguments)}}function we(u){return function(e,t,r){if(r=M(r||L),u<=0||!e)return r(null);var n=me(e),i=!1,o=0,a=!1;function s(e,t){if(o-=1,e)i=!0,r(e);else{if(t===R||i&&o<=0)return i=!0,r(null);a||c()}}function c(){for(a=!0;o<u&&!i;){var e=n();if(null===e)return i=!0,void(o<=0&&r(null));o+=1,t(e.value,e.key,be(s))}a=!1}c()}}function _e(e,t,r,n){we(t)(e,y(r),n)}function ke(n,i){return function(e,t,r){return n(e,i,t,r)}}function Te(e,t,r){r=M(r||L);var n=0,i=0,o=e.length;function a(e,t){e?r(e):++i!==o&&t!==R||r(null)}for(0===o&&r(null);n<o;n++)t(e[n],n,be(a))}var Se=ke(_e,1/0),Ae=function(e,t,r){(N(e)?Te:Se)(e,y(t),r)};function xe(n){return function(e,t,r){return n(Ae,e,y(t),r)}}function Be(e,t,r,n){n=n||L,t=t||[];var i=[],o=0,a=y(r);e(t,function(e,t,r){var n=o++;a(e,function(e,t){i[n]=t,r(e)})},function(e){n(e,i)})}var Ee=xe(Be),He=p(Ee);function je(i){return function(e,t,r,n){return i(we(t),e,y(r),n)}}var Oe=je(Be),Ie=ke(Oe,1),Ce=p(Ie);function ze(e,t){for(var r=-1,n=null==e?0:e.length;++r<n&&!1!==t(e[r],r,e););return e}var Fe,Ne=function(e,t,r){for(var n=-1,i=Object(e),o=r(e),a=o.length;a--;){var s=o[Fe?a:++n];if(!1===t(i[s],s,i))break}return e};function Re(e,t){return e&&Ne(e,t,ge)}function Le(e){return e!=e}function Me(e,t,r){return t==t?function(e,t,r){for(var n=r-1,i=e.length;++n<i;)if(e[n]===t)return n;return-1}(e,t,r):function(e,t,r,n){for(var i=e.length,o=r+(n?1:-1);n?o--:++o<i;)if(t(e[o],o,e))return o;return-1}(e,Le,r)}var De=function(o,e,i){"function"==typeof e&&(i=e,e=null),i=M(i||L);var r=ge(o).length;if(!r)return i(null);e||(e=r);var a={},s=0,c=!1,u=Object.create(null),n=[],f=[],l={};function d(e,t){n.push(function(){!function(n,e){if(c)return;var t=be(function(e,t){if(s--,2<arguments.length&&(t=v(arguments,1)),e){var r={};Re(a,function(e,t){r[t]=e}),r[n]=t,c=!0,u=Object.create(null),i(e,r)}else a[n]=t,ze(u[n]||[],function(e){e()}),h()});s++;var r=y(e[e.length-1]);1<e.length?r(a,t):r(t)}(e,t)})}function h(){if(0===n.length&&0===s)return i(null,a);for(;n.length&&s<e;){n.shift()()}}function p(r){var n=[];return Re(o,function(e,t){K(e)&&0<=Me(e,r,0)&&n.push(t)}),n}Re(o,function(t,r){if(!K(t))return d(r,[t]),void f.push(r);var n=t.slice(0,t.length-1),i=n.length;if(0===i)return d(r,t),void f.push(r);l[r]=i,ze(n,function(e){if(!o[e])throw new Error("async.auto task `"+r+"` has a non-existent dependency `"+e+"` in "+n.join(", "));!function(e,t){var r=u[e];r||(r=u[e]=[]);r.push(t)}(e,function(){0===--i&&d(r,t)})})}),function(){var e,t=0;for(;f.length;)e=f.pop(),t++,ze(p(e),function(e){0==--l[e]&&f.push(e)});if(t!==r)throw new Error("async.auto cannot execute tasks due to a recursive dependency")}(),h()};function qe(e,t){for(var r=-1,n=null==e?0:e.length,i=Array(n);++r<n;)i[r]=t(e[r],r,e);return i}var Pe="[object Symbol]";var Ue=1/0,Je=w?w.prototype:void 0,Ve=Je?Je.toString:void 0;function Ge(e){if("string"==typeof e)return e;if(K(e))return qe(e,Ge)+"";if("symbol"==typeof(t=e)||P(t)&&H(t)==Pe)return Ve?Ve.call(e):"";var t,r=e+"";return"0"==r&&1/e==-Ue?"-0":r}function We(e,t,r){var n=e.length;return r=void 0===r?n:r,!t&&n<=r?e:function(e,t,r){var n=-1,i=e.length;t<0&&(t=i<-t?0:i+t),(r=i<r?i:r)<0&&(r+=i),i=r<t?0:r-t>>>0,t>>>=0;for(var o=Array(i);++n<i;)o[n]=e[n+t];return o}(e,t,r)}var Ke=RegExp("[\\u200d\\ud800-\\udfff\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff\\ufe0e\\ufe0f]");var $e="\\ud800-\\udfff",Xe="["+$e+"]",Ze="[\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff]",Ye="\\ud83c[\\udffb-\\udfff]",Qe="[^"+$e+"]",et="(?:\\ud83c[\\udde6-\\uddff]){2}",tt="[\\ud800-\\udbff][\\udc00-\\udfff]",rt="(?:"+Ze+"|"+Ye+")"+"?",nt="[\\ufe0e\\ufe0f]?",it=nt+rt+("(?:\\u200d(?:"+[Qe,et,tt].join("|")+")"+nt+rt+")*"),ot="(?:"+[Qe+Ze+"?",Ze,et,tt,Xe].join("|")+")",at=RegExp(Ye+"(?="+Ye+")|"+ot+it,"g");function st(e){return t=e,Ke.test(t)?e.match(at)||[]:e.split("");var t}var ct=/^\s+|\s+$/g;function ut(e,t,r){var n;if((e=null==(n=e)?"":Ge(n))&&(r||void 0===t))return e.replace(ct,"");if(!e||!(t=Ge(t)))return e;var i=st(e),o=st(t);return We(i,function(e,t){for(var r=-1,n=e.length;++r<n&&-1<Me(t,e[r],0););return r}(i,o),function(e,t){for(var r=e.length;r--&&-1<Me(t,e[r],0););return r}(i,o)+1).join("")}var ft=/^(?:async\s+)?(function)?\s*[^\(]*\(\s*([^\)]*)\)/m,lt=/,/,dt=/(=.+)?(\s*)$/,ht=/((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm;function pt(e,t){var s={};Re(e,function(n,e){var i,t,r=d(n),o=!r&&1===n.length||r&&0===n.length;if(K(n))i=n.slice(0,-1),n=n[n.length-1],s[e]=i.concat(0<i.length?a:n);else if(o)s[e]=n;else{if(i=t=(t=(t=(t=(t=n).toString().replace(ht,"")).match(ft)[2].replace(" ",""))?t.split(lt):[]).map(function(e){return ut(e.replace(dt,""))}),0===n.length&&!r&&0===i.length)throw new Error("autoInject task functions require explicit parameters.");r||i.pop(),s[e]=i.concat(a)}function a(t,e){var r=qe(i,function(e){return t[e]});r.push(e),y(n).apply(null,r)}}),De(s,t)}function vt(){this.head=this.tail=null,this.length=0}function yt(e,t){e.length=1,e.head=e.tail=t}function gt(e,t,r){if(null==t)t=1;else if(0===t)throw new Error("Concurrency must not be zero");var a=y(e),s=0,c=[],u=!1;function n(e,t,r){if(null!=r&&"function"!=typeof r)throw new Error("task callback must be a function");if(d.started=!0,K(e)||(e=[e]),0===e.length&&d.idle())return h(function(){d.drain()});for(var n=0,i=e.length;n<i;n++){var o={data:e[n],callback:r||L};t?d._tasks.unshift(o):d._tasks.push(o)}u||(u=!0,h(function(){u=!1,d.process()}))}function f(o){return function(e){s-=1;for(var t=0,r=o.length;t<r;t++){var n=o[t],i=Me(c,n,0);0===i?c.shift():0<i&&c.splice(i,1),n.callback.apply(n,arguments),null!=e&&d.error(e,n.data)}s<=d.concurrency-d.buffer&&d.unsaturated(),d.idle()&&d.drain(),d.process()}}var l=!1,d={_tasks:new vt,concurrency:t,payload:r,saturated:L,unsaturated:L,buffer:t/4,empty:L,drain:L,error:L,started:!1,paused:!1,push:function(e,t){n(e,!1,t)},kill:function(){d.drain=L,d._tasks.empty()},unshift:function(e,t){n(e,!0,t)},remove:function(e){d._tasks.remove(e)},process:function(){if(!l){for(l=!0;!d.paused&&s<d.concurrency&&d._tasks.length;){var e=[],t=[],r=d._tasks.length;d.payload&&(r=Math.min(r,d.payload));for(var n=0;n<r;n++){var i=d._tasks.shift();e.push(i),c.push(i),t.push(i.data)}s+=1,0===d._tasks.length&&d.empty(),s===d.concurrency&&d.saturated();var o=be(f(e));a(t,o)}l=!1}},length:function(){return d._tasks.length},running:function(){return s},workersList:function(){return c},idle:function(){return d._tasks.length+s===0},pause:function(){d.paused=!0},resume:function(){!1!==d.paused&&(d.paused=!1,h(d.process))}};return d}function mt(e,t){return gt(e,1,t)}vt.prototype.removeLink=function(e){return e.prev?e.prev.next=e.next:this.head=e.next,e.next?e.next.prev=e.prev:this.tail=e.prev,e.prev=e.next=null,this.length-=1,e},vt.prototype.empty=function(){for(;this.head;)this.shift();return this},vt.prototype.insertAfter=function(e,t){t.prev=e,t.next=e.next,e.next?e.next.prev=t:this.tail=t,e.next=t,this.length+=1},vt.prototype.insertBefore=function(e,t){t.prev=e.prev,(t.next=e).prev?e.prev.next=t:this.head=t,e.prev=t,this.length+=1},vt.prototype.unshift=function(e){this.head?this.insertBefore(this.head,e):yt(this,e)},vt.prototype.push=function(e){this.tail?this.insertAfter(this.tail,e):yt(this,e)},vt.prototype.shift=function(){return this.head&&this.removeLink(this.head)},vt.prototype.pop=function(){return this.tail&&this.removeLink(this.tail)},vt.prototype.toArray=function(){for(var e=Array(this.length),t=this.head,r=0;r<this.length;r++)e[r]=t.data,t=t.next;return e},vt.prototype.remove=function(e){for(var t=this.head;t;){var r=t.next;e(t)&&this.removeLink(t),t=r}return this};var bt=ke(_e,1);function wt(e,n,t,r){r=M(r||L);var i=y(t);bt(e,function(e,t,r){i(n,e,function(e,t){n=t,r(e)})},function(e){r(e,n)})}function _t(){var t=qe(arguments,y);return function(){var e=v(arguments),n=this,r=e[e.length-1];"function"==typeof r?e.pop():r=L,wt(t,e,function(e,t,r){t.apply(n,e.concat(function(e){var t=v(arguments,1);r(e,t)}))},function(e,t){r.apply(n,[e].concat(t))})}}var kt=function(){return _t.apply(null,v(arguments).reverse())},Tt=Array.prototype.concat,St=function(e,t,r,i){i=i||L;var n=y(r);Oe(e,t,function(e,t){n(e,function(e){return e?t(e):t(null,v(arguments,1))})},function(e,t){for(var r=[],n=0;n<t.length;n++)t[n]&&(r=Tt.apply(r,t[n]));return i(e,r)})},At=ke(St,1/0),xt=ke(St,1),Bt=function(){var e=v(arguments),t=[null].concat(e);return function(){return arguments[arguments.length-1].apply(this,t)}};function Et(e){return e}function Ht(s,c){return function(e,t,i,r){r=r||L;var o,a=!1;e(t,function(r,e,n){i(r,function(e,t){e?n(e):s(t)&&!o?(o=c(a=!0,r),n(null,R)):n()})},function(e){e?r(e):r(null,a?o:c(!1))})}}function jt(e,t){return t}var Ot=xe(Ht(Et,jt)),It=je(Ht(Et,jt)),Ct=ke(It,1);function zt(r){return function(e){var t=v(arguments,1);t.push(function(e){var t=v(arguments,1);"object"==typeof console&&(e?console.error&&console.error(e):console[r]&&ze(t,function(e){console[r](e)}))}),y(e).apply(null,t)}}var Ft=zt("dir");function Nt(e,t,r){r=be(r||L);var n=y(e),i=y(t);function o(e){if(e)return r(e);var t=v(arguments,1);t.push(a),i.apply(this,t)}function a(e,t){return e?r(e):t?void n(o):r(null)}a(null,!0)}function Rt(e,r,n){n=be(n||L);var i=y(e),o=function(e){if(e)return n(e);var t=v(arguments,1);if(r.apply(this,t))return i(o);n.apply(null,[null].concat(t))};i(o)}function Lt(e,t,r){Rt(e,function(){return!t.apply(this,arguments)},r)}function Mt(e,t,r){r=be(r||L);var n=y(t),i=y(e);function o(e){if(e)return r(e);i(a)}function a(e,t){return e?r(e):t?void n(o):r(null)}i(a)}function Dt(n){return function(e,t,r){return n(e,r)}}function qt(e,t,r){Ae(e,Dt(y(t)),r)}function Pt(e,t,r,n){we(t)(e,Dt(y(r)),n)}var Ut=ke(Pt,1);function Jt(n){return d(n)?n:c(function(e,t){var r=!0;e.push(function(){var e=arguments;r?h(function(){t.apply(null,e)}):t.apply(null,e)}),n.apply(this,e),r=!1})}function Vt(e){return!e}var Gt=xe(Ht(Vt,Vt)),Wt=je(Ht(Vt,Vt)),Kt=ke(Wt,1);function $t(t){return function(e){return null==e?void 0:e[t]}}function Xt(e,n,t,i){var o=new Array(n.length);e(n,function(e,r,n){t(e,function(e,t){o[r]=!!t,n(e)})},function(e){if(e)return i(e);for(var t=[],r=0;r<n.length;r++)o[r]&&t.push(n[r]);i(null,t)})}function Zt(e,t,o,r){var a=[];e(t,function(r,n,i){o(r,function(e,t){e?i(e):(t&&a.push({index:n,value:r}),i())})},function(e){e?r(e):r(null,qe(a.sort(function(e,t){return e.index-t.index}),$t("value")))})}function Yt(e,t,r,n){(N(t)?Xt:Zt)(e,t,y(r),n||L)}var Qt=xe(Yt),er=je(Yt),tr=ke(er,1);function rr(e,t){var r=be(t||L),n=y(Jt(e));!function e(t){if(t)return r(t);n(e)}()}var nr=function(e,t,r,s){s=s||L;var i=y(r);Oe(e,t,function(r,n){i(r,function(e,t){return e?n(e):n(null,{key:t,val:r})})},function(e,t){for(var r={},n=Object.prototype.hasOwnProperty,i=0;i<t.length;i++)if(t[i]){var o=t[i].key,a=t[i].val;n.call(r,o)?r[o].push(a):r[o]=[a]}return s(e,r)})},ir=ke(nr,1/0),or=ke(nr,1),ar=zt("log");function sr(e,t,r,n){n=M(n||L);var i={},o=y(r);_e(e,t,function(e,r,n){o(e,r,function(e,t){if(e)return n(e);i[r]=t,n()})},function(e){n(e,i)})}var cr=ke(sr,1/0),ur=ke(sr,1);function fr(e,t){return t in e}function lr(e,r){var o=Object.create(null),a=Object.create(null);r=r||Et;var n=y(e),t=c(function(e,t){var i=r.apply(null,e);fr(o,i)?h(function(){t.apply(null,o[i])}):fr(a,i)?a[i].push(t):(a[i]=[t],n.apply(null,e.concat(function(){var e=v(arguments);o[i]=e;var t=a[i];delete a[i];for(var r=0,n=t.length;r<n;r++)t[r].apply(null,e)})))});return t.memo=o,t.unmemoized=e,t}var dr=a(n?Wr.nextTick:r?$r:o);function hr(e,t,r){r=r||L;var i=N(t)?[]:{};e(t,function(e,r,n){y(e)(function(e,t){2<arguments.length&&(t=v(arguments,1)),i[r]=t,n(e)})},function(e){r(e,i)})}function pr(e,t){hr(Ae,e,t)}function vr(e,t,r){hr(we(t),e,r)}var yr=function(e,t){var r=y(e);return gt(function(e,t){r(e[0],t)},t,1)},gr=function(e,t){var s=yr(e,t);return s.push=function(e,t,r){if(null==r&&(r=L),"function"!=typeof r)throw new Error("task callback must be a function");if(s.started=!0,K(e)||(e=[e]),0===e.length)return h(function(){s.drain()});t=t||0;for(var n=s._tasks.head;n&&t>=n.priority;)n=n.next;for(var i=0,o=e.length;i<o;i++){var a={data:e[i],priority:t,callback:r};n?s._tasks.insertBefore(n,a):s._tasks.push(a)}h(s.process)},delete s.unshift,s};function mr(e,t){if(t=M(t||L),!K(e))return t(new TypeError("First argument to race must be an array of functions"));if(!e.length)return t();for(var r=0,n=e.length;r<n;r++)y(e[r])(t)}function br(e,t,r,n){wt(v(e).reverse(),t,r,n)}function wr(e){var t=y(e);return c(function(e,n){return e.push(function(e,t){var r;e?n(null,{error:e}):(r=arguments.length<=2?t:v(arguments,1),n(null,{value:r}))}),t.apply(this,e)})}function _r(e){var r;return K(e)?r=qe(e,wr):(r={},Re(e,function(e,t){r[t]=wr.call(this,e)})),r}function kr(e,t,n,r){Yt(e,t,function(e,r){n(e,function(e,t){r(e,!t)})},r)}var Tr=xe(kr),Sr=je(kr),Ar=ke(Sr,1);function xr(e){return function(){return e}}function Br(e,t,r){var n={times:5,intervalFunc:xr(0)};if(arguments.length<3&&"function"==typeof e?(r=t||L,t=e):(!function(e,t){if("object"==typeof t)e.times=+t.times||5,e.intervalFunc="function"==typeof t.interval?t.interval:xr(+t.interval||0),e.errorFilter=t.errorFilter;else{if("number"!=typeof t&&"string"!=typeof t)throw new Error("Invalid arguments for async.retry");e.times=+t||5}}(n,e),r=r||L),"function"!=typeof t)throw new Error("Invalid arguments for async.retry");var i=y(t),o=1;!function t(){i(function(e){e&&o++<n.times&&("function"!=typeof n.errorFilter||n.errorFilter(e))?setTimeout(t,n.intervalFunc(o)):r.apply(null,arguments)})}()}var Er=function(n,e){e||(e=n,n=null);var i=y(e);return c(function(t,e){function r(e){i.apply(null,t.concat(e))}n?Br(n,r,e):Br(r,e)})};function Hr(e,t){hr(bt,e,t)}var jr=xe(Ht(Boolean,Et)),Or=je(Ht(Boolean,Et)),Ir=ke(Or,1);function Cr(e,t,r){var i=y(t);function n(e,t){var r=e.criteria,n=t.criteria;return r<n?-1:n<r?1:0}Ee(e,function(r,n){i(r,function(e,t){if(e)return n(e);n(null,{value:r,criteria:t})})},function(e,t){if(e)return r(e);r(null,qe(t.sort(n),$t("value")))})}function zr(i,o,a){var s=y(i);return c(function(e,r){var t,n=!1;e.push(function(){n||(r.apply(null,arguments),clearTimeout(t))}),t=setTimeout(function(){var e=i.name||"anonymous",t=new Error('Callback function "'+e+'" timed out.');t.code="ETIMEDOUT",a&&(t.info=a),n=!0,r(t)},o),s.apply(null,e)})}var Fr=Math.ceil,Nr=Math.max;function Rr(e,t,r,n){var i=y(r);Oe(function(e,t,r,n){for(var i=-1,o=Nr(Fr((t-e)/(r||1)),0),a=Array(o);o--;)a[n?o:++i]=e,e+=r;return a}(0,e,1),t,i,n)}var Lr=ke(Rr,1/0),Mr=ke(Rr,1);function Dr(e,n,t,r){arguments.length<=3&&(r=t,t=n,n=K(e)?[]:{}),r=M(r||L);var i=y(t);Ae(e,function(e,t,r){i(n,e,t,r)},function(e){r(e,n)})}function qr(e,t){var n,i=null;t=t||L,Ut(e,function(e,r){y(e)(function(e,t){n=2<arguments.length?v(arguments,1):t,r(!(i=e))})},function(){t(i,n)})}function Pr(e){return function(){return(e.unmemoized||e).apply(null,arguments)}}function Ur(r,e,n){n=be(n||L);var i=y(e);if(!r())return n(null);var o=function(e){if(e)return n(e);if(r())return i(o);var t=v(arguments,1);n.apply(null,[null].concat(t))};i(o)}function Jr(e,t,r){Ur(function(){return!e.apply(this,arguments)},t,r)}var Vr=function(r,t){if(t=M(t||L),!K(r))return t(new Error("First argument to waterfall must be an array of functions"));if(!r.length)return t();var n=0;function i(e){var t=y(r[n++]);e.push(be(o)),t.apply(null,e)}function o(e){if(e||n===r.length)return t.apply(null,arguments);i(v(arguments,1))}i([])},Gr={apply:t,applyEach:He,applyEachSeries:Ce,asyncify:s,auto:De,autoInject:pt,cargo:mt,compose:kt,concat:At,concatLimit:St,concatSeries:xt,constant:Bt,detect:Ot,detectLimit:It,detectSeries:Ct,dir:Ft,doDuring:Nt,doUntil:Lt,doWhilst:Rt,during:Mt,each:qt,eachLimit:Pt,eachOf:Ae,eachOfLimit:_e,eachOfSeries:bt,eachSeries:Ut,ensureAsync:Jt,every:Gt,everyLimit:Wt,everySeries:Kt,filter:Qt,filterLimit:er,filterSeries:tr,forever:rr,groupBy:ir,groupByLimit:nr,groupBySeries:or,log:ar,map:Ee,mapLimit:Oe,mapSeries:Ie,mapValues:cr,mapValuesLimit:sr,mapValuesSeries:ur,memoize:lr,nextTick:dr,parallel:pr,parallelLimit:vr,priorityQueue:gr,queue:yr,race:mr,reduce:wt,reduceRight:br,reflect:wr,reflectAll:_r,reject:Tr,rejectLimit:Sr,rejectSeries:Ar,retry:Br,retryable:Er,seq:_t,series:Hr,setImmediate:h,some:jr,someLimit:Or,someSeries:Ir,sortBy:Cr,timeout:zr,times:Lr,timesLimit:Rr,timesSeries:Mr,transform:Dr,tryEach:qr,unmemoize:Pr,until:Jr,waterfall:Vr,whilst:Ur,all:Gt,allLimit:Wt,allSeries:Kt,any:jr,anyLimit:Or,anySeries:Ir,find:Ot,findLimit:It,findSeries:Ct,forEach:qt,forEachSeries:Ut,forEachLimit:Pt,forEachOf:Ae,forEachOfSeries:bt,forEachOfLimit:_e,inject:wt,foldl:wt,foldr:br,select:Qt,selectLimit:er,selectSeries:tr,wrapSync:s};e.default=Gr,e.apply=t,e.applyEach=He,e.applyEachSeries=Ce,e.asyncify=s,e.auto=De,e.autoInject=pt,e.cargo=mt,e.compose=kt,e.concat=At,e.concatLimit=St,e.concatSeries=xt,e.constant=Bt,e.detect=Ot,e.detectLimit=It,e.detectSeries=Ct,e.dir=Ft,e.doDuring=Nt,e.doUntil=Lt,e.doWhilst=Rt,e.during=Mt,e.each=qt,e.eachLimit=Pt,e.eachOf=Ae,e.eachOfLimit=_e,e.eachOfSeries=bt,e.eachSeries=Ut,e.ensureAsync=Jt,e.every=Gt,e.everyLimit=Wt,e.everySeries=Kt,e.filter=Qt,e.filterLimit=er,e.filterSeries=tr,e.forever=rr,e.groupBy=ir,e.groupByLimit=nr,e.groupBySeries=or,e.log=ar,e.map=Ee,e.mapLimit=Oe,e.mapSeries=Ie,e.mapValues=cr,e.mapValuesLimit=sr,e.mapValuesSeries=ur,e.memoize=lr,e.nextTick=dr,e.parallel=pr,e.parallelLimit=vr,e.priorityQueue=gr,e.queue=yr,e.race=mr,e.reduce=wt,e.reduceRight=br,e.reflect=wr,e.reflectAll=_r,e.reject=Tr,e.rejectLimit=Sr,e.rejectSeries=Ar,e.retry=Br,e.retryable=Er,e.seq=_t,e.series=Hr,e.setImmediate=h,e.some=jr,e.someLimit=Or,e.someSeries=Ir,e.sortBy=Cr,e.timeout=zr,e.times=Lr,e.timesLimit=Rr,e.timesSeries=Mr,e.transform=Dr,e.tryEach=qr,e.unmemoize=Pr,e.until=Jr,e.waterfall=Vr,e.whilst=Ur,e.all=Gt,e.allLimit=Wt,e.allSeries=Kt,e.any=jr,e.anyLimit=Or,e.anySeries=Ir,e.find=Ot,e.findLimit=It,e.findSeries=Ct,e.forEach=qt,e.forEachSeries=Ut,e.forEachLimit=Pt,e.forEachOf=Ae,e.forEachOfSeries=bt,e.forEachOfLimit=_e,e.inject=wt,e.foldl=wt,e.foldr=br,e.select=Qt,e.selectLimit=er,e.selectSeries=tr,e.wrapSync=s,Object.defineProperty(e,"__esModule",{value:!0})},"object"==typeof r&&void 0!==Xr?t(r):"function"==typeof define&&define.amd?define(["exports"],t):t(e.async=e.async||{})}).call(this,e("_process"),"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},e("timers").setImmediate)},{_process:59,timers:60}],24:[function(e,r,t){!function(e){"use strict";var t,F=/^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i,N=Math.ceil,R=Math.floor,L=" not a boolean or binary digit",M="rounding mode",D="number type has more than 15 significant digits",q="0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_",P=1e14,U=14,J=9007199254740991,V=[1,10,100,1e3,1e4,1e5,1e6,1e7,1e8,1e9,1e10,1e11,1e12,1e13],G=1e7,W=1e9;function K(e){var t=0|e;return 0<e||e===t?t:t-1}function $(e){for(var t,r,n=1,i=e.length,o=e[0]+"";n<i;){for(t=e[n++]+"",r=U-t.length;r--;t="0"+t);o+=t}for(i=o.length;48===o.charCodeAt(--i););return o.slice(0,i+1||1)}function o(e,t){var r,n,i=e.c,o=t.c,a=e.s,s=t.s,c=e.e,u=t.e;if(!a||!s)return null;if(r=i&&!i[0],n=o&&!o[0],r||n)return r?n?0:-s:a;if(a!=s)return a;if(r=a<0,n=c==u,!i||!o)return n?0:!i^r?1:-1;if(!n)return u<c^r?1:-1;for(s=(c=i.length)<(u=o.length)?c:u,a=0;a<s;a++)if(i[a]!=o[a])return i[a]>o[a]^r?1:-1;return c==u?0:u<c^r?1:-1}function X(e,t,r){return(e=te(e))>=t&&e<=r}function Z(e){return"[object Array]"==Object.prototype.toString.call(e)}function Y(e,t,r){for(var n,i,o=[0],a=0,s=e.length;a<s;){for(i=o.length;i--;o[i]*=t);for(o[n=0]+=q.indexOf(e.charAt(a++));n<o.length;n++)o[n]>r-1&&(null==o[n+1]&&(o[n+1]=0),o[n+1]+=o[n]/r|0,o[n]%=r)}return o.reverse()}function Q(e,t){return(1<e.length?e.charAt(0)+"."+e.slice(1):e)+(t<0?"e":"e+")+t}function ee(e,t){var r,n;if(t<0){for(n="0.";++t;n+="0");e=n+e}else if(++t>(r=e.length)){for(n="0",t-=r;--t;n+="0");e+=n}else t<r&&(e=e.slice(0,t)+"."+e.slice(t));return e}function te(e){return(e=parseFloat(e))<0?N(e):R(e)}(t=function e(t){var y,u,r,f,a,s,c,l,d,w=0,n=E.prototype,g=new E(1),p=20,m=4,h=-7,v=21,b=-1e7,_=1e7,k=!0,T=O,S=!1,A=1,x=0,B={decimalSeparator:".",groupSeparator:",",groupSize:3,secondaryGroupSize:0,fractionGroupSeparator:" ",fractionGroupSize:0};function E(e,t){var r,n,i,o,a,s,c=this;if(!(c instanceof E))return k&&C(26,"constructor call without new",e),new E(e,t);if(null!=t&&T(t,2,64,w,"base")){if(s=e+"",10==(t|=0))return z(c=new E(e instanceof E?e:s),p+c.e+1,m);if((o="number"==typeof e)&&0*e!=0||!new RegExp("^-?"+(r="["+q.slice(0,t)+"]+")+"(?:\\."+r+")?$",t<37?"i":"").test(s))return u(c,s,o,t);o?(c.s=1/e<0?(s=s.slice(1),-1):1,k&&15<s.replace(/^0\.0*|\./,"").length&&C(w,D,e),o=!1):c.s=45===s.charCodeAt(0)?(s=s.slice(1),-1):1,s=H(s,10,t,c.s)}else{if(e instanceof E)return c.s=e.s,c.e=e.e,c.c=(e=e.c)?e.slice():e,void(w=0);if((o="number"==typeof e)&&0*e==0){if(c.s=1/e<0?(e=-e,-1):1,e===~~e){for(n=0,i=e;10<=i;i/=10,n++);return c.e=n,c.c=[e],void(w=0)}s=e+""}else{if(!F.test(s=e+""))return u(c,s,o);c.s=45===s.charCodeAt(0)?(s=s.slice(1),-1):1}}for(-1<(n=s.indexOf("."))&&(s=s.replace(".","")),0<(i=s.search(/e/i))?(n<0&&(n=i),n+=+s.slice(i+1),s=s.substring(0,i)):n<0&&(n=s.length),i=0;48===s.charCodeAt(i);i++);for(a=s.length;48===s.charCodeAt(--a););if(s=s.slice(i,a+1))if(a=s.length,o&&k&&15<a&&(J<e||e!==R(e))&&C(w,D,c.s*e),_<(n=n-i-1))c.c=c.e=null;else if(n<b)c.c=[c.e=0];else{if(c.e=n,c.c=[],i=(n+1)%U,n<0&&(i+=U),i<a){for(i&&c.c.push(+s.slice(0,i)),a-=U;i<a;)c.c.push(+s.slice(i,i+=U));s=s.slice(i),i=U-s.length}else i-=a;for(;i--;s+="0");c.c.push(+s)}else c.c=[c.e=0];w=0}function H(e,t,r,n){var i,o,a,s,c,u,f,l=e.indexOf("."),d=p,h=m;for(r<37&&(e=e.toLowerCase()),0<=l&&(a=x,x=0,e=e.replace(".",""),c=(f=new E(r)).pow(e.length-l),x=a,f.c=Y(ee($(c.c),c.e),10,t),f.e=f.c.length),o=a=(u=Y(e,r,t)).length;0==u[--a];u.pop());if(!u[0])return"0";if(l<0?--o:(c.c=u,c.e=o,c.s=n,u=(c=y(c,f,d,h,t)).c,s=c.r,o=c.e),l=u[i=o+d+1],a=t/2,s=s||i<0||null!=u[i+1],s=h<4?(null!=l||s)&&(0==h||h==(c.s<0?3:2)):a<l||l==a&&(4==h||s||6==h&&1&u[i-1]||h==(c.s<0?8:7)),i<1||!u[0])e=s?ee("1",-d):"0";else{if(u.length=i,s)for(--t;++u[--i]>t;)u[i]=0,i||(++o,u=[1].concat(u));for(a=u.length;!u[--a];);for(l=0,e="";l<=a;e+=q.charAt(u[l++]));e=ee(e,o)}return e}function j(e,t,r,n){var i,o,a,s,c;if(r=null!=r&&T(r,0,8,n,M)?0|r:m,!e.c)return e.toString();if(i=e.c[0],a=e.e,null==t)c=$(e.c),c=19==n||24==n&&a<=h?Q(c,a):ee(c,a);else if(o=(e=z(new E(e),t,r)).e,s=(c=$(e.c)).length,19==n||24==n&&(t<=o||o<=h)){for(;s<t;c+="0",s++);c=Q(c,o)}else if(t-=a,c=ee(c,o),s<o+1){if(0<--t)for(c+=".";t--;c+="0");}else if(0<(t+=o-s))for(o+1==s&&(c+=".");t--;c+="0");return e.s<0&&i?"-"+c:c}function i(e,t){var r,n,i=0;for(Z(e[0])&&(e=e[0]),r=new E(e[0]);++i<e.length;){if(!(n=new E(e[i])).s){r=n;break}t.call(r,n)&&(r=n)}return r}function O(e,t,r,n,i){return(e<t||r<e||e!=te(e))&&C(n,(i||"decimal places")+(e<t||r<e?" out of range":" not an integer"),e),!0}function I(e,t,r){for(var n=1,i=t.length;!t[--i];t.pop());for(i=t[0];10<=i;i/=10,n++);return(r=n+r*U-1)>_?e.c=e.e=null:r<b?e.c=[e.e=0]:(e.e=r,e.c=t),e}function C(e,t,r){var n=new Error(["new BigNumber","cmp","config","div","divToInt","eq","gt","gte","lt","lte","minus","mod","plus","precision","random","round","shift","times","toDigits","toExponential","toFixed","toFormat","toFraction","pow","toPrecision","toString","BigNumber"][e]+"() "+t+": "+r);throw n.name="BigNumber Error",w=0,n}function z(e,t,r,n){var i,o,a,s,c,u,f,l=e.c,d=V;if(l){e:{for(i=1,s=l[0];10<=s;s/=10,i++);if((o=t-i)<0)o+=U,a=t,f=(c=l[u=0])/d[i-a-1]%10|0;else if((u=N((o+1)/U))>=l.length){if(!n)break e;for(;l.length<=u;l.push(0));c=f=0,a=(o%=U)-U+(i=1)}else{for(c=s=l[u],i=1;10<=s;s/=10,i++);f=(a=(o%=U)-U+i)<0?0:c/d[i-a-1]%10|0}if(n=n||t<0||null!=l[u+1]||(a<0?c:c%d[i-a-1]),n=r<4?(f||n)&&(0==r||r==(e.s<0?3:2)):5<f||5==f&&(4==r||n||6==r&&(0<o?0<a?c/d[i-a]:0:l[u-1])%10&1||r==(e.s<0?8:7)),t<1||!l[0])return l.length=0,n?(t-=e.e+1,l[0]=d[(U-t%U)%U],e.e=-t||0):l[0]=e.e=0,e;if(0==o?(l.length=u,s=1,u--):(l.length=u+1,s=d[U-o],l[u]=0<a?R(c/d[i-a]%d[a])*s:0),n)for(;;){if(0==u){for(o=1,a=l[0];10<=a;a/=10,o++);for(a=l[0]+=s,s=1;10<=a;a/=10,s++);o!=s&&(e.e++,l[0]==P&&(l[0]=1));break}if(l[u]+=s,l[u]!=P)break;l[u--]=0,s=1}for(o=l.length;0===l[--o];l.pop());}e.e>_?e.c=e.e=null:e.e<b&&(e.c=[e.e=0])}return e}return E.another=e,E.ROUND_UP=0,E.ROUND_DOWN=1,E.ROUND_CEIL=2,E.ROUND_FLOOR=3,E.ROUND_HALF_UP=4,E.ROUND_HALF_DOWN=5,E.ROUND_HALF_EVEN=6,E.ROUND_HALF_CEIL=7,E.ROUND_HALF_FLOOR=8,E.EUCLID=9,E.config=E.set=function(){var e,t,r=0,n={},i=arguments,o=i[0],a=o&&"object"==typeof o?function(){if(o.hasOwnProperty(t))return null!=(e=o[t])}:function(){if(i.length>r)return null!=(e=i[r++])};return a(t="DECIMAL_PLACES")&&T(e,0,W,2,t)&&(p=0|e),n[t]=p,a(t="ROUNDING_MODE")&&T(e,0,8,2,t)&&(m=0|e),n[t]=m,a(t="EXPONENTIAL_AT")&&(Z(e)?T(e[0],-W,0,2,t)&&T(e[1],0,W,2,t)&&(h=0|e[0],v=0|e[1]):T(e,-W,W,2,t)&&(h=-(v=0|(e<0?-e:e)))),n[t]=[h,v],a(t="RANGE")&&(Z(e)?T(e[0],-W,-1,2,t)&&T(e[1],1,W,2,t)&&(b=0|e[0],_=0|e[1]):T(e,-W,W,2,t)&&(0|e?b=-(_=0|(e<0?-e:e)):k&&C(2,t+" cannot be zero",e))),n[t]=[b,_],a(t="ERRORS")&&(e===!!e||1===e||0===e?(w=0,T=(k=!!e)?O:X):k&&C(2,t+L,e)),n[t]=k,a(t="CRYPTO")&&(!0===e||!1===e||1===e||0===e?e?!(e="undefined"==typeof crypto)&&crypto&&(crypto.getRandomValues||crypto.randomBytes)?S=!0:k?C(2,"crypto unavailable",e?void 0:crypto):S=!1:S=!1:k&&C(2,t+L,e)),n[t]=S,a(t="MODULO_MODE")&&T(e,0,9,2,t)&&(A=0|e),n[t]=A,a(t="POW_PRECISION")&&T(e,0,W,2,t)&&(x=0|e),n[t]=x,a(t="FORMAT")&&("object"==typeof e?B=e:k&&C(2,t+" not an object",e)),n[t]=B,n},E.max=function(){return i(arguments,n.lt)},E.min=function(){return i(arguments,n.gt)},E.random=(r=9007199254740992,f=Math.random()*r&2097151?function(){return R(Math.random()*r)}:function(){return 8388608*(1073741824*Math.random()|0)+(8388608*Math.random()|0)},function(e){var t,r,n,i,o,a=0,s=[],c=new E(g);if(e=null!=e&&T(e,0,W,14)?0|e:p,i=N(e/U),S)if(crypto.getRandomValues){for(t=crypto.getRandomValues(new Uint32Array(i*=2));a<i;)9e15<=(o=131072*t[a]+(t[a+1]>>>11))?(r=crypto.getRandomValues(new Uint32Array(2)),t[a]=r[0],t[a+1]=r[1]):(s.push(o%1e14),a+=2);a=i/2}else if(crypto.randomBytes){for(t=crypto.randomBytes(i*=7);a<i;)9e15<=(o=281474976710656*(31&t[a])+1099511627776*t[a+1]+4294967296*t[a+2]+16777216*t[a+3]+(t[a+4]<<16)+(t[a+5]<<8)+t[a+6])?crypto.randomBytes(7).copy(t,a):(s.push(o%1e14),a+=7);a=i/7}else S=!1,k&&C(14,"crypto unavailable",crypto);if(!S)for(;a<i;)(o=f())<9e15&&(s[a++]=o%1e14);for(i=s[--a],e%=U,i&&e&&(o=V[U-e],s[a]=R(i/o)*o);0===s[a];s.pop(),a--);if(a<0)s=[n=0];else{for(n=-1;0===s[0];s.splice(0,1),n-=U);for(a=1,o=s[0];10<=o;o/=10,a++);a<U&&(n-=U-a)}return c.e=n,c.c=s,c}),y=function(){function A(e,t,r){var n,i,o,a,s=0,c=e.length,u=t%G,f=t/G|0;for(e=e.slice();c--;)s=((i=u*(o=e[c]%G)+(n=f*o+(a=e[c]/G|0)*u)%G*G+s)/r|0)+(n/G|0)+f*a,e[c]=i%r;return s&&(e=[s].concat(e)),e}function x(e,t,r,n){var i,o;if(r!=n)o=n<r?1:-1;else for(i=o=0;i<r;i++)if(e[i]!=t[i]){o=e[i]>t[i]?1:-1;break}return o}function B(e,t,r,n){for(var i=0;r--;)e[r]-=i,i=e[r]<t[r]?1:0,e[r]=i*n+e[r]-t[r];for(;!e[0]&&1<e.length;e.splice(0,1));}return function(e,t,r,n,i){var o,a,s,c,u,f,l,d,h,p,v,y,g,m,b,w,_,k=e.s==t.s?1:-1,T=e.c,S=t.c;if(!(T&&T[0]&&S&&S[0]))return new E(e.s&&t.s&&(T?!S||T[0]!=S[0]:S)?T&&0==T[0]||!S?0*k:k/0:NaN);for(h=(d=new E(k)).c=[],k=r+(a=e.e-t.e)+1,i||(i=P,a=K(e.e/U)-K(t.e/U),k=k/U|0),s=0;S[s]==(T[s]||0);s++);if(S[s]>(T[s]||0)&&a--,k<0)h.push(1),c=!0;else{for(m=T.length,w=S.length,k+=2,1<(u=R(i/(S[s=0]+1)))&&(S=A(S,u,i),T=A(T,u,i),w=S.length,m=T.length),g=w,v=(p=T.slice(0,w)).length;v<w;p[v++]=0);_=S.slice(),_=[0].concat(_),b=S[0],S[1]>=i/2&&b++;do{if(u=0,(o=x(S,p,w,v))<0){if(y=p[0],w!=v&&(y=y*i+(p[1]||0)),1<(u=R(y/b)))for(i<=u&&(u=i-1),l=(f=A(S,u,i)).length,v=p.length;1==x(f,p,l,v);)u--,B(f,w<l?_:S,l,i),l=f.length,o=1;else 0==u&&(o=u=1),l=(f=S.slice()).length;if(l<v&&(f=[0].concat(f)),B(p,f,v,i),v=p.length,-1==o)for(;x(S,p,w,v)<1;)u++,B(p,w<v?_:S,v,i),v=p.length}else 0===o&&(u++,p=[0]);h[s++]=u,p[0]?p[v++]=T[g]||0:(p=[T[g]],v=1)}while((g++<m||null!=p[0])&&k--);c=null!=p[0],h[0]||h.splice(0,1)}if(i==P){for(s=1,k=h[0];10<=k;k/=10,s++);z(d,r+(d.e=s+a*U-1)+1,n,c)}else d.e=a,d.r=+c;return d}}(),a=/^(-?)0([xbo])(?=\w[\w.]*$)/i,s=/^([^.]+)\.$/,c=/^\.([^.]+)$/,l=/^-?(Infinity|NaN)$/,d=/^\s*\+(?=[\w.])|^\s+|\s+$/g,u=function(e,t,r,n){var i,o=r?t:t.replace(d,"");if(l.test(o))e.s=isNaN(o)?null:o<0?-1:1;else{if(!r&&(o=o.replace(a,function(e,t,r){return i="x"==(r=r.toLowerCase())?16:"b"==r?2:8,n&&n!=i?e:t}),n&&(i=n,o=o.replace(s,"$1").replace(c,"0.$1")),t!=o))return new E(o,i);k&&C(w,"not a"+(n?" base "+n:"")+" number",t),e.s=null}e.c=e.e=null,w=0},n.absoluteValue=n.abs=function(){var e=new E(this);return e.s<0&&(e.s=1),e},n.ceil=function(){return z(new E(this),this.e+1,2)},n.comparedTo=n.cmp=function(e,t){return w=1,o(this,new E(e,t))},n.decimalPlaces=n.dp=function(){var e,t,r=this.c;if(!r)return null;if(e=((t=r.length-1)-K(this.e/U))*U,t=r[t])for(;t%10==0;t/=10,e--);return e<0&&(e=0),e},n.dividedBy=n.div=function(e,t){return w=3,y(this,new E(e,t),p,m)},n.dividedToIntegerBy=n.divToInt=function(e,t){return w=4,y(this,new E(e,t),0,1)},n.equals=n.eq=function(e,t){return w=5,0===o(this,new E(e,t))},n.floor=function(){return z(new E(this),this.e+1,3)},n.greaterThan=n.gt=function(e,t){return w=6,0<o(this,new E(e,t))},n.greaterThanOrEqualTo=n.gte=function(e,t){return w=7,1===(t=o(this,new E(e,t)))||0===t},n.isFinite=function(){return!!this.c},n.isInteger=n.isInt=function(){return!!this.c&&K(this.e/U)>this.c.length-2},n.isNaN=function(){return!this.s},n.isNegative=n.isNeg=function(){return this.s<0},n.isZero=function(){return!!this.c&&0==this.c[0]},n.lessThan=n.lt=function(e,t){return w=8,o(this,new E(e,t))<0},n.lessThanOrEqualTo=n.lte=function(e,t){return w=9,-1===(t=o(this,new E(e,t)))||0===t},n.minus=n.sub=function(e,t){var r,n,i,o,a=this,s=a.s;if(w=10,t=(e=new E(e,t)).s,!s||!t)return new E(NaN);if(s!=t)return e.s=-t,a.plus(e);var c=a.e/U,u=e.e/U,f=a.c,l=e.c;if(!c||!u){if(!f||!l)return f?(e.s=-t,e):new E(l?a:NaN);if(!f[0]||!l[0])return l[0]?(e.s=-t,e):new E(f[0]?a:3==m?-0:0)}if(c=K(c),u=K(u),f=f.slice(),s=c-u){for((o=s<0)?(s=-s,i=f):(u=c,i=l),i.reverse(),t=s;t--;i.push(0));i.reverse()}else for(n=(o=(s=f.length)<(t=l.length))?s:t,s=t=0;t<n;t++)if(f[t]!=l[t]){o=f[t]<l[t];break}if(o&&(i=f,f=l,l=i,e.s=-e.s),0<(t=(n=l.length)-(r=f.length)))for(;t--;f[r++]=0);for(t=P-1;s<n;){if(f[--n]<l[n]){for(r=n;r&&!f[--r];f[r]=t);--f[r],f[n]+=P}f[n]-=l[n]}for(;0==f[0];f.splice(0,1),--u);return f[0]?I(e,f,u):(e.s=3==m?-1:1,e.c=[e.e=0],e)},n.modulo=n.mod=function(e,t){var r,n,i=this;return w=11,e=new E(e,t),!i.c||!e.s||e.c&&!e.c[0]?new E(NaN):!e.c||i.c&&!i.c[0]?new E(i):(9==A?(n=e.s,e.s=1,r=y(i,e,0,3),e.s=n,r.s*=n):r=y(i,e,0,A),i.minus(r.times(e)))},n.negated=n.neg=function(){var e=new E(this);return e.s=-e.s||null,e},n.plus=n.add=function(e,t){var r,n=this,i=n.s;if(w=12,t=(e=new E(e,t)).s,!i||!t)return new E(NaN);if(i!=t)return e.s=-t,n.minus(e);var o=n.e/U,a=e.e/U,s=n.c,c=e.c;if(!o||!a){if(!s||!c)return new E(i/0);if(!s[0]||!c[0])return c[0]?e:new E(s[0]?n:0*i)}if(o=K(o),a=K(a),s=s.slice(),i=o-a){for(0<i?(a=o,r=c):(i=-i,r=s),r.reverse();i--;r.push(0));r.reverse()}for((i=s.length)-(t=c.length)<0&&(r=c,c=s,s=r,t=i),i=0;t;)i=(s[--t]=s[t]+c[t]+i)/P|0,s[t]=P===s[t]?0:s[t]%P;return i&&(s=[i].concat(s),++a),I(e,s,a)},n.precision=n.sd=function(e){var t,r,n=this.c;if(null!=e&&e!==!!e&&1!==e&&0!==e&&(k&&C(13,"argument"+L,e),e!=!!e&&(e=null)),!n)return null;if(t=(r=n.length-1)*U+1,r=n[r]){for(;r%10==0;r/=10,t--);for(r=n[0];10<=r;r/=10,t++);}return e&&this.e+1>t&&(t=this.e+1),t},n.round=function(e,t){var r=new E(this);return(null==e||T(e,0,W,15))&&z(r,~~e+this.e+1,null!=t&&T(t,0,8,15,M)?0|t:m),r},n.shift=function(e){var t=this;return T(e,-J,J,16,"argument")?t.times("1e"+te(e)):new E(t.c&&t.c[0]&&(e<-J||J<e)?t.s*(e<0?0:1/0):t)},n.squareRoot=n.sqrt=function(){var e,t,r,n,i,o=this,a=o.c,s=o.s,c=o.e,u=p+4,f=new E("0.5");if(1!==s||!a||!a[0])return new E(!s||s<0&&(!a||a[0])?NaN:a?o:1/0);if(0==(s=Math.sqrt(+o))||s==1/0?(((t=$(a)).length+c)%2==0&&(t+="0"),s=Math.sqrt(t),c=K((c+1)/2)-(c<0||c%2),r=new E(t=s==1/0?"1e"+c:(t=s.toExponential()).slice(0,t.indexOf("e")+1)+c)):r=new E(s+""),r.c[0])for((s=(c=r.e)+u)<3&&(s=0);;)if(i=r,r=f.times(i.plus(y(o,i,u,1))),$(i.c).slice(0,s)===(t=$(r.c)).slice(0,s)){if(r.e<c&&--s,"9999"!=(t=t.slice(s-3,s+1))&&(n||"4999"!=t)){+t&&(+t.slice(1)||"5"!=t.charAt(0))||(z(r,r.e+p+2,1),e=!r.times(r).eq(o));break}if(!n&&(z(i,i.e+p+2,0),i.times(i).eq(o))){r=i;break}u+=4,s+=4,n=1}return z(r,r.e+p+1,m,e)},n.times=n.mul=function(e,t){var r,n,i,o,a,s,c,u,f,l,d,h,p,v,y,g=this,m=g.c,b=(w=17,e=new E(e,t)).c;if(!(m&&b&&m[0]&&b[0]))return!g.s||!e.s||m&&!m[0]&&!b||b&&!b[0]&&!m?e.c=e.e=e.s=null:(e.s*=g.s,m&&b?(e.c=[0],e.e=0):e.c=e.e=null),e;for(n=K(g.e/U)+K(e.e/U),e.s*=g.s,(c=m.length)<(l=b.length)&&(p=m,m=b,b=p,i=c,c=l,l=i),i=c+l,p=[];i--;p.push(0));for(v=P,y=G,i=l;0<=--i;){for(r=0,d=b[i]%y,h=b[i]/y|0,o=i+(a=c);i<o;)r=((u=d*(u=m[--a]%y)+(s=h*u+(f=m[a]/y|0)*d)%y*y+p[o]+r)/v|0)+(s/y|0)+h*f,p[o--]=u%v;p[o]=r}return r?++n:p.splice(0,1),I(e,p,n)},n.toDigits=function(e,t){var r=new E(this);return e=null!=e&&T(e,1,W,18,"precision")?0|e:null,t=null!=t&&T(t,0,8,18,M)?0|t:m,e?z(r,e,t):r},n.toExponential=function(e,t){return j(this,null!=e&&T(e,0,W,19)?1+~~e:null,t,19)},n.toFixed=function(e,t){return j(this,null!=e&&T(e,0,W,20)?~~e+this.e+1:null,t,20)},n.toFormat=function(e,t){var r=j(this,null!=e&&T(e,0,W,21)?~~e+this.e+1:null,t,21);if(this.c){var n,i=r.split("."),o=+B.groupSize,a=+B.secondaryGroupSize,s=B.groupSeparator,c=i[0],u=i[1],f=this.s<0,l=f?c.slice(1):c,d=l.length;if(a&&(n=o,o=a,d-=a=n),0<o&&0<d){for(n=d%o||o,c=l.substr(0,n);n<d;n+=o)c+=s+l.substr(n,o);0<a&&(c+=s+l.slice(n)),f&&(c="-"+c)}r=u?c+B.decimalSeparator+((a=+B.fractionGroupSize)?u.replace(new RegExp("\\d{"+a+"}\\B","g"),"$&"+B.fractionGroupSeparator):u):c}return r},n.toFraction=function(e){var t,r,n,i,o,a,s,c,u,f=k,l=this,d=l.c,h=new E(g),p=r=new E(g),v=s=new E(g);if(null!=e&&(k=!1,a=new E(e),k=f,(f=a.isInt())&&!a.lt(g)||(k&&C(22,"max denominator "+(f?"out of range":"not an integer"),e),e=!f&&a.c&&z(a,a.e+1,1).gte(g)?a:null)),!d)return l.toString();for(u=$(d),i=h.e=u.length-l.e-1,h.c[0]=V[(o=i%U)<0?U+o:o],e=!e||0<a.cmp(h)?0<i?h:p:a,o=_,_=1/0,a=new E(u),s.c[0]=0;c=y(a,h,0,1),1!=(n=r.plus(c.times(v))).cmp(e);)r=v,v=n,p=s.plus(c.times(n=p)),s=n,h=a.minus(c.times(n=h)),a=n;return n=y(e.minus(r),v,0,1),s=s.plus(n.times(p)),r=r.plus(n.times(v)),s.s=p.s=l.s,t=y(p,v,i*=2,m).minus(l).abs().cmp(y(s,r,i,m).minus(l).abs())<1?[p.toString(),v.toString()]:[s.toString(),r.toString()],_=o,t},n.toNumber=function(){return+this},n.toPower=n.pow=function(e,t){var r,n,i,o=R(e<0?-e:+e),a=this;if(null!=t&&(w=23,t=new E(t)),!T(e,-J,J,23,"exponent")&&(!isFinite(e)||J<o&&(e/=0)||parseFloat(e)!=e&&!(e=NaN))||0==e)return r=Math.pow(+a,e),new E(t?r%t:r);for(t?1<e&&a.gt(g)&&a.isInt()&&t.gt(g)&&t.isInt()?a=a.mod(t):(i=t,t=null):x&&(r=N(x/U+2)),n=new E(g);;){if(o%2){if(!(n=n.times(a)).c)break;r?n.c.length>r&&(n.c.length=r):t&&(n=n.mod(t))}if(!(o=R(o/2)))break;a=a.times(a),r?a.c&&a.c.length>r&&(a.c.length=r):t&&(a=a.mod(t))}return t?n:(e<0&&(n=g.div(n)),i?n.mod(i):r?z(n,x,m):n)},n.toPrecision=function(e,t){return j(this,null!=e&&T(e,1,W,24,"precision")?0|e:null,t,24)},n.toString=function(e){var t,r=this.s,n=this.e;return null===n?r?(t="Infinity",r<0&&(t="-"+t)):t="NaN":(t=$(this.c),t=null!=e&&T(e,2,64,25,"base")?H(ee(t,n),0|e,10,r):n<=h||v<=n?Q(t,n):ee(t,n),r<0&&this.c[0]&&(t="-"+t)),t},n.truncated=n.trunc=function(){return z(new E(this),this.e+1,1)},n.valueOf=n.toJSON=function(){var e,t=this.e;return null===t?this.toString():(e=$(this.c),e=t<=h||v<=t?Q(e,t):ee(e,t),this.s<0?"-"+e:e)},n.isBigNumber=!0,null!=t&&E.config(t),E}()).default=t.BigNumber=t,"function"==typeof define&&define.amd?define(function(){return t}):void 0!==r&&r.exports?r.exports=t:(e||(e="undefined"!=typeof self?self:Function("return this")()),e.BigNumber=t)}(this)},{}],25:[function(e,t,r){var n,i;n=this,i=function(i){return function(){var e=i,t=e.lib.BlockCipher,r=e.algo,u=[],f=[],l=[],d=[],h=[],p=[],v=[],y=[],g=[],m=[];!function(){for(var e=[],t=0;t<256;t++)e[t]=t<128?t<<1:t<<1^283;var r=0,n=0;for(t=0;t<256;t++){var i=n^n<<1^n<<2^n<<3^n<<4;i=i>>>8^255&i^99,u[r]=i;var o=e[f[i]=r],a=e[o],s=e[a],c=257*e[i]^16843008*i;l[r]=c<<24|c>>>8,d[r]=c<<16|c>>>16,h[r]=c<<8|c>>>24,p[r]=c;c=16843009*s^65537*a^257*o^16843008*r;v[i]=c<<24|c>>>8,y[i]=c<<16|c>>>16,g[i]=c<<8|c>>>24,m[i]=c,r?(r=o^e[e[e[s^o]]],n^=e[e[n]]):r=n=1}}();var b=[0,1,2,4,8,16,32,64,128,27,54],n=r.AES=t.extend({_doReset:function(){if(!this._nRounds||this._keyPriorReset!==this._key){for(var e=this._keyPriorReset=this._key,t=e.words,r=e.sigBytes/4,n=4*((this._nRounds=r+6)+1),i=this._keySchedule=[],o=0;o<n;o++)if(o<r)i[o]=t[o];else{var a=i[o-1];o%r?6<r&&o%r==4&&(a=u[a>>>24]<<24|u[a>>>16&255]<<16|u[a>>>8&255]<<8|u[255&a]):(a=u[(a=a<<8|a>>>24)>>>24]<<24|u[a>>>16&255]<<16|u[a>>>8&255]<<8|u[255&a],a^=b[o/r|0]<<24),i[o]=i[o-r]^a}for(var s=this._invKeySchedule=[],c=0;c<n;c++){o=n-c;if(c%4)a=i[o];else a=i[o-4];s[c]=c<4||o<=4?a:v[u[a>>>24]]^y[u[a>>>16&255]]^g[u[a>>>8&255]]^m[u[255&a]]}}},encryptBlock:function(e,t){this._doCryptBlock(e,t,this._keySchedule,l,d,h,p,u)},decryptBlock:function(e,t){var r=e[t+1];e[t+1]=e[t+3],e[t+3]=r,this._doCryptBlock(e,t,this._invKeySchedule,v,y,g,m,f);r=e[t+1];e[t+1]=e[t+3],e[t+3]=r},_doCryptBlock:function(e,t,r,n,i,o,a,s){for(var c=this._nRounds,u=e[t]^r[0],f=e[t+1]^r[1],l=e[t+2]^r[2],d=e[t+3]^r[3],h=4,p=1;p<c;p++){var v=n[u>>>24]^i[f>>>16&255]^o[l>>>8&255]^a[255&d]^r[h++],y=n[f>>>24]^i[l>>>16&255]^o[d>>>8&255]^a[255&u]^r[h++],g=n[l>>>24]^i[d>>>16&255]^o[u>>>8&255]^a[255&f]^r[h++],m=n[d>>>24]^i[u>>>16&255]^o[f>>>8&255]^a[255&l]^r[h++];u=v,f=y,l=g,d=m}v=(s[u>>>24]<<24|s[f>>>16&255]<<16|s[l>>>8&255]<<8|s[255&d])^r[h++],y=(s[f>>>24]<<24|s[l>>>16&255]<<16|s[d>>>8&255]<<8|s[255&u])^r[h++],g=(s[l>>>24]<<24|s[d>>>16&255]<<16|s[u>>>8&255]<<8|s[255&f])^r[h++],m=(s[d>>>24]<<24|s[u>>>16&255]<<16|s[f>>>8&255]<<8|s[255&l])^r[h++];e[t]=v,e[t+1]=y,e[t+2]=g,e[t+3]=m},keySize:8});e.AES=t._createHelper(n)}(),i.AES},"object"==typeof r?t.exports=r=i(e("./core"),e("./enc-base64"),e("./md5"),e("./evpkdf"),e("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./enc-base64","./md5","./evpkdf","./cipher-core"],i):i(n.CryptoJS)},{"./cipher-core":26,"./core":27,"./enc-base64":28,"./evpkdf":30,"./md5":35}],26:[function(e,t,r){var n,i;n=this,i=function(e){var t,r,n,c,i,o,a,s,u,f,l,d,h,p,v,y,g,m;e.lib.Cipher||(r=(t=e).lib,n=r.Base,c=r.WordArray,i=r.BufferedBlockAlgorithm,(o=t.enc).Utf8,a=o.Base64,s=t.algo.EvpKDF,u=r.Cipher=i.extend({cfg:n.extend(),createEncryptor:function(e,t){return this.create(this._ENC_XFORM_MODE,e,t)},createDecryptor:function(e,t){return this.create(this._DEC_XFORM_MODE,e,t)},init:function(e,t,r){this.cfg=this.cfg.extend(r),this._xformMode=e,this._key=t,this.reset()},reset:function(){i.reset.call(this),this._doReset()},process:function(e){return this._append(e),this._process()},finalize:function(e){return e&&this._append(e),this._doFinalize()},keySize:4,ivSize:4,_ENC_XFORM_MODE:1,_DEC_XFORM_MODE:2,_createHelper:function(){function i(e){return"string"==typeof e?m:y}return function(n){return{encrypt:function(e,t,r){return i(t).encrypt(n,e,t,r)},decrypt:function(e,t,r){return i(t).decrypt(n,e,t,r)}}}}()}),r.StreamCipher=u.extend({_doFinalize:function(){return this._process(!0)},blockSize:1}),f=t.mode={},l=r.BlockCipherMode=n.extend({createEncryptor:function(e,t){return this.Encryptor.create(e,t)},createDecryptor:function(e,t){return this.Decryptor.create(e,t)},init:function(e,t){this._cipher=e,this._iv=t}}),d=f.CBC=function(){var e=l.extend();function o(e,t,r){var n=this._iv;if(n){var i=n;this._iv=void 0}else i=this._prevBlock;for(var o=0;o<r;o++)e[t+o]^=i[o]}return e.Encryptor=e.extend({processBlock:function(e,t){var r=this._cipher,n=r.blockSize;o.call(this,e,t,n),r.encryptBlock(e,t),this._prevBlock=e.slice(t,t+n)}}),e.Decryptor=e.extend({processBlock:function(e,t){var r=this._cipher,n=r.blockSize,i=e.slice(t,t+n);r.decryptBlock(e,t),o.call(this,e,t,n),this._prevBlock=i}}),e}(),h=(t.pad={}).Pkcs7={pad:function(e,t){for(var r=4*t,n=r-e.sigBytes%r,i=n<<24|n<<16|n<<8|n,o=[],a=0;a<n;a+=4)o.push(i);var s=c.create(o,n);e.concat(s)},unpad:function(e){var t=255&e.words[e.sigBytes-1>>>2];e.sigBytes-=t}},r.BlockCipher=u.extend({cfg:u.cfg.extend({mode:d,padding:h}),reset:function(){u.reset.call(this);var e=this.cfg,t=e.iv,r=e.mode;if(this._xformMode==this._ENC_XFORM_MODE)var n=r.createEncryptor;else{n=r.createDecryptor;this._minBufferSize=1}this._mode&&this._mode.__creator==n?this._mode.init(this,t&&t.words):(this._mode=n.call(r,this,t&&t.words),this._mode.__creator=n)},_doProcessBlock:function(e,t){this._mode.processBlock(e,t)},_doFinalize:function(){var e=this.cfg.padding;if(this._xformMode==this._ENC_XFORM_MODE){e.pad(this._data,this.blockSize);var t=this._process(!0)}else{t=this._process(!0);e.unpad(t)}return t},blockSize:4}),p=r.CipherParams=n.extend({init:function(e){this.mixIn(e)},toString:function(e){return(e||this.formatter).stringify(this)}}),v=(t.format={}).OpenSSL={stringify:function(e){var t=e.ciphertext,r=e.salt;if(r)var n=c.create([1398893684,1701076831]).concat(r).concat(t);else n=t;return n.toString(a)},parse:function(e){var t=a.parse(e),r=t.words;if(1398893684==r[0]&&1701076831==r[1]){var n=c.create(r.slice(2,4));r.splice(0,4),t.sigBytes-=16}return p.create({ciphertext:t,salt:n})}},y=r.SerializableCipher=n.extend({cfg:n.extend({format:v}),encrypt:function(e,t,r,n){n=this.cfg.extend(n);var i=e.createEncryptor(r,n),o=i.finalize(t),a=i.cfg;return p.create({ciphertext:o,key:r,iv:a.iv,algorithm:e,mode:a.mode,padding:a.padding,blockSize:e.blockSize,formatter:n.format})},decrypt:function(e,t,r,n){return n=this.cfg.extend(n),t=this._parse(t,n.format),e.createDecryptor(r,n).finalize(t.ciphertext)},_parse:function(e,t){return"string"==typeof e?t.parse(e,this):e}}),g=(t.kdf={}).OpenSSL={execute:function(e,t,r,n){n||(n=c.random(8));var i=s.create({keySize:t+r}).compute(e,n),o=c.create(i.words.slice(t),4*r);return i.sigBytes=4*t,p.create({key:i,iv:o,salt:n})}},m=r.PasswordBasedCipher=y.extend({cfg:y.cfg.extend({kdf:g}),encrypt:function(e,t,r,n){var i=(n=this.cfg.extend(n)).kdf.execute(r,e.keySize,e.ivSize);n.iv=i.iv;var o=y.encrypt.call(this,e,t,i.key,n);return o.mixIn(i),o},decrypt:function(e,t,r,n){n=this.cfg.extend(n),t=this._parse(t,n.format);var i=n.kdf.execute(r,e.keySize,e.ivSize,t.salt);return n.iv=i.iv,y.decrypt.call(this,e,t,i.key,n)}}))},"object"==typeof r?t.exports=r=i(e("./core"),e("./evpkdf")):"function"==typeof define&&define.amd?define(["./core","./evpkdf"],i):i(n.CryptoJS)},{"./core":27,"./evpkdf":30}],27:[function(e,t,r){var n,i;n=this,i=function(){var f,r,e,t,n,l,i,o,a,s,c,u,d=d||(f=Math,r=Object.create||function(){function r(){}return function(e){var t;return r.prototype=e,t=new r,r.prototype=null,t}}(),t=(e={}).lib={},n=t.Base={extend:function(e){var t=r(this);return e&&t.mixIn(e),t.hasOwnProperty("init")&&this.init!==t.init||(t.init=function(){t.$super.init.apply(this,arguments)}),(t.init.prototype=t).$super=this,t},create:function(){var e=this.extend();return e.init.apply(e,arguments),e},init:function(){},mixIn:function(e){for(var t in e)e.hasOwnProperty(t)&&(this[t]=e[t]);e.hasOwnProperty("toString")&&(this.toString=e.toString)},clone:function(){return this.init.prototype.extend(this)}},l=t.WordArray=n.extend({init:function(e,t){e=this.words=e||[],this.sigBytes=null!=t?t:4*e.length},toString:function(e){return(e||o).stringify(this)},concat:function(e){var t=this.words,r=e.words,n=this.sigBytes,i=e.sigBytes;if(this.clamp(),n%4)for(var o=0;o<i;o++){var a=r[o>>>2]>>>24-o%4*8&255;t[n+o>>>2]|=a<<24-(n+o)%4*8}else for(o=0;o<i;o+=4)t[n+o>>>2]=r[o>>>2];return this.sigBytes+=i,this},clamp:function(){var e=this.words,t=this.sigBytes;e[t>>>2]&=4294967295<<32-t%4*8,e.length=f.ceil(t/4)},clone:function(){var e=n.clone.call(this);return e.words=this.words.slice(0),e},random:function(e){for(var t,r=[],n=function(t){t=t;var r=987654321,n=4294967295;return function(){var e=((r=36969*(65535&r)+(r>>16)&n)<<16)+(t=18e3*(65535&t)+(t>>16)&n)&n;return e/=4294967296,(e+=.5)*(.5<f.random()?1:-1)}},i=0;i<e;i+=4){var o=n(4294967296*(t||f.random()));t=987654071*o(),r.push(4294967296*o()|0)}return new l.init(r,e)}}),i=e.enc={},o=i.Hex={stringify:function(e){for(var t=e.words,r=e.sigBytes,n=[],i=0;i<r;i++){var o=t[i>>>2]>>>24-i%4*8&255;n.push((o>>>4).toString(16)),n.push((15&o).toString(16))}return n.join("")},parse:function(e){for(var t=e.length,r=[],n=0;n<t;n+=2)r[n>>>3]|=parseInt(e.substr(n,2),16)<<24-n%8*4;return new l.init(r,t/2)}},a=i.Latin1={stringify:function(e){for(var t=e.words,r=e.sigBytes,n=[],i=0;i<r;i++){var o=t[i>>>2]>>>24-i%4*8&255;n.push(String.fromCharCode(o))}return n.join("")},parse:function(e){for(var t=e.length,r=[],n=0;n<t;n++)r[n>>>2]|=(255&e.charCodeAt(n))<<24-n%4*8;return new l.init(r,t)}},s=i.Utf8={stringify:function(e){try{return decodeURIComponent(escape(a.stringify(e)))}catch(e){throw new Error("Malformed UTF-8 data")}},parse:function(e){return a.parse(unescape(encodeURIComponent(e)))}},c=t.BufferedBlockAlgorithm=n.extend({reset:function(){this._data=new l.init,this._nDataBytes=0},_append:function(e){"string"==typeof e&&(e=s.parse(e)),this._data.concat(e),this._nDataBytes+=e.sigBytes},_process:function(e){var t=this._data,r=t.words,n=t.sigBytes,i=this.blockSize,o=n/(4*i),a=(o=e?f.ceil(o):f.max((0|o)-this._minBufferSize,0))*i,s=f.min(4*a,n);if(a){for(var c=0;c<a;c+=i)this._doProcessBlock(r,c);var u=r.splice(0,a);t.sigBytes-=s}return new l.init(u,s)},clone:function(){var e=n.clone.call(this);return e._data=this._data.clone(),e},_minBufferSize:0}),t.Hasher=c.extend({cfg:n.extend(),init:function(e){this.cfg=this.cfg.extend(e),this.reset()},reset:function(){c.reset.call(this),this._doReset()},update:function(e){return this._append(e),this._process(),this},finalize:function(e){return e&&this._append(e),this._doFinalize()},blockSize:16,_createHelper:function(r){return function(e,t){return new r.init(t).finalize(e)}},_createHmacHelper:function(r){return function(e,t){return new u.HMAC.init(r,t).finalize(e)}}}),u=e.algo={},e);return d},"object"==typeof r?t.exports=r=i():"function"==typeof define&&define.amd?define([],i):n.CryptoJS=i()},{}],28:[function(e,t,r){var n,i;n=this,i=function(e){var t,c;return c=(t=e).lib.WordArray,t.enc.Base64={stringify:function(e){var t=e.words,r=e.sigBytes,n=this._map;e.clamp();for(var i=[],o=0;o<r;o+=3)for(var a=(t[o>>>2]>>>24-o%4*8&255)<<16|(t[o+1>>>2]>>>24-(o+1)%4*8&255)<<8|t[o+2>>>2]>>>24-(o+2)%4*8&255,s=0;s<4&&o+.75*s<r;s++)i.push(n.charAt(a>>>6*(3-s)&63));var c=n.charAt(64);if(c)for(;i.length%4;)i.push(c);return i.join("")},parse:function(e){var t=e.length,r=this._map,n=this._reverseMap;if(!n){n=this._reverseMap=[];for(var i=0;i<r.length;i++)n[r.charCodeAt(i)]=i}var o=r.charAt(64);if(o){var a=e.indexOf(o);-1!==a&&(t=a)}return function(e,t,r){for(var n=[],i=0,o=0;o<t;o++)if(o%4){var a=r[e.charCodeAt(o-1)]<<o%4*2,s=r[e.charCodeAt(o)]>>>6-o%4*2;n[i>>>2]|=(a|s)<<24-i%4*8,i++}return c.create(n,i)}(e,t,n)},_map:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="},e.enc.Base64},"object"==typeof r?t.exports=r=i(e("./core")):"function"==typeof define&&define.amd?define(["./core"],i):i(n.CryptoJS)},{"./core":27}],29:[function(e,t,r){var n,i;n=this,i=function(r){return function(){var e=r,i=e.lib.WordArray,t=e.enc;t.Utf16=t.Utf16BE={stringify:function(e){for(var t=e.words,r=e.sigBytes,n=[],i=0;i<r;i+=2){var o=t[i>>>2]>>>16-i%4*8&65535;n.push(String.fromCharCode(o))}return n.join("")},parse:function(e){for(var t=e.length,r=[],n=0;n<t;n++)r[n>>>1]|=e.charCodeAt(n)<<16-n%2*16;return i.create(r,2*t)}};function a(e){return e<<8&4278255360|e>>>8&16711935}t.Utf16LE={stringify:function(e){for(var t=e.words,r=e.sigBytes,n=[],i=0;i<r;i+=2){var o=a(t[i>>>2]>>>16-i%4*8&65535);n.push(String.fromCharCode(o))}return n.join("")},parse:function(e){for(var t=e.length,r=[],n=0;n<t;n++)r[n>>>1]|=a(e.charCodeAt(n)<<16-n%2*16);return i.create(r,2*t)}}}(),r.enc.Utf16},"object"==typeof r?t.exports=r=i(e("./core")):"function"==typeof define&&define.amd?define(["./core"],i):i(n.CryptoJS)},{"./core":27}],30:[function(e,t,r){var n,i;n=this,i=function(e){var t,r,n,f,i,o,a;return r=(t=e).lib,n=r.Base,f=r.WordArray,i=t.algo,o=i.MD5,a=i.EvpKDF=n.extend({cfg:n.extend({keySize:4,hasher:o,iterations:1}),init:function(e){this.cfg=this.cfg.extend(e)},compute:function(e,t){for(var r=this.cfg,n=r.hasher.create(),i=f.create(),o=i.words,a=r.keySize,s=r.iterations;o.length<a;){c&&n.update(c);var c=n.update(e).finalize(t);n.reset();for(var u=1;u<s;u++)c=n.finalize(c),n.reset();i.concat(c)}return i.sigBytes=4*a,i}}),t.EvpKDF=function(e,t,r){return a.create(r).compute(e,t)},e.EvpKDF},"object"==typeof r?t.exports=r=i(e("./core"),e("./sha1"),e("./hmac")):"function"==typeof define&&define.amd?define(["./core","./sha1","./hmac"],i):i(n.CryptoJS)},{"./core":27,"./hmac":32,"./sha1":51}],31:[function(e,t,r){var n,i;n=this,i=function(e){var t,r,n;return r=(t=e).lib.CipherParams,n=t.enc.Hex,t.format.Hex={stringify:function(e){return e.ciphertext.toString(n)},parse:function(e){var t=n.parse(e);return r.create({ciphertext:t})}},e.format.Hex},"object"==typeof r?t.exports=r=i(e("./core"),e("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],i):i(n.CryptoJS)},{"./cipher-core":26,"./core":27}],32:[function(e,t,r){var n,i;n=this,i=function(e){var t,r,u;r=(t=e).lib.Base,u=t.enc.Utf8,t.algo.HMAC=r.extend({init:function(e,t){e=this._hasher=new e.init,"string"==typeof t&&(t=u.parse(t));var r=e.blockSize,n=4*r;t.sigBytes>n&&(t=e.finalize(t)),t.clamp();for(var i=this._oKey=t.clone(),o=this._iKey=t.clone(),a=i.words,s=o.words,c=0;c<r;c++)a[c]^=1549556828,s[c]^=909522486;i.sigBytes=o.sigBytes=n,this.reset()},reset:function(){var e=this._hasher;e.reset(),e.update(this._iKey)},update:function(e){return this._hasher.update(e),this},finalize:function(e){var t=this._hasher,r=t.finalize(e);return t.reset(),t.finalize(this._oKey.clone().concat(r))}})},"object"==typeof r?t.exports=r=i(e("./core")):"function"==typeof define&&define.amd?define(["./core"],i):i(n.CryptoJS)},{"./core":27}],33:[function(e,t,r){var n,i;n=this,i=function(e){return e},"object"==typeof r?t.exports=r=i(e("./core"),e("./x64-core"),e("./lib-typedarrays"),e("./enc-utf16"),e("./enc-base64"),e("./md5"),e("./sha1"),e("./sha256"),e("./sha224"),e("./sha512"),e("./sha384"),e("./sha3"),e("./ripemd160"),e("./hmac"),e("./pbkdf2"),e("./evpkdf"),e("./cipher-core"),e("./mode-cfb"),e("./mode-ctr"),e("./mode-ctr-gladman"),e("./mode-ofb"),e("./mode-ecb"),e("./pad-ansix923"),e("./pad-iso10126"),e("./pad-iso97971"),e("./pad-zeropadding"),e("./pad-nopadding"),e("./format-hex"),e("./aes"),e("./tripledes"),e("./rc4"),e("./rabbit"),e("./rabbit-legacy")):"function"==typeof define&&define.amd?define(["./core","./x64-core","./lib-typedarrays","./enc-utf16","./enc-base64","./md5","./sha1","./sha256","./sha224","./sha512","./sha384","./sha3","./ripemd160","./hmac","./pbkdf2","./evpkdf","./cipher-core","./mode-cfb","./mode-ctr","./mode-ctr-gladman","./mode-ofb","./mode-ecb","./pad-ansix923","./pad-iso10126","./pad-iso97971","./pad-zeropadding","./pad-nopadding","./format-hex","./aes","./tripledes","./rc4","./rabbit","./rabbit-legacy"],i):n.CryptoJS=i(n.CryptoJS)},{"./aes":25,"./cipher-core":26,"./core":27,"./enc-base64":28,"./enc-utf16":29,"./evpkdf":30,"./format-hex":31,"./hmac":32,"./lib-typedarrays":34,"./md5":35,"./mode-cfb":36,"./mode-ctr":38,"./mode-ctr-gladman":37,"./mode-ecb":39,"./mode-ofb":40,"./pad-ansix923":41,"./pad-iso10126":42,"./pad-iso97971":43,"./pad-nopadding":44,"./pad-zeropadding":45,"./pbkdf2":46,"./rabbit":48,"./rabbit-legacy":47,"./rc4":49,"./ripemd160":50,"./sha1":51,"./sha224":52,"./sha256":53,"./sha3":54,"./sha384":55,"./sha512":56,"./tripledes":57,"./x64-core":58}],34:[function(e,t,r){var n,i;n=this,i=function(t){return function(){if("function"==typeof ArrayBuffer){var e=t.lib.WordArray,i=e.init;(e.init=function(e){if(e instanceof ArrayBuffer&&(e=new Uint8Array(e)),(e instanceof Int8Array||"undefined"!=typeof Uint8ClampedArray&&e instanceof Uint8ClampedArray||e instanceof Int16Array||e instanceof Uint16Array||e instanceof Int32Array||e instanceof Uint32Array||e instanceof Float32Array||e instanceof Float64Array)&&(e=new Uint8Array(e.buffer,e.byteOffset,e.byteLength)),e instanceof Uint8Array){for(var t=e.byteLength,r=[],n=0;n<t;n++)r[n>>>2]|=e[n]<<24-n%4*8;i.call(this,r,t)}else i.apply(this,arguments)}).prototype=e}}(),t.lib.WordArray},"object"==typeof r?t.exports=r=i(e("./core")):"function"==typeof define&&define.amd?define(["./core"],i):i(n.CryptoJS)},{"./core":27}],35:[function(e,t,r){var n,i;n=this,i=function(a){return function(f){var e=a,t=e.lib,r=t.WordArray,n=t.Hasher,i=e.algo,x=[];!function(){for(var e=0;e<64;e++)x[e]=4294967296*f.abs(f.sin(e+1))|0}();var o=i.MD5=n.extend({_doReset:function(){this._hash=new r.init([1732584193,4023233417,2562383102,271733878])},_doProcessBlock:function(e,t){for(var r=0;r<16;r++){var n=t+r,i=e[n];e[n]=16711935&(i<<8|i>>>24)|4278255360&(i<<24|i>>>8)}var o=this._hash.words,a=e[t+0],s=e[t+1],c=e[t+2],u=e[t+3],f=e[t+4],l=e[t+5],d=e[t+6],h=e[t+7],p=e[t+8],v=e[t+9],y=e[t+10],g=e[t+11],m=e[t+12],b=e[t+13],w=e[t+14],_=e[t+15],k=o[0],T=o[1],S=o[2],A=o[3];T=j(T=j(T=j(T=j(T=H(T=H(T=H(T=H(T=E(T=E(T=E(T=E(T=B(T=B(T=B(T=B(T,S=B(S,A=B(A,k=B(k,T,S,A,a,7,x[0]),T,S,s,12,x[1]),k,T,c,17,x[2]),A,k,u,22,x[3]),S=B(S,A=B(A,k=B(k,T,S,A,f,7,x[4]),T,S,l,12,x[5]),k,T,d,17,x[6]),A,k,h,22,x[7]),S=B(S,A=B(A,k=B(k,T,S,A,p,7,x[8]),T,S,v,12,x[9]),k,T,y,17,x[10]),A,k,g,22,x[11]),S=B(S,A=B(A,k=B(k,T,S,A,m,7,x[12]),T,S,b,12,x[13]),k,T,w,17,x[14]),A,k,_,22,x[15]),S=E(S,A=E(A,k=E(k,T,S,A,s,5,x[16]),T,S,d,9,x[17]),k,T,g,14,x[18]),A,k,a,20,x[19]),S=E(S,A=E(A,k=E(k,T,S,A,l,5,x[20]),T,S,y,9,x[21]),k,T,_,14,x[22]),A,k,f,20,x[23]),S=E(S,A=E(A,k=E(k,T,S,A,v,5,x[24]),T,S,w,9,x[25]),k,T,u,14,x[26]),A,k,p,20,x[27]),S=E(S,A=E(A,k=E(k,T,S,A,b,5,x[28]),T,S,c,9,x[29]),k,T,h,14,x[30]),A,k,m,20,x[31]),S=H(S,A=H(A,k=H(k,T,S,A,l,4,x[32]),T,S,p,11,x[33]),k,T,g,16,x[34]),A,k,w,23,x[35]),S=H(S,A=H(A,k=H(k,T,S,A,s,4,x[36]),T,S,f,11,x[37]),k,T,h,16,x[38]),A,k,y,23,x[39]),S=H(S,A=H(A,k=H(k,T,S,A,b,4,x[40]),T,S,a,11,x[41]),k,T,u,16,x[42]),A,k,d,23,x[43]),S=H(S,A=H(A,k=H(k,T,S,A,v,4,x[44]),T,S,m,11,x[45]),k,T,_,16,x[46]),A,k,c,23,x[47]),S=j(S,A=j(A,k=j(k,T,S,A,a,6,x[48]),T,S,h,10,x[49]),k,T,w,15,x[50]),A,k,l,21,x[51]),S=j(S,A=j(A,k=j(k,T,S,A,m,6,x[52]),T,S,u,10,x[53]),k,T,y,15,x[54]),A,k,s,21,x[55]),S=j(S,A=j(A,k=j(k,T,S,A,p,6,x[56]),T,S,_,10,x[57]),k,T,d,15,x[58]),A,k,b,21,x[59]),S=j(S,A=j(A,k=j(k,T,S,A,f,6,x[60]),T,S,g,10,x[61]),k,T,c,15,x[62]),A,k,v,21,x[63]),o[0]=o[0]+k|0,o[1]=o[1]+T|0,o[2]=o[2]+S|0,o[3]=o[3]+A|0},_doFinalize:function(){var e=this._data,t=e.words,r=8*this._nDataBytes,n=8*e.sigBytes;t[n>>>5]|=128<<24-n%32;var i=f.floor(r/4294967296),o=r;t[15+(n+64>>>9<<4)]=16711935&(i<<8|i>>>24)|4278255360&(i<<24|i>>>8),t[14+(n+64>>>9<<4)]=16711935&(o<<8|o>>>24)|4278255360&(o<<24|o>>>8),e.sigBytes=4*(t.length+1),this._process();for(var a=this._hash,s=a.words,c=0;c<4;c++){var u=s[c];s[c]=16711935&(u<<8|u>>>24)|4278255360&(u<<24|u>>>8)}return a},clone:function(){var e=n.clone.call(this);return e._hash=this._hash.clone(),e}});function B(e,t,r,n,i,o,a){var s=e+(t&r|~t&n)+i+a;return(s<<o|s>>>32-o)+t}function E(e,t,r,n,i,o,a){var s=e+(t&n|r&~n)+i+a;return(s<<o|s>>>32-o)+t}function H(e,t,r,n,i,o,a){var s=e+(t^r^n)+i+a;return(s<<o|s>>>32-o)+t}function j(e,t,r,n,i,o,a){var s=e+(r^(t|~n))+i+a;return(s<<o|s>>>32-o)+t}e.MD5=n._createHelper(o),e.HmacMD5=n._createHmacHelper(o)}(Math),a.MD5},"object"==typeof r?t.exports=r=i(e("./core")):"function"==typeof define&&define.amd?define(["./core"],i):i(n.CryptoJS)},{"./core":27}],36:[function(e,t,r){var n,i;n=this,i=function(t){return t.mode.CFB=function(){var e=t.lib.BlockCipherMode.extend();function o(e,t,r,n){var i=this._iv;if(i){var o=i.slice(0);this._iv=void 0}else o=this._prevBlock;n.encryptBlock(o,0);for(var a=0;a<r;a++)e[t+a]^=o[a]}return e.Encryptor=e.extend({processBlock:function(e,t){var r=this._cipher,n=r.blockSize;o.call(this,e,t,n,r),this._prevBlock=e.slice(t,t+n)}}),e.Decryptor=e.extend({processBlock:function(e,t){var r=this._cipher,n=r.blockSize,i=e.slice(t,t+n);o.call(this,e,t,n,r),this._prevBlock=i}}),e}(),t.mode.CFB},"object"==typeof r?t.exports=r=i(e("./core"),e("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],i):i(n.CryptoJS)},{"./cipher-core":26,"./core":27}],37:[function(e,t,r){var n,i;n=this,i=function(r){return r.mode.CTRGladman=function(){var e=r.lib.BlockCipherMode.extend();function u(e){if(255==(e>>24&255)){var t=e>>16&255,r=e>>8&255,n=255&e;255===t?(t=0,255===r?(r=0,255===n?n=0:++n):++r):++t,e=0,e+=t<<16,e+=r<<8,e+=n}else e+=1<<24;return e}var t=e.Encryptor=e.extend({processBlock:function(e,t){var r,n=this._cipher,i=n.blockSize,o=this._iv,a=this._counter;o&&(a=this._counter=o.slice(0),this._iv=void 0),0===((r=a)[0]=u(r[0]))&&(r[1]=u(r[1]));var s=a.slice(0);n.encryptBlock(s,0);for(var c=0;c<i;c++)e[t+c]^=s[c]}});return e.Decryptor=t,e}(),r.mode.CTRGladman},"object"==typeof r?t.exports=r=i(e("./core"),e("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],i):i(n.CryptoJS)},{"./cipher-core":26,"./core":27}],38:[function(e,t,r){var n,i;n=this,i=function(e){var t,r;return e.mode.CTR=(t=e.lib.BlockCipherMode.extend(),r=t.Encryptor=t.extend({processBlock:function(e,t){var r=this._cipher,n=r.blockSize,i=this._iv,o=this._counter;i&&(o=this._counter=i.slice(0),this._iv=void 0);var a=o.slice(0);r.encryptBlock(a,0),o[n-1]=o[n-1]+1|0;for(var s=0;s<n;s++)e[t+s]^=a[s]}}),t.Decryptor=r,t),e.mode.CTR},"object"==typeof r?t.exports=r=i(e("./core"),e("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],i):i(n.CryptoJS)},{"./cipher-core":26,"./core":27}],39:[function(e,t,r){var n,i;n=this,i=function(e){var t;return e.mode.ECB=((t=e.lib.BlockCipherMode.extend()).Encryptor=t.extend({processBlock:function(e,t){this._cipher.encryptBlock(e,t)}}),t.Decryptor=t.extend({processBlock:function(e,t){this._cipher.decryptBlock(e,t)}}),t),e.mode.ECB},"object"==typeof r?t.exports=r=i(e("./core"),e("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],i):i(n.CryptoJS)},{"./cipher-core":26,"./core":27}],40:[function(e,t,r){var n,i;n=this,i=function(e){var t,r;return e.mode.OFB=(t=e.lib.BlockCipherMode.extend(),r=t.Encryptor=t.extend({processBlock:function(e,t){var r=this._cipher,n=r.blockSize,i=this._iv,o=this._keystream;i&&(o=this._keystream=i.slice(0),this._iv=void 0),r.encryptBlock(o,0);for(var a=0;a<n;a++)e[t+a]^=o[a]}}),t.Decryptor=r,t),e.mode.OFB},"object"==typeof r?t.exports=r=i(e("./core"),e("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],i):i(n.CryptoJS)},{"./cipher-core":26,"./core":27}],41:[function(e,t,r){var n,i;n=this,i=function(e){return e.pad.AnsiX923={pad:function(e,t){var r=e.sigBytes,n=4*t,i=n-r%n,o=r+i-1;e.clamp(),e.words[o>>>2]|=i<<24-o%4*8,e.sigBytes+=i},unpad:function(e){var t=255&e.words[e.sigBytes-1>>>2];e.sigBytes-=t}},e.pad.Ansix923},"object"==typeof r?t.exports=r=i(e("./core"),e("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],i):i(n.CryptoJS)},{"./cipher-core":26,"./core":27}],42:[function(e,t,r){var n,i;n=this,i=function(i){return i.pad.Iso10126={pad:function(e,t){var r=4*t,n=r-e.sigBytes%r;e.concat(i.lib.WordArray.random(n-1)).concat(i.lib.WordArray.create([n<<24],1))},unpad:function(e){var t=255&e.words[e.sigBytes-1>>>2];e.sigBytes-=t}},i.pad.Iso10126},"object"==typeof r?t.exports=r=i(e("./core"),e("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],i):i(n.CryptoJS)},{"./cipher-core":26,"./core":27}],43:[function(e,t,r){var n,i;n=this,i=function(r){return r.pad.Iso97971={pad:function(e,t){e.concat(r.lib.WordArray.create([2147483648],1)),r.pad.ZeroPadding.pad(e,t)},unpad:function(e){r.pad.ZeroPadding.unpad(e),e.sigBytes--}},r.pad.Iso97971},"object"==typeof r?t.exports=r=i(e("./core"),e("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],i):i(n.CryptoJS)},{"./cipher-core":26,"./core":27}],44:[function(e,t,r){var n,i;n=this,i=function(e){return e.pad.NoPadding={pad:function(){},unpad:function(){}},e.pad.NoPadding},"object"==typeof r?t.exports=r=i(e("./core"),e("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],i):i(n.CryptoJS)},{"./cipher-core":26,"./core":27}],45:[function(e,t,r){var n,i;n=this,i=function(e){return e.pad.ZeroPadding={pad:function(e,t){var r=4*t;e.clamp(),e.sigBytes+=r-(e.sigBytes%r||r)},unpad:function(e){for(var t=e.words,r=e.sigBytes-1;!(t[r>>>2]>>>24-r%4*8&255);)r--;e.sigBytes=r+1}},e.pad.ZeroPadding},"object"==typeof r?t.exports=r=i(e("./core"),e("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],i):i(n.CryptoJS)},{"./cipher-core":26,"./core":27}],46:[function(e,t,r){var n,i;n=this,i=function(e){var t,r,n,g,i,o,m,a;return r=(t=e).lib,n=r.Base,g=r.WordArray,i=t.algo,o=i.SHA1,m=i.HMAC,a=i.PBKDF2=n.extend({cfg:n.extend({keySize:4,hasher:o,iterations:1}),init:function(e){this.cfg=this.cfg.extend(e)},compute:function(e,t){for(var r=this.cfg,n=m.create(r.hasher,e),i=g.create(),o=g.create([1]),a=i.words,s=o.words,c=r.keySize,u=r.iterations;a.length<c;){var f=n.update(t).finalize(o);n.reset();for(var l=f.words,d=l.length,h=f,p=1;p<u;p++){h=n.finalize(h),n.reset();for(var v=h.words,y=0;y<d;y++)l[y]^=v[y]}i.concat(f),s[0]++}return i.sigBytes=4*c,i}}),t.PBKDF2=function(e,t,r){return a.create(r).compute(e,t)},e.PBKDF2},"object"==typeof r?t.exports=r=i(e("./core"),e("./sha1"),e("./hmac")):"function"==typeof define&&define.amd?define(["./core","./sha1","./hmac"],i):i(n.CryptoJS)},{"./core":27,"./hmac":32,"./sha1":51}],47:[function(e,t,r){var n,i;n=this,i=function(o){return function(){var e=o,t=e.lib.StreamCipher,r=e.algo,i=[],c=[],u=[],n=r.RabbitLegacy=t.extend({_doReset:function(){for(var e=this._key.words,t=this.cfg.iv,r=this._X=[e[0],e[3]<<16|e[2]>>>16,e[1],e[0]<<16|e[3]>>>16,e[2],e[1]<<16|e[0]>>>16,e[3],e[2]<<16|e[1]>>>16],n=this._C=[e[2]<<16|e[2]>>>16,4294901760&e[0]|65535&e[1],e[3]<<16|e[3]>>>16,4294901760&e[1]|65535&e[2],e[0]<<16|e[0]>>>16,4294901760&e[2]|65535&e[3],e[1]<<16|e[1]>>>16,4294901760&e[3]|65535&e[0]],i=this._b=0;i<4;i++)d.call(this);for(i=0;i<8;i++)n[i]^=r[i+4&7];if(t){var o=t.words,a=o[0],s=o[1],c=16711935&(a<<8|a>>>24)|4278255360&(a<<24|a>>>8),u=16711935&(s<<8|s>>>24)|4278255360&(s<<24|s>>>8),f=c>>>16|4294901760&u,l=u<<16|65535&c;n[0]^=c,n[1]^=f,n[2]^=u,n[3]^=l,n[4]^=c,n[5]^=f,n[6]^=u,n[7]^=l;for(i=0;i<4;i++)d.call(this)}},_doProcessBlock:function(e,t){var r=this._X;d.call(this),i[0]=r[0]^r[5]>>>16^r[3]<<16,i[1]=r[2]^r[7]>>>16^r[5]<<16,i[2]=r[4]^r[1]>>>16^r[7]<<16,i[3]=r[6]^r[3]>>>16^r[1]<<16;for(var n=0;n<4;n++)i[n]=16711935&(i[n]<<8|i[n]>>>24)|4278255360&(i[n]<<24|i[n]>>>8),e[t+n]^=i[n]},blockSize:4,ivSize:2});function d(){for(var e=this._X,t=this._C,r=0;r<8;r++)c[r]=t[r];t[0]=t[0]+1295307597+this._b|0,t[1]=t[1]+3545052371+(t[0]>>>0<c[0]>>>0?1:0)|0,t[2]=t[2]+886263092+(t[1]>>>0<c[1]>>>0?1:0)|0,t[3]=t[3]+1295307597+(t[2]>>>0<c[2]>>>0?1:0)|0,t[4]=t[4]+3545052371+(t[3]>>>0<c[3]>>>0?1:0)|0,t[5]=t[5]+886263092+(t[4]>>>0<c[4]>>>0?1:0)|0,t[6]=t[6]+1295307597+(t[5]>>>0<c[5]>>>0?1:0)|0,t[7]=t[7]+3545052371+(t[6]>>>0<c[6]>>>0?1:0)|0,this._b=t[7]>>>0<c[7]>>>0?1:0;for(r=0;r<8;r++){var n=e[r]+t[r],i=65535&n,o=n>>>16,a=((i*i>>>17)+i*o>>>15)+o*o,s=((4294901760&n)*n|0)+((65535&n)*n|0);u[r]=a^s}e[0]=u[0]+(u[7]<<16|u[7]>>>16)+(u[6]<<16|u[6]>>>16)|0,e[1]=u[1]+(u[0]<<8|u[0]>>>24)+u[7]|0,e[2]=u[2]+(u[1]<<16|u[1]>>>16)+(u[0]<<16|u[0]>>>16)|0,e[3]=u[3]+(u[2]<<8|u[2]>>>24)+u[1]|0,e[4]=u[4]+(u[3]<<16|u[3]>>>16)+(u[2]<<16|u[2]>>>16)|0,e[5]=u[5]+(u[4]<<8|u[4]>>>24)+u[3]|0,e[6]=u[6]+(u[5]<<16|u[5]>>>16)+(u[4]<<16|u[4]>>>16)|0,e[7]=u[7]+(u[6]<<8|u[6]>>>24)+u[5]|0}e.RabbitLegacy=t._createHelper(n)}(),o.RabbitLegacy},"object"==typeof r?t.exports=r=i(e("./core"),e("./enc-base64"),e("./md5"),e("./evpkdf"),e("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./enc-base64","./md5","./evpkdf","./cipher-core"],i):i(n.CryptoJS)},{"./cipher-core":26,"./core":27,"./enc-base64":28,"./evpkdf":30,"./md5":35}],48:[function(e,t,r){var n,i;n=this,i=function(o){return function(){var e=o,t=e.lib.StreamCipher,r=e.algo,i=[],c=[],u=[],n=r.Rabbit=t.extend({_doReset:function(){for(var e=this._key.words,t=this.cfg.iv,r=0;r<4;r++)e[r]=16711935&(e[r]<<8|e[r]>>>24)|4278255360&(e[r]<<24|e[r]>>>8);var n=this._X=[e[0],e[3]<<16|e[2]>>>16,e[1],e[0]<<16|e[3]>>>16,e[2],e[1]<<16|e[0]>>>16,e[3],e[2]<<16|e[1]>>>16],i=this._C=[e[2]<<16|e[2]>>>16,4294901760&e[0]|65535&e[1],e[3]<<16|e[3]>>>16,4294901760&e[1]|65535&e[2],e[0]<<16|e[0]>>>16,4294901760&e[2]|65535&e[3],e[1]<<16|e[1]>>>16,4294901760&e[3]|65535&e[0]];for(r=this._b=0;r<4;r++)d.call(this);for(r=0;r<8;r++)i[r]^=n[r+4&7];if(t){var o=t.words,a=o[0],s=o[1],c=16711935&(a<<8|a>>>24)|4278255360&(a<<24|a>>>8),u=16711935&(s<<8|s>>>24)|4278255360&(s<<24|s>>>8),f=c>>>16|4294901760&u,l=u<<16|65535&c;i[0]^=c,i[1]^=f,i[2]^=u,i[3]^=l,i[4]^=c,i[5]^=f,i[6]^=u,i[7]^=l;for(r=0;r<4;r++)d.call(this)}},_doProcessBlock:function(e,t){var r=this._X;d.call(this),i[0]=r[0]^r[5]>>>16^r[3]<<16,i[1]=r[2]^r[7]>>>16^r[5]<<16,i[2]=r[4]^r[1]>>>16^r[7]<<16,i[3]=r[6]^r[3]>>>16^r[1]<<16;for(var n=0;n<4;n++)i[n]=16711935&(i[n]<<8|i[n]>>>24)|4278255360&(i[n]<<24|i[n]>>>8),e[t+n]^=i[n]},blockSize:4,ivSize:2});function d(){for(var e=this._X,t=this._C,r=0;r<8;r++)c[r]=t[r];t[0]=t[0]+1295307597+this._b|0,t[1]=t[1]+3545052371+(t[0]>>>0<c[0]>>>0?1:0)|0,t[2]=t[2]+886263092+(t[1]>>>0<c[1]>>>0?1:0)|0,t[3]=t[3]+1295307597+(t[2]>>>0<c[2]>>>0?1:0)|0,t[4]=t[4]+3545052371+(t[3]>>>0<c[3]>>>0?1:0)|0,t[5]=t[5]+886263092+(t[4]>>>0<c[4]>>>0?1:0)|0,t[6]=t[6]+1295307597+(t[5]>>>0<c[5]>>>0?1:0)|0,t[7]=t[7]+3545052371+(t[6]>>>0<c[6]>>>0?1:0)|0,this._b=t[7]>>>0<c[7]>>>0?1:0;for(r=0;r<8;r++){var n=e[r]+t[r],i=65535&n,o=n>>>16,a=((i*i>>>17)+i*o>>>15)+o*o,s=((4294901760&n)*n|0)+((65535&n)*n|0);u[r]=a^s}e[0]=u[0]+(u[7]<<16|u[7]>>>16)+(u[6]<<16|u[6]>>>16)|0,e[1]=u[1]+(u[0]<<8|u[0]>>>24)+u[7]|0,e[2]=u[2]+(u[1]<<16|u[1]>>>16)+(u[0]<<16|u[0]>>>16)|0,e[3]=u[3]+(u[2]<<8|u[2]>>>24)+u[1]|0,e[4]=u[4]+(u[3]<<16|u[3]>>>16)+(u[2]<<16|u[2]>>>16)|0,e[5]=u[5]+(u[4]<<8|u[4]>>>24)+u[3]|0,e[6]=u[6]+(u[5]<<16|u[5]>>>16)+(u[4]<<16|u[4]>>>16)|0,e[7]=u[7]+(u[6]<<8|u[6]>>>24)+u[5]|0}e.Rabbit=t._createHelper(n)}(),o.Rabbit},"object"==typeof r?t.exports=r=i(e("./core"),e("./enc-base64"),e("./md5"),e("./evpkdf"),e("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./enc-base64","./md5","./evpkdf","./cipher-core"],i):i(n.CryptoJS)},{"./cipher-core":26,"./core":27,"./enc-base64":28,"./evpkdf":30,"./md5":35}],49:[function(e,t,r){var n,i;n=this,i=function(a){return function(){var e=a,t=e.lib.StreamCipher,r=e.algo,n=r.RC4=t.extend({_doReset:function(){for(var e=this._key,t=e.words,r=e.sigBytes,n=this._S=[],i=0;i<256;i++)n[i]=i;i=0;for(var o=0;i<256;i++){var a=i%r,s=t[a>>>2]>>>24-a%4*8&255;o=(o+n[i]+s)%256;var c=n[i];n[i]=n[o],n[o]=c}this._i=this._j=0},_doProcessBlock:function(e,t){e[t]^=i.call(this)},keySize:8,ivSize:0});function i(){for(var e=this._S,t=this._i,r=this._j,n=0,i=0;i<4;i++){r=(r+e[t=(t+1)%256])%256;var o=e[t];e[t]=e[r],e[r]=o,n|=e[(e[t]+e[r])%256]<<24-8*i}return this._i=t,this._j=r,n}e.RC4=t._createHelper(n);var o=r.RC4Drop=n.extend({cfg:n.cfg.extend({drop:192}),_doReset:function(){n._doReset.call(this);for(var e=this.cfg.drop;0<e;e--)i.call(this)}});e.RC4Drop=t._createHelper(o)}(),a.RC4},"object"==typeof r?t.exports=r=i(e("./core"),e("./enc-base64"),e("./md5"),e("./evpkdf"),e("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./enc-base64","./md5","./evpkdf","./cipher-core"],i):i(n.CryptoJS)},{"./cipher-core":26,"./core":27,"./enc-base64":28,"./evpkdf":30,"./md5":35}],50:[function(e,t,r){var n,i;n=this,i=function(s){return function(e){var t=s,r=t.lib,n=r.WordArray,i=r.Hasher,o=t.algo,T=n.create([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13]),S=n.create([5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11]),A=n.create([11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6]),x=n.create([8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11]),B=n.create([0,1518500249,1859775393,2400959708,2840853838]),E=n.create([1352829926,1548603684,1836072691,2053994217,0]),a=o.RIPEMD160=i.extend({_doReset:function(){this._hash=n.create([1732584193,4023233417,2562383102,271733878,3285377520])},_doProcessBlock:function(e,t){for(var r=0;r<16;r++){var n=t+r,i=e[n];e[n]=16711935&(i<<8|i>>>24)|4278255360&(i<<24|i>>>8)}var o,a,s,c,u,f,l,d,h,p,v,y=this._hash.words,g=B.words,m=E.words,b=T.words,w=S.words,_=A.words,k=x.words;f=o=y[0],l=a=y[1],d=s=y[2],h=c=y[3],p=u=y[4];for(r=0;r<80;r+=1)v=o+e[t+b[r]]|0,v+=r<16?H(a,s,c)+g[0]:r<32?j(a,s,c)+g[1]:r<48?O(a,s,c)+g[2]:r<64?I(a,s,c)+g[3]:C(a,s,c)+g[4],v=(v=z(v|=0,_[r]))+u|0,o=u,u=c,c=z(s,10),s=a,a=v,v=f+e[t+w[r]]|0,v+=r<16?C(l,d,h)+m[0]:r<32?I(l,d,h)+m[1]:r<48?O(l,d,h)+m[2]:r<64?j(l,d,h)+m[3]:H(l,d,h)+m[4],v=(v=z(v|=0,k[r]))+p|0,f=p,p=h,h=z(d,10),d=l,l=v;v=y[1]+s+h|0,y[1]=y[2]+c+p|0,y[2]=y[3]+u+f|0,y[3]=y[4]+o+l|0,y[4]=y[0]+a+d|0,y[0]=v},_doFinalize:function(){var e=this._data,t=e.words,r=8*this._nDataBytes,n=8*e.sigBytes;t[n>>>5]|=128<<24-n%32,t[14+(n+64>>>9<<4)]=16711935&(r<<8|r>>>24)|4278255360&(r<<24|r>>>8),e.sigBytes=4*(t.length+1),this._process();for(var i=this._hash,o=i.words,a=0;a<5;a++){var s=o[a];o[a]=16711935&(s<<8|s>>>24)|4278255360&(s<<24|s>>>8)}return i},clone:function(){var e=i.clone.call(this);return e._hash=this._hash.clone(),e}});function H(e,t,r){return e^t^r}function j(e,t,r){return e&t|~e&r}function O(e,t,r){return(e|~t)^r}function I(e,t,r){return e&r|t&~r}function C(e,t,r){return e^(t|~r)}function z(e,t){return e<<t|e>>>32-t}t.RIPEMD160=i._createHelper(a),t.HmacRIPEMD160=i._createHmacHelper(a)}(Math),s.RIPEMD160},"object"==typeof r?t.exports=r=i(e("./core")):"function"==typeof define&&define.amd?define(["./core"],i):i(n.CryptoJS)},{"./core":27}],51:[function(e,t,r){var n,i;n=this,i=function(e){var t,r,n,i,o,l,a;return r=(t=e).lib,n=r.WordArray,i=r.Hasher,o=t.algo,l=[],a=o.SHA1=i.extend({_doReset:function(){this._hash=new n.init([1732584193,4023233417,2562383102,271733878,3285377520])},_doProcessBlock:function(e,t){for(var r=this._hash.words,n=r[0],i=r[1],o=r[2],a=r[3],s=r[4],c=0;c<80;c++){if(c<16)l[c]=0|e[t+c];else{var u=l[c-3]^l[c-8]^l[c-14]^l[c-16];l[c]=u<<1|u>>>31}var f=(n<<5|n>>>27)+s+l[c];f+=c<20?1518500249+(i&o|~i&a):c<40?1859775393+(i^o^a):c<60?(i&o|i&a|o&a)-1894007588:(i^o^a)-899497514,s=a,a=o,o=i<<30|i>>>2,i=n,n=f}r[0]=r[0]+n|0,r[1]=r[1]+i|0,r[2]=r[2]+o|0,r[3]=r[3]+a|0,r[4]=r[4]+s|0},_doFinalize:function(){var e=this._data,t=e.words,r=8*this._nDataBytes,n=8*e.sigBytes;return t[n>>>5]|=128<<24-n%32,t[14+(n+64>>>9<<4)]=Math.floor(r/4294967296),t[15+(n+64>>>9<<4)]=r,e.sigBytes=4*t.length,this._process(),this._hash},clone:function(){var e=i.clone.call(this);return e._hash=this._hash.clone(),e}}),t.SHA1=i._createHelper(a),t.HmacSHA1=i._createHmacHelper(a),e.SHA1},"object"==typeof r?t.exports=r=i(e("./core")):"function"==typeof define&&define.amd?define(["./core"],i):i(n.CryptoJS)},{"./core":27}],52:[function(e,t,r){var n,i;n=this,i=function(e){var t,r,n,i,o;return r=(t=e).lib.WordArray,n=t.algo,i=n.SHA256,o=n.SHA224=i.extend({_doReset:function(){this._hash=new r.init([3238371032,914150663,812702999,4144912697,4290775857,1750603025,1694076839,3204075428])},_doFinalize:function(){var e=i._doFinalize.call(this);return e.sigBytes-=4,e}}),t.SHA224=i._createHelper(o),t.HmacSHA224=i._createHmacHelper(o),e.SHA224},"object"==typeof r?t.exports=r=i(e("./core"),e("./sha256")):"function"==typeof define&&define.amd?define(["./core","./sha256"],i):i(n.CryptoJS)},{"./core":27,"./sha256":53}],53:[function(e,t,r){var n,i;n=this,i=function(c){return function(i){var e=c,t=e.lib,r=t.WordArray,n=t.Hasher,o=e.algo,a=[],b=[];!function(){function e(e){for(var t=i.sqrt(e),r=2;r<=t;r++)if(!(e%r))return!1;return!0}function t(e){return 4294967296*(e-(0|e))|0}for(var r=2,n=0;n<64;)e(r)&&(n<8&&(a[n]=t(i.pow(r,.5))),b[n]=t(i.pow(r,1/3)),n++),r++}();var w=[],s=o.SHA256=n.extend({_doReset:function(){this._hash=new r.init(a.slice(0))},_doProcessBlock:function(e,t){for(var r=this._hash.words,n=r[0],i=r[1],o=r[2],a=r[3],s=r[4],c=r[5],u=r[6],f=r[7],l=0;l<64;l++){if(l<16)w[l]=0|e[t+l];else{var d=w[l-15],h=(d<<25|d>>>7)^(d<<14|d>>>18)^d>>>3,p=w[l-2],v=(p<<15|p>>>17)^(p<<13|p>>>19)^p>>>10;w[l]=h+w[l-7]+v+w[l-16]}var y=n&i^n&o^i&o,g=(n<<30|n>>>2)^(n<<19|n>>>13)^(n<<10|n>>>22),m=f+((s<<26|s>>>6)^(s<<21|s>>>11)^(s<<7|s>>>25))+(s&c^~s&u)+b[l]+w[l];f=u,u=c,c=s,s=a+m|0,a=o,o=i,i=n,n=m+(g+y)|0}r[0]=r[0]+n|0,r[1]=r[1]+i|0,r[2]=r[2]+o|0,r[3]=r[3]+a|0,r[4]=r[4]+s|0,r[5]=r[5]+c|0,r[6]=r[6]+u|0,r[7]=r[7]+f|0},_doFinalize:function(){var e=this._data,t=e.words,r=8*this._nDataBytes,n=8*e.sigBytes;return t[n>>>5]|=128<<24-n%32,t[14+(n+64>>>9<<4)]=i.floor(r/4294967296),t[15+(n+64>>>9<<4)]=r,e.sigBytes=4*t.length,this._process(),this._hash},clone:function(){var e=n.clone.call(this);return e._hash=this._hash.clone(),e}});e.SHA256=n._createHelper(s),e.HmacSHA256=n._createHmacHelper(s)}(Math),c.SHA256},"object"==typeof r?t.exports=r=i(e("./core")):"function"==typeof define&&define.amd?define(["./core"],i):i(n.CryptoJS)},{"./core":27}],54:[function(e,t,r){var n,i;n=this,i=function(o){return function(d){var e=o,t=e.lib,h=t.WordArray,n=t.Hasher,f=e.x64.Word,r=e.algo,H=[],j=[],O=[];!function(){for(var e=1,t=0,r=0;r<24;r++){H[e+5*t]=(r+1)*(r+2)/2%64;var n=(2*e+3*t)%5;e=t%5,t=n}for(e=0;e<5;e++)for(t=0;t<5;t++)j[e+5*t]=t+(2*e+3*t)%5*5;for(var i=1,o=0;o<24;o++){for(var a=0,s=0,c=0;c<7;c++){if(1&i){var u=(1<<c)-1;u<32?s^=1<<u:a^=1<<u-32}128&i?i=i<<1^113:i<<=1}O[o]=f.create(a,s)}}();var I=[];!function(){for(var e=0;e<25;e++)I[e]=f.create()}();var i=r.SHA3=n.extend({cfg:n.cfg.extend({outputLength:512}),_doReset:function(){for(var e=this._state=[],t=0;t<25;t++)e[t]=new f.init;this.blockSize=(1600-2*this.cfg.outputLength)/32},_doProcessBlock:function(e,t){for(var r=this._state,n=this.blockSize/2,i=0;i<n;i++){var o=e[t+2*i],a=e[t+2*i+1];o=16711935&(o<<8|o>>>24)|4278255360&(o<<24|o>>>8),a=16711935&(a<<8|a>>>24)|4278255360&(a<<24|a>>>8),(S=r[i]).high^=a,S.low^=o}for(var s=0;s<24;s++){for(var c=0;c<5;c++){for(var u=0,f=0,l=0;l<5;l++){u^=(S=r[c+5*l]).high,f^=S.low}var d=I[c];d.high=u,d.low=f}for(c=0;c<5;c++){var h=I[(c+4)%5],p=I[(c+1)%5],v=p.high,y=p.low;for(u=h.high^(v<<1|y>>>31),f=h.low^(y<<1|v>>>31),l=0;l<5;l++){(S=r[c+5*l]).high^=u,S.low^=f}}for(var g=1;g<25;g++){var m=(S=r[g]).high,b=S.low,w=H[g];if(w<32)u=m<<w|b>>>32-w,f=b<<w|m>>>32-w;else u=b<<w-32|m>>>64-w,f=m<<w-32|b>>>64-w;var _=I[j[g]];_.high=u,_.low=f}var k=I[0],T=r[0];k.high=T.high,k.low=T.low;for(c=0;c<5;c++)for(l=0;l<5;l++){var S=r[g=c+5*l],A=I[g],x=I[(c+1)%5+5*l],B=I[(c+2)%5+5*l];S.high=A.high^~x.high&B.high,S.low=A.low^~x.low&B.low}S=r[0];var E=O[s];S.high^=E.high,S.low^=E.low}},_doFinalize:function(){var e=this._data,t=e.words,r=(this._nDataBytes,8*e.sigBytes),n=32*this.blockSize;t[r>>>5]|=1<<24-r%32,t[(d.ceil((r+1)/n)*n>>>5)-1]|=128,e.sigBytes=4*t.length,this._process();for(var i=this._state,o=this.cfg.outputLength/8,a=o/8,s=[],c=0;c<a;c++){var u=i[c],f=u.high,l=u.low;f=16711935&(f<<8|f>>>24)|4278255360&(f<<24|f>>>8),l=16711935&(l<<8|l>>>24)|4278255360&(l<<24|l>>>8),s.push(l),s.push(f)}return new h.init(s,o)},clone:function(){for(var e=n.clone.call(this),t=e._state=this._state.slice(0),r=0;r<25;r++)t[r]=t[r].clone();return e}});e.SHA3=n._createHelper(i),e.HmacSHA3=n._createHmacHelper(i)}(Math),o.SHA3},"object"==typeof r?t.exports=r=i(e("./core"),e("./x64-core")):"function"==typeof define&&define.amd?define(["./core","./x64-core"],i):i(n.CryptoJS)},{"./core":27,"./x64-core":58}],55:[function(e,t,r){var n,i;n=this,i=function(e){var t,r,n,i,o,a,s;return r=(t=e).x64,n=r.Word,i=r.WordArray,o=t.algo,a=o.SHA512,s=o.SHA384=a.extend({_doReset:function(){this._hash=new i.init([new n.init(3418070365,3238371032),new n.init(1654270250,914150663),new n.init(2438529370,812702999),new n.init(355462360,4144912697),new n.init(1731405415,4290775857),new n.init(2394180231,1750603025),new n.init(3675008525,1694076839),new n.init(1203062813,3204075428)])},_doFinalize:function(){var e=a._doFinalize.call(this);return e.sigBytes-=16,e}}),t.SHA384=a._createHelper(s),t.HmacSHA384=a._createHmacHelper(s),e.SHA384},"object"==typeof r?t.exports=r=i(e("./core"),e("./x64-core"),e("./sha512")):"function"==typeof define&&define.amd?define(["./core","./x64-core","./sha512"],i):i(n.CryptoJS)},{"./core":27,"./sha512":56,"./x64-core":58}],56:[function(e,t,r){var n,i;n=this,i=function(c){return function(){var e=c,t=e.lib.Hasher,r=e.x64,n=r.Word,i=r.WordArray,o=e.algo;function a(){return n.create.apply(n,arguments)}var Te=[a(1116352408,3609767458),a(1899447441,602891725),a(3049323471,3964484399),a(3921009573,2173295548),a(961987163,4081628472),a(1508970993,3053834265),a(2453635748,2937671579),a(2870763221,3664609560),a(3624381080,2734883394),a(310598401,1164996542),a(607225278,1323610764),a(1426881987,3590304994),a(1925078388,4068182383),a(2162078206,991336113),a(2614888103,633803317),a(3248222580,3479774868),a(3835390401,2666613458),a(4022224774,944711139),a(264347078,2341262773),a(604807628,2007800933),a(770255983,1495990901),a(1249150122,1856431235),a(1555081692,3175218132),a(1996064986,2198950837),a(2554220882,3999719339),a(2821834349,766784016),a(2952996808,2566594879),a(3210313671,3203337956),a(3336571891,1034457026),a(3584528711,2466948901),a(113926993,3758326383),a(338241895,168717936),a(666307205,1188179964),a(773529912,1546045734),a(1294757372,1522805485),a(1396182291,2643833823),a(1695183700,2343527390),a(1986661051,1014477480),a(2177026350,1206759142),a(2456956037,344077627),a(2730485921,1290863460),a(2820302411,3158454273),a(3259730800,3505952657),a(3345764771,106217008),a(3516065817,3606008344),a(3600352804,1432725776),a(4094571909,1467031594),a(275423344,851169720),a(430227734,3100823752),a(506948616,1363258195),a(659060556,3750685593),a(883997877,3785050280),a(958139571,3318307427),a(1322822218,3812723403),a(1537002063,2003034995),a(1747873779,3602036899),a(1955562222,1575990012),a(2024104815,1125592928),a(2227730452,2716904306),a(2361852424,442776044),a(2428436474,593698344),a(2756734187,3733110249),a(3204031479,2999351573),a(3329325298,3815920427),a(3391569614,3928383900),a(3515267271,566280711),a(3940187606,3454069534),a(4118630271,4000239992),a(116418474,1914138554),a(174292421,2731055270),a(289380356,3203993006),a(460393269,320620315),a(685471733,587496836),a(852142971,1086792851),a(1017036298,365543100),a(1126000580,2618297676),a(1288033470,3409855158),a(1501505948,4234509866),a(1607167915,987167468),a(1816402316,1246189591)],Se=[];!function(){for(var e=0;e<80;e++)Se[e]=a()}();var s=o.SHA512=t.extend({_doReset:function(){this._hash=new i.init([new n.init(1779033703,4089235720),new n.init(3144134277,2227873595),new n.init(1013904242,4271175723),new n.init(2773480762,1595750129),new n.init(1359893119,2917565137),new n.init(2600822924,725511199),new n.init(528734635,4215389547),new n.init(1541459225,327033209)])},_doProcessBlock:function(e,t){for(var r=this._hash.words,n=r[0],i=r[1],o=r[2],a=r[3],s=r[4],c=r[5],u=r[6],f=r[7],l=n.high,d=n.low,h=i.high,p=i.low,v=o.high,y=o.low,g=a.high,m=a.low,b=s.high,w=s.low,_=c.high,k=c.low,T=u.high,S=u.low,A=f.high,x=f.low,B=l,E=d,H=h,j=p,O=v,I=y,C=g,z=m,F=b,N=w,R=_,L=k,M=T,D=S,q=A,P=x,U=0;U<80;U++){var J=Se[U];if(U<16)var V=J.high=0|e[t+2*U],G=J.low=0|e[t+2*U+1];else{var W=Se[U-15],K=W.high,$=W.low,X=(K>>>1|$<<31)^(K>>>8|$<<24)^K>>>7,Z=($>>>1|K<<31)^($>>>8|K<<24)^($>>>7|K<<25),Y=Se[U-2],Q=Y.high,ee=Y.low,te=(Q>>>19|ee<<13)^(Q<<3|ee>>>29)^Q>>>6,re=(ee>>>19|Q<<13)^(ee<<3|Q>>>29)^(ee>>>6|Q<<26),ne=Se[U-7],ie=ne.high,oe=ne.low,ae=Se[U-16],se=ae.high,ce=ae.low;V=(V=(V=X+ie+((G=Z+oe)>>>0<Z>>>0?1:0))+te+((G=G+re)>>>0<re>>>0?1:0))+se+((G=G+ce)>>>0<ce>>>0?1:0);J.high=V,J.low=G}var ue,fe=F&R^~F&M,le=N&L^~N&D,de=B&H^B&O^H&O,he=E&j^E&I^j&I,pe=(B>>>28|E<<4)^(B<<30|E>>>2)^(B<<25|E>>>7),ve=(E>>>28|B<<4)^(E<<30|B>>>2)^(E<<25|B>>>7),ye=(F>>>14|N<<18)^(F>>>18|N<<14)^(F<<23|N>>>9),ge=(N>>>14|F<<18)^(N>>>18|F<<14)^(N<<23|F>>>9),me=Te[U],be=me.high,we=me.low,_e=q+ye+((ue=P+ge)>>>0<P>>>0?1:0),ke=ve+he;q=M,P=D,M=R,D=L,R=F,L=N,F=C+(_e=(_e=(_e=_e+fe+((ue=ue+le)>>>0<le>>>0?1:0))+be+((ue=ue+we)>>>0<we>>>0?1:0))+V+((ue=ue+G)>>>0<G>>>0?1:0))+((N=z+ue|0)>>>0<z>>>0?1:0)|0,C=O,z=I,O=H,I=j,H=B,j=E,B=_e+(pe+de+(ke>>>0<ve>>>0?1:0))+((E=ue+ke|0)>>>0<ue>>>0?1:0)|0}d=n.low=d+E,n.high=l+B+(d>>>0<E>>>0?1:0),p=i.low=p+j,i.high=h+H+(p>>>0<j>>>0?1:0),y=o.low=y+I,o.high=v+O+(y>>>0<I>>>0?1:0),m=a.low=m+z,a.high=g+C+(m>>>0<z>>>0?1:0),w=s.low=w+N,s.high=b+F+(w>>>0<N>>>0?1:0),k=c.low=k+L,c.high=_+R+(k>>>0<L>>>0?1:0),S=u.low=S+D,u.high=T+M+(S>>>0<D>>>0?1:0),x=f.low=x+P,f.high=A+q+(x>>>0<P>>>0?1:0)},_doFinalize:function(){var e=this._data,t=e.words,r=8*this._nDataBytes,n=8*e.sigBytes;return t[n>>>5]|=128<<24-n%32,t[30+(n+128>>>10<<5)]=Math.floor(r/4294967296),t[31+(n+128>>>10<<5)]=r,e.sigBytes=4*t.length,this._process(),this._hash.toX32()},clone:function(){var e=t.clone.call(this);return e._hash=this._hash.clone(),e},blockSize:32});e.SHA512=t._createHelper(s),e.HmacSHA512=t._createHmacHelper(s)}(),c.SHA512},"object"==typeof r?t.exports=r=i(e("./core"),e("./x64-core")):"function"==typeof define&&define.amd?define(["./core","./x64-core"],i):i(n.CryptoJS)},{"./core":27,"./x64-core":58}],57:[function(e,t,r){var n,i;n=this,i=function(s){return function(){var e=s,t=e.lib,r=t.WordArray,n=t.BlockCipher,i=e.algo,u=[57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4],f=[14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32],l=[1,2,4,6,8,10,12,14,15,17,19,21,23,25,27,28],d=[{0:8421888,268435456:32768,536870912:8421378,805306368:2,1073741824:512,1342177280:8421890,1610612736:8389122,1879048192:8388608,2147483648:514,2415919104:8389120,2684354560:33280,2952790016:8421376,3221225472:32770,3489660928:8388610,3758096384:0,4026531840:33282,134217728:0,402653184:8421890,671088640:33282,939524096:32768,1207959552:8421888,1476395008:512,1744830464:8421378,2013265920:2,2281701376:8389120,2550136832:33280,2818572288:8421376,3087007744:8389122,3355443200:8388610,3623878656:32770,3892314112:514,4160749568:8388608,1:32768,268435457:2,536870913:8421888,805306369:8388608,1073741825:8421378,1342177281:33280,1610612737:512,1879048193:8389122,2147483649:8421890,2415919105:8421376,2684354561:8388610,2952790017:33282,3221225473:514,3489660929:8389120,3758096385:32770,4026531841:0,134217729:8421890,402653185:8421376,671088641:8388608,939524097:512,1207959553:32768,1476395009:8388610,1744830465:2,2013265921:33282,2281701377:32770,2550136833:8389122,2818572289:514,3087007745:8421888,3355443201:8389120,3623878657:0,3892314113:33280,4160749569:8421378},{0:1074282512,16777216:16384,33554432:524288,50331648:1074266128,67108864:1073741840,83886080:1074282496,100663296:1073758208,117440512:16,134217728:540672,150994944:1073758224,167772160:1073741824,184549376:540688,201326592:524304,218103808:0,234881024:16400,251658240:1074266112,8388608:1073758208,25165824:540688,41943040:16,58720256:1073758224,75497472:1074282512,92274688:1073741824,109051904:524288,125829120:1074266128,142606336:524304,159383552:0,176160768:16384,192937984:1074266112,209715200:1073741840,226492416:540672,243269632:1074282496,260046848:16400,268435456:0,285212672:1074266128,301989888:1073758224,318767104:1074282496,335544320:1074266112,352321536:16,369098752:540688,385875968:16384,402653184:16400,419430400:524288,436207616:524304,452984832:1073741840,469762048:540672,486539264:1073758208,503316480:1073741824,520093696:1074282512,276824064:540688,293601280:524288,310378496:1074266112,327155712:16384,343932928:1073758208,360710144:1074282512,377487360:16,394264576:1073741824,411041792:1074282496,427819008:1073741840,444596224:1073758224,461373440:524304,478150656:0,494927872:16400,511705088:1074266128,528482304:540672},{0:260,1048576:0,2097152:67109120,3145728:65796,4194304:65540,5242880:67108868,6291456:67174660,7340032:67174400,8388608:67108864,9437184:67174656,10485760:65792,11534336:67174404,12582912:67109124,13631488:65536,14680064:4,15728640:256,524288:67174656,1572864:67174404,2621440:0,3670016:67109120,4718592:67108868,5767168:65536,6815744:65540,7864320:260,8912896:4,9961472:256,11010048:67174400,12058624:65796,13107200:65792,14155776:67109124,15204352:67174660,16252928:67108864,16777216:67174656,17825792:65540,18874368:65536,19922944:67109120,20971520:256,22020096:67174660,23068672:67108868,24117248:0,25165824:67109124,26214400:67108864,27262976:4,28311552:65792,29360128:67174400,30408704:260,31457280:65796,32505856:67174404,17301504:67108864,18350080:260,19398656:67174656,20447232:0,21495808:65540,22544384:67109120,23592960:256,24641536:67174404,25690112:65536,26738688:67174660,27787264:65796,28835840:67108868,29884416:67109124,30932992:67174400,31981568:4,33030144:65792},{0:2151682048,65536:2147487808,131072:4198464,196608:2151677952,262144:0,327680:4198400,393216:2147483712,458752:4194368,524288:2147483648,589824:4194304,655360:64,720896:2147487744,786432:2151678016,851968:4160,917504:4096,983040:2151682112,32768:2147487808,98304:64,163840:2151678016,229376:2147487744,294912:4198400,360448:2151682112,425984:0,491520:2151677952,557056:4096,622592:2151682048,688128:4194304,753664:4160,819200:2147483648,884736:4194368,950272:4198464,1015808:2147483712,1048576:4194368,1114112:4198400,1179648:2147483712,1245184:0,1310720:4160,1376256:2151678016,1441792:2151682048,1507328:2147487808,1572864:2151682112,1638400:2147483648,1703936:2151677952,1769472:4198464,1835008:2147487744,1900544:4194304,1966080:64,2031616:4096,1081344:2151677952,1146880:2151682112,1212416:0,1277952:4198400,1343488:4194368,1409024:2147483648,1474560:2147487808,1540096:64,1605632:2147483712,1671168:4096,1736704:2147487744,1802240:2151678016,1867776:4160,1933312:2151682048,1998848:4194304,2064384:4198464},{0:128,4096:17039360,8192:262144,12288:536870912,16384:537133184,20480:16777344,24576:553648256,28672:262272,32768:16777216,36864:537133056,40960:536871040,45056:553910400,49152:553910272,53248:0,57344:17039488,61440:553648128,2048:17039488,6144:553648256,10240:128,14336:17039360,18432:262144,22528:537133184,26624:553910272,30720:536870912,34816:537133056,38912:0,43008:553910400,47104:16777344,51200:536871040,55296:553648128,59392:16777216,63488:262272,65536:262144,69632:128,73728:536870912,77824:553648256,81920:16777344,86016:553910272,90112:537133184,94208:16777216,98304:553910400,102400:553648128,106496:17039360,110592:537133056,114688:262272,118784:536871040,122880:0,126976:17039488,67584:553648256,71680:16777216,75776:17039360,79872:537133184,83968:536870912,88064:17039488,92160:128,96256:553910272,100352:262272,104448:553910400,108544:0,112640:553648128,116736:16777344,120832:262144,124928:537133056,129024:536871040},{0:268435464,256:8192,512:270532608,768:270540808,1024:268443648,1280:2097152,1536:2097160,1792:268435456,2048:0,2304:268443656,2560:2105344,2816:8,3072:270532616,3328:2105352,3584:8200,3840:270540800,128:270532608,384:270540808,640:8,896:2097152,1152:2105352,1408:268435464,1664:268443648,1920:8200,2176:2097160,2432:8192,2688:268443656,2944:270532616,3200:0,3456:270540800,3712:2105344,3968:268435456,4096:268443648,4352:270532616,4608:270540808,4864:8200,5120:2097152,5376:268435456,5632:268435464,5888:2105344,6144:2105352,6400:0,6656:8,6912:270532608,7168:8192,7424:268443656,7680:270540800,7936:2097160,4224:8,4480:2105344,4736:2097152,4992:268435464,5248:268443648,5504:8200,5760:270540808,6016:270532608,6272:270540800,6528:270532616,6784:8192,7040:2105352,7296:2097160,7552:0,7808:268435456,8064:268443656},{0:1048576,16:33555457,32:1024,48:1049601,64:34604033,80:0,96:1,112:34603009,128:33555456,144:1048577,160:33554433,176:34604032,192:34603008,208:1025,224:1049600,240:33554432,8:34603009,24:0,40:33555457,56:34604032,72:1048576,88:33554433,104:33554432,120:1025,136:1049601,152:33555456,168:34603008,184:1048577,200:1024,216:34604033,232:1,248:1049600,256:33554432,272:1048576,288:33555457,304:34603009,320:1048577,336:33555456,352:34604032,368:1049601,384:1025,400:34604033,416:1049600,432:1,448:0,464:34603008,480:33554433,496:1024,264:1049600,280:33555457,296:34603009,312:1,328:33554432,344:1048576,360:1025,376:34604032,392:33554433,408:34603008,424:0,440:34604033,456:1049601,472:1024,488:33555456,504:1048577},{0:134219808,1:131072,2:134217728,3:32,4:131104,5:134350880,6:134350848,7:2048,8:134348800,9:134219776,10:133120,11:134348832,12:2080,13:0,14:134217760,15:133152,2147483648:2048,2147483649:134350880,2147483650:134219808,2147483651:134217728,2147483652:134348800,2147483653:133120,2147483654:133152,2147483655:32,2147483656:134217760,2147483657:2080,2147483658:131104,2147483659:134350848,2147483660:0,2147483661:134348832,2147483662:134219776,2147483663:131072,16:133152,17:134350848,18:32,19:2048,20:134219776,21:134217760,22:134348832,23:131072,24:0,25:131104,26:134348800,27:134219808,28:134350880,29:133120,30:2080,31:134217728,2147483664:131072,2147483665:2048,2147483666:134348832,2147483667:133152,2147483668:32,2147483669:134348800,2147483670:134217728,2147483671:134219808,2147483672:134350880,2147483673:134217760,2147483674:134219776,2147483675:0,2147483676:133120,2147483677:2080,2147483678:131104,2147483679:134350848}],h=[4160749569,528482304,33030144,2064384,129024,8064,504,2147483679],o=i.DES=n.extend({_doReset:function(){for(var e=this._key.words,t=[],r=0;r<56;r++){var n=u[r]-1;t[r]=e[n>>>5]>>>31-n%32&1}for(var i=this._subKeys=[],o=0;o<16;o++){var a=i[o]=[],s=l[o];for(r=0;r<24;r++)a[r/6|0]|=t[(f[r]-1+s)%28]<<31-r%6,a[4+(r/6|0)]|=t[28+(f[r+24]-1+s)%28]<<31-r%6;a[0]=a[0]<<1|a[0]>>>31;for(r=1;r<7;r++)a[r]=a[r]>>>4*(r-1)+3;a[7]=a[7]<<5|a[7]>>>27}var c=this._invSubKeys=[];for(r=0;r<16;r++)c[r]=i[15-r]},encryptBlock:function(e,t){this._doCryptBlock(e,t,this._subKeys)},decryptBlock:function(e,t){this._doCryptBlock(e,t,this._invSubKeys)},_doCryptBlock:function(e,t,r){this._lBlock=e[t],this._rBlock=e[t+1],p.call(this,4,252645135),p.call(this,16,65535),v.call(this,2,858993459),v.call(this,8,16711935),p.call(this,1,1431655765);for(var n=0;n<16;n++){for(var i=r[n],o=this._lBlock,a=this._rBlock,s=0,c=0;c<8;c++)s|=d[c][((a^i[c])&h[c])>>>0];this._lBlock=a,this._rBlock=o^s}var u=this._lBlock;this._lBlock=this._rBlock,this._rBlock=u,p.call(this,1,1431655765),v.call(this,8,16711935),v.call(this,2,858993459),p.call(this,16,65535),p.call(this,4,252645135),e[t]=this._lBlock,e[t+1]=this._rBlock},keySize:2,ivSize:2,blockSize:2});function p(e,t){var r=(this._lBlock>>>e^this._rBlock)&t;this._rBlock^=r,this._lBlock^=r<<e}function v(e,t){var r=(this._rBlock>>>e^this._lBlock)&t;this._lBlock^=r,this._rBlock^=r<<e}e.DES=n._createHelper(o);var a=i.TripleDES=n.extend({_doReset:function(){var e=this._key.words;this._des1=o.createEncryptor(r.create(e.slice(0,2))),this._des2=o.createEncryptor(r.create(e.slice(2,4))),this._des3=o.createEncryptor(r.create(e.slice(4,6)))},encryptBlock:function(e,t){this._des1.encryptBlock(e,t),this._des2.decryptBlock(e,t),this._des3.encryptBlock(e,t)},decryptBlock:function(e,t){this._des3.decryptBlock(e,t),this._des2.encryptBlock(e,t),this._des1.decryptBlock(e,t)},keySize:6,ivSize:2,blockSize:2});e.TripleDES=n._createHelper(a)}(),s.TripleDES},"object"==typeof r?t.exports=r=i(e("./core"),e("./enc-base64"),e("./md5"),e("./evpkdf"),e("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./enc-base64","./md5","./evpkdf","./cipher-core"],i):i(n.CryptoJS)},{"./cipher-core":26,"./core":27,"./enc-base64":28,"./evpkdf":30,"./md5":35}],58:[function(e,t,r){var n,i;n=this,i=function(e){var t,r,i,o,n;return r=(t=e).lib,i=r.Base,o=r.WordArray,(n=t.x64={}).Word=i.extend({init:function(e,t){this.high=e,this.low=t}}),n.WordArray=i.extend({init:function(e,t){e=this.words=e||[],this.sigBytes=null!=t?t:8*e.length},toX32:function(){for(var e=this.words,t=e.length,r=[],n=0;n<t;n++){var i=e[n];r.push(i.high),r.push(i.low)}return o.create(r,this.sigBytes)},clone:function(){for(var e=i.clone.call(this),t=e.words=this.words.slice(0),r=t.length,n=0;n<r;n++)t[n]=t[n].clone();return e}}),e},"object"==typeof r?t.exports=r=i(e("./core")):"function"==typeof define&&define.amd?define(["./core"],i):i(n.CryptoJS)},{"./core":27}],59:[function(e,t,r){var n,i,o=t.exports={};function a(){throw new Error("setTimeout has not been defined")}function s(){throw new Error("clearTimeout has not been defined")}function c(t){if(n===setTimeout)return setTimeout(t,0);if((n===a||!n)&&setTimeout)return n=setTimeout,setTimeout(t,0);try{return n(t,0)}catch(e){try{return n.call(null,t,0)}catch(e){return n.call(this,t,0)}}}!function(){try{n="function"==typeof setTimeout?setTimeout:a}catch(e){n=a}try{i="function"==typeof clearTimeout?clearTimeout:s}catch(e){i=s}}();var u,f=[],l=!1,d=-1;function h(){l&&u&&(l=!1,u.length?f=u.concat(f):d=-1,f.length&&p())}function p(){if(!l){var e=c(h);l=!0;for(var t=f.length;t;){for(u=f,f=[];++d<t;)u&&u[d].run();d=-1,t=f.length}u=null,l=!1,function(t){if(i===clearTimeout)return clearTimeout(t);if((i===s||!i)&&clearTimeout)return i=clearTimeout,clearTimeout(t);try{i(t)}catch(e){try{return i.call(null,t)}catch(e){return i.call(this,t)}}}(e)}}function v(e,t){this.fun=e,this.array=t}function y(){}o.nextTick=function(e){var t=new Array(arguments.length-1);if(1<arguments.length)for(var r=1;r<arguments.length;r++)t[r-1]=arguments[r];f.push(new v(e,t)),1!==f.length||l||c(p)},v.prototype.run=function(){this.fun.apply(null,this.array)},o.title="browser",o.browser=!0,o.env={},o.argv=[],o.version="",o.versions={},o.on=y,o.addListener=y,o.once=y,o.off=y,o.removeListener=y,o.removeAllListeners=y,o.emit=y,o.prependListener=y,o.prependOnceListener=y,o.listeners=function(e){return[]},o.binding=function(e){throw new Error("process.binding is not supported")},o.cwd=function(){return"/"},o.chdir=function(e){throw new Error("process.chdir is not supported")},o.umask=function(){return 0}},{}],60:[function(c,e,u){(function(e,t){var n=c("process/browser.js").nextTick,r=Function.prototype.apply,i=Array.prototype.slice,o={},a=0;function s(e,t){this._id=e,this._clearFn=t}u.setTimeout=function(){return new s(r.call(setTimeout,window,arguments),clearTimeout)},u.setInterval=function(){return new s(r.call(setInterval,window,arguments),clearInterval)},u.clearTimeout=u.clearInterval=function(e){e.close()},s.prototype.unref=s.prototype.ref=function(){},s.prototype.close=function(){this._clearFn.call(window,this._id)},u.enroll=function(e,t){clearTimeout(e._idleTimeoutId),e._idleTimeout=t},u.unenroll=function(e){clearTimeout(e._idleTimeoutId),e._idleTimeout=-1},u._unrefActive=u.active=function(e){clearTimeout(e._idleTimeoutId);var t=e._idleTimeout;0<=t&&(e._idleTimeoutId=setTimeout(function(){e._onTimeout&&e._onTimeout()},t))},u.setImmediate="function"==typeof e?e:function(e){var t=a++,r=!(arguments.length<2)&&i.call(arguments,1);return o[t]=!0,n(function(){o[t]&&(r?e.apply(null,r):e.call(null),u.clearImmediate(t))}),t},u.clearImmediate="function"==typeof t?t:function(e){delete o[e]}}).call(this,c("timers").setImmediate,c("timers").clearImmediate)},{"process/browser.js":59,timers:60}],61:[function(e,t,r){t.exports={name:"iota.lib.js",version:"0.5.1",description:"Javascript Library for IOTA",main:"./lib/iota.js",scripts:{build:"gulp",test:"mocha"},author:{name:"Dominik Schiener (IOTA Foundation)",website:"https://iota.org"},keywords:["iota","tangle","library","browser","javascript","nodejs","API"],license:"MIT",bugs:{url:"https://github.com/iotaledger/iota.lib.js/issues"},repository:{type:"git",url:"https://github.com/iotaledger/iota.lib.js.git"},dependencies:{async:"^2.5.0","bignumber.js":"^4.1.0","crypto-js":"^3.1.9-1",xmlhttprequest:"^1.8.0"},devDependencies:{bower:">=1.8.0",browserify:">=14.1.0",chai:"^4.0.2",del:"^3.0.0",gulp:"^4.0.0","gulp-buffer":"0.0.2","gulp-jshint":"^2.0.2","gulp-sourcemaps":"^2.6.4","gulp-tap":"^1.0.1","gulp-uglify":"^3.0.0",jshint:"^2.9.6",mocha:"^5.2.0"}}},{}]},{},[1]);
//

/**
 * [js-sha256]{@link https://github.com/emn178/js-sha256}
 *
 * @version 0.9.0
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2014-2017
 * @license MIT
 */
!function(){"use strict";function t(t,i){i?(d[0]=d[16]=d[1]=d[2]=d[3]=d[4]=d[5]=d[6]=d[7]=d[8]=d[9]=d[10]=d[11]=d[12]=d[13]=d[14]=d[15]=0,this.blocks=d):this.blocks=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],t?(this.h0=3238371032,this.h1=914150663,this.h2=812702999,this.h3=4144912697,this.h4=4290775857,this.h5=1750603025,this.h6=1694076839,this.h7=3204075428):(this.h0=1779033703,this.h1=3144134277,this.h2=1013904242,this.h3=2773480762,this.h4=1359893119,this.h5=2600822924,this.h6=528734635,this.h7=1541459225),this.block=this.start=this.bytes=this.hBytes=0,this.finalized=this.hashed=!1,this.first=!0,this.is224=t}function i(i,r,s){var e,n=typeof i;if("string"===n){var o,a=[],u=i.length,c=0;for(e=0;e<u;++e)(o=i.charCodeAt(e))<128?a[c++]=o:o<2048?(a[c++]=192|o>>6,a[c++]=128|63&o):o<55296||o>=57344?(a[c++]=224|o>>12,a[c++]=128|o>>6&63,a[c++]=128|63&o):(o=65536+((1023&o)<<10|1023&i.charCodeAt(++e)),a[c++]=240|o>>18,a[c++]=128|o>>12&63,a[c++]=128|o>>6&63,a[c++]=128|63&o);i=a}else{if("object"!==n)throw new Error(h);if(null===i)throw new Error(h);if(f&&i.constructor===ArrayBuffer)i=new Uint8Array(i);else if(!(Array.isArray(i)||f&&ArrayBuffer.isView(i)))throw new Error(h)}i.length>64&&(i=new t(r,!0).update(i).array());var y=[],p=[];for(e=0;e<64;++e){var l=i[e]||0;y[e]=92^l,p[e]=54^l}t.call(this,r,s),this.update(p),this.oKeyPad=y,this.inner=!0,this.sharedMemory=s}var h="input is invalid type",r="object"==typeof window,s=r?window:{};s.JS_SHA256_NO_WINDOW&&(r=!1);var e=!r&&"object"==typeof self,n=!s.JS_SHA256_NO_NODE_JS&&"object"==typeof process&&process.versions&&process.versions.node;n?s=global:e&&(s=self);var o=!s.JS_SHA256_NO_COMMON_JS&&"object"==typeof module&&module.exports,a="function"==typeof define&&define.amd,f=!s.JS_SHA256_NO_ARRAY_BUFFER&&"undefined"!=typeof ArrayBuffer,u="0123456789abcdef".split(""),c=[-2147483648,8388608,32768,128],y=[24,16,8,0],p=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298],l=["hex","array","digest","arrayBuffer"],d=[];!s.JS_SHA256_NO_NODE_JS&&Array.isArray||(Array.isArray=function(t){return"[object Array]"===Object.prototype.toString.call(t)}),!f||!s.JS_SHA256_NO_ARRAY_BUFFER_IS_VIEW&&ArrayBuffer.isView||(ArrayBuffer.isView=function(t){return"object"==typeof t&&t.buffer&&t.buffer.constructor===ArrayBuffer});var A=function(i,h){return function(r){return new t(h,!0).update(r)[i]()}},w=function(i){var h=A("hex",i);n&&(h=b(h,i)),h.create=function(){return new t(i)},h.update=function(t){return h.create().update(t)};for(var r=0;r<l.length;++r){var s=l[r];h[s]=A(s,i)}return h},b=function(t,i){var r=eval("require('crypto')"),s=eval("require('buffer').Buffer"),e=i?"sha224":"sha256",n=function(i){if("string"==typeof i)return r.createHash(e).update(i,"utf8").digest("hex");if(null===i||void 0===i)throw new Error(h);return i.constructor===ArrayBuffer&&(i=new Uint8Array(i)),Array.isArray(i)||ArrayBuffer.isView(i)||i.constructor===s?r.createHash(e).update(new s(i)).digest("hex"):t(i)};return n},v=function(t,h){return function(r,s){return new i(r,h,!0).update(s)[t]()}},_=function(t){var h=v("hex",t);h.create=function(h){return new i(h,t)},h.update=function(t,i){return h.create(t).update(i)};for(var r=0;r<l.length;++r){var s=l[r];h[s]=v(s,t)}return h};t.prototype.update=function(t){if(!this.finalized){var i,r=typeof t;if("string"!==r){if("object"!==r)throw new Error(h);if(null===t)throw new Error(h);if(f&&t.constructor===ArrayBuffer)t=new Uint8Array(t);else if(!(Array.isArray(t)||f&&ArrayBuffer.isView(t)))throw new Error(h);i=!0}for(var s,e,n=0,o=t.length,a=this.blocks;n<o;){if(this.hashed&&(this.hashed=!1,a[0]=this.block,a[16]=a[1]=a[2]=a[3]=a[4]=a[5]=a[6]=a[7]=a[8]=a[9]=a[10]=a[11]=a[12]=a[13]=a[14]=a[15]=0),i)for(e=this.start;n<o&&e<64;++n)a[e>>2]|=t[n]<<y[3&e++];else for(e=this.start;n<o&&e<64;++n)(s=t.charCodeAt(n))<128?a[e>>2]|=s<<y[3&e++]:s<2048?(a[e>>2]|=(192|s>>6)<<y[3&e++],a[e>>2]|=(128|63&s)<<y[3&e++]):s<55296||s>=57344?(a[e>>2]|=(224|s>>12)<<y[3&e++],a[e>>2]|=(128|s>>6&63)<<y[3&e++],a[e>>2]|=(128|63&s)<<y[3&e++]):(s=65536+((1023&s)<<10|1023&t.charCodeAt(++n)),a[e>>2]|=(240|s>>18)<<y[3&e++],a[e>>2]|=(128|s>>12&63)<<y[3&e++],a[e>>2]|=(128|s>>6&63)<<y[3&e++],a[e>>2]|=(128|63&s)<<y[3&e++]);this.lastByteIndex=e,this.bytes+=e-this.start,e>=64?(this.block=a[16],this.start=e-64,this.hash(),this.hashed=!0):this.start=e}return this.bytes>4294967295&&(this.hBytes+=this.bytes/4294967296<<0,this.bytes=this.bytes%4294967296),this}},t.prototype.finalize=function(){if(!this.finalized){this.finalized=!0;var t=this.blocks,i=this.lastByteIndex;t[16]=this.block,t[i>>2]|=c[3&i],this.block=t[16],i>=56&&(this.hashed||this.hash(),t[0]=this.block,t[16]=t[1]=t[2]=t[3]=t[4]=t[5]=t[6]=t[7]=t[8]=t[9]=t[10]=t[11]=t[12]=t[13]=t[14]=t[15]=0),t[14]=this.hBytes<<3|this.bytes>>>29,t[15]=this.bytes<<3,this.hash()}},t.prototype.hash=function(){var t,i,h,r,s,e,n,o,a,f=this.h0,u=this.h1,c=this.h2,y=this.h3,l=this.h4,d=this.h5,A=this.h6,w=this.h7,b=this.blocks;for(t=16;t<64;++t)i=((s=b[t-15])>>>7|s<<25)^(s>>>18|s<<14)^s>>>3,h=((s=b[t-2])>>>17|s<<15)^(s>>>19|s<<13)^s>>>10,b[t]=b[t-16]+i+b[t-7]+h<<0;for(a=u&c,t=0;t<64;t+=4)this.first?(this.is224?(e=300032,w=(s=b[0]-1413257819)-150054599<<0,y=s+24177077<<0):(e=704751109,w=(s=b[0]-210244248)-1521486534<<0,y=s+143694565<<0),this.first=!1):(i=(f>>>2|f<<30)^(f>>>13|f<<19)^(f>>>22|f<<10),r=(e=f&u)^f&c^a,w=y+(s=w+(h=(l>>>6|l<<26)^(l>>>11|l<<21)^(l>>>25|l<<7))+(l&d^~l&A)+p[t]+b[t])<<0,y=s+(i+r)<<0),i=(y>>>2|y<<30)^(y>>>13|y<<19)^(y>>>22|y<<10),r=(n=y&f)^y&u^e,A=c+(s=A+(h=(w>>>6|w<<26)^(w>>>11|w<<21)^(w>>>25|w<<7))+(w&l^~w&d)+p[t+1]+b[t+1])<<0,i=((c=s+(i+r)<<0)>>>2|c<<30)^(c>>>13|c<<19)^(c>>>22|c<<10),r=(o=c&y)^c&f^n,d=u+(s=d+(h=(A>>>6|A<<26)^(A>>>11|A<<21)^(A>>>25|A<<7))+(A&w^~A&l)+p[t+2]+b[t+2])<<0,i=((u=s+(i+r)<<0)>>>2|u<<30)^(u>>>13|u<<19)^(u>>>22|u<<10),r=(a=u&c)^u&y^o,l=f+(s=l+(h=(d>>>6|d<<26)^(d>>>11|d<<21)^(d>>>25|d<<7))+(d&A^~d&w)+p[t+3]+b[t+3])<<0,f=s+(i+r)<<0;this.h0=this.h0+f<<0,this.h1=this.h1+u<<0,this.h2=this.h2+c<<0,this.h3=this.h3+y<<0,this.h4=this.h4+l<<0,this.h5=this.h5+d<<0,this.h6=this.h6+A<<0,this.h7=this.h7+w<<0},t.prototype.hex=function(){this.finalize();var t=this.h0,i=this.h1,h=this.h2,r=this.h3,s=this.h4,e=this.h5,n=this.h6,o=this.h7,a=u[t>>28&15]+u[t>>24&15]+u[t>>20&15]+u[t>>16&15]+u[t>>12&15]+u[t>>8&15]+u[t>>4&15]+u[15&t]+u[i>>28&15]+u[i>>24&15]+u[i>>20&15]+u[i>>16&15]+u[i>>12&15]+u[i>>8&15]+u[i>>4&15]+u[15&i]+u[h>>28&15]+u[h>>24&15]+u[h>>20&15]+u[h>>16&15]+u[h>>12&15]+u[h>>8&15]+u[h>>4&15]+u[15&h]+u[r>>28&15]+u[r>>24&15]+u[r>>20&15]+u[r>>16&15]+u[r>>12&15]+u[r>>8&15]+u[r>>4&15]+u[15&r]+u[s>>28&15]+u[s>>24&15]+u[s>>20&15]+u[s>>16&15]+u[s>>12&15]+u[s>>8&15]+u[s>>4&15]+u[15&s]+u[e>>28&15]+u[e>>24&15]+u[e>>20&15]+u[e>>16&15]+u[e>>12&15]+u[e>>8&15]+u[e>>4&15]+u[15&e]+u[n>>28&15]+u[n>>24&15]+u[n>>20&15]+u[n>>16&15]+u[n>>12&15]+u[n>>8&15]+u[n>>4&15]+u[15&n];return this.is224||(a+=u[o>>28&15]+u[o>>24&15]+u[o>>20&15]+u[o>>16&15]+u[o>>12&15]+u[o>>8&15]+u[o>>4&15]+u[15&o]),a},t.prototype.toString=t.prototype.hex,t.prototype.digest=function(){this.finalize();var t=this.h0,i=this.h1,h=this.h2,r=this.h3,s=this.h4,e=this.h5,n=this.h6,o=this.h7,a=[t>>24&255,t>>16&255,t>>8&255,255&t,i>>24&255,i>>16&255,i>>8&255,255&i,h>>24&255,h>>16&255,h>>8&255,255&h,r>>24&255,r>>16&255,r>>8&255,255&r,s>>24&255,s>>16&255,s>>8&255,255&s,e>>24&255,e>>16&255,e>>8&255,255&e,n>>24&255,n>>16&255,n>>8&255,255&n];return this.is224||a.push(o>>24&255,o>>16&255,o>>8&255,255&o),a},t.prototype.array=t.prototype.digest,t.prototype.arrayBuffer=function(){this.finalize();var t=new ArrayBuffer(this.is224?28:32),i=new DataView(t);return i.setUint32(0,this.h0),i.setUint32(4,this.h1),i.setUint32(8,this.h2),i.setUint32(12,this.h3),i.setUint32(16,this.h4),i.setUint32(20,this.h5),i.setUint32(24,this.h6),this.is224||i.setUint32(28,this.h7),t},i.prototype=new t,i.prototype.finalize=function(){if(t.prototype.finalize.call(this),this.inner){this.inner=!1;var i=this.array();t.call(this,this.is224,this.sharedMemory),this.update(this.oKeyPad),this.update(i),t.prototype.finalize.call(this)}};var B=w();B.sha256=B,B.sha224=w(!0),B.sha256.hmac=_(),B.sha224.hmac=_(!0),o?module.exports=B:(s.sha256=B.sha256,s.sha224=B.sha224,a&&define(function(){return B}))}();
var EPUBJS = EPUBJS || {};
EPUBJS.core = {};

var ELEMENT_NODE = 1;
var TEXT_NODE = 3;
var COMMENT_NODE = 8;
var DOCUMENT_NODE = 9;

//-- Get a element for an id
EPUBJS.core.getEl = function(elem) {
	return document.getElementById(elem);
};

//-- Get all elements for a class
EPUBJS.core.getEls = function(classes) {
	return document.getElementsByClassName(classes);
};

EPUBJS.core.request = function(url, type, withCredentials) {
	var supportsURL = window.URL;
	var BLOB_RESPONSE = supportsURL ? "blob" : "arraybuffer";
	var deferred = new RSVP.defer();
	var xhr = new XMLHttpRequest();
	var uri;

	//-- Check from PDF.js:
	//   https://github.com/mozilla/pdf.js/blob/master/web/compatibility.js
	var xhrPrototype = XMLHttpRequest.prototype;

	var handler = function() {
		var r;

		if (this.readyState != this.DONE) return;

		if ((this.status === 200 || this.status === 0) && this.response) { // Android & Firefox reporting 0 for local & blob urls
			if (type == 'xml'){
                // If this.responseXML wasn't set, try to parse using a DOMParser from text
                if(!this.responseXML) {
                    r = new DOMParser().parseFromString(this.response, "application/xml");
                } else {
                    r = this.responseXML;
                }
			} else if (type == 'xhtml') {
                if (!this.responseXML){
                    r = new DOMParser().parseFromString(this.response, "application/xhtml+xml");
                } else {
                    r = this.responseXML;
                }
			} else if (type == 'html') {
				if (!this.responseXML){
                    r = new DOMParser().parseFromString(this.response, "text/html");
                } else {
                    r = this.responseXML;
                }
			} else if (type == 'json') {
				r = JSON.parse(this.response);
			} else if (type == 'blob') {
				if (supportsURL) {
					r = this.response;
				} else {
					//-- Safari doesn't support responseType blob, so create a blob from arraybuffer
					r = new Blob([this.response]);
				}
			} else {
				r = this.response;
			}

			deferred.resolve(r);
		} else {
			deferred.reject({
				message : this.response,
				stack : new Error().stack
			});
		}
	};

	if (!('overrideMimeType' in xhrPrototype)) {
		// IE10 might have response, but not overrideMimeType
		Object.defineProperty(xhrPrototype, 'overrideMimeType', {
			value: function xmlHttpRequestOverrideMimeType(mimeType) {}
		});
	}

	xhr.onreadystatechange = handler;
	xhr.open("GET", url, true);

	if(withCredentials) {
		xhr.withCredentials = true;
	}

	// If type isn't set, determine it from the file extension
	if(!type) {
		uri = EPUBJS.core.uri(url);
		type = uri.extension;
		type = {
			'htm': 'html'
		}[type] || type;
	}

	if(type == 'blob'){
		xhr.responseType = BLOB_RESPONSE;
	}

	if(type == "json") {
		xhr.setRequestHeader("Accept", "application/json");
	}

	if(type == 'xml') {
		xhr.responseType = "document";
		xhr.overrideMimeType('text/xml'); // for OPF parsing
	}

	if(type == 'xhtml') {
		xhr.responseType = "document";
	}

	if(type == 'html') {
		xhr.responseType = "document";
 	}

	if(type == "binary") {
		xhr.responseType = "arraybuffer";
	}

	xhr.send();

	return deferred.promise;
};

EPUBJS.core.toArray = function(obj) {
	var arr = [];

	for (var member in obj) {
		var newitm;
		if ( obj.hasOwnProperty(member) ) {
			newitm = obj[member];
			newitm.ident = member;
			arr.push(newitm);
		}
	}

	return arr;
};

//-- Parse the different parts of a url, returning a object
EPUBJS.core.uri = function(url){
	var uri = {
				protocol : '',
				host : '',
				path : '',
				origin : '',
				directory : '',
				base : '',
				filename : '',
				extension : '',
				fragment : '',
				href : url
			},
			blob = url.indexOf('blob:'),
			doubleSlash = url.indexOf('://'),
			search = url.indexOf('?'),
			fragment = url.indexOf("#"),
			withoutProtocol,
			dot,
			firstSlash;

	if(blob === 0) {
		uri.protocol = "blob";
		uri.base = url.indexOf(0, fragment);
		return uri;
	}

	if(fragment != -1) {
		uri.fragment = url.slice(fragment + 1);
		url = url.slice(0, fragment);
	}

	if(search != -1) {
		uri.search = url.slice(search + 1);
		url = url.slice(0, search);
		href = uri.href;
	}

	if(doubleSlash != -1) {
		uri.protocol = url.slice(0, doubleSlash);
		withoutProtocol = url.slice(doubleSlash+3);
		firstSlash = withoutProtocol.indexOf('/');

		if(firstSlash === -1) {
			uri.host = uri.path;
			uri.path = "";
		} else {
			uri.host = withoutProtocol.slice(0, firstSlash);
			uri.path = withoutProtocol.slice(firstSlash);
		}


		uri.origin = uri.protocol + "://" + uri.host;

		uri.directory = EPUBJS.core.folder(uri.path);

		uri.base = uri.origin + uri.directory;
		// return origin;
	} else {
		uri.path = url;
		uri.directory = EPUBJS.core.folder(url);
		uri.base = uri.directory;
	}

	//-- Filename
	uri.filename = url.replace(uri.base, '');
	dot = uri.filename.lastIndexOf('.');
	if(dot != -1) {
		uri.extension = uri.filename.slice(dot+1);
	}
	return uri;
};

//-- Parse out the folder, will return everything before the last slash

EPUBJS.core.folder = function(url){

	var lastSlash = url.lastIndexOf('/');

	if(lastSlash == -1) var folder = '';

	folder = url.slice(0, lastSlash + 1);

	return folder;

};

//-- https://github.com/ebidel/filer.js/blob/master/src/filer.js#L128
EPUBJS.core.dataURLToBlob = function(dataURL) {
	var BASE64_MARKER = ';base64,',
		parts, contentType, raw, rawLength, uInt8Array;

	if (dataURL.indexOf(BASE64_MARKER) == -1) {
		parts = dataURL.split(',');
		contentType = parts[0].split(':')[1];
		raw = parts[1];

		return new Blob([raw], {type: contentType});
	}

	parts = dataURL.split(BASE64_MARKER);
	contentType = parts[0].split(':')[1];
	raw = window.atob(parts[1]);
	rawLength = raw.length;

	uInt8Array = new Uint8Array(rawLength);

	for (var i = 0; i < rawLength; ++i) {
		uInt8Array[i] = raw.charCodeAt(i);
	}

	return new Blob([uInt8Array], {type: contentType});
};

//-- Load scripts async: http://stackoverflow.com/questions/7718935/load-scripts-asynchronously
EPUBJS.core.addScript = function(src, callback, target) {
	var s, r;
	r = false;
	s = document.createElement('script');
	s.type = 'text/javascript';
	s.async = false;
	s.src = src;
	s.onload = s.onreadystatechange = function() {
		if ( !r && (!this.readyState || this.readyState == 'complete') ) {
			r = true;
			if(callback) callback();
		}
	};
	target = target || document.body;
	target.appendChild(s);
};

EPUBJS.core.addScripts = function(srcArr, callback, target) {
	var total = srcArr.length,
		curr = 0,
		cb = function(){
			curr++;
			if(total == curr){
				if(callback) callback();
			}else{
				EPUBJS.core.addScript(srcArr[curr], cb, target);
			}
		};

	EPUBJS.core.addScript(srcArr[curr], cb, target);
};

EPUBJS.core.addCss = function(src, callback, target) {
	var s, r;
	r = false;
	s = document.createElement('link');
	s.type = 'text/css';
	s.rel = "stylesheet";
	s.href = src;
	s.onload = s.onreadystatechange = function() {
		if ( !r && (!this.readyState || this.readyState == 'complete') ) {
			r = true;
			if(callback) callback();
		}
	};
	target = target || document.body;
	target.appendChild(s);
};

EPUBJS.core.prefixed = function(unprefixed) {
	var vendors = ["Webkit", "Moz", "O", "ms" ],
		prefixes = ['-Webkit-', '-moz-', '-o-', '-ms-'],
		upper = unprefixed[0].toUpperCase() + unprefixed.slice(1),
		length = vendors.length;

	if (typeof(document.documentElement.style[unprefixed]) != 'undefined') {
		return unprefixed;
	}

	for ( var i=0; i < length; i++ ) {
		if (typeof(document.documentElement.style[vendors[i] + upper]) != 'undefined') {
			return vendors[i] + upper;
		}
	}

	return unprefixed;
};

EPUBJS.core.resolveUrl = function(base, path) {
	var url,
		segments = [],
		uri = EPUBJS.core.uri(path),
		folders = base.split("/"),
		paths;

	if(uri.host) {
		return path;
	}

	folders.pop();

	paths = path.split("/");
	paths.forEach(function(p){
		if(p === ".."){
			folders.pop();
		}else{
			segments.push(p);
		}
	});

	url = folders.concat(segments);

	return url.join("/");
};

// http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
EPUBJS.core.uuid = function() {
	var d = new Date().getTime();
	var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = (d + Math.random()*16)%16 | 0;
			d = Math.floor(d/16);
			return (c=='x' ? r : (r&0x7|0x8)).toString(16);
	});
	return uuid;
};

// Fast quicksort insert for sorted array -- based on:
// http://stackoverflow.com/questions/1344500/efficient-way-to-insert-a-number-into-a-sorted-array-of-numbers
EPUBJS.core.insert = function(item, array, compareFunction) {
	var location = EPUBJS.core.locationOf(item, array, compareFunction);
	array.splice(location, 0, item);

	return location;
};

EPUBJS.core.locationOf = function(item, array, compareFunction, _start, _end) {
	var start = _start || 0;
	var end = _end || array.length;
	var pivot = parseInt(start + (end - start) / 2);
	var compared;
	if(!compareFunction){
		compareFunction = function(a, b) {
			if(a > b) return 1;
			if(a < b) return -1;
			if(a = b) return 0;
		};
	}
	if(end-start <= 0) {
		return pivot;
	}

	compared = compareFunction(array[pivot], item);
	if(end-start === 1) {
		return compared > 0 ? pivot : pivot + 1;
	}

	if(compared === 0) {
		return pivot;
	}
	if(compared === -1) {
		return EPUBJS.core.locationOf(item, array, compareFunction, pivot, end);
	} else{
		return EPUBJS.core.locationOf(item, array, compareFunction, start, pivot);
	}
};

EPUBJS.core.indexOfSorted = function(item, array, compareFunction, _start, _end) {
	var start = _start || 0;
	var end = _end || array.length;
	var pivot = parseInt(start + (end - start) / 2);
	var compared;
	if(!compareFunction){
		compareFunction = function(a, b) {
			if(a > b) return 1;
			if(a < b) return -1;
			if(a = b) return 0;
		};
	}
	if(end-start <= 0) {
		return -1; // Not found
	}

	compared = compareFunction(array[pivot], item);
	if(end-start === 1) {
		return compared === 0 ? pivot : -1;
	}
	if(compared === 0) {
		return pivot; // Found
	}
	if(compared === -1) {
		return EPUBJS.core.indexOfSorted(item, array, compareFunction, pivot, end);
	} else{
		return EPUBJS.core.indexOfSorted(item, array, compareFunction, start, pivot);
	}
};


EPUBJS.core.queue = function(_scope){
	var _q = [];
	var scope = _scope;
	// Add an item to the queue
	var enqueue = function(funcName, args, context) {
		_q.push({
			"funcName" : funcName,
			"args"     : args,
			"context"  : context
		});
		return _q;
	};
	// Run one item
	var dequeue = function(){
		var inwait;
		if(_q.length) {
			inwait = _q.shift();
			// Defer to any current tasks
			// setTimeout(function(){
			scope[inwait.funcName].apply(inwait.context || scope, inwait.args);
			// }, 0);
		}
	};

	// Run All
	var flush = function(){
		while(_q.length) {
			dequeue();
		}
	};
	// Clear all items in wait
	var clear = function(){
		_q = [];
	};

	var length = function(){
		return _q.length;
	};

	return {
		"enqueue" : enqueue,
		"dequeue" : dequeue,
		"flush" : flush,
		"clear" : clear,
		"length" : length
	};
};

// From: https://code.google.com/p/fbug/source/browse/branches/firebug1.10/content/firebug/lib/xpath.js
/**
 * Gets an XPath for an element which describes its hierarchical location.
 */
EPUBJS.core.getElementXPath = function(element) {
	if (element && element.id) {
		return '//*[@id="' + element.id + '"]';
	} else {
		return EPUBJS.core.getElementTreeXPath(element);
	}
};

EPUBJS.core.getElementTreeXPath = function(element) {
	var paths = [];
	var 	isXhtml = (element.ownerDocument.documentElement.getAttribute('xmlns') === "http://www.w3.org/1999/xhtml");
	var index, nodeName, tagName, pathIndex;

	if(element.nodeType === Node.TEXT_NODE){
		// index = Array.prototype.indexOf.call(element.parentNode.childNodes, element) + 1;
		index = EPUBJS.core.indexOfTextNode(element) + 1;

		paths.push("text()["+index+"]");
		element = element.parentNode;
	}

	// Use nodeName (instead of localName) so namespace prefix is included (if any).
	for (; element && element.nodeType == 1; element = element.parentNode)
	{
		index = 0;
		for (var sibling = element.previousSibling; sibling; sibling = sibling.previousSibling)
		{
			// Ignore document type declaration.
			if (sibling.nodeType == Node.DOCUMENT_TYPE_NODE) {
				continue;
			}
			if (sibling.nodeName == element.nodeName) {
				++index;
			}
		}
		nodeName = element.nodeName.toLowerCase();
		tagName = (isXhtml ? "xhtml:" + nodeName : nodeName);
		pathIndex = (index ? "[" + (index+1) + "]" : "");
		paths.splice(0, 0, tagName + pathIndex);
	}

	return paths.length ? "./" + paths.join("/") : null;
};

EPUBJS.core.nsResolver = function(prefix) {
	var ns = {
		'xhtml' : 'http://www.w3.org/1999/xhtml',
		'epub': 'http://www.idpf.org/2007/ops'
	};
	return ns[prefix] || null;
};

//https://stackoverflow.com/questions/13482352/xquery-looking-for-text-with-single-quote/13483496#13483496
EPUBJS.core.cleanStringForXpath = function(str)  {
		var parts = str.match(/[^'"]+|['"]/g);
		parts = parts.map(function(part){
				if (part === "'")  {
						return '\"\'\"'; // output "'"
				}

				if (part === '"') {
						return "\'\"\'"; // output '"'
				}
				return "\'" + part + "\'";
		});
		return "concat(\'\'," + parts.join(",") + ")";
};

EPUBJS.core.indexOfTextNode = function(textNode){
	var parent = textNode.parentNode;
	var children = parent.childNodes;
	var sib;
	var index = -1;
	for (var i = 0; i < children.length; i++) {
		sib = children[i];
		if(sib.nodeType === Node.TEXT_NODE){
			index++;
		}
		if(sib == textNode) break;
	}

	return index;
};

// Underscore
EPUBJS.core.defaults = function(obj) {
  for (var i = 1, length = arguments.length; i < length; i++) {
    var source = arguments[i];
    for (var prop in source) {
      if (obj[prop] === void 0) obj[prop] = source[prop];
    }
  }
  return obj;
};

EPUBJS.core.extend = function(target) {
    var sources = [].slice.call(arguments, 1);
    sources.forEach(function (source) {
      if(!source) return;
      Object.getOwnPropertyNames(source).forEach(function(propName) {
        Object.defineProperty(target, propName, Object.getOwnPropertyDescriptor(source, propName));
      });
    });
    return target;
};

EPUBJS.core.clone = function(obj) {
  return EPUBJS.core.isArray(obj) ? obj.slice() : EPUBJS.core.extend({}, obj);
};

EPUBJS.core.isElement = function(obj) {
    return !!(obj && obj.nodeType == 1);
};

EPUBJS.core.isNumber = function(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
};

EPUBJS.core.isString = function(str) {
  return (typeof str === 'string' || str instanceof String);
};

EPUBJS.core.isArray = Array.isArray || function(obj) {
  return Object.prototype.toString.call(obj) === '[object Array]';
};

// Lodash
EPUBJS.core.values = function(object) {
	var index = -1;
	var props, length, result;

	if(!object) return [];

  props = Object.keys(object);
  length = props.length;
  result = Array(length);

  while (++index < length) {
    result[index] = object[props[index]];
  }
  return result;
};

EPUBJS.core.indexOfNode = function(node, typeId) {
	var parent = node.parentNode;
	var children = parent.childNodes;
	var sib;
	var index = -1;
	for (var i = 0; i < children.length; i++) {
		sib = children[i];
		if (sib.nodeType === typeId) {
			index++;
		}
		if (sib == node) break;
	}

	return index;
}

EPUBJS.core.indexOfTextNode = function(textNode) {
	return EPUBJS.core.indexOfNode(textNode, TEXT_NODE);
}

EPUBJS.core.indexOfElementNode = function(elementNode) {
	return EPUBJS.core.indexOfNode(elementNode, ELEMENT_NODE);
}

// Require the use of IOTA library
const iota = new IOTA({ provider: 'https://nodes.iota.fm:443' })

const tryteAlphabet = '9ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function rtrim(char, str) {
    if (str.slice(str.length - char.length) === char) {
      return rtrim(char, str.slice(0, 0 - char.length));
    } else {
      return str;
    }
}

function get_rating(book_addr, callback) {

    iota.api.findTransactionObjects( { addresses: [book_addr]}, function(error,success) { 
        if(error) { 
            console.log(error);
            return; 
        }
        //console.log(success)

        var rating = {
            "5" : 0,
            "4" : 0,
            "3" : 0,
            "2" : 0,
            "1" : 0,
            "total" : success.length,
            "avg" : 0
        };

        tmp = ''
        var sum = 0;
        for (var x = 0; x < success.length; x++) {
            tmp = success[x].signatureMessageFragment;

            tmp = rtrim('9', tmp);
            var res = iota.utils.fromTrytes(tmp);
            console.log(res);

            res = JSON.parse(res);
            rating[res["rating"]] += 1;
            sum += parseInt(res["rating"]);
            console.log(sum)
        }

        var avg = sum / success.length;
        rating["avg"] = avg;

        callback(rating);
    });
}

function push_rating(book_addr, rating) {
    const message = iota.utils.toTrytes(rating)

    console.log(rating);

    const transfers = [
        {
          value: 0,
          address: book_addr,
          message: message//,tag: tag
        }
      ]
      
      iota.api.sendTransfer(book_addr, 3, 14, transfers, (error, success) => {
        if (error) {
          console.log(error)
        } else {
          console.log(success)
        }
      })
}

function hashCreate(str)
{ 
    str = sha256(str);
    str = str.toUpperCase();
    //console.log(str);

    for(var i=0 ; i<65 ; i++)
    {
        if(str[i] == '0')
            str = str.substr(0,i) + 'G' + str.substr(i+1);
        if(str[i] == '1')
            str = str.substr(0,i) + 'H' + str.substr(i+1);
        if(str[i] == '2')
            str = str.substr(0,i) + 'I' + str.substr(i+1);
        if(str[i] == '3')
            str = str.substr(0,i) + 'J' + str.substr(i+1);
        if(str[i] == '4')
            str = str.substr(0,i) + 'K' + str.substr(i+1);
        if(str[i] == '5')
            str = str.substr(0,i) + 'L' + str.substr(i+1);
        if(str[i] == '6')
            str = str.substr(0,i) + 'M' + str.substr(i+1);
        if(str[i] == '7')
            str = str.substr(0,i) + 'N' + str.substr(i+1);
        if(str[i] == '8')
            str = str.substr(0,i) + 'O' + str.substr(i+1);

    }

    str= str + '99999999999999999';
    return str;
};
var EPUBJS = EPUBJS || {};
EPUBJS.reader = {};
EPUBJS.reader.plugins = {}; //-- Attach extra Controllers as plugins (like search?)

(function(root, $) {

	var previousReader = root.ePubReader || {};

	var ePubReader = root.ePubReader = function(path, options) {
		return new EPUBJS.Reader(path, options);
	};

	//exports to multiple environments
	if (typeof define === 'function' && define.amd) {
		//AMD
		define(function(){ return Reader; });
	} else if (typeof module != "undefined" && module.exports) {
		//Node
		module.exports = ePubReader;
	}

})(window, jQuery);

EPUBJS.Reader = function(bookPath, _options) {
	var reader = this;
	var book;
	var plugin;
	var $viewer = $("#viewer");
	var search = window.location.search;
	var parameters;

	this.settings = EPUBJS.core.defaults(_options || {}, {
		bookPath : bookPath,
		restore : false,
		reload : false,
		bookmarks : undefined,
		annotations : undefined,
		contained : undefined,
		bookKey : undefined,
		styles : undefined,
		sidebarReflow: false,
		generatePagination: false,
		history: true
	});

	// Overide options with search parameters
	if(search) {
		parameters = search.slice(1).split("&");
		parameters.forEach(function(p){
			var split = p.split("=");
			var name = split[0];
			var value = split[1] || '';
			reader.settings[name] = decodeURIComponent(value);
		});
	}

	this.setBookKey(this.settings.bookPath); //-- This could be username + path or any unique string

	if(this.settings.restore && this.isSaved()) {
		this.applySavedSettings();
	}

	this.settings.styles = this.settings.styles || {
		fontSize : "100%"
	};

	this.book = book = new ePub(this.settings.bookPath, this.settings);

	this.offline = false;
	this.sidebarOpen = false;
	if(!this.settings.bookmarks) {
		this.settings.bookmarks = [];
	}

	if(!this.settings.annotations) {
		this.settings.annotations = [];
	}

	if(this.settings.generatePagination) {
		book.generatePagination($viewer.width(), $viewer.height());
	}

	this.rendition = book.renderTo("viewer", {
		ignoreClass: "annotator-hl",
		width: "100%",
		height: "100%"
	});

	if(this.settings.previousLocationCfi) {
		this.displayed = this.rendition.display(this.settings.previousLocationCfi);
	} else {
		this.displayed = this.rendition.display();
	}

	book.ready.then(function () {
		reader.ReaderController = EPUBJS.reader.ReaderController.call(reader, book);
		reader.SettingsController = EPUBJS.reader.SettingsController.call(reader, book);
		reader.ControlsController = EPUBJS.reader.ControlsController.call(reader, book);
		reader.SidebarController = EPUBJS.reader.SidebarController.call(reader, book);
		reader.BookmarksController = EPUBJS.reader.BookmarksController.call(reader, book);
		reader.NotesController = EPUBJS.reader.NotesController.call(reader, book);

		window.addEventListener("hashchange", this.hashChanged.bind(this), false);

		document.addEventListener('keydown', this.adjustFontSize.bind(this), false);

		this.rendition.on("keydown", this.adjustFontSize.bind(this));
		this.rendition.on("keydown", reader.ReaderController.arrowKeys.bind(this));

		this.rendition.on("selected", this.selectedRange.bind(this));
	}.bind(this)).then(function() {
		reader.ReaderController.hideLoader();
	}.bind(this));

	// Call Plugins
	for(plugin in EPUBJS.reader.plugins) {
		if(EPUBJS.reader.plugins.hasOwnProperty(plugin)) {
			reader[plugin] = EPUBJS.reader.plugins[plugin].call(reader, book);
		}
	}

	book.loaded.metadata.then(function(meta) {
		reader.MetaController = EPUBJS.reader.MetaController.call(reader, meta);
	});

	book.loaded.navigation.then(function(navigation) {
		reader.TocController = EPUBJS.reader.TocController.call(reader, navigation);
	});

	window.addEventListener("beforeunload", this.unload.bind(this), false);

	return this;
};

EPUBJS.Reader.prototype.adjustFontSize = function(e) {
	var fontSize;
	var interval = 2;
	var PLUS = 187;
	var MINUS = 189;
	var ZERO = 48;
	var MOD = (e.ctrlKey || e.metaKey );

	if(!this.settings.styles) return;

	if(!this.settings.styles.fontSize) {
		this.settings.styles.fontSize = "100%";
	}

	fontSize = parseInt(this.settings.styles.fontSize.slice(0, -1));

	if(MOD && e.keyCode == PLUS) {
		e.preventDefault();
		this.book.setStyle("fontSize", (fontSize + interval) + "%");

	}

	if(MOD && e.keyCode == MINUS){

		e.preventDefault();
		this.book.setStyle("fontSize", (fontSize - interval) + "%");
	}

	if(MOD && e.keyCode == ZERO){
		e.preventDefault();
		this.book.setStyle("fontSize", "100%");
	}
};

EPUBJS.Reader.prototype.addBookmark = function(cfi) {
	var present = this.isBookmarked(cfi);
	if(present > -1 ) return;

	this.settings.bookmarks.push(cfi);

	this.trigger("reader:bookmarked", cfi);
};

EPUBJS.Reader.prototype.removeBookmark = function(cfi) {
	var bookmark = this.isBookmarked(cfi);
	if( bookmark === -1 ) return;

	this.settings.bookmarks.splice(bookmark, 1);

	this.trigger("reader:unbookmarked", bookmark);
};

EPUBJS.Reader.prototype.isBookmarked = function(cfi) {
	var bookmarks = this.settings.bookmarks;

	return bookmarks.indexOf(cfi);
};

/*
EPUBJS.Reader.prototype.searchBookmarked = function(cfi) {
	var bookmarks = this.settings.bookmarks,
			len = bookmarks.length,
			i;

	for(i = 0; i < len; i++) {
		if (bookmarks[i]['cfi'] === cfi) return i;
	}
	return -1;
};
*/

EPUBJS.Reader.prototype.clearBookmarks = function() {
	this.settings.bookmarks = [];
};

//-- Notes
EPUBJS.Reader.prototype.addNote = function(note) {
	this.settings.annotations.push(note);
};

EPUBJS.Reader.prototype.removeNote = function(note) {
	var index = this.settings.annotations.indexOf(note);
	if( index === -1 ) return;

	delete this.settings.annotations[index];

};

EPUBJS.Reader.prototype.clearNotes = function() {
	this.settings.annotations = [];
};

//-- Settings
EPUBJS.Reader.prototype.setBookKey = function(identifier){
	if(!this.settings.bookKey) {
		this.settings.bookKey = "epubjsreader:" + EPUBJS.VERSION + ":" + window.location.host + ":" + identifier;
	}
	return this.settings.bookKey;
};

//-- Checks if the book setting can be retrieved from localStorage
EPUBJS.Reader.prototype.isSaved = function(bookPath) {
	var storedSettings;

	if(!localStorage) {
		return false;
	}

	storedSettings = localStorage.getItem(this.settings.bookKey);

	if(storedSettings === null) {
		return false;
	} else {
		return true;
	}
};

EPUBJS.Reader.prototype.removeSavedSettings = function() {
	if(!localStorage) {
		return false;
	}

	localStorage.removeItem(this.settings.bookKey);
};

EPUBJS.Reader.prototype.applySavedSettings = function() {
		var stored;

		if(!localStorage) {
			return false;
		}

	try {
		stored = JSON.parse(localStorage.getItem(this.settings.bookKey));
	} catch (e) { // parsing error of localStorage
		return false;
	}

		if(stored) {
			// Merge styles
			if(stored.styles) {
				this.settings.styles = EPUBJS.core.defaults(this.settings.styles || {}, stored.styles);
			}
			// Merge the rest
			this.settings = EPUBJS.core.defaults(this.settings, stored);
			return true;
		} else {
			return false;
		}
};

EPUBJS.Reader.prototype.saveSettings = function(){
	if(this.book) {
		this.settings.previousLocationCfi = this.rendition.currentLocation().start.cfi;
	}

	if(!localStorage) {
		return false;
	}

	localStorage.setItem(this.settings.bookKey, JSON.stringify(this.settings));
};

EPUBJS.Reader.prototype.unload = function(){
	if(this.settings.restore && localStorage) {
		this.saveSettings();
	}
};


EPUBJS.Reader.prototype.hashChanged = function(){
	var hash = window.location.hash.slice(1);
	this.rendition.display(hash);
};

EPUBJS.Reader.prototype.selectedRange = function(cfiRange){
	var cfiFragment = "#"+cfiRange;

	// Update the History Location
	if(this.settings.history &&
			window.location.hash != cfiFragment) {
		// Add CFI fragment to the history
		history.pushState({}, '', cfiFragment);
		this.currentLocationCfi = cfiRange;
	}
};

//-- Enable binding events to reader
RSVP.EventTarget.mixin(EPUBJS.Reader.prototype);

EPUBJS.reader.BookmarksController = function() {
	var reader = this;
	var book = this.book;
	var rendition = this.rendition;

	var $bookmarks = $("#bookmarksView"),
			$list = $bookmarks.find("#bookmarks");

	var docfrag = document.createDocumentFragment();

	var show = function() {
		$bookmarks.show();
	};

	var hide = function() {
		$bookmarks.hide();
	};

	var counter = 0;

	var createBookmarkItem = function(cfi) {
		var listitem = document.createElement("li"),
				link = document.createElement("a");

		listitem.id = "bookmark-"+counter;
		listitem.classList.add('list_item');

		var spineItem = book.spine.get(cfi);
		var tocItem;
		if (spineItem.index in book.navigation.toc) {
			tocItem = book.navigation.toc[spineItem.index];
			link.textContent = tocItem.label;
		} else {
			link.textContent = cfi;
		}

		link.href = cfi;

		link.classList.add('bookmark_link');

		link.addEventListener("click", function(event){
				var cfi = this.getAttribute('href');
				rendition.display(cfi);
				event.preventDefault();
		}, false);

		listitem.appendChild(link);

		counter++;

		return listitem;
	};

	this.settings.bookmarks.forEach(function(cfi) {
		var bookmark = createBookmarkItem(cfi);
		docfrag.appendChild(bookmark);
	});

	$list.append(docfrag);

	this.on("reader:bookmarked", function(cfi) {
		var item = createBookmarkItem(cfi);
		$list.append(item);
	});

	this.on("reader:unbookmarked", function(index) {
		var $item = $("#bookmark-"+index);
		$item.remove();
	});

	return {
		"show" : show,
		"hide" : hide
	};
};

EPUBJS.reader.ControlsController = function(book) {
	var reader = this;
	var rendition = this.rendition;

	var $store = $("#store"),
			$fullscreen = $("#fullscreen"),
			$fullscreenicon = $("#fullscreenicon"),
			$cancelfullscreenicon = $("#cancelfullscreenicon"),
			$slider = $("#slider"),
			$main = $("#main"),
			$sidebar = $("#sidebar"),
			$settings = $("#setting"),
			$bookmark = $("#bookmark");
	/*
	var goOnline = function() {
		reader.offline = false;
		// $store.attr("src", $icon.data("save"));
	};

	var goOffline = function() {
		reader.offline = true;
		// $store.attr("src", $icon.data("saved"));
	};

	var fullscreen = false;

	book.on("book:online", goOnline);
	book.on("book:offline", goOffline);
	*/
	$slider.on("click", function () {
		if(reader.sidebarOpen) {
			reader.SidebarController.hide();
			$slider.addClass("icon-menu");
			$slider.removeClass("icon-right");
		} else {
			reader.SidebarController.show();
			$slider.addClass("icon-right");
			$slider.removeClass("icon-menu");
		}
	});

	if(typeof screenfull !== 'undefined') {
		$fullscreen.on("click", function() {
			screenfull.toggle($('#container')[0]);
		});
		if(screenfull.raw) {
			document.addEventListener(screenfull.raw.fullscreenchange, function() {
					fullscreen = screenfull.isFullscreen;
					if(fullscreen) {
						$fullscreen
							.addClass("icon-resize-small")
							.removeClass("icon-resize-full");
					} else {
						$fullscreen
							.addClass("icon-resize-full")
							.removeClass("icon-resize-small");
					}
			});
		}
	}

	$settings.on("click", function() {
		reader.SettingsController.show();
	});

	$bookmark.on("click", function() {
		var cfi = reader.rendition.currentLocation().start.cfi;
		var bookmarked = reader.isBookmarked(cfi);

		if(bookmarked === -1) { //-- Add bookmark
			reader.addBookmark(cfi);
			$bookmark
				.addClass("icon-bookmark")
				.removeClass("icon-bookmark-empty");
		} else { //-- Remove Bookmark
			reader.removeBookmark(cfi);
			$bookmark
				.removeClass("icon-bookmark")
				.addClass("icon-bookmark-empty");
		}

	});

	rendition.on('relocated', function(location){
		var cfi = location.start.cfi;
		var cfiFragment = "#" + cfi;
		//-- Check if bookmarked
		var bookmarked = reader.isBookmarked(cfi);
		if(bookmarked === -1) { //-- Not bookmarked
			$bookmark
				.removeClass("icon-bookmark")
				.addClass("icon-bookmark-empty");
		} else { //-- Bookmarked
			$bookmark
				.addClass("icon-bookmark")
				.removeClass("icon-bookmark-empty");
		}

		reader.currentLocationCfi = cfi;

		// Update the History Location
		if(reader.settings.history &&
				window.location.hash != cfiFragment) {
			// Add CFI fragment to the history
			history.pushState({}, '', cfiFragment);
		}
	});

	return {

	};
};

EPUBJS.reader.MetaController = function(meta) {
	var title = meta.title,
			author = meta.creator;

	var $title = $("#book-title"),
			$author = $("#chapter-title"),
			$dash = $("#title-seperator");

		document.title = title+" – "+author;

		$title.html(title);
		$author.html(author);
		$dash.show();
};

EPUBJS.reader.NotesController = function() {
	var book = this.book;
	var rendition = this.rendition;
	var reader = this;
	var $notesView = $("#notesView");
	var $notes = $("#notes");
	var $text = $("#note-text");
	var $anchor = $("#note-anchor");
	var annotations = reader.settings.annotations;
	var renderer = book.renderer;
	var popups = [];
	var epubcfi = new ePub.CFI();

	var show = function() {
		$notesView.show();
	};

	var hide = function() {
		$notesView.hide();
	}

	var insertAtPoint = function(e) {
		var range;
		var textNode;
		var offset;
		var doc = book.renderer.doc;
		var cfi;
		var annotation;

		// standard
		if (doc.caretPositionFromPoint) {
			range = doc.caretPositionFromPoint(e.clientX, e.clientY);
			textNode = range.offsetNode;
			offset = range.offset;
		// WebKit
		} else if (doc.caretRangeFromPoint) {
			range = doc.caretRangeFromPoint(e.clientX, e.clientY);
			textNode = range.startContainer;
			offset = range.startOffset;
		}

		if (textNode.nodeType !== 3) {
			for (var i=0; i < textNode.childNodes.length; i++) {
				if (textNode.childNodes[i].nodeType == 3) {
					textNode = textNode.childNodes[i];
					break;
				}
			}
			}

		// Find the end of the sentance
		offset = textNode.textContent.indexOf(".", offset);
		if(offset === -1){
			offset = textNode.length; // Last item
		} else {
			offset += 1; // After the period
		}

		cfi = epubcfi.generateCfiFromTextNode(textNode, offset, book.renderer.currentChapter.cfiBase);

		annotation = {
			annotatedAt: new Date(),
			anchor: cfi,
			body: $text.val()
		}

		// add to list
		reader.addNote(annotation);

		// attach
		addAnnotation(annotation);
		placeMarker(annotation);

		// clear
		$text.val('');
		$anchor.text("Attach");
		$text.prop("disabled", false);

		rendition.off("click", insertAtPoint);

	};

	var addAnnotation = function(annotation){
		var note = document.createElement("li");
		var link = document.createElement("a");

		note.innerHTML = annotation.body;
		// note.setAttribute("ref", annotation.anchor);
		link.innerHTML = " context &#187;";
		link.href = "#"+annotation.anchor;
		link.onclick = function(){
			rendition.display(annotation.anchor);
			return false;
		};

		note.appendChild(link);
		$notes.append(note);

	};

	var placeMarker = function(annotation){
		var doc = book.renderer.doc;
		var marker = document.createElement("span");
		var mark = document.createElement("a");
		marker.classList.add("footnotesuperscript", "reader_generated");

		marker.style.verticalAlign = "super";
		marker.style.fontSize = ".75em";
		// marker.style.position = "relative";
		marker.style.lineHeight = "1em";

		// mark.style.display = "inline-block";
		mark.style.padding = "2px";
		mark.style.backgroundColor = "#fffa96";
		mark.style.borderRadius = "5px";
		mark.style.cursor = "pointer";

		marker.id = "note-"+EPUBJS.core.uuid();
		mark.innerHTML = annotations.indexOf(annotation) + 1 + "[Reader]";

		marker.appendChild(mark);
		epubcfi.addMarker(annotation.anchor, doc, marker);

		markerEvents(marker, annotation.body);
	}

	var markerEvents = function(item, txt){
		var id = item.id;

		var showPop = function(){
			var poppos,
					iheight = renderer.height,
					iwidth = renderer.width,
			 		tip,
					pop,
					maxHeight = 225,
					itemRect,
					left,
					top,
					pos;


			//-- create a popup with endnote inside of it
			if(!popups[id]) {
				popups[id] = document.createElement("div");
				popups[id].setAttribute("class", "popup");

				pop_content = document.createElement("div");

				popups[id].appendChild(pop_content);

				pop_content.innerHTML = txt;
				pop_content.setAttribute("class", "pop_content");

				renderer.render.document.body.appendChild(popups[id]);

				//-- TODO: will these leak memory? - Fred
				popups[id].addEventListener("mouseover", onPop, false);
				popups[id].addEventListener("mouseout", offPop, false);

				//-- Add hide on page change
				rendition.on("locationChanged", hidePop, this);
				rendition.on("locationChanged", offPop, this);
				// chapter.book.on("renderer:chapterDestroy", hidePop, this);
			}

			pop = popups[id];


			//-- get location of item
			itemRect = item.getBoundingClientRect();
			left = itemRect.left;
			top = itemRect.top;

			//-- show the popup
			pop.classList.add("show");

			//-- locations of popup
			popRect = pop.getBoundingClientRect();

			//-- position the popup
			pop.style.left = left - popRect.width / 2 + "px";
			pop.style.top = top + "px";


			//-- Adjust max height
			if(maxHeight > iheight / 2.5) {
				maxHeight = iheight / 2.5;
				pop_content.style.maxHeight = maxHeight + "px";
			}

			//-- switch above / below
			if(popRect.height + top >= iheight - 25) {
				pop.style.top = top - popRect.height  + "px";
				pop.classList.add("above");
			}else{
				pop.classList.remove("above");
			}

			//-- switch left
			if(left - popRect.width <= 0) {
				pop.style.left = left + "px";
				pop.classList.add("left");
			}else{
				pop.classList.remove("left");
			}

			//-- switch right
			if(left + popRect.width / 2 >= iwidth) {
				//-- TEMP MOVE: 300
				pop.style.left = left - 300 + "px";

				popRect = pop.getBoundingClientRect();
				pop.style.left = left - popRect.width + "px";
				//-- switch above / below again
				if(popRect.height + top >= iheight - 25) {
					pop.style.top = top - popRect.height  + "px";
					pop.classList.add("above");
				}else{
					pop.classList.remove("above");
				}

				pop.classList.add("right");
			}else{
				pop.classList.remove("right");
			}

		}

		var onPop = function(){
			popups[id].classList.add("on");
		}

		var offPop = function(){
			popups[id].classList.remove("on");
		}

		var hidePop = function(){
			setTimeout(function(){
				popups[id].classList.remove("show");
			}, 100);
		}

		var openSidebar = function(){
			reader.ReaderController.slideOut();
			show();
		};

		item.addEventListener("mouseover", showPop, false);
		item.addEventListener("mouseout", hidePop, false);
		item.addEventListener("click", openSidebar, false);

	}
	$anchor.on("click", function(e){

		$anchor.text("Cancel");
		$text.prop("disabled", "true");
		// listen for selection
		rendition.on("click", insertAtPoint);

	});

	annotations.forEach(function(note) {
		addAnnotation(note);
	});

	/*
	renderer.registerHook("beforeChapterDisplay", function(callback, renderer){
		var chapter = renderer.currentChapter;
		annotations.forEach(function(note) {
			var cfi = epubcfi.parse(note.anchor);
			if(cfi.spinePos === chapter.spinePos) {
				try {
					placeMarker(note);
				} catch(e) {
					console.log("anchoring failed", note.anchor);
				}
			}
		});
		callback();
	}, true);
	*/

	return {
		"show" : show,
		"hide" : hide
	};
};

function getBookPath()
{
	var query = window.location.href.split('?')[1];
	//query won't be set if ? isn't in the URL
	if(!query) {
		return { };
	}

	var params = query.split('&');

	var pairs = {};
	for(var i = 0, len = params.length; i < len; i++) {
		var pair = params[i].split('=');
		pairs[pair[0]] = pair[1];
		console.log(pair[1])
	}

	var res = pairs['bookPath'].split('#');

	return res[0];
}

EPUBJS.reader.ReaderController = function(book) {
	var $main = $("#main"),
			$divider = $("#divider"),
			$loader = $("#loader"),
			$next = $("#next"),
			$prev = $("#prev"),
			$voting = $("#votingModal"),
			$votingSubmit = $("#votingSubmit"),
			$rate = $("#rate");
	var reader = this;
	var book = this.book;
	var rendition = this.rendition;
	var slideIn = function() {
		var currentPosition = rendition.currentLocation().start.cfi;
		if (reader.settings.sidebarReflow){
			$main.removeClass('single');
			$main.one("transitionend", function(){
				rendition.resize();
			});
		} else {
			$main.removeClass("closed");
		}
	};

	var slideOut = function() {
		var location = rendition.currentLocation();
		if (!location) {
			return;
		}
		var currentPosition = location.start.cfi;
		if (reader.settings.sidebarReflow){
			$main.addClass('single');
			$main.one("transitionend", function(){
				rendition.resize();
			});
		} else {
			$main.addClass("closed");
		}
	};

	var showLoader = function() {
		$loader.show();
		hideDivider();
	};

	var hideLoader = function() {
		$loader.hide();

		//-- If the book is using spreads, show the divider
		// if(book.settings.spreads) {
		// 	showDivider();
		// }
	};

	var showDivider = function() {
		$divider.addClass("show");
	};

	var hideDivider = function() {
		$divider.removeClass("show");
	};

	var keylock = false;

	var arrowKeys = function(e) {
		if(e.keyCode == 37) {

			if(book.package.metadata.direction === "rtl") {
				rendition.next();
			} else {
				rendition.prev();
			}

			$prev.addClass("active");

			keylock = true;
			setTimeout(function(){
				keylock = false;
				$prev.removeClass("active");
			}, 100);

			 e.preventDefault();
		}
		if(e.keyCode == 39) {

			if(book.package.metadata.direction === "rtl") {
				rendition.prev();
			} else {
				rendition.next();
			}

			$next.addClass("active");

			keylock = true;
			setTimeout(function(){
				keylock = false;
				$next.removeClass("active");
			}, 100);

			 e.preventDefault();
		}
	}

	document.addEventListener('keydown', arrowKeys, false);

	$votingSubmit.on("click", function(e) {
		var addr = hashCreate(getBookPath());
		console.log(addr);
		var value = $rate.val();

		if (!value)
		{
			value = 0;
		}

		var rating = {
			"rating" : value
		};
		var rating_json = JSON.stringify(rating);
		
		push_rating(addr, rating_json);

		$voting.removeClass("md-show");
	});

	$next.on("click", function(e) {

		if(book.package.metadata.direction === "rtl") {
			rendition.prev();
		} else {
			rendition.next();
		}

		// var curLocation = rendition.currentLocation();
		// var percent = book.locations.percentageFromCfi(curLocation.start.cfi);
		// console.log("%d", location.length);
		//$voting.addClass("md-show");

		e.preventDefault();
	});

	$prev.on("click", function(e){

		if(book.package.metadata.direction === "rtl") {
			rendition.next();
		} else {
			rendition.prev();
		}

		e.preventDefault();
	});

	rendition.on("layout", function(props){
		if(props.spread === true) {
			showDivider();
		} else {
			hideDivider();
		}
	});

	rendition.on('relocated', function(location) {
		var total = location.end.displayed.total;
		var page = location.end.displayed.page;

		if (page == total - 1)
		{
			console.log("relocated %d", page);
			$voting.addClass("md-show");
		}

		if (location.atStart) {
			$prev.addClass("disabled");
		}

		if (location.atEnd) {
			$next.addClass("disabled");
		}
	});

	return {
		"slideOut" : slideOut,
		"slideIn"  : slideIn,
		"showLoader" : showLoader,
		"hideLoader" : hideLoader,
		"showDivider" : showDivider,
		"hideDivider" : hideDivider,
		"arrowKeys" : arrowKeys
	};
};

EPUBJS.reader.SettingsController = function() {
	var book = this.book;
	var reader = this;
	var $settings = $("#settings-modal"),
			$overlay = $(".overlay");

	var show = function() {
		$settings.addClass("md-show");
	};

	var hide = function() {
		$settings.removeClass("md-show");
	};

	var $sidebarReflowSetting = $('#sidebarReflow');

	$sidebarReflowSetting.on('click', function() {
		reader.settings.sidebarReflow = !reader.settings.sidebarReflow;
	});

	$settings.find(".closer").on("click", function() {
		hide();
	});

	$overlay.on("click", function() {
		hide();
	});

	return {
		"show" : show,
		"hide" : hide
	};
};
EPUBJS.reader.SidebarController = function(book) {
	var reader = this;

	var $sidebar = $("#sidebar"),
			$panels = $("#panels");

	var activePanel = "Toc";

	var changePanelTo = function(viewName) {
		var controllerName = viewName + "Controller";
		
		if(activePanel == viewName || typeof reader[controllerName] === 'undefined' ) return;
		reader[activePanel+ "Controller"].hide();
		reader[controllerName].show();
		activePanel = viewName;

		$panels.find('.active').removeClass("active");
		$panels.find("#show-" + viewName ).addClass("active");
	};
	
	var getActivePanel = function() {
		return activePanel;
	};
	
	var show = function() {
		reader.sidebarOpen = true;
		reader.ReaderController.slideOut();
		$sidebar.addClass("open");
	}

	var hide = function() {
		reader.sidebarOpen = false;
		reader.ReaderController.slideIn();
		$sidebar.removeClass("open");
	}

	$panels.find(".show_view").on("click", function(event) {
		var view = $(this).data("view");

		changePanelTo(view);
		event.preventDefault();
	});

	return {
		'show' : show,
		'hide' : hide,
		'getActivePanel' : getActivePanel,
		'changePanelTo' : changePanelTo
	};
};
EPUBJS.reader.TocController = function(toc) {
	var book = this.book;
	var rendition = this.rendition;

	var $list = $("#tocView"),
			docfrag = document.createDocumentFragment();

	var currentChapter = false;

	var generateTocItems = function(toc, level) {
		var container = document.createElement("ul");

		if(!level) level = 1;

		toc.forEach(function(chapter) {
			var listitem = document.createElement("li"),
					link = document.createElement("a");
					toggle = document.createElement("a");

			var subitems;

			listitem.id = "toc-"+chapter.id;
			listitem.classList.add('list_item');

			link.textContent = chapter.label;
			link.href = chapter.href;

			link.classList.add('toc_link');

			listitem.appendChild(link);

			if(chapter.subitems && chapter.subitems.length > 0) {
				level++;
				subitems = generateTocItems(chapter.subitems, level);
				toggle.classList.add('toc_toggle');

				listitem.insertBefore(toggle, link);
				listitem.appendChild(subitems);
			}


			container.appendChild(listitem);

		});

		return container;
	};

	var onShow = function() {
		$list.show();
	};

	var onHide = function() {
		$list.hide();
	};

	var chapterChange = function(e) {
		var id = e.id,
				$item = $list.find("#toc-"+id),
				$current = $list.find(".currentChapter"),
				$open = $list.find('.openChapter');

		if($item.length){

			if($item != $current && $item.has(currentChapter).length > 0) {
				$current.removeClass("currentChapter");
			}

			$item.addClass("currentChapter");

			// $open.removeClass("openChapter");
			$item.parents('li').addClass("openChapter");
		}
	};

	rendition.on('renderered', chapterChange);

	var tocitems = generateTocItems(toc);

	docfrag.appendChild(tocitems);

	$list.append(docfrag);
	$list.find(".toc_link").on("click", function(event){
			var url = this.getAttribute('href');

			event.preventDefault();

			//-- Provide the Book with the url to show
			//   The Url must be found in the books manifest
			rendition.display(url);

			$list.find(".currentChapter")
					.addClass("openChapter")
					.removeClass("currentChapter");

			$(this).parent('li').addClass("currentChapter");

	});

	$list.find(".toc_toggle").on("click", function(event){
			var $el = $(this).parent('li'),
					open = $el.hasClass("openChapter");

			event.preventDefault();
			if(open){
				$el.removeClass("openChapter");
			} else {
				$el.addClass("openChapter");
			}
	});

	return {
		"show" : onShow,
		"hide" : onHide
	};
};

//# sourceMappingURL=reader.js.map