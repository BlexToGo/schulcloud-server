import { Account } from '@shared/domain';
import { AccountDto } from '../services/dto/account.dto';

export class AccountEntityToDtoMapper {
	static mapToDto(account: Account): AccountDto {
		return new AccountDto({
			id: account.id,
			createdAt: account.createdAt,
			updatedAt: account.updatedAt,
			userId: account.userId?.toString(),
			username: account.username,
			activated: account.activated,
			credentialHash: account.credentialHash,
			expiresAt: account.expiresAt,
			lasttriedFailedLogin: account.lasttriedFailedLogin,
			password: account.password,
			systemId: account.systemId?.toString(),
			token: account.token,
		});
	}

	static mapSearchResult(accountEntities: [Account[], number]) {
		const foundAccounts = accountEntities[0];
		const accountDtos: AccountDto[] = AccountEntityToDtoMapper.mapAccountsToDto(foundAccounts);
		return { accounts: accountDtos, total: accountEntities[1] };
	}

	static mapAccountsToDto(accounts: Account[]): AccountDto[] {
		return accounts.map((accountEntity) => AccountEntityToDtoMapper.mapToDto(accountEntity));
	}
}
