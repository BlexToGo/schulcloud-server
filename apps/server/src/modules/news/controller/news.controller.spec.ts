import { createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { NewsUc } from '../uc';
import { NewsController } from './news.controller';

describe('NewsController', () => {
	let controller: NewsController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [NewsController],
			providers: [
				{
					provide: NewsUc,
					useValue: createMock<NewsUc>(),
				},
			],
		}).compile();

		controller = module.get(NewsController);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});
});
