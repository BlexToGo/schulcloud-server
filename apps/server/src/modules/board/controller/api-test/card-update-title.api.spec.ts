import { EntityManager } from '@mikro-orm/mongodb';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiValidationError } from '@shared/common';
import { CardNode } from '@shared/domain';
import {
	cardNodeFactory,
	cleanupCollections,
	columnBoardNodeFactory,
	columnNodeFactory,
	mapUserToCurrentUser,
	userFactory,
} from '@shared/testing';
import { ICurrentUser } from '@src/modules/authentication';
import { JwtAuthGuard } from '@src/modules/authentication/guard/jwt-auth.guard';
import { ServerTestModule } from '@src/modules/server/server.module';
import { Request } from 'express';
import request from 'supertest';

const baseRouteName = '/cards';

class API {
	app: INestApplication;

	constructor(app: INestApplication) {
		this.app = app;
	}

	async updateCardTitle(cardId: string, title: string) {
		const response = await request(this.app.getHttpServer())
			.put(`${baseRouteName}/${cardId}/title`)
			.set('Accept', 'application/json')
			.send({ title });

		return {
			error: response.body as ApiValidationError,
			status: response.status,
		};
	}
}

describe(`card update title (api)`, () => {
	let app: INestApplication;
	let em: EntityManager;
	let currentUser: ICurrentUser;
	let api: API;

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			imports: [ServerTestModule],
		})
			.overrideGuard(JwtAuthGuard)
			.useValue({
				canActivate(context: ExecutionContext) {
					const req: Request = context.switchToHttp().getRequest();
					req.user = currentUser;
					return true;
				},
			})
			.compile();

		app = module.createNestApplication();
		await app.init();
		em = module.get(EntityManager);
		api = new API(app);
	});

	afterAll(async () => {
		await app.close();
	});

	const setup = async () => {
		await cleanupCollections(em);
		const user = userFactory.build();

		const columnBoardNode = columnBoardNodeFactory.buildWithId();
		const columnNode = columnNodeFactory.buildWithId({ parent: columnBoardNode });
		const cardNode = cardNodeFactory.buildWithId({ parent: columnNode });

		await em.persistAndFlush([user, cardNode, columnNode, columnBoardNode]);
		em.clear();

		return { user, cardNode };
	};

	describe('with valid user', () => {
		it('should return status 200', async () => {
			const { user, cardNode } = await setup();
			currentUser = mapUserToCurrentUser(user);
			const newTitle = 'new title';

			const response = await api.updateCardTitle(cardNode.id, newTitle);

			expect(response.status).toEqual(200);
		});

		it('should actually change the column title', async () => {
			const { user, cardNode } = await setup();
			currentUser = mapUserToCurrentUser(user);
			const newTitle = 'new title';

			await api.updateCardTitle(cardNode.id, newTitle);

			const result = await em.findOneOrFail(CardNode, cardNode.id);

			expect(result.title).toEqual(newTitle);
		});
	});

	// TODO: add tests for permission checks... during their implementation
});
