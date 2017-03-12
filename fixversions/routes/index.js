'use strict';
module.exports = function (app, addon) {

    var _ = require('lodash');
    var util = require('util');
    var request = require('request');
    var credentials = require('../credentials.json');
    var username = credentials.jira.username;
    var password = credentials.jira.password;

    app.get('/', function (req, res) {
        res.format({
            'text/html': function () {
                res.redirect('/atlassian-connect.json');
            },
            'application/json': function () {
                res.redirect('/atlassian-connect.json');
            }
        });
    });

    var iconPath = 'images/icons/sport/',
            sports = [
                { id: 'nfl', name: 'American Football', icon: iconPath + 'american_football.png'},
                { id: 'baseball', name: 'Baseball', icon: iconPath + 'baseball.png'},
                { id: 'basketball', name: 'Basketball', icon: iconPath + 'basketball.png'},
                { id: 'football', name: 'Football', icon: iconPath + 'football.png'},
                { id: 'golf', name: 'Golf', icon: iconPath + 'golf.png'},
                { id: 'tennis', name: 'Tennis', icon: iconPath + 'tennis.png'}
            ];

    function getFixVersionsByProject(project) {
      return new Promise(function(resolve, reject) {
        var url = `http://${username}:${password}@thrillistmediagroup.atlassian.net/rest/api/2/project/${project}/versions`;

        request({url: url}, function (error, response, body) {
          if(!error) {
            let rawVersions = JSON.parse(body)
            let versions = []
            rawVersions.forEach(version => {
              if (_.has(version, 'userReleaseDate') === false) {
                version.userReleaseDate = 'TBD'
              }
              if (version.released) {
                version.status = "Released"
              } else {
                version.status = "Unreleased"
              }
              versions.push(version)
            })
            return resolve(versions)
          } else {
            return reject(error)
          }
        });
      })
    }

    function getFixVersionById(id) {
      return new Promise(function(resolve, reject) {
        var url = `http://${username}:${password}@thrillistmediagroup.atlassian.net/rest/api/2/version/${id}`;

        request({url: url}, function (error, response, body) {
          if(!error) {
            let version = JSON.parse(body)
            if (_.has(version, 'userReleaseDate') === false) {
              version.userReleaseDate = 'TBD'
            }
            return resolve(version)
          } else {
            return reject(error)
          }
        });
      })
    }

    function renderMacro(req, res) {
        var requestVersion = req.param('sport');
        getFixVersionById(requestVersion).then(version => {
          res.render('macro/macro-view', {
              //versionDate: version
              sport: version
          });
        })
        console.log('PARAMS')
        console.log(req.params)
        console.log('RENDERING MACRO')
        var requestSport = req.param('sport');
        console.log('SPORT SENT BY CONFLUENCE')
        console.log(requestSport)
        var sport = _.find(sports, function (_sport) {
           return requestSport === _sport.id;
        });
        console.log('SPORT FOUND BY US')
        console.log(sport)

        if(!sport) {
           sport = sports[5];
        }

        console.log('SPORT FALLBACK BY US')
        console.log(sport)

        // var requestVersion = req.param('version');
        // var version

        // res.render('macro/macro-view', {
        //     //versionDate: version
        //     sport: sport
        // });
    }

    app.get('/macro', addon.authenticate(), function (req, res) {
        renderMacro(req, res);
    });

    app.get('/macro-page', addon.authenticate(), function (req, res) {
        renderMacro(req, res);
    });

    app.get('/editor', addon.authenticate(), function (req, res) {
        // Rendering a template is easy. `render()` takes two params: name of template and a
        // json object to pass the context in.

        //TODO: make a variable req.param('project')
        getFixVersionsByProject('ADS').then(versions => {
          res.render('macro/macro-editor', {
              baseUrl: res.locals.hostBaseUrl,
              sports: sports,
              versions: versions
          });
        })
    });

    app.get('/dialog', addon.authenticate(), function (req, res) {
        res.render('dialog', {
            baseUrl: res.locals.hostBaseUrl,
            spaceKey: req.param('spaceKey'),
            spaceId: req.param('spaceId')
        });
    });

    app.get('/hello-world', addon.authenticate(), function (req, res) {
        res.render('hello-world', {
            baseUrl: res.locals.hostBaseUrl
        });
    });

    app.get('/conditions/dialog', addon.authenticate(), function (req, res) {
        res.render('conditions/dialog', {
            shouldDisplay: true
        });
    });

};
