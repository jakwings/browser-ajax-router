Draft
=====

No time to explain it now. It can be easy or difficult to use.

    var f = function (next) { console.log(1); /*next && next();*/ };
    var g = function (next) { console.log(1); next && next(); };
    var router = new Router({
      '/': {
        on: [f,g,f],
        '(.+)': {
          on: function (s, next) {
            setTimeout(function () {
              console.log(2); next && next();
            }, 1000);
          },
          '(.+)': {
            on: function (s, s, next) { console.log(3); next && next(); }
          }
        },
      }
    }).configure({
      recurse: 'forward',
      async: true,
      on: function () {console.log(Date.now())}
    }).init('/a/b');