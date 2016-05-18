// Allow webpack to handle less compilation here
require('./index.less');
require('../index.less');

import { basename } from 'path';
import _ from 'lodash';
import React from 'react';
import { render } from 'react-dom';
import {
	IndexRoute,
	Link,
	Route,
	Router,
	useRouterHistory,
} from 'react-router';
import { createHashHistory } from 'history';
import { markdown } from 'markdown';
import docgenMapRaw from './docgen.json';
import { handleHighlightCode, toMarkdown } from './util';

import ColorPalette from './containers/color-palette';
import LandingPage from './containers/landing-page';

import {
	Table,
	VerticalListMenuDumb,
	stateManagement,
} from '../index';

const {
	Thead,
	Tbody,
	Tr,
	Th,
	Td,
} = Table;

function toggleOrSelectReducer(state = {}, i) {
	return {
		...state,
		expandedIndices: _.xor(state.expandedIndices || [], [i]),
	}
}

const VerticalListMenu = stateManagement.buildHybridComponent(VerticalListMenuDumb, {
	reducers: {
		onSelect: toggleOrSelectReducer,
		onToggle: toggleOrSelectReducer,
	}
});

const { Item } = VerticalListMenu;

const hashHistory = useRouterHistory(createHashHistory)({ queryKey: false });

// This is webpackism for "dynamically load all example files"
const reqExamples = require.context('../components/', true, /examples.*\.jsx?/i);
const reqExamplesRaw = require.context('!!raw!../components/', true, /examples.*\.jsx?/i);

const docgenMap = _.mapValues(docgenMapRaw, (value, componentName) => {
	const parentName = value.customData.extend;

	if (!parentName) {
		return value;
	}

	// TODO: this hack only allows for one level of `extend` nesting, we'll need
	// recursion to go deeper.
	const parentExtend = _.get(docgenMapRaw, `${parentName}.customData.extend`);
	const parentProps = _.get(docgenMapRaw, `${parentExtend || parentName}.props`);

	if (!parentProps) {
		throw new Error(`Looks like something is wrong with the custom metadata for ${componentName}. Please make sure the 'extend' refers to a real component that has valid props defined.`);
	}

	// The `clone` is important to keep from mutating `value`
	return _.defaultsDeep(_.clone(value), { props: parentProps });
});

/**
 * Transforms an example filename to an example title. Remove leading numbers and
 * file extensions then capitalizes each word and separates each with a space.
 */
function getExampleTitleFromFilename (filename) {
	const words = _.words(_.startCase(basename(filename, '.jsx')));
	return (/^\d+$/.test(_.head(words)) ? _.tail(words) : words).join(' ');
}

const examplesByComponent = _.chain(reqExamples.keys())
	.map((path) => {
		const items = path.split('/').reverse(); // e.g. ['default.jsx', 'examples', 'Button', '.']
		const componentName = items[2];
		return {
			componentName: componentName,
			name: getExampleTitleFromFilename(items[0]),
			source: reqExamplesRaw(path),
			Example: reqExamples(path).default // `default` because we use es6 modules in the examples
		};
	})
	.groupBy('componentName')
	.value();

const {
	PropTypes: {
		oneOfType,
		shape,
		object,
		array,
		string,
		node,
		any,
		bool,
		}
	} = React;

const PropType = React.createClass({
	propTypes: {
		componentName: string.isRequired,
		type: oneOfType([
			node,
			string,
			shape({
				name: string,
				computed: bool,
				value: oneOfType([
					string,
					array,
					object,
				])
			})
		]).isRequired
	},

	render() {
		const {
			componentName,
			type
		} = this.props;

		if (!type) {
			console.error(`It looks like there's an issue with ${componentName}'s props. One common cause of this issue is when the getDefaultProps method defines a default value for a prop that is not explicitly defined in the propTypes map.`);
			return null;
		}

		// If type.value exists it means there are multiple children and we need to
		// recurse
		if (_.isPlainObject(type.value) || _.isArray(type.value)) {
			return (
				<div>
					{type.name === 'union' ? 'oneOfType' : type.name}:
					<ul>
						{_.map(type.value, (innerType, index) => {
							return (
								<li key={index}>
									<PropType type={innerType} componentName={componentName} />
								</li>
							);
						})}
					</ul>
				</div>
			)
		}

		return <span>{type.name || type.value || type}</span>;
	}
});

