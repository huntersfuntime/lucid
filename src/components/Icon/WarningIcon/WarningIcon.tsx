import _ from 'lodash';
import React from 'react';
import Icon, { IIconProps, propTypes as iconPropTypes } from '../Icon';
import { lucidClassNames } from '../../../util/style-helpers';
import { omitProps } from '../../../util/component-types';

const cx = lucidClassNames.bind('&-WarningIcon');

interface IWarningIconProps extends IIconProps {}

export const WarningIcon = ({
	className,
	isClickable,
	isDisabled,
	...passThroughs
}: IWarningIconProps) => {
	return (
		<Icon
			{...omitProps(
				passThroughs,
				undefined,
				_.keys(WarningIcon.propTypes),
				false
			)}
			{..._.pick(passThroughs, _.keys(iconPropTypes))}
			isClickable={isClickable}
			isDisabled={isDisabled}
			className={cx(
				'&',
				isDisabled && '&-is-disabled',
				isClickable && '&-is-clickable',
				className
			)}
		>
			<path className={cx('&-background')} d='M.5 15h15L8 .5z' />
			<path className={cx('&-mark')} d='M7.99 5v4' />
			<circle className={cx('&-mark')} cx='7.99' cy='12' r='.293' />
		</Icon>
	);
};

WarningIcon.displayName = 'WarningIcon';
WarningIcon.peek = {
	description: `
		A warning Icon.
	`,
	categories: ['visual design', 'icons'],
	extend: 'Icon',
	madeFrom: ['Icon'],
};
WarningIcon.propTypes = iconPropTypes;
WarningIcon.defaultProps = Icon.defaultProps;

export default WarningIcon;
