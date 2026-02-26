import {
    IsString,
    IsOptional,
    IsDate,
    IsBoolean,
    IsEnum,
    Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CalendarItemVisibility } from '../entities/calendar-item.entity';

export class UpdateCalendarItemDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    start_date?: Date;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    end_date?: Date;

    @IsOptional()
    @IsBoolean()
    all_day?: boolean;

    @IsOptional()
    @IsString()
    @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex color (e.g. #FF5733)' })
    color?: string;

    @IsOptional()
    @IsEnum(CalendarItemVisibility)
    visibility?: CalendarItemVisibility;

    @IsOptional()
    @IsString()
    daerah_id?: string;
}
