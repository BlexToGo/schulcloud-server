import { BaseWithTimestampsDO } from './base.do';

export class LtiToolDO extends BaseWithTimestampsDO {
	name: string;

	oAuthClientId?: string;

	secret?: string;

	constructor(props: LtiToolDO) {
		super(props);
		this.name = props.name;
		this.oAuthClientId = props.oAuthClientId;
		this.secret = props.secret;
	}
}