const Component = React.createClass({
	propTypes: {
		params: shape({
			componentName: string.isRequired
		})
	},

	getInitialState() {
		return {
			examples: {
				Foo: { // an example of the shape of this state
					isShown: true
				}
			}
		};
	},

	componentDidMount: handleHighlightCode,
	componentDidUpdate: handleHighlightCode,

	handleShowExample(componentName, exampleName) {
		const path = `${componentName}.${exampleName}`;
		const isShown = _.get(this.state.examples, path, false);
		this.setState({
			examples: _.set(this.state.examples, path, !isShown)
		});
	},

	render() {
		const {
			componentName
		} = this.props.params;

		const component = _.get(docgenMap, componentName, {});
		const childComponents = _.get(component, 'childComponents', []);

		const componentProps = _.chain(docgenMap)
			.get(`${componentName}.props`, [])
			.toPairs() // this turns the object into an array of [propName, propDetails] so we can sort
			.sortBy(x => x[0]) // sort by property name
			.value()

		const descriptionAsHTML = toMarkdown(_.get(docgenMap, `${componentName}.description`));

		const privateString = _.get(docgenMap, `${componentName}.isPrivateComponent`) ? '(private)' : '';

		const composesComponents = _.chain(docgenMap)
			.get(`${componentName}.customData.madeFrom`, null)
			.thru((componentNames) => {
				if (_.isEmpty(componentNames)) {
					return '';
				}

				const composesComponentLinks = componentNames.map((name, index) => (
					<span key={name}>
						<Link to={`/components/${name}`}>
							{name}
						</Link>
						{index == componentNames.length - 1 ? null : ', '}
					</span>
				));

				return (
					<span className='Component-made-from'>
						<span>made from: </span>
						{composesComponentLinks}
					</span>
				);
			})
			.value();

		return (
			<div className='Component'>
				<h2>{componentName} {privateString} {composesComponents}</h2>
				<div dangerouslySetInnerHTML={descriptionAsHTML} />
				<h3>Props</h3>
				<Table style={{width:'100%'}}>
					<Thead>
						<Tr>
							<Th>Name</Th>
							<Th>Type</Th>
							<Th>Required</Th>
							<Th>Default</Th>
							<Th>Description</Th>
						</Tr>
					</Thead>
					<Tbody>
						{_.map(componentProps, ([propName, propDetails]) => {
							if (!propDetails || !propDetails.description) {
								console.error(`Warning: There was an issue with the docs that were generated for component "${componentName}" and prop "${propName}". One reason might be that you have a default value for something that was never declared in propTypes.`);
								return null;
							}

							return (
								<Tr key={propName}>
									<Td>{propName}</Td>
									<Td><PropType type={propDetails.type} componentName={componentName} /></Td>
									<Td>{propDetails.required ? 'yes' : 'no'}</Td>
									<Td>
										{propDetails.defaultValue ?
											<pre>
												<code className='lang-javascript'>
													{_.get(propDetails, 'defaultValue.value', '')}
												</code>
											</pre>
										: null}
									</Td>
									<Td dangerouslySetInnerHTML={{ __html: markdown.toHTML(propDetails.description)}} />
								</Tr>
							);
						})}
					</Tbody>
				</Table>
				{!_.isEmpty(childComponents) ? (
					<section>
						<h3>Child Components</h3>
						{_.map(childComponents, (childComponent) => (
							<section key={childComponent.displayName}>
								<h4>{childComponent.displayName}</h4>
								<div dangerouslySetInnerHTML={toMarkdown(childComponent.description)} />
								{!_.isNil(childComponent.props) ? (
									<Table style={{width:'100%'}}>
										<Thead>
											<Tr>
												<Th>Name</Th>
												<Th>Type</Th>
												<Th>Required</Th>
												<Th>Default</Th>
												<Th>Description</Th>
											</Tr>
										</Thead>
										<Tbody>
											{_.map((_.chain(childComponent)
												.get('props', [])
												.toPairs() // this turns the object into an array of [propName, propDetails] so we can sort
												.sortBy(x => x[0]) // sort by property name
												.value()
											), ([propName, propDetails]) => {
												if (!propDetails || _.isNil(propDetails.description)) {
													console.error(`Warning: There was an issue with the docs that were generated for component "${componentName}.${childComponent.displayName}" and prop "${propName}". One reason might be that you have a default value for something that was never declared in propTypes.`);
													return null;
												}

												return (
													<Tr key={`${childComponent.displayName}-${propName}`}>
														<Td>{propName}</Td>
														<Td><PropType type={propDetails.type} componentName={childComponent.displayName} /></Td>
														<Td>{propDetails.required ? 'yes' : 'no'}</Td>
														<Td>
															{propDetails.defaultValue ?
																<pre>
																	<code className='lang-javascript'>
																		{_.get(propDetails, 'defaultValue.value', '')}
																	</code>
																</pre>
															: null}
														</Td>
														<Td dangerouslySetInnerHTML={{ __html: markdown.toHTML(propDetails.description)}} />
													</Tr>
												);
											})}
										</Tbody>
									</Table>
								) : null}
							</section>
						))}
					</section>
				) : null}
				<h3>Examples</h3>
				<ul className={`Component-examples ${componentName}`}>
					{_.map(_.get(examplesByComponent, componentName, []), (example) => {
						return (
							<li className={`${componentName}-example-${example.name}`} key={example.name}>
								<div className='Component-examples-header'>
									<h4>{example.name}</h4>
									<a href='#' onClick={(event) => {
										event.preventDefault();
										this.handleShowExample(componentName, example.name);
									}}>
									{_.get(this.state.examples, `${componentName}.${example.name}`, false)
										? 'Hide code'
										: 'Show code'
									}
									</a>
								</div>
								{_.get(this.state.examples, `${componentName}.${example.name}`) ?
									<pre><code className='lang-javascript'>{example.source}</code></pre>
								: null}
								<example.Example />
							</li>
						);
					})}
				</ul>
			</div>
		);
	}
});

