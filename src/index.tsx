import * as React from 'react';
import * as PropTypes from 'prop-types';
import cn from 'classnames';

import {
	computeLineInformation,
	LineInformation,
	DiffInformation,
	DiffType,
	DiffMethod,
} from './compute-lines';
import computeStyles, {
	ReactDiffViewerStylesOverride,
	ReactDiffViewerStyles,
} from './styles';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const m = require('memoize-one');

const memoize = m.default || m;

export enum LineNumberPrefix {
	LEFT = 'L',
	RIGHT = 'R',
}

export interface CommitInfo {
	commitUrl:string;
	message:string;
	authorName:string;
	committedDate:string;
}

export interface ReactDiffViewerProps {
	// Commits
	commitMap: Map<number,CommitInfo>;
	// Old value to compare.
	oldValue: string;
	// New value to compare.
	newValue: string;
	// Enable/Disable split view.
	splitView?: boolean;
	// Set line Offset
	linesOffset?: number;
	linesOffsetOfRight?: number;
	// Enable/Disable word diff.
	disableWordDiff?: boolean;
	// JsDiff text diff method from https://github.com/kpdecker/jsdiff/tree/v4.0.1#api
	compareMethod?: DiffMethod;
	// Number of unmodified lines surrounding each line diff.
	extraLinesSurroundingDiff?: number;
	// Show/hide line number.
	hideLineNumbers?: boolean;
	// Show only diff between the two values.
	showDiffOnly?: boolean;
	// Render prop to format final string before displaying them in the UI.
	renderContent?: (source: string) => JSX.Element;
	// Render prop to format code fold message.
	codeFoldMessageRenderer?: (
		totalFoldedLines: number,
		leftStartLineNumber: number,
		rightStartLineNumber: number,
	) => JSX.Element;
	// Event handler for line number click.
	onLineNumberClick?: (
		lineId: string,
		event: React.MouseEvent<HTMLTableCellElement>,
	) => void;
	onAuthorClick?: (
		commitInfo: CommitInfo,
		event: React.MouseEvent<HTMLTableCellElement>,
	) => void;
	// Array of line ids to highlight lines.
	highlightLines?: string[];
	// Style overrides.
	styles?: ReactDiffViewerStylesOverride;
	// Use dark theme.
	useDarkTheme?: boolean;
	// Title for left column
	leftTitle?: string | JSX.Element;
	// Title for left column
	rightTitle?: string | JSX.Element;
	onBlockClick?: () => void;
}

export interface ReactDiffViewerState {
	// Array holding the expanded code folding.
	expandedBlocks?: number[];
}

class DiffViewer extends React.Component<
	ReactDiffViewerProps,
	ReactDiffViewerState
