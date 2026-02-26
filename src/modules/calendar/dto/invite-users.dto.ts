import { IsArray, IsUUID } from 'class-validator';

export class InviteUsersDto {
    @IsArray()
    @IsUUID('4', { each: true })
    user_ids: string[];
}
