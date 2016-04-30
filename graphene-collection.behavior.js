(function(window) {
    'use strict';
    //Define client status var

    //Init document.Graphene object
    window.Graphene = window.Graphene || {};
    window.Graphene._impl = window.Graphene._impl || {};
    window.Graphene.behaviors = window.Graphene.behaviors || {};

    window.Graphene._impl.collection = {

        _getActionName: function(modelName) {
            if (modelName !== null && !!window.Graphene.settings.models[modelName]) {
                return window.Graphene.settings.models[modelName] + '_READ_COLLECTION'
            }
        },

        _getCollectionQuery: function(fingerprint, page) {
            //var url = doc.base.DocAction[0].url;
            var queryComponents = [];
            !!this.search && this.search !== '' ? queryComponents.push('search=' + this.search) : null;
            !!this.sortBy && this.sortBy !== '' ? queryComponents.push('sort_by=' + this.sortBy) : null;
            !!this.sortBy && this.sortBy !== '' ? queryComponents.push('sort_descend=' + (this.sortDescendant ? 1 : 0)) : null;
            !!this.page && this.page !== '' ? queryComponents.push('page_no=' + page) : null;
            !!this.pageSize && this.pageSize !== '' ? queryComponents.push('page_size=' + this.pageSize) : null;
            !!this.queryParams ? queryComponents.push('qParams=' + JSON.stringify(this.queryParams)) : null;

            return {
                fingerprint: fingerprint,
                page:        page,
                pageSize:    this.pageSize,
                url:         this.doc.DocAction[0].url + (queryComponents.length > 0 ? '?' + queryComponents.join('&') : '')
            }
        },

        _onCollectionQueryChange: function(query, status) {
            query = query.base;
            if (status == 'free' && !this._hasChunk(query.fingerprint, query.page)) {
                this._setCollectionStatus('busy');
                this.fetch(query.url)
                    .then(this._onResults.bind(this, query))
                    .catch(this._onError.bind(this, query))
            }
        },

        _onResults: function(query, results) {
            this._commitResults(query, results.Collection);
        },

        _onError: function(query, err) {
            try {
                var error = JSON.parse(err.message);
                if (error.code === 404) {
                    this._commitResults(query, []);
                }
            } catch (e) {
                console.error(err || query);
            }
        },

        _commitResults: function(query, results) {
            var updatedChunks = JSON.parse(JSON.stringify(this._collectionChunks || {}));
            updatedChunks.chunks = updatedChunks.fingerprint === query.fingerprint ? updatedChunks.chunks || {} : {};
            updatedChunks.fingerprint = query.fingerprint;
            updatedChunks.chunks['chunk:' + query.page] = results;
            this.set('_collectionChunks', updatedChunks);

            //status check
            if (results.length === 0 && this.page === 1) {
                this._setCollectionStatus('empty');
            } else if (results.length < this.pageSize) {
                this._setCollectionStatus('completed');
            } else {
                this._setCollectionStatus('free');
            }
        },

        _hasChunk: function(fingerprint, chunk) {
            var tChunk = this._collectionChunks || {chunks: {}};
            return tChunk.fingerprint === fingerprint && tChunk.chunks.hasOwnProperty('chunk:' + chunk)
        },

        _getCollectionResults: function(collectionChunks, continuous) {
            collectionChunks = collectionChunks.base;
            if (continuous) {
                var i = 1;
                var results = [];
                while (collectionChunks.chunks.hasOwnProperty('chunk:' + i)) {
                    results = results.concat(collectionChunks.chunks['chunk:' + i]);
                    i++;
                }
                return results;
            } else {
                return collectionChunks.chunks['p' + this.page];
            }
        },

        _getFingerprint: function(url, search, sortBy, sortDescendant, pageSize, queryParams, refresh) {
            console.log(url + search + sortBy + sortDescendant + pageSize + JSON.stringify(queryParams.base) + refresh);
            return md5(url + search + sortBy + sortDescendant + pageSize + JSON.stringify(queryParams.base) + refresh);
        },

        _checkFingerprint: function(newFingerprint, oldFingerprint) {
            console.log('old fingerprint: ' + oldFingerprint);
            console.log('new fingerprint: ' + newFingerprint);

            //TODO check fingerprints
            if (oldFingerprint !== newFingerprint) {
                this.set('page', 1);
                this._setCollectionStatus('free');
            }
        },

        refresh: function() {
            this.set('_refresh', (this._refresh + 1) % 10);
            console.log(this._refresh);
        },

        observers: [
            '_onCollectionQueryChange(_collectionQuery.*, collectionStatus)',
        ],

        properties: {
            modelName: String,

            //element params
            search:         {type: String, value: ''},
            sortBy:         {type: String, value: null},
            sortDescendant: {type: Boolean, value: false},
            page:           {type: Number, value: 1},
            pageSize:       {type: Number, value: 20},
            queryParams:    {type: Object, value: null},
            continuous:     {type: Boolean, value: false},

            //output properties
            collection:       {
                type:     Array,
                computed: '_getCollectionResults(_collectionChunks.*, continuous)',
                notify:   true,
                readOnly: true
            },
            collectionStatus: {type: String, value: 'free', readOnly: true, notify: true},
            fingerprint:      {
                type:     String,
                computed: '_getFingerprint(doc.DocAction.#0.url, search, sortBy, sortDescendant, pageSize, queryParams.*, _refresh)',
                observer: '_checkFingerprint'
            },

            //private properties ( from graphene doc: doc, docError, ...)
            actionName:        {type: String, computed: '_getActionName(modelName)'},
            _collectionQuery:  {type: Object, computed: '_getCollectionQuery(fingerprint, page)'},
            _collectionChunks: Object,
            _refresh:          {type: Number, value: 0}
        }
    };

    window.Graphene.behaviors.collection = [
        window.Graphene.behaviors.doc,
        window.Graphene._impl.collection
    ]

})(window);
