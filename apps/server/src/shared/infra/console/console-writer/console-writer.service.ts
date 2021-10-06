import { Injectable } from '@nestjs/common';
import { createSpinner } from 'nestjs-console';

@Injectable()
/**
 * Console writer service using ora spinner internally.
 */
export class ConsoleWriterService {
	spinner = createSpinner();

	info(text: string): void {
		this.spinner.info(text);
	}
}
