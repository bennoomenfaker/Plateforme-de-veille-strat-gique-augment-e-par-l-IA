import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export class CreatePerimeterDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  name: string;

  @IsEnum(['GEOGRAPHIC', 'SECTORAL'], { message: 'Type invalide : GEOGRAPHIC ou SECTORAL' })
  type: string;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsString()
  parent_id?: string;

  @IsOptional()
  @IsString()
  objective_id?: string;

  @IsOptional()
  @IsString()
  axis_id?: string;
}
