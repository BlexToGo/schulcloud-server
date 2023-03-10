import { Configuration } from '@hpi-schul-cloud/commons/lib';
import {
	BadRequestException,
	Injectable,
	InternalServerErrorException,
	UnprocessableEntityException,
} from '@nestjs/common';
import { SchoolDO } from '@shared/domain/domainobject/school.do';
import { SchoolService } from '@src/modules/school';
import { SystemDto, SystemService } from '@src/modules/system/service';
import { SystemTypeEnum } from '@src/shared/domain/types';
import { UserDO } from '@shared/domain/domainobject/user.do';
import { Logger } from '@src/core/logger';
import { AccountService } from '@src/modules/account/services/account.service';
import { AccountDto } from '@src/modules/account/services/dto';
import { UserService } from '@src/modules/user/service/user.service';
import { PageContentDto } from './dto/page-content.dto';
import { PageTypes } from '../interface/page-types.enum';
import { MigrationDto } from './dto/migration.dto';

@Injectable()
export class UserMigrationService {
	private readonly hostUrl: string;

	private readonly publicBackendUrl: string;

	private readonly dashboardUrl: string = '/dashboard';

	private readonly logoutUrl: string = '/logout';

	private readonly loginUrl: string = '/login';

	constructor(
		private readonly schoolService: SchoolService,
		private readonly systemService: SystemService,
		private readonly userService: UserService,
		private readonly logger: Logger,
		private readonly accountService: AccountService
	) {
		this.hostUrl = Configuration.get('HOST') as string;
		this.publicBackendUrl = Configuration.get('PUBLIC_BACKEND_URL') as string;
	}

	async isSchoolInMigration(officialSchoolNumber: string): Promise<boolean> {
		const school: SchoolDO | null = await this.schoolService.getSchoolBySchoolNumber(officialSchoolNumber);
		const isInMigration: boolean = !!school?.oauthMigrationPossible || !!school?.oauthMigrationMandatory;
		return isInMigration;
	}

	async getMigrationRedirect(officialSchoolNumber: string, originSystemId: string): Promise<string> {
		const school: SchoolDO | null = await this.schoolService.getSchoolBySchoolNumber(officialSchoolNumber);
		const oauthSystems: SystemDto[] = await this.systemService.findByType(SystemTypeEnum.OAUTH);
		const sanisSystem: SystemDto | undefined = oauthSystems.find(
			(system: SystemDto): boolean => system.alias === 'SANIS'
		);
		const iservSystem: SystemDto | undefined = oauthSystems.find(
			(system: SystemDto): boolean => system.alias === 'Schulserver'
		);

		if (!iservSystem?.id || !sanisSystem?.id) {
			throw new InternalServerErrorException(
				'Unable to generate migration redirect url. Iserv or Sanis system information is invalid.'
			);
		}

		const url = new URL('/migration', this.hostUrl);
		url.searchParams.append('sourceSystem', iservSystem.id);
		url.searchParams.append('targetSystem', sanisSystem.id);
		url.searchParams.append('origin', originSystemId);
		url.searchParams.append('mandatory', (!!school?.oauthMigrationMandatory).toString());
		return url.toString();
	}

	async getPageContent(pageType: PageTypes, sourceId: string, targetId: string): Promise<PageContentDto> {
		const sourceSystem: SystemDto = await this.systemService.findById(sourceId);
		const targetSystem: SystemDto = await this.systemService.findById(targetId);

		const targetSystemLoginUrl: string = this.getLoginUrl(targetSystem);

		switch (pageType) {
			case PageTypes.START_FROM_TARGET_SYSTEM: {
				const sourceSystemLoginUrl: string = this.getLoginUrl(sourceSystem, targetSystemLoginUrl.toString());

				const content: PageContentDto = new PageContentDto({
					proceedButtonUrl: sourceSystemLoginUrl.toString(),
					cancelButtonUrl: this.loginUrl,
				});
				return content;
			}
			case PageTypes.START_FROM_SOURCE_SYSTEM: {
				const content: PageContentDto = new PageContentDto({
					proceedButtonUrl: targetSystemLoginUrl.toString(),
					cancelButtonUrl: this.dashboardUrl,
				});
				return content;
			}
			case PageTypes.START_FROM_SOURCE_SYSTEM_MANDATORY: {
				const content: PageContentDto = new PageContentDto({
					proceedButtonUrl: targetSystemLoginUrl.toString(),
					cancelButtonUrl: this.logoutUrl,
				});
				return content;
			}
			default: {
				throw new BadRequestException('Unknown PageType requested');
			}
		}
	}

	// TODO: https://ticketsystem.dbildungscloud.de/browse/N21-632 Move Redirect Logic URLs to Client
	getMigrationRedirectUri(): string {
		const combinedUri = new URL(this.publicBackendUrl);
		combinedUri.pathname = `api/v3/sso/oauth/migration`;
		return combinedUri.toString();
	}

	async migrateUser(currentUserId: string, externalUserId: string, targetSystemId: string): Promise<MigrationDto> {
		const userDO: UserDO = await this.userService.findById(currentUserId);
		const account: AccountDto = await this.accountService.findByUserIdOrFail(currentUserId);
		const userDOCopy: UserDO = { ...userDO };
		const accountCopy: AccountDto = { ...account };

		try {
			userDO.previousExternalId = userDO.externalId;
			userDO.externalId = externalUserId;
			userDO.lastLoginSystemChange = new Date();
			await this.userService.save(userDO);
			account.systemId = targetSystemId;
			await this.accountService.save(account);

			// TODO: https://ticketsystem.dbildungscloud.de/browse/N21-632 Move Redirect Logic URLs to Client
			const userMigrationDto: MigrationDto = new MigrationDto({
				redirect: `${this.hostUrl}/migration/succeed`,
			});
			return userMigrationDto;
		} catch (e: unknown) {
			await this.userService.save(userDOCopy);
			await this.accountService.save(accountCopy);

			this.logger.log({
				message: 'This error occurred during migration of User:',
				affectedUserId: currentUserId,
				error: e,
			});

			// TODO: https://ticketsystem.dbildungscloud.de/browse/N21-632 Move Redirect Logic URLs to Client
			const userMigrationDto: MigrationDto = new MigrationDto({
				redirect: `${this.hostUrl}/dashboard`,
			});
			return userMigrationDto;
		}
	}

	private getLoginUrl(system: SystemDto, postLoginRedirect?: string): string {
		if (!system.oauthConfig || !system.id) {
			throw new UnprocessableEntityException(`System ${system?.id || 'unknown'} has no oauth config`);
		}

		const loginUrl: URL = new URL(`api/v3/sso/login/${system.id}`, this.publicBackendUrl);
		if (postLoginRedirect) {
			loginUrl.searchParams.append('postLoginRedirect', postLoginRedirect);
		} else {
			loginUrl.searchParams.append('migration', 'true');
		}

		return loginUrl.toString();
	}
}
