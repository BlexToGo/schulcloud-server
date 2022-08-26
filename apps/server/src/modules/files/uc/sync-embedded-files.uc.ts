/* istanbul ignore file */

import { ObjectId } from '@mikro-orm/mongodb';
import { Injectable } from '@nestjs/common';
import { FileRecordParentType, IComponentProperties, Lesson, Task } from '@shared/domain';
import { Logger } from '@src/core/logger/logger.service';
import _ from 'lodash';
import { EmbeddedFilesRepo, fileUrlRegex } from '../repo/embedded-files.repo';
import { AvailableSyncEntityType, AvailableSyncParentType, SyncFileItem } from '../types';
import { SyncFilesMetadataService } from './sync-files-metadata.service';
import { SyncFilesStorageService } from './sync-files-storage.service';

@Injectable()
export class SyncEmbeddedFilesUc {
	failedIds: ObjectId[] = [];

	constructor(
		private embeddedFilesRepo: EmbeddedFilesRepo,
		private logger: Logger,
		private syncFilesMetaDataService: SyncFilesMetadataService,
		private syncFilesStorageService: SyncFilesStorageService
	) {}

	async syncFilesForParentType(type: AvailableSyncParentType, limit = 1000) {
		await this.embeddedFilesRepo.createBackUpCollection(type);
		await this.syncEmbeddedFiles(type, limit);
	}

	private async syncEmbeddedFiles(type: AvailableSyncParentType, limit: number) {
		const [entities, count] = await this.embeddedFilesRepo.findElementsToSyncFiles(type, limit, this.failedIds);

		this.logger.log(`Found ${entities.length} ${type} descriptions with embedded files.`);

		const promises = entities.map(async (entity: AvailableSyncEntityType) => {
			const fileIds = this.extractFileIds(entity);

			const files = await this.embeddedFilesRepo.findFiles(fileIds, entity._id, type);
			return this.syncFiles(files, entity);
		});

		await Promise.all(promises);
		if (count > 0) {
			await this.syncEmbeddedFiles(type, limit);
		}
		return true;
	}

	private extractFileIds(entity: AvailableSyncEntityType): ObjectId[] {
		const fileIds: string[] = [];

		if (entity instanceof Lesson) {
			entity.contents.forEach((item: IComponentProperties) => {
				if (item.content === undefined || !('text' in item.content)) {
					return;
				}

				const contentFileIds = this.extractFileIdsFromContent(item.content.text);

				if (contentFileIds !== null) {
					fileIds.push(...contentFileIds);
				}
			});
		}
		if (entity instanceof Task) {
			const contentFileIds = this.extractFileIdsFromContent(entity.description);

			if (contentFileIds !== null) {
				fileIds.push(...contentFileIds);
			}
		}

		return _.uniq(fileIds).map((id) => new ObjectId(id));
	}

	private extractFileIdsFromContent(text: string) {
		const regEx = new RegExp(`(?<=src=${fileUrlRegex}).+?(?=&amp;)`, 'g');
		const contentFileIds = text.match(regEx);

		return contentFileIds;
	}

	private async syncFiles(files: SyncFileItem[], entity: AvailableSyncEntityType) {
		const promises = files.map((file) => this.sync(file, entity));
		await Promise.all(promises);
	}

	private async sync(file: SyncFileItem, entity: AvailableSyncEntityType) {
		try {
			await this.syncFilesMetaDataService.prepareMetaData(file);
			await this.syncFilesStorageService.syncS3File(file);
			await this.syncFilesMetaDataService.persistMetaData(file);
			await this.updateEntityLinks(file, entity);
			this.logger.log(`Synced file ${file.source.id}`);
		} catch (error) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const stack: string = 'stack' in error ? (error as Error).stack : error;
			this.logger.error(file, stack);
			this.failedIds.push(entity._id);
			await this.syncFilesMetaDataService.persistError(file, stack);
		}
	}

	private async updateEntityLinks(file: SyncFileItem, entity: Task | Lesson, errorUrl?: string) {
		if (file.parentType === FileRecordParentType.Lesson && entity instanceof Lesson) {
			entity.contents = entity.contents.map((item: IComponentProperties) => {
				if ('text' in item.content) {
					item.content.text = this.replaceLink(item.content.text, file, errorUrl);
				}

				return item;
			});
			await this.embeddedFilesRepo.updateEntity(entity);
		}

		if (file.parentType === FileRecordParentType.Task && entity instanceof Task) {
			entity.description = this.replaceLink(entity.description, file, errorUrl);
			await this.embeddedFilesRepo.updateEntity(entity);
		}
	}

	private replaceLink(text: string, file: SyncFileItem, errorUrl?: string) {
		const regex = new RegExp(`${fileUrlRegex}${file.source.id}.+?"`, 'g');
		const newUrl = errorUrl || `"/api/v3/file/download/${file.fileRecord.id}/${file.fileRecord.name}"`;
		return text.replace(regex, newUrl);
	}
}