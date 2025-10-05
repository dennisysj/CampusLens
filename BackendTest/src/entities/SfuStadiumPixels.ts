import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('sfu_stadium_pixels')
export class SfuStadiumPixels {
  @PrimaryColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'integer' })
  pixel_column: number;

  @Column({ type: 'integer' })
  pixel_row: number;

  @Column({ type: 'double precision' })
  longitude: number;

  @Column({ type: 'double precision' })
  latitude: number;

  @Column({ type: 'double precision' })
  pixel_value: number;

  @Column({ type: 'geometry' })
  geom_utm: string;

  @Column({ type: 'geometry' })
  geom_wgs84: string;
}
