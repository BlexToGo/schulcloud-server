import { Injectable } from '@nestjs/common';
import { BaseDORepo, EntityProperties } from '@shared/repo/base.do.repo';
import { EntityName } from '@mikro-orm/core';
import { LtiToolDO } from '@shared/domain/domainobject/ltitool.do';
import { ILtiToolProperties, LtiTool } from '@shared/domain/index';

@Injectable()
export class LtiToolRepo extends BaseDORepo<LtiToolDO, LtiTool, ILtiToolProperties> {
	get entityName(): EntityName<LtiTool> {
		return LtiTool;
	}

	getConstructor(): { new (I): LtiTool } {
		return LtiTool;
	}

	async findByName(name: string): Promise<LtiToolDO> {
		const entity = await this._em.findOneOrFail(LtiTool, { name });

		return this.mapEntityToDO(entity);
	}

	protected mapEntityToDO(entity: LtiTool): LtiToolDO {
		return new LtiToolDO({
			id: entity.id,
			createdAt: entity.createdAt,
			updatedAt: entity.updatedAt,
			name: entity.name,
		});
	}

	protected mapDOToEntity(entityDO: LtiToolDO): EntityProperties<LtiToolDO> {
		return {
			id: entityDO.id,
			name: entityDO.name,
		};
	}
}