const App = React.createClass({
	contextTypes: {
		router: object,
	},

	propTypes: {
		children: any,
		location: any,
	},

	goToPath(path) {
		this.context.router.push(path);
	},

	renderCategoryLinks(items) {
		if (_.isPlainObject(items)) {
			const sortedItems = _.chain(items)
				.toPairs()
				.sortBy((pair) => pair[0])
				.value();

			return (
				<VerticalListMenu selectedIndices={[]}>
					{_.map(sortedItems, ([categoryName, kids]) => {
						return (
							<Item hasExpander isActionable={false} key={categoryName}>
								<span>{_.startCase(categoryName)}</span>
								{this.renderCategoryLinks(kids)}
							</Item>
						);
					})}
				</VerticalListMenu>
			);
		}

		return (
			<VerticalListMenu selectedIndices={[]}>
				{_.map(_.sortBy(items), (componentName) => {
					return (
						<Item
							key={componentName}
							onSelect={_.partial(this.goToPath, `/components/${componentName}`)}
							isSelected={this.props.location.pathname === `/components/${componentName}`}
						>
							{componentName}
						</Item>
					);
				})}
			</VerticalListMenu>
		);
	},

	render() {
		const showPrivateComponents = _.get(this, 'props.location.query.private', false);
		const docgenGroups = _.reduce(docgenMap, (acc, value, key) => {
			if (!showPrivateComponents && value.isPrivateComponent) {
				return acc;
			}

			const path = value.customData.categories.join('.');
			const newGroup = _.get(acc, path, []);
			newGroup.push(key);
			return _.set(acc, path, newGroup);
		}, {});

		return (
			<div className='App'>
				<div className='App-sidebar'>
					<Link to='/'>
						{/* `width` helps prevent a FOUC with webpack */}
						<img src='img/logo.svg' width={214} />
					</Link>

					<nav className='App-nav'>
						{this.renderCategoryLinks(docgenGroups)}

						<VerticalListMenu>
							<Item
								onSelect={_.partial(this.goToPath, '/color-palette')}
								isSelected={this.props.location.pathname === '/color-palette'}
							>
								Color Palette
							</Item>
						</VerticalListMenu>
					</nav>
				</div>
				<div className='App-body'>
					{this.props.children}
				</div>
			</div>
		);
	}
});

render((
	<Router history={hashHistory}>
		<Route path='/' component={App}>
			<IndexRoute component={LandingPage} />
			<Route path='/components/:componentName' component={Component}/>
			<Route path='/color-palette' component={ColorPalette}/>
		</Route>
	</Router>
), document.querySelector('#docs'));
