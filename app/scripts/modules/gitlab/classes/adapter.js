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
    'q',
    'jquery' // uses jquery for http 
], function(_, Q, $) {
    'use strict';

    var Adapter = {

        init: function(config, profile) {
            this.profile = profile;
            this.config = config;
            this.baseUrl = config.serverUrl + '/api/v3/projects/';

        },

        buildHttpSettings: function( method, path, data) {
            return {
                method: method,
                url: this.baseUrl + encodeURIComponent(this.config.projectId) + path,
                data: data,
                headers: {'PRIVATE-TOKEN' : this.config.apiKey}
            };
        },

        checkAuth: function() {
            var self = this;
            var dfd  = Q.defer();
            $.ajax( this.buildHttpSettings('GET', '', {}))
            .done(function(projectDef) {
                self.config.projectId = projectDef.id;
                dfd.resolve();
            })
            .fail(function() {
                dfd.reject();
            });
            return dfd.promise;
        },

        /**
         * Save a model to Dropbox.
         *
         * @type string type [notes|notebooks|tags]
         * @type object model
         * @type array encryptKeys
         */
        save: function(type, model, encryptKeys) {
            var self = this;
            if (!model.id) {
                return new Q();
            }
            var dfd = Q.defer();

            var saveFn = function(result) {
                var method = !result ? 'POST' : 'PUT';

                if(result.status === 404){
                    method = 'POST';
                } else if(result.status !== 200){
                    dfd.reject(result);
                }

                if (model.encryptedData) {
                    model = _.omit(model, encryptKeys);
                }

                var fileName = self.profile + '/' + type + '/' + model.id + '.json' ;
                var content = JSON.stringify(model);

                $.ajax(
                    self.buildHttpSettings(method, '/repository/files', {
                        'file_path' : fileName,
                        'branch_name' : 'master',
                        'content' : content,
                        'encoding': 'text',
                        'commit_message' : 'Updated ' + type
                    }))
                    .then(function(){
                        dfd.resolve(model);
                    })
                    .fail(function (err) {
                        dfd.reject(err);
                    });
            };

            this.getById(type, model.id)
            .then(saveFn, saveFn);

            return dfd.promise;
        },

        /**
         * Get all models from Dropbox.
         *
         * @type string type [notes|notebooks|tags]
         */
        getAll: function(type) {
            var hash = this.getHash(type) || null,
                self = this;

            return this.readdir(type, {hash: hash})
            .then(function(files) {
                var promises = [];

                _.each(files, function(fileName) {
                    if (fileName.indexOf('.json') !== -1) {
                        promises.push(self.getById(type, fileName));
                    }
                });

                return Q.all(promises);
            });
        },

        /**
         * Get a JSON object by ID from Dropbox.
         *
         * @type string type [notes|notebooks|tags]
         * @type string fileName
         */
        getById: function(type, fileName) {
            var defer = Q.defer();

            // Add a file extension
            if (fileName.search('.json') === -1) {
                fileName += '.json';
            }

            fileName = this.profile + '/' + type + '/' + fileName;

            $.ajax(
                this.buildHttpSettings('GET', '/repository/files', {'file_path' : fileName, 'ref' : 'master'})
            )
            .done(function(result) {
                var contentString = result.encoding == 'base64' ? atob(result.content) : result.content;
                defer.resolve(JSON.parse(contentString));
            })
            .fail(function(err) {
                defer.reject(err);
            });

            return defer.promise;
        },

        /**
         * Get a folder stat from Dropbox.
         *
         * @type string type [notes|notebooks|tags]
         * @type object options
         */
        readdir: function(type, options) {
            var dfd = Q.defer(),
                self  = this;
            options   = options || {};

            $.ajax(this.buildHttpSettings('GET', '/repository/tree', {path : self.profile + '/' + type, 'ref_name' : 'master'}))
            .done(function(list) {
                dfd.resolve(_.map(list, _.property('name')));
            })
                .fail(function(err) {
                     /*
                     * If a folder doesn't exist, probably synchronizing is done
                     * for the first time
                     */
                    if (err.status === 404) {
                        dfd.resolve([]);
                        return;
                    }
                    console.error('GitlabError error', err);
                    dfd.reject(err);
                });

            return dfd.promise;
        },

        /**
         * Update folder hash.
         *
         * @type string type [notes|notebooks|tags]
         */
        updateHash: function(type) {
            return this.readdir(type)
            .then(function(data) {
                if (!data) {
                    return;
                }
                return localStorage.setItem(
                    'gitlab.hash.' + Adapter.profile + '.' + type,
                    JSON.stringify(data)
                );
            });
        },

        /**
         * Get folder hash.
         *
         * @type string type [notes|notebooks|tags]
         */
        getHash: function(type) {
            return localStorage.getItem(
                'gilab.hash.' + this.profile + '.' + type
            );
        },

        /**
         * Get an array of objects which exist on Dropbox.
         *
         * @type string type [notes|notebooks|tags]
         */
        getCache: function(type) {
            var data = localStorage.getItem('gilab.cache.' + this.profile + '/' + type);
            return JSON.parse(data);
        },

        /**
         * Save an array of objects which exist on Gitlab.
         *
         * @type string type [notes|notebooks|tags]
         */
        saveCache: function(type, data) {
            data = _.map(data, function(item) {
                return {id: item.id, updated: item.updated};
            });

            return localStorage.setItem(
                'gilab.cache.' + this.profile + '/' + type,
                JSON.stringify(data)
            );
        }

    };

    return Adapter;
});
