import { IsArray, IsUUID, IsEmail, IsOptional } from 'class-validator';

/**
 * At least one of `user_ids` or `emails` must be provided.
 * Both can be sent simultaneously — they are merged before processing.
 */
export class InviteUsersDto {
    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    user_ids?: string[];

    @IsOptional()
    @IsArray()
    @IsEmail({}, { each: true })
    emails?: string[];
}
