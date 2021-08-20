import { EntityId, TestHelper, BaseEntity } from '@shared/domain';

import { Submission, Task, UserTaskInfo, LessonTaskInfo, ITaskParent, IParentDescriptionsProperties } from '../entity';

class TaskParent extends BaseEntity implements ITaskParent {
	public studentNumber = 10;

	public userIdWithWritePermissions: EntityId | undefined;

	hasWritePermission(userId: EntityId): boolean {
		const hasWritePermission = this.userIdWithWritePermissions === userId;
		return hasWritePermission;
	}

	getDescriptions(): IParentDescriptionsProperties {
		return {
			id: this.id,
			color: 'FFFFFF',
			name: 'Parent',
		};
	}

	getStudentsNumber(): number {
		return this.studentNumber;
	}
}

export class TaskTestHelper extends TestHelper<UserTaskInfo, EntityId> {
	createSchool(): EntityId {
		return this.createEntityId();
	}

	createUser(): UserTaskInfo {
		const user = new UserTaskInfo({ lastName: '', firstName: '' });
		this.addId(user);
		return user;
	}

	createTaskParent(parentId?: EntityId, studentNumber = 10): TaskParent {
		const parent = new TaskParent();
		parent.id = parentId || this.createEntityId();
		parent.studentNumber = studentNumber;
		return parent;
	}

	createTask(parentId?: EntityId, dueDate?: Date): Task {
		const id = parentId || this.createEntityId();
		const task = new Task({ name: '', parentId: id, dueDate });
		this.addId(task);
		return task;
	}

	createLessonWithTask(): { task: Task; lesson: LessonTaskInfo; parentId: EntityId } {
		const parentId = this.createEntityId();
		const lesson = new LessonTaskInfo({ courseId: parentId });
		this.addId(lesson);
		const task = new Task({ name: '', parentId, lesson });
		this.addId(task);
		return { task, lesson, parentId };
	}

	createSubmission(task: Task, student?: UserTaskInfo): Submission {
		const user = student || this.getFirstUser();
		const submission = new Submission({ student: user, comment: '', task });
		this.addId(submission);
		return submission;
	}

	createTeamMemberSubmission(task: Task, students: UserTaskInfo[]): Submission {
		const submission = new Submission({ student: students[0], comment: '', task, teamMembers: students });
		this.addId(submission);
		return submission;
	}

	createSubmissionsForEachStudent(task: Task): Submission[] {
		const submissions = this.getUsers().map((student) => {
			const submission = this.createSubmission(task, student);
			return submission;
		});
		return submissions;
	}
}
