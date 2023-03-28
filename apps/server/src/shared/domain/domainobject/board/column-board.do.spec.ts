import { BoardNodeBuilderImpl } from '@shared/domain/entity/boardnode/board-node-builder-impl';
import { cardFactory, columnBoardFactory, columnFactory } from '@shared/testing';
import { ColumnBoard } from './column-board.do';

describe(ColumnBoard.name, () => {
	const setup = () => {
		const board = columnBoardFactory.build();
		const column = columnFactory.build();
		const builder = new BoardNodeBuilderImpl();

		return { board, column, builder };
	};

	it('should be able to add children', () => {
		const { board, column } = setup();

		board.addChild(column);

		expect(board.children[board.children.length - 1]).toEqual(column);
	});

	it('should call the specific builder method', () => {
		const { board, builder } = setup();
		jest.spyOn(builder, 'buildColumnBoardNode');

		board.useBoardNodeBuilder(builder);

		expect(builder.buildColumnBoardNode).toHaveBeenCalledWith(board);
	});

	describe('when adding a child', () => {
		it('should throw error on unsupported child type', () => {
			const { board } = setup();
			const card = cardFactory.build();
			expect(() => board.addChild(card)).toThrowError();
		});
	});
});
