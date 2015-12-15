'use strict';
const util = require('util');
const net = require('net');

var Hypermedia = function () {
    var self = this;
    self.closed = true;
    self.authenticated = false;
    self._socket = new net.Socket();
    self._socket.on('data', self._onSocketData.bind(self));
};
module.exports = Hypermedia;

//** API Calls
Hypermedia.prototype.authenticate = function (password, clientId) {
    var self = this;

    var request = {
        method: 'authentication',
        server_password: password
    };

    if (clientId) {
        request.client_id = clientId;
    }

    return self._sendRequest(request);
};

Hypermedia.prototype.sendSms = function (number, message, messageId) {
    var self = this;

    var request = {
        number: number,
        msg: message,
        unicode: '3'
    };

    if (messageId) {
        request.msg_id = messageId;
    }

    return self._sendRequest(request);
};

Hypermedia.prototype.registerForIncommingSms = function () {
    var self = this;

    var request = {
        method: 'register_for_incoming_sms'
    };

    return self._sendRequest(request);
};

//** Helper Functions
Hypermedia.prototype.connect = function () {
    var self = this;

    self._socket.connect.apply(self._socket, arguments);
    return self;
};

Hypermedia.prototype.on = function () {
    var self = this;

    self._socket.on.apply(self._socket, arguments);
    return self;
};

Hypermedia.prototype._parseJson = function (str) {
    var self = this;

    try {
        return JSON.parse(str);
    } catch (e) {
        return undefined;
    }
};

Hypermedia.prototype._sendRequest = function (request) {
    return this._socket.write(JSON.stringify(request)+'\r\n');
};

//** Events
Hypermedia.prototype._onSocketData = function (data) {
    var self = this;

    data = data.toString();
    var json = self._parseJson(data);

    if (json !== undefined) {

        if (json.method_reply === 'authentication' && json.reply === 'ok') {
            self.authenticated = true;
            self._socket.emit('authenticated');
        }

        if (json.number && json.reply === 'proceeding') {
            self._socket.emit('sms_proceeding', json);
        }

        if (json.number && json.reply === 'ok') {
            self._socket.emit('sms_ok', json);
        }

        if (json.number && json.reply === 'confirmation') {
            self._socket.emit('sms_confirmation', json);
        }

        if (json.number && json.reply === 'error') {
            self._socket.emit('sms_error', json);
        }

        self._socket.emit('message', json);
    }
};