> {
	private styles: ReactDiffViewerStyles;
	private lastAuthorLines:number[] = [0];
    private blockLineNumberMap = new Map<number, number>();

	public static defaultProps: ReactDiffViewerProps = {
		oldValue: '',
		newValue: '',
		splitView: true,
		highlightLines: [],
		disableWordDiff: false,
		compareMethod: DiffMethod.CHARS,
		styles: {},
		hideLineNumbers: false,
		extraLinesSurroundingDiff: 3,
		showDiffOnly: true,
		useDarkTheme: false,
		linesOffset: 0,
		linesOffsetOfRight: 0,
		commitMap: new Map(),
	};

	public static propTypes = {
		oldValue: PropTypes.string.isRequired,
		newValue: PropTypes.string.isRequired,
		splitView: PropTypes.bool,
		disableWordDiff: PropTypes.bool,
		compareMethod: PropTypes.oneOf(Object.values(DiffMethod)),
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

	public constructor(props: ReactDiffViewerProps) {
		super(props);

		this.state = {
			expandedBlocks: [],
		};
	}

	/**
	 * Resets code block expand to the initial stage. Will be exposed to the parent component via
	 * refs.
	 */
	public resetCodeBlocks = (): boolean => {
		if (this.state.expandedBlocks.length > 0) {
			this.setState({
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
	private onBlockExpand = (id: number): void => {
		const prevState = this.state.expandedBlocks.slice();
		prevState.push(id);

		this.setState({
			expandedBlocks: prevState,
		}, () => {
			this.props.onBlockClick && this.props.onBlockClick();
		});
	};

	private onBlockCollapse = (id: number): void => {
		const {expandedBlocks} = this.state;
		if (expandedBlocks.length > 0) {
			this.setState({
				expandedBlocks: expandedBlocks.filter(item => item !== id),
			}, () => {
				this.props.onBlockClick && this.props.onBlockClick();
			});
		}
	};

	/**
	 * Computes final styles for the diff viewer. It combines the default styles with the user
	 * supplied overrides. The computed styles are cached with performance in mind.
	 *
	 * @param styles User supplied style overrides.
	 */
	private computeStyles: (
		styles: ReactDiffViewerStylesOverride,
		useDarkTheme: boolean,
	) => ReactDiffViewerStyles = memoize(computeStyles);

	/**
	 * Returns a function with clicked line number in the closure. Returns an no-op function when no
	 * onLineNumberClick handler is supplied.
	 *
	 * @param id Line id of a line.
	 */
	private onLineNumberClickProxy = (id: string): any => {
		if (this.props.onLineNumberClick) {
			return (e: any): void => this.props.onLineNumberClick(id, e);
		}
		return (): void => {};
	};

	private onAuthorClickProxy = (commitInfo: CommitInfo): any => {
		if (this.props.onAuthorClick) {
			return (e: any): void => this.props.onAuthorClick(commitInfo, e);
		}
		return (): void => {
		};
	};

	/**
	 * Maps over the word diff and constructs the required React elements to show word diff.
	 *
	 * @param diffArray Word diff information derived from line information.
	 * @param renderer Optional renderer to format diff words. Useful for syntax highlighting.
	 */
	private renderWordDiff = (
		diffArray: DiffInformation[],
		renderer?: (chunk: string) => JSX.Element,
	): JSX.Element[] => {
		return diffArray.map(
			(wordDiff, i): JSX.Element => {
				return (
					<span
						key={i}
						className={cn(this.styles.wordDiff, {
							[this.styles.wordAdded]: wordDiff.type === DiffType.ADDED,
							[this.styles.wordRemoved]: wordDiff.type === DiffType.REMOVED,
						})}>
						{renderer ? renderer(wordDiff.value as string) : wordDiff.value}
					</span>
				);
			},
		);
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
	private renderLine = (
		lineNumber: number,
		type: DiffType,
		prefix: LineNumberPrefix,
		value: string | DiffInformation[],
		additionalLineNumber?: number,
		additionalPrefix?: LineNumberPrefix,
		isRightEmpty?: boolean,
		commitMap?: Map<number, CommitInfo>,
		authorMinW?: number,
	): JSX.Element => {
		const lineNumberTemplate = `${prefix}-${lineNumber}`;
		const additionalLineNumberTemplate = `${additionalPrefix}-${additionalLineNumber}`;
		const highlightLine =
			this.props.highlightLines.includes(lineNumberTemplate) ||
			this.props.highlightLines.includes(additionalLineNumberTemplate);
		const added = type === DiffType.ADDED;
		const removed = type === DiffType.REMOVED;
		let content;
		if (Array.isArray(value)) {
			content = this.renderWordDiff(value, this.props.renderContent);
		} else if (this.props.renderContent) {
			content = this.props.renderContent(value);
		} else {
			content = value;
		}

		return (
			<React.Fragment>
				{!this.props.hideLineNumbers && (
					<td
						onClick={
							lineNumber && this.onLineNumberClickProxy(lineNumberTemplate)
						}
						className={cn(this.styles.gutter, {
							[this.styles.emptyGutter]: !lineNumber,
							[this.styles.diffAdded]: added,
							[this.styles.diffRemoved]: removed,
							[this.styles.highlightedGutter]: highlightLine,
						})}>
						<pre className={this.styles.lineNumber}>{lineNumber}</pre>
					</td>
				)}
				{!this.props.splitView && !this.props.hideLineNumbers && (
					<td
						onClick={
							additionalLineNumber &&
							this.onLineNumberClickProxy(additionalLineNumberTemplate)
						}
						className={cn(this.styles.gutter, {
							[this.styles.emptyGutter]: !additionalLineNumber,
							[this.styles.diffAdded]: added,
							[this.styles.diffRemoved]: removed,
							[this.styles.highlightedGutter]: highlightLine,
						})}>
						<pre className={this.styles.lineNumber}>{additionalLineNumber}</pre>
					</td>
				)}
				<td
					className={cn(this.styles.marker, {
						[this.styles.emptyLine]: !content,
						[this.styles.diffAdded]: added,
						[this.styles.diffRemoved]: removed,
						[this.styles.highlightedLine]: highlightLine,
					})}>
					<pre>
						{added && '+'}
						{removed && '-'}
					</pre>
				</td>
				<td
					className={cn(this.styles.content, {
						[this.styles.emptyLine]: !content,
						[this.styles.diffAdded]: added,
						[this.styles.diffRemoved]: removed,
						[this.styles.highlightedLine]: highlightLine,
					})}>
					<pre className={this.styles.contentText}>{content}</pre>
				</td>
			</React.Fragment>
		);
	};

	private renderAuthor = (props: { lineNumber: number, prefix: LineNumberPrefix, added: boolean, removed: boolean, isRightEmpty?: boolean, commitMap?: Map<number, CommitInfo>, authorMinW?: number, }): JSX.Element => {
		const {lineNumber, prefix, added, removed, isRightEmpty, commitMap, authorMinW} = props;
		const showAuthorOfRight = LineNumberPrefix.RIGHT === prefix && (added || removed);
		const showAuthorOfLeft = LineNumberPrefix.LEFT === prefix && (added || removed) && isRightEmpty;
		if (showAuthorOfRight || showAuthorOfLeft) {
			if (!this.lastAuthorLines.includes(lineNumber)) {
				this.lastAuthorLines.push(lineNumber);
			}
			const index = this.lastAuthorLines.findIndex(item => item === lineNumber);
			if (index) {
				const prevIndex = Math.max(index - 1, 0);
				const prevLineNumber = this.lastAuthorLines[prevIndex];
				// 连续的改动只显示一个作者信息
				if (prevLineNumber + 1 === lineNumber) {
					return <pre className={this.styles.lineNumber}>{lineNumber}</pre>;
				}
			}
			const commitInfo = commitMap != null ? commitMap.get(lineNumber) : null;
			if (commitInfo == null) {
				return <pre className={this.styles.lineNumber}>{lineNumber}</pre>;
			}
			return <pre className={this.styles.lineNumber} style={{minWidth: authorMinW || 52}}><span
				onClick={this.onAuthorClickProxy(commitInfo)}>{`${commitInfo.authorName} `}</span>{lineNumber}</pre>;
		} else {
			return <pre className={this.styles.lineNumber}>{lineNumber}</pre>;
		}
	}

	/**
	 * Generates lines for split view.
	 *
	 * @param obj Line diff information.
	 * @param obj.left Life diff information for the left pane of the split view.
	 * @param obj.right Life diff information for the right pane of the split view.
	 * @param index React key for the lines.
	 */
	private renderSplitView = (
		{ left, right }: LineInformation,
		index: number,
		commitMap: Map<number, CommitInfo>,
		authorMinW: number,
	): JSX.Element => {
		const params = this.getMarkParams({left, right});
		return (
			<tr key={index} className={this.styles.line} {...params}>
				{this.renderLine(
					left.lineNumber,
					left.type,
					LineNumberPrefix.LEFT,
					left.value,
					undefined,
					undefined,
					right.value == null,
					commitMap,
					authorMinW,
				)}
				{this.renderLine(
					right.lineNumber,
					right.type,
					LineNumberPrefix.RIGHT,
					right.value,
					undefined,
					undefined,
					undefined,
					commitMap,
					authorMinW,
				)}
			</tr>
		);
	};

	private getMarkParams = (lineInformation: LineInformation) => {
		const {left, right} = lineInformation;
		let params = {};
		if (left.type === DiffType.REMOVED) {
			params = {id: "removed", num: left.lineNumber};
		}
		if (right.type === DiffType.ADDED) {
			params = {id: "add", num: right.lineNumber};
		}
		return params;
	}

	/**
	 * Generates lines for inline view.
	 *
	 * @param obj Line diff information.
	 * @param obj.left Life diff information for the added section of the inline view.
	 * @param obj.right Life diff information for the removed section of the inline view.
	 * @param index React key for the lines.
	 */
	public renderInlineView = (
		{ left, right }: LineInformation,
		index: number,
		commitMap: Map<number, CommitInfo>,
		authorMinW: number,
	): JSX.Element => {
		let content;
		if (left.type === DiffType.REMOVED && right.type === DiffType.ADDED) {
			return (
				<React.Fragment key={index}>
					<tr className={this.styles.line}>
						{this.renderLine(
							left.lineNumber,
							left.type,
							LineNumberPrefix.LEFT,
							left.value,
							null,
						)}
					</tr>
					<tr className={this.styles.line}>
						{this.renderLine(
							null,
							right.type,
							LineNumberPrefix.RIGHT,
							right.value,
							right.lineNumber,
						)}
					</tr>
				</React.Fragment>
			);
		}
		if (left.type === DiffType.REMOVED) {
			content = this.renderLine(
				left.lineNumber,
				left.type,
				LineNumberPrefix.LEFT,
				left.value,
				null,
			);
		}
		if (left.type === DiffType.DEFAULT) {
			content = this.renderLine(
				left.lineNumber,
				left.type,
				LineNumberPrefix.LEFT,
				left.value,
				right.lineNumber,
				LineNumberPrefix.RIGHT,
			);
		}
		if (right.type === DiffType.ADDED) {
			content = this.renderLine(
				null,
				right.type,
				LineNumberPrefix.RIGHT,
				right.value,
				right.lineNumber,
			);
		}
		const params = this.getMarkParams({left, right});
		return (
			<tr key={index} className={this.styles.line} {...params}>
				{content}
			</tr>
		);
	};

	/**
	 * Returns a function with clicked block number in the closure.
	 *
	 * @param id Cold fold block id.
	 * @param isExpand
	 */
	private onBlockClickProxy = (params: { id: number, isCollapse: boolean, blockLineNumber: number, num: number }): any => (): void => {
		const {isCollapse, id, blockLineNumber, num} = params;
		if (isCollapse) {
			this.onBlockCollapse(id);
			this.blockLineNumberMap.delete(blockLineNumber);
		} else {
			this.onBlockExpand(id);
			this.blockLineNumberMap.set(blockLineNumber, num);
		}
	}

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
	private renderSkippedLineIndicator = (
		num: number,
		blockNumber: number,
		leftBlockLineNumber: number,
		rightBlockLineNumber: number,
		showCollapse: boolean = false,
	): JSX.Element => {
		const { hideLineNumbers, splitView } = this.props;
		const operateText = showCollapse ? '折叠' : '展开';
		const collapseStyle = showCollapse ? {
			style: {
				backgroundColor: 'transparent',
				color: 'rgba(0,0,0,0.3)',
				fontSize: 5,
				height: 5,
			}
		} : {};
		const collapseLineTdStyle = showCollapse ? {style: {backgroundColor: '#f7f7f7'}} : {};
		const message = this.props.codeFoldMessageRenderer ? (
			this.props.codeFoldMessageRenderer(
				num,
				leftBlockLineNumber,
				rightBlockLineNumber,
			)
		) : (
			<pre className={this.styles.codeFoldContent} {...collapseStyle}>{`${operateText} ${num} 行 ...`}</pre>
		);
		const content = (
			<td>
				<a onClick={this.onBlockClickProxy({
					id: blockNumber,
					isCollapse: showCollapse,
					blockLineNumber: rightBlockLineNumber,
					num,
				})}
				   tabIndex={0}>
					{message}
				</a>
			</td>
		);
		const isUnifiedViewWithoutLineNumbers = !splitView && !hideLineNumbers;
		return (
			<tr
				key={`${leftBlockLineNumber}-${rightBlockLineNumber}`}
				className={this.styles.codeFold}
				{...collapseStyle}
			>
				{!hideLineNumbers &&
					<td className={this.styles.codeFoldGutter} {...collapseLineTdStyle}/>}
				<td
					className={cn({
						[this.styles.codeFoldGutter]: isUnifiedViewWithoutLineNumbers,
					})}
				/>

				{/* Swap columns only for unified view without line numbers */}
				{isUnifiedViewWithoutLineNumbers ? (
					<React.Fragment>
						<td />
						{content}
					</React.Fragment>
				) : (
					<React.Fragment>
						{content}
						<td {...collapseLineTdStyle}/>
					</React.Fragment>
				)}

				<td />
				<td />
			</tr>
		);
	};

	/**
	 * Generates the entire diff view.
	 */
	private renderDiff = (): JSX.Element[] => {
		const {
			oldValue,
			newValue,
			splitView,
			disableWordDiff,
			compareMethod,
			linesOffset,
			linesOffsetOfRight,
			commitMap,
		} = this.props;
		const { lineInformation, diffLines } = computeLineInformation(
			oldValue,
			newValue,
			disableWordDiff,
			compareMethod,
			linesOffset,
			linesOffsetOfRight,
		);
		// const authorMinW = diffLines[diffLines.length - 1] >= 1000 ? 60 : 52;
		const extraLines =
			this.props.extraLinesSurroundingDiff < 0
			  ? 0
			  : this.props.extraLinesSurroundingDiff;
		let skippedLines: number[] = [];
		return lineInformation.map(
			(line: LineInformation, i: number): JSX.Element => {
				const diffBlockStart = diffLines[0];
				const currentPosition = diffBlockStart - i;
				if (this.props.showDiffOnly) {
					if (currentPosition === -extraLines) {
						skippedLines = [];
						diffLines.shift();
					}
					if (
						line.left.type === DiffType.DEFAULT &&
						(currentPosition > extraLines ||
							typeof diffBlockStart === 'undefined') &&
						!this.state.expandedBlocks.includes(diffBlockStart)
					) {
						skippedLines.push(i + 1);
						if (i === lineInformation.length - 1 && skippedLines.length > 1) {
							return this.renderSkippedLineIndicator(
								skippedLines.length,
								diffBlockStart,
								line.left.lineNumber,
								line.right.lineNumber,
							);
						}
						return null;
					}
				}

				const diffNodes = splitView
					? this.renderSplitView(line, i, commitMap, 0)
					: this.renderInlineView(line, i, commitMap, 0);
				const showCollapse = this.blockLineNumberMap.has(line.right.lineNumber);
				if ((currentPosition === extraLines && skippedLines.length > 0) || showCollapse) {
					let { length } = skippedLines;
					skippedLines = [];
					if (showCollapse) {
						length = this.blockLineNumberMap.get(line.right.lineNumber);
					}
					return (
						<React.Fragment key={i}>
							{this.renderSkippedLineIndicator(
								length,
								diffBlockStart,
								line.left.lineNumber,
								line.right.lineNumber,
								showCollapse,
							)}
							{diffNodes}
						</React.Fragment>
					);
				}
				return diffNodes;
			},
		);
	};

	public render = (): JSX.Element => {
		const {
			oldValue,
			newValue,
			useDarkTheme,
			leftTitle,
			rightTitle,
			splitView,
			hideLineNumbers,
		} = this.props;

		if (typeof oldValue !== 'string' || typeof newValue !== 'string') {
			throw Error('"oldValue" and "newValue" should be strings');
		}

		this.styles = this.computeStyles(this.props.styles, useDarkTheme);
		const nodes = this.renderDiff();
		const colSpanOnSplitView = hideLineNumbers ? 2 : 3;
		const colSpanOnInlineView = hideLineNumbers ? 2 : 4;

		const title = (leftTitle || rightTitle) && (
			<tr>
				<td
					colSpan={splitView ? colSpanOnSplitView : colSpanOnInlineView}
					className={this.styles.titleBlock}>
					<pre className={this.styles.contentText}>{leftTitle}</pre>
				</td>
				{splitView && (
					<td colSpan={colSpanOnSplitView} className={this.styles.titleBlock}>
						<pre className={this.styles.contentText}>{rightTitle}</pre>
					</td>
				)}
			</tr>
		);

		return (
			<table
				className={cn(this.styles.diffContainer, {
					[this.styles.splitView]: splitView,
				})}>
				<tbody>
					{title}
					{nodes}
				</tbody>
			</table>
		);
	};
}

export default DiffViewer;
export { ReactDiffViewerStylesOverride, DiffMethod };
