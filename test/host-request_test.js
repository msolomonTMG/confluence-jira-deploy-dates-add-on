var helper = require('./test_helper');
var assert = require('assert');
var http = require('http');
var express = require('express');
var app = express();
var ac = require('../index');
var request = require('request');
var moment = require('moment');
var qs = require('qs');
var jwt = require('../lib/internal/jwt');
var hostRequest = require('../lib/internal/host-request');
var logger = require('./logger');
var spy = require("sinon").spy;

var addon = {};

describe('Host Request', function () {
    var server;
    var httpClient;

    before(function (done) {
        app.set('env', 'development');
        app.use(express.bodyParser());

        // mock host
        app.get('/confluence/plugins/servlet/oauth/consumer-info', function (req, res) {
            res.set('Content-Type', 'application/xml');
            res.send(200, helper.consumerInfo);
        });

        app.head("/confluence/rest/plugins/1.0/", function (req, res) {
            res.setHeader("upm-token", "123");
            res.send(200);
        });

        // Post request to UPM installer

        app.post("/confluence/rest/plugins/1.0/", function (req, res) {
            request({
                url: helper.addonBaseUrl + '/installed',
                query: {
                    jwt: createJwtToken()
                },
                method: 'POST',
                json: helper.installedPayload
            });
            res.send(200);
        });

        ac.store.register("teststore", function (logger, opts) {
            var store = require("../lib/store/jugglingdb")(logger, opts);
            spy(store, "get");
            spy(store, "set");
            spy(store, "del");
            return store;
        });

        addon = ac(app, {
            config: {
                "development": {
                    store: {
                        adapter: 'teststore',
                        type: "memory"
                    },
                    "hosts": [
                        helper.productBaseUrl
                    ]
                }
            }
        }, logger);
        server = http.createServer(app).listen(helper.addonPort, function () {
            addon.register().then(done);
        });

        var settings = {
            'sharedSecret': helper.installedPayload.sharedSecret,
            'baseUrl': helper.productBaseUrl
        };
        addon.settings.set('clientInfo', settings, helper.installedPayload.clientKey);
        httpClient = hostRequest(addon, { 'user': 'admin' }, helper.installedPayload.clientKey);
    });

    after(function (done) {
        server.close();
        done();
    });

    function createJwtToken() {
        var jwtPayload = {
            "sub": 'admin',
            "iss": helper.installedPayload.clientKey,
            "iat": moment().utc().unix(),
            "exp": moment().utc().add('minutes', 10).unix()
        };

        return jwt.encode(jwtPayload, helper.installedPayload.sharedSecret);
    }

    it('constructs non-null get request', function (done) {
        httpClient.get('/some/path/on/host').then(function(request) {
            assert.ok(request);
            done();
        });
    });

    it('get request has headers', function (done) {
        httpClient.get('/some/path/on/host').then(function(request) {
            assert.ok(request.headers);
            done();
        });
    });

    it('get request has Authorization header', function (done) {
        httpClient.get('/some/path/on/host').then(function(request) {
            assert.ok(request.headers['Authorization']);
            done();
        });
    });

    it('get request has Authorization header starting with "JWT "', function (done) {
        httpClient.get('/some/path/on/host').then(function(request) {
            assert.equal(request.headers['Authorization'].indexOf('JWT '), 0);
            done();
        });
    });

    it('post request has correct url', function (done) {
        var relativeUrl = '/some/path/on/host';
        httpClient.post(relativeUrl).then(function(request) {
            assert.equal(request.href, helper.productBaseUrl + relativeUrl);
            done();
        });
    });

    it('post request preserves custom header', function (done) {
        httpClient.post({
            'url': '/some/path',
            'headers': {
                'custom_header': 'arbitrary value'
            }
        }).then(function(request) {
            assert.equal(request.headers['custom_header'], 'arbitrary value');
            done();
        });
    });

    it('post request with form sets form data', function (done) {
        httpClient.post({
            'url': '/some/path',
            file: [
                'file content', {
                    filename: 'filename',
                    ContentType: 'text/plain'
                }
            ]
        }).then(function(request) {
                assert.deepEqual(request.file, ["file content",{"filename":"filename","ContentType":"text/plain"}]);
            done();
        });
    });
});