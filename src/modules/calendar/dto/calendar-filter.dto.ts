import { IsOptional, IsEnum, IsString, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { CalendarItemType, CalendarItemVisibility } from '../entities/calendar-item.entity';

export enum CalendarView {
    MONTHLY = 'monthly',
    WEEKLY = 'weekly',
    AGENDA = 'agenda',
}

export enum CalendarSourceFilter {
    IMPORTANT_DATE = 'important_date',
    PERSONAL_SCHEDULE = 'personal_schedule',
    EVENT = 'event',
}

export class CalendarFilterDto {
    @Type(() => Number)
    @IsInt()
    @Min(2020)
    @Max(2100)
    year: number;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(12)
    month: number;

    @IsOptional()
    @IsEnum(CalendarView)
    view?: CalendarView = CalendarView.MONTHLY;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(6)
    week?: number;

    @IsOptional()
    @IsEnum(CalendarSourceFilter)
    source?: CalendarSourceFilter;

    @IsOptional()
    @IsEnum(CalendarItemVisibility)
    visibility?: CalendarItemVisibility;

    @IsOptional()
    @IsString()
    daerah_id?: string;

    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    include_events?: boolean = true;

    @IsOptional()
    @IsString()
    search?: string;
}
