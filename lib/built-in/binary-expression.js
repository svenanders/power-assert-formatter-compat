'use strict';

var DiffMatchPatch = require('googlediff'),
    dmp = new DiffMatchPatch(),
    typeName = require('type-name'),
    keys = Object.keys || require('object-keys'),
    syntax = require('estraverse').Syntax;


function BinaryExpressionRenderer(traversal, config) {
    this.config = config;
    this.stringify = config.stringify;
    this.espathToPair = {};
    var _this = this;
    traversal.on('esnode', function (esNode) {
        var pair;
        if (!esNode.isCaptured()) {
            if (isTargetBinaryExpression(esNode.getParent()) && esNode.currentNode.type === syntax.Literal) {
                _this.espathToPair[esNode.parentEspath][esNode.currentProp] = {code: esNode.code(), value: esNode.value()};
            }
            return;
        }
        if (isTargetBinaryExpression(esNode.getParent())) {
            _this.espathToPair[esNode.parentEspath][esNode.currentProp] = {code: esNode.code(), value: esNode.value()};
        }
        if (isTargetBinaryExpression(esNode)) {
            pair = {
                operator: esNode.currentNode.operator,
                value: esNode.value()
            };
            _this.espathToPair[esNode.espath] = pair;
        }
    });
    traversal.on('render', function (writer) {
        var pairs = [];
        keys(_this.espathToPair).forEach(function (espath) {
            var pair = _this.espathToPair[espath];
            if (pair.left && pair.right) {
                pairs.push(pair);
            }
        });
        pairs.forEach(function (pair) {
            _this.compare(pair, writer);
        });
    });
}

BinaryExpressionRenderer.prototype.compare = function (pair, writer) {
    if (isStringDiffTarget(pair)) {
        this.showStringDiff(pair, writer);
    } else {
        this.showExpectedAndActual(pair, writer);
    }
};

BinaryExpressionRenderer.prototype.showExpectedAndActual = function (pair, writer) {
    writer.write('');
    writer.write('[' + typeName(pair.right.value) + '] ' + pair.right.code);
    writer.write('=> ' + this.stringify(pair.right.value));
    writer.write('[' + typeName(pair.left.value)  + '] ' + pair.left.code);
    writer.write('=> ' + this.stringify(pair.left.value));
};

BinaryExpressionRenderer.prototype.showStringDiff = function (pair, writer) {
    var patch;
    if (this.shouldUseLineLevelDiff(pair.right.value)) {
        patch = udiffLines(pair.right.value, pair.left.value);
    } else {
        patch = udiffChars(pair.right.value, pair.left.value);
    }
    writer.write('');
    writer.write('--- [string] ' + pair.right.code);
    writer.write('+++ [string] ' + pair.left.code);
    writer.write(decodeURIComponent(patch));
};

BinaryExpressionRenderer.prototype.shouldUseLineLevelDiff = function (text) {
    return this.config.lineDiffThreshold < text.split(/\r\n|\r|\n/).length;
};


function isTargetBinaryExpression (esNode) {
    return esNode &&
        esNode.currentNode.type === syntax.BinaryExpression &&
        (esNode.currentNode.operator === '===' || esNode.currentNode.operator === '==') &&
        esNode.isCaptured() &&
        !(esNode.value());
}

function isStringDiffTarget(pair) {
    return typeof pair.left.value === 'string' && typeof pair.right.value === 'string';
}

function udiffLines(text1, text2) {
    /*jshint camelcase: false */
    var a = dmp.diff_linesToChars_(text1, text2),
        diffs = dmp.diff_main(a.chars1, a.chars2, false);
    dmp.diff_charsToLines_(diffs, a.lineArray);
    dmp.diff_cleanupSemantic(diffs);
    return dmp.patch_toText(dmp.patch_make(text1, diffs));
}

function udiffChars (text1, text2) {
    /*jshint camelcase: false */
    var diffs = dmp.diff_main(text1, text2, false);
    dmp.diff_cleanupSemantic(diffs);
    return dmp.patch_toText(dmp.patch_make(text1, diffs));
}

module.exports = BinaryExpressionRenderer;