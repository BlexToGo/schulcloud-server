import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { Page } from '@shared/domain/domainobject/page';
import { SchoolDO } from '@shared/domain/domainobject/school.do';
import { UserDO } from '@shared/domain/domainobject/user.do';
import { setupEntities, userDoFactory } from '@shared/testing';
import { schoolDOFactory } from '@shared/testing/factory/domainobject/school.factory';
import { Logger } from '@src/core/logger';
import { SchoolService } from '@src/modules/school';
import { UserService } from '@src/modules/user';
import { ValidationError } from '@shared/common';
import { ICurrentUser } from '@src/modules/authentication';
import { OAuthMigrationError } from '@src/modules/user-login-migration/error/oauth-migration.error';
import { ObjectId } from '@mikro-orm/mongodb';
import { SchoolMigrationService } from './school-migration.service';

describe('SchoolMigrationService', () => {
	let module: TestingModule;
	let service: SchoolMigrationService;

	let userService: DeepMocked<UserService>;
	let schoolService: DeepMocked<SchoolService>;

	beforeAll(async () => {
		module = await Test.createTestingModule({
			providers: [
				SchoolMigrationService,
				{
					provide: SchoolService,
					useValue: createMock<SchoolService>(),
				},
				{
					provide: UserService,
					useValue: createMock<UserService>(),
				},
				{
					provide: Logger,
					useValue: createMock<Logger>(),
				},
			],
		}).compile();

		service = module.get(SchoolMigrationService);
		schoolService = module.get(SchoolService);
		userService = module.get(UserService);

		await setupEntities();
	});

	afterAll(async () => {
		await module.close();
	});

	describe('validateGracePeriod is called', () => {
		describe('when current date is before finalFinish date', () => {
			const setup = () => {
				const oauthMigrationStart = new Date(2023, 2, 26);
				const schoolDO: SchoolDO = schoolDOFactory.buildWithId({
					id: 'schoolId',
					name: 'schoolName',
					officialSchoolNumber: 'officialSchoolNumber',
					externalId: 'firstExternalId',
					oauthMigrationFinished: new Date(2023, 2, 27),
					oauthMigrationFinalFinish: new Date(2023, 3, 27),
					oauthMigrationStart,
				});

				return {
					schoolDO,
				};
			};
			it('should not throw', () => {
				const { schoolDO } = setup();
				jest.useFakeTimers();
				jest.setSystemTime(new Date(2023, 3, 14));

				expect(() => service.validateGracePeriod(schoolDO)).not.toThrow();
			});
		});

		describe('when current date is after finalFinish date', () => {
			const setup = () => {
				const oauthMigrationStart = new Date(2023, 2, 26);
				const schoolDO: SchoolDO = schoolDOFactory.buildWithId({
					id: 'schoolId',
					name: 'schoolName',
					officialSchoolNumber: 'officialSchoolNumber',
					externalId: 'firstExternalId',
					oauthMigrationFinished: new Date(2023, 2, 27),
					oauthMigrationFinalFinish: new Date(2023, 3, 27),
					oauthMigrationStart,
				});

				return {
					schoolDO,
				};
			};

			it('should throw validation error', () => {
				const { schoolDO } = setup();
				jest.useFakeTimers();
				jest.setSystemTime(new Date(2023, 3, 28));

				expect(() => service.validateGracePeriod(schoolDO)).toThrow(
					new ValidationError('grace_period_expired: The grace period after finishing migration has expired')
				);
			});
		});
	});

	describe('schoolToMigrate is called', () => {
		describe('when school number is missing', () => {
			const setup = () => {
				const oauthMigrationStart = new Date(2023, 2, 26);
				const schoolDO: SchoolDO = schoolDOFactory.buildWithId({
					id: 'schoolId',
					name: 'schoolName',
					officialSchoolNumber: 'officialSchoolNumber',
					externalId: 'firstExternalId',
					oauthMigrationFinished: new Date(2023, 2, 27),
					oauthMigrationFinalFinish: new Date(2023, 3, 27),
					oauthMigrationStart,
				});

				const userDO: UserDO = userDoFactory.buildWithId({ schoolId: schoolDO.id }, new ObjectId().toHexString(), {});

				const currentUser: ICurrentUser = {
					userId: userDO.id,
					schoolId: userDO.schoolId,
					systemId: 'systemId',
				} as ICurrentUser;

				return {
					externalId: schoolDO.externalId as string,
					currentUser,
				};
			};

			it('should throw an error', async () => {
				const { currentUser, externalId } = setup();

				const func = () => service.schoolToMigrate(currentUser.userId, externalId, undefined);

				await expect(func()).rejects.toThrow(
					new OAuthMigrationError(
						'Official school number from target migration system is missing',
						'ext_official_school_number_missing'
					)
				);
			});
		});

		describe('when school could not be found with official school number', () => {
			const setup = () => {
				const oauthMigrationStart = new Date(2023, 2, 26);
				const schoolDO: SchoolDO = schoolDOFactory.buildWithId({
					id: 'schoolId',
					name: 'schoolName',
					officialSchoolNumber: 'officialSchoolNumber',
					externalId: 'firstExternalId',
					oauthMigrationFinished: new Date(2023, 2, 27),
					oauthMigrationFinalFinish: new Date(2023, 3, 27),
					oauthMigrationStart,
				});

				const userDO: UserDO = userDoFactory.buildWithId({ schoolId: schoolDO.id }, new ObjectId().toHexString(), {});

				return {
					currentUserId: userDO.id as string,
					officialSchoolNumber: schoolDO.officialSchoolNumber,
					schoolDO,
					externalId: schoolDO.externalId as string,
					userDO,
				};
			};

			it('should throw an error', async () => {
				const { currentUserId, externalId, officialSchoolNumber, userDO, schoolDO } = setup();
				userService.findById.mockResolvedValue(userDO);
				schoolService.getSchoolById.mockResolvedValue(schoolDO);
				schoolService.getSchoolBySchoolNumber.mockResolvedValue(null);

				const func = () => service.schoolToMigrate(currentUserId, externalId, officialSchoolNumber);

				await expect(func()).rejects.toThrow(
					new OAuthMigrationError(
						'Could not find school by official school number from target migration system',
						'ext_official_school_missing'
					)
				);
			});
		});

		describe('when current users school not match with school of to migrate user ', () => {
			const setup = () => {
				const oauthMigrationStart = new Date(2023, 2, 26);
				const schoolDO: SchoolDO = schoolDOFactory.buildWithId({
					id: 'schoolId',
					name: 'schoolName',
					officialSchoolNumber: 'officialSchoolNumber',
					externalId: 'firstExternalId',
					oauthMigrationFinished: new Date(2023, 2, 27),
					oauthMigrationFinalFinish: new Date(2023, 3, 27),
					oauthMigrationStart,
				});

				const userDO: UserDO = userDoFactory.buildWithId({ schoolId: schoolDO.id }, new ObjectId().toHexString(), {});

				return {
					currentUserId: userDO.id as string,
					schoolDO,
					externalId: schoolDO.externalId as string,
					userDO,
				};
			};

			it('should throw an error', async () => {
				const { currentUserId, externalId, schoolDO, userDO } = setup();
				schoolService.getSchoolBySchoolNumber.mockResolvedValue(schoolDO);
				schoolDO.officialSchoolNumber = 'OfficialSchoolnumberMismatch';
				schoolService.getSchoolById.mockResolvedValue(schoolDO);

				userService.findById.mockResolvedValue(userDO);

				const func = () => service.schoolToMigrate(currentUserId, externalId, 'targetSchoolNumber');

				await expect(func()).rejects.toThrow(
					new OAuthMigrationError(
						'Current users school is not the same as school found by official school number from target migration system',
						'ext_official_school_number_mismatch',
						'targetSchoolNumber',
						schoolDO.officialSchoolNumber
					)
				);
			});
		});

		describe('when school was already migrated', () => {
			const setup = () => {
				const oauthMigrationStart = new Date(2023, 2, 26);
				const schoolDO: SchoolDO = schoolDOFactory.buildWithId({
					id: 'schoolId',
					name: 'schoolName',
					officialSchoolNumber: 'officialSchoolNumber',
					externalId: 'firstExternalId',
					oauthMigrationFinished: new Date(2023, 2, 27),
					oauthMigrationFinalFinish: new Date(2023, 3, 27),
					oauthMigrationStart,
				});

				const userDO: UserDO = userDoFactory.buildWithId({ schoolId: schoolDO.id }, new ObjectId().toHexString(), {});

				return {
					currentUserId: userDO.id as string,
					schoolDO,
					externalId: schoolDO.externalId as string,
					userDO,
				};
			};

			it('should return null ', async () => {
				const { currentUserId, externalId, schoolDO, userDO } = setup();
				userService.findById.mockResolvedValue(userDO);
				schoolService.getSchoolById.mockResolvedValue(schoolDO);
				schoolService.getSchoolBySchoolNumber.mockResolvedValue(schoolDO);

				const result: SchoolDO | null = await service.schoolToMigrate(
					currentUserId,
					externalId,
					schoolDO.officialSchoolNumber
				);

				expect(result).toBeNull();
			});
		});

		describe('when school has to be migrated', () => {
			const setup = () => {
				const oauthMigrationStart = new Date(2023, 2, 26);
				const schoolDO: SchoolDO = schoolDOFactory.buildWithId({
					id: 'schoolId',
					name: 'schoolName',
					officialSchoolNumber: 'officialSchoolNumber',
					externalId: 'firstExternalId',
					oauthMigrationFinished: new Date(2023, 2, 27),
					oauthMigrationFinalFinish: new Date(2023, 3, 27),
					oauthMigrationStart,
				});

				const userDO: UserDO = userDoFactory.buildWithId({ schoolId: schoolDO.id }, new ObjectId().toHexString(), {});

				return {
					currentUserId: userDO.id as string,
					schoolDO,
					userDO,
				};
			};

			it('should return migrated school', async () => {
				const { currentUserId, schoolDO, userDO } = setup();
				schoolService.getSchoolById.mockResolvedValue(schoolDO);
				schoolService.getSchoolBySchoolNumber.mockResolvedValue(schoolDO);
				userService.findById.mockResolvedValue(userDO);

				const result: SchoolDO | null = await service.schoolToMigrate(
					currentUserId,
					'newExternalId',
					schoolDO.officialSchoolNumber
				);

				expect(result).toEqual(schoolDO);
			});
		});
	});

	describe('migrateSchool is called', () => {
		describe('when school will be migrated', () => {
			const setup = () => {
				const oauthMigrationStart = new Date(2023, 2, 26);
				const schoolDO: SchoolDO = schoolDOFactory.buildWithId({
					id: 'schoolId',
					name: 'schoolName',
					officialSchoolNumber: 'officialSchoolNumber',
					externalId: 'firstExternalId',
					oauthMigrationFinished: new Date(2023, 2, 27),
					oauthMigrationFinalFinish: new Date(2023, 3, 27),
					oauthMigrationStart,
				});
				const targetSystemId = 'targetSystemId';

				return {
					schoolDO,
					targetSystemId,
					firstExternalId: schoolDO.externalId,
				};
			};

			it('should save the migrated school', async () => {
				const { schoolDO, targetSystemId, firstExternalId } = setup();
				const newExternalId = 'newExternalId';

				await service.migrateSchool(newExternalId, schoolDO, targetSystemId);

				expect(schoolService.save).toHaveBeenCalledWith(
					expect.objectContaining<Partial<SchoolDO>>({
						systems: [targetSystemId],
						previousExternalId: firstExternalId,
						externalId: newExternalId,
					})
				);
			});

			describe('when there are other systems before', () => {
				it('should add the system to migrated school', async () => {
					const { schoolDO, targetSystemId } = setup();
					schoolDO.systems = ['existingSystem'];

					await service.migrateSchool('newExternalId', schoolDO, targetSystemId);

					expect(schoolService.save).toHaveBeenCalledWith(
						expect.objectContaining<Partial<SchoolDO>>({
							systems: ['existingSystem', targetSystemId],
						})
					);
				});
			});

			describe('when there are no systems in School', () => {
				it('should add the system to migrated school', async () => {
					const { schoolDO, targetSystemId } = setup();
					schoolDO.systems = undefined;

					await service.migrateSchool('newExternalId', schoolDO, targetSystemId);

					expect(schoolService.save).toHaveBeenCalledWith(
						expect.objectContaining<Partial<SchoolDO>>({
							systems: [targetSystemId],
						})
					);
				});
			});

			describe('when an error occurred', () => {
				it('should save the old schoolDo (rollback the migration)', async () => {
					const { schoolDO, targetSystemId } = setup();
					schoolService.save.mockRejectedValueOnce(new Error());

					await service.migrateSchool('newExternalId', schoolDO, targetSystemId);

					expect(schoolService.save).toHaveBeenCalledWith(schoolDO);
				});
			});
		});
	});

	describe('completeMigration is called', () => {
		describe('when admin completes the migration', () => {
			const setup = () => {
				const oauthMigrationStart = new Date(2023, 2, 26);
				const schoolDO: SchoolDO = schoolDOFactory.buildWithId({
					id: 'schoolId',
					name: 'schoolName',
					officialSchoolNumber: 'officialSchoolNumber',
					externalId: 'firstExternalId',
					oauthMigrationFinished: new Date(2023, 2, 27),
					oauthMigrationFinalFinish: new Date(2023, 3, 27),
					oauthMigrationStart,
				});

				const userDO: UserDO = userDoFactory.buildWithId({ schoolId: schoolDO.id }, new ObjectId().toHexString(), {});

				return {
					schoolDO,
					schoolId: schoolDO.id as string,
					userDO,
					oauthMigrationStart,
				};
			};

			it('should call getSchoolById on schoolService', async () => {
				const expectedSchoolId = 'expectedSchoolId';
				const migrationStartedAt = new Date();
				const users: Page<UserDO> = new Page([userDoFactory.buildWithId()], 1);
				userService.findUsers.mockResolvedValue(users);

				await service.completeMigration(expectedSchoolId, migrationStartedAt);

				expect(schoolService.getSchoolById).toHaveBeenCalledWith(expectedSchoolId);
			});

			it('should call findUsers on userService', async () => {
				const { schoolId, oauthMigrationStart } = setup();
				const users: Page<UserDO> = new Page([userDoFactory.buildWithId()], 1);
				userService.findUsers.mockResolvedValue(users);

				await service.completeMigration(schoolId, oauthMigrationStart);

				expect(userService.findUsers).toHaveBeenCalledWith({
					schoolId,
					isOutdated: false,
					lastLoginSystemChangeSmallerThan: expect.objectContaining<Date>(oauthMigrationStart) as Date,
				});
			});

			it('should save non migrated user', async () => {
				const { schoolDO, userDO, schoolId } = setup();
				const users: Page<UserDO> = new Page([userDO], 1);
				userService.findUsers.mockResolvedValue(users);
				schoolService.getSchoolById.mockResolvedValue(schoolDO);

				await service.completeMigration(schoolId, schoolDO.oauthMigrationStart);

				expect(userService.saveAll).toHaveBeenCalledWith(
					expect.arrayContaining<UserDO>([
						{
							...users.data[0],
							outdatedSince: schoolDO.oauthMigrationFinished,
						},
					])
				);
			});
		});
	});

	describe('restartMigration is called', () => {
		describe('when admin restarts the migration', () => {
			const setup = () => {
				const oauthMigrationStart = new Date(2023, 2, 26);
				const schoolDO: SchoolDO = schoolDOFactory.buildWithId({
					id: 'schoolId',
					name: 'schoolName',
					officialSchoolNumber: 'officialSchoolNumber',
					externalId: 'firstExternalId',
					oauthMigrationFinished: new Date(2023, 2, 27),
					oauthMigrationFinalFinish: new Date(2023, 3, 27),
					oauthMigrationStart,
				});

				return {
					schoolDO,
				};
			};

			it('should call getSchoolById on schoolService', async () => {
				const expectedSchoolId = 'expectedSchoolId';
				const users: Page<UserDO> = new Page([userDoFactory.buildWithId()], 1);
				userService.findUsers.mockResolvedValue(users);

				await service.restartMigration(expectedSchoolId);

				expect(schoolService.getSchoolById).toHaveBeenCalledWith(expectedSchoolId);
			});

			it('should call findUsers on userService', async () => {
				const { schoolDO } = setup();
				schoolService.getSchoolById.mockResolvedValue(schoolDO);
				const expectedSchoolId = 'expectedSchoolId';
				const users: Page<UserDO> = new Page([userDoFactory.buildWithId({ outdatedSince: new Date(2023, 2, 27) })], 1);
				userService.findUsers.mockResolvedValue(users);

				await service.restartMigration(expectedSchoolId);

				expect(userService.findUsers).toHaveBeenCalledWith({
					schoolId: expectedSchoolId,
					outdatedSince: schoolDO.oauthMigrationFinished,
				});
			});

			it('should save migrated user with removed outdatedSince entry', async () => {
				const expectedSchoolId = 'expectedSchoolId';
				const users: Page<UserDO> = new Page([userDoFactory.buildWithId()], 1);
				userService.findUsers.mockResolvedValue(users);

				await service.restartMigration(expectedSchoolId);

				expect(userService.saveAll).toHaveBeenCalledWith(
					expect.arrayContaining<UserDO>([
						{
							...users.data[0],
							outdatedSince: undefined,
						},
					])
				);
			});
		});
	});
});
