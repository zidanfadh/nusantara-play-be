import { IsOptional, IsString, IsInt, IsDateString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { CalendarSourceFilter } from './calendar-filter.dto';

export class AgendaFilterDto {
    @IsDateString()
    startDate: string;

    @IsDateString()
    endDate: string;

    @IsOptional()
    @IsEnum(CalendarSourceFilter)
    source?: CalendarSourceFilter;

    @IsOptional()
    @IsString()
    daerah_id?: string;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    limit?: number = 20;
}
