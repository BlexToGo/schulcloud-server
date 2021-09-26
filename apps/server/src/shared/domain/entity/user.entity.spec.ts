import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryDatabaseModule } from '@src/modules/database';
import { User } from './user.entity';
import { userFactory } from '../factory';

describe('User Entity', () => {
	let module: TestingModule;

	beforeAll(async () => {
		module = await Test.createTestingModule({ imports: [MongoMemoryDatabaseModule.forRoot()] }).compile();
	});

	afterAll(async () => {
		await module.close();
	});

	describe('constructor', () => {
		it('should throw an error by empty constructor', () => {
			// @ts-expect-error: Test case
			const test = () => new User();
			expect(test).toThrow();
		});

		it('should create a user by passing required properties', () => {
			const user = userFactory.build();
			expect(user instanceof User).toEqual(true);
		});
	});
});
