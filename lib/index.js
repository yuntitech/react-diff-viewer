"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var React = require("react");
var PropTypes = require("prop-types");
var classnames_1 = require("classnames");
var compute_lines_1 = require("./compute-lines");
exports.DiffMethod = compute_lines_1.DiffMethod;
var styles_1 = require("./styles");
// eslint-disable-next-line @typescript-eslint/no-var-requires
var m = require('memoize-one');
var memoize = m.default || m;
var LineNumberPrefix;
(function (LineNumberPrefix) {
    LineNumberPrefix["LEFT"] = "L";
    LineNumberPrefix["RIGHT"] = "R";
})(LineNumberPrefix = exports.LineNumberPrefix || (exports.LineNumberPrefix = {}));
var DiffViewer = /** @class */ (function (_super) {
    __extends(DiffViewer, _super);
    function DiffViewer(props) {
        var _this = _super.call(this, props) || this;
        _this.lastAuthorLines = [0];
        _this.blockLineNumberMap = new Map();
        /**
         * Resets code block expand to the initial stage. Will be exposed to the parent component via
         * refs.
         */
        _this.resetCodeBlocks = function () {
            if (_this.state.expandedBlocks.length > 0) {
                _this.setState({
                    expandedBlocks: [],
                });
                return true;
            }
            return false;
        };
        /**
         * Pushes the target expanded code block to the state. During the re-render,
         * this value is used to expand/fold unmodified code.
         */
        _this.onBlockExpand = function (id) {
            var prevState = _this.state.expandedBlocks.slice();
            prevState.push(id);
            _this.setState({
                expandedBlocks: prevState,
            }, function () {
                _this.props.onBlockClick && _this.props.onBlockClick();
            });
        };
        _this.onBlockCollapse = function (id) {
            var expandedBlocks = _this.state.expandedBlocks;
            if (expandedBlocks.length > 0) {
                _this.setState({
                    expandedBlocks: expandedBlocks.filter(function (item) { return item !== id; }),
                }, function () {
                    _this.props.onBlockClick && _this.props.onBlockClick();
                });
            }
        };
        /**
         * Computes final styles for the diff viewer. It combines the default styles with the user
         * supplied overrides. The computed styles are cached with performance in mind.
         *
         * @param styles User supplied style overrides.
         */
        _this.computeStyles = memoize(styles_1.default);
        /**
         * Returns a function with clicked line number in the closure. Returns an no-op function when no
         * onLineNumberClick handler is supplied.
         *
         * @param id Line id of a line.
         */
        _this.onLineNumberClickProxy = function (id) {
            if (_this.props.onLineNumberClick) {
                return function (e) { return _this.props.onLineNumberClick(id, e); };
            }
            return function () { };
        };
        _this.onAuthorClickProxy = function (commitInfo) {
            if (_this.props.onAuthorClick) {
                return function (e) { return _this.props.onAuthorClick(commitInfo, e); };
            }
            return function () {
            };
        };
        /**
         * Maps over the word diff and constructs the required React elements to show word diff.
         *
         * @param diffArray Word diff information derived from line information.
         * @param renderer Optional renderer to format diff words. Useful for syntax highlighting.
         */
        _this.renderWordDiff = function (diffArray, renderer) {
            return diffArray.map(function (wordDiff, i) {
                var _a;
                return (React.createElement("span", { key: i, className: classnames_1.default(_this.styles.wordDiff, (_a = {},
                        _a[_this.styles.wordAdded] = wordDiff.type === compute_lines_1.DiffType.ADDED,
                        _a[_this.styles.wordRemoved] = wordDiff.type === compute_lines_1.DiffType.REMOVED,
                        _a)) }, renderer ? renderer(wordDiff.value) : wordDiff.value));
            });
        };
        /**
         * Maps over the line diff and constructs the required react elements to show line diff. It calls
         * renderWordDiff when encountering word diff. This takes care of both inline and split view line
         * renders.
         *
         * @param lineNumber Line number of the current line.
         * @param type Type of diff of the current line.
         * @param prefix Unique id to prefix with the line numbers.
         * @param value Content of the line. It can be a string or a word diff array.
         * @param additionalLineNumber Additional line number to be shown. Useful for rendering inline
         *  diff view. Right line number will be passed as additionalLineNumber.
         * @param additionalPrefix Similar to prefix but for additional line number.
         */
        _this.renderLine = function (lineNumber, type, prefix, value, additionalLineNumber, additionalPrefix, isRightEmpty, commitMap, authorMinW) {
            var _a, _b, _c, _d;
            var lineNumberTemplate = prefix + "-" + lineNumber;
            var additionalLineNumberTemplate = additionalPrefix + "-" + additionalLineNumber;
            var highlightLine = _this.props.highlightLines.includes(lineNumberTemplate) ||
                _this.props.highlightLines.includes(additionalLineNumberTemplate);
            var added = type === compute_lines_1.DiffType.ADDED;
            var removed = type === compute_lines_1.DiffType.REMOVED;
            var content;
            if (Array.isArray(value)) {
                content = _this.renderWordDiff(value, _this.props.renderContent);
            }
            else if (_this.props.renderContent) {
                content = _this.props.renderContent(value);
            }
            else {
                content = value;
            }
            return (React.createElement(React.Fragment, null,
                !_this.props.hideLineNumbers && (React.createElement("td", { onClick: lineNumber && _this.onLineNumberClickProxy(lineNumberTemplate), className: classnames_1.default(_this.styles.gutter, (_a = {},
                        _a[_this.styles.emptyGutter] = !lineNumber,
                        _a[_this.styles.diffAdded] = added,
                        _a[_this.styles.diffRemoved] = removed,
                        _a[_this.styles.highlightedGutter] = highlightLine,
                        _a)) },
                    React.createElement("pre", { className: _this.styles.lineNumber }, lineNumber))),
                !_this.props.splitView && !_this.props.hideLineNumbers && (React.createElement("td", { onClick: additionalLineNumber &&
                        _this.onLineNumberClickProxy(additionalLineNumberTemplate), className: classnames_1.default(_this.styles.gutter, (_b = {},
                        _b[_this.styles.emptyGutter] = !additionalLineNumber,
                        _b[_this.styles.diffAdded] = added,
                        _b[_this.styles.diffRemoved] = removed,
                        _b[_this.styles.highlightedGutter] = highlightLine,
                        _b)) },
                    React.createElement("pre", { className: _this.styles.lineNumber }, additionalLineNumber))),
                React.createElement("td", { className: classnames_1.default(_this.styles.marker, (_c = {},
                        _c[_this.styles.emptyLine] = !content,
                        _c[_this.styles.diffAdded] = added,
                        _c[_this.styles.diffRemoved] = removed,
                        _c[_this.styles.highlightedLine] = highlightLine,
                        _c)) },
                    React.createElement("pre", null,
                        added && '+',
                        removed && '-')),
                React.createElement("td", { className: classnames_1.default(_this.styles.content, (_d = {},
                        _d[_this.styles.emptyLine] = !content,
                        _d[_this.styles.diffAdded] = added,
                        _d[_this.styles.diffRemoved] = removed,
                        _d[_this.styles.highlightedLine] = highlightLine,
                        _d)) },
                    React.createElement("pre", { className: _this.styles.contentText }, content))));
        };
        _this.renderAuthor = function (props) {
            var lineNumber = props.lineNumber, prefix = props.prefix, added = props.added, removed = props.removed, isRightEmpty = props.isRightEmpty, commitMap = props.commitMap, authorMinW = props.authorMinW;
            var showAuthorOfRight = LineNumberPrefix.RIGHT === prefix && (added || removed);
            var showAuthorOfLeft = LineNumberPrefix.LEFT === prefix && (added || removed) && isRightEmpty;
            if (showAuthorOfRight || showAuthorOfLeft) {
                if (!_this.lastAuthorLines.includes(lineNumber)) {
                    _this.lastAuthorLines.push(lineNumber);
                }
                var index = _this.lastAuthorLines.findIndex(function (item) { return item === lineNumber; });
                if (index) {
                    var prevIndex = Math.max(index - 1, 0);
                    var prevLineNumber = _this.lastAuthorLines[prevIndex];
                    // 连续的改动只显示一个作者信息
                    if (prevLineNumber + 1 === lineNumber) {
                        return React.createElement("pre", { className: _this.styles.lineNumber }, lineNumber);
                    }
                }
                var commitInfo = commitMap != null ? commitMap.get(lineNumber) : null;
                if (commitInfo == null) {
                    return React.createElement("pre", { className: _this.styles.lineNumber }, lineNumber);
                }
                return React.createElement("pre", { className: _this.styles.lineNumber, style: { minWidth: authorMinW || 52 } },
                    React.createElement("span", { onClick: _this.onAuthorClickProxy(commitInfo) }, commitInfo.authorName + " "),
                    lineNumber);
            }
            else {
                return React.createElement("pre", { className: _this.styles.lineNumber }, lineNumber);
            }
        };
        /**
         * Generates lines for split view.
         *
         * @param obj Line diff information.
         * @param obj.left Life diff information for the left pane of the split view.
         * @param obj.right Life diff information for the right pane of the split view.
         * @param index React key for the lines.
         */
        _this.renderSplitView = function (_a, index, commitMap, authorMinW) {
            var left = _a.left, right = _a.right;
            var params = _this.getMarkParams({ left: left, right: right });
            return (React.createElement("tr", __assign({ key: index, className: _this.styles.line }, params),
                _this.renderLine(left.lineNumber, left.type, LineNumberPrefix.LEFT, left.value, undefined, undefined, right.value == null, commitMap, authorMinW),
                _this.renderLine(right.lineNumber, right.type, LineNumberPrefix.RIGHT, right.value, undefined, undefined, undefined, commitMap, authorMinW)));
        };
        _this.getMarkParams = function (lineInformation) {
            var left = lineInformation.left, right = lineInformation.right;
            var params = {};
            if (left.type === compute_lines_1.DiffType.REMOVED) {
                params = { id: "removed", num: left.lineNumber };
            }
            if (right.type === compute_lines_1.DiffType.ADDED) {
                params = { id: "add", num: right.lineNumber };
            }
            return params;
        };
        /**
         * Generates lines for inline view.
         *
         * @param obj Line diff information.
         * @param obj.left Life diff information for the added section of the inline view.
         * @param obj.right Life diff information for the removed section of the inline view.
         * @param index React key for the lines.
         */
        _this.renderInlineView = function (_a, index, commitMap, authorMinW) {
            var left = _a.left, right = _a.right;
            var content;
            if (left.type === compute_lines_1.DiffType.REMOVED && right.type === compute_lines_1.DiffType.ADDED) {
                return (React.createElement(React.Fragment, { key: index },
                    React.createElement("tr", { className: _this.styles.line }, _this.renderLine(left.lineNumber, left.type, LineNumberPrefix.LEFT, left.value, null)),
                    React.createElement("tr", { className: _this.styles.line }, _this.renderLine(null, right.type, LineNumberPrefix.RIGHT, right.value, right.lineNumber))));
            }
            if (left.type === compute_lines_1.DiffType.REMOVED) {
                content = _this.renderLine(left.lineNumber, left.type, LineNumberPrefix.LEFT, left.value, null);
            }
            if (left.type === compute_lines_1.DiffType.DEFAULT) {
                content = _this.renderLine(left.lineNumber, left.type, LineNumberPrefix.LEFT, left.value, right.lineNumber, LineNumberPrefix.RIGHT);
            }
            if (right.type === compute_lines_1.DiffType.ADDED) {
                content = _this.renderLine(null, right.type, LineNumberPrefix.RIGHT, right.value, right.lineNumber);
            }
            var params = _this.getMarkParams({ left: left, right: right });
            return (React.createElement("tr", __assign({ key: index, className: _this.styles.line }, params), content));
        };
        /**
         * Returns a function with clicked block number in the closure.
         *
         * @param id Cold fold block id.
         * @param isExpand
         */
        _this.onBlockClickProxy = function (params) { return function () {
            var isCollapse = params.isCollapse, id = params.id, blockLineNumber = params.blockLineNumber, num = params.num;
            if (isCollapse) {
                _this.onBlockCollapse(id);
                _this.blockLineNumberMap.delete(blockLineNumber);
            }
            else {
                _this.onBlockExpand(id);
                _this.blockLineNumberMap.set(blockLineNumber, num);
            }
        }; };
        /**
         * Generates cold fold block. It also uses the custom message renderer when available to show
         * cold fold messages.
         *
         * @param num Number of skipped lines between two blocks.
         * @param blockNumber Code fold block id.
         * @param leftBlockLineNumber First left line number after the current code fold block.
         * @param rightBlockLineNumber First right line number after the current code fold block.
         * @param showCollapse
         */
        _this.renderSkippedLineIndicator = function (num, blockNumber, leftBlockLineNumber, rightBlockLineNumber, showCollapse) {
            var _a;
            if (showCollapse === void 0) { showCollapse = false; }
            var _b = _this.props, hideLineNumbers = _b.hideLineNumbers, splitView = _b.splitView;
            var operateText = showCollapse ? '折叠' : '展开';
            var collapseStyle = showCollapse ? {
                style: {
                    backgroundColor: 'transparent',
                    color: 'rgba(0,0,0,0.3)',
                    fontSize: 5,
                    height: 5,
                }
            } : {};
            var collapseLineTdStyle = showCollapse ? { style: { backgroundColor: '#f7f7f7' } } : {};
            var message = _this.props.codeFoldMessageRenderer ? (_this.props.codeFoldMessageRenderer(num, leftBlockLineNumber, rightBlockLineNumber)) : (React.createElement("pre", __assign({ className: _this.styles.codeFoldContent }, collapseStyle), operateText + " " + num + " \u884C ..."));
            var content = (React.createElement("td", null,
                React.createElement("a", { onClick: _this.onBlockClickProxy({
                        id: blockNumber,
                        isCollapse: showCollapse,
                        blockLineNumber: rightBlockLineNumber,
                        num: num,
                    }), tabIndex: 0 }, message)));
            var isUnifiedViewWithoutLineNumbers = !splitView && !hideLineNumbers;
            return (React.createElement("tr", __assign({ key: leftBlockLineNumber + "-" + rightBlockLineNumber, className: _this.styles.codeFold }, collapseStyle),
                !hideLineNumbers &&
                    React.createElement("td", __assign({ className: _this.styles.codeFoldGutter }, collapseLineTdStyle)),
                React.createElement("td", { className: classnames_1.default((_a = {},
                        _a[_this.styles.codeFoldGutter] = isUnifiedViewWithoutLineNumbers,
                        _a)) }),
                isUnifiedViewWithoutLineNumbers ? (React.createElement(React.Fragment, null,
                    React.createElement("td", null),
                    content)) : (React.createElement(React.Fragment, null,
                    content,
                    React.createElement("td", __assign({}, collapseLineTdStyle)))),
                React.createElement("td", null),
                React.createElement("td", null)));
        };
        /**
         * Generates the entire diff view.
         */
        _this.renderDiff = function () {
            var _a = _this.props, oldValue = _a.oldValue, newValue = _a.newValue, splitView = _a.splitView, disableWordDiff = _a.disableWordDiff, compareMethod = _a.compareMethod, linesOffset = _a.linesOffset, linesOffsetOfRight = _a.linesOffsetOfRight, commitMap = _a.commitMap;
            var _b = compute_lines_1.computeLineInformation(oldValue, newValue, disableWordDiff, compareMethod, linesOffset, linesOffsetOfRight), lineInformation = _b.lineInformation, diffLines = _b.diffLines;
            // const authorMinW = diffLines[diffLines.length - 1] >= 1000 ? 60 : 52;
            var extraLines = _this.props.extraLinesSurroundingDiff < 0
                ? 0
                : _this.props.extraLinesSurroundingDiff;
            var skippedLines = [];
            return lineInformation.map(function (line, i) {
                var diffBlockStart = diffLines[0];
                var currentPosition = diffBlockStart - i;
                if (_this.props.showDiffOnly) {
                    if (currentPosition === -extraLines) {
                        skippedLines = [];
                        diffLines.shift();
                    }
                    if (line.left.type === compute_lines_1.DiffType.DEFAULT &&
                        (currentPosition > extraLines ||
                            typeof diffBlockStart === 'undefined') &&
                        !_this.state.expandedBlocks.includes(diffBlockStart)) {
                        skippedLines.push(i + 1);
                        if (i === lineInformation.length - 1 && skippedLines.length > 1) {
                            return _this.renderSkippedLineIndicator(skippedLines.length, diffBlockStart, line.left.lineNumber, line.right.lineNumber);
                        }
                        return null;
                    }
                }
                var diffNodes = splitView
                    ? _this.renderSplitView(line, i, commitMap, 0)
                    : _this.renderInlineView(line, i, commitMap, 0);
                var showCollapse = _this.blockLineNumberMap.has(line.right.lineNumber);
                if ((currentPosition === extraLines && skippedLines.length > 0) || showCollapse) {
                    var length_1 = skippedLines.length;
                    skippedLines = [];
                    if (showCollapse) {
                        length_1 = _this.blockLineNumberMap.get(line.right.lineNumber);
                    }
                    return (React.createElement(React.Fragment, { key: i },
                        _this.renderSkippedLineIndicator(length_1, diffBlockStart, line.left.lineNumber, line.right.lineNumber, showCollapse),
                        diffNodes));
                }
                return diffNodes;
            });
        };
        _this.render = function () {
            var _a;
            var _b = _this.props, oldValue = _b.oldValue, newValue = _b.newValue, useDarkTheme = _b.useDarkTheme, leftTitle = _b.leftTitle, rightTitle = _b.rightTitle, splitView = _b.splitView, hideLineNumbers = _b.hideLineNumbers;
            if (typeof oldValue !== 'string' || typeof newValue !== 'string') {
                throw Error('"oldValue" and "newValue" should be strings');
            }
            _this.styles = _this.computeStyles(_this.props.styles, useDarkTheme);
            var nodes = _this.renderDiff();
            var colSpanOnSplitView = hideLineNumbers ? 2 : 3;
            var colSpanOnInlineView = hideLineNumbers ? 2 : 4;
            var title = (leftTitle || rightTitle) && (React.createElement("tr", null,
                React.createElement("td", { colSpan: splitView ? colSpanOnSplitView : colSpanOnInlineView, className: _this.styles.titleBlock },
                    React.createElement("pre", { className: _this.styles.contentText }, leftTitle)),
                splitView && (React.createElement("td", { colSpan: colSpanOnSplitView, className: _this.styles.titleBlock },
                    React.createElement("pre", { className: _this.styles.contentText }, rightTitle)))));
            return (React.createElement("table", { className: classnames_1.default(_this.styles.diffContainer, (_a = {},
                    _a[_this.styles.splitView] = splitView,
                    _a)) },
                React.createElement("tbody", null,
                    title,
                    nodes)));
        };
        _this.state = {
            expandedBlocks: [],
        };
        return _this;
    }
    DiffViewer.defaultProps = {
        oldValue: '',
        newValue: '',
        splitView: true,
        highlightLines: [],
        disableWordDiff: false,
        compareMethod: compute_lines_1.DiffMethod.CHARS,
        styles: {},
        hideLineNumbers: false,
        extraLinesSurroundingDiff: 3,
        showDiffOnly: true,
        useDarkTheme: false,
        linesOffset: 0,
        linesOffsetOfRight: 0,
        commitMap: new Map(),
    };
    DiffViewer.propTypes = {
        oldValue: PropTypes.string.isRequired,
        newValue: PropTypes.string.isRequired,
        splitView: PropTypes.bool,
        disableWordDiff: PropTypes.bool,
        compareMethod: PropTypes.oneOf(Object.values(compute_lines_1.DiffMethod)),
        renderContent: PropTypes.func,
        onLineNumberClick: PropTypes.func,
        onAuthorClick: PropTypes.func,
        extraLinesSurroundingDiff: PropTypes.number,
        styles: PropTypes.object,
        hideLineNumbers: PropTypes.bool,
        showDiffOnly: PropTypes.bool,
        highlightLines: PropTypes.arrayOf(PropTypes.string),
        leftTitle: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
        rightTitle: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
        linesOffset: PropTypes.number,
        linesOffsetOfRight: PropTypes.number,
        onBlockClick: PropTypes.func,
    };
    return DiffViewer;
}(React.Component));
exports.default = DiffViewer;
