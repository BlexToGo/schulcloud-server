import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { MikroORM } from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';
import { ForbiddenException, NotImplementedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Actions, ALL_RULES, BaseEntity } from '@shared/domain';
import { courseFactory, schoolFactory, setupEntities, taskFactory, userFactory } from '@shared/testing';
import { AuthorizationService } from './authorization.service';
import { AllowedAuthorizationEntityType } from './interfaces';
import { ReferenceLoader } from './reference.loader';

class TestEntity extends BaseEntity {}

describe('authorization.service', () => {
	let orm: MikroORM;
	let service: AuthorizationService;
	let loader: DeepMocked<ReferenceLoader>;

	beforeAll(async () => {
		orm = await setupEntities();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthorizationService,
				...ALL_RULES,
				{
					provide: ReferenceLoader,
					useValue: createMock<ReferenceLoader>(),
				},
			],
		}).compile();

		service = await module.get(AuthorizationService);
		loader = await module.get(ReferenceLoader);
	});

	afterAll(async () => {
		await orm.close();
	});

	describe('hasPermission', () => {
		it('throw an error if no rule exist', () => {
			const user = userFactory.build();
			const entity = new TestEntity();

			const exec = () => {
				service.hasPermission(user, entity, { action: Actions.write, requiredPermissions: [] });
			};
			expect(exec).toThrowError(NotImplementedException);
		});

		it('can resolve tasks', () => {
			const user = userFactory.build();
			const task = taskFactory.build({ creator: user });

			const response = service.hasPermission(user, task, { action: Actions.write, requiredPermissions: [] });
			expect(response).toBe(true);
		});

		it('can resolve courses', () => {
			const user = userFactory.build();
			const course = courseFactory.build({ teachers: [user] });

			const response = service.hasPermission(user, course, { action: Actions.write, requiredPermissions: [] });
			expect(response).toBe(true);
		});

		it('can resolve school', () => {
			const school = schoolFactory.build();
			const user = userFactory.build({ school });

			const response = service.hasPermission(user, school, { action: Actions.write, requiredPermissions: [] });
			expect(response).toBe(true);
		});

		it('can resolve user', () => {
			const user = userFactory.build();

			const response = service.hasPermission(user, user, { action: Actions.write, requiredPermissions: [] });
			expect(response).toBe(true);
		});
	});

	describe('hasPermissionByReferences', () => {
		it('should call ReferenceLoader.getUserWithPermissions', async () => {
			const userId = new ObjectId().toHexString();
			const entityName = AllowedAuthorizationEntityType.Course;
			const entityId = new ObjectId().toHexString();
			const spy = jest.spyOn(service, 'hasPermission');
			spy.mockReturnValue(true);
			await service.hasPermissionByReferences(userId, entityName, entityId, {
				action: Actions.read,
				requiredPermissions: [],
			});
			expect(loader.getUserWithPermissions).lastCalledWith(userId);
		});
		it('should call ReferenceLoader.loadEntity', async () => {
			const userId = new ObjectId().toHexString();
			const entityName = AllowedAuthorizationEntityType.Course;
			const entityId = new ObjectId().toHexString();
			const spy = jest.spyOn(service, 'hasPermission');
			spy.mockReturnValue(true);

			await service.hasPermissionByReferences(userId, entityName, entityId, {
				action: Actions.read,
				requiredPermissions: [],
			});
			expect(loader.loadEntity).lastCalledWith(entityName, entityId);
		});
	});

	describe('checkPermissionByReferences', () => {
		it('should call ReferenceLoader.getUserWithPermissions', () => {
			const userId = new ObjectId().toHexString();
			const entityName = AllowedAuthorizationEntityType.Course;
			const entityId = new ObjectId().toHexString();
			const spy = jest.spyOn(service, 'hasPermission');
			spy.mockReturnValue(false);
			void expect(() =>
				service.checkPermissionByReferences(userId, entityName, entityId, {
					action: Actions.read,
					requiredPermissions: [],
				})
			).rejects.toThrowError(ForbiddenException);
		});
	});

	describe('getUserWithPermissions', () => {
		it('should call ReferenceLoader.getUserWithPermissions', async () => {
			const userId = new ObjectId().toHexString();

			await service.getUserWithPermissions(userId);
			expect(loader.getUserWithPermissions).lastCalledWith(userId);
		});
	});
});
