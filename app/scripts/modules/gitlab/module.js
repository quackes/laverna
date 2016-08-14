    /**
 * Copyright (C) 2015 Laverna project Authors.
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/* global define */
define([
    'underscore',
    'backbone.radio',
    'marionette',
    'modules',
    'modules/gitlab/classes/sync'
], function(_, Radio, Marionette, Modules, Sync) {
    'use strict';

    var Gitlab = Modules.module('Gitlab', {});

    /**
     * Initializers & finalizers of the module
     */
    Gitlab.on('start', function() {
        console.info('Gitlab started');
        new Sync();
    });

    Gitlab.on('stop', function() {
    });

    // Add a global module initializer
    Radio.request('init', 'add', 'module', function() {
        Gitlab.start();
    });

    return Gitlab;
});
