var util = require('util')
    ,net = require('net');

var AUTHENTICATION = 'authentication'
    ,REGISTER_INCOMING_SMS = 'register_for_incoming_sms'
    ,REGISTER_OUTGOING_SMS = 'register_for_outgoing_sms'
    ,UNREGISTER_INCOMING_SMS = 'unregister_for_incoming_sms'
    ,UNREGISTER_OUTGOING_SMS = 'unregister_for_outgoing_sms';

var Hypermedia = function () {
    var self = this;
    self.closed = true;
    self.authenticated = false;
    self._socket = new net.Socket();
    self._socket.on('data', self._onSocketData.bind(self));
    self._socket.setKeepAlive(true, 10000);
    self._buffer = '';
};
module.exports = Hypermedia;

//** API Calls
Hypermedia.prototype.authenticate = function (password, clientId) {
    var self = this;

    var request = {
        method: AUTHENTICATION,
        server_password: password
    };

    if (clientId) {
        request.client_id = clientId;
    }

    return self._sendRequest(request);
};

Hypermedia.prototype.sendSms = function (number, message, messageId, sendToSim) {
    var self = this;

    var request = {
        number: number,
        msg: message,
        unicode: '3'
    };

    if (messageId) {
        request.msg_id = messageId;
    }

    if (sendToSim) {
        request.send_to_sim = sendToSim;
    }

    return self._sendRequest(request);
};

Hypermedia.prototype.registerForIncomingSms = function () {
    return this._sendRequest({ method: REGISTER_INCOMING_SMS });
};

Hypermedia.prototype.registerForOutgoingSms = function () {
    return this._sendRequest({ method: REGISTER_OUTGOING_SMS });
};

Hypermedia.prototype.unregisterForIncomingSms = function () {
    return this._sendRequest({ method: UNREGISTER_INCOMING_SMS });
};

Hypermedia.prototype.unregisterForOutgoingSms = function () {
    return this._sendRequest({ method: UNREGISTER_OUTGOING_SMS });
};


//** Helper methods
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
        console.log(e);
        console.log(str);
        return undefined;
    }
};

Hypermedia.prototype._sendRequest = function (request) {
    return this._socket.write(JSON.stringify(request)+'\r\n');
};

Hypermedia.prototype._process = function (message) {
    
    var self = this;
    var json = self._parseJson(message);

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

        if (json.notification === 'cdr' && json.direction === 'in') {
            self._socket.emit('cdr_in', json);
        }

        if (json.notification === 'cdr' && json.direction === 'out') {
            if (json.result === 'OK') {
                self._socket.emit('cdr_out_ok', json);
            } else if (json.result.startsWith('Err-')) {
                json.error_no = json.result.substring(4);
                self._socket.emit('cdr_out_error', json);
            } else {
                self._socket.emit('cdr_out', json);
            }
        }

        self._socket.emit('message', json);
    }
};

//** Events
Hypermedia.prototype._onSocketData = function (data) {
    var self = this;

    var prev = 0, next;
    data = data.toString('utf8');
    while ((next = data.indexOf('\n', prev)) > -1) {
        
        self._buffer += data.substring(prev, next);

        self._process(self._buffer);        

        self._buffer = '';
        prev = next + 1;
    }
    self._buffer += data.substring(prev);
};